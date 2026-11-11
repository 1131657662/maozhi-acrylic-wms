package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.CachedPlan
import cn.maozhi.wms.pda.data.ScanDao
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.network.ApiFailure
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

class SyncRepository(private val dao: ScanDao, private val api: ApiClient) {
    suspend fun sync(planId: String? = null) = mutex.withLock {
        var failed = 0
        val plans = if (planId == null) dao.allFacts().map { it.planId }.toSet() else setOf(planId)
        for (fact in dao.allFacts().filter { it.state != "synced" && (planId == null || it.planId == planId) }) {
            val context = dao.context(fact.id)
            if (context == null) {
                dao.updateState(fact.id, "conflict", "该扫码记录尚未关联商品行；请在网页端交接清单中处理后重试")
                failed++; continue
            }
            val envelope = JSONObject().put("schemaVersion", 2).put("fact", JSONObject(fact.payload)).put("context", JSONObject(context.json)).toString()
            try {
                val result = api.post("/scan/plans/${fact.planId}/facts", envelope) as JSONObject
                dao.acknowledge(fact.id, CachedPlan(fact.planId, result.toString()))
            } catch (error: ApiFailure) {
                val state = if (error.status in listOf(403, 409, 422)) "conflict" else "failed"
                dao.updateState(fact.id, state, error.message ?: "同步失败")
                if (error.status == 401) throw error
                failed++
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                dao.updateState(fact.id, "failed", "上传结果待核对，扫码记录已保留；联网重试会检查记录是否已收到")
                throw error
            }
        }
        for (id in plans) NoticeRepository(dao, api).refresh(id)
        check(failed == 0) { "$failed 条待处理记录保留在冲突队列；其他记录已独立补传" }
    }
    companion object { private val mutex = Mutex() }
}
