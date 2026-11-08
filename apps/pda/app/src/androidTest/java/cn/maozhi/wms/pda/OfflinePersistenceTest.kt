package cn.maozhi.wms.pda
import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.*
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.*
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Test
import java.util.UUID
class OfflinePersistenceTest {
 @Test fun hundredOfflineThenFailedRefresh():Unit=runBlocking(Dispatchers.IO){
  val ctx=InstrumentationRegistry.getInstrumentation().targetContext
  check(ctx.packageName=="cn.maozhi.wms.pda.b1c2test.debug")
  val session=SessionStore(ctx);val api=ApiClient(session)
  check(runCatching{api.get("/health")}.isFailure){"Remove test API reverse tunnel first"}
  val name="offline-${UUID.randomUUID()}.db";var db=Room.databaseBuilder(ctx,AppStore::class.java,name).build()
  val entries=(1..101).map{LocalCatalogEntry(1,"OFFLINE-$it","隔离规格",300000,null)}
  db.dao().activate(LocalCatalogVersion(1,101,CatalogHash.entries(entries),true),entries)
  val plan=JSONObject().put("id","offline").put("status","open").put("facts",JSONArray())
   .put("lines",JSONArray().put(JSONObject().put("id","L").put("productCode","ERP").put("actualPackages",0).put("plannedPackages",101)))
  db.dao().savePlan(CachedPlan("offline",plan.toString()))
  for(i in 1..100)ScanRepository(db.dao(),session).enqueue("offline","OFFLINE-$i","L")
  val before=db.dao().allFacts();val contexts=before.map{db.dao().context(it.id)}
  db.close();db=Room.databaseBuilder(ctx,AppStore::class.java,name).build()
  check(db.dao().allFacts()==before);check(before.map{db.dao().context(it.id)}==contexts)
  check(runCatching{CatalogRepository(db.dao(),api).refresh()}.isFailure)
  ScanRepository(db.dao(),session).enqueue("offline","OFFLINE-101","L")
  check(db.dao().allFacts().size==101 && db.dao().currentCatalog()!!.version==1)
  DeviceEvidence.record("B1C2_OFFLINE network=unreachable scans=100 durable_after_reopen=100/100 contexts=100/100 refresh_failed=true subsequent_scan=101 head=v1")
  db.close();ctx.deleteDatabase(name)
 }
}
