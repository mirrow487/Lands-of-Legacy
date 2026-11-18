'use strict';
(function () {
  // ======================================================================
  //  Isometric real-time tactical battle (RTS style)
  // ======================================================================
  const U = LOL.util;
  const TW = 64, TH = 32, N = 48, SIDEBAR = 232;
  const T_GRASS = 0, T_DGRASS = 1, T_DIRT = 2, T_SAND = 3, T_WATER = 4, T_FORD = 5, T_ROAD = 6, T_BRIDGE = 7, T_FIELD = 8;
  const PALETTES = {
    temperate: [[92, 132, 60], [72, 112, 46], [138, 116, 78], [200, 182, 128], [38, 86, 128], [84, 128, 142], [150, 126, 88], [38, 86, 128], [176, 158, 74]],
    desert: [[196, 170, 112], [178, 150, 96], [168, 128, 82], [222, 198, 142], [46, 110, 140], [110, 150, 150], [160, 130, 92], [46, 110, 140], [170, 160, 80]],
    snow: [[226, 230, 236], [206, 214, 222], [170, 168, 170], [216, 216, 210], [70, 100, 130], [150, 170, 185], [150, 140, 130], [70, 100, 130], [214, 214, 206]],
  };
  let TILE_RGB = PALETTES.temperate;

  const UT = {
    inf: { name: 'Piyade', foot: true, hp: 60, speed: 1.45, range: 4.2, minRange: 0, sight: 6.5, dmg: 9, rof: 0.8, radius: 0.2, armor: 'inf', weapon: 'rifle', turn: 12 },
    mg: { name: 'Makineli Tüfek', foot: true, hp: 70, speed: 1.1, range: 5.2, minRange: 0, sight: 7, dmg: 4.2, rof: 0.16, radius: 0.24, armor: 'inf', weapon: 'mg', turn: 8, burst: 1 },
    at: { name: 'Tanksavar', foot: true, hp: 55, speed: 1.3, range: 4.8, minRange: 0, sight: 6.5, dmg: 70, rof: 3.4, radius: 0.2, armor: 'inf', weapon: 'atr', turn: 10 },
    recon: { name: 'Zırhlı Keşif', hp: 160, speed: 3.3, range: 5, minRange: 0, sight: 10, dmg: 6, rof: 0.22, radius: 0.36, armor: 'light', weapon: 'mg', turn: 5, turret: true, turretTurn: 7 },
    tank: { name: 'Tank', hp: 320, speed: 2.0, range: 5.2, minRange: 0, sight: 7, dmg: 46, rof: 2.1, radius: 0.4, armor: 'heavy', weapon: 'cannon', turn: 3.0, turret: true, turretTurn: 4.5, splash: 0.55 },
    heavy: { name: 'Ağır Tank', hp: 680, speed: 1.3, range: 5.8, minRange: 0, sight: 7, dmg: 88, rof: 3.0, radius: 0.5, armor: 'heavy', weapon: 'bigcannon', turn: 1.8, turret: true, turretTurn: 2.6, splash: 0.75 },
    art: { name: 'Topçu', hp: 140, speed: 1.2, range: 10.5, minRange: 3, sight: 11, dmg: 80, rof: 4.6, radius: 0.38, armor: 'art', weapon: 'shell', turn: 2.4, splash: 1.4 },
    rocket: { name: 'Roket Topçusu', hp: 150, speed: 1.6, range: 12, minRange: 4, sight: 12.5, dmg: 32, rof: 10, radius: 0.4, armor: 'art', weapon: 'rocket', turn: 2.6, splash: 1.1, salvo: 8 },
  };
  const isFoot = (u) => UT[u.type].foot;
  const MULT = {
    rifle: { inf: 1, light: 0.3, heavy: 0.08, art: 0.45 },
    mg: { inf: 1.35, light: 0.35, heavy: 0.04, art: 0.4 },
    atr: { inf: 0.35, light: 1.2, heavy: 1.05, art: 1 },
    cannon: { inf: 0.55, light: 1.1, heavy: 0.85, art: 1.1 },
    bigcannon: { inf: 0.6, light: 1.2, heavy: 1, art: 1.2 },
    shell: { inf: 1, light: 0.7, heavy: 0.45, art: 0.8 },
    rocket: { inf: 1, light: 0.6, heavy: 0.35, art: 0.8 },
  };
  const MAX_PER_SIDE = 36;

  const B = (LOL.battle = { UT });
  let st = null, canvas = null, ctx = null;
  let OX = 0, OY = 0;
  let treeSprites = null;
  let nextId = 1;

  // ---------------- projection ----------------
  const isoX = (x, y) => OX + (x - y) * TW / 2;
  const isoY = (x, y) => OY + (x + y) * TH / 2;
  const sp = (x, y, h) => [isoX(x, y) - st.camX, isoY(x, y) - st.camY - (h || 0)];
  function screenToTile(sx, sy) {
    const wx = sx + st.camX - OX, wy = sy + st.camY - OY;
    const a = wx / (TW / 2), b = wy / (TH / 2);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const walk = (x, y) => inb(x, y) && !st.block[y * N + x];
  const walkAt = (fx, fy) => walk(Math.floor(fx), Math.floor(fy));
  const viewW = () => canvas.width - SIDEBAR;
  const viewH = () => canvas.height;

  // ======================================================================
  //  Map generation
  // ======================================================================
  function genMap(seed, defSide, terrain, fort) {
    const TR = { 'Ova': { tree: 0.68, rnd: 0.006, rock: 0.004, river: 0.4, lake: 0.28 }, 'Ormanlık': { tree: 0.5, rnd: 0.03, rock: 0.004, river: 0.4, lake: 0.26 }, 'Tepelik': { tree: 0.64, rnd: 0.01, rock: 0.03, river: 0.25, lake: 0.22 }, 'Kıyı': { tree: 0.7, rnd: 0.006, rock: 0.006, river: 0.9, lake: 0.36 }, 'Çöl': { tree: 0.8, rnd: 0.003, rock: 0.02, river: 0.15, lake: 0.18 }, 'Tundra': { tree: 0.6, rnd: 0.012, rock: 0.015, river: 0.35, lake: 0.26 } }[terrain] || { tree: 0.6, rnd: 0.012, rock: 0.006, river: 0.55, lake: 0.3 };
    const rng = U.rng(seed);
    const nz = U.noise(seed + 3), nz2 = U.noise(seed + 9), nz3 = U.noise(seed + 15);
    const tiles = new Uint8Array(N * N), block = new Uint8Array(N * N);
    const objAt = new Int16Array(N * N).fill(-1);
    const P = { x: 7, y: N - 8 }, E = { x: N - 8, y: 7 };
    const river = rng.next() < TR.river;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const m = nz.fbm(x / 9, y / 9, 3);
      let t = T_GRASS;
      if (m > 0.6) t = T_DGRASS; else if (m < 0.37) t = T_DIRT;
      if (river) {
        const u = x - y, v = x + y;
        const mc = (nz2.fbm(v / 16, 3.3, 3) - 0.5) * 18;
        if (Math.abs(u - mc) < 1.7) t = T_WATER;
      } else if (nz3.fbm(x / 8, y / 8, 3) < TR.lake) t = T_WATER;
      if (Math.hypot(x - P.x, y - P.y) < 7 || Math.hypot(x - E.x, y - E.y) < 7) { if (t === T_WATER) t = T_GRASS; }
      tiles[y * N + x] = t;
    }
    // road from spawn to spawn
    const roadTiles = [];
    const L = Math.hypot(E.x - P.x, E.y - P.y);
    for (let s = 0; s <= 1; s += 0.5 / L) {
      const w = (nz2.fbm(s * 4, 7.7, 2) - 0.5) * 10;
      const x = Math.floor(U.lerp(P.x, E.x, s) + w * 0.7), y = Math.floor(U.lerp(P.y, E.y, s) + w * 0.7);
      if (!inb(x, y)) continue;
      const i = y * N + x;
      tiles[i] = tiles[i] === T_WATER || tiles[i] === T_FORD || tiles[i] === T_BRIDGE ? T_BRIDGE : T_ROAD;
      roadTiles.push(i);
    }
    if (river) {
      for (let k = 0; k < 2; k++) {
        const fv = rng.int(14, 2 * N - 14);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (tiles[y * N + x] === T_WATER && Math.abs(x + y - fv) <= 1) tiles[y * N + x] = T_FORD;
        }
      }
    }
    // sand shores
    const isW = (x, y) => inb(x, y) && tiles[y * N + x] === T_WATER;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (tiles[i] === T_WATER || tiles[i] === T_FORD || tiles[i] === T_ROAD || tiles[i] === T_BRIDGE) continue;
      if (isW(x - 1, y) || isW(x + 1, y) || isW(x, y - 1) || isW(x, y + 1) || isW(x - 1, y - 1) || isW(x + 1, y + 1)) {
        if (rng.next() < 0.85) tiles[i] = T_SAND;
      }
    }

    const objects = [];
    const D = defSide === 0 ? P : E;
    const freeTile = (x, y, margin) => {
      if (!inb(x, y)) return false;
      const t = tiles[y * N + x];
      if (t === T_WATER || t === T_FORD || t === T_ROAD || t === T_BRIDGE || t === T_FIELD) return false;
      if (block[y * N + x]) return false;
      if (Math.hypot(x - P.x, y - P.y) < (margin || 6) || Math.hypot(x - E.x, y - E.y) < (margin || 6)) return false;
      return true;
    };
    const place = (o) => {
      const idx = objects.length;
      objects.push(o);
      for (let y = o.y; y < o.y + o.d; y++) for (let x = o.x; x < o.x + o.w; x++) { block[y * N + x] = 1; objAt[y * N + x] = idx; }
    };
    // defender town
    const cx = N / 2, cy = N / 2;
    const town = { x: U.lerp(D.x, cx, 0.42), y: U.lerp(D.y, cy, 0.42) };
    const houseCols = ['#cdbb94', '#b9a27c', '#d6c9a8', '#a89070', '#c4b08a'];
    const roofCols = ['#8e3b2a', '#6e4a32', '#7a2f25', '#5c5048', '#94552f'];
    let houses = rng.int(4, 7);
    for (let t = 0; t < 200 && houses > 0; t++) {
      const hx = Math.round(town.x + rng.range(-7, 7)), hy = Math.round(town.y + rng.range(-7, 7));
      const w = rng.chance(0.5) ? 2 : 3, d = w === 3 ? 2 : rng.int(2, 3);
      let ok = true;
      for (let y = hy - 1; y < hy + d + 1 && ok; y++) for (let x = hx - 1; x < hx + w + 1 && ok; x++) if (!freeTile(x, y, 7)) ok = false;
      if (!ok) continue;
      place({ type: 'house', x: hx, y: hy, w, d, wall: rng.pick(houseCols), roof: rng.pick(roofCols), ruined: rng.chance(0.25) });
      houses--;
    }
    // a couple of ruins in no-man's land
    for (let t = 0; t < 60; t++) {
      const hx = rng.int(14, N - 16), hy = rng.int(14, N - 16);
      const w = 2, d = 2;
      let ok = true;
      for (let y = hy - 1; y < hy + d + 1 && ok; y++) for (let x = hx - 1; x < hx + w + 1 && ok; x++) if (!freeTile(x, y, 9)) ok = false;
      if (!ok) continue;
      place({ type: 'house', x: hx, y: hy, w, d, wall: '#9a8f80', roof: '#4e4640', ruined: true });
      if (rng.chance(0.5)) break;
    }
    // sandbag line for defender
    {
      const dx = cx - D.x, dy = cy - D.y, dl = Math.hypot(dx, dy);
      const fx = dx / dl, fy = dy / dl, px = -fy, py = fx;
      for (let k = -5; k <= 5; k++) {
        if (Math.abs(k) === 2 || k === 0) continue; // gaps
        const x = Math.round(D.x + fx * 9 + px * k), y = Math.round(D.y + fy * 9 + py * k);
        if (freeTile(x, y, 4)) place({ type: 'sandbag', x, y, w: 1, d: 1 });
      }
      for (let lv = 1; lv <= (fort || 0); lv++) {
        const dist = 9 + lv * 2.5;
        for (let k = -6; k <= 6; k++) {
          if (Math.abs(k) % 3 === 0) continue;
          const x = Math.round(D.x + fx * dist + px * k), y = Math.round(D.y + fy * dist + py * k);
          if (freeTile(x, y, 4)) place({ type: 'sandbag', x, y, w: 1, d: 1 });
        }
        for (const k of [-4, 4]) {
          const x = Math.round(D.x + fx * (dist - 1.5) + px * k), y = Math.round(D.y + fy * (dist - 1.5) + py * k);
          if (freeTile(x, y, 4)) place({ type: 'bunker', x, y, w: 1, d: 1 });
        }
      }
    }
    // trees and rocks
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = tiles[y * N + x];
      if (t !== T_GRASS && t !== T_DGRASS && t !== T_DIRT) continue;
      if (!freeTile(x, y, 6)) continue;
      const f = nz3.fbm(x / 5 + 50, y / 5 + 50, 3);
      if ((f > TR.tree && rng.next() < 0.6) || rng.next() < TR.rnd) place({ type: 'tree', x, y, w: 1, d: 1, v: rng.int(0, 3) });
      else if (rng.next() < TR.rock) place({ type: 'rock', x, y, w: 1, d: 1, v: rng.next() });
    }
    // fields near the town (with fences)
    const placeDeco = (o) => { o.deco = true; objects.push(o); };
    for (let k = 0; k < 4; k++) {
      const fx0 = Math.round(town.x + rng.range(-12, 12)), fy0 = Math.round(town.y + rng.range(-12, 12));
      const fw = rng.int(3, 5), fd = rng.int(3, 5);
      let ok = true;
      for (let y = fy0; y < fy0 + fd && ok; y++) for (let x = fx0; x < fx0 + fw && ok; x++) if (!freeTile(x, y, 7) || tiles[y * N + x] === T_SAND) ok = false;
      if (!ok) continue;
      for (let y = fy0; y < fy0 + fd; y++) for (let x = fx0; x < fx0 + fw; x++) tiles[y * N + x] = T_FIELD;
      for (let x = fx0; x < fx0 + fw; x++) { placeDeco({ type: 'fence', x, y: fy0 + fd, w: 1, d: 0.05, dir: 0 }); }
      for (let y = fy0; y < fy0 + fd; y++) { placeDeco({ type: 'fence', x: fx0 + fw, y, w: 0.05, d: 1, dir: 1 }); }
    }
    // telegraph poles along the road
    roadTiles.forEach((i, k) => {
      if (k % 5 !== 2) return;
      const x = (i % N) + 1, y = ((i / N) | 0);
      if (inb(x, y) && freeTile(x, y, 3)) placeDeco({ type: 'pole', x, y, w: 1, d: 1 });
    });
    // burnt-out wrecks from earlier fighting
    for (let k = 0, n = rng.int(1, 3); k < 40 && n > 0; k++) {
      const x = rng.int(12, N - 12), y = rng.int(12, N - 12);
      if (!freeTile(x, y, 8)) continue;
      place({ type: 'wreck', x, y, w: 1, d: 1, a: rng.range(0, 6.28), v: rng.int(0, 1) });
      n--;
    }
    for (let i = 0; i < N * N; i++) if (tiles[i] === T_WATER) block[i] = 1;

    // connectivity check P -> E, carve if needed
    const reach = () => {
      const seen = new Uint8Array(N * N);
      const q = [P.y * N + P.x]; seen[q[0]] = 1;
      while (q.length) {
        const j = q.pop();
        if (j === E.y * N + E.x) return true;
        const x = j % N, y = (j / N) | 0;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, ny = y + ay;
          if (!inb(nx, ny)) continue;
          const k = ny * N + nx;
          if (!seen[k] && !block[k]) { seen[k] = 1; q.push(k); }
        }
      }
      return false;
    };
    if (!reach()) {
      for (const i of roadTiles) {
        if (tiles[i] === T_WATER) tiles[i] = T_BRIDGE;
        block[i] = 0;
        const oi = objAt[i];
        if (oi >= 0 && objects[oi]) {
          const o = objects[oi];
          for (let y = o.y; y < o.y + o.d; y++) for (let x = o.x; x < o.x + o.w; x++) { block[y * N + x] = tiles[y * N + x] === T_WATER ? 1 : 0; objAt[y * N + x] = -1; }
          objects[oi] = null;
        }
      }
    }
    return { tiles, block, objects: objects.filter(Boolean), P, E };
  }

  // ======================================================================
  //  Terrain pre-render
  // ======================================================================
  function diamond(c, x, y, grow) {
    const g = grow || 0;
    c.beginPath();
    c.moveTo(isoX(x, y), isoY(x, y) - g);
    c.lineTo(isoX(x + 1, y) + g * 2, isoY(x + 1, y));
    c.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1) + g);
    c.lineTo(isoX(x, y + 1) - g * 2, isoY(x, y + 1));
    c.closePath();
  }
  function renderTerrain(seed) {
    const rng = U.rng(seed + 77);
    const nz = U.noise(seed + 101);
    const w = N * TW + TW, h = N * TH + TH * 2;
    OX = w / 2; OY = TH;
    // smooth terrain: bilinear blend of per-tile colours at quarter resolution + noise
    const tcol = new Float32Array(N * N * 3);
    const isWater = (x, y) => { x = U.clamp(x, 0, N - 1); y = U.clamp(y, 0, N - 1); return st.tiles[y * N + x] === T_WATER; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = st.tiles[y * N + x];
      const v = (nz.fbm(x / 4, y / 4, 3) - 0.5) * 30 + rng.range(-4, 4);
      let c = TILE_RGB[t];
      if (t === T_WATER) {
        let deep = 0;
        for (let k = -2; k <= 2; k++) for (let j = -2; j <= 2; j++) if (isWater(x + j, y + k)) deep++;
        const f = deep / 25;
        c = [U.lerp(70, 22, f), U.lerp(120, 62, f), U.lerp(140, 105, f)];
      }
      const i = (y * N + x) * 3;
      tcol[i] = c[0] + v; tcol[i + 1] = c[1] + v; tcol[i + 2] = c[2] + v * 0.6;
    }
    const sc = 4, bw = Math.ceil(w / sc), bh = Math.ceil(h / sc);
    const base = document.createElement('canvas'); base.width = bw; base.height = bh;
    const b = base.getContext('2d');
    const id = b.createImageData(bw, bh);
    const sm = (t) => t * t * (3 - 2 * t);
    for (let py = 0; py < bh; py++) for (let px = 0; px < bw; px++) {
      const wx = px * sc, wy = py * sc;
      const a = (wx - OX) / (TW / 2), bb = (wy - OY) / (TH / 2);
      const tx = (a + bb) / 2 - 0.5, ty = (bb - a) / 2 - 0.5;
      const x0 = Math.floor(tx), y0 = Math.floor(ty);
      const fx = sm(tx - x0), fy = sm(ty - y0);
      const cx0 = U.clamp(x0, 0, N - 1), cx1 = U.clamp(x0 + 1, 0, N - 1), cy0 = U.clamp(y0, 0, N - 1), cy1 = U.clamp(y0 + 1, 0, N - 1);
      const i00 = (cy0 * N + cx0) * 3, i10 = (cy0 * N + cx1) * 3, i01 = (cy1 * N + cx0) * 3, i11 = (cy1 * N + cx1) * 3;
      const n = (nz.n2(wx / 22, wy / 11) - 0.5) * 16 + (nz.n2(wx / 6, wy / 3) - 0.5) * 8;
      const o4 = (py * bw + px) * 4;
      for (let k = 0; k < 3; k++) {
        const top = tcol[i00 + k] + (tcol[i10 + k] - tcol[i00 + k]) * fx;
        const bot = tcol[i01 + k] + (tcol[i11 + k] - tcol[i01 + k]) * fx;
        id.data[o4 + k] = top + (bot - top) * fy + n * (k === 2 ? 0.6 : 1);
      }
      id.data[o4 + 3] = 255;
    }
    b.putImageData(id, 0, 0);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const o = out.getContext('2d');
    o.fillStyle = '#0c0f0a'; o.fillRect(0, 0, w, h);
    o.save();
    o.beginPath();
    o.moveTo(isoX(0, 0), isoY(0, 0)); o.lineTo(isoX(N, 0), isoY(N, 0)); o.lineTo(isoX(N, N), isoY(N, N)); o.lineTo(isoX(0, N), isoY(0, N)); o.closePath();
    o.clip();
    o.imageSmoothingEnabled = true;
    o.drawImage(base, 0, 0, bw, bh, 0, 0, bw * sc, bh * sc);
    o.restore();
    // clip to map diamond
    o.save();
    o.beginPath();
    o.moveTo(isoX(0, 0), isoY(0, 0)); o.lineTo(isoX(N, 0), isoY(N, 0)); o.lineTo(isoX(N, N), isoY(N, N)); o.lineTo(isoX(0, N), isoY(0, N)); o.closePath();
    o.clip();
    // details
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = st.tiles[y * N + x];
      if (t === T_FIELD) {
        // furrows / crop rows
        o.strokeStyle = st.snow ? 'rgba(150,150,160,0.35)' : 'rgba(110,90,30,0.45)'; o.lineWidth = 1;
        for (let k = 1; k < 5; k++) { const a = [isoX(x + k / 5, y), isoY(x + k / 5, y)], b = [isoX(x + k / 5, y + 1), isoY(x + k / 5, y + 1)]; o.beginPath(); o.moveTo(a[0], a[1]); o.lineTo(b[0], b[1]); o.stroke(); }
        if (!st.snow) for (let k = 0; k < 10; k++) { const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next()); o.fillStyle = 'rgba(240,210,100,0.5)'; o.fillRect(qx, qy - 2, 1, 2.5); }
      } else if (t === T_BRIDGE) {
        // wooden deck
        o.fillStyle = '#6a4a2a'; diamond(o, x, y, 0); o.fill();
        o.strokeStyle = 'rgba(30,20,10,0.6)'; o.lineWidth = 1;
        for (let k = 1; k < 6; k++) { const a = [isoX(x + k / 6, y), isoY(x + k / 6, y)], b = [isoX(x + k / 6, y + 1), isoY(x + k / 6, y + 1)]; o.beginPath(); o.moveTo(a[0], a[1]); o.lineTo(b[0], b[1]); o.stroke(); }
        o.strokeStyle = '#3a2a18'; o.lineWidth = 2;
        o.beginPath(); o.moveTo(isoX(x, y), isoY(x, y) - 4); o.lineTo(isoX(x + 1, y), isoY(x + 1, y) - 4); o.stroke();
        o.beginPath(); o.moveTo(isoX(x, y + 1), isoY(x, y + 1) - 4); o.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1) - 4); o.stroke();
      } else if (st.climate === 'snow' && (t === T_GRASS || t === T_DGRASS || t === T_DIRT)) {
        for (let k = 0; k < 3; k++) { const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next()); o.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(150,160,175,0.35)'; o.fillRect(qx, qy, 1.5, 1); }
      } else if (st.climate === 'desert' && (t === T_GRASS || t === T_DGRASS)) {
        for (let k = 0; k < 2; k++) { const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next()); o.strokeStyle = 'rgba(120,100,50,0.5)'; o.beginPath(); o.moveTo(qx - 2, qy); o.lineTo(qx, qy - 3); o.lineTo(qx + 2, qy); o.stroke(); }
      } else if (t === T_GRASS || t === T_DGRASS) {
        for (let k = 0; k < 7; k++) {
          const px = isoX(x + rng.next(), y + rng.next()), py = isoY(x + rng.next() * 0, y) + rng.next() * TH;
          const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next());
          const l = rng.next() < 0.5;
          o.strokeStyle = l ? 'rgba(160,200,90,0.35)' : 'rgba(30,60,20,0.35)';
          o.lineWidth = 1;
          o.beginPath(); o.moveTo(qx, qy); o.lineTo(qx + rng.range(-1, 1), qy - rng.range(2, 4)); o.stroke();
          if (k < 1 && rng.next() < 0.15) { o.fillStyle = rng.pick(['#e8d860', '#f0f0f0', '#d070a0']); o.fillRect(px, py, 1.5, 1.5); }
        }
      } else if (t === T_DIRT || t === T_ROAD || t === T_SAND) {
        for (let k = 0; k < 6; k++) {
          const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next());
          o.fillStyle = rng.next() < 0.5 ? 'rgba(60,45,25,0.35)' : 'rgba(230,210,170,0.25)';
          o.fillRect(qx, qy, rng.range(1, 2.5), rng.range(1, 2));
        }
      } else if (t === T_WATER) {
        o.strokeStyle = 'rgba(170,210,240,0.25)'; o.lineWidth = 1;
        for (let k = 0; k < 2; k++) {
          const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next());
          o.beginPath(); o.moveTo(qx - 5, qy); o.quadraticCurveTo(qx, qy - 2, qx + 5, qy); o.stroke();
        }
      } else if (t === T_FORD) {
        for (let k = 0; k < 5; k++) {
          const qx = isoX(x + rng.next(), y + rng.next()), qy = isoY(x + rng.next(), y + rng.next());
          o.fillStyle = 'rgba(200,200,190,0.35)';
          o.beginPath(); o.ellipse(qx, qy, 2.5, 1.3, 0, 0, 7); o.fill();
        }
      }
    }
    // road ruts
    o.restore();
    // map edge
    o.strokeStyle = 'rgba(0,0,0,0.8)'; o.lineWidth = 3;
    o.beginPath();
    o.moveTo(isoX(0, 0), isoY(0, 0)); o.lineTo(isoX(N, 0), isoY(N, 0)); o.lineTo(isoX(N, N), isoY(N, N)); o.lineTo(isoX(0, N), isoY(0, N)); o.closePath();
    o.stroke();
    return out;
  }

  function makeTreeSprites(climate) {
    const out = [];
    for (let v = 0; v < 4; v++) {
      const c = document.createElement('canvas'); c.width = 48; c.height = 70;
      const g = c.getContext('2d');
      if (climate === 'desert') {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(30, 62, 13, 5, 0, 0, 7); g.fill();
        g.strokeStyle = '#7a5a34'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(24, 62); g.quadraticCurveTo(20 + v * 2, 40, 25, 22); g.stroke();
        g.strokeStyle = '#5f8a2e'; g.lineWidth = 3;
        for (let k = 0; k < 7; k++) { const a = -Math.PI + k * Math.PI / 6; g.beginPath(); g.moveTo(25, 22); g.quadraticCurveTo(25 + Math.cos(a) * 9, 18 + Math.sin(a) * 4, 25 + Math.cos(a) * 15, 26 + Math.abs(Math.sin(a)) * 2); g.stroke(); }
        out.push(c); continue;
      }
      if (climate === 'snow' && v !== 2) {
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(30, 62, 14, 5, 0, 0, 7); g.fill();
        g.fillStyle = '#4a3420'; g.fillRect(22, 46, 4, 16);
        for (let k = 0; k < 4; k++) {
          const yy = 52 - k * 10, ww = 15 - k * 3;
          g.fillStyle = ['#2e4a36', '#34523c', '#3a5a42', '#406248'][k];
          g.beginPath(); g.moveTo(24 - ww, yy); g.lineTo(24 + ww, yy); g.lineTo(24, yy - 18); g.closePath(); g.fill();
          g.fillStyle = 'rgba(245,248,252,0.92)';
          g.beginPath(); g.moveTo(24 - ww * 0.75, yy - 3); g.lineTo(24 + ww * 0.3, yy - 4); g.lineTo(24, yy - 18); g.closePath(); g.fill();
        }
        out.push(c); continue;
      }
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(30, 62, 15, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#5a3e22'; g.fillRect(22, 46, 4, 16);
      const base = [[44, 92, 38], [52, 100, 40], [38, 84, 44], [60, 96, 36]][v];
      if (v === 2) { // pine
        for (let k = 0; k < 4; k++) {
          const yy = 50 - k * 10, ww = 15 - k * 3;
          g.fillStyle = U.rgbStr([base[0] - 6 + k * 4, base[1] - 10 + k * 6, base[2]]);
          g.beginPath(); g.moveTo(24 - ww, yy); g.lineTo(24 + ww, yy); g.lineTo(24, yy - 18); g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.beginPath(); g.moveTo(24, yy); g.lineTo(24 + ww, yy); g.lineTo(24, yy - 18); g.closePath(); g.fill();
        }
      } else {
        const blobs = [[24, 40, 14], [15, 33, 10], [33, 32, 10], [24, 24, 11], [18, 22, 7]];
        blobs.forEach(([x, y, r], k) => {
          g.fillStyle = U.rgbStr([base[0] + k * 3, base[1] + k * 5, base[2] + k * 2]);
          g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        });
        blobs.forEach(([x, y, r]) => {
          g.fillStyle = 'rgba(190,230,120,0.18)';
          g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.55, 0, 7); g.fill();
        });
        g.fillStyle = 'rgba(0,20,0,0.18)';
        g.beginPath(); g.arc(30, 42, 10, 0, 7); g.fill();
      }
      out.push(c);
    }
    return out;
  }

  // ======================================================================
  //  Setup
  // ======================================================================
  function scaleForces(u) {
    const total = U.sumUnits(u);
    if (total <= MAX_PER_SIDE) return U.copyUnits(u);
    const k = total / MAX_PER_SIDE;
    const r = {};
    U.TYPES.forEach((t) => { r[t] = u[t] > 0 ? Math.max(1, Math.round(u[t] / k)) : 0; });
    return r;
  }

  B.start = function (cfg) {
    canvas = LOL.app.canvas; ctx = LOL.app.ctx;

    return new Promise((resolve) => {
      const playerIsAtt = cfg.playerSide === 'attacker';
      const defSide = playerIsAtt ? 1 : 0;
      const seed = cfg.seed >>> 0;
      const wr = U.rng(seed + 555);
      const winter = [12, 1, 2].includes(cfg.month);
      const climate = cfg.terrain === 'Çöl' ? 'desert' : (cfg.terrain === 'Tundra' || (winter && cfg.biome !== 1 && cfg.biome !== 3 && cfg.biome !== 7)) ? 'snow' : 'temperate';
      TILE_RGB = PALETTES[climate];
      const r = wr.next();
      const weather = climate === 'snow' ? (r < 0.65 ? 'snow' : r < 0.8 ? 'fog' : 'clear') : climate === 'desert' ? (r < 0.15 ? 'dust' : 'clear') : (r < 0.22 ? 'rain' : r < 0.36 ? 'fog' : 'clear');
      treeSprites = makeTreeSprites(climate);
      const map = genMap(seed, defSide, cfg.terrain, cfg.fort || 0);
      st = {
        cfg, resolve, seed,
        tiles: map.tiles, block: map.block, objects: map.objects, spawns: [map.P, map.E],
        units: [], corpses: [], projectiles: [], particles: [], tracers: [], markers: [],
        camX: 0, camY: 0, sel: new Set(), groups: {}, time: 0, speed: 1, paused: false,
        ended: false, endTimer: -1, amoveMode: false, mouse: { x: 0, y: 0, inside: false }, drag: null, mdrag: null,
        keys: {}, lastClick: 0, sideColor: [], sideName: [], orig: [], bcount: [],
        ai: { mode: playerIsAtt ? 'hold' : 'attack', t: 3 },
        defSide, fort: cfg.fort || 0,
        mods: playerIsAtt ? [cfg.attEff || {}, cfg.defEff || {}] : [cfg.defEff || {}, cfg.attEff || {}],
        bannerT: 0, climate, weather, snow: climate === 'snow',
        fogOn: true, vis: new Uint8Array(N * N), seen: new Uint8Array(N * N), fogT: 0, wx: [],
      };
      st.objAt = new Array(N * N).fill(null);
      st.objects.forEach((o) => { if (o.deco) return; for (let y = o.y; y < o.y + o.d; y++) for (let x = o.x; x < o.x + o.w; x++) st.objAt[y * N + x] = o; });
      for (let i = 0; i < 260; i++) st.wx.push({ x: Math.random(), y: Math.random(), z: Math.random(), s: 0.5 + Math.random() });
      const attN = cfg.attacker, defN = cfg.defender;
      const sideNation = playerIsAtt ? [attN, defN] : [defN, attN];
      st.sideNation = sideNation;
      st.sideColor = sideNation.map((n) => U.hexToRgb(n.color));
      st.sideName = sideNation.map((n) => n.name);
      st.orig = playerIsAtt ? [cfg.attUnits, cfg.defUnits] : [cfg.defUnits, cfg.attUnits];
      st.bcount = st.orig.map(scaleForces);
      st.terrain = renderTerrain(seed);
      buildMinimapBase();
      spawnSide(0, st.bcount[0], map.P, map.E);
      spawnSide(1, st.bcount[1], map.E, map.P);
      const [px, py] = [isoX(map.P.x + 4, map.P.y - 4), isoY(map.P.x + 4, map.P.y - 4)];
      st.camX = px - viewW() / 2; st.camY = py - viewH() / 2;
      clampCam();
      updateFog();
      setupUI();
      const wname = { snow: 'Kar fırtınası', fog: 'Yoğun sis — görüş ve isabet düşük', rain: 'Yağmurlu', dust: 'Kum fırtınası', clear: '' }[weather];
      if (wname) setTimeout(() => { if (st) banner(wname, 2.5); }, 3200);
      if (weather === 'rain' || weather === 'snow' || weather === 'dust') LOL.audio.weather(weather);
      banner(playerIsAtt ? `${cfg.provinceName} kuşatması başladı!` : `${cfg.provinceName} savunması!`, 3);
    });
  };

  function spawnSide(side, counts, at, toward) {
    const cand = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!walk(x, y)) continue;
      const d = Math.hypot(x - at.x, y - at.y);
      if (d < 9) cand.push({ x, y, d });
    }
    cand.sort((a, b) => a.d - b.d);
    const total = U.sumUnits(counts);
    const pick = cand.slice(0, Math.max(total, 1));
    const fx = toward.x - at.x, fy = toward.y - at.y, fl = Math.hypot(fx, fy);
    pick.sort((a, b) => ((b.x - at.x) * fx + (b.y - at.y) * fy) / fl - ((a.x - at.x) * fx + (a.y - at.y) * fy) / fl);
    const order = [];
    ['heavy', 'tank', 'recon', 'at', 'inf', 'mg', 'art', 'rocket'].forEach((t) => { for (let i = 0; i < (counts[t] || 0); i++) order.push(t); });
    const ang = Math.atan2(fy, fx);
    order.forEach((type, i) => {
      const c = pick[i] || pick[pick.length - 1];
      const u = makeUnit(type, side, c.x + 0.5 + (Math.random() - 0.5) * 0.3, c.y + 0.5 + (Math.random() - 0.5) * 0.3, ang);
      st.units.push(u);
    });
  }

  function makeUnit(type, side, x, y, ang) {
    const e = (st.mods && st.mods[side]) || {};
    const T = Object.assign({}, UT[type]);
    const tc = LOL.config.techClass[type] || type;
    T.hp = Math.round(T.hp * (1 + (e[tc + 'Hp'] || 0)));
    T.dmg = T.dmg * (1 + (e[tc + 'Dmg'] || 0));
    T.speed = T.speed * (1 + (e[tc + 'Speed'] || 0));
    T.range = T.range * (1 + (e[tc + 'Range'] || 0));
    if (tc === 'art') T.sight = Math.max(T.sight, T.range + 0.5);
    T.rof = T.rof * (1 - (e[tc + 'Rof'] || 0));
    T.acc = e[tc + 'Acc'] || 0;
    return {
      id: nextId++, type, side, x, y, hp: T.hp, maxHp: T.hp, T, angle: ang, turret: ang,
      path: null, order: { type: 'idle' }, guardX: x, guardY: y, cd: Math.random() * T.rof, target: null,
      scanT: Math.random() * 0.3, repathT: 0, stuckT: 0, stuckN: 0, lastX: x, lastY: y,
      burstN: 0, anim: Math.random() * 10, recoil: 0, moving: false, flashT: 0, hitT: 0, dead: false, kills: 0, rank: 0, salvoLeft: 0, salvoT: 0, trackT: 0,
    };
  }

  // ======================================================================
  //  Pathfinding (A* 8-dir, string-pulled)
  // ======================================================================
  function nearestWalkable(x, y) {
    for (let r = 1; r < 12; r++) {
      let best = null, bd = 1e9;
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
        if (!walk(xx, yy)) continue;
        const d = (xx - x) ** 2 + (yy - y) ** 2;
        if (d < bd) { bd = d; best = { x: xx, y: yy }; }
      }
      if (best) return best;
    }
    return null;
  }
  function lineWalkable(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 0.01) return true;
    const steps = Math.ceil(L / 0.2);
    const px = -dy / L * 0.28, py = dx / L * 0.28;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + dx * i / steps, y = y0 + dy * i / steps;
      if (!walkAt(x, y) || !walkAt(x + px, y + py) || !walkAt(x - px, y - py)) return false;
    }
    return true;
  }
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function findPath(sx, sy, gx, gy) {
    let ax = Math.floor(sx), ay = Math.floor(sy);
    let bx = U.clamp(Math.floor(gx), 0, N - 1), by = U.clamp(Math.floor(gy), 0, N - 1);
    if (!walk(bx, by)) {
      const n = nearestWalkable(bx, by);
      if (!n) return null;
      bx = n.x; by = n.y; gx = bx + 0.5; gy = by + 0.5;
    }
    if (!walk(ax, ay)) { const n = nearestWalkable(ax, ay); if (n) { ax = n.x; ay = n.y; } }
    if (lineWalkable(sx, sy, gx, gy)) return [{ x: gx, y: gy }];
    const NN = N * N;
    const g = new Float32Array(NN).fill(1e9);
    const came = new Int32Array(NN).fill(-1);
    const closed = new Uint8Array(NN);
    const heapI = [], heapF = [];
    const push = (i, f) => {
      heapI.push(i); heapF.push(f);
      let c = heapI.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heapF[p] <= heapF[c]) break;
        [heapI[p], heapI[c]] = [heapI[c], heapI[p]]; [heapF[p], heapF[c]] = [heapF[c], heapF[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heapI[0];
      const li = heapI.pop(), lf = heapF.pop();
      if (heapI.length) {
        heapI[0] = li; heapF[0] = lf;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1;
          let m = c;
          if (l < heapI.length && heapF[l] < heapF[m]) m = l;
          if (r < heapI.length && heapF[r] < heapF[m]) m = r;
          if (m === c) break;
          [heapI[m], heapI[c]] = [heapI[c], heapI[m]]; [heapF[m], heapF[c]] = [heapF[c], heapF[m]];
          c = m;
        }
      }
      return top;
    };
    const hfun = (x, y) => { const dx = Math.abs(x - bx), dy = Math.abs(y - by); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const start = ay * N + ax, goal = by * N + bx;
    g[start] = 0; push(start, hfun(ax, ay));
    let bestNode = start, bestH = hfun(ax, ay), iter = 0;
    while (heapI.length && iter++ < 4000) {
      const cur = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) { bestNode = cur; break; }
      const cx = cur % N, cy = (cur / N) | 0;
      const hh = hfun(cx, cy);
      if (hh < bestH) { bestH = hh; bestNode = cur; }
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!walk(nx, ny)) continue;
        if (dx && dy && (!walk(cx + dx, cy) || !walk(cx, cy + dy))) continue;
        const ni = ny * N + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + cost * (st.tiles[ni] === T_FORD ? 1.8 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ni, ng + hfun(nx, ny)); }
      }
    }
    const nodes = [];
    for (let c = bestNode; c !== start && c >= 0; c = came[c]) nodes.push(c);
    nodes.reverse();
    if (!nodes.length) return null;
    const pts = nodes.map((i) => ({ x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 }));
    if (bestNode === goal) pts[pts.length - 1] = { x: gx, y: gy };
    // string pulling
    const out = [];
    let cx = sx, cy = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !lineWalkable(cx, cy, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]);
      cx = pts[j].x; cy = pts[j].y; i = j + 1;
    }
    return out;
  }

  // ======================================================================
  //  Orders
  // ======================================================================
  function centroid(list) {
    let x = 0, y = 0;
    list.forEach((u) => { x += u.x; y += u.y; });
    return { x: x / list.length, y: y / list.length };
  }
  function findFreeTile(fx, fy, taken) {
    const bx = Math.floor(fx), by = Math.floor(fy);
    let best = null, bd = 1e9;
    for (let r = 0; r < 10; r++) {
      for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) {
        if (Math.max(Math.abs(x - bx), Math.abs(y - by)) !== r) continue;
        if (!walk(x, y) || taken.has(y * N + x)) continue;
        const d = (x + 0.5 - fx) ** 2 + (y + 0.5 - fy) ** 2;
        if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) return best;
    }
    return { x: bx, y: by };
  }
  function issueMove(units, tx, ty, type) {
    units = units.filter((u) => !u.dead);
    if (!units.length) return;
    if (units.length === 1 && walkAt(tx, ty)) {
      const u = units[0];
      u.order = { type, x: tx, y: ty }; u.target = null; u.stuckN = 0;
      u.path = findPath(u.x, u.y, tx, ty);
      return;
    }
    const c = centroid(units);
    let maxOff = 0;
    units.forEach((u) => { maxOff = Math.max(maxOff, Math.hypot(u.x - c.x, u.y - c.y)); });
    const spread = Math.max(1.2, Math.sqrt(units.length) * 0.75);
    const sc = maxOff > spread ? spread / maxOff : 1;
    const taken = new Set();
    const sorted = units.slice().sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    for (const u of sorted) {
      const slot = findFreeTile(tx + (u.x - c.x) * sc, ty + (u.y - c.y) * sc, taken);
      taken.add(slot.y * N + slot.x);
      u.order = { type, x: slot.x + 0.5, y: slot.y + 0.5 };
      u.target = null; u.stuckN = 0;
      u.path = findPath(u.x, u.y, u.order.x, u.order.y);
    }
  }
  function issueAttack(units, target) {
    units.forEach((u) => { if (u.dead) return; u.order = { type: 'attack', target }; u.target = target; u.path = null; u.repathT = 0; });
  }
  function stopUnits(units) {
    units.forEach((u) => { u.order = { type: 'idle' }; u.path = null; u.target = null; u.guardX = u.x; u.guardY = u.y; });
  }

  // ======================================================================
  //  Simulation
  // ======================================================================
  const alive = (side) => st.units.filter((u) => !u.dead && (side == null || u.side === side));

  function nearestEnemy(u, r) {
    const T = u.T;
    let best = null, bs = 1e9;
    for (const e of st.units) {
      if (e.dead || e.side === u.side) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d > r || d < (T.minRange || 0)) continue;
      let s = d;
      const wpn = MULT[T.weapon], ea = UT[e.type].armor;
      s -= (wpn[ea] || 0.5) * 2;
      if (st.fogOn && u.side === 1 && !st.vis[Math.floor(e.y) * N + Math.floor(e.x)] && false) s += 0;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  function updateUnit(u, dt) {
    const T = u.T;
    u.cd -= dt; u.recoil = Math.max(0, u.recoil - dt * 3); u.flashT -= dt; u.hitT -= dt;
    u.scanT -= dt; u.repathT -= dt;
    const o = u.order;
    if (o.type === 'attack') {
      if (!o.target || o.target.dead) { u.order = { type: 'idle' }; u.guardX = u.x; u.guardY = u.y; u.target = null; u.path = null; }
      else u.target = o.target;
    } else if (u.scanT <= 0) {
      u.scanT = 0.3 + Math.random() * 0.1;
      if (o.type === 'move') u.target = T.turret ? nearestEnemy(u, T.range) : null;
      else u.target = nearestEnemy(u, T.sight);
    }
    if (u.target && u.target.dead) u.target = null;

    let wantFire = false;
    const tg = u.target;
    if (tg) {
      const d = Math.hypot(tg.x - u.x, tg.y - u.y);
      if (d <= T.range && d >= (T.minRange || 0)) {
        wantFire = true;
        if (u.order.type !== 'move') u.path = null;
      } else if (u.order.type !== 'move') {
        if (u.order.type === 'idle' && Math.hypot(tg.x - u.guardX, tg.y - u.guardY) > T.sight + 4) {
          u.target = null;
        } else if (d < (T.minRange || 0)) {
          if (!u.path) {
            const ax = u.x + (u.x - tg.x) / d * 3, ay = u.y + (u.y - tg.y) / d * 3;
            u.path = findPath(u.x, u.y, ax, ay);
          }
        } else if (u.repathT <= 0 || !u.path) {
          u.repathT = 0.8 + Math.random() * 0.3;
          u.path = findPath(u.x, u.y, tg.x, tg.y);
        }
      }
    } else {
      if (u.order.type === 'amove' && !u.path) {
        if (Math.hypot(u.order.x - u.x, u.order.y - u.y) < 0.6) { u.order = { type: 'idle' }; u.guardX = u.x; u.guardY = u.y; }
        else u.path = findPath(u.x, u.y, u.order.x, u.order.y);
      } else if (u.order.type === 'idle' && !u.path && Math.hypot(u.guardX - u.x, u.guardY - u.y) > 1.5) {
        u.path = findPath(u.x, u.y, u.guardX, u.guardY);
      }
    }

    // aiming & firing
    if (wantFire && u.target) {
      const ang = Math.atan2(u.target.y - u.y, u.target.x - u.x);
      let aligned;
      if (T.turret) {
        u.turret = U.turnToward(u.turret, ang, T.turretTurn * dt);
        aligned = Math.abs(U.angleDiff(u.turret, ang)) < 0.12;
      } else if (!u.path) {
        u.angle = U.turnToward(u.angle, ang, T.turn * dt);
        aligned = Math.abs(U.angleDiff(u.angle, ang)) < 0.15;
      }
      if (aligned && u.cd <= 0 && !u.salvoLeft) {
        fire(u, u.target);
        u.cd = T.rof * (0.9 + Math.random() * 0.2);
        if (T.burst && ++u.burstN >= 9) { u.burstN = 0; u.cd = 1.3 + Math.random() * 0.5; }
      }
    } else if (T.turret) {
      u.turret = U.turnToward(u.turret, u.angle, T.turretTurn * dt * 0.5);
    }

    // rocket salvo in progress
    if (u.salvoLeft > 0) {
      u.salvoT -= dt;
      if (u.salvoT <= 0) {
        u.salvoT = 0.17;
        u.salvoLeft--;
        launchRocket(u);
      }
    }
    // movement
    u.moving = false;
    if (u.path && u.path.length) {
      const wp = u.path[0];
      const dx = wp.x - u.x, dy = wp.y - u.y, d = Math.hypot(dx, dy);
      if (d < 0.08) {
        u.path.shift();
        if (!u.path.length) arrive(u);
      } else {
        const ang = Math.atan2(dy, dx);
        u.angle = U.turnToward(u.angle, ang, T.turn * dt);
        if (isFoot(u) || Math.abs(U.angleDiff(u.angle, ang)) < 0.5) {
          const tile = st.tiles[Math.floor(u.y) * N + Math.floor(u.x)];
          const tf = tile === T_FORD ? 0.6 : tile === T_ROAD ? 1.15 : 1;
          const step = Math.min(d, T.speed * tf * dt);
          u.x += dx / d * step; u.y += dy / d * step;
          u.moving = true;
          u.anim += dt * T.speed * 2;
          if (step >= d - 1e-6) { u.path.shift(); if (!u.path.length) arrive(u); }
        }
      }
      // stuck detection
      u.stuckT += dt;
      if (u.stuckT > 0.8) {
        u.stuckT = 0;
        const moved = Math.hypot(u.x - u.lastX, u.y - u.lastY);
        u.lastX = u.x; u.lastY = u.y;
        if (u.path && moved < 0.15) {
          u.stuckN++;
          const fin = u.path[u.path.length - 1];
          if (Math.hypot(fin.x - u.x, fin.y - u.y) < 1.4 || u.stuckN > 5) { u.path = null; arrive(u); }
          else if (u.stuckN > 1) u.path = findPath(u.x, u.y, fin.x, fin.y);
        } else u.stuckN = 0;
      }
    }
    if (!isFoot(u) && u.moving) {
      u.trackT += T.speed * dt;
      if (u.trackT > 0.22) { u.trackT = 0; trackMark(u); }
    }
    if (!isFoot(u) && u.moving && Math.random() < dt * 3) {
      const [bx, by] = [u.x - Math.cos(u.angle) * 0.45, u.y - Math.sin(u.angle) * 0.45];
      addP('dust', bx, by, 2, { vz: 4, life: 0.9, size: 3, grow: 6 });
    }
  }
  function arrive(u) {
    u.path = null;
    if (u.order.type === 'move' || u.order.type === 'amove') { u.order = { type: 'idle' }; }
    if (u.order.type === 'idle') { u.guardX = u.x; u.guardY = u.y; }
  }

  function separation() {
    const us = st.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (a.dead) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = UT[a.type].radius + UT[b.type].radius;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        let nx, ny;
        if (d < 1e-4) { const r = Math.random() * 6.28; nx = Math.cos(r); ny = Math.sin(r); d = 0; } else { nx = dx / d; ny = dy / d; }
        const push = (min - d) * 0.5;
        const wa = a.path ? 1 : 0.35, wb = b.path ? 1 : 0.35;
        const sa = wa / (wa + wb), sb = wb / (wa + wb);
        const ax = a.x - nx * push * sa * 2, ay = a.y - ny * push * sa * 2;
        const bx = b.x + nx * push * sb * 2, by = b.y + ny * push * sb * 2;
        if (walkAt(ax, ay)) { a.x = ax; a.y = ay; }
        if (walkAt(bx, by)) { b.x = bx; b.y = by; }
      }
      a.x = U.clamp(a.x, 0.2, N - 0.2); a.y = U.clamp(a.y, 0.2, N - 0.2);
    }
  }

  function muzzle(u) {
    if (isFoot(u)) { const a = u.angle; return { x: u.x + Math.cos(a) * 0.28, y: u.y + Math.sin(a) * 0.28, z: u.type === 'at' ? 12 : 10 }; }
    if (u.type === 'recon') { const a = u.turret; return { x: u.x + Math.cos(a) * 0.4, y: u.y + Math.sin(a) * 0.4, z: 13 }; }
    if (u.type === 'tank') { const a = u.turret; return { x: u.x + Math.cos(a) * 0.62, y: u.y + Math.sin(a) * 0.62, z: 13 }; }
    if (u.type === 'heavy') { const a = u.turret; return { x: u.x + Math.cos(a) * 0.82, y: u.y + Math.sin(a) * 0.82, z: 16 }; }
    if (u.type === 'rocket') { const a = u.angle; return { x: u.x - Math.cos(a) * 0.1, y: u.y - Math.sin(a) * 0.1, z: 20 }; }
    const a = u.angle; return { x: u.x + Math.cos(a) * 0.8, y: u.y + Math.sin(a) * 0.8, z: 22 };
  }
  function snd(name, x, y) {
    const [sx] = sp(x, y, 0);
    LOL.audio.play(name, sndVol(x, y), U.clamp((sx - viewW() / 2) / (viewW() / 2), -1, 1) * 0.8);
  }
  function sndVol(x, y) {
    const [sx, sy] = sp(x, y, 0);
    const cx = viewW() / 2, cy = viewH() / 2;
    const d = Math.hypot(sx - cx, sy - cy);
    return U.clamp(1.15 - d / 900, 0, 1);
  }

  function vet(u) { return 1 + u.rank * 0.15; }
  function fire(u, t) {
    const T = u.T;
    const m = muzzle(u);
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    const w = T.weapon;
    if (w === 'rifle' || w === 'mg') {
      const acc = (w === 'mg' ? 0.55 : 0.75) * (st.weather === 'fog' ? 0.85 : 1);
      const hit = Math.random() < acc;
      const ex = t.x + (hit ? 0 : (Math.random() - 0.5) * 0.9), ey = t.y + (hit ? 0 : (Math.random() - 0.5) * 0.9);
      st.tracers.push({ x1: m.x, y1: m.y, z1: m.z, x2: ex, y2: ey, z2: hit ? 7 : 0, life: w === 'mg' ? 0.05 : 0.07, mg: w === 'mg' });
      u.flashT = 0.06;
      if (hit) damage(t, T.dmg * MULT[w][UT[t.type].armor] * vet(u), u);
      else addP('dust', ex, ey, 0, { vz: 10, life: 0.4, size: 1.5, grow: 3 });
      if (!isFoot(t) && hit) { addP('spark', t.x, t.y, 8, { n: 2 }); if (Math.random() < 0.3) snd('hit', t.x, t.y); }
      snd(w === 'mg' ? 'mg' : 'rifle', u.x, u.y);
    } else if (w === 'atr') {
      st.projectiles.push({ kind: 'atr', x: m.x, y: m.y, z: m.z, tx: t.x + (Math.random() - 0.5) * 0.2, ty: t.y + (Math.random() - 0.5) * 0.2, speed: 9, dmg: T.dmg * vet(u), splash: 0.4, weapon: 'atr', side: u.side, owner: u });
      addP('smoke', m.x - Math.cos(u.angle) * 0.3, m.y - Math.sin(u.angle) * 0.3, m.z, { life: 0.9, size: 3, grow: 8, alpha: 0.45 });
      u.flashT = 0.1;
      snd('bazooka', u.x, u.y);
    } else if (w === 'cannon' || w === 'bigcannon') {
      const big = w === 'bigcannon';
      st.projectiles.push({ kind: 'shell', x: m.x, y: m.y, z: m.z, tx: t.x, ty: t.y, speed: big ? 15 : 14, dmg: T.dmg * vet(u), splash: T.splash, weapon: w, side: u.side, owner: u, big });
      u.recoil = 1;
      addP('flash', m.x, m.y, m.z, { life: 0.08, size: big ? 13 : 9 });
      for (let k = 0; k < (big ? 5 : 3); k++) addP('smoke', m.x, m.y, m.z, { life: 0.9, size: 3, grow: 10, alpha: 0.35 });
      addP('dust', u.x, u.y, 0, { life: 0.6, size: big ? 8 : 5, grow: 12, n: 2, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5) });
      snd('cannon', u.x, u.y);
    } else if (w === 'rocket') {
      u.salvoLeft = T.salvo; u.salvoT = 0; u.salvoTarget = { x: t.x, y: t.y };
      snd('rocketfire', u.x, u.y);
    } else {
      const scatter = (0.25 + 0.75 * (d / T.range)) * (1 - (T.acc || 0)) * (st.weather === 'fog' ? 1.3 : 1);
      const r = Math.random() * scatter, a = Math.random() * 6.283;
      const tx = t.x + Math.cos(a) * r, ty = t.y + Math.sin(a) * r;
      const dur = 0.8 + d * 0.11;
      st.projectiles.push({ kind: 'arc', fx: m.x, fy: m.y, fz: m.z, tx, ty, t: 0, dur, peak: 50 + d * 9, dmg: T.dmg * vet(u), splash: T.splash, weapon: 'shell', side: u.side, owner: u, x: m.x, y: m.y, z: m.z });
      u.recoil = 1;
      addP('flash', m.x, m.y, m.z, { life: 0.12, size: 14 });
      for (let k = 0; k < 6; k++) addP('smoke', m.x, m.y, m.z, { life: 1.5, size: 4, grow: 14, alpha: 0.4, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 });
      snd('artfire', u.x, u.y);
    }
  }
  function launchRocket(u) {
    const T = u.T, m = muzzle(u), tg = u.salvoTarget || u;
    const d = Math.hypot(tg.x - u.x, tg.y - u.y);
    const scatter = (0.8 + 0.8 * d / T.range) * (1 - (T.acc || 0) * 0.5);
    const r = Math.random() * scatter, a = Math.random() * 6.283;
    const tx = tg.x + Math.cos(a) * r, ty = tg.y + Math.sin(a) * r;
    st.projectiles.push({ kind: 'arc', rocket: true, fx: m.x, fy: m.y, fz: m.z, tx, ty, t: 0, dur: 0.9 + d * 0.07, peak: 40 + d * 5, dmg: T.dmg * vet(u), splash: T.splash, weapon: 'rocket', side: u.side, owner: u, x: m.x, y: m.y, z: m.z, whistled: true });
    addP('flash', m.x, m.y, m.z, { life: 0.08, size: 8 });
    for (let k = 0; k < 3; k++) addP('smoke', m.x, m.y, m.z, { life: 1.4, size: 3, grow: 12, alpha: 0.5, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 });
    if (Math.random() < 0.5) snd('rocket', u.x, u.y);
  }
  function trackMark(u) {
    const c = st.terrain.getContext('2d');
    const ca = Math.cos(u.angle), sa = Math.sin(u.angle);
    const w = UT[u.type].radius * 0.75;
    c.fillStyle = st.snow ? 'rgba(120,120,130,0.22)' : 'rgba(40,30,20,0.16)';
    for (const sgn of [-1, 1]) {
      const x = u.x - sa * w * sgn, y = u.y + ca * w * sgn;
      c.beginPath(); c.ellipse(isoX(x, y), isoY(x, y), 2.4, 1.3, 0, 0, 7); c.fill();
    }
  }

  function damage(t, amt, src) {
    if (t.dead) return;
    if (t.side === st.defSide && st.fort) amt *= 1 - 0.08 * st.fort;
    t.hp -= amt;
    t.hitT = 0.12;
    // being shot while idle: retaliate
    if (src && !src.dead && t.order.type === 'idle' && !t.target) { t.target = src; t.scanT = 1.2; }
    if (t.hp <= 0) {
      kill(t);
      if (src && !src.dead) {
        src.kills++;
        const nr = src.kills >= 8 ? 2 : src.kills >= 3 ? 1 : 0;
        if (nr > src.rank) {
          src.rank = nr; src.hp = Math.min(src.maxHp, src.hp + src.maxHp * 0.3);
          addP('promo', src.x, src.y, 30, { life: 1.4, vz: 14 });
          if (src.side === 0) banner(nr === 2 ? 'Birlik ELİT rütbeye yükseldi!' : 'Birlik tecrübe kazandı!', 1.2);
        }
      }
    }
  }

  function kill(u) {
    u.dead = true;
    st.sel.delete(u);
    if (isFoot(u)) {
      st.corpses.push({ type: 'inf', x: u.x, y: u.y, angle: u.angle, side: u.side, life: 12, max: 12 });
    } else {
      explosion(u.x, u.y, 1.2, true);
      st.corpses.push({ type: u.type, x: u.x, y: u.y, angle: u.angle, turret: u.turret + (Math.random() - 0.5), side: u.side, life: 40, max: 40, wreck: true });
    }
  }

  function explosion(x, y, scale, big) {
    addP('explosion', x, y, 4, { life: 0.55 * scale, size: 16 * scale });
    addP('flash', x, y, 6, { life: 0.1, size: 26 * scale });
    for (let k = 0; k < 8 * scale; k++) addP('fire', x, y, 4, { vx: (Math.random() - 0.5) * 2.5 * scale, vy: (Math.random() - 0.5) * 2.5 * scale, vz: 20 + Math.random() * 50, life: 0.5 + Math.random() * 0.4 });
    for (let k = 0; k < 6 * scale; k++) addP('smoke', x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, 6, { vz: 12 + Math.random() * 15, life: 1.8 + Math.random(), size: 6 * scale, grow: 14 * scale, alpha: 0.5 });
    for (let k = 0; k < 6 * scale; k++) addP('debris', x, y, 6, { vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: 40 + Math.random() * 80, life: 1.2 });
    scorch(x, y, 0.6 * scale);
    snd(big ? 'boom' : 'small', x, y);
  }
  function scorch(x, y, r) {
    const c = st.terrain.getContext('2d');
    const px = isoX(x, y), py = isoY(x, y);
    const rx = r * TW * 0.55, ry = r * TH * 0.55;
    const g = c.createRadialGradient(px, py, 0, px, py, rx);
    g.addColorStop(0, 'rgba(25,18,10,0.55)'); g.addColorStop(0.6, 'rgba(40,30,15,0.3)'); g.addColorStop(1, 'rgba(40,30,15,0)');
    c.fillStyle = g;
    c.save(); c.translate(px, py); c.scale(1, ry / rx); c.translate(-px, -py);
    c.beginPath(); c.arc(px, py, rx, 0, 7); c.fill();
    c.restore();
  }

  // terrain destruction: trees fall, houses crumble
  function hitEnvironment(x, y, r, dmg) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inb(tx, ty)) continue;
      const o = st.objAt[ty * N + tx];
      if (!o || o.dead) continue;
      if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r + 0.5) continue;
      if (o.type === 'tree' && dmg > 40 && Math.random() < 0.55) {
        o.dead = true; st.block[ty * N + tx] = 0; st.objAt[ty * N + tx] = null;
        st.corpses.push({ type: 'stump', x: tx + 0.5, y: ty + 0.5, life: 1e9, max: 1e9, fall: Math.random() < 0.5 ? 1 : -1, t: 0, v: o.v });
        for (let k = 0; k < 4; k++) addP('debris', tx + 0.5, ty + 0.5, 10, { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: 30 + Math.random() * 40, life: 1, leaf: true });
      } else if (o.type === 'house') {
        o.hp = (o.hp == null ? 500 : o.hp) - dmg * 0.5;
        if (o.hp <= 0 && !o.ruined) {
          o.ruined = true; o.burning = 25;
          for (let k = 0; k < 10; k++) addP('debris', o.x + o.w / 2, o.y + o.d / 2, 20, { vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 30 + Math.random() * 60, life: 1.3 });
          explosion(o.x + o.w / 2, o.y + o.d / 2, 0.8, true);
        }
      } else if (o.type === 'sandbag' && dmg > 60 && Math.random() < 0.25) {
        o.dead = true; st.block[ty * N + tx] = 0; st.objAt[ty * N + tx] = null;
      }
    }
  }
  function splash(x, y, p) {
    if (p.dmg > 20) hitEnvironment(x, y, p.splash * 0.8, p.dmg);
    for (const e of st.units) {
      if (e.dead || e.side === p.side) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > p.splash + UT[e.type].radius) continue;
      const f = 1 - 0.5 * Math.min(1, d / p.splash);
      damage(e, p.dmg * MULT[p.weapon][UT[e.type].armor] * f, p.owner);
    }
  }

  function updateProjectiles(dt) {
    for (const p of st.projectiles) {
      if (p.kind === 'shell' || p.kind === 'atr') {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        const step = p.speed * dt;
        if (p.kind === 'atr') addP('smoke', p.x, p.y, p.z, { life: 0.7, size: 1.6, grow: 5, alpha: 0.45 });
        if (step >= d) {
          p.dead = true;
          explosion(p.tx, p.ty, p.big ? 0.65 : p.kind === 'atr' ? 0.4 : 0.45, !!p.big);
          splash(p.tx, p.ty, p);
        } else {
          p.x += dx / d * step; p.y += dy / d * step;
          p.z = Math.max(4, p.z - dt * 6);
        }
      } else {
        p.t += dt;
        if (!p.whistled && p.dur - p.t < 1.4) {
          p.whistled = true;
          const [sx] = sp(p.tx, p.ty, 0);
          LOL.audio.whistle(p.dur - p.t, sndVol(p.tx, p.ty) * 0.9, U.clamp((sx - viewW() / 2) / (viewW() / 2), -1, 1) * 0.8);
        }
        const k = Math.min(1, p.t / p.dur);
        p.x = U.lerp(p.fx, p.tx, k); p.y = U.lerp(p.fy, p.ty, k);
        p.z = U.lerp(p.fz, 0, k) + 4 * p.peak * k * (1 - k);
        if (p.rocket) { addP('smoke', p.x, p.y, p.z, { life: 1.1, size: 2, grow: 7, alpha: 0.45 }); addP('fire', p.x, p.y, p.z, { life: 0.12, vz: 0 }); }
        else if (Math.random() < 0.6) addP('smoke', p.x, p.y, p.z, { life: 0.5, size: 1.5, grow: 4, alpha: 0.3 });
        if (k >= 1) {
          p.dead = true;
          explosion(p.tx, p.ty, p.rocket ? 0.6 : 0.9, true);
          splash(p.tx, p.ty, p);
        }
      }
    }
    st.projectiles = st.projectiles.filter((p) => !p.dead);
  }

  // ---------------- particles ----------------
  function addP(kind, x, y, z, o) {
    o = o || {};
    const n = o.n || 1;
    for (let i = 0; i < n; i++) {
      if (st.particles.length > 1600) return;
      st.particles.push({
        kind, x, y, z: z || 0,
        vx: o.vx != null ? o.vx : (kind === 'spark' ? (Math.random() - 0.5) * 3 : 0),
        vy: o.vy != null ? o.vy : (kind === 'spark' ? (Math.random() - 0.5) * 3 : 0),
        vz: o.vz != null ? o.vz : (kind === 'spark' ? 30 + Math.random() * 40 : kind === 'smoke' ? 10 : 0),
        life: o.life || 0.5, max: o.life || 0.5, size: o.size || 2, grow: o.grow || 0, alpha: o.alpha || 1,
        rot: Math.random() * 6,
      });
    }
  }
  function updateParticles(dt) {
    for (const p of st.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'debris' || p.kind === 'spark' || p.kind === 'fire') {
        p.vz -= 220 * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
      }
      if (p.kind === 'smoke') { p.vx += 0.15 * dt; p.vz *= 0.99; }
      p.size += p.grow * dt;
    }
    st.particles = st.particles.filter((p) => p.life > 0);
    for (const t of st.tracers) t.life -= dt;
    st.tracers = st.tracers.filter((t) => t.life > 0);
    for (const m of st.markers) m.life -= dt;
    st.markers = st.markers.filter((m) => m.life > 0);
    for (const c of st.corpses) {
      c.life -= dt;
      if (c.wreck && c.life > c.max * 0.4 && Math.random() < dt * 5) addP('smoke', c.x + (Math.random() - 0.5) * 0.3, c.y, 10, { vz: 14, life: 2.2, size: 3, grow: 9, alpha: 0.45 });
      if (c.wreck && c.life > c.max * 0.7 && Math.random() < dt * 6) addP('fire', c.x, c.y, 8, { vz: 18, life: 0.4 });
    }
    st.corpses = st.corpses.filter((c) => c.life > 0);
    for (const o of st.objects) {
      if (o.burning > 0) {
        o.burning -= dt;
        if (Math.random() < dt * 6) addP('smoke', o.x + Math.random() * o.w, o.y + Math.random() * o.d, 18, { vz: 16, life: 2.6, size: 4, grow: 10, alpha: 0.5 });
        if (Math.random() < dt * 8) addP('fire', o.x + Math.random() * o.w, o.y + Math.random() * o.d, 14, { vz: 20, life: 0.5 });
      }
    }
  }

  // ---------------- enemy AI ----------------
  function aiUpdate(dt) {
    const ai = st.ai;
    ai.t -= dt;
    if (ai.t > 0) return;
    ai.t = 1.3;
    const mine = alive(1), theirs = alive(0);
    if (!mine.length || !theirs.length) return;
    if (ai.mode === 'hold') {
      const c = centroid(mine);
      const near = theirs.some((u) => Math.hypot(u.x - c.x, u.y - c.y) < 13);
      if (near || st.time > 50) { ai.mode = 'attack'; banner('Düşman karşı saldırıya geçti!', 2); }
      else return;
    }
    const idle = mine.filter((u) => u.order.type === 'idle' && !u.target && !u.path);
    if (!idle.length) return;
    const c = centroid(idle);
    let tgt = null, bd = 1e9;
    for (const e of theirs) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < bd) { bd = d; tgt = e; } }
    if (tgt) issueMove(idle, tgt.x, tgt.y, 'amove');
  }

  function step(dt) {
    st.time += dt;
    st.fogT -= dt;
    if (st.fogT <= 0) { st.fogT = 0.25; updateFog(); }
    for (const u of st.units) if (!u.dead) updateUnit(u, dt);
    separation();
    updateProjectiles(dt);
    updateParticles(dt);
    aiUpdate(dt);
    st.units = st.units.filter((u) => !u.dead);
    if (!st.ended && st.endTimer < 0) {
      if (!alive(0).length) { st.endTimer = 1.8; st.pendingOutcome = 'lose'; }
      else if (!alive(1).length) { st.endTimer = 1.8; st.pendingOutcome = 'win'; }
    }
    if (st.endTimer > 0) {
      st.endTimer -= dt;
      if (st.endTimer <= 0) finish(st.pendingOutcome);
    }
  }

  // ======================================================================
  //  Rendering
  // ======================================================================
  function teamCol(side, f) { return U.shade(st.sideColor[side], f || 0); }

  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // prism with footprint corners (tile coords) between heights h0..h1
  function prism(corners, h0, h1, top, sideL, sideR, stroke) {
    const bot = corners.map(([x, y]) => sp(x, y, h0));
    const tp = corners.map(([x, y]) => sp(x, y, h1));
    let cx = 0, cy = 0;
    bot.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= bot.length; cy /= bot.length;
    for (let i = 0; i < bot.length; i++) {
      const j = (i + 1) % bot.length;
      const ex = bot[j][0] - bot[i][0], ey = bot[j][1] - bot[i][1];
      let nx = ey, ny = -ex;
      const mx = (bot[i][0] + bot[j][0]) / 2 - cx, my = (bot[i][1] + bot[j][1]) / 2 - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      if (ny <= 0) continue;
      poly([bot[i], bot[j], tp[j], tp[i]]);
      ctx.fillStyle = nx > 0 ? sideR : sideL; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
    }
    poly(tp);
    ctx.fillStyle = top; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  function rect(cx, cy, ang, L, W, ox) {
    const c = Math.cos(ang), s = Math.sin(ang);
    ox = ox || 0;
    return [[L / 2 + ox, W / 2], [L / 2 + ox, -W / 2], [-L / 2 + ox, -W / 2], [-L / 2 + ox, W / 2]].map(([a, b]) => [cx + a * c - b * s, cy + a * s + b * c]);
  }

  function soldier(sx, sy, u, col, dark, fx, fy, walkA, gun) {
    ctx.strokeStyle = '#2b2a20'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 1.5, sy - 6); ctx.lineTo(sx - 1.5 + walkA, sy - 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 1.5, sy - 6); ctx.lineTo(sx + 1.5 - walkA, sy - 0.5); ctx.stroke();
    ctx.fillStyle = u.hitT > 0 ? '#fff' : col;
    ctx.fillRect(sx - 3, sy - 13, 6, 7.5);
    ctx.fillStyle = dark; ctx.fillRect(sx - 3, sy - 8, 6, 1.5);
    if (st.snow) { ctx.fillStyle = 'rgba(240,240,245,0.55)'; ctx.fillRect(sx - 3, sy - 13, 6, 2); }
    ctx.fillStyle = '#e2b892';
    ctx.beginPath(); ctx.arc(sx, sy - 15, 2.3, 0, 7); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(sx, sy - 15.6, 2.6, Math.PI, 0); ctx.fill();
    if (gun === 'at') {
      ctx.strokeStyle = '#4a5636'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - fx * 5, sy - 13 - fy * 2); ctx.lineTo(sx + fx * 8, sy - 13 + fy * 4); ctx.stroke();
      ctx.fillStyle = '#5a4a30'; ctx.fillRect(sx - 4 - fx, sy - 12, 2.5, 4);
      if (u.flashT > 0) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.arc(sx - fx * 7, sy - 14 - fy * 2, 3, 0, 7); ctx.fill(); }
    } else if (gun !== 'none') {
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx + fx * 1, sy - 10 + fy * 1); ctx.lineTo(sx + fx * 9, sy - 10 + fy * 5); ctx.stroke();
      if (u.flashT > 0) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(sx + fx * 10, sy - 10 + fy * 5.5, 2.5, 0, 7); ctx.fill(); }
    }
  }
  function drawInf(u) {
    const [sx, sy] = sp(u.x, u.y, 0);
    const col = teamCol(u.side), dark = teamCol(u.side, -0.45);
    const a = u.angle;
    const fdx = (Math.cos(a) - Math.sin(a)), fdy = (Math.cos(a) + Math.sin(a)) / 2;
    const fl = Math.hypot(fdx, fdy) || 1;
    const fx = fdx / fl, fy = fdy / fl;
    const walkA = u.moving ? Math.sin(u.anim * 6) * 2.2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, u.type === 'mg' ? 9 : 5, u.type === 'mg' ? 4 : 2.5, 0, 0, 7); ctx.fill();
    if (u.type === 'mg') {
      // two-man crew with a tripod machine gun
      const px = -fy * 4, py = fx * 2;
      soldier(sx - px, sy - py, u, col, dark, fx, fy, walkA, 'none');
      const gx = sx + px + fx * 3, gy = sy + py + fy * 2;
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(gx, gy - 4); ctx.lineTo(gx - 3, gy); ctx.moveTo(gx, gy - 4); ctx.lineTo(gx + 3, gy); ctx.stroke();
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(gx - fx * 3, gy - 5 - fy * 1.5); ctx.lineTo(gx + fx * 9, gy - 5 + fy * 4); ctx.stroke();
      ctx.fillStyle = '#4a4030'; ctx.fillRect(gx - 5, gy - 3, 3, 3);
      soldier(sx + px - fx * 3, sy + py - fy * 2, u, col, dark, fx, fy, 0, 'none');
      if (u.flashT > 0) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(gx + fx * 10, gy - 5 + fy * 4.5, 3, 0, 7); ctx.fill(); }
      return;
    }
    soldier(sx, sy, u, col, dark, fx, fy, walkA, u.type === 'at' ? 'at' : 'rifle');
  }

  function wheels(u, L, Wd, n, h) {
    const ca = Math.cos(u.angle), sa = Math.sin(u.angle);
    ctx.fillStyle = '#151515';
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * L * 0.8;
      for (const sgn of [-1, 1]) {
        const x = u.x + ca * t - sa * Wd / 2 * sgn, y = u.y + sa * t + ca * Wd / 2 * sgn;
        const [px, py] = sp(x, y, h || 3);
        ctx.beginPath(); ctx.ellipse(px, py, 3.6, 3, 0, 0, 7); ctx.fill();
      }
    }
  }
  function barrel(u, ta, from, to, h0, h1, w) {
    const b0 = sp(u.x + Math.cos(ta) * from, u.y + Math.sin(ta) * from, h0);
    const b1 = sp(u.x + Math.cos(ta) * to, u.y + Math.sin(ta) * to, h1);
    ctx.strokeStyle = '#1e1e1c'; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1] - 1); ctx.lineTo(b1[0], b1[1] - 1); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  function drawVehicle(u, wreck) {
    const side = u.side;
    const base = wreck ? [45, 42, 38] : st.sideColor[side];
    const top = U.shade(base, wreck ? 0 : 0.05), sL = U.shade(base, -0.3), sR = U.shade(base, -0.15);
    const flash = !wreck && u.hitT > 0;
    const hl = (f) => (flash ? U.shade(base, 0.45) : U.shade(base, f));
    const sz = u.type === 'heavy' ? 1.25 : u.type === 'recon' ? 0.85 : 1;
    const shadow = rect(u.x + 0.08, u.y + 0.08, u.angle, 1.05 * sz, 0.72 * sz).map(([x, y]) => sp(x, y, 0));
    poly(shadow); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    const ta = u.turret;
    if (u.type === 'tank' || u.type === 'heavy') {
      const k = sz;
      prism(rect(u.x, u.y, u.angle, 0.98 * k, 0.66 * k), 0, 5 * k, wreck ? '#2a2826' : '#3a3a36', '#222', '#2c2c2a', 'rgba(0,0,0,0.5)');
      prism(rect(u.x, u.y, u.angle, 0.86 * k, 0.5 * k), 5 * k, 10 * k, flash ? U.shade(base, 0.45) : top, sL, sR, 'rgba(0,0,0,0.45)');
      if (u.type === 'heavy') prism(rect(u.x, u.y, u.angle, 0.3, 0.52 * k, 0.3), 10 * k, 11.5 * k, hl(-0.05), sL, sR);
      prism(rect(u.x, u.y, ta, 0.4 * k, 0.36 * k, -0.04), 10 * k, 15 * k + (k > 1 ? 2 : 0), hl(0.12), sL, sR, 'rgba(0,0,0,0.5)');
      const rl = (u.type === 'heavy' ? 0.95 : 0.62) - (u.recoil || 0) * 0.12;
      barrel(u, ta, 0.14, rl, 12.5 * k + 1, 12.5 * k + 1, u.type === 'heavy' ? 4.6 : 3.4);
      if (u.type === 'heavy') { const m = sp(u.x + Math.cos(ta) * rl, u.y + Math.sin(ta) * rl, 12.5 * k + 1); ctx.fillStyle = '#1e1e1c'; ctx.beginPath(); ctx.arc(m[0], m[1], 3, 0, 7); ctx.fill(); }
    } else if (u.type === 'recon') {
      wheels(u, 0.8, 0.58, 3, 2);
      prism(rect(u.x, u.y, u.angle, 0.82, 0.5), 3, 10, flash ? U.shade(base, 0.45) : top, sL, sR, 'rgba(0,0,0,0.45)');
      prism(rect(u.x, u.y, u.angle, 0.24, 0.48, 0.32), 3, 8, hl(-0.1), sL, sR);
      prism(rect(u.x, u.y, ta, 0.26, 0.24, -0.06), 10, 14, hl(0.12), sL, sR, 'rgba(0,0,0,0.5)');
      barrel(u, ta, 0.08, 0.42, 12.5, 12.5, 1.8);
      if (u.flashT > 0) { const m = sp(u.x + Math.cos(ta) * 0.45, u.y + Math.sin(ta) * 0.45, 12.5); ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(m[0], m[1], 2.5, 0, 7); ctx.fill(); }
    } else if (u.type === 'rocket') {
      wheels(u, 0.9, 0.56, 3, 2);
      prism(rect(u.x, u.y, u.angle, 0.92, 0.5), 3, 7, hl(-0.05), sL, sR, 'rgba(0,0,0,0.45)');
      prism(rect(u.x, u.y, u.angle, 0.28, 0.5, 0.3), 7, 14, flash ? U.shade(base, 0.45) : top, sL, sR, 'rgba(0,0,0,0.45)');
      // launcher rails, raised toward the rear
      const ca = Math.cos(u.angle), sa = Math.sin(u.angle);
      for (let k = -2; k <= 2; k++) {
        const ox = -sa * k * 0.08, oy = ca * k * 0.08;
        const a0 = sp(u.x - ca * 0.4 + ox, u.y - sa * 0.4 + oy, 9), a1 = sp(u.x + ca * 0.12 + ox, u.y + sa * 0.12 + oy, 20);
        ctx.strokeStyle = '#3a3a30'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
        if (!wreck && u.salvoLeft <= Math.abs(k) * 2 && u.cd > 2) continue;
        ctx.strokeStyle = '#c8b888'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a1[0] - (a1[0] - a0[0]) * 0.3, a1[1] - (a1[1] - a0[1]) * 0.3); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      }
    } else {
      prism(rect(u.x, u.y, u.angle, 0.92, 0.6), 0, 5, '#333', '#222', '#2a2a2a', 'rgba(0,0,0,0.5)');
      prism(rect(u.x, u.y, u.angle, 0.82, 0.5), 5, 9, flash ? U.shade(base, 0.45) : top, sL, sR, 'rgba(0,0,0,0.45)');
      prism(rect(u.x, u.y, u.angle, 0.36, 0.4, -0.18), 9, 16, hl(0.1), sL, sR, 'rgba(0,0,0,0.5)');
      const a = u.angle;
      const rl = 0.85 - (u.recoil || 0) * 0.15;
      barrel(u, a, -0.05, rl, 14, wreck ? 12 : 24, 4);
    }
    if (st.snow && !wreck) {
      const c = rect(u.x, u.y, u.angle, 0.5 * sz, 0.3 * sz).map(([x, y]) => sp(x, y, 10 * sz));
      poly(c); ctx.fillStyle = 'rgba(245,245,250,0.4)'; ctx.fill();
    }
  }

  function drawCorpse(c) {
    if (c.type === 'stump') {
      const [sx, sy] = sp(c.x, c.y, 0);
      c.t = Math.min(1, (c.t || 0) + 0.03);
      const rot = c.fall * Math.min(1.45, c.t * c.t * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(sx + c.fall * 16 * c.t, sy + 2, 18 * c.t + 3, 4, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(sx, sy - 2); ctx.rotate(rot); ctx.globalAlpha = 0.95;
      ctx.drawImage(treeSprites[c.v % treeSprites.length], -24, -60);
      ctx.restore();
      ctx.fillStyle = '#5a3e22'; ctx.beginPath(); ctx.ellipse(sx, sy - 1, 3, 1.6, 0, 0, 7); ctx.fill();
      return;
    }
    const a = Math.min(1, c.life / 3);
    ctx.globalAlpha = a;
    if (c.type === 'inf') {
      const [sx, sy] = sp(c.x, c.y, 0);
      ctx.fillStyle = 'rgba(70,20,15,0.5)';
      ctx.beginPath(); ctx.ellipse(sx + 2, sy, 5, 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = teamCol(c.side, -0.25);
      ctx.save(); ctx.translate(sx, sy - 1); ctx.rotate(Math.cos(c.angle) > 0 ? 0.25 : -0.25);
      ctx.fillRect(-6, -2, 10, 4);
      ctx.fillStyle = '#e2b892'; ctx.beginPath(); ctx.arc(5, 0, 2, 0, 7); ctx.fill();
      ctx.restore();
    } else drawVehicle(c, true);
    ctx.globalAlpha = 1;
  }

  function drawFence(o) {
    ctx.strokeStyle = st.snow ? '#6a5a4a' : '#7a5a34'; ctx.lineWidth = 1.2;
    const x0 = o.x, y0 = o.y, x1 = o.x + (o.dir ? 0 : 1), y1 = o.y + (o.dir ? 1 : 0);
    for (const h of [3, 6]) { const a = sp(x0, y0, h), b = sp(x1, y1, h); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let k = 0; k <= 2; k++) { const t = k / 2; const a = sp(U.lerp(x0, x1, t), U.lerp(y0, y1, t), 0), b = sp(U.lerp(x0, x1, t), U.lerp(y0, y1, t), 8); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  }
  function drawPole(o) {
    const [sx, sy] = sp(o.x + 0.5, o.y + 0.5, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx, sy - 1, 10, 2);
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 34); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 6, sy - 30); ctx.lineTo(sx + 6, sy - 30); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,20,20,0.35)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(sx - 6, sy - 30); ctx.quadraticCurveTo(sx - 30, sy - 22, sx - 58, sy - 30); ctx.stroke();
  }
  function drawWreck(o) {
    const fake = { x: o.x + 0.5, y: o.y + 0.5, angle: o.a, turret: o.a + 0.7, type: o.v ? 'tank' : 'recon', side: 0 };
    drawVehicle(fake, true);
    if (Math.random() < 0.04) addP('smoke', o.x + 0.5, o.y + 0.5, 8, { vz: 10, life: 2.5, size: 2, grow: 6, alpha: 0.3 });
  }
  function drawTree(o) {
    const [sx, sy] = sp(o.x + 0.5, o.y + 0.5, 0);
    const spr = treeSprites[o.v % treeSprites.length];
    ctx.drawImage(spr, sx - 24, sy - 62);
  }
  function drawRock(o) {
    const [sx, sy] = sp(o.x + 0.5, o.y + 0.5, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx + 3, sy + 2, 14, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7d7a72';
    ctx.beginPath(); ctx.moveTo(sx - 13, sy); ctx.lineTo(sx - 8, sy - 10); ctx.lineTo(sx + 2, sy - 14); ctx.lineTo(sx + 12, sy - 6); ctx.lineTo(sx + 11, sy + 2); ctx.lineTo(sx - 4, sy + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9d9a90';
    ctx.beginPath(); ctx.moveTo(sx - 8, sy - 10); ctx.lineTo(sx + 2, sy - 14); ctx.lineTo(sx + 4, sy - 6); ctx.lineTo(sx - 6, sy - 3); ctx.closePath(); ctx.fill();
  }
  function drawSandbag(o) {
    const c = [[o.x + 0.05, o.y + 0.25], [o.x + 0.95, o.y + 0.25], [o.x + 0.95, o.y + 0.75], [o.x + 0.05, o.y + 0.75]];
    prism(c, 0, 9, '#b8a57a', '#8a7a55', '#9e8c62', 'rgba(40,30,10,0.6)');
    ctx.strokeStyle = 'rgba(60,45,20,0.5)'; ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) {
      const a = sp(o.x + k / 3, o.y + 0.25, 9), b = sp(o.x + k / 3, o.y + 0.75, 9);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  function drawBunker(o) {
    const c = [[o.x + 0.08, o.y + 0.08], [o.x + 0.92, o.y + 0.08], [o.x + 0.92, o.y + 0.92], [o.x + 0.08, o.y + 0.92]];
    const sh = c.map(([x, y]) => sp(x + 0.15, y + 0.15, 0));
    poly(sh); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    prism(c, 0, 14, '#8d8b84', '#5f5d57', '#7a7871', 'rgba(0,0,0,0.5)');
    const c2 = [[o.x + 0.25, o.y + 0.25], [o.x + 0.75, o.y + 0.25], [o.x + 0.75, o.y + 0.75], [o.x + 0.25, o.y + 0.75]];
    prism(c2, 14, 18, '#9a988f', '#6a6862', '#84827b', 'rgba(0,0,0,0.4)');
    ctx.fillStyle = '#111';
    poly([sp(o.x + 0.3, o.y + 0.92, 7), sp(o.x + 0.7, o.y + 0.92, 7), sp(o.x + 0.7, o.y + 0.92, 10), sp(o.x + 0.3, o.y + 0.92, 10)]); ctx.fill();
    poly([sp(o.x + 0.92, o.y + 0.3, 7), sp(o.x + 0.92, o.y + 0.7, 7), sp(o.x + 0.92, o.y + 0.7, 10), sp(o.x + 0.92, o.y + 0.3, 10)]); ctx.fill();
  }
  function drawHouse(o) {
    const x0 = o.x + 0.1, y0 = o.y + 0.1, x1 = o.x + o.w - 0.1, y1 = o.y + o.d - 0.1;
    const wallH = 24, ridgeH = o.ruined ? 24 : 40;
    const shadow = [[x0 + 0.3, y0 + 0.3], [x1 + 0.6, y0 + 0.3], [x1 + 0.6, y1 + 0.6], [x0 + 0.3, y1 + 0.6]].map(([x, y]) => sp(x, y, 0));
    poly(shadow); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    const wall = o.wall;
    prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 0, wallH, U.shade(wall, -0.1), U.shade(wall, -0.28), U.shade(wall, -0.08), 'rgba(0,0,0,0.4)');
    // windows on visible faces
    ctx.fillStyle = 'rgba(30,35,45,0.85)';
    const winsY = Math.max(1, Math.round(x1 - x0));
    for (let k = 0; k < winsY; k++) {
      const a = x0 + (k + 0.3) / winsY * (x1 - x0), b = x0 + (k + 0.65) / winsY * (x1 - x0);
      poly([sp(a, y1, 8), sp(b, y1, 8), sp(b, y1, 16), sp(a, y1, 16)]); ctx.fill();
    }
    const winsX = Math.max(1, Math.round(y1 - y0));
    for (let k = 0; k < winsX; k++) {
      const a = y0 + (k + 0.3) / winsX * (y1 - y0), b = y0 + (k + 0.65) / winsX * (y1 - y0);
      poly([sp(x1, a, 8), sp(x1, b, 8), sp(x1, b, 16), sp(x1, a, 16)]); ctx.fill();
    }
    if (o.ruined) {
      // broken top, rubble
      ctx.fillStyle = 'rgba(30,25,20,0.55)';
      poly([sp(x0, y0, wallH), sp(x1, y0, wallH), sp(x1, y1, wallH), sp(x0, y1, wallH)]); ctx.fill();
      ctx.fillStyle = U.shade(wall, -0.2);
      poly([sp(x0, y1, wallH), sp((x0 + x1) / 2, y1, wallH), sp((x0 + x1) / 2 - 0.2, y1, wallH - 9), sp(x0 + 0.3, y1, wallH - 5)]);
      ctx.fillStyle = '#2b2620'; ctx.fill();
      return;
    }
    const ym = (y0 + y1) / 2, e = 0.12;
    const roof = o.roof;
    poly([sp(x0 - e, y0 - e, wallH), sp(x1 + e, y0 - e, wallH), sp(x1 + e, ym, ridgeH), sp(x0 - e, ym, ridgeH)]);
    ctx.fillStyle = U.shade(roof, -0.25); ctx.fill();
    poly([sp(x1, y0, wallH), sp(x1, y1, wallH), sp(x1, ym, ridgeH)]);
    ctx.fillStyle = U.shade(wall, -0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
    poly([sp(x0 - e, y1 + e, wallH), sp(x1 + e, y1 + e, wallH), sp(x1 + e, ym, ridgeH), sp(x0 - e, ym, ridgeH)]);
    ctx.fillStyle = roof; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    // roof tile lines
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const a = sp(x0 - e, U.lerp(y1 + e, ym, t), U.lerp(wallH, ridgeH, t)), b = sp(x1 + e, U.lerp(y1 + e, ym, t), U.lerp(wallH, ridgeH, t));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // chimney
    const cxp = x0 + 0.4;
    prism([[cxp, ym - 0.1], [cxp + 0.2, ym - 0.1], [cxp + 0.2, ym + 0.1], [cxp, ym + 0.1]], ridgeH - 6, ridgeH + 6, '#5a4a40', '#4a3a30', '#6a5a50');
  }

  function drawParticle(p) {
    const [sx, sy] = sp(p.x, p.y, p.z);
    const k = p.life / p.max;
    switch (p.kind) {
      case 'smoke':
        ctx.fillStyle = `rgba(70,70,68,${0.55 * k * p.alpha})`;
        ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, 7); ctx.fill(); break;
      case 'dust':
        ctx.fillStyle = `rgba(150,130,95,${0.45 * k})`;
        ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, 7); ctx.fill(); break;
      case 'fire':
        ctx.fillStyle = `rgba(255,${120 + 100 * k | 0},40,${k})`;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5 + 2 * k, 0, 7); ctx.fill(); break;
      case 'spark':
        ctx.fillStyle = `rgba(255,230,140,${k})`; ctx.fillRect(sx - 1, sy - 1, 2, 2); break;
      case 'debris':
        ctx.fillStyle = p.leaf ? `rgba(50,90,40,${Math.min(1, k * 2)})` : `rgba(35,30,25,${Math.min(1, k * 2)})`; ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); break;
      case 'promo':
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.lineTo(sx, sy - 6); ctx.lineTo(sx + 7, sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 7, sy + 5); ctx.lineTo(sx, sy - 1); ctx.lineTo(sx + 7, sy + 5); ctx.stroke();
        ctx.globalAlpha = 1; break;
      case 'flash': {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size);
        g.addColorStop(0, `rgba(255,250,220,${k})`); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, 7); ctx.fill(); break;
      }
      case 'explosion': {
        const r = p.size * (1.3 - k * 0.6);
        const g = ctx.createRadialGradient(sx, sy - r * 0.3, 0, sx, sy - r * 0.3, r);
        g.addColorStop(0, `rgba(255,255,200,${k})`); g.addColorStop(0.35, `rgba(255,170,40,${k})`);
        g.addColorStop(0.75, `rgba(200,60,10,${k * 0.7})`); g.addColorStop(1, 'rgba(80,20,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - r * 0.3, r, 0, 7); ctx.fill(); break;
      }
    }
  }

  function healthBar(u, sx, sy) {
    const w = isFoot(u) ? 18 : 30;
    const f = U.clamp(u.hp / u.maxHp, 0, 1);
    const segs = isFoot(u) ? 5 : 8;
    const x = sx - w / 2, y = sy;
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    const col = f > 0.55 ? '#38d838' : f > 0.28 ? '#e8d030' : '#e83a2a';
    const sw = w / segs;
    for (let i = 0; i < segs; i++) {
      if ((i + 0.5) / segs > f && !(i === 0 && f > 0)) continue;
      ctx.fillStyle = col; ctx.fillRect(x + i * sw + 0.5, y, sw - 1, 3);
    }
  }
  function brackets(sx, sy, w, h) {
    const l = 5;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(sx - w, sy - h + l); ctx.lineTo(sx - w, sy - h); ctx.lineTo(sx - w + l, sy - h);
    ctx.moveTo(sx + w - l, sy - h); ctx.lineTo(sx + w, sy - h); ctx.lineTo(sx + w, sy - h + l);
    ctx.moveTo(sx - w, sy - l); ctx.lineTo(sx - w, sy); ctx.lineTo(sx - w + l, sy);
    ctx.moveTo(sx + w - l, sy); ctx.lineTo(sx + w, sy); ctx.lineTo(sx + w, sy - l);
    ctx.stroke();
  }

  // ---------------- fog of war ----------------
  let fogCanvas = null;
  function updateFog() {
    const vis = st.vis, seen = st.seen;
    vis.fill(0);
    const fogF = st.weather === 'fog' ? 0.75 : st.weather === 'snow' || st.weather === 'dust' ? 0.88 : 1;
    for (const u of st.units) {
      if (u.dead || u.side !== 0) continue;
      const r = u.T.sight * fogF + 0.5;
      const x0 = Math.max(0, Math.floor(u.x - r)), x1 = Math.min(N - 1, Math.floor(u.x + r));
      const y0 = Math.max(0, Math.floor(u.y - r)), y1 = Math.min(N - 1, Math.floor(u.y + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if ((x + 0.5 - u.x) ** 2 + (y + 0.5 - u.y) ** 2 <= r * r) { vis[y * N + x] = 1; seen[y * N + x] = 1; }
      }
    }
    if (!fogCanvas) { fogCanvas = document.createElement('canvas'); fogCanvas.width = N + 2; fogCanvas.height = N + 2; }
    const g = fogCanvas.getContext('2d');
    const id = g.createImageData(N + 2, N + 2);
    for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) {
      const o = ((y + 1) * (N + 2) + (x + 1)) * 4;
      const xi = U.clamp(x, 0, N - 1), yi = U.clamp(y, 0, N - 1), i = yi * N + xi;
      id.data[o] = 6; id.data[o + 1] = 8; id.data[o + 2] = 12;
      id.data[o + 3] = vis[i] ? 0 : seen[i] ? 110 : 235;
    }
    g.putImageData(id, 0, 0);
  }
  const visibleU = (u) => u.side === 0 || !st.fogOn || st.vis[Math.floor(u.y) * N + Math.floor(u.x)];
  const visibleXY = (x, y) => !st.fogOn || !!st.vis[U.clamp(Math.floor(y), 0, N - 1) * N + U.clamp(Math.floor(x), 0, N - 1)];

  function drawWeather(vw, vh, dt) {
    const w = st.weather;
    if (w === 'clear') return;
    if (w === 'fog') {
      const t = st.time;
      for (let k = 0; k < 3; k++) {
        const gx = (Math.sin(t * 0.05 + k * 2) * 0.5 + 0.5) * vw, gy = (Math.cos(t * 0.04 + k) * 0.5 + 0.5) * vh;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(vw, vh) * 0.6);
        g.addColorStop(0, 'rgba(200,205,210,0.22)'); g.addColorStop(1, 'rgba(200,205,210,0.05)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
      }
      return;
    }
    if (w === 'rain') { ctx.fillStyle = 'rgba(30,40,60,0.18)'; ctx.fillRect(0, 0, vw, vh); }
    if (w === 'snow') { ctx.fillStyle = 'rgba(200,210,230,0.08)'; ctx.fillRect(0, 0, vw, vh); }
    if (w === 'dust') { ctx.fillStyle = 'rgba(190,150,90,0.16)'; ctx.fillRect(0, 0, vw, vh); }
    const spd = st.paused ? 0 : st.speed;
    ctx.lineWidth = 1;
    for (const p of st.wx) {
      if (w === 'rain') {
        p.y += dt * 1.6 * p.s * spd; p.x -= dt * 0.25 * spd;
        if (p.y > 1) { p.y -= 1; p.x = Math.random(); } if (p.x < 0) p.x += 1;
        const x = p.x * vw, y = p.y * vh;
        ctx.strokeStyle = 'rgba(180,200,230,0.45)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12 * p.s); ctx.stroke();
      } else if (w === 'snow') {
        p.y += dt * 0.12 * p.s * spd; p.x += Math.sin(st.time * 1.3 + p.z * 10) * dt * 0.02 * spd;
        if (p.y > 1) { p.y -= 1; p.x = Math.random(); } p.x = (p.x + 1) % 1;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(p.x * vw, p.y * vh, 1 + p.s * 1.3, 0, 7); ctx.fill();
      } else {
        p.x += dt * 0.5 * p.s * spd; p.y += Math.sin(p.z * 9 + st.time) * dt * 0.02 * spd;
        if (p.x > 1) { p.x -= 1; p.y = Math.random(); } p.y = (p.y + 1) % 1;
        ctx.fillStyle = 'rgba(210,170,110,0.35)'; ctx.fillRect(p.x * vw, p.y * vh, 6 * p.s, 1.2);
      }
    }
  }

  function chevrons(u, x, y) {
    if (!u.rank) return;
    ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1.6;
    for (let k = 0; k < u.rank; k++) {
      const yy = y - k * 3.5;
      ctx.beginPath(); ctx.moveTo(x - 4, yy); ctx.lineTo(x, yy - 3); ctx.lineTo(x + 4, yy); ctx.stroke();
    }
  }

  function render(dt) {
    const vw = viewW(), vh = viewH();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080a08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tw = st.terrain.width, th = st.terrain.height;
    const sx0 = Math.max(0, st.camX), sy0 = Math.max(0, st.camY);
    const sx1 = Math.min(tw, st.camX + vw), sy1 = Math.min(th, st.camY + vh);
    if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(st.terrain, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 - st.camX, sy0 - st.camY, sx1 - sx0, sy1 - sy0);

    const onScreen = (x, y, m) => {
      const [a, b] = sp(x, y, 0);
      return a > -m && a < vw + m && b > -m && b < vh + m * 1.5;
    };
    for (const c of st.corpses) if (c.type === 'inf' && onScreen(c.x, c.y, 30)) drawCorpse(c);
    for (const m of st.markers) {
      const [mx, my] = sp(m.x, m.y, 0);
      const k = m.life / m.max;
      ctx.strokeStyle = m.color; ctx.globalAlpha = k; ctx.lineWidth = 2;
      const r = 6 + (1 - k) * 10;
      ctx.beginPath(); ctx.ellipse(mx, my, r * 1.6, r * 0.8, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const u of st.sel) {
      const [x, y] = sp(u.x, u.y, 0);
      const r = isFoot(u) ? (u.type === 'mg' ? 11 : 8) : u.type === 'heavy' ? 24 : 20;
      ctx.strokeStyle = 'rgba(120,255,120,0.75)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 7); ctx.stroke();
    }

    const list = [];
    for (const o of st.objects) {
      if (o.dead) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.d / 2;
      if (!onScreen(cx, cy, 120)) continue;
      list.push({ k: cx + cy, o });
    }
    for (const c of st.corpses) if ((c.wreck || c.type === 'stump') && onScreen(c.x, c.y, 60)) list.push({ k: c.x + c.y, c });
    for (const u of st.units) if (onScreen(u.x, u.y, 40) && visibleU(u)) list.push({ k: u.x + u.y, u });
    list.sort((a, b) => a.k - b.k);
    for (const it of list) {
      if (it.u) { if (isFoot(it.u)) drawInf(it.u); else drawVehicle(it.u, false); }
      else if (it.c) drawCorpse(it.c);
      else {
        const o = it.o;
        if (o.type === 'tree') drawTree(o);
        else if (o.type === 'house') drawHouse(o);
        else if (o.type === 'sandbag') drawSandbag(o);
        else if (o.type === 'bunker') drawBunker(o);
        else if (o.type === 'fence') drawFence(o);
        else if (o.type === 'pole') drawPole(o);
        else if (o.type === 'wreck') drawWreck(o);
        else drawRock(o);
      }
    }

    for (const p of st.projectiles) {
      if (!visibleXY(p.x, p.y) && p.kind !== 'arc') continue;
      const [x, y] = sp(p.x, p.y, p.z);
      const [gx, gy] = sp(p.x, p.y, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 2.5, 1.2, 0, 0, 7); ctx.fill();
      if (p.rocket || p.kind === 'atr') { ctx.fillStyle = '#ffcf70'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); continue; }
      ctx.fillStyle = p.kind === 'shell' ? '#ffe9a0' : '#2b2b2b';
      ctx.beginPath(); ctx.arc(x, y, p.kind === 'shell' ? 2 : 2.8, 0, 7); ctx.fill();
    }
    for (const t of st.tracers) {
      const a = sp(t.x1, t.y1, t.z1), b = sp(t.x2, t.y2, t.z2);
      ctx.lineWidth = t.mg ? 1.1 : 1.4;
      ctx.strokeStyle = t.mg ? `rgba(255,170,90,${t.life / 0.05})` : `rgba(255,240,150,${t.life / 0.07})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (const p of st.particles) if (onScreen(p.x, p.y, 60)) drawParticle(p);

    // fog of war overlay (smoothly interpolated tile visibility, iso-projected)
    if (st.fogOn && fogCanvas) {
      ctx.save();
      ctx.setTransform(TW / 2, TH / 2, -TW / 2, TH / 2, OX - st.camX, OY - st.camY);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fogCanvas, 0, 0, N + 2, N + 2, -1, -1, N + 2, N + 2);
      ctx.restore();
    }

    const hover = st.hover;
    for (const u of st.units) {
      const isSel = st.sel.has(u);
      if (!visibleU(u)) continue;
      if (!isSel && u.hp >= u.maxHp && u !== hover && !u.rank) continue;
      if (!onScreen(u.x, u.y, 30)) continue;
      const h = isFoot(u) ? 20 : u.type === 'heavy' ? 26 : u.type === 'recon' ? 18 : u.type === 'tank' ? 22 : 28;
      const [x, y] = sp(u.x, u.y, h);
      if (isSel) brackets(x, y + h + 4, isFoot(u) ? (u.type === 'mg' ? 11 : 8) : 20, h + 6);
      if (isSel || u.hp < u.maxHp || u === hover) healthBar(u, x, y - 6);
      chevrons(u, x - (isFoot(u) ? 13 : 19), y - 1);
    }

    drawWeather(vw, vh, dt || 0.016);

    if (st.drag && st.drag.active) {
      const d = st.drag;
      ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(120,255,120,0.08)';
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
    if (st.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = '#ffcf6a'; ctx.font = '900 30px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText('DURAKLATILDI', vw / 2, vh / 2); ctx.textAlign = 'left';
    }
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }

  // ---------------- minimap ----------------
  let mini = null, miniCtx = null, miniBase = null;
  const MW = 212, MH = 112;
  function buildMinimapBase() {
    mini = U.el('minimap'); miniCtx = mini.getContext('2d');
    miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
    const c = miniBase.getContext('2d');
    c.fillStyle = '#050608'; c.fillRect(0, 0, MW, MH);
    c.drawImage(st.terrain, 0, 0, st.terrain.width, st.terrain.height, 0, 0, MW, MH);
  }
  function renderMinimap() {
    const sx = MW / st.terrain.width, sy = MH / st.terrain.height;
    miniCtx.drawImage(miniBase, 0, 0);
    for (const o of st.objects) {
      if (o.type !== 'house' || !st.seen[Math.floor(o.y) * N + Math.floor(o.x)]) continue;
      miniCtx.fillStyle = '#c8b890';
      miniCtx.fillRect(isoX(o.x + 1, o.y + 1) * sx - 1.5, isoY(o.x + 1, o.y + 1) * sy - 1, 3, 2);
    }
    // unexplored areas dark on the minimap
    if (fogCanvas) {
      miniCtx.save();
      miniCtx.setTransform(TW / 2 * sx, TH / 2 * sy, -TW / 2 * sx, TH / 2 * sy, OX * sx, OY * sy);
      miniCtx.drawImage(fogCanvas, 0, 0, N + 2, N + 2, -1, -1, N + 2, N + 2);
      miniCtx.restore();
    }
    for (const u of st.units) {
      if (!visibleU(u)) continue;
      miniCtx.fillStyle = U.rgbStr(st.sideColor[u.side].map((v) => Math.min(255, v + 40)));
      const s = isFoot(u) ? 2 : 3;
      miniCtx.fillRect(isoX(u.x, u.y) * sx - s / 2, isoY(u.x, u.y) * sy - s / 2, s, s);
    }
    miniCtx.strokeStyle = '#fff'; miniCtx.lineWidth = 1;
    miniCtx.strokeRect(st.camX * sx + 0.5, st.camY * sy + 0.5, viewW() * sx, viewH() * sy);
  }

  // ---------------- camera ----------------
  function clampCam() {
    const tw = st.terrain.width, th = st.terrain.height;
    st.camX = U.clamp(st.camX, -150, tw - viewW() + 150);
    st.camY = U.clamp(st.camY, -150, th - viewH() + 150);
  }

  // ======================================================================
  //  UI
  // ======================================================================
  function banner(text, secs) {
    const b = U.el('battle-banner');
    b.textContent = text;
    b.classList.add('show');
    st.bannerT = secs || 2.5;
  }

  function setupUI() {
    const c = st.cfg;
    U.el('sb-title').textContent = c.playerSide === 'attacker' ? 'SALDIRI' : 'SAVUNMA';
    U.el('sb-sub').textContent = c.provinceName;
    U.el('f-us').src = LOL.ui.flagURL(st.sideNation[0]);
    U.el('f-them').src = LOL.ui.flagURL(st.sideNation[1]);
    LOL.audio.music('battle');
    LOL.audio.ambience(true);
    U.el('f-us-name').textContent = st.sideName[0];
    U.el('f-them-name').textContent = st.sideName[1];
    U.el('f-bar-us').style.background = U.rgbStr(st.sideColor[0]);
    U.el('f-bar-them').style.background = U.rgbStr(st.sideColor[1]);
    U.el('b-speed').textContent = 'Hız 1x';
    st.uiT = 0;
  }
  function updateUI(dt) {
    st.uiT -= dt;
    if (st.bannerT > 0) { st.bannerT -= dt; if (st.bannerT <= 0) U.el('battle-banner').classList.remove('show'); }
    if (st.uiT > 0) return;
    st.uiT = 0.2;
    const a = alive(0), b = alive(1);
    const pa = a.reduce((s, u) => s + u.hp / u.maxHp * LOL.config.power[u.type], 0);
    const pb = b.reduce((s, u) => s + u.hp / u.maxHp * LOL.config.power[u.type], 0);
    U.el('f-us-n').textContent = a.length;
    U.el('f-them-n').textContent = b.length;
    const tot = pa + pb || 1;
    U.el('f-bar-us').style.width = (pa / tot * 100) + '%';
    U.el('f-bar-them').style.width = (pb / tot * 100) + '%';
    const sel = [...st.sel];
    const box = U.el('sb-sel');
    if (!sel.length) {
      box.innerHTML = '<div class="sel-title">Seçim yok</div><div style="color:#888">Birliklerini seçmek için tıkla ya da kutu çiz.</div>';
    } else {
      const cnt = U.zeroUnits();
      let hp = 0, mx = 0;
      sel.forEach((u) => { cnt[u.type]++; hp += u.hp; mx += u.maxHp; });
      box.innerHTML = `<div class="sel-title">${sel.length} birlik seçili</div>
        <div class="sel-grid">${U.TYPES.filter((t) => cnt[t]).map((t) => `<div class="cell"><img src="${LOL.ui.unitIcon(t, st.sideNation[0].color)}"><b>${cnt[t]}</b><small>${LOL.config.unitShort[t]}</small></div>`).join('')}</div>
        ${sel.some((u) => u.rank) ? `<div style="color:#ffd860;font-size:11px;margin-top:4px">★ ${sel.filter((u) => u.rank).length} tecrübeli birlik</div>` : ''}
        <div class="hpbar"><div style="width:${hp / mx * 100}%"></div></div>`;
    }
    U.el('b-pause').classList.toggle('on', st.paused);
    document.querySelector('.sb-btns [data-b=amove]').classList.toggle('on', st.amoveMode);
  }

  // ======================================================================
  //  Input
  // ======================================================================
  function unitAt(mx, my, sideFilter) {
    let best = null, bd = 1e9;
    for (const u of st.units) {
      if (sideFilter != null && u.side !== sideFilter) continue;
      if (!visibleU(u)) continue;
      const [x, y] = sp(u.x, u.y, 0);
      const r = isFoot(u) ? 10 : 20;
      const cy = y - (isFoot(u) ? 8 : 9);
      const d = (mx - x) ** 2 + (my - cy) ** 2;
      if (d < r * r && d < bd) { bd = d; best = u; }
    }
    return best;
  }
  function domType(list) {
    const c = { inf: 0, tank: 0, art: 0 };
    list.forEach((u) => { const k = LOL.config.techClass[u.type]; c[k] += isFoot(u) ? 1 : 2.5; });
    return U.TYPES.filter((t) => c[t] != null).reduce((a, t) => (c[t] > c[a] ? t : a), 'inf');
  }
  function selectedList() { return [...st.sel].filter((u) => !u.dead); }

  function commandAt(mx, my, forceAmove) {
    const sel = selectedList();
    if (!sel.length) return;
    const enemy = unitAt(mx, my, 1);
    if (enemy) {
      issueAttack(sel, enemy);
      st.markers.push({ x: enemy.x, y: enemy.y, life: 0.6, max: 0.6, color: '#ff4040' });
    } else {
      const t = screenToTile(mx, my);
      if (!inb(Math.floor(t.x), Math.floor(t.y))) return;
      const type = forceAmove ? 'amove' : 'move';
      issueMove(sel, t.x, t.y, type);
      st.markers.push({ x: t.x, y: t.y, life: 0.6, max: 0.6, color: type === 'amove' ? '#ffb040' : '#60ff60' });
    }
    LOL.audio.say(enemy || forceAmove ? 'attack' : 'move', domType(sel));
  }

  function doButton(b) {
    if (!st || st.ended) return;
    LOL.audio.play('click');
    if (b === 'amove') st.amoveMode = !st.amoveMode;
    else if (b === 'stop') stopUnits(selectedList());
    else if (b === 'selall') { st.sel = new Set(alive(0)); }
    else if (b === 'speed') { st.speed = st.speed === 1 ? 2 : st.speed === 2 ? 3 : 1; U.el('b-speed').textContent = 'Hız ' + st.speed + 'x'; }
    else if (b === 'pause') st.paused = !st.paused;
    else if (b === 'retreat') retreatPrompt();
  }
  B.button = doButton;

  async function retreatPrompt() {
    const was = st.paused; st.paused = true;
    const v = await LOL.ui.modal('Geri Çekil?', 'Kalan birliklerin geri çekilecek ve bölge düşmana kalacak. Çekilirken birliklerinin yaklaşık %15\'i kaybedilir.',
      [{ label: 'Vazgeç', value: false }, { label: 'Geri Çekil', value: true, cls: 'danger' }]);
    st.paused = was;
    if (v && !st.ended) finish('retreat');
  }

  B.onInput = function (type, e) {
    if (!st || st.ended) return;
    if (LOL.ui.isModalOpen()) return;
    const mx = e.clientX, my = e.clientY;
    if (type === 'move') {
      st.mouse.x = mx; st.mouse.y = my; st.mouse.inside = true;
      if (st.drag) {
        st.drag.x1 = mx; st.drag.y1 = my;
        if (Math.abs(mx - st.drag.x0) + Math.abs(my - st.drag.y0) > 6) st.drag.active = true;
      }
      if (st.mdrag) {
        st.camX = st.mdrag.cx - (mx - st.mdrag.x); st.camY = st.mdrag.cy - (my - st.mdrag.y); clampCam();
      }
      if (mx < viewW()) {
        st.hover = unitAt(mx, my);
        const enemyHover = st.hover && st.hover.side === 1 && st.sel.size;
        canvas.style.cursor = st.amoveMode || enemyHover ? 'crosshair' : st.hover && st.hover.side === 0 ? 'pointer' : 'default';
      }
    } else if (type === 'down') {
      if (mx >= viewW()) return;
      LOL.audio.init();
      if (e.button === 0) {
        if (st.amoveMode) { commandAt(mx, my, true); st.amoveMode = false; return; }
        st.drag = { x0: mx, y0: my, x1: mx, y1: my, active: false };
      } else if (e.button === 1) {
        st.mdrag = { x: mx, y: my, cx: st.camX, cy: st.camY };
        e.preventDefault();
      } else if (e.button === 2) {
        commandAt(mx, my, e.ctrlKey);
      }
    } else if (type === 'up') {
      if (e.button === 1) { st.mdrag = null; return; }
      if (e.button !== 0 || !st.drag) return;
      const d = st.drag; st.drag = null;
      if (d.active) {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
        const picked = alive(0).filter((u) => {
          const [x, y] = sp(u.x, u.y, 8);
          return x >= x0 && x <= x1 && y >= y0 && y <= y1;
        });
        if (!e.shiftKey) st.sel = new Set();
        picked.forEach((u) => st.sel.add(u));
        if (picked.length) LOL.audio.say('select', domType(picked));
      } else {
        const u = unitAt(mx, my);
        const now = performance.now();
        if (u && u.side === 0) {
          if (now - st.lastClick < 320 && st.lastClickUnit && st.lastClickUnit.type === u.type) {
            const vw = viewW(), vh = viewH();
            st.sel = new Set(alive(0).filter((v) => {
              const [x, y] = sp(v.x, v.y, 0);
              return v.type === u.type && x > 0 && x < vw && y > 0 && y < vh;
            }));
          } else if (e.shiftKey) {
            if (st.sel.has(u)) st.sel.delete(u); else st.sel.add(u);
          } else st.sel = new Set([u]);
          st.lastClick = now; st.lastClickUnit = u;
          LOL.audio.say('select', u.type);
        } else if (u && u.side === 1 && st.sel.size) {
          commandAt(mx, my, false);
        } else if (!e.shiftKey) {
          st.sel = new Set();
        }
      }
    } else if (type === 'leave') {
      st.mouse.inside = false;
    } else if (type === 'keydown') {
      const k = e.key;
      st.keys[k] = true;
      if (k >= '1' && k <= '9') {
        if (e.ctrlKey) { st.groups[k] = selectedList(); e.preventDefault(); banner('Grup ' + k + ' kuruldu', 1); }
        else if (st.groups[k]) {
          const g = st.groups[k].filter((u) => !u.dead);
          if (g.length) {
            if (st.sel.size === g.length && g.every((u) => st.sel.has(u))) {
              const c = centroid(g);
              st.camX = isoX(c.x, c.y) - viewW() / 2; st.camY = isoY(c.x, c.y) - viewH() / 2; clampCam();
            }
            st.sel = new Set(g);
          }
        }
      } else if (k === 'a' || k === 'A') doButton('amove');
      else if (k === 's' || k === 'S') doButton('stop');
      else if (k === 'q' || k === 'Q') doButton('selall');
      else if (k === 'p' || k === 'P') doButton('pause');
      else if (k === 'Escape') { st.sel = new Set(); st.amoveMode = false; }
    } else if (type === 'keyup') {
      st.keys[e.key] = false;
    }
  };

  B.onMinimap = function (e, isDown) {
    if (!st || st.ended) return;
    const r = mini.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const wx = fx * st.terrain.width, wy = fy * st.terrain.height;
    if (isDown === 'right' && st.sel.size) {
      const tx = ((wx - OX) / (TW / 2) + (wy - OY) / (TH / 2)) / 2;
      const ty = ((wy - OY) / (TH / 2) - (wx - OX) / (TW / 2)) / 2;
      issueMove(selectedList(), tx, ty, 'move');
      LOL.audio.say('move', domType(selectedList()));
      return;
    }
    st.camX = wx - viewW() / 2; st.camY = wy - viewH() / 2; clampCam();
  };

  // ======================================================================
  //  Frame / end
  // ======================================================================
  B.frame = function (dt) {
    if (!st) return;
    // camera scrolling
    const sp2 = 900 * dt;
    if (st.keys.ArrowLeft) st.camX -= sp2;
    if (st.keys.ArrowRight) st.camX += sp2;
    if (st.keys.ArrowUp) st.camY -= sp2;
    if (st.keys.ArrowDown) st.camY += sp2;
    if (st.mouse.inside && !st.drag && !st.mdrag && !LOL.ui.isModalOpen()) {
      const m = 14, mx = st.mouse.x, my = st.mouse.y;
      if (mx < m) st.camX -= sp2;
      else if (mx > viewW() - m && mx < viewW()) st.camX += sp2;
      if (my < m) st.camY -= sp2;
      else if (my > viewH() - m) st.camY += sp2;
    }
    clampCam();
    if (!st.paused && !st.ended) {
      const h = 1 / 30;
      st.acc = (st.acc || 0) + dt * st.speed;
      let n = 0;
      while (st.acc >= h && n < 8) { step(h); st.acc -= h; n++; }
      if (n >= 8) st.acc = 0;
    }
    if (!st) return;
    render(dt);
    renderMinimap();
    updateUI(dt);
  };

  function finish(outcome) {
    if (st.ended) return;
    st.ended = true;
    const s = st;
    const surv = [0, 1].map((side) => {
      const cnt = U.zeroUnits();
      s.units.forEach((u) => { if (!u.dead && u.side === side) cnt[u.type]++; });
      const out = U.zeroUnits();
      U.TYPES.forEach((t) => {
        const orig = s.orig[side][t], bc = s.bcount[side][t];
        if (!bc) return;
        let v = Math.round(cnt[t] * orig / bc);
        if (outcome === 'retreat' && side === 0) v = Math.floor(v * 0.85);
        out[t] = Math.min(orig, v);
      });
      return out;
    });
    const winnerSide = outcome === 'win' ? 0 : 1;
    const playerIsAtt = s.cfg.playerSide === 'attacker';
    const attSide = playerIsAtt ? 0 : 1;
    const result = {
      winner: winnerSide === attSide ? 'attacker' : 'defender',
      attSurv: surv[attSide], defSurv: surv[1 - attSide],
      retreated: outcome === 'retreat' ? s.cfg.playerSide : null,
      tactical: true,
    };
    const loss = (side) => {
      const o = s.orig[side], v = surv[side];
      const parts = U.TYPES.filter((t) => o[t] > 0).map((t) => `${LOL.config.unitShort[t]} <b>${o[t] - v[t]}</b>/${o[t]}`);
      return `<td>${parts.join(' · ') || '—'}</td>`;
    };
    const title = outcome === 'win' ? 'ZAFER!' : outcome === 'retreat' ? 'GERİ ÇEKİLDİN' : 'YENİLGİ';
    LOL.audio.play(outcome === 'win' ? 'victory' : 'defeat');
    LOL.audio.ambience(false);
    LOL.audio.weather(null);
    LOL.audio.music('strategy');
    const body = `<p style="text-align:center">${U.esc(s.cfg.provinceName)} muharebesi ${outcome === 'win' ? 'kazanıldı' : 'kaybedildi'}. Süre: ${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}</p>
      <table><tr><th>Taraf</th><th>Kayıplar (kayıp/toplam)</th></tr>
      <tr><td>${LOL.ui.flag(s.sideNation[0], 14)}${U.esc(s.sideName[0])}</td>${loss(0)}</tr>
      <tr><td>${LOL.ui.flag(s.sideNation[1], 14)}${U.esc(s.sideName[1])}</td>${loss(1)}</tr></table>`;
    setTimeout(() => {
      LOL.ui.modal(title, body, [{ label: 'Haritaya Dön', value: 1, cls: 'primary' }], { cls: outcome === 'win' ? 'win' : 'lose' }).then(() => {
        st = null;
        U.el('battle-banner').classList.remove('show');
        s.resolve(result);
      });
    }, 300);
  }

  B.isActive = () => !!st;
  B.debug = () => ({ st, issueMove, alive });
})();
