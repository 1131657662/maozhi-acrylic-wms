package cn.maozhi.wms.pda.ui

import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.graphics.Color
import android.content.res.ColorStateList
import cn.maozhi.wms.pda.data.ScanFact
import org.json.JSONObject
import java.util.Locale
import android.widget.Spinner
import android.widget.ArrayAdapter
import android.widget.AdapterView
import android.view.View

data class ScanActions(
    val scan: (String) -> Boolean, val sync: () -> Unit, val records: () -> Unit,
    val freeze: () -> Unit, val home: () -> Unit,
    val line: (String?) -> Unit, val refreshCatalog: () -> Unit, val recheck: () -> Unit,
)
object ScanScreen {
    fun render(parent: LinearLayout, model: Pair<JSONObject, List<ScanFact>>, selectedLine: String?, actions: ScanActions) {
        val (plan, facts) = model
        Ui.title(parent, plan.getString("orderNo"))
        Ui.text(parent, "扫码只做计数参考，出库数量以网页填写为准", 15f)
        Ui.text(parent, "${plan.getString("customerName")} · ${plan.getString("vehicleNo")}")
        val card = Ui.card(parent)
        card.backgroundTintList = ColorStateList.valueOf(Ui.teal)
        val pending = facts.count { it.state != "synced" }
        val remote = plan.getJSONArray("facts")
        val ids = (0 until remote.length()).map { remote.getJSONObject(it).getString("id") }.toSet()
        val localOnly = facts.filter { it.id !in ids && it.state != "conflict" }
        val count = plan.getInt("actualPackages") + localOnly.size
        Ui.title(card, "当前进度 $count / ${plan.getInt("plannedPackages")} 包").setTextColor(Color.WHITE)
        Ui.text(card, "已上传 ${plan.getInt("actualPackages")} 包 · 本机待处理 $pending 条").setTextColor(Color.WHITE)
        Ui.text(card, "${tonnes(plan.getLong("actualWeightGrams"))} 吨已回传 · ${status(plan.getString("status"), !plan.isNull("scanClosedAt"))}", 14f).setTextColor(Color.WHITE)
        val canScan = plan.getString("status") == "open" && plan.isNull("scanClosedAt")
        if (canScan) {
            lineSelector(parent, plan, selectedLine, actions.line)
            barcodeInput(parent, actions)
        }
        Ui.button(parent, "上传扫码记录", actions.sync)
        Ui.button(parent, "联网更新条码目录（保留本单与记录）", actions.refreshCatalog)
        Ui.button(parent, "扫码记录", actions.records)
        Ui.button(parent, if (canScan) "结束扫码" else "已结束扫码", actions.freeze).isEnabled = canScan
        Ui.text(parent, "扫码记录用于核对，不会直接扣减库存。", 14f)
        Ui.button(parent, "重新清点交接（保留扫码记录）", actions.recheck)
        Ui.button(parent, "返回扫码计划", actions.home)
    }
    private fun barcodeInput(parent: LinearLayout, actions: ScanActions) {
        val input = Ui.input(parent, "扫码条码 / 扫码枪回车")
        input.imeOptions = EditorInfo.IME_ACTION_DONE
        val submit: () -> Unit = { actions.scan(input.text.toString().trim()); Unit }
        input.setOnEditorActionListener { _, actionId, event ->
            val accepted = actionId == EditorInfo.IME_ACTION_DONE ||
                (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_UP)
            if (accepted) submit()
            accepted
        }
        Ui.button(parent, "记录条码", submit)
        input.requestFocus()
    }
    private fun lineSelector(parent: LinearLayout, plan: JSONObject, selected: String?, choose: (String?) -> Unit) {
        val rows = plan.getJSONArray("lines")
        val lines = (0 until rows.length()).map { rows.getJSONObject(it) }
        Ui.text(parent, "本单商品行（不会自动按条码目录选择商品）", 14f)
        if (lines.size == 1) { choose(lines.single().getString("id")); Ui.text(parent, lines.single().getString("productCode")); return }
        val spinner = Spinner(parent.context)
        spinner.contentDescription = "本单商品行"
        val labels = listOf("请选择出库单商品") + lines.map { "${it.getString("productCode")} · ${it.getInt("plannedPackages")} 包" }
        spinner.adapter = ArrayAdapter(parent.context, android.R.layout.simple_spinner_dropdown_item, labels)
        spinner.setSelection(lines.indexOfFirst { it.getString("id") == selected } + 1)
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(p: AdapterView<*>?) { choose(null) }
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) { choose(lines.getOrNull(pos - 1)?.getString("id")) }
        }
        parent.addView(spinner)
    }
    fun tonnes(grams: Long): String = String.format(Locale.ROOT, "%.4f", grams / 1000000.0)
    fun status(value: String, scanClosed: Boolean = false): String = when {
        value == "open" && scanClosed -> "已结束扫码，待网页确认出库数量"
        value == "open" -> "扫码中"
        value == "frozen" -> "已结束扫码，待网页确认出库数量"
        value == "confirmed" -> "已出库（只读）"
        else -> "状态未识别，停止新增扫码"
    }
}
