// Frame hitch log, to find the cause of rare stutters. Game code marks notable events with mark('...'); a frame
// that takes longer than LIMIT ms to arrive is logged to the console with the events of that frame and whether
// three.js had to compile shaders or upload new geometry or textures in it. Also kept in window.windloom.hitches.
// Only on a local server (tools/serve.py); the published game logs nothing.
const LIMIT = 50, ON = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let marks = [], last = { programs: 0, geometries: 0, textures: 0 };
export const hitches = [];
export function mark(tag) { if (ON && marks.length < 20) marks.push(tag); }
// Browser events that can stall a frame
window.addEventListener('resize', () => mark('window resized'));
document.addEventListener('pointerlockchange', () => mark(document.pointerLockElement ? 'pointer locked' : 'pointer released'));
document.addEventListener('fullscreenchange', () => mark(document.fullscreenElement ? 'full screen on' : 'full screen off'));
// Called once per frame after rendering: interval since the previous frame, time spent in this frame's code
export function endFrame(renderer, interval, work) {
  if (!ON) return;
  const info = renderer.info, now = { programs: info.programs ? info.programs.length : 0, geometries: info.memory.geometries, textures: info.memory.textures };
  // a long gap after the tab was hidden or the page was in the background is not a hitch
  if (interval > LIMIT && interval < 1500 && !document.hidden) {
    const d = k => now[k] - last[k], gpu = [];
    if (d('programs') > 0) gpu.push('+' + d('programs') + ' shader program(s) compiled');
    if (d('geometries') > 0) gpu.push('+' + d('geometries') + ' geometries');
    if (d('textures') > 0) gpu.push('+' + d('textures') + ' textures');
    const h = { at: Math.round(performance.now() / 100) / 10, interval: Math.round(interval), work: Math.round(work), events: marks.slice(), gpu };
    hitches.push(h); if (hitches.length > 100) hitches.shift();
    console.warn('[hitch] ' + h.interval + ' ms frame (game code ' + h.work + ' ms) at ' + h.at + ' s: ' +
      ([...h.events, ...h.gpu].join(', ') || 'no game event (likely garbage collection, the browser or the GPU)'));
  }
  marks = []; last = now;
}

// Chrome (123+) also reports each long frame with a breakdown of where the time went: scripts (with what started
// them, such as a click handler or the game loop), forced style and layout, and rendering. A long frame with little
// time in any of these was waiting on something else (garbage collection, the GPU or the compositor).
if (ON && (PerformanceObserver.supportedEntryTypes || []).includes('long-animation-frame')) try {
  new PerformanceObserver(list => {
    for (const f of list.getEntries()) {
      if (f.duration < LIMIT) continue;
      const ms = v => Math.round(v);
      const scripts = (f.scripts || []).filter(s => s.duration >= 5).map(s =>
        (s.invoker || s.invokerType || '?') + (s.sourceFunctionName ? ' → ' + s.sourceFunctionName : '') +
        (s.sourceURL ? ' (' + s.sourceURL.split('/').pop() + ')' : '') + ' ' + ms(s.duration) + ' ms' +
        (s.forcedStyleAndLayoutDuration >= 5 ? ', forced layout ' + ms(s.forcedStyleAndLayoutDuration) + ' ms' : ''));
      const scriptMs = (f.scripts || []).reduce((a, s) => a + s.duration, 0);
      const layout = f.styleAndLayoutStart ? f.startTime + f.duration - f.styleAndLayoutStart : 0;
      const render = f.renderStart && f.styleAndLayoutStart ? f.styleAndLayoutStart - f.renderStart : 0;
      const other = f.duration - scriptMs - layout - render;
      const e = { at: Math.round(f.startTime / 100) / 10, duration: ms(f.duration), scripts: ms(scriptMs), render: ms(render), styleLayout: ms(layout), other: ms(other), detail: scripts };
      hitches.push({ loaf: e }); if (hitches.length > 100) hitches.shift();
      console.warn('[long frame] ' + e.duration + ' ms at ' + e.at + ' s: scripts ' + e.scripts + ' ms, rendering ' + e.render +
        ' ms, style and layout ' + e.styleLayout + ' ms, other ' + e.other + ' ms' + (scripts.length ? '\n  ' + scripts.join('\n  ') : ''));
    }
  }).observe({ type: 'long-animation-frame', buffered: true });
} catch (e) { /* not supported (Firefox, Safari): the [hitch] lines above still work */ }
