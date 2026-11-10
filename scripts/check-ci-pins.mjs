/**
 * Offline supply-chain regression for Messenger CI action provenance.
 * Source-only validation: pinning is NOT a vulnerability audit or release gate.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const workflows = ['android-preview.yml', 'browser-smoke.yml', 'checks.yml',
  'matrix-sdk-browser.yml', 'matrix-sdk-smoke.yml', 'web-preview.yml'];
const pinned = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '49933ea5288caeca8642d1e84afbd3f7d6820020'],
  ['actions/setup-java', 'b843ebf9b913146b38da2eaa7aeddf76074ae1ad'],
  ['gradle/actions/setup-gradle', '8da46b539cd8fe6ab27ca75128919a18d757604c'],
  ['actions/upload-artifact', 'cf430e030ddbb5b0abf93d22962f4752f3646cd9'],
]);
const expectedByFile = {
  'android-preview.yml': ['actions/checkout', 'actions/setup-java',
    'gradle/actions/setup-gradle', 'actions/upload-artifact'],
  'browser-smoke.yml': ['actions/checkout', 'actions/setup-node',
    'actions/upload-artifact'],
  'checks.yml': ['actions/checkout', 'actions/setup-node'],
  'matrix-sdk-browser.yml': ['actions/checkout', 'actions/setup-node',
    'actions/upload-artifact'],
  'matrix-sdk-smoke.yml': ['actions/checkout', 'actions/setup-node',
    'actions/upload-artifact'],
  'web-preview.yml': ['actions/checkout', 'actions/setup-node',
    'actions/upload-artifact'],
};

function assertPinned(file, yaml) {
  const uses = [...yaml.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)]
    .map(m => m[1]);
  const required = expectedByFile[file];
  assert.equal(uses.length, required.length, file + ': action count changed');
  const actions = new Set();
  for (const value of uses) {
    const at = value.lastIndexOf('@');
    const action = value.slice(0, at);
    const sha = value.slice(at + 1);
    assert.equal(sha, pinned.get(action), file + ': unexpected or movable action');
    assert.ok(required.includes(action), file + ': unexpected action');
    assert.ok(!actions.has(action), file + ': duplicate action');
    actions.add(action);
  }
  for (const action of required) assert.ok(actions.has(action), file + ': missing action');
  const checkouts = [...yaml.matchAll(
    /^\s*-\s*uses:\s*actions\/checkout@[a-f0-9]{40}\n\s+with:\n\s+persist-credentials:\s*false\s*$/gm
  )];
  assert.equal(checkouts.length, 1, file + ': checkout must not persist credentials');
}

for (const file of workflows) {
  const path = fileURLToPath(new URL('../.github/workflows/' + file, import.meta.url));
  assertPinned(file, readFileSync(path, 'utf8'));
}
const target = 'checks.yml';
const source = readFileSync(
  fileURLToPath(new URL('../.github/workflows/' + target, import.meta.url)), 'utf8');
for (const mutant of [
  source.replace(pinned.get('actions/checkout'), 'v4'),
  source.replace('persist-credentials: false', 'persist-credentials: true'),
  source.replace('actions/setup-node@' + pinned.get('actions/setup-node'),
    'actions/setup-python@v6'),
]) {
  assert.throws(() => assertPinned(target, mutant), assert.AssertionError);
}
process.stdout.write('PASS: six Messenger workflows pinned and checkout credentials disabled\n');
