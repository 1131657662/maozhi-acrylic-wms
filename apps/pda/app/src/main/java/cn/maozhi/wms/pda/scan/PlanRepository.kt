package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.CachedPlan
import cn.maozhi.wms.pda.data.CatalogItem
import cn.maozhi.wms.pda.data.ScanDao
import cn.maozhi.wms.pda.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject

class PlanRepository(private val dao: ScanDao, private val api: ApiClient) {
    suspend fun refresh() {
        var page = 1
        do {
            val result = api.get("/scan/plans?page=$page&pageSize=50") as JSONObject
            val rows = result.getJSONArray("items")
            for (i in 0 until rows.length()) {
                val plan = rows.getJSONObject(i)
                val detail = api.get("/scan/plans/${plan.getString("id")}") as JSONObject
                dao.savePlan(CachedPlan(detail.getString("id"), detail.toString()))
            }
            page++
        } while ((page - 1) * 50 < result.getInt("total"))
        val rows = api.get("/scan/catalog") as JSONArray
        val items = (0 until rows.length()).map { i ->
            val row = rows.getJSONObject(i)
            CatalogItem(row.getString("barcode"), row.getString("productCode"), row.getLong("weightGrams"), row.getInt("catalogVersion"))
        }
        dao.saveCatalog(items)
    }
}
