package com.goreecloud.messenger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

private val canvas = Color(0xFF0D121D)
private val surface = Color(0xFF171D2A)
private val brand = Color(0xFFBFB8FF)
private val soft = Color(0xFFCED5E5)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(
                primary = brand, onPrimary = Color(0xFF272057),
                background = canvas, surface = surface,
                onBackground = Color(0xFFF2F4FB), onSurface = Color(0xFFF2F4FB)
            )) { MessengerScreen() }
        }
    }
}

@Composable
private fun MessengerScreen() {
    val engine = remember { MatrixEngine() }
    DisposableEffect(engine) { onDispose { engine.close() } }
    val scope = rememberCoroutineScope()

    var server by remember { mutableStateOf("https://matrix.example.org") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var connected by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var rooms by remember { mutableStateOf<List<Conversation>>(emptyList()) }
    var selected by remember { mutableStateOf<Conversation?>(null) }
    var messages by remember { mutableStateOf<List<TimelineEntry>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var roomName by remember { mutableStateOf("") }
    var inviteId by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var notice by remember { mutableStateOf("") }

    fun refresh() {
        scope.launch {
            try { rooms = engine.rooms(); error = "" }
            catch (_: Exception) { error = "Unable to refresh conversations." }
        }
    }

    fun openRoom(room: Conversation) {
        selected = room; messages = emptyList(); draft = ""; error = ""
        scope.launch {
            try {
                engine.openRoom(room.id) { snapshot ->
                    scope.launch { if (selected?.id == room.id) messages = snapshot }
                }
            } catch (_: Exception) { error = "Unable to open conversation." }
        }
    }

    Column(Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("GoreeCloud Messenger", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Native Android · Matrix Rust SDK", style = MaterialTheme.typography.labelMedium, color = soft)
            }
            if (connected) TextButton(enabled = !busy, onClick = {
                connected = false; rooms = emptyList(); selected = null; messages = emptyList()
                scope.launch { engine.logout() }
            }) { Text("Sign out") }
        }
        Spacer(Modifier.height(12.dp))
        if (!connected) {
            ElevatedCard(colors = CardDefaults.elevatedCardColors(containerColor = surface)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    Text("Connect to your homeserver", style = MaterialTheme.typography.headlineSmall)
                    Text("Sign in to an existing Matrix account. This preview keeps keys in memory: encrypted history may become unreadable after a restart.", color = soft)
                    OutlinedTextField(server, { server = it }, label = { Text("HTTPS homeserver origin") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(username, { username = it }, label = { Text("Matrix username") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(password, { password = it }, label = { Text("Password") },
                        singleLine = true, visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth())
                    Button(enabled = !busy && username.isNotBlank() && password.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth(), onClick = {
                            busy = true; error = ""; notice = ""
                            scope.launch {
                                try {
                                    rooms = engine.login(server, username, password) { refresh() }
                                    password = ""
                                    connected = true
                                    notice = "Signed in using Matrix Rust SDK. Device verification and key recovery are not yet available."
                                } catch (_: Exception) { error = "Could not sign in. Check your homeserver, TLS and credentials." }
                                finally { busy = false }
                            }
                        }) { Text(if (busy) "Connecting…" else "Connect securely") }
                }
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Your conversations", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                TextButton(onClick = { refresh() }, enabled = !busy) { Text("Refresh") }
            }
            Text("Messages use the Matrix Rust SDK encryption stack. Device verification, encrypted backup and key recovery are NOT enabled yet.", style = MaterialTheme.typography.bodySmall, color = soft)
            Spacer(Modifier.height(10.dp))
            if (selected == null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(roomName, { roomName = it }, singleLine = true, label = { Text("New encrypted room") }, modifier = Modifier.weight(1f))
                    Button(enabled = !busy && roomName.isNotBlank(), onClick = {
                        busy = true; error = ""
                        scope.launch {
                            try {
                                val id = engine.createPrivateRoom(roomName)
                                roomName = ""
                                rooms = engine.rooms()
                                rooms.find { it.id == id }?.let { openRoom(it) }
                                notice = "Created a private encrypted room."
                            } catch (_: Exception) { error = "Unable to create encrypted room." }
                            finally { busy = false }
                        }
                    }) { Text("Create") }
                }
                LazyColumn(Modifier.weight(1f)) {
                    items(rooms, key = { it.id }) { room ->
                        Surface(color = surface, shape = RoundedCornerShape(18.dp),
                            border = BorderStroke(1.dp, Color(0xFF505B70)),
                            modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp).clickable { openRoom(room) }) {
                            Column(Modifier.padding(15.dp)) {
                                Text(room.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(if (room.encrypted) "Encrypted room" else "Unencrypted · read-only",
                                    style = MaterialTheme.typography.bodySmall, color = soft)
                            }
                        }
                    }
                }
            } else {
                val room = selected!!
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { selected = null; messages = emptyList(); error = "" }) { Text("← Rooms") }
                    Column(Modifier.weight(1f)) {
                        Text(room.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold)
                        Text(if (room.encrypted) "Encrypted · identity not verified" else "Unencrypted · sending blocked",
                            style = MaterialTheme.typography.labelSmall, color = soft)
                    }
                }
                TextButton(enabled = !busy, onClick = {
                    busy = true; error = ""
                    scope.launch {
                        try {
                            val more = engine.loadOlder(room.id)
                            if (!more) notice = "No additional local history was returned."
                        } catch (_: Exception) { error = "Unable to load older messages." }
                        finally { busy = false }
                    }
                }) { Text("Load older messages") }
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(messages, key = { it.id }) { msg ->
                        Surface(shape = RoundedCornerShape(16.dp), color = if (msg.own) Color(0xFF413974) else surface,
                            modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(13.dp)) {
                                Text(msg.sender, style = MaterialTheme.typography.labelSmall, color = brand, maxLines = 1)
                                Text(msg.body, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
                if (room.encrypted) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(draft, { draft = it }, label = { Text("Write an encrypted message") },
                            singleLine = true, modifier = Modifier.weight(1f))
                        Button(enabled = !busy && draft.isNotBlank(), onClick = {
                            busy = true; error = ""
                            scope.launch {
                                try { engine.sendEncrypted(room.id, draft); draft = "" }
                                catch (_: Exception) { error = "Encrypted sending failed. No plaintext fallback was attempted." }
                                finally { busy = false }
                            }
                        }) { Text("Send") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(inviteId, { inviteId = it }, label = { Text("Invite @user:server") },
                            singleLine = true, modifier = Modifier.weight(1f))
                        TextButton(enabled = !busy && inviteId.isNotBlank(), onClick = {
                            busy = true; error = ""
                            scope.launch {
                                try {
                                    engine.invite(room.id, inviteId.trim())
                                    inviteId = ""; notice = "Invitation requested."
                                } catch (_: Exception) { error = "Unable to invite this user." }
                                finally { busy = false }
                            }
                        }) { Text("Invite") }
                    }
                } else {
                    Text("Sending to unencrypted rooms is disabled.", color = soft)
                }
            }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (error.isNotBlank()) Text(error, color = Color(0xFFFFB4AB), style = MaterialTheme.typography.bodySmall)
        if (notice.isNotBlank()) Text(notice, color = Color(0xFF95E0BB), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(8.dp))
        Text("Experimental preview · No persistent keys, device verification, cross-signing or production security approval.",
            style = MaterialTheme.typography.labelSmall, color = soft)
    }
}
