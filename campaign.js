/* campaign.js — the campaign screen: moving the company between adventures. Adventures can be played alone or in order.
   A company that is not ready for an adventure may still go, but is warned. Travel costs gold for each member and a
   day of time. The company may only travel from a town, when it is not in a fight. */
var EM = window.EM = window.EM || {};

EM.Campaign = (function () {
  var MOD = EM.Mod, el = MOD.el;
  var TRAVEL_COST = 10, TRAVEL_MINUTES = 24 * 60;

  function S() { return EM.Game.state(); }

  function info(id) {
    var a = EM.Adventures.ALL[id];
    var s = S();
    var q = s && s.quests ? s.quests : {};
    var mainKey = id + ':main';
    var done = !!(q[mainKey] && q[mainKey].status === 'done');
    var open = Object.keys(q).some(function (k) { return k.indexOf(id + ':') === 0 && q[k].status === 'open'; });
    var status = done ? 'Complete' : (s && s.adv === id) || open ? 'In progress' : 'Not started';
    var minL = a.minLevel || (a.places && 1) || 1;
    var maxL = a.maxLevel || 20;
    return { id: id, name: a.name, levels: a.levels || '', status: status, minLevel: minL, maxLevel: maxL, adventure: a };
  }

  function partyLevel() {
    var s = S();
    if (!s || !s.party.length) return 1;
    return Math.round(s.party.filter(function (c) { return c.status !== 'dead'; }).reduce(function (a, c) { return a + c.level; }, 0) /
      Math.max(1, s.party.filter(function (c) { return c.status !== 'dead'; }).length));
  }

  function canTravelNow() {
    var s = S();
    if (!s) return 'Start a company first.';
    if (EM.Combat && EM.Combat.isActive()) return 'The company cannot travel in the middle of a fight.';
    if (s.mode === 'wild') return 'Return to the town gate before the company can travel by the roads of the campaign.';
    var pl = EM.Game.currentLevel();
    if (!pl || pl.kind !== 'town') return 'The company must be in a town to set out on a new adventure.';
    return null;
  }

  // Moves the company to the start of another adventure.
  function travel(id) {
    var why = canTravelNow();
    if (why) { EM.Game.log(why); return false; }
    var s = S();
    var cost = s.party.filter(function (c) { return c.status !== 'dead'; }).length * TRAVEL_COST;
    if (s.gold < cost) { EM.Game.log('The company cannot pay for the road (' + cost + ' gold).'); return false; }
    var a = EM.Adventures.ALL[id];
    s.gold -= cost;
    s.adv = id;
    EM.Watch.advance(s, TRAVEL_MINUTES);
    EM.Game.log('The company travels to ' + a.name + '. It cost ' + cost + ' gold for the road.', 'find');
    EM.Game.arrive(a.start.place, a.start.x, a.start.y, a.start.dir);
    if (EM.Journal) EM.Journal.note('Set out for ' + a.name + '.');
    return true;
  }

  function open() {
    var box = el('div', { class: 'campaign' });
    var why = canTravelNow();
    box.appendChild(el('p', { class: 'hint', text: why || 'Choose an adventure to travel to. Each member pays a little for the road.' }));
    box.appendChild(el('p', { class: 'hint', text: 'Party average level: ' + partyLevel() + '.' }));
    var s = S();
    EM.Adventures.order().forEach(function (id) {
      var i = info(id);
      var ready = partyLevel() >= i.minLevel;
      var row = el('div', { class: 'slotrow' }, [
        el('span', { text: i.id + ' · ' + i.name + ' · levels ' + i.levels + ' · ' + i.status + (ready ? '' : ' (under-levelled)') }),
        el('button', {
          type: 'button', text: s && s.adv === id ? 'Here' : 'Travel', disabled: !!why || (s && s.adv === id),
          onclick: function () { if (travel(id)) EM.UI.closeModal(); }
        })
      ]);
      box.appendChild(row);
    });
    EM.UI.modal('Campaign', box, [{ label: 'Close' }]);
  }

  return { open: open, travel: travel, info: info, partyLevel: partyLevel, TRAVEL_COST: TRAVEL_COST };
})();
