import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseInput,
  roomDescriptor,
  roomKey,
  rulesetId,
  normalizeNickname
} from '../src/online/protocol.js';
import { issueCredential, verifyCredential } from '../server/auth.js';
const secret = 'a'.repeat(64);
test('input protocol accepts controls, not client positions, scores, or non-finite axes', () => {
  const v = parseInput({
    type: 'input',
    seq: 1,
    keys: { KeyW: true },
    input: { mouseX: 0.5, novaReq: true }
  });
  assert.equal(v.keys.KeyW, true);
  assert.equal(v.input.mouseX, 0.5);
  for (const message of [
    { type: 'score', score: 999 },
    { type: 'input', seq: 1, score: 999 },
    { type: 'input', seq: 2, input: { mouseX: NaN } },
    { type: 'input', seq: 2, input: { mouseX: 8 } },
    { type: 'input', seq: -1 }
  ])
    assert.throws(() => parseInput(message));
});
test('same seed/mode/round/ruleset finds the same room; different game types stay isolated', () => {
  const a = roomDescriptor(
    { seed: 123, mode: 'coop', round: 'timed', ruleset: 'v1-test' },
    'v1-test'
  );
  assert.equal(roomKey(a), 'v1-test|coop|timed|123');
  assert.notEqual(roomKey(a), roomKey({ ...a, mode: 'competitive' }));
  assert.throws(() => roomDescriptor({ ...a, seed: -1 }, 'v1-test'));
  assert.throws(() => roomDescriptor({ ...a, ruleset: 'old' }, 'v1-test'));
});
test('nickname validation accepts Unicode but rejects markup controls and overlong input', () => {
  assert.equal(normalizeNickname('  أميرة 🪁  '), 'أميرة 🪁');
  assert.throws(() => normalizeNickname('x'.repeat(25)));
  assert.throws(() => normalizeNickname('a\u202eb'));
});
test('ruleset is stable across derived browser fields and changes with gameplay configuration', async () => {
  assert.equal(
    await rulesetId({ world: { a: 1 } }),
    await rulesetId({ world: { a: 1, boundRadius: 30 } })
  );
  assert.notEqual(await rulesetId({ world: { a: 1 } }), await rulesetId({ world: { a: 2 } }));
});
test('guest credentials reject tampering, expiry and another signing secret', async () => {
  const token = await issueCredential({ id: 'guest-1', name: 'Amira' }, secret, 1000);
  assert.equal((await verifyCredential(token, secret, 1001)).id, 'guest-1');
  await assert.rejects(() => verifyCredential(token.slice(0, -1) + 'x', secret, 1001));
  await assert.rejects(() => verifyCredential(token, 'b'.repeat(64), 1001));
  await assert.rejects(() => verifyCredential(token, secret, 1000 + 366 * 86400000));
});
