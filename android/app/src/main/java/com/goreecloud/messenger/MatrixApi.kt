package com.goreecloud.messenger

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.TimeUnit

/** No token persistence. Native E2EE and secure session recovery are intentionally NOT yet implemented. */
data class MessengerSession(val baseUrl: String, val token: String, val userId: String)
enum class EncryptionStatus { ENCRYPTED, NOT_ENCRYPTED, UNKNOWN }
data class Conversation(val roomId: String, val name: String, val encryption: EncryptionStatus)
data class TimelineEntry(val sender: String, val body: String)

object MatrixApi {
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
        .followRedirects(false).build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    fun validatedHomeserver(raw: String): String {
        val value = raw.trim()
        val uri = URI(value)
        require(uri.scheme.equals("https", ignoreCase = true) &&
            !uri.host.isNullOrBlank() && uri.userInfo == null &&
            uri.query == null && uri.fragment == null &&
            (uri.path.isNullOrEmpty() || uri.path == "/")) {
            "Use an HTTPS homeserver origin without a path, query, or credentials."
        }
        return "https://" + uri.authority
    }

    private fun endpoint(baseUrl: String, segments: List<String>, query: Map<String, String> = emptyMap()): HttpUrl {
        val builder = baseUrl.toHttpUrl().newBuilder()
        for (segment in segments) builder.addPathSegment(segment)
        for ((key, value) in query) builder.addQueryParameter(key, value)
        return builder.build()
    }

    private fun jsonResponse(request: Request): Pair<Int, JSONObject> =
        http.newCall(request).execute().use { response ->
            val content = response.body?.string().orEmpty()
            val body = try { JSONObject(content) } catch (_: Exception) { JSONObject() }
            response.code to body
        }

    private fun authorizedRequest(session: MessengerSession, path: List<String>, query: Map<String, String> = emptyMap()): Request =
        Request.Builder().url(endpoint(session.baseUrl, listOf("_matrix", "client", "v3") + path, query))
            .header("Authorization", "Bearer " + session.token)
            .get().build()

    suspend fun login(rawServer: String, username: String, password: String): MessengerSession = withContext(Dispatchers.IO) {
        val server = validatedHomeserver(rawServer)
        val payload = JSONObject().put("type", "m.login.password")
            .put("identifier", JSONObject().put("type", "m.id.user").put("user", username))
            .put("password", password).toString()
        val request = Request.Builder()
            .url(endpoint(server, listOf("_matrix", "client", "v3", "login")))
            .post(payload.toRequestBody(jsonType)).build()
        val (status, response) = jsonResponse(request)
        if (status !in 200..299) error("Homeserver login failed (HTTP $status).")
        val token = response.optString("access_token")
        val userId = response.optString("user_id")
        require(token.isNotBlank() && userId.isNotBlank()) { "Incomplete homeserver login response." }
        MessengerSession(server, token, userId)
    }

    suspend fun joinedRooms(session: MessengerSession): List<Conversation> = withContext(Dispatchers.IO) {
        val (status, body) = jsonResponse(authorizedRequest(session, listOf("joined_rooms")))
        if (status !in 200..299) error("Could not load rooms (HTTP $status).")
        val rooms = body.optJSONArray("joined_rooms") ?: return@withContext emptyList()
        val result = mutableListOf<Conversation>()
        for (index in 0 until rooms.length()) {
            val id = rooms.optString(index)
            if (id.isBlank()) continue
            val (nameStatus, nameBody) = jsonResponse(authorizedRequest(session, listOf("rooms", id, "state", "m.room.name")))
            val name = if (nameStatus in 200..299) nameBody.optString("name").ifBlank { id } else id
            val (encStatus, _) = jsonResponse(authorizedRequest(session, listOf("rooms", id, "state", "m.room.encryption")))
            val encrypted = when (encStatus) {
                200 -> EncryptionStatus.ENCRYPTED
                404 -> EncryptionStatus.NOT_ENCRYPTED
                else -> EncryptionStatus.UNKNOWN
            }
            result += Conversation(id, name, encrypted)
        }
        result.sortedBy { it.name.lowercase() }
    }

    /** Plaintext is shown only in rooms explicitly confirmed to be unencrypted. */
    suspend fun publicRoomMessages(session: MessengerSession, room: Conversation): List<TimelineEntry> =
        withContext(Dispatchers.IO) {
            require(room.encryption == EncryptionStatus.NOT_ENCRYPTED) { "Encrypted room content is unavailable in the Android preview." }
            val (freshStatus, _) = jsonResponse(authorizedRequest(session, listOf("rooms", room.roomId, "state", "m.room.encryption")))
            require(freshStatus == 404) { "Room encryption state changed. No plaintext was requested." }
            val (status, body) = jsonResponse(
                authorizedRequest(session, listOf("rooms", room.roomId, "messages"), mapOf("dir" to "b", "limit" to "30"))
            )
            if (status !in 200..299) error("Could not fetch messages (HTTP $status).")
            val chunk = body.optJSONArray("chunk") ?: return@withContext emptyList()
            val items = mutableListOf<TimelineEntry>()
            for (index in chunk.length() - 1 downTo 0) {
                val event = chunk.optJSONObject(index) ?: continue
                if (event.optString("type") != "m.room.message") continue
                val data = event.optJSONObject("content") ?: continue
                if (data.optString("msgtype") != "m.text") continue
                items += TimelineEntry(event.optString("sender"), data.optString("body"))
            }
            items
        }

    suspend fun logout(session: MessengerSession) = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(endpoint(session.baseUrl, listOf("_matrix", "client", "v3", "logout")))
            .header("Authorization", "Bearer " + session.token)
            .post("{}".toRequestBody(jsonType)).build()
        try { jsonResponse(request) } catch (_: Exception) { /* In-memory session still cleared by caller. */ }
        Unit
    }
}
