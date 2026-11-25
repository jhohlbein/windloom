import { test, expect } from '@playwright/test';
import path from 'node:path';
import { latencyProxy } from '../helpers/latency-proxy.js';
import { startBackend } from '../helpers/backend.js';
import config from '../../config/game-config.json' with { type: 'json' };
async function prepare(page) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.128.0/**', (route) =>
    route.fulfill({
      path: path.resolve('node_modules/three/build/three.module.js'),
      contentType: 'text/javascript'
    })
  );
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
}
async function join(page, name, mode = 'coop', seed = 12345) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/')) errors.push(r.url() + ': ' + r.failure()?.errorText);
  });
  await prepare(page);
  await page.bringToFront();
  await page.goto('http://127.0.0.1:8000/?online=' + mode + '&round=timed#s' + seed);
  await page.waitForFunction(() => window.windloom?.G, null, { timeout: 15000, polling: 100 });
  try {
    await expect(page.locator('#onlineStatus')).toContainText('Online ready', { timeout: 10000 });
  } catch (e) {
    throw Error(
      name +
        ' online startup: ' +
        JSON.stringify(errors) +
        ' ' +
        (await page.locator('#onlineStatus').textContent())
    );
  }
  await page.locator('#nickname').fill(name);
  await page.locator('#start').click();
  try {
    await page.waitForFunction(() => windloom.online.connected && windloom.online.frame, null, {
      timeout: 12000,
      polling: 100
    });
  } catch (e) {
    throw Error(
      name +
        ' join failed: ' +
        JSON.stringify(errors) +
        ' ' +
        (await page.locator('#onlineStatus').textContent())
    );
  }
}
// Seven peers use the production network client without additional software-rendered WebGL scenes.
async function joinPeer(page, name, seed) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => errors.push(r.url() + ': ' + r.failure()?.errorText));
  await page.goto(
    'http://127.0.0.1:8000/tests/browser/network-peer.html?name=' +
      encodeURIComponent(name) +
      '&seed=' +
      seed
  );
  try {
    await page.waitForFunction(() => window.peer?.connected && peer.frame, null, {
      timeout: 12000
    });
  } catch (e) {
    const state = await page.evaluate(() => ({
      loaded: !!window.peer,
      base: window.peer?.base,
      info: window.peer?.info,
      connected: window.peer?.connected
    }));
    throw Error(name + ' peer failed: ' + JSON.stringify({ errors, state }));
  }
}
test('two browsers join the same co-op URL, see live players and keep server authority', async ({
  browser
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const one = await a.newPage(),
    two = await b.newPage();
  const errors = [];
  one.on('pageerror', (e) => errors.push(e.message));
  two.on('pageerror', (e) => errors.push(e.message));
  try {
    await join(one, '<img src=x>');
    await join(two, 'أميرة 🪁');
    await expect.poll(() => one.evaluate(() => windloom.online.frame.roster.length)).toBe(2);
    await expect.poll(() => two.evaluate(() => windloom.online.frame.roster.length)).toBe(2);
    expect(await one.evaluate(() => windloom.online.frame.room.key)).toBe(
      await two.evaluate(() => windloom.online.frame.room.key)
    );
    await expect(one.locator('#onlineCount')).toContainText('2 online');
    expect(await one.locator('#roomPlayers img').count()).toBe(0);
    const names = await one.evaluate(() => windloom.online.frame.roster.map((p) => p.name));
    expect(names).toContain('<img src=x>');
    expect(names).toContain('أميرة 🪁');
    const ids = await one.evaluate(() => windloom.online.frame.enemies.map((e) => e.id));
    expect(ids).toEqual(await two.evaluate(() => windloom.online.frame.enemies.map((e) => e.id)));
    await one.evaluate(() => {
      windloom.G.castleMana = 999999;
    });
    await expect.poll(() => one.evaluate(() => windloom.G.castleMana)).toBe(0);
    const before = await one.evaluate(() => windloom.online.frame.timeLeft);
    await one.waitForTimeout(400);
    expect(await one.evaluate(() => windloom.online.frame.timeLeft)).toBeLessThan(before);
    expect(one.url()).toContain('?online=coop&round=timed#s12345');
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test('competitive browsers share presence while each starts a full independent round', async ({
  browser
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const one = await a.newPage(),
    two = await b.newPage();
  try {
    await join(one, 'Racer A', 'competitive', 999);
    await one.waitForTimeout(700);
    await join(two, 'Racer B', 'competitive', 999);
    await expect.poll(() => two.evaluate(() => windloom.online.frame.roster.length)).toBe(2);
    const old = await one.evaluate(() => windloom.online.frame.timeLeft),
      fresh = await two.evaluate(() => windloom.online.frame.timeLeft);
    expect(fresh).toBeGreaterThan(old);
    await b.setOffline(true);
    await two.waitForTimeout(1000);
    await b.setOffline(false);
    await expect
      .poll(() => two.evaluate(() => windloom.online.connected), { timeout: 15000 })
      .toBe(true);
    await expect.poll(() => two.evaluate(() => windloom.online.frame.roster.length)).toBe(2);
  } finally {
    await a.close();
    await b.close();
  }
});
test('eight browser clients share a room; a ninth gets a full-room message and can still play solo', async ({
  browser
}) => {
  test.setTimeout(120000);
  const contexts = [];
  try {
    const pages = [];
    for (let i = 0; i < 8; i++) {
      const c = await browser.newContext({ viewport: { width: 640, height: 360 } });
      contexts.push(c);
      const p = await c.newPage();
      pages.push(p);
      if (i === 0) await join(p, 'Flyer ' + i, 'coop', 314159);
      else await joinPeer(p, 'Flyer ' + i, 314159);
    }
    await expect
      .poll(() => pages[0].evaluate(() => windloom.online.frame.roster.length), { timeout: 15000 })
      .toBe(8);
    await expect(pages[0].locator('#onlineCount')).toContainText('8 online', { timeout: 10000 });
    await expect(pages[0].locator('#roomTitle')).toContainText('Team ');
    for (const p of pages.slice(1))
      await expect.poll(() => p.evaluate(() => peer.frame.roster.length)).toBe(8);
    const ninth = await browser.newContext();
    contexts.push(ninth);
    const p = await ninth.newPage();
    await prepare(p);
    await p.bringToFront();
    await p.goto('http://127.0.0.1:8000/?online=coop#s314159');
    await p.waitForFunction(() => window.windloom?.G, null, { timeout: 15000, polling: 100 });
    await expect(p.locator('#onlineStatus')).toContainText('Online ready', { timeout: 10000 });
    await p.locator('#nickname').fill('Ninth');
    await p.locator('#start').click();
    await expect(p.locator('#onlineStatus')).toContainText('full', { timeout: 12000 });
    await p.locator('#networkMode').selectOption('solo');
    await p.locator('#start').click();
    await expect.poll(() => p.evaluate(() => windloom.G.mode)).toBe('play');
    await pages[0].bringToFront();
    await expect(pages[0].locator('#roomPlayers')).toBeVisible();
    await pages[0].keyboard.press('Tab');
    await expect(pages[0].locator('#roomPlayers')).not.toBeVisible();
    await pages[0].keyboard.press('Tab');
    await expect(pages[0].locator('#roomPlayers')).toBeVisible();
    await pages[0].screenshot({ path: '.artifacts/eight-player-room.png' });
  } finally {
    for (const c of contexts) await c.close();
  }
});
for (const latency of [100, 200])
  test(`movement reconciles under ${latency} ms measured round-trip delay`, async ({ browser }) => {
    const proxy = await latencyProxy('http://127.0.0.1:8787', latency),
      context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.route('**/config/online.json', (route) =>
        route.fulfill({ json: { backendUrl: proxy.origin } })
      );
      await join(page, 'Latency ' + latency, 'competitive', latency + 7000);
      await expect
        .poll(() => page.evaluate(() => windloom.online.rtt), { timeout: 8000 })
        .toBeGreaterThan(latency * 0.75);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(800);
      await page.keyboard.up('KeyW');
      const error = await page.evaluate(() => {
        const f = windloom.online.frame,
          p = f.players.find((p) => p.id === f.self),
          g = windloom.G.playerPos;
        return Math.hypot(g.x - p.pos[0], g.y - p.pos[1], g.z - p.pos[2]);
      });
      expect(error).toBeLessThan(20);
      expect(await page.evaluate(() => windloom.online.connected)).toBe(true);
    } finally {
      await context.close();
      await proxy.close();
    }
  });
