/* figures.js — every texture and portrait is drawn here at start-up. No image files are used. */
var EM = window.EM = window.EM || {};

EM.Figures = (function () {
  var TEX = 64;

  // Draw a texture with a canvas painter, then keep its pixels for fast sampling.
  function bake(paint, seed) {
    var c = document.createElement('canvas');
    c.width = c.height = TEX;
    var g = c.getContext('2d');
    var rnd = EM.Mod.rng(seed);
    paint(g, rnd);
    return g.getImageData(0, 0, TEX, TEX).data;
  }

  function speckle(g, rnd, n, colours) {
    for (var i = 0; i < n; i++) {
      g.fillStyle = colours[Math.floor(rnd() * colours.length)];
      g.fillRect(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), 2, 2);
    }
  }

  function stone(g, rnd) {
    g.fillStyle = '#6d6f78'; g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = '#3b3d44'; g.lineWidth = 3;
    for (var row = 0; row < 4; row++) {
      var off = row % 2 ? 0 : 16;
      for (var x = -16; x < TEX + 16; x += 32) {
        var bx = x + off;
        g.strokeRect(bx, row * 16, 32, 16);
        g.fillStyle = ['#7b7e88', '#66697a', '#73767f'][Math.floor(rnd() * 3)];
        g.fillRect(bx + 3, row * 16 + 3, 26, 10);
      }
    }
    speckle(g, rnd, 60, ['#55575e', '#8a8d96', '#4a4c52']);
  }

  function brick(g, rnd) {
    g.fillStyle = '#7a3d2e'; g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = '#c9b89a'; g.lineWidth = 2;
    for (var row = 0; row < 8; row++) {
      var off = row % 2 ? 0 : 8;
      g.beginPath(); g.moveTo(0, row * 8); g.lineTo(TEX, row * 8); g.stroke();
      for (var x = -8; x < TEX + 8; x += 16) {
        g.beginPath(); g.moveTo(x + off, row * 8); g.lineTo(x + off, row * 8 + 8); g.stroke();
      }
    }
    speckle(g, rnd, 80, ['#94503d', '#632f23', '#8f5a48']);
  }

  function wood(g, rnd) {
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, TEX, TEX);
    for (var i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#5a3d22' : '#7a5632';
      g.fillRect(i * 8, 0, 8, TEX);
    }
    g.strokeStyle = '#2e1e10'; g.lineWidth = 1;
    for (var k = 0; k < 8; k++) { g.beginPath(); g.moveTo(k * 8, 0); g.lineTo(k * 8, TEX); g.stroke(); }
    speckle(g, rnd, 30, ['#3c2814', '#8a6440']);
  }

  function door(g, rnd) {
    wood(g, rnd);
    g.fillStyle = '#3a2716';
    g.fillRect(4, 4, TEX - 8, TEX - 8);
    g.fillStyle = '#c9a545'; g.beginPath(); g.arc(TEX - 12, TEX / 2, 3, 0, 6.3); g.fill();
    g.fillStyle = '#1b130a'; g.fillRect(TEX / 2 - 1, 4, 2, TEX - 8);
  }

  function lockedDoor(g, rnd) {
    door(g, rnd);
    g.fillStyle = '#4b4f57';
    g.fillRect(4, TEX / 2 - 6, TEX - 8, 4);
    g.fillRect(4, TEX / 2 + 4, TEX - 8, 4);
    g.fillStyle = '#c9a545'; g.fillRect(TEX / 2 - 3, TEX / 2 - 3, 6, 8);
  }

  function temple(g, rnd) {
    g.fillStyle = '#d9d6cc'; g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = '#b5b0a2'; g.lineWidth = 2;
    for (var y = 0; y < TEX; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(TEX, y); g.stroke(); }
    g.fillStyle = '#e0b948'; g.fillRect(29, 12, 6, 40); g.fillRect(16, 22, 32, 6);
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(32, 14, 4, 0, 6.3); g.fill();
    speckle(g, rnd, 40, ['#c9c4b4', '#eeeade']);
  }

  function inn(g, rnd) {
    wood(g, rnd);
    g.fillStyle = '#e8d9a6'; g.fillRect(12, 14, 40, 18);
    g.fillStyle = '#2d4a2a'; g.beginPath(); g.ellipse(32, 23, 14, 6, 0, 0, 6.3); g.fill();
    g.fillStyle = '#e8d9a6'; g.fillRect(28, 20, 8, 2);
    g.fillStyle = '#7a1f1f'; g.fillRect(12, 40, 40, 4);
  }

  function hall(g, rnd) {
    stone(g, rnd);
    g.strokeStyle = '#cfd3da'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(16, 14); g.lineTo(48, 50); g.stroke();
    g.beginPath(); g.moveTo(48, 14); g.lineTo(16, 50); g.stroke();
    g.fillStyle = '#b8a27a'; g.fillRect(28, 26, 8, 14);
  }

  function shop(g, rnd) {
    g.fillStyle = '#c8c0a6'; g.fillRect(0, 0, TEX, TEX);
    for (var i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#2f6b8a' : '#e6e0cf';
      g.fillRect(i * 8, 0, 8, 22);
    }
    g.fillStyle = '#7a5632'; g.fillRect(4, 26, TEX - 8, TEX - 30);
    g.fillStyle = '#e6c26a'; g.fillRect(14, 36, 36, 8);
    speckle(g, rnd, 20, ['#5a3d22', '#8a6440']);
  }

  function gate(g, rnd) {
    wood(g, rnd);
    g.fillStyle = '#2a1a0e';
    g.beginPath(); g.moveTo(10, TEX); g.lineTo(10, 26); g.arc(TEX / 2, 26, TEX / 2 - 10, Math.PI, 0); g.lineTo(TEX - 10, TEX); g.fill();
    g.fillStyle = '#4b4f57'; g.fillRect(4, 8, TEX - 8, 3);
  }

  function stairs(g, rnd) {
    stone(g, rnd);
    g.fillStyle = '#23252b';
    for (var i = 0; i < 6; i++) g.fillRect(10 + i * 2, 10 + i * 8, 44 - i * 4, 4);
  }

  function cobble(g, rnd) {
    g.fillStyle = '#5c5a52'; g.fillRect(0, 0, TEX, TEX);
    for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
      var ox = (y % 2) * 8;
      g.fillStyle = ['#6f6c63', '#66635b', '#7a776d'][Math.floor(rnd() * 3)];
      g.fillRect(x * 16 + ox % 16 + 1, y * 16 + 1, 14, 14);
    }
  }

  var TEXTURES = null;
  function textures() {
    if (TEXTURES) return TEXTURES;
    TEXTURES = {
      stone: bake(stone, 11),
      brick: bake(brick, 12),
      door: bake(door, 13),
      locked: bake(lockedDoor, 14),
      temple: bake(temple, 15),
      inn: bake(inn, 16),
      hall: bake(hall, 17),
      shop: bake(shop, 18),
      gate: bake(gate, 19),
      stairs: bake(stairs, 20),
      cobble: bake(cobble, 21)
    };
    return TEXTURES;
  }

  // Wall texture for a map code, given the kind of place it is in.
  function wallTexture(code, kind) {
    var t = textures();
    switch (code) {
      case 'T': return t.temple;
      case 'I': return t.inn;
      case 'H': return t.hall;
      case 'S': return t.shop;
      case 'D': return t.door;
      case 'L': return t.locked;
      case '=': return t.gate;
      case '>': case '<': return t.stairs;
      default: return kind === 'town' ? t.brick : t.stone;
    }
  }

  // ---- portraits -------------------------------------------------------------
  var SKIN = { human: '#e0b08a', dwarf: '#c8946a', elf: '#f1d3b5', gnome: '#d9a77f', 'half-elf': '#e8c09a', halfling: '#e6b98e' };
  var HAIR = ['#2b1d12', '#6b3d1e', '#c9a04a', '#d9d4c7', '#1d1f2a', '#8a2d22', '#4a4a4a'];

  function portrait(canvas, ch) {
    var w = canvas.width, h = canvas.height;
    var g = canvas.getContext('2d');
    var rnd = EM.Mod.rng(ch.portrait * 97 + 5);
    g.fillStyle = ['#34465a', '#5a3d3d', '#3d5a3d', '#4f3d5a', '#5a523d'][ch.portrait % 5];
    g.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h * 0.46, r = Math.min(w, h) * 0.22;
    // shoulders and cloak
    g.fillStyle = ch.cls === 'mage' ? '#3a2a6a' : ch.cls === 'cleric' ? '#ece6d2' : ch.cls === 'thief' ? '#2a2a2a' : '#6a4a2a';
    g.beginPath(); g.ellipse(cx, h * 1.05, w * 0.42, h * 0.36, 0, 0, Math.PI * 2); g.fill();
    // neck and head
    g.fillStyle = SKIN[ch.race] || '#e0b08a';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    if (ch.race === 'elf' || ch.race === 'half-elf') {
      g.beginPath(); g.moveTo(cx - r * 0.8, cy - r * 0.1); g.lineTo(cx - r * 1.5, cy - r * 0.45); g.lineTo(cx - r * 0.8, cy + r * 0.3); g.fill();
      g.beginPath(); g.moveTo(cx + r * 0.8, cy - r * 0.1); g.lineTo(cx + r * 1.5, cy - r * 0.45); g.lineTo(cx + r * 0.8, cy + r * 0.3); g.fill();
    }
    // hair or helmet by class
    var hair = HAIR[Math.floor(rnd() * HAIR.length)];
    if (ch.cls === 'fighter' || ch.cls === 'paladin') {
      g.fillStyle = '#9aa3ad';
      g.beginPath(); g.arc(cx, cy - r * 0.15, r * 1.08, Math.PI, 0); g.fill();
      g.fillStyle = '#5a6068'; g.fillRect(cx - r * 0.1, cy - r * 1.1, r * 0.2, r * 0.8);
    } else if (ch.cls === 'mage') {
      g.fillStyle = '#2c2360';
      g.beginPath(); g.moveTo(cx - r * 1.2, cy - r * 0.2); g.lineTo(cx, cy - r * 2.1); g.lineTo(cx + r * 1.2, cy - r * 0.2); g.fill();
    } else if (ch.cls === 'thief') {
      g.fillStyle = '#1b1b1f';
      g.beginPath(); g.arc(cx, cy - r * 0.2, r * 1.05, Math.PI, 0); g.fill();
    } else {
      g.fillStyle = hair;
      g.beginPath(); g.arc(cx, cy - r * 0.2, r * 1.05, Math.PI, 0); g.fill();
    }
    // eyes and mouth
    g.fillStyle = '#1b1410';
    g.beginPath(); g.arc(cx - r * 0.38, cy + r * 0.05, r * 0.09, 0, 6.3); g.arc(cx + r * 0.38, cy + r * 0.05, r * 0.09, 0, 6.3); g.fill();
    g.strokeStyle = '#6b3d2a'; g.lineWidth = Math.max(1, r * 0.08);
    g.beginPath(); g.moveTo(cx - r * 0.25, cy + r * 0.5); g.lineTo(cx + r * 0.25, cy + r * 0.5); g.stroke();
    if (ch.race === 'dwarf') {
      g.fillStyle = hair; g.beginPath(); g.arc(cx, cy + r * 0.7, r * 0.45, 0, Math.PI); g.fill();
    }
    if (ch.status !== 'ok') {
      g.fillStyle = 'rgba(20,10,10,0.6)'; g.fillRect(0, 0, w, h);
    }
  }

  return {
    TEX: TEX, textures: textures, wallTexture: wallTexture, portrait: portrait
  };
})();
