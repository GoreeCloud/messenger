import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTimeline } from '../src/timeline.mjs';
const local = (id, extra = {}) => ({ id, own: true, protocol: 'DATA', text: 'draft',
  timestamp: 2, delivery: 'Delivery unconfirmed', error: true, ...extra });
const server = (id, extra = {}) => ({ id, own: false, protocol: 'DATA', text: 'from server',
  timestamp: 1, ...extra });

test('failed sends survive polling and retain retry id', () => {
  assert.deepEqual(reconcileTimeline([local('txn-1')], [server('$a')]),
    [server('$a'), local('txn-1')]);
});
test('accepted sends merge by server event ID without duplicates', () => {
  const previous = local('txn-1', { eventId: '$a', delivery: 'Accepted by homeserver', error: false });
  const result = reconcileTimeline([previous], [server('$a', { own: true, timestamp: 3 })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'txn-1');
  assert.equal(result[0].eventId, '$a');
  assert.equal(result[0].delivery, 'Confirmed by sync');
  assert.equal(result[0].error, false);
});
test('does not infer sends from identical content', () => {
  const existing = local('txn-1', { text: 'same' });
  const result = reconcileTimeline([existing], [server('$unrelated', { text: 'same' })]);
  assert.equal(result.length, 2);
});
test('deduplicates server pages by event ID', () => {
  assert.deepEqual(reconcileTimeline([], [server('$a'), server('$a'), server('$b')]),
    [server('$a'), server('$b')]);
});
test('preserves unconfirmed sends with bounded history', () => {
  const inbound = Array.from({ length: 10 }, (_, i) => server('$' + i, { timestamp: i }));
  const result = reconcileTimeline([local('retry')], inbound, { limit: 4 });
  assert.equal(result.length, 4);
  assert.equal(result.some(m => m.id === 'retry' && m.error), true);
});
test('cannot bypass the bounded limit and skips malformed server events', () => {
  assert.throws(() => reconcileTimeline([], [], { limit: Infinity }), RangeError);
  assert.throws(() => reconcileTimeline({}, []), TypeError);
  assert.deepEqual(reconcileTimeline([], [null, { id: '$a' }, server('$b')]), [server('$b')]);
});
test('does not retain arbitrarily old own events outside the server page', () => {
  const oldServerOwn = server('$old', { own: true, timestamp: -10 });
  assert.deepEqual(reconcileTimeline([oldServerOwn], [server('$new')]), [server('$new')]);
});
