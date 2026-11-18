'use strict';
window.LOL = window.LOL || {};
(function () {
  const U = (LOL.util = {});

  U.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.rng = function (seed) {
    const r = U.mulberry32(seed >>> 0);
    return {
      next: r,
      range: (a, b) => a + (b - a) * r(),
      int: (a, b) => a + Math.floor((b - a + 1) * r()),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      chance: (p) => r() < p,
      shuffle: (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
    };
  };

  // Value noise + fbm (deterministic per seed). Output roughly in [0,1].
  U.noise = function (seed) {
    const r = U.mulberry32(seed >>> 0);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    const p = [];
    for (let i = 0; i < 256; i++) { p.push(i); vals[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    function lat(ix, iy) { return vals[perm[perm[ix & 255] + (iy & 255)]]; }
    function n2(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
    function fbm(x, y, oct) {
      oct = oct || 4;
      let s = 0, amp = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += amp * n2(x * f + i * 17.3, y * f - i * 9.1); n += amp; amp *= 0.5; f *= 2.03; }
      return s / n;
    }
    return { n2, fbm };
  };

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.hexToRgb = (h) => {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  };
  U.rgbStr = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  U.shade = (hex, f) => {
    const c = typeof hex === 'string' ? U.hexToRgb(hex) : hex;
    return U.rgbStr(f >= 0 ? c.map((v) => v + (255 - v) * f) : c.map((v) => v * (1 + f)));
  };
  U.angleDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  U.turnToward = (a, b, max) => {
    const d = U.angleDiff(a, b);
    return Math.abs(d) <= max ? b : a + Math.sign(d) * max;
  };
  U.el = (id) => document.getElementById(id);
  U.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  U.zeroUnits = () => ({ inf: 0, tank: 0, art: 0 });
  U.copyUnits = (u) => ({ inf: u.inf, tank: u.tank, art: u.art });
  U.sumUnits = (u) => u.inf + u.tank + u.art;
  U.TYPES = ['inf', 'tank', 'art'];

  LOL.config = {
    unitName: { inf: 'Piyade', tank: 'Tank', art: 'Topçu' },
    cost: { inf: 8, tank: 25, art: 20 },
    upkeep: { inf: 0.2, tank: 0.6, art: 0.5 },
    power: { inf: 1, tank: 3.2, art: 2.4 },
    startGold: 60,
    capitalBonus: 5,
  };
  U.power = (u) => u.inf * LOL.config.power.inf + u.tank * LOL.config.power.tank + u.art * LOL.config.power.art;
  U.unitsText = (u) => {
    const n = LOL.config.unitName;
    const parts = [];
    U.TYPES.forEach((t) => { if (u[t] > 0) parts.push(u[t] + ' ' + n[t]); });
    return parts.length ? parts.join(', ') : 'ordu yok';
  };
})();
