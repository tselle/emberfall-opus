/* bestiary.js — the bestiary fills in as the company meets and fights creatures. Entries show only what has been learned:
   a creature met shows its name and appearance; fighting it reveals its hit dice, armour and damage; slaying one
   reveals its special abilities and treasure. State lives in S.bestiary: { kind: { met, killed, fought } }. */
var EM = window.EM = window.EM || {};

EM.Bestiary = (function () {
  var MOD = EM.Mod, el = MOD.el;

  function book() {
    var s = EM.Game.state();
    if (!s) return {};
    s.bestiary = s.bestiary || {};
    return s.bestiary;
  }

  function entry(kind) {
    var b = book();
    b[kind] = b[kind] || { met: 0, killed: 0, fought: 0 };
    return b[kind];
  }

  function met(kind) { entry(kind).met++; }
  function fought(kind) { entry(kind).fought++; }
  function killed(kind) { entry(kind).killed++; }

  // Summary: monsters met out of the total.
  function counts() {
    var b = book(), met = 0;
    Object.keys(b).forEach(function (k) { if (b[k].met) met++; });
    return { met: met, total: EM.Monsters.count };
  }

  function open() {
    var b = book();
    var c = counts();
    var box = el('div', { class: 'bestiary' });
    box.appendChild(el('p', { class: 'hint', text: 'Creatures met so far: ' + c.met + ' of ' + c.total + '.' }));
    var kinds = EM.Monsters.list().filter(function (k) { return b[k] && b[k].met; }).sort(function (p, q) {
      return EM.Monsters.get(p).hd - EM.Monsters.get(q).hd;
    });
    if (!kinds.length) box.appendChild(el('p', { class: 'hint', text: 'Nothing has been met yet. The bestiary fills in as the company meets and fights creatures.' }));
    kinds.forEach(function (k) {
      var d = EM.Monsters.get(k), e = b[k];
      var lines = [el('h3', { text: d.name + (e.killed ? '' : '') })];
      lines.push(el('p', { text: 'Met ' + e.met + ' time' + (e.met === 1 ? '' : 's') + '; slain ' + e.killed + '.' }));
      if (e.fought) {
        lines.push(el('p', { text: 'Hit dice ' + d.hd + ' · armour class ' + d.ac + ' · damage ' + d.dmg.replace(/\//g, ' / ') + ' · moves ' + d.move + ' · morale ' + d.morale }));
        var traits = [];
        if (d.undead) traits.push('undead (turned by the faithful)');
        if (d.humanoid) traits.push('humanoid');
        if (d.poison) traits.push('poison');
        if (d.paralyze) traits.push('paralysing touch');
        if (d.drain) traits.push('drains levels');
        if (d.regen) traits.push('regenerates');
        if (d.breath) traits.push('breathes fire');
        if (d.resist) traits.push('plain weapons deal half damage');
        if (d.swarm) traits.push('swarms (half damage from area spells)');
        lines.push(el('p', { text: 'Habits: ' + (traits.length ? traits.join('; ') : 'none that are known') + '.' }));
      } else {
        lines.push(el('p', { class: 'hint', text: 'Fight one to learn more.' }));
      }
      if (e.killed && d.treasure) lines.push(el('p', { text: 'Carries treasure type ' + d.treasure.toUpperCase() + '.' }));
      lines.forEach(function (l) { box.appendChild(l); });
    });
    EM.UI.modal('Bestiary', box, [{ label: 'Close' }]);
  }

  return { met: met, fought: fought, killed: killed, counts: counts, open: open };
})();
