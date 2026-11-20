/* spells.js — the spell list: 45 mage spells (levels 1–9) and 30 cleric spells (levels 1–7). Loaded after data.js.
   Row: id | name | class | level | kind | range (squares) | radius | dice | save | rounds | text | utility
   Kinds:
     missile       one foe, automatic hit; casters get extra darts as they grow
     ray           one foe, saving throw halves
     area          every foe in a radius; saving throw halves
     smite-undead  every undead foe in a radius; no save
     sleep         foes in a radius with few hit dice fall asleep
     hold          one humanoid foe is held for some rounds (saving throw)
     hold-area     every foe in a radius is held (saving throw)
     charm         one foe that is not undead stops fighting for some rounds (saving throw)
     slay          one foe is destroyed outright if it fails a saving throw (undead are immune)
     weaken        one foe deals half damage for some rounds (saving throw)
     slow          one foe acts only every other round for some rounds (saving throw)
     fear-area     foes in a radius flee if they fail a saving throw
     heal          one ally is healed (dice)
     heal-party    every living ally within range is healed (dice)
     cure          one ally: paralysis removed and healed
     bless         the company hits more often for some rounds
     shield        the company's armour class improves for some rounds
     utility       used out of combat (see EM.Spells.utility)
   Utility effects: light, detect-traps, find-doors, read-magic, scry (reveals the level), recall (back to town),
     restore (all living allies fully healed), raise (one dead ally returned to life), sense-evil (lists monsters near the company). */
var EM = window.EM = window.EM || {};

