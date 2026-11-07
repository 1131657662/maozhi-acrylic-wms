package cn.maozhi.wms.pda

import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.PlanRepository
import cn.maozhi.wms.pda.scan.ScanRepository
import cn.maozhi.wms.pda.scan.SubmissionRepository
import cn.maozhi.wms.pda.scan.SyncRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

class ScanIntegrationTest {
    @Test fun durableQueueUploadsActualWeightWithoutDeductingStock(): Unit = runBlocking(Dispatchers.IO) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = SessionStore(context)
        session.endpoint = "http://127.0.0.1:4310"
        val api = ApiClient(session)
        val auth = api.post("/auth/login", JSONObject().put("username", "owner")
            .put("password", "e2e-only-password").put("channel", "pda").toString()) as JSONObject
        session.save(auth.getString("token"))
        val name = "integration-${UUID.randomUUID()}.db"
        var db = Room.databaseBuilder(context, AppStore::class.java, name).build()
        PlanRepository(db.dao(), api).refresh()
        ScanRepository(db.dao(), session).enqueue("DEMO-002", "DEMO-032-21")
        ScanRepository(db.dao(), session).enqueue("DEMO-002", "DEMO-032-22")
        assertEquals(2, db.dao().pending().size)
        db.close()
        db = Room.databaseBuilder(context, AppStore::class.java, name).build()
        SyncRepository(db.dao(), api).sync()
        assertEquals(0, db.dao().pending().size)
        SubmissionRepository(db.dao(), api).freeze("DEMO-002")
        val plan = api.get("/scan/plans/DEMO-002") as JSONObject
        assertEquals("frozen", plan.getString("status"))
        assertEquals(600000, plan.getInt("actualWeightGrams"))
        val stock = api.get("/stock") as JSONArray
        assertEquals(6, stock.getJSONObject(0).getInt("packages"))
        db.close()
        context.deleteDatabase(name)
    }
}
