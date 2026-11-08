package cn.maozhi.wms.pda

import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.*
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.*
import kotlinx.coroutines.*
import org.json.JSONObject
import org.junit.Test
import java.net.ServerSocket
import java.util.UUID

class CatalogSafetyTest {
    @Test fun corruptRefreshAndConcurrentHandoff(): Unit = runBlocking(Dispatchers.IO) {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        check(ctx.packageName == "cn.maozhi.wms.pda.b1c2test.debug")
        val name = "catalog-safety-${UUID.randomUUID()}.db"
        val db = Room.databaseBuilder(ctx, AppStore::class.java, name).build(); val dao = db.dao()
        val entry = LocalCatalogEntry(1, "SAFE-1", "隔离规格", 300000, null)
        dao.activate(LocalCatalogVersion(1, 1, CatalogHash.entries(listOf(entry)), true), listOf(entry))
        val plan = JSONObject().put("id", "safe-plan").put("status", "open").put("facts", org.json.JSONArray())
            .put("lines", org.json.JSONArray().put(JSONObject().put("id", "safe-line").put("productCode", "ERP")
                .put("plannedPackages", 1).put("actualPackages", 0)))
        dao.savePlan(CachedPlan("safe-plan", plan.toString()))
        ServerSocket(4310).use { server ->
            val responder = launch(Dispatchers.IO) { repeat(2) { respond(server) } }
            val session = SessionStore(ctx); session.endpoint = "http://127.0.0.1:4310"
            val result = runCatching { CatalogRepository(dao, ApiClient(session)).refresh() }
            check(result.isFailure); check(dao.currentCatalog()!!.version == 1)
            ScanRepository(dao, session).enqueue("safe-plan", "SAFE-1", "safe-line")
            check(dao.allFacts().size == 1);responder.join()
        }
        db.openHelper.writableDatabase.execSQL("CREATE TRIGGER fail_head BEFORE INSERT ON catalog_head_local WHEN NEW.version=2 BEGIN SELECT RAISE(ABORT,'TEST_FAIL_HEAD'); END")
        val next = LocalCatalogEntry(2, "NEXT", "隔离规格", 302000, null)
        check(runCatching { dao.activate(LocalCatalogVersion(2, 1, CatalogHash.entries(listOf(next)), true), listOf(next)) }.isFailure)
        check(dao.currentCatalog()!!.version == 1 && dao.version(2) == null && dao.versionEntry(2, "NEXT") == null)
        check(dao.allFacts().size == 1)
        DeviceEvidence.record("B1C2_LOCAL_TRANSACTION failed_head=rolled_back v2_entries=0 v2_metadata=0 head=v1 facts=unchanged")
        val handoffs = coroutineScope { (1..20).map { async { dao.firstHandoff(LocalHandoff(header = UUID.randomUUID().toString(), records = "[]", registered = false)).header } }.awaitAll() }
        check(handoffs.toSet().size == 1)
        DeviceEvidence.record("B1C2_CATALOG corrupt_hash=refused active_version=1 subsequent_offline_scan=success concurrent_handoff_20=one_manifest")
        db.close();ctx.deleteDatabase(name)
    }
    @Test fun recheckRetainsIncompleteManifest(): Unit = runBlocking(Dispatchers.IO) {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        check(ctx.packageName == "cn.maozhi.wms.pda.b1c2test.debug")
        val name = "recheck-${UUID.randomUUID()}.db"
        val db = Room.databaseBuilder(ctx, AppStore::class.java, name).build(); val dao = db.dao()
        dao.activate(LocalCatalogVersion(1, 0, CatalogHash.entries(emptyList()), true), emptyList())
        val old = LocalHandoff(header = JSONObject().put("id", UUID.randomUUID().toString()).toString(), records = "[]", registered = true)
        dao.saveHandoff(old)
        ServerSocket(4310).use { server ->
            val responder = launch(Dispatchers.IO) {
                for (confirmed in listOf(false, true)) server.accept().use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    while (!input.readLine().isNullOrEmpty()) { }
                    val summary = JSONObject().put("confirmedAt", if (confirmed) "2026-11-08" else JSONObject.NULL)
                    val bytes = JSONObject().put("data", JSONObject().put("summary", summary)).toString().toByteArray()
                    val crlf = 13.toChar().toString() + 10.toChar()
                    val headers = listOf("HTTP/1.1 200 OK", "Content-Length: ${bytes.size}", "Connection: close", "", "").joinToString(crlf)
                    socket.getOutputStream().write(headers.toByteArray())
                    socket.getOutputStream().write(bytes); socket.getOutputStream().flush()
                }
            }
            val session = SessionStore(ctx); session.endpoint = "http://127.0.0.1:4310"
            val repo = HandoffRepository(dao, ApiClient(session), session)
            check(runCatching { repo.recheck() }.isFailure); check(dao.handoff() == old)
            repo.recheck(); check(dao.handoff()!!.header != old.header); responder.join()
        }
        DeviceEvidence.record("B1C2_RECHECK incomplete_manifest=retained confirmed_manifest=new_snapshot")
        db.close(); ctx.deleteDatabase(name)
    }
    private fun respond(server: ServerSocket) {
        server.accept().use { socket ->
            val input = socket.getInputStream().bufferedReader(); val request = input.readLine()
            while (!input.readLine().isNullOrEmpty()) { /* consume HTTP headers */ }
            val body = if (request.contains("manifest"))
                """{"versionId":2,"entryCount":1,"contentSha256":"${"0".repeat(64)}","hashVersion":"json-entries-v1"}"""
            else """{"versionId":2,"entryCount":1,"contentSha256":"${"0".repeat(64)}","nextBarcode":null,"items":[{"barcode":"BAD","sourceSpec":"wrong","weightGrams":301000,"catalogVersion":2}]}"""
            val bytes = "{\"data\":$body}".toByteArray()
            socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
            socket.getOutputStream().write(bytes);socket.getOutputStream().flush()
        }
    }
}
