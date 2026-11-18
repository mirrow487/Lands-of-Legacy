'use strict';
(function () {
  // ======================================================================
  //  Grand strategy layer (province map, economy, diplomacy, AI)
  // ======================================================================
  const U = LOL.util, C = LOL.config, UI = LOL.ui;
  const S = (LOL.strategy = {});
  const SAVE_KEY = 'lol_save_v1';

  let map = null, G = null;
  let mapCanvas = null, mapCtx = null, img = null;
  let cam = { x: 0, y: 0, s: 1 };
  let sel = -1, hover = -1;
  let phase = 'menu'; // menu | pick | play | busy | over
  let dirty = true;
  let anims = [];
  let send = U.zeroUnits();
  let drag = null;
  let mouse = { x: 0, y: 0 };
  let nationRGB = [];
  let canvas, ctx;
  let waveT = 0;

  const P = (id) => G.provinces[id];
  const nation = (id) => G.nations[id];
  const isPlayer = (id) => id === G.playerId;
  const warKey = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
  const atWar = (a, b) => a !== b && G.wars.has(warKey(a, b));
  const provsOf = (nid) => G.provinces.filter((p) => p.owner === nid);
  const nationPower = (nid) => provsOf(nid).reduce((s, p) => s + U.power(p.units), 0);
  const enemiesOf = (nid) => G.nations.filter((n) => n.alive && atWar(nid, n.id));
  function neighborNations(nid) {
    const s = new Set();
    provsOf(nid).forEach((p) => p.neighbors.forEach((q) => { const o = P(q).owner; if (o !== nid) s.add(o); }));
    return [...s].filter((id) => nation(id).alive);
  }
  function incomeOf(nid) {
    const n = nation(nid);
    let inc = 0, up = 0;
    provsOf(nid).forEach((p) => {
      inc += p.income + (p.isCapital ? C.capitalBonus : 0);
      U.TYPES.forEach((t) => { up += p.units[t] * C.upkeep[t]; });
    });
    return { inc, up, net: Math.round(inc - up) , n };
  }

  // ---------------------------------------------------------------- setup
  S.init = function () {
    canvas = LOL.app.canvas; ctx = LOL.app.ctx;
  };

  S.newMap = function (seed) {
    map = LOL.mapgen.generate(seed, 8);
    G = { seed, turn: 1, playerId: -1, nations: map.nations, provinces: map.provinces, wars: new Set(), truce: {}, log: [] };
    nationRGB = G.nations.map((n) => U.hexToRgb(n.color));
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = map.W; mapCanvas.height = map.H;
    mapCtx = mapCanvas.getContext('2d');
    img = mapCtx.createImageData(map.W, map.H);
    sel = -1; hover = -1; anims = [];
    fitCam();
    dirty = true;
  };

  S.setPhase = function (p) {
    phase = p;
    U.el('pick-banner').classList.toggle('hidden', p !== 'pick');
    U.el('btn-endturn').classList.toggle('hidden', p !== 'play' && p !== 'busy');
    U.el('busy').classList.toggle('hidden', p !== 'busy');
    U.el('btn-endturn').disabled = p !== 'play';
    U.el('log').classList.toggle('hidden', p === 'pick' || p === 'menu');
    ['btn-diplo', 'btn-save'].forEach((id) => { U.el(id).disabled = p !== 'play'; });
    updatePanel(); updateTop();
  };
  S.getPhase = () => phase;
  S.hasGame = () => !!G && G.playerId >= 0;

  function fitCam() {
    const vw = canvas.width, vh = canvas.height - 42;
    cam.s = Math.min(vw / map.W, vh / map.H) * 0.98;
    cam.x = (vw - map.W * cam.s) / 2;
    cam.y = 42 + (vh - map.H * cam.s) / 2;
  }
  S.onResize = function () { if (map) fitCam(); };

  // ---------------------------------------------------------------- map render
  function renderMap() {
    const d = img.data, W = map.W, Hh = map.H;
    const pid = map.pid, depth = map.seaDepth, shade = map.shade, nb = map.nbPid, coast = map.coast;
    const owners = G.provinces.map((p) => p.owner);
    const selN = sel >= 0 ? P(sel) : null;
    const targets = new Set();
    if (selN && selN.owner === G.playerId && phase === 'play') selN.neighbors.forEach((q) => targets.add(q));
    const pickNation = phase === 'pick' && sel >= 0 ? P(sel).owner : -1;
    for (let i = 0, o = 0; i < W * Hh; i++, o += 4) {
      const p = pid[i];
      let r, g, b;
      if (p < 0) {
        const t = Math.min(1, depth[i] / 60);
        const s = (shade[i] - 128) / 255 * 10;
        r = 70 + (22 - 70) * t + s; g = 122 + (48 - 122) * t + s; b = 160 + (84 - 160) * t + s;
        if (depth[i] === 3 || depth[i] === 4) { r += 18; g += 22; b += 22; }
        const x = i % W, y = (i / W) | 0;
        if (x % 100 === 0 || y % 100 === 0) { r += 8; g += 10; b += 12; }
      } else {
        const own = owners[p];
        const c = nationRGB[own];
        const s = shade[i] / 128;
        r = c[0] * s; g = c[1] * s; b = c[2] * s;
        // desaturate a bit for map feel
        const avg = (r + g + b) / 3;
        r = r * 0.82 + avg * 0.18; g = g * 0.82 + avg * 0.18; b = b * 0.82 + avg * 0.18;
        if (pickNation >= 0 && own === pickNation) { r += 40; g += 40; b += 40; }
        if (p === sel) { r += 55; g += 55; b += 55; }
        else if (targets.has(p)) {
          const x = i % W, y = (i / W) | 0;
          if (((x + y) >> 2) & 1) { r += 30; g += 30; b += 30; }
        }
        if (coast[i]) { r *= 0.4; g *= 0.4; b *= 0.4; }
        else if (nb[i] >= 0) {
          if (owners[nb[i]] !== own) { r *= 0.22; g *= 0.22; b *= 0.22; }
          else { r *= 0.7; g *= 0.7; b *= 0.7; }
        }
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    mapCtx.putImageData(img, 0, 0);
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16304e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(cam.s, 0, 0, cam.s, cam.x, cam.y);
    ctx.imageSmoothingEnabled = cam.s < 2;
    ctx.drawImage(mapCanvas, 0, 0);
    // naval links
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -waveT * 8;
    ctx.strokeStyle = 'rgba(220,235,255,0.55)';
    ctx.lineWidth = 1.5 / Math.min(cam.s, 2);
    for (const [a, b] of map.links) {
      ctx.beginPath(); ctx.moveTo(P(a).cx, P(a).cy); ctx.lineTo(P(b).cx, P(b).cy); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;

    // move arrows from selected
    if (sel >= 0 && phase === 'play' && P(sel).owner === G.playerId && hover >= 0 && P(sel).neighbors.includes(hover) && U.sumUnits(send) > 0) {
      const [ax, ay] = toScreen(P(sel).cx, P(sel).cy), [bx, by] = toScreen(P(hover).cx, P(hover).cy);
      const enemy = P(hover).owner !== G.playerId;
      arrow(ax, ay, bx, by, enemy ? '#ff5040' : '#70ff70');
    }

    // province names
    if (cam.s > 1.15) {
      ctx.font = `${Math.min(13, 8 + cam.s * 2) | 0}px Georgia, serif`;
      ctx.textAlign = 'center';
      for (const p of G.provinces) {
        const [x, y] = toScreen(p.cx, p.cy);
        if (x < -50 || y < -50 || x > canvas.width + 50 || y > canvas.height + 50) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillText(p.name, x + 1, y - 13 + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(p.name, x, y - 13);
      }
    }
    // capitals & armies
    for (const p of G.provinces) {
      const [x, y] = toScreen(p.cx, p.cy);
      if (x < -50 || y < -50 || x > canvas.width + 50 || y > canvas.height + 50) continue;
      if (p.isCapital) star(x, y - (U.sumUnits(p.units) ? 16 : 0), 7, '#ffd84a');
      const tot = U.sumUnits(p.units);
      if (tot > 0 && !anims.some((a) => a.to === p.id && a.t < a.dur)) badge(p, x, y, tot);
    }
    // move anims
    anims = anims.filter((a) => a.t < a.dur + 0.05);
    for (const a of anims) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur), e = k * k * (3 - 2 * k);
      const [ax, ay] = toScreen(P(a.from).cx, P(a.from).cy), [bx, by] = toScreen(P(a.to).cx, P(a.to).cy);
      const x = U.lerp(ax, bx, e), y = U.lerp(ay, by, e);
      ctx.fillStyle = G.nations[a.owner].color;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(a.n, x, y + 3.5);
    }

    // tooltip
    if (hover >= 0 && !drag?.moved && !UI.isModalOpen()) {
      const p = P(hover), n = nation(p.owner);
      let rel = '';
      if (G.playerId >= 0 && p.owner !== G.playerId) rel = atWar(G.playerId, p.owner) ? ' <span class="war">(Savaşta)</span>' : ' <span class="peace">(Barış)</span>';
      UI.tooltip(`<b>${U.esc(p.name)}</b>${p.isCapital ? ' ★' : ''}<br>${UI.flag(n.color)}${U.esc(n.name)}${rel}<br>Gelir: +${p.income}<br>${U.unitsText(p.units)}`, mouse.x, mouse.y);
    } else UI.tooltip(null);
  };

  function arrow(ax, ay, bx, by, col) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    if (L < 5) return;
    const ux = dx / L, uy = dy / L;
    const ex = bx - ux * 10, ey = by - uy * 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex - uy * 9, ey + ux * 9); ctx.lineTo(ex + uy * 9, ey - ux * 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
  function star(x, y, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function badge(p, x, y, tot) {
    const txt = String(tot);
    const own = p.owner === G.playerId;
    const showDetail = cam.s > 1.6;
    const label = showDetail ? `${p.units.inf}·${p.units.tank}·${p.units.art}` : txt;
    ctx.font = 'bold 11px sans-serif';
    const w = Math.max(22, ctx.measureText(label).width + 16), h = 16;
    const bx = x - w / 2, by = y - h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx + 2, by + 2, w, h);
    ctx.fillStyle = nation(p.owner).color;
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bx, by + h / 2, w, h / 2);
    ctx.strokeStyle = own ? '#fff' : '#000';
    ctx.lineWidth = own && p.id === sel ? 2.5 : 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    // tiny soldier icon
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx + 4, by + 4, 3, 8);
    ctx.beginPath(); ctx.arc(bx + 5.5, by + 3.5, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(label, x + 4, y + 4);
    if (own && phase === 'play' && U.sumUnits(p.ready) === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, by, w, h);
    }
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
      const h = phase === 'menu' ? -1 : pidAt(mx, my);
      if (h !== hover) { hover = h; }
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
      const ns = U.clamp(cam.s * f, 0.6, 6);
      const [wx, wy] = toWorld(mx, my);
      cam.s = ns;
      cam.x = mx - wx * ns; cam.y = my - wy * ns;
    } else if (type === 'leave') {
      hover = -1;
    } else if (type === 'keydown') {
      if (e.key === 'Escape') { sel = -1; dirty = true; updatePanel(); }
      if (e.key === 'Enter' && phase === 'play') endTurn();
    }
  };

  function leftClick(p) {
    LOL.audio.init();
    if (phase === 'pick') {
      sel = p; dirty = true; updatePanel(); LOL.audio.play('click');
      return;
    }
    if (phase !== 'play' && phase !== 'busy') return;
    sel = p;
    if (p >= 0) {
      send = U.copyUnits(P(p).ready);
      LOL.audio.play('click');
    }
    dirty = true;
    updatePanel();
  }

  async function rightClick(t) {
    if (phase !== 'play' || sel < 0 || t < 0 || t === sel) return;
    const from = P(sel), to = P(t);
    if (from.owner !== G.playerId) return;
    if (!from.neighbors.includes(t)) { flashMsg('Sadece komşu bölgelere hareket edebilirsin.'); return; }
    const units = clampSend(from);
    if (U.sumUnits(units) === 0) { flashMsg('Bu bölgede hareket edebilecek birlik yok (bu tur hareket etmişler).'); return; }
    if (to.owner !== G.playerId && !atWar(G.playerId, to.owner)) {
      const tr = G.truce[warKey(G.playerId, to.owner)];
      if (tr && tr > G.turn) { flashMsg(`${nation(to.owner).name} ile ateşkes var (${tr - G.turn} tur).`); return; }
      const ok = await UI.modal('Savaş İlanı', `${UI.flag(nation(to.owner).color)}<b>${U.esc(nation(to.owner).name)}</b> ile barış içindesin. Saldırmak için savaş ilan etmen gerekir. Savaş ilan edilsin mi?`,
        [{ label: 'Vazgeç', value: false }, { label: 'Savaş İlan Et', value: true, cls: 'danger' }]);
      if (!ok) return;
      declareWar(G.playerId, to.owner);
    }
    S.setPhase('busy');
    U.el('busy').classList.add('hidden');
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

  function flashMsg(text) { addLog(text, '#e0a040'); }

  // ---------------------------------------------------------------- actions
  function addLog(text, color) {
    G.log.push({ turn: G.turn, text, color });
    if (G.log.length > 60) G.log.shift();
    renderLog();
  }
  function renderLog() {
    const el = U.el('log');
    el.innerHTML = G.log.slice(-9).map((l) => `<div class="l"${l.color ? ` style="color:${l.color}"` : ''}><span class="t">T${l.turn}</span>${l.text}</div>`).join('');
  }
  const nn = (id) => `<b style="color:${nation(id).color}">${U.esc(nation(id).name)}</b>`;

  function declareWar(a, b) {
    if (atWar(a, b)) return;
    G.wars.add(warKey(a, b));
    addLog(`${nn(a)}, ${nn(b)} ulusuna savaş ilan etti!`, '#ff7060');
    LOL.audio.play('war');
    updateTop();
  }
  function makePeace(a, b) {
    G.wars.delete(warKey(a, b));
    G.truce[warKey(a, b)] = G.turn + 6;
    addLog(`${nn(a)} ile ${nn(b)} barış imzaladı.`, '#80e080');
    updateTop();
  }

  function recruit(p, type, n) {
    const nat = nation(p.owner);
    let done = 0;
    for (let i = 0; i < n; i++) {
      if (nat.gold < C.cost[type]) break;
      nat.gold -= C.cost[type];
      p.units[type]++;
      done++;
    }
    if (done && isPlayer(p.owner)) LOL.audio.play('coin');
    return done;
  }

  function animMove(from, to, units, owner) {
    anims.push({ from: from.id, to: to.id, t: 0, dur: 0.45, owner, n: U.sumUnits(units) });
  }

  function capture(prov, newOwner, units) {
    const old = prov.owner;
    prov.owner = newOwner;
    prov.units = U.copyUnits(units);
    prov.ready = U.zeroUnits();
    if (prov.isCapital) {
      prov.isCapital = false;
      const loot = Math.floor(Math.max(0, nation(old).gold) * 0.4);
      nation(old).gold -= loot; nation(newOwner).gold += loot;
      const rest = provsOf(old);
      if (rest.length) {
        const nc = rest.sort((a, b) => b.income - a.income)[0];
        nc.isCapital = true; nation(old).capital = nc.id;
        addLog(`${nn(old)} başkentini kaybetti! Yeni başkent: ${U.esc(nc.name)}. (${loot} altın yağmalandı)`, '#ffb050');
      }
    }
    if (!provsOf(old).length) {
      nation(old).alive = false;
      G.nations.forEach((n) => G.wars.delete(warKey(old, n.id)));
      addLog(`${nn(old)} tarih sahnesinden silindi!`, '#ff5050');
    }
    dirty = true;
  }

  function autoResolve(att, def, prov) {
    const A = U.power(att) * (0.85 + Math.random() * 0.3);
    const D = U.power(def) * (prov.isCapital ? 1.4 : 1.2) * (0.85 + Math.random() * 0.3);
    const attWin = A > D;
    const Wp = Math.max(A, D), Lp = Math.min(A, D);
    const lossFrac = Math.min(0.92, 0.65 * Math.pow(Lp / Wp, 1.3) + 0.05);
    const wu = attWin ? att : def;
    const surv = U.zeroUnits();
    U.TYPES.forEach((t) => { surv[t] = Math.max(0, Math.round(wu[t] * (1 - lossFrac * (0.75 + Math.random() * 0.5)))); });
    if (U.sumUnits(surv) === 0) { const t = U.TYPES.find((k) => wu[k] > 0); if (t) surv[t] = 1; }
    return { winner: attWin ? 'attacker' : 'defender', attSurv: attWin ? surv : U.zeroUnits(), defSurv: attWin ? U.zeroUnits() : surv };
  }

  function unitsTable(u) {
    return U.TYPES.map((t) => `<div class="row"><span>${C.unitName[t]}</span><b>${u[t]}</b></div>`).join('');
  }

  // Core move/attack routine shared by player and AI
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
      await U.sleep(250);
      capture(to, owner, units);
      addLog(`${nn(owner)}, ${U.esc(to.name)} bölgesini savaşsız ele geçirdi.`);
      checkGameOver();
      return;
    }
    const playerInvolved = isPlayer(owner) || isPlayer(defender);
    let result;
    if (playerInvolved) {
      await U.sleep(200);
      const pAtt = isPlayer(owner);
      const ratio = U.power(units) / Math.max(0.1, U.power(to.units) * (to.isCapital ? 1.4 : 1.2));
      const oddsTxt = ratio > 1.6 ? 'Çok yüksek' : ratio > 1.15 ? 'Yüksek' : ratio > 0.85 ? 'Dengeli' : ratio > 0.6 ? 'Düşük' : 'Çok düşük';
      const body = `${pAtt ? '' : `<p><b>${nn(owner)}</b> ordusu <b>${U.esc(to.name)}</b> bölgene saldırıyor!</p>`}
        <div class="vs"><div class="side">${UI.flag(nation(owner).color)}<b>${U.esc(nation(owner).name)}</b><br><small>Saldıran</small>${unitsTable(units)}</div>
        <div class="mid">VS</div>
        <div class="side">${UI.flag(nation(defender).color)}<b>${U.esc(nation(defender).name)}</b><br><small>Savunan${to.isCapital ? ' (Başkent)' : ''}</small>${unitsTable(to.units)}</div></div>
        <div class="odds">${pAtt ? 'Zafer şansın' : 'Savunma şansın'}: <b>${pAtt ? oddsTxt : (ratio < 0.6 ? 'Çok yüksek' : ratio < 0.85 ? 'Yüksek' : ratio < 1.15 ? 'Dengeli' : ratio < 1.6 ? 'Düşük' : 'Çok düşük')}</b></div>
        <p style="color:#9aa0a8;font-size:12px;margin-top:10px">"Savaşı Yönet" ile izometrik savaş alanına girip birliklerine bizzat komuta edersin.</p>`;
      const btns = [{ label: 'Otomatik Çöz', value: 'auto' }, { label: '⚔ Savaşı Yönet', value: 'tactical', cls: 'primary' }];
      if (pAtt) btns.unshift({ label: 'İptal', value: 'cancel' });
      const choice = await UI.modal(pAtt ? `${U.esc(to.name)} Saldırısı` : 'Saldırı Altındasın!', body, btns);
      if (choice === 'cancel') {
        U.TYPES.forEach((t) => { from.units[t] += units[t]; from.ready[t] += units[t]; });
        anims = anims.filter((a) => a.to !== to.id);
        dirty = true;
        return;
      }
      if (choice === 'tactical') {
        result = await LOL.app.startBattle({
          provinceName: to.name,
          attacker: nation(owner), defender: nation(defender),
          attUnits: U.copyUnits(units), defUnits: U.copyUnits(to.units),
          playerSide: pAtt ? 'attacker' : 'defender',
          seed: (G.seed * 31 + to.id * 7919 + G.turn * 131) >>> 0,
        });
      } else {
        result = autoResolve(units, to.units, to);
        const win = (result.winner === 'attacker') === pAtt;
        const lossA = U.zeroUnits(), lossD = U.zeroUnits();
        U.TYPES.forEach((t) => { lossA[t] = units[t] - result.attSurv[t]; lossD[t] = to.units[t] - result.defSurv[t]; });
        LOL.audio.play(win ? 'victory' : 'defeat');
        await UI.modal(win ? 'Zafer!' : 'Yenilgi', `<p style="text-align:center">${U.esc(to.name)} muharebesi otomatik çözüldü.</p>
          <table><tr><th></th><th>Kayıplar</th></tr>
          <tr><td>${UI.flag(nation(owner).color)}${U.esc(nation(owner).name)}</td><td>${U.unitsText(lossA)}</td></tr>
          <tr><td>${UI.flag(nation(defender).color)}${U.esc(nation(defender).name)}</td><td>${U.unitsText(lossD)}</td></tr></table>`,
        [{ label: 'Tamam', value: 1, cls: 'primary' }], { cls: win ? 'win' : 'lose' });
      }
    } else {
      await U.sleep(120);
      result = autoResolve(units, to.units, to);
    }
    applyResult(from, to, owner, defender, result);
    checkGameOver();
  }

  function applyResult(from, to, att, def, r) {
    if (r.winner === 'attacker') {
      const dsurv = r.defSurv || U.zeroUnits();
      if (U.sumUnits(dsurv) > 0) {
        const ref = to.neighbors.map(P).find((q) => q.owner === def);
        if (ref) U.TYPES.forEach((t) => { ref.units[t] += dsurv[t]; });
      }
      capture(to, att, r.attSurv);
      addLog(`${nn(att)}, ${U.esc(to.name)} muharebesini kazandı ve bölgeyi ele geçirdi.`, isPlayer(att) ? '#9fe870' : isPlayer(def) ? '#ff7060' : null);
    } else {
      to.units = U.copyUnits(r.defSurv);
      to.ready = U.TYPES.reduce((o, t) => { o[t] = Math.min(to.ready[t], to.units[t]); return o; }, {});
      const asurv = r.attSurv || U.zeroUnits();
      if (from.owner === att) U.TYPES.forEach((t) => { from.units[t] += asurv[t]; });
      addLog(`${nn(def)}, ${U.esc(to.name)} bölgesini ${nn(att)} saldırısına karşı savundu.`, isPlayer(def) ? '#9fe870' : isPlayer(att) ? '#ff7060' : null);
      dirty = true;
    }
  }

  function checkGameOver() {
    if (phase === 'over') return true;
    if (!nation(G.playerId).alive) {
      phase = 'over';
      LOL.audio.play('defeat');
      localStorage.removeItem(SAVE_KEY);
      UI.modal('İMPARATORLUK ÇÖKTÜ', `<p style="text-align:center">${U.esc(nation(G.playerId).name)} son toprağını da kaybetti. ${G.turn}. turda tarih sayfalarına gömüldün.</p>`,
        [{ label: 'Ana Menü', value: 1, cls: 'primary' }], { cls: 'lose' }).then(() => LOL.app.toMenu());
      return true;
    }
    const others = G.nations.filter((n) => n.alive && n.id !== G.playerId);
    if (!others.length) {
      phase = 'over';
      LOL.audio.play('victory');
      localStorage.removeItem(SAVE_KEY);
      UI.modal('DÜNYA SENİN!', `<p style="text-align:center">${U.esc(nation(G.playerId).name)} tüm dünyayı ${G.turn} turda birleştirdi. Efsane bir zafer!</p>`,
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
    S.setPhase('busy');
    for (const n of G.nations) {
      if (!n.alive || isPlayer(n.id)) continue;
      await aiTurn(n);
      if (phase === 'over') return;
      if (checkGameOver()) return;
    }
    newRound();
    S.setPhase('play');
    save(true);
  }

  function newRound() {
    G.turn++;
    for (const n of G.nations) {
      if (!n.alive) continue;
      const inc = incomeOf(n.id);
      n.gold += inc.net;
      if (n.gold < -40) {
        // bankrupt: desert some troops
        const big = provsOf(n.id).sort((a, b) => U.sumUnits(b.units) - U.sumUnits(a.units))[0];
        if (big) { const t = big.units.tank > 0 ? 'tank' : big.units.art > 0 ? 'art' : 'inf'; if (big.units[t] > 0) big.units[t]--; }
        if (isPlayer(n.id)) addLog('Hazine iflas etti! Maaş alamayan birlikler firar ediyor.', '#ff7060');
      }
    }
    G.provinces.forEach((p) => { p.ready = U.copyUnits(p.units); });
    addLog(`— ${G.turn}. tur başladı —`, '#888');
  }

  async function aiTurn(n) {
    const me = n.id;
    const myPow = nationPower(me);
    // --- diplomacy
    const wars = enemiesOf(me);
    if (wars.length === 0 && G.turn >= 3 && Math.random() < 0.3) {
      const cands = neighborNations(me).filter((o) => !(G.truce[warKey(me, o)] > G.turn));
      let best = -1, br = 1e9;
      for (const o of cands) {
        let r = nationPower(o) / Math.max(1, myPow);
        if (isPlayer(o)) r *= 0.9 + Math.random() * 0.3;
        if (r < br) { br = r; best = o; }
      }
      if (best >= 0 && br < 1.15) {
        declareWar(me, best);
        if (isPlayer(best)) {
          await UI.modal('Savaş İlanı!', `${nn(me)} sana savaş ilan etti! Sınırlarını savunmaya hazırlan.`, [{ label: 'Hazırız', value: 1, cls: 'danger' }]);
        }
      }
    } else if (wars.length) {
      for (const e of wars) {
        const ep = nationPower(e.id);
        const want = ep > myPow * 1.5 && Math.random() < 0.3;
        if (!want) continue;
        if (isPlayer(e.id)) {
          const ok = await UI.modal('Barış Teklifi', `${nn(me)} barış teklif ediyor. Kabul edersen 6 tur boyunca birbirinize saldıramazsınız.`,
            [{ label: 'Reddet', value: false }, { label: 'Kabul Et', value: true, cls: 'primary' }]);
          if (ok) makePeace(me, e.id); else addLog(`${nn(me)} barış teklifi reddedildi.`);
        } else if (Math.random() < 0.5) makePeace(me, e.id);
      }
    }
    // --- recruitment
    const mine = provsOf(me);
    if (!mine.length) return;
    const enemyIds = new Set(enemiesOf(me).map((e) => e.id));
    const isFront = (p) => p.neighbors.some((q) => enemyIds.has(P(q).owner));
    const isBorder = (p) => p.neighbors.some((q) => P(q).owner !== me);
    let front = mine.filter(isFront);
    if (!front.length) front = mine.filter(isBorder);
    if (!front.length) front = mine;
    const reserve = enemyIds.size ? 10 : 30;
    for (let guard = 0; guard < 40 && n.gold - reserve >= C.cost.inf; guard++) {
      const r = Math.random();
      let t = r < 0.55 ? 'inf' : r < 0.82 ? 'tank' : 'art';
      if (n.gold - reserve < C.cost[t]) t = 'inf';
      // weight toward threatened provinces
      const p = front.sort((a, b) => threat(b, me) - threat(a, me) + (Math.random() - 0.5) * 4)[0];
      recruit(p, t, 1);
    }
    // --- attacks
    let attacks = 0;
    const order = mine.slice().sort((a, b) => U.power(b.ready) - U.power(a.ready));
    for (const p of order) {
      if (p.owner !== me || U.power(p.ready) < 2) continue;
      let best = null, bs = 0;
      for (const q of p.neighbors.map(P)) {
        if (q.owner === me || !atWar(me, q.owner)) continue;
        const dp = U.power(q.units) * (q.isCapital ? 1.4 : 1.2);
        const ratio = U.power(p.ready) / Math.max(0.5, dp);
        const score = ratio + (q.isCapital ? 0.3 : 0) + q.income * 0.03;
        if (ratio > 1.3 && score > bs) { bs = score; best = q; }
      }
      if (best) {
        // leave a small garrison if the province is threatened
        const units = U.copyUnits(p.ready);
        if (threat(p, me) > 0 && units.inf > 1) units.inf -= 1;
        if (U.sumUnits(units) === 0) continue;
        await moveArmy(p, best, units);
        attacks++;
        if (phase === 'over') return;
      }
    }
    // --- reinforce toward the front
    const dist = new Map();
    const q0 = provsOf(me).filter(isFront);
    if (q0.length) {
      const queue = [];
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
        if (units.inf > 0 && d > 0) units.inf -= 1; // small garrison
        if (U.sumUnits(units) === 0) continue;
        await moveArmy(p, next, units);
      }
    }
    if (attacks) await U.sleep(150);
  }
  function threat(p, me) {
    let t = 0;
    for (const q of p.neighbors.map(P)) if (q.owner !== me && atWar(me, q.owner)) t += U.power(q.units);
    return t - U.power(p.units) * 0.5;
  }

  // ---------------------------------------------------------------- panels
  function updateTop() {
    if (!G || G.playerId < 0) return;
    const n = nation(G.playerId);
    U.el('tb-flag').style.background = n.color;
    U.el('tb-name').textContent = n.name;
    U.el('tb-gold').textContent = Math.floor(n.gold);
    const inc = incomeOf(G.playerId);
    const el = U.el('tb-income');
    el.textContent = (inc.net >= 0 ? '+' : '') + inc.net;
    el.className = inc.net >= 0 ? '' : 'neg';
    el.title = `Gelir ${Math.round(inc.inc)} - Bakım ${Math.round(inc.up)}`;
    U.el('tb-turn').textContent = G.turn;
    U.el('tb-provs').textContent = provsOf(G.playerId).length;
    U.el('tb-power').textContent = Math.round(nationPower(G.playerId));
    const ws = enemiesOf(G.playerId);
    U.el('tb-wars').innerHTML = ws.length ? 'Savaş: ' + ws.map((w) => U.esc(w.name)).join(', ') : '<span class="peace">Barış</span>';
  }

  function updatePanel() {
    const el = U.el('prov-panel');
    if (!G || sel < 0 || phase === 'menu') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const p = P(sel), n = nation(p.owner);
    if (phase === 'pick') {
      const ps = provsOf(n.id);
      el.innerHTML = `<h3>${UI.flag(n.color)}${U.esc(n.name)}</h3>
        <div class="row"><span>Bölgeler</span><b>${ps.length}</b></div>
        <div class="row"><span>Başkent</span><b>${U.esc(P(n.capital).name)}</b></div>
        <div class="row"><span>Gelir</span><b>+${incomeOf(n.id).net}</b></div>
        <div class="row"><span>Ordu gücü</span><b>${Math.round(nationPower(n.id))}</b></div>
        <div class="row"><span>Komşular</span><b>${neighborNations(n.id).length}</b></div>
        <div class="btnrow"><button class="primary" data-act="start" style="width:100%;padding:10px;font-size:15px">Bu Ulusla Başla</button></div>`;
      return;
    }
    const own = p.owner === G.playerId;
    let html = `<h3>${U.esc(p.name)}${p.isCapital ? ' ★' : ''}</h3>
      <div class="owner">${UI.flag(n.color)}${U.esc(n.name)}${!own ? (atWar(G.playerId, p.owner) ? ' — <span class="war">Savaşta</span>' : ' — <span class="peace">Barış</span>') : ''}</div>
      <div class="row"><span>Gelir</span><b>+${p.income}${p.isCapital ? ' (+' + C.capitalBonus + ' başkent)' : ''}</b></div>
      <div class="sect"><div class="sect-title">Ordu</div>
      ${U.TYPES.map((t) => `<div class="row"><span>${C.unitName[t]}</span><b>${p.units[t]}${own ? ` <small style="color:#9aa0a8">(hazır ${p.ready[t]})</small>` : ''}</b></div>`).join('')}
      <div class="row"><span>Toplam güç</span><b>${Math.round(U.power(p.units))}</b></div></div>`;
    if (own) {
      const gold = nation(G.playerId).gold;
      html += `<div class="sect"><div class="sect-title">Asker Topla</div><div class="recruit">
        ${U.TYPES.map((t) => `<button data-act="rec" data-t="${t}" ${gold < C.cost[t] || phase !== 'play' ? 'disabled' : ''}>${C.unitName[t]}<small>${C.cost[t]} altın</small></button>`).join('')}
        </div><div class="hint">Shift+tık: 5 adet. Yeni birlikler sonraki tur hareket edebilir.</div></div>`;
      if (U.sumUnits(p.ready) > 0) {
        html += `<div class="sect"><div class="sect-title">Gönderilecek Kuvvet</div>
          ${U.TYPES.filter((t) => p.ready[t] > 0).map((t) => `<div class="send-row"><span>${C.unitName[t]}</span><input type="range" min="0" max="${p.ready[t]}" value="${Math.min(send[t], p.ready[t])}" data-send="${t}"><b id="sv-${t}">${Math.min(send[t], p.ready[t])}</b></div>`).join('')}
          <div class="hint">Hedef komşu bölgeye <b>sağ tıkla</b>. Düşman bölgesine gönderirsen savaş başlar.</div></div>`;
      }
    } else if (G.playerId >= 0 && phase === 'play') {
      const tr = G.truce[warKey(G.playerId, p.owner)];
      html += `<div class="btnrow">${atWar(G.playerId, p.owner)
        ? `<button data-act="peace">Barış Teklif Et</button>`
        : tr > G.turn ? `<span style="color:#9aa0a8">Ateşkes: ${tr - G.turn} tur</span>` : `<button class="danger" data-act="war">Savaş İlan Et</button>`}</div>`;
    }
    el.innerHTML = html;
  }

  async function panelAction(act, target, e) {
    if (act === 'start') { startGame(P(sel).owner); return; }
    if (phase !== 'play' || sel < 0) return;
    const p = P(sel);
    if (act === 'rec') {
      const t = target.dataset.t;
      const n = recruit(p, t, e.shiftKey ? 5 : 1);
      if (n) addLog(`${U.esc(p.name)} bölgesinde ${n} ${C.unitName[t]} toplandı.`);
    } else if (act === 'war') {
      const ok = await UI.modal('Savaş İlanı', `${nn(p.owner)} ulusuna savaş ilan edilsin mi?`, [{ label: 'Vazgeç', value: false }, { label: 'Savaş İlan Et', value: true, cls: 'danger' }]);
      if (ok) declareWar(G.playerId, p.owner);
    } else if (act === 'peace') {
      await proposePeace(p.owner);
    }
    updatePanel(); updateTop();
  }

  async function proposePeace(o) {
    const mp = nationPower(G.playerId), op = nationPower(o);
    const lost = op < mp * 0.8 || Math.random() < 0.25;
    if (lost) {
      makePeace(G.playerId, o);
      await UI.modal('Barış', `${nn(o)} barış teklifini kabul etti.`, [{ label: 'Tamam', value: 1 }]);
    } else {
      await UI.modal('Barış Reddedildi', `${nn(o)} teklifini reddetti. Önce sahada üstünlük kurmalısın.`, [{ label: 'Tamam', value: 1 }]);
    }
  }

  function diplomacy() {
    const me = G.playerId;
    const rows = G.nations.filter((n) => n.alive && n.id !== me).map((n) => {
      const tr = G.truce[warKey(me, n.id)];
      const status = atWar(me, n.id) ? '<span class="war">Savaş</span>' : tr > G.turn ? `<span class="peace">Ateşkes (${tr - G.turn})</span>` : '<span class="peace">Barış</span>';
      const btn = atWar(me, n.id) ? `<button data-dip="peace" data-n="${n.id}">Barış Teklif Et</button>` : tr > G.turn ? '' : `<button class="danger" data-dip="war" data-n="${n.id}">Savaş İlan Et</button>`;
      return `<tr><td>${UI.flag(n.color)}${U.esc(n.name)}</td><td>${provsOf(n.id).length}</td><td>${Math.round(nationPower(n.id))}</td><td>${Math.floor(n.gold)}</td><td>${status}</td><td>${btn}</td></tr>`;
    }).join('');
    const body = `<table><tr><th>Ulus</th><th>Bölge</th><th>Güç</th><th>Altın</th><th>Durum</th><th></th></tr>
      <tr style="background:rgba(255,255,255,.05)"><td>${UI.flag(nation(me).color)}<b>${U.esc(nation(me).name)}</b> (sen)</td><td>${provsOf(me).length}</td><td>${Math.round(nationPower(me))}</td><td>${Math.floor(nation(me).gold)}</td><td></td><td></td></tr>${rows}</table>`;
    UI.modal('Diplomasi', body, [{ label: 'Kapat', value: 0 }], {
      onMount: (wrap, close) => {
        wrap.querySelectorAll('[data-dip]').forEach((b) => {
          b.onclick = async () => {
            const o = +b.dataset.n;
            close(0);
            if (b.dataset.dip === 'war') declareWar(me, o);
            else await proposePeace(o);
            updatePanel(); updateTop();
          };
        });
      },
    });
  }

  // ---------------------------------------------------------------- game flow
  function startGame(nid) {
    G.playerId = nid;
    G.log = [];
    addLog(`${nn(nid)} hükümdarı olarak tahta çıktın. Dünyayı fethet!`, '#ffd060');
    addLog('İpucu: Bölgeni seç, asker topla, komşu bölgeye sağ tıklayarak saldır.', '#9aa0a8');
    sel = nation(nid).capital;
    send = U.copyUnits(P(sel).ready);
    dirty = true;
    S.setPhase('play');
    renderLog();
    save(true);
  }

  S.startPick = function () {
    S.newMap((Math.random() * 1e9) >>> 0);
    S.setPhase('pick');
  };

  function save(silent) {
    if (!G || G.playerId < 0) return;
    const data = {
      seed: G.seed, turn: G.turn, playerId: G.playerId,
      nations: G.nations.map((n) => ({ gold: n.gold, alive: n.alive, capital: n.capital })),
      provinces: G.provinces.map((p) => ({ o: p.owner, u: p.units, r: p.ready, c: p.isCapital })),
      wars: [...G.wars], truce: G.truce, log: G.log.slice(-20),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) addLog('Oyun kaydedildi.', '#80c0ff');
    } catch (e) { if (!silent) addLog('Kayıt başarısız!', '#ff7060'); }
  }
  S.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  S.load = function () {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!data) return false;
    S.newMap(data.seed);
    G.turn = data.turn; G.playerId = data.playerId;
    data.nations.forEach((d, i) => Object.assign(G.nations[i], d));
    data.provinces.forEach((d, i) => { const p = G.provinces[i]; p.owner = d.o; p.units = d.u; p.ready = d.r; p.isCapital = d.c; });
    G.wars = new Set(data.wars); G.truce = data.truce || {}; G.log = data.log || [];
    addLog('Kayıtlı oyun yüklendi.', '#80c0ff');
    sel = -1; dirty = true;
    S.setPhase('play');
    renderLog();
    return true;
  };

  S.bindUI = function () {
    U.el('btn-endturn').onclick = () => endTurn();
    U.el('btn-diplo').onclick = () => { LOL.audio.play('click'); diplomacy(); };
    U.el('btn-save').onclick = () => { LOL.audio.play('click'); save(false); };
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
    U.el('btn-newmap').onclick =() => { LOL.audio.play('click'); S.startPick(); };
    U.el('btn-sound').onclick = () => {
      LOL.audio.enabled = !LOL.audio.enabled;
      U.el('btn-sound').textContent = 'Ses: ' + (LOL.audio.enabled ? 'Açık' : 'Kapalı');
    };
    const panel = U.el('prov-panel');
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) panelAction(b.dataset.act, b, e);
    });
    panel.addEventListener('input', (e) => {
      const t = e.target.dataset.send;
      if (!t) return;
      send[t] = +e.target.value;
      U.el('sv-' + t).textContent = send[t];
    });
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
  };

  S.refresh = function () { dirty = true; updatePanel(); updateTop(); renderLog(); };
  S.debug = () => ({ G, map, cam, sel, phase });
})();
