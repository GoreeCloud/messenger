package com.goreecloud.messenger

import org.matrix.rustcomponents.sdk.Client
import org.matrix.rustcomponents.sdk.ClientBuilder
import org.matrix.rustcomponents.sdk.CreateRoomParameters
import org.matrix.rustcomponents.sdk.Membership
import org.matrix.rustcomponents.sdk.MessageType
import org.matrix.rustcomponents.sdk.MsgLikeKind
import org.matrix.rustcomponents.sdk.RoomPreset
import org.matrix.rustcomponents.sdk.RoomVisibility
import org.matrix.rustcomponents.sdk.SyncListenerV2
import org.matrix.rustcomponents.sdk.SyncResponseV2
import org.matrix.rustcomponents.sdk.SyncSettingsV2
import org.matrix.rustcomponents.sdk.TaskHandle
import org.matrix.rustcomponents.sdk.TextMessageContent
import org.matrix.rustcomponents.sdk.Timeline
import org.matrix.rustcomponents.sdk.TimelineDiff
import org.matrix.rustcomponents.sdk.TimelineItem
import org.matrix.rustcomponents.sdk.TimelineItemContent
import org.matrix.rustcomponents.sdk.TimelineListener
import org.matrix.rustcomponents.sdk.messageEventContentNew
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class Conversation(val id: String, val name: String, val encrypted: Boolean)
data class TimelineEntry(val id: String, val sender: String, val body: String, val own: Boolean)

/**
 * Uses Matrix Rust SDK directly for authentication, sync, timelines and encryption.
 *
 * Current policy is intentionally in-memory only. The SDK's E2EE implementation
 * operates during this one process lifetime, but device keys and room keys are
 * NOT backed up/restored after process death. No device trust claim is made.
 */
class MatrixEngine : AutoCloseable {
    private var client: Client? = null
    private var syncTask: TaskHandle? = null
    private var timelineTask: TaskHandle? = null
    private var timeline: Timeline? = null
    private var selectedRoomId: String? = null
    private val timelineItems = mutableListOf<TimelineItem>()

    val userId: String get() = client?.session()?.userId ?: ""

    suspend fun login(server: String, username: String, password: String, updated: () -> Unit): List<Conversation> =
        withContext(Dispatchers.IO) {
            require(client == null) { "Already connected." }
            val homeserver = HomeserverPolicy.requireHttpsOrigin(server)
            val built = ClientBuilder()
                .homeserverUrl(homeserver)
                .disableWellKnownLookup(true)
                .inMemoryStore()
                .build()
            try {
                built.login(username.trim(), password, "GoreeCloud Messenger Android", null)
                built.syncOnceV2(SyncSettingsV2(timeoutMs = 0UL, fullState = true))
                client = built
                syncTask = built.syncV2(SyncSettingsV2(), object : SyncListenerV2 {
                    override fun onUpdate(response: SyncResponseV2) = updated()
                })
                rooms()
            } catch (failure: Exception) {
                syncTask?.cancel()
                syncTask?.close()
                syncTask = null
                client = null
                built.close()
                throw failure
            }
        }

    suspend fun rooms(): List<Conversation> = withContext(Dispatchers.IO) {
        val active = client ?: return@withContext emptyList()
        active.rooms().filter { it.membership() == Membership.JOINED }
            .map { Conversation(it.id(), it.displayName() ?: it.id(), it.isEncrypted()) }
            .sortedBy { it.name.lowercase() }
    }

    suspend fun createPrivateRoom(name: String): String = withContext(Dispatchers.IO) {
        val active = requireNotNull(client) { "Sign in first." }
        val title = name.trim()
        require(title.isNotEmpty() && title.length <= 90) { "Enter a room name (1–90 characters)." }
        val id = active.createRoom(CreateRoomParameters(
            name = title,
            isEncrypted = true,
            visibility = RoomVisibility.Private,
            preset = RoomPreset.PRIVATE_CHAT,
        ))
        active.awaitRoomRemoteEcho(id)
        id
    }

