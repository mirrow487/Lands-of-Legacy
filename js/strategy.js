'use strict';
(function () {
  // ======================================================================
  //  Grand strategy layer
  // ======================================================================
  const U = LOL.util, C = LOL.config, UI = LOL.ui;
  const S = (LOL.strategy = {});
  const SAVE_KEY = 'lol_save_v3';
  const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const dateStr = (turn) => MONTHS[(turn - 1) % 12] + ' ' + (1936 + Math.floor((turn - 1) / 12));

  const MP_COST = C.mp;
  const BUILD = {
    fac: { name: 'Fabrika', ico: 'factory', max: 3, cost: (l) => 45 + l * 35, desc: '+2 altın ve +1 araştırma / ay' },
    fort: { name: 'Tahkimat', ico: 'fort', max: 3, cost: (l) => 35 + l * 30, desc: 'Savunmada +%15 güç, savaş alanında sığınak ve siper' },
    bar: { name: 'Kışla', ico: 'barracks', max: 2, cost: (l) => 30 + l * 30, desc: '+%30 insan gücü, burada üretim %10 ucuz' },
  };
  const TECHS = [
    { id: 'inf1', br: 'Piyade', name: 'Yarı Otomatik Tüfek', cost: 30, desc: 'Piyade ateş gücü +%25', eff: { infDmg: 0.25 } },
    { id: 'inf2', br: 'Piyade', req: 'inf1', name: 'Çelik Miğfer', cost: 50, desc: 'Piyade dayanıklılığı +%30', eff: { infHp: 0.3 } },
    { id: 'inf3', br: 'Piyade', req: 'inf2', name: 'Elit Eğitim', cost: 80, desc: 'Piyade hızı +%15, menzil +%10', eff: { infSpeed: 0.15, infRange: 0.1 } },
    { id: 'tank1', br: 'Zırh', name: 'Kaynaklı Zırh', cost: 40, desc: 'Tank dayanıklılığı +%25', eff: { tankHp: 0.25 } },
    { id: 'tank2', br: 'Zırh', req: 'tank1', name: 'Yüksek Hızlı Top', cost: 60, desc: 'Tank hasarı +%25', eff: { tankDmg: 0.25 } },
    { id: 'tank3', br: 'Zırh', req: 'tank2', name: 'Dizel Motor', cost: 90, desc: 'Tank hızı +%20, zırh +%15', eff: { tankSpeed: 0.2, tankHp: 0.15 } },
    { id: 'art1', br: 'Topçu', name: 'Gelişmiş Balistik', cost: 40, desc: 'Topçu menzili +%15', eff: { artRange: 0.15 } },
    { id: 'art2', br: 'Topçu', req: 'art1', name: 'Yüksek Patlayıcı', cost: 60, desc: 'Topçu hasarı +%30', eff: { artDmg: 0.3 } },
    { id: 'art3', br: 'Topçu', req: 'art2', name: 'Telsiz Koordinasyonu', cost: 90, desc: 'Topçu isabeti +%40, atış hızı +%15', eff: { artAcc: 0.4, artRof: 0.15 } },
    { id: 'eco1', br: 'Ekonomi', name: 'Sanayileşme', cost: 35, desc: 'Gelir +%15', eff: { income: 0.15 } },
    { id: 'eco2', br: 'Ekonomi', req: 'eco1', name: 'Seri Üretim', cost: 60, desc: 'Birlik maliyeti -%15', eff: { unitCost: -0.15 } },
    { id: 'eco3', br: 'Ekonomi', req: 'eco2', name: 'Demiryolu Ağı', cost: 90, desc: 'Gelir +%15, insan gücü +%25', eff: { income: 0.15, manpower: 0.25 } },
    { id: 'def1', br: 'Doktrin', name: 'Beton Sığınaklar', cost: 35, desc: 'Tahkimat etkisi +%50', eff: { fort: 0.5 } },
    { id: 'def2', br: 'Doktrin', req: 'def1', name: 'Propaganda Bakanlığı', cost: 55, desc: 'İstikrar +1 / ay', eff: { stab: 1 } },
    { id: 'def3', br: 'Doktrin', req: 'def2', name: 'Topyekûn Savaş', cost: 85, desc: 'Tüm birliklerin hasarı +%10', eff: { infDmg: 0.1, tankDmg: 0.1, artDmg: 0.1 } },
  ];
  const TECH = Object.fromEntries(TECHS.map((t) => [t.id, t]));
  const GOVS = [
    { g: 'Krallık', t: 'Kral' }, { g: 'Cumhuriyet', t: 'Cumhurbaşkanı' }, { g: 'Askerî Cunta', t: 'Mareşal' },
    { g: 'İmparatorluk', t: 'İmparator' }, { g: 'Federasyon', t: 'Başkan' }, { g: 'Prenslik', t: 'Prens' },
  ];
  const FIRST = ['Viktor', 'Aldric', 'Kerem', 'Osric', 'Leon', 'Mirza', 'Anton', 'Erhan', 'Dorian', 'Selim', 'Konrad', 'Tarık', 'Elias', 'Baran', 'Henrik', 'Cem'];
  const LAST = ['Valder', 'Morrow', 'Karaman', 'Steiner', 'Draven', 'Aksoy', 'Holm', 'Varga', 'Erol', 'Brandt', 'Tuna', 'Novak', 'Kral', 'Ferro'];

  let map = null, G = null;
  let mapCanvas = null, mapCtx = null, img = null, selCanvas = null;
  let cam = { x: 0, y: 0, s: 1 };
  let sel = -1, hover = -1, selTab = 'genel';
  let phase = 'menu';
  let dirty = true, labels = [];
  let anims = [];
  let send = U.zeroUnits();
  let drag = null;
  let mouse = { x: 0, y: 0 };
  let nationRGB = [];
  let canvas, ctx;
  let waveT = 0;
  let mapMode = 'political';

  const P = (id) => G.provinces[id];
  const nation = (id) => G.nations[id];
  const isPlayer = (id) => id === G.playerId;
  const key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
  const atWar = (a, b) => a !== b && G.wars.has(key(a, b));
  const allied = (a, b) => a !== b && G.allies.has(key(a, b));
  const rel = (a, b) => (a === b ? 100 : G.rel[key(a, b)] || 0);
  const addRel = (a, b, d) => { G.rel[key(a, b)] = U.clamp(rel(a, b) + d, -100, 100); };
  const truce = (a, b) => (G.truce[key(a, b)] || 0) > G.turn;
  const provsOf = (nid) => G.provinces.filter((p) => p.owner === nid);
  const enemiesOf = (nid) => G.nations.filter((n) => n.alive && atWar(nid, n.id));
  const alliesOf = (nid) => G.nations.filter((n) => n.alive && allied(nid, n.id));
  const fmtK = (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'B' : String(Math.round(v)));

  function eff(nid) {
    const n = nation(nid);
    if (n._effKey === n.techs.join()) return n._eff;
    const e = {};
    n.techs.forEach((id) => { const t = TECH[id]; if (t) for (const k in t.eff) e[k] = (e[k] || 0) + t.eff[k]; });
    n._eff = e; n._effKey = n.techs.join();
    return e;
  }
  function typeMult(nid, t) {
    const e = eff(nid);
    t = C.techClass[t] || t;
    return 1 + 0.6 * (e[t + 'Dmg'] || 0) + 0.6 * (e[t + 'Hp'] || 0) + 0.3 * (e[t + 'Range'] || 0) + 0.2 * (e[t + 'Speed'] || 0) + 0.3 * (e[t + 'Acc'] || 0) + 0.3 * (e[t + 'Rof'] || 0);
  }
  const powerOf = (u, nid) => U.TYPES.reduce((s, t) => s + u[t] * C.power[t] * (nid == null ? 1 : typeMult(nid, t)), 0);
  const nationPower = (nid) => provsOf(nid).reduce((s, p) => s + powerOf(p.units, nid), 0);
  const defBonus = (p) => 1.2 + (p.isCapital ? 0.2 : 0) + p.buildings.fort * 0.15 * (1 + (eff(p.owner).fort || 0));
  function neighborNations(nid) {
    const s = new Set();
    provsOf(nid).forEach((p) => p.neighbors.forEach((q) => { const o = P(q).owner; if (o !== nid) s.add(o); }));
    return [...s].filter((id) => nation(id).alive);
  }
  function unitCost(nid, t, prov) {
    return Math.round(C.cost[t] * (1 + (eff(nid).unitCost || 0)) * (prov && prov.buildings.bar ? 0.9 : 1));
  }
  function economy(nid) {
    const n = nation(nid), e = eff(nid);
    let inc = 0, up = 0, mp = 0, rp = 2;
    provsOf(nid).forEach((p) => {
      inc += p.income + p.buildings.fac * 2 + (p.isCapital ? C.capitalBonus : 0);
      rp += p.buildings.fac + (p.isCapital ? 2 : 0);
      mp += p.pop * 3 * (1 + p.buildings.bar * 0.3);
      U.TYPES.forEach((t) => { up += p.units[t] * C.upkeep[t]; });
    });
    const stabM = 0.7 + 0.6 * n.stability / 100;
    inc *= (1 + (e.income || 0)) * stabM;
    mp *= (1 + (e.manpower || 0)) * (0.6 + 0.8 * n.stability / 100);
    let stabD = (n.stability < 60 ? 1 : n.stability > 60 ? -0.5 : 0) + (e.stab || 0) - enemiesOf(nid).length * 1.2;
    return { inc: Math.round(inc), up: Math.round(up), net: Math.round(inc - up), mp: Math.round(mp), rp: Math.round(rp), stabD: Math.round(stabD * 10) / 10 };
  }

  // ---------------------------------------------------------------- setup
  S.init = function () { canvas = LOL.app.canvas; ctx = LOL.app.ctx; };

  S.newMap = function (seed, kind) {
    map = kind === 'world' ? LOL.mapgen.generateWorld(seed) : LOL.mapgen.generate(seed, 8);
    S.mapKind = map.kind;
    const rng = U.rng(seed + 5);
    G = { seed, kind: map.kind, turn: 1, playerId: -1, nations: map.nations, provinces: map.provinces, wars: new Set(), allies: new Set(), truce: {}, rel: {}, news: [], eventsSeen: {} };
    G.nations.forEach((n) => {
      const gov = rng.pick(GOVS);
      n.advisor = rng.pick(['Orgeneral', 'Mareşal', 'Amiral', 'Kurmay Albay']) + ' ' + rng.pick(FIRST) + ' ' + rng.pick(LAST);
      Object.assign(n, { manpower: 9000, stability: rng.int(55, 75), techs: [], research: { cur: null, prog: 0 }, gov: gov.g, leader: gov.t + ' ' + rng.pick(FIRST) + ' ' + rng.pick(LAST), flagSeed: rng.int(0, 999) });
    });
    if (map.kind !== 'world') for (let a = 0; a < G.nations.length; a++) for (let b = a + 1; b < G.nations.length; b++) G.rel[key(a, b)] = rng.int(-25, 30);
    else map.provinces.forEach((p) => p.neighbors.forEach((q) => { const a = p.owner, b = map.provinces[q].owner; if (a !== b && G.rel[key(a, b)] == null) G.rel[key(a, b)] = rng.int(-25, 30); }));
    nationRGB = G.nations.map((n) => U.hexToRgb(n.color));
    mapCanvas = document.createElement('canvas'); mapCanvas.width = map.W; mapCanvas.height = map.H;
    mapCtx = mapCanvas.getContext('2d');
    img = mapCtx.createImageData(map.W, map.H);
    selCanvas = document.createElement('canvas'); selCanvas.width = map.W; selCanvas.height = map.H;
    sel = -1; hover = -1; anims = [];
    fitCam();
    dirty = true;
  };

  S.setPhase = function (p, showBusy) {
    phase = p;
    U.el('pick-banner').classList.toggle('hidden', p !== 'pick');
    const playing = p === 'play' || p === 'busy';
    ['endturn-wrap', 'news', 'mapmodes'].forEach((id) => U.el(id).classList.toggle('hidden', !playing));
    U.el('busy').classList.toggle('hidden', !(p === 'busy' && showBusy));
    U.el('btn-endturn').disabled = p !== 'play';
    U.el('tb-res').classList.toggle('hidden', !playing);
    ['btn-diplo', 'btn-save', 'btn-tech'].forEach((id) => { U.el(id).disabled = p !== 'play'; });
    updatePanel(); updateTop();
  };
  S.getPhase = () => phase;

  function fitCam() {
    const vw = canvas.width, vh = canvas.height - 58;
    cam.s = Math.min(vw / map.W, vh / map.H) * 0.97;
    cam.x = (vw - map.W * cam.s) / 2;
    cam.y = 58 + (vh - map.H * cam.s) / 2;
  }
  S.onResize = function () { if (map) fitCam(); };

  // ---------------------------------------------------------------- map render
  function provColor(p) {
    const own = p.owner;
    if (mapMode === 'political' || G.playerId < 0) return nationRGB[own];
    const me = G.playerId;
    if (mapMode === 'diplo') {
      if (own === me) return [214, 178, 94];
      if (allied(me, own)) return [80, 150, 230];
      if (atWar(me, own)) return [200, 60, 45];
      if (truce(me, own)) return [90, 170, 160];
      const r = rel(me, own);
      return r > 0 ? [120 - r * 0.4, 140 + r * 0.6, 120] : [140 - r * 0.3, 130 + r * 0.5, 120 + r * 0.3];
    }
    if (mapMode === 'economy') {
      const v = U.clamp((p.income + p.buildings.fac * 2 - 2) / 12, 0, 1);
      return [U.lerp(60, 250, v), U.lerp(70, 210, v), U.lerp(90, 60, v)];
    }
    if (mapMode === 'terrain') {
      return nationRGB[own];
    }
    if (mapMode === 'military') {
      const v = U.clamp(powerOf(p.units) / 40, 0, 1);
      const base = own === me ? [70, 120, 200] : atWar(me, own) ? [200, 70, 50] : [120, 120, 120];
      return base.map((c) => U.lerp(40, c * 1.2, 0.25 + v * 0.75));
    }
    return nationRGB[own];
  }

  function renderMap() {
    const d = img.data, W = map.W, H = map.H;
    const pid = map.pid, depth = map.seaDepth, sn = map.seaNoise, nb = map.nbPid, coast = map.coast, biome = map.biome, elev = map.elev;
    const BR = LOL.mapgen.BIOME_RGB;
    const owners = G.provinces.map((p) => p.owner);
    const cols = G.provinces.map(provColor);
    const selP = sel >= 0 ? P(sel) : null;
    const targets = new Set();
    if (selP && selP.owner === G.playerId && phase === 'play') selP.neighbors.forEach((q) => targets.add(q));
    const pickNation = phase === 'pick' && sel >= 0 ? P(sel).owner : -1;
    const politicalBorders = mapMode !== 'terrain' && mapMode !== 'economy';
    const tint = mapMode === 'terrain' ? 0 : mapMode === 'political' || mapMode === 'diplo' ? 0.58 : 0.72;
    for (let i = 0, o = 0; i < W * H; i++, o += 4) {
      const p = pid[i];
      let r, g, b;
      if (p < 0) {
        // Azgaar-like ocean: light shelf, contour lines, deep water
        const dd = depth[i];
        const t = Math.min(1, dd / 60);
        const nn = (sn[i] - 128) / 255 * 10;
        r = 98 + (44 - 98) * t + nn; g = 146 + (86 - 146) * t + nn; b = 196 + (150 - 196) * t + nn;
        if (dd === 3 || dd === 8 || dd === 16 || dd === 28) { r += 22; g += 24; b += 22; }
        const x = i % W, y = (i / W) | 0;
        if (x % 100 === 0 || y % 100 === 0) { r += 6; g += 7; b += 8; }
      } else {
        const own = owners[p];
        const bc = BR[biome[i]];
        const e = elev[i];
        // hillshade from elevation gradient
        const ex = i % W < W - 1 ? elev[i + 1] : e, ey = i < (H - 1) * W ? elev[i + W] : e;
        const shade = U.clamp(1 + (e - ex) * 6 + (e - ey) * 6 - e * 0.15, 0.7, 1.25);
        const c = cols[p];
        r = (bc[0] * (1 - tint) + c[0] * tint) * shade;
        g = (bc[1] * (1 - tint) + c[1] * tint) * shade;
        b = (bc[2] * (1 - tint) + c[2] * tint) * shade;
        if (pickNation >= 0) { if (own === pickNation) { r += 40; g += 40; b += 40; } else { r *= 0.72; g *= 0.72; b *= 0.72; } }
        if (p === sel) { r += 40; g += 40; b += 40; }
        else if (targets.has(p)) {
          const x = i % W, y = (i / W) | 0;
          if (((x + y) >> 2) & 1) { const en = owners[p] !== G.playerId; r += en ? 50 : 20; g += en ? 0 : 30; b += en ? -10 : 15; }
        }
        if (coast[i]) { r *= 0.42; g *= 0.42; b *= 0.45; }
        else if (nb[i] >= 0) {
          if (politicalBorders && owners[nb[i]] !== own) { r *= 0.25; g *= 0.25; b *= 0.25; }
          else { r *= 0.8; g *= 0.8; b *= 0.8; }
        }
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    mapCtx.putImageData(img, 0, 0);
    const sc = selCanvas.getContext('2d');
    sc.clearRect(0, 0, W, H);
    if (selP) {
      const od = sc.createImageData(W, H);
      for (const i of selP.borderPix) { const o = i * 4; od.data[o] = 255; od.data[o + 1] = 240; od.data[o + 2] = 190; od.data[o + 3] = 255; }
      sc.putImageData(od, 0, 0);
    }
    computeLabels();
  }

  function computeLabels() {
    labels = [];
    for (const n of G.nations) {
      if (!n.alive) continue;
      const ps = provsOf(n.id);
      let sw = 0, mx = 0, my = 0;
      ps.forEach((p) => { sw += p.size; mx += p.cx * p.size; my += p.cy * p.size; });
      mx /= sw; my /= sw;
      let cxx = 0, cyy = 0, cxy = 0;
      ps.forEach((p) => { const dx = p.cx - mx, dy = p.cy - my; cxx += dx * dx * p.size; cyy += dy * dy * p.size; cxy += dx * dy * p.size; });
      cxx /= sw; cyy /= sw; cxy /= sw;
      let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      ang = U.clamp(ang, -0.6, 0.6);
      const ax = Math.cos(ang), ay = Math.sin(ang);
      let lo = 1e9, hi = -1e9, perp = 0;
      ps.forEach((p) => {
        const r = Math.sqrt(p.size / Math.PI);
        const t = (p.cx - mx) * ax + (p.cy - my) * ay;
        lo = Math.min(lo, t - r * 0.6); hi = Math.max(hi, t + r * 0.6);
        perp += Math.abs(-(p.cx - mx) * ay + (p.cy - my) * ax) * p.size;
      });
      perp /= sw;
      const ext = hi - lo;
      const name = n.name.toUpperCase();
      const fs = U.clamp(Math.min(ext * 0.82 / (name.length * 0.82), perp * 1.1 + 14), 9, 46);
      labels.push({ n, x: mx + ax * (lo + hi) / 2, y: my + ay * (lo + hi) / 2, ang, fs, name });
    }
  }

  // ---------------------------------------------------------------- frame
  const toScreen = (x, y) => [x * cam.s + cam.x, y * cam.s + cam.y];
  const toWorld = (sx, sy) => [(sx - cam.x) / cam.s, (sy - cam.y) / cam.s];
  function pidAt(sx, sy) {
    if (!map) return -1;
    const [x, y] = toWorld(sx, sy);
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= map.W || yi >= map.H) return -1;
    return map.pid[yi * map.W + xi];
  }

  S.frame = function (dt) {
    if (!map) return;
    waveT += dt;
    if (dirty) { renderMap(); dirty = false; }
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, Math.max(W, H) * 0.8);
    bg.addColorStop(0, '#0f2236'); bg.addColorStop(1, '#060d16');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.setTransform(cam.s, 0, 0, cam.s, cam.x, cam.y);
    ctx.imageSmoothingEnabled = cam.s < 2.2;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30 / Math.max(1, cam.s);
    ctx.drawImage(mapCanvas, 0, 0);
    ctx.shadowBlur = 0;
    if (map.overlay) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = mapMode === 'terrain' ? 1 : 0.75;
      ctx.drawImage(map.overlay, 0, 0, map.W, map.H);
      ctx.globalAlpha = 1;
    }
    if (sel >= 0) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(waveT * 4);
      ctx.drawImage(selCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -waveT * 8;
    ctx.strokeStyle = 'rgba(220,235,255,0.5)';
    ctx.lineWidth = 1.4 / Math.min(cam.s, 2);
    for (const [a, b] of map.links) { ctx.beginPath(); ctx.moveTo(P(a).cx, P(a).cy); ctx.lineTo(P(b).cx, P(b).cy); ctx.stroke(); }
    ctx.setLineDash([]);
    // nation names
    if (mapMode === 'political' || mapMode === 'diplo') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const l of labels) {
        const ss = l.fs * cam.s;
        const la = ss < 10 ? 0 : ss > 70 ? Math.max(0, 1 - (ss - 70) / 40) * 0.85 : 0.85;
        if (la <= 0.02) continue;
        ctx.save();
        ctx.translate(l.x, l.y); ctx.rotate(l.ang);
        ctx.font = `700 ${l.fs}px Cinzel, Georgia, serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = (l.fs * 0.18).toFixed(1) + 'px';
        ctx.globalAlpha = la;
        ctx.lineWidth = Math.max(2, l.fs * 0.12); ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeText(l.name, 0, 0);
        ctx.fillStyle = 'rgba(15,12,8,0.78)';
        ctx.fillText(l.name, 0, 0);
        ctx.restore();
      }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = true;

    // move arrow preview
    if (sel >= 0 && phase === 'play' && P(sel).owner === G.playerId && hover >= 0 && P(sel).neighbors.includes(hover) && U.sumUnits(clampSend(P(sel))) > 0) {
      const [ax, ay] = toScreen(P(sel).cx, P(sel).cy), [bx, by] = toScreen(P(hover).cx, P(hover).cy);
      const enemy = P(hover).owner !== G.playerId;
      arrow(ax, ay, bx, by, enemy ? '#ff5a44' : '#7ce07c');
    }

    // province names
    const nameZ = map.kind === 'world' ? 2.4 : 1.35;
    if (cam.s > nameZ) {
      const a = U.clamp((cam.s - nameZ) * 2, 0, 1);
      ctx.font = `600 ${Math.min(13, 7 + cam.s * 2) | 0}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      for (const p of G.provinces) {
        const [x, y] = toScreen(p.cx, p.cy);
        if (x < -50 || y < -50 || x > W + 50 || y > H + 50) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(p.name, x + 1, y - 15);
        ctx.fillStyle = '#fff'; ctx.fillText(p.name, x, y - 16);
        ctx.globalAlpha = 1;
      }
    }
    // capitals, buildings & armies
    for (const p of G.provinces) {
      const [x, y] = toScreen(p.cx, p.cy);
      if (x < -50 || y < -50 || x > W + 50 || y > H + 50) continue;
      const tot = U.sumUnits(p.units);
      if (p.isCapital && (map.kind !== 'world' || cam.s > 1.2 || p.owner === G.playerId)) capitalIcon(x, y - (tot && counterVisible(p) ? 17 : 0));
      else if (cam.s > 1.1 && p.buildings.fort > 0) { ctx.fillStyle = 'rgba(30,30,30,.8)'; ctx.fillRect(x - 3, y - (tot ? 19 : 4), 6, 6); }
      if (tot > 0 && !anims.some((a) => a.to === p.id && a.t < a.dur) && counterVisible(p)) counter(p, x, y, tot);
    }
    // move anims
    anims = anims.filter((a) => a.t < a.dur + 0.05);
    for (const a of anims) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur), e = k * k * (3 - 2 * k);
      const [ax, ay] = toScreen(P(a.from).cx, P(a.from).cy), [bx, by] = toScreen(P(a.to).cx, P(a.to).cy);
      const x = U.lerp(ax, bx, e), y = U.lerp(ay, by, e) - Math.sin(e * Math.PI) * 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke();
      fakeCounter(nation(a.owner), x, y, a.n);
    }

    // tooltip
    if (hover >= 0 && !(drag && drag.moved) && !UI.isModalOpen() && phase !== 'menu') {
      const p = P(hover), n = nation(p.owner);
      let relTxt = '';
      if (G.playerId >= 0 && p.owner !== G.playerId) {
        relTxt = atWar(G.playerId, p.owner) ? '<span class="tag war">SAVAŞ</span>' : allied(G.playerId, p.owner) ? '<span class="tag ally">MÜTTEFİK</span>' : `<span class="tag">İlişki ${rel(G.playerId, p.owner)}</span>`;
      }
      UI.tooltip(`<div class="tt-title">${U.esc(p.name)}${p.isCapital ? ' ★' : ''}</div>
        <div>${UI.flag(n, 12)}${U.esc(n.name)} ${relTxt}</div>
        <div class="tt-sub">${p.terrain} · Nüfus ${p.pop}B · Gelir +${p.income + p.buildings.fac * 2}</div>
        <div>${U.unitsText(p.units)}</div>`, mouse.x, mouse.y);
    } else UI.tooltip(null);
  };

  function counterVisible(p) {
    if (map.kind !== 'world' || cam.s >= 3.2) return true;
    if (G.playerId < 0) return false;
    const me = G.playerId;
    if (p.owner === me || atWar(me, p.owner)) return true;
    if (sel >= 0 && P(sel).neighbors.includes(p.id)) return true;
    return p.neighbors.some((q) => P(q).owner === me);
  }
  function arrow(ax, ay, bx, by, col) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    if (L < 5) return;
    const ux = dx / L, uy = dy / L;
    const ex = bx - ux * 12, ey = by - uy * 12;
    const mx = (ax + ex) / 2 - uy * L * 0.15, my = (ay + ey) / 2 + ux * L * 0.15;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 4.5;
    ctx.setLineDash([10, 6]); ctx.lineDashOffset = -waveT * 30;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = 'butt';
    const tx = ex - mx, ty = ey - my, tl = Math.hypot(tx, ty);
    const vx = tx / tl, vy = ty / tl;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(ex + vx * 12, ey + vy * 12); ctx.lineTo(ex - vy * 10, ey + vx * 10); ctx.lineTo(ex + vy * 10, ey - vx * 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function capitalIcon(x, y) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,210,90,0.8)'; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3.2 : 7.5; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = '#ffd860'; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#4a3400'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function unitGlyph(type, x, y) {
    type = C.techClass[type];
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
    if (type === 'inf') { ctx.beginPath(); ctx.arc(x, y - 3.5, 2.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, y + 5); ctx.quadraticCurveTo(x, y - 4, x + 4, y + 5); ctx.fill(); }
    else if (type === 'tank') { ctx.fillRect(x - 5, y, 10, 3.5); ctx.fillRect(x - 2.5, y - 3, 5, 3.5); ctx.fillRect(x + 1, y - 2, 5, 1.5); }
    else { ctx.beginPath(); ctx.arc(x - 1.5, y + 3, 2.5, 0, 7); ctx.fill(); ctx.save(); ctx.translate(x - 1.5, y + 2); ctx.rotate(-0.6); ctx.fillRect(0, -1, 8, 2); ctx.restore(); }
  }
  function counter(p, x, y, tot) {
    const own = p.owner === G.playerId;
    const dom = U.TYPES.reduce((a, t) => (p.units[t] * C.power[t] > p.units[a] * C.power[a] ? t : a), 'inf');
    const cls = { inf: 0, tank: 0, art: 0 }; U.TYPES.forEach((t) => { cls[C.techClass[t]] += p.units[t]; });
    const label = cam.s > (map.kind === 'world' ? 4.5 : 1.9) ? `${cls.inf}·${cls.tank}·${cls.art}` : String(tot);
    ctx.font = '700 11px Inter, sans-serif';
    const w = Math.max(30, ctx.measureText(label).width + 26), h = 17;
    const bx = x - w / 2, by = y - h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(bx + 1, by + 2, w, h, 4); ctx.fill();
    ctx.fillStyle = '#141a22'; rr(bx, by, w, h, 4); ctx.fill();
    ctx.fillStyle = nation(p.owner).color; rr(bx, by, 17, h, 4); ctx.fill(); ctx.fillRect(bx + 10, by, 7, h);
    unitGlyph(dom, bx + 8.5, y);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(label, bx + 17 + (w - 17) / 2, y + 4);
    ctx.strokeStyle = own ? (p.id === sel ? '#ffe9a0' : 'rgba(255,255,255,0.75)') : 'rgba(0,0,0,0.9)';
    ctx.lineWidth = own && p.id === sel ? 2 : 1;
    rr(bx + 0.5, by + 0.5, w - 1, h - 1, 4); ctx.stroke();
    if (own && phase === 'play' && U.sumUnits(p.ready) === 0) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(bx, by, w, h, 4); ctx.fill(); }
  }
  function fakeCounter(n, x, y, num) {
    ctx.fillStyle = n.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 10px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(num, x, y + 3.5);
  }

  // ---------------------------------------------------------------- input
  S.onInput = function (type, e) {
    if (!map) return;
    if (UI.isModalOpen() && type !== 'up') return;
    const mx = e.clientX, my = e.clientY;
    if (type === 'move') {
      mouse.x = mx; mouse.y = my;
      if (drag) {
        if (Math.abs(mx - drag.x) + Math.abs(my - drag.y) > 5) drag.moved = true;
        if (drag.moved) { cam.x = drag.cx + (mx - drag.x); cam.y = drag.cy + (my - drag.y); }
      }
      hover = phase === 'menu' || (e.target !== canvas && !drag) ? -1 : pidAt(mx, my);
    } else if (type === 'down') {
      if (phase === 'menu') return;
      if (e.button === 0 || e.button === 1) drag = { x: mx, y: my, cx: cam.x, cy: cam.y, moved: false };
      else if (e.button === 2) rightClick(pidAt(mx, my));
    } else if (type === 'up') {
      if (drag && !drag.moved && e.button === 0 && !UI.isModalOpen()) leftClick(pidAt(mx, my));
      drag = null;
    } else if (type === 'wheel') {
      if (phase === 'menu') return;
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const ns = U.clamp(cam.s * f, 0.6, map.kind === 'world' ? 9 : 6);
      const [wx, wy] = toWorld(mx, my);
      cam.s = ns; cam.x = mx - wx * ns; cam.y = my - wy * ns;
    } else if (type === 'leave') {
      hover = -1;
    } else if (type === 'keydown') {
      if (e.key === 'Escape') { sel = -1; dirty = true; updatePanel(); }
      if (e.key === 'Enter' && phase === 'play' && !UI.isModalOpen()) endTurn();
    }
  };

  function leftClick(p) {
    LOL.audio.init();
    if (phase === 'pick') { sel = p; dirty = true; updatePanel(); LOL.audio.play('select'); return; }
    if (phase !== 'play' && phase !== 'busy') return;
    if (p !== sel) selTab = p >= 0 && P(p).owner === G.playerId ? selTab : 'genel';
    sel = p;
    if (p >= 0) { send = U.copyUnits(P(p).ready); LOL.audio.play('select'); }
    dirty = true;
    updatePanel();
  }

  async function rightClick(t) {
    if (phase !== 'play' || sel < 0 || t < 0 || t === sel) return;
    const from = P(sel), to = P(t);
    if (from.owner !== G.playerId) return;
    if (!from.neighbors.includes(t)) { UI.toast('Sadece komşu bölgelere hareket edebilirsin.', 'bad'); return; }
    const units = clampSend(from);
    if (U.sumUnits(units) === 0) { UI.toast('Bu bölgede hazır birlik yok — birlikler ayda bir kez hareket edebilir.', 'bad'); return; }
    if (to.owner !== G.playerId && !atWar(G.playerId, to.owner)) {
      if (allied(G.playerId, to.owner)) { UI.toast('Müttefikine saldıramazsın.', 'bad'); return; }
      if (truce(G.playerId, to.owner)) { UI.toast(`${nation(to.owner).name} ile ateşkes var (${G.truce[key(G.playerId, to.owner)] - G.turn} ay).`, 'bad'); return; }
      const ok = await UI.modal('Savaş İlanı', `<p>${UI.flag(nation(to.owner))}<b>${U.esc(nation(to.owner).name)}</b> ile barış içindesin. Saldırmak için savaş ilan etmelisin.</p>
        ${alliesOf(to.owner).length ? `<p class="hint">Müttefikleri de sana savaş açacak: <b>${alliesOf(to.owner).map((n) => U.esc(n.name)).join(', ')}</b></p>` : ''}
        <p class="hint">İstikrar −5</p>`,
      [{ label: 'Vazgeç', value: false }, { label: 'Savaş İlan Et', value: true, cls: 'danger' }]);
      if (!ok) return;
      declareWar(G.playerId, to.owner);
      nation(G.playerId).stability = Math.max(0, nation(G.playerId).stability - 5);
    }
    S.setPhase('busy');
    await moveArmy(from, to, units);
    if (phase !== 'over') S.setPhase('play');
    if (sel >= 0) send = U.copyUnits(P(sel).ready);
    updatePanel(); updateTop();
  }
  function clampSend(p) {
    const u = U.zeroUnits();
    U.TYPES.forEach((t) => { u[t] = U.clamp(send[t] | 0, 0, p.ready[t]); });
    return u;
  }

  // ---------------------------------------------------------------- news
  const nn = (id) => `<b style="color:${U.shade(nation(id).color, 0.25)}">${U.esc(nation(id).name)}</b>`;
  function news(icon, color, title, body, mine) {
    G.news.unshift({ turn: G.turn, icon, color, title, body: body || '', mine: !!mine });
    if (G.news.length > 80) G.news.pop();
    renderNews();
  }
  function renderNews() {
    const el = U.el('news-list');
    if (!G) { el.innerHTML = ''; return; }
    el.innerHTML = G.news.slice(0, 40).map((n) => `<div class="ncard${n.mine ? ' mine' : ''}">
      <div class="ni" style="background:${n.color}">${UI.icon(n.icon, 16)}</div>
      <div><div class="nt">${n.title}</div>${n.body ? `<div class="nb">${n.body}</div>` : ''}<div class="nd">${dateStr(n.turn)}</div></div></div>`).join('');
  }

  // ---------------------------------------------------------------- diplomacy actions
  function declareWar(a, b, silent) {
    if (atWar(a, b) || a === b) return;
    G.wars.add(key(a, b));
    G.allies.delete(key(a, b));
    addRel(a, b, -60);
    const involved = isPlayer(a) || isPlayer(b);
    if (involved || map.kind !== 'world' || (major(a) && major(b))) news('sword', '#b33a2a', `${nn(a)}, ${nn(b)} ulusuna savaş ilan etti!`, involved ? 'Cepheler alevlendi. Ordular sınırda.' : '', involved);
    if (involved && !silent) LOL.audio.play('war');
    // allies of defender join
    alliesOf(b).forEach((ally) => {
      if (ally.id === a || atWar(ally.id, a) || allied(ally.id, a)) return;
      G.wars.add(key(ally.id, a)); addRel(ally.id, a, -50);
      news('sword', '#8c3024', `${nn(ally.id)}, müttefiki ${nn(b)} için ${nn(a)} ulusuna savaş açtı.`, '', isPlayer(ally.id) || isPlayer(a));
    });
    // allies of attacker may join
    alliesOf(a).forEach((ally) => {
      if (ally.id === b || atWar(ally.id, b) || allied(ally.id, b) || isPlayer(ally.id)) return;
      if (Math.random() < 0.7) {
        G.wars.add(key(ally.id, b)); addRel(ally.id, b, -40);
        news('sword', '#8c3024', `${nn(ally.id)}, müttefiki ${nn(a)} yanında savaşa girdi.`, '', isPlayer(b) || isPlayer(a));
      }
    });
    dirty = true; updateTop();
  }
  function major(nid) { return provsOf(nid).length >= 6; }
  function makePeace(a, b) {
    G.wars.delete(key(a, b));
    G.truce[key(a, b)] = G.turn + 8;
    addRel(a, b, 20);
    const involved = isPlayer(a) || isPlayer(b);
    if (involved || map.kind !== 'world' || (major(a) && major(b))) news('dove', '#3c8a4a', `${nn(a)} ve ${nn(b)} barış antlaşması imzaladı.`, '8 ay sürecek bir ateşkes başladı.', involved);
    if (involved) LOL.audio.play('peace');
    dirty = true; updateTop();
  }
  function makeAlliance(a, b) {
    G.allies.add(key(a, b));
    addRel(a, b, 15);
    news('handshake', '#2f6aa8', `${nn(a)} ile ${nn(b)} askerî ittifak kurdu.`, '', isPlayer(a) || isPlayer(b));
    if (isPlayer(a) || isPlayer(b)) LOL.audio.play('peace');
    dirty = true;
  }

  // ---------------------------------------------------------------- economy actions
  function recruit(p, type, n) {
    const nat = nation(p.owner);
    let done = 0;
    for (let i = 0; i < n; i++) {
      const c = unitCost(p.owner, type, p);
      if (nat.gold < c || nat.manpower < MP_COST[type]) break;
      nat.gold -= c; nat.manpower -= MP_COST[type];
      p.units[type]++; done++;
    }
    if (done && isPlayer(p.owner)) LOL.audio.play('coin');
    return done;
  }
  function build(p, type) {
    const lvl = p.buildings[type], b = BUILD[type];
    if (lvl >= b.max || p.queue) return false;
    const cost = b.cost(lvl);
    const nat = nation(p.owner);
    if (nat.gold < cost) return false;
    nat.gold -= cost;
    p.queue = { type, t: 2 };
    if (isPlayer(p.owner)) LOL.audio.play('build');
    return true;
  }

  function animMove(from, to, units, owner) {
    anims.push({ from: from.id, to: to.id, t: 0, dur: 0.5, owner, n: U.sumUnits(units) });
  }

  function capture(prov, newOwner, units) {
    const old = prov.owner;
    prov.owner = newOwner;
    prov.units = U.copyUnits(units);
    prov.ready = U.zeroUnits();
    prov.queue = null;
    prov.buildings.fort = Math.max(0, prov.buildings.fort - 1);
    nation(old).stability = Math.max(0, nation(old).stability - (prov.isCapital ? 15 : 3));
    nation(newOwner).stability = Math.min(100, nation(newOwner).stability + 1);
    if (prov.isCapital) {
      prov.isCapital = false;
      const loot = Math.floor(Math.max(0, nation(old).gold) * 0.4);
      nation(old).gold -= loot; nation(newOwner).gold += loot;
      const rest = provsOf(old);
      if (rest.length) {
        const nc = rest.sort((a, b) => b.income - a.income)[0];
        nc.isCapital = true; nation(old).capital = nc.id;
        news('crown', '#a8741a', `${U.esc(prov.name)} düştü! ${nn(old)} başkentini kaybetti.`, `${nn(newOwner)} ${loot} altın yağmaladı. Yeni başkent: ${U.esc(nc.name)}.`, isPlayer(old) || isPlayer(newOwner));
      }
    }
    if (!provsOf(old).length) {
      nation(old).alive = false;
      G.nations.forEach((n) => { G.wars.delete(key(old, n.id)); G.allies.delete(key(old, n.id)); });
      news('skull', '#5a1a1a', `${nn(old)} tarih sahnesinden silindi!`, `Son toprakları ${nn(newOwner)} tarafından ilhak edildi.`, true);
    }
    dirty = true;
  }

  function autoResolve(att, def, prov, an, dn) {
    const A = powerOf(att, an) * (0.85 + Math.random() * 0.3);
    const D = powerOf(def, dn) * defBonus(prov) * (0.85 + Math.random() * 0.3);
    const attWin = A > D;
    const Wp = Math.max(A, D), Lp = Math.min(A, D);
    const lossFrac = Math.min(0.92, 0.65 * Math.pow(Lp / Wp, 1.3) + 0.05);
    const wu = attWin ? att : def;
    const surv = U.zeroUnits();
    U.TYPES.forEach((t) => { surv[t] = Math.max(0, Math.round(wu[t] * (1 - lossFrac * (0.75 + Math.random() * 0.5)))); });
    if (U.sumUnits(surv) === 0) { const t = U.TYPES.find((k) => wu[k] > 0); if (t) surv[t] = 1; }
    return { winner: attWin ? 'attacker' : 'defender', attSurv: attWin ? surv : U.zeroUnits(), defSurv: attWin ? U.zeroUnits() : surv };
  }

  function sideCard(n, units, label) {
    return `<div class="side"><div class="nm">${UI.flag(n, 16)}${U.esc(n.name)}</div><small>${label}</small>
      <div class="units-row">${U.TYPES.filter((t) => units[t] > 0).map((t) => `<div class="ucard"><img src="${UI.unitIcon(t, n.color)}"><div class="n">${units[t]}</div><div class="t">${C.unitShort[t]}</div></div>`).join('')}</div></div>`;
  }

  async function moveArmy(from, to, units) {
    const owner = from.owner;
    U.TYPES.forEach((t) => { from.units[t] -= units[t]; from.ready[t] = Math.max(0, from.ready[t] - units[t]); });
    if (to.owner === owner) {
      U.TYPES.forEach((t) => { to.units[t] += units[t]; });
      animMove(from, to, units, owner);
      dirty = true;
      return;
    }
    const defender = to.owner;
    animMove(from, to, units, owner);
    if (U.sumUnits(to.units) === 0) {
      if (isPlayer(owner) || isPlayer(defender)) await U.sleep(300);
      capture(to, owner, units);
      if (isPlayer(owner) || isPlayer(defender) || map.kind !== 'world') news('flag', U.shade(nation(owner).color, -0.3), `${nn(owner)}, ${U.esc(to.name)} bölgesini direnişsiz ele geçirdi.`, '', isPlayer(owner) || isPlayer(defender));
      checkGameOver();
      return;
    }
    const playerInvolved = isPlayer(owner) || isPlayer(defender);
    let result;
    if (playerInvolved) {
      await U.sleep(250);
      const pAtt = isPlayer(owner);
      const A = powerOf(units, owner), D = powerOf(to.units, defender) * defBonus(to);
      const pa = A / (A + D);
      const myShare = pAtt ? pa : 1 - pa;
      const odds = myShare > 0.68 ? 'Çok yüksek' : myShare > 0.55 ? 'Yüksek' : myShare > 0.45 ? 'Dengeli' : myShare > 0.32 ? 'Düşük' : 'Çok düşük';
      const banner = `<div class="banner"><div class="bg" style="background:linear-gradient(120deg, ${U.shade(nation(owner).color, -0.4)}, #1a0c08 45%, #1a0c08 55%, ${U.shade(nation(defender).color, -0.4)})"></div>
        <div class="big-ico">${UI.icon('sword', 80)}</div><div><div class="bk">${pAtt ? 'Taarruz' : 'Saldırı altındasın'}</div><div class="bt">${U.esc(to.name)} Muharebesi</div></div></div>`;
      const body = `<div class="vs">${sideCard(nation(owner), units, 'Saldıran')}<div class="mid">VS</div>${sideCard(nation(defender), to.units, `Savunan · ${to.terrain}${to.buildings.fort ? ' · Tahkimat ' + to.buildings.fort : ''}${to.isCapital ? ' · Başkent' : ''}`)}</div>
        <div class="odds"><div class="ob"><div style="width:${pa * 100}%;background:${nation(owner).color}"></div><div style="flex:1;background:${nation(defender).color}"></div></div>
        <div class="ol"><span>Kuvvet ${Math.round(A)}</span><span>Zafer şansın: <b style="color:var(--text)">${odds}</b></span><span>${Math.round(D)} Kuvvet</span></div></div>
        <p class="hint">"<b>Savaşı Yönet</b>" ile izometrik savaş alanına inip birliklerine bizzat komuta edersin. Arazi ve tahkimatlar savaş alanına yansır.</p>`;
      const btns = [{ label: 'Otomatik Çöz', value: 'auto' }, { label: '⚔ Savaşı Yönet', value: 'tactical', cls: 'primary' }];
      if (pAtt) btns.unshift({ label: 'İptal', value: 'cancel' });
      if (!pAtt) LOL.audio.play('war');
      const choice = await UI.modal('', body, btns, { banner, width: 640 });
      if (choice === 'cancel') {
        U.TYPES.forEach((t) => { from.units[t] += units[t]; from.ready[t] += units[t]; });
        anims = anims.filter((a) => a.to !== to.id);
        dirty = true;
        return;
      }
      if (choice === 'tactical') {
        result = await LOL.app.startBattle({
          provinceName: to.name, terrain: to.terrain, biome: to.biome, month: ((G.turn - 1) % 12) + 1, fort: Math.round(to.buildings.fort * (1 + (eff(defender).fort || 0))),
          attacker: nation(owner), defender: nation(defender),
          attUnits: U.copyUnits(units), defUnits: U.copyUnits(to.units),
          attEff: eff(owner), defEff: eff(defender),
          playerSide: pAtt ? 'attacker' : 'defender',
          seed: (G.seed * 31 + to.id * 7919 + G.turn * 131) >>> 0,
        });
      } else {
        result = autoResolve(units, to.units, to, owner, defender);
        const win = (result.winner === 'attacker') === pAtt;
        const lossA = U.zeroUnits(), lossD = U.zeroUnits();
        U.TYPES.forEach((t) => { lossA[t] = units[t] - result.attSurv[t]; lossD[t] = to.units[t] - result.defSurv[t]; });
        LOL.audio.play(win ? 'victory' : 'defeat');
        await UI.modal(win ? 'ZAFER' : 'YENİLGİ', `<p style="text-align:center;color:var(--muted)">${U.esc(to.name)} muharebesi</p>
          <table><tr><th>Taraf</th><th>Kayıplar</th></tr>
          <tr><td>${UI.flag(nation(owner), 14)}${U.esc(nation(owner).name)}</td><td>${U.unitsText(lossA)}</td></tr>
          <tr><td>${UI.flag(nation(defender), 14)}${U.esc(nation(defender).name)}</td><td>${U.unitsText(lossD)}</td></tr></table>`,
        [{ label: 'Devam', value: 1, cls: 'primary' }], { cls: win ? 'win' : 'lose' });
      }
    } else {
      if (map.kind !== 'world') await U.sleep(120);
      result = autoResolve(units, to.units, to, owner, defender);
    }
    applyResult(from, to, owner, defender, result);
    checkGameOver();
  }

  function applyResult(from, to, att, def, r) {
    const involved = isPlayer(att) || isPlayer(def);
    if (r.winner === 'attacker') {
      const dsurv = r.defSurv || U.zeroUnits();
      if (U.sumUnits(dsurv) > 0) {
        const ref = to.neighbors.map(P).find((q) => q.owner === def);
        if (ref) U.TYPES.forEach((t) => { ref.units[t] += dsurv[t]; });
      }
      capture(to, att, r.attSurv);
      if (involved || map.kind !== 'world') news('sword', isPlayer(att) ? '#3c7a3a' : isPlayer(def) ? '#a83226' : '#6a4a2a', `${nn(att)} ordusu ${U.esc(to.name)} bölgesini fethetti.`, involved ? `${nn(def)} savunması çöktü.` : '', involved);
    } else {
      to.units = U.copyUnits(r.defSurv);
      U.TYPES.forEach((t) => { to.ready[t] = Math.min(to.ready[t], to.units[t]); });
      const asurv = r.attSurv || U.zeroUnits();
      if (from.owner === att) U.TYPES.forEach((t) => { from.units[t] += asurv[t]; });
      if (involved) news('fort', isPlayer(def) ? '#3c7a3a' : '#a83226', `${U.esc(to.name)} önünde ${nn(att)} taarruzu püskürtüldü.`, `${nn(def)} hatlarını korudu.`, true);
      dirty = true;
    }
  }

  function checkGameOver() {
    if (phase === 'over') return true;
    if (!nation(G.playerId).alive) {
      phase = 'over';
      LOL.audio.play('defeat');
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      UI.modal('İMPARATORLUK ÇÖKTÜ', `<p style="text-align:center">${U.esc(nation(G.playerId).name)} son toprağını da kaybetti.<br>${dateStr(G.turn)} tarihinde tarih sayfalarına gömüldün.</p>`,
        [{ label: 'Ana Menü', value: 1, cls: 'primary' }], { cls: 'lose' }).then(() => LOL.app.toMenu());
      return true;
    }
    const others = G.nations.filter((n) => n.alive && n.id !== G.playerId && !allied(n.id, G.playerId));
    if (!others.length) {
      phase = 'over';
      LOL.audio.play('victory');
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      UI.modal('DÜNYA SENİN', `<p style="text-align:center">${U.esc(nation(G.playerId).name)}, ${dateStr(G.turn)} itibarıyla dünyaya hükmediyor.<br>Efsanevi bir zafer!</p>`,
        [{ label: 'Ana Menü', value: 1, cls: 'primary' }], { cls: 'win' }).then(() => LOL.app.toMenu());
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- turns
  async function endTurn() {
    if (phase !== 'play') return;
    LOL.audio.play('turn');
    sel = -1; dirty = true;
    S.setPhase('busy', true);
    for (const n of G.nations) {
      if (!n.alive || isPlayer(n.id)) continue;
      U.el('busy-text').innerHTML = `${UI.flag(n, 12)} ${U.esc(n.name)} hamle yapıyor...`;
      await aiTurn(n);
      if (phase === 'over') return;
      if (checkGameOver()) return;
    }
    await newRound();
    if (phase === 'over') return;
    S.setPhase('play');
    await maybeEvent();
    updatePanel(); updateTop();
    save(true);
  }

  async function newRound() {
    G.turn++;
    for (const n of G.nations) {
      if (!n.alive) continue;
      const ec = economy(n.id);
      n.gold += ec.net;
      n.manpower = Math.min(40000, n.manpower + ec.mp);
      n.stability = U.clamp(n.stability + ec.stabD, 0, 100);
      if (n.gold < -40) {
        const big = provsOf(n.id).sort((a, b) => U.sumUnits(b.units) - U.sumUnits(a.units))[0];
        if (big) { const t = big.units.tank > 0 ? 'tank' : big.units.art > 0 ? 'art' : 'inf'; if (big.units[t] > 0) big.units[t]--; }
        n.stability = Math.max(0, n.stability - 2);
        if (isPlayer(n.id)) UI.toast('Hazine iflas etti! Maaş alamayan birlikler firar ediyor.', 'bad');
      }
      // research
      if (n.research.cur) {
        n.research.prog += ec.rp;
        const t = TECH[n.research.cur];
        if (n.research.prog >= t.cost) {
          n.techs.push(t.id);
          n.research = { cur: null, prog: n.research.prog - t.cost };
          if (isPlayer(n.id)) { news('sci', '#2f6a8a', `Bilimsel atılım: <b>${t.name}</b>`, t.desc, true); LOL.audio.play('research'); }
        }
      }
      if (!isPlayer(n.id) && !n.research.cur) {
        const av = TECHS.filter((t) => !n.techs.includes(t.id) && (!t.req || n.techs.includes(t.req)));
        if (av.length) n.research.cur = av[Math.floor(Math.random() * av.length)].id;
      }
      // rebellions
      if (n.stability < 20 && Math.random() < 0.25) {
        const ps = provsOf(n.id).filter((p) => !p.isCapital);
        const p = ps[Math.floor(Math.random() * ps.length)];
        if (p) {
          p.units.inf = Math.max(0, p.units.inf - 3);
          n.gold -= 15;
          news('alert', '#9a5a1a', `${nn(n.id)} topraklarında isyan! ${U.esc(p.name)} karıştı.`, 'Düşük istikrar halkı sokaklara döktü.', isPlayer(n.id));
        }
      }
    }
    // construction
    G.provinces.forEach((p) => {
      if (p.queue && --p.queue.t <= 0) {
        p.buildings[p.queue.type]++;
        if (isPlayer(p.owner)) UI.toast(`${U.esc(p.name)}: ${BUILD[p.queue.type].name} tamamlandı (Seviye ${p.buildings[p.queue.type]})`, 'good');
        p.queue = null;
      }
      p.ready = U.copyUnits(p.units);
    });
    // relations drift
    for (const k in G.rel) G.rel[k] += G.rel[k] > 0 ? -0.5 : G.rel[k] < 0 ? 0.5 : 0;
    if (G.turn % 12 === 1) news('globe', '#5a4a8a', `${1936 + Math.floor((G.turn - 1) / 12)} yılı başladı`, 'Dünya liderleri yeni yıla gergin bir bekleyişle giriyor.', false);
    dirty = true;
  }

  async function aiTurn(n) {
    const me = n.id;
    const myPow = nationPower(me);
    const wars = enemiesOf(me);
    // --- diplomacy
    if (wars.length === 0 && G.turn >= 3 && Math.random() < (map.kind === 'world' ? 0.06 : 0.28)) {
      const cands = neighborNations(me).filter((o) => !truce(me, o) && !allied(me, o));
      let best = -1, br = 1e9;
      for (const o of cands) {
        let r = (nationPower(o) + alliesOf(o).reduce((s, a) => s + nationPower(a.id) * 0.5, 0)) / Math.max(1, myPow);
        r *= 1 + Math.max(0, rel(me, o)) / 60;
        if (isPlayer(o)) r *= 0.9 + Math.random() * 0.3;
        if (r < br) { br = r; best = o; }
      }
      if (best >= 0 && br < 1.1) {
        declareWar(me, best);
        if (isPlayer(best)) {
          const banner = `<div class="banner"><div class="bg" style="background:linear-gradient(120deg, ${U.shade(n.color, -0.3)}, #200a06)"></div><div class="big-ico">${UI.icon('sword', 80)}</div><div><div class="bk">Acil Telgraf</div><div class="bt">SAVAŞ İLANI</div></div></div>`;
          await UI.modal('', `<p class="event-text">"${U.esc(n.leader)} bu sabah radyodan halkına seslendi: ${U.esc(nation(best).name)} ile tüm diplomatik ilişkiler kesilmiştir. Ordularımız sınırı geçmeye hazırdır."</p><p>${nn(me)} sana savaş ilan etti! Sınırlarını savunmaya hazırlan.</p>`, [{ label: 'Silah Başına!', value: 1, cls: 'danger' }], { banner, width: 560 });
        }
      }
    } else if (wars.length) {
      for (const e of wars) {
        if (!(nationPower(e.id) > myPow * 1.5 && Math.random() < 0.3)) continue;
        if (isPlayer(e.id)) {
          const ok = await UI.modal('Barış Teklifi', `<p>${UI.flag(n, 16)}<b>${U.esc(n.name)}</b> elçisi beyaz bayrakla geldi. ${U.esc(n.leader)} barış istiyor.</p><p class="hint">Kabul edersen 8 ay boyunca birbirinize saldıramazsınız.</p>`,
            [{ label: 'Reddet', value: false }, { label: 'Kabul Et', value: true, cls: 'good' }]);
          if (ok) makePeace(me, e.id); else news('sword', '#7a3a2a', `${nn(e.id)}, ${nn(me)} barış teklifini reddetti.`, '', true);
        } else if (Math.random() < 0.5) makePeace(me, e.id);
      }
    }
    // alliances among AIs / offer to player
    if (Math.random() < (map.kind === 'world' ? 0.015 : 0.08)) {
      const cands = G.nations.filter((o) => o.alive && o.id !== me && !allied(me, o.id) && !atWar(me, o.id) && rel(me, o.id) > 35);
      const o = cands[Math.floor(Math.random() * cands.length)];
      if (o) {
        if (isPlayer(o.id)) {
          const ok = await UI.modal('İttifak Teklifi', `<p>${UI.flag(n, 16)}<b>${U.esc(n.name)}</b> sana askerî ittifak öneriyor.</p><p class="hint">Müttefikler, birbirlerine savaş açan ulusa karşı birlikte savaşır.</p>`,
            [{ label: 'Reddet', value: false }, { label: 'İttifak Kur', value: true, cls: 'good' }]);
          if (ok) makeAlliance(me, o.id); else addRel(me, o.id, -10);
        } else makeAlliance(me, o.id);
      }
    }
    // --- buildings
    const mine = provsOf(me);
    if (!mine.length) return;
    const enemyIds = new Set(enemiesOf(me).map((e) => e.id));
    const isFront = (p) => p.neighbors.some((q) => enemyIds.has(P(q).owner));
    if (n.gold > 90 && Math.random() < 0.5) {
      const p = mine[Math.floor(Math.random() * mine.length)];
      const t = isFront(p) ? 'fort' : Math.random() < 0.7 ? 'fac' : 'bar';
      build(p, t);
    }
    // --- recruitment
    const isBorder = (p) => p.neighbors.some((q) => P(q).owner !== me);
    let front = mine.filter(isFront);
    if (!front.length) front = mine.filter(isBorder);
    if (!front.length) front = mine;
    const reserve = enemyIds.size ? 10 : 35;
    for (let guard = 0; guard < 40 && n.gold - reserve >= C.cost.inf && n.manpower >= MP_COST.inf; guard++) {
      const r = Math.random();
      const pool = [['inf', 30], ['mg', 8], ['at', 9], ['recon', 6], ['tank', 20], ['heavy', 6], ['art', 12], ['rocket', 5]].filter(([k]) => !C.req[k] || n.techs.includes(C.req[k]));
      let rr = r * pool.reduce((s2, x) => s2 + x[1], 0), t = 'inf';
      for (const [k, w] of pool) { rr -= w; if (rr <= 0) { t = k; break; } }
      const p = front.sort((a, b) => threat(b, me) - threat(a, me) + (Math.random() - 0.5) * 4)[0];
      if (n.gold - reserve < unitCost(me, t, p) || n.manpower < MP_COST[t]) t = 'inf';
      if (!recruit(p, t, 1)) break;
    }
    // --- attacks
    const order = mine.slice().sort((a, b) => powerOf(b.ready) - powerOf(a.ready));
    for (const p of order) {
      if (p.owner !== me || powerOf(p.ready) < 2) continue;
      let best = null, bs = 0;
      for (const q of p.neighbors.map(P)) {
        if (q.owner === me || !atWar(me, q.owner)) continue;
        const dp = powerOf(q.units, q.owner) * defBonus(q);
        const ratio = powerOf(p.ready, me) / Math.max(0.5, dp);
        const score = ratio + (q.isCapital ? 0.3 : 0) + q.income * 0.03;
        if (ratio > 1.3 && score > bs) { bs = score; best = q; }
      }
      if (best) {
        const units = U.copyUnits(p.ready);
        if (threat(p, me) > 0 && units.inf > 1) units.inf -= 1;
        if (U.sumUnits(units) === 0) continue;
        await moveArmy(p, best, units);
        if (phase === 'over') return;
      }
    }
    // --- reinforce toward the front
    const q0 = provsOf(me).filter(isFront);
    if (q0.length) {
      const dist = new Map(), queue = [];
      q0.forEach((p) => { dist.set(p.id, 0); queue.push(p); });
      while (queue.length) {
        const p = queue.shift();
        for (const q of p.neighbors.map(P)) {
          if (q.owner !== me || dist.has(q.id)) continue;
          dist.set(q.id, dist.get(p.id) + 1); queue.push(q);
        }
      }
      for (const p of provsOf(me)) {
        const d = dist.get(p.id);
        if (!d || U.sumUnits(p.ready) === 0) continue;
        const next = p.neighbors.map(P).filter((q) => q.owner === me && dist.get(q.id) === d - 1)[0];
        if (!next) continue;
        const units = U.copyUnits(p.ready);
        if (units.inf > 0) units.inf -= 1;
        if (U.sumUnits(units) === 0) continue;
        await moveArmy(p, next, units);
      }
    }
  }
  function threat(p, me) {
    let t = 0;
    for (const q of p.neighbors.map(P)) if (q.owner !== me && atWar(me, q.owner)) t += powerOf(q.units);
    return t - powerOf(p.units) * 0.5;
  }

  // ---------------------------------------------------------------- random events
  const EVENTS = [
    { id: 'harvest', w: 3, ico: 'gold', col: '#7a6a1a', title: 'Bereketli Hasat', text: () => 'Tarlalar bu yıl altın gibi parlıyor. Ambarlar taşıyor, köylüler bayram ediyor.',
      opts: (n) => [{ label: 'Hazineye aktar (+40 altın)', fn: () => { n.gold += 40; } }, { label: 'Halka dağıt (+8 istikrar)', fn: () => { n.stability = Math.min(100, n.stability + 8); } }] },
    { id: 'strike', w: 2, ico: 'alert', col: '#8a3a1a', title: 'Fabrikalarda Grev', text: () => 'Sanayi işçileri daha yüksek ücret talebiyle üretimi durdurdu. Başkentte gergin bekleyiş.',
      opts: (n) => [{ label: 'Taleplerini karşıla (−35 altın)', fn: () => { n.gold -= 35; } }, { label: 'Grevi dağıt (−10 istikrar)', fn: () => { n.stability = Math.max(0, n.stability - 10); } }] },
    { id: 'volunteers', w: 2, ico: 'man', col: '#2a5a8a', title: 'Gönüllü Akını', cond: (n) => enemiesOf(n.id).length > 0, text: () => 'Savaş haberleri yayıldıkça binlerce genç orduya katılmak için askerlik şubelerine akın etti.',
      opts: (n) => [{ label: 'Kabul et (+4000 insan gücü)', fn: () => { n.manpower += 4000; } }] },
    { id: 'science', w: 2, ico: 'sci', col: '#2a6a7a', title: 'Üniversitede Buluş', cond: (n) => n.research.cur, text: () => 'Başkent üniversitesindeki genç bir mühendis, araştırmalarımızı hızlandıracak bir yöntem geliştirdi.',
      opts: (n) => [{ label: 'Projeye fon ayır (−20 altın, +25 araştırma)', fn: () => { n.gold -= 20; n.research.prog += 25; } }, { label: 'Şimdilik değil', fn: () => {} }] },
    { id: 'border', w: 2, ico: 'sword', col: '#8a2a1a', title: 'Sınır Olayı', cond: (n) => neighborNations(n.id).some((o) => !atWar(n.id, o) && !allied(n.id, o) && !truce(n.id, o)),
      text: (n, ctx2) => `${U.esc(nation(ctx2.o).name)} sınır devriyesi karakollarımıza ateş açtı. Halk misilleme talep ediyor.`,
      prep: (n) => { const os = neighborNations(n.id).filter((o) => !atWar(n.id, o) && !allied(n.id, o) && !truce(n.id, o)); return { o: os[Math.floor(Math.random() * os.length)] }; },
      opts: (n, c) => [{ label: `${nation(c.o).name}'ya savaş ilan et`, cls: 'danger', fn: () => declareWar(n.id, c.o) }, { label: 'Diplomatik nota ver (−4 istikrar)', fn: () => { n.stability = Math.max(0, n.stability - 4); addRel(n.id, c.o, -15); } }] },
    { id: 'plague', w: 1, ico: 'skull', col: '#4a5a2a', title: 'Salgın Hastalık', text: () => 'Kalabalık kışlalarda ateşli bir hastalık yayılıyor. Doktorlar karantina öneriyor.',
      opts: (n) => [{ label: 'Karantina uygula (−30 altın)', fn: () => { n.gold -= 30; } }, { label: 'Görmezden gel (−%25 insan gücü, −5 istikrar)', fn: () => { n.manpower = Math.round(n.manpower * 0.75); n.stability = Math.max(0, n.stability - 5); } }] },
    { id: 'invest', w: 2, ico: 'factory', col: '#5a4a2a', title: 'Yabancı Sermaye', text: () => 'Denizaşırı bir sanayici, başkentimizde modern bir fabrika kurmayı teklif ediyor.',
      opts: (n) => [{ label: 'Kabul et (−50 altın, başkente Fabrika)', fn: () => { n.gold -= 50; const c = P(n.capital); if (c && c.buildings.fac < 3) c.buildings.fac++; } }, { label: 'Ulusal sanayiyi koru (+3 istikrar)', fn: () => { n.stability = Math.min(100, n.stability + 3); } }] },
    { id: 'rally', w: 2, ico: 'flag', col: '#7a1a2a', title: 'Büyük Miting', cond: (n) => enemiesOf(n.id).length > 0, text: (n) => `${U.esc(n.leader)} başkentin meydanında yüz binlere seslendi. Kalabalık ulusal marşı söylüyor.`,
      opts: (n) => [{ label: 'Coşkuyu körükle (+10 istikrar)', fn: () => { n.stability = Math.min(100, n.stability + 10); } }, { label: 'Savaş tahvili sat (+45 altın)', fn: () => { n.gold += 45; } }] },
    { id: 'spy', w: 1, ico: 'alert', col: '#3a3a5a', title: 'Casusluk Skandalı', cond: (n) => G.nations.some((o) => o.alive && o.id !== n.id),
      prep: (n) => { const os = G.nations.filter((o) => o.alive && o.id !== n.id); return { o: os[Math.floor(Math.random() * os.length)].id }; },
      text: (n, c) => `Bakanlıkta ${U.esc(nation(c.o).name)} adına çalışan bir casus yakalandı. Gazeteler manşetten veriyor.`,
      opts: (n, c) => [{ label: 'Kamuoyuna açıkla (ilişki −25, +4 istikrar)', fn: () => { addRel(n.id, c.o, -25); n.stability = Math.min(100, n.stability + 4); } }, { label: 'Sessizce takas et (+15 ilişki)', fn: () => { addRel(n.id, c.o, 15); } }] },
    { id: 'drought', w: 1, ico: 'alert', col: '#8a6a2a', title: 'Kuraklık', text: () => 'Aylardır yağmur yağmıyor. Tahıl fiyatları fırladı, köylerde huzursuzluk var.',
      opts: (n) => [{ label: 'Tahıl ithal et (−30 altın)', fn: () => { n.gold -= 30; } }, { label: 'Karne uygula (−8 istikrar)', fn: () => { n.stability = Math.max(0, n.stability - 8); } }] },
    { id: 'deserters', w: 2, ico: 'man', col: '#5a2a2a', cond: (n) => n.stability < 40 && provsOf(n.id).some((p) => p.units.inf > 2), title: 'Asker Kaçakları',
      text: () => 'Cephedeki moral çöktü. Bazı birlikler silahlarını bırakıp köylerine dönüyor.',
      opts: (n) => [{ label: 'Divan-ı harp kur (−5 istikrar)', fn: () => { n.stability = Math.max(0, n.stability - 5); } }, { label: 'Affet (birlik kaybı)', fn: () => { provsOf(n.id).forEach((p) => { if (p.units.inf > 2 && Math.random() < 0.5) p.units.inf--; }); n.stability = Math.min(100, n.stability + 3); } }] },
  ];
  async function maybeEvent() {
    if (G.turn < 3 || Math.random() > 0.32 || phase !== 'play') return;
    const n = nation(G.playerId);
    const pool = EVENTS.filter((e) => !e.cond || e.cond(n));
    const total = pool.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total, ev = pool[0];
    for (const e of pool) { r -= e.w; if (r <= 0) { ev = e; break; } }
    if (!ev) return;
    const c = ev.prep ? ev.prep(n) : {};
    if (ev.prep && (c.o == null)) return;
    const opts = ev.opts(n, c);
    LOL.audio.play('event');
    const banner = `<div class="banner"><div class="bg" style="background:linear-gradient(120deg, ${ev.col}, #0d1118 70%)"></div><div class="big-ico">${UI.icon(ev.ico, 80)}</div><div><div class="bk">${dateStr(G.turn)} · Olay</div><div class="bt">${ev.title}</div></div></div>`;
    const v = await UI.modal('', `<p class="event-text">${ev.text(n, c)}</p>`, opts.map((o, i) => ({ label: o.label, value: i, cls: o.cls || (i === 0 ? 'primary' : '') })), { banner, width: 560 });
    opts[v].fn();
    news(ev.ico, ev.col, ev.title, opts[v].label, true);
    dirty = true; updateTop(); updatePanel();
  }

  // ---------------------------------------------------------------- top bar & panels
  function updateTop() {
    if (!G || G.playerId < 0) {
      if (LOL.advisor) LOL.advisor.refresh();
      U.el('tb-nation').style.visibility = 'hidden';
      U.el('tb-date').textContent = G ? dateStr(G.turn) : '';
      U.el('tb-wars').innerHTML = '';
      return;
    }
    U.el('tb-nation').style.visibility = 'visible';
    const n = nation(G.playerId), ec = economy(G.playerId);
    U.el('tb-flag').src = UI.flagURL(n);
    U.el('tb-name').textContent = n.name;
    U.el('tb-gov').textContent = n.gov + ' · ' + n.leader;
    const cur = n.research.cur ? TECH[n.research.cur] : null;
    const chip = (ico, col, lbl, v, d, title, bar) => `<div class="chip" title="${title}">${UI.icon(ico, 20, col)}<div><div class="lbl">${lbl}</div><div class="v">${v}${d != null ? ` <span class="d${String(d).startsWith('-') || String(d).startsWith('−') ? ' neg' : ''}">${d}</span>` : ''}</div></div>${bar != null ? `<div class="bar"><i style="width:${bar}%"></i></div>` : ''}</div>`;
    U.el('tb-res').innerHTML =
      chip('gold', null, 'Hazine', Math.floor(n.gold), (ec.net >= 0 ? '+' : '') + ec.net, `Gelir ${ec.inc} − Bakım ${ec.up}`) +
      chip('man', '#9fc3e8', 'İnsan Gücü', fmtK(n.manpower), '+' + fmtK(ec.mp), 'Asker toplamak için gereken nüfus') +
      chip('stab', n.stability > 50 ? '#7fd08a' : n.stability > 25 ? '#e8c050' : '#e8604a', 'İstikrar', Math.round(n.stability) + '%', (ec.stabD >= 0 ? '+' : '') + ec.stabD, 'Düşük istikrar gelir kaybı ve isyan getirir. Savaşlar istikrarı düşürür.') +
      chip('sci', '#8ad0e0', 'Araştırma', cur ? Math.floor(n.research.prog) + '/' + cur.cost : '—', '+' + ec.rp, cur ? 'Araştırılıyor: ' + cur.name : 'Araştırma seçilmedi!', cur ? n.research.prog / cur.cost * 100 : 0) +
      chip('army', '#d89a7a', 'Ordu Gücü', Math.round(nationPower(G.playerId)), null, 'Toplam askerî güç');
    U.el('tb-date').textContent = dateStr(G.turn);
    const ws = enemiesOf(G.playerId), al = alliesOf(G.playerId);
    U.el('tb-wars').innerHTML = (ws.length ? '<span class="war">⚔ ' + ws.map((w) => U.esc(w.name)).join(', ') + '</span>' : '<span class="peace">Barış</span>') +
      (al.length ? ' · <span style="color:#a8d8ff">🤝 ' + al.map((w) => U.esc(w.name)).join(', ') + '</span>' : '');
    U.el('endturn-label').textContent = MONTHS[G.turn % 12];
    if (LOL.advisor) LOL.advisor.refresh();
    U.el('endturn-info').textContent = cur ? '' : 'Araştırma seçilmedi';
    if (!cur) U.el('endturn-info').innerHTML = '<span style="color:#e8c050">⚠ Araştırma seçilmedi</span>';
  }

  function updatePanel() {
    const el = U.el('prov-panel');
    if (!G || sel < 0 || phase === 'menu') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const p = P(sel), n = nation(p.owner);
    if (phase === 'pick') {
      const ps = provsOf(n.id), ec = economy(n.id);
      el.innerHTML = `<div class="pp-head"><div class="tint" style="background:${n.color}"></div>
        <div class="nat-head" style="margin:0"><img class="flagimg" src="${UI.flagURL(n)}" style="width:72px;height:48px"><div><div class="pp-title">${U.esc(n.name)}</div><div class="pp-sub">${n.gov}</div></div></div></div>
        <div class="pp-body"><div class="hint" style="margin:0 0 10px">${U.esc(n.leader)}</div>
        <div class="stat-grid">
          <div class="stat"><div class="k">Bölgeler</div><div class="v">${ps.length}</div></div>
          <div class="stat"><div class="k">Başkent</div><div class="v" style="font-size:13px">${U.esc(P(n.capital).name)}</div></div>
          <div class="stat"><div class="k">Aylık Gelir</div><div class="v">+${ec.net}</div></div>
          <div class="stat"><div class="k">Ordu Gücü</div><div class="v">${Math.round(nationPower(n.id))}</div></div>
          <div class="stat"><div class="k">Nüfus</div><div class="v">${fmtK(ps.reduce((s, q) => s + q.pop, 0) * 1000)}</div></div>
          <div class="stat"><div class="k">Komşular</div><div class="v">${neighborNations(n.id).length}</div></div>
        </div>
        <button class="primary" data-act="start" style="width:100%;padding:12px;font-size:15px;font-family:var(--serif)">Bu Ulusu Yönet</button></div>`;
      return;
    }
    const own = p.owner === G.playerId;
    const me = G.playerId;
    let tag = '';
    if (!own) tag = atWar(me, p.owner) ? '<span class="tag war">SAVAŞ</span>' : allied(me, p.owner) ? '<span class="tag ally">MÜTTEFİK</span>' : truce(me, p.owner) ? '<span class="tag peace">ATEŞKES</span>' : '<span class="tag">BARIŞ</span>';
    const head = `<div class="pp-head"><div class="tint" style="background:${n.color}"></div><button class="pp-close" data-act="close">×</button>
      <div class="pp-title">${U.esc(p.name)}${p.isCapital ? ' <span style="color:#ffd860">★</span>' : ''}</div>
      <div class="pp-sub">${UI.flag(n, 14)}${U.esc(n.name)} ${tag} <span class="tag gold">${p.terrain}</span></div></div>`;
    const tabs = own ? ['genel', 'ordu', 'insa'] : ['genel'];
    if (!tabs.includes(selTab)) selTab = 'genel';
    const tabNames = { genel: 'Genel', ordu: 'Ordu', insa: 'İnşaat' };
    let body = '';
    if (selTab === 'genel') {
      body += `<div class="stat-grid">
        <div class="stat"><div class="k">Gelir</div><div class="v">+${p.income + p.buildings.fac * 2 + (p.isCapital ? C.capitalBonus : 0)}</div></div>
        <div class="stat"><div class="k">Nüfus</div><div class="v">${p.pop}B</div></div>
        <div class="stat"><div class="k">Savunma</div><div class="v">×${defBonus(p).toFixed(2)}</div></div>
        <div class="stat"><div class="k">Binalar</div><div class="v" style="font-size:12px">${Object.keys(BUILD).map((k) => `${UI.icon(BUILD[k].ico, 14)}${p.buildings[k]}`).join(' ')}</div></div></div>
        <div class="sect-title">Garnizon</div>
        ${U.sumUnits(p.units) ? `<div class="units-row">${U.TYPES.filter((t) => p.units[t] > 0).map((t) => `<div class="ucard" title="${C.unitName[t]}: ${C.unitDesc[t]}"><img src="${UI.unitIcon(t, n.color)}"><div class="n">${p.units[t]}</div><div class="t">${C.unitShort[t]}${own ? ` <span class="r">${p.ready[t]} hazır</span>` : ''}</div></div>`).join('')}</div>` : '<div class="hint">Garnizon yok — bölge savunmasız!</div>'}`;
      if (own && U.sumUnits(p.ready) > 0) body += sendHtml(p);
      if (!own && phase === 'play') {
        body += `<div class="sect-title">Diplomasi</div><div class="row"><span>İlişki</span><b>${rel(me, p.owner)}</b></div><div class="btnrow">` +
          (atWar(me, p.owner) ? `<button data-act="peace">Barış Teklif Et</button>`
            : truce(me, p.owner) ? `<span class="hint">Ateşkes: ${G.truce[key(me, p.owner)] - G.turn} ay</span>`
              : allied(me, p.owner) ? '<span class="hint">Müttefikin</span>' : `<button class="danger" data-act="war">Savaş İlan Et</button>`) + '</div>';
      }
    } else if (selTab === 'ordu') {
      const nat = nation(me);
      body += `<div class="sect-title">Asker Topla</div><div class="rec-grid">${U.TYPES.map((t) => {
        const c = unitCost(me, t, p);
        const lock = C.req[t] && !nat.techs.includes(C.req[t]);
        const dis = lock || nat.gold < c || nat.manpower < MP_COST[t] || phase !== 'play';
        return `<button data-act="rec" data-t="${t}" ${dis ? 'disabled' : ''} title="${C.unitName[t]} — ${C.unitDesc[t]}${lock ? ' (Gerekli teknoloji: ' + TECH[C.req[t]].name + ')' : ''}"><img src="${UI.unitIcon(t, n.color)}"><span>${C.unitShort[t]}</span>${lock ? `<small class="mp">🔒 ${TECH[C.req[t]].name}</small>` : `<small>${c} altın</small><small class="mp">${fmtK(MP_COST[t])} kişi</small>`}</button>`;
      }).join('')}</div><div class="hint">Shift+tık: 5 adet. Yeni birlikler gelecek ay hareket edebilir. Birliklerin üzerine gelince açıklamasını görürsün.</div>`;
      if (U.sumUnits(p.ready) > 0) body += sendHtml(p);
    } else if (selTab === 'insa') {
      const nat = nation(me);
      body += Object.keys(BUILD).map((k) => {
        const b = BUILD[k], lvl = p.buildings[k];
        const inQ = p.queue && p.queue.type === k;
        const maxed = lvl >= b.max;
        const cost = b.cost(lvl);
        return `<div class="bld"><div class="bi">${UI.icon(b.ico, 22)}</div>
          <div><div class="bn">${b.name}<span class="lvl">${Array.from({ length: b.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></div><div class="bd">${b.desc}</div>
          ${inQ ? `<div class="prog"><i style="width:${(2 - p.queue.t) / 2 * 100}%"></i></div><div class="bd">İnşa ediliyor — ${p.queue.t} ay</div>` : ''}</div>
          ${maxed ? '<span class="tag gold">MAKS</span>' : inQ ? '' : `<button data-act="build" data-b="${k}" ${nat.gold < cost || p.queue || phase !== 'play' ? 'disabled' : ''}>${cost} ${UI.icon('gold', 14)}</button>`}</div>`;
      }).join('') + '<div class="hint">Bir bölgede aynı anda tek inşaat yapılabilir. İnşaat 2 ay sürer.</div>';
    }
    el.innerHTML = head + (tabs.length > 1 ? `<div class="tabs">${tabs.map((t) => `<button data-tab="${t}" class="${t === selTab ? 'on' : ''}">${tabNames[t]}</button>`).join('')}</div>` : '') + `<div class="pp-body">${body}</div>`;
  }
  function sendHtml(p) {
    return `<div class="sect-title">Sefer Kuvveti</div>
      ${U.TYPES.filter((t) => p.ready[t] > 0).map((t) => `<div class="send-row"><span>${C.unitShort[t]}</span><input type="range" min="0" max="${p.ready[t]}" value="${Math.min(send[t], p.ready[t])}" data-send="${t}"><b id="sv-${t}">${Math.min(send[t], p.ready[t])}</b></div>`).join('')}
      <div class="hint">Haritada komşu bir bölgeye <b>sağ tıkla</b>. Düşman bölgesine gönderirsen muharebe başlar.</div>`;
  }

  async function panelAction(act, target, e) {
    if (act === 'start') { startGame(P(sel).owner); return; }
    if (act === 'close') { sel = -1; dirty = true; updatePanel(); return; }
    if (phase !== 'play' || sel < 0) return;
    const p = P(sel);
    if (act === 'rec') {
      const t = target.dataset.t;
      const n = recruit(p, t, e.shiftKey ? 5 : 1);
      if (n) UI.toast(`${U.esc(p.name)}: ${n} ${C.unitName[t]} saflara katıldı.`, 'good');
    } else if (act === 'build') {
      if (build(p, target.dataset.b)) UI.toast(`${U.esc(p.name)}: ${BUILD[target.dataset.b].name} inşaatı başladı.`);
    } else if (act === 'war') {
      const ok = await UI.modal('Savaş İlanı', `${nn(p.owner)} ulusuna savaş ilan edilsin mi? <span class="hint">(İstikrar −5)</span>`, [{ label: 'Vazgeç', value: false }, { label: 'Savaş İlan Et', value: true, cls: 'danger' }]);
      if (ok) { declareWar(G.playerId, p.owner); nation(G.playerId).stability = Math.max(0, nation(G.playerId).stability - 5); }
    } else if (act === 'peace') {
      await proposePeace(p.owner);
    }
    updatePanel(); updateTop();
  }

  async function proposePeace(o) {
    const mp = nationPower(G.playerId), op = nationPower(o);
    if (op < mp * 0.8 || Math.random() < 0.2 + rel(G.playerId, o) / 200) {
      makePeace(G.playerId, o);
      await UI.modal('Barış', `${nn(o)} barış teklifini kabul etti.`, [{ label: 'Tamam', value: 1, cls: 'primary' }]);
    } else {
      await UI.modal('Barış Reddedildi', `${nn(o)} teklifini reddetti. Önce sahada üstünlük kurmalısın.`, [{ label: 'Tamam', value: 1 }]);
    }
  }

  function diplomacy() {
    const me = G.playerId;
    const relBar = (r) => `<span class="relbar"><i style="left:${r >= 0 ? 50 : 50 + r / 2}%;width:${Math.abs(r) / 2}%;background:${r >= 0 ? '#63c46a' : '#e2533f'}"></i></span> <small>${Math.round(r)}</small>`;
    const rows = G.nations.filter((n) => n.alive && n.id !== me).map((n) => {
      const st = atWar(me, n.id) ? '<span class="tag war">SAVAŞ</span>' : allied(me, n.id) ? '<span class="tag ally">MÜTTEFİK</span>' : truce(me, n.id) ? `<span class="tag peace">ATEŞKES ${G.truce[key(me, n.id)] - G.turn}</span>` : '<span class="tag">BARIŞ</span>';
      const acts = [];
      acts.push(`<button data-dip="gift" data-n="${n.id}" ${nation(me).gold < 25 ? 'disabled' : ''} title="25 altın, ilişki +15">Hediye</button>`);
      if (atWar(me, n.id)) acts.push(`<button data-dip="peace" data-n="${n.id}">Barış</button>`);
      else if (allied(me, n.id)) acts.push(`<button data-dip="break" data-n="${n.id}">İttifakı Boz</button>`);
      else {
        acts.push(`<button class="good" data-dip="ally" data-n="${n.id}" ${rel(me, n.id) < 40 ? 'disabled title="İlişki en az 40 olmalı"' : ''}>İttifak</button>`);
        if (!truce(me, n.id)) acts.push(`<button class="danger" data-dip="war" data-n="${n.id}">Savaş</button>`);
      }
      return `<tr><td>${UI.flag(n, 16)}<b>${U.esc(n.name)}</b><div class="hint" style="margin:0;font-size:10.5px">${n.gov}</div></td><td>${provsOf(n.id).length}</td><td>${Math.round(nationPower(n.id))}</td><td>${relBar(rel(me, n.id))}</td><td>${st}</td><td><div class="dip-actions">${acts.join('')}</div></td></tr>`;
    }).join('');
    const body = `<table><tr><th>Ulus</th><th>Bölge</th><th>Güç</th><th>İlişki</th><th>Durum</th><th></th></tr>
      <tr style="background:rgba(214,178,94,.07)"><td>${UI.flag(nation(me), 16)}<b>${U.esc(nation(me).name)}</b> (sen)</td><td>${provsOf(me).length}</td><td>${Math.round(nationPower(me))}</td><td></td><td></td><td></td></tr>${rows}</table>`;
    UI.modal('Diplomasi', body, [{ label: 'Kapat', value: 0 }], {
      width: 760, closeOnBack: true,
      onMount: (wrap, close) => {
        wrap.querySelectorAll('[data-dip]').forEach((b) => {
          b.onclick = async () => {
            LOL.audio.play('click');
            const o = +b.dataset.n, a = b.dataset.dip;
            close(0);
            if (a === 'war') { declareWar(me, o); nation(me).stability = Math.max(0, nation(me).stability - 5); }
            else if (a === 'peace') await proposePeace(o);
            else if (a === 'gift') { nation(me).gold -= 25; addRel(me, o, 15); UI.toast(`${U.esc(nation(o).name)} hediyeni memnuniyetle kabul etti.`, 'good'); LOL.audio.play('coin'); }
            else if (a === 'ally') {
              if (rel(me, o) > 40 && (Math.random() < 0.4 + rel(me, o) / 150)) makeAlliance(me, o);
              else { UI.toast(`${U.esc(nation(o).name)} ittifak teklifini geri çevirdi.`, 'bad'); addRel(me, o, -5); }
            } else if (a === 'break') { G.allies.delete(key(me, o)); addRel(me, o, -30); news('handshake', '#5a4a3a', `${nn(me)} ile ${nn(o)} arasındaki ittifak sona erdi.`, '', true); }
            updatePanel(); updateTop(); dirty = true;
            if (a !== 'peace') diplomacy();
          };
        });
      },
    });
  }

  function techScreen() {
    const n = nation(G.playerId), ec = economy(G.playerId);
    const branches = [...new Set(TECHS.map((t) => t.br))];
    const card = (t) => {
      const done = n.techs.includes(t.id), cur = n.research.cur === t.id;
      const locked = t.req && !n.techs.includes(t.req);
      const prog = cur ? `<div class="prog"><i style="width:${Math.min(100, n.research.prog / t.cost * 100)}%"></i></div>` : '';
      return `<div class="tech ${done ? 'done' : cur ? 'cur' : locked ? 'locked' : ''}" data-tech="${t.id}">
        <div class="tn">${t.name}</div><div class="td">${t.desc}</div>
        <div class="tc">${done ? '✔ Tamamlandı' : cur ? `Araştırılıyor ${Math.floor(n.research.prog)}/${t.cost}` : locked ? '🔒 ' + TECH[t.req].name : `${t.cost} puan · ~${Math.ceil(t.cost / Math.max(1, ec.rp))} ay`}</div>${prog}</div>`;
    };
    const body = `<p class="hint" style="margin-top:0">Aylık araştırma: <b>+${ec.rp}</b> puan (fabrikalar ve başkent artırır). Bir teknolojiye tıklayarak araştırmaya başla.</p>
      <div class="tech-grid">${branches.map((b) => `<div class="tech-col"><h4>${b}</h4>${TECHS.filter((t) => t.br === b).map(card).join('')}</div>`).join('')}</div>`;
    UI.modal('Teknoloji', body, [{ label: 'Kapat', value: 0 }], {
      width: 900, closeOnBack: true,
      onMount: (wrap, close) => {
        wrap.querySelectorAll('[data-tech]').forEach((el) => {
          el.onclick = () => {
            const t = TECH[el.dataset.tech];
            if (n.techs.includes(t.id) || (t.req && !n.techs.includes(t.req))) return;
            if (n.research.cur && n.research.cur !== t.id) n.research.prog = Math.floor(n.research.prog * 0.5);
            n.research.cur = t.id;
            LOL.audio.play('click');
            close(0); updateTop(); techScreen();
          };
        });
      },
    });
  }

  function nationScreen() {
    const me = G.playerId, n = nation(me), ec = economy(me);
    const ps = provsOf(me);
    const body = `<div class="nat-head"><img class="flagimg" src="${UI.flagURL(n)}"><div><div class="nn">${U.esc(n.name)}</div><div class="hint" style="margin:0">${n.gov} · ${U.esc(n.leader)}</div></div></div>
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat"><div class="k">Bölgeler</div><div class="v">${ps.length}</div></div>
        <div class="stat"><div class="k">Nüfus</div><div class="v">${fmtK(ps.reduce((s, q) => s + q.pop, 0) * 1000)}</div></div>
        <div class="stat"><div class="k">Fabrikalar</div><div class="v">${ps.reduce((s, q) => s + q.buildings.fac, 0)}</div></div>
        <div class="stat"><div class="k">Teknolojiler</div><div class="v">${n.techs.length}/${TECHS.length}</div></div></div>
      <div class="sect-title">Aylık Bütçe</div>
      <div class="row"><span>Vergi ve sanayi geliri</span><b style="color:var(--good)">+${ec.inc}</b></div>
      <div class="row"><span>Ordu bakımı</span><b style="color:var(--bad)">−${ec.up}</b></div>
      <div class="row" style="border-top:1px solid var(--line2);margin-top:4px;padding-top:6px"><span>Net</span><b>${ec.net >= 0 ? '+' : ''}${ec.net}</b></div>
      <div class="sect-title">Ulus Durumu</div>
      <div class="row"><span>İstikrar</span><b>${Math.round(n.stability)}% (${ec.stabD >= 0 ? '+' : ''}${ec.stabD}/ay)</b></div>
      <div class="row"><span>İnsan gücü</span><b>${fmtK(n.manpower)} (+${fmtK(ec.mp)}/ay)</b></div>
      <div class="row"><span>Araştırma</span><b>+${ec.rp}/ay</b></div>
      <div class="row"><span>Savaşlar</span><b>${enemiesOf(me).map((x) => U.esc(x.name)).join(', ') || '—'}</b></div>
      <div class="row"><span>Müttefikler</span><b>${alliesOf(me).map((x) => U.esc(x.name)).join(', ') || '—'}</b></div>
      <p class="hint">İstikrar, gelir ve insan gücünü etkiler. Her aktif savaş istikrarı düşürür; %20'nin altında isyanlar başlar.</p>`;
    UI.modal('', body, [{ label: 'Kapat', value: 0 }], { width: 560, closeOnBack: true });
  }

  S.settings = function () {
    const A = LOL.audio;
    const body = `<div class="slider-row"><span>Ana ses</span><input type="range" min="0" max="100" value="${A.vol.master * 100}" data-v="master"><b>${Math.round(A.vol.master * 100)}</b></div>
      <div class="slider-row"><span>Müzik</span><input type="range" min="0" max="100" value="${A.vol.music * 100}" data-v="music"><b>${Math.round(A.vol.music * 100)}</b></div>
      <div class="slider-row"><span>Efektler</span><input type="range" min="0" max="100" value="${A.vol.sfx * 100}" data-v="sfx"><b>${Math.round(A.vol.sfx * 100)}</b></div>
      <div class="slider-row"><span>Ses açık</span><input type="checkbox" id="set-en" ${A.enabled ? 'checked' : ''}><span></span></div>
      <div class="slider-row"><span>Telsiz sesleri</span><input type="checkbox" id="set-voice" ${A.voice ? 'checked' : ''}><span class="hint" style="margin:0">${A.hasVoice() ? '' : 'Tarayıcında Türkçe ses yok'}</span></div>`;
    UI.modal('Ses Ayarları', body, [{ label: 'Tamam', value: 0, cls: 'primary' }], {
      closeOnBack: true,
      onMount: (wrap) => {
        wrap.querySelectorAll('[data-v]').forEach((r) => {
          r.oninput = () => { A.vol[r.dataset.v] = r.value / 100; r.nextElementSibling.textContent = r.value; A.applyVolumes(); A.saveSettings(); };
          r.onchange = () => A.play('click');
        });
        wrap.querySelector('#set-en').onchange = (e) => { A.enabled = e.target.checked; A.applyVolumes(); A.saveSettings(); };
        wrap.querySelector('#set-voice').onchange = (e) => { A.voice = e.target.checked; A.saveSettings(); };
      },
    });
  };

  // ---------------------------------------------------------------- game flow
  function startGame(nid) {
    G.playerId = nid;
    G.news = [];
    if (LOL.advisor) LOL.advisor.reset();
    const n = nation(nid);
    news('crown', '#a8741a', `${nn(nid)} hükümdarı göreve başladı`, `${U.esc(n.leader)}: "Atalarımızın topraklarını genişletmenin vakti geldi."`, true);
    news('globe', '#3a4a6a', 'Dünya gerginliğin eşiğinde', 'Sekiz büyük güç sınırlarına asker yığıyor. Diplomatlar barışı korumaya çalışıyor.', false);
    sel = n.capital;
    selTab = 'genel';
    send = U.copyUnits(P(sel).ready);
    dirty = true;
    S.setPhase('play');
    LOL.audio.play('event');
    save(true);
    setTimeout(() => {
      if (phase !== 'play') return;
      UI.modal('', `<p class="event-text">"Sayın ${U.esc(n.leader.split(' ')[0])}, kabine toplandı. Ülke sizden yön bekliyor."</p>
        <p><b>İlk adımlar:</b></p>
        <p>• Üst bardan <b>Teknoloji</b> açıp bir araştırma seç.<br>• Başkentini seçip <b>Ordu</b> sekmesinden asker topla, <b>İnşaat</b> sekmesinden fabrika kur.<br>• Komşu bir bölgeye <b>sağ tıklayarak</b> ordunu gönder.<br>• Hazır olduğunda <b>sağ alttaki</b> düğmeyle ayı bitir.</p>`,
      [{ label: 'Göreve Başla', value: 1, cls: 'primary' }], { width: 540, banner: `<div class="banner"><div class="bg" style="background:linear-gradient(120deg, ${U.shade(n.color, -0.3)}, #0d1118 70%)"></div><div class="big-ico">${UI.icon('crown', 80)}</div><div><div class="bk">${dateStr(1)}</div><div class="bt">${U.esc(n.name)}</div></div></div>` });
    }, 300);
  }

  S.startPick = function (kind) {
    S.pickKind = kind || S.pickKind || 'world';
    S.newMap((Math.random() * 1e9) >>> 0, S.pickKind);
    document.querySelectorAll('#pick-banner [data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === S.pickKind));
    U.el('btn-newmap').classList.toggle('hidden', S.pickKind === 'world');
    S.setPhase('pick');
  };

  function save(silent) {
    if (!G || G.playerId < 0) return;
    const data = {
      seed: G.seed, kind: G.kind, turn: G.turn, playerId: G.playerId,
      nations: G.nations.map((n) => ({ advisor: n.advisor, gold: n.gold, alive: n.alive, capital: n.capital, manpower: n.manpower, stability: n.stability, techs: n.techs, research: n.research, gov: n.gov, leader: n.leader, flagSeed: n.flagSeed })),
      provinces: G.provinces.map((p) => ({ o: p.owner, u: p.units, r: p.ready, c: p.isCapital, b: p.buildings, q: p.queue })),
      wars: [...G.wars], allies: [...G.allies], truce: G.truce, rel: G.rel, news: G.news.slice(0, 30),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) UI.toast('Oyun kaydedildi.', 'good');
    } catch (e) { if (!silent) UI.toast('Kayıt başarısız!', 'bad'); }
  }
  S.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  S.load = function () {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!data) return false;
    S.newMap(data.seed, data.kind);
    G.turn = data.turn; G.playerId = data.playerId;
    data.nations.forEach((d, i) => Object.assign(G.nations[i], d));
    data.provinces.forEach((d, i) => { const p = G.provinces[i]; p.owner = d.o; p.units = d.u; p.ready = d.r; p.isCapital = d.c; p.buildings = d.b; p.queue = d.q; });
    G.wars = new Set(data.wars); G.allies = new Set(data.allies || []); G.truce = data.truce || {}; G.rel = data.rel || {}; G.news = data.news || [];
    sel = -1; dirty = true;
    S.setPhase('play');
    renderNews();
    UI.toast('Kayıtlı oyun yüklendi.', 'good');
    return true;
  };

  S.bindUI = function () {
    document.querySelectorAll('[data-ico]').forEach((e) => { e.outerHTML = UI.icon(e.dataset.ico, 18); });
    U.el('btn-endturn').onclick = () => endTurn();
    U.el('btn-diplo').onclick = () => { LOL.audio.play('click'); diplomacy(); };
    U.el('btn-tech').onclick = () => { LOL.audio.play('click'); techScreen(); };
    U.el('tb-nation').onclick = () => { if (phase === 'play' || phase === 'busy') { LOL.audio.play('click'); nationScreen(); } };
    U.el('btn-save').onclick = () => { LOL.audio.play('click'); save(false); };
    U.el('btn-newmap').onclick = () => { LOL.audio.play('click'); S.startPick(); };
    document.querySelectorAll('#pick-banner [data-kind]').forEach((b) => { b.onclick = () => { LOL.audio.play('click'); U.el('pick-banner').classList.add('loading'); setTimeout(() => { S.startPick(b.dataset.kind); U.el('pick-banner').classList.remove('loading'); }, 30); }; });
    U.el('btn-sound').onclick = () => { LOL.audio.play('click'); S.settings(); };
    U.el('news-toggle').onclick = () => { U.el('news').classList.toggle('collapsed'); };
    U.el('btn-menu').onclick = async () => {
      LOL.audio.play('click');
      if (phase === 'busy') return;
      if (phase === 'play') {
        const ok = await UI.modal('Ana Menü', 'Oyun kaydedilip ana menüye dönülsün mü?', [{ label: 'Vazgeç', value: false }, { label: 'Kaydet ve Çık', value: true, cls: 'primary' }]);
        if (!ok) return;
        save(true);
      }
      sel = -1;
      LOL.app.toMenu();
    };
    U.el('mapmodes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      mapMode = b.dataset.mode;
      document.querySelectorAll('#mapmodes button').forEach((x) => x.classList.toggle('on', x === b));
      LOL.audio.play('select');
      dirty = true;
    });
    const panel = U.el('prov-panel');
    panel.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { selTab = tb.dataset.tab; LOL.audio.play('select'); updatePanel(); return; }
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) { LOL.audio.play('click'); panelAction(b.dataset.act, b, e); }
    });
    panel.addEventListener('input', (e) => {
      const t = e.target.dataset.send;
      if (!t) return;
      send[t] = +e.target.value;
      U.el('sv-' + t).textContent = send[t];
    });
    ['prov-panel', 'news', 'mapmodes', 'topbar', 'endturn-wrap', 'pick-banner'].forEach((id) => U.el(id).addEventListener('mousedown', (e) => e.stopPropagation()));
  };

  // ---------------------------------------------------------------- advisor hooks
  S.analysis = function () {
    if (!G || G.playerId < 0 || (phase !== 'play' && phase !== 'busy')) return null;
    const me = G.playerId, n = nation(me), ec = economy(me);
    const mine = provsOf(me), myPow = nationPower(me);
    const threats = [], opps = [];
    for (const p of mine) {
      let e = 0, enemyId = -1, big = 0;
      for (const q of p.neighbors.map(P)) {
        if (!atWar(me, q.owner)) continue;
        const qp = powerOf(q.units, q.owner);
        e += qp;
        if (qp > big) { big = qp; enemyId = q.owner; }
        const ratio = powerOf(p.ready, me) / Math.max(0.5, qp * defBonus(q));
        if (ratio > 1.5 && powerOf(p.ready, me) >= 3) opps.push({ from: p.id, fromName: p.name, to: q.id, toName: q.name, att: Math.round(powerOf(p.ready, me)), def: Math.round(qp * defBonus(q)), ratio });
      }
      const my = powerOf(p.units, me) * defBonus(p);
      if (e > my * 1.1 && enemyId >= 0) threats.push({ id: p.id, name: p.name, enemy: nation(enemyId).name, enemyPower: Math.round(e), myPower: Math.round(my), gap: e - my });
    }
    threats.sort((a, b) => b.gap - a.gap);
    opps.sort((a, b) => b.ratio - a.ratio);
    const stronger = enemiesOf(me).filter((x) => nationPower(x.id) > myPow * 1.5).map((x) => x.name);
    const weak = neighborNations(me).filter((o) => !atWar(me, o) && !allied(me, o) && !truce(me, o)).sort((a, b) => nationPower(a) - nationPower(b))[0];
    const cur = n.research.cur ? TECH[n.research.cur] : null;
    const unitList = (u) => Object.fromEntries(U.TYPES.filter((t) => u[t] > 0).map((t) => [C.unitName[t], u[t]]));
    return {
      me, turn: G.turn, date: dateStr(G.turn), nationName: n.name, color: n.color, seed: n.flagSeed || me,
      advisorName: n.advisor || 'Orgeneral Hasan Arda',
      ec, gold: n.gold, manpower: n.manpower, stability: n.stability, research: cur, capital: n.capital,
      wars: enemiesOf(me).map((x) => x.name), threats, opportunities: opps, stronger,
      weakNeighbor: weak != null && nationPower(weak) < myPow * 0.6 ? nation(weak).name : null,
      forLLM: {
        tarih: dateStr(G.turn), ulus: n.name, yonetim: n.gov, lider: n.leader,
        hazine: Math.floor(n.gold), aylikNetGelir: ec.net, insanGucu: Math.round(n.manpower), istikrar: Math.round(n.stability),
        arastirma: cur ? cur.name : 'yok', teknolojiler: n.techs.map((t) => TECH[t].name), orduGucu: Math.round(myPow), bolgeSayisi: mine.length,
        savaslar: enemiesOf(me).map((x) => ({ ulus: x.name, guc: Math.round(nationPower(x.id)), bolge: provsOf(x.id).length })),
        muttefikler: alliesOf(me).map((x) => x.name),
        komsular: neighborNations(me).slice(0, 14).map((o) => ({ ulus: nation(o).name, guc: Math.round(nationPower(o)), iliski: Math.round(rel(me, o)), durum: atWar(me, o) ? 'savaş' : allied(me, o) ? 'müttefik' : truce(me, o) ? 'ateşkes' : 'barış' })),
        bolgelerim: mine.slice(0, 30).map((p) => ({ ad: p.name, arazi: p.terrain, birlikler: unitList(p.units), binalar: p.buildings, baskent: p.isCapital || undefined })),
        tehditler: threats.slice(0, 5).map((t) => `${t.name}: düşman ${t.enemyPower} / biz ${t.myPower}`),
        firsatlar: opps.slice(0, 5).map((o) => `${o.fromName} -> ${o.toName} (${o.att} vs ${o.def})`),
      },
    };
  };
  S.focusProvince = function (id) {
    if (!G || id == null || id < 0) return;
    sel = id; selTab = 'genel'; send = U.copyUnits(P(id).ready);
    const p = P(id);
    cam.s = Math.max(cam.s, map.kind === 'world' ? 2.6 : 1.6);
    cam.x = canvas.width / 2 - p.cx * cam.s; cam.y = canvas.height / 2 - p.cy * cam.s;
    dirty = true; updatePanel();
  };
  S.openTech = () => { if (phase === 'play') techScreen(); };
  S.openDiplo = () => { if (phase === 'play') diplomacy(); };

  S.refresh = function () { dirty = true; updatePanel(); updateTop(); renderNews(); };
  S.debug = () => ({ G, map, cam, sel, phase });
})();
