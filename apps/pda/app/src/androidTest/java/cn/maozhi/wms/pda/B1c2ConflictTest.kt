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
import java.util.UUID
class B1c2ConflictTest {
 @Test fun unknownVersionRetainedWhileOtherFactsProceed():Unit=runBlocking(Dispatchers.IO){
  val ctx=InstrumentationRegistry.getInstrumentation().targetContext
  check(ctx.packageName=="cn.maozhi.wms.pda.b1c2test.debug")
  val name="conflict-${UUID.randomUUID()}.db";var db=Room.databaseBuilder(ctx,AppStore::class.java,name).build()
  val session=SessionStore(ctx);val api=ApiClient(session)
  val bad=FactBuilder.create("pda-offline-plan",CatalogItem("BAD-VERSION","TEST-ERP",300000,999),session.deviceId)
  val good=FactBuilder.create("pda-offline-plan",CatalogItem("OFFLINE-102","TEST-ERP",300000,1),session.deviceId)
  for(f in listOf(bad,good)) db.dao().persist(f,LocalFactContext(f.id,JSONObject().put("outboundLineId","pda-offline-line")
   .put("sourceSpec","交接规格").put("resolvedAt",JSONObject.NULL).toString()))
  check(runCatching{SyncRepository(db.dao(),api).sync()}.isFailure)
  db.close();db=Room.databaseBuilder(ctx,AppStore::class.java,name).build()
  val rows=db.dao().allFacts().associateBy{it.id}
  check(rows[bad.id]!!.state=="conflict" && rows[bad.id]!!.payload==bad.payload)
  check(rows[bad.id]!!.error.contains("未发布或不存在"));check(rows[good.id]!!.state=="synced")
  DeviceEvidence.record("B1C2_CONFLICT unknown_version=409 retained_after_reopen=true original_body=unchanged other_valid_v1=accepted_after_v2")
  db.close();ctx.deleteDatabase(name)
 }
}
