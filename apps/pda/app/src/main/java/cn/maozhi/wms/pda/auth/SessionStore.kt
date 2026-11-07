package cn.maozhi.wms.pda.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    var endpoint: String
        get() = preferences.getString("endpoint", "http://127.0.0.1:4310")!!
        set(value) { preferences.edit().putString("endpoint", value).apply() }
    val deviceId: String
        get() = preferences.getString("deviceId", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("deviceId", it).commit()
        }
    var selectedPlan: String
        get() = preferences.getString("selectedPlan", "")!!
        set(value) { preferences.edit().putString("selectedPlan", value).apply() }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("wms-session", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder("wms-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            generateKey()
        }
    }

    fun save(token: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        preferences.edit().putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("token", Base64.encodeToString(cipher.doFinal(token.toByteArray()), Base64.NO_WRAP)).commit()
    }
    fun token(): String = runCatching {
        val encrypted = preferences.getString("token", null) ?: return ""
        val iv = Base64.decode(preferences.getString("iv", ""), Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv)) }
        String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)))
    }.getOrDefault("")
    fun clear() { preferences.edit().remove("token").remove("iv").apply() }
}
