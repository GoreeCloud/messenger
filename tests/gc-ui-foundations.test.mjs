import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = name => readFileSync(new URL(name, import.meta.url), "utf8");
const html = file("../web/index.html");
const tokens = file("../web/foundations/gc-ui-tokens.v1.0.1.css");
const css = file("../web/styles.css");
const app = file("../web/app.mjs");

test("first-party Foundations 1.0.1 tokens load before app styles on the same origin", () => {
  assert.ok(html.indexOf("./foundations/gc-ui-tokens.v1.0.1.css") >= 0);
  assert.ok(html.indexOf("./foundations/gc-ui-tokens.v1.0.1.css") < html.indexOf("./styles.css"));
  assert.match(tokens, /--gc-v1-foundation-radius-lg: 26px/);
  assert.match(tokens, /--gc-v1-color-primary:/);
  assert.match(tokens, /:root\[data-gc-mode="dark"\]/);
  assert.match(html, /data-gc-accent="lagoon"/);
  assert.doesNotMatch(html, /https?:\/\/[^" ]+\.css/);
});
test("Messenger app aliases target official v1 semantic tokens", () => {
  assert.match(css, /--accent: var\(--gc-v1-color-primary\)/);
  assert.match(css, /--accent-contrast: var\(--gc-v1-color-on-primary\)/);
  assert.match(css, /--r-surface: var\(--gc-v1-foundation-radius-lg\)/);
  assert.match(app, /syncGCUITheme\(\)/);
  assert.match(app, /prefers-contrast: more/);
});
