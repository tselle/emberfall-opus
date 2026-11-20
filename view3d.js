/* view3d.js — first-person textured raycaster. Renders a 320x200 buffer that CSS scales up,
   which keeps the work per frame small enough for an old tablet. */
var EM = window.EM = window.EM || {};

EM.View3D = (function () {
  var W = 320, H = 200, PLANE = 0.66, TEXN = 64;
  var SOLID = { '#': 1, 'T': 1, 'I': 1, 'H': 1, 'S': 1, 'D': 1, 'L': 1, 's': 1, '=': 1, '<': 1, '>': 1 };

  var THEMES = {
    town: { ceilTop: [92, 140, 196], ceilBot: [196, 214, 226], floorTop: [70, 74, 66], floorBot: [120, 118, 104] },
    dungeon: { ceilTop: [12, 10, 14], ceilBot: [40, 34, 34], floorTop: [18, 16, 18], floorBot: [58, 54, 56] }
  };

  function isSolid(ch) { return !!SOLID[ch]; }

  function Renderer(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.img = this.ctx.createImageData(W, H);
    this.buf = this.img.data;
    this.zbuf = new Float32Array(W);
  }

  // grid: array of strings or arrays of chars; cam: {x, y, a} with a in radians; sprites: monster groups.
  Renderer.prototype.draw = function (grid, kind, cam, sprites) {
    var buf = this.buf, zbuf = this.zbuf;
    var theme = THEMES[kind] || THEMES.dungeon;
    var gh = grid.length, gw = grid[0].length;
    var dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
    var planeX = -dirY * PLANE, planeY = dirX * PLANE;
    var tex = this.textureSet(kind);

    // Ceiling and floor rows are shaded once per frame.
    for (var y = 0; y < H; y++) {
      var t = y / (H - 1), r, g, b, base, top, bot;
      if (y < H / 2) {
        top = theme.ceilTop; bot = theme.ceilBot; t = y / (H / 2);
      } else {
        top = theme.floorTop; bot = theme.floorBot; t = (y - H / 2) / (H / 2);
      }
      r = top[0] + (bot[0] - top[0]) * t;
      g = top[1] + (bot[1] - top[1]) * t;
      b = top[2] + (bot[2] - top[2]) * t;
      for (var x = 0; x < W; x++) {
        base = (y * W + x) * 4;
        buf[base] = r; buf[base + 1] = g; buf[base + 2] = b; buf[base + 3] = 255;
      }
    }

    for (var col = 0; col < W; col++) {
      var camX = 2 * col / W - 1;
      var rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      var mapX = Math.floor(cam.x), mapY = Math.floor(cam.y);
      var dX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      var dY = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      var stepX, stepY, sdX, sdY;
      if (rdx < 0) { stepX = -1; sdX = (cam.x - mapX) * dX; } else { stepX = 1; sdX = (mapX + 1 - cam.x) * dX; }
      if (rdy < 0) { stepY = -1; sdY = (cam.y - mapY) * dY; } else { stepY = 1; sdY = (mapY + 1 - cam.y) * dY; }

      var hit = false, side = 0, code = '#', guard = 0;
      while (!hit && guard++ < 96) {
        if (sdX < sdY) { sdX += dX; mapX += stepX; side = 0; }
        else { sdY += dY; mapY += stepY; side = 1; }
        code = (mapY < 0 || mapY >= gh || mapX < 0 || mapX >= gw) ? '#' : grid[mapY][mapX];
        if (isSolid(code)) hit = true;
      }
      if (!hit) { zbuf[col] = 99; continue; }

      var perp = side === 0 ? (mapX - cam.x + (1 - stepX) / 2) / rdx : (mapY - cam.y + (1 - stepY) / 2) / rdy;
      if (perp < 0.05) perp = 0.05;
      zbuf[col] = perp;
      var lineH = Math.floor(H / perp);
      var y0 = Math.max(0, Math.floor(H / 2 - lineH / 2));
      var y1 = Math.min(H - 1, Math.floor(H / 2 + lineH / 2));

      var wallX = side === 0 ? cam.y + perp * rdy : cam.x + perp * rdx;
      wallX -= Math.floor(wallX);
      var texX = Math.floor(wallX * TEXN);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = TEXN - texX - 1;

      var source = tex[code] || tex['#'];
      var shade = Math.max(0.28, 1 - perp / 13) * (side === 1 ? 0.74 : 1);
      var step = TEXN / lineH;
      var texPos = (y0 - H / 2 + lineH / 2) * step;
      for (var yy = y0; yy <= y1; yy++) {
        var texY = Math.floor(texPos) & (TEXN - 1);
        texPos += step;
        var si = (texY * TEXN + texX) * 4;
        var di = (yy * W + col) * 4;
        buf[di] = source[si] * shade;
        buf[di + 1] = source[si + 1] * shade;
        buf[di + 2] = source[si + 2] * shade;
        buf[di + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    if (sprites && sprites.length) this.drawSprites(sprites, cam, dirX, dirY, planeX, planeY);
  };

  // Monster groups are drawn as simple standing figures, hidden behind walls by the depth buffer.
  Renderer.prototype.drawSprites = function (list, cam, dirX, dirY, planeX, planeY) {
    var ctx = this.ctx, zbuf = this.zbuf;
    var inv = 1 / (planeX * dirY - dirX * planeY);
    var items = [];
    list.forEach(function (g) {
      var sx = g.x + 0.5 - cam.x, sy = g.y + 0.5 - cam.y;
      var tx = inv * (dirY * sx - dirX * sy), ty = inv * (-planeY * sx + planeX * sy);
      if (ty > 0.3 && ty < 12) items.push({ g: g, tx: tx, ty: ty });
    });
    items.sort(function (a, b) { return b.ty - a.ty; });
    items.forEach(function (it) {
      var g = it.g, ty = it.ty;
      var cx = Math.floor((W / 2) * (1 + it.tx / ty));
      var size = Math.max(4, Math.floor(Math.abs(H / ty) * 0.7));
      var top = Math.floor(H / 2 - size * 0.45);
      var half = Math.max(2, Math.floor(size * 0.26));
      var hue = EM.Mod.hash(g.kind) % 360;
      var light = g.state === 'sleep' ? 30 : 42;
      ctx.fillStyle = 'hsl(' + hue + ',45%,' + light + '%)';
      for (var col = cx - half; col <= cx + half; col++) {
        if (col < 0 || col >= W || zbuf[col] <= ty) continue;
        ctx.fillRect(col, top + size * 0.32, 1, size * 0.68);
      }
      if (cx >= 0 && cx < W && zbuf[cx] > ty) {
        ctx.fillRect(cx - half, top, half * 2 + 1, size * 0.34);
        ctx.fillStyle = g.state === 'sleep' ? '#9aa0ff' : '#ff5a3c';
        ctx.fillRect(cx - half * 0.6, top + size * 0.12, 2, 2);
        ctx.fillRect(cx + half * 0.6 - 1, top + size * 0.12, 2, 2);
      }
    });
  };

  Renderer.prototype.textureSet = function (kind) {
    if (this._set && this._setKind === kind) return this._set;
    var F = EM.Figures, set = {};
    var codes = ['#', 'T', 'I', 'H', 'S', 'D', 'L', 's', '=', '<', '>'];
    codes.forEach(function (c) { set[c] = F.wallTexture(c, kind); });
    this._set = set;
    this._setKind = kind;
    return set;
  };

  return { Renderer: Renderer, isSolid: isSolid, W: W, H: H, THEMES: THEMES };
})();
