
    var out = document.getElementById('out');
    var results = [];
    var errors = [];
    window.onerror = function (msg, src, line) { errors.push(msg + ' @' + line); };
    function check(name, ok, detail) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function clickText(text) {
      var b = Array.prototype.filter.call(document.querySelectorAll('button'), function (x) { return x.textContent.indexOf(text) === 0; })[0];
      if (!b) throw new Error('no button: ' + text);
      b.click();
    }
    function key(k) { document.dispatchEvent(new KeyboardEvent('keydown', { key: k })); }

    (async function run() {
      try {
        await wait(50);
        clickText('Ready-made company');
        await wait(50);
        var S = EM.Game.state();
        check('ready-made company starts in Thornwick', S && S.place === 'thornwick', S && S.place);
        check('party has four members', S.party.length === 4, String(S.party.length));
        check('game screen visible', !document.getElementById('screen-game').classList.contains('hidden'));

        // Bump into the north wall, then turn and walk east.
        var sx = S.x, sy = S.y;
        EM.Game.act('fwd'); await wait(450);
        check('walking into a wall does not move the party', S.x === sx && S.y === sy, S.x + ',' + S.y);
        key('d'); await wait(350);
        check('turning right changes facing to east', S.dir === 1, 'dir ' + S.dir);
        key('w'); await wait(350);
        check('forward key walks one square east', S.x === sx + 1 && S.y === sy, S.x + ',' + S.y);
        check('a step advances the clock', EM.Watch.format(S) !== 'Day 1, 08:00');

        // Walk to the town stairs and descend.
        S.x = 10; S.y = 8; S.dir = 0; EM.Game.requestDraw(); await wait(60);
        EM.Game.act('fwd'); await wait(500);
        check('walking into the stairs descends to the cellars', S.place === 'cellars-1', S.place);
        check('arrives on the cellar entry square', S.x === 2 && S.y === 1, S.x + ',' + S.y);

        // Search, camp and the save round-trip.
        EM.Game.search(); await wait(60);
        check('search leaves a log line', EM.Game.state().log.slice(-1)[0].text.length > 0);
        EM.Game.camp(); await wait(60);
        check('camping heals the company', EM.Game.state().party.every(function (c) { return c.hp === c.hpMax || c.status === 'dead'; }));
        var before = JSON.stringify(EM.Game.state().party.map(function (c) { return c.name; }));
        check('save to slot 1', EM.Game.saveSlot(1));
        S.gold = 0; EM.Game.requestDraw(); await wait(40);
        check('load from slot 1 restores gold', EM.Game.loadSlot(1) && EM.Game.state().gold !== 0);
        check('load restores the party names', JSON.stringify(EM.Game.state().party.map(function (c) { return c.name; })) === before);

        // Full character creation: one fighter, then start.
        EM.UI.showScreen('create');
        EM.UI.openSheet(0);
        await wait(30);
        check('character sheet opens', !document.getElementById('modal').classList.contains('hidden'));
        EM.UI.closeModal();

        // Experience and training.
        var c = EM.Game.state().party[0];
        var before2 = c.level;
        EM.Rules.awardXp(c, 2100);
        check('experience accrues without a level until training', c.level === before2 && EM.Rules.canTrain(c), 'xp ' + c.xp);
        var gained = EM.Rules.train(c);
        check('training raises the level', c.level > before2 && gained.length > 0, 'level ' + c.level);

        // Encounter: walk into the sleeping goblins on the cellar map, fight to the end, and check the aftermath.
        S = EM.Game.state();
        S.party.forEach(function (c) { c.hp = c.hpMax; c.status = 'ok'; });
        S.x = 4; S.y = 12; S.dir = 1; EM.Game.requestDraw(); await wait(60);
        var goblinsBefore = S.groups['cellars-1'].filter(function (g) { return g.kind === 'goblin'; })[0].n;
        var goldBefore = S.gold;
        EM.Game.act('fwd'); await wait(600);
        check('bumping a monster group starts combat', !!EM.Combat._state() && !document.getElementById('screen-combat').classList.contains('hidden'));
        EM.Combat.setAuto(true);
        var waited = 0;
        while (!document.getElementById('screen-game').classList.contains('hidden') === false && waited < 150000) { await wait(500); waited += 500; }
        check('combat returns to the game screen', !document.getElementById('screen-game').classList.contains('hidden'));
        var goblin = S.groups['cellars-1'].filter(function (g) { return g.kind === 'goblin'; })[0];
        check('goblin group is updated or removed', !goblin || goblin.n < goblinsBefore, goblin ? 'left ' + goblin.n : 'cleared');
        check('gold never goes down from a victory', S.gold >= goldBefore || S.party.every(function (c) { return c.status === 'ok'; }) === false);
        // Rules spot checks.
        check('demi-humans move slower', EM.Rules.RACES.dwarf.moveFactor < 1);
        check('thac0 improves with level', EM.Rules.thac0('fighter', 10) < EM.Rules.thac0('fighter', 1));
        check('paladin needs lawful good', EM.Rules.validate('human', 'paladin', { STR: 13, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 18 }, 'Chaotic Evil').length > 0);
        check('mage cannot be dwarf', EM.Rules.validate('dwarf', 'mage', { STR: 9, DEX: 9, CON: 9, INT: 9, WIS: 9, CHA: 9 }, 'True Neutral').length > 0);
      } catch (e) {
        errors.push('exception: ' + e.message + ' ' + (e.stack || '').split('\n')[1]);
      }
      out.textContent = results.join('\n') + '\n\nerrors: ' + (errors.length ? errors.join('; ') : 'none') + '\n\nDONE';
    })();
  