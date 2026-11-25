import { test, expect } from '@playwright/test';
import path from 'node:path';
test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:8787/**', (route) => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/three@0.128.0/**', (route) =>
    route.fulfill({
      path: path.resolve('node_modules/three/build/three.module.js'),
      contentType: 'text/javascript'
    })
  );
});
test('timed flight, spells, banking, respawn and pause retain the original rules', async ({
  page
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#s12345');
  await page.waitForFunction(() => window.windloom?.G, null, { timeout: 10000 });
  await page.locator('input[name=mode][value=timed]').locator('..').click();
  await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => windloom.G.mode)).toBe('play');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => windloom.G.playTime)).toBeGreaterThan(0);
  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => windloom.G.spellMana)).toBeLessThan(100);
  await page.evaluate(() => {
    const { G, W } = windloom;
    G.playerPos.set(W.CX + 20, W.PH + 15, W.CZ);
    G.carried = 60;
    G.speed = 0;
  });
  await expect.poll(() => page.evaluate(() => windloom.G.castleMana)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => windloom.G.mode)).toBe('pause');
  expect(await page.evaluate(() => windloom.W.SEED)).toBe(12345);
  expect(errors).toEqual([]);
});
for (const mode of ['free', 'tutorial'])
  test(`${mode} starts without an online backend`, async ({ page }) => {
    await page.goto('/#s12345');
    await page.waitForFunction(() => window.windloom?.G, null, { timeout: 10000 });
    await page.locator(`input[name=mode][value=${mode}]`).locator('..').click();
    await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => windloom.G.gameMode)).toBe(mode);
    expect(await page.evaluate(() => windloom.G.timed)).toBe(false);
    if (mode === 'tutorial') expect(await page.evaluate(() => !!windloom.G.tut)).toBe(true);
  });
