import { PROTOCOL, normalizeNickname, rulesetId } from './protocol.js';
const KEY = 'windloom.online.guest';
const KEYS = [
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
const AXES = ['mouseX', 'mouseY', 'touchX', 'touchY', 'tiltX', 'tiltY'];
const BUTTONS = [
  'mouseFire',
  'touchFire',
  'touchBoost',
  'touchBack',
  'touchLeft',
  'touchRight',
  'novaReq'
];
const FATAL = new Set([
  'ONLINE_UNAVAILABLE',
  'ONLINE_BUSY',
  'RATE_LIMIT',
  'ROOM_FULL',
  'VERSION_MISMATCH',
  'BAD_INPUT',
  'BAD_SEQUENCE',
  'UNAUTHORIZED',
  'CONNECTION_TOO_SLOW'
]);
export function onlineLink(href) {
  const u = new URL(href);
  return {
    mode: ['coop', 'competitive'].includes(u.searchParams.get('online'))
      ? u.searchParams.get('online')
      : 'solo',
    round: u.searchParams.get('round') === 'free' ? 'free' : 'timed'
  };
}
export function shareUrl(href, seed, mode, round) {
  const u = new URL(href);
  u.search = '';
  u.hash = 's' + (seed >>> 0);
  if (mode !== 'solo') {
    u.searchParams.set('online', mode);
    u.searchParams.set('round', round === 'free' ? 'free' : 'timed');
  }
  return u.href;
}
export function backendOrigin(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    (u.protocol !== 'https:' &&
      !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
  )
    throw Error('Invalid online backend URL');
  return u.origin;
}
export function backendForHost(value, hostname) {
  const loopback = ['localhost', '127.0.0.1', '[::1]'];
  const local = loopback.includes(hostname);
  if (!value) return local ? 'http://127.0.0.1:8787' : '';
  const origin = backendOrigin(value);
  return local && !loopback.includes(new URL(origin).hostname)
    ? 'http://127.0.0.1:8787'
    : origin;
}
export function controlsFrom(G, settings) {
  const enabled = G.mode === 'play',
    keys = {},
    input = {};
  for (const k of KEYS) keys[k] = enabled && G.keys[k] === true;
  for (const k of AXES) input[k] = enabled ? Math.max(-1, Math.min(1, Number(G.input[k]) || 0)) : 0;
  for (const k of BUTTONS) input[k] = enabled && G.input[k] === true;
  return {
    keys,
    input,
    settings: { invertKeys: !!settings.invertKeys, invertMouse: !!settings.invertMouse }
  };
}
function loadGuest() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
function storeGuest(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}
export class OnlineClient {
  constructor(config, handlers = {}) {
    this.config = config;
    this.handlers = handlers;
    this.profile = typeof localStorage === 'undefined' ? null : loadGuest();
    this.base = '';
    this.info = null;
    this.socket = null;
    this.liveSocket = null;
    this.frame = null;
    this.seq = 0;
    this.connected = false;
    this.active = false;
    this.stopped = true;
    this.lastSend = 0;
    this.lastButtons = '';
    this.pendingFire = false;
    this.generation = 0;
    this.rtt = 0;
    this.retryTimer = null;
    this.heartbeat = null;
  }
  async init() {
    const response = await fetch('config/online.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('Online configuration is unavailable');
    const cfg = await response.json();
    const value = backendForHost(cfg.backendUrl, location.hostname);
    if (!value) {
      this.handlers.status?.('Online is unavailable. Solo play is ready.');
      return false;
    }
    this.base = backendOrigin(value);
    this.version = await rulesetId(this.config);
    this.info = await this.request('/api/info');
    if (this.info.ruleset !== this.version)
      throw Error('The online game has changed. Reload the page.');
    this.handlers.live?.({ online: this.info.online });
    this.handlers.status?.('Online ready · up to 8 players per island');
    return true;
  }
  async request(path, { method = 'GET', data, auth = false } = {}) {
    const abort = new AbortController(),
      timer = setTimeout(() => abort.abort(), 8000);
    try {
      const headers = {};
      if (data !== undefined) headers['Content-Type'] = 'application/json';
      if (auth) headers.Authorization = 'Bearer ' + this.profile?.credential;
      const response = await fetch(this.base + path, {
        method,
        headers,
        body: data === undefined ? undefined : JSON.stringify(data),
        credentials: 'omit',
        signal: abort.signal
      });
      const value = await response.json();
      if (!response.ok) {
        const e = Error(
          value.message || 'Online is temporarily unavailable. Try later or play solo.'
        );
        e.code = value.code;
        throw e;
      }
      return value;
    } catch (e) {
      if (e.code) throw e;
      throw Error('Online is temporarily unavailable. Check your connection, retry, or play solo.');
    } finally {
      clearTimeout(timer);
    }
  }
  async identify(name) {
    name = normalizeNickname(name);
    if (this.identityTask) await this.identityTask;
    if (this.profile?.guest?.name === name && this.profile.credential) return;
    this.identityTask = this.request('/api/session', {
      method: 'POST',
      data: { nickname: name, credential: this.profile?.credential }
    }).catch((error) => {
      if (error.code !== 'UNAUTHORIZED' || !this.profile?.credential) throw error;
      return this.request('/api/session', { method: 'POST', data: { nickname: name } });
    });
    try {
      this.profile = await this.identityTask;
      storeGuest(this.profile);
    } finally {
      this.identityTask = null;
    }
  }
  async openSocket(channel, descriptor) {
    let admission;
    try {
      admission = await this.request('/api/ws-ticket', {
        method: 'POST',
        auth: channel === 'room',
        data: { channel, ...(descriptor ? { room: descriptor } : {}) }
      });
    } catch (e) {
      if (e.code !== 'UNAUTHORIZED') throw e;
      const name = this.profile?.guest?.name || 'Player';
      this.profile = null;
      await this.identify(name);
      admission = await this.request('/api/ws-ticket', {
        method: 'POST',
        auth: true,
        data: { channel, ...(descriptor ? { room: descriptor } : {}) }
      });
    }
    const endpoint = new URL(admission.path, this.base);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(endpoint.href, [PROTOCOL, 'ticket.' + admission.ticket]);
  }
  async watch(name) {
    if (!this.info || this.liveSocket) return;
    try {
      const socket = await this.openSocket('live');
      this.liveSocket = socket;
      socket.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          this.handlers.live?.(JSON.parse(event.data));
        } catch {}
      };
      socket.onclose = () => {
        if (this.liveSocket === socket) {
          this.liveSocket = null;
          this.handlers.live?.({ online: null });
        }
      };
      socket.onerror = () => {};
    } catch {
      this.handlers.live?.({ online: null });
    }
  }
  async join(name, seed, mode, round) {
    this.leave();
    this.stopped = false;
    this.active = true;
    const generation = this.generation;
    this.descriptor = { seed, mode, round, ruleset: this.version };
    this.name = normalizeNickname(name);
    this.frame = null;
    this.seq = 0;
    this.retryUntil = performance.now() + 30000;
    if (!this.info) {
      this.active = false;
      throw Error('Online is unavailable. Solo play is ready.');
    }
    this.handlers.status?.('Joining the island…');
    await this.identify(this.name);
    if (generation !== this.generation || this.stopped) return false;
    await this.connect(generation);
    if (generation !== this.generation || this.stopped) return false;
    this.heartbeat = setInterval(() => {
      for (const ws of [this.socket, this.liveSocket])
        if (ws?.readyState === WebSocket.OPEN) {
          if (ws === this.socket) this.pingAt = performance.now();
          ws.send('ping');
        }
    }, 25000);
    return true;
  }
  async connect(generation) {
    if (generation !== this.generation || this.stopped) return;
    const socket = await this.openSocket('room', this.descriptor);
    if (generation !== this.generation || this.stopped) {
      socket.close();
      return;
    }
    this.socket = socket;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(Error('Could not join the room. Retry or choose another island.'));
      }, 8000);
      let welcomed = false;
      socket.onopen = () => {
        this.pingAt = performance.now();
        socket.send('ping');
      };
      socket.onmessage = (event) => {
        if (generation !== this.generation) return;
        if (event.data === 'pong') {
          if (this.pingAt) this.rtt = performance.now() - this.pingAt;
          return;
        }
        let frame;
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        if (frame.type === 'snapshot') {
          if (!welcomed) {
            welcomed = true;
            clearTimeout(timeout);
            this.connected = true;
            this.seq = Math.max(this.seq, frame.ack || 0);
            this.handlers.status?.(
              'Connected · ' + (this.descriptor.mode === 'coop' ? 'Co-op' : 'Competitive')
            );
            resolve();
            if (frame.finished && frame.timed) {
              this.frame = frame;
              socket.send(JSON.stringify({ type: 'restart' }));
              return;
            }
          }
          this.frame = frame;
          this.retryUntil = performance.now() + 30000;
          this.handlers.snapshot?.(frame);
        } else if (frame.type === 'error') {
          this.handlers.status?.(frame.message);
          const error = Object.assign(Error(frame.message), { code: frame.code });
          if (!welcomed) {
            clearTimeout(timeout);
            reject(error);
          }
          if (FATAL.has(frame.code)) {
            this.stopped = true;
            this.connected = false;
            clearInterval(this.heartbeat);
            clearTimeout(this.retryTimer);
            socket.close();
            if (welcomed) this.handlers.error?.(frame.message);
          }
        } else if (frame.type === 'interrupted' || frame.type === 'room-ended') {
          this.stopped = true;
          this.connected = false;
          this.handlers.error?.(frame.message);
          socket.close();
        }
      };
      socket.onerror = () => {
        if (!welcomed) {
          clearTimeout(timeout);
          reject(Error('Could not join the room. It may be full or temporarily unavailable.'));
        }
      };
      socket.onclose = (event) => {
        clearTimeout(timeout);
        if (generation !== this.generation) return;
        this.connected = false;
        if (!welcomed) {
          reject(Error('Could not join the room. Retry or choose another island.'));
          return;
        }
        if (event.reason === 'Replaced by another tab') {
          this.stopped = true;
          this.handlers.error?.('This guest joined from another tab.');
          return;
        }
        const finished = this.frame?.finished && this.frame?.timed;
        if (!this.stopped && !finished && performance.now() < this.retryUntil) {
          this.handlers.status?.('Connection lost · reconnecting…');
          this.retryTimer = setTimeout(
            () => this.connect(generation).catch((e) => this.connectionFailed(e, generation)),
            1200
          );
        } else if (!this.stopped && !finished)
          this.connectionFailed(Error('Connection lost. Join again or play solo.'), generation);
      };
    });
  }
  connectionFailed(error, generation) {
    if (generation !== this.generation || this.stopped) return;
    if (!FATAL.has(error.code) && performance.now() < this.retryUntil) {
      this.retryTimer = setTimeout(
        () => this.connect(generation).catch((e) => this.connectionFailed(e, generation)),
        2000
      );
    } else {
      this.stopped = true;
      this.handlers.error?.(error.message);
    }
  }
  sendControls(G, settings, now, force = false) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const finished = this.frame?.finished && this.frame?.timed;
    if (finished && this.lastSnapshotAck === this.frame.snapshotId) return;
    const controls = controlsFrom(
      finished ? { mode: 'results', keys: {}, input: {} } : G,
      settings
    );
    if (G.mode === 'play' && !finished)
      this.pendingFire ||=
        controls.keys.Space || controls.input.mouseFire || controls.input.touchFire;
    else this.pendingFire = false;
    if (this.pendingFire) controls.input.mouseFire = true;
    const buttons = JSON.stringify([controls.keys, ...BUTTONS.map((k) => controls.input[k])]);
    const elapsed = now - this.lastSend,
      edge = buttons !== this.lastButtons;
    if (
      !force &&
      elapsed < 1000 / (this.config.multiplayer?.inputHz ?? 10) &&
      !(edge && elapsed >= (this.config.multiplayer?.transitionMinMs ?? 40))
    )
      return;
    if (this.socket.bufferedAmount > (this.config.multiplayer?.maxBufferedBytes ?? 1048576)) {
      this.socket.close();
      return;
    }
    this.socket.send(
      JSON.stringify({
        type: 'input',
        seq: ++this.seq,
        ack: this.frame?.snapshotId || 0,
        ...controls
      })
    );
    this.lastSnapshotAck = this.frame?.snapshotId;
    this.pendingFire = false;
    this.lastSend = now;
    this.lastButtons = buttons;
    G.input.novaReq = false;
  }
  async leaderboard(mode, partySize = 1) {
    return this.request('/api/leaderboard?mode=' + mode + '&partySize=' + partySize);
  }
  leave() {
    this.stopped = true;
    this.active = false;
    this.connected = false;
    this.pendingFire = false;
    this.lastSnapshotAck = undefined;
    this.lastButtons = '';
    this.lastSend = 0;
    this.generation++;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.retryTimer = this.heartbeat = null;
    const ws = this.socket;
    this.socket = null;
    try {
      ws?.close(1000, 'Left room');
    } catch {}
    this.frame = null;
  }
  stopWatching() {
    const ws = this.liveSocket;
    this.liveSocket = null;
    try {
      ws?.close(1000, 'Viewer left');
    } catch {}
  }
}
