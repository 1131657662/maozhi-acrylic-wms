package cn.maozhi.wms.pda.ui

import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.graphics.Color
import android.content.res.ColorStateList
import cn.maozhi.wms.pda.data.ScanFact
import org.json.JSONObject
import java.util.Locale

data class ScanActions(
    val scan: (String) -> Boolean, val sync: () -> Unit, val records: () -> Unit,
    val freeze: () -> Unit, val home: () -> Unit,
)
object ScanScreen {
    fun render(parent: LinearLayout, model: Pair<JSONObject, List<ScanFact>>, actions: ScanActions) {
        val (plan, facts) = model
        Ui.title(parent, plan.getString("orderNo"))
        Ui.text(parent, "${plan.getString("customerName")} · ${plan.getString("vehicleNo")}")
        val card = Ui.card(parent)
        card.backgroundTintList = ColorStateList.valueOf(Ui.teal)
        val pending = facts.count { it.state != "synced" }
        val remote = plan.getJSONArray("facts")
        val ids = (0 until remote.length()).map { remote.getJSONObject(it).getString("id") }.toSet()
        val localOnly = facts.filter { it.id !in ids && it.state != "conflict" }
        val count = plan.getInt("actualPackages") + localOnly.size
        Ui.title(card, "当前进度 $count / ${plan.getInt("plannedPackages")} 包").setTextColor(Color.WHITE)
        Ui.text(card, "服务端 ${plan.getInt("actualPackages")} 包 · 本机待处理 $pending 条").setTextColor(Color.WHITE)
        Ui.text(card, "${tonnes(plan.getLong("actualWeightGrams"))} 吨已回传 · ${status(plan.getString("status"))}", 14f).setTextColor(Color.WHITE)
        if (plan.getString("status") == "open") barcodeInput(parent, actions)
        Ui.button(parent, "补传 / 同步状态", actions.sync)
        Ui.button(parent, "扫码记录", actions.records)
        Ui.button(parent, "结束核对 · 冻结", actions.freeze).isEnabled = plan.getString("status") == "open"
        Ui.text(parent, "冻结只锁定扫码事实。库存由 Web 确认出库后扣减。", 14f)
        Ui.button(parent, "返回扫码计划", actions.home)
    }
    private fun barcodeInput(parent: LinearLayout, actions: ScanActions) {
        val input = Ui.input(parent, "扫码条码 / 扫码枪回车")
        input.imeOptions = EditorInfo.IME_ACTION_DONE
        val submit = { val value = input.text.toString().trim(); if (actions.scan(value)) input.setText("") }
        input.setOnEditorActionListener { _, actionId, event ->
            val accepted = actionId == EditorInfo.IME_ACTION_DONE ||
                (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_UP)
            if (accepted) submit()
            accepted
        }
        Ui.button(parent, "记录条码", submit)
        input.requestFocus()
    }
    fun tonnes(grams: Long): String = String.format(Locale.ROOT, "%.4f", grams / 1000000.0)
    fun status(value: String): String = when (value) {
        "open" -> "扫码中"
        "frozen" -> "已冻结，待 Web 确认"
        "confirmed" -> "已出库（只读）"
        else -> "未知状态，停止作业"
    }
}
