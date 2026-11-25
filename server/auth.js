import { ProtocolError, normalizeNickname } from '../src/online/protocol.js';
const encoder = new TextEncoder();
const b64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
const bytes = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function key(secret) {
  if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}
export async function issueCredential(guest, secret, now = Date.now()) {
  const data = b64(
    encoder.encode(
      JSON.stringify({
        id: guest.id,
        name: normalizeNickname(guest.name),
        expires: now + 365 * 86400000
      })
    )
  );
  return (
    data +
    '.' +
    b64(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(data))))
  );
}
export async function verifyCredential(token, secret, now = Date.now()) {
  try {
    if (
      typeof token !== 'string' ||
      token.length > 1024 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      throw Error();
    const [data, signature] = token.split('.');
    if (
      !(await crypto.subtle.verify(
        'HMAC',
        await key(secret),
        bytes(signature),
        encoder.encode(data)
      ))
    )
      throw Error();
    const guest = JSON.parse(new TextDecoder().decode(bytes(data)));
    if (
      typeof guest.id !== 'string' ||
      guest.id.length > 64 ||
      !guest.id ||
      !Number.isFinite(guest.expires) ||
      guest.expires <= now
    )
      throw Error();
    guest.name = normalizeNickname(guest.name);
    return guest;
  } catch {
    throw new ProtocolError(
      'UNAUTHORIZED',
      'Your guest session expired. Enter your nickname again.',
      401
    );
  }
}
export async function ipKey(ip, secret) {
  return b64(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', await key(secret), encoder.encode('rate:' + ip))
    )
  );
}
export function bearer(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer '))
    throw new ProtocolError('UNAUTHORIZED', 'Enter a nickname to join.', 401);
  return header.slice(7);
}
