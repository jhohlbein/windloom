import { DurableObject } from 'cloudflare:workers';
import config from '../config/game-config.json';
import { Room } from './room-core.js';
import { BackendStore } from './store.js';
import { bearer, ipKey, issueCredential, verifyCredential } from './auth.js';
import {
  PROTOCOL,
  ProtocolError,
  normalizeNickname,
  roomDescriptor,
  roomKey,
  parseRoomKey,
  rulesetId
} from '../src/online/protocol.js';

const settings = {
  maxMessageBytes: 4096,
  maxBufferedBytes: 1048576,
  maxViewers: 128,
  maxActiveRooms: 16,
  ticketSeconds: 30,
  presenceLeaseSeconds: 90,
  presenceRefreshSeconds: 30,
  tickHz: 20,
  snapshotHz: 10,
  ...config.multiplayer
};
let rulesetPromise;
const ruleset = () => (rulesetPromise ??= rulesetId(config));
const live = (env) => env.LIVE.get(env.LIVE.idFromName('global'));
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function safeSend(ws, value) {
  try {
    if (ws.bufferedAmount > settings.maxBufferedBytes) {
      ws.close(1013, 'Connection too slow');
      return;
    }
    ws.send(typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    try {
      ws.close(1011, 'Connection interrupted');
    } catch {}
  }
}
function publicError(error) {
  return {
    type: 'error',
    code: error instanceof ProtocolError ? error.code : 'ONLINE_UNAVAILABLE',
    message:
      error instanceof ProtocolError
        ? error.message
        : 'Online is temporarily unavailable. Please retry later or play solo.'
  };
}
async function rpcResult(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return {
      ok: false,
      error: { ...publicError(e), status: e instanceof ProtocolError ? e.status : 503 }
    };
  }
}
function unwrap(result) {
  if (!result.ok)
    throw new ProtocolError(result.error.code, result.error.message, result.error.status);
  return result.value;
}
function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  return (
    origin &&
    (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((v) => v.trim())
      .includes(origin)
  );
}
function cors(response, origin) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Max-Age', '600');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ProtocolError('BAD_INPUT', 'Missing request body');
  let total = 0,
    text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > settings.maxMessageBytes) {
        await reader.cancel();
        throw new ProtocolError('BAD_INPUT', 'Request is too large', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (e) {
    if (e instanceof ProtocolError) throw e;
    throw new ProtocolError('BAD_INPUT', 'Invalid JSON request');
  }
}
function ticketFrom(request) {
  const protocols = (request.headers.get('Sec-WebSocket-Protocol') || '')
    .split(',')
    .map((s) => s.trim());
  if (!protocols.includes(PROTOCOL))
    throw new ProtocolError('VERSION_MISMATCH', 'Reload the game to connect.', 409);
  const ticket = protocols.find((p) => p.startsWith('ticket.'))?.slice(7);
  if (!ticket) throw new ProtocolError('UNAUTHORIZED', 'Missing admission ticket', 401);
  return ticket;
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/health')
      return json({ ok: true });
    const origin = request.headers.get('Origin');
    if (!originAllowed(request, env))
      return json({ code: 'FORBIDDEN', message: 'Origin is not allowed' }, 403);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
    const url = new URL(request.url);
    try {
      const version = await ruleset(),
        board = live(env);
      if (request.method === 'GET' && url.pathname === '/api/info')
        return cors(
          json({
            protocol: PROTOCOL,
            ruleset: version,
            online: await board.online(),
            limits: {
              maxPlayers: settings.maxPlayers ?? 8,
              inputHz: settings.inputHz ?? 10,
              snapshotHz: settings.snapshotHz,
              reconnectSeconds: settings.reconnectSeconds ?? 30
            }
          }),
          origin
        );
      if (request.method === 'POST' && url.pathname === '/api/session') {
        const data = await body(request);
        const name = normalizeNickname(data.nickname);
        const ip = await ipKey(
          request.headers.get('CF-Connecting-IP') || 'local',
          env.SESSION_SECRET
        );
        unwrap(await board.sessionRate(ip));
        const old = data.credential
          ? await verifyCredential(data.credential, env.SESSION_SECRET)
          : null;
        const guest = { id: old?.id || crypto.randomUUID(), name };
        return cors(
          json({ guest, credential: await issueCredential(guest, env.SESSION_SECRET) }),
          origin
        );
      }
      if (request.method === 'POST' && url.pathname === '/api/ws-ticket') {
        const data = await body(request);
        if (!['room', 'live'].includes(data.channel))
          throw new ProtocolError('BAD_INPUT', 'Invalid connection');
        let guest;
        if (data.channel === 'room')
          guest = await verifyCredential(bearer(request), env.SESSION_SECRET);
        else {
          unwrap(
            await board.viewerRate(
              await ipKey(request.headers.get('CF-Connecting-IP') || 'local', env.SESSION_SECRET)
            )
          );
          guest = { id: 'viewer-' + crypto.randomUUID(), name: 'Viewer' };
        }
        const descriptor = data.channel === 'room' ? roomDescriptor(data.room, version) : null,
          key = descriptor ? roomKey(descriptor) : '';
        if (descriptor && !(await env.ROOMS.get(env.ROOMS.idFromName(key)).canJoin(guest.id)))
          throw new ProtocolError(
            'ROOM_FULL',
            'This room is full. Try another island or play solo.',
            409
          );
        const ticket = unwrap(await board.issueTicket(guest, data.channel, key));
        return cors(
          json({
            ...ticket,
            path: descriptor ? '/api/room?room=' + encodeURIComponent(key) : '/api/live'
          }),
          origin
        );
      }
      if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
        const mode = url.searchParams.get('mode') || 'competitive',
          party = Number(url.searchParams.get('partySize') || 1);
        if (
          !['coop', 'competitive'].includes(mode) ||
          !Number.isInteger(party) ||
          party < 1 ||
          party > 8
        )
          throw new ProtocolError('BAD_INPUT', 'Invalid leaderboard');
        return cors(
          json({
            ruleset: version,
            rows: await board.readBoard(version, mode, mode === 'competitive' ? 1 : party),
            online: await board.online()
          }),
          origin
        );
      }
      if (request.method === 'GET' && ['/api/room', '/api/live'].includes(url.pathname)) {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
          throw new ProtocolError('BAD_INPUT', 'WebSocket required', 426);
        const channel = url.pathname === '/api/room' ? 'room' : 'live';
        const descriptor =
            channel === 'room' ? parseRoomKey(url.searchParams.get('room'), version) : null,
          key = descriptor ? roomKey(descriptor) : '';
        const guest = unwrap(await board.consumeTicket(ticketFrom(request), channel, key));
        const headers = new Headers({
          'X-Windloom-Guest': JSON.stringify(guest),
          'X-Windloom-Room': JSON.stringify(descriptor)
        });
        const internal = new Request('https://internal/' + channel, {
          headers: { ...Object.fromEntries(headers), Upgrade: 'websocket' }
        });
        if (channel === 'live') return await board.fetch(internal);
        unwrap(await board.reserveRoom(key, guest.id));
        try {
          const response = await env.ROOMS.get(env.ROOMS.idFromName(key)).fetch(internal);
          if (response.status !== 101) await board.releaseMember(key, guest.id);
          return response;
        } catch (e) {
          await board.releaseMember(key, guest.id);
          throw e;
        }
      }
      return cors(
        json(
          { code: 'NOT_FOUND', message: 'Unsupported endpoint' },
          request.method === 'GET' ? 404 : 405
        ),
        origin
      );
    } catch (error) {
      return cors(
        json(publicError(error), error instanceof ProtocolError ? error.status : 503),
        origin
      );
    }
  }
};