EM.Spells = (function () {
  var ROWS = [
    // ---- mage: first circle ----
    'magic-missile|Magic missile|mage|1|missile|6|0|1d4+1|none|0|Darts of force fly from the fingers and strike unerringly.|',
    'sleep|Sleep|mage|1|sleep|6|1|2d8|none|0|A drowsy haze settles over the foes with few hit dice.|',
    'shield-arc|Shield arc|mage|1|shield|0|0|2|none|6|A shimmering disc steadies the company’s guard.|',
    'read-runes|Read runes|mage|1|utility|0|0|0|none|0|Old writing becomes clear. The scroll of the mind is read.|read-magic',
    'light-orb|Light orb|mage|1|utility|0|0|0|none|0|A ball of cold light hangs in the air above the company.|light',
    'charm-beast|Beast friend|mage|1|charm|6|0|0|spells|4|A wild beast of little wit is calmed for a while.|',
    // ---- mage: second circle ----
    'blaze-sphere|Blaze sphere|mage|2|area|8|1|3d6|breath|0|A sphere of fire bursts where it is aimed.|',
    'web-snare|Web snare|mage|2|hold-area|8|1|0|spells|3|Sticky strands fall on the foes around the chosen spot.|',
    'ray-of-frost|Ray of frost|mage|2|ray|8|0|2d6|spells|0|A cold white beam strikes one foe.|',
    'veil|Veil of the company|mage|2|shield|0|0|1|none|8|A faint haze makes the company harder to strike.|',
    'detect-traps|Sense snares|mage|2|utility|0|0|0|none|0|The air tingles where traps lie hidden.|detect-traps',
    'weaken|Sap strength|mage|2|weaken|6|0|0|spells|4|The foe’s blows lose their force.|',
    // ---- mage: third circle ----
    'lightning-arc|Lightning arc|mage|3|area|8|2|6d6|spells|0|A crackling arc of lightning leaps through the foes.|',
    'smite-undead|Dispel the restless|mage|3|smite-undead|8|3|1d6|none|0|Undead within the spell’s reach are torn apart by a pale light.|',
    'cinder-burst|Cinder burst|mage|3|area|8|2|5d6|breath|0|Burning ash fills the space around the target.|',
    'slow-limb|Slow foe|mage|3|slow|6|0|0|spells|3|The foe moves as if through deep water.|',
    'find-doors|Sense hollows|mage|3|utility|0|0|0|none|0|Hidden doors and passages reveal themselves to the caster.|find-doors',
    'sustain|Sustain company|mage|3|heal-party|0|0|1d8|none|0|The company is steadied and healed a little.|',
    // ---- mage: fourth circle ----
    'ice-storm|Ice storm|mage|4|area|10|2|4d8|breath|0|Hail and cold wind fall on the chosen place.|',
    'bewilder|Bewilder|mage|4|charm|8|0|0|spells|2|The foe forgets what it meant to do.|',
    'dread-gaze|Dread gaze|mage|4|fear-area|8|2|0|spells|0|Shadows crawl over the foes; the timid break and run.|',
    'stoneskin|Stone skin|mage|4|shield|0|0|4|none|10|The company’s skin takes on a grey, hard sheen.|',
    'dimension-hop|Short hop|mage|4|utility|0|0|0|none|0|The caster slips a little way through the walls to the nearest open floor.|recall',
    'wizard-eye|Scrying glass|mage|4|utility|0|0|0|none|0|A floating eye maps the level the company stands on.|scry',
    // ---- mage: fifth circle ----
    'cloudkill|Cloud of ruin|mage|5|area|10|2|5d8|breath|0|A yellow-green cloud spreads and poisons all it covers.|',
    'telekinetic-shove|Unseen hand|mage|5|ray|10|0|6d8|spells|0|An invisible hand hurls a foe against the wall.|',
    'cone-of-cold|Frost cone|mage|5|area|6|3|6d8|breath|0|A cone of bitter cold spreads from the caster.|',
    'drain-mind|Drain the mind|mage|5|hold|8|0|0|spells|6|The foe’s thoughts are pulled away, leaving it helpless.|',
    'stillness-cloud|Cloud of stillness|mage|5|hold-area|8|2|0|spells|3|A grey fog holds every foe it touches still.|',
    // ---- mage: sixth circle ----
    'chain-lightning|Chain lightning|mage|6|area|10|2|8d6|spells|0|Lightning leaps from foe to foe across the field.|',
    'ruin-bolt|Ruin bolt|mage|6|ray|10|0|10d6|spells|0|A bolt of purple light tears at one foe.|',
    'compel|Compel|mage|6|charm|8|0|0|spells|8|The foe becomes the caster’s loyal servant for a time.|',
    'soul-seize|Seize the soul|mage|6|hold|8|0|1d6|spells|5|A grey hand closes on the foe’s spirit and holds it.|',
    // ---- mage: seventh circle ----
    'fire-storm|Firestorm|mage|7|area|12|3|9d6|breath|0|Flame rains from above across a wide space.|',
    'finger-of-death|Finger of death|mage|7|slay|10|0|0|spells|0|A pointing finger; the foe falls dead unless it resists.|',
    'prism-flare|Prism flare|mage|7|area|10|2|9d4|spells|0|Bands of coloured light stun and burn the foes.|',
    'mind-blank|Mind ward|mage|7|shield|0|0|3|none|12|The company is shielded against mind-stealing magic and blows alike.|',
    // ---- mage: eighth circle ----
    'star-fall|Star fall|mage|8|area|12|2|10d6|breath|0|A falling star strikes the foes and scorches all around.|',
    'word-of-silence|Word of silence|mage|8|hold|8|0|0|none|3|A word of power cripples the foe if its wounds are light.|',
    'unravel|Unravel|mage|8|ray|10|0|12d6|spells|0|The foe’s body begins to come apart.|',
    'time-hold|Hold time|mage|8|hold-area|8|3|0|spells|3|The foes in the chosen space stop as if the moment froze.|',
    // ---- mage: ninth circle ----
    'storm-of-stars|Storm of stars|mage|9|area|14|3|12d6|breath|0|A storm of falling light covers the field.|',
    'time-rend|Rend the hour|mage|9|slay|10|0|0|spells|0|Time tears; the foe is cast out of the moment and perishes.|',
    'restore-hope|Restore the company|mage|9|utility|0|0|0|none|0|Every living member is made whole again.|restore',
    'banish-undead|Banish the dead|mage|9|smite-undead|10|4|10d6|none|0|The restless dead are unmade across a wide space.|',
    // ---- cleric: first circle ----
    'cure-light|Cure light wounds|cleric|1|heal|6|0|1d8+1|none|0|A warm light closes the wounds of an ally.|',
    'bless|Bless|cleric|1|bless|0|0|1|none|5|The company feels steadier and surer of its aim.|',
    'ward-faith|Ward of faith|cleric|1|shield|0|0|2|none|6|A ward of the faithful lies across the company.|',
    'dawn-light|Dawn light|cleric|1|utility|0|0|0|none|0|A gentle light of morning fills the room.|light',
    'command-word|Command|cleric|1|hold|6|0|0|spells|1|A single word of command halts a humanoid foe.|',
    'sense-evil|Sense evil|cleric|1|utility|0|0|0|none|0|The priest feels which foes are wicked.|sense-evil',
    // ---- cleric: second circle ----
    'hold-person|Hold person|cleric|2|hold|6|0|0|spells|3|The chosen humanoid stiffens and cannot move.|',
    'holy-hammer|Holy hammer|cleric|2|missile|8|0|1d8+1|none|0|A spectral hammer strikes one foe.|',
    'bark-skin|Bark skin|cleric|2|shield|0|0|3|none|8|The company’s skin thickens like bark.|',
    'mend|Mend|cleric|2|heal|6|0|2d8|none|0|Torn flesh knits itself together under the priest’s hands.|',
    'find-traps|Find traps|cleric|2|utility|0|0|0|none|0|The priest senses the snares that lie ahead.|detect-traps',
    // ---- cleric: third circle ----
    'flame-strike|Flame strike|cleric|3|area|8|1|6d8|breath|0|A column of holy fire descends on the foe.|',
    'cure-blight|Cure blight|cleric|3|cure|6|0|3d8|none|0|Paralysis and sickness drain away from an ally.|',
    'prayer|Prayer|cleric|3|bless|0|0|2|none|6|The company is lifted by a prayer for courage and sure aim.|',
    'dispel|Dispel|cleric|3|utility|0|0|0|none|0|The priest breaks up a lesser magic around the company.|',
    'wind-wall|Wind wall|cleric|3|shield|0|0|3|none|6|A wall of wind keeps the arrows and darts away.|',
    // ---- cleric: fourth circle ----
    'smite-sacred|Smite the restless|cleric|4|smite-undead|8|2|4d8|none|0|Undead within reach are struck by a holy light.|',
    'spiritual-bulwark|Spirit bulwark|cleric|4|shield|0|0|4|none|10|A guardian spirit stands beside the company.|',
    'restore-party|Restore company|cleric|4|heal-party|0|0|2d8|none|0|The company’s wounds close, though it is not made whole.|',
    'cure-serious|Cure serious wounds|cleric|4|heal|6|0|4d8|none|0|Deep wounds are closed by the priest’s prayer.|',
    // ---- cleric: fifth circle ----
    'sunburst|Sunburst|cleric|5|area|10|2|6d8|breath|0|A burst of sunlight scorches the foes and blinds the timid.|',
    'resurrect|Raise the fallen|cleric|5|utility|0|0|0|none|0|A dead ally is drawn back to life, weak but whole.|raise',
    'true-sight|True sight|cleric|5|utility|0|0|0|none|0|The priest sees through hidden doors and false walls.|find-doors',
    'mass-cure|Mass cure|cleric|5|heal-party|0|0|3d8|none|0|Every living member of the company is healed.|',
    // ---- cleric: sixth circle ----
    'word-of-healing|Word of healing|cleric|6|heal-party|0|0|6d8|none|0|A word of power heals every living member of the company.|',
    'blade-barrier|Blade barrier|cleric|6|area|8|1|8d8|breath|0|A wall of whirling blades cuts through all within it.|',
    'recall-to-town|Recall|cleric|6|utility|0|0|0|none|0|The company is drawn back to Thornwick.|recall',
    // ---- cleric: seventh circle ----
    'holy-storm|Holy storm|cleric|7|area|12|3|10d8|breath|0|A storm of divine light falls on the foes.|',
    'divine-judgment|Divine judgment|cleric|7|slay|10|0|0|spells|0|The foe is judged, and falls dead unless it resists.|',
    'regenerate|Regenerate|cleric|7|heal-party|0|0|4d8|none|0|Wounds and weariness fall away from the company.|'
  ];

  var SPELLS = {};
  ROWS.forEach(function (row) {
    var p = row.split('|');
    var s = {
      id: p[0], name: p[1], cls: p[2], level: parseInt(p[3], 10), kind: p[4],
      range: parseInt(p[5], 10), radius: parseInt(p[6], 10), dmg: p[7], save: p[8] === 'none' ? null : p[8],
      rounds: parseInt(p[9], 10), text: p[10], utility: p[11] || null
    };
    if (s.dmg === '0') s.dmg = null;
    if (SPELLS[s.id]) throw new Error('duplicate spell ' + s.id);
    SPELLS[s.id] = s;
  });

  // Dice for a caster of the given level: one extra die for every two levels above the spell's first level.
  function dice(sp, casterLevel) {
    if (!sp.dmg || !/^\d+d\d+/.test(sp.dmg)) return sp.dmg;
    var extra = Math.min(6, Math.floor(Math.max(0, casterLevel - (2 * sp.level - 1)) / 2));
    return EM.Mod.scaleDice(sp.dmg, extra);
  }

  // Missiles per cast: one more for every two caster levels.
  function missiles(casterLevel) { return 1 + Math.floor((casterLevel - 1) / 2); }

  // Out-of-combat effects. Returns a message for the log.
  function utility(id, caster, state) {
    var sp = SPELLS[id];
    var S = state;
    switch (sp.utility) {
      case 'light': return 'A cold light fills the area.';
      case 'read-magic': return 'The caster reads the old writing aloud.';
      case 'detect-traps':
      case 'find-doors':
        return 'The caster reads the stones: ' + (sp.utility === 'find-doors' ? 'hidden doors show themselves.' : 'the traps show themselves.');
      case 'sense-evil': return 'The priest senses no great evil near the company.';
      case 'scry': return 'A map of the level is written in the caster’s mind.';
      case 'recall': return 'The company is drawn back to Thornwick.';
      case 'restore':
        S.party.forEach(function (c) { if (c.status !== 'dead') { c.status = 'ok'; c.hp = c.hpMax; } });
        return 'Every living member is made whole.';
      case 'raise':
        var dead = S.party.filter(function (c) { return c.status === 'dead'; })[0];
        if (!dead) return 'There is no one to raise.';
        dead.status = 'ok'; dead.hp = 1;
        return dead.name + ' is drawn back from death.';
      default: return sp.name + ' has no effect out of combat.';
    }
  }

  // Spells a caster level can use, by circle: mages to 9, clerics to 7.
  function maxCircle(cls) { return cls === 'mage' ? 9 : 7; }

  return { ROWS: ROWS, SPELLS: SPELLS, dice: dice, missiles: missiles, utility: utility, maxCircle: maxCircle,
    count: ROWS.length };
})();

// Spells are read by the rules, combat and the data tables under EM.Data.SPELLS.
EM.Data.SPELLS = EM.Spells.SPELLS;

// Spell scrolls for every mage spell, so the list can be found and bought.
(function () {
  Object.keys(EM.Spells.SPELLS).forEach(function (id) {
    var sp = EM.Spells.SPELLS[id];
    if (sp.cls !== 'mage') return;
    EM.Data.ITEMS['scroll:' + id] = { name: 'Scroll: ' + sp.name.toLowerCase(), kind: 'spellscroll', spell: id,
      value: 60 * sp.level * sp.level + 40, classes: ['mage'] };
  });
})();
