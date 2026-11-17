package cn.maozhi.wms.pda.auth

object AuthText {
    const val expired = "登录已过期，请重新登录；本机扫码队列和记录已保留。"
    const val legacyPassword = "当前密码超过安全长度，请到网页个人中心修改密码。"
    const val invalidCredentials = "用户名或密码错误，请重新输入。"
    const val locked = "账号暂时锁定，请稍后重新登录。"
}
