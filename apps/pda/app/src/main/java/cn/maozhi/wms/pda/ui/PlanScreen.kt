package cn.maozhi.wms.pda.ui

import android.widget.LinearLayout
import cn.maozhi.wms.pda.data.CachedPlan
import org.json.JSONObject

data class PlanActions(val open: (String) -> Unit, val refresh: () -> Unit, val logout: () -> Unit)
object PlanScreen {
    fun render(parent: LinearLayout, plans: List<CachedPlan>, actions: PlanActions) {
        Ui.title(parent, "今日作业")
        Ui.text(parent, "已下载计划可离线扫码；上传扫码记录后可结束扫码", 15f)
        Ui.button(parent, "下载 / 刷新计划与目录", actions.refresh)
        if (plans.isEmpty()) Ui.text(parent, "暂无缓存计划，请联网下载")
        for (cached in plans) {
            val plan = JSONObject(cached.json)
            val card = Ui.card(parent)
            Ui.text(card, ScanScreen.status(plan.getString("status"), !plan.isNull("scanClosedAt")), 15f)
            Ui.title(card, plan.getString("orderNo"))
            Ui.text(card, "${plan.getString("customerName")} · 计划 ${plan.getInt("plannedPackages")} 包")
            Ui.button(card, "进入作业") { actions.open(cached.id) }
        }
        Ui.button(parent, "退出登录（本机记录保留）", actions.logout)
    }
}
