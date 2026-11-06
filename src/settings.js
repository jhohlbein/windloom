// Player settings chosen on the start screen, kept in this browser (localStorage). Storage may be unavailable
// (private mode, blocked site data), so every access is optional and the defaults always work.
const KEY = 'windloom.settings';
const DEFAULTS = { rider: 'sultan', shadows: true, tilt: true }; // tilt: steer by tilting the phone (touch devices only) // rider: 'sultan' (turbaned rider) | 'princess' (veiled princess)

export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* defaults */ }

export function saveSetting(name, value) {
  settings[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* kept for this visit only */ }
}
