/* journal.js — commissions and dated notes. Quest experience is a quarter of the listed figure; gold is paid in full.
   Quests are defined per adventure (adventures.js). The company's state is S.quests (status by quest id) and S.notes. */
var EM = window.EM = window.EM || {};

EM.Journal = (function () {
  var R = EM.Rules, MOD = EM.Mod;

  function S() { return EM.Game.state(); }
  function quests() { return EM.Adventures.ALL[S().adv].quests || {}; }

  function note(text) {
    var s = S();
    s.notes = s.notes || [];
    s.notes.push({ t: s.clock, text: text });
    if (s.notes.length > 300) s.notes.shift();
  }

  // Commissions are kept per adventure: the key is the adventure id and the quest id.
  function qk(id) { return S().adv + ':' + id; }

  function accept(id) {
    var s = S(), q = quests()[id];
    s.quests = s.quests || {};
    if (!q || s.quests[qk(id)]) return;
    s.quests[qk(id)] = { status: 'open', taken: s.clock };
    s.flags['accepted:' + qk(id)] = true;
    note('Accepted: ' + q.title + ' from ' + q.giver + '. ' + q.text);
    EM.Game.log('New commission: ' + q.title + '.', 'find');
  }

  function complete(id) {
    var s = S(), q = quests()[id];
    if (!q) return;
    s.quests = s.quests || {};
    if (!s.quests[qk(id)]) accept(id);
    if (s.quests[qk(id)].status === 'done') return;
    s.quests[qk(id)].status = 'done';
    s.quests[qk(id)].done = s.clock;
    s.gold += q.gold;
    var xp = R.questXp(q.xp);
    var alive = s.party.filter(function (c) { return c.status !== 'dead'; });
    if (alive.length) {
      var share = Math.floor(xp / alive.length);
      alive.forEach(function (c) { R.awardXp(c, share); });
    }
    var msg = 'Completed: ' + q.title + '. Paid ' + q.gold + ' gold and ' + xp + ' experience.';
    note(msg);
    EM.Game.log(msg, 'find');
  }

  function status(id) {
    var s = S();
    var q = s.quests && s.quests[qk(id)];
    return q ? q.status : 'untaken';
  }

  function open() {
    var s = S();
    var box = MOD.el('div', { class: 'journal' });
    box.appendChild(MOD.el('h3', { text: 'Commissions' }));
    Object.keys(quests()).forEach(function (id) {
      var q = quests()[id];
      var st = status(id);
      var label = st === 'done' ? 'Completed' : st === 'open' ? 'Open' : 'Not yet taken';
      box.appendChild(MOD.el('p', { class: 'jline' }, []));
      box.lastChild.appendChild(MOD.el('strong', { text: q.title }));
      box.lastChild.appendChild(document.createTextNode(' · ' + label + ' · from ' + q.giver));
      if (st !== 'untaken') box.appendChild(MOD.el('p', { class: 'hint', text: q.text }));
    });
    box.appendChild(MOD.el('h3', { text: 'Notes' }));
    var notes = (s.notes || []).slice().reverse();
    if (!notes.length) box.appendChild(MOD.el('p', { class: 'hint', text: 'Nothing has been written yet.' }));
    notes.forEach(function (n) {
      box.appendChild(MOD.el('p', { class: 'jline', text: EM.Watch.format({ clock: n.t }) + ' — ' + n.text }));
    });
    EM.UI.modal('Journal', box, [{ label: 'Close' }]);
  }

  return { accept: accept, complete: complete, note: note, status: status, open: open };
})();
