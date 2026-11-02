import test from "node:test";
import assert from "node:assert/strict";
import { planRoute, createCapabilities, formatSecurity } from "../src/protocols.mjs";
const caps = createCapabilities({DATA:{available:true,encrypted:true,verified:true},
  RCS:{available:true,verified:true},SMS:{available:true,verified:true},MMS:{available:true,verified:true}});
test("secure DATA preferred by default", () => {
  assert.deepEqual(planRoute({capabilities:caps}), {status:"ready", protocol:"DATA",encrypted:true,cost:"internet-data"});
});
test("no silent downgrade even if fallback requested", () => {
  const c = createCapabilities({SMS:{available:true,verified:true}});
  assert.equal(planRoute({capabilities:c,policy:{preferred:["DATA","SMS"],requireEncryption:true,allowFallback:true}}).status,"blocked");
});
test("encryption downgrade needs explicit confirmation", () => {
  const result = planRoute({requested:"SMS",capabilities:caps,policy:{requireEncryption:false},
    previous:{protocol:"DATA",encrypted:true}});
  assert.equal(result.status,"confirmation-required");
});
test("carrier unavailable despite optimistic capability hint", () => {
  const c = createCapabilities({RCS:{available:true,verified:false}});
  assert.equal(planRoute({requested:"RCS",capabilities:c,policy:{requireEncryption:false}}).status,"blocked");
});
test("explicit insecure cellular route allowed when encryption not required", () => {
  assert.equal(planRoute({requested:"SMS",capabilities:caps,policy:{requireEncryption:false}}).protocol,"SMS");
});
test("fallback must be enabled", () => {
  const c = createCapabilities({SMS:{available:true,verified:true}});
  assert.equal(planRoute({capabilities:c,policy:{preferred:["DATA","SMS"],requireEncryption:false,allowFallback:false}}).status,"blocked");
  assert.equal(planRoute({capabilities:c,policy:{preferred:["DATA","SMS"],requireEncryption:false,allowFallback:true}}).protocol,"SMS");
});
test("unknown protocol fails closed",()=>assert.equal(planRoute({requested:"FAX",capabilities:caps}).status,"blocked"));
test("security badge never claims carrier E2EE",()=>{
  assert.equal(formatSecurity("SMS",false),"Not end-to-end encrypted");
  assert.equal(formatSecurity("RCS",false),"Not end-to-end encrypted");
});
