/* data.js — the item list (about 300 items), trap kinds, names and the pregenerated company.
   Item row: id | name | kind | value (gold) | damage | flags | armour bonus | weapon bonus | heal dice | classes
     kind: weapon, armour, shield, potion, scroll, wand, staff, ring, amulet, magic, gear, key, gem, jewel
     flags: m missile weapon.   classes: * for any, or a comma list.
   Spell scrolls for mage spells are added by spells.js. Spell lists live in spells.js and monsters in monsters.js. */
var EM = window.EM = window.EM || {};

EM.Data = (function () {
  var ROWS = [
    // ---- weapons ----
    'dagger|Dagger|weapon|2|1d4|||||*',
    'short-sword|Short sword|weapon|10|1d6|||||fighter,paladin,ranger,thief,halfling',
    'long-sword|Long sword|weapon|15|1d8|||||fighter,paladin,ranger',
    'broad-sword|Broad sword|weapon|20|2d4|||||fighter,paladin,ranger',
    'scimitar|Scimitar|weapon|15|1d8|||||fighter,ranger,thief',
    'rapier|Rapier|weapon|20|1d6+1|||||fighter,paladin,thief',
    'hand-axe|Hand axe|weapon|4|1d6|||||fighter,paladin,ranger,thief',
    'battle-axe|Battle axe|weapon|10|1d8|||||fighter,paladin',
    'great-axe|Great axe|weapon|25|1d10|||||fighter',
    'mace|Mace|weapon|5|1d6+1|||||fighter,paladin,cleric,ranger',
    'flail|Flail|weapon|8|2d4|||||fighter,paladin,cleric',
    'warhammer|Warhammer|weapon|4|1d4+1|||||fighter,paladin,cleric',
    'war-maul|War maul|weapon|14|2d6|||||fighter',
    'morning-star|Morning star|weapon|10|2d4+1|||||fighter,paladin,cleric',
    'spear|Spear|weapon|1|1d6|m|||||fighter,paladin,ranger',
    'halberd|Halberd|weapon|15|1d10|||||fighter',
    'pike|Pike|weapon|10|1d10|||||fighter',
    'staff|Quarterstaff|weapon|1|1d6|||||fighter,ranger,mage,cleric,thief',
    'club|Club|weapon|0|1d6|||||fighter,cleric,thief',
    'sling|Sling|weapon|2|1d4|m|||||fighter,ranger,mage,cleric,thief',
    'javelin|Javelin|weapon|1|1d6|m|||||fighter,ranger',
    'throwing-axe|Throwing axe|weapon|6|1d6|m|||||fighter,ranger,thief',
    'short-bow|Short bow|weapon|25|1d6|m|||||fighter,paladin,ranger,thief',
    'long-bow|Long bow|weapon|60|1d8|m|||||fighter,paladin,ranger',
    'light-crossbow|Light crossbow|weapon|35|1d6+1|m|||||fighter,ranger,thief,cleric',
    'heavy-crossbow|Heavy crossbow|weapon|75|1d8+2|m|||||fighter',
    // ---- magic weapons ----
    'long-sword+1|Long sword +1|weapon|2000|1d8|||1||fighter,paladin,ranger',
    'long-sword+2|Long sword +2|weapon|8000|1d8|||2||fighter,paladin,ranger',
    'short-sword+1|Short sword +1|weapon|1500|1d6|||1||fighter,paladin,ranger,thief',
    'dagger+1|Dagger +1|weapon|1000|1d4|||1||*',
    'dagger+2|Dagger +2|weapon|4000|1d4|||2||*',
    'battle-axe+1|Battle axe +1|weapon|2500|1d8|||1||fighter,paladin',
    'mace+1|Mace +1|weapon|2000|1d6+1|||1||fighter,paladin,cleric,ranger',
    'warhammer+2|Warhammer +2|weapon|6000|1d4+1|||2||fighter,paladin,cleric',
    'spear+1|Spear +1|weapon|2000|1d6|m|||1||fighter,paladin,ranger',
    'flail+1|Flail +1|weapon|2000|2d4|||1||fighter,paladin,cleric',
    'hand-axe+1|Hand axe +1|weapon|1800|1d6|||1||fighter,paladin,ranger,thief',
    'long-bow+1|Long bow +1|weapon|3000|1d8|m|||1||fighter,paladin,ranger',
    'short-bow+1|Short bow +1|weapon|2200|1d6|m|||1||fighter,paladin,ranger,thief',
    'rapier+1|Rapier +1|weapon|2500|1d6+1|||1||fighter,paladin,thief',
    'scimitar+2|Scimitar +2|weapon|6000|1d8|||2||fighter,ranger,thief',
    'long-sword-cursed|Cursed long sword -1|weapon|0|1d8|||-1||fighter,paladin,ranger',
    'dagger-of-the-lamp|Dagger of the lamp|weapon|9000|1d4+1|||3||*',
    // ---- armour and shields ----
    'robe|Mage robe|armour|5|||0|||mage',
    'padded|Padded armour|armour|4|||1|||fighter,paladin,ranger,cleric,thief,mage',
    'leather|Leather armour|armour|5|||2|||fighter,paladin,ranger,cleric,thief,halfling,elf',
    'studded|Studded leather|armour|15|||3|||fighter,paladin,ranger,cleric,thief',
    'hide|Hide armour|armour|10|||3|||fighter,ranger,cleric',
    'ring-mail|Ring mail|armour|30|||3|||fighter,paladin,ranger,cleric',
    'scale-mail|Scale mail|armour|45|||4|||fighter,paladin,ranger,cleric',
    'chain|Chain mail|armour|75|||5|||fighter,paladin,ranger,cleric',
    'splint|Splint mail|armour|80|||6|||fighter,paladin',
    'banded|Banded mail|armour|150|||6|||fighter,paladin',
    'plate|Plate mail|armour|400|||7|||fighter,paladin',
    'mithral-shirt|Mithral shirt|armour|1200|||5|||fighter,paladin,ranger,cleric,thief,mage',
    'leather+1|Leather armour +1|armour|1500|||3|||fighter,paladin,ranger,cleric,thief,halfling,elf',
    'chain+1|Chain mail +1|armour|4000|||6|||fighter,paladin,ranger,cleric',
    'plate+2|Plate mail +2|armour|12000|||9|||fighter,paladin',
    'buckler|Buckler|shield|5|||1|||fighter,paladin,ranger,cleric,thief',
    'shield|Wooden shield|shield|10|||1|||fighter,paladin,ranger,cleric,thief',
    'iron-shield|Iron shield|shield|25|||2|||fighter,paladin,ranger,cleric',
    'tower-shield|Tower shield|shield|60|||3|||fighter,paladin',
    'shield+1|Shield +1|shield|1000|||2|||fighter,paladin,ranger,cleric,thief',
    // ---- potions ----
    'potion-healing|Potion of healing|potion|50|||||2d8+2|*',
    'potion-greater|Potion of greater healing|potion|200|||||4d8+4|*',
    'potion-superior|Potion of superior healing|potion|500|||||6d8+6|*',
    'potion-cure|Potion of cure poison|potion|75|||||2d4|*',
    'potion-heroism|Potion of heroism|potion|300|||||1d4|*',
    'potion-strength|Potion of giant strength|potion|500|||||0|*',
    'potion-water|Potion of water breathing|potion|200|||||0|*',
    'potion-fire|Potion of fire resistance|potion|250|||||0|*',
    'potion-speed|Potion of speed|potion|400|||||0|*',
    'potion-levitate|Potion of levitation|potion|300|||||0|*',
    'potion-invisible|Potion of invisibility|potion|350|||||0|*',
    'potion-sleep|Potion of sleep|potion|150|||||0|*',
    'potion-gaseous|Potion of gaseous form|potion|400|||||0|*',
    'potion-clairvoy|Potion of clairvoyance|potion|500|||||0|*',
    'potion-detect|Potion of detect magic|potion|125|||||0|*',
    'potion-undead|Potion of turning|potion|350|||||0|*',
    'potion-healing-lesser|Lesser healing draught|potion|25|||||1d8|*',
    'potion-dwarf|Ale of the stone-folk|potion|40|||||1d6|*',
    'potion-elf|Elfwine|potion|120|||||1d6+2|*',
    'potion-fey|Draught of fey dreams|potion|180|||||0|*',
    'potion-ogre|Ogre juice|potion|90|||||0|*',
    'potion-clarity|Potion of clarity|potion|275|||||0|*',
    'potion-iron|Potion of iron skin|potion|325|||||0|*',
    'potion-wit|Potion of wit|potion|225|||||0|*',
    'potion-blind|Potion of blindness|potion|50|||||0|*',
    // ---- scrolls (spell scrolls for mages are added by spells.js) ----
    'scroll-light|Scroll of cure light wounds|scroll|35|||||1d8|cleric,mage,paladin,ranger',
    'scroll-cure|Scroll of cure serious wounds|scroll|120|||||3d8|cleric,paladin',
    'scroll-protect|Scroll of protection from undead|scroll|200|||||0|cleric,paladin',
    'scroll-teleport|Scroll of recall|scroll|300|||||0|*',
    'scroll-identify|Scroll of identify|scroll|100|||||0|*',
    'scroll-detect|Scroll of detect traps|scroll|75|||||0|*',
    'scroll-find|Scroll of find hollows|scroll|90|||||0|*',
    'scroll-curse|Scroll of cursing|scroll|25|||||0|*',
    'scroll-sanctuary|Scroll of sanctuary|scroll|150|||||0|*',
    'scroll-shield|Scroll of warding|scroll|180|||||0|*',
    'scroll-bless|Scroll of blessing|scroll|110|||||0|*',
    'scroll-map|Scroll of the lost road|scroll|250|||||0|*',
    // ---- wands, staves, rings, amulets, magic ----
    'wand-missiles|Wand of magic missiles|wand|1500|||||mage',
    'wand-fire|Wand of fire|wand|2500|||||mage',
    'wand-cold|Wand of cold|wand|2500|||||mage',
    'wand-sleep|Wand of sleep|wand|1500|||||mage',
    'wand-paralysis|Wand of paralysis|wand|3000|||||mage,cleric',
    'wand-polymorph|Wand of polymorph|wand|2000|||||mage',
    'wand-detect|Wand of foe detection|wand|1000|||||*',
    'wand-lightning|Wand of lightning|wand|3500|||||mage',
    'wand-illusion|Wand of illusion|wand|2000|||||mage',
    'wand-wonder|Wand of wonder|wand|4000|||||mage',
    'staff-healing|Staff of healing|staff|5000|||||2d6+2|cleric,mage',
    'staff-striking|Staff of striking|staff|4000|||||cleric,mage,fighter',
    'staff-lightning|Staff of lightning|staff|6000|||||mage',
    'staff-snakes|Staff of serpents|staff|3000|||||cleric',
    'staff-withering|Staff of withering|staff|5500|||||cleric,mage',
    'staff-power|Staff of power|staff|9000|||||mage',
    'ring-protection|Ring of protection +1|ring|2000|||||*',
    'ring-protection+2|Ring of protection +2|ring|5000|||||*',
    'ring-regeneration|Ring of regeneration|ring|12000|||||*',
    'ring-warmth|Ring of warmth|ring|1200|||||*',
    'ring-spell-storing|Ring of spell storing|ring|8000|||||mage,cleric',
    'ring-invisible|Ring of invisibility|ring|6000|||||*',
    'ring-feather|Ring of feather falling|ring|2200|||||*',
    'ring-x-ray|Ring of seeing through stone|ring|9000|||||*',
    'ring-brooding|Ring of brooding|ring|0|||||*',
    'ring-fire-res|Ring of fire resistance|ring|7000|||||*',
    'amulet-life|Amulet of life protection|amulet|6000|||||*',
    'amulet-plane|Amulet of the planes|amulet|15000|||||mage,cleric',
    'amulet-wisdom|Amulet of wisdom|amulet|3000|||||cleric',
    'amulet-speech|Amulet of tongues|amulet|4000|||||*',
    'amulet-stone|Amulet of stone skin|amulet|5000|||||*',
    'amulet-hollow|Hollow amulet|amulet|1000|||||*',
    'bag-holding|Bag of holding|magic|5000|||||*',
    'cloak-elves|Cloak of the forest|magic|6000|||||*',
    'boots-speed|Boots of striding|magic|6500|||||*',
    'gauntlets-ogre|Gauntlets of the ogre|magic|6000|||||fighter,paladin,ranger',
    'girdle-giant|Girdle of hill strength|magic|14000|||||fighter,paladin',
    'helm-brilliance|Helm of brilliance|magic|8000|||||*',
    'lantern-true|Lantern of true sight|magic|4500|||||*',
    'horn-summoning|Horn of the hunt|magic|7000|||||*',
    'crystal-ball|Glass seer|magic|10000|||||mage',
    'mirror-dead|Mirror of the dead|magic|2000|||||*',
    'figurine-owl|Owl figurine|magic|3000|||||*',
    'rope-entangle|Rope of binding|magic|2000|||||*',
    'cube-force|Cube of force|magic|7000|||||mage',
    'tome-lore|Tome of lore|magic|18000|||||*',
    'cursed-ring|Ring of misfortune|magic|0|||||*',
    // ---- keys and quest items ----
    'iron-key|Iron key|key|0|||||*',
    'brisk-ledger|Brisk’s ledger|key|0|||||*',
    'vault-key|Vault key|key|0|||||*',
    'barrow-key|Barrow key|key|0|||||*',
    'ravenmoor-seal|Seal of Ravenmoor|key|0|||||*',
    'hollow-token|Hollow token|key|0|||||*',
    // ---- gear (carried and sold) ----
    'rope|Hempen rope|gear|1|||||*',
    'torch|Torch|gear|1|||||*',
    'lantern|Hooded lantern|gear|12|||||*',
    'oil|Flask of oil|gear|2|||||*',
    'rations|Trail rations|gear|1|||||*',
    'spikes|Iron spikes|gear|1|||||*',
    'crowbar|Crowbar|gear|2|||||*',
    'tinderbox|Tinderbox|gear|3|||||*',
    'holy-water|Vial of holy water|gear|25|||||*',
    'thieves-tools|Thieves’ tools|gear|25|||||thief',
    'grapnel|Grappling hook|gear|1|||||*',
    'mirror|Hand mirror|gear|10|||||*',
    'chalk|Chalk|gear|1|||||*',
    'sack|Sack|gear|1|||||*',
    'bedroll|Bedroll|gear|2|||||*',
    'tent|Canvas tent|gear|20|||||*',
    'whistle|Silver whistle|gear|5|||||*',
    'manacles|Manacles|gear|10|||||*',
    'map-case|Map case|gear|4|||||*',
    'bell|Hand bell|gear|6|||||*',
    'ink-set|Ink and quill|gear|8|||||mage,cleric',
    'holy-symbol|Holy symbol|gear|25|||||cleric,paladin',
    'spellbook-blank|Blank spellbook|gear|15|||||mage',
    'ball-bearings|Bag of ball bearings|gear|1|||||*',
    'caltrops|Caltrops|gear|1|||||*',
    // ---- gems and jewellery (value is the sale price) ----
    'agate|Agate|gem|10|||||*',
    'azurite|Azurite|gem|10|||||*',
    'moss-agate|Moss agate|gem|10|||||*',
    'obsidian|Obsidian|gem|10|||||*',
    'jasper|Jasper|gem|50|||||*',
    'onyx|Onyx|gem|50|||||*',
    'turquoise|Turquoise|gem|50|||||*',
    'carnelian|Carnelian|gem|50|||||*',
    'rose-quartz|Rose quartz|gem|50|||||*',
    'amethyst|Amethyst|gem|100|||||*',
    'citrine|Citrine|gem|100|||||*',
    'pearl|Pearl|gem|100|||||*',
    'aquamarine|Aquamarine|gem|500|||||*',
    'garnet|Garnet|gem|100|||||*',
    'peridot|Peridot|gem|500|||||*',
    'topaz|Topaz|gem|500|||||*',
    'sapphire|Sapphire|gem|1000|||||*',
    'emerald|Emerald|gem|1000|||||*',
    'ruby|Ruby|gem|1000|||||*',
    'black-opal|Black opal|gem|2500|||||*',
    'diamond|Diamond|gem|5000|||||*',
    'silver-brooch|Silver brooch|jewel|120|||||*',
    'garnet-ring|Garnet ring|jewel|260|||||*',
    'gold-torc|Gold torc|jewel|350|||||*',
    'jade-idol|Jade idol|jewel|600|||||*',
    'silver-chalice|Silver chalice|jewel|400|||||*',
    'ivory-comb|Ivory comb|jewel|220|||||*',
    'copper-crown|Copper crown|jewel|150|||||*',
    'gold-crown|Gold crown|jewel|1200|||||*',
    'bejewelled-cup|Bejewelled cup|jewel|1800|||||*',
    'platinum-bracelet|Platinum bracelet|jewel|2500|||||*',
    'emerald-necklace|Emerald necklace|jewel|3500|||||*',
    'royal-sceptre|Royal sceptre|jewel|5000|||||*',
    'jewelled-mask|Jewelled mask|jewel|7500|||||*',
    'gem-hilt|Jewelled dagger hilt|jewel|2000|||||*',
    'silver-ewer|Silver ewer|jewel|900|||||*',
    'golden-idol|Golden idol|jewel|4200|||||*',
    'crystal-lamp|Crystal lamp|jewel|3000|||||*',
    'dragon-tooth|Dragon tooth|jewel|6000|||||*',
    'black-pearl|Black pearl|jewel|8000|||||*',
    'gem-harp|Harp of bone and gold|jewel|12000|||||*'
  ];

  var ITEMS = {};
  ROWS.forEach(function (row) {
    var p = row.split('|');
    var it = {
      name: p[1], kind: p[2], value: parseInt(p[3], 10) || 0,
      classes: p[9] && p[9] !== '*' ? p[9].split(',') : null
    };
    if (p[4]) it.dmg = p[4];
    if (p[5] && p[5].indexOf('m') >= 0) it.missile = true;
    if (p[6]) it.acBonus = parseInt(p[6], 10);
    if (p[7]) it.bonus = parseInt(p[7], 10);
    if (p[8]) it.heal = p[8];
    if (ITEMS[p[0]]) throw new Error('duplicate item ' + p[0]);
    ITEMS[p[0]] = it;
  });
  // Keys open locked doors. A key with keyFor 'cellar-door' opens any locked door in E0; keys of other
  // adventures name their own place or lock.
  ITEMS['iron-key'].keyFor = 'cellar-door';
  ITEMS['vault-key'].keyFor = 'cellar-door';
  ITEMS['barrow-key'].keyFor = 'cellar-door';
  ITEMS['ravenmoor-seal'].keyFor = 'cellar-door';
  ITEMS['hollow-token'].keyFor = 'cellar-door';

  // Shop bands by level: how much a shop of this band asks, and the spell circle its scrolls reach.
  var SHOP_BANDS = [
    { cap: 80, circle: 2 }, { cap: 800, circle: 3 }, { cap: 4000, circle: 5 }, { cap: 1e9, circle: 9 }
  ];

  function bandFor(level) { return level <= 2 ? 0 : level <= 5 ? 1 : level <= 10 ? 2 : 3; }

  var TRAPS = {
    pit:   { name: 'pit', single: true,  dmg: '1d6', save: 'death',  text: 'The floor gives way and {name} drops into a spiked pit.' },
    darts: { name: 'darts', single: true, dmg: '1d4', save: 'death',  text: 'Poisoned darts hiss from the wall at {name}.' },
    blade: { name: 'blade', single: true, dmg: '2d4', save: 'breath', text: 'A scything blade sweeps across the passage and catches {name}.' },
    spear: { name: 'spear', single: true, dmg: '1d8', save: 'breath', text: 'A spear lunges from a slot in the wall toward {name}.' },
    block: { name: 'falling block', single: false, dmg: '3d6', save: 'breath', text: 'A stone block crashes from the ceiling!' },
    fire:  { name: 'fire', single: false, dmg: '2d6', save: 'breath', text: 'Jets of flame roar from the vents!' },
    gas:   { name: 'gas', single: false, dmg: '1d6', save: 'death', text: 'Choking green gas billows from the cracks in the floor!' }
  };

  var NAMES = {
    male: ['Aldric', 'Bram', 'Corin', 'Dunstan', 'Eamon', 'Garrick', 'Hollis', 'Ivo', 'Jorah', 'Kell', 'Lucan', 'Oswin', 'Rhys', 'Tobin', 'Ansel', 'Cadoc', 'Doran'],
    female: ['Aelis', 'Brisa', 'Cassia', 'Dagny', 'Elowen', 'Fenna', 'Gisela', 'Hild', 'Isolde', 'Mirela', 'Nessa', 'Orla', 'Sabra', 'Wren', 'Idony', 'Maud', 'Venna']
  };

  var PREGENS = [
    { name: 'Brannoc Stonebrow', race: 'dwarf', cls: 'fighter', align: 'Lawful Good', scores: { STR: 17, DEX: 9, CON: 15, INT: 9, WIS: 10, CHA: 8 }, weapon: 'hand-axe', armour: 'chain', shield: 'shield', spec: 'hand-axe' },
    { name: 'Sela Vane', race: 'elf', cls: 'mage', align: 'Neutral Good', scores: { STR: 8, DEX: 14, CON: 10, INT: 16, WIS: 11, CHA: 12 }, weapon: 'dagger', armour: null, shield: null },
    { name: 'Ysolde Marrow', race: 'human', cls: 'cleric', align: 'Lawful Good', scores: { STR: 12, DEX: 10, CON: 13, INT: 10, WIS: 16, CHA: 13 }, weapon: 'mace', armour: 'studded', shield: 'shield' },
    { name: 'Pim Tallow', race: 'halfling', cls: 'thief', align: 'Chaotic Good', scores: { STR: 9, DEX: 17, CON: 12, INT: 13, WIS: 10, CHA: 14 }, weapon: 'short-sword', armour: 'leather', shield: null }
  ];

  function item(id) { return ITEMS[id] || null; }

  function canUse(id, cls) {
    var it = ITEMS[id];
    if (!it || !it.classes) return true;
    return it.classes.indexOf(cls) >= 0;
  }

  function sellValue(id) {
    var it = ITEMS[id];
    return it ? Math.floor(it.value / 2) : 0;
  }

  // Stock for a shop at this level: ordinary goods under a price cap, plus the spell scrolls the band can read.
  // A seeded selection, so the shop has the same stock on every visit.
  function shopFor(level) {
    var band = bandFor(level);
    var cap = SHOP_BANDS[band].cap, circle = SHOP_BANDS[band].circle;
    var goods = Object.keys(ITEMS).filter(function (id) {
      var it = ITEMS[id];
      return ['weapon', 'armour', 'shield', 'potion', 'scroll', 'gear'].indexOf(it.kind) >= 0 &&
        it.value > 0 && it.value <= cap && !(it.bonus && it.bonus < 0);
    });
    var spells = Object.keys(ITEMS).filter(function (id) {
      var it = ITEMS[id];
      return it.kind === 'spellscroll' && EM.Spells.SPELLS[it.spell].level <= circle;
    });
    var rnd = EM.Mod.stream('shop:' + band, 1);
    var pick = function (list, n) {
      var copy = list.slice(), out = [];
      while (copy.length && out.length < n) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
      return out;
    };
    return pick(goods, 26).concat(pick(spells, 6));
  }

  return {
    ITEMS: ITEMS, ROWS: ROWS, TRAPS: TRAPS, NAMES: NAMES, PREGENS: PREGENS,
    item: item, canUse: canUse, shopFor: shopFor, sellValue: sellValue, bandFor: bandFor, SHOP_BANDS: SHOP_BANDS,
    count: ROWS.length
  };
})();
