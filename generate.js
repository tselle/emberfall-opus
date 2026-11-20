/* generate.js — deterministic adventure generator. Every adventure is built from a named random stream (EM.Mod.stream),
   so it is identical on every load, and a feature added later uses its own stream name and never shifts existing content.
   Dungeon levels: rooms joined by corridors in a chain with some extra loops. Corridor doors may be secret (hiding a leaf
   room with a treasure cache). The last level holds a locked door and its key, and the final enemy. Every level has
   2–3 floor traps and 1–3 secret doors, and a validator checks that everything is reachable (see tools/validate.js). */
var EM = window.EM = window.EM || {};

EM.Gen = (function () {
  var SIZES = {
    small:  { w: 24, h: 17, rooms: 6,  levels: 2 },
    medium: { w: 30, h: 21, rooms: 9,  levels: 3 },
    large:  { w: 36, h: 25, rooms: 12, levels: 4 },
    huge:   { w: 42, h: 29, rooms: 15, levels: 5 }
  };

  // Bands: 10 generated adventures per band (4 small, 3 medium, 2 large, 1 huge).
  var BANDS = [[1, 4], [5, 8], [9, 12], [13, 16], [17, 20]];
  var BAND_PLAN = ['small', 'small', 'small', 'small', 'medium', 'medium', 'medium', 'large', 'large', 'huge'];

  var TOWN_NAMES = ['Ashford', 'Brackmere', 'Coldharbour', 'Dunmere', 'Eastwold', 'Fallowby', 'Greyhythe', 'Hollin', 'Ironwick', 'Kestle',
    'Lowmoor', 'Marrowdale', 'Northcombe', 'Oakhollow', 'Pellham', 'Quarrymouth', 'Ravenscar', 'Stonebridge', 'Thistlecote', 'Upmarsh'];
  var DUNGEON_NAMES = ['Undercroft', 'Sunken Vaults', 'Ossuary', 'Crypt', 'Old Workings', 'Drowned Halls', 'Mine of the Lost', 'Hollow Keep',
    'Warrens', 'Cistern', 'Sepulchre', 'Gallery', 'Lightless Stair', 'Bone Galleries', 'Iron Gate Cellars', 'Mirrored Halls'];
  var BOSS_TITLES = ['the Hollow Warden', 'the Pale Mother', 'the Old Miser', 'the Thorn Tyrant', 'the Grave Lantern', 'the Breaker of Stairs',
    'the Silent Choir', 'the Mould King', 'the Ash Priest', 'the Shrike', 'the Drowned Lord', 'the Hungering Abbot'];

  function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }
  function key(x, y) { return x + ',' + y; }

  // ---- candidate monsters for a depth -------------------------------------------------
  function candidates(depth, rnd, boss) {
    var all = EM.Monsters.list().filter(function (k) {
      var d = EM.Monsters.get(k);
      return (d.habitat.indexOf('c') >= 0 || d.habitat.indexOf('r') >= 0 || d.habitat.indexOf('x') >= 0);
    });
    if (boss) {
      var big = all.filter(function (k) { var d = EM.Monsters.get(k); return d.hd >= Math.max(3, depth - 1) && d.hd <= depth + 6 && !d.breath; });
      return big.length ? big : all;
    }
    var lo = Math.max(1, Math.floor(depth / 2) - 1), hi = depth + 2;
    var ok = all.filter(function (k) { var d = EM.Monsters.get(k); return d.hd >= lo && d.hd <= hi; });
    return ok.length ? ok : all;
  }

  // ---- one dungeon level --------------------------------------------------------------
  // Returns {rows, up, down, arrival, groups, traps, events, locked, keyEvent, secrets, rooms} or null if the layout fails.
  function level(stream, size, depth, last, opts) {
    var rnd = stream;
    var W = size.w, H = size.h;
    var g = [];
    for (var y = 0; y < H; y++) g.push(new Array(W).fill('#'));
    var rooms = [];
    var tries = 0;
    while (rooms.length < size.rooms && tries++ < 600) {
      var rw = 3 + Math.floor(rnd() * 4), rh = 3 + Math.floor(rnd() * 3);
      var rx = 1 + Math.floor(rnd() * (W - rw - 2)), ry = 1 + Math.floor(rnd() * (H - rh - 2));
      var ok = rooms.every(function (r) {
        return rx + rw + 1 < r.x || r.x + r.w + 1 < rx || ry + rh + 1 < r.y || r.y + r.h + 1 < ry;
      });
      if (ok) rooms.push({ x: rx, y: ry, w: rw, h: rh, id: rooms.length });
    }
    if (rooms.length < 4) return null;
    rooms.sort(function (a, b) { return a.x - b.x; });
    rooms.forEach(function (r, i) { r.id = i; });
    rooms.forEach(function (r) { for (var yy = r.y; yy < r.y + r.h; yy++) for (var xx = r.x; xx < r.x + r.w; xx++) g[yy][xx] = '.'; });

    // Edges: a chain left to right, plus a few extra links between neighbours.
    var edges = [];
    function has(a, b) { return edges.some(function (e) { return (e.a === a && e.b === b) || (e.a === b && e.b === a); }); }
    for (var i = 0; i + 1 < rooms.length; i++) edges.push({ a: i, b: i + 1 });
    for (var j = 0; j < rooms.length; j++) {
      var k = j + 2;
      if (k < rooms.length && rnd() < 0.35 && !has(j, k)) edges.push({ a: j, b: k });
    }

    // Carve each edge as an L-shaped corridor. Record the corridor square just outside room a: that is the door.
    function center(r) { return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }; }
    function inRoom(r, x, y) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }
    var corridorCells = {};
    edges.forEach(function (e) {
      var ra = rooms[e.a], rb = rooms[e.b];
      var ca = center(ra), cb = center(rb);
      var path = [];
      var x = ca.x, yy2 = ca.y;
      while (x !== cb.x) { x += x < cb.x ? 1 : -1; path.push([x, yy2]); }
      while (yy2 !== cb.y) { yy2 += yy2 < cb.y ? 1 : -1; path.push([x, yy2]); }
      var doorA = null, doorB = null;
      // the first corridor square that leaves room a, and the last that enters room b
      var startPath = [[ca.x, ca.y]].concat(path);
      for (var q = 0; q < startPath.length; q++) {
        var px = startPath[q][0], py = startPath[q][1];
        if (!inRoom(ra, px, py)) { doorA = [px, py]; break; }
      }
      for (var z = startPath.length - 1; z >= 0; z--) {
        var qx = startPath[z][0], qy = startPath[z][1];
        if (!inRoom(rb, qx, qy)) { doorB = [qx, qy]; break; }
      }
      path.forEach(function (c) {
        if (!inRoom(ra, c[0], c[1]) && !inRoom(rb, c[0], c[1])) {
          g[c[1]][c[0]] = '.';
          corridorCells[key(c[0], c[1])] = 1;
        } else if (g[c[1]][c[0]] === '#') {
          g[c[1]][c[0]] = '.';
        }
      });
      e.doorA = doorA; e.doorB = doorB;
    });

    // Degree of each room.
    var deg = rooms.map(function () { return 0; });
    edges.forEach(function (e) { deg[e.a]++; deg[e.b]++; });
    var first = rooms[0], lastRoom = rooms[rooms.length - 1];

    // Up stairs in the first room's corner, with the arrival square beside them.
    g[first.y][first.x] = '<';
    var up = { x: first.x, y: first.y };
    var arrival = { x: first.x + 1, y: first.y };
    if (g[arrival.y][arrival.x] !== '.') return null;

    // Down stairs (if not the last level) in the last room's far corner.
    var down = null;
    if (!last) {
      down = { x: lastRoom.x + lastRoom.w - 1, y: lastRoom.y + lastRoom.h - 1 };
      g[down.y][down.x] = '>';
    }

    // Secret doors: each one is set in a room wall and opens onto a one-square alcove that holds a treasure cache.
    var secrets = [];
    var alcoves = [];
    var want = 1 + Math.floor(rnd() * 3);
    for (var sx = 0; sx < 40 && secrets.length < want; sx++) {
      var sr = rooms[1 + Math.floor(rnd() * Math.max(1, rooms.length - 2))];
      if (!sr || rooms.length < 3) break;
      var topSide = rnd() < 0.5;
      var dx0 = sr.x + Math.floor(rnd() * sr.w);
      var dy0 = topSide ? sr.y - 1 : sr.y + sr.h;
      var ay0 = topSide ? sr.y - 2 : sr.y + sr.h + 1;
      if (ay0 < 1 || ay0 > H - 2 || dy0 < 1 || dy0 > H - 2) continue;
      if (g[dy0][dx0] !== '#' || g[ay0][dx0] !== '#') continue;
      var clear = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(function (d) {
        var nx = dx0 + d[0], ny = ay0 + d[1];
        if (nx === dx0 && ny === dy0) return true;
        return g[ny][nx] === '#';
      });
      if (!clear) continue;
      g[dy0][dx0] = 's';
      g[ay0][dx0] = '.';
      secrets.push({ x: dx0, y: dy0 });
      alcoves.push({ x: dx0, y: ay0 });
    }
    if (!secrets.length) return null;

    // Locked door on the last level: the door of the edge into the last room (not a secret one).
    var locked = null;
    if (last && opts.boss) {
      var lastEdge = edges.filter(function (e) { return (e.a === rooms.length - 2 && e.b === rooms.length - 1) || (e.b === rooms.length - 2 && e.a === rooms.length - 1); })[0];
      var ldoor = lastEdge && (lastEdge.a === rooms.length - 1 ? lastEdge.doorA : lastEdge.doorB);
      if (ldoor && g[ldoor[1]][ldoor[0]] === '.') {
        g[ldoor[1]][ldoor[0]] = 'L';
        locked = { x: ldoor[0], y: ldoor[1] };
      }
    }

    // Reachability from the arrival, with locked and secret doors passable (they are ways through, not walls).
    function reach(blockL) {
      var seen = {}, q2 = [arrival], dq = 0;
      seen[key(arrival.x, arrival.y)] = 1;
      while (dq < q2.length) {
        var c = q2[dq++];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = c.x + d[0], ny = c.y + d[1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
          var ch = g[ny][nx];
          if (ch === '#' || ch === '<' || ch === '>') return;
          if (blockL && ch === 'L') return;
          if (seen[key(nx, ny)]) return;
          seen[key(nx, ny)] = 1;
          q2.push({ x: nx, y: ny });
        });
      }
      return seen;
    }

    // The key lies in the farthest room that can be reached without the locked door.
    var keyEvent = null;
    if (locked) {
      var reachable = reach(true);
      var roomsReach = rooms.filter(function (r, i) {
        return i !== rooms.length - 1 && reachable[key(center(r).x, center(r).y)];
      });
      var keyRoom = roomsReach[roomsReach.length - 1] || rooms[0];
      var kc = center(keyRoom);
      keyEvent = { x: kc.x, y: kc.y };
      if (g[kc.y][kc.x] !== '.') return null;
    }

    // Floor squares that are free for events, groups and traps.
    var free = [];
    for (var yq = 1; yq < H - 1; yq++) for (var xq = 1; xq < W - 1; xq++) {
      if (g[yq][xq] === '.' && !corridorCells[key(xq, yq)]) free.push({ x: xq, y: yq, room: rooms.findIndex(function (r) { return inRoom(r, xq, yq); }) });
    }
    function takeFree(pred) {
      var cands = free.filter(pred);
      if (!cands.length) return null;
      var c = cands[Math.floor(rnd() * cands.length)];
      free.splice(free.indexOf(c), 1);
      return c;
    }

    // Treasure caches: in the leaf rooms behind the secret doors, and in some other rooms.
    var events = {};
    var canItem = ['potion', 'scroll', 'gem', 'jewel', 'magic'];
    function treasure(c, rich) {
      var gold = Math.round((depth * 20 + Math.floor(rnd() * 60)) * (rich ? 3 : 1));
      var ev = { title: rich ? 'A hidden cache' : 'Forgotten coins', text: rich ? 'Behind the hidden door lies a cache, wrapped in oilcloth.' : 'A few coins lie in a broken crate.', gold: gold, once: true };
      if (rnd() < (rich ? 0.6 : 0.2)) {
        var ids = Object.keys(EM.Data.ITEMS).filter(function (id) {
          var it = EM.Data.ITEMS[id];
          return canItem.indexOf(it.kind) >= 0 && it.value > 0 && it.value <= depth * 350 + 200;
        });
        if (ids.length) ev.item = pick(ids, rnd);
      }
      events[key(c.x, c.y)] = ev;
      g[c.y][c.x] = 'E';
    }
    alcoves.forEach(function (c) { treasure(c, true); });
    var extra = 2 + Math.floor(rnd() * 3);
    for (var t = 0; t < extra; t++) {
      var tc = takeFree(function () { return rnd() < 0.5; });
      if (tc) treasure(tc, false);
    }
    if (keyEvent) {
      var kx = keyEvent.x, ky = keyEvent.y;
      events[key(kx, ky)] = { title: 'Key of the lower door', text: 'A heavy iron key lies in the dust, its bow worn smooth by a hand that carried it.', item: opts.keyId, once: true };
      g[ky][kx] = 'E';
      free = free.filter(function (f) { return !(f.x === kx && f.y === ky); });
    }

    // Traps: two or three on floor squares in corridors (never next to stairs or in a room with the boss).
    var trapCount = 2 + Math.floor(rnd() * 2);
    var traps = [];
    var kinds = depth >= 4 ? ['pit', 'darts', 'blade', 'spear', 'block', 'fire', 'gas'] : ['pit', 'darts', 'blade', 'spear'];
    for (var tr = 0; tr < trapCount; tr++) {
      var tcell = takeFree(function (f) { return f.room < 0 || (f.room !== rooms.length - 1 && !(events[key(f.x, f.y)])); });
      if (!tcell) break;
      traps.push({ x: tcell.x, y: tcell.y, kind: pick(kinds, rnd) });
    }

    // Groups of monsters in rooms (not the first room, the last room, or on events and traps).
    var groups = [];
    var pool = candidates(depth, rnd, false);
    rooms.forEach(function (r, ri) {
      if (ri === 0 || ri === rooms.length - 1) return;
      if (rnd() < 0.5) return;
      var c = takeFree(function (f) { return f.room === ri; });
      if (!c) return;
      var kind = pick(pool, rnd);
      var n = 1 + Math.floor(rnd() * 3);
      groups.push({ kind: kind, n: n, x: c.x, y: c.y, state: rnd() < 0.6 ? 'sleep' : 'awake' });
    });
    if (opts.boss && last) {
      var bc = takeFree(function (f) { return f.room === rooms.length - 1; });
      if (bc) {
        var bossKind = opts.bossKind || pick(candidates(depth, rnd, true), rnd);
        groups.push({ kind: bossKind, n: 1, x: bc.x, y: bc.y, state: 'sleep', quest: opts.bossFlag });
        if (rnd() < 0.7) {
          var mc = takeFree(function (f) { return f.room === rooms.length - 1; });
          if (mc) groups.push({ kind: pick(pool, rnd), n: 2, x: mc.x, y: mc.y, state: 'sleep' });
        }
      }
    }

    var rows = g.map(function (r) { return r.join(''); });
    var downArrival = down ? { x: down.x - 1, y: down.y } : null;
    return { rows: rows, up: up, arrival: arrival, down: down, downArrival: downArrival, groups: groups, traps: traps, events: events, locked: locked, secrets: secrets.length, rooms: rooms.length };
  }

  // Validates a level like tools/validate.js does: entry reachable, every floor square reachable, secret count, trap count.
  function validLevel(lv) {
    var rows = lv.rows, H = rows.length, W = rows[0].length;
    var at = function (x, y) { return (y < 0 || y >= H || x < 0 || x >= W) ? '#' : rows[y].charAt(x); };
    var seen = {}, q = [lv.arrival], dq = 0;
    seen[key(lv.arrival.x, lv.arrival.y)] = 1;
    while (dq < q.length) {
      var c = q[dq++];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = c.x + d[0], ny = c.y + d[1];
        var ch = at(nx, ny);
        if ('#<>'.indexOf(ch) >= 0 || ch === '' ) return;
        if (seen[key(nx, ny)]) return;
        seen[key(nx, ny)] = 1;
        q.push({ x: nx, y: ny });
      });
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var ch = at(x, y);
      if (ch !== '#' && ch !== '<' && ch !== '>' && !seen[key(x, y)]) return 'square ' + x + ',' + y + ' unreachable';
    }
    var secrets = 0;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (at(x, y) === 's') secrets++;
    if (secrets < 1 || secrets > 3) return 'secret count ' + secrets;
    if (lv.traps.length < 2 || lv.traps.length > 3) return 'trap count ' + lv.traps.length;
    return null;
  }

  function town(id, name, quests, rnd) {
    var rows = [
      '######################',
      '#....................#',
      '#..TT...#.....II.....#',
      '#..TT...#.....II.....#',
      '#........E...........#',
      '#....................#',
      '#....................#',
      '=.........>..........#',
      '#...............E....#',
      '#..HH.....#.....SS...#',
      '#..HH.....#.....SS...#',
      '#....................#',
      '#....................#',
      '######################'
    ];
    rows[3] = '#..TTE..#.....II.....#';
    rows[8] = '#..............E.....#';
    return {
      name: name, kind: 'town',
      legend: { T: 'Temple', I: 'Inn', H: 'Training hall', S: 'Shop' },
      rows: rows, links: {}, traps: [],
      events: {
        '9,4': { title: 'The reeve of ' + name, text: 'The reeve of ' + name + ' looks up from the ledger. “Something has taken root beneath the town. Go down, find what sleeps there, and end it.”', accept: 'main', once: true,
          alt: { when: 'flag:' + quests.main.flag, complete: 'main', once: true, title: 'The reeve of ' + name, text: 'The reeve counts out the coin. “The town sleeps safer tonight.”' } },
        '5,3': { title: 'The sexton', text: 'The sexton of the temple is a tired old man who knows every stone under the town. “Mind the stair; it has teeth.”', once: true }
      }
    };
  }

  // Makes a whole adventure from a plan: size, depth range, names and quests.
  function build(advId, plan) {
    var stream = EM.Mod.stream('adv:' + advId, 7);
    var size = SIZES[plan.size];
    var places = {};
    var townId = advId + '-town';
    EM.Data.ITEMS[plan.keyId] = { name: 'Key of ' + plan.dungeonName, kind: 'key', value: 0, keyFor: advId, classes: null };
    var quests = {
      main: { title: plan.questTitle, giver: 'The reeve of ' + plan.townName, gold: plan.gold, xp: plan.xp,
        text: plan.questText, flag: plan.bossFlag }
    };
    places[townId] = town(townId, plan.townName, { main: { flag: plan.bossFlag } }, stream);
    places[townId].events['15,8'] = { title: 'The innkeeper', once: false,
      text: 'The innkeeper leans across the bar. \u201C' + EM.Wilds.RUMOURS[Math.floor(stream() * EM.Wilds.RUMOURS.length)] + '\u201D' };
    // prevDown: where the previous place's stairs down are; prevExit: the square beside them, where the company arrives
    // when it climbs back up. The town's stairs are at 10,7 and the company arrives at 10,8.
    var prevId = townId, prevDown = { x: 10, y: 7 }, prevExit = { x: 10, y: 8 };
    var cellar = null;
    var levelIds = [];
    for (var d = 1; d <= size.levels; d++) {
      var depth = plan.minLevel + d - 1;
      var last = d === size.levels;
      var lid = advId + '-d' + d;
      levelIds.push(lid);
      var lv = null, attempt = 0;
      while (!lv && attempt++ < 40) {
        var s2 = EM.Mod.stream('adv:' + advId + ':level' + d + ':' + attempt, 11);
        var cand = level(s2, size, depth, last, { boss: last, bossFlag: plan.bossFlag, keyId: plan.keyId, bossKind: plan.bossKind });
        if (cand && !validLevel(cand)) lv = cand;
      }
      if (!lv) throw new Error('could not generate level ' + lid);
      places[lid] = {
        name: plan.dungeonName + (size.levels > 1 ? ', level ' + d : ''),
        kind: 'dungeon', depth: depth, legend: {},
        rows: lv.rows,
        links: {},
        groups: lv.groups,
        traps: lv.traps,
        events: lv.events
      };
      // The up stairs of this level lead back to the previous place's exit square.
      places[lid].links[lv.up.x + ',' + lv.up.y] = { to: prevId, x: prevExit.x, y: prevExit.y, dir: 1 };
      // The previous place's stairs down lead to this level's arrival square.
      places[prevId].links[prevDown.x + ',' + prevDown.y] = { to: lid, x: lv.arrival.x, y: lv.arrival.y, dir: 1 };
      if (prevId === townId) cellar = { place: lid, x: lv.arrival.x, y: lv.arrival.y, dir: 1 };
      prevId = lid;
      prevDown = lv.down;
      prevExit = lv.downArrival;
    }
    return { id: advId, name: plan.name, levels: plan.levelRange, start: { place: townId, x: 10, y: 11, dir: 0 }, quests: quests,
      places: places, cellar: cellar, size: plan.size, minLevel: plan.minLevel, maxLevel: plan.maxLevel };
  }

  // Plan for a generated adventure: band, size, names. Deterministic by index.
  function plan(bandIndex, index) {
    var band = BANDS[bandIndex];
    var size = BAND_PLAN[index];
    var id = 'G' + (bandIndex + 1) + '-' + (index + 1);
    var rnd = EM.Mod.stream('plan:' + id, 3);
    var minLevel = band[0] + Math.floor(rnd() * 2);
    var maxLevel = band[1];
    var townName = pick(TOWN_NAMES, rnd);
    var dungeonName = pick(DUNGEON_NAMES, rnd);
    var boss = pick(BOSS_TITLES, rnd);
    var mid = (minLevel + maxLevel) / 2;
    var bossFlag = 'slain:' + id;
    return {
      bossKind: null,
      id: id, size: size, minLevel: minLevel, maxLevel: maxLevel,
      levelRange: minLevel + '–' + maxLevel,
      name: dungeonName + ' of ' + townName,
      townName: townName, dungeonName: dungeonName,
      questTitle: 'The terror of ' + dungeonName + ' (' + boss + ')',
      questText: 'Go down into the ' + dungeonName.toLowerCase() + ' beneath ' + townName + ' and destroy ' + boss + '.',
      gold: Math.round(mid * 150 + SIZES[size].rooms * 40),
      xp: Math.round(mid * 1200 + SIZES[size].rooms * 200),
      bossFlag: bossFlag,
      keyId: 'key:' + id
    };
  }

  // Wilds for a generated adventure: a seeded map with a road from the gate, a hamlet, a holy site, a lair, and a
  // cellar entrance (K) that leads to the first level.
  function wildsFor(advId) {
    var stream = EM.Mod.stream('wilds:' + advId, 5);
    var W = 30, H = 18;
    var g = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) {
        var r = stream();
        row.push(r < 0.2 ? 'f' : r < 0.3 ? 'h' : r < 0.36 ? 'w' : '.');
      }
      g.push(row);
    }
    var riverX = 12 + Math.floor(stream() * 8);
    for (var yr = 0; yr < H; yr++) g[yr][riverX] = '~';
    var by = 3 + Math.floor(stream() * 12);
    g[by][riverX] = 'b';
    for (var xr = 0; xr < W; xr++) if (g[8][xr] !== '~') g[8][xr] = 'r';
    g[8][riverX] = 'b';
    g[8][0] = 'T';
    var placed = {};
    function place(site) {
      for (var tries = 0; tries < 200; tries++) {
        var px = 2 + Math.floor(stream() * (W - 4)), py = 1 + Math.floor(stream() * (H - 2));
        if (g[py][px] === '~' || g[py][px] === 'r' || g[py][px] === 'b' || placed[px + ',' + py]) continue;
        var east = px > riverX;
        if (site === 'K' && east) continue;
        g[py][px] = site; placed[px + ',' + py] = 1;
        return { x: px, y: py };
      }
      return null;
    }
    var M = place('M'), S2 = place('S'), L = place('L'), C = place('C'), K = place('K');
    var rows = g.map(function (r) { return r.join(''); });
    var sites = { T: 1 };
    if (M) sites.M = 1;
    if (S2) sites.S = 1;
    if (L) sites.L = 1;
    if (C) sites.C = 1;
    if (K) sites.K = 1;
    return {
      W: W, H: H, rows: rows, start: { x: 1, y: 8 }, sites: sites,
      lair: L ? { x: L.x, y: L.y, kind: pick(['wolf', 'hill-giant', 'bog-troll', 'ogre', 'hobgoblin'], stream), n: 2 } : null,
      cellarSite: K, cellarPlace: advId + '-d1', town: advId + '-town'
    };
  }

  // The generated adventure for an id like 'G3-7'. Cached.
  var cache = {};
  function adventure(id) {
    if (cache[id]) return cache[id];
    var m = /^G(\d)-(\d+)$/.exec(id);
    if (!m) return null;
    var p = plan(parseInt(m[1], 10) - 1, parseInt(m[2], 10) - 1);
    var adv = build(id, p);
    cache[id] = adv;
    return adv;
  }

  // Ids of all generated adventures, in order.
  function ids() {
    var out = [];
    for (var b = 0; b < BANDS.length; b++) for (var i = 0; i < BAND_PLAN.length; i++) out.push('G' + (b + 1) + '-' + (i + 1));
    return out;
  }

  return { SIZES: SIZES, BANDS: BANDS, BAND_PLAN: BAND_PLAN, level: level, validLevel: validLevel, build: build, plan: plan,
    adventure: adventure, ids: ids, wildsFor: wildsFor, candidates: candidates, town: town };
})();
