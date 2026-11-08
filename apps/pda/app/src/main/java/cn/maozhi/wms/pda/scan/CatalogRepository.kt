package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.*
import cn.maozhi.wms.pda.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.security.MessageDigest
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

object CatalogHash {
    fun sha(text: String): String = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
    fun entries(items: List<LocalCatalogEntry>): String {
        val rows = JSONArray()
        items.sortedBy { it.barcode }.forEach { rows.put(JSONArray().put(it.barcode).put(it.sourceSpec ?: JSONObject.NULL).put(it.weightGrams)) }
        // Android JSON escapes slash; the server's JSON.stringify does not.
        return sha(rows.toString().replace("\\/", "/"))
    }
}
class CatalogRepository(private val dao: ScanDao, private val api: ApiClient) {
    suspend fun refresh() = mutex.withLock {
        val manifest = api.get("/scan/catalog/manifest") as JSONObject
        require(manifest.getString("hashVersion") == "json-entries-v1") { "目录校验协议不支持" }
        val version = manifest.getInt("versionId")
        val items = download(version, manifest)
        require(items.size == manifest.getInt("entryCount") && items.map { it.barcode }.toSet().size == items.size) { "目录条数不完整或重复" }
        require(CatalogHash.entries(items) == manifest.getString("contentSha256")) { "目录校验失败，原版本仍可扫码" }
        dao.activate(LocalCatalogVersion(version, items.size, manifest.getString("contentSha256"), true), items)
        version
    }
    private fun download(version: Int, manifest: JSONObject): List<LocalCatalogEntry> {
        val items = mutableListOf<LocalCatalogEntry>(); var after = ""
        do {
            val page = api.get("/scan/catalog/versions/$version/entries?limit=1000&afterBarcode=${URLEncoder.encode(after, "UTF-8")}") as JSONObject
            require(page.getInt("versionId") == version && page.getString("contentSha256") == manifest.getString("contentSha256") &&
                page.getInt("entryCount") == manifest.getInt("entryCount")) { "目录分页版本不一致" }
            val rows = page.getJSONArray("items")
            for (i in 0 until rows.length()) {
                val r = rows.getJSONObject(i)
                require(r.getInt("catalogVersion") == version && r.getLong("weightGrams") > 0 && r.getLong("weightGrams") % 100 == 0L) { "目录条目无效" }
                items.add(LocalCatalogEntry(version, r.getString("barcode"), if (r.isNull("sourceSpec")) null else r.getString("sourceSpec"), r.getLong("weightGrams"), null))
            }
            val next = if (page.isNull("nextBarcode")) null else page.getString("nextBarcode")
            require(next == null || next > after) { "目录分页游标没有前进" }
            require(items.size <= manifest.getInt("entryCount")) { "目录超过声明条数" }
            after = next ?: ""
        } while (after.isNotEmpty())
        return items
    }
    companion object { private val mutex = Mutex() }
}
