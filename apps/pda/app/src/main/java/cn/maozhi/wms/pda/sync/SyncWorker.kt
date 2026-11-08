package cn.maozhi.wms.pda.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.network.ApiFailure
import cn.maozhi.wms.pda.scan.SyncRepository
import cn.maozhi.wms.pda.scan.HandoffRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val dao = AppStore.get(applicationContext).dao()
            val session = SessionStore(applicationContext)
            val api = ApiClient(session)
            if (dao.currentCatalog()?.verified != true) return@withContext Result.failure()
            HandoffRepository(dao, api, session).exchange()
            SyncRepository(dao, api).sync()
            Result.success()
        } catch (error: ApiFailure) {
            if (error.status in listOf(401, 403, 409, 422)) Result.failure() else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }
    companion object {
        fun schedule(context: Context) {
            val work = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniqueWork("scan-upload", ExistingWorkPolicy.KEEP, work)
        }
    }
}
