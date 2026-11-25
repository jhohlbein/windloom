import { ProtocolError } from '../src/online/protocol.js';
export class BackendStore {
  constructor(sql) {
    this.sql = sql;
    for (const statement of [
      'CREATE TABLE IF NOT EXISTS tickets(token TEXT PRIMARY KEY, guest TEXT NOT NULL, channel TEXT NOT NULL, room TEXT NOT NULL, expires INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS presence(room TEXT PRIMARY KEY, members TEXT NOT NULL, expires INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS rates(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS boards(ruleset TEXT NOT NULL, mode TEXT NOT NULL, party INTEGER NOT NULL, entry_key TEXT NOT NULL, score INTEGER NOT NULL, completed INTEGER NOT NULL, details TEXT NOT NULL, PRIMARY KEY(ruleset,mode,party,entry_key))',
      'CREATE INDEX IF NOT EXISTS board_order ON boards(ruleset,mode,party,score DESC,completed ASC)',
      'CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
      "INSERT OR IGNORE INTO metadata(key,value) VALUES('revision',0)"
    ])
      sql.exec(statement);
  }
  rows(query, ...args) {
    return this.sql.exec(query, ...args).toArray();
  }
  issueTicket(guest, channel, room, now = Date.now(), seconds = 30) {
    const ticket = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    this.sql.exec('DELETE FROM tickets WHERE expires<=?', now);
    this.sql.exec(
      'INSERT INTO tickets VALUES(?,?,?,?,?)',
      ticket,
      JSON.stringify(guest),
      channel,
      room,
      now + seconds * 1000
    );
    return { ticket, expiresAt: now + seconds * 1000 };
  }
  consumeTicket(ticket, channel, room, now = Date.now()) {
    if (typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket))
      throw new ProtocolError('UNAUTHORIZED', 'Invalid admission ticket', 401);
    const row = this.rows('DELETE FROM tickets WHERE token=? RETURNING *', ticket)[0];
    if (!row || row.expires <= now || row.channel !== channel || row.room !== room)
      throw new ProtocolError('UNAUTHORIZED', 'Admission ticket expired or already used', 401);
    return JSON.parse(row.guest);
  }
  rate(key, limit, windowMs, now = Date.now()) {
    this.sql.exec('DELETE FROM rates WHERE expires<=?', now);
    const bucket = key + ':' + Math.floor(now / windowMs);
    const row = this.rows(
      'INSERT INTO rates(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
      bucket,
      now + windowMs
    )[0];
    if (row.count > limit)
      throw new ProtocolError('RATE_LIMIT', 'Please wait before trying again.', 429);
  }
  reserveRoom(room, guestId, now = Date.now(), maximum = 16) {
    this.sql.exec('DELETE FROM presence WHERE expires<=?', now);
    const old = this.rows('SELECT members FROM presence WHERE room=?', room)[0];
    if (!old && this.rows('SELECT COUNT(*) AS n FROM presence')[0].n >= maximum)
      throw new ProtocolError(
        'ONLINE_BUSY',
        'Online rooms are at the free-service capacity. Try again later or play solo.',
        503
      );
    const ids = new Set(old ? JSON.parse(old.members) : []);
    ids.add(guestId);
    if (ids.size > 8)
      throw new ProtocolError(
        'ROOM_FULL',
        'This room is full. Try another island or play solo.',
        409
      );
    this.updatePresence(room, [...ids], now, 90);
  }
  releaseMember(room, id, now = Date.now()) {
    const old = this.rows('SELECT members FROM presence WHERE room=?', room)[0];
    if (old)
      this.updatePresence(
        room,
        JSON.parse(old.members).filter((v) => v !== id),
        now,
        90
      );
  }
  updatePresence(room, ids, now = Date.now(), seconds = 90) {
    if (ids.length > 8) throw new Error('Invalid room presence');
    if (!ids.length) {
      this.sql.exec('DELETE FROM presence WHERE room=?', room);
      return;
    }
    this.sql.exec(
      'INSERT INTO presence(room,members,expires) VALUES(?,?,?) ON CONFLICT(room) DO UPDATE SET members=excluded.members,expires=excluded.expires',
      room,
      JSON.stringify([...new Set(ids)]),
      now + seconds * 1000
    );
  }
  online(now = Date.now()) {
    const ids = new Set();
    for (const row of this.rows('SELECT members FROM presence WHERE expires>?', now))
      for (const id of JSON.parse(row.members)) ids.add(id);
    return ids.size;
  }
  nextExpiry(now = Date.now()) {
    return (
      this.rows('SELECT MIN(expires) AS next FROM presence WHERE expires>?', now)[0]?.next ?? null
    );
  }
  cleanup(now = Date.now()) {
    for (const table of ['tickets', 'presence', 'rates'])
      this.sql.exec(`DELETE FROM ${table} WHERE expires<=?`, now);
  }
  revision() {
    return this.rows("SELECT value FROM metadata WHERE key='revision'")[0].value;
  }
  publish(result, limit = 100) {
    const r = result;
    if (
      !r ||
      !['coop', 'competitive'].includes(r.mode) ||
      !Number.isInteger(r.score) ||
      r.score < 0 ||
      r.score > 100000000 ||
      !Number.isInteger(r.partySize) ||
      r.partySize < 1 ||
      r.partySize > 8 ||
      !Array.isArray(r.members) ||
      !r.members.length ||
      r.members.length > 8 ||
      typeof r.ruleset !== 'string' ||
      typeof r.runId !== 'string'
    )
      throw new Error('Invalid server result');
    const entry = r.mode === 'competitive' ? r.members[0].id : r.runId;
    const rows = this.rows(
      'INSERT INTO boards VALUES(?,?,?,?,?,?,?) ON CONFLICT(ruleset,mode,party,entry_key) DO UPDATE SET score=excluded.score,completed=excluded.completed,details=excluded.details WHERE excluded.score>boards.score RETURNING entry_key',
      r.ruleset,
      r.mode,
      r.partySize,
      entry,
      r.score,
      r.completedAt,
      JSON.stringify(r)
    );
    this.sql.exec(
      'DELETE FROM boards WHERE ruleset=? AND mode=? AND party=? AND entry_key NOT IN (SELECT entry_key FROM boards WHERE ruleset=? AND mode=? AND party=? ORDER BY score DESC,completed ASC,entry_key ASC LIMIT ?)',
      r.ruleset,
      r.mode,
      r.partySize,
      r.ruleset,
      r.mode,
      r.partySize,
      limit
    );
    this.sql.exec(
      'DELETE FROM boards WHERE ruleset NOT IN (SELECT ruleset FROM boards GROUP BY ruleset ORDER BY MAX(completed) DESC LIMIT 3)'
    );
    if (rows.length) this.sql.exec("UPDATE metadata SET value=value+1 WHERE key='revision'");
    return rows.length > 0;
  }
  readBoard(ruleset, mode, party = 1, limit = 100) {
    return this.rows(
      'SELECT details FROM boards WHERE ruleset=? AND mode=? AND party=? ORDER BY score DESC,completed ASC,entry_key ASC LIMIT ?',
      ruleset,
      mode,
      party,
      limit
    ).map((r, i) => ({ rank: i + 1, ...JSON.parse(r.details) }));
  }
}
