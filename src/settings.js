// Player settings chosen on the start screen, kept in this browser (localStorage). Storage may be unavailable
// (private mode, blocked site data), so every access is optional and the defaults always work.
const KEY = 'windloom.settings';
const DEFAULTS = { rider: 'sultan', shadows: true, tilt: true, autoFullscreen: true, mode: 'timed', mouse: true, invertKeys: false, invertMouse: false }; // invertKeys / invertMouse: up and down swapped for the arrow keys / the mouse // mouse: mouse and trackpad play on a computer (off: keys only, so a brushed trackpad does nothing) // mode: game mode chosen on the start screen ('timed' | 'free' | 'tutorial') // tilt: steer by tilting the phone; autoFullscreen: full screen when flight starts (touch devices only) // rider: 'sultan' (turbaned rider) | 'princess' (veiled princess)

export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* defaults */ }

export function saveSetting(name, value) {
  settings[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* kept for this visit only */ }
}
