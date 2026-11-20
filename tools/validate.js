#!/usr/bin/env node
/* Content validator. Loads the real data files into a sandbox and checks them.
   Run: node tools/validate.js   (exit code 1 if any problem is found) */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var sandbox = { window: {}, console: console, Math: Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
['rules.js', 'data.js', 'modules.js', 'monsters.js', 'spells.js', 'treasure.js', 'wilds.js', 'generate.js', 'adventures.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});
var EM = sandbox.EM;
var problems = [];
var notes = [];
function bad(msg) { problems.push(msg); }

var SOLID = { '#': 1, 'T': 1, 'I': 1, 'H': 1, 'S': 1, 'D': 1, 'L': 1, 's': 1, '=': 1, '<': 1, '>': 1 };
var LEGAL = { '#': 1, '.': 1, 's': 1, 'D': 1, 'L': 1, 'd': 1, 'T': 1, 'I': 1, 'H': 1, 'S': 1, '=': 1, '>': 1, '<': 1, 'E': 1 };
// Doors and secret doors count as passable for reachability: they can be opened or found.
var BLOCKS_WALK = { '#': 1, 'T': 1, 'I': 1, 'H': 1, 'S': 1, '=': 1, '<': 1, '>': 1 };
var BUILDINGS = { T: 'temple', I: 'inn', H: 'hall', S: 'shop' };

function grid(place) { return place.rows.map(function (r) { return r.split(''); }); }

function checkPlace(advId, placeId, place) {
  var tag = advId + ':' + placeId;
  var w = place.rows[0].length, h = place.rows.length;
  place.rows.forEach(function (r, y) {
    if (r.length !== w) bad(tag + ' row ' + y + ' has width ' + r.length + ', expected ' + w);
    r.split('').forEach(function (c, x) {
      if (!LEGAL[c]) bad(tag + ' illegal map char "' + c + '" at ' + x + ',' + y);
    });
  });
  var g = grid(place);
  var at = function (x, y) { return (x < 0 || y < 0 || y >= h || x >= w) ? '#' : g[y][x]; };
  var passable = function (x, y) { return !BLOCKS_WALK[at(x, y)]; };

  // Events must sit on event squares.
  Object.keys(place.events || {}).forEach(function (k) {
    var p = k.split(',').map(Number);
    if (at(p[0], p[1]) !== 'E') bad(tag + ' event at ' + k + ' is not on an E square');
    var ev = place.events[k];
    if (ev.item && !EM.Data.item(ev.item)) bad(tag + ' event ' + k + ' gives unknown item ' + ev.item);
  });
  // Every E square needs an event.
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    if (at(x, y) === 'E' && !(place.events || {})[x + ',' + y]) bad(tag + ' E square at ' + x + ',' + y + ' has no event');
  }

  // Stairs and links.
  var stairs = 0;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (at(x, y) === '<' || at(x, y) === '>') stairs++;
  Object.keys(place.links || {}).forEach(function (k) {
    var p = k.split(',').map(Number);
    var c = at(p[0], p[1]);
    if (c !== '<' && c !== '>') bad(tag + ' link at ' + k + ' is not on a stairs square');
    var l = place.links[k];
    var dest = EM.Adventures.ALL[advId].places[l.to];
    if (!dest) { bad(tag + ' link ' + k + ' targets unknown place ' + l.to); return; }
    if (dest.rows[l.y] === undefined || BLOCKS_WALK[dest.rows[l.y][l.x]] || dest.rows[l.y][l.x] === undefined) {
      bad(tag + ' link ' + k + ' arrives on a solid or missing square in ' + l.to);
    }
  });
  if (stairs && Object.keys(place.links || {}).length === 0) notes.push(tag + ' has stairs but no links yet');

  // Reachability: flood from the entry through everything that is not solid.
  var entry = null;
  var start = EM.Adventures.ALL[advId].start;
  if (start.place === placeId) entry = { x: start.x, y: start.y };
  Object.keys(place.links || {}).forEach(function (k) {
    if (place.arrivals) return;
  });
  if (!entry) {
    // Arrivals from other places sit just next to their stairs; treat those squares as entries too.
    Object.keys(EM.Adventures.ALL[advId].places).forEach(function (pid) {
      var other = EM.Adventures.ALL[advId].places[pid];
      Object.keys(other.links || {}).forEach(function (k) {
        var l = other.links[k];
        if (l.to === placeId && !entry) entry = { x: l.x, y: l.y };
      });
    });
  }
  if (!entry) { bad(tag + ' has no entry square'); return; }
  var seen = {}, queue = [entry], dq = 0;
  seen[entry.x + ',' + entry.y] = 1;
  while (dq < queue.length) {
    var cur = queue[dq++];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nx = cur.x + d[0], ny = cur.y + d[1], key = nx + ',' + ny;
      if (seen[key] || !passable(nx, ny)) return;
      seen[key] = 1;
      queue.push({ x: nx, y: ny });
    });
  }
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    var c2 = at(x, y);
    if (!BLOCKS_WALK[c2] && !seen[x + ',' + y]) bad(tag + ' square ' + x + ',' + y + ' is unreachable from the entry');
  }

  // Town rules: buildings and gate.
  if (place.kind === 'town') {
    Object.keys(BUILDINGS).forEach(function (b) {
      var n = 0;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (at(x, y) === b) n++;
      if (n === 0) bad(tag + ' has no ' + BUILDINGS[b]);
    });
  }

  if (place.kind === 'dungeon') {
    var secrets = 0, locked = 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (at(x, y) === 's') {
        secrets++;
        // A secret door must open onto floor on the far side.
        var sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { return passable(x + d[0], y + d[1]); });
        if (sides.length < 2) bad(tag + ' secret door at ' + x + ',' + y + ' does not separate two floor squares');
      }
      if (at(x, y) === 'L') locked++;
    }
    if (secrets < 1 || secrets > 3) bad(tag + ' has ' + secrets + ' secret doors (need 1–3)');
    var traps = place.traps || [];
    if (traps.length < 2 || traps.length > 3) bad(tag + ' has ' + traps.length + ' traps (need 2–3)');
    traps.forEach(function (t) {
      if (!passable(t.x, t.y)) bad(tag + ' trap at ' + t.x + ',' + t.y + ' is not on a floor square');
      if (!EM.Data.TRAPS[t.kind]) bad(tag + ' unknown trap kind ' + t.kind);
    });
    if (locked) {
      // The key may lie on this level or any other level of the same adventure.
      var hasKey = Object.keys(EM.Adventures.ALL[advId].places).some(function (pid) {
        var ev = EM.Adventures.ALL[advId].places[pid].events || {};
        return Object.keys(ev).some(function (k) { var it = EM.Data.item(ev[k].item); return it && it.kind === 'key'; });
      });
      if (!hasKey) bad(tag + ' has locked doors but no key to open them');
    }
    notes.push(tag + ': ' + secrets + ' secret door(s), ' + traps.length + ' trap(s), ' + locked + ' locked door(s)');
  }
}

