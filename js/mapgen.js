'use strict';
(function () {
  // ======================================================================
  //  Map generation
  //   - generate(seed, n): fantasy world (heightmap, biomes, rivers, relief)
  //   - generateWorld(seed): real world 1936-style map from country borders
  // ======================================================================
  const U = LOL.util;
  let W = 1000, H = 620, N = W * H;
  const setSize = (w, h) => { W = w; H = h; N = w * h; };

  const SYL1 = ['Kar', 'Val', 'Ost', 'Bel', 'Mor', 'Zan', 'Tir', 'Ves', 'Dor', 'Ast', 'Gal', 'Hel', 'Iz', 'Lor', 'Nor', 'Rav', 'Sel', 'Tor', 'Ul', 'Var', 'Eld', 'Bran', 'Cor', 'Fen', 'Kel', 'Mar', 'Pel', 'Sar', 'Tal', 'Zer', 'Ak', 'Bor', 'Ere', 'Gor', 'Kuz', 'Ner'];
  const SYL2 = ['an', 'or', 'ia', 'en', 'ul', 'ar', 'os', 'eth', 'ik', 'um', 'ir', 'ad', 'esh', 'ova', 'ira', 'und', 'ak', 'em', 'ay', 'in'];
  const SYL3 = ['', '', '', 'ya', 'burg', 'grad', 'stan', 'heim', 'ova', 'port', 'dor', 'mark', 'iye', 'kale', 'vik', 'abad', 'lar'];

  const NATIONS = [
    { name: 'Valoria', color: '#4f7fe0' }, { name: 'Karsland', color: '#d23c3c' }, { name: 'Ostmark', color: '#e3b53b' },
    { name: 'Drakonya', color: '#3fae5a' }, { name: 'Sylvaria', color: '#9b59c9' }, { name: 'Aurelia', color: '#e57d30' },
    { name: 'Novgard', color: '#2fb8b0' }, { name: 'Zephyra', color: '#d0569a' }, { name: 'Tirakya', color: '#9aa03a' },
    { name: 'Marvenia', color: '#8d6440' },
  ];
  // Biome palette (index -> name, colour)
  const BIOMES = [
    ['Deniz', '#466eab'], ['Sıcak Çöl', '#fbe79f'], ['Soğuk Çöl', '#b5b887'], ['Savan', '#d2d082'], ['Çayır', '#c8d68f'],
    ['Tropik Orman', '#b6d95d'], ['Ilıman Orman', '#29bc56'], ['Yağmur Ormanı', '#7dcb35'], ['Ilıman Yağmur Ormanı', '#409c43'],
    ['Tayga', '#4b6b32'], ['Tundra', '#96784b'], ['Buzul', '#d5e7eb'], ['Sulak Alan', '#0b9131'],
  ];
  const BIOME_RGB = BIOMES.map((b) => U.hexToRgb(b[1]));
  const PALETTE = ['#c94c4c', '#4f7fe0', '#e3b53b', '#3fae5a', '#9b59c9', '#e57d30', '#2fb8b0', '#d0569a', '#9aa03a', '#8d6440',
    '#5c6bc0', '#c0a060', '#7cb342', '#ef6c8a', '#4db6ac', '#a1887f', '#f06292', '#ba68c8', '#4fc3f7', '#ffb74d', '#aed581', '#90a4ae'];

  function provName(rng, used) {
    for (let t = 0; t < 60; t++) {
      const n = rng.pick(SYL1) + rng.pick(SYL2) + rng.pick(SYL3);
      if (!used.has(n) && n.length <= 13) { used.add(n); return n; }
    }
    return 'Bölge ' + used.size;
  }
  const nb4 = (j) => { const x = j % W; return [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j >= W ? j - W : -1, j < N - W ? j + W : -1]; };

  function biomeOf(t, m, e) {
    if (t < 0.1) return 11;
    if (t < 0.24) return 10;
    if (t < 0.38) return m > 0.33 ? 9 : 2;
    if (t < 0.68) return m < 0.25 ? 2 : m < 0.45 ? 4 : m < 0.72 ? 6 : 8;
    if (m < 0.22) return 1;
    if (m < 0.4) return 3;
    if (m < 0.66) return 5;
    return 7;
  }

  // ---------------------------------------------------------------- shared steps
  function labelComponents(land) {
    const comp = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    const comps = [];
    for (let i = 0; i < N; i++) {
      if (!land[i] || comp[i] >= 0) continue;
      const id = comps.length;
      let sp = 0, size = 0;
      stack[sp++] = i; comp[i] = id;
      while (sp) {
        const j = stack[--sp]; size++;
        for (const k of nb4(j)) if (k >= 0 && land[k] && comp[k] < 0) { comp[k] = id; stack[sp++] = k; }
      }
      comps.push({ id, size });
    }
    return { comp, comps, stack };
  }

  function buildProvinces(pid, comp, P, rng, names) {
    // distance to border -> label points
    const dist = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = pid[i];
      if (p < 0) { dist[i] = 0; continue; }
      const x = i % W;
      const border = x === 0 || x === W - 1 || i < W || i >= N - W || pid[i - 1] !== p || pid[i + 1] !== p || pid[i - W] !== p || pid[i + W] !== p;
      dist[i] = border ? 0 : 1e6;
    }
    for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - W] + 1, dist[i - W - 1] + 1.414, dist[i - W + 1] + 1.414);
    }
    for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x >= 1; x--) {
      const i = y * W + x;
      if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + W] + 1, dist[i + W + 1] + 1.414, dist[i + W - 1] + 1.414);
    }
    const used = new Set();
    const provinces = [];
    for (let k = 0; k < P; k++) {
      provinces.push({ id: k, name: names ? names[k] : provName(rng, used), cx: 0, cy: 0, best: -1, size: 0, neighbors: [], naval: [], comp: -1,
        income: 0, owner: -1, isCapital: false, units: U.zeroUnits(), ready: U.zeroUnits() });
    }
    for (let i = 0; i < N; i++) {
      const p = pid[i];
      if (p < 0) continue;
      const pr = provinces[p];
      pr.size++;
      if (dist[i] > pr.best) { pr.best = dist[i]; pr.cx = i % W; pr.cy = (i / W) | 0; pr.comp = comp[i]; }
    }
    // adjacency
    const adj = new Map();
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x, a = pid[i];
      if (a < 0) continue;
      const r = pid[i + 1], d = pid[i + W];
      if (r >= 0 && r !== a) { const key = Math.min(a, r) * 8192 + Math.max(a, r); adj.set(key, (adj.get(key) || 0) + 1); }
      if (d >= 0 && d !== a) { const key = Math.min(a, d) * 8192 + Math.max(a, d); adj.set(key, (adj.get(key) || 0) + 1); }
    }
    for (const [key, c] of adj) {
      if (c < 3) continue;
      const a = Math.floor(key / 8192), b = key % 8192;
      provinces[a].neighbors.push(b); provinces[b].neighbors.push(a);
    }
    return provinces;
  }

  function navalLinks(provinces, maxExtra, maxNaval) {
    const links = [];
    const parent = provinces.map((p) => p.id);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    provinces.forEach((p) => p.neighbors.forEach((q) => { parent[find(p.id)] = find(q); }));
    const addLink = (a, b) => {
      if (provinces[a].neighbors.includes(b)) return;
      provinces[a].neighbors.push(b); provinces[b].neighbors.push(a);
      provinces[a].naval.push(b); provinces[b].naval.push(a);
      links.push([a, b]);
      parent[find(a)] = find(b);
    };
    for (let guard = 0; guard < 300; guard++) {
      const groups = {};
      provinces.forEach((p) => { const r = find(p.id); (groups[r] = groups[r] || []).push(p); });
      const gl = Object.values(groups);
      if (gl.length <= 1) break;
      const g = gl.sort((a, b) => a.length - b.length)[0];
      let best = null, bd = 1e18;
      for (const a of g) for (const b of provinces) {
        if (find(b.id) === find(a.id)) continue;
        const d = (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
        if (d < bd) { bd = d; best = [a.id, b.id]; }
      }
      if (best) addLink(best[0], best[1]);
    }
    for (let a = 0; a < provinces.length; a++) for (let b = a + 1; b < provinces.length; b++) {
      const pa = provinces[a], pb = provinces[b];
      if (pa.comp === pb.comp) continue;
      const d = Math.hypot(pa.cx - pb.cx, pa.cy - pb.cy);
      if (d < maxExtra && pa.naval.length < maxNaval && pb.naval.length < maxNaval) addLink(a, b);
    }
    return links;
  }

  function renderHelpers(pid, nzT) {
    const seaDepth = new Uint8Array(N);
    const q = new Int32Array(N);
    let h = 0, t = 0;
    const dd = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (pid[i] >= 0) { dd[i] = 0; q[t++] = i; }
    while (h < t) {
      const j = q[h++];
      const dj = dd[j];
      if (dj >= 70) continue;
      for (const k of nb4(j)) if (k >= 0 && dd[k] < 0) { dd[k] = dj + 1; q[t++] = k; }
    }
    for (let i = 0; i < N; i++) seaDepth[i] = dd[i] < 0 ? 70 : dd[i];
    const nbPid = new Int16Array(N).fill(-1);
    const coast = new Uint8Array(N);
    const seaNoise = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const p = pid[i];
      if (p < 0) { const x = i % W, y = (i / W) | 0; seaNoise[i] = Math.round(nzT.fbm(x / 30, y / 30, 3) * 255); continue; }
      for (const k of nb4(i)) {
        if (k < 0 || pid[k] < 0) { coast[i] = 1; continue; }
        if (pid[k] !== p) nbPid[i] = pid[k];
      }
    }
    return { seaDepth, nbPid, coast, seaNoise };
  }

  function finishProvinces(provinces, pid, coast, nbPid, biome, elev, rng) {
    const P = provinces.length;
    const coastCnt = new Int32Array(P);
    const borderLists = provinces.map(() => []);
    const bc = provinces.map(() => new Int32Array(BIOMES.length));
    const esum = new Float32Array(P);
    for (let i = 0; i < N; i++) {
      const p = pid[i];
      if (p < 0) continue;
      if (coast[i]) coastCnt[p]++;
      if (coast[i] || nbPid[i] >= 0) borderLists[p].push(i);
      bc[p][biome[i]]++;
      esum[p] += elev[i];
    }
    provinces.forEach((p) => {
      p.borderPix = Int32Array.from(borderLists[p.id]);
      p.coastal = coastCnt[p.id] > 15;
      let bb = 0;
      for (let k = 1; k < BIOMES.length; k++) if (bc[p.id][k] > bc[p.id][bb]) bb = k;
      p.biome = bb;
      const me = esum[p.id] / Math.max(1, p.size);
      const forest = [5, 6, 7, 8, 9].includes(bb);
      p.terrain = me > 0.5 ? 'Tepelik' : bb === 1 || bb === 2 ? 'Çöl' : bb === 10 || bb === 11 ? 'Tundra' : forest && rng.chance(0.7) ? 'Ormanlık' : (p.coastal && rng.chance(0.5)) ? 'Kıyı' : 'Ova';
      p.pop = Math.max(5, Math.round(p.size / 45 * rng.range(0.7, 1.3) * (p.isCapital ? 1.6 : 1) * (bb === 1 || bb === 11 || bb === 10 ? 0.35 : 1)));
      p.buildings = { fac: p.isCapital ? 1 : 0, fort: p.isCapital ? 1 : 0, bar: 0 };
      p.queue = null;
      p.income = U.clamp(Math.round(2 + Math.min(4, p.pop / 30) + rng.int(0, 1)), 1, 8);
      const g = p.isCapital ? 6 : rng.int(2, 4);
      p.units = U.zeroUnits();
      p.units.inf = g;
      if (p.isCapital) { p.units.tank = 2; p.units.art = 1; p.units.mg = 1; } else if (rng.chance(0.25)) p.units.tank = 1;
      p.ready = U.copyUnits(p.units);
    });
  }

  // Draw rivers, relief icons and towns into a hi-res overlay canvas
  function drawOverlay(map, scale) {
    const c = document.createElement('canvas');
    c.width = map.W * scale; c.height = map.H * scale;
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of map.rivers) {
      for (let i = 1; i < r.length; i++) {
        const w = 0.35 + Math.min(1.8, (i / r.length) * 1.6 + r.flow * 0.02);
        g.strokeStyle = 'rgba(66,110,170,0.9)'; g.lineWidth = w;
        g.beginPath(); g.moveTo(r[i - 1][0], r[i - 1][1]); g.lineTo(r[i][0], r[i][1]); g.stroke();
      }
    }
    for (const ic of map.relief) {
      const { x, y, s } = ic;
      if (ic.t === 'mount') {
        g.fillStyle = 'rgba(120,96,70,0.95)';
        g.beginPath(); g.moveTo(x - 5 * s, y); g.lineTo(x - 0.5 * s, y - 7 * s); g.lineTo(x + 5 * s, y); g.closePath(); g.fill();
        g.fillStyle = 'rgba(80,60,45,0.9)';
        g.beginPath(); g.moveTo(x - 0.5 * s, y - 7 * s); g.lineTo(x + 5 * s, y); g.lineTo(x + 1 * s, y); g.closePath(); g.fill();
        if (s > 1.1) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(x - 2 * s, y - 4.6 * s); g.lineTo(x - 0.5 * s, y - 7 * s); g.lineTo(x + 1.5 * s, y - 4.8 * s); g.closePath(); g.fill(); }
        g.strokeStyle = 'rgba(50,35,25,0.6)'; g.lineWidth = 0.35;
        g.beginPath(); g.moveTo(x - 5 * s, y); g.lineTo(x - 0.5 * s, y - 7 * s); g.lineTo(x + 5 * s, y); g.stroke();
      } else if (ic.t === 'tree' || ic.t === 'conifer' || ic.t === 'palm') {
        g.strokeStyle = 'rgba(60,40,20,0.8)'; g.lineWidth = 0.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 2 * s); g.stroke();
        if (ic.t === 'conifer') {
          g.fillStyle = 'rgba(35,70,35,0.85)';
          g.beginPath(); g.moveTo(x - 2 * s, y - 1.5 * s); g.lineTo(x, y - 6 * s); g.lineTo(x + 2 * s, y - 1.5 * s); g.closePath(); g.fill();
        } else if (ic.t === 'palm') {
          g.strokeStyle = 'rgba(50,110,40,0.9)'; g.lineWidth = 0.6;
          for (const a of [-2.4, -1.6, -0.8, -0.2]) { g.beginPath(); g.moveTo(x, y - 3 * s); g.lineTo(x + Math.cos(a) * 2.5 * s, y - 3 * s + Math.sin(a) * 1.5 * s + 1); g.stroke(); }
        } else {
          g.fillStyle = 'rgba(40,95,40,0.85)';
          g.beginPath(); g.arc(x, y - 3.2 * s, 1.9 * s, 0, 7); g.fill();
          g.fillStyle = 'rgba(120,180,90,0.5)';
          g.beginPath(); g.arc(x - 0.6 * s, y - 3.8 * s, 0.8 * s, 0, 7); g.fill();
        }
      } else if (ic.t === 'dune') {
        g.strokeStyle = 'rgba(170,140,70,0.75)'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(x - 4 * s, y); g.quadraticCurveTo(x - 1 * s, y - 2.5 * s, x + 3 * s, y); g.stroke();
      } else if (ic.t === 'grass') {
        g.strokeStyle = 'rgba(90,110,50,0.6)'; g.lineWidth = 0.4;
        g.beginPath(); g.moveTo(x - 1.2, y); g.lineTo(x - 1.6, y - 2); g.moveTo(x, y); g.lineTo(x, y - 2.6); g.moveTo(x + 1.2, y); g.lineTo(x + 1.6, y - 2); g.stroke();
      }
    }
    return c;
  }

  function reliefIcons(pid, biome, elev, rng, mountains) {
    const icons = [];
    const step = 8;
    for (let y = step; y < H - 4; y += step) for (let x = step / 2; x < W - 4; x += step) {
      const px = Math.round(x + rng.range(-3, 3)), py = Math.round(y + rng.range(-3, 3));
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const i = py * W + px;
      if (pid[i] < 0) continue;
      const e = elev[i], b = biome[i];
      if (mountains && e > 0.52 && rng.chance(0.75)) icons.push({ t: 'mount', x: px, y: py, s: 0.75 + (e - 0.5) * 1.6 });
      else if ((b === 6 || b === 8 || b === 5 || b === 7) && rng.chance(0.55)) icons.push({ t: b === 7 ? 'palm' : 'tree', x: px, y: py, s: 0.8 + rng.next() * 0.3 });
      else if (b === 9 && rng.chance(0.6)) icons.push({ t: 'conifer', x: px, y: py, s: 0.85 + rng.next() * 0.3 });
      else if (b === 1 && rng.chance(0.3)) icons.push({ t: 'dune', x: px, y: py, s: 0.9 });
      else if ((b === 3 || b === 4) && rng.chance(0.15)) icons.push({ t: 'grass', x: px, y: py, s: 1 });
    }
    icons.sort((a, b) => a.y - b.y);
    return icons;
  }

  // ======================================================================
  //  Fantasy world
  // ======================================================================
  function generate(seed, nNations) {
    setSize(1100, 680);
    const rng = U.rng(seed * 9973 + 17);
    const nz = U.noise(seed + 11), nzA = U.noise(seed + 23), nzB = U.noise(seed + 37), nzT = U.noise(seed + 51), nzM = U.noise(seed + 63), nzR = U.noise(seed + 81);

    const val = new Float32Array(N);
    const blobs = [];
    const nb = rng.int(3, 5);
    for (let i = 0; i < nb; i++) blobs.push({ x: rng.range(0.2, 0.8) * W, y: rng.range(0.22, 0.78) * H, r: rng.range(0.2, 0.34) * W });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let m = 0;
      for (const b of blobs) {
        const dx = x - b.x, dy = (y - b.y) * 1.35;
        const d = 1 - Math.sqrt(dx * dx + dy * dy) / b.r;
        if (d > m) m = d;
      }
      const e = nz.fbm(x / 160, y / 160, 6);
      // ridged noise for mountain chains
      const r = 1 - Math.abs(nzR.fbm(x / 110, y / 110, 4) * 2 - 1);
      const edge = Math.min(x, W - 1 - x, y, H - 1 - y) / 80;
      let v = m * 0.8 + e * 1.0 + Math.pow(r, 4) * 0.25 * Math.max(0, m);
      if (edge < 1) v -= (1 - edge) * 1.2;
      val[y * W + x] = v;
    }
    const sample = [];
    for (let i = 0; i < N; i += 37) sample.push(val[i]);
    sample.sort((a, b) => a - b);
    const thr = sample[Math.floor(sample.length * 0.56)], vmax = sample[sample.length - 1];
    const land = new Uint8Array(N);
    for (let i = 0; i < N; i++) land[i] = val[i] > thr ? 1 : 0;

    let { comp, comps, stack } = labelComponents(land);
    const MINC = 1500;
    for (let i = 0; i < N; i++) if (land[i] && comps[comp[i]].size < MINC) { land[i] = 0; comp[i] = -1; }
    const elev = new Float32Array(N);
    for (let i = 0; i < N; i++) elev[i] = land[i] ? U.clamp((val[i] - thr) / (vmax - thr), 0, 1) : 0;

    // biomes
    const biome = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const x = i % W, y = (i / W) | 0;
      const lat = Math.abs(y / H - 0.5) * 2;
      const t = U.clamp(1.05 - lat * 0.95 - elev[i] * 0.55 + (nzT.fbm(x / 90, y / 90, 3) - 0.5) * 0.3, 0, 1);
      const m = U.clamp(nzM.fbm(x / 120, y / 120, 4) * 1.4 - 0.2, 0, 1);
      biome[i] = biomeOf(t, m, elev[i]);
    }

    const landIdx = [];
    for (let i = 0; i < N; i++) if (land[i]) landIdx.push(i);
    const minD = 54;
    const seeds = [];
    for (let t = 0; t < 40000 && seeds.length < 130; t++) {
      const i = landIdx[Math.floor(rng.next() * landIdx.length)];
      const x = i % W, y = (i / W) | 0;
      let ok = true;
      for (const s of seeds) { const dx = s.x - x, dy = s.y - y; if (dx * dx + dy * dy < minD * minD) { ok = false; break; } }
      if (ok) seeds.push({ x, y, comp: comp[i] });
    }
    const hasSeed = new Set(seeds.map((s) => s.comp));
    for (const c of comps) {
      if (c.size < MINC || hasSeed.has(c.id)) continue;
      const pix = landIdx.filter((i) => comp[i] === c.id);
      const i = pix[pix.length >> 1];
      seeds.push({ x: i % W, y: (i / W) | 0, comp: c.id });
    }
    const pid = new Int16Array(N).fill(-1);
    const byComp = {};
    seeds.forEach((s, k) => { (byComp[s.comp] = byComp[s.comp] || []).push(k); });
    for (const i of landIdx) {
      const x = i % W, y = (i / W) | 0;
      const jx = x + (nzA.fbm(x / 40, y / 40, 3) - 0.5) * 90, jy = y + (nzB.fbm(x / 40, y / 40, 3) - 0.5) * 90;
      const list = byComp[comp[i]];
      let best = -1, bd = 1e18;
      for (const k of list) { const s = seeds[k]; const d = (s.x - jx) ** 2 + (s.y - jy) ** 2; if (d < bd) { bd = d; best = k; } }
      pid[i] = best;
    }
    removeFragments(pid, stack);
    mergeSmall(pid, seeds.length, 700);
    removeFragments(pid, stack);
    const sizes = new Int32Array(seeds.length);
    for (let i = 0; i < N; i++) if (pid[i] >= 0) sizes[pid[i]]++;
    const remap = new Int16Array(seeds.length).fill(-1);
    let P = 0;
    for (let k = 0; k < seeds.length; k++) if (sizes[k] > 0) remap[k] = P++;
    for (let i = 0; i < N; i++) if (pid[i] >= 0) pid[i] = remap[pid[i]];

    const provinces = buildProvinces(pid, comp, P, rng);
    const links = navalLinks(provinces, 115, 2);
    const helpers = renderHelpers(pid, nzT);

    // nations
    const nations = [];
    const pool = U.rng(seed + 99).shuffle(NATIONS.slice());
    for (let k = 0; k < nNations; k++) nations.push({ id: k, name: pool[k].name, color: pool[k].color, gold: LOL.config.startGold, alive: true, capital: -1 });
    const caps = [];
    const big = provinces.filter((p) => p.neighbors.length >= 2);
    caps.push(rng.pick(big.length ? big : provinces).id);
    while (caps.length < nNations) {
      let best = -1, bd = -1;
      for (const p of provinces) {
        if (caps.includes(p.id) || p.neighbors.length < 2) continue;
        let md = 1e18;
        for (const c of caps) md = Math.min(md, Math.hypot(p.cx - provinces[c].cx, p.cy - provinces[c].cy));
        md *= 0.85 + rng.next() * 0.3;
        if (md > bd) { bd = md; best = p.id; }
      }
      if (best < 0) break;
      caps.push(best);
    }
    caps.forEach((c, k) => { provinces[c].owner = k; provinces[c].isCapital = true; nations[k].capital = c; });
    let progress = true;
    while (progress) {
      progress = false;
      for (const n of nations) {
        const cap = provinces[n.capital];
        if (!cap) continue;
        let best = null, bd = 1e18;
        for (const p of provinces) {
          if (p.owner !== n.id) continue;
          for (const q of p.neighbors) {
            const pq = provinces[q];
            if (pq.owner !== -1) continue;
            const d = Math.hypot(pq.cx - cap.cx, pq.cy - cap.cy) * (0.8 + rng.next() * 0.4);
            if (d < bd) { bd = d; best = pq; }
          }
        }
        if (best) { best.owner = n.id; progress = true; }
      }
    }
    provinces.forEach((p) => { if (p.owner < 0) p.owner = 0; });
    finishProvinces(provinces, pid, helpers.coast, helpers.nbPid, biome, elev, rng);

    // rivers: steepest descent on a coarse grid
    const rivers = [];
    {
      const cs = 4, gw = Math.floor(W / cs), gh = Math.floor(H / cs);
      const ge = new Float32Array(gw * gh), gl = new Uint8Array(gw * gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = (y * cs + 2) * W + x * cs + 2;
        ge[y * gw + x] = land[i] ? elev[i] + nzA.n2(x / 3, y / 3) * 0.02 : -1;
        gl[y * gw + x] = land[i];
      }
      const visited = new Uint8Array(gw * gh);
      for (let s = 0; s < 400 && rivers.length < 45; s++) {
        let x = rng.int(1, gw - 2), y = rng.int(1, gh - 2);
        if (!gl[y * gw + x] || ge[y * gw + x] < 0.35) continue;
        const pts = [];
        let flow = 0;
        for (let step = 0; step < 300; step++) {
          const ci = y * gw + x;
          pts.push([x * cs + 2 + rng.range(-1, 1), y * cs + 2 + rng.range(-1, 1)]);
          if (visited[ci]) { flow += 10; break; }
          visited[ci] = 1;
          if (!gl[ci]) break;
          let bx = -1, by = -1, be = ge[ci];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            const e = ge[ny * gw + nx];
            if (e < be) { be = e; bx = nx; by = ny; }
          }
          if (bx < 0) break;
          x = bx; y = by;
        }
        if (pts.length > 9) { pts.flow = flow; rivers.push(pts); }
      }
    }
    const relief = reliefIcons(pid, biome, elev, rng, true);
    const map = { kind: 'fantasy', W, H, pid, provinces, links, nations, biome, elev, rivers, relief, ...helpers };
    map.overlay = drawOverlay(map, 2);
    return map;
  }

  // ======================================================================
  //  Real world
  // ======================================================================
  const SKIP = new Set(['Antarctica', 'Siachen Glacier', 'Fr. S. Antarctic Lands', 'S. Geo. and the Is.', 'Åland', 'Faeroe Is.', 'Fr. Polynesia']);
  const DIRS = ['Doğu', 'Kuzeydoğu', 'Kuzey', 'Kuzeybatı', 'Batı', 'Güneybatı', 'Güney', 'Güneydoğu'];

  function generateWorld(seed) {
    const info = LOL.WORLD_INFO || {};
    const LAT_N = 83, LAT_S = -56;
    const Wd = 1600;
    const sc = Wd / (2 * Math.PI);
    const my = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * Math.PI / 180));
    const yTop = my(LAT_N), yBot = my(LAT_S);
    setSize(Wd, Math.round((yTop - yBot) * sc));
    const proj = (lon, lat) => [(lon + 180) / 360 * W, (yTop - my(Math.max(LAT_S, Math.min(LAT_N, lat)))) * sc];
    const rng = U.rng(seed * 7919 + 3);
    const nzA = U.noise(seed + 23), nzB = U.noise(seed + 37), nzT = U.noise(seed + 51), nzM = U.noise(seed + 63), nzE = U.noise(seed + 5);

    const countries = LOL.WORLD.filter((c) => !SKIP.has(c.n));
    const cid = new Int16Array(N).fill(-1);
    // scanline polygon fill (even-odd per polygon)
    countries.forEach((c, ci) => {
      for (const poly of c.p) {
        // unwrap longitudes so rings crossing the antimeridian stay continuous
        const rings = poly.map((flat) => {
          const pts = [];
          let prev = null;
          for (let i = 0; i < flat.length; i += 2) {
            let lon = flat[i];
            if (prev != null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; }
            prev = lon;
            const [px, py] = proj(lon, flat[i + 1]);
            pts.push([px, py]);
          }
          return pts;
        });
        let miny = 1e9, maxy = -1e9;
        rings[0].forEach(([, y]) => { miny = Math.min(miny, y); maxy = Math.max(maxy, y); });
        for (let y = Math.max(0, Math.floor(miny)); y <= Math.min(H - 1, Math.ceil(maxy)); y++) {
          const yc = y + 0.5, xs = [];
          for (const r of rings) {
            for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
              const [x1, y1] = r[j], [x2, y2] = r[i];
              if ((y1 > yc) !== (y2 > yc)) xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
            }
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const a = Math.max(-W, Math.round(xs[k])), b = Math.min(2 * W - 1, Math.round(xs[k + 1]) - 1);
            for (let x = a; x <= b; x++) cid[y * W + ((x % W) + W) % W] = ci;
          }
        }
      }
    });
    const csize = new Int32Array(countries.length);
    for (let i = 0; i < N; i++) if (cid[i] >= 0) csize[cid[i]]++;
    const keep = countries.map((c, i) => csize[i] >= 20);
    for (let i = 0; i < N; i++) if (cid[i] >= 0 && !keep[cid[i]]) cid[i] = -1;
    const land = new Uint8Array(N);
    for (let i = 0; i < N; i++) land[i] = cid[i] >= 0 ? 1 : 0;
    const { comp } = labelComponents(land);

    // pseudo elevation (shading only) & biomes from latitude + moisture
    const elev = new Float32Array(N), biome = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const x = i % W, y = (i / W) | 0;
      elev[i] = nzE.fbm(x / 60, y / 60, 4) * 0.45;
      const lon = x / W * 360 - 180;
      // invert Miller for latitude
      const yy = yTop - y / sc;
      const lat = (Math.atan(Math.exp(yy / 1.25)) - Math.PI / 4) / 0.4 * 180 / Math.PI;
      const al = Math.abs(lat);
      const t = U.clamp(1.08 - al / 72 + (nzT.fbm(x / 70, y / 70, 3) - 0.5) * 0.18, 0, 1);
      let m = nzM.fbm(x / 80, y / 80, 4);
      // dry subtropical belts and big deserts
      if (al > 14 && al < 34) m -= 0.28;
      if (lon > -17 && lon < 60 && lat > 14 && lat < 35) m -= 0.35; // Sahara/Arabia
      if (lon > 112 && lon < 145 && lat < -18 && lat > -33) m -= 0.3; // Australia
      if (lon > 55 && lon < 115 && lat > 36 && lat < 48) m -= 0.25; // Central Asia
      if (al < 10) m += 0.25;
      biome[i] = biomeOf(t, U.clamp(m * 1.3 - 0.1, 0, 1), elev[i]);
    }

    // provinces inside each country
    const nations = [];
    const natOf = new Int16Array(countries.length).fill(-1);
    countries.forEach((c, ci) => {
      if (!keep[ci]) return;
      const inf = info[c.n] || {};
      natOf[ci] = nations.length;
      nations.push({ id: nations.length, name: inf.tr || c.n, en: c.n, color: '#888', flagSpec: inf.flag || null, gold: LOL.config.startGold, alive: true, capital: -1, capLonLat: inf.cap || null });
    });
    const pixByC = countries.map(() => []);
    for (let i = 0; i < N; i++) if (cid[i] >= 0) pixByC[cid[i]].push(i);
    let seeds = []; // {x,y,c}
    countries.forEach((c, ci) => {
      if (!keep[ci]) return;
      const pix = pixByC[ci];
      const area = pix.length;
      const k = U.clamp(Math.round(Math.pow(area, 0.6) / 19), 1, 26);
      const minD = Math.sqrt(area / k) * 0.75;
      const local = [];
      const cap = nations[natOf[ci]].capLonLat;
      if (cap) {
        const [px, py] = proj(cap[0], cap[1]);
        const xi = Math.round(px), yi = Math.round(py);
        if (xi >= 0 && yi >= 0 && xi < W && yi < H && cid[yi * W + xi] === ci) local.push({ x: xi, y: yi, c: ci, cap: true });
      }
      for (let t = 0; t < 3000 && local.length < k; t++) {
        const i = pix[Math.floor(rng.next() * area)];
        const x = i % W, y = (i / W) | 0;
        if (local.every((s) => (s.x - x) ** 2 + (s.y - y) ** 2 >= minD * minD)) local.push({ x, y, c: ci });
      }
      if (!local.length) { const i = pix[area >> 1]; local.push({ x: i % W, y: (i / W) | 0, c: ci }); }
      local.forEach((s) => seeds.push(s));
    });
    let seedsByC = countries.map(() => []);
    seeds.forEach((s, k) => seedsByC[s.c].push(k));
    const pid = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      const ci = cid[i];
      if (ci < 0) continue;
      const list = seedsByC[ci];
      if (list.length === 1) { pid[i] = list[0]; continue; }
      const x = i % W, y = (i / W) | 0;
      const jx = x + (nzA.fbm(x / 25, y / 25, 3) - 0.5) * 40, jy = y + (nzB.fbm(x / 25, y / 25, 3) - 0.5) * 40;
      let best = -1, bd = 1e18;
      for (const k of list) { const s = seeds[k]; const d = (s.x - jx) ** 2 + (s.y - jy) ** 2; if (d < bd) { bd = d; best = k; } }
      pid[i] = best;
    }
    // drop seeds that ended up with no pixels
    {
      const ssz = new Int32Array(seeds.length);
      for (let i = 0; i < N; i++) if (pid[i] >= 0) ssz[pid[i]]++;
      const rm = new Int16Array(seeds.length).fill(-1), s2 = [];
      seeds.forEach((s, k) => { if (ssz[k] > 0) { rm[k] = s2.length; s2.push(s); } });
      for (let i = 0; i < N; i++) if (pid[i] >= 0) pid[i] = rm[pid[i]];
      seeds = s2;
      seedsByC = countries.map(() => []);
      seeds.forEach((s, k) => seedsByC[s.c].push(k));
    }
    // province names: country + direction
    const names = seeds.map((s) => {
      const nat = nations[natOf[s.c]];
      const list = seedsByC[s.c];
      if (list.length === 1) return nat.name;
      let cx = 0, cy = 0;
      list.forEach((k) => { cx += seeds[k].x; cy += seeds[k].y; });
      cx /= list.length; cy /= list.length;
      const dx = s.x - cx, dy = s.y - cy;
      if (s.cap || Math.hypot(dx, dy) < Math.sqrt(csize[s.c] / list.length) * 0.35) return 'Orta ' + nat.name;
      const a = Math.atan2(-dy, dx);
      return DIRS[(Math.round(a / (Math.PI / 4)) + 8) % 8] + ' ' + nat.name;
    });
    const usedN = {};
    for (let k = 0; k < names.length; k++) {
      usedN[names[k]] = (usedN[names[k]] || 0) + 1;
      if (usedN[names[k]] > 1) names[k] = names[k] + ' ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][Math.min(8, usedN[names[k]])];
    }
    const provinces = buildProvinces(pid, comp, seeds.length, rng, names);
    provinces.forEach((p, k) => {
      const s = seeds[k];
      p.owner = natOf[s.c];
      if (s.cap) { p.isCapital = true; nations[p.owner].capital = p.id; }
    });
    nations.forEach((n) => {
      if (n.capital >= 0) return;
      const ps = provinces.filter((p) => p.owner === n.id).sort((a, b) => b.size - a.size);
      if (ps[0]) { ps[0].isCapital = true; n.capital = ps[0].id; }
    });
    // drop provinces with no pixels (seed overwritten)
    const links = navalLinks(provinces, 70, 3);
    const helpers = renderHelpers(pid, nzT);
    finishProvinces(provinces, pid, helpers.coast, helpers.nbPid, biome, elev, rng);
    // greedy colouring so neighbours differ
    const nnb = nations.map(() => new Set());
    provinces.forEach((p) => p.neighbors.forEach((q) => { const a = p.owner, b = provinces[q].owner; if (a !== b) { nnb[a].add(b); nnb[b].add(a); } }));
    const order = nations.slice().sort((a, b) => nnb[b.id].size - nnb[a.id].size);
    for (const n of order) {
      const usedC = new Set([...nnb[n.id]].map((o) => nations[o].color));
      const start = Math.floor(rng.next() * PALETTE.length);
      for (let k = 0; k < PALETTE.length; k++) { const c = PALETTE[(start + k) % PALETTE.length]; if (!usedC.has(c)) { n.color = c; break; } }
    }
    const relief = reliefIcons(pid, biome, elev, rng, false);
    const map = { kind: 'world', W, H, pid, provinces, links, nations, biome, elev, rivers: [], relief, proj, ...helpers };
    map.overlay = drawOverlay(map, 2);
    return map;
  }

  function removeFragments(pid, stack) {
    const vis = new Uint8Array(N);
    const regions = [];
    for (let i = 0; i < N; i++) {
      if (pid[i] < 0 || vis[i]) continue;
      const p = pid[i];
      let sp = 0;
      stack[sp++] = i; vis[i] = 1;
      const pix = [];
      while (sp) {
        const j = stack[--sp];
        pix.push(j);
        for (const k of nb4(j)) if (k >= 0 && !vis[k] && pid[k] === p) { vis[k] = 1; stack[sp++] = k; }
      }
      regions.push({ p, pix });
    }
    const largest = new Map();
    for (const r of regions) { const l = largest.get(r.p); if (!l || r.pix.length > l.pix.length) largest.set(r.p, r); }
    for (const r of regions) {
      if (largest.get(r.p) === r) continue;
      const cnt = new Map();
      for (const j of r.pix) for (const k of nb4(j)) if (k >= 0 && pid[k] >= 0 && pid[k] !== r.p) cnt.set(pid[k], (cnt.get(pid[k]) || 0) + 1);
      let best = -1, bc = 0;
      for (const [k, c] of cnt) if (c > bc) { bc = c; best = k; }
      if (best >= 0) for (const j of r.pix) pid[j] = best;
    }
  }

  function mergeSmall(pid, count, minSize) {
    for (let iter = 0; iter < 3; iter++) {
      const sizes = new Int32Array(count);
      for (let i = 0; i < N; i++) if (pid[i] >= 0) sizes[pid[i]]++;
      const cnt = new Map();
      for (let i = 0; i < N; i++) {
        const p = pid[i];
        if (p < 0 || sizes[p] >= minSize) continue;
        for (const k of nb4(i)) {
          if (k < 0 || pid[k] < 0 || pid[k] === p) continue;
          let m = cnt.get(p);
          if (!m) { m = new Map(); cnt.set(p, m); }
          m.set(pid[k], (m.get(pid[k]) || 0) + 1);
        }
      }
      if (!cnt.size) return;
      const to = new Map();
      for (const [p, m] of cnt) {
        let best = -1, bc = 0;
        for (const [k, c] of m) if (c > bc) { bc = c; best = k; }
        to.set(p, best);
      }
      for (let i = 0; i < N; i++) {
        const p = pid[i];
        if (p >= 0 && to.has(p) && to.get(p) >= 0 && (!to.has(to.get(p)) || to.get(p) < p)) pid[i] = to.get(p);
      }
    }
  }

  LOL.mapgen = { NATIONS, BIOMES, BIOME_RGB, generate, generateWorld };
})();
