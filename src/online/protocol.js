import { VERSION } from '../version.js';
export const PROTOCOL = 'windloom.v1';
export class ProtocolError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const bad = (message, code = 'BAD_INPUT', status = 400) => {
  throw new ProtocolError(code, message, status);
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function keysOnly(value, keys) {
  if (!object(value) || Object.keys(value).some((k) => !keys.includes(k)))
    bad('Unsupported controls');
}
export function normalizeNickname(value) {
  if (typeof value !== 'string') bad('Enter a nickname');
  const name = value.trim().normalize('NFC');
  if (
    !name ||
    [...name].length > 24 ||
    /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)
  )
    bad('Use a nickname of 1–24 characters without control characters');
  return name;
}
export function roomDescriptor(value, expectedRuleset) {
  keysOnly(value, ['seed', 'mode', 'round', 'ruleset']);
  if (!Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff)
    bad('Invalid island seed');
  if (!['coop', 'competitive'].includes(value.mode) || !['timed', 'free'].includes(value.round))
    bad('Invalid room mode');
  if (value.ruleset !== expectedRuleset)
    bad('The game has changed. Reload the page to join.', 'VERSION_MISMATCH', 409);
  return { seed: value.seed, mode: value.mode, round: value.round, ruleset: expectedRuleset };
}
export const roomKey = (r) => `${r.ruleset}|${r.mode}|${r.round}|${r.seed}`;
export function parseInput(value) {
  keysOnly(value, ['type', 'seq', 'ack', 'keys', 'input', 'settings']);
  if (value.type !== 'input' || !Number.isSafeInteger(value.seq) || value.seq < 1)
    bad('Invalid input sequence');
  if (value.ack !== undefined && (!Number.isSafeInteger(value.ack) || value.ack < 0))
    bad('Invalid snapshot acknowledgement');
  const keys = value.keys ?? {},
    input = value.input ?? {},
    settings = value.settings ?? {};
  const keyNames = [
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Space'
  ];
  const axes = ['mouseX', 'mouseY', 'touchX', 'touchY', 'tiltX', 'tiltY'];
  const buttons = [
    'mouseFire',
    'touchFire',
    'touchBoost',
    'touchBack',
    'touchLeft',
    'touchRight',
    'novaReq'
  ];
  keysOnly(keys, keyNames);
  keysOnly(input, [...axes, ...buttons]);
  keysOnly(settings, ['invertKeys', 'invertMouse']);
  const out = { type: 'input', seq: value.seq, keys: {}, input: {}, settings: {} };
  for (const k of keyNames) {
    if (k in keys && typeof keys[k] !== 'boolean') bad('Invalid key');
    out.keys[k] = keys[k] === true;
  }
  for (const k of axes) {
    const v = input[k] ?? 0;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < -1 || v > 1)
      bad('Invalid steering axis');
    out.input[k] = v;
  }
  for (const k of buttons) {
    if (k in input && typeof input[k] !== 'boolean') bad('Invalid action');
    out.input[k] = input[k] === true;
  }
  for (const k of ['invertKeys', 'invertMouse']) {
    if (k in settings && typeof settings[k] !== 'boolean') bad('Invalid control setting');
    out.settings[k] = settings[k] === true;
  }
  return out;
}
export async function rulesetId(config) {
  const copy = structuredClone(config);
  if (copy.world) delete copy.world.boundRadius;
  const sorted = (v) =>
    Array.isArray(v)
      ? v.map(sorted)
      : object(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sorted(v[k])])
          )
        : v;
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sorted(copy))))
  );
  return (
    VERSION + '-' + [...hash.slice(0, 16)].map((n) => n.toString(16).padStart(2, '0')).join('')
  );
}
export function parseRoomKey(key, ruleset) {
  if (typeof key !== 'string' || key.length > 120) bad('Invalid room');
  const [version, mode, round, seed, ...extra] = key.split('|');
  if (extra.length || !/^\d{1,10}$/.test(seed || '')) bad('Invalid room');
  return roomDescriptor({ ruleset: version, mode, round, seed: Number(seed) }, ruleset);
}
