import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OnlineClient,
  shareUrl,
  onlineLink,
  backendOrigin,
  backendForHost,
  controlsFrom
} from '../src/online/client.js';
test('published backend configuration keeps localhost on its development Worker', () => {
  const production = 'https://windloom-online.alatiaun.workers.dev';
  assert.equal(backendForHost(production, 'jhohlbein.github.io'), production);
  for (const host of ['localhost', '127.0.0.1', '[::1]'])
    assert.equal(backendForHost(production, host), 'http://127.0.0.1:8787');
  assert.equal(backendForHost('http://127.0.0.1:9900', 'localhost'), 'http://127.0.0.1:9900');
  assert.equal(backendForHost('', 'jhohlbein.github.io'), '');
  assert.equal(backendForHost('', 'localhost'), 'http://127.0.0.1:8787');
});
test('share links retain the Pages path and never include credentials or backend query data', () => {
  const url = shareUrl(
    'https://jhohlbein.github.io/windloom/?token=secret#s1',
    123,
    'coop',
    'free'
  );
  assert.equal(url, 'https://jhohlbein.github.io/windloom/?online=coop&round=free#s123');
  assert.deepEqual(onlineLink(url), { mode: 'coop', round: 'free' });
});
test('backend configuration accepts HTTPS or loopback development, not insecure remote servers', () => {
  assert.equal(backendOrigin('https://example.workers.dev/'), 'https://example.workers.dev');
  assert.equal(backendOrigin('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  assert.throws(() => backendOrigin('http://remote.example'));
  assert.throws(() => backendOrigin('https://user:secret@example.com'));
});
test('paused controls are neutral and only approved controls leave the browser', () => {
  const g = {
    mode: 'pause',
    keys: { KeyW: true, Secret: 'never' },
    input: { mouseFire: true, mouseX: 0.2 },
    hp: 999
  };
  const controls = controlsFrom(g, {});
  assert.equal(controls.keys.KeyW, false);
  assert.equal(controls.input.mouseFire, false);
  assert.equal(controls.input.mouseX, 0);
  assert.equal(controls.hp, undefined);
  g.mode = 'play';
  assert.equal(controlsFrom(g, {}).keys.KeyW, true);
});
test('a short fire tap survives throttling and pausing sends neutral controls immediately', () => {
  globalThis.WebSocket = { OPEN: 1 };
  const sent = [],
    client = new OnlineClient({}),
    g = { mode: 'play', keys: {}, input: {} };
  client.connected = true;
  client.socket = { readyState: 1, bufferedAmount: 0, send: (s) => sent.push(JSON.parse(s)) };
  client.sendControls(g, {}, 100);
  g.keys.Space = true;
  client.sendControls(g, {}, 120);
  g.keys.Space = false;
  client.sendControls(g, {}, 140);
  assert.ok(
    sent.some((s) => s.keys.Space || s.input.mouseFire),
    'tap must reach the simulation'
  );
  g.mode = 'pause';
  client.sendControls(g, {}, 141, true);
  assert.equal(sent.at(-1).keys.Space, false);
  assert.equal(sent.at(-1).input.mouseFire, false);
});
test('leaving during guest identification cancels admission and timers', async () => {
  const client = new OnlineClient({});
  client.info = {};
  client.version = 'test';
  let release,
    connections = 0;
  client.identify = () =>
    new Promise((r) => {
      release = r;
    });
  client.connect = async () => {
    connections++;
  };
  const pending = client.join('Player', 1, 'coop', 'timed');
  client.leave();
  release();
  await pending;
  try {
    assert.equal(connections, 0);
    assert.equal(client.heartbeat, null);
  } finally {
    client.leave();
  }
});
test('finished players acknowledge new snapshots without continuing periodic input traffic', () => {
  globalThis.WebSocket = { OPEN: 1 };
  const sent = [],
    client = new OnlineClient({}),
    g = { mode: 'play', keys: { Space: true }, input: {} };
  client.connected = true;
  client.frame = { finished: true, timed: true, snapshotId: 42 };
  client.socket = { readyState: 1, bufferedAmount: 0, send: (s) => sent.push(JSON.parse(s)) };
  client.sendControls(g, {}, 100);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].ack, 42);
  assert.equal(sent[0].keys.Space, false);
  client.sendControls(g, {}, 200);
  assert.equal(sent.length, 1);
  client.frame.snapshotId = 43;
  client.sendControls(g, {}, 300);
  assert.equal(sent.length, 2);
});
test('a changed nickname recovers after the stored credential expires', async () => {
  const client = new OnlineClient({});
  client.profile = { guest: { id: 'old', name: 'Old name' }, credential: 'expired' };
  const requests = [];
  client.request = async (_path, { data }) => {
    requests.push(data);
    if (data.credential) throw Object.assign(Error('Expired'), { code: 'UNAUTHORIZED' });
    return { guest: { id: 'new', name: data.nickname }, credential: 'renewed' };
  };
  await client.identify('New name');
  assert.equal(client.profile.credential, 'renewed');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].credential, undefined);
});
test('a reconnect to a finished round acknowledges the new connection’s snapshots', async () => {
  const client = new OnlineClient({});
  client.stopped = false;
  client.descriptor = { mode: 'coop' };
  client.frame = { snapshotId: 100, finished: false, timed: true };
  const sent = [],
    socket = { send: (data) => sent.push(JSON.parse(data)), close() {} };
  client.openSocket = async () => socket;
  const connected = client.connect(client.generation);
  await Promise.resolve();
  socket.onmessage({
    data: JSON.stringify({ type: 'snapshot', snapshotId: 1, finished: true, timed: true, ack: 10 })
  });
  await connected;
  assert.equal(client.frame.snapshotId, 1);
  assert.equal(sent.at(-1).type, 'restart');
});
