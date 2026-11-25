import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import config from '../config/game-config.json' with { type: 'json' };
import { startBackend } from './helpers/backend.js';
const ORIGIN = 'http://127.0.0.1:8000';
test('real Worker enforces CORS, single-use socket admission and authoritative rooms', async () => {
  const backend = await startBackend();
  const sockets = [];
  try {
    const request = (path, options = {}) =>
      backend.mf.dispatchFetch('http://localhost' + path, {
        ...options,
        headers: { Origin: ORIGIN, ...options.headers }
      });
    assert.equal(
      (
        await backend.mf.dispatchFetch('http://localhost/api/info', {
          headers: { Origin: 'https://evil.example' }
        })
      ).status,
      403
    );
    const preflight = await request('/api/session', { method: 'OPTIONS' });
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    const info = await (await request('/api/info')).json();
    const observer = await request('/api/ws-ticket', {
      method: 'POST',
      body: JSON.stringify({ channel: 'live' }),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(observer.status, 200, 'public ranking observers do not need a player identity');
    const auth = await (
      await request('/api/session', {
        method: 'POST',
        body: JSON.stringify({ nickname: 'أميرة 🪁' }),
        headers: { 'Content-Type': 'application/json' }
      })
    ).json();
    assert.ok(auth.credential);
    const ticket = await (
      await request('/api/ws-ticket', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'room',
          room: { seed: 12345, mode: 'coop', round: 'timed', ruleset: info.ruleset }
        }),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.credential }
      })
    ).json();
    const forbiddenSocket = await backend.mf.dispatchFetch('http://localhost' + ticket.path, {
      headers: {
        Origin: 'https://evil.example',
        Upgrade: 'websocket',
        'Sec-WebSocket-Protocol': 'windloom.v1, ticket.' + ticket.ticket
      }
    });
    assert.equal(forbiddenSocket.status, 403);
    const upgraded = await request(ticket.path, {
      headers: {
        Upgrade: 'websocket',
        'Sec-WebSocket-Protocol': 'windloom.v1, ticket.' + ticket.ticket
      }
    });
    assert.equal(upgraded.status, 101);
    const ws = upgraded.webSocket;
    sockets.push(ws);
    const packets = [];
    ws.addEventListener('message', (e) => {
      if (typeof e.data === 'string' && e.data !== 'pong') packets.push(JSON.parse(e.data));
    });
    ws.accept();
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(
      packets.some(
        (p) => p.type === 'snapshot' && p.roster.length === 1 && p.roster[0].name === 'أميرة 🪁'
      )
    );
    const reused = await request(ticket.path, {
      headers: {
        Upgrade: 'websocket',
        'Sec-WebSocket-Protocol': 'windloom.v1, ticket.' + ticket.ticket
      }
    });
    assert.equal(reused.status, 401);
    assert.equal(
      (
        await request('/api/leaderboard', {
          method: 'POST',
          body: JSON.stringify({ score: 999999 })
        })
      ).status,
      405
    );
    let closed = false;
    ws.addEventListener('close', () => {
      closed = true;
    });
    ws.send(JSON.stringify({ type: 'score', score: 999999 }));
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(packets.some((p) => p.type === 'error' && p.code === 'BAD_INPUT'));
    assert.ok(closed, 'malformed controls must close the connection');
    assert.equal(
      (await (await request('/api/leaderboard?mode=competitive')).json()).rows.length,
      0
    );
  } finally {
    for (const s of sockets)
      try {
        s.close();
      } catch {}
    await backend.mf.dispose();
  }
});
test('real Worker caps active rooms and closes restart floods without accepting scores', async () => {
  const backend = await startBackend({ maxRooms: 1 }),
    sockets = [];
  let stage = 'info';
  const request = (path, data, credential) =>
    backend.mf.dispatchFetch('http://localhost' + path, {
      method: data ? 'POST' : 'GET',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: 'Bearer ' + credential } : {})
      },
      body: data ? JSON.stringify(data) : undefined
    });
  try {
    const info = await (await request('/api/info')).json();
    async function admission(name, seed) {
      const auth = await (await request('/api/session', { nickname: name })).json();
      return (
        await request(
          '/api/ws-ticket',
          { channel: 'room', room: { seed, mode: 'coop', round: 'timed', ruleset: info.ruleset } },
          auth.credential
        )
      ).json();
    }
    async function connect(ticket) {
      const url = new URL(ticket.path, backend.url);
      url.protocol = 'ws:';
      return new Promise((resolve, reject) => {
        const socket = new WebSocket(url, ['windloom.v1', 'ticket.' + ticket.ticket], {
          origin: ORIGIN
        });
        socket.on('error', () => {});
        socket.once('open', () => {
          socket.terminate();
          reject(Error('Expected quota refusal'));
        });
        socket.once('unexpected-response', (_request, response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            socket.terminate();
            resolve({ status: response.statusCode, json: async () => JSON.parse(data) });
          });
        });
      });
    }
    stage = 'first admission';
    const ticket = await admission('First', 8001),
      url = new URL(ticket.path, backend.url);
    url.protocol = 'ws:';
    const ws = new WebSocket(url, ['windloom.v1', 'ticket.' + ticket.ticket], { origin: ORIGIN });
    sockets.push(ws);
    const packets = [];
    let closed = false;
    ws.on('message', (data) => packets.push(JSON.parse(data.toString())));
    ws.on('close', () => {
      closed = true;
    });
    ws.on('error', () => {});
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    stage = 'quota admission';
    const second = await connect(await admission('Second', 8002));
    assert.equal(second.status, 503);
    assert.equal((await second.json()).code, 'ONLINE_BUSY');
    stage = 'restart flood';
    for (let i = 0; i < 31; i++) ws.send(JSON.stringify({ type: 'restart' }));
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(packets.some((p) => p.code === 'RATE_LIMIT'));
    assert.ok(closed);
    assert.equal((await (await request('/api/leaderboard?mode=coop')).json()).rows.length, 0);
  } catch (e) {
    throw Error(stage + ': ' + e.message, { cause: e });
  } finally {
    for (const s of sockets) s.terminate();
    await backend.mf.dispose();
  }
});
test('real Worker bounds snapshot backlog and removes an unresponsive reader from presence', async () => {
  const backend = await startBackend();
  let ws;
  const request = (path, data, credential) =>
    backend.mf.dispatchFetch('http://localhost' + path, {
      method: data ? 'POST' : 'GET',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: 'Bearer ' + credential } : {})
      },
      body: data ? JSON.stringify(data) : undefined
    });
  try {
    const info = await (await request('/api/info')).json(),
      auth = await (await request('/api/session', { nickname: 'Slow reader' })).json();
    const ticket = await (
      await request(
        '/api/ws-ticket',
        {
          channel: 'room',
          room: { seed: 345, mode: 'competitive', round: 'free', ruleset: info.ruleset }
        },
        auth.credential
      )
    ).json();
    const url = new URL(ticket.path, backend.url);
    url.protocol = 'ws:';
    ws = new WebSocket(url, ['windloom.v1', 'ticket.' + ticket.ticket], { origin: ORIGIN });
    let snapshots = 0;
    ws.on('error', () => {});
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Snapshot backlog was not bounded')), 9000);
      ws.on('message', (data) => {
        const p = JSON.parse(data.toString());
        if (p.type === 'snapshot') snapshots++;
        if (p.code === 'CONNECTION_TOO_SLOW') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    assert.equal(snapshots, 50);
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(snapshots, 50);
    assert.equal((await (await request('/api/info')).json()).online, 0);
  } finally {
    ws?.terminate();
    await backend.mf.dispose();
  }
});
test('restarting a finished room must reacquire the active-room capacity', async () => {
  const fixture = structuredClone(config);
  fixture.round.durationSeconds = 2;
  const backend = await startBackend({ maxRooms: 1, configOverride: fixture }),
    sockets = [];
  const request = (path, data, credential) =>
    backend.mf.dispatchFetch('http://localhost' + path, {
      method: data ? 'POST' : 'GET',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: 'Bearer ' + credential } : {})
      },
      body: data ? JSON.stringify(data) : undefined
    });
  try {
    const info = await (await request('/api/info')).json();
    async function open(name, seed) {
      const auth = await (await request('/api/session', { nickname: name })).json();
      const ticket = await (
        await request(
          '/api/ws-ticket',
          { channel: 'room', room: { seed, mode: 'coop', round: 'timed', ruleset: info.ruleset } },
          auth.credential
        )
      ).json();
      const url = new URL(ticket.path, backend.url);
      url.protocol = 'ws:';
      const socket = new WebSocket(url, ['windloom.v1', 'ticket.' + ticket.ticket], {
        origin: ORIGIN
      });
      sockets.push(socket);
      const state = { socket, frames: [], errors: [] };
      socket.on('error', () => {});
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('No first snapshot')), 3000);
        socket.on('message', (data) => {
          const packet = JSON.parse(data.toString());
          if (packet.type === 'snapshot') {
            state.frames.push(packet);
            clearTimeout(timer);
            resolve();
          } else if (packet.type === 'error') state.errors.push(packet);
        });
      });
      return state;
    }
    const first = await open('Finished A', 91234);
    for (let i = 0; i < 40 && !first.frames.at(-1).finished; i++)
      await new Promise((r) => setTimeout(r, 100));
    assert.equal(
      first.frames.at(-1).finished,
      true,
      JSON.stringify({
        time: first.frames.at(-1).time,
        timeLeft: first.frames.at(-1).timeLeft,
        snapshots: first.frames.length
      })
    );
    const run = first.frames.at(-1).room.runId;
    await open('Active B', 95678);
    first.socket.send(JSON.stringify({ type: 'restart' }));
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(
      first.errors.some((e) => e.code === 'ONLINE_BUSY'),
      'restart must respect the active-room limit'
    );
    assert.equal(first.frames.at(-1).finished, true);
    assert.equal(first.frames.at(-1).room.runId, run);
    assert.equal((await (await request('/api/info')).json()).online, 1);
  } finally {
    for (const socket of sockets) socket.terminate();
    await backend.mf.dispose();
  }
});
