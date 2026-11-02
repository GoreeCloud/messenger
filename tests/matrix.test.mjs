import test from "node:test";
import assert from "node:assert/strict";
import { MatrixPlaintextSession, MatrixError, validateHomeserver } from "../src/matrix.mjs";
function fake(status, payload={}) {
  return {ok:status>=200&&status<300,status,async json(){return payload;}};
}
test("rejects remote insecure schemes, credentials, paths",()=>{
  for(const url of ["http://example.org","https://user:pass@example.org","https://example.org/p",
    "https://example.org/?token=a","javascript:alert(1)"]) {
    assert.throws(()=>validateHomeserver(url));
  }
  assert.equal(validateHomeserver("https://example.org"),"https://example.org");
  assert.equal(validateHomeserver("http://localhost:8008"),"http://localhost:8008");
});
test("requests use Authorization header and never put token in URLs",async()=>{
  let seen;
  const session=new MatrixPlaintextSession({homeserver:"https://matrix.example.org",accessToken:"supersecret",
    fetchImpl:async(url,opts)=>{seen={url,opts};return fake(200,{user_id:"@a:example.org"});}});
  assert.equal(await session.whoami(),"@a:example.org");
  assert.ok(!seen.url.includes("supersecret"));
  assert.equal(seen.opts.headers.Authorization,"Bearer supersecret");
  assert.equal(seen.opts.redirect,"error");
  session.close();
});
test("encrypted rooms block REST reads and all plaintext sends",async()=>{
  const session=new MatrixPlaintextSession({homeserver:"https://matrix.example.org",accessToken:"x",
    fetchImpl:async()=>fake(200,{algorithm:"m.megolm.v1.aes-sha2"})});
  const encrypted={id:"!r:example.org",encrypted:"encrypted"};
  await assert.rejects(session.readMessages(encrypted),MatrixError);
  await assert.rejects(session.sendPlaintext(encrypted,"hello","12345678",{allowPlaintext:true}),MatrixError);
});
test("unencrypted room requires explicit opt-in",async()=>{
  let calls=0;
  const session=new MatrixPlaintextSession({homeserver:"https://matrix.example.org",accessToken:"x",
    fetchImpl:async()=>{calls++;return fake(200,{event_id:"$e"});}});
  const room={id:"!r:example.org",encrypted:"plaintext"};
  await assert.rejects(session.sendPlaintext(room,"hi","12345678"),MatrixError);
  assert.equal(calls,0);
  await session.sendPlaintext(room,"hi","12345678",{allowPlaintext:true});
  assert.equal(calls,1);
});
test("unknown encryption state fails closed",async()=>{
  const session=new MatrixPlaintextSession({homeserver:"https://matrix.example.org",accessToken:"x",
    fetchImpl:async()=>fake(403,{})});
  await assert.rejects(session.inspectRoom("!r:example.org"),MatrixError);
});
