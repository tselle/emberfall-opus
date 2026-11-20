/* treasure.js — treasure types and rolls. Each monster carries a treasure type letter (a–i); its hoard is rolled
   when the monster dies and lies on the ground where it fell (dungeon) or is gathered at once (wilds).
   Coins are in gold pieces. Gems and jewellery come from the item list by value tier. Magic items are drawn from the
   magic kinds in the item list. Type fields: coins dice, coins multiplier, gem dice and chance, jewel dice and chance,
   magic dice and chance, and the highest value tier allowed for gems and jewellery (1 low, 2 middle, 3 high). */
var EM = window.EM = window.EM || {};

EM.Treasure = (function () {
  var TYPES = {
    a: { coins: '1d6', mult: 10, gems: '0', gemChance: 0, jewels: '0', jewelChance: 0, magic: '0', magicChance: 0, tier: 1 },
    b: { coins: '2d6', mult: 10, gems: '1d2', gemChance: 25, jewels: '0', jewelChance: 0, magic: '0', magicChance: 0, tier: 1 },
    c: { coins: '1d10', mult: 25, gems: '1d4', gemChance: 30, jewels: '1d2', jewelChance: 15, magic: '0', magicChance: 0, tier: 1 },
    d: { coins: '2d6', mult: 50, gems: '1d6', gemChance: 40, jewels: '1d3', jewelChance: 25, magic: '1', magicChance: 10, tier: 2 },
    e: { coins: '3d6', mult: 100, gems: '1d8', gemChance: 45, jewels: '1d4', jewelChance: 30, magic: '1', magicChance: 25, tier: 2 },
    f: { coins: '2d4', mult: 500, gems: '1d4', gemChance: 40, jewels: '1d6', jewelChance: 40, magic: '1d2', magicChance: 30, tier: 2 },
    g: { coins: '4d6', mult: 1000, gems: '4d6', gemChance: 60, jewels: '1d10', jewelChance: 50, magic: '1d3', magicChance: 50, tier: 3 },
    h: { coins: '1d20', mult: 1000, gems: '4d6', gemChance: 70, jewels: '4d6', jewelChance: 60, magic: '2d4', magicChance: 50, tier: 3 },
    i: { coins: '1d4', mult: 5000, gems: '2d6', gemChance: 80, jewels: '2d8', jewelChance: 80, magic: '3d4', magicChance: 80, tier: 3 }
  };

  function gemsByTier(tier) {
    var out = [], I = EM.Data.ITEMS;
    Object.keys(I).forEach(function (id) {
      var it = I[id];
      if (it.kind !== 'gem') return;
      if (tier === 1 && it.value <= 50) out.push(id);
      if (tier === 2 && it.value <= 500) out.push(id);
      if (tier === 3) out.push(id);
    });
    return out;
  }

  function jewelsByTier(tier) {
    var out = [], I = EM.Data.ITEMS;
    Object.keys(I).forEach(function (id) {
      var it = I[id];
      if (it.kind !== 'jewel') return;
      if (tier === 1 && it.value <= 400) out.push(id);
      if (tier === 2 && it.value <= 3500) out.push(id);
      if (tier === 3) out.push(id);
    });
    return out;
  }

  var MAGIC_KINDS = ['wand', 'staff', 'ring', 'amulet', 'magic', 'potion', 'scroll'];
  function magicPool(tier) {
    var I = EM.Data.ITEMS;
    return Object.keys(I).filter(function (id) {
      var it = I[id];
      if (MAGIC_KINDS.indexOf(it.kind) < 0) return false;
      if (it.value <= 0) return false;
      if (tier === 1) return it.value <= 1500;
      if (tier === 2) return it.value <= 8000;
      return true;
    }).concat(Object.keys(I).filter(function (id) {
      var it = I[id];
      return (it.kind === 'weapon' || it.kind === 'armour' || it.kind === 'shield') && it.bonus > 0;
    }));
  }

  function roll(type, rnd) {
    rnd = rnd || EM.rand;
    var t = TYPES[type];
    var out = { gp: 0, items: [] };
    if (!t) return out;
    out.gp = EM.roll(t.coins, rnd) * t.mult;
    var n = EM.roll(t.gems, rnd);
    if (n && rnd() * 100 < t.gemChance) {
      var gp = gemsByTier(t.tier);
      for (var i = 0; i < n; i++) out.items.push(gp[Math.floor(rnd() * gp.length)]);
    }
    var j = EM.roll(t.jewels, rnd);
    if (j && rnd() * 100 < t.jewelChance) {
      var jp = jewelsByTier(t.tier);
      for (var k = 0; k < j; k++) out.items.push(jp[Math.floor(rnd() * jp.length)]);
    }
    var m = EM.roll(t.magic, rnd);
    if (m && rnd() * 100 < t.magicChance) {
      var mp = magicPool(t.tier);
      for (var q = 0; q < m; q++) out.items.push(mp[Math.floor(rnd() * mp.length)]);
    }
    return out;
  }

  // The hoard for a list of monster kinds that died. rnd is an optional seeded source.
  function hoardFor(kinds, rnd) {
    var out = { gp: 0, items: [] };
    kinds.forEach(function (kind) {
      var def = EM.Monsters.get(kind);
      if (!def || !def.treasure) return;
      var r = roll(def.treasure, rnd);
      out.gp += r.gp;
      out.items = out.items.concat(r.items);
    });
    return out;
  }

  return { TYPES: TYPES, roll: roll, hoardFor: hoardFor };
})();
