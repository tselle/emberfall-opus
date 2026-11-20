/* adventures.js — hand-written content. E0 "The Cellars of Thornwick": a home town, the wilds around it, and two cellar levels.
   Map legend:
     #  wall (brick in towns, stone underground)   .  floor          s  secret door (looks like wall)
     D  closed door   L  locked door   d  open door (set at runtime)
     T  temple   I  inn   H  training hall   S  shop   (solid; walk into them to use)
     =  town gate (walk into it to leave for the wilds)   >  stairs down   <  stairs up   E  event square (floor)
   Stairs are solid in the 3D view: walk into them to use them. Links map a stairs square to its destination
   {to, x, y, dir}. Traps are listed separately. Groups are monsters on the map; `quest` names a flag set when
   the group is destroyed. Events may `accept` or `complete` a quest (see journal.js). */
var EM = window.EM = window.EM || {};

EM.Adventures = (function () {
  // Builds rows from a list of rectangle fills and single squares, so geometry stays explicit.
  function carve(w, h, ops) {
    var g = [];
    for (var y = 0; y < h; y++) g.push(new Array(w + 1).join('#').split(''));
    ops.forEach(function (op) {
      if (op[0] === 'fill') {
        for (var y1 = op[2]; y1 <= op[4]; y1++) for (var x1 = op[1]; x1 <= op[3]; x1++) g[y1][x1] = op[5];
      } else if (op[0] === 'pt') {
        g[op[2]][op[1]] = op[3];
      }
    });
    return g.map(function (r) { return r.join(''); });
  }

  function withEvents(ops, events) {
    return ops.concat(Object.keys(events).map(function (k) {
      var p = k.split(',').map(Number);
      return ['pt', p[0], p[1], 'E'];
    }));
  }

  var CELLARS_OPS = [
    ['fill', 1, 1, 4, 7, '.'],        // room A: arrival room
    ['fill', 6, 1, 14, 4, '.'],       // room B: brewing hall
    ['fill', 16, 1, 22, 7, '.'],      // room C: the brewer's vault
    ['fill', 1, 10, 13, 15, '.'],     // room D: south hall
    ['fill', 17, 10, 22, 15, '.'],    // room E: south-east cellar
    ['fill', 2, 8, 2, 9, '.'],        // corridor A to D
    ['fill', 20, 8, 20, 9, '.'],      // corridor from the vault down to E
    ['fill', 10, 5, 10, 9, '.'],      // corridor B to D
    ['fill', 6, 6, 7, 6, '.'],        // secret alcove 1 (behind a secret door)
    ['fill', 15, 12, 15, 12, '.'],    // secret alcove 2
    ['pt', 5, 2, 'D'],                // door between A and B
    ['pt', 15, 4, 'L'],               // locked door into the vault
    ['pt', 5, 6, 's'],                // secret door into alcove 1
    ['pt', 16, 12, 's'],              // secret door into alcove 2
    ['pt', 1, 1, '<'],                // stairs up to Thornwick
    ['pt', 1, 15, '>']                // stairs down to the second level
  ];

  var CELLARS_EVENTS = {
    '3,5':   { title: 'Burnt-out lamp', text: 'A dead lantern lies on the flagstones beside a few copper coins.', gold: 25, once: true },
    '6,6':   { title: 'Iron key', text: "Among bones in the alcove, a heavy iron key hangs from a hook. It bears the reeve's seal.", item: 'iron-key', gold: 10, once: true },
    '15,12': { title: 'Hidden niche', text: 'A niche holds a leather pouch of old gold, tied shut with wire.', gold: 60, once: true },
    '19,2':  { title: 'Vault of the brewer', text: 'Behind the rusted grille lies a silver brooch no goblin could have carried this far.', item: 'silver-brooch', once: true },
    '21,6':  { title: 'Gilded casks', text: 'The casks are empty, but a garnet ring has been pressed into the wax of one.', item: 'garnet-ring', once: true },
    '7,12':  { title: 'Ransacked chest', text: 'The chest is empty save for a few coins and a scroll of cure light wounds.', gold: 40, item: 'scroll-light', once: true },
    '2,13':  { title: 'Goblin bedroll', text: 'Filthy blankets, a snapped spear and a pouch with a turquoise in it.', item: 'turquoise', gold: 10, once: true },
    '21,14': { title: 'Old offering', text: 'A shrine niche carved with a lamp and a broken chain holds a few coins.', gold: 30, once: true }
  };

  var CELLARS2_OPS = [
    ['fill', 1, 1, 5, 5, '.'],        // room A: arrival from the level above
    ['fill', 7, 3, 7, 3, '.'],        // passage from A to the shrine hall
    ['fill', 8, 1, 16, 6, '.'],       // room C: the shrine hall
    ['fill', 18, 1, 22, 6, '.'],      // room F: the wight's barrow
    ['fill', 1, 10, 5, 15, '.'],      // room B: ghoul gallery
    ['fill', 3, 6, 3, 9, '.'],        // corridor A to B
    ['fill', 13, 7, 13, 9, '.'],      // corridor C to E
    ['fill', 12, 10, 22, 15, '.'],    // room E: the crypt
    ['fill', 7, 12, 9, 12, '.'],      // secret alcove 1 (tithe box)
    ['fill', 17, 7, 17, 8, '.'],      // secret alcove 2 (ledger niche)
    ['pt', 6, 3, 'D'],                // door between A and the shrine passage
    ['pt', 17, 3, 'L'],               // locked door into the barrow (needs the iron key)
    ['pt', 6, 12, 's'],               // secret door into alcove 1
    ['pt', 17, 9, 's'],               // secret door into alcove 2
    ['pt', 1, 1, '<']                 // stairs up
  ];

  var CELLARS2_EVENTS = {
    '3,2':   { title: 'Mason’s tools', text: 'A rusted set of masons’ tools lies stacked by the wall.', gold: 20, once: true },
    '14,2':  { title: 'Shrine of the lamp', text: 'A small shrine of the Dawn Lamp stands cold and clean. The company kneels, and feels a little lighter for it.', holy: 60, once: true },
    '7,12':  { title: 'Tithe box', text: 'A tithe box, its lock broken, holds a little silver and a worn coin.', gold: 80, once: true },
    '17,7':  { title: 'Brisk’s ledger', text: 'A water-stained ledger, with Brisk’s name on the spine, is tucked behind a loose stone.', item: 'brisk-ledger', once: true },
    '21,5':  { title: 'The wight’s coffer', text: 'Beneath the barrow’s stone lid lie coins and a gem-set cup, all black with age.', gold: 200, once: true },
    '15,14': { title: 'Crypt crates', text: 'Crates of grave goods; a few coins are still in the linen.', gold: 50, item: 'scroll-light', once: true }
  };

  var E0 = {
    id: 'E0',
    name: 'The Cellars of Thornwick',
    levels: '1–2',
    start: { place: 'thornwick', x: 10, y: 11, dir: 0 },
    quests: {
      main: {
        title: 'The Brewer’s Wight', giver: 'Reeve Hollis Dane', gold: 600, xp: 2400,
        text: 'Destroy the wight that haunts the brewer’s barrow below the cellars, and bring the reeve word of it.'
      },
      rats: {
        title: 'Rats of the mill', giver: 'Brother Cale', gold: 60, xp: 400,
        text: 'Clear the giant rats from the cellar hall, to give the millers some peace.'
      },
      ledger: {
        title: 'Brisk’s ledger', giver: 'Brisk the shopkeeper', gold: 80, xp: 200,
        text: 'Find Brisk’s ledger, which fell into the cellars, and return it to his shop.'
      }
    },
    places: {
      thornwick: {
        name: 'Thornwick',
        kind: 'town',
        legend: { T: 'Temple of the Dawn Lamp', I: 'The Sleeping Stag inn', H: 'Training hall', S: "Brisk's general store" },
        rows: [
          '######################',
          '#....................#',
          '#..TT...#.....II.....#',
          '#..TTE..#.....II.....#',
          '#........E...........#',
          '#....................#',
          '#....................#',
          '=.........>..........#',
          '#..............E.....#',
          '#..HH.....#.....SS...#',
          '#..HH.....#.....SS...#',
          '#....................#',
          '#....................#',
          '######################'
        ],
        links: {
          '10,7': { to: 'cellars-1', x: 2, y: 1, dir: 1 }
        },
        traps: [],
        events: {
          '9,4': {
            title: 'Reeve Hollis Dane',
            text: "The reeve looks up from a ledger. 'Something stirs in the brewer’s barrow below the cellars, and the goblins have grown bold. Destroy whatever is down there and I will pay you well.'",
            accept: 'main', once: true,
            alt: {
              when: 'flag:wight-slain', complete: 'main', once: true,
              title: 'Reeve Hollis Dane',
              text: "The reeve sets down his pen. 'The barrow is quiet at last. The county owes you a great deal.'"
            }
          },
          '5,3': {
            title: 'Brother Cale',
            text: "A young priest sweeps the temple steps. 'The rats have taken over the mill cellars. If you can clear them out, I will see you rewarded.'",
            accept: 'rats', once: true,
            alt: {
              when: 'flag:rats-slain', complete: 'rats', once: true,
              title: 'Brother Cale',
              text: "Brother Cale blesses your hands. 'The mill is quiet again. Thank you.'"
            }
          },
          '15,8': {
            title: 'Brisk',
            text: "Brisk the shopkeeper wrings his hands. 'I dropped my ledger down the cellar stairs! It has all my debts in it. Bring it back and I will be generous.'",
            accept: 'ledger', once: true,
            alt: {
              when: 'brisk-ledger', take: 'brisk-ledger', complete: 'ledger', once: true,
              title: 'Brisk',
              text: "Brisk snatches the ledger and pats it fondly. 'You have saved me a fortune. Here, take this with my thanks.'"
            }
          }
        }
      },
      'cellars-1': {
        name: 'Cellars of Thornwick, level 1',
        kind: 'dungeon',
        depth: 1,
        legend: {},
        rows: carve(24, 17, withEvents(CELLARS_OPS, CELLARS_EVENTS)),
        links: {
          '1,1': { to: 'thornwick', x: 10, y: 8, dir: 0 },
          '1,15': { to: 'cellars-2', x: 2, y: 1, dir: 1 }
        },
        // Monster groups. state: 'sleep' or 'awake'. An ambush group is hidden until the company is beside it.
        groups: [
          { kind: 'goblin', n: 3, x: 5, y: 12, state: 'sleep' },
          { kind: 'giant-rat', n: 4, x: 11, y: 3, state: 'awake', quest: 'rats-slain' },
          { kind: 'kobold', n: 2, x: 2, y: 9, state: 'sleep', ambush: true },
          { kind: 'skeleton', n: 3, x: 19, y: 4, state: 'sleep' }
        ],
        traps: [
          { x: 3, y: 14, kind: 'pit' },
          { x: 9, y: 12, kind: 'darts' },
          { x: 19, y: 13, kind: 'block' }
        ],
        events: CELLARS_EVENTS
      },
      'cellars-2': {
        name: 'Cellars of Thornwick, level 2',
        kind: 'dungeon',
        depth: 2,
        legend: {},
        rows: carve(24, 17, withEvents(CELLARS2_OPS, CELLARS2_EVENTS)),
        links: {
          '1,1': { to: 'cellars-1', x: 2, y: 15, dir: 1 }
        },
        groups: [
          { kind: 'ghoul', n: 2, x: 2, y: 11, state: 'sleep' },
          { kind: 'zombie', n: 3, x: 16, y: 12, state: 'sleep' },
          { kind: 'wight', n: 1, x: 20, y: 3, state: 'sleep', quest: 'wight-slain' }
        ],
        traps: [
          { x: 4, y: 13, kind: 'pit' },
          { x: 9, y: 4, kind: 'darts' },
          { x: 20, y: 12, kind: 'block' }
        ],
        events: CELLARS2_EVENTS
      }
    }
  };

  E0.cellar = { place: 'cellars-1', x: 2, y: 1, dir: 1 };

  // The three hand-set adventures share the generator's level builder, with their own names, quests and final enemies.
  // Each has its own town and levels; their stories are written out in full here.
  function storied(id, o) {
    var plan = EM.Gen.plan(0, 0);
    plan.bossKind = o.bossKind;
    var adv = EM.Gen.build(id, Object.assign({}, plan, {
      size: o.size, minLevel: o.minLevel, maxLevel: o.maxLevel, levelRange: o.levels, name: o.name,
      townName: o.townName, dungeonName: o.dungeonName, questTitle: o.questTitle, questText: o.questText,
      gold: o.gold, xp: o.xp, bossFlag: id + ':' + o.bossFlag, keyId: 'key:' + id
    }));
    adv.id = id;
    adv.name = o.name;
    adv.levels = o.levels;
    adv.quests.main.title = o.questTitle;
    adv.quests.main.text = o.questText;
    adv.quests.main.giver = 'The reeve of ' + o.townName;
    return adv;
  }

  var registry = { E0: E0 };
  var E_IDS = ['E1', 'E2', 'E3'];
  var STORIES = {
    E1: { name: 'The Hollow Vaults', levels: '1–3', size: 'medium', minLevel: 1, maxLevel: 3, townName: 'Marrowgate', dungeonName: 'the Hollow Vaults',
      questTitle: 'The Hollow Warden', questText: 'Go down into the Hollow Vaults beneath Marrowgate and destroy the warden that has taken the lowest hall.',
      gold: 450, xp: 1800, bossKind: 'ghoul-lord', bossFlag: 'hollow-warden' },
    E2: { name: 'Barrow of the Iron King', levels: '3–5', size: 'large', minLevel: 3, maxLevel: 5, townName: 'Kellmoor', dungeonName: 'the Iron King\u2019s barrow',
      questTitle: 'The Iron King\u2019s Wight', questText: 'Enter the barrow of the Iron King beyond Kellmoor and lay its guardian to rest.',
      gold: 900, xp: 4200, bossKind: 'wight-lord', bossFlag: 'iron-wight' },
    E3: { name: 'The Witch-Queen of Ravenmoor', levels: '5–7', size: 'medium', minLevel: 5, maxLevel: 7, townName: 'Ravenmoor', dungeonName: 'the Witch-Queen\u2019s mire',
      questTitle: 'The Witch-Queen', questText: 'Wade into the mire below Ravenmoor and end the Witch-Queen\u2019s rule.',
      gold: 1500, xp: 7500, bossKind: 'night-hag', bossFlag: 'witch-queen' }
  };

  // Adventures by id. Hand-set ones are built now; generated ones (G1-1 .. G5-10) on first use.
  var ALL = {};
  ALL.E0 = E0;
  E_IDS.forEach(function (id) {
    var built = null;
    Object.defineProperty(ALL, id, { enumerable: true, get: function () { return built || (built = storied(id, STORIES[id])); } });
  });
  EM.Gen.ids().forEach(function (id) {
    Object.defineProperty(ALL, id, { enumerable: true, get: function () { return EM.Gen.adventure(id); } });
  });

  // The order of play: the hand-written three, then the generated ones.
  function order() { return ['E0', 'E1', 'E2', 'E3'].concat(EM.Gen.ids()); }

  return { ALL: ALL, E0: E0, carve: carve, order: order };
})();
