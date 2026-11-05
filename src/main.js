// Entry point: load the tuning file first, then the game modules (which read CFG at import time).
import { loadConfig } from './config.js';

try {
  await loadConfig();
  await import('./game.js');
  showBuildTime();
} catch (err) {
  console.error(err);
  const text = document.getElementById('ovText');
  const isle = document.getElementById('isle');
  if (isle) isle.textContent = 'Could not start';
  if (text) {
    text.textContent = 'Windloom could not start: ' + err.message + '. ' +
      (location.protocol === 'file:'
        ? 'Browsers block modules and config files opened straight from disk. Start a local web server in the project folder (see README) and open http://localhost:8000.'
        : 'Check your connection (the 3D library loads from a CDN) and reload the page.');
  }
}

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
