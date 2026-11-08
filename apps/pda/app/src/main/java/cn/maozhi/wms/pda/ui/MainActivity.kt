package cn.maozhi.wms.pda.ui

import android.app.AlertDialog
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import cn.maozhi.wms.pda.auth.SessionStore
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.network.ApiClient
import cn.maozhi.wms.pda.scan.PlanRepository
import cn.maozhi.wms.pda.scan.ScanRepository
import cn.maozhi.wms.pda.scan.SubmissionRepository
import cn.maozhi.wms.pda.scan.SyncRepository
import cn.maozhi.wms.pda.scan.CatalogRepository
import cn.maozhi.wms.pda.scan.HandoffRepository
import cn.maozhi.wms.pda.sync.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private val session by lazy { SessionStore(this) }
    private val dao by lazy { AppStore.get(this).dao() }
    private val api by lazy { ApiClient(session) }
    private lateinit var body: LinearLayout
    private lateinit var notice: TextView
    private var busy = false
    private var selectedLine: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (session.token().isEmpty()) showLogin() else perform {
            if (session.selectedPlan.isEmpty()) showPlans() else showScan()
            SyncWorker.schedule(this@MainActivity)
        }
    }
    private fun page(): LinearLayout {
        val root = Ui.column(this)
        root.setBackgroundColor(Ui.teal)
        notice = Ui.text(root, "本地合成环境 · 非生产作业", 14f)
        notice.setTextColor(android.graphics.Color.WHITE)
        notice.setPadding(Ui.dp(this, 18), Ui.dp(this, 10), Ui.dp(this, 18), Ui.dp(this, 10))
        val scroll = ScrollView(this)
        scroll.setBackgroundColor(android.graphics.Color.rgb(243, 246, 245))
        body = Ui.column(this)
        scroll.addView(body)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        return body
    }
    private fun perform(action: suspend () -> Unit): Boolean {
        if (busy) {
            if (::notice.isInitialized) notice.text = "正在处理，请等待后重试；输入未提交。"
            return false
        }
        busy = true
        lifecycleScope.launch {
            try { action() }
            catch (error: Exception) {
                if (!::notice.isInitialized) page()
                notice.text = "未完成：${error.message}。本机记录保留，可重试或重新登录。"
                notice.setTextColor(android.graphics.Color.rgb(168, 44, 44))
            } finally { busy = false }
        }
        return true
    }
    private fun showLogin() {
        LoginScreen.render(page(), session.endpoint) { credentials -> perform { login(credentials) } }
    }
    private suspend fun login(credentials: Credentials) {
        session.endpoint = credentials.endpoint
        val result = withContext(Dispatchers.IO) {
            api.post("/auth/login", JSONObject().put("username", credentials.username)
                .put("password", credentials.password).put("channel", "pda").toString()) as JSONObject
        }
        session.save(result.getString("token"))
        showPlans()
        refresh()
        showPlans()
        SyncWorker.schedule(this)
    }
    private suspend fun showPlans() {
        val plans = withContext(Dispatchers.IO) { dao.plans() }
        PlanScreen.render(page(), plans, PlanActions(
            open = { id -> session.selectedPlan = id; perform { showScan() } },
            refresh = { perform { refresh(); showPlans() } }, logout = { logout() },
        ))
    }
    private suspend fun refresh() = withContext(Dispatchers.IO) {
        PlanRepository(dao, api).refresh()
        CatalogRepository(dao, api).refresh()
        HandoffRepository(dao, api, session).exchange()
    }
    private suspend fun showScan() {
        val id = session.selectedPlan
        val model = withContext(Dispatchers.IO) { Pair(JSONObject(dao.plan(id)?.json ?: error("计划未缓存")), dao.facts(id)) }
        val version = withContext(Dispatchers.IO) { dao.currentCatalog() }
        val parent = page()
        Ui.text(parent, "本机目录 v${version?.version ?: "未下载"} · ${if(version?.verified == true) "完整校验" else "旧缓存待交接"} · 离线可作业", 14f)
        ScanScreen.render(parent, model, selectedLine, ScanActions(
            scan = { barcode -> perform { scan(id, barcode) } },
            line = { selectedLine = it },
            recheck = { perform { withContext(Dispatchers.IO) {
                HandoffRepository(dao, api, session).recheck(); HandoffRepository(dao, api, session).exchange()
            }; showScan(); notice.text = "新交接清单已上报，请在 Web 核验" } },
            refreshCatalog = { perform { withContext(Dispatchers.IO) { CatalogRepository(dao, api).refresh(); HandoffRepository(dao, api, session).exchange() }; showScan() } },
            sync = { perform { withContext(Dispatchers.IO) { HandoffRepository(dao, api, session).exchange(); SyncRepository(dao, api).sync(id) }; showScan() } },
            records = { perform { showRecords() } }, freeze = { freezeDialog(model.first) },
            home = { session.selectedPlan = ""; perform { showPlans() } },
        ))
    }
    private suspend fun scan(id: String, barcode: String) {
        val message = withContext(Dispatchers.IO) { ScanRepository(dao, session).enqueue(id, barcode, selectedLine) }
        showScan()
        notice.text = "✓ $message"
        SyncWorker.schedule(this)
    }
    private suspend fun showRecords() {
        val facts = withContext(Dispatchers.IO) { dao.facts(session.selectedPlan) }
        val parent = page()
        Ui.title(parent, "本机扫码记录")
        Ui.text(parent, "待补传 ${facts.count { it.state == "pending" }} · 失败/响应待核实 ${facts.count { it.state == "failed" }} · 冲突 ${facts.count { it.state == "conflict" }}", 14f)
        Ui.text(parent, "丢响应须联网核验，不能按本机失败条数推断。Web 交接清单支持按原单批量确认。", 14f)
        if (facts.isEmpty()) Ui.text(parent, "暂无本机记录")
        facts.forEach { fact ->
            val card = Ui.card(parent)
            Ui.text(card, fact.barcode)
            val raw = JSONObject(fact.payload)
            val state = mapOf("pending" to "待补传", "failed" to "失败/响应待核实", "conflict" to "冲突待处理", "synced" to "服务端已收妥")[fact.state] ?: fact.state
            Ui.text(card, "$state · ${raw.getLong("weightGrams") / 1000.0} kg · v${raw.getInt("catalogVersion")}", 15f)
            if (fact.error.isNotEmpty()) Ui.text(card, fact.error, 14f)
        }
        Ui.button(parent, "返回连续扫码") { perform { showScan() } }
    }
    private fun freezeDialog(plan: JSONObject) {
        AlertDialog.Builder(this).setTitle("差异核对 / 冻结")
            .setMessage("计划 ${plan.getInt("plannedPackages")} 包 / ${ScanScreen.tonnes(plan.getLong("plannedWeightGrams"))} 吨\n" +
                "服务端已收 ${plan.getInt("actualPackages")} 包 / ${ScanScreen.tonnes(plan.getLong("actualWeightGrams"))} 吨\n" +
                "本机未同步、冲突或计划差异会阻止冻结。冻结不会扣库存。")
            .setNegativeButton("继续核对", null).setPositiveButton("确认冻结") { _, _ -> perform {
                withContext(Dispatchers.IO) { SubmissionRepository(dao, api).freeze(session.selectedPlan) }
                showScan(); notice.text = "扫码已冻结，待 Web 确认出库。"
            } }.show()
    }
    private fun logout() {
        AlertDialog.Builder(this).setTitle("退出登录？").setMessage("扫码队列与本机记录保留。")
            .setNegativeButton("取消", null).setPositiveButton("退出") { _, _ -> perform {
                withContext(Dispatchers.IO) { runCatching { api.post("/auth/logout", "{}") } }
                session.clear(); showLogin()
            } }.show()
    }
}
