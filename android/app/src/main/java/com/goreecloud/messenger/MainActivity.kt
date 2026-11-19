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
    var server by remember { mutableStateOf("https://matrix.example.org") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var session by remember { mutableStateOf<MessengerSession?>(null) }
    var rooms by remember { mutableStateOf<List<Conversation>>(emptyList()) }
    var current by remember { mutableStateOf<Conversation?>(null) }
    var messages by remember { mutableStateOf<List<TimelineEntry>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    suspend fun refreshRooms(s: MessengerSession) {
        try {
            busy = true
            rooms = MatrixApi.joinedRooms(s)
            error = ""
        } catch (cause: Exception) {
            error = cause.message ?: "Unable to load rooms."
        } finally { busy = false }
    }

    Column(Modifier.fillMaxSize().safeDrawingPadding().padding(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text("GoreeCloud Messenger", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Native Android · Development preview", style = MaterialTheme.typography.labelMedium, color = soft)
            }
            if (session != null) TextButton(onClick = {
                val prior = session
                session = null
                rooms = emptyList(); current = null; messages = emptyList()
                if (prior != null) scope.launch { MatrixApi.logout(prior) }
            }) { Text("Sign out") }
        }
        Spacer(Modifier.height(25.dp))
        if (session == null) {
            ElevatedCard(colors = CardDefaults.elevatedCardColors(containerColor = surface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text("Connect to your homeserver", style = MaterialTheme.typography.headlineSmall)
                    Text("Use an existing Matrix account. TLS is required; credentials and tokens are never stored on disk.", color = soft)
                    OutlinedTextField(server, { server = it }, label = { Text("HTTPS homeserver") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(username, { username = it }, label = { Text("Matrix username") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth())
                    Button(
                        enabled = !busy && password.isNotEmpty() && username.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(), onClick = {
                            busy = true; error = ""
                            scope.launch {
                                try {
                                    val signedIn = MatrixApi.login(server, username, password)
                                    password = ""
                                    session = signedIn
                                    refreshRooms(signedIn)
                                } catch (cause: Exception) { error = cause.message ?: "Login failed." }
                                finally { busy = false }
                            }
                        }
                    ) { Text(if (busy) "Connecting…" else "Connect") }
                }
            }
        } else {
            val active = session!!
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Conversations", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                TextButton(enabled = !busy, onClick = { scope.launch { refreshRooms(active) } }) { Text("Refresh") }
            }
            Text("Encrypted conversations are listed but not decrypted on Android yet. Sending is disabled until the native Matrix Rust SDK is integrated.", color = soft, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(16.dp))
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            LazyColumn(Modifier.weight(1f)) {
                items(rooms, key = { it.roomId }) { room ->
                    Surface(
                        color = if (current?.roomId == room.roomId) Color(0xFF413974) else surface,
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, Color(0xFF505B70)),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)
                            .clickable(enabled = !busy) {
                                current = room
                                messages = emptyList()
                                if (room.encryption == EncryptionStatus.NOT_ENCRYPTED) {
                                    busy = true
                                    scope.launch {
                                        try { messages = MatrixApi.publicRoomMessages(active, room); error = "" }
                                        catch (cause: Exception) { error = cause.message ?: "Unable to read room." }
                                        finally { busy = false }
                                    }
                                }
                            }
                    ) {
                        Column(Modifier.padding(15.dp)) {
                            Text(room.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(when (room.encryption) {
                                EncryptionStatus.ENCRYPTED -> "Encrypted · content unavailable in Android preview"
                                EncryptionStatus.NOT_ENCRYPTED -> "Unencrypted · read-only"
                                EncryptionStatus.UNKNOWN -> "Encryption state unknown · content hidden"
                            }, style = MaterialTheme.typography.bodySmall, color = soft)
                        }
                    }
                }
                if (current != null) {
                    item {
                        Spacer(Modifier.height(15.dp))
                        Text("Selected: " + (current?.name ?: ""), style = MaterialTheme.typography.titleMedium)
                        if (current?.encryption == EncryptionStatus.NOT_ENCRYPTED) {
                            if (messages.isEmpty()) Text("No recent text messages.", color = soft)
                            for (entry in messages) {
                                ElevatedCard(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                                    Column(Modifier.padding(12.dp)) {
                                        Text(entry.sender, style = MaterialTheme.typography.labelSmall, color = brand)
                                        Text(entry.body)
                                    }
                                }
                            }
                        } else Text("Message contents remain hidden until native end-to-end encryption is implemented.", color = soft)
                    }
                }
            }
            Text(active.userId, style = MaterialTheme.typography.labelSmall, color = soft)
        }
        if (error.isNotBlank()) {
            Spacer(Modifier.height(14.dp))
            Text(error, color = Color(0xFFFFB4AB), style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(14.dp))
        Text("Not production-ready · Device verification, encrypted key backup, calls, media, and push notifications are not yet available.",
            style = MaterialTheme.typography.labelSmall, color = soft)
    }
}
