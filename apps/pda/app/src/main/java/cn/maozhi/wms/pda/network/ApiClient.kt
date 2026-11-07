package cn.maozhi.wms.pda.network

import cn.maozhi.wms.pda.auth.SessionStore
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ApiFailure(val status: Int, val code: String, message: String) : Exception(message)
class ApiClient(private val session: SessionStore) {
    private val client = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS).build()
    fun get(path: String): Any = execute(Request.Builder().url(base() + path).get())
    fun post(path: String, json: String, key: String? = null): Any {
        val request = Request.Builder().url(base() + path)
            .post(json.toRequestBody("application/json".toMediaType()))
        if (key != null) request.header("Idempotency-Key", key)
        return execute(request)
    }
    private fun base(): String {
        require(session.endpoint in listOf("http://127.0.0.1:4310", "http://10.0.2.2:4310", "http://localhost:4310")) {
            "本阶段仅允许本机合成 API"
        }
        return session.endpoint + "/api/v1"
    }
    private fun execute(builder: Request.Builder): Any {
        if (session.token().isNotEmpty()) builder.header("Authorization", "Bearer ${session.token()}")
        client.newCall(builder.build()).execute().use { response ->
            val body = JSONObject(response.body?.string() ?: error("服务返回空响应"))
            if (!response.isSuccessful) throw ApiFailure(response.code, body.optString("code"),
                body.optString("message", "服务异常") + " · " + body.optString("traceId").take(8))
            return body.get("data")
        }
    }
}
