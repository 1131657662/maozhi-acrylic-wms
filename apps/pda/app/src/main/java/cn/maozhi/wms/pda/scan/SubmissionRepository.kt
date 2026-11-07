package cn.maozhi.wms.pda.scan

import cn.maozhi.wms.pda.data.CachedPlan
import cn.maozhi.wms.pda.data.PendingSubmission
import cn.maozhi.wms.pda.data.ScanDao
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.network.ApiFailure
import org.json.JSONObject
import java.util.UUID

class SubmissionRepository(private val dao: ScanDao, private val api: ApiClient) {
    suspend fun freeze(planId: String) {
        require(dao.facts(planId).all { it.state == "synced" }) { "仍有未同步或冲突记录，不能冻结" }
        val command = dao.submission(planId) ?: createCommand(planId)
        try {
            val result = api.post("/scan/plans/$planId/submit", command.payload, command.key) as JSONObject
            dao.savePlan(CachedPlan(planId, result.toString()))
            dao.removeSubmission(planId)
        } catch (error: ApiFailure) {
            if (error.code in listOf("STALE_PLAN", "PLAN_DIFFERENCE")) dao.removeSubmission(planId)
            throw error
        }
    }
    private suspend fun createCommand(planId: String): PendingSubmission {
        val plan = api.get("/scan/plans/$planId") as JSONObject
        require(plan.getString("status") == "open") { "服务端已冻结或确认，请刷新查看" }
        dao.savePlan(CachedPlan(planId, plan.toString()))
        val body = JSONObject().put("revision", plan.getInt("revision")).put("digest", plan.getString("digest"))
        return PendingSubmission(planId, UUID.randomUUID().toString(), body.toString()).also { dao.saveSubmission(it) }
    }
}
