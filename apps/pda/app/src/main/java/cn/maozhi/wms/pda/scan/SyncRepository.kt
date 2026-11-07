package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.CachedPlan
import cn.maozhi.wms.pda.data.ScanDao
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.network.ApiFailure
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

class SyncRepository(private val dao: ScanDao, private val api: ApiClient) {
    suspend fun sync() = mutex.withLock {
        for (fact in dao.pending()) {
            try {
                val result = api.post("/scan/plans/${fact.planId}/facts", fact.payload) as JSONObject
                dao.acknowledge(fact.id, CachedPlan(fact.planId, result.toString()))
            } catch (error: ApiFailure) {
                val state = if (error.status in listOf(403, 409, 422)) "conflict" else "failed"
                dao.updateState(fact.id, state, error.message ?: "同步失败")
                throw error
            } catch (error: Exception) {
                dao.updateState(fact.id, "failed", "网络失败，原记录保留")
                throw error
            }
        }
    }
    companion object { private val mutex = Mutex() }
}
