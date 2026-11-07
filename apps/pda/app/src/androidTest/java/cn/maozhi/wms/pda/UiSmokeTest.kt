package cn.maozhi.wms.pda

import android.content.Intent
import android.graphics.Bitmap
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.PlanRepository
import cn.maozhi.wms.pda.ui.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class UiSmokeTest {
    @Test fun keyboardInputSavesFactAndRendersProgress(): Unit = runBlocking(Dispatchers.IO) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = SessionStore(context)
        session.endpoint = "http://127.0.0.1:4310"
        val api = ApiClient(session)
        val login = api.post("/auth/login", JSONObject().put("username", "owner")
            .put("password", "e2e-only-password").put("channel", "pda").toString()) as JSONObject
        session.save(login.getString("token"))
        val dao = AppStore.get(context).dao()
        PlanRepository(dao, api).refresh()
        session.selectedPlan = "DEMO-003"
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        val deadline = System.currentTimeMillis() + 5000
        var field: EditText? = null
        while (field == null && System.currentTimeMillis() < deadline) {
            instrumentation.runOnMainSync { field = input(activity.window.decorView) }
            if (field == null) Thread.sleep(100)
        }
        checkNotNull(field) { "连续扫码输入框未出现" }
        instrumentation.runOnMainSync { field!!.setText("DEMO-032-31"); field!!.onEditorAction(EditorInfo.IME_ACTION_DONE) }
        while (dao.facts("DEMO-003").isEmpty() && System.currentTimeMillis() < deadline) Thread.sleep(100)
        assertTrue(dao.facts("DEMO-003").any { it.barcode == "DEMO-032-31" })
        instrumentation.waitForIdleSync()
        val file = File(context.getExternalFilesDir(null), "pda-scan.png")
        file.outputStream().use { instrumentation.uiAutomation.takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, it) }
        instrumentation.runOnMainSync { activity.finish() }
    }
    private fun input(view: View): EditText? {
        if (view is EditText) return view
        if (view !is ViewGroup) return null
        for (i in 0 until view.childCount) input(view.getChildAt(i))?.let { return it }
        return null
    }
}