// ---- run ------------------------------------------------------------------
Object.keys(EM.Adventures.ALL).forEach(function (advId) {
  var adv = EM.Adventures.ALL[advId];
  if (!adv.places[adv.start.place]) bad(advId + ' start place missing');
  Object.keys(adv.places).forEach(function (pid) { checkPlace(advId, pid, adv.places[pid]); });
});

var ITEM_REF = Object.keys(EM.Data.ITEMS);
EM.Data.PREGENS.forEach(function (p) {
  var v = EM.Rules.validate(p.race, p.cls, p.scores, p.align);
  if (v.length) bad('pregen ' + p.name + ': ' + v.join(' '));
  ['weapon', 'armour', 'shield'].forEach(function (slot) {
    if (p[slot] && !EM.Data.item(p[slot])) bad('pregen ' + p.name + ' unknown ' + slot + ' ' + p[slot]);
  });
});
Object.keys(EM.Data.ITEMS).forEach(function (id) {
  var it = EM.Data.ITEMS[id];
  if (it.kind === 'weapon' && !/^\d+d\d+([+-]\d+)?$/.test(it.dmg)) bad('item ' + id + ' has bad damage ' + it.dmg);
});
[1, 3, 6, 11, 16, 20].forEach(function (lvl) {
  EM.Data.shopFor(lvl).forEach(function (id) {
    if (ITEM_REF.indexOf(id) < 0) bad('shop at level ' + lvl + ' stocks unknown item ' + id);
  });
});

