package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.CatalogItem
import cn.maozhi.wms.pda.data.ScanFact
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

object FactBuilder {
    fun create(planId: String, item: CatalogItem, deviceId: String): ScanFact {
        require(item.weightGrams > 0 && item.weightGrams % 100 == 0L) { "目录缺少有效实重，禁止猜测重量" }
        require(item.catalogVersion == 1) { "目录版本不支持" }
        val id = UUID.randomUUID().toString()
        val json = JSONObject().put("id", id).put("barcode", item.barcode)
            .put("weightGrams", item.weightGrams).put("catalogVersion", item.catalogVersion)
            .put("weightSource", "catalog").put("deviceId", deviceId)
            .put("scannedAt", Instant.now().toString()).put("planVersion", 1)
        return ScanFact(id, planId, item.barcode, json.toString())
    }
}
