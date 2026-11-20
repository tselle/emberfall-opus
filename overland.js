/* overland.js — travel across the wilds: steps, time and fatigue, sites, encounters and the overland screen.
   The company is on the wilds when S.mode === 'wild'. S.wild holds the position, fatigue and the squares seen. */
var EM = window.EM = window.EM || {};

EM.Overland = (function () {
  var D = EM.Data, R = EM.Rules, MOD = EM.Mod;
  // The wilds of the adventure the company is in.
  function WM() { return EM.Wilds.of(S().adv); }
  var CELL = 24;
  var REVEAL = 3;
  var FATIGUE_LIMIT = 8;   // hours of travel before the company tires
  var canvas = null, ctx = null;
  var busy = false;

  function S() { return EM.Game.state(); }
  function log(text, cls) { EM.Game.log(text, cls); }
  function note(text) { if (EM.Journal) EM.Journal.note(text); }
  function autoSave() { EM.Game.autoSave(); }

  // ---- entering and leaving ------------------------------------------------------
  function enter() {
    var s = S();
    s.mode = 'wild';
    s.wild = s.wild || { x: WM().START.x, y: WM().START.y, fatigue: 0, seen: {} };
    s.wild.x = WM().START.x; s.wild.y = WM().START.y;
    reveal();
    log('The company leaves Thornwick by the gate and takes the east road.');
    show();
  }

  // Back to the town gate, or to a named place. dest: {place, x, y, dir}.
  function leave(dest) {
    busy = false;
    EM.Game.arrive(dest.place, dest.x, dest.y, dest.dir);
  }

  // The town of the adventure the company is in: its gate.
  function leaveToTown() {
    leave({ place: EM.Adventures.ALL[S().adv].start.place, x: 1, y: 7, dir: 1 });
  }

  function show() {
    EM.UI.showScreen('overland');
    requestDraw();
    autoSave();
  }

  // ---- seeing ------------------------------------------------------------------
  function reveal() {
    var w = S().wild;
    for (var dy = -REVEAL; dy <= REVEAL; dy++) for (var dx = -REVEAL; dx <= REVEAL; dx++) {
      var x = w.x + dx, y = w.y + dy;
      if (x >= 0 && y >= 0 && x < WM().W && y < WM().H) w.seen[x + ',' + y] = 1;
    }
  }

  // ---- drawing -----------------------------------------------------------------------
  var TERRAIN_COLOUR = {
    '.': '#56703f', 'r': '#a88f5e', 'b': '#8a6a3c', 'f': '#2f4a2a', 'h': '#7a7f52',
    'w': '#3f5a4a', 'm': '#6b6660', '~': '#2f5f86'
  };
  var SITE_COLOUR = { T: '#e6d7a8', M: '#e0b060', S: '#f2efe2', K: '#5a3a2a', L: '#8a2a2a', C: '#c9a045' };

  function draw(cv, cell) {
    var c = cv.getContext('2d');
    var s = S(), w = s.wild;
    cv.width = WM().W * cell; cv.height = WM().H * cell;
    c.fillStyle = '#0b0b0e';
    c.fillRect(0, 0, cv.width, cv.height);
    for (var y = 0; y < WM().H; y++) for (var x = 0; x < WM().W; x++) {
      var k = x + ',' + y;
      if (!w.seen[k]) continue;
      var t = WM().at(x, y);
      c.fillStyle = TERRAIN_COLOUR[t] || TERRAIN_COLOUR['.'];
      if (t === 'r' || t === 'b') c.fillStyle = TERRAIN_COLOUR[t];
      c.fillRect(x * cell, y * cell, cell, cell);
      if (t === 'f') { c.fillStyle = '#1d3320'; c.beginPath(); c.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.3, 0, 6.3); c.fill(); }
      if (t === 'h') { c.fillStyle = '#4f5536'; c.beginPath(); c.moveTo(x * cell + 2, y * cell + cell - 3); c.lineTo(x * cell + cell / 2, y * cell + 4); c.lineTo(x * cell + cell - 2, y * cell + cell - 3); c.fill(); }
      if (t === 'm') { c.fillStyle = '#9b958c'; c.beginPath(); c.moveTo(x * cell + 2, y * cell + cell - 3); c.lineTo(x * cell + cell / 2, y * cell + 3); c.lineTo(x * cell + cell - 2, y * cell + cell - 3); c.fill(); }
      var site = WM().site(x, y);
      if (site) siteMarker(c, x, y, cell, site, s);
    }
    // The party.
    var px = w.x * cell + cell / 2, py = w.y * cell + cell / 2;
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(px, py, cell * 0.36, 0, 6.3); c.fill();
    c.strokeStyle = '#120e0a'; c.lineWidth = 2; c.stroke();
    // Monsters that are waiting on the wilds (the lair).
    var lair = WM().lair;
    if (lair && !s.flags['lair-cleared:' + s.adv] && w.seen[lair.x + ',' + lair.y]) {
      var lx = lair.x, ly = lair.y;
      c.fillStyle = 'rgba(200,40,40,0.35)';
      c.beginPath(); c.arc(lx * cell + cell / 2, ly * cell + cell / 2, cell * 0.5, 0, 6.3); c.fill();
    }
  }

  function siteMarker(c, x, y, cell, site, s) {
    var known = WM().SITES[site];
    c.fillStyle = SITE_COLOUR[site] || '#ccc';
    c.beginPath(); c.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.36, 0, 6.3); c.fill();
    c.fillStyle = '#120e0a';
    c.font = 'bold ' + Math.round(cell * 0.6) + 'px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(site, x * cell + cell / 2, y * cell + cell / 2 + 1);
  }

  function requestDraw() {
    if (canvas) draw(canvas, CELL);
    refresh();
  }

  function refresh() {
    var s = S(), w = s.wild;
    if (!w) return;
    var terr = WM().at(w.x, w.y), site = WM().site(w.x, w.y);
    var where = site ? WM().SITES[site].name : 'The wilds';
    var txt = where + ' · ' + WM().NAMES[terr] + ' · ' + EM.Watch.format(s);
    if (w.fatigue >= FATIGUE_LIMIT) txt += ' · the company is weary';
    var loc = document.getElementById('wildloc');
    if (loc) loc.textContent = txt;
  }

  // ---- movement ------------------------------------------------------------------------
  // dir: 0 north, 1 east, 2 south, 3 west.
  function step(dir) {
    if (busy || EM.Game.isBusy()) return;
    var s = S(), w = s.wild;
    var v = MOD.DIRS[dir];
    var nx = w.x + v.dx, ny = w.y + v.dy;
    if (!WM().passable(nx, ny)) {
      log('The river is too deep to cross here. The bridge lies on the east road.');
      requestDraw();
      return;
    }
    var terr = WM().at(nx, ny);
    var mins = WM().COST[terr] || 60;
    if (w.fatigue >= FATIGUE_LIMIT) mins = Math.round(mins * 1.25);
    w.x = nx; w.y = ny;
    w.fatigue += mins / 60;
    EM.Watch.advance(s, mins);
    reveal();
    var site = WM().site(nx, ny);
    if (site === 'T') { leaveToTown(); return; }
    requestDraw();
    if (site) { siteEvent(site); return; }
    roll(terr);
  }

  function roll(terr) {
    var s = S();
    var enc = WM().encounterFor(terr, EM.Watch.isNight(s), EM.rand);
    if (enc) return fight(enc.kind, enc.n, null, 'The company is set upon by ' + enc.n + ' ' + EM.Monsters.name(enc.kind, enc.n).toLowerCase() + '!');
    if (EM.rand() < 0.04) traveller();
    autoSave();
  }

  // Friendly travellers: a pedlar, a pilgrim or a carter, who may share news.
  var TRAVELLERS = [
    { who: 'A pedlar with a cart of pots', give: 'Thanks for the company on the road.' },
    { who: 'A pilgrim bound for the standing stones', give: 'Pray there if you pass; the stones remember kindness.' },
    { who: 'A carter with a load of barley', give: 'Mind the fen after dark. Something is walking in it.' }
  ];

  function traveller() {
    var s = S();
    var t = MOD.pick(TRAVELLERS, EM.rand);
    var news = WM().rumour(EM.rand);
    log(t.who + ' greets the company on the road.');
    if (EM.Journal) EM.Journal.note('Met ' + t.who.toLowerCase() + ' on the east road. Heard: ' + news);
    EM.UI.modal('On the road', t.who + ' falls in step for a while. \u201C' + news + '\u201D ' + t.give, [{ label: 'Wave goodbye' }]);
    requestDraw();
  }

  // ---- sites -------------------------------------------------------------------------------
  function siteEvent(site) {
    var s = S(), w = s.wild;
    if (site === 'M') return hamlet();
    if (site === 'S') return standingStones();
    if (site === 'K') {
      if (!s.flags['accepted:' + s.adv + ':main']) {
        log('The cellar door of the old brewery is barred and chained. Someone in Thornwick may know why.');
        requestDraw();
        return;
      }
      log('The chains come away easily. The brewery’s cellar stair leads down.');
      return leave(EM.Adventures.ALL[s.adv].cellar);
    }
    if (site === 'L') {
      var lr = WM().lair;
      if (!lr || s.flags['lair-cleared:' + s.adv]) { log('The lair is quiet. Nothing lives there now.'); requestDraw(); return; }
      return fight(lr.kind, lr.n, { onWin: function () { s.flags['lair-cleared:' + s.adv] = true; note('Cleared a lair on the road.'); } },
        'The lair stirs, and ' + lr.n + ' ' + EM.Monsters.name(lr.kind, lr.n).toLowerCase() + ' come out!');
    }
    if (site === 'C') { log('A safe camp by the road. Nothing will disturb the company here.'); requestDraw(); autoSave(); return; }
    requestDraw();
  }

  function hamlet() {
    var s = S();
    var body = EM.Mod.el('div', {});
    body.appendChild(EM.Mod.el('p', { text: 'Millbrook is a handful of cottages around a mill-wheel. The miller will sell you a bed, a bit of trade and the news.' }));
    EM.UI.modal('Millbrook', body, [
      { label: 'Take a room', action: function () {
        var alive = s.party.filter(function (c) { return c.status !== 'dead'; });
        var cost = alive.length * 5;
        if (s.gold < cost) { log('The miller shakes his head: the company cannot afford the rooms.'); return; }
        s.gold -= cost;
        alive.forEach(function (c) { R.heal(c, c.hpMax); R.memorize(c); });
        EM.Watch.advance(s, 8 * 60);
        log('The company rests in Millbrook and wakes fully healed. It cost ' + cost + ' gold.');
        requestDraw();
      } },
      { label: 'Trade', action: function () { EM.UI.service('S', function () { requestDraw(); }); }, close: false },
      { label: 'Healer', action: function () { EM.UI.service('T', function () { requestDraw(); }); }, close: false },
      { label: 'Hear a rumour (5 gp)', action: function () {
        if (s.gold < 5) { log('The miller has nothing to say for free.'); return; }
        s.gold -= 5;
        log('Rumour: ' + WM().rumour(EM.rand), 'find');
        requestDraw();
      } },
      { label: 'Leave' }
    ]);
    requestDraw();
  }

  function standingStones() {
    var s = S();
    if (s.flags['holy-stones']) { log('The standing stones hum quietly. The company has already prayed here.'); requestDraw(); return; }
    s.flags['holy-stones'] = true;
    var share = 50;
    var alive = s.party.filter(function (c) { return c.status === 'ok'; });
    if (alive.length) alive.forEach(function (c) { R.awardXp(c, Math.floor(share / alive.length)); });
    log('The company prays among the standing stones, and the stones seem to listen. Each member gains a little experience.', 'find');
    EM.UI.modal('The standing stones', 'Nine grey stones stand in a ring on the hill. Lichen grows in the carved lamps on their faces. The company prays, and each member feels a little steadier.', [{ label: 'Close' }]);
    requestDraw();
  }

  // ---- encounters on the wilds ---------------------------------------------------------
  // An encounter uses the combat engine; afterwards the company returns to the overland screen.
  function fight(kind, n, opts, opening) {
    var s = S(), w = s.wild;
    busy = true;
    log(opening, 'hurt');
    EM.Combat.start({
      party: s.party,
      group: { kind: kind, n: n, x: w.x, y: w.y },
      ambush: false,
      done: function (res) { afterFight(res, opts); }
    });
    return true;
  }

  function afterFight(res, opts) {
    var s = S();
    busy = false;
    EM.Watch.advance(s, 10);
    if (res.gold) { s.gold += res.gold; log('The company gathers ' + res.gold + ' gold.', 'find'); }
    if (res.defeated) {
      s.party.forEach(function (c) { if (c.status === 'unconscious') { c.status = 'ok'; c.hp = 1; } });
      s.gold = Math.floor(s.gold * 0.9);
      log('The company is carried back to Thornwick, bruised and poorer.', 'hurt');
      return leaveToTown();
    }
    if (res.victory && !res.fled && opts && opts.onWin) opts.onWin();
    if (res.fled) log('The company breaks away and gets clear.');
    EM.UI.showScreen('overland');
    requestDraw();
    autoSave();
    if (EM.Game.partyDown()) EM.Game.gameOver();
  }

  // ---- camping on the wilds -------------------------------------------------------
  function camp() {
    if (busy || EM.Game.isBusy()) return;
    var s = S(), w = s.wild;
    var site = WM().site(w.x, w.y);
    s.party.forEach(function (c) {
      if (c.status === 'dead') return;
      if (c.status !== 'ok') { c.status = 'ok'; c.hp = Math.max(1, c.hp); }
      c.hp = c.hpMax;
      R.memorize(c);
    });
    EM.Watch.advance(s, 8 * 60);
    w.fatigue = 0;
    log('The company camps and rests until healed.');
    if (site !== 'C' && EM.rand() < 0.25) {
      // Something finds the camp in the night.
      var pick = WM().pickEncounter(WM().at(w.x, w.y), EM.rand);
      return fight(pick.kind, pick.n, null, 'A noise in the night! ' + pick.n + ' ' + EM.Monsters.name(pick.kind, pick.n).toLowerCase() + ' come for the camp!');
    }
    requestDraw();
    autoSave();
  }

  // ---- input and screen -------------------------------------------------------------
  function init(cv) {
    canvas = cv;
    cv.width = 30 * CELL; cv.height = 18 * CELL;   // the wilds set their own size when drawn
    ctx = cv.getContext('2d');
  }

  function fullMap() {
    var cv = document.createElement('canvas');
    cv.style.width = '100%';
    cv.className = 'bigmap';
    draw(cv, 16);
    EM.UI.modal('The wilds of Thornwick', cv, [{ label: 'Close' }]);
  }

  return {
    init: init, enter: enter, leave: leave, leaveToTown: leaveToTown, step: step, camp: camp,
    requestDraw: requestDraw, fullMap: fullMap, draw: draw, isBusy: function () { return busy; }
  };
})();
