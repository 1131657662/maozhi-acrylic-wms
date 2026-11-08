package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.BuildConfig
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.*
import cn.maozhi.wms.pda.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class HandoffRepository(private val dao: ScanDao, private val api: ApiClient, private val session: SessionStore) {
    suspend fun exchange() = mutex.withLock {
        val local = dao.handoff() ?: snapshot()
        val id = JSONObject(local.header).getString("id")
        api.post("/scan/handoffs", local.header)
        if (!local.registered) register(id, JSONArray(local.records))
        dao.saveHandoff(local.copy(registered = true))
        enrich(id)
    }
    suspend fun recheck() = mutex.withLock {
        val old = dao.handoff()
        if (old != null) {
            val result = api.get("/scan/handoffs/${JSONObject(old.header).getString("id")}") as JSONObject
            require(!result.getJSONObject("summary").isNull("confirmedAt")) { "原交接尚未完成，请补传或在 Web 核验，不能丢弃原清单" }
        }
        snapshot(replace = true)
    }
    private suspend fun snapshot(replace: Boolean = false): LocalHandoff {
        val version = dao.currentCatalog() ?: error("交接前须同步完整目录，旧队列仍保留")
        require(version.verified) { "交接前须校验本地目录，旧队列仍保留" }
        val records = JSONArray(); val manifest = JSONArray()
        for (fact in dao.allFacts().sortedBy { it.id }) {
            val sha = CatalogHash.sha(fact.payload)
            val row = JSONObject().put("planId", fact.planId).put("rawPayload", fact.payload).put("payloadSha", sha).put("localState", fact.state)
            dao.context(fact.id)?.let { row.put("context", JSONObject(it.json)) }
            records.put(row); manifest.put(JSONArray().put(fact.id).put(fact.planId).put(sha))
        }
        val header = JSONObject().put("id", UUID.randomUUID().toString()).put("deviceId", session.deviceId)
            .put("appVersion", BuildConfig.VERSION_NAME).put("expectedCount", records.length())
            .put("manifestSha", CatalogHash.sha(manifest.toString().replace("\\/", "/")))
            .put("catalogVersion", version.version).put("catalogSha", version.sha).put("previousSessionHashes", session.previousSessionHashes())
        val candidate = LocalHandoff(header = header.toString(), records = records.toString(), registered = false)
        if (replace) { dao.saveHandoff(candidate); return candidate }
        return dao.firstHandoff(candidate)
    }
    private fun register(id: String, records: JSONArray) {
        for (start in 0 until records.length() step 3) {
            val batch = JSONArray()
            for (i in start until minOf(start + 3, records.length())) batch.put(records.getJSONObject(i))
            api.post("/scan/handoffs/$id/records", JSONObject().put("records", batch).toString())
        }
    }
    private suspend fun enrich(id: String) {
        var page = 1
        do {
            val result = api.get("/scan/handoffs/$id?page=$page") as JSONObject
            val rows = result.getJSONArray("items")
            for (i in 0 until rows.length()) {
                val r = rows.getJSONObject(i)
                if (!r.isNull("context")) {
                    val factId = r.getString("factId")
                    val c = r.getJSONObject("context"); val old = dao.context(factId)
                    if (old == null) dao.sealContext(LocalFactContext(factId, c.toString()))
                    else require(sameContext(JSONObject(old.json), c)) { "交接上下文冲突，原事实保留" }
                }
            }
            page++
        } while ((page - 1) * 100 < result.getInt("total"))
    }
    private fun sameContext(a: JSONObject, b: JSONObject): Boolean = listOf("outboundLineId", "sourceSpec", "resolvedAt")
        .all { a.opt(it).toString() == b.opt(it).toString() }
    companion object { private val mutex = Mutex() }
}
