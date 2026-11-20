/* combat.js — turn-based tactical combat on an isometric field.
   Each round: a d6 initiative roll decides whether the company or the monsters act first. Each company member may
   move once and then take one action (melee, missile, spell, backstab, turn undead, potion, defend, or flee).
   Monsters act in turn with simple tactics; several attacks may be made in one turn. A group checks morale when it
   loses members; a broken group flees. The arena is 10 by 8 squares; the company starts on the left, monsters on the right. */
var EM = window.EM = window.EM || {};

EM.Combat = (function () {
  var R = EM.Rules, D = EM.Data, MOD = EM.Mod, MON = EM.Monsters;
  var COLS = 10, ROWS = 8, CW = 720, CH = 440;
  var TW = 84, TH = 42;
  var OX = CW / 2 - (COLS - ROWS) / 2 * TW / 2;
  var OY = CH / 2 - (COLS + ROWS - 2) / 2 * TH / 2;
  var PC_SPOTS = [[0, 1], [0, 3], [0, 5], [0, 7], [1, 2], [1, 6]];
  var MON_SPOTS = [[9, 1], [9, 3], [9, 5], [9, 7], [8, 2], [8, 4], [8, 6], [8, 0], [9, 0], [7, 7], [9, 2], [9, 4]];
  var PACE = 320;
  var FLEE_CHANCE = 45;
  var AREA_KINDS = { area: 1, sleep: 1, 'smite-undead': 1, 'hold-area': 1, 'fear-area': 1 };
  var PARTY_KINDS = { bless: 1, shield: 1, 'heal-party': 1 };

  var C = null;
  var cv = null, cx = null;
  var onEnd = null;
  var autoMode = false;
  var busy = false;

  // ---- geometry ---------------------------------------------------------------
  function dist(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function inside(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  function blocked(x, y) { return !inside(x, y) || C.terrain[y][x] === 'x'; }

  function los(ax, ay, bx, by) {
    var dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    var sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    var err = dx - dy, x = ax, y = ay;
    while (!(x === bx && y === by)) {
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === bx && y === by) break;
      if (C.terrain[y][x] === 'x') return false;
    }
    return true;
  }

  // The unit standing on a square. Fled and slain monsters no longer occupy it.
  function unitAt(x, y) {
    for (var i = 0; i < C.units.length; i++) {
      var u = C.units[i];
      if (u.x !== x || u.y !== y) continue;
      if (!isPC(u) && !active(u)) continue;
      return u;
    }
    return null;
  }

  function proj(x, y) { return { sx: (x - y) * TW / 2 + OX, sy: (x + y) * TH / 2 + OY }; }

  function cellFromPoint(px, py) {
    var a = (px - OX) / (TW / 2), b = (py - OY) / (TH / 2);
    return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
  }

  // ---- unit helpers ---------------------------------------------------------------
  function isPC(u) { return u.side === 'pc'; }
  function active(u) {
    if (isPC(u)) return u.c.status === 'ok';
    return !u.m.fled && u.m.hp > 0;
  }
  function pcs() { return C.units.filter(function (u) { return isPC(u); }); }
  function mons() { return C.units.filter(function (u) { return !isPC(u) && active(u); }); }
  function activePCs() { return pcs().filter(active); }
  function thac0Of(u) { return isPC(u) ? R.thac0(u.c.cls, u.c.level) : 21 - u.m.def.hd; }
  function acOf(u) {
    if (isPC(u)) {
      var armour = u.c.armour ? D.item(u.c.armour) : null;
      var shield = u.c.shield ? D.item(u.c.shield) : null;
      return R.armourClass(u.c, armour, shield) - (C.shielded > 0 ? C.shieldBonus : 0);
    }
    return u.m.def.ac;
  }
  function moveRange(u) { return Math.max(2, Math.round(6 * R.RACES[u.c.race].moveFactor)); }

  function reachable(u, maxSteps) {
    var out = {}, frontier = [{ x: u.x, y: u.y, d: 0 }];
    out[u.x + ',' + u.y] = 0;
    while (frontier.length) {
      var cur = frontier.shift();
      if (cur.d >= maxSteps) continue;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cur.x + dx, ny = cur.y + dy, k = nx + ',' + ny;
        if (out[k] !== undefined || blocked(nx, ny) || unitAt(nx, ny)) continue;
        out[k] = cur.d + 1;
        frontier.push({ x: nx, y: ny, d: cur.d + 1 });
      }
    }
    return out;
  }

  // ---- arena -------------------------------------------------------------------------
  function buildArena(party, group) {
    var rnd = MOD.rng(group.x * 131 + group.y * 17 + (group.n || 1));
    C.terrain = [];
    for (var y = 0; y < ROWS; y++) {
      var row = [];
      for (var x = 0; x < COLS; x++) {
        var wall = x >= 3 && x <= 6 && rnd() < 0.14;
        row.push(wall ? 'x' : '.');
      }
      C.terrain.push(row);
    }
    C.units = [];
    var live = party.filter(function (c) { return c.status !== 'dead'; });
    live.forEach(function (c, i) {
      var s = PC_SPOTS[i % PC_SPOTS.length];
      C.units.push({ side: 'pc', c: c, x: s[0], y: s[1], moved: false, paralyzed: 0 });
      C.terrain[s[1]][s[0]] = '.';
    });
    group.instances.forEach(function (m, i) {
      var s = MON_SPOTS[i % MON_SPOTS.length];
      C.terrain[s[1]][s[0]] = '.';
      C.units.push({ side: 'mon', m: m, x: s[0], y: s[1] });
    });
  }

  // ---- drawing -----------------------------------------------------------------------
  function hueFor(kind) { return 'hsl(' + (MOD.hash(kind) % 360) + ',55%,48%)'; }

  function draw() {
    if (!cx || !C) return;
    cx.fillStyle = '#17130f';
    cx.fillRect(0, 0, CW, CH);
    var hl = highlightSet();
    for (var s = 0; s <= COLS + ROWS - 2; s++) {
      for (var x = 0; x < COLS; x++) {
        var y = s - x;
        if (y < 0 || y >= ROWS) continue;
        var p = proj(x, y);
        var ground = (x + y) % 2 ? '#3f5a33' : '#49653a';
        var k = x + ',' + y;
        if (hl[k] === 'move') ground = '#3d6a8a';
        else if (hl[k] === 'target') ground = '#8a6f2a';
        else if (hl[k] === 'area') ground = '#7a4a2e';
        diamond(p.sx, p.sy, ground, '#1e2a18');
        if (C.terrain[y][x] === 'x') block(p.sx, p.sy);
        var u = unitAt(x, y);
        if (u) unitSprite(u, p.sx, p.sy);
      }
    }
    if (C.lastEffect) {
      var e = proj(C.lastEffect.x, C.lastEffect.y);
      cx.fillStyle = 'rgba(255,230,120,' + (0.6 * C.lastEffect.t) + ')';
      cx.beginPath(); cx.arc(e.sx, e.sy, TW * 0.35, 0, Math.PI * 2); cx.fill();
    }
  }

  function diamond(sx, sy, fill, stroke) {
    cx.beginPath();
    cx.moveTo(sx, sy - TH / 2); cx.lineTo(sx + TW / 2, sy); cx.lineTo(sx, sy + TH / 2); cx.lineTo(sx - TW / 2, sy);
    cx.closePath();
    cx.fillStyle = fill; cx.fill();
    cx.strokeStyle = stroke; cx.lineWidth = 1; cx.stroke();
  }

  function block(sx, sy) {
    var h = 30;
    cx.fillStyle = '#5b5751';
    cx.beginPath();
    cx.moveTo(sx - TW / 2, sy); cx.lineTo(sx, sy + TH / 2); cx.lineTo(sx, sy + TH / 2 - h); cx.lineTo(sx - TW / 2, sy - h);
    cx.closePath(); cx.fill();
    cx.fillStyle = '#433f3a';
    cx.beginPath();
    cx.moveTo(sx + TW / 2, sy); cx.lineTo(sx, sy + TH / 2); cx.lineTo(sx, sy + TH / 2 - h); cx.lineTo(sx + TW / 2, sy - h);
    cx.closePath(); cx.fill();
    diamond(sx, sy - h, '#7c776e', '#2a2723');
  }

  function unitSprite(u, sx, sy) {
    var r = TW * 0.19, cy = sy - TH * 0.35;
    var down = isPC(u) ? u.c.status !== 'ok' : false;
    var fill = isPC(u) ? (down ? '#666' : '#3f78c4') : hueFor(u.m.kind);
    if (!isPC(u) && u.m.asleep) fill = '#6b6b78';
    if (!isPC(u) && u.m.charmed > 0) fill = '#8a4fb0';
    cx.beginPath(); cx.arc(sx, cy, r, 0, Math.PI * 2);
    cx.fillStyle = fill; cx.fill();
    cx.strokeStyle = (C.actor === u) ? '#ffffff' : '#120e0a';
    cx.lineWidth = C.actor === u ? 3 : 2; cx.stroke();
    cx.fillStyle = '#fff8e8';
    cx.font = 'bold ' + Math.round(r * 1.1) + 'px Georgia, serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    var label = isPC(u) ? u.c.name.charAt(0) : u.m.def.name.charAt(0);
    cx.fillText(down ? 'x' : label, sx, cy + 1);
    var hp = isPC(u) ? Math.max(0, u.c.hp) : Math.max(0, u.m.hp);
    var mx = isPC(u) ? u.c.hpMax : u.m.hpMax;
    var w = TW * 0.5, pct = Math.max(0, Math.min(1, hp / mx));
    cx.fillStyle = '#2a1d14'; cx.fillRect(sx - w / 2, cy - r - 8, w, 5);
    cx.fillStyle = isPC(u) ? '#7fd17f' : '#e0604a';
    cx.fillRect(sx - w / 2, cy - r - 8, w * pct, 5);
  }

  function highlightSet() {
    var out = {};
    if (C && C.pending) {
      validCells(C.pending).forEach(function (c) { out[c.x + ',' + c.y] = c.kind || 'target'; });
    }
    return out;
  }

  // ---- what an action may target -----------------------------------------------
  function enemiesIn(range, from) {
    return mons().filter(function (m) { return dist(from.x, from.y, m.x, m.y) <= range && los(from.x, from.y, m.x, m.y); });
  }

  function spellTargets(a, sp) {
    var out = [];
    var rng = sp.range || 0;
    if (PARTY_KINDS[sp.kind]) return out;
    if (sp.kind === 'heal' || sp.kind === 'cure') {
      pcs().forEach(function (u) {
        if (u.c.status !== 'dead' && dist(a.x, a.y, u.x, u.y) <= Math.max(1, rng) && los(a.x, a.y, u.x, u.y)) out.push({ x: u.x, y: u.y });
      });
      return out;
    }
    if (AREA_KINDS[sp.kind]) {
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        if (dist(a.x, a.y, x, y) <= rng && los(a.x, a.y, x, y)) out.push({ x: x, y: y, kind: 'area' });
      }
      return out;
    }
    mons().forEach(function (m) {
      if (dist(a.x, a.y, m.x, m.y) > rng || !los(a.x, a.y, m.x, m.y)) return;
      if (sp.kind === 'hold' && !m.m.def.humanoid) return;
      if ((sp.kind === 'charm' || sp.kind === 'slay') && m.m.def.undead) return;
      out.push({ x: m.x, y: m.y });
    });
    return out;
  }

  function validCells(p) {
    var a = C.actor, out = [];
    if (!a || !p) return out;
    if (p.type === 'move') {
      var r = reachable(a, moveRange(a));
      Object.keys(r).forEach(function (k) { if (r[k] > 0) { var q = k.split(','); out.push({ x: +q[0], y: +q[1], kind: 'move' }); } });
    } else if (p.type === 'melee' || p.type === 'backstab') {
      mons().forEach(function (m) {
        if (dist(a.x, a.y, m.x, m.y) !== 1) return;
        if (p.type === 'backstab' && !flanked(m)) return;
        out.push({ x: m.x, y: m.y });
      });
    } else if (p.type === 'missile') {
      enemiesIn(weaponRange(a), a).forEach(function (m) { out.push({ x: m.x, y: m.y }); });
    } else if (p.type === 'turn') {
      mons().forEach(function (m) {
        if (m.m.def.undead && dist(a.x, a.y, m.x, m.y) <= 6 && los(a.x, a.y, m.x, m.y)) out.push({ x: m.x, y: m.y });
      });
    } else if (p.type === 'heal') {
      var range = p.range || 2;
      pcs().forEach(function (u) { if (dist(a.x, a.y, u.x, u.y) <= range) out.push({ x: u.x, y: u.y }); });
    } else if (p.type === 'spell') {
      out = spellTargets(a, D.SPELLS[p.spell]);
    }
    return out;
  }

  function flanked(m) {
    // A monster is flanked when another company member stands next to it, or it cannot defend itself.
    if (m.m.asleep || m.m.paralyzed > 0 || m.m.charmed > 0) return true;
    return activePCs().some(function (u) { return u.c !== C.actor.c && dist(u.x, u.y, m.x, m.y) === 1; });
  }

  function weaponOf(a) { return a.c.weapon ? D.item(a.c.weapon) : null; }
  function weaponRange(a) {
    var w = weaponOf(a);
    if (!w || !w.missile) return 0;
    return /long-bow|heavy-crossbow/.test(a.c.weapon || '') ? 9 : 6;
  }

  // ---- attack rules ----------------------------------------------------------------
  function rollHit(bonus, thac0, targetAC) {
    var roll = 1 + Math.floor(EM.rand() * 20);
    if (roll === 20) return true;
    if (roll === 1) return false;
    return roll + bonus >= thac0 - targetAC;
  }

  function say(text, cls) {
    C.log.push({ text: text, cls: cls || '' });
    var box = document.getElementById('cblog');
    if (box) {
      box.appendChild(EM.Mod.el('div', { class: 'logline ' + (cls || ''), text: text }));
      box.scrollTop = box.scrollHeight;
    }
  }

  function effect(u) { C.lastEffect = { x: u.x, y: u.y, t: 1 }; }

  function hurtMonster(m, dmg, label) {
    m.hp -= dmg;
    m.asleep = false;
    if (m.hp <= 0) {
      say(label + (m.def.undead ? ' destroys ' : ' slays ') + m.def.name.toLowerCase() + '.', 'find');
      C.lost.mon++;
      C.killed.push(m.kind);
    }
  }

  // Melee or missile from a company member.
  function pcStrike(a, target, opts) {
    opts = opts || {};
    var c = a.c, w = weaponOf(a);
    var spec = R.specBonus(c);
    var bonus = (opts.missile ? 0 : R.strHit(c.abil.STR)) + spec.hit + ((w && w.bonus) || 0) + (C.blessed ? 1 : 0) + (opts.bonus || 0);
    if (opts.missile && c.abil.DEX >= 16) bonus += 1;
    if (!rollHit(bonus, thac0Of(a), target.m.def.ac)) {
      say(c.name + ' misses the ' + target.m.def.name.toLowerCase() + '.');
      target.m.asleep = false;
      return false;
    }
    var dmg = MOD.roll((w && w.dmg) || '1d2', EM.rand) + (opts.missile ? 0 : R.strDmg(c.abil.STR) + spec.dmg + ((w && w.bonus) || 0));
    if (opts.mult) dmg *= opts.mult;
    var magic = !!(w && w.bonus);
    if (target.m.def.resist === 'nonmagic' && !magic) dmg = Math.floor(dmg / 2);
    dmg = Math.max(1, dmg);
    say(c.name + ' hits the ' + target.m.def.name.toLowerCase() + ' for ' + dmg + (opts.label ? ' (' + opts.label + ')' : '') + '.');
    effect(target);
    hurtMonster(target.m, dmg, c.name);
    return true;
  }

  // Monster attacks: several attacks may be made in one turn (separated by slashes), each with its own roll.
  function monsterStrike(m, target) {
    var d = m.m.def;
    d.dmg.split('/').forEach(function (spec) {
      if (!target || target.c.status === 'dead' || target.c.status === 'unconscious') return;
      var ac = acOf(target);
      var roll = 1 + Math.floor(EM.rand() * 20);
      var hit = roll === 20 || (roll !== 1 && roll >= (21 - d.hd) - ac);
      if (!hit) { say(d.name + ' misses ' + target.c.name + '.'); return; }
      var dmg = Math.max(1, MOD.roll(spec, EM.rand));
      if (m.m.weakened > 0) dmg = Math.max(1, Math.floor(dmg / 2));
      R.harm(target.c, dmg);
      say(d.name + ' hits ' + target.c.name + ' for ' + dmg + '.', 'hurt');
      if (d.poison && target.c.status !== 'dead' && !R.saveRoll(target.c, 'death')) {
        var p = MOD.roll('2d6', EM.rand);
        R.harm(target.c, p);
        say('The poison burns for ' + p + ' more damage!', 'hurt');
      }
      if (d.paralyze && target.c.status === 'ok' && !R.saveRoll(target.c, 'death')) {
        target.paralyzed = 2;
        say(target.c.name + ' is paralysed by the touch!', 'hurt');
      }
      if (d.drain && target.c.status !== 'dead' && !R.saveRoll(target.c, 'spells')) {
        drainLevel(target.c);
        say(target.c.name + ' loses a level to the touch!', 'hurt');
      }
      if (target.c.status === 'unconscious') say(target.c.name + ' falls unconscious.', 'hurt');
      if (target.c.status === 'dead') say(target.c.name + ' is dead.', 'hurt');
    });
  }

  function drainLevel(c) {
    if (c.level <= 1) { c.hpMax = Math.max(1, c.hpMax - 1); c.hp = Math.min(c.hp, c.hpMax); return; }
    c.level -= 1;
    c.xp = R.XP[c.cls][c.level - 1];
    var lose = Math.max(1, Math.floor(c.hpMax / (c.level + 1)));
    c.hpMax = Math.max(1, c.hpMax - lose);
    c.hp = Math.min(c.hp, c.hpMax);
  }

  // ---- spells ------------------------------------------------------------------------
  // A foe's saving throw: a d20 roll against a number that falls as the foe's hit dice rise.
  function monSave(u) {
    var target = Math.max(4, 16 - u.m.def.hd * 2);
    return Math.floor(EM.rand() * 20) + 1 >= target;
  }

  function hurtArea(u, dmg, caster) {
    if (u.m.def.swarm) dmg = Math.max(1, Math.floor(dmg / 2));
    effect(u);
    hurtMonster(u.m, dmg, caster);
  }

  // Casts a memorized spell at a square (or on the company). The spell is used up.
  function castAt(a, spellId, x, y) {
    var sp = D.SPELLS[spellId];
    var memo = a.c.memo || [];
    var idx = memo.indexOf(spellId);
    if (idx < 0) { say(a.c.name + ' has no memorized ' + sp.name + '.'); return false; }
    memo.splice(idx, 1);
    say(a.c.name + ' casts ' + sp.name.toLowerCase() + '.', 'find');
    var cell = unitAt(x, y);
    var lvl = a.c.level;
    var dice = EM.Spells.dice(sp, lvl);
    var foes, n, i, total;
    switch (sp.kind) {
      case 'bless':
        C.blessed = Math.max(C.blessed, sp.rounds);
        say('The company is blessed.');
        return true;
      case 'shield':
        C.shielded = Math.max(C.shielded, sp.rounds);
        C.shieldBonus = Math.max(C.shieldBonus, parseInt(sp.dmg, 10) || 2);
        say('A ward settles over the company.');
        return true;
      case 'heal':
        if (cell && isPC(cell) && cell.c.status !== 'dead') say(cell.c.name + ' is healed for ' + R.heal(cell.c, MOD.roll(dice, EM.rand)) + '.');
        return true;
      case 'cure':
        if (cell && isPC(cell) && cell.c.status !== 'dead') {
          cell.paralyzed = 0;
          say(cell.c.name + ' is cured for ' + R.heal(cell.c, MOD.roll(dice, EM.rand)) + '.');
        }
        return true;
      case 'heal-party':
        pcs().forEach(function (u) {
          if (u.c.status === 'dead') return;
          var got = R.heal(u.c, MOD.roll(dice, EM.rand));
          if (got) say(u.c.name + ' is healed for ' + got + '.');
        });
        return true;
      case 'missile':
        n = EM.Spells.missiles(lvl);
        for (i = 0; i < n; i++) {
          var t = unitAt(x, y);
          if (!t || isPC(t) || !active(t)) break;
          var dmg = MOD.roll(dice, EM.rand);
          say('A missile of force strikes the ' + t.m.def.name.toLowerCase() + ' for ' + dmg + '.');
          effect(t);
          hurtMonster(t.m, dmg, a.c.name);
        }
        return true;
      case 'ray':
        if (cell && !isPC(cell) && active(cell)) {
          var rd = MOD.roll(dice, EM.rand);
          if (sp.save && monSave(cell)) rd = Math.floor(rd / 2);
          hurtArea(cell, Math.max(1, rd), a.c.name);
        }
        return true;
      case 'area':
        foes = mons().filter(function (m) { return dist(x, y, m.x, m.y) <= sp.radius; });
        total = 0;
        foes.forEach(function (m) {
          var d1 = MOD.roll(dice, EM.rand);
          if (sp.save && monSave(m)) d1 = Math.floor(d1 / 2);
          total++;
          hurtArea(m, Math.max(1, d1), a.c.name);
        });
        say(total ? sp.name + ' catches ' + total + ' foe' + (total === 1 ? '' : 's') + '.' : sp.name + ' strikes nothing.');
        effect({ x: x, y: y });
        return true;
      case 'smite-undead':
        foes = mons().filter(function (m) { return m.m.def.undead && dist(x, y, m.x, m.y) <= sp.radius; });
        foes.forEach(function (m) { hurtArea(m, MOD.roll(dice, EM.rand), a.c.name); });
        say(foes.length ? 'The restless dead are scorched (' + foes.length + ').' : 'No undead are touched by the light.');
        effect({ x: x, y: y });
        return true;
      case 'sleep':
        // The dice give a budget of hit dice; the nearest foes fall asleep first.
        var budget = MOD.roll(dice, EM.rand);
        mons().filter(function (m) { return dist(x, y, m.x, m.y) <= sp.radius; })
          .sort(function (p, q) { return p.m.def.hd - q.m.def.hd; })
          .forEach(function (m) {
            if (m.m.def.undead || m.m.def.sleepProof || m.m.def.hd > budget) return;
            budget -= m.m.def.hd;
            m.m.asleep = true;
            say('The ' + m.m.def.name.toLowerCase() + ' falls asleep.');
          });
        effect({ x: x, y: y });
        return true;
      case 'hold':
        if (!cell || isPC(cell) || !active(cell)) return true;
        if (!cell.m.def.humanoid || cell.m.def.undead) { say('The spell has no effect.'); return true; }
        if (!monSave(cell)) { cell.m.paralyzed = sp.rounds; say('The ' + cell.m.def.name.toLowerCase() + ' is held fast.'); }
        else say('The ' + cell.m.def.name.toLowerCase() + ' resists.');
        return true;
      case 'hold-area':
        mons().forEach(function (m) {
          if (dist(x, y, m.x, m.y) > sp.radius || m.m.def.sleepProof) return;
          if (!monSave(m)) m.m.paralyzed = sp.rounds;
        });
        effect({ x: x, y: y });
        say('Foes in the spell’s reach are held still.');
        return true;
      case 'charm':
        if (!cell || isPC(cell) || !active(cell) || cell.m.def.undead) return true;
        if (!monSave(cell)) { cell.m.charmed = sp.rounds; say('The ' + cell.m.def.name.toLowerCase() + ' is charmed and will not fight.'); }
        else say('The ' + cell.m.def.name.toLowerCase() + ' shrugs off the charm.');
        return true;
      case 'slay':
        if (!cell || isPC(cell) || !active(cell) || cell.m.def.undead) { say('The spell has no effect.'); return true; }
        if (!monSave(cell)) { cell.m.hp = 0; say('The ' + cell.m.def.name.toLowerCase() + ' falls dead!', 'find'); C.lost.mon++; C.killed.push(cell.m.kind); }
        else say('The ' + cell.m.def.name.toLowerCase() + ' resists the death spell.');
        return true;
      case 'weaken':
        if (!cell || isPC(cell) || !active(cell)) return true;
        if (!monSave(cell)) { cell.m.weakened = sp.rounds; say('The ' + cell.m.def.name.toLowerCase() + ' loses its strength.'); }
        return true;
      case 'slow':
        if (!cell || isPC(cell) || !active(cell)) return true;
        if (!monSave(cell)) { cell.m.slowed = sp.rounds; say('The ' + cell.m.def.name.toLowerCase() + ' moves as if through water.'); }
        return true;
      case 'fear-area':
        mons().forEach(function (m) {
          if (dist(x, y, m.x, m.y) > sp.radius) return;
          if (!monSave(m)) { m.m.feared = 3; say('The ' + m.m.def.name.toLowerCase() + ' breaks and runs.'); }
        });
        effect({ x: x, y: y });
        return true;
      default:
        say(sp.name + ' has no effect in battle.');
        return true;
    }
  }

  // ---- company actions ------------------------------------------------------------
  // Each returns true when the action ends the actor's turn.
  function execute(p, x, y) {
    var a = C.actor;
    if (p.type === 'move') {
      var r = reachable(a, moveRange(a));
      if (!r[x + ',' + y]) return false;
      a.x = x; a.y = y; a.moved = true;
      say(a.c.name + ' moves.');
      return false;
    }
    if (p.type === 'melee' || p.type === 'backstab') {
      var t = unitAt(x, y);
      if (!t) return false;
      if (p.type === 'backstab') {
        var mult = a.c.level <= 4 ? 2 : a.c.level <= 8 ? 3 : 4;
        pcStrike(a, t, { bonus: 4, mult: mult, label: 'backstab' });
      } else {
        pcStrike(a, t);
      }
      return true;
    }
    if (p.type === 'missile') {
      var mt = unitAt(x, y);
      if (mt) pcStrike(a, mt, { missile: true });
      return true;
    }
    if (p.type === 'turn') {
      var u = unitAt(x, y);
      if (u) turnUndead(a, u);
      return true;
    }
    if (p.type === 'heal') {
      var hu = unitAt(x, y);
      if (hu && isPC(hu) && EM.Game.takeItem(p.item)) {
        var got = R.heal(hu.c, MOD.roll(D.item(p.item).heal, EM.rand));
        say(a.c.name + ' gives ' + hu.c.name + ' a ' + D.item(p.item).name.toLowerCase() + ': +' + got + ' hit points.');
      }
      return true;
    }
    if (p.type === 'spell') {
      var sp = D.SPELLS[p.spell];
      if (PARTY_KINDS[sp.kind]) return castAt(a, p.spell, a.x, a.y);
      return castAt(a, p.spell, x, y);
    }
    return false;
  }

  function turnUndead(a, u) {
    var lvl = R.turnLevel(a.c);
    if (!lvl) { say(a.c.name + ' cannot turn undead.'); return; }
    var diff = lvl - u.m.def.turn;
    if (diff >= 3) {
      say(a.c.name + ' destroys the ' + u.m.def.name.toLowerCase() + '!', 'find');
      u.m.hp = 0; C.lost.mon++; C.killed.push(u.m.kind); effect(u);
      return;
    }
    var chance = Math.max(5, Math.min(95, 50 + diff * 15));
    if (EM.rand() * 100 < chance) {
      say(a.c.name + ' turns the ' + u.m.def.name.toLowerCase() + '. It flees!', 'find');
      u.m.fled = true;
      C.lost.mon++;
    } else {
      say(a.c.name + ' fails to turn the ' + u.m.def.name.toLowerCase() + '.');
    }
  }

  // ---- automatic company decisions (used by auto-fight) -----------------------------
  function usableSpells(a) {
    var seen = {};
    return (a.c.memo || []).filter(function (id) {
      if (seen[id]) return false;
      seen[id] = true;
      return D.SPELLS[id] && D.SPELLS[id].kind !== 'utility';
    });
  }

  function bestSpellPlan(a) {
    var order = usableSpells(a).sort(function (p, q) { return D.SPELLS[q].level - D.SPELLS[p].level; });
    for (var i = 0; i < order.length; i++) {
      var sid = order[i], sp = D.SPELLS[sid];
      if (sp.kind === 'heal' || sp.kind === 'cure' || sp.kind === 'heal-party') continue;
      if (PARTY_KINDS[sp.kind]) {
        if (sp.kind === 'bless' && C.blessed > 0) continue;
        if (sp.kind === 'shield' && C.shielded > 0) continue;
        return { spell: sid, x: a.x, y: a.y, party: true };
      }
      var cells = spellTargets(a, sp);
      if (AREA_KINDS[sp.kind]) {
        var best = null, bestN = 0;
        cells.forEach(function (c) {
          var n = mons().filter(function (m) { return dist(c.x, c.y, m.x, m.y) <= sp.radius; }).length;
          if (n > bestN) { bestN = n; best = c; }
        });
        if (best && bestN >= 2) return { spell: sid, x: best.x, y: best.y };
        continue;
      }
      if (cells.length) return { spell: sid, x: cells[0].x, y: cells[0].y };
    }
    return null;
  }

  function autoAct(a) {
    // Healing first.
    var hurt = activePCs().filter(function (u) { return u.c.hp < u.c.hpMax * 0.4; });
    var heals = usableSpells(a).filter(function (id) { return D.SPELLS[id].kind === 'heal' || D.SPELLS[id].kind === 'cure'; });
    if (hurt.length && heals.length) {
      var tgt = hurt[0];
      var hsp = D.SPELLS[heals[0]];
      if (dist(a.x, a.y, tgt.x, tgt.y) <= Math.max(1, hsp.range) && los(a.x, a.y, tgt.x, tgt.y)) {
        execute({ type: 'spell', spell: heals[0] }, tgt.x, tgt.y);
        return true;
      }
    }
    var party = usableSpells(a).filter(function (id) { return D.SPELLS[id].kind === 'heal-party'; });
    if (party.length && activePCs().filter(function (u) { return u.c.hp < u.c.hpMax * 0.5; }).length >= 2) {
      execute({ type: 'spell', spell: party[0] }, a.x, a.y);
      return true;
    }
    var plan = bestSpellPlan(a);
    if (plan) {
      execute({ type: 'spell', spell: plan.spell }, plan.x, plan.y);
      return true;
    }
    if (R.turnLevel(a.c)) {
      var und = mons().filter(function (m) { return m.m.def.undead && dist(a.x, a.y, m.x, m.y) <= 6 && los(a.x, a.y, m.x, m.y); })[0];
      if (und) { execute({ type: 'turn' }, und.x, und.y); return true; }
    }
    var adj = mons().filter(function (m) { return dist(a.x, a.y, m.x, m.y) === 1; });
    if (a.c.cls === 'thief') {
      var fl = adj.filter(flanked)[0];
      if (fl) { execute({ type: 'backstab' }, fl.x, fl.y); return true; }
    }
    if (adj.length) { execute({ type: 'melee' }, adj[0].x, adj[0].y); return true; }
    var shots = enemiesIn(weaponRange(a), a);
    if (weaponRange(a) && shots.length) { execute({ type: 'missile' }, shots[0].x, shots[0].y); return true; }
    // Move toward the nearest foe; a move ends the turn, so the next turn can strike.
    if (!a.moved) {
      var foes = mons();
      if (!foes.length) return true;
      var r = reachable(a, moveRange(a)), best2 = null, bestScore = 1e9;
      Object.keys(r).forEach(function (k) {
        var q = k.split(',').map(Number);
        var d = Math.min.apply(null, foes.map(function (f) { return dist(q[0], q[1], f.x, f.y); }));
        var score = d * 10 + r[k];
        if (score < bestScore) { bestScore = score; best2 = q; }
      });
      if (best2 && (best2[0] !== a.x || best2[1] !== a.y)) {
        a.x = best2[0]; a.y = best2[1]; a.moved = true;
        say(a.c.name + ' closes in.');
      }
      adj = mons().filter(function (m) { return dist(a.x, a.y, m.x, m.y) === 1; });
      if (adj.length) execute({ type: 'melee' }, adj[0].x, adj[0].y);
      return true;
    }
    say(a.c.name + ' waits.');
    return true;
  }

  // ---- monsters ----------------------------------------------------------------------
  function monsterAct(u) {
    var m = u.m, d = m.def;
    if (m.fled || m.hp <= 0) return;
    if (m.asleep) return;
    if (m.paralyzed > 0 || m.charmed > 0) return;
    if (m.slowed > 0 && (C.round % 2 === 0)) return;
    if (d.regen && m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + d.regen);
    if (m.breathCd > 0) m.breathCd--;
    var targets = activePCs();
    if (!targets.length) return;
    var nearest = targets.slice().sort(function (p, q) { return dist(u.x, u.y, p.x, p.y) - dist(u.x, u.y, q.x, q.y); })[0];
    if (m.feared > 0) {
      // A frightened foe keeps its distance from the nearest company member.
      var rr = reachable(u, d.move), away = null, far = -1;
      Object.keys(rr).forEach(function (k) {
        var q = k.split(',').map(Number), dd = dist(q[0], q[1], nearest.x, nearest.y);
        if (dd > far) { far = dd; away = q; }
      });
      if (away) { u.x = away[0]; u.y = away[1]; }
      return;
    }
    if (d.breath && m.breathCd <= 0) {
      var far2 = targets.filter(function (t) { return dist(u.x, u.y, t.x, t.y) <= 4 && los(u.x, u.y, t.x, t.y); })[0];
      if (far2 && EM.rand() < 0.6) {
        say(d.name + ' breathes fire!', 'hurt');
        effect(far2);
        targets.forEach(function (t) {
          if (dist(far2.x, far2.y, t.x, t.y) > 1) return;
          var dmg = Math.max(1, Math.ceil(m.hp / 3));
          if (R.saveRoll(t.c, 'breath')) dmg = Math.floor(dmg / 2);
          R.harm(t.c, dmg);
          say(t.c.name + ' takes ' + dmg + ' fire damage.', 'hurt');
        });
        m.breathCd = 4;
        return;
      }
    }
    var adj = targets.filter(function (t) { return dist(u.x, u.y, t.x, t.y) === 1; });
    if (adj.length) {
      monsterStrike(u, adj[Math.floor(EM.rand() * adj.length)]);
      return;
    }
    // Move toward the nearest company member; a move ends the turn.
    var r = reachable(u, d.move), best = null, bestScore = 1e9;
    Object.keys(r).forEach(function (k) {
      var q = k.split(',').map(Number);
      var sc = dist(q[0], q[1], nearest.x, nearest.y) * 10 + r[k];
      if (sc < bestScore) { bestScore = sc; best = q; }
    });
    if (best && (best[0] !== u.x || best[1] !== u.y)) {
      u.x = best[0]; u.y = best[1];
      say(d.name + ' advances.');
    }
  }

  // ---- round flow ------------------------------------------------------------------------
  function start(opts) {
    // opts: party (characters), group ({kind,n,x,y}), ambush (bool), done (callback(result))
    C = {
      round: 0, units: [], terrain: null, log: [], actor: null, actorIdx: -1,
      pending: null, moved: false, monstersFirst: !!opts.ambush, lastEffect: null,
      blessed: 0, shielded: 0, shieldBonus: 0, lost: { mon: 0, pc: 0 }, killed: [],
      group: opts.group, party: opts.party, over: false
    };
    C.group.instances = MON.spawn(C.group.kind, C.group.n, MOD.rng(C.group.x * 97 + C.group.y * 7 + 3));
    buildArena(opts.party, { x: C.group.x, y: C.group.y, n: C.group.n, instances: C.group.instances });
    onEnd = opts.done;
    cv = document.getElementById('iso');
    cx = cv.getContext('2d');
    cv.width = CW; cv.height = CH;
    var box = document.getElementById('cblog');
    if (box) box.innerHTML = '';
    EM.UI.showScreen('combat');
    if (EM.Bestiary) { EM.Bestiary.met(C.group.kind); EM.Bestiary.fought(C.group.kind); }
    var foe = C.group.n + ' ' + MON.name(C.group.kind, C.group.n).toLowerCase();
    say('Battle! ' + (opts.ambush ? 'The ' + foe + ' spring from hiding. The company is surprised.' : 'The company meets ' + foe + '.'), 'find');
    cv.onclick = onCanvasClick;
    beginRound();
  }

  function beginRound() {
    if (C.over) return;
    C.round++;
    C.lastEffect = null;
    C.lost = { mon: 0, pc: 0 };
    var pcRoll = 1 + Math.floor(EM.rand() * 6), mRoll = 1 + Math.floor(EM.rand() * 6);
    if (C.round === 1 && C.monstersFirst) mRoll = 99;
    if (pcRoll === mRoll) { C.monstersFirst = false; } else { C.monstersFirst = mRoll > pcRoll; }
    say('Round ' + C.round + '. Initiative: company ' + pcRoll + ', monsters ' + (mRoll === 99 ? 'ambush' : mRoll) + '.');
    if (C.monstersFirst) runMonsters(beginPartyPhase);
    else beginPartyPhase();
    render();
  }

  function beginPartyPhase() {
    if (checkEnd()) return;
    C.actorIdx = -1;
    nextActor();
  }

  function nextActor() {
    if (C.over) return;
    C.pending = null;
    C.actorIdx++;
    var list = pcs();
    while (C.actorIdx < list.length && !active(list[C.actorIdx])) C.actorIdx++;
    if (C.actorIdx >= list.length) {
      C.actor = null;
      render();
      // Monsters that won initiative already acted this round; the round ends with the company.
      if (C.monstersFirst) {
        endRound();
        if (!checkEnd()) beginRound();
        return;
      }
      runMonsters(function () {
        endRound();
        if (!checkEnd()) beginRound();
      });
      return;
    }
    C.actor = list[C.actorIdx];
    C.actor.moved = false;
    if (C.actor.paralyzed > 0) {
      C.actor.paralyzed--;
      say(C.actor.c.name + ' is still paralysed.');
      return nextActor();
    }
    render();
    if (autoMode) setTimeout(autoTurn, PACE);
  }

  function autoTurn() {
    if (C.over || !C.actor || busy) return;
    var a = C.actor;
    var ended = autoAct(a);
    render();
    if (ended) setTimeout(nextActor, PACE);
    else if (autoMode) setTimeout(autoTurn, PACE);
  }

  function runMonsters(then) {
    var list = mons();
    busy = true;
    var i = 0;
    (function step() {
      if (C.over) { busy = false; return; }
      if (i >= list.length) {
        busy = false;
        render();
        return then();
      }
      var u = list[i++];
      if (active(u)) {
        monsterAct(u);
        effectDecay();
        render();
      }
      setTimeout(step, PACE);
    })();
  }

  function effectDecay() { if (C.lastEffect) C.lastEffect.t *= 0.6; }

  function endRound() {
    C.blessed = Math.max(0, C.blessed - 1);
    C.shielded = Math.max(0, C.shielded - 1);
    C.units.forEach(function (u) {
      if (isPC(u) || !u.m) return;
      ['charmed', 'weakened', 'slowed', 'feared'].forEach(function (k) { if (u.m[k] > 0) u.m[k]--; });
    });
    // Morale: a group that has lost members may break.
    var alive = mons();
    if (C.lost.mon > 0 && alive.length) {
      var avg = Math.round(alive.reduce(function (s, u) { return s + u.m.def.morale; }, 0) / alive.length);
      var roll = MOD.roll('2d6', EM.rand);
      if (roll > avg) {
        say('The survivors lose heart and flee!', 'find');
        alive.forEach(function (u) { u.m.fled = true; });
      }
    }
  }

  function checkEnd() {
    var foesLeft = mons().length > 0;
    var partyLeft = activePCs().length > 0;
    if (!foesLeft) return finish(true, false);
    if (!partyLeft) return finish(false, false);
    return false;
  }

  function fleeAttempt() {
    if (busy || !C.actor) return;
    var roll = Math.floor(EM.rand() * 100) + 1;
    if (roll <= FLEE_CHANCE) {
      say('The company breaks off and flees!', 'find');
      finish(false, true);
    } else {
      say('The company fails to get clear.');
      C.actor = null;
      C.actorIdx = pcs().length;
      nextActor();
    }
  }

  // ---- end of a fight ------------------------------------------------------------------
  // The result carries experience, gold and the loot of the monsters that died. The caller decides where the loot
  // goes: a dungeon drops it on the square; the wilds gather it at once.
  function finish(victory, fled) {
    if (C.over) return true;
    C.over = true;
    busy = false;
    C.actor = null;
    var result = { victory: victory, fled: fled, killed: C.killed.slice(), xp: 0, gold: 0, items: [], group: C.group, remaining: 0, defeated: !victory && !fled };
    C.killed.forEach(function (k) { result.xp += MON.get(k).xp; });
    var sharers = pcs().filter(function (u) { return u.c.status !== 'dead'; });
    if (result.xp && sharers.length) {
      var share = Math.floor(result.xp / sharers.length);
      sharers.forEach(function (u) { R.awardXp(u.c, share); });
    }
    var hoard = EM.Treasure.hoardFor(C.killed, EM.rand);
    result.gold = hoard.gp;
    result.items = hoard.items;
    result.remaining = mons().length;
    if (EM.Bestiary) C.killed.forEach(function (k) { EM.Bestiary.killed(k); });
    setTimeout(function () {
      if (onEnd) onEnd(result);
    }, 0);
    return true;
  }

  // ---- display and input -------------------------------------------------------------
  function render() {
    draw();
    renderPanel();
  }

  function renderPanel() {
    var box = document.getElementById('cbactions'), st = document.getElementById('cbstatus');
    if (!box) return;
    box.innerHTML = '';
    if (!C) return;
    st.textContent = 'Round ' + C.round + ' · ' + (C.actor ? 'Acting: ' + C.actor.c.name + (C.actor.moved ? ' (moved)' : '') : busy ? 'The monsters act…' : 'Waiting') + ' · ' + mons().length + ' foe(s) left';
    var B = EM.Mod.el;
    function btn(label, fn, disabled, cls) {
      box.appendChild(B('button', { type: 'button', class: cls || '', text: label, disabled: !!disabled, onclick: fn }));
    }
    btn(autoMode ? 'Auto-fight: on' : 'Auto-fight: off', function () { setAuto(!autoMode); }, false, 'toggle');
    if (!C.actor || busy || C.over) return;
    var a = C.actor;
    var cls = a.c.cls;
    btn('Move', function () { setPending({ type: 'move' }); }, a.moved, '');
    btn('Attack', function () { setPending({ type: 'melee' }); }, !mons().some(function (m) { return dist(a.x, a.y, m.x, m.y) === 1; }));
    if (weaponRange(a)) btn('Missile', function () { setPending({ type: 'missile' }); }, !enemiesIn(weaponRange(a), a).length);
    if (cls === 'thief') btn('Backstab', function () { setPending({ type: 'backstab' }); });
    if (R.turnLevel(a.c)) btn('Turn undead', function () { setPending({ type: 'turn' }); });
    usableSpells(a).forEach(function (id) {
      var n = a.c.memo.filter(function (x) { return x === id; }).length;
      var sp = D.SPELLS[id];
      btn(sp.name + ' (' + n + ')', function () {
        if (PARTY_KINDS[sp.kind]) { castAt(a, id, a.x, a.y); return finishAction(); }
        setPending({ type: 'spell', spell: id });
      });
    });
    activeHeals().forEach(function (it) {
      btn('Use ' + D.item(it.id).name, function () { setPending({ type: 'heal', item: it.id, range: 2 }); });
    });
    btn('Defend', function () { say(a.c.name + ' stands ready.'); finishAction(); });
    btn('Done', function () { finishAction(); });
    btn('Flee', fleeAttempt, false, 'danger');
    box.appendChild(B('div', { class: 'hint', text: C.pending ? 'Choose a target on the field. Gold squares are legal targets.' : 'Pick an action, then a target on the field.' }));
  }

  function activeHeals() {
    var st = EM.Game && EM.Game.state();
    if (!st) return [];
    return (st.pack || []).map(function (id, i) { return { id: id, idx: i }; }).filter(function (x) {
      var it = D.item(x.id);
      return it && it.heal;
    });
  }

  function setPending(p) {
    C.pending = p;
    if (p.type === 'spell') p.range = D.SPELLS[p.spell].range;
    if (p.type === 'heal') p.range = 2;
    render();
  }

  function finishAction() {
    C.pending = null;
    setTimeout(nextActor, 60);
    render();
  }

  function onCanvasClick(ev) {
    if (!C || busy || C.over || !C.actor) return;
    var rect = cv.getBoundingClientRect();
    var px = (ev.clientX - rect.left) * CW / rect.width;
    var py = (ev.clientY - rect.top) * CH / rect.height;
    var cell = cellFromPoint(px, py);
    if (!inside(cell.x, cell.y) || !C.pending) return;
    var legal = validCells(C.pending).some(function (c) { return c.x === cell.x && c.y === cell.y; });
    if (!legal) return;
    var p = C.pending;
    var endsTurn = execute(p, cell.x, cell.y);
    if (p.type === 'move') { C.pending = null; render(); return; }
    if (endsTurn) return finishAction();
    render();
  }

  function setAuto(on) {
    autoMode = !!on;
    if (autoMode && C && C.actor && !busy && !C.over) setTimeout(autoTurn, PACE);
    render();
  }

  function isActive() { return !!(C && !C.over); }

  return {
    start: start, setAuto: setAuto, isAuto: function () { return autoMode; },
    isActive: isActive, PACE: PACE, COLS: COLS, ROWS: ROWS,
    _state: function () { return C; }
  };
})();
