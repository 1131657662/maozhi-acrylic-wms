package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.ScanDao
import cn.maozhi.wms.pda.network.ApiClient
import kotlinx.coroutines.CancellationException
import org.json.JSONObject

class NoticeRepository(private val dao: ScanDao, private val api: ApiClient) {
    suspend fun refresh(planId: String) {
        try {
            var after = ""
            do {
                val page = api.get("/scan/plans/$planId/fact-contexts?afterFactId=$after") as JSONObject
                val rows = page.getJSONArray("items")
                for (i in 0 until rows.length()) {
                    val row = rows.getJSONObject(i)
                    dao.notice(row.getString("factId"), if (row.isNull("notice")) "" else row.getString("notice"))
                }
                after = if (page.isNull("nextFactId")) "" else page.getString("nextFactId")
            } while (after.isNotEmpty())
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            for (fact in dao.facts(planId).filter { it.state == "synced" })
                dao.notice(fact.id, "已收妥；版本差异提示暂不可用，联网同步可重试")
        }
    }
}
