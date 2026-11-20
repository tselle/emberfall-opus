/* ui.js — screens, the company panel, character sheets, town services, menus and key/touch input. */
var EM = window.EM = window.EM || {};

EM.UI = (function () {
  var R = EM.Rules, D = EM.Data, MOD = EM.Mod, el = MOD.el;
  var $ = function (id) { return document.getElementById(id); };
  var screen = 'title';
  var modalClose = null;
  var pending = null;   // company being created
  var party = [];       // characters being assembled
  var logLines = [];
  var portraitCache = {};

  // ---- screens and modal -----------------------------------------------------
  function showScreen(name) {
    screen = name;
    ['title', 'create', 'game', 'combat', 'overland'].forEach(function (s) {
      $('screen-' + s).classList.toggle('hidden', s !== name);
    });
    $('topbar').classList.toggle('hidden', name === 'title' && !EM.Game.hasState());
    $('hud').classList.toggle('hidden', name !== 'game' && name !== 'overland');
    document.body.dataset.screen = name;
    if (name === 'game') { EM.Game.requestDraw(); }
  }

  // One modal at a time. Opening a new modal replaces the old one; its onClose is handled by the caller.
  function modal(title, body, buttons, onClose) {
    var box = $('modal-box');
    box.innerHTML = '';
    box.appendChild(el('h2', { text: title }));
    if (typeof body === 'string') {
      body.split('\n\n').forEach(function (p) { box.appendChild(el('p', { text: p })); });
    } else if (body) {
      box.appendChild(body);
    }
    var bar = el('div', { class: 'btnrow' });
    (buttons || [{ label: 'Close' }]).forEach(function (b) {
      bar.appendChild(el('button', {
        type: 'button', text: b.label, class: b.primary ? 'primary' : '', disabled: !!b.disabled,
        onclick: function () { if (b.action) b.action(); if (b.close !== false) closeModal(); }
      }));
    });
    box.appendChild(bar);
    modalClose = onClose || null;
    $('modal').classList.remove('hidden');
    var first = box.querySelector('button:not([disabled])');
    if (first) first.focus();
  }

  function closeModal() {
    var cb = modalClose;
    modalClose = null;
    $('modal').classList.add('hidden');
    if (cb) cb();
  }

  function modalOpen() { return !$('modal').classList.contains('hidden'); }

  // ---- log ---------------------------------------------------------------------
  function log(text, cls) {
    logLines.push({ text: text, cls: cls || '' });
    if (logLines.length > 120) logLines.shift();
    var box = $('log');
    if (!box) return;
    box.appendChild(el('div', { class: 'logline ' + cls, text: text }));
    while (box.childNodes.length > 120) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  function fillLog() {
    var box = $('log');
    box.innerHTML = '';
    var s = EM.Game.state();
    (s && s.log || []).slice(-120).forEach(function (l) {
      box.appendChild(el('div', { class: 'logline ' + (l.cls || ''), text: l.text }));
    });
    box.scrollTop = box.scrollHeight;
  }

  // ---- portraits ----------------------------------------------------------------
  function portraitFor(ch, size) {
    var cvs = el('canvas', { class: 'portrait', width: size || 64, height: size || 64 });
    EM.Figures.portrait(cvs, ch);
    return cvs;
  }

  // ---- HUD and company panel ------------------------------------------------------
  function refresh(s) {
    if (!s) return;
    $('hud').textContent = EM.Watch.format(s) + '   ·   ' + s.gold + ' gp   ·   ' + (EM.Watch.isNight(s) ? 'Night' : 'Day');
    $('location').textContent = EM.Game.placeName() + '  ·  facing ' + MOD.CARDINAL[s.dir];
    refreshParty(s);
  }

  function refreshParty(s) {
    var box = $('party');
    box.innerHTML = '';
    s.party.forEach(function (c, i) {
      var maxHp = c.hpMax || 1;
      var pct = Math.max(0, Math.min(100, Math.round(100 * Math.max(0, c.hp) / maxHp)));
      var status = c.status === 'dead' ? 'Dead' : c.status === 'unconscious' ? 'Unconscious' : '';
      var card = el('button', {
        type: 'button', class: 'card' + (c.status !== 'ok' ? ' down' : ''), 'aria-label': 'Character sheet for ' + c.name,
        onclick: function () { openSheet(i); }
      }, [
        portraitFor(c, 48),
        el('div', { class: 'cardtext' }, [
          el('div', { class: 'cname', text: (i + 1) + '. ' + c.name }),
          el('div', { class: 'csub', text: c.race + ' ' + c.cls + ' · L' + c.level }),
          el('div', { class: 'hpbar' }, [el('div', { class: 'hpfill', style: 'width:' + pct + '%' })]),
          el('div', { class: 'csub', text: 'HP ' + Math.max(0, c.hp) + '/' + c.hpMax + ' · AC ' + R.armourClass(c, lookup(c.armour), lookup(c.shield)) + (status ? ' · ' + status : '') })
        ])
      ]);
      box.appendChild(card);
    });
  }

  function lookup(id) { return id ? D.item(id) : null; }

  // ---- title -------------------------------------------------------------------
  function buildTitle() {
    var box = $('screen-title');
    box.innerHTML = '';
    var auto = EM.Game.autosaveInfo();
    var slots = [];
    for (var n = 1; n <= 6; n++) slots.push({ n: n, info: EM.Game.slotInfo(n) });
    var hasSaves = slots.some(function (x) { return x.info; });
    box.appendChild(el('div', { class: 'titlecard' }, [
      el('h1', { text: 'Emberfall' }),
      el('h2', { text: 'The Emberwild Saga' }),
      el('p', { class: 'tagline', text: 'Form a company of up to six adventurers. Explore the cellars of Thornwick, and the wider world beyond.' }),
      el('div', { class: 'btnstack' }, [
        el('button', { class: 'primary', type: 'button', text: 'New company', onclick: function () { openCreate(); } }),
        el('button', { type: 'button', text: 'Ready-made company', onclick: function () { startPregens(); } }),
        auto ? el('button', { type: 'button', text: 'Continue (autosave · ' + auto.name + ')', onclick: function () { loadAuto(); } }) : null,
        el('button', { type: 'button', text: 'Load a saved game', onclick: function () { openLoad(); }, disabled: !hasSaves }),
        el('button', { type: 'button', text: 'How to play', onclick: function () { howToPlay(); } })
      ])
    ]));
  }

  function openLoad() {
    var list = el('div', { class: 'slotlist' });
    for (var n = 1; n <= 6; n++) {
      (function (n) {
        var info = EM.Game.slotInfo(n);
        list.appendChild(el('div', { class: 'slotrow' }, [
          el('span', { text: 'Slot ' + n + ': ' + (info ? info.name + ' · ' + new Date(info.when).toLocaleString() : 'empty') }),
          el('button', {
            type: 'button', text: 'Load', disabled: !info,
            onclick: function () { if (EM.Game.loadSlot(n)) { closeModal(); resume(); } }
          })
        ]));
      })(n);
    }
    modal('Load a saved game', list, [{ label: 'Back' }]);
  }

  function loadAuto() {
    if (EM.Game.loadAutosave()) resume();
  }

  // ---- how to play --------------------------------------------------------------
  function howToPlay() {
    var body = el('div', { class: 'howto' }, [
      el('p', { text: 'Walk the streets and corridors in first person. Walk into a door to open it; walk into a building to use its services; walk into stairs to climb or descend.' }),
      el('h3', { text: 'Keys' }),
      el('ul', {}, [
        el('li', { text: 'W / ↑ forward · S / ↓ back · A / ← turn left · D / → turn right' }),
        el('li', { text: 'Q / E sidestep left and right' }),
        el('li', { text: 'F search for secret doors and traps (dwarves and thieves are better at it)' }),
        el('li', { text: 'K disarm a known trap in front of you (thieves only)' }),
        el('li', { text: 'R camp and rest until healed (8 hours)' }),
        el('li', { text: 'M full map · P pack and gold · J journal of notes · B bestiary (later phase)' }),
        el('li', { text: '1–6 open a character sheet · Esc menu: save, load and options' })
      ]),
      el('h3', { text: 'Touch' }),
      el('p', { text: 'Use the command bar under the view. Its buttons do the same as the keys.' }),
      el('h3', { text: 'Town' }),
      el('p', { text: 'The temple heals and revives. The inn rests the company for a few gold. The hall trains characters who have earned enough experience, at 100 gp per level gained. The shop buys and sells.' }),
      el('h3', { text: 'Saving' }),
      el('p', { text: 'The game autosaves as you go. Six manual save slots are in the Esc menu. Saves are kept in this browser only.' })
    ]);
    modal('How to play', body, [{ label: 'Back', action: function () { if (screen === 'title') buildTitle(); } }]);
  }

  // ---- company creation ---------------------------------------------------------
  function openCreate() {
    party = [];
    pending = { name: '', race: 'human', cls: 'fighter', align: 'True Neutral', scores: R.rollScores() };
    showScreen('create');
    renderCreate();
  }

  function renderCreate() {
    var box = $('screen-create');
    box.innerHTML = '';
    var p = pending;
    var adj = R.racialScores(p.scores, p.race);
    var errs = R.validate(p.race, p.cls, p.scores, p.align);
    var raceSel = el('select', { id: 'f-race' });
    Object.keys(R.RACES).forEach(function (r) {
      var ok = R.RACES[r].classes.indexOf(p.cls) >= 0;
      if (!ok && r !== p.race) return;
      raceSel.appendChild(el('option', { value: r, text: R.RACES[r].name, selected: r === p.race }));
    });
    var clsSel = el('select', { id: 'f-class' });
    Object.keys(R.CLASSES).forEach(function (c) {
      var ok = R.RACES[p.race].classes.indexOf(c) >= 0;
      if (!ok && c !== p.cls) return;
      clsSel.appendChild(el('option', { value: c, text: R.CLASSES[c].name, selected: c === p.cls }));
    });
    var alignSel = el('select', { id: 'f-align' });
    R.ALIGNMENTS.forEach(function (a) { alignSel.appendChild(el('option', { value: a, text: a, selected: a === p.align })); });
    var nameIn = el('input', { type: 'text', value: p.name, maxlength: 24, placeholder: 'Name your adventurer', oninput: function (e) { p.name = e.target.value; } });

    var abilGrid = el('div', { class: 'abilgrid' });
    R.ABILITIES.forEach(function (a) {
      var delta = adj[a] - p.scores[a];
      abilGrid.appendChild(el('div', { class: 'abil' }, [
        el('span', { class: 'aname', text: a }),
        el('span', { class: 'aval', text: String(adj[a]) }),
        el('span', { class: 'adelta', text: delta ? (delta > 0 ? '+' : '') + delta : '' })
      ]));
    });

    var errBox = el('div', { class: 'errs' }, errs.map(function (e) { return el('p', { text: e }); }));
    var form = el('div', { class: 'panel' }, [
      el('h2', { text: 'New adventurer' }),
      el('label', {}, ['Name ', nameIn]),
      el('div', { class: 'row2' }, [
        el('label', {}, ['Race ', raceSel]),
        el('label', {}, ['Class ', clsSel]),
        el('label', {}, ['Alignment ', alignSel])
      ]),
      el('p', { class: 'hint', text: R.RACES[p.race].desc }),
      el('p', { class: 'hint', text: R.CLASSES[p.cls].desc + ' Needs: ' + Object.keys(R.CLASSES[p.cls].min).map(function (k) { return k + ' ' + R.CLASSES[p.cls].min[k]; }).join(', ') + '.' }),
      el('h3', { text: 'Abilities (after racial adjustment)' }),
      abilGrid,
      el('div', { class: 'btnrow' }, [
        el('button', { type: 'button', text: 'Reroll abilities', onclick: function () { p.scores = R.rollScores(); renderCreate(); } }),
        el('button', { type: 'button', class: 'primary', text: 'Add to company', disabled: errs.length > 0 || party.length >= 6, onclick: function () { addMember(); } })
      ]),
      errBox,
      el('p', { class: 'hint', text: party.length >= 6 ? 'The company is full.' : 'Company: ' + party.length + ' of 6.' })
    ]);

    var roster = el('div', { class: 'panel' }, [
      el('h2', { text: 'Your company' }),
      party.length ? el('ul', { class: 'roster' }, party.map(function (c, i) {
        return el('li', {}, [
          el('span', { text: c.name + ', ' + c.race + ' ' + c.cls + ' (' + c.align + ')' }),
          el('button', { type: 'button', text: 'Remove', onclick: function () { party.splice(i, 1); renderCreate(); } })
        ]);
      })) : el('p', { class: 'hint', text: 'No one has joined yet.' }),
      el('div', { class: 'btnrow' }, [
        el('button', { type: 'button', text: 'Back', onclick: function () { showScreen('title'); buildTitle(); } }),
        el('button', { type: 'button', class: 'primary', text: 'Begin the adventure', disabled: party.length < 1, onclick: function () { beginAdventure(party); } })
      ])
    ]);

    // Name and selectors update the pending record and re-render.
    raceSel.onchange = function () { p.race = raceSel.value; fixClass(); renderCreate(); };
    clsSel.onchange = function () { p.cls = clsSel.value; fixRace(); renderCreate(); };
    alignSel.onchange = function () { p.align = alignSel.value; renderCreate(); };
    box.appendChild(el('div', { class: 'createwrap' }, [form, roster]));
  }

  function fixClass() {
    var p = pending;
    if (R.RACES[p.race].classes.indexOf(p.cls) < 0) p.cls = R.RACES[p.race].classes[0];
    if (R.CLASSES[p.cls].alignments && R.CLASSES[p.cls].alignments.indexOf(p.align) < 0) p.align = R.CLASSES[p.cls].alignments[0];
  }
  function fixRace() {
    var p = pending;
    if (R.RACES[p.race].classes.indexOf(p.cls) < 0) p.race = 'human';
    if (R.CLASSES[p.cls].alignments && R.CLASSES[p.cls].alignments.indexOf(p.align) < 0) p.align = R.CLASSES[p.cls].alignments[0];
  }

  // Starting gear for each class: a weapon, armour and, where allowed, a shield.
  var STARTING = {
    fighter: { weapon: 'long-sword', armour: 'chain', shield: 'shield' },
    paladin: { weapon: 'long-sword', armour: 'chain', shield: 'shield' },
    ranger: { weapon: 'long-sword', armour: 'studded', shield: null },
    mage: { weapon: 'dagger', armour: null, shield: null },
    cleric: { weapon: 'mace', armour: 'studded', shield: 'shield' },
    thief: { weapon: 'short-sword', armour: 'leather', shield: null }
  };

  function addMember() {
    var p = pending;
    if (party.length >= 6) return;
    var g = STARTING[p.cls];
    var ch = R.makeCharacter({
      name: p.name.trim() || MOD.pick(D.NAMES[p.race === 'elf' || p.race === 'half-elf' ? 'female' : 'male']),
      race: p.race, cls: p.cls, align: p.align, scores: p.scores,
      weapon: g.weapon, armour: g.armour, shield: g.shield,
      spec: R.CLASSES[p.cls].canSpecialize ? g.weapon : null
    });
    party.push(ch);
    pending = { name: '', race: p.race, cls: p.cls, align: p.align, scores: R.rollScores() };
    renderCreate();
  }

  function startPregens() {
    var list = D.PREGENS.map(function (p, i) {
      return R.makeCharacter({
        id: 'pg' + i, name: p.name, race: p.race, cls: p.cls, align: p.align, scores: p.scores,
        weapon: p.weapon, armour: p.armour, shield: p.shield || null, spec: p.spec || null, portrait: 1000 + i * 37
      });
    });
    beginAdventure(list);
  }

  function beginAdventure(list) {
    EM.Game.startNew(list.slice(0, 6), 'E0');
    showScreen('game');
    fillLog();
    EM.Game.requestDraw();
  }

  // ---- character sheet ----------------------------------------------------------
  function openSheet(i) {
    var s = EM.Game.state();
    var c = s.party[i];
    if (!c) return;
    var R_ = R, cls = R.CLASSES[c.cls];
    var sv = R.saves(c);
    var body = el('div', { class: 'sheet' });

    var top = el('div', { class: 'sheettop' }, [
      portraitFor(c, 96),
      el('div', {}, [
        el('h3', { text: c.name }),
        el('p', { class: 'hint', text: c.race + ' ' + cls.name + ' · ' + c.align + ' · Level ' + c.level }),
        el('p', { text: 'HP ' + Math.max(0, c.hp) + ' / ' + c.hpMax + (c.status !== 'ok' ? ' (' + c.status + ')' : '') }),
        el('p', { text: 'Experience ' + c.xp + (R.nextLevelXp(c) != null ? ' · next level at ' + R.nextLevelXp(c) : ' · level cap reached') }),
        el('p', { text: 'Gold (party): ' + s.gold })
      ])
    ]);
    body.appendChild(top);

    var abil = el('table', { class: 'grid' }, [el('tr', {}, [el('th', { text: 'Ability' }), el('th', { text: 'Score' }), el('th', { text: 'Note' })])]);
    R.ABILITIES.forEach(function (a) {
      var note = '';
      if (a === 'STR') note = 'to-hit ' + (R.strHit(c.abil.STR) >= 0 ? '+' : '') + R.strHit(c.abil.STR) + ', damage ' + (R.strDmg(c.abil.STR) >= 0 ? '+' : '') + R.strDmg(c.abil.STR);
      if (a === 'DEX') note = 'AC adj ' + (R.dexAc(c.abil.DEX) >= 0 ? '+' : '') + R.dexAc(c.abil.DEX);
      if (a === 'CON') note = 'HP per level ' + (R.conHp(c.abil.CON) >= 0 ? '+' : '') + R.conHp(c.abil.CON);
      if (cls.prime.indexOf(a) >= 0) note += (note ? ' · ' : '') + 'prime requisite';
      abil.appendChild(el('tr', {}, [el('td', { text: R.ABILITY_NAMES[a] }), el('td', { text: String(c.abil[a]) }), el('td', { text: note })]));
    });
    body.appendChild(el('h3', { text: 'Abilities' }));
    body.appendChild(abil);
    body.appendChild(el('p', { text: 'Experience bonus: +' + Math.round(R.primeBonus(c) * 100) + '% · THAC0 ' + R.thac0(c.cls, c.level) + ' · AC ' + R.armourClass(c, lookup(c.armour), lookup(c.shield)) + ' · Movement ' + Math.round(12 * R.RACES[c.race].moveFactor) }));
    body.appendChild(el('p', { text: 'Turns undead: ' + (R.turnLevel(c) ? 'as a level ' + R.turnLevel(c) + ' cleric' : 'no') }));

    var saveRows = el('table', { class: 'grid' });
    R.SAVES.forEach(function (k) {
      saveRows.appendChild(el('tr', {}, [el('td', { text: R.SAVE_NAMES[k] }), el('td', { text: sv[k] + '+' })]));
    });
    body.appendChild(el('h3', { text: 'Saving throws (roll d20 equal to or above the number)' }));
    body.appendChild(saveRows);

    if (c.cls === 'thief') {
      var skills = el('table', { class: 'grid' });
      R.SKILL_ORDER.forEach(function (k) {
        skills.appendChild(el('tr', {}, [el('td', { text: R.SKILLS[k].name }), el('td', { text: R.skillValue(c, k) + '%' })]));
      });
      body.appendChild(el('h3', { text: 'Thief skills' }));
      body.appendChild(skills);
    }

    body.appendChild(el('h3', { text: 'Spells' }));
    if (c.cls === 'mage' || c.cls === 'cleric') {
      var known = R.knownSpells(c);
      var memo = c.memo || [];
      body.appendChild(el('p', { text: (c.cls === 'mage' ? 'Spellbook: ' : 'Prayers known: ') + (known.length ? known.map(function (id) { return D.SPELLS[id].name + ' (' + D.SPELLS[id].level + ')'; }).join(', ') : 'none') }));
      body.appendChild(el('p', { text: 'Memorized: ' + (memo.length ? memo.map(function (id) { return D.SPELLS[id].name; }).join(', ') : 'nothing') }));
      body.appendChild(el('p', { class: 'hint', text: 'Spells are memorized automatically when the company rests. Casting uses up a memorized spell.' }));
      memo.forEach(function (id, idx) {
        var sp = D.SPELLS[id];
        if (!sp || sp.kind !== 'utility') return;
        body.appendChild(el('div', { class: 'slotrow' }, [
          el('span', { text: sp.name + ' (out of combat)' }),
          el('button', { type: 'button', text: 'Cast', onclick: function () {
            c.memo.splice(idx, 1);
            EM.Game.castUtility(id, c);
            openSheet(i);
          } })
        ]));
      });
      if (c.cls === 'mage') {
        EM.Game.state().pack.forEach(function (id, idx) {
          var it = D.item(id);
          if (!it || it.kind !== 'spellscroll') return;
          var have = (c.book || []).indexOf(it.spell) >= 0;
          body.appendChild(el('div', { class: 'slotrow' }, [
            el('span', { text: it.name }),
            el('button', { type: 'button', text: have ? 'Already known' : 'Learn', disabled: have, onclick: function () {
              var msg = EM.Game.learnScroll(c, idx);
              if (msg) EM.Game.log(msg);
              openSheet(i);
            } })
          ]));
        });
      }
    } else {
      body.appendChild(el('p', { class: 'hint', text: 'This class does not cast spells.' }));
    }

    // Equipment with pack-driven choices.
    body.appendChild(el('h3', { text: 'Equipment' }));
    body.appendChild(slotPicker(c, 'weapon', 'weapon', 'Weapon'));
    body.appendChild(slotPicker(c, 'armour', 'armour', 'Armour'));
    body.appendChild(slotPicker(c, 'shield', 'shield', 'Shield'));
    if (cls.canSpecialize) {
      var specSel = el('select', {}, [el('option', { value: '', text: 'None' })]);
      cls.weapons.forEach(function (w) {
        var it = D.item(w);
        if (it) specSel.appendChild(el('option', { value: w, text: it.name, selected: c.spec === w }));
      });
      specSel.onchange = function () { c.spec = specSel.value || null; EM.Game.requestDraw(); openSheet(i); };
      var sb = R.specBonus(c);
      body.appendChild(el('label', {}, ['Weapon specialization ', specSel]));
      body.appendChild(el('p', { class: 'hint', text: c.spec ? '+' + sb.hit + ' to hit and +' + sb.dmg + ' damage with ' + D.item(c.spec).name + ' at this level.' : 'Specialize in one weapon for extra hits and damage.' }));
    }

    var usable = s.pack.map(function (id, idx) { return { id: id, idx: idx }; }).filter(function (x) { return D.item(x.id) && D.item(x.id).heal; });
    if (usable.length) {
      body.appendChild(el('h3', { text: 'Use an item' }));
      usable.forEach(function (x) {
        body.appendChild(el('button', { type: 'button', text: 'Use ' + D.item(x.id).name, onclick: function () { EM.Game.useItem(x.idx, c); openSheet(i); } }));
      });
    }

    modal(c.name, body, [
      { label: 'Previous', action: function () { openSheet((i + s.party.length - 1) % s.party.length); }, close: false },
      { label: 'Next', action: function () { openSheet((i + 1) % s.party.length); }, close: false },
      { label: 'Close' }
    ]);
  }

  function slotPicker(c, slot, kind, label) {
    var sel = el('select', {}, [el('option', { value: '', text: '— none —' })]);
    var cur = c[slot];
    if (cur) sel.appendChild(el('option', { value: cur, text: D.item(cur).name, selected: true }));
    var seen = {};
    EM.Game.state().pack.forEach(function (id) {
      var it = D.item(id);
      if (!it || it.kind !== kind || seen[id] || id === cur) return;
      if (!D.canUse(id, c.cls)) return;
      seen[id] = 1;
      sel.appendChild(el('option', { value: id, text: it.name }));
    });
    sel.onchange = function () { EM.Game.equip(c, slot, sel.value || null); openSheet(EM.Game.state().party.indexOf(c)); };
    return el('label', {}, [label + ' ', sel]);
  }

  // ---- pack ----------------------------------------------------------------------
  function openPack() {
    var s = EM.Game.state();
    var box = el('div', {}, [el('p', { text: 'Gold: ' + s.gold })]);
    if (!s.pack.length) box.appendChild(el('p', { class: 'hint', text: 'The pack is empty.' }));
    s.pack.forEach(function (id, idx) {
      var it = D.item(id);
      if (!it) return;
      var row = el('div', { class: 'slotrow' }, [
        el('span', { text: it.name + (it.kind === 'key' ? ' (key)' : '') }),
        el('button', { type: 'button', text: 'Sell for ' + D.sellValue(id) + ' gp', onclick: function () { EM.Game.sellItem(idx); openPack(); } })
      ]);
      box.appendChild(row);
    });
    modal('Pack', box, [{ label: 'Close' }]);
  }

  // ---- town services -----------------------------------------------------------
  function service(ch, onClose) {
    if (ch === 'I') return inn(onClose);
    if (ch === 'T') return temple(onClose);
    if (ch === 'H') return hall(onClose);
    if (ch === 'S') return shop(onClose);
  }

  function inn(onClose) {
    var s = EM.Game.state();
    var alive = s.party.filter(function (c) { return c.status !== 'dead'; });
    var cost = alive.length * 5;
    var body = el('p', { text: 'The innkeeper, a stout woman with a ledger of debts, offers a warm bed and a hot meal for 5 gp each. The company costs ' + cost + ' gp tonight.' });
    modal('The Sleeping Stag', body, [
      { label: 'Take the rooms (' + cost + ' gp)', primary: true, disabled: s.gold < cost, action: function () {
        s.gold -= cost;
        alive.forEach(function (c) { R.heal(c, c.hpMax); });
        EM.Watch.advance(s, 8 * 60);
        EM.Game.log('The company sleeps well at the Sleeping Stag and wakes fully healed.');
        EM.Game.autoSave();
      } },
      { label: 'Leave' }
    ], onClose);
  }

  function temple(onClose) {
    var s = EM.Game.state();
    var lvls = s.party.reduce(function (a, c) { return a + c.level; }, 0);
    var healCost = lvls * 20;
    var reviveCost = s.party.reduce(function (a, c) { return a + (c.status === 'unconscious' ? c.level * 50 : 0); }, 0);
    var raiseCost = s.party.reduce(function (a, c) { return a + (c.status === 'dead' ? c.level * 500 : 0); }, 0);
    var body = el('p', { text: 'The priest of the Dawn Lamp lays a hand on each brow. Healing costs 20 gp per character level. Reviving the unconscious costs 50 gp per level. Raising the dead costs 500 gp per level.' });
    modal('Temple of the Dawn Lamp', body, [
      { label: 'Heal the company (' + healCost + ' gp)', disabled: s.gold < healCost || !s.party.some(function (c) { return c.status === 'ok' && c.hp < c.hpMax; }), action: function () {
        s.gold -= healCost;
        s.party.forEach(function (c) { if (c.status === 'ok') c.hp = c.hpMax; });
        EM.Game.log('The priest’s prayers close the living party’s wounds.');
      } },
      { label: 'Revive the unconscious (' + reviveCost + ' gp)', disabled: !reviveCost || s.gold < reviveCost, action: function () {
        s.gold -= reviveCost;
        s.party.forEach(function (c) { if (c.status === 'unconscious') { c.status = 'ok'; c.hp = Math.max(1, Math.floor(c.hpMax / 2)); } });
        EM.Game.log('The unconscious rise, blinking.');
      } },
      { label: 'Raise the dead (' + raiseCost + ' gp)', disabled: !raiseCost || s.gold < raiseCost, action: function () {
        s.gold -= raiseCost;
        s.party.forEach(function (c) { if (c.status === 'dead') { c.status = 'ok'; c.hp = 1; } });
        EM.Game.log('Lamplight returns to the dead. They rise, pale and shaking.');
      } },
      { label: 'Leave' }
    ], onClose);
  }

  function hall(onClose) {
    var s = EM.Game.state();
    var box = el('div', {});
    box.appendChild(el('p', { text: 'The trainer sets out practice blades. Training costs 100 gp per level gained. A character must have earned enough experience first.' }));
    s.party.forEach(function (c) {
      var need = R.nextLevelXp(c);
      var cost = R.trainCost(c);
      var status = need == null ? 'Level cap reached.' : R.canTrain(c) ? 'Ready to train: ' + cost + ' gp.' : 'Needs ' + (need - c.xp) + ' more experience.';
      var btn = el('button', {
        type: 'button', text: 'Train', disabled: !R.canTrain(c) || s.gold < cost,
        onclick: function () {
          s.gold -= cost;
          var gains = R.train(c);
          EM.Game.log(c.name + ' trains and reaches level ' + c.level + '. Hit points +' + gains.reduce(function (a, b) { return a + b; }, 0) + '.', 'find');
          hall(onClose);
        }
      });
      box.appendChild(el('div', { class: 'slotrow' }, [el('span', { text: c.name + ' (L' + c.level + '): ' + status }), btn]));
    });
    modal('Training hall', box, [{ label: 'Leave' }], onClose);
  }

  function shop(onClose) {
    var s = EM.Game.state();
    var level = Math.max.apply(null, s.party.map(function (c) { return c.level; }).concat([1]));
    var stock = D.shopFor(level);
    var box = el('div', {});
    box.appendChild(el('h3', { text: 'For sale' }));
    stock.forEach(function (id) {
      var it = D.item(id);
      box.appendChild(el('div', { class: 'slotrow' }, [
        el('span', { text: it.name + ' · ' + it.value + ' gp' }),
        el('button', { type: 'button', text: 'Buy', disabled: s.gold < it.value, onclick: function () { if (EM.Game.buyItem(id)) shop(onClose); } })
      ]));
    });
    box.appendChild(el('h3', { text: 'Sell from the pack' }));
    if (!s.pack.length) box.appendChild(el('p', { class: 'hint', text: 'Nothing to sell.' }));
    s.pack.forEach(function (id, idx) {
      var it = D.item(id);
      if (!it) return;
      box.appendChild(el('div', { class: 'slotrow' }, [
        el('span', { text: it.name + ' · ' + D.sellValue(id) + ' gp' }),
        el('button', { type: 'button', text: 'Sell', onclick: function () { EM.Game.sellItem(idx); shop(onClose); } })
      ]));
    });
    modal('Brisk’s general store', box, [{ label: 'Leave' }], onClose);
  }

  // ---- full map, menu, journal ----------------------------------------------------
  function openMap() {
    var s = EM.Game.state();
    if (!s) return;
    var cvs = el('canvas', { class: 'bigmap', width: 480, height: 340 });
    var lvl = EM.Game.currentLevel();
    modal(EM.Game.placeName() + ' — map', cvs, [{ label: 'Close' }]);
    EM.Map.draw(cvs, lvl, s.seen[s.place] || {}, EM.Game.view().cam, { traps: lvl.traps });
  }

  function openJournal() { EM.Journal.open(); }

  // After loading: the wilds if the company was travelling, otherwise the game screen.
  function resume() {
    var st = EM.Game.state();
    showScreen(st && st.mode === 'wild' ? 'overland' : 'game');
    fillLog();
  }

  function openMenu() {
    var s = EM.Game.state();
    var box = el('div', {});
    box.appendChild(el('h3', { text: 'Save the game' }));
    for (var n = 1; n <= 6; n++) {
      (function (n) {
        var info = EM.Game.slotInfo(n);
        box.appendChild(el('div', { class: 'slotrow' }, [
          el('span', { text: 'Slot ' + n + ': ' + (info ? info.name : 'empty') }),
          el('button', { type: 'button', text: 'Save here', onclick: function () {
            var ok = EM.Game.saveSlot(n);
            EM.Game.log(ok ? 'Game saved to slot ' + n + '.' : 'Could not save: browser storage is unavailable.', 'find');
            openMenu();
          } }),
          el('button', { type: 'button', text: 'Load', disabled: !info, onclick: function () { if (EM.Game.loadSlot(n)) { closeModal(); fillLog(); } } })
        ]));
      })(n);
    }
    box.appendChild(el('h3', { text: 'The road' }));
    box.appendChild(el('div', { class: 'btnrow' }, [
      el('button', { type: 'button', text: 'Campaign (travel between adventures)', onclick: function () { EM.Campaign.open(); } }),
      el('button', { type: 'button', text: EM.NavPad.isOn() ? 'Hide the on-screen pad' : 'Show the on-screen pad', onclick: function () { EM.NavPad.setPref(!EM.NavPad.isOn()); closeModal(); openMenu(); } })
    ]));
    modal('Menu', box, [
      { label: 'How to play', close: false, action: function () { closeModal(); howToPlay(); } },
      { label: 'Title screen', action: function () { closeModal(); showScreen('title'); buildTitle(); } },
      { label: 'Resume' }
    ]);
  }

  // ---- keyboard and command bar -----------------------------------------------------
  var ACTIONS = {
    fwd: function () { EM.Game.act('fwd'); },
    back: function () { EM.Game.act('back'); },
    turnL: function () { EM.Game.act('turnL'); },
    turnR: function () { EM.Game.act('turnR'); },
    left: function () { EM.Game.act('left'); },
    right: function () { EM.Game.act('right'); },
    search: function () { EM.Game.search(); },
    disarm: function () { EM.Game.disarm(); },
    camp: function () { EM.Game.camp(); },
    map: function () { openMap(); },
    pack: function () { openPack(); },
    journal: function () { openJournal(); },
    bestiary: function () { EM.Bestiary.open(); },
    listen: function () { EM.Game.listen(); },
    campaign: function () { EM.Campaign.open(); },
    menu: function () { openMenu(); }
  };

  var BAR = [
    ['turnL', '⟲', 'Turn left'], ['fwd', '▲', 'Forward'], ['turnR', '⟳', 'Turn right'],
    ['left', '◀', 'Sidestep left'], ['back', '▼', 'Back'], ['right', '▶', 'Sidestep right'],
    ['search', 'F', 'Search'], ['disarm', 'K', 'Disarm trap'], ['camp', 'R', 'Camp'],
    ['map', 'M', 'Map'], ['pack', 'P', 'Pack'], ['journal', 'J', 'Journal'],
    ['bestiary', 'B', 'Bestiary'], ['listen', 'L', 'Listen at a door'], ['menu', 'Esc', 'Menu']
  ];

  function buildCommandBar() {
    var bar = $('cmdbar');
    bar.innerHTML = '';
    BAR.forEach(function (b) {
      bar.appendChild(el('button', {
        type: 'button', class: 'cmd', 'aria-label': b[2], title: b[2], text: b[1],
        onclick: function () { if (!modalOpen()) ACTIONS[b[0]](); }
      }));
    });
  }

  var KEYS = {
    'w': 'fwd', 'arrowup': 'fwd', 's': 'back', 'arrowdown': 'back',
    'a': 'turnL', 'arrowleft': 'turnL', 'd': 'turnR', 'arrowright': 'turnR',
    'q': 'left', 'e': 'right', 'f': 'search', 'k': 'disarm', 'r': 'camp',
    'm': 'map', 'p': 'pack', 'j': 'journal', 'b': 'bestiary', 'l': 'listen'
  };

  var WILD_KEYS = { 'w': 0, 'arrowup': 0, 'd': 1, 'arrowright': 1, 's': 2, 'arrowdown': 2, 'a': 3, 'arrowleft': 3 };

  function onKey(ev) {
    if (screen === 'overland') {
      var wk = (ev.key || '').toLowerCase();
      if (modalOpen()) { if (ev.key === 'Escape') closeModal(); return; }
      if (ev.key === 'Escape') { openMenu(); ev.preventDefault(); return; }
      if (WILD_KEYS[wk] !== undefined) { EM.Overland.step(WILD_KEYS[wk]); ev.preventDefault(); return; }
      if (wk === 'r') EM.Overland.camp();
      else if (wk === 'm') EM.Overland.fullMap();
      else if (wk === 'j') openJournal();
      else return;
      ev.preventDefault();
      return;
    }
    if (screen !== 'game') {
      if (ev.key === 'Escape' && modalOpen()) closeModal();
      return;
    }
    if (ev.key === 'Escape') {
      if (modalOpen()) closeModal(); else openMenu();
      ev.preventDefault();
      return;
    }
    if (modalOpen()) return;
    var k = (ev.key || '').toLowerCase();
    if (/^[1-6]$/.test(k)) {
      var n = parseInt(k, 10) - 1;
      if (EM.Game.state().party[n]) openSheet(n);
      ev.preventDefault();
      return;
    }
    var act = KEYS[k];
    if (act && ACTIONS[act]) {
      ACTIONS[act]();
      ev.preventDefault();
    }
  }

  // Swipes on the view act like the arrow keys.
  function bindTouch() {
    var view = $('view'), sx = 0, sy = 0, t0 = 0;
    view.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; t0 = Date.now();
    }, { passive: true });
    view.addEventListener('touchend', function (e) {
      if (modalOpen() || !EM.Game.hasState()) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - t0 > 600) return;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) { EM.Game.act('fwd'); return; }
      if (Math.abs(dx) > Math.abs(dy)) ACTIONS[dx > 0 ? 'turnR' : 'turnL']();
      else ACTIONS[dy < 0 ? 'fwd' : 'back']();
    }, { passive: true });
  }

  // ---- start-up -----------------------------------------------------------------
  // The overland command bar: four directions and the company's other needs.
  function buildWildBar() {
    var bar = $('wildbar');
    bar.innerHTML = '';
    var dirs = [['North', 0, '▲'], ['West', 3, '◀'], ['East', 1, '▶'], ['South', 2, '▼']];
    var layout = [null, dirs[0], null, dirs[1], null, dirs[2], null, dirs[3], null];
    layout.forEach(function (d) {
      bar.appendChild(d
        ? el('button', { type: 'button', class: 'cmd', 'aria-label': 'Travel ' + d[0], title: 'Travel ' + d[0], text: d[2], onclick: function () { if (!modalOpen()) EM.Overland.step(d[1]); } })
        : el('span', { class: 'cmdgap' }));
    });
    [['Camp', 'R', function () { EM.Overland.camp(); }], ['Map', 'M', function () { EM.Overland.fullMap(); }],
     ['Journal', 'J', openJournal], ['Menu', 'Esc', openMenu]].forEach(function (b) {
      bar.appendChild(el('button', { type: 'button', class: 'cmd', 'aria-label': b[0], title: b[0], text: b[1], onclick: function () { if (!modalOpen()) b[2](); } }));
    });
  }

  function init() {
    EM.Game.init($('view'), $('mini'));
    EM.NavPad.init($('navpad'), {
      fwd: function () { EM.Game.act('fwd'); }, back: function () { EM.Game.act('back'); },
      left: function () { EM.Game.act('left'); }, right: function () { EM.Game.act('right'); },
      turnL: function () { EM.Game.act('turnL'); }, turnR: function () { EM.Game.act('turnR'); },
      search: function () { EM.Game.search(); }, listen: function () { EM.Game.listen(); }, camp: function () { EM.Game.camp(); }
    });
    EM.Overland.init($('wild'));
    buildWildBar();
    buildCommandBar();
    buildTitle();
    showScreen('title');
    document.addEventListener('keydown', onKey);
    bindTouch();
    window.addEventListener('resize', function () { EM.Game.requestDraw(); });
  }

  return {
    init: init, showScreen: showScreen, modal: modal, closeModal: closeModal,
    log: log, refresh: refresh, service: service, openSheet: openSheet, openMap: openMap
  };
})();
