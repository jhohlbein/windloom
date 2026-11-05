// Entry point. All game code is imported statically; config.js loads the tuning file with a top-level await
// before any module that reads CFG runs. (No dynamic import: browsers keep dynamically imported modules in
// the cache even on a hard reload, which left old game code running after updates.)
// Errors: config.js reports start-up errors; a file that fails to download (e.g. the 3D library from the CDN)
// stops the whole module graph before any code runs, which the script tag's onerror in index.html reports.
import { VERSION } from './version.js';
import './game.js';

showBuildTime().then(checkForUpdate);

// Show when the newest loaded file was last changed (the Last-Modified header of the page, config and every
// module). The files are fetched with the normal cache policy, so this reflects what the browser actually
// loaded: if it shows an old time after you edited something, do a hard reload.
async function showBuildTime() {
  const el = document.getElementById('ver');
  if (!el) return;
  try {
    const urls = [location.pathname, ...performance.getEntriesByType('resource')
      .map(e => e.name).filter(n => n.startsWith(location.origin) && /\.(js|json)(\?|$)/.test(n))];
    const times = await Promise.all(urls.map(async u => {
      const t = Date.parse((await fetch(u)).headers.get('last-modified'));
      return Number.isNaN(t) ? 0 : t;
    }));
    const newest = Math.max(...times);
    if (newest > 0) {
      const d = new Date(newest), p = n => String(n).padStart(2, '0');
      el.textContent += ` · changed ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
  } catch (err) { console.warn('build time unavailable', err); }
}

// Compare the version this page is running with the one on the server. Browsers may keep serving cached modules
// for a while after an update (GitHub Pages allows 10 minutes), so offer an update button when they differ.
async function checkForUpdate() {
  const el = document.getElementById('ver');
  if (!el) return;
  try {
    const m = /VERSION\s*=\s*'([^']+)'/.exec(await (await fetch('src/version.js', { cache: 'no-store' })).text());
    if (!m || m[1] === VERSION) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'update'; btn.textContent = 'Version ' + m[1] + ' is available, update now';
    btn.addEventListener('click', updateNow);
    el.append(' · ', btn);
  } catch (err) { /* offline or blocked: nothing to offer */ }
}
// Refetch every file this page loaded with cache: 'reload', which replaces the browser's cached copies, then reload
async function updateNow(e) {
  e.target.disabled = true; e.target.textContent = 'Updating…';
  const urls = [location.pathname, ...performance.getEntriesByType('resource')
    .map(r => r.name).filter(n => n.startsWith(location.origin) && /\.(js|json|css)(\?|$)/.test(n))];
  await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
  location.reload();
}
