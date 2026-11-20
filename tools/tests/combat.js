
    var out = document.getElementById('out');
    var results = [], errors = [];
    window.onerror = function (msg, src, line) { errors.push(msg + ' @' + line); };
    function check(name, ok, detail) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function party() {
      return EM.Data.PREGENS.map(function (p, i) {
        return EM.Rules.makeCharacter({ id: 'pg' + i, name: p.name, race: p.race, cls: p.cls, align: p.align, scores: p.scores,
          weapon: p.weapon, armour: p.armour, shield: p.shield || null, spec: p.spec || null, portrait: 1000 + i * 37 });
      });
    }
    function fight(kind, n, x, y) {
      return new Promise(function (resolve) {
        var pc = party();
        var before = pc.map(function (c) { return c.xp; });
        EM.Combat.start({ party: pc, group: { kind: kind, n: n, x: x, y: y }, ambush: false,
          done: function (res) { resolve({ res: res, pc: pc, before: before }); } });
        EM.Combat.setAuto(true);
      });
    }
    (async function () {
      try {
        await wait(20);
        var scen = [['goblin', 3, 5, 12], ['skeleton', 3, 19, 4], ['wight', 1, 19, 4], ['bugbear', 2, 5, 5]];
        for (var i = 0; i < scen.length; i++) {
          var s = scen[i];
          var r = await fight(s[0], s[1], s[2], s[3]);
          var gained = r.pc.reduce(function (a, c, k) { return a + (c.xp - r.before[k]); }, 0);
          check(s[1] + ' ' + s[0] + ' fight ends', true,
            (r.res.victory ? 'victory' : r.res.fled ? 'fled' : 'defeat') + ', killed ' + r.res.killed.length + ', xp ' + r.res.xp + ', shared ' + gained);
          if (r.res.victory) check('victory awards experience', r.res.killed.length === 0 || gained > 0);
          if (r.res.victory) check('every foe slain or fled after victory', r.res.remaining === 0 || r.res.killed.length < s[1]);
          check('no living foe remains as active after a defeat', !(r.res.defeated && r.res.remaining > 0 && r.pc.every(function (c) { return c.status === 'ok'; })));
          EM.Combat.setAuto(false);
          await wait(50);
        }
        check('combat screen used', document.getElementById('screen-combat') !== null);
      } catch (e) {
        errors.push('exception: ' + e.message + ' ' + (e.stack || '').split('\n')[1]);
      }
      out.textContent = results.join('\n') + '\n\nerrors: ' + (errors.length ? errors.join('; ') : 'none') + '\n\nDONE';
    })();
  