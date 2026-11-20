/* map.js — minimap under the view and the full-page map (M key). Only squares the party has seen are drawn. */
var EM = window.EM = window.EM || {};

EM.Map = (function () {
  var COLOURS = {
    '#': '#8a8f99', 's': '#8a8f99', '.': '#3d3f48', 'd': '#7a5a32', 'D': '#a7733a', 'L': '#c9a545',
    'T': '#f0ead0', 'I': '#c48a4a', 'H': '#b7bcc7', 'S': '#5fa3c7', '=': '#6b4a2b', '<': '#e0e0e0', '>': '#e0e0e0'
  };

  // Draw the level into a canvas. opts: {cell (pixels), full (bool), traps (array of {x,y,found}), events (object)}.
  function draw(canvas, level, seen, cam, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var gw = level.grid[0].length, gh = level.grid.length;
    var cw = canvas.width, ch = canvas.height;
    var cell = Math.max(2, Math.floor(Math.min(cw / gw, ch / gh)));
    var ox = Math.floor((cw - cell * gw) / 2), oy = Math.floor((ch - cell * gh) / 2);
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(0, 0, cw, ch);

    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var key = x + ',' + y;
        if (!seen[key]) continue;
        var c = level.grid[y][x];
        ctx.fillStyle = COLOURS[c] || COLOURS['.'];
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }

    // Loot piles on squares the company has seen: a small gold dot.
    Object.keys(opts.loot || {}).forEach(function (k) {
      if (!seen[k]) return;
      var p = k.split(',');
      ctx.fillStyle = '#ffd24a';
      var s2 = Math.max(2, cell * 0.3);
      ctx.fillRect(ox + p[0] * cell + (cell - s2) / 2, oy + p[1] * cell + (cell - s2) / 2, s2, s2);
    });

    (opts.traps || []).forEach(function (t) {
      if (!t.found || !seen[t.x + ',' + t.y]) return;
      ctx.fillStyle = '#e0553a';
      var s = Math.max(1, cell * 0.4);
      ctx.fillRect(ox + t.x * cell + (cell - s) / 2, oy + t.y * cell + (cell - s) / 2, s, s);
    });

    if (cam) {
      var px = ox + cam.x * cell, py = oy + cam.y * cell;
      var r = Math.max(2, cell * 0.42);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(cam.a) * r * 1.6, py + Math.sin(cam.a) * r * 1.6);
      ctx.lineTo(px + Math.cos(cam.a + 2.4) * r, py + Math.sin(cam.a + 2.4) * r);
      ctx.lineTo(px + Math.cos(cam.a - 2.4) * r, py + Math.sin(cam.a - 2.4) * r);
      ctx.closePath();
      ctx.fill();
    }
    return { cell: cell, ox: ox, oy: oy };
  }

  return { draw: draw, COLOURS: COLOURS };
})();
