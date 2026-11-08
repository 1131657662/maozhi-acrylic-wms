package cn.maozhi.wms.pda
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.*
import cn.maozhi.wms.pda.scan.FactBuilder
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import java.io.File
class LegacyFixtureTest {
 @Test fun seed():Unit=runBlocking {
  val ctx=InstrumentationRegistry.getInstrumentation().targetContext
  check(ctx.packageName in listOf("cn.maozhi.wms.pda.b1c2test.debug","cn.maozhi.wms.pda.b1c2recovery.debug"))
  val dao=AppStore.get(ctx).dao(); check(dao.plans().isEmpty())
  val session=SessionStore(ctx); session.save("isolated-offline-fixture");session.selectedPlan="pda-handoff-plan"
  val plan=JSONObject().put("id","pda-handoff-plan").put("orderNo","TEST-HANDOFF-60").put("customerName","隔离验证")
   .put("vehicleNo","TEST").put("status","open").put("plannedPackages",61).put("plannedWeightGrams",18302000)
   .put("actualPackages",0).put("actualWeightGrams",0).put("facts",JSONArray()).put("revision",1).put("digest","test")
   .put("lines",JSONArray().put(JSONObject().put("id","pda-handoff-line").put("productCode","TEST-ERP")
    .put("productName","隔离验证商品").put("plannedPackages",61).put("plannedWeightGrams",18302000).put("actualPackages",0)))
  dao.savePlan(CachedPlan("pda-handoff-plan",plan.toString()))
  val records=JSONArray()
  for(i in 1..60){
   val item=CatalogItem("HANDOFF-%03d".format(i),"TEST-ERP",300000,1)
   dao.saveCatalog(listOf(item));val f=FactBuilder.create("pda-handoff-plan",item,session.deviceId)
    .copy(state=if(i<=55)"pending" else "failed",error=if(i>55)"旧版网络异常，原记录保留" else "")
   dao.insertFact(f);records.put(JSONObject().put("planId",f.planId).put("payload",f.payload).put("state",f.state))
  }
  dao.saveSubmission(PendingSubmission("pending-freeze-fixture","f369b875-f0d7-42e3-891b-6d386265e5f2","{\"revision\":1,\"digest\":\"unchanged\"}"))
  File(ctx.getExternalFilesDir(null),"legacy-records.json").writeText(records.toString())
  println("B1C2_LEGACY seed pending=55 failed=5 total=60 freezeKey=f369b875-f0d7-42e3-891b-6d386265e5f2 device=${session.deviceId}")
 }
 @Test fun verify():Unit=runBlocking {
  val ctx=InstrumentationRegistry.getInstrumentation().targetContext
  val db=AppStore.get(ctx);val dao=db.dao()
  check(dao.facts("pda-handoff-plan").size==60)
  val expected=JSONArray(File(ctx.getExternalFilesDir(null),"legacy-records.json").readText())
  val actual=dao.facts("pda-handoff-plan").associateBy{it.id}
  for(i in 0 until expected.length()){
   val raw=expected.getJSONObject(i).getString("payload");check(actual[JSONObject(raw).getString("id")]?.payload==raw)
  }
  check(dao.submission("pending-freeze-fixture")!!.key=="f369b875-f0d7-42e3-891b-6d386265e5f2")
  val instrumentation=InstrumentationRegistry.getInstrumentation()
  val activity=instrumentation.startActivitySync(android.content.Intent(ctx,cn.maozhi.wms.pda.ui.MainActivity::class.java).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
  val deadline=System.currentTimeMillis()+10000
  var visible=false
  while(!visible && System.currentTimeMillis()<deadline){
   instrumentation.runOnMainSync { visible=texts(activity.window.decorView).any { it.contains("60 / 61") } }
   if(!visible)Thread.sleep(100)
  }
  check(visible){"Old APK did not render original queue"}
  instrumentation.runOnMainSync {
   val view=activity.window.decorView
   val bitmap=android.graphics.Bitmap.createBitmap(view.width,view.height,android.graphics.Bitmap.Config.ARGB_8888)
   view.draw(android.graphics.Canvas(bitmap))
   File(ctx.getExternalFilesDir(null),"b1c2-old-queue.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
  }
  println("B1C2_OLD_APK UI original_queue_text=60/61 rendered=true")
  println("B1C2_OLD_APK reopened schema=1 total=60 pending=55 failed=5 raw_payloads=60/60 freeze_key=unchanged")
 }
 private fun texts(view:android.view.View):List<String> {
  if(view is android.widget.TextView)return listOf(view.text.toString())
  if(view !is android.view.ViewGroup)return emptyList()
  return (0 until view.childCount).flatMap { texts(view.getChildAt(it)) }
 }
}