// ---- monsters ----------------------------------------------------------------
var MONS = EM.Monsters.MONSTERS;
var DICE = /^\d+d\d+([+-]\d+)?$/;
Object.keys(MONS).forEach(function (k) {
  var m = MONS[k];
  ['name', 'plural', 'hd', 'hp', 'ac', 'dmg', 'move', 'xp', 'gold', 'morale'].forEach(function (f) {
    if (m[f] === undefined) bad('monster ' + k + ' has no ' + f);
  });
  if (!DICE.test(m.hp)) bad('monster ' + k + ' has bad hp dice ' + m.hp);
  m.dmg.split('/').forEach(function (part) { if (!DICE.test(part) && part !== '0') bad('monster ' + k + ' has bad damage dice ' + part); });
  if (m.gold !== '0' && !DICE.test(m.gold)) bad('monster ' + k + ' has bad gold dice ' + m.gold);
  if (m.undead && m.turn === undefined) bad('undead monster ' + k + ' has no turning difficulty');
});

// ---- monster groups on the map -------------------------------------------------
Object.keys(EM.Adventures.ALL).forEach(function (advId) {
  var adv = EM.Adventures.ALL[advId];
  Object.keys(adv.places).forEach(function (pid) {
    var pl = adv.places[pid];
    (pl.groups || []).forEach(function (g) {
      var tag = advId + ':' + pid + ' group ' + g.kind;
      if (!MONS[g.kind]) { bad(tag + ' is an unknown monster'); return; }
      if (!(g.n >= 1 && g.n <= 8)) bad(tag + ' has size ' + g.n + ' (need 1–8)');
      var row = pl.rows[g.y] || '';
      var c = row.charAt(g.x);
      if (c !== '.' && c !== 'E') bad(tag + ' stands on ' + JSON.stringify(c) + ' at ' + g.x + ',' + g.y + ' (need floor)');
      if ((pl.traps || []).some(function (t) { return t.x === g.x && t.y === g.y; })) bad(tag + ' stands on a trap');
      if ((pl.events || {})[g.x + ',' + g.y]) bad(tag + ' stands on an event square');
    });
  });
});

// ---- spells ----------------------------------------------------------------------
Object.keys(EM.Data.SPELLS).forEach(function (k) {
  var sp = EM.Data.SPELLS[k];
  if (['mage', 'cleric'].indexOf(sp.cls) < 0) bad('spell ' + k + ' has bad class');
  var maxC = sp.cls === 'mage' ? 9 : 7;
  if (!(sp.level >= 1 && sp.level <= maxC)) bad('spell ' + k + ' has level ' + sp.level + ' (' + sp.cls + ' circles run to ' + maxC + ')');
  var plainBonus = /^\d+$/.test(sp.dmg || '') && (sp.kind === 'shield' || sp.kind === 'bless');
  if (sp.dmg && !DICE.test(sp.dmg) && !plainBonus) bad('spell ' + k + ' has bad dice ' + sp.dmg);
});
EM.Rules.CLASSES.mage && ['magic-missile', 'sleep'].forEach(function (id) {
  if (!EM.Data.SPELLS[id]) bad('starting spell ' + id + ' missing');
});
Object.keys(EM.Data.ITEMS).forEach(function (id) {
  var it = EM.Data.ITEMS[id];
  if (it.kind === 'spellscroll' && !EM.Data.SPELLS[it.spell]) bad('scroll ' + id + ' teaches unknown spell ' + it.spell);
});

// ---- quests ----------------------------------------------------------------------
var FLAG_SETTERS = {};
Object.keys(EM.Adventures.ALL).forEach(function (advId) {
  var adv = EM.Adventures.ALL[advId];
  var quests = adv.quests || {};
  Object.keys(adv.places).forEach(function (pid) {
    var pl = adv.places[pid];
    (pl.groups || []).forEach(function (g) { if (g.quest) FLAG_SETTERS[g.quest] = true; });
  });
  var evs = [];
  Object.keys(adv.places).forEach(function (pid) {
    var pl = adv.places[pid];
    Object.keys(pl.events || {}).forEach(function (k) { evs.push({ where: pid + ' ' + k, ev: pl.events[k] }); });
  });
  evs.forEach(function (x) {
    [x.ev, x.ev.alt].forEach(function (e) {
      if (!e) return;
      ['accept', 'complete'].forEach(function (f) {
        if (e[f] && !quests[e[f]]) bad(advId + ' ' + x.where + ' ' + f + 's unknown quest ' + e[f]);
      });
      if (e.alt) return;
    });
    if (x.ev.alt) {
      var w = x.ev.alt.when;
      if (w.indexOf('flag:') === 0) FLAG_SETTERS[w.slice(5)] = FLAG_SETTERS[w.slice(5)] || 'needs';
      else if (!EM.Data.item(w)) bad(advId + ' ' + x.where + ' alternative needs unknown item ' + w);
    }
  });
  Object.keys(quests).forEach(function (q) {
    var q2 = quests[q];
    if (!q2.gold && q2.gold !== 0) bad('quest ' + q + ' has no gold reward');
    if (!q2.xp) bad('quest ' + q + ' has no experience reward');
  });
});
Object.keys(FLAG_SETTERS).forEach(function (f) {
  if (FLAG_SETTERS[f] === 'needs') bad('flag ' + f + ' is tested but no group or quest sets it');
});

