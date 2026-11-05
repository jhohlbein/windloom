// Entry point: load the tuning file first, then the game modules (which read CFG at import time).
import { loadConfig } from './config.js';

try {
  await loadConfig();
  await import('./game.js');
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
