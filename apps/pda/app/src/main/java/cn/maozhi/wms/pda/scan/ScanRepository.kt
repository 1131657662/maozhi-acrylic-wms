package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.ScanDao
import org.json.JSONObject

class ScanRepository(private val dao: ScanDao, private val session: SessionStore) {
    suspend fun enqueue(planId: String, barcode: String): String {
        require(barcode.isNotBlank()) { "请扫描条码" }
        require(dao.findBarcode(barcode) == null) { "本机已记录此条码，请勿重复扫描" }
        val plan = JSONObject(dao.plan(planId)?.json ?: error("请先在线下载计划"))
        require(plan.getString("status") == "open") { "计划已冻结或已出库" }
        require(dao.submission(planId) == null) { "冻结请求待核验，禁止继续扫码" }
        val item = dao.catalogItem(barcode) ?: error("条码不在缓存目录，无法确认实重")
        val lines = plan.getJSONArray("lines")
        val line = (0 until lines.length()).map { lines.getJSONObject(it) }
            .find { it.getString("productCode") == item.productCode } ?: error("商品不属于该计划")
        val facts = dao.facts(planId).filter { it.state != "synced" }
        val localCount = facts.count { dao.catalogItem(it.barcode)?.productCode == item.productCode }
        require(line.getInt("actualPackages") + localCount < line.getInt("plannedPackages")) { "已达到计划包数" }
        val fact = FactBuilder.create(planId, item, session.deviceId)
        dao.insertFact(fact)
        return "已保存至本机：$barcode / ${item.weightGrams / 1000.0} kg"
    }
}
