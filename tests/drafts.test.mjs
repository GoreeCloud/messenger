import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionDrafts } from '../src/drafts.mjs';
test('keeps each conversation draft independently in volatile memory', () => {
  const d = new SessionDrafts();
  d.set('notes', 'personal'); d.set('!room:a', 'unfinished');
  assert.equal(d.get('notes'), 'personal');
  assert.equal(d.get('!room:a'), 'unfinished');
  d.set('!room:a', '');
  assert.equal(d.get('!room:a'), '');
});
test('disconnection clears prior account drafts but retains local notes', () => {
  const d = new SessionDrafts();
  d.set('notes', 'private note'); d.set('!old:server', 'old secret');
  d.clearOtherAccounts();
  assert.equal(d.get('!old:server'), '');
  assert.equal(d.get('notes'), 'private note');
});
test('rejects unbounded/invalid drafts and fails closed after close', () => {
  const d = new SessionDrafts();
  assert.throws(() => d.set('room', 'x'.repeat(16001)));
  assert.throws(() => d.set('', 'bad'));
  d.close();
  assert.equal(d.get('room'), '');
  assert.throws(() => d.set('room', 'after close'));
});
