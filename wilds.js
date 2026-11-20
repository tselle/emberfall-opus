/* wilds.js — overland maps. Each adventure has its own wilds: terrain, sites, encounter tables and rumours.
   Terrain: . grass   r road   b bridge   f forest   h hills   w fen   m mountains   ~ river (impassable).
   Sites: T the town gate   M hamlet (rooms, trade, healer, rumours)   S standing stones (holy site)
          K cellar entrance (barred until its commission is taken)   L lair (a fight)   C safe camp.
   Terrain is generated from a named random stream, so every load gives the same wilds.
   EM.Wilds.of(advId) returns the wilds of an adventure; E0's map is built from a hand-placed layout. */
var EM = window.EM = window.EM || {};

EM.Wilds = (function () {
  var SITE_INFO = {
    T: { name: 'Thornwick', kind: 'town' },
    M: { name: 'Millbrook', kind: 'hamlet' },
    S: { name: 'The standing stones', kind: 'holy' },
    K: { name: 'The old brewery', kind: 'cellar' },
    L: { name: 'Wolf lair', kind: 'lair' },
    C: { name: 'Safe camp', kind: 'camp' }
  };

  // Minutes spent crossing each terrain.
  var COST = { '.': 60, 'r': 40, 'b': 40, 'f': 90, 'h': 120, 'w': 120, 'm': 150 };
  var NAMES = { '.': 'grassland', 'r': 'the road', 'b': 'the bridge', 'f': 'forest', 'h': 'hills', 'w': 'fen', 'm': 'mountains', '~': 'the river' };
  var BASE_CHANCE = 8;
  var TERRAIN_CHANCE = { '.': 1, 'r': 0.8, 'b': 0.8, 'f': 1.3, 'h': 1.2, 'w': 1.4, 'm': 1.2 };
  var DEFAULT_TABLES = {
    '.': [{ kind: 'giant-rat', n: [2, 4] }, { kind: 'kobold', n: [2, 3] }, { kind: 'wolf', n: [2, 3] }],
    'r': [{ kind: 'kobold', n: [2, 3] }, { kind: 'goblin', n: [2, 4] }],
    'b': [{ kind: 'giant-rat', n: [2, 3] }, { kind: 'kobold', n: [2, 3] }],
    'f': [{ kind: 'wolf', n: [2, 4] }, { kind: 'goblin', n: [2, 5] }],
    'h': [{ kind: 'hobgoblin', n: [1, 3] }, { kind: 'goblin', n: [3, 5] }],
    'w': [{ kind: 'skeleton', n: [2, 4] }, { kind: 'zombie', n: [1, 2] }],
    'm': [{ kind: 'hell-hound', n: [1, 2] }, { kind: 'bog-troll', n: [1, 1] }]
  };

  var RUMOURS = [
    'The miller swears the mill-wheel turns on its own when the moon is full.',
    'A carter saw lights moving in the standing stones at dusk, and no one was there to light them.',
    'The brewer who built the cellars buried his savings under the barrow, and his ghost still counts them.',
    'Wolves have taken the old lair back, and they hunt the road at night.',
    'Brisk has been asking after a ledger. Half the town thinks it holds his debts; the other half thinks it holds his secrets.',
    'Someone in Millbrook saw goblins carrying lamps down into the brewery. Nobody goes near it now.',
    'The fen is full of old bones, and some of them stand up.',
    'A hound with fire in its belly was seen on the mountain path, and a shepherd lost his flock to it.',
    'The old road beyond the bridge was once a king’s road. Its milestones are still carved with a crown.',
    'A stranger paid for a night’s lodging in coins that have no face on them.'
  ];

  // Builds the wilds object for a map: rows of terrain (with sites already placed), start square and tables.
  function make(spec) {
    var W = spec.W, H = spec.H, ROWS = spec.rows, SITES = spec.sites || {};
    var START = spec.start;
    var TABLES = spec.tables || DEFAULT_TABLES;

    function at(x, y) { return (y < 0 || y >= H || x < 0 || x >= W) ? '~' : ROWS[y].charAt(x); }
    function passable(x, y) { return at(x, y) !== '~'; }
    function site(x, y) { var c = at(x, y); return SITE_INFO[c] ? c : null; }

    function pickEncounter(t, rnd) {
      var table = TABLES[t] || DEFAULT_TABLES['.'];
      var pick = table[Math.floor(rnd() * table.length)];
      var n = pick.n[0] + Math.floor(rnd() * (pick.n[1] - pick.n[0] + 1));
      return { kind: pick.kind, n: n };
    }

    // Encounter for a step onto terrain t, at this time of day. Returns null for no encounter.
    function encounterFor(t, night, rnd) {
      var chance = BASE_CHANCE * (TERRAIN_CHANCE[t] || 1) * (night ? 1.5 : 1);
      if ((rnd() * 100) >= chance) return null;
      return pickEncounter(t, rnd);
    }

    function rumour(rnd) { return (spec.rumours || RUMOURS)[Math.floor(rnd() * (spec.rumours || RUMOURS).length)]; }

    return {
      W: W, H: H, ROWS: ROWS, SITES: SITES, SITE_INFO: SITE_INFO, COST: COST, NAMES: NAMES, START: START,
      lair: spec.lair || null, cellarSite: spec.cellarSite || null, cellarPlace: spec.cellarPlace || null, town: spec.town || 'thornwick',
      at: at, passable: passable, site: site, encounterFor: encounterFor, pickEncounter: pickEncounter,
      rumour: rumour, RUMOURS: spec.rumours || RUMOURS, TABLES: TABLES
    };
  }

  // The wilds of E0: a hand-placed road, a river with one bridge, a hamlet, a barrow-side brewery and a wolf lair.
  function e0Map() {
    var W = 30, H = 18;
    var rnd = EM.Mod.stream('wilds:E0', 1);
    var g = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) {
        var c;
        if (x === 16) c = '~';
        else if (x >= 26 && y <= 5) c = rnd() < 0.7 ? 'm' : 'h';
        else if (x >= 18 && x <= 23 && y >= 10 && y <= 16) c = rnd() < 0.6 ? 'w' : '.';
        else {
          var r = rnd();
          c = r < 0.22 ? 'f' : r < 0.32 ? 'h' : '.';
        }
        row.push(c);
      }
      g.push(row);
    }
    function set(x, y, c) { g[y][x] = c; }
    for (var x1 = 0; x1 < W; x1++) if (g[8][x1] !== '~') set(x1, 8, 'r');
    set(16, 8, 'b');
    for (var y1 = 9; y1 <= 11; y1++) set(8, y1, 'r');
    for (var y2 = 5; y2 <= 7; y2++) set(4, y2, 'r');
    set(0, 8, 'T'); set(8, 12, 'M'); set(22, 3, 'S'); set(4, 4, 'K'); set(25, 13, 'L'); set(11, 14, 'C');
    return {
      W: W, H: H, rows: g.map(function (r) { return r.join(''); }), start: { x: 1, y: 8 },
      sites: { T: 1, M: 1, S: 1, K: 1, L: 1, C: 1 }, lair: { x: 25, y: 13, kind: 'wolf', n: 2 },
      cellarSite: { x: 4, y: 4 }, cellarPlace: 'cellars-1', town: 'thornwick'
    };
  }

  var registry = {};
  function register(advId, spec) { registry[advId] = spec; }

  // Wilds for an adventure. Generated adventures register their own map when they are first made.
  function of(advId) {
    if (!registry[advId]) {
      if (advId === 'E0') registry[advId] = e0Map();
      else if (EM.Gen && EM.Gen.wildsFor) registry[advId] = EM.Gen.wildsFor(advId);
      else return null;
    }
    var spec = registry[advId];
    if (!spec.built) spec.built = make(spec);
    return spec.built;
  }

  return { SITE_INFO: SITE_INFO, COST: COST, NAMES: NAMES, make: make, of: of, register: register, RUMOURS: RUMOURS, DEFAULT_TABLES: DEFAULT_TABLES };
})();
