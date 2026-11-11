package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

class ScanRepository(private val dao: ScanDao, private val session: SessionStore) {
    suspend fun enqueue(planId: String, barcode: String, selectedLine: String? = null): String = mutex.withLock {
        require(barcode.isNotBlank()) { "请扫描条码" }
        require(dao.findBarcode(barcode) == null) { "本机已记录此条码，请勿重复扫描" }
        val plan = JSONObject(dao.plan(planId)?.json ?: error("请先在线下载计划"))
        require(plan.getString("status") == "open" && plan.isNull("scanClosedAt")) { "该单已结束扫码或出库" }
        require(dao.submission(planId) == null) { "结束扫码请求待核验，暂不能继续扫码" }
        val version = dao.currentCatalog() ?: error("请先下载完整目录")
        val item = dao.versionEntry(version.version, barcode) ?: error("本机 v${version.version} 无此条码；联网刷新后可用原单继续扫")
        val line = selectLine(plan, selectedLine, if (version.verified) null else item.legacyProduct)
        checkCapacity(plan, line)
        val fact = FactBuilder.create(planId, CatalogItem(barcode, line.getString("productCode"), item.weightGrams, item.version), session.deviceId)
        val context = if (version.verified) LocalFactContext(fact.id, JSONObject().put("outboundLineId", line.getString("id"))
            .put("sourceSpec", item.sourceSpec ?: JSONObject.NULL).put("resolvedAt", JSONObject(fact.payload).getString("scannedAt")).toString()) else null
        dao.persist(fact, context)
        "已保存至本机：$barcode / ${item.weightGrams / 1000.0} kg · v${item.version}"
    }
    private fun selectLine(plan: JSONObject, selected: String?, legacyProduct: String?): JSONObject {
        val rows = plan.getJSONArray("lines")
        val lines = (0 until rows.length()).map { rows.getJSONObject(it) }
        val line = if (selected != null) lines.singleOrNull { it.getString("id") == selected }
            else if (lines.size == 1) lines.single() else lines.singleOrNull { it.getString("productCode") == legacyProduct }
        require(line != null) { "请先选择原单 ERP 作业行，目录规格不自动映射库存商品" }
        if (legacyProduct != null) require(line.getString("productCode") == legacyProduct) { "旧缓存需先完成目录同步与作业行核验" }
        return line
    }
    private suspend fun checkCapacity(plan: JSONObject, line: JSONObject) {
        val remote = plan.getJSONArray("facts")
        val ids = (0 until remote.length()).map { remote.getJSONObject(it).getString("id") }.toSet()
        val local = dao.facts(plan.getString("id")).filter { it.id !in ids }
        var count = 0
        for (f in local) {
            val context = dao.context(f.id)
            // Unbound legacy records reserve capacity until the original ERP line is verified.
            if (context == null || JSONObject(context.json).getString("outboundLineId") == line.getString("id")) count++
        }
        require(line.getInt("actualPackages") + count < line.getInt("plannedPackages")) { "已达到本行计划包数（含待补传/冲突）" }
    }
    companion object { private val mutex = Mutex() }
}
