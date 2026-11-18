'use strict';
(function () {
  // ======================================================================
  //  Campaign map (Bannerlord-style): time flows, armies march freely on the
  //  map, besiege provinces and clash with enemy armies in the field.
  // ======================================================================
  const U = LOL.util, C = LOL.config, UI = LOL.ui;
  const K = (LOL.campaign = {});
  const DAY_SEC = 0.5; // seconds per in-game day at 1x
  let speed = 0, acc = 0, lock = false, selId = -1, follow = false, animT = 0;
  const flagImgs = {};
  const I = () => LOL.strategy._i;
  const G = () => I().G();
  const P = (id) => I().P(id);
  const armies = () => G().armies;
  const byId = (id) => armies().find((a) => a.id === id);
  const scale = () => I().map().W / 1100;

  function flagImg(n) {
    if (!flagImgs[n.id]) { const im = new Image(); im.src = UI.flagURL(n); flagImgs[n.id] = im; }
    return flagImgs[n.id];
  }
  K.reset = () => { speed = 0; acc = 0; lock = false; selId = -1; follow = false; for (const k in flagImgs) delete flagImgs[k]; };
  K.isLocked = () => lock;
  K.selectedArmy = () => (selId >= 0 ? byId(selId) || null : null);
  K.deselect = () => { selId = -1; follow = false; };

  function pidAt(x, y) {
    const m = I().map();
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= m.W || yi >= m.H) return -1;
    return m.pid[yi * m.W + xi];
  }
  const hostile = (a, b) => I().atWar(a, b);
  const friendly = (owner, o) => o === owner || I().allied(owner, o);
  function speedPx(a) {
    const u = a.units;
    const foot = u.inf + u.mg + u.at;
    let f = u.heavy > 0 ? 0.75 : u.art + u.rocket > 0 ? 0.85 : 1;
    if (foot === 0) f *= 1.35;
    const p = P(a.prov);
    const tf = p ? ({ 'Ormanlık': 0.8, 'Tepelik': 0.7, 'Çöl': 0.85, 'Tundra': 0.75 }[p.terrain] || 1) : 1;
    return 11 * scale() * f * tf;
  }
  function domClass(u) {
    const c = { inf: 0, tank: 0, art: 0 };
    U.TYPES.forEach((t) => { c[C.techClass[t]] += u[t] * C.power[t]; });
    return c.tank >= c.inf && c.tank >= c.art ? 'tank' : c.art > c.inf ? 'art' : 'inf';
  }

  // ---------------------------------------------------------------- routing
  function route(owner, from, to) {
    const Ps = G().provinces, n = Ps.length;
    if (from < 0 || to < 0) return null;
    const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let u = -1, b = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < b) { b = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = 1;
      const pu = Ps[u];
      for (const q of pu.neighbors) {
        const pq = Ps[q];
        const ok = friendly(owner, pq.owner) || hostile(owner, pq.owner);
        if (!ok) continue;
        const w = Math.hypot(pq.cx - pu.cx, pq.cy - pu.cy) * (hostile(owner, pq.owner) && q !== to ? 3 : 1);
        if (dist[u] + w < dist[q]) { dist[q] = dist[u] + w; prev[q] = u; }
      }
    }
    if (dist[to] === Infinity) return null;
    const path = [];
    for (let c = to; c !== from; c = prev[c]) path.push(c);
    return path.reverse();
  }
  function orderTo(a, pid, x, y) {
    const p = P(pid);
    if (!p) return false;
    let path = pid === a.prov ? [] : route(a.owner, a.prov, pid);
    if (path === null) return false;
    a.wp = path.map((id) => ({ x: P(id).cx, y: P(id).cy, pid: id }));
    if (x != null && friendly(a.owner, p.owner)) {
      if (a.wp.length) a.wp[a.wp.length - 1] = { x, y, pid };
      else a.wp = [{ x, y, pid }];
    } else if (!a.wp.length) a.wp = [{ x: p.cx, y: p.cy, pid }];
    a.dest = pid;
    return true;
  }
  function chaseUpdate(a) {
    const b = byId(a.chase);
    if (!b || !hostile(a.owner, b.owner)) { a.chase = null; return; }
    const path = b.prov === a.prov ? [] : route(a.owner, a.prov, b.prov);
    if (path === null) { a.chase = null; a.wp = []; return; }
    a.wp = path.slice(0, -1).map((id) => ({ x: P(id).cx, y: P(id).cy, pid: id }));
    a.wp.push({ x: b.x, y: b.y, pid: -1 });
    a.dest = b.prov;
  }
  function nearestOwn(a, exclude) {
    let best = null, bd = 1e18;
    for (const p of G().provinces) {
      if (!friendly(a.owner, p.owner) || p.id === exclude) continue;
      const d = (p.cx - a.x) ** 2 + (p.cy - a.y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function goHome(a) {
    const p = nearestOwn(a);
    if (!p) return;
    a.chase = null;
    if (!orderTo(a, p.id)) { a.wp = [{ x: p.cx, y: p.cy, pid: p.id }]; }
    a.mergeHome = true;
  }
  function retreat(a, from) {
    a.wp = []; a.chase = null; a.cool = 3;
    const home = nearestOwn(a, from && from.prov != null ? undefined : a.prov);
    if (home) a.wp = [{ x: home.cx, y: home.cy, pid: home.id }];
  }
  function removeArmy(a) {
    a.dead = true;
    const g = G();
    g.armies = g.armies.filter((x) => x !== a);
    if (selId === a.id) { selId = -1; follow = false; }
  }
  function mergeInto(a, p) {
    U.TYPES.forEach((t) => { p.units[t] += a.units[t]; });
    removeArmy(a);
  }

  K.formArmy = function (owner, units, p) {
    const g = G(), n = I().nation(owner);
    n.armyNo = (n.armyNo || 0) + 1;
    const a = {
      id: g.nextArmyId++, owner, units: U.copyUnits(units), x: p.cx + (Math.random() - 0.5) * 6, y: p.cy + 6 + Math.random() * 4,
      prov: p.id, wp: [], dest: -1, chase: null, cool: 0,
      name: I().isPlayer(owner) ? `${n.armyNo}. Ordu` : `${n.name} ${n.armyNo}. Ordusu`,
    };
    g.armies.push(a);
    if (I().isPlayer(owner)) {
      selId = a.id;
      UI.toast(`<b>${a.name}</b> kuruldu. Haritada gitmesini istediğin yere sağ tıkla.`, 'good');
      LOL.audio.say('select', domClass(a.units));
      if (!speed) K.setSpeed(1);
    }
    return a;
  };

  // ---------------------------------------------------------------- battles
  async function siege(a, p) {
    const i = I();
    const def = p.owner;
    if (!U.sumUnits(p.units)) {
      i.capture(p, a.owner, U.zeroUnits());
      if (i.isPlayer(a.owner) || i.isPlayer(def) || i.map().kind !== 'world') i.news('flag', U.shade(i.nation(a.owner).color, -0.3), `${i.nn(a.owner)} ordusu ${U.esc(p.name)} bölgesine girdi.`, `${i.nn(def)} garnizonu yoktu.`, i.isPlayer(a.owner) || i.isPlayer(def));
      if (i.isPlayer(a.owner)) LOL.audio.play('victory');
      i.checkGameOver(); i.setDirty(); i.updateTop();
      return;
    }
    const involved = i.isPlayer(a.owner) || i.isPlayer(def);
    a.busy = true;
    if (involved) lock = true;
    let r;
    try { r = await i.fight(a.owner, U.copyUnits(a.units), def, U.copyUnits(p.units), p, false); } finally { lock = false; a.busy = false; }
    if (a.dead) return;
    if (!r) { retreat(a); return; }
    a.units = U.copyUnits(r.attSurv);
    if (r.winner === 'attacker') {
      const ds = r.defSurv || U.zeroUnits();
      if (U.sumUnits(ds) > 0) { const ref = p.neighbors.map(P).find((q) => q.owner === def); if (ref) U.TYPES.forEach((t) => { ref.units[t] += ds[t]; }); }
      i.capture(p, a.owner, U.zeroUnits());
      if (involved || i.map().kind !== 'world') i.news('sword', i.isPlayer(a.owner) ? '#3c7a3a' : i.isPlayer(def) ? '#a83226' : '#6a4a2a', `${i.nn(a.owner)} ordusu ${U.esc(p.name)} kuşatmasını kazandı.`, involved ? `${i.nn(def)} garnizonu teslim oldu.` : '', involved);
    } else {
      p.units = U.copyUnits(r.defSurv);
      if (involved) i.news('fort', i.isPlayer(def) ? '#3c7a3a' : '#a83226', `${U.esc(p.name)} önünde ${i.nn(a.owner)} kuşatması kırıldı.`, '', true);
      retreat(a);
    }
    if (!U.sumUnits(a.units)) removeArmy(a);
    i.checkGameOver(); i.setDirty(); i.updatePanel(); i.updateTop();
  }

  async function engage(a, b) {
    const i = I();
    const involved = i.isPlayer(a.owner) || i.isPlayer(b.owner);
    a.busy = b.busy = true;
    if (involved) lock = true;
    const prov = P(a.prov) || P(b.prov) || G().provinces[0];
    let r;
    try { r = await i.fight(a.owner, U.copyUnits(a.units), b.owner, U.copyUnits(b.units), prov, true); } finally { lock = false; a.busy = b.busy = false; }
    if (a.dead || b.dead) return;
    if (!r) { retreat(a, b); return; }
    a.units = U.copyUnits(r.attSurv); b.units = U.copyUnits(r.defSurv);
    const win = r.winner === 'attacker' ? a : b, lose = win === a ? b : a;
    if (involved) i.news('sword', i.isPlayer(win.owner) ? '#3c7a3a' : '#a83226', `${U.esc(prov.name)} yakınlarında ${i.nn(win.owner)} ordusu ${i.nn(lose.owner)} ordusunu bozguna uğrattı.`, '', true);
    if (U.sumUnits(lose.units)) retreat(lose, win); else removeArmy(lose);
    if (!U.sumUnits(win.units)) removeArmy(win);
    win.cool = 1;
    i.updatePanel(); i.updateTop();
  }

  // ---------------------------------------------------------------- simulation
  function onWaypoint(a, w) {
    if (w.pid < 0) return;
    const p = P(w.pid);
    a.prov = w.pid;
    if (hostile(a.owner, p.owner)) { a.wp = []; siege(a, p); return; }
    if (!a.wp.length && a.mergeHome && p.owner === a.owner && !I().isPlayer(a.owner)) mergeInto(a, p);
  }
  function moveAll(days) {
    const list = armies().slice();
    for (const a of list) {
      if (lock) return;
      if (a.dead || a.busy || !a.wp.length) continue;
      let budget = speedPx(a) * days;
      while (budget > 0 && a.wp.length && !a.busy && !a.dead) {
        const w = a.wp[0];
        const dx = w.x - a.x, dy = w.y - a.y, d = Math.hypot(dx, dy);
        if (d <= budget) {
          a.x = w.x; a.y = w.y; budget -= d; a.wp.shift();
          onWaypoint(a, w);
          if (lock) return;
        } else { a.x += dx / d * budget; a.y += dy / d * budget; budget = 0; }
      }
      const pid = pidAt(a.x, a.y);
      if (pid >= 0) a.prov = pid;
    }
    // encounters between hostile armies
    const R = 9 * scale();
    const all = armies();
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.busy || a.dead || a.cool > 0) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.busy || b.dead || b.cool > 0 || !hostile(a.owner, b.owner)) continue;
        if (Math.abs(a.x - b.x) > R || Math.abs(a.y - b.y) > R) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > R) continue;
        const att = a.wp.length || a.chase != null ? a : b;
        engage(att, att === a ? b : a);
        if (lock) return;
        break;
      }
    }
  }

  function dailyTick() {
    const g = G(), i = I();
    g.day++;
    for (const a of armies().slice()) {
      if (!i.nation(a.owner).alive) { removeArmy(a); continue; }
      if (a.cool > 0) a.cool--;
      if (a.chase != null && !a.busy) chaseUpdate(a);
    }
    for (const n of g.nations) {
      if (!n.alive || i.isPlayer(n.id)) continue;
      if ((n.id + g.day) % 4 === 0) aiArmies(n);
    }
    if (g.day >= 30) {
      g.day = 0;
      lock = true;
      Promise.resolve(i.monthEnd()).catch((e) => console.error(e)).finally(() => { lock = false; K.renderTime(); });
    }
    K.renderTime();
  }

  function aiArmies(n) {
    const i = I(), me = n.id, sc = scale();
    const wars = i.enemiesOf(me).map((x) => x.id);
    const mine = armies().filter((a) => a.owner === me && !a.busy);
    if (!wars.length) {
      for (const a of mine) {
        if (a.wp.length) continue;
        const p = P(a.prov);
        if (p && p.owner === me) mergeInto(a, p); else goHome(a);
      }
      return;
    }
    const provs = i.provsOf(me);
    const maxA = Math.min(4, 1 + Math.floor(provs.length / 5));
    if (mine.length < maxA) {
      let best = null, bs = 0;
      for (const p of provs) {
        const pw = i.powerOf(p.units, me);
        const border = p.neighbors.some((q) => wars.includes(P(q).owner));
        const s = pw * (border ? 1.5 : 1);
        if (pw >= 5 && s > bs) { bs = s; best = p; }
      }
      if (best) {
        const take = U.zeroUnits();
        U.TYPES.forEach((t) => { take[t] = Math.floor(best.units[t] * 0.7); best.units[t] -= take[t]; });
        if (U.sumUnits(take) > 0) mine.push(K.formArmy(me, take, best));
      }
    }
    for (const a of mine) {
      if (a.dead) continue;
      if (a.chase != null && byId(a.chase)) continue;
      const ap = i.powerOf(a.units, me);
      if (ap < 2.5) { if (!a.mergeHome) goHome(a); continue; }
      if (a.wp.length && !a.mergeHome) continue;
      let best = null, bs = 0;
      for (const b of armies()) {
        if (!wars.includes(b.owner)) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d > 260 * sc) continue;
        const bp = i.powerOf(b.units, b.owner);
        if (ap > bp * 1.25) { const s = (ap / Math.max(0.5, bp)) / (1 + d / (150 * sc)); if (s > bs) { bs = s; best = { army: b }; } }
      }
      for (const p of G().provinces) {
        if (!wars.includes(p.owner)) continue;
        const d = Math.hypot(p.cx - a.x, p.cy - a.y);
        if (d > 420 * sc) continue;
        const dp = i.powerOf(p.units, p.owner) * i.defBonus(p);
        if (ap > dp * 1.3) { const s = (ap / Math.max(1, dp)) * (p.isCapital ? 1.3 : 1) / (1 + d / (150 * sc)); if (s > bs) { bs = s; best = { prov: p }; } }
      }
      if (best && best.army) { a.mergeHome = false; a.chase = best.army.id; chaseUpdate(a); }
      else if (best && best.prov) { a.mergeHome = false; a.chase = null; if (!orderTo(a, best.prov.id)) goHome(a); }
      else if (!a.wp.length) {
        const p = P(a.prov);
        if (!p || p.owner !== me) goHome(a);
      }
    }
  }

  K.update = function (dt) {
    const g = G();
    if (!g || g.playerId < 0) return;
    animT += dt;
    const a = K.selectedArmy();
    if (follow && a) I().focus(a.x, a.y);
    if (lock || !speed) return;
    const days = dt * speed / DAY_SEC;
    moveAll(days);
    if (lock) return;
    acc += days;
    while (acc >= 1 && !lock) { acc -= 1; dailyTick(); }
    const bar = U.el('tc-prog');
    if (bar) bar.style.width = ((g.day + acc) / 30 * 100) + '%';
  };

  // ---------------------------------------------------------------- input
  function pick(mx, my, filter) {
    const i = I();
    let best = null, bd = 1e9;
    for (const a of armies()) {
      if (filter && !filter(a)) continue;
      const [x, y] = i.toScreen(a.x, a.y);
      const d = (mx - x) ** 2 + (my - (y - 8)) ** 2;
      if (d < 18 * 18 && d < bd) { bd = d; best = a; }
    }
    return best;
  }
  K.leftClick = function (mx, my) {
    const a = pick(mx, my);
    if (!a) return false;
    selId = a.id;
    LOL.audio.play('select');
    if (I().isPlayer(a.owner)) LOL.audio.say('select', domClass(a.units));
    return true;
  };
  async function askWar(o) {
    const i = I(), me = i.G().playerId;
    if (i.allied(me, o)) { UI.toast('Müttefikine saldıramazsın.', 'bad'); return false; }
    if (i.truce(me, o)) { UI.toast(`${i.nation(o).name} ile ateşkes var.`, 'bad'); return false; }
    const ok = await UI.modal('Savaş İlanı', `<p>${UI.flag(i.nation(o))}<b>${U.esc(i.nation(o).name)}</b> ile barış içindesin. Ordunu oraya göndermek için savaş ilan etmelisin.</p><p class="hint">İstikrar −5</p>`,
      [{ label: 'Vazgeç', value: false }, { label: 'Savaş İlan Et', value: true, cls: 'danger' }]);
    if (!ok) return false;
    i.declareWar(me, o);
    i.nation(me).stability = Math.max(0, i.nation(me).stability - 5);
    return true;
  }
  K.rightClick = async function (pid, wx, wy, mx, my) {
    const i = I(), me = i.G().playerId;
    const a = K.selectedArmy();
    if (!a || a.owner !== me) {
      if (pid >= 0) UI.toast('Önce bir ordu seç. Ordu kurmak için kendi bölgeni seçip <b>Ordu</b> sekmesini kullan.');
      return;
    }
    if (a.busy) return;
    const t = pick(mx, my, (b) => b.owner !== me);
    if (t) {
      if (!hostile(me, t.owner) && !(await askWar(t.owner))) return;
      a.chase = t.id; a.mergeHome = false; chaseUpdate(a);
      LOL.audio.say('attack', domClass(a.units));
      if (!speed) K.setSpeed(1);
      i.updatePanel();
      return;
    }
    if (pid < 0) { UI.toast('Ordular denizde yürüyemez — kıyıya ya da bir deniz yolunun ucuna tıkla.', 'bad'); return; }
    const p = P(pid);
    if (!friendly(me, p.owner) && !hostile(me, p.owner) && !(await askWar(p.owner))) return;
    a.chase = null;
    if (!orderTo(a, pid, wx, wy)) { UI.toast('Oraya giden bir yol yok (barışta olduğun ülkelerin topraklarından geçilemez).', 'bad'); return; }
    LOL.audio.say(hostile(me, p.owner) ? 'attack' : 'move', domClass(a.units));
    if (!speed) K.setSpeed(1);
    i.updatePanel();
  };
  K.key = function (e) {
    if (e.key === ' ') { e.preventDefault(); K.setSpeed(speed ? 0 : (K.lastSpeed || 1)); }
    else if (e.key === '1') K.setSpeed(1);
    else if (e.key === '2') K.setSpeed(2);
    else if (e.key === '3') K.setSpeed(4);
    else if (e.key === 'f' || e.key === 'F') { if (K.selectedArmy()) follow = !follow; }
  };
  K.setSpeed = function (s) {
    if (s) K.lastSpeed = s;
    speed = s;
    LOL.audio.play('click');
    K.renderTime();
  };
  K.renderTime = function () {
    const g = G();
    if (!g || g.playerId < 0) return;
    const i = I();
    const m = (g.turn - 1) % 12, y = 1936 + Math.floor((g.turn - 1) / 12);
    const el = U.el('tc-date');
    if (el) el.textContent = `${g.day + 1} ${i.MONTHS[m]} ${y}`;
    const bar = U.el('tc-prog');
    if (bar) bar.style.width = ((g.day + acc) / 30 * 100) + '%';
    document.querySelectorAll('#timectrl [data-spd]').forEach((b) => b.classList.toggle('on', +b.dataset.spd === speed));
    const tc = U.el('timectrl');
    if (tc) tc.classList.toggle('paused', !speed);
  };
  K.bind = function () {
    U.el('timectrl').addEventListener('click', (e) => {
      const b = e.target.closest('[data-spd]');
      if (b) K.setSpeed(+b.dataset.spd);
    });
    U.el('timectrl').addEventListener('mousedown', (e) => e.stopPropagation());
  };

  // ---------------------------------------------------------------- panel
  K.panelHtml = function (a) {
    const i = I(), n = i.nation(a.owner), me = i.G().playerId, own = a.owner === me;
    const p = P(a.prov);
    const tgt = a.chase != null && byId(a.chase) ? `Takipte: <b>${U.esc(byId(a.chase).name)}</b>` : a.wp.length ? `Yürüyüşte → <b>${U.esc(P(a.dest) ? P(a.dest).name : '')}</b>` : 'Bekliyor';
    const days = a.wp.length ? Math.ceil(a.wp.reduce((s, w, k) => s + Math.hypot(w.x - (k ? a.wp[k - 1].x : a.x), w.y - (k ? a.wp[k - 1].y : a.y)), 0) / speedPx(a)) : 0;
    let html = `<div class="pp-head"><div class="tint" style="background:${n.color}"></div><button class="pp-close" data-act="army-close">×</button>
      <div class="pp-title army-head"><img class="flagimg" src="${UI.flagURL(n)}">${U.esc(a.name)}</div>
      <div class="pp-sub">${U.esc(n.name)} ${own ? '<span class="tag gold">SENİN ORDUN</span>' : hostile(me, a.owner) ? '<span class="tag war">DÜŞMAN</span>' : '<span class="tag">YABANCI</span>'}</div></div>
      <div class="pp-body">
      <div class="army-stat"><span>${tgt}${days ? ` · ~${days} gün` : ''}</span></div>
      <div class="army-stat"><span>Güç <b>${Math.round(i.powerOf(a.units, a.owner))}</b></span><span>Hız <b>${speedPx(a).toFixed(1)}</b>/gün</span><span>Konum <b>${p ? U.esc(p.name) : 'Deniz'}</b></span></div>
      <div class="units-row">${U.TYPES.filter((t) => a.units[t] > 0).map((t) => `<div class="ucard" title="${C.unitName[t]}: ${C.unitDesc[t]}"><img src="${UI.unitIcon(t, n.color)}"><div class="n">${a.units[t]}</div><div class="t">${C.unitShort[t]}</div></div>`).join('')}</div>`;
    if (own) {
      const inOwn = p && p.owner === me;
      html += `<div class="btnrow">
        <button data-act="army-stop">Dur</button>
        <button data-act="army-follow" class="${follow ? 'primary' : ''}">${follow ? 'Takibi Bırak' : 'Kamerayla İzle (F)'}</button></div>
        <div class="btnrow">
        <button data-act="army-take" ${inOwn && U.sumUnits(p.units) ? '' : 'disabled'}>Garnizonu Orduya Kat</button>
        <button data-act="army-merge" ${inOwn ? '' : 'disabled'}>Garnizona Bırak</button></div>
        <div class="hint">Haritada <b>sağ tık</b>: oraya yürü · düşman ordusuna sağ tık: peşine düş · düşman bölgesine yürürsen kuşatma başlar.<br><b>Boşluk</b>: zamanı duraklat/başlat · <b>1-2-3</b>: hız.</div>`;
    }
    return html + '</div>';
  };
  K.action = async function (act) {
    const a = K.selectedArmy();
    if (act === 'army-close') { K.deselect(); return; }
    if (!a || !I().isPlayer(a.owner) || a.busy) return;
    const p = P(a.prov);
    if (act === 'army-stop') { a.wp = []; a.chase = null; }
    else if (act === 'army-follow') follow = !follow;
    else if (act === 'army-take' && p && p.owner === a.owner) { U.TYPES.forEach((t) => { a.units[t] += p.units[t]; p.units[t] = 0; }); LOL.audio.play('coin'); }
    else if (act === 'army-merge' && p && p.owner === a.owner) { mergeInto(a, p); UI.toast(`Ordu ${U.esc(p.name)} garnizonuna katıldı.`); }
    I().updateTop();
  };

  // ---------------------------------------------------------------- drawing
  function figure(ctx, x, y, s, col, bob) {
    ctx.fillStyle = '#1e1a14';
    ctx.fillRect(x - 1.6 * s, y - 4 * s + bob, 1.2 * s, 4 * s); ctx.fillRect(x + 0.4 * s, y - 4 * s - bob, 1.2 * s, 4 * s);
    ctx.fillStyle = col; ctx.fillRect(x - 2 * s, y - 9 * s, 4 * s, 5.5 * s);
    ctx.fillStyle = '#e2b892'; ctx.beginPath(); ctx.arc(x, y - 10.4 * s, 1.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = U.shade(col, -0.45); ctx.beginPath(); ctx.arc(x, y - 10.9 * s, 1.8 * s, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(x + 1.5 * s, y - 8 * s); ctx.lineTo(x + 2.5 * s, y - 13 * s); ctx.stroke();
  }
  function tankFig(ctx, x, y, s, col) {
    ctx.fillStyle = '#1e1e1c'; ctx.fillRect(x - 7 * s, y - 3 * s, 14 * s, 3.5 * s);
    ctx.fillStyle = col; ctx.fillRect(x - 6 * s, y - 6.5 * s, 12 * s, 3.8 * s);
    ctx.fillStyle = U.shade(col, 0.12); ctx.fillRect(x - 3 * s, y - 9.5 * s, 6 * s, 3.2 * s);
    ctx.fillStyle = '#151515'; ctx.fillRect(x + 2.5 * s, y - 8.7 * s, 6 * s, 1.3 * s);
  }
  function token(ctx, a, x, y, s, sel) {
    const i = I(), n = i.nation(a.owner);
    const col = n.color;
    const moving = a.wp.length > 0 && speed > 0 && !lock;
    const bob = moving ? Math.sin(animT * 12 + a.id) * 0.9 * s : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 1, 12 * s, 3.6 * s, 0, 0, 7); ctx.fill();
    if (sel) {
      ctx.strokeStyle = `rgba(255,220,120,${0.6 + 0.4 * Math.sin(animT * 5)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 1, 16 * s, 5.5 * s, 0, 0, 7); ctx.stroke();
    }
    const dc = domClass(a.units);
    if (dc === 'tank') { tankFig(ctx, x - 1 * s, y, s, col); figure(ctx, x - 9 * s, y + 1, s * 0.85, col, bob); }
    else { figure(ctx, x - 6 * s, y, s, col, bob); figure(ctx, x, y + 1.5 * s, s, col, -bob); figure(ctx, x + 6 * s, y, s, col, bob); if (dc === 'art') { ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x - 10 * s, y); ctx.lineTo(x - 15 * s, y - 6 * s); ctx.stroke(); } }
    // banner
    const bx = x + 10 * s, by = y - 26 * s;
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, by - 2 * s); ctx.stroke();
    const im = flagImg(n);
    const fw = 16 * s, fh = 11 * s;
    if (im.complete) {
      const wave = Math.sin(animT * 4 + a.id) * 1.2 * s;
      ctx.save(); ctx.translate(bx, by); ctx.transform(1, wave / fw, 0, 1, 0, 0);
      ctx.drawImage(im, 0, 0, fw, fh);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.8; ctx.strokeRect(0, 0, fw, fh);
      ctx.restore();
    }
    // strength plate
    const tot = U.sumUnits(a.units);
    ctx.font = `700 ${Math.round(9.5 * Math.min(1.3, s))}px Inter, sans-serif`;
    const label = String(tot);
    const w = ctx.measureText(label).width + 10;
    const px = x - w / 2, py = y + 4 * s;
    ctx.fillStyle = 'rgba(10,14,20,0.9)'; ctx.fillRect(px, py, w, 12 * Math.min(1.3, s));
    ctx.fillStyle = col; ctx.fillRect(px, py, 3, 12 * Math.min(1.3, s));
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(label, x + 1.5, py + 9.5 * Math.min(1.3, s));
    if (i.isPlayer(a.owner) && i.cam().s > 1.2) {
      ctx.font = `600 ${Math.round(9 * Math.min(1.3, s))}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(a.name, x + 1, py + 23 * Math.min(1.3, s) + 1);
      ctx.fillStyle = '#ffe9a0'; ctx.fillText(a.name, x, py + 23 * Math.min(1.3, s));
    }
    if (a.busy) {
      ctx.font = '16px sans-serif'; ctx.fillText('⚔', x, y - 30 * s);
    }
  }
  K.draw = function (ctx) {
    const i = I(), g = G();
    if (!g || g.playerId < 0) return;
    const cam = i.cam();
    const s = U.clamp(cam.s * 0.8, 1.05, 1.7);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    // routes
    for (const a of armies()) {
      if (!a.wp.length || !(a.owner === g.playerId || a.id === selId)) continue;
      ctx.setLineDash([6, 5]); ctx.lineDashOffset = -animT * 14;
      ctx.lineWidth = 2;
      const dest = P(a.dest);
      ctx.strokeStyle = dest && hostile(a.owner, dest.owner) || a.chase != null ? 'rgba(255,90,70,0.85)' : 'rgba(255,230,150,0.85)';
      ctx.beginPath();
      let [x0, y0] = i.toScreen(a.x, a.y);
      ctx.moveTo(x0, y0);
      for (const w of a.wp) { const [x, y] = i.toScreen(w.x, w.y); ctx.lineTo(x, y); x0 = x; y0 = y; }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(x0, y0, 4, 0, 7); ctx.fill();
    }
    const list = armies().map((a) => ({ a, p: i.toScreen(a.x, a.y) })).filter((o) => o.p[0] > -40 && o.p[1] > -40 && o.p[0] < W + 40 && o.p[1] < H + 40);
    list.sort((u, v) => u.p[1] - v.p[1]);
    for (const o of list) token(ctx, o.a, o.p[0], o.p[1], s, o.a.id === selId);
  };
  K.armyPowerOf = (nid) => armies().filter((a) => a.owner === nid).reduce((s, a) => s + I().powerOf(a.units, nid), 0);
  K.armyUnitsOf = (nid) => armies().filter((a) => a.owner === nid);
})();
