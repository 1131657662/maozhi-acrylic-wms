package cn.maozhi.wms.pda.ui

import android.text.InputType
import android.widget.LinearLayout

data class Credentials(val endpoint: String, val username: String, val password: String)
object LoginScreen {
    fun render(parent: LinearLayout, endpoint: String, submit: (Credentials) -> Unit) {
        Ui.title(parent, "茂智腈纶仓")
        Ui.text(parent, "茂智云仓 · 腈纶仓储管理系统", 15f)
        Ui.text(parent, "Maozhi Acrylic Fiber WMS", 14f)
        Ui.text(parent, "本地合成环境 · 扫码事实独立保存", 15f)
        val server = Ui.input(parent, "本地 API 地址").apply { setText(endpoint) }
        val username = Ui.input(parent, "用户名").apply { setText("owner") }
        val password = Ui.input(parent, "密码").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        Ui.button(parent, "登录并下载计划") {
            val credentials = Credentials(server.text.toString().trim(), username.text.toString(), password.text.toString())
            password.setText("")
            submit(credentials)
        }
        Ui.text(parent, "真机先执行 adb reverse tcp:4310 tcp:4310；模拟器可用 10.0.2.2。凭据见项目 .local/demo-access.txt。", 14f)
    }
}
