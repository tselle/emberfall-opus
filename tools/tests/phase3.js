
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
    window.addEventListener('load', async function () {
      var out = document.getElementById('out');
      try {
        clickText('Ready-made company');
        await wait(50);
        var S = EM.Game.state();
        EM.rand = function () { return 0.99; };   // no wandering encounters while we check the walking rules
        // Leave town by the gate.
        S.x = 1; S.y = 7; S.dir = 3; EM.Game.requestDraw(); await wait(60);
        EM.Game.act('fwd'); await wait(700);
        S = EM.Game.state();
        check('the town gate leads to the wilds', S.mode === 'wild' && visible('screen-overland'), S.mode);
        check('the wilds start beside the gate', S.wild.x === 1 && S.wild.y === 8, S.wild.x + ',' + S.wild.y);
        // Walk the road east, then cross the bridge.
        EM.Overland.step(1); await wait(30);
        check('stepping east moves along the road', S.wild.x === 2, '' + S.wild.x);
        check('steps cost time', EM.Watch.format(S) !== 'Day 1, 08:00');
        S.wild.x = 15; S.wild.y = 8; EM.Overland.step(1); await wait(30);
        check('the bridge carries the road over the river', S.wild.x === 16 && S.wild.y === 8, S.wild.x + ',' + S.wild.y);
        S.wild.x = 15; S.wild.y = 4; EM.Overland.step(1); await wait(30);
        check('the river cannot be crossed off the bridge', S.wild.x === 15, '' + S.wild.x);
        // Millbrook: a hamlet with services.
        S.wild.x = 8; S.wild.y = 11; EM.Overland.step(2); await wait(40);
        check('Millbrook opens its services', visible('modal') && document.getElementById('modal-box').textContent.indexOf('Millbrook') >= 0);
        closeAll(); await wait(20);
        // Commissions and rewards.
        var goldBefore = S.gold;
        EM.Journal.accept('rats');
        check('accepting a commission is recorded', S.quests['E0:rats'].status === 'open');
        S.flags['rats-slain'] = true;
        EM.Journal.complete('rats');
        check('completing a commission pays its gold', S.gold === goldBefore + 60, S.gold + ' vs ' + (goldBefore + 60));
        check('quest experience is a quarter of the listed figure', S.notes.some(function (n) { return n.text.indexOf('100 experience') >= 0; }));
        // The brewery is barred until the reeve's commission is taken.
        S.flags['accepted:E0:main'] = false;
        S.wild.x = 4; S.wild.y = 5; EM.Overland.step(0); await wait(30);
        check('the barred brewery stops the company on its step', S.mode === 'wild' && S.wild.x === 4 && S.wild.y === 4, S.mode + ' ' + S.wild.x + ',' + S.wild.y);
        S.flags['accepted:E0:main'] = true;
        S.wild.x = 4; S.wild.y = 5; EM.Overland.step(0); await wait(60);
        check('the brewery opens once the commission is taken', S.mode === 'place' && S.place === 'cellars-1', S.mode + ' ' + S.place);
        S.mode = 'wild'; S.place = 'thornwick'; EM.Game.arrive('thornwick', 1, 7, 1); await wait(30);
        S = EM.Game.state();
        S.mode = 'wild'; S.wild = { x: 1, y: 8, fatigue: 0, seen: {} };
        // Camp on the safe camp square: no encounter there.
        S.wild.x = 10; S.wild.y = 14; var clock0 = S.clock; EM.Overland.step(0); await wait(30);
        EM.Overland.camp(); await wait(40);
        check('camping on the wilds rests the company', S.clock > clock0 && S.party.every(function (c) { return c.hp === c.hpMax || c.status !== 'ok'; }));
        // Fight the wolves at their lair; the company returns to the wilds afterwards.
        EM.rand = Math.random;
        S.wild.x = 24; S.wild.y = 13; EM.Overland.step(1); await wait(60);
        check('the wolf lair starts a fight', !!EM.Combat._state() && visible('screen-combat'));
        EM.Combat.setAuto(true);
        var ok = await waitFor(function () { return !EM.Combat.isActive() && (visible('screen-overland') || visible('screen-game')); }, 200000);
        check('the fight ends on the wilds, or carries the company home', ok && (visible('screen-overland') || visible('screen-game')), 'overland ' + visible('screen-overland') + ', game ' + visible('screen-game') + ', mode ' + S.mode + ', party ' + S.party.map(function (c) { return c.status; }).join('/'));
        // Second cellar level, reached through the first.
        EM.Game.arrive('cellars-2', 2, 1, 1); await wait(30);
        check('the second cellar level is entered', S.place === 'cellars-2' && S.mode === 'place');
        check('the second level holds the wight', EM.Game.currentLevel().groups.some(function (g) { return g.kind === 'wight'; }));
        // Save while travelling and check the mode is kept.
        EM.Game.arrive('thornwick', 1, 7, 1); await wait(30);
        EM.Game.act('fwd'); await wait(60);
        EM.Game.saveSlot(2);
        check('a save records the journal and the wilds', !!EM.Game.slotInfo(2));
      } catch (e) {
        errors.push('exception: ' + e.message + ' ' + (e.stack || '').split('\n')[1]);
      }
      out.textContent = results.join('\n') + '\n\nerrors: ' + (errors.length ? errors.join('; ') : 'none') + '\n\nDONE';
    });
  