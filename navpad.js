/* navpad.js — the on-screen movement pad for touch screens: forward, back, turns, sidesteps, search, listen and camp.
   It shows by default on devices with a coarse pointer, and can be switched on or off from the menu (a per-viewer
   preference kept in localStorage; it is never needed for play, since the keys and the command bar work too). */
var EM = window.EM = window.EM || {};

EM.NavPad = (function () {
  var MOD = EM.Mod, el = MOD.el;
  var PREF = 'emberfall.navpad';

  function isTouch() {
    try { return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window; }
    catch (e) { return false; }
  }

  function pref() {
    var v = MOD.store.get(PREF);
    if (v === '1') return true;
    if (v === '0') return false;
    return isTouch();
  }

  function setPref(on) { MOD.store.set(PREF, on ? '1' : '0'); apply(); }

  var host = null, actions = null;

  // A press repeats while held, so a long press walks on.
  function button(label, aria, fn) {
    var b = el('button', { type: 'button', class: 'pad', text: label, 'aria-label': aria, title: aria });
    var timer = null;
    function go() { fn(); }
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      go();
      timer = setInterval(go, 320);
      var stop = function () { clearInterval(timer); timer = null; };
      window.addEventListener('pointerup', stop, { once: true });
      window.addEventListener('pointercancel', stop, { once: true });
    });
    return b;
  }

  function build() {
    host.innerHTML = '';
    var a = actions;
    var grid = el('div', { class: 'padgrid' }, [
      el('span', { class: 'padgap' }),
      button('▲', 'Forward', function () { a.fwd(); }),
      el('span', { class: 'padgap' }),
      button('◀', 'Sidestep left', function () { a.left(); }),
      button('▼', 'Back', function () { a.back(); }),
      button('▶', 'Sidestep right', function () { a.right(); }),
      button('⟲', 'Turn left', function () { a.turnL(); }),
      button('⟳', 'Turn right', function () { a.turnR(); }),
      el('span', { class: 'padgap' })
    ]);
    var extras = el('div', { class: 'padrow' }, [
      button('F', 'Search', function () { a.search(); }),
      button('L', 'Listen at door', function () { a.listen(); }),
      button('R', 'Camp', function () { a.camp(); })
    ]);
    host.appendChild(grid);
    host.appendChild(extras);
  }

  function apply() {
    if (!host) return;
    host.classList.toggle('hidden', !pref());
  }

  // ctx: { el (container), actions: { fwd, back, left, right, turnL, turnR, search, listen, camp } }
  function init(container, acts) {
    host = container;
    actions = acts;
    build();
    apply();
  }

  return { init: init, setPref: setPref, isOn: pref };
})();
