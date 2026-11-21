import { FormEvent, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { acceptInvitation, connect, createPrivateEncryptedRoom, declineInvitation, leaveSession,
  listInvitations, listRooms } from "./matrix";
import { validMatrixId } from "./config";
import { filterLoadedMessages } from "./localSearch";
import {
  cryptoReadinessDisclaimer, cryptoReadinessSummary,
  inspectBrowserCryptoReadiness,
} from "./cryptoReadiness";
import type { BrowserCryptoReadiness } from "./cryptoReadiness";
import { eraseBrowserCryptoDevice } from "./eraseDevice";
import { inviteEncryptedUser, safeMessage, sendEncryptedText } from "./security";
import type { MessageView } from "./matrix";

export default function App() {
  const [homeserver, setHomeserver] = useState("https://matrix.example.org");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [eraseAccount, setEraseAccount] = useState("");
  const [eraseAcknowledgment, setEraseAcknowledgment] = useState("");
  const [devicePassphrase, setDevicePassphrase] = useState("");
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [cryptoReadiness, setCryptoReadiness] = useState<BrowserCryptoReadiness | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageView | null>(null);
  const [roomName, setRoomName] = useState("");
  const [inviteId, setInviteId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const rooms = useMemo(() => client ? listRooms(client) : [], [client, revision]);
  const invitations = useMemo(() => client ? listInvitations(client) : [], [client, revision]);
  const selected = rooms.find(room => room.id === selectedId) || rooms[0];
  const myId = client?.getUserId() || "";
  const visibleMessages = selected ? filterLoadedMessages(selected.messages, messageQuery) : [];

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) {
      setError(safeMessage(cause));
    } finally { setBusy(false); }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Clear controlled UI secrets BEFORE the asynchronous server request.
    // They stay only in the current call closure until authentication finishes.
    const submittedPassword = password;
    const submittedPassphrase = devicePassphrase;
    setPassword("");
    setDevicePassphrase("");
    void perform(async () => {
      const active = await connect(homeserver, username, submittedPassword, () => setRevision(n => n + 1), {
        rememberDevice, devicePassphrase: submittedPassphrase,
      });
      setClient(active);
      setCryptoReadiness(null);
      setNotice(rememberDevice
        ? "Connected. Device keys are encrypted locally; enter the same passphrase on the next login. Access tokens remain memory-only."
        : "Connected with an in-memory device. Keys from this session will not survive a restart.");
    });
  }

  function eraseDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // This action is available only while signed out. It is never tied
    // to ordinary logout or to a browser session disappearing on reload.
    if (client || eraseAcknowledgment !== "ERASE" || !validMatrixId(eraseAccount.trim())) return;
    void perform(async () => {
      await eraseBrowserCryptoDevice(
        homeserver, eraseAccount, eraseAcknowledgment,
        window.localStorage,
        typeof indexedDB === "undefined" ? undefined : indexedDB,
        navigator.locks,
      );
      setEraseAccount("");
      setEraseAcknowledgment("");
      setRememberDevice(false);
      setNotice("The selected browser's stored encrypted device data was erased locally. This did not revoke any other server token. Old encrypted history may be permanently unreadable.");
    });
  }

  function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !roomName.trim()) return;
    void perform(async () => {
      const roomId = await createPrivateEncryptedRoom(client, roomName);
      setRoomName(""); setSelectedId(roomId); setMessageQuery(""); setRevision(n => n + 1);
      setNotice("Private encrypted room requested from the homeserver.");
    });
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !selected || !draft.trim()) return;
    if (!selected.encrypted) { setError("Sending to unencrypted rooms is disabled in this preview."); return; }
    void perform(async () => {
      await sendEncryptedText(client, selected.id, draft, replyingTo || undefined);
      setDraft(""); setReplyingTo(null); setRevision(n => n + 1);
    });
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !selected || !validMatrixId(inviteId)) { setError("Enter a valid Matrix user ID."); return; }
    void perform(async () => {
      await inviteEncryptedUser(client, selected.id, inviteId.trim());
      setInviteId("");
      setNotice("Invitation sent to the homeserver.");
    });
  }

  function logout() {
    if (!client) return;
    void perform(async () => {
      const serverRevoked = await leaveSession(client);
      setClient(null); setCryptoReadiness(null); setSelectedId(""); setDraft(""); setReplyingTo(null); setUsername(""); setMessageQuery("");
      setNotice(serverRevoked
        ? "Signed out locally and the homeserver confirmed this session was revoked."
        : "Signed out locally. Server logout could not be confirmed: revoke the device token from another trusted client when connected.");
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
              <label className="persist-device-label" htmlFor="remember-device">
                <input id="remember-device" type="checkbox" checked={rememberDevice}
                  onChange={e => {setRememberDevice(e.target.checked); setDevicePassphrase("");}}/>
                Keep encrypted device keys on this browser
              </label>
              {rememberDevice && <>
                <label htmlFor="device-passphrase">Local encryption passphrase (20+ characters)</label>
                <input id="device-passphrase" value={devicePassphrase}
                  onChange={e => setDevicePassphrase(e.target.value)}
                  type="password" autoComplete="new-password" minLength={20} maxLength={1024}
                  aria-describedby="local-crypto-note" required />
                <p className="local-crypto-note" id="local-crypto-note">
                  Your passphrase encrypts the Matrix crypto database and is never stored. The browser
                  retains a device ID, but not a password or access token. A lost passphrase cannot be
                  recovered here. Use only one tab at a time.
                </p>
              </>}
              <button type="submit" className="primary" disabled={busy}>{busy ? "Connecting…" : "Connect to Messenger"}</button>
            </form>
            <p className="security-note"><span aria-hidden="true">◇</span> Your login password is never saved. Optional local crypto storage is passphrase-encrypted; this preview still lacks verified device identities, remote key backup and account recovery.</p>
            <details className="erase-device-panel">
              <summary>Erase this browser's saved encrypted device</summary>
              <p>
                Irreversible: deletes this browser's local Matrix encryption keys for one account.
                Without a verified key backup, old encrypted history may be lost forever.
                This does not revoke server tokens or affect another browser or device.
              </p>
              <form onSubmit={eraseDevice}>
                <label htmlFor="erase-account">Exact Matrix account ID</label>
                <input id="erase-account" autoComplete="off" value={eraseAccount}
                  onChange={e => setEraseAccount(e.target.value)}
                  placeholder="@you:example.org" maxLength={255} required />
                <label htmlFor="erase-acknowledgment">Type ERASE to confirm permanent local deletion</label>
                <input id="erase-acknowledgment" autoComplete="off" spellCheck={false}
                  value={eraseAcknowledgment} maxLength={5}
                  onChange={e => setEraseAcknowledgment(e.target.value)} required />
                <button type="submit" className="erase-device-button"
                  disabled={busy || !validMatrixId(eraseAccount.trim()) || eraseAcknowledgment !== "ERASE"}>
                  Permanently erase local encrypted device
                </button>
              </form>
              <p className="local-crypto-note">
                Close other Messenger tabs before erasing. The action only touches this account's
                two known Matrix Rust SDK crypto databases and scoped device metadata.
              </p>
            </details>
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
            {invitations.length > 0 && <section className="invite-list" aria-label="Pending room invitations">
              <h3>Invitations ({invitations.length})</h3>
              <p>Joining may disclose your account membership. Encryption is checked after joining; unencrypted rooms remain read-only.</p>
              {invitations.map(invitation => <div className="invite-item" key={invitation.id}>
                <strong>{invitation.name}</strong>
                <div className="invite-actions">
                  <button type="button" className="quiet bordered" disabled={busy}
                    aria-label={"Join invited room " + invitation.name}
                    onClick={() => client && void perform(async () => {
                      await acceptInvitation(client, invitation.id);
                      setRevision(n => n + 1);
                      setNotice("Joined invited room. Check room encryption before sending.");
                    })}>Join</button>
                  <button type="button" className="quiet bordered" disabled={busy}
                    aria-label={"Decline invited room " + invitation.name}
                    onClick={() => client && void perform(async () => {
                      await declineInvitation(client, invitation.id);
                      setRevision(n => n + 1);
                      setNotice("Declined room invitation.");
                    })}>Decline</button>
                </div>
              </div>)}
            </section>}
            <div className="room-list">
              {rooms.length === 0 ? <p className="muted empty">No rooms yet. Create your first encrypted conversation.</p> :
                rooms.map(room => <button type="button" key={room.id} onClick={() => { setSelectedId(room.id); setReplyingTo(null); setMessageQuery(""); }}
                  aria-current={selected?.id === room.id ? "true" : undefined}
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
              <div className="loaded-search">
                <label htmlFor="loaded-message-search">Search loaded messages</label>
                <input id="loaded-message-search" type="search" value={messageQuery}
                  maxLength={128} autoComplete="off" placeholder="Find text or sender in this room"
                  onChange={e => setMessageQuery(e.target.value)} />
                <small>{messageQuery.trim() ? visibleMessages.length + " local matches" :
                  "On-device search of loaded messages only. No server search."}</small>
              </div>
              <div className="messages" role="log" aria-live="polite" aria-label="Messages">
                {selected.messages.length === 0 ? <div className="empty-chat"><span aria-hidden="true">◌</span><h3>A fresh conversation</h3><p>Once messages arrive, they will appear here.</p></div> :
                  visibleMessages.length === 0
                    ? <div className="empty-chat"><h3>No local matches</h3><p>Only currently loaded messages are searched. Load older history to search more.</p></div>
                    : visibleMessages.map(message =>
                    <article className={"message " + (message.sender === myId ? "mine" : "")} key={message.id}>
                      <small>{message.sender} · {new Date(message.timestamp).toLocaleString()}</small>
                      <p>{message.body}</p>
                      {selected.encrypted && message.id.startsWith("$") && <div className="message-actions">
                        <button type="button" className="message-action"
                          aria-label={"Reply to message from " + message.sender}
                          onClick={() => setReplyingTo(message)}>Reply</button>
                        <span className="reaction-notice" role="status">
                          Reactions disabled: the pinned SDK would expose the emoji without E2EE.
                        </span>
                        {message.reactions.map(({emoji, count}) => <span className="reaction-pill" key={emoji}>{emoji} {count}</span>)}
                      </div>}
                    </article>)}
              </div>
              {replyingTo && <div className="reply-target" role="status">
                <span>Replying to {replyingTo.sender}: {replyingTo.body.slice(0, 72)}</span>
                <button type="button" className="quiet" onClick={() => setReplyingTo(null)}>Cancel reply</button>
              </div>}
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
            <section className="crypto-readiness" aria-label="Local encryption SDK status">
              <div className="crypto-readiness-heading">
                <strong>Local SDK crypto status</strong>
                <button type="button" className="quiet bordered" disabled={busy}
                  onClick={() => client && void perform(async () => {
                    setCryptoReadiness(await inspectBrowserCryptoReadiness(client));
                  })}>Inspect</button>
              </div>
              <p role="status">{cryptoReadiness
                ? cryptoReadinessSummary(cryptoReadiness)
                : "Not inspected this session."}</p>
              <small>{cryptoReadinessDisclaimer}</small>
            </section>
            {selected ? <>
              <div className="detail-box"><span className="eyebrow">SECURITY</span><strong>{selected.encrypted ? "End-to-end encryption configured" : "No room encryption"}</strong><small>{selected.encrypted ? "Device verification and key backup are not implemented yet." : "Message content may be visible to the homeserver."}</small></div>
              <p className="detail-label">Room ID</p><code className="room-id">{selected.id}</code>
              <form onSubmit={invite} className="invite-form"><label htmlFor="invite">Invite a Matrix user</label>
                <input id="invite" value={inviteId} onChange={e => setInviteId(e.target.value)} placeholder="@friend:server.org" required />
                <button type="submit" className="quiet bordered" disabled={busy || !selected.encrypted || !validMatrixId(inviteId)}>Send invitation</button></form>
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
