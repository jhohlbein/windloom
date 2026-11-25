import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { BackendStore } from '../server/store.js';
function setup() {
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(query, ...args) {
      const stmt = db.prepare(query);
      const rows = stmt.all(...args);
      return { toArray: () => rows, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    }
  };
  return { db, store: new BackendStore(sql) };
}
const guest = { id: 'a', name: 'Amira' };
test('SQLite admission tickets expire, are channel-bound, and can only be consumed once', () => {
  const { db, store } = setup();
  try {
    const t = store.issueTicket(guest, 'room', 'room-a', 1000, 30);
    assert.equal(store.consumeTicket(t.ticket, 'room', 'room-a', 1001).id, 'a');
    assert.throws(() => store.consumeTicket(t.ticket, 'room', 'room-a', 1002));
    const expired = store.issueTicket(guest, 'room', 'room-a', 1000, 30);
    assert.throws(() => store.consumeTicket(expired.ticket, 'room', 'room-a', 31001));
    const wrong = store.issueTicket(guest, 'room', 'room-a', 1000, 30);
    assert.throws(() => store.consumeTicket(wrong.ticket, 'live', '', 1001));
  } finally {
    db.close();
  }
});
test('SQLite boards keep only each competitive guest’s best and separate co-op team sizes', () => {
  const { db, store } = setup();
  try {
    const result = {
      runId: '1',
      ruleset: 'v1',
      mode: 'competitive',
      seed: 1,
      partySize: 1,
      score: 20,
      members: [guest],
      completedAt: 1000
    };
    store.publish(result);
    store.publish({ ...result, runId: '2', score: 10 });
    store.publish({ ...result, runId: '3', score: 30 });
    assert.equal(store.readBoard('v1', 'competitive', 1)[0].score, 30);
    assert.equal(store.readBoard('v1', 'competitive', 1).length, 1);
    store.publish({ ...result, runId: 'c1', mode: 'coop', partySize: 2 });
    assert.equal(store.readBoard('v1', 'coop', 1).length, 0);
    assert.equal(store.readBoard('v1', 'coop', 2).length, 1);
    assert.equal(store.readBoard('old', 'competitive', 1).length, 0);
    for (let i = 0; i < 105; i++)
      store.publish({
        ...result,
        runId: 'r' + i,
        members: [{ id: 'p' + i, name: 'Player' }],
        score: i
      });
    const rows = store.readBoard('v1', 'competitive', 1);
    assert.equal(rows.length, 100);
    assert.equal(rows[0].score, 104);
  } finally {
    db.close();
  }
});
test('presence deduplicates players across rooms, expires crashes, and caps simultaneous rooms', () => {
  const { db, store } = setup();
  try {
    store.reserveRoom('a', 'guest', 1000, 1);
    store.updatePresence('a', ['guest'], 1000, 90);
    assert.equal(store.online(1001), 1);
    assert.throws(() => store.reserveRoom('b', 'another', 1001, 1));
    store.updatePresence('b', ['guest', 'other'], 1001, 90);
    assert.equal(store.online(1002), 2);
    assert.equal(store.online(92000), 0);
  } finally {
    db.close();
  }
});