test('starting free flight from timed results joins a free room', async ({ browser }) => {
  const fixture = structuredClone(config);
  fixture.round.durationSeconds = 3;
  const backend = await startBackend({ configOverride: fixture }),
    context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route('**/config/online.json', (route) =>
      route.fulfill({ json: { backendUrl: backend.url.origin } })
    );
    await page.route('**/config/game-config.json', (route) => route.fulfill({ json: fixture }));
    await join(page, 'Mode switch', 'coop', 8765);
    try {
      await expect
        .poll(() => page.evaluate(() => windloom.G.mode), { timeout: 10000 })
        .toBe('results');
    } catch (e) {
      throw Error(
        'Timed fixture did not finish: ' +
          JSON.stringify(
            await page.evaluate(() => ({
              mode: windloom.G.mode,
              frame: windloom.online.frame && {
                timeLeft: windloom.online.frame.timeLeft,
                finished: windloom.online.frame.finished,
                round: windloom.online.frame.room.round
              },
              status: document.getElementById('onlineStatus').textContent
            }))
          )
      );
    }
    await page.locator('input[name=mode][value=free]').locator('..').click();
    await page.locator('#start').click();
    await expect
      .poll(() => page.evaluate(() => windloom.online.frame?.room.round), { timeout: 8000 })
      .toBe('free');
    expect(await page.evaluate(() => windloom.G.timed)).toBe(false);
  } finally {
    await context.close();
    await backend.mf.dispose();
  }
});
