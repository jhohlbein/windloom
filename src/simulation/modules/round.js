// Shared original gameplay. Presentation and state are injected; no DOM or WebGL dependency.
export function createRound(services) {
  const random = services.random || Math.random,
    R = random;
  const { CFG } = services;
  const { G } = services;
  const { W } = services;
  // Timed rounds: countdown, end conditions, score and the best score per island seed (localStorage).

  // timed: the standard 4-minute round. Untimed (free flight): no clock, no score, play as long as you like.
  function resetRound(timed) {
    G.timed = timed;
    G.timeLeft = CFG.round.durationSeconds;
    G.killsBy = {};
    G.dragonSlain = false;
    G.endTimer = -1;
    G.endReason = '';
    G.finished = false;
  }
  // Complete = palace at its last stage and Vharoth slain
  const roundComplete = () => G.dragonSlain && G.level >= CFG.palace.stageThresholds.length;

  // Returns 'time' or 'complete' once the round is over, otherwise ''. The clock runs everywhere, beam included.
  // In free flight only 'complete' can happen, once; afterwards you keep flying.
  function updateRound(dt) {
    if (G.endTimer > 0) {
      G.endTimer -= dt;
      if (G.endTimer > 0) return '';
      G.endTimer = -1;
      G.finished = true;
      return G.endReason;
    }
    if (G.finished) return '';
    if (G.timed) G.timeLeft = Math.max(0, G.timeLeft - dt);
    if (roundComplete()) {
      G.endReason = 'complete';
      G.endTimer = 2.4;
      return '';
    } // a moment to see the finale
    if (G.timed && G.timeLeft <= 0) {
      G.finished = true;
      return (G.endReason = 'time');
    }
    return '';
  }

  function formatClock(s) {
    const t = Math.ceil(s),
      m = Math.floor(t / 60),
      r = t % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  const KIND_LABEL = {
    skeleton: 'Skeleton archers',
    wyvern: 'Wyverns',
    drake: 'Drakes',
    worm: 'Sandworms',
    kraken: 'Krakens'
  };
  function scoreRound() {
    const S = CFG.round,
      lines = [];
    for (const kind of Object.keys(KIND_LABEL)) {
      const n = G.killsBy[kind] || 0,
        p = S.pointsPerKill[kind] || 0;
      if (n) lines.push([KIND_LABEL[kind] + ' slain × ' + n, n * p]);
    }
    if (G.level > 1)
      lines.push(['Palace stages raised × ' + (G.level - 1), (G.level - 1) * S.pointsPerStage]);
    if (G.dragonSlain) lines.push(['Vharoth slain', S.dragonSlainBonus]);
    if (G.endReason === 'complete') {
      lines.push(['Round complete', S.completionBonus]);
      const left = Math.floor(G.timeLeft);
      if (left > 0) lines.push(['Time left ' + formatClock(left), left * S.pointsPerSecondLeft]);
    }
    return { lines, total: lines.reduce((a, l) => a + l[1], 0) };
  }

  return { resetRound, roundComplete, updateRound, formatClock, scoreRound };
}
