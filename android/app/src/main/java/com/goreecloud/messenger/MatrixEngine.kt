package com.goreecloud.messenger

import android.content.Context

import org.matrix.rustcomponents.sdk.Client
import org.matrix.rustcomponents.sdk.ClientBuilder
import org.matrix.rustcomponents.sdk.SqliteStoreBuilder
import org.matrix.rustcomponents.sdk.CreateRoomParameters
import org.matrix.rustcomponents.sdk.EventOrTransactionId
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
data class EmojiReaction(val emoji: String, val count: Int, val reactedByMe: Boolean)
data class TimelineEntry(
    val id: String,
    val sender: String,
    val body: String,
    val own: Boolean,
    val remoteEventId: String?,
    val reactions: List<EmojiReaction>,
)

/**
 * Native Matrix Rust SDK client with Android Keystore-encrypted SQLite storage.
 *
 * Device keys persist on this Android installation but CANNOT yet be recovered
 * on a replacement device. Neither trusted cross-signing nor key backup exists.
 * Log out erases the local encrypted store and its Keystore wrapping key.
 */
class MatrixEngine(context: Context) : AutoCloseable {
    private val vault = AndroidSessionVault(context.applicationContext)
    private var client: Client? = null
    private var syncTask: TaskHandle? = null
    private var timelineTask: TaskHandle? = null
    private var timeline: Timeline? = null
    private val timelineLock = Any()
    private var generation = 0L
    private var selectedRoomId: String? = null
    private val timelineItems = mutableListOf<TimelineItem>()

    fun hasStoredSession() = vault.hasSession()
    fun hasOrphanedLocalData() = vault.hasLocalDeviceData() && !vault.hasSession()

    private suspend fun buildClient(server: String): Client {
        val key = vault.storeKey()
        try {
            return ClientBuilder()
                .homeserverUrl(HomeserverPolicy.requireHttpsOrigin(server))
                .disableWellKnownLookup(true)
                .sessionPaths(vault.dataPath, vault.cachePath)
                .sqliteStore(SqliteStoreBuilder(vault.dataPath, vault.cachePath).key(key))
                .build()
        } finally {
            // The Rust FFI copies the key; do not keep a second Java byte array.
            key.fill(0)
        }
    }

    private suspend fun startSync(built: Client, updated: () -> Unit): List<Conversation> {
        built.syncOnceV2(SyncSettingsV2(timeoutMs = 0UL, fullState = true))
        client = built
        syncTask = built.syncV2(SyncSettingsV2(), object : SyncListenerV2 {
            override fun onUpdate(response: SyncResponseV2) = updated()
        })
        return rooms()
    }

    val userId: String get() = client?.session()?.userId ?: ""

    suspend fun login(server: String, username: String, password: String, updated: () -> Unit): List<Conversation> =
        withContext(Dispatchers.IO) {
            require(client == null) { "Already connected." }
            require(!vault.hasLocalDeviceData()) {
                "Encrypted device data already exists. Restore or explicitly forget it before signing in."
            }
            val built = buildClient(server)
            try {
                built.login(username.trim(), password, "GoreeCloud Messenger Android", null)
                // Persist the authenticated device before starting sync, so
                // process death cannot silently replace the signing device.
                vault.saveSession(built.session())
                startSync(built, updated)
            } catch (failure: Exception) {
                syncTask?.cancel()
                syncTask?.close()
                syncTask = null
                client = null
                built.close()
                throw failure
            }
        }

    suspend fun restore(updated: () -> Unit): List<Conversation> = withContext(Dispatchers.IO) {
        require(client == null) { "Already connected." }
        val saved = requireNotNull(vault.readSession()) { "No encrypted local session." }
        val built = buildClient(saved.homeserverUrl)
        try {
            built.restoreSession(saved)
            startSync(built, updated)
        } catch (failure: Exception) {
            syncTask?.cancel()
            syncTask?.close()
            syncTask = null
            client = null
            built.close()
            // Never erase a recoverable crypto database on transient failures.
            throw failure
        }
    }

