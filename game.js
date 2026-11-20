/* game.js — game state, movement, events, traps, searching, camping, saves and the main loop.
   Loaded last. Everything is reached through window.EM. */
var EM = window.EM = window.EM || {};

EM.Game = (function () {
  var R = EM.Rules, D = EM.Data, MOD = EM.Mod, V = EM.View3D;
  var SAVE_PREFIX = 'emberfall.save.';
  var AUTOSAVE = 'emberfall.autosave';
  var SAVE_VERSION = 1;
  var TWO_PI = Math.PI * 2;
  var DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  var WALK_BLOCK = { '#': 1, 's': 1, 'D': 1, 'L': 1, 'T': 1, 'I': 1, 'H': 1, 'S': 1, '=': 1, '<': 1, '>': 1 };

  var S = null;          // the saved game state (plain data)
  var level = null;      // compiled current place: {id, kind, grid, rows, w, h, traps, place}
  var cam = { x: 0, y: 0, a: 0 };
  var anim = null;       // current tween
  var queued = null;     // one buffered action while a tween runs
  var renderer = null, miniCanvas = null;
  var drawPending = false;
  var busy = false;      // true while a modal is open
  var inCombat = false;

  // ---- state helpers ----------------------------------------------------------
  function adv() { return EM.Adventures.ALL[S.adv]; }
  function placeData(id) { return adv().places[id]; }
  function key(x, y) { return x + ',' + y; }

  function compile(placeId) {
    var pl = placeData(placeId);
    var rows = pl.rows.map(function (r) { return r.replace(/E/g, '.').split(''); });
    var changes = (S.changes[placeId] || {});
    Object.keys(changes).forEach(function (k) {
      var p = k.split(',').map(Number);
      rows[p[1]][p[0]] = changes[k];
    });
    var traps = (pl.traps || []).map(function (t, i) {
      var st = (S.traps[placeId] || {})[i] || {};
      return { x: t.x, y: t.y, kind: t.kind, index: i, found: !!st.found, gone: !!st.gone };
    });
    S.groups = S.groups || {};
    if (!S.groups[placeId]) {
      S.groups[placeId] = (pl.groups || []).map(function (g) {
        return { kind: g.kind, n: g.n, x: g.x, y: g.y, state: g.state || 'awake', ambush: !!g.ambush };
      });
    }
    return { id: placeId, kind: pl.kind, depth: pl.depth || 0, rows: rows, grid: rows, w: rows[0].length, h: rows.length, traps: traps, place: pl, groups: S.groups[placeId] };
  }

  function setChange(x, y, ch) {
    var m = S.changes[S.place] = S.changes[S.place] || {};
    m[key(x, y)] = ch;
    level.grid[y][x] = ch;
  }

  function groupAt(x, y) {
    var gs = level && level.groups || [];
    for (var i = 0; i < gs.length; i++) if (gs[i].x === x && gs[i].y === y) return gs[i];
    return null;
  }

  // Line of sight across the map: walls and closed doors block it.
  function sightClear(ax, ay, bx, by) {
    var dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    var sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1, err = dx - dy, x = ax, y = ay;
    while (!(x === bx && y === by)) {
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === bx && y === by) break;
      if (WALK_BLOCK[level.grid[y][x]]) return false;
    }
    return true;
  }

  function trapState(i) {
    var m = S.traps[S.place] = S.traps[S.place] || {};
    m[i] = m[i] || {};
    return m[i];
  }

  function markSeen(x, y) {
    var seen = S.seen[S.place] = S.seen[S.place] || {};
    seen[key(x, y)] = 1;
  }

  function seenMap() { return S.seen[S.place] = S.seen[S.place] || {}; }

  // Reveal squares along the four directions until a wall, plus the squares next to the party.
  function reveal() {
    markSeen(S.x, S.y);
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var nx = S.x + dx, ny = S.y + dy;
      if (nx >= 0 && ny >= 0 && ny < level.h && nx < level.w) markSeen(nx, ny);
    }
    for (var d = 0; d < 4; d++) {
      var v = MOD.DIRS[d];
      for (var s = 1; s <= 8; s++) {
        var x = S.x + v.dx * s, y = S.y + v.dy * s;
        if (x < 0 || y < 0 || y >= level.h || x >= level.w) break;
        markSeen(x, y);
        if (WALK_BLOCK[level.grid[y][x]] && level.grid[y][x] !== 'D' && level.grid[y][x] !== 'L') break;
        if (level.grid[y][x] === 'D' || level.grid[y][x] === 'L') break;
      }
    }
  }

  function living() { return S.party.filter(function (c) { return c.status === 'ok'; }); }
  function partyDown() { return S.party.length > 0 && living().length === 0; }

  // ---- messages ---------------------------------------------------------------
  function log(text, cls) {
    S.log = S.log || [];
    S.log.push({ t: S.clock, text: text, cls: cls || '' });
    if (S.log.length > 200) S.log.shift();
    if (EM.UI) EM.UI.log(text, cls);
  }

  // ---- drawing ----------------------------------------------------------------
  function requestDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(function () {
      drawPending = false;
      paint();
      if (EM.UI && S) EM.UI.refresh(S);
    });
  }

  function paint() {
    if (!renderer || !level) return;
    renderer.draw(level.grid, level.kind, cam, visibleGroups());
    EM.Map.draw(miniCanvas, level, seenMap(), { x: cam.x, y: cam.y, a: cam.a }, { traps: level.traps, loot: (S.loot && S.loot[S.place]) || {} });
  }

  var inFrame = false;   // a tween started from inside a frame must not start a second loop
  function frame(now) {
    inFrame = true;
    frameBody(now);
    inFrame = false;
  }

  function frameBody(now) {
    if (anim) {
      var p = Math.min(1, (now - anim.t0) / anim.dur);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // ease in-out
      cam.x = anim.fx + (anim.tx - anim.fx) * e;
      cam.y = anim.fy + (anim.ty - anim.fy) * e;
      cam.a = anim.fa + (anim.ta - anim.fa) * e;
      paint();
      if (p >= 1) {
        var done = anim.after;
        anim = null;
        if (done) done();
        if (!anim) settleCamera();
      }
      if (anim) requestAnimationFrame(frame);
      else if (queued) { var q = queued; queued = null; act(q); }
      return;
    }
    paint();
  }

  function visibleGroups() {
    return (level && level.groups || []).filter(function (g) { return !g.ambush || g.revealed; });
  }

  function settleCamera() {
    if (!S) return;
    var base = DIR_ANGLE[S.dir];
    var k = Math.round((cam.a - base) / TWO_PI);
    cam.a = base + k * TWO_PI;
    cam.x = S.x + 0.5; cam.y = S.y + 0.5;
  }

  function tween(tx, ty, ta, dur, after) {
    anim = {
      fx: cam.x, fy: cam.y, fa: cam.a,
      tx: tx, ty: ty, ta: ta, t0: performance.now(), dur: dur, after: after
    };
    if (!inFrame) requestAnimationFrame(frame);
  }

  // ---- movement ---------------------------------------------------------------
  // rel: 'fwd' | 'back' | 'left' (strafe) | 'right' (strafe) | 'turnL' | 'turnR' | 'bump'
  function act(rel) {
    if (!S || busy) return;
    if (anim) { queued = rel; return; }
    var fx = S.x + 0.5, fy = S.y + 0.5;
    var baseA = cam.a;
    if (rel === 'turnL' || rel === 'turnR') {
      var nd = (S.dir + (rel === 'turnL' ? 3 : 1)) % 4;
      tween(fx, fy, baseA + (rel === 'turnL' ? -Math.PI / 2 : Math.PI / 2), 170, function () {
        S.dir = nd;
        settleCamera();
        requestDraw();
        autoSaveLater();
      });
      return;
    }
    var v = MOD.DIRS[S.dir];
    var dx = v.dx, dy = v.dy;
    if (rel === 'back') { dx = -dx; dy = -dy; }
    if (rel === 'left') { dx = MOD.DIRS[(S.dir + 3) % 4].dx; dy = MOD.DIRS[(S.dir + 3) % 4].dy; }
    if (rel === 'right') { dx = MOD.DIRS[(S.dir + 1) % 4].dx; dy = MOD.DIRS[(S.dir + 1) % 4].dy; }
    var tx = S.x + dx, ty = S.y + dy;
    var ch = (tx < 0 || ty < 0 || ty >= level.h || tx >= level.w) ? '#' : level.grid[ty][tx];
    if (WALK_BLOCK[ch] || groupAt(tx, ty)) {
      // Bump: a short nudge toward the wall, no hitch, then the bump is resolved.
      var nudge = 0.12;
      tween(fx + dx * nudge, fy + dy * nudge, baseA, 110, function () {
        tween(fx, fy, baseA, 110, function () { bump(tx, ty, ch); });
      });
      return;
    }
    tween(tx + 0.5, ty + 0.5, baseA, 200, function () {
      S.x = tx; S.y = ty;
      EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP);
      S.steps = (S.steps || 0) + 1;
      settleCamera();
      reveal();
      enter(tx, ty);
      if (!busy && !inCombat) noticeCheck();
      requestDraw();
      if (S.steps % 8 === 0) autoSaveLater();
    });
  }

  function bump(x, y, ch) {
    var g = groupAt(x, y);
    if (g) { g.revealed = true; return encounter(g, false); }
    if (ch === 'D') {
      setChange(x, y, 'd');
      log('You ease the door open.');
      EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP);
      requestDraw();
      return;
    }
    if (ch === 'L') return tryLock(x, y);
    if (ch === 'T' || ch === 'I' || ch === 'H' || ch === 'S') {
      busy = true;
      EM.UI.service(ch, function () { busy = false; requestDraw(); });
      return;
    }
    if (ch === '=') {
      if (EM.Overland) return EM.Overland.enter();
      log('The town gate is barred.');
      requestDraw();
      return;
    }
    if (ch === '<' || ch === '>') {
      var link = placeData(S.place).links && placeData(S.place).links[key(x, y)];
      if (!link) {
        log('These stairs lead further down, but that part of the Cellars is not built yet.');
        requestDraw();
        return;
      }
      travel(link);
      return;
    }
    requestDraw();
  }

  function tryLock(x, y) {
    var keyItem = null;
    S.pack.forEach(function (id, i) {
      var kf = D.item(id) && D.item(id).keyFor;
      if (!keyItem && (kf === 'cellar-door' || kf === S.adv)) keyItem = i;
    });
    if (keyItem !== null) {
      setChange(x, y, 'd');
      log('The iron key turns with a heavy click, and the door swings open.');
      EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP);
      requestDraw();
      return;
    }
    var thief = S.party.filter(function (c) { return c.cls === 'thief' && c.status === 'ok'; })[0];
    if (!thief) {
      log('The door is locked. Nothing in your pack will open it.');
      requestDraw();
      return;
    }
    var chance = R.skillValue(thief, 'pickLock');
    EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP * 3);
    if (EM.rand() * 100 < chance) {
      setChange(x, y, 'd');
      log(thief.name + ' picks the lock.');
    } else {
      log(thief.name + ' fails to pick the lock.');
    }
    requestDraw();
  }

  function travel(link) {
    S.place = link.to;
    S.x = link.x; S.y = link.y; S.dir = link.dir;
    level = compile(S.place);
    cam.x = S.x + 0.5; cam.y = S.y + 0.5; cam.a = DIR_ANGLE[S.dir];
    reveal();
    log('You make your way to ' + placeData(S.place).name + '.');
    autoSave();
    requestDraw();
  }

  // ---- monsters: noticing and encounters ----------------------------------------
  // Returns true if a fight started. Awake groups within six squares in sight notice the company; sleeping
  // groups stir only when the company is close. Thieves who move silently are less often noticed.
  function noticeCheck() {
    var gs = level.groups || [];
    var quiet = Math.max.apply(null, [0].concat(S.party.filter(function (c) { return c.cls === 'thief' && c.status === 'ok'; })
      .map(function (c) { return R.skillValue(c, 'moveSilently'); })));
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      var d = Math.max(Math.abs(g.x - S.x), Math.abs(g.y - S.y));
      if (g.ambush) {
        if (d <= 1) { g.revealed = true; return encounter(g, true); }
        continue;
      }
      if (d > 6 || !sightClear(S.x, S.y, g.x, g.y)) continue;
      var chance = g.state === 'sleep' ? (d <= 2 ? 25 : 0) : 60;
      chance *= 1 - quiet / 150;
      if (EM.rand() * 100 < chance) return encounter(g, false);
    }
    return false;
  }

  function encounter(g, ambush) {
    if (inCombat || !EM.Combat) return false;
    inCombat = true;
    busy = true;
    g.state = 'awake';
    EM.Combat.start({
      party: S.party,
      group: { kind: g.kind, n: g.n, x: g.x, y: g.y },
      ambush: ambush,
      done: function (res) { afterCombat(g, res); }
    });
    return true;
  }

  function afterCombat(g, res) {
    var list = S.groups[S.place] || [];
    var idx = list.indexOf(g);
    if (idx >= 0) {
      var left = g.n - res.killed.length;
      if (left <= 0) {
        list.splice(idx, 1);
        // Destroying a group can complete a commission: its quest flag is set for the events to read.
        if (g.quest) { S.flags[g.quest] = true; if (EM.Journal) EM.Journal.note('Cleared the ' + MON_NAME(g) + ' in ' + placeData(S.place).name + '.'); }
      } else { g.n = left; g.ambush = false; g.state = 'awake'; }
    }
    EM.Watch.advance(S, 10);
    if (res.victory) log('The company is victorious.', 'find');
    if (res.fled) log('The company breaks away and gets clear.');
    if (res.xp) log('The company shares ' + res.xp + ' experience.', 'find');
    // The foe's hoard lies where it fell; the company picks it up by walking onto the square.
    if (res.gold || (res.items && res.items.length)) {
      dropLoot(g.x, g.y, res.gold, res.items || []);
      log('The foe leaves a hoard: ' + (res.gold ? res.gold + ' gold' : '') + (res.items && res.items.length ? (res.gold ? ' and ' : '') + res.items.length + ' item(s)' : '') + ' on the ground.', 'find');
    }
    if (res.defeated) {
      S.party.forEach(function (c) { if (c.status === 'unconscious') { c.status = 'ok'; c.hp = 1; } });
      S.gold = Math.floor(S.gold * 0.9);
      var a = adv();
      S.place = a.start.place; S.x = a.start.x; S.y = a.start.y; S.dir = a.start.dir;
      level = compile(S.place);
      cam.x = S.x + 0.5; cam.y = S.y + 0.5; cam.a = DIR_ANGLE[S.dir];
      reveal();
      log('The company is carried back to ' + placeData(S.place).name + ', bruised and poorer.', 'hurt');
    }
    busy = false;
    inCombat = false;
    if (EM.UI) EM.UI.showScreen('game');
    autoSave();
    if (partyDown()) gameOver();
    requestDraw();
  }

  // ---- squares of interest ----------------------------------------------------
  // Loot lies on a square until someone picks it up: { gp, items }.
  function dropLoot(x, y, gp, items) {
    S.loot = S.loot || {};
    var m = S.loot[S.place] = S.loot[S.place] || {};
    var k = key(x, y);
    var pile = m[k] || { gp: 0, items: [] };
    pile.gp += gp || 0;
    pile.items = pile.items.concat(items || []);
    m[k] = pile;
    if (level) level.loot = m;
  }

  function pickUpLoot(x, y) {
    var m = S.loot && S.loot[S.place];
    var pile = m && m[key(x, y)];
    if (!pile) return;
    delete m[key(x, y)];
    if (level) level.loot = m;
    if (pile.gp) { S.gold += pile.gp; log('The company gathers ' + pile.gp + ' gold.', 'find'); }
    pile.items.forEach(function (id) { S.pack.push(id); log('The company takes the ' + D.item(id).name.toLowerCase() + '.', 'find'); });
    if (EM.Bestiary) EM.Bestiary.noteLoot && EM.Bestiary.noteLoot(pile);
  }

  function enter(x, y) {
    var k = key(x, y);
    pickUpLoot(x, y);
    // Traps spring on unfound squares.
    level.traps.forEach(function (t) {
      if (t.x === x && t.y === y && !t.gone && !t.found) springTrap(t);
    });
    var ev = placeData(S.place).events && placeData(S.place).events[k];
    if (ev) runEvent(k, ev);
    if (partyDown()) gameOver();
  }

  // Conditions: 'flag:name' checks a flag set by play; anything else is an item in the pack.
  function hasCond(cond) {
    if (cond.indexOf('flag:') === 0) return !!S.flags[cond.slice(5)];
    return S.pack.indexOf(cond) >= 0;
  }

  // A holy site gives a small experience award, shared among the living, separate from the listed monster XP.
  function holySite(xp) {
    var alive = living();
    if (alive.length) alive.forEach(function (c) { R.awardXp(c, Math.floor(xp / alive.length)); });
    log('The shrine blesses the company. Each member gains a little experience.', 'find');
  }

  function MON_NAME(g) { return EM.Monsters.name(g.kind, 2); }

  function runEvent(k, ev) {
    var base = S.place + ':' + k;
    S.done = S.done || {};
    var e = null, dk = null;
    // An alternative event applies when its condition holds: an item carried, or a flag set by play.
    if (ev.alt && hasCond(ev.alt.when) && !S.done[base + ':alt']) { e = ev.alt; dk = base + ':alt'; }
    else if (!ev.once || !S.done[base]) { e = ev; dk = base; }
    if (!e) return;
    if (e.once !== false) S.done[dk] = true;
    if (e.flag) S.flags[e.flag] = true;
    if (e.take) S.pack.splice(S.pack.indexOf(e.take), 1);
    if (e.accept && EM.Journal) EM.Journal.accept(e.accept);
    if (e.complete && EM.Journal) EM.Journal.complete(e.complete);
    if (e.holy) holySite(e.holy);
    var lines = [];
    if (e.text) lines.push(e.text);
    if (e.gold) { S.gold += e.gold; lines.push('You find ' + e.gold + ' gold.'); }
    if (e.item) {
      S.pack.push(e.item);
      lines.push('You take the ' + D.item(e.item).name.toLowerCase() + '.');
    }
    if (e.xp) {
      var xp = e.quest ? R.questXp(e.xp) : e.xp;
      var alive = living();
      var share = alive.length ? Math.floor(xp / alive.length) : 0;
      alive.forEach(function (c) { R.awardXp(c, share); });
      lines.push('The party gains ' + xp + ' experience.');
    }
    if (e.title) log(e.title + ': ' + (e.text || '').slice(0, 120) + ((e.text || '').length > 120 ? '…' : ''));
    lines.slice(e.text ? 1 : 0).forEach(function (l) { log(l); });
    if (EM.UI && e.title) EM.UI.modal(e.title, lines.join('\n\n'));
  }

  // ---- traps ------------------------------------------------------------------
  function scaled(spec) {
    var extra = Math.floor(((level.depth || 1) - 1) / 2);
    return MOD.scaleDice(spec, extra);
  }

  function springTrap(t) {
    var def = D.TRAPS[t.kind];
    var st = trapState(t.index);
    st.gone = true;
    var text = def.text;
    if (def.single) {
      var alive = living();
      if (!alive.length) return;
      var victim = MOD.pick(alive);
      log(text.replace('{name}', victim.name));
      hurt(victim, def, true);
    } else {
      log(text);
      S.party.forEach(function (c) { if (c.status === 'ok') hurt(c, def, true); });
    }
    st.gone = true;
    t.gone = true;
    requestDraw();
  }

  function hurt(ch, def, allowSave) {
    var dmg = MOD.roll(scaled(def.dmg));
    var saved = allowSave && R.saveRoll(ch, def.save);
    if (saved) dmg = Math.floor(dmg / 2);
    var down = R.harm(ch, dmg);
    log(ch.name + (saved ? ' avoids most of the harm and takes ' : ' takes ') + dmg + ' damage.' + (ch.status === 'dead' ? ' ' + ch.name + ' is dead.' : down ? ' ' + ch.name + ' falls unconscious.' : ''), 'hurt');
  }

  // ---- actions ----------------------------------------------------------------
  function search() {
    if (busy) return;
    var found = 0, hits = [];
    var ok = living();
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var x = S.x + dx, y = S.y + dy;
      if (x < 0 || y < 0 || y >= level.h || x >= level.w) continue;
      if (level.grid[y][x] === 's') {
        var roll = ok.some(function (c) { return EM.rand() * 100 < R.searchChance(c); });
        if (roll) { setChange(x, y, 'D'); found++; hits.push('a secret door'); }
      }
      level.traps.forEach(function (t) {
        if (t.x === x && t.y === y && !t.gone && !t.found) {
          var r2 = ok.some(function (c) { return EM.rand() * 100 < R.searchChance(c); });
          if (r2) { t.found = true; trapState(t.index).found = true; found++; hits.push('a ' + D.TRAPS[t.kind].name + ' trap'); }
        }
      });
    }
    EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP * 2);
    if (found) log('Your search turns up ' + hits.join(' and ') + '.', 'find');
    else log('Your search turns up nothing.');
    requestDraw();
    autoSaveLater();
  }

  // Listening at a door: thieves hear better. Groups within four squares behind the door can be heard.
  function listen() {
    if (busy || inCombat) return;
    var fx = S.x + MOD.DIRS[S.dir].dx, fy = S.y + MOD.DIRS[S.dir].dy;
    var ch = level.grid[fy] && level.grid[fy][fx];
    if (ch !== 'D' && ch !== 'L') { log('There is no closed door in front of you to listen at.'); requestDraw(); return; }
    EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP * 2);
    var thief = S.party.some(function (c) { return c.cls === 'thief' && c.status === 'ok'; });
    var heard = (level.groups || []).filter(function (g) {
      return !g.ambush && Math.abs(g.x - fx) + Math.abs(g.y - fy) <= 4;
    });
    if (heard.length && EM.rand() * 100 < (thief ? 70 : 40)) {
      var g0 = heard[0];
      log(g0.state === 'sleep' ? 'You hear a slow, sleeping breath behind the door.' : 'You hear movement behind the door: ' + EM.Monsters.name(g0.kind, g0.n).toLowerCase() + ', perhaps.', 'find');
    } else {
      log('You hear nothing beyond the door.');
    }
    requestDraw();
  }

  // Spells cast out of combat: the ones with effects on the level or the company are handled here.
  function castUtility(spellId, caster) {
    var sp = D.SPELLS[spellId];
    var msg = EM.Spells.utility(spellId, caster, S);
    var r = 8, px = S.x, py = S.y;
    if (sp.utility === 'detect-traps') {
      level.traps.forEach(function (t) {
        if (Math.max(Math.abs(t.x - px), Math.abs(t.y - py)) <= r) { t.found = true; trapState(t.index).found = true; }
      });
    }
    if (sp.utility === 'find-doors') {
      for (var y = py - r; y <= py + r; y++) for (var x = px - r; x <= px + r; x++) {
        if (x >= 0 && y >= 0 && x < level.w && y < level.h && level.grid[y][x] === 's') setChange(x, y, 'D');
      }
    }
    if (sp.utility === 'scry') {
      var seen = seenMap();
      for (var yy = 0; yy < level.h; yy++) for (var xx = 0; xx < level.w; xx++) seen[key(xx, yy)] = 1;
    }
    if (sp.utility === 'recall') {
      var a = adv();
      log(msg, 'find');
      EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP * 3);
      return arrive(a.start.place, a.start.x, a.start.y, a.start.dir);
    }
    log(msg, 'find');
    requestDraw();
    autoSaveLater();
    return msg;
  }

  function disarm() {
    if (busy) return;
    var fx = S.x + MOD.DIRS[S.dir].dx, fy = S.y + MOD.DIRS[S.dir].dy;
    var t = null;
    level.traps.forEach(function (tr) { if (tr.x === fx && tr.y === fy && tr.found && !tr.gone) t = tr; });
    if (!t) { log('There is no known trap in front of you.'); requestDraw(); return; }
    var thief = S.party.filter(function (c) { return c.cls === 'thief' && c.status === 'ok'; })[0];
    if (!thief) { log('Only a thief can disarm a trap with any hope of success.'); requestDraw(); return; }
    EM.Watch.advance(S, EM.Watch.MINUTES_PER_STEP * 2);
    if (EM.rand() * 100 < R.skillValue(thief, 'removeTraps')) {
      t.gone = true; trapState(t.index).gone = true;
      log(thief.name + ' disarms the ' + D.TRAPS[t.kind].name + ' trap.', 'find');
    } else {
      log(thief.name + ' fails to disarm the trap.');
      if (EM.rand() < 0.4) springTrap(t);
    }
    requestDraw();
    autoSaveLater();
  }

  function camp() {
    if (busy) return;
    S.party.forEach(function (c) {
      if (c.status === 'dead') return;
      if (c.status !== 'ok') { c.status = 'ok'; c.hp = Math.max(1, c.hp); }
      c.hp = c.hpMax;
    });
    S.party.forEach(function (c) { R.memorize(c); });
    EM.Watch.advance(S, 8 * 60);
    log('The company rests until healed. Nothing disturbs the camp.');
    requestDraw();
    autoSave();
  }

  // Remove one copy of an item from the pack (used by combat potions).
  function takeItem(id) {
    var i = S.pack.indexOf(id);
    if (i < 0) return false;
    S.pack.splice(i, 1);
    return true;
  }

  // A mage copies a spell scroll from the pack into the spellbook. Returns a message.
  function learnScroll(ch, index) {
    var id = S.pack[index], it = D.item(id);
    if (!it || it.kind !== 'spellscroll') return 'That is not a spell scroll.';
    if (ch.cls !== 'mage') return 'Only mages can copy spells from scrolls.';
    if (!R.learnSpell(ch, it.spell)) return ch.name + ' already knows that spell.';
    S.pack.splice(index, 1);
    log(ch.name + ' copies the ' + D.SPELLS[it.spell].name.toLowerCase() + ' spell into the spellbook.', 'find');
    requestDraw();
    return null;
  }

  function useItem(index, ch) {
    var id = S.pack[index], it = D.item(id);
    if (!it || (!it.heal)) return false;
    var amount = MOD.roll(it.heal);
    var healed = R.heal(ch, amount);
    S.pack.splice(index, 1);
    log(ch.name + ' uses the ' + it.name.toLowerCase() + ' and recovers ' + healed + ' hit points.');
    requestDraw();
    return true;
  }

  // Equip from pack: the item previously in the slot goes back to the pack.
  function equip(ch, slot, id) {
    var old = ch[slot];
    if (old) S.pack.push(old);
    if (id) {
      var i = S.pack.indexOf(id);
      if (i >= 0) S.pack.splice(i, 1);
    }
    ch[slot] = id || null;
    requestDraw();
  }

  function sellItem(index) {
    var id = S.pack[index];
    var price = D.sellValue(id);
    S.pack.splice(index, 1);
    S.gold += price;
    log('You sell the ' + D.item(id).name.toLowerCase() + ' for ' + price + ' gold.');
    requestDraw();
  }

  function buyItem(id) {
    var it = D.item(id);
    if (!it || S.gold < it.value) return false;
    S.gold -= it.value;
    S.pack.push(id);
    log('You buy the ' + it.name.toLowerCase() + ' for ' + it.value + ' gold.');
    requestDraw();
    return true;
  }

  // ---- game over and new games ----------------------------------------------
  function gameOver() {
    log('Every member of the company has fallen. Load a saved game to continue.', 'hurt');
    if (EM.UI) EM.UI.modal('The company has fallen', 'Every member of the party is down. Load a saved game, or start a new company from the title screen.');
    busy = true;
  }

  function startNew(party, adventureId) {
    adventureId = adventureId || 'E0';
    var a = EM.Adventures.ALL[adventureId];
    busy = false;
    S = {
      v: SAVE_VERSION,
      adv: adventureId,
      place: a.start.place,
      x: a.start.x, y: a.start.y, dir: a.start.dir,
      party: party,
      gold: 100,
      pack: [],
      flags: {},
      clock: 8 * 60,
      steps: 0,
      seen: {}, changes: {}, traps: {}, done: {}, groups: {},
      log: []
    };
    level = compile(S.place);
    cam.x = S.x + 0.5; cam.y = S.y + 0.5; cam.a = DIR_ANGLE[S.dir];
    reveal();
    log('The company sets out from ' + placeData(S.place).name + '. Good luck.');
    autoSave();
    requestDraw();
  }

  // Change place (used when leaving the wilds, or taking stairs from the overland).
  function arrive(placeId, x, y, dir) {
    S.mode = 'place';
    S.place = placeId; S.x = x; S.y = y; S.dir = dir;
    level = compile(S.place);
    cam.x = S.x + 0.5; cam.y = S.y + 0.5; cam.a = DIR_ANGLE[S.dir];
    reveal();
    log('The company arrives at ' + placeData(S.place).name + '.');
    if (EM.UI) EM.UI.showScreen('game');
    autoSave();
    requestDraw();
  }

  function loadState(data) {
    if (!data || data.v !== SAVE_VERSION || !data.party) return false;
    S = data;
    busy = false;
    level = compile(S.place);
    cam.x = S.x + 0.5; cam.y = S.y + 0.5; cam.a = DIR_ANGLE[S.dir];
    reveal();
    requestDraw();
    return true;
  }

  function saveSlot(n) {
    var payload = JSON.stringify({ v: SAVE_VERSION, when: Date.now(), name: S.party.map(function (c) { return c.name; }).join(', '), state: S });
    return MOD.store.set(SAVE_PREFIX + n, payload);
  }

  function slotInfo(n) {
    var raw = MOD.store.get(SAVE_PREFIX + n);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      return { when: o.when, name: o.name, data: o.state };
    } catch (e) { return null; }
  }

  function loadSlot(n) {
    var info = slotInfo(n);
    return info ? loadState(info.data) : false;
  }

  function autoSave() {
    if (!S) return;
    try {
      MOD.store.set(AUTOSAVE, JSON.stringify({ v: SAVE_VERSION, when: Date.now(), name: S.party.map(function (c) { return c.name; }).join(', '), state: S }));
    } catch (e) { /* ignore */ }
  }

  var saveTimer = null;
  function autoSaveLater() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autoSave, 400);
  }

  function autosaveInfo() { return slotInfo('autosave') || null; }
  function loadAutosave() {
    var raw = MOD.store.get(AUTOSAVE);
    if (!raw) return false;
    try { return loadState(JSON.parse(raw).state); } catch (e) { return false; }
  }

  // ---- public surface ---------------------------------------------------------
  function init(canvas, mini) {
    renderer = new V.Renderer(canvas);
    miniCanvas = mini;
    miniCanvas.width = 240; miniCanvas.height = 180;
  }

  function state() { return S; }
  function hasState() { return !!S; }
  function currentLevel() { return level; }
  function isBusy() { return busy; }
  function setBusy(v) { busy = v; }
  function view() { return { cam: cam, level: level }; }

  return {
    init: init, act: act, search: search, disarm: disarm, camp: camp, useItem: useItem, listen: listen, castUtility: castUtility,
    equip: equip, sellItem: sellItem, buyItem: buyItem, startNew: startNew,
    takeItem: takeItem, learnScroll: learnScroll,
    saveSlot: saveSlot, slotInfo: slotInfo, loadSlot: loadSlot, loadAutosave: loadAutosave,
    autosaveInfo: autosaveInfo, autoSave: autoSave, state: state, hasState: hasState,
    currentLevel: currentLevel, isBusy: isBusy, setBusy: setBusy, view: view,
    requestDraw: requestDraw, log: log, living: living, placeName: function () { return placeData(S.place).name; },
    partyDown: partyDown, gameOver: gameOver, arrive: arrive, isWild: function () { return !!S && S.mode === 'wild'; },
    _setChange: setChange
  };
})();
