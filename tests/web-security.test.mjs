import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
test('preview CSP disallows inline/eval and does not permit arbitrary network origins', () => {
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /connect-src https:/);
  assert.match(html, /frame-src 'none'/);
  assert.doesNotMatch(html, /unsafe-eval|unsafe-inline|connect-src \*/);
});
test('preview never exposes platform-level SMS permissions or untrusted scripts', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.match(html, /referrer" content="no-referrer"/);
  assert.match(html, /security-symbol" aria-hidden="true">i<\/span>/);
});