export class LiveBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new BackendStore(ctx.storage.sql);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async sessionRate(ip) {
    return rpcResult(() => {
      this.store.rate('session-minute:' + ip, 20, 60000);
      this.store.rate('session-day:' + ip, 200, 86400000);
    });
  }
  async viewerRate(ip) {
    return rpcResult(() => this.store.rate('viewer-minute:' + ip, 40, 60000));
  }
  async issueTicket(guest, channel, key) {
    return rpcResult(() => {
      this.store.rate('ticket:' + guest.id, 40, 60000);
      return this.store.issueTicket(guest, channel, key, Date.now(), settings.ticketSeconds);
    });
  }
  async consumeTicket(ticket, channel, key) {
    return rpcResult(() => this.store.consumeTicket(ticket, channel, key));
  }
  async reserveRoom(key, id) {
    return rpcResult(async () => {
      this.store.reserveRoom(
        key,
        id,
        Date.now(),
        Number(this.env.MAX_ACTIVE_ROOMS) || settings.maxActiveRooms
      );
      await this.changed();
    });
  }
  async releaseMember(key, id) {
    this.store.releaseMember(key, id);
    await this.changed();
  }
  async presence(key, ids) {
    this.store.updatePresence(key, ids, Date.now(), settings.presenceLeaseSeconds);
    await this.changed();
  }
  async online() {
    return this.store.online();
  }
  async readBoard(version, mode, party) {
    return this.store.readBoard(version, mode, party, settings.leaderboardSize ?? 100);
  }
  async publish(result) {
    if (this.store.publish(result, settings.leaderboardSize ?? 100)) await this.changed();
  }
  async changed() {
    const packet = { type: 'live', online: this.store.online(), revision: this.store.revision() };
    if (packet.online !== this.lastOnline || packet.revision !== this.lastRevision) {
      this.lastOnline = packet.online;
      this.lastRevision = packet.revision;
      for (const ws of this.ctx.getWebSockets()) safeSend(ws, packet);
    }
    const next = this.store.nextExpiry();
    if (next !== null) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }
  async fetch(request) {
    if (this.ctx.getWebSockets().length >= settings.maxViewers)
      return json(
        { code: 'ONLINE_BUSY', message: 'Live rankings are busy. Try again later.' },
        503
      );
    const guest = JSON.parse(request.headers.get('X-Windloom-Guest'));
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    for (const old of this.ctx.getWebSockets())
      if (old.deserializeAttachment()?.id === guest.id)
        try {
          old.close(1000, 'Replaced by another tab');
        } catch {}
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: guest.id });
    safeSend(server, {
      type: 'live',
      online: this.store.online(),
      revision: this.store.revision()
    });
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': PROTOCOL }
    });
  }
  webSocketMessage(ws) {
    try {
      ws.close(1008, 'Read-only connection');
    } catch {}
  }
  webSocketClose(ws, code) {
    try {
      ws.close(code === 1006 ? 1000 : code);
    } catch {}
  }
  webSocketError(ws) {
    try {
      ws.close(1011, 'Connection interrupted');
    } catch {}
  }
  async alarm() {
    this.store.cleanup();
    await this.changed();
  }
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.timer = null;
    this.lastSnapshot = 0;
    this.lastLease = 0;
    this.pendingTick = null;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    for (const ws of ctx.getWebSockets()) {
      const old = ws.deserializeAttachment();
      safeSend(ws, {
        type: old?.finished ? 'room-ended' : 'interrupted',
        message: old?.finished
          ? 'The round finished. Join again to play.'
          : 'The room restarted. Join again to start a new round.'
      });
      try {
        ws.close(1012, 'Room restarted');
      } catch {}
    }
  }
  canJoin(id) {
    return !this.room || this.room.canJoin(id);
  }
  async fetch(request) {
    let accepted, guest, connectionId;
    try {
      guest = JSON.parse(request.headers.get('X-Windloom-Guest'));
      const descriptor = JSON.parse(request.headers.get('X-Windloom-Room'));
      this.room ??= new Room(descriptor, config);
      connectionId = crypto.randomUUID();
      this.room.connect(guest, connectionId);
      const pair = new WebSocketPair(),
        [client, server] = Object.values(pair);
      for (const old of this.ctx.getWebSockets())
        if (old.deserializeAttachment()?.id === guest.id)
          try {
            old.close(1000, 'Replaced by another tab');
          } catch {}
      this.ctx.acceptWebSocket(server);
      accepted = server;
      server.serializeAttachment({ id: guest.id, connectionId, finished: false });
      this.sendSnapshot(server);
      await this.lease();
      this.startTimer();
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: { 'Sec-WebSocket-Protocol': PROTOCOL }
      });
    } catch (e) {
      if (accepted) {
        try {
          accepted.close(1013, 'Admission interrupted');
        } catch {}
        this.room?.disconnect(guest.id, connectionId);
        this.startTimer();
      }
      return json(publicError(e), e instanceof ProtocolError ? e.status : 503);
    }
  }
  startTimer() {
    if (!this.timer && this.room?.hasSimulation)
      this.timer = setInterval(() => {
        if (!this.pendingTick)
          this.pendingTick = this.tick().finally(() => {
            this.pendingTick = null;
          });
      }, 1000 / settings.tickHz);
  }
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  sendSnapshot(ws) {
    const a = ws.deserializeAttachment();
    if (a.blocked) return;
    const snapshotId = (a.snapshotId || 0) + 1,
      pending = (a.pending || []).filter(([id]) => id > (a.ack || 0));
    const packet = JSON.stringify({ ...this.room.snapshotFor(a.id), snapshotId }),
      bytes = new TextEncoder().encode(packet).byteLength;
    if (
      pending.length >= (settings.maxUnackedSnapshots ?? 50) ||
      pending.reduce((n, [, size]) => n + size, 0) + bytes > settings.maxBufferedBytes
    ) {
      ws.serializeAttachment({ ...a, blocked: true });
      safeSend(ws, {
        type: 'error',
        code: 'CONNECTION_TOO_SLOW',
        message:
          'Your connection cannot keep up with this room. Retry on a faster connection or play solo.'
      });
      try {
        ws.close(1013, 'Connection too slow');
      } catch {}
      this.room.disconnect(a.id, a.connectionId);
      return false;
    }
    pending.push([snapshotId, bytes]);
    ws.serializeAttachment({ ...a, snapshotId, pending });
    safeSend(ws, packet);
  }
  async lease() {
    if (!this.room) return;
    this.lastLease = Date.now();
    await live(this.env).presence(this.room.key, this.room.activeIds);
  }
  async tick() {
    try {
      // Workers clocks can stay unchanged between I/O. Timer callbacks must still
      // advance physics, deadlines and disconnect grace without database polling.
      const now = Math.max(Date.now(), this.room.lastAt + 1000 / settings.tickHz);
      this.room.advance(now);
      for (const result of this.room.takeResults()) await live(this.env).publish(result);
      if (now - this.lastSnapshot >= 1000 / settings.snapshotHz || !this.room.hasSimulation) {
        this.lastSnapshot = now;
        for (const ws of this.ctx.getWebSockets()) {
          const a = ws.deserializeAttachment(),
            c = this.room.clients.get(a?.id);
          if (c?.connected && c.connectionId === a.connectionId) {
            if (c.game.G.finished && !a.finished) ws.serializeAttachment({ ...a, finished: true });
            if (this.sendSnapshot(ws) === false) await this.lease();
          }
        }
      }
      if (
        !this.room.hasSimulation ||
        now - this.lastLease >= settings.presenceRefreshSeconds * 1000
      )
        await this.lease();
      if (!this.room.hasSimulation) this.stopTimer();
    } catch {
      this.stopTimer();
      for (const ws of this.ctx.getWebSockets()) {
        safeSend(ws, {
          type: 'error',
          code: 'ONLINE_UNAVAILABLE',
          message:
            'Online reached a service limit or was interrupted. Please retry later or play solo.'
        });
        try {
          ws.close(1013, 'Online temporarily unavailable');
        } catch {}
      }
    }
  }
  async webSocketMessage(ws, message) {
    const a = ws.deserializeAttachment(),
      c = this.room?.clients.get(a?.id);
    if (a?.blocked || !c || c.connectionId !== a.connectionId) return;
    try {
      const now = Date.now();
      if (!a.windowAt || now - a.windowAt >= 1000) {
        a.windowAt = now;
        a.messages = 0;
      }
      a.messages++;
      ws.serializeAttachment(a);
      if (a.messages > (settings.maxInputsPerSecond ?? 30))
        throw new ProtocolError('RATE_LIMIT', 'Too many messages', 429);
      if (
        typeof message !== 'string' ||
        message.length > settings.maxMessageBytes ||
        new TextEncoder().encode(message).byteLength > settings.maxMessageBytes
      )
        throw new ProtocolError('BAD_INPUT', 'Invalid or oversized message');
      let value;
      try {
        value = JSON.parse(message);
      } catch {
        throw new ProtocolError('BAD_INPUT', 'Invalid JSON');
      }
      if (value.type === 'restart') {
        if (Object.keys(value).length !== 1)
          throw new ProtocolError('BAD_INPUT', 'Invalid restart');
        this.room.expire();
        if (!c.game.G.finished)
          throw new ProtocolError('ROUND_RUNNING', 'Finish the current round first', 409);
        unwrap(await live(this.env).reserveRoom(this.room.key, a.id));
        // Another co-op player may have restarted while capacity was being reserved.
        if (c.connected && c.connectionId === a.connectionId && c.game.G.finished)
          this.room.restart(a.id);
        this.startTimer();
        await this.lease();
      } else {
        const ack = value.ack ?? 0;
        if (!Number.isSafeInteger(ack) || ack < (a.ack || 0) || ack > (a.snapshotId || 0))
          throw new ProtocolError('BAD_SEQUENCE', 'Invalid snapshot acknowledgement');
        this.room.receive(a.id, value);
        a.ack = ack;
        a.pending = (a.pending || []).filter(([id]) => id > ack);
        ws.serializeAttachment(a);
      }
    } catch (e) {
      safeSend(ws, publicError(e));
      if (
        !(e instanceof ProtocolError) ||
        ['RATE_LIMIT', 'BAD_INPUT', 'BAD_SEQUENCE'].includes(e.code)
      ) {
        ws.serializeAttachment({ ...a, blocked: true });
        try {
          ws.close(1008, 'Invalid input');
        } catch {}
        this.room.disconnect(a.id, a.connectionId);
        await this.lease();
        this.startTimer();
      }
    }
  }
  async webSocketClose(ws, code) {
    const a = ws.deserializeAttachment();
    this.room?.disconnect(a?.id, a?.connectionId);
    try {
      ws.close(code === 1006 ? 1000 : code);
    } catch {}
    if (this.room) {
      await this.lease();
      this.startTimer();
    }
  }
  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011);
  }
}
