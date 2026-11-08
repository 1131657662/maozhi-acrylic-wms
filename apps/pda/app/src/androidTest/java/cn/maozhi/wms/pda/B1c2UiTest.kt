package cn.maozhi.wms.pda
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.NoticeRepository
import cn.maozhi.wms.pda.scan.PlanRepository
import cn.maozhi.wms.pda.ui.MainActivity
import kotlinx.coroutines.*
import org.junit.Test
import java.io.File
class B1c2UiTest {
 @Test fun versionAndDifferenceVisible():Unit=runBlocking(Dispatchers.IO){
  val ins=InstrumentationRegistry.getInstrumentation();val ctx=ins.targetContext
  check(ctx.packageName=="cn.maozhi.wms.pda.b1c2test.debug")
  val session=SessionStore(ctx);session.selectedPlan="pda-handoff-plan"
  val dao=AppStore.get(ctx).dao();val api=ApiClient(session)
  PlanRepository(dao,api).refresh();NoticeRepository(dao,api).refresh("pda-handoff-plan")
  check(dao.facts("pda-handoff-plan").first{it.barcode=="HANDOFF-001"}.error.contains("300→302"))
  val activity=ins.startActivitySync(Intent(ctx,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  suspend fun waitText(value:String){
   val end=System.currentTimeMillis()+10000;var found=false
   while(!found && System.currentTimeMillis()<end){ins.runOnMainSync{found=views(activity.window.decorView).any{it.text.contains(value)}};if(!found)delay(100)}
   check(found){"UI missing: $value"}
  }
  fun shot(name:String){ins.runOnMainSync{val v=activity.window.decorView;val b=Bitmap.createBitmap(v.width,v.height,Bitmap.Config.ARGB_8888)
   v.draw(Canvas(b));File(ctx.getExternalFilesDir(null),name).outputStream().use{b.compress(Bitmap.CompressFormat.PNG,100,it)}}}
  waitText("61 / 61");waitText("本机目录 v2");shot("b1c2-mixed-pda.png")
  ins.runOnMainSync{views(activity.window.decorView).first{it.text.toString()=="扫码记录"}.performClick()}
  waitText("300→302");shot("b1c2-version-notice-pda.png")
  DeviceEvidence.record("B1C2_UI current=v2 original_order=61/61 old_version=v1 weight_notice=300->302 rendered=true")
  ins.runOnMainSync{activity.finish()}
 }
 private fun views(v:View):List<TextView>{
  if(v is TextView)return listOf(v)
  return if(v is ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))} else emptyList()
 }
}
