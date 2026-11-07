package cn.maozhi.wms.pda.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

object Ui {
    val teal = Color.rgb(16, 89, 87)
    val ink = Color.rgb(23, 60, 59)
    val muted = Color.rgb(102, 126, 122)
    fun dp(context: Context, size: Int): Int = (size * context.resources.displayMetrics.density).toInt()
    fun column(context: Context): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(context, 18), dp(context, 14), dp(context, 18), dp(context, 18))
    }
    fun text(parent: LinearLayout, value: String, size: Float = 17f): TextView = TextView(parent.context).apply {
        text = value; textSize = size; setTextColor(ink)
        setPadding(0, dp(context, 8), 0, dp(context, 8))
        parent.addView(this)
    }
    fun title(parent: LinearLayout, value: String): TextView = text(parent, value, 25f).apply {
        setTypeface(null, Typeface.BOLD)
    }
    fun card(parent: LinearLayout): LinearLayout = column(parent.context).apply {
        background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(context, 16).toFloat() }
        val params = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        params.bottomMargin = dp(context, 14)
        parent.addView(this, params)
    }
    fun button(parent: LinearLayout, label: String, click: () -> Unit): Button = Button(parent.context).apply {
        text = label; textSize = 19f; isAllCaps = false; minHeight = dp(context, 60)
        setTextColor(Color.WHITE)
        backgroundTintList = android.content.res.ColorStateList.valueOf(teal)
        val params = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        params.topMargin = dp(context, 8)
        parent.addView(this, params)
        setOnClickListener { click() }
    }
    fun input(parent: LinearLayout, label: String): EditText = EditText(parent.context).apply {
        hint = label; textSize = 18f; setSingleLine(true); minHeight = dp(context, 56)
        contentDescription = label
        parent.addView(this)
    }
}
