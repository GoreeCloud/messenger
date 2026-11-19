import { FormEvent, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { connect, createPrivateEncryptedRoom, leaveSession, listRooms } from "./matrix";
import { validMatrixId } from "./config";

export default function App() {
  const [homeserver, setHomeserver] = useState("https://matrix.example.org");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [roomName, setRoomName] = useState("");
  const [inviteId, setInviteId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const rooms = useMemo(() => client ? listRooms(client) : [], [client, revision]);
  const selected = rooms.find(room => room.id === selectedId) || rooms[0];
  const myId = client?.getUserId() || "";

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally { setBusy(false); }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(async () => {
      const active = await connect(homeserver, username, password, () => setRevision(n => n + 1));
      setClient(active);
      setPassword("");
      setNotice("Connected. Credentials and tokens are held only in memory.");
    });
  }

  function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !roomName.trim()) return;
    void perform(async () => {
      const roomId = await createPrivateEncryptedRoom(client, roomName);
      setRoomName(""); setSelectedId(roomId); setRevision(n => n + 1);
      setNotice("Private encrypted room requested from the homeserver.");
    });
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !selected || !draft.trim()) return;
    if (!selected.encrypted) { setError("Sending to unencrypted rooms is disabled in this preview."); return; }
    void perform(async () => {
      await client.sendTextMessage(selected.id, draft.trim());
      setDraft(""); setRevision(n => n + 1);
    });
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !selected || !validMatrixId(inviteId)) { setError("Enter a valid Matrix user ID."); return; }
    void perform(async () => {
      await client.invite(selected.id, inviteId.trim());
      setInviteId("");
      setNotice("Invitation sent to the homeserver.");
    });
  }

  function logout() {
    if (!client) return;
    void perform(async () => {
      await leaveSession(client);
      setClient(null); setSelectedId(""); setDraft(""); setUsername("");
      setNotice("Signed out; the local in-memory session was cleared.");
    });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="identity"><div className="brand-mark" aria-hidden="true">M</div>
          <div><strong>GoreeCloud <span>Messenger</span></strong><small>Private by design · Self-hosted by choice</small></div></div>
        <div className="header-actions"><span className="preview-pill">Development preview</span>
          {client ? <button type="button" className="quiet" onClick={logout} disabled={busy}>Sign out</button> : null}</div>
      </header>
      {!client ? (
        <main className="welcome-wrap">
          <section className="hero">
            <span className="eyebrow">YOUR CONVERSATIONS. YOUR INFRASTRUCTURE.</span>
            <h1>Better conversations,<br /><em>on your terms.</em></h1>
            <p>Connect to your own Matrix homeserver and bring your people together in one calm, private workspace.</p>
            <div className="feature-grid">
              <div><span aria-hidden="true">◇</span><strong>Private rooms</strong><small>Encryption enabled by default for new rooms.</small></div>
              <div><span aria-hidden="true">◎</span><strong>Open protocol</strong><small>Built on the Matrix ecosystem, without a closed network.</small></div>
              <div><span aria-hidden="true">▣</span><strong>Self-hosted</strong><small>Choose the homeserver that holds your account.</small></div>
            </div>
          </section>
          <section className="login-card" aria-label="Connect to homeserver">
            <span className="eyebrow">GET CONNECTED</span><h2>Welcome back</h2>
            <p>Use an existing Matrix account. Registration is managed by your homeserver administrator.</p>
            <form onSubmit={login}>
              <label htmlFor="server">Homeserver URL</label>
              <input id="server" value={homeserver} onChange={e => setHomeserver(e.target.value)} type="url" autoComplete="url" required />
              <label htmlFor="username">Matrix username</label>
              <input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="@you:example.org" autoComplete="username" required />
              <label htmlFor="password">Password</label>
              <input id="password" value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
              <button type="submit" className="primary" disabled={busy}>{busy ? "Connecting…" : "Connect to Messenger"}</button>
            </form>
            <p className="security-note"><span aria-hidden="true">◇</span> Your password is never saved by this app. This preview lacks device verification, encrypted backups and account recovery.</p>
          </section>
        </main>
      ) : (
        <main className="workspace">
          <aside className="rooms-panel" aria-label="Conversations">
            <div className="panel-title"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Messages</h2></div>
              <span className="count">{rooms.length}</span></div>
            <form className="create-form" onSubmit={addRoom}>
              <label htmlFor="room-name">New private room</label>
              <div className="inline-form"><input id="room-name" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Name your room" maxLength={90} required />
                <button className="small-primary" disabled={busy} title="Create encrypted room" aria-label="Create encrypted room" type="submit">+</button></div>
            </form>
            <div className="room-list">
              {rooms.length === 0 ? <p className="muted empty">No rooms yet. Create your first encrypted conversation.</p> :
                rooms.map(room => <button type="button" key={room.id} onClick={() => setSelectedId(room.id)}
                  className={"room-item " + (selected?.id === room.id ? "selected" : "")}>
                  <span className="avatar" aria-hidden="true">{room.name.substring(0, 1).toUpperCase()}</span>
                  <span className="room-copy"><strong>{room.name}</strong><small>{room.encrypted ? "Encrypted room" : "Unencrypted room · view only"}</small></span>
                </button>)}
            </div>
            <div className="account-foot"><span className="status-dot" /><div><strong>Connected</strong><small title={myId}>{myId}</small></div></div>
          </aside>
          <section className="conversation" aria-label="Selected conversation">
            {selected ? <>
              <div className="conversation-top"><div><h2>{selected.name}</h2><p>{selected.encrypted ? "Encrypted conversation · Verification unavailable in preview" : "Unencrypted room · Sending disabled"}</p></div><span className="room-indicator" aria-label={selected.encrypted ? "Encrypted" : "Not encrypted"}>{selected.encrypted ? "◇ Encrypted" : "⚠ Unencrypted"}</span></div>
              <div className="messages" role="log" aria-live="polite" aria-label="Messages">
                {selected.messages.length === 0 ? <div className="empty-chat"><span aria-hidden="true">◌</span><h3>A fresh conversation</h3><p>Once messages arrive, they will appear here.</p></div> :
                  selected.messages.map(message =>
                    <article className={"message " + (message.sender === myId ? "mine" : "")} key={message.id}>
                      <small>{message.sender} · {new Date(message.timestamp).toLocaleString()}</small>
                      <p>{message.body}</p>
                    </article>)}
              </div>
              <form className="composer" onSubmit={send}>
                <label className="sr-only" htmlFor="message">Write a message</label>
                <input id="message" value={draft} onChange={e => setDraft(e.target.value)} placeholder={selected.encrypted ? "Write a message…" : "Unencrypted sending is disabled"} disabled={busy || !selected.encrypted} maxLength={4000} />
                <button className="primary" type="submit" disabled={busy || !draft.trim() || !selected.encrypted}>Send</button>
              </form>
            </> : <div className="empty-chat"><span aria-hidden="true">✦</span><h2>Your space to connect</h2><p>Create a private room to begin.</p></div>}
          </section>
          <aside className="details-panel" aria-label="Room details">
            <span className="eyebrow">CONVERSATION DETAILS</span>
            <h3>Room information</h3>
            {selected ? <>
              <div className="detail-box"><span className="eyebrow">SECURITY</span><strong>{selected.encrypted ? "End-to-end encryption configured" : "No room encryption"}</strong><small>{selected.encrypted ? "Device verification and key backup are not implemented yet." : "Message content may be visible to the homeserver."}</small></div>
              <p className="detail-label">Room ID</p><code className="room-id">{selected.id}</code>
              <form onSubmit={invite} className="invite-form"><label htmlFor="invite">Invite a Matrix user</label>
                <input id="invite" value={inviteId} onChange={e => setInviteId(e.target.value)} placeholder="@friend:server.org" required />
                <button type="submit" className="quiet bordered" disabled={busy || !validMatrixId(inviteId)}>Send invitation</button></form>
            </> : <p className="muted">Choose a conversation to see its details.</p>}
          </aside>
        </main>
      )}
      {(error || notice) && <div className={"toast " + (error ? "error" : "")} role={error ? "alert" : "status"}>
        {error || notice}<button type="button" className="close" aria-label="Dismiss notification" onClick={() => {setError(""); setNotice("");}}>×</button></div>}
      <footer className="footer-note">GoreeCloud Messenger · Experimental source preview · Not audited for production use</footer>
    </div>
  );
}
