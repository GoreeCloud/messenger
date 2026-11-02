import { planRoute, createCapabilities, formatSecurity } from "../src/protocols.mjs";
import { MatrixPlaintextSession } from "../src/matrix.mjs";

const $ = id => document.getElementById(id);
const state = {
  session: null, userId: "", rooms: [], notes: [], messages: new Map(),
  selected: "notes", filter: "ALL", query: "", loading: false,
  allowPlaintext: false, failures: new Map()
};
const els = {
  list: $("conversationList"), timeline: $("timeline"), message: $("messageInput"),
  transport: $("transportSelect"), send: $("sendButton"), connection: $("connection"),
  toast: $("toast")
};

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = String(content);
  return element;
}
function announce(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
}
function selectedRoom() { return state.rooms.find(room => room.id === state.selected); }
function dateLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function securityFor(room) {
  if (!room) return formatSecurity("LOCAL", false);
  if (room.encrypted === "encrypted") return "E2EE room · locked (crypto not configured)";
  if (room.encrypted === "unknown") return "Security unknown · blocked";
  return formatSecurity("DATA", false) + " · homeserver can read content";
}
function setFilter(next) {
  state.filter = next;
  document.querySelectorAll("[data-filter]").forEach(button => {
    const active = button.dataset.filter === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderList();
}

function renderList() {
  els.list.replaceChildren();
  const list = [{ id: "notes", name: "Personal notes", protocol: "LOCAL", subtitle: "On this tab only", icon: "✎" },
    ...state.rooms.map(room => ({
      id: room.id, name: room.name, protocol: "DATA",
      subtitle: room.encrypted === "plaintext" ? "Not E2EE" : "Encrypted/unknown · locked", icon: "#"
    }))].filter(item => (state.filter === "ALL" ||
    (state.filter === "DATA" && item.protocol === "DATA")) &&
    (item.name + " " + item.subtitle).toLowerCase().includes(state.query));
  $("roomCount").textContent = String(state.rooms.length + 1);
  if (!list.length) els.list.append(node("p", "empty-list", "No conversations match. Carrier transports are not available in this web preview."));
  for (const item of list) {
    const button = node("button", "conversation" + (state.selected === item.id ? " selected" : ""));
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-current", String(state.selected === item.id));
    const avatar = node("span", "conversation-avatar", item.icon);
    avatar.setAttribute("aria-hidden", "true");
    const copy = node("span", "conversation-copy");
    copy.append(node("strong", "", item.name), node("small", "", item.subtitle));
    button.append(avatar, copy, node("span", "conversation-tag", item.protocol));
    button.addEventListener("click", () => { state.selected = item.id; render(); if (item.protocol === "DATA") void loadMessages(); });
    els.list.append(button);
  }
}
function renderTimeline() {
  els.timeline.replaceChildren();
  const room = selectedRoom();
  if (room && room.encrypted !== "plaintext") {
    const panel = node("div", "empty-state locked");
    panel.append(node("div", "empty-icon", "◇"), node("h3", "", "This conversation is locked"),
      node("p", "", "The current connector cannot decrypt or verify this room. No plaintext fallback will occur."));
    els.timeline.append(panel); return;
  }
  const messages = room ? (state.messages.get(room.id) || []) : state.notes;
  if (!messages.length) {
    const panel = node("div", "empty-state");
    panel.append(node("div", "empty-icon", room ? "◈" : "✎"),
      node("h3", "", room ? "No plaintext messages loaded" : "A place for your thoughts"),
      node("p", "", room ? "Select Refresh to check this room. Messages are session-only and not E2EE." :
        "Write a note to get started. Notes never leave this browser tab and are not saved to disk."));
    els.timeline.append(panel); return;
  }
  const stack = node("div", "message-stack");
  for (const message of messages) {
    const bubble = node("article", "message" + (message.own ? " own" : ""));
    bubble.append(node("div", "message-body", message.text));
    const meta = node("div", "message-meta");
    meta.append(node("span", "", message.protocol),
      node("span", "", securityFor(room)),
      node("time", "", dateLabel(message.timestamp)));
    if (message.error) {
      const retry = node("button", "retry", "Retry");
      retry.type = "button";
      retry.addEventListener("click", () => void retryMessage(message.id));
      meta.append(retry);
    }
    bubble.append(meta); stack.append(bubble);
  }
  els.timeline.append(stack);
  els.timeline.scrollTop = els.timeline.scrollHeight;
}
function renderComposer() {
  const room = selectedRoom();
  const notes = !room;
  const requested = els.transport.value;
  const isMatching = notes ? requested === "LOCAL" : requested === "DATA";
  const unlocked = notes || (room.encrypted === "plaintext" && state.allowPlaintext);
  els.send.disabled = state.loading || !isMatching || !unlocked;
  $("routeStatus").textContent = !isMatching ? "Selected transport unavailable for this conversation" :
    notes ? "On-device only" : room.encrypted !== "plaintext" ? "Locked · no crypto support" :
    state.allowPlaintext ? "Plaintext DATA · consent enabled" : "Plaintext DATA blocked · consent required";
  $("composeHelp").textContent = notes
    ? "Notes are in tab memory only; refresh closes them. Enter to save · Shift+Enter for a newline."
    : room.encrypted !== "plaintext" ? "Encrypted/unknown rooms cannot send without a verified cryptographic adapter." :
    "DATA messages are NOT E2EE. Consent is required per session. Enter to send · Shift+Enter for a newline.";
  els.message.placeholder = notes ? "Write a note…" : "Write a DATA message…";
  els.message.disabled = state.loading || (room && room.encrypted !== "plaintext");
}
function render() {
  const room = selectedRoom();
  $("chatTitle").textContent = room?.name || "Personal notes";
  $("chatSubtitle").textContent = room ? "Matrix DATA · " + room.id : "Private workspace on this tab";
  $("chatAvatar").textContent = room ? "#" : "✎";
  $("securityText").textContent = securityFor(room);
  $("securityStrip").classList.toggle("warning", Boolean(room));
  $("refreshButton").disabled = !room || state.loading;
  els.transport.value = room ? "DATA" : "LOCAL";
  $("sidebarStatus").textContent = state.session
    ? "Connected to Matrix · " + state.userId : "Local notes ready · no DATA session";
  renderList(); renderTimeline(); renderComposer();
}
async function loadMessages() {
  const room = selectedRoom();
  if (!state.session || !room || room.encrypted !== "plaintext") return;
  state.loading = true; renderComposer();
  try {
    const messages = await state.session.readMessages(room);
    if (state.selected === room.id) state.messages.set(room.id, messages);
    announce("Updated Matrix messages");
  } catch (error) { announce(error.message); }
  finally { state.loading = false; render(); }
}
async function send() {
  const text = els.message.value;
  if (!text.trim() || state.loading) return;
  const room = selectedRoom();
  if (!room) {
    if (els.transport.value !== "LOCAL") return announce("Notes are local only. No carrier gateway is configured.");
    state.notes.push({ id: crypto.randomUUID(), text, timestamp: Date.now(),
      protocol: "LOCAL", encrypted: false, own: true });
    els.message.value = ""; render(); return;
  }
  if (!state.session || !state.allowPlaintext || room.encrypted !== "plaintext") {
    return announce("Blocked by transport/security policy. Nothing was sent.");
  }
  const route = planRoute({ requested: "DATA",
    capabilities: createCapabilities({ DATA: {available:true,encrypted:false,verified:true} }),
    policy: {preferred:["DATA"],requireEncryption:false,allowFallback:false} });
  if (route.status !== "ready" || els.transport.value !== route.protocol) return announce("No authorized transport. Nothing sent.");
  const message = { id: crypto.randomUUID(), text, timestamp: Date.now(),
    protocol: "DATA", encrypted: false, own: true, error: false };
  const messages = state.messages.get(room.id) || [];
  state.messages.set(room.id, [...messages, message]); els.message.value = "";
  await transmit(room, message);
}
async function transmit(room, message) {
  state.loading = true; render();
  try {
    await state.session.sendPlaintext(room, message.text, message.id,
      { allowPlaintext: state.allowPlaintext });
    message.error = false;
    announce("Matrix homeserver accepted message · not E2EE");
  } catch (error) {
    message.error = true;
    announce(error.message + " · Retry uses the same transaction ID");
  } finally { state.loading = false; render(); }
}
async function retryMessage(id) {
  const room = selectedRoom(); const message = (state.messages.get(room?.id) || []).find(m => m.id === id);
  if (!room || !message || !message.error || !state.allowPlaintext || state.loading) return;
  await transmit(room, message);
}
function disconnect() {
  state.session?.close();
  state.session = null; state.rooms = []; state.userId = ""; state.selected = "notes";
  state.messages.clear(); state.allowPlaintext = false;
  $("plaintextConsent").checked = false; $("tokenInput").value = "";
  $("connectionStatus").textContent = "Disconnected. Credentials were not persisted.";
  announce("DATA disconnected"); render();
}
async function connect(event) {
  event.preventDefault();
  if (state.loading) return;
  state.loading = true; $("connectButton").disabled = true;
  $("connectionStatus").textContent = "Authenticating and checking room security…";
  const homeserver = $("homeserverInput").value;
  const token = $("tokenInput").value;
  let next;
  try {
    next = new MatrixPlaintextSession({homeserver,accessToken:token});
    const userId = await next.whoami();
    const ids = await next.listRooms();
    const rooms = [];
    for (const id of ids) rooms.push(await next.inspectRoom(id));
    state.session?.close();
    state.session = next; state.userId = userId; state.rooms = rooms; state.messages.clear();
    state.selected = rooms.length ? rooms[0].id : "notes";
    state.allowPlaintext = false; $("plaintextConsent").checked = false;
    $("tokenInput").value = "";
    $("connectionStatus").textContent = "Connected as " + userId + " · " + rooms.length + " rooms inspected";
    announce("Connected. Unencrypted DATA requires separate explicit consent.");
    els.connection.hidden = true;
  } catch (error) {
    next?.close();
    $("connectionStatus").textContent = error.message;
    announce("Connection failed: " + error.message);
  } finally {
    state.loading = false; $("connectButton").disabled = false; render();
    if (state.session && selectedRoom()?.encrypted === "plaintext") void loadMessages();
  }
}

$("composeForm").addEventListener("submit", e => { e.preventDefault(); void send(); });
els.message.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault(); void send();
  }
});
$("searchInput").addEventListener("input", e => { state.query = e.target.value.toLowerCase(); renderList(); });
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter)));
els.transport.addEventListener("change", renderComposer);
$("connectToggle").addEventListener("click", () => { els.connection.hidden = false; $("homeserverInput").focus(); });
$("railConnection").addEventListener("click", e => { e.preventDefault(); els.connection.hidden = false; $("homeserverInput").focus(); });
$("railPrivacy").addEventListener("click", e => { e.preventDefault(); $("privacy").scrollIntoView({behavior:"smooth"}); });
$("closeConnection").addEventListener("click", () => { els.connection.hidden = true; });
$("connectForm").addEventListener("submit", e => void connect(e));
$("disconnectButton").addEventListener("click", disconnect);
$("plaintextConsent").addEventListener("change", e => {
  state.allowPlaintext = Boolean(state.session && e.target.checked);
  if (!state.session) e.target.checked = false;
  renderComposer();
});
$("refreshButton").addEventListener("click", () => void loadMessages());
$("themeToggle").addEventListener("click", () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
});
render();
