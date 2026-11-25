import { OnlineClient, onlineLink, shareUrl } from './client.js';
import { OnlineView } from './view.js';
const $ = (id) => document.getElementById(id);
export function createOnline(config, callbacks) {
  const mode = $('networkMode'),
    nickname = $('nickname'),
    seed = $('onlineSeed'),
    view = new OnlineView();
  const board = document.createElement('section');
  board.className = 'online-board';
  board.id = 'onlineBoard';
  const heading = document.createElement('h2');
  heading.textContent = 'Online best rounds';
  const controls = document.createElement('div');
  controls.className = 'online-board-controls';
  const category = document.createElement('select');
  category.id = 'onlineBoardMode';
  category.setAttribute('aria-label', 'Online leaderboard mode');
  for (const [v, text] of [
    ['competitive', 'Competitive'],
    ['coop', 'Co-op teams']
  ]) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = text;
    category.append(o);
  }
  const party = document.createElement('select');
  party.id = 'onlinePartySize';
  party.setAttribute('aria-label', 'Co-op team size');
  party.hidden = true;
  for (let i = 1; i <= 8; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = i === 1 ? '1 player' : i + ' players';
    party.append(o);
  }
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'go2';
  refresh.textContent = 'Refresh';
  const rows = document.createElement('ol');
  rows.id = 'onlineBoardList';
  const empty = document.createElement('p');
  empty.className = 'hint';
  empty.textContent = 'Online rankings are unavailable.';
  controls.append(category, party, refresh);
  board.append(heading, controls, rows, empty);
  document.querySelector('#overlay .card').append(board);
  let lastRosterAt = 0,
    lastRevision = -1,
    lastBoardRead = 0,
    boardTimer = null,
    backgroundTimer = null;
  const status = (text) => {
    $('onlineStatus').textContent = text;
    $('roomConnection').textContent = text;
  };
  const count = (n) => {
    $('onlineCount').textContent = n === null ? 'Online unavailable' : String(n) + ' online';
  };
  const client = new OnlineClient(config, {
    status,
    live: (value) => {
      count(value.online);
      if (value.revision !== undefined && value.revision !== lastRevision) {
        lastRevision = value.revision;
        scheduleBoard();
      }
    },
    snapshot: (frame) => {
      view.receive(frame, client.rtt);
      if (performance.now() - lastRosterAt > 200) {
        lastRosterAt = performance.now();
        $('roomTitle').textContent =
          (frame.room.mode === 'coop' ? 'Co-op' : 'Competitive') +
          ' · ' +
          frame.roster.filter((p) => p.connected).length +
          '/' +
          frame.room.capacity +
          (!frame.timed
            ? ' · Unranked'
            : frame.room.mode === 'coop'
              ? ' · Team ' + frame.score.total
              : '');
        const sorted = [...frame.roster].sort((a, b) =>
          frame.room.mode === 'coop' ? b.banked - a.banked : b.score - a.score
        );
        $('roomPlayers').replaceChildren(
          ...sorted.map((p) => {
            const li = document.createElement('li'),
              name = document.createElement('span'),
              value = document.createElement('b');
            name.textContent =
              p.name + ' · ' + p.id.slice(0, 4) + (p.connected ? '' : ' (reconnecting)');
            value.textContent =
              frame.room.mode === 'coop' || !frame.timed
                ? p.kills + ' kills · ' + Math.floor(p.banked) + ' banked'
                : String(p.score);
            li.append(name, value);
            return li;
          })
        );
      }
      callbacks.frame(frame);
    },
    error: (message) => {
      status(message);
      callbacks.error(message);
    }
  });
  if (client.profile?.guest?.name) nickname.value = client.profile.guest.name;
  const link = onlineLink(location.href);
  mode.value = link.mode;
  if (link.mode !== 'solo') callbacks.setRound(link.round);
  function update() {
    $('onlineFields').hidden = mode.value === 'solo';
    $('onlineHint').textContent =
      mode.value === 'coop'
        ? 'Share this island to hunt together and build one palace. Players cannot hurt one another.'
        : 'Fly the same island together with your own creatures and palace. Compare scores; players cannot hurt one another.';
  }
  mode.addEventListener('change', () => {
    if (mode.value !== 'solo' && callbacks.round() === 'tutorial') callbacks.setRound('timed');
    update();
    callbacks.modeChanged();
  });
  for (const input of document.querySelectorAll('input[name=mode]'))
    input.addEventListener('change', () => {
      if (callbacks.round() === 'tutorial' && mode.value !== 'solo') {
        mode.value = 'solo';
        update();
        callbacks.modeChanged();
      }
    });
  function seedValue() {
    const value = seed.value.trim();
    if (!/^\d{1,10}$/.test(value) || Number(value) > 0xffffffff)
      throw Error('Enter an island seed from 0 to 4294967295.');
    return Number(value);
  }
  $('shareIsland').addEventListener('click', async () => {
    try {
      const href = shareUrl(location.href, seedValue(), mode.value, callbacks.round());
      await navigator.clipboard.writeText(href);
      status('Island link copied. Friends can open it and press Start.');
    } catch {
      status('Could not copy automatically. The page address contains the island seed.');
    }
  });
  async function readBoard() {
    if (!client.info) return;
    lastBoardRead = performance.now();
    refresh.disabled = true;
    try {
      const data = await client.leaderboard(category.value, Number(party.value));
      count(data.online);
      rows.replaceChildren(
        ...data.rows.slice(0, 10).map((row) => {
          const li = document.createElement('li'),
            name = document.createElement('span'),
            score = document.createElement('b'),
            link = document.createElement('a');
          name.textContent = row.members.map((m) => m.name + ' · ' + m.id.slice(0, 4)).join(', ');
          score.textContent = String(row.score);
          link.textContent = 'Island ' + row.seed;
          link.href = shareUrl(location.href, row.seed, row.mode, 'timed');
          li.append(name, score, link);
          return li;
        })
      );
      empty.hidden = data.rows.length > 0;
      empty.textContent = 'No completed online rounds yet. Be the first to set a score.';
    } catch {
      empty.hidden = false;
      empty.textContent =
        'Online rankings are temporarily unavailable. Your browser’s solo scores are still saved.';
    } finally {
      refresh.disabled = false;
    }
  }
  function scheduleBoard() {
    clearTimeout(boardTimer);
    boardTimer = setTimeout(
      () => {
        if (!$('overlay').hidden) readBoard();
      },
      Math.max(0, 3000 - (performance.now() - lastBoardRead))
    );
  }
  category.addEventListener('change', () => {
    party.hidden = category.value !== 'coop';
    readBoard();
  });
  party.addEventListener('change', readBoard);
  refresh.addEventListener('click', readBoard);
  document.addEventListener('visibilitychange', () => {
    clearTimeout(backgroundTimer);
    if (document.hidden)
      backgroundTimer = setTimeout(
        () => {
          if (client.active)
            callbacks.error(
              'You left the online room while this tab was inactive. Join again to play.'
            );
          client.stopWatching();
        },
        (config.multiplayer?.backgroundLeaveSeconds ?? 90) * 1000
      );
    else if (client.info) client.watch(nickname.value || 'Player');
  });
  window.addEventListener('pagehide', () => {
    client.leave();
    client.stopWatching();
  });
  window.addEventListener('online', () => {
    if (client.info) client.watch(nickname.value || 'Player');
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab' && client.active && $('overlay').hidden) {
      event.preventDefault();
      $('roomHud').open = !$('roomHud').open;
    }
  });
  update();
  return {
    client,
    view,
    mode: () => mode.value,
    seed: seedValue,
    nickname: () => nickname.value,
    status,
    updateSeed: (value) => {
      seed.value = String(value);
    },
    leave() {
      client.leave();
      view.clear();
      $('roomHud').hidden = true;
    },
    async init() {
      try {
        if (await client.init()) {
          readBoard();
          client.watch(nickname.value || 'Player');
        }
      } catch (e) {
        status(e.message);
        count(null);
      }
    },
    async join(round) {
      if (await client.join(nickname.value, seedValue(), mode.value, round)) {
        $('roomHud').hidden = false;
        client.watch(nickname.value);
      }
    },
    results() {
      scheduleBoard();
    }
  };
}
