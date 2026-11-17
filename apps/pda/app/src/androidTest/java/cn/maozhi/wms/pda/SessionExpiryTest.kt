package cn.maozhi.wms.pda

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.data.CatalogItem
import cn.maozhi.wms.pda.data.LocalFactContext
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.network.ApiFailure
import cn.maozhi.wms.pda.scan.FactBuilder
import cn.maozhi.wms.pda.scan.SyncRepository
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class SessionExpiryTest {
    private fun context(): Context {
        val base = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "identity-test-${UUID.randomUUID()}"
        return object : ContextWrapper(base) {
            override fun getSharedPreferences(ignored: String, mode: Int): SharedPreferences =
                base.getSharedPreferences(name, mode)
        }
    }
    private fun unauthorized(beforeResponse: () -> Unit = {}): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor { chain ->
            beforeResponse()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(401)
                .message("Unauthorized").body("{\"code\":\"INVALID_CREDENTIALS\",\"message\":\"拒绝\"}".toResponseBody()).build()
        }.build()

    @Test fun unauthorizedPreservesQueueAcrossReopenAndReauthentication(): Unit = runBlocking {
        val ctx = context()
        val session = SessionStore(ctx)
        val name = "identity-${UUID.randomUUID()}.db"
        var db = Room.databaseBuilder(ctx, AppStore::class.java, name).build()
        val fact = FactBuilder.create("TEST", CatalogItem("LOCAL-1", "ACR-032", 302500, 1), "test-device")
        val context = LocalFactContext(fact.id, "{}")
        try {
            session.save("expired-test-token")
            session.selectedPlan = "TEST"
            val device = session.deviceId
            db.dao().persist(fact, context)
            val error = runCatching { SyncRepository(db.dao(), ApiClient(session, unauthorized())).sync("TEST") }.exceptionOrNull()
            assertEquals(401, (error as ApiFailure).status)
            assertEquals("", session.token())
            assertTrue(SessionStore(ctx).needsReauthentication)
            assertEquals("TEST", session.selectedPlan)
            assertEquals(device, session.deviceId)
            db.close(); db = Room.databaseBuilder(ctx, AppStore::class.java, name).build()
            val queued = db.dao().pending().single()
            assertEquals(fact.id, queued.id)
            assertEquals(fact.payload, queued.payload)
            assertEquals(context, db.dao().context(fact.id))
            session.save("new-test-token")
            assertFalse(session.needsReauthentication)
            assertEquals(queued, db.dao().pending().single())
        } finally {
            db.close(); ctx.deleteDatabase(name)
            ctx.getSharedPreferences("session", Context.MODE_PRIVATE).edit().clear().commit()
        }
    }

    @Test fun lateUnauthorizedAndFailedLoginCannotClearNewCredential() {
        val ctx = context()
        val session = SessionStore(ctx)
        try {
            session.save("old-test-token")
            val api = ApiClient(session, unauthorized { SessionStore(ctx).save("new-test-token") })
            assertTrue(runCatching { api.get("/scan/plans") }.exceptionOrNull() is ApiFailure)
            assertEquals("new-test-token", session.token())
            assertFalse(session.needsReauthentication)
            runCatching { ApiClient(session, unauthorized()).post("/auth/login", "{}") }
            assertEquals("new-test-token", session.token())
            assertFalse(session.needsReauthentication)
        } finally { ctx.getSharedPreferences("session", Context.MODE_PRIVATE).edit().clear().commit() }
    }
}
