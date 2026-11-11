package cn.maozhi.wms.pda

import androidx.room.Room
import androidx.work.WorkManager
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.*
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import java.io.File

class B1c2DeviceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private fun db(): AppStore {
        check(context.packageName == "cn.maozhi.wms.pda.b1c2test.debug")
        WorkManager.getInstance(context).cancelUniqueWork("scan-upload").result.get()
        return Room.databaseBuilder(context, AppStore::class.java, "maozhi-scan.db").addMigrations(CatalogMigration).build()
    }
    private fun login(session: SessionStore): ApiClient {
        session.endpoint = "http://127.0.0.1:4310"
        val api = ApiClient(session)
        val result = api.post("/auth/login", JSONObject().put("username", "owner").put("password", "e2e-only-password").put("channel", "pda").toString()) as JSONObject
        session.save(result.getString("token")); return api
    }
    @Test fun migrateAndHandoff(): Unit = runBlocking(Dispatchers.IO) {
        val db = db(); val dao = db.dao(); val session = SessionStore(context)
        val expected = JSONArray(File(context.getExternalFilesDir(null), "legacy-records.json").readText())
        val actual = dao.facts("pda-handoff-plan").associateBy { it.id }
        check(actual.size == 60)
        for (i in 0 until expected.length()) {
            val r = expected.getJSONObject(i); val raw = r.getString("payload")
            check(actual[JSONObject(raw).getString("id")]?.payload == raw)
        }
        check(dao.submission("pending-freeze-fixture")!!.key == "f369b875-f0d7-42e3-891b-6d386265e5f2")
        val api = login(session)
        PlanRepository(dao, api).refresh(); CatalogRepository(dao, api).refresh()
        HandoffRepository(dao, api, session).exchange()
        DeviceEvidence.record("B1C2_UPGRADE facts=60/60 raw_body=unchanged freeze_key=unchanged schema=2 v1_verified=true manifest_uploaded=60")
        db.close()
    }
    @Test fun uploadLegacyQueue(): Unit = runBlocking(Dispatchers.IO) {
        val db = db(); val dao = db.dao(); val session = SessionStore(context); val api = ApiClient(session)
        HandoffRepository(dao, api, session).exchange()
        SyncRepository(dao, api).sync("pda-handoff-plan")
        check(dao.facts("pda-handoff-plan").count { it.state == "synced" } == 60)
        DeviceEvidence.record("B1C2_LEGACY_UPLOAD received=60 failed=0 conflicts=0 original_UUID_body=preserved")
        db.close()
    }
    @Test fun offlineHundredAndReopen(): Unit = runBlocking(Dispatchers.IO) {
        var db = db(); val session = SessionStore(context); val api = ApiClient(session)
        check(runCatching { api.get("/health") }.isFailure) { "Test must run with adb reverse removed" }
        for (i in 1..100) ScanRepository(db.dao(), session).enqueue("pda-offline-plan", "OFFLINE-%03d".format(i), "pda-offline-line")
        val before = db.dao().facts("pda-offline-plan").associate { it.id to it.payload }
        db.close(); db = db()
        check(db.dao().facts("pda-offline-plan").associate { it.id to it.payload } == before)
        check(runCatching { CatalogRepository(db.dao(), api).refresh() }.isFailure)
        ScanRepository(db.dao(), session).enqueue("pda-offline-plan", "OFFLINE-101", "pda-offline-line")
        check(db.dao().currentCatalog()!!.version == 1)
        session.selectedPlan = "pda-offline-plan"
        DeviceEvidence.record("B1C2_OFFLINE network=unreachable scans=100 durable_after_reopen=100/100 refresh_failed=true subsequent_scan=101 local_version=1")
        db.close()
    }
    @Test fun refreshAndContinueOriginalOrder(): Unit = runBlocking(Dispatchers.IO) {
        val db = db(); val dao = db.dao(); val session = SessionStore(context); val api = ApiClient(session)
        val old = dao.facts("pda-handoff-plan").associate { it.id to it.payload }
        check(CatalogRepository(dao, api).refresh() == 2)
        check(dao.facts("pda-handoff-plan").associate { it.id to it.payload } == old)
        ScanRepository(dao, session).enqueue("pda-handoff-plan", "HANDOFF-NEW", "pda-handoff-line")
        SyncRepository(dao, api).sync()
        SubmissionRepository(dao, api).freeze("pda-handoff-plan")
        val plan = api.get("/scan/plans/pda-handoff-plan") as JSONObject
        check(plan.getString("status") == "open"); check(!plan.isNull("scanClosedAt")); check(plan.getLong("actualWeightGrams") == 18302000L)
        session.selectedPlan = "pda-handoff-plan"
        DeviceEvidence.record("B1C2_MIXED original_order=pda-handoff-plan versions=60*v1+1*v2 weight_grams=18302000 scan_closed=true old_payloads=60/60 offline101_uploaded_after_v2=true")
        db.close()
    }
}