    fun forgetStoredSession() {
        require(client == null) { "Sign out before deleting a connected session." }
        vault.forget()
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
        // Late asynchronous callbacks from older rooms must not replace this room.
        val requestedGeneration = synchronized(timelineLock) {
            generation += 1
            timelineTask?.cancel()
            timelineTask?.close()
            timeline?.close()
            timeline = null
            timelineTask = null
            timelineItems.clear()
            selectedRoomId = roomId
            generation
        }
        val room = requireNotNull(client?.getRoom(roomId)) { "The room is unavailable." }
        require(room.membership() == Membership.JOINED) { "This room has not been joined." }
        val opened = room.timeline()
        val ownUserId = client?.session()?.userId
        val subscription = opened.addListener(object : TimelineListener {
            override fun onUpdate(diff: List<TimelineDiff>) {
                val visible = synchronized(timelineLock) {
                    if (generation != requestedGeneration || selectedRoomId != roomId) return
                    applyTimelineDiff(timelineItems, diff)
                    timelineItems.mapNotNull { item ->
                        val event = item.asEvent() ?: return@mapNotNull null
                        val kind = (event.content as? TimelineItemContent.MsgLike)?.content?.kind
                        val body = when (kind) {
                            is MsgLikeKind.Message -> kind.content.body
                            is MsgLikeKind.UnableToDecrypt -> "Encrypted message cannot be decrypted on this device."
                            MsgLikeKind.Redacted -> "Message removed."
                            else -> return@mapNotNull null
                        }
                        // A local transaction ID is NOT a remote Matrix event
                        // ID. Enable reactions only once its server ID exists.
                        val remoteId = if (kind is MsgLikeKind.Message && event.isRemote) {
                            (event.eventOrTransactionId as? EventOrTransactionId.EventId)?.eventId
                        } else null
                        val reactions = event.reactions
                            .filter { it.key in ReactionPolicy.supportedEmoji }
                            .map { reaction ->
                                EmojiReaction(
                                    reaction.key, reaction.senders.size,
                                    reaction.senders.any { it.senderId == ownUserId },
                                )
                            }
                        TimelineEntry(item.uniqueId().id, event.sender, body, event.isOwn, remoteId, reactions)
                    }.takeLast(150)
                }
                // This callback may be on the Rust SDK thread. UI marshals the snapshot.
                update(visible)
            }
        })
        synchronized(timelineLock) {
            if (generation != requestedGeneration || selectedRoomId != roomId) {
                subscription.cancel()
                subscription.close()
                opened.close()
            } else {
                timeline = opened
                timelineTask = subscription
            }
        }
    }

    suspend fun loadOlder(roomId: String): Boolean = withContext(Dispatchers.IO) {
        val current = synchronized(timelineLock) {
            require(selectedRoomId == roomId) { "Select the room again." }
            requireNotNull(timeline) { "Room timeline unavailable." }
        }
        // SDK controls pagination tokens. No raw HTTP history scraping.
        current.paginateBackwards(30u)
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

    suspend fun sendEncryptedReply(roomId: String, eventId: String, body: String) =
        withContext(Dispatchers.IO) {
            val active = requireNotNull(client) { "Sign in first." }
            val room = requireNotNull(active.getRoom(roomId)) { "Room unavailable." }
            // The SDK's encrypted reply mechanism constructs the Matrix
            // relation; never send a custom unencrypted HTTP event.
            val isEncrypted = room.isEncrypted()
            val isJoined = room.membership() == Membership.JOINED
            val activeTimeline = synchronized(timelineLock) {
                require(selectedRoomId == roomId) { "Select the room again." }
                requireNotNull(timeline) { "Room timeline unavailable." }
            }
            val safeBody = ReplyPolicy.requireEncryptedReply(
                roomId, roomId, eventId, body, isEncrypted, isJoined,
            )
            val content = messageEventContentNew(
                MessageType.Text(TextMessageContent(safeBody, null))
            )
            try {
                activeTimeline.sendReply(content, eventId).close()
            } finally {
                content.close()
            }
        }

    suspend fun toggleReaction(roomId: String, eventId: String, emoji: String): Boolean =
        withContext(Dispatchers.IO) {
            val room = requireNotNull(client?.getRoom(roomId)) { "Room unavailable." }
            // Resolve suspending SDK queries before entering Kotlin's monitor.
            val isEncrypted = room.isEncrypted()
            val isJoined = room.membership() == Membership.JOINED
            val current = synchronized(timelineLock) {
                ReactionPolicy.requireEncryptedReaction(
                    roomId, selectedRoomId, eventId, emoji, isEncrypted, isJoined,
                )
                requireNotNull(timeline) { "Selected timeline unavailable." }
            }
            // SDK owns the encryption and local toggle semantics. Never send
            // an unencrypted custom reaction HTTP request as fallback.
            current.toggleReaction(EventOrTransactionId.EventId(eventId), emoji)
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
        try { if (active != null) active.logout() }
        catch (_: Exception) { /* Server-side revocation may be unavailable offline. */ }
        finally {
            close()
            // Explicit sign-out deletes device keys. A device without trusted
            // server-side key backup may lose old encrypted history forever.
            vault.forget()
        }
    }

    override fun close() {
        synchronized(timelineLock) {
            generation += 1
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
            is TimelineDiff.Insert -> if (diff.index.toLong() <= items.size.toLong()) items.add(diff.index.toInt(), diff.value)
            is TimelineDiff.Set -> if (diff.index.toLong() < items.size.toLong()) items[diff.index.toInt()] = diff.value
            is TimelineDiff.Remove -> if (diff.index.toLong() < items.size.toLong()) items.removeAt(diff.index.toInt())
            is TimelineDiff.Truncate -> items.subList(diff.length.toLong().coerceAtMost(items.size.toLong()).toInt(), items.size).clear()
            is TimelineDiff.Reset -> { items.clear(); items.addAll(diff.values) }
        }
    }
}
