/* rules.js — abilities, races, classes, saves, experience, THAC0, thief skills.
   Original rules written for Emberfall. Loaded first; everything else hangs off window.EM. */
var EM = window.EM = window.EM || {};

EM.Rules = (function () {
  var ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  var ABILITY_NAMES = {
    STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
    INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma'
  };

  var ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good',
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

  // Five saving-throw categories. A roll of d20 equal to or above the target succeeds.
  var SAVES = ['death', 'wands', 'stone', 'breath', 'spells'];
  var SAVE_NAMES = {
    death: 'Poison or death', wands: 'Rods, staves, wands',
    stone: 'Petrify or polymorph', breath: 'Breath weapon', spells: 'Spells and magic'
  };

  var RACES = {
    human: {
      name: 'Human', mods: {}, moveFactor: 1, search: 0,
      classes: ['fighter', 'paladin', 'ranger', 'mage', 'cleric', 'thief'], caps: {},
      desc: 'Adaptable and ambitious. No racial limits.'
    },
    dwarf: {
      name: 'Dwarf', mods: { CON: 1, CHA: -1 }, moveFactor: 0.85, search: 16,
      classes: ['fighter', 'cleric', 'thief'], caps: { fighter: 12, cleric: 10, thief: 12 },
      desc: 'Stout and stubborn. Keen eye for stonework: finds hidden doors and traps more often.'
    },
    elf: {
      name: 'Elf', mods: { DEX: 1, CON: -1 }, moveFactor: 0.85, search: 10,
      classes: ['fighter', 'ranger', 'mage', 'thief'], caps: { fighter: 10, ranger: 10, mage: 12, thief: 10 },
      desc: 'Graceful and long-sighted. Notices what others walk past.'
    },
    gnome: {
      name: 'Gnome', mods: { CON: 1, WIS: -1 }, moveFactor: 0.85, search: 6,
      classes: ['fighter', 'mage', 'cleric', 'thief'], caps: { fighter: 9, mage: 10, cleric: 9, thief: 10 },
      desc: 'Curious tinkerer, good with locks and small mechanisms.'
    },
    'half-elf': {
      name: 'Half-elf', mods: {}, moveFactor: 0.85, search: 4,
      classes: ['fighter', 'ranger', 'mage', 'cleric', 'thief'], caps: { fighter: 10, ranger: 10, mage: 9, cleric: 10, thief: 10 },
      desc: 'Between two peoples. Adaptable, with a knack for the wilds.'
    },
    halfling: {
      name: 'Halfling', mods: { DEX: 1, STR: -1 }, moveFactor: 0.85, search: 4,
      classes: ['fighter', 'thief'], caps: { fighter: 8, thief: 10 },
      desc: 'Small, quick and hard to surprise. Moves quietly.'
    }
  };

  // thac0Rate: how fast the to-hit number falls per level (THAC0 = 20 - floor((level-1) * rate)).
  // saves.base: target for levels 1 (lower is better); improves by 1 every `every` levels.
  var CLASSES = {
    fighter: {
      name: 'Fighter', prime: ['STR'], die: 10, min: { STR: 9 }, thac0Rate: 1,
      saves: { base: [14, 15, 16, 17, 15], every: 3 }, canSpecialize: true,
      alignments: null, turnsUndead: null,
      weapons: ['dagger', 'short-sword', 'long-sword', 'hand-axe', 'battle-axe', 'mace', 'warhammer', 'spear', 'staff', 'sling', 'short-bow', 'long-bow', 'club'],
      desc: 'Master of arms. Specialize in one weapon for extra hits and damage.'
    },
    paladin: {
      name: 'Paladin', prime: ['STR', 'WIS'], die: 10, min: { STR: 12, WIS: 13, CHA: 17, CON: 9 }, thac0Rate: 1,
      saves: { base: [12, 14, 13, 16, 15], every: 3 }, canSpecialize: true,
      alignments: ['Lawful Good'], turnsUndead: { as: 'cleric', offset: -2 },
      weapons: ['long-sword', 'short-sword', 'battle-axe', 'mace', 'warhammer', 'spear', 'long-bow', 'short-bow'],
      desc: 'Holy knight. Lawful good only. Turns undead as a cleric two levels lower.'
    },
    ranger: {
      name: 'Ranger', prime: ['STR', 'DEX', 'WIS'], die: 8, min: { STR: 13, DEX: 13, CON: 14, WIS: 14 }, thac0Rate: 1,
      saves: { base: [14, 16, 15, 17, 16], every: 3 }, canSpecialize: true,
      alignments: null, turnsUndead: null,
      weapons: ['dagger', 'short-sword', 'long-sword', 'hand-axe', 'spear', 'staff', 'sling', 'short-bow', 'long-bow'],
      desc: 'Woodsman and tracker. Strong with a bow and a blade.'
    },
    mage: {
      name: 'Mage', prime: ['INT'], die: 4, min: { INT: 9 }, thac0Rate: 0.34,
      saves: { base: [14, 11, 13, 13, 12], every: 3 }, canSpecialize: false,
      alignments: null, turnsUndead: null,
      weapons: ['dagger', 'staff', 'sling'],
      desc: 'Scholar of the arcane. Fragile in melee; learns spells from scrolls.'
    },
    cleric: {
      name: 'Cleric', prime: ['WIS'], die: 8, min: { WIS: 9 }, thac0Rate: 0.67,
      saves: { base: [10, 14, 13, 16, 15], every: 3 }, canSpecialize: false,
      alignments: null, turnsUndead: { as: 'cleric', offset: 0 },
      weapons: ['mace', 'warhammer', 'staff', 'sling', 'club'],
      desc: 'Servant of a god. Heals, and turns the restless dead.'
    },
    thief: {
      name: 'Thief', prime: ['DEX'], die: 6, min: { DEX: 9 }, thac0Rate: 0.5,
      saves: { base: [13, 14, 12, 16, 15], every: 4 }, canSpecialize: false,
      alignments: null, turnsUndead: null,
      weapons: ['dagger', 'short-sword', 'hand-axe', 'short-bow', 'sling', 'club'],
      desc: 'Locks, traps, shadows and backstabs.'
    }
  };

  // Cumulative XP needed for levels 1..20 (index 0 = level 1).
  var XP = {
    fighter: [0, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000, 2750000, 3000000],
    paladin: [0, 2750, 5500, 12000, 24000, 45000, 95000, 175000, 350000, 700000, 1050000, 1400000, 1750000, 2100000, 2450000, 2800000, 3150000, 3500000, 3850000, 4200000],
    ranger:  [0, 2250, 4500, 9000, 18000, 35000, 70000, 125000, 250000, 500000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000, 2750000, 3000000],
    mage:    [0, 2500, 5000, 10000, 20000, 40000, 80000, 160000, 320000, 640000, 960000, 1280000, 1600000, 1920000, 2240000, 2560000, 2880000, 3200000, 3520000, 3840000],
    cleric:  [0, 1500, 3000, 6000, 13000, 27500, 55000, 110000, 220000, 440000, 660000, 880000, 1100000, 1320000, 1540000, 1760000, 1980000, 2200000, 2420000, 2640000],
    thief:   [0, 1250, 2500, 5000, 10000, 20000, 40000, 70000, 110000, 160000, 220000, 440000, 660000, 880000, 1100000, 1320000, 1540000, 1760000, 1980000, 2200000]
  };

  var MAX_LEVEL = 20;
  var TRAIN_COST_PER_LEVEL = 100;

  var SKILLS = {
    pickLock: { name: 'Open locks', base: 25, gain: 4 },
    findTraps: { name: 'Find traps', base: 20, gain: 4 },
    removeTraps: { name: 'Remove traps', base: 15, gain: 3 },
    pickPockets: { name: 'Pick pockets', base: 30, gain: 4 },
    moveSilently: { name: 'Move silently', base: 20, gain: 3 },
    hideInShadows: { name: 'Hide in shadows', base: 15, gain: 3 },
    climbWalls: { name: 'Climb walls', base: 85, gain: 2 }
  };
  var SKILL_ORDER = ['pickLock', 'findTraps', 'removeTraps', 'pickPockets', 'moveSilently', 'hideInShadows', 'climbWalls'];

  var RACE_SKILL = {
    dwarf: { findTraps: 15, removeTraps: 10 },
    elf: { moveSilently: 5, hideInShadows: 5 },
    gnome: { pickLock: 5, removeTraps: 5 },
    'half-elf': { pickPockets: 5 },
    halfling: { moveSilently: 10, hideInShadows: 10, climbWalls: -5 },
    human: {}
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ---- ability modifiers --------------------------------------------------
  function strHit(s) { return s <= 3 ? -3 : s <= 5 ? -2 : s <= 7 ? -1 : s <= 15 ? 0 : s === 16 ? 1 : s === 17 ? 2 : 3; }
  function strDmg(s) { return s <= 5 ? -1 : s <= 15 ? 0 : s <= 17 ? 1 : 2; }
  function conHp(s) { return s <= 3 ? -2 : s <= 5 ? -1 : s <= 14 ? 0 : s <= 16 ? 1 : s === 17 ? 2 : 3; }
  // Points of armour-class improvement from Dexterity (positive is better).
  function dexAc(s) { return s <= 5 ? -1 : s <= 14 ? 0 : s === 15 ? 1 : s === 16 ? 1 : s === 17 ? 2 : 3; }

  // ---- dice and generation --------------------------------------------------
  function rollStat(rnd) {
    var r = [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)];
    r.sort(function (a, b) { return a - b; });
    return r[1] + r[2] + r[3];
  }
  function rollScores(rnd) {
    var out = {};
    ABILITIES.forEach(function (a) { out[a] = rollStat(rnd || EM.rand); });
    return out;
  }

  function racialScores(scores, race) {
    var out = {}, mods = RACES[race].mods;
    ABILITIES.forEach(function (a) { out[a] = clamp(scores[a] + (mods[a] || 0), 3, 18); });
    return out;
  }

  // Returns a list of problems; empty means the combination is legal.
  function validate(race, cls, scores, alignment) {
    var errs = [], r = RACES[race], c = CLASSES[cls];
    if (!r) return ['Unknown race'];
    if (!c) return ['Unknown class'];
    if (r.classes.indexOf(cls) < 0) errs.push(r.name + 's cannot be ' + c.name.toLowerCase() + 's.');
    var adj = racialScores(scores, race);
    Object.keys(c.min).forEach(function (a) {
      if (adj[a] < c.min[a]) errs.push(c.name + 's need ' + a + ' ' + c.min[a] + ' or more (have ' + adj[a] + ').');
    });
    if (c.alignments && c.alignments.indexOf(alignment) < 0) errs.push(c.name + 's must be ' + c.alignments.join(' or ') + '.');
    return errs;
  }

  function maxLevel(race, cls) {
    var caps = RACES[race].caps;
    return caps[cls] || MAX_LEVEL;
  }

  // ---- derived values -------------------------------------------------------
  function thac0(cls, level) { return 20 - Math.floor((level - 1) * CLASSES[cls].thac0Rate); }

  function saves(ch) {
    var c = CLASSES[ch.cls], out = {};
    SAVES.forEach(function (s, i) {
      out[s] = Math.max(2, c.saves.base[i] - Math.floor((ch.level - 1) / c.saves.every));
    });
    return out;
  }

  function primeBonus(ch) {
    var c = CLASSES[ch.cls], low = 99;
    c.prime.forEach(function (a) { low = Math.min(low, ch.abil[a]); });
    if (low >= 17) return 0.10;
    if (low >= 15) return 0.05;
    return 0;
  }

  function armourClass(ch, armourItem, shieldItem) {
    var ac = 10;
    if (armourItem) ac -= armourItem.acBonus || 0;
    if (shieldItem) ac -= shieldItem.acBonus || 0;
    ac -= dexAc(ch.abil.DEX);
    return ac;
  }

  function levelForXp(cls, race, xp) {
    var cap = maxLevel(race, cls), table = XP[cls], lvl = 1;
    for (var i = 0; i < table.length && i < cap; i++) {
      if (xp >= table[i]) lvl = i + 1;
    }
    return lvl;
  }

  function nextLevelXp(ch) {
    if (ch.level >= maxLevel(ch.race, ch.cls)) return null;
    return XP[ch.cls][ch.level];
  }

  // Experience accrues; a character may only advance a level by training at the hall.
  function awardXp(ch, amount) {
    var earned = Math.floor(amount * (1 + primeBonus(ch)));
    ch.xp += earned;
    return earned;
  }

  function questXp(listed) { return Math.floor(listed / 4); }

  function canTrain(ch) {
    var need = nextLevelXp(ch);
    return need !== null && ch.xp >= need;
  }

  function trainCost(ch) {
    var target = levelForXp(ch.cls, ch.race, ch.xp);
    return Math.max(0, target - ch.level) * TRAIN_COST_PER_LEVEL;
  }

  // Training: one level per 100 gp for each level gained.
  function train(ch) {
    var target = levelForXp(ch.cls, ch.race, ch.xp), gained = [];
    while (ch.level < target) {
      var gain = rollHp(ch);
      ch.level += 1;
      ch.hpMax += gain;
      ch.hp += gain;
      gained.push(gain);
    }
    return gained;
  }

  function rollHp(ch) {
    return Math.max(1, EM.roll('1d' + CLASSES[ch.cls].die) + conHp(ch.abil.CON));
  }

  function turnLevel(ch) {
    var t = CLASSES[ch.cls].turnsUndead;
    if (!t) return 0;
    return Math.max(0, ch.level + t.offset);
  }

  function skillValue(ch, skill) {
    if (ch.cls !== 'thief') return 0;
    var s = SKILLS[skill];
    var v = s.base + s.gain * (ch.level - 1);
    v += (RACE_SKILL[ch.race] && RACE_SKILL[ch.race][skill]) || 0;
    var dex = ch.abil.DEX;
    if (dex >= 16) v += 5; else if (dex >= 14) v += 2; else if (dex <= 7) v -= 5;
    return clamp(Math.round(v), 0, 95);
  }

  // Chance (percent) that one character finds a secret door or trap next to them.
  function searchChance(ch) {
    var base = 17 + (RACES[ch.race].search || 0);
    if (ch.cls === 'thief') base = Math.max(base, skillValue(ch, 'findTraps') / 2);
    return Math.min(90, Math.round(base));
  }

  function specBonus(ch) {
    if (!ch.spec || !CLASSES[ch.cls].canSpecialize) return { hit: 0, dmg: 0, attacks: 0 };
    return { hit: 1 + Math.floor(ch.level / 4), dmg: 1 + Math.floor(ch.level / 6), attacks: 0 };
  }

  // ---- creation -------------------------------------------------------------
  var nextId = 1;
  function makeCharacter(o) {
    var c = CLASSES[o.cls], r = RACES[o.race];
    var abil = racialScores(o.scores, o.race);
    var ch = {
      id: o.id || ('c' + Date.now().toString(36) + (nextId++)),
      name: o.name || 'Nameless',
      race: o.race, cls: o.cls, align: o.align || 'True Neutral',
      level: 1, xp: 0, abil: abil,
      hpMax: 0, hp: 0, status: 'ok',
      weapon: null, armour: null, shield: null, spec: null,
      portrait: o.portrait != null ? o.portrait : Math.floor((o.rnd || EM.rand)() * 100000)
    };
    ch.hpMax = Math.max(1, EM.roll('1d' + c.die) + conHp(abil.CON));
    ch.hp = ch.hpMax;
    if (o.weapon) ch.weapon = o.weapon;
    if (o.armour) ch.armour = o.armour;
    if (o.shield) ch.shield = o.shield;
    if (o.spec) ch.spec = o.spec;
    ch.book = o.book ? o.book.slice() : (o.cls === 'mage' ? ['magic-missile', 'sleep'] : []);
    ch.memo = [];
    memorize(ch);
    return ch;
  }

  // Adjusts hit points and status after damage. Returns true if the character is now down.
  function harm(ch, amount) {
    ch.hp -= amount;
    if (ch.hp <= -10) ch.status = 'dead';
    else if (ch.hp <= 0) ch.status = 'unconscious';
    return ch.status !== 'ok';
  }

  function heal(ch, amount) {
    if (ch.status === 'dead') return 0;
    var before = ch.hp;
    ch.hp = Math.min(ch.hpMax, ch.hp + amount);
    if (ch.hp > 0) ch.status = 'ok';
    return ch.hp - before;
  }

  // Spell slots for spell level n (1-3 in this build). Mages and clerics both reach level n at caster level 2n-1.
  function slotsFor(cls, level, n) {
    if (cls !== 'mage' && cls !== 'cleric') return 0;
    if (n > (cls === 'mage' ? 9 : 7)) return 0;
    if (level < 2 * n - 1) return 0;
    return Math.min(4, 1 + Math.floor((level - (2 * n - 1)) / 2));
  }

  // Spells a character may memorize: a mage's spellbook, or every prayer a cleric can cast.
  function knownSpells(ch) {
    var all = EM.Data.SPELLS;
    if (ch.cls === 'mage') return (ch.book || []).slice();
    if (ch.cls === 'cleric') return Object.keys(all).filter(function (id) {
      return all[id].cls === 'cleric' && slotsFor('cleric', ch.level, all[id].level) > 0;
    });
    return [];
  }

  // Fill every spell slot from the known spells. Called after rest, town rest and training.
  function memorize(ch) {
    var out = [];
    for (var n = 1; n <= 9; n++) {
      var count = slotsFor(ch.cls, ch.level, n);
      var known = knownSpells(ch).filter(function (id) { return EM.Data.SPELLS[id].level === n; });
      for (var i = 0; i < count && known.length; i++) out.push(known[i % known.length]);
    }
    ch.memo = out;
    return out;
  }

  function learnSpell(ch, spellId) {
    ch.book = ch.book || [];
    if (ch.book.indexOf(spellId) >= 0) return false;
    ch.book.push(spellId);
    memorize(ch);
    return true;
  }

  function saveRoll(ch, category) {
    var target = saves(ch)[category];
    return Math.floor(EM.rand() * 20) + 1 >= target;   // true = saved
  }

  return {
    ABILITIES: ABILITIES, ABILITY_NAMES: ABILITY_NAMES, ALIGNMENTS: ALIGNMENTS,
    SAVES: SAVES, SAVE_NAMES: SAVE_NAMES, RACES: RACES, CLASSES: CLASSES, XP: XP,
    SKILLS: SKILLS, SKILL_ORDER: SKILL_ORDER, MAX_LEVEL: MAX_LEVEL,
    clamp: clamp, strHit: strHit, strDmg: strDmg, conHp: conHp, dexAc: dexAc,
    rollScores: rollScores, racialScores: racialScores, validate: validate,
    maxLevel: maxLevel, thac0: thac0, saves: saves, primeBonus: primeBonus,
    armourClass: armourClass, levelForXp: levelForXp, nextLevelXp: nextLevelXp,
    awardXp: awardXp, questXp: questXp, canTrain: canTrain, trainCost: trainCost,
    train: train, rollHp: rollHp, turnLevel: turnLevel, skillValue: skillValue,
    searchChance: searchChance, specBonus: specBonus, makeCharacter: makeCharacter,
    harm: harm, heal: heal, saveRoll: saveRoll,
    slotsFor: slotsFor, knownSpells: knownSpells, memorize: memorize, learnSpell: learnSpell
  };
})();