// ---- the wilds, for every adventure ----------------------------------------------
Object.keys(EM.Adventures.ALL).forEach(function (advId) {
  var W = EM.Wilds.of(advId);
  if (!W) { bad(advId + ' has no wilds'); return; }
  if (W.ROWS.length !== W.H) bad(advId + ' wilds have ' + W.ROWS.length + ' rows, expected ' + W.H);
  W.ROWS.forEach(function (r, y) {
    if (r.length !== W.W) bad(advId + ' wilds row ' + y + ' has width ' + r.length);
    r.split('').forEach(function (c, x) {
      if (!W.COST[c] && c !== '~' && !W.SITE_INFO[c]) bad(advId + ' wilds has illegal square ' + c + ' at ' + x + ',' + y);
    });
  });
  var seen = {}, q = [W.START], dq = 0;
  seen[W.START.x + ',' + W.START.y] = 1;
  while (dq < q.length) {
    var c = q[dq++];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nx = c.x + d[0], ny = c.y + d[1], k = nx + ',' + ny;
      if (seen[k] || !W.passable(nx, ny)) return;
      seen[k] = 1; q.push({ x: nx, y: ny });
    });
  }
  Object.keys(W.SITES).forEach(function (sid) {
    var found = false;
    W.ROWS.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === sid && seen[x + ',' + y]) found = true; });
    if (!found) bad(advId + ' wild site ' + sid + ' cannot be reached from the gate');
  });
  ['.', 'r', 'b', 'f', 'h', 'w', 'm'].forEach(function (t) {
    var rnd = EM.Mod.rng(7);
    for (var i = 0; i < 40; i++) {
      var e = W.pickEncounter(t, rnd);
      if (!EM.Monsters.get(e.kind)) bad(advId + ' wild table for ' + t + ' has unknown monster ' + e.kind);
    }
  });
  if (W.lair && !EM.Monsters.get(W.lair.kind)) bad(advId + ' lair has unknown monster ' + W.lair.kind);
});
EM.Wilds.RUMOURS.length || bad('no rumours');
notes.push('wilds: ' + Object.keys(EM.Adventures.ALL).length + ' adventures checked');

// ---- the content counts the brief asks for ------------------------------------------
var monCount = EM.Monsters.count;
if (monCount < 330) bad('only ' + monCount + ' monsters (brief asks for about 330)');
var spellCount = { mage: 0, cleric: 0 };
Object.keys(EM.Spells.SPELLS).forEach(function (k) { spellCount[EM.Spells.SPELLS[k].cls]++; });
if (spellCount.mage !== 45 || spellCount.cleric !== 30) bad('spell counts are mage ' + spellCount.mage + ', cleric ' + spellCount.cleric + ' (want 45 and 30)');
var itemCount = Object.keys(EM.Data.ITEMS).length;
if (itemCount < 260) bad('only ' + itemCount + ' items');
notes.push('content: ' + monCount + ' monsters, ' + Object.keys(EM.Spells.SPELLS).length + ' spells, ' + itemCount + ' items');

// ---- treasure codes -------------------------------------------------------------------
EM.Monsters.list().forEach(function (k) {
  var t = EM.Monsters.get(k).treasure;
  if (t && !EM.Treasure.TYPES[t]) bad('monster ' + k + ' has unknown treasure type ' + t);
});

notes.forEach(function (n) { console.log('  note  ' + n); });
if (problems.length) {
  problems.forEach(function (p) { console.log('  FAIL  ' + p); });
  console.log(problems.length + ' problem(s) found.');
  process.exit(1);
}
console.log('All content checks passed.');
