import { createSimulation } from '../src/simulation/runtime.js';
import { ProtocolError, parseInput, roomKey } from '../src/online/protocol.js';

export class Room {
  constructor(descriptor, config, now = Date.now()) {
    this.descriptor = descriptor;
    this.config = config;
    this.key = roomKey(descriptor);
    this.clients = new Map();
    this.lastAt = now;
    this.results = [];
    this.layout = null;
    this.shared = null;
    this.peak = 0;
    this.participants = new Map();
    this.capacity = config.multiplayer?.maxPlayers ?? 8;
    this.graceMs = (config.multiplayer?.reconnectSeconds ?? 30) * 1000;
  }
  newGame(now) {
    const game = createSimulation(this.config, this.descriptor.seed, {
      timed: this.descriptor.round === 'timed',
      layout: this.layout
    });
    this.layout = game.layout;
    game.runId = crypto.randomUUID();
    game.deadline = now + this.config.round.durationSeconds * 1000;
    game.published = false;
    return game;
  }
  connect(guest, connectionId, now = Date.now()) {
    this.expire(now);
    let c = this.clients.get(guest.id);
    if (!c) {
      if (this.clients.size >= this.capacity)
        throw new ProtocolError(
          'ROOM_FULL',
          'This room is full. Try another island or play solo.',
          409
        );
      if (this.descriptor.mode === 'coop') this.shared ??= this.newGame(now);
      const game = this.shared || this.newGame(now);
      game.addPlayer(guest.id);
      c = { guest: { id: guest.id, name: guest.name }, game, seq: 0, windowAt: now, messages: 0 };
      this.clients.set(guest.id, c);
      this.peak = Math.max(this.peak, this.clients.size);
      if (this.descriptor.round === 'timed' && this.participants.size < this.capacity)
        this.participants.set(guest.id, guest.name);
    }
    c.guest.name = guest.name;
    c.connected = true;
    c.connectionId = connectionId;
    c.expires = Infinity;
    return c;
  }
  disconnect(id, connectionId, now = Date.now()) {
    const c = this.clients.get(id);
    if (!c || c.connectionId !== connectionId) return;
    c.connected = false;
    c.expires = now + this.graceMs;
    c.game.setInput(id, {
      keys: {},
      input: {
        mouseFire: false,
        touchFire: false,
        touchBoost: false,
        touchBack: false,
        touchLeft: false,
        touchRight: false,
        novaReq: false,
        mouseX: 0,
        mouseY: 0,
        touchX: 0,
        touchY: 0,
        tiltX: 0,
        tiltY: 0
      }
    });
  }
  receive(id, message, now = Date.now()) {
    const c = this.clients.get(id);
    if (!c?.connected) throw new ProtocolError('UNAUTHORIZED', 'Not connected', 401);
    const controls = parseInput(message);
    if (controls.seq <= c.seq)
      throw new ProtocolError('BAD_SEQUENCE', 'Input sequence must increase');
    if (now - c.windowAt >= 1000) {
      c.windowAt = now;
      c.messages = 0;
    }
    if (++c.messages > (this.config.multiplayer?.maxInputsPerSecond ?? 30))
      throw new ProtocolError('RATE_LIMIT', 'Too many input messages', 429);
    controls.input.novaReq ||= c.game.players.get(id)?.input.novaReq === true;
    c.seq = controls.seq;
    c.game.setInput(id, controls);
  }
  restart(id, now = Date.now()) {
    this.expire(now);
    const c = this.clients.get(id);
    if (!c || !c.game.G.finished)
      throw new ProtocolError('ROUND_RUNNING', 'Finish the current round first', 409);
    if (this.descriptor.mode === 'coop') {
      this.shared = this.newGame(now);
      this.peak = this.clients.size;
      this.participants = new Map();
      for (const [pid, p] of this.clients) {
        p.game = this.shared;
        p.game.addPlayer(pid);
        this.participants.set(pid, p.guest.name);
      }
    } else {
      c.game = this.newGame(now);
      c.game.addPlayer(id);
    }
    this.lastAt = now;
  }
  get games() {
    return [...new Set([...this.clients.values()].map((c) => c.game))];
  }
  get hasSimulation() {
    return this.games.some((g) => g.players.size > 0 && (!g.G.finished || !g.G.timed));
  }
  get activeIds() {
    return [...this.clients]
      .filter(([, c]) => c.connected && (!c.game.G.finished || !c.game.G.timed))
      .map(([id]) => id);
  }
  expire(now = Date.now()) {
    for (const [id, c] of this.clients)
      if (!c.connected && now >= c.expires) {
        c.game.removePlayer(id);
        this.clients.delete(id);
      }
    if (!this.clients.size) {
      this.shared = null;
      this.peak = 0;
      this.participants.clear();
      this.lastAt = now;
    }
  }
  canJoin(id, now = Date.now()) {
    this.expire(now);
    return this.clients.has(id) || this.clients.size < this.capacity;
  }
  advance(now = Date.now()) {
    this.expire(now);
    const elapsed = Math.max(0, (now - this.lastAt) / 1000);
    this.lastAt = now;
    for (const game of this.games) {
      if ((game.G.finished && game.G.timed) || !game.players.size) continue;
      if (game.G.timed && !game.G.endReason)
        game.G.timeLeft = Math.max(0, (game.deadline - now) / 1000);
      const hz = this.config.multiplayer?.simulationHz ?? 60;
      const steps = Math.min(
        this.config.multiplayer?.maxCatchupSteps ?? 15,
        Math.max(1, Math.round(elapsed * hz))
      );
      for (let i = 0; i < steps && (!game.G.finished || !game.G.timed); i++) game.step(1 / hz);
      if (game.G.finished && game.G.timed && !game.published) {
        game.published = true;
        const members =
          this.descriptor.mode === 'coop'
            ? [...this.participants].slice(0, 8).map(([id, name]) => ({ id, name }))
            : [...this.clients.values()].filter((c) => c.game === game).map((c) => c.guest);
        this.results.push({
          runId: game.runId,
          ruleset: this.descriptor.ruleset,
          mode: this.descriptor.mode,
          seed: this.descriptor.seed,
          partySize: this.descriptor.mode === 'coop' ? this.peak : 1,
          score: game.score().total,
          stage: game.G.level,
          dragon: game.G.dragonSlain,
          complete: game.G.endReason === 'complete',
          members,
          completedAt: now
        });
      }
    }
  }
  takeResults() {
    return this.results.splice(0);
  }
  snapshotFor(id) {
    const own = this.clients.get(id);
    if (!own) throw new ProtocolError('ROOM_ENDED', 'This room ended. Join again.', 409);
    const roster = [...this.clients].map(([pid, c]) => ({
      ...c.game.playerSnapshot(c.game.players.get(pid)),
      name: c.guest.name,
      connected: c.connected,
      score: c.game.score().total,
      finished: c.game.G.finished
    }));
    return {
      type: 'snapshot',
      room: { ...this.descriptor, key: this.key, capacity: this.capacity, runId: own.game.runId },
      self: id,
      ack: own.seq,
      ...own.game.snapshot(),
      roster
    };
  }
}
