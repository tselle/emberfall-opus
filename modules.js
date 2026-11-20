/* modules.js — shared helpers: seeded random streams, dice, DOM and storage utilities. */
var EM = window.EM = window.EM || {};

EM.Mod = (function () {
  // 32-bit FNV-1a string hash.
  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // mulberry32: small, fast, deterministic generator.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Named, independent stream. Adding a new stream name never shifts existing ones.
  function stream(name, seed) {
    return rng((hash(name) ^ Math.imul((seed | 0) + 0x9E3779B9, 2654435761)) >>> 0);
  }

  // Dice notation: "2d6+1", "1d4", "3" (flat). Uses the given random source.
  function roll(spec, rnd) {
    rnd = rnd || EM.rand;
    var m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(spec);
    if (!m) return parseInt(spec, 10) || 0;
    var n = parseInt(m[1] || '1', 10), s = parseInt(m[2], 10);
    var total = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
    for (var i = 0; i < n; i++) total += 1 + Math.floor(rnd() * s);
    return total;
  }

  // Dice with extra dice added (used for depth scaling).
  function scaleDice(spec, extra) {
    var m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(spec);
    if (!m || !extra) return spec;
    var n = parseInt(m[1] || '1', 10) + extra;
    return n + 'd' + m[2] + (m[3] ? m[3].replace(/\s+/g, '') : '');
  }

  function pick(arr, rnd) {
    rnd = rnd || EM.rand;
    return arr[Math.floor(rnd() * arr.length)];
  }

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else if (v !== false && v != null) node.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  // localStorage wrapped so private windows and blocked storage never break the game.
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, val); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  var DIRS = [
    { dx: 0, dy: -1 }, // 0 north
    { dx: 1, dy: 0 },  // 1 east
    { dx: 0, dy: 1 },  // 2 south
    { dx: -1, dy: 0 }  // 3 west
  ];

  var CARDINAL = ['North', 'East', 'South', 'West'];

  return {
    hash: hash, rng: rng, stream: stream, roll: roll, scaleDice: scaleDice,
    pick: pick, el: el, store: store, DIRS: DIRS, CARDINAL: CARDINAL
  };
})();

EM.rand = Math.random;
EM.roll = EM.Mod.roll;
