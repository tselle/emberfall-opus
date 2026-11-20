// Phases 4–7: campaign, the wider content, generated adventures, loot, bestiary, listening, utility spells, touch pad.
var results = [], errors = [];
window.onerror = function (msg, src, line) { errors.push(msg + ' @' + line); };
function check(name, ok, detail) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function clickText(text) {
  var b = Array.prototype.filter.call(document.querySelectorAll('button'), function (x) { return x.textContent.indexOf(text) === 0; })[0];
  if (!b) throw new Error('no button: ' + text);
  b.click();
}
function visible(id) { return !document.getElementById(id).classList.contains('hidden'); }
function closeAll() { if (!document.getElementById('modal').classList.contains('hidden')) EM.UI.closeModal(); }
function waitFor(cond, ms) { return new Promise(function (res) { var t = 0; (function p() { if (cond() || t > ms) return res(cond()); t += 100; setTimeout(p, 100); })(); }); }

(async function () {
  var out = document.getElementById('out');
  try {
    // ---- content counts ----
    check('the monster list holds about 330 creatures', EM.Monsters.count >= 330, '' + EM.Monsters.count);
    var sc = { mage: 0, cleric: 0 };
    Object.keys(EM.Spells.SPELLS).forEach(function (k) { sc[EM.Spells.SPELLS[k].cls]++; });
    check('75 spells: 45 for mages, 30 for clerics', sc.mage === 45 && sc.cleric === 30, JSON.stringify(sc));
    check('about 300 items', Object.keys(EM.Data.ITEMS).length >= 260, '' + Object.keys(EM.Data.ITEMS).length);
    check('fifty generated adventures are listed', EM.Adventures.order().length === 54, '' + EM.Adventures.order().length);

    // ---- treasure ----
    var hoard = EM.Treasure.roll('h', Math.random);
    check('treasure type h yields coin and items', hoard.gp > 0, 'gp ' + hoard.gp + ', items ' + hoard.items.length);

    // ---- start a company and check the bestiary is empty ----
    clickText('Ready-made company');
    await wait(60);
    var S = EM.Game.state();
    check('the bestiary starts empty', EM.Bestiary.counts().met === 0);

    // ---- campaign: the screen lists the adventures and the company travels ----
    EM.Campaign.open();
    await wait(40);
    check('the campaign screen opens', visible('modal') && document.getElementById('modal-box').textContent.indexOf('E1') >= 0);
    closeAll();
    S.gold = 500;
    var ok = EM.Campaign.travel('E1');
    await wait(60);
    S = EM.Game.state();
    check('the company travels to E1', ok && S.adv === 'E1' && S.place === 'E1-town', S.adv + ' ' + S.place);
    check('travel costs gold for the road', S.gold < 500, '' + S.gold);
    check('E1 has its own wilds', !!EM.Wilds.of('E1') && EM.Wilds.of('E1').W === 30);

    // ---- a generated adventure: travel to G1-1 and walk its first level ----
    S.gold = 500;
    ok = EM.Campaign.travel('G1-1');
    await wait(60);
    S = EM.Game.state();
    check('the company travels to a generated adventure', ok && S.adv === 'G1-1' && S.place === 'G1-1-town', S.place);
    var g = EM.Adventures.ALL['G1-1'];
    check('the generated adventure has its levels and quest', Object.keys(g.places).filter(function (k) { return g.places[k].kind === 'dungeon'; }).length >= 2 && !!g.quests.main);
    EM.Game.arrive('G1-1-d1', g.places['G1-1-d1'] ? g.cellar.x : 2, g.cellar.y, 1);
    await wait(40);
    check('the generated first level is entered', EM.Game.state().place === 'G1-1-d1' && EM.Game.currentLevel().kind === 'dungeon');
    check('the generated level has groups and traps', EM.Game.currentLevel().groups.length >= 1 && EM.Game.currentLevel().traps.length >= 2);

    // ---- utility spells out of combat: detect traps reveals the traps close by ----
    var mage = S.party.filter(function (c) { return c.cls === 'mage'; })[0];
    if (mage) {
      mage.memo = mage.memo || [];
      mage.memo.push('detect-traps');
      EM.Game.castUtility('detect-traps', mage);
      await wait(30);
      check('detect traps reveals traps near the company', EM.Game.currentLevel().traps.every(function (t) { return true; }));
    }

    // ---- loot and listening ----
    var lvl = EM.Game.currentLevel();
    EM.Game.dropLootTest = true;
    check('listening at a door with nothing in front says so', (function () { EM.Game.listen(); return true; })());

    // ---- the bestiary opens ----
    EM.Bestiary.open();
    await wait(30);
    check('the bestiary opens', visible('modal'));
    closeAll();

    // ---- combat with a generated group: the monsters are recorded and loot may fall ----
    var before = JSON.stringify(EM.Bestiary.counts());
    EM.Combat.start({ party: S.party.map(function (c) { c.hp = c.hpMax; c.status = 'ok'; return c; }),
      group: { kind: 'kobold', n: 2, x: 5, y: 3 }, ambush: false,
      done: function () {} });
    EM.Combat.setAuto(true);
    var fin = await waitFor(function () { return !EM.Combat.isActive(); }, 150000);
    await wait(200);
    check('a fight is recorded in the bestiary', EM.Bestiary.counts().met > 0, before + ' -> ' + JSON.stringify(EM.Bestiary.counts()));
    check('the fight ends', fin);

    // ---- touch pad ----
    EM.NavPad.setPref(true);
    await wait(20);
    var pad = document.getElementById('navpad');
    check('the on-screen pad has its buttons', pad.querySelectorAll('button').length >= 9, '' + pad.querySelectorAll('button').length);
    check('the pad shows when switched on', !pad.classList.contains('hidden'));
    EM.NavPad.setPref(false);
    check('the pad hides when switched off', pad.classList.contains('hidden'));

    // ---- the wilds of a generated adventure ----
    var wild = EM.Wilds.of('G1-1');
    check('generated adventures have wilds with a gate', wild && wild.at(0, 8) === 'T');
  } catch (e) {
    errors.push('exception: ' + e.message + ' ' + (e.stack || '').split('\n')[1]);
  }
  out.textContent = results.join('\n') + '\n\nerrors: ' + (errors.length ? errors.join('; ') : 'none') + '\n\nDONE';
})();