    suspend fun openRoom(roomId: String, update: (List<TimelineEntry>) -> Unit) = withContext(Dispatchers.IO) {
        timelineTask?.cancel()
        timelineTask?.close()
        timeline?.close()
        timeline = null
        timelineTask = null
        timelineItems.clear()
        selectedRoomId = roomId
        val room = requireNotNull(client?.getRoom(roomId)) { "The room is unavailable." }
        require(room.membership() == Membership.JOINED) { "This room has not been joined." }
        val opened = room.timeline()
        timeline = opened
        timelineTask = opened.addListener(object : TimelineListener {
            override fun onUpdate(diff: List<TimelineDiff>) {
                applyTimelineDiff(timelineItems, diff)
                val visible = timelineItems.mapNotNull { item ->
                    val event = item.asEvent() ?: return@mapNotNull null
                    val kind = (event.content as? TimelineItemContent.MsgLike)?.content?.kind
                    val message = when (kind) {
                        is MsgLikeKind.Message -> kind.content.body
                        is MsgLikeKind.UnableToDecrypt -> "Encrypted message cannot be decrypted on this device."
                        MsgLikeKind.Redacted -> "Message removed."
                        else -> return@mapNotNull null
                    }
                    TimelineEntry(item.uniqueId().id, event.sender, message, event.isOwn)
                }
                update(visible.takeLast(150))
            }
        })
    }

    suspend fun sendEncrypted(roomId: String, body: String) = withContext(Dispatchers.IO) {
        val active = requireNotNull(client) { "Sign in first." }
        val room = requireNotNull(active.getRoom(roomId)) { "The room is no longer available." }
        // Critical: never construct sendable content unless E2EE is confirmed.
        val trimmed = MessagePolicy.requireEncryptedMessage(body, room.isEncrypted())
        require(selectedRoomId == roomId) { "Open the room before sending." }
        val activeTimeline = requireNotNull(timeline) { "Room timeline not loaded." }
        val content = messageEventContentNew(MessageType.Text(TextMessageContent(trimmed, null)))
        try { activeTimeline.send(content) } finally { content.close() }
    }

    suspend fun invite(roomId: String, userId: String) = withContext(Dispatchers.IO) {
        require(Regex("^@[^:\\s]+:[^:\\s]+$").matches(userId) && userId.length <= 255) {
            "Enter a valid Matrix user ID."
        }
        val room = requireNotNull(client?.getRoom(roomId)) { "Room unavailable." }
        require(room.isEncrypted()) { "Invitations from this preview require an encrypted room." }
        room.inviteUserById(userId)
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        val active = client
        try { if (active != null) active.logout() } catch (_: Exception) { /* local session still clears */ }
        finally { close() }
    }

    override fun close() {
        syncTask?.cancel()
        timelineTask?.cancel()
        syncTask?.close()
        timelineTask?.close()
        timeline?.close()
        syncTask = null
        timelineTask = null
        timeline = null
        timelineItems.clear()
        selectedRoomId = null
        // Do not close until after network logout (when explicitly requested).
        client?.close()
        client = null
    }
}

/** Apply the exact diff semantics used by the SDK's vector-based timeline. */
internal fun applyTimelineDiff(items: MutableList<TimelineItem>, diffs: List<TimelineDiff>) {
    for (diff in diffs) {
        when (diff) {
            is TimelineDiff.Append -> items.addAll(diff.values)
            TimelineDiff.Clear -> items.clear()
            is TimelineDiff.PushFront -> items.add(0, diff.value)
            is TimelineDiff.PushBack -> items.add(diff.value)
            TimelineDiff.PopFront -> if (items.isNotEmpty()) items.removeAt(0)
            TimelineDiff.PopBack -> if (items.isNotEmpty()) items.removeAt(items.lastIndex)
            is TimelineDiff.Insert -> if (diff.index.toInt() <= items.size) items.add(diff.index.toInt(), diff.value)
            is TimelineDiff.Set -> if (diff.index.toInt() in items.indices) items[diff.index.toInt()] = diff.value
            is TimelineDiff.Remove -> if (diff.index.toInt() in items.indices) items.removeAt(diff.index.toInt())
            is TimelineDiff.Truncate -> items.subList(diff.length.toInt().coerceAtMost(items.size), items.size).clear()
            is TimelineDiff.Reset -> { items.clear(); items.addAll(diff.values) }
        }
    }
}
