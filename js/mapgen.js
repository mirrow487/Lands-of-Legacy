'use strict';
(function () {
  // Procedural world map: continents, organic Voronoi provinces, nations.
  const U = LOL.util;
  const W = 1000, H = 620, N = W * H;

  const SYL1 = ['Kar', 'Val', 'Ost', 'Bel', 'Mor', 'Zan', 'Tir', 'Ves', 'Dor', 'Ast', 'Gal', 'Hel', 'Iz', 'Lor', 'Nor', 'Rav', 'Sel', 'Tor', 'Ul', 'Var', 'Eld', 'Bran', 'Cor', 'Fen', 'Kel', 'Mar', 'Pel', 'Sar', 'Tal', 'Zer', 'Ak', 'Bor', 'Ere', 'Gor', 'Kuz', 'Ner'];
  const SYL2 = ['an', 'or', 'ia', 'en', 'ul', 'ar', 'os', 'eth', 'ik', 'um', 'ir', 'ad', 'esh', 'ova', 'ira', 'und', 'ak', 'em', 'ay', 'in'];
  const SYL3 = ['', '', '', 'ya', 'burg', 'grad', 'stan', 'heim', 'ova', 'port', 'dor', 'mark', 'iye', 'kale', 'vik', 'abad', 'lar'];

  const NATIONS = [
    { name: 'Valoria', color: '#4f7fe0' },
    { name: 'Karsland', color: '#d23c3c' },
    { name: 'Ostmark', color: '#e3b53b' },
    { name: 'Drakonya', color: '#3fae5a' },
    { name: 'Sylvaria', color: '#9b59c9' },
    { name: 'Aurelia', color: '#e57d30' },
    { name: 'Novgard', color: '#2fb8b0' },
    { name: 'Zephyra', color: '#d0569a' },
    { name: 'Tirakya', color: '#9aa03a' },
    { name: 'Marvenia', color: '#8d6440' },
  ];

  function provName(rng, used) {
    for (let t = 0; t < 60; t++) {
      const n = rng.pick(SYL1) + rng.pick(SYL2) + rng.pick(SYL3);
      if (!used.has(n) && n.length <= 13) { used.add(n); return n; }
    }
    return 'Bölge ' + used.size;
  }

  function generate(seed, nNations) {
    const rng = U.rng(seed * 9973 + 17);
    const nz = U.noise(seed + 11), nzA = U.noise(seed + 23), nzB = U.noise(seed + 37), nzT = U.noise(seed + 51);

    // ---------- 1. Land mask ----------
    const val = new Float32Array(N);
    const blobs = [];
    const nb = rng.int(3, 5);
    for (let i = 0; i < nb; i++) blobs.push({ x: rng.range(0.2, 0.8) * W, y: rng.range(0.22, 0.78) * H, r: rng.range(0.2, 0.34) * W });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let m = 0;
        for (let k = 0; k < blobs.length; k++) {
          const b = blobs[k];
          const dx = x - b.x, dy = (y - b.y) * 1.35;
          const d = 1 - Math.sqrt(dx * dx + dy * dy) / b.r;
          if (d > m) m = d;
        }
        const e = nz.fbm(x / 150, y / 150, 5);
        const edge = Math.min(x, W - 1 - x, y, H - 1 - y) / 80;
        let v = m * 0.8 + e * 1.0;
        if (edge < 1) v -= (1 - edge) * 1.2;
        val[y * W + x] = v;
      }
    }
    const sample = [];
    for (let i = 0; i < N; i += 37) sample.push(val[i]);
    sample.sort((a, b) => a - b);
    const thr = sample[Math.floor(sample.length * 0.56)];
    const land = new Uint8Array(N);
    for (let i = 0; i < N; i++) land[i] = val[i] > thr ? 1 : 0;

    // ---------- 2. Land components, drop tiny islands ----------
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
        const x = j % W;
        if (x > 0 && land[j - 1] && comp[j - 1] < 0) { comp[j - 1] = id; stack[sp++] = j - 1; }
        if (x < W - 1 && land[j + 1] && comp[j + 1] < 0) { comp[j + 1] = id; stack[sp++] = j + 1; }
        if (j >= W && land[j - W] && comp[j - W] < 0) { comp[j - W] = id; stack[sp++] = j - W; }
        if (j < N - W && land[j + W] && comp[j + W] < 0) { comp[j + W] = id; stack[sp++] = j + W; }
      }
      comps.push({ id, size });
    }
    const MINC = 1500;
    for (let i = 0; i < N; i++) if (land[i] && comps[comp[i]].size < MINC) { land[i] = 0; comp[i] = -1; }

    const landIdx = [];
    for (let i = 0; i < N; i++) if (land[i]) landIdx.push(i);

    // ---------- 3. Seeds ----------
    const minD = 52;
    const seeds = [];
    for (let t = 0; t < 40000 && seeds.length < 120; t++) {
      const i = landIdx[Math.floor(rng.next() * landIdx.length)];
      const x = i % W, y = (i / W) | 0;
      let ok = true;
      for (let k = 0; k < seeds.length; k++) {
        const dx = seeds[k].x - x, dy = seeds[k].y - y;
        if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
      }
      if (ok) seeds.push({ x, y, comp: comp[i] });
    }
    const hasSeed = new Set(seeds.map((s) => s.comp));
    for (const c of comps) {
      if (c.size < MINC || hasSeed.has(c.id)) continue;
      const pix = landIdx.filter((i) => comp[i] === c.id);
      const i = pix[pix.length >> 1];
      seeds.push({ x: i % W, y: (i / W) | 0, comp: c.id });
    }

    // ---------- 4. Noisy Voronoi assignment ----------
    const pid = new Int16Array(N).fill(-1);
    const byComp = {};
    seeds.forEach((s, k) => { (byComp[s.comp] = byComp[s.comp] || []).push(k); });
    for (let n = 0; n < landIdx.length; n++) {
      const i = landIdx[n];
      const x = i % W, y = (i / W) | 0;
      const jx = x + (nzA.fbm(x / 40, y / 40, 3) - 0.5) * 90;
      const jy = y + (nzB.fbm(x / 40, y / 40, 3) - 0.5) * 90;
      const list = byComp[comp[i]];
      let best = -1, bd = 1e18;
      for (let q = 0; q < list.length; q++) {
        const s = seeds[list[q]];
        const dx = s.x - jx, dy = s.y - jy;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = list[q]; }
      }
      pid[i] = best;
    }

    // ---------- 5. Cleanup: remove fragments, merge tiny provinces ----------
    removeFragments(pid, stack);
    mergeSmall(pid, seeds.length, 700);
    removeFragments(pid, stack);

    // compact ids
    const sizes = new Int32Array(seeds.length);
    for (let i = 0; i < N; i++) if (pid[i] >= 0) sizes[pid[i]]++;
    const remap = new Int16Array(seeds.length).fill(-1);
    let P = 0;
    for (let k = 0; k < seeds.length; k++) if (sizes[k] > 0) remap[k] = P++;
    for (let i = 0; i < N; i++) if (pid[i] >= 0) pid[i] = remap[pid[i]];

    // ---------- 6. Distance-to-border (label points) ----------
    const dist = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = pid[i];
      if (p < 0) { dist[i] = 0; continue; }
      const x = i % W;
      const border = x === 0 || x === W - 1 || i < W || i >= N - W ||
        pid[i - 1] !== p || pid[i + 1] !== p || pid[i - W] !== p || pid[i + W] !== p;
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
      provinces.push({ id: k, name: provName(rng, used), cx: 0, cy: 0, best: -1, size: 0, neighbors: [], naval: [], comp: -1,
        income: 0, owner: -1, isCapital: false, units: U.zeroUnits(), ready: U.zeroUnits() });
    }
    for (let i = 0; i < N; i++) {
      const p = pid[i];
      if (p < 0) continue;
      const pr = provinces[p];
      pr.size++;
      if (dist[i] > pr.best) { pr.best = dist[i]; pr.cx = i % W; pr.cy = (i / W) | 0; pr.comp = comp[i]; }
    }

    // ---------- 7. Adjacency ----------
    const adj = new Map();
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x, a = pid[i];
      if (a < 0) continue;
      const r = pid[i + 1], d = pid[i + W];
      if (r >= 0 && r !== a) { const key = Math.min(a, r) * 4096 + Math.max(a, r); adj.set(key, (adj.get(key) || 0) + 1); }
      if (d >= 0 && d !== a) { const key = Math.min(a, d) * 4096 + Math.max(a, d); adj.set(key, (adj.get(key) || 0) + 1); }
    }
    for (const [key, c] of adj) {
      if (c < 4) continue;
      const a = Math.floor(key / 4096), b = key % 4096;
      provinces[a].neighbors.push(b); provinces[b].neighbors.push(a);
    }

    // ---------- 8. Naval links (connect all landmasses) ----------
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
    for (let guard = 0; guard < 50; guard++) {
      const roots = new Set(provinces.map((p) => find(p.id)));
      if (roots.size <= 1) break;
      // connect the smallest group to its nearest outside province
      const groups = {};
      provinces.forEach((p) => { const r = find(p.id); (groups[r] = groups[r] || []).push(p); });
      const g = Object.values(groups).sort((a, b) => a.length - b.length)[0];
      let best = null, bd = 1e18;
      for (const a of g) for (const b of provinces) {
        if (find(b.id) === find(a.id)) continue;
        const d = (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
        if (d < bd) { bd = d; best = [a.id, b.id]; }
      }
      if (best) addLink(best[0], best[1]);
    }
    for (let a = 0; a < P; a++) for (let b = a + 1; b < P; b++) {
      const pa = provinces[a], pb = provinces[b];
      if (pa.comp === pb.comp) continue;
      const d = Math.hypot(pa.cx - pb.cx, pa.cy - pb.cy);
      if (d < 115 && pa.naval.length < 2 && pb.naval.length < 2) addLink(a, b);
    }

    // ---------- 9. Render helpers ----------
    const seaDepth = new Uint8Array(N);
    {
      const q = new Int32Array(N);
      let h = 0, t = 0;
      const dd = new Int16Array(N).fill(-1);
      for (let i = 0; i < N; i++) if (pid[i] >= 0) { dd[i] = 0; q[t++] = i; }
      while (h < t) {
        const j = q[h++];
        const dj = dd[j];
        if (dj >= 70) continue;
        const x = j % W;
        const nbs = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j >= W ? j - W : -1, j < N - W ? j + W : -1];
        for (const k of nbs) if (k >= 0 && dd[k] < 0) { dd[k] = dj + 1; q[t++] = k; }
      }
      for (let i = 0; i < N; i++) seaDepth[i] = dd[i] < 0 ? 70 : dd[i];
    }
    const shade = new Uint8Array(N);
    const nbPid = new Int16Array(N).fill(-1);
    const coast = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      const p = pid[i];
      if (p < 0) { shade[i] = Math.round(nzT.fbm(x / 30, y / 30, 3) * 255); continue; }
      // relief shading from a height field
      const h1 = nz.fbm(x / 26, y / 26, 4), h2 = nz.fbm((x + 2) / 26, (y + 2) / 26, 4);
      const s = 0.93 + (h1 - h2) * 3.5 + (nzT.fbm(x / 12, y / 12, 2) - 0.5) * 0.08;
      shade[i] = U.clamp(Math.round(s * 128), 0, 255);
      const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1];
      for (const k of nbs) {
        if (k < 0 || pid[k] < 0) { coast[i] = 1; continue; }
        if (pid[k] !== p) nbPid[i] = pid[k];
      }
    }

    // ---------- 10. Nations ----------
    const nations = [];
    const pool = U.rng(seed + 99).shuffle(NATIONS.slice());
    for (let k = 0; k < nNations; k++) {
      nations.push({ id: k, name: pool[k].name, color: pool[k].color, gold: LOL.config.startGold, alive: true, capital: -1 });
    }
    // capitals via farthest-point sampling
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
    // grow territories round-robin
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
    provinces.forEach((p) => {
      if (p.owner < 0) p.owner = 0;
      p.income = U.clamp(2 + Math.floor(p.size / 2600) + rng.int(0, 2), 2, 8);
      const g = p.isCapital ? 6 : rng.int(2, 4);
      p.units = { inf: g, tank: p.isCapital ? 2 : (rng.chance(0.25) ? 1 : 0), art: p.isCapital ? 1 : 0 };
      p.ready = U.copyUnits(p.units);
    });

    return { W, H, pid, provinces, links, seaDepth, shade, nbPid, coast, nations };
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
        const x = j % W;
        if (x > 0 && !vis[j - 1] && pid[j - 1] === p) { vis[j - 1] = 1; stack[sp++] = j - 1; }
        if (x < W - 1 && !vis[j + 1] && pid[j + 1] === p) { vis[j + 1] = 1; stack[sp++] = j + 1; }
        if (j >= W && !vis[j - W] && pid[j - W] === p) { vis[j - W] = 1; stack[sp++] = j - W; }
        if (j < N - W && !vis[j + W] && pid[j + W] === p) { vis[j + W] = 1; stack[sp++] = j + W; }
      }
      regions.push({ p, pix });
    }
    const largest = new Map();
    for (const r of regions) { const l = largest.get(r.p); if (!l || r.pix.length > l.pix.length) largest.set(r.p, r); }
    for (const r of regions) {
      if (largest.get(r.p) === r) continue;
      const cnt = new Map();
      for (const j of r.pix) {
        const x = j % W;
        const nbs = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j >= W ? j - W : -1, j < N - W ? j + W : -1];
        for (const k of nbs) if (k >= 0 && pid[k] >= 0 && pid[k] !== r.p) cnt.set(pid[k], (cnt.get(pid[k]) || 0) + 1);
      }
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
        const x = i % W;
        const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1];
        for (const k of nbs) {
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
      // resolve one level only per iteration (avoid cycles)
      for (let i = 0; i < N; i++) {
        const p = pid[i];
        if (p >= 0 && to.has(p) && to.get(p) >= 0 && (!to.has(to.get(p)) || to.get(p) < p)) pid[i] = to.get(p);
      }
    }
  }

  LOL.mapgen = { W, H, NATIONS, generate };
})();
