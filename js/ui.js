'use strict';
(function () {
  const U = LOL.util;
  const UI = (LOL.ui = {});

  // buttons: [{label, value, cls}] -> Promise resolving with chosen value
  UI.modal = function (title, bodyHtml, buttons, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const root = U.el('modal-root');
      const wrap = document.createElement('div');
      wrap.className = 'modal-back';
      wrap.innerHTML = `<div class="modal ${opts.cls || ''}" style="${opts.width ? 'width:' + opts.width + 'px;max-width:94vw' : ''}">
        ${opts.banner || ''}
        <div class="modal-inner">${title ? `<h2>${title}</h2>` : ''}<div class="modal-body">${bodyHtml}</div><div class="modal-btns"></div></div></div>`;
      const close = (v) => { wrap.classList.add('closing'); setTimeout(() => wrap.remove(), 140); resolve(v); };
      const bb = wrap.querySelector('.modal-btns');
      buttons.forEach((b) => {
        const e = document.createElement('button');
        e.innerHTML = b.label;
        if (b.cls) e.className = b.cls;
        if (b.disabled) e.disabled = true;
        if (b.title) e.title = b.title;
        e.onclick = () => { LOL.audio.play('click'); close(b.value); };
        bb.appendChild(e);
      });
      if (!buttons.length) bb.remove();
      root.appendChild(wrap);
      if (opts.closeOnBack) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(opts.backValue); });
      if (opts.onMount) opts.onMount(wrap, close);
    });
  };

  UI.isModalOpen = () => { const r = U.el('modal-root'); return [...r.children].some((c) => !c.classList.contains('closing')); };

  UI.tooltip = function (html, x, y) {
    const t = U.el('tooltip');
    if (!html) { t.classList.add('hidden'); return; }
    if (t._html !== html) { t.innerHTML = html; t._html = html; }
    t.classList.remove('hidden');
    const w = t.offsetWidth, h = t.offsetHeight;
    let tx = x + 18, ty = y + 18;
    if (tx + w > window.innerWidth - 4) tx = x - w - 12;
    if (ty + h > window.innerHeight - 4) ty = y - h - 12;
    t.style.left = tx + 'px';
    t.style.top = ty + 'px';
  };

  UI.toast = function (html, kind) {
    const box = U.el('toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = html;
    box.appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3700);
  };

  // ---------------- procedural flags ----------------
  const flagCache = {};
  UI.flagURL = function (n) {
    const key = n.name + n.color + (n.flagSeed || 0);
    if (flagCache[key]) return flagCache[key];
    const c = document.createElement('canvas'); c.width = 60; c.height = 40;
    const g = c.getContext('2d');
    if (n.flagSpec) {
      drawSpec(g, n.flagSpec);
      const gr0 = g.createLinearGradient(0, 0, 60, 40);
      gr0.addColorStop(0, 'rgba(255,255,255,0.15)'); gr0.addColorStop(0.5, 'rgba(255,255,255,0)'); gr0.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = gr0; g.fillRect(0, 0, 60, 40);
      return (flagCache[key] = c.toDataURL());
    }
    let h = 0; for (const ch of n.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = U.rng(h + (n.flagSeed || 0));
    const main = n.color;
    const pal = ['#f4f1e6', '#16161a', '#d9b23a', U.shade(main, -0.45), '#b8202a', '#1d3f8a', '#2f7a3a'];
    const others = pal.filter((p) => p !== main);
    const a = main, b = rng.pick(others.slice(0, 4)), d = rng.pick(others);
    const pat = rng.int(0, 7);
    g.fillStyle = a; g.fillRect(0, 0, 60, 40);
    const star = (x, y, r, col) => {
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      g.closePath(); g.fill();
    };
    switch (pat) {
      case 0: g.fillStyle = b; g.fillRect(0, 13.3, 60, 13.4); g.fillStyle = d; g.fillRect(0, 26.6, 60, 13.4); break;
      case 1: g.fillStyle = b; g.fillRect(20, 0, 20, 40); g.fillStyle = d; g.fillRect(40, 0, 20, 40); break;
      case 2: g.fillStyle = b; g.fillRect(16, 0, 8, 40); g.fillRect(0, 16, 60, 8); g.fillStyle = d; g.fillRect(18.5, 0, 3, 40); g.fillRect(0, 18.5, 60, 3); break;
      case 3: g.fillStyle = b; g.fillRect(0, 20, 60, 20); g.fillStyle = d; g.fillRect(0, 0, 24, 20); star(12, 10, 7, b); break;
      case 4: g.fillStyle = b; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 20); g.lineTo(0, 40); g.closePath(); g.fill(); star(9, 20, 6, d); break;
      case 5: g.fillStyle = b; g.beginPath(); g.moveTo(0, 40); g.lineTo(60, 0); g.lineTo(60, 40); g.closePath(); g.fill(); g.fillStyle = d; g.beginPath(); g.arc(30, 20, 8, 0, 7); g.fill(); break;
      case 6: g.fillStyle = b; g.fillRect(0, 0, 60, 8); g.fillRect(0, 32, 60, 8); g.fillStyle = d; g.beginPath(); g.arc(30, 20, 9, 0, 7); g.fill(); star(30, 20, 6, a); break;
      default: g.fillStyle = b; g.fillRect(0, 0, 60, 20); star(30, 20, 9, d); break;
    }
    // cloth shading
    const gr = g.createLinearGradient(0, 0, 60, 40);
    gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = gr; g.fillRect(0, 0, 60, 40);
    const url = c.toDataURL();
    flagCache[key] = url;
    return url;
  };

  // real-world flag renderer (simplified designs)
  function drawSpec(g, f) {
    const Wf = 60, Hf = 40;
    const star = (x, y, r, col, rot) => {
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (rot || 0) + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      g.closePath(); g.fill();
    };
    const stripes = (cols, horiz, weights) => {
      let pos = 0;
      cols.forEach((col, i) => {
        const w = weights ? weights[i] : 1 / cols.length;
        g.fillStyle = col;
        if (horiz) g.fillRect(0, Math.floor(pos * Hf), Wf, Math.ceil(w * Hf) + 1); else g.fillRect(Math.floor(pos * Wf), 0, Math.ceil(w * Wf) + 1, Hf);
        pos += w;
      });
    };
    const ukJack = (x0, y0, w, h) => {
      g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      g.fillStyle = '#012169'; g.fillRect(x0, y0, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = h * 0.2;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w, y0 + h); g.moveTo(x0 + w, y0); g.lineTo(x0, y0 + h); g.stroke();
      g.strokeStyle = '#c8102e'; g.lineWidth = h * 0.07;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w, y0 + h); g.moveTo(x0 + w, y0); g.lineTo(x0, y0 + h); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(x0 + w / 2 - h * 0.17, y0, h * 0.34, h); g.fillRect(x0, y0 + h / 2 - h * 0.17, w, h * 0.34);
      g.fillStyle = '#c8102e'; g.fillRect(x0 + w / 2 - h * 0.1, y0, h * 0.2, h); g.fillRect(x0, y0 + h / 2 - h * 0.1, w, h * 0.2);
      g.restore();
    };
    if (f.usa) {
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#b22234'; g.fillRect(0, i * Hf / 13, Wf, Hf / 13 + 0.5); }
      g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 26, 21.5);
      g.fillStyle = '#fff';
      for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) g.fillRect(2 + k * 4 + (r % 2) * 2, 2 + r * 4, 1.4, 1.4);
      return;
    }
    if (f.uk) { ukJack(0, 0, Wf, Hf); return; }
    if (f.greece) {
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#fff' : '#0d5eaf'; g.fillRect(0, i * Hf / 9, Wf, Hf / 9 + 0.5); }
      g.fillStyle = '#0d5eaf'; g.fillRect(0, 0, 22, 22.2);
      g.fillStyle = '#fff'; g.fillRect(8.9, 0, 4.4, 22.2); g.fillRect(0, 8.9, 22, 4.4);
      return;
    }
    if (f.brazil) {
      g.fillStyle = '#009c3b'; g.fillRect(0, 0, Wf, Hf);
      g.fillStyle = '#ffdf00'; g.beginPath(); g.moveTo(30, 4); g.lineTo(56, 20); g.lineTo(30, 36); g.lineTo(4, 20); g.closePath(); g.fill();
      g.fillStyle = '#002776'; g.beginPath(); g.arc(30, 20, 9, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.arc(30, 30, 13, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
      return;
    }
    if (f.solid) { g.fillStyle = f.solid; g.fillRect(0, 0, Wf, Hf); }
    if (f.h) stripes(f.h, true);
    if (f.v) stripes(f.v, false);
    if (f.hw) stripes(f.hw.map((x) => x[0]), true, f.hw.map((x) => x[1]));
    if (f.vw) stripes(f.vw.map((x) => x[0]), false, f.vw.map((x) => x[1]));
    if (f.nordic) {
      const [bg, cr, inner] = f.nordic;
      g.fillStyle = bg; g.fillRect(0, 0, Wf, Hf);
      g.fillStyle = cr; g.fillRect(16, 0, 9, Hf); g.fillRect(0, 15.5, Wf, 9);
      if (inner) { g.fillStyle = inner; g.fillRect(18.5, 0, 4, Hf); g.fillRect(0, 18, Wf, 4); }
    }
    if (f.stripes) { g.fillStyle = f.stripes; g.fillRect(0, 4, Wf, 4); g.fillRect(0, 32, Wf, 4); }
    if (f.band) { g.fillStyle = f.band; g.fillRect(0, 0, 15, Hf); }
    if (f.vband) { g.fillStyle = f.vband; g.fillRect(0, 0, 20, Hf); }
    if (f.border) { g.strokeStyle = f.border; g.lineWidth = 4; g.strokeRect(2, 2, Wf - 4, Hf - 4); }
    if (f.diag) {
      g.fillStyle = '#ffd100'; g.beginPath(); g.moveTo(0, 40); g.lineTo(0, 33); g.lineTo(50, 0); g.lineTo(60, 0); g.lineTo(60, 7); g.lineTo(10, 40); g.closePath(); g.fill();
      g.fillStyle = f.diag; g.beginPath(); g.moveTo(0, 40); g.lineTo(60, 40); g.lineTo(60, 9); g.lineTo(13, 40); g.closePath(); g.fill();
      g.fillStyle = K0(f); g.beginPath(); g.moveTo(3, 40); g.lineTo(60, 2); g.lineTo(60, 8); g.lineTo(12, 40); g.closePath(); g.fill();
    }
    if (f.tri) { g.fillStyle = f.tri; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, 20); g.lineTo(0, 40); g.closePath(); g.fill(); }
    if (f.ukCanton) ukJack(0, 0, 30, 20);
    if (f.canton && typeof f.canton === 'string') { g.fillStyle = f.canton; g.fillRect(0, 0, 26, 20); }
    if (f.quarter) { g.fillStyle = '#d21034'; g.fillRect(30, 0, 30, 20); g.fillStyle = '#005293'; g.fillRect(0, 20, 30, 20); star(15, 10, 5, '#005293'); star(45, 30, 5, '#d21034'); }
    if (f.cross) {
      g.fillStyle = f.cross;
      if (f.thin) { g.fillRect(27, 0, 6, Hf); g.fillRect(0, 17, Wf, 6); } else { g.fillRect(25.5, 9, 9, 22); g.fillRect(19, 15.5, 22, 9); }
    }
    if (f.disc) {
      const col = typeof f.disc === 'string' ? f.disc : '#fff';
      g.fillStyle = col; g.beginPath(); g.arc(f.crescent ? 30 : 30, 20, 10, 0, 7); g.fill();
    }
    if (f.sun) {
      g.fillStyle = f.sun; g.strokeStyle = f.sun; g.lineWidth = 1.2;
      const cx = f.canton ? 13 : 30, cy = f.canton ? 10 : 20, r = f.canton ? 4 : 6;
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * r * 1.7, cy + Math.sin(a) * r * 1.7); g.stroke(); }
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
    if (f.crescent) {
      const col = f.crescent;
      const cx = f.v || f.vw || f.pk ? 31 : f.h ? 27 : 24, cy = 20;
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill();
      const back = f.disc ? '#e70013' : f.solid && !f.h ? f.solid : f.h ? f.h[Math.floor(f.h.length / 2)] : f.vw ? f.vw[f.vw.length - 1][0] : f.hw ? f.hw[1][0] : f.v ? f.v[1] : '#000';
      g.fillStyle = back; g.beginPath(); g.arc(cx + 2.6, cy, 8, 0, 7); g.fill();
      star(cx + 9, cy, 4.2, col, -Math.PI / 2 + 0.3);
    }
    if (f.star) {
      if (f.canton) star(f.canton === 1 ? 11 : 13, 10, 5, f.star);
      else if (f.tri) star(7, 20, 4.5, f.star);
      else if (f.ukCanton) { star(44, 28, 4, f.star); star(50, 14, 3, f.star); star(40, 12, 3, f.star); }
      else star(30, 20, 8, f.star);
    }
    if (f.emblem) { g.fillStyle = f.emblem; g.beginPath(); g.arc(30, 20, 6, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(30, 20, 3, 0, 7); g.fill(); }
  }
  const K0 = () => '#000';

  UI.flag = function (n, size) {
    if (typeof n === 'string') return `<span class="flag" style="background:${n}"></span>`;
    const s = size || 18;
    return `<img class="flagimg" src="${UI.flagURL(n)}" style="width:${s * 1.5}px;height:${s}px" alt="">`;
  };

  // ---------------- icons (inline SVG) ----------------
  const P = {
    gold: '<circle cx="12" cy="12" r="8" fill="#e8c048" stroke="#7a5a10" stroke-width="1.5"/><text x="12" y="16" font-size="10" text-anchor="middle" fill="#7a5a10" font-weight="bold">₺</text>',
    man: '<circle cx="12" cy="7" r="3.5" fill="currentColor"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7z" fill="currentColor"/>',
    stab: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="currentColor"/>',
    sci: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 16h10l1.5 3H5.5z" fill="currentColor"/>',
    sword: '<path d="M4 20l4-4M14 4l6 0 0 6-9 9-6-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    dove: '<path d="M3 13c4 0 6-2 8-6 1 3 4 4 7 4l3-2-1 4c-2 5-7 7-12 6l-3 2 1-3c-2-1-3-3-3-5z" fill="currentColor"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" fill="none" stroke="currentColor" stroke-width="2"/>',
    globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    save: '<path d="M5 3h11l3 3v15H5z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="3" width="7" height="5" fill="currentColor"/><rect x="8" y="13" width="8" height="6" fill="currentColor"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8c2 2 2 6 0 8M18.5 5.5c3.5 3.5 3.5 9.5 0 13" fill="none" stroke="currentColor" stroke-width="2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4"/>',
    crown: '<path d="M3 18h18l-2-10-4 4-3-6-3 6-4-4z" fill="currentColor"/>',
    factory: '<path d="M3 21V10l5 3V10l5 3V5h4v16z" fill="currentColor"/>',
    fort: '<path d="M3 21V8h3v3h3V8h3v3h3V8h3v3h3V8h0v13z" fill="currentColor"/>',
    barracks: '<path d="M3 11l9-6 9 6v10H3z" fill="currentColor"/><rect x="10" y="14" width="4" height="7" fill="#000" opacity=".35"/>',
    news: '<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 9h12M6 12h12M6 15h7" stroke="currentColor" stroke-width="1.6"/>',
    alert: '<path d="M12 3l10 18H2z" fill="currentColor"/><rect x="11" y="9" width="2" height="6" fill="#000"/><rect x="11" y="16.5" width="2" height="2" fill="#000"/>',
    handshake: '<path d="M2 12l4-4 4 2 3-2 4 1 5 3-4 4-3-2-4 4-3-3-3 1z" fill="currentColor"/>',
    skull: '<path d="M12 3a8 8 0 00-8 8c0 3 2 5 3 6v3h10v-3c1-1 3-3 3-6a8 8 0 00-8-8z" fill="currentColor"/><circle cx="9" cy="11" r="2" fill="#000"/><circle cx="15" cy="11" r="2" fill="#000"/>',
    flag: '<path d="M5 21V3M5 4h12l-3 4 3 4H5" fill="currentColor" stroke="currentColor" stroke-width="2"/>',
    hammer: '<path d="M4 20l9-9M11 5l5-2 5 5-2 5-3-1-4-4z" fill="currentColor" stroke="currentColor" stroke-width="2"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.5"/>',
    coin: '<circle cx="12" cy="12" r="8" fill="currentColor"/>',
    tree: '<path d="M12 2l6 9h-3l4 6H5l4-6H6z" fill="currentColor"/><rect x="11" y="17" width="2" height="5" fill="currentColor"/>',
    army: '<path d="M4 18l8-12 8 12z" fill="currentColor"/>',
    book: '<path d="M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7z" fill="none" stroke="currentColor" stroke-width="2"/>',
    star: '<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z" fill="currentColor"/>',
    next: '<path d="M6 4l10 8-10 8z" fill="currentColor"/><rect x="17" y="4" width="3" height="16" fill="currentColor"/>',
  };
  UI.icon = (name, size, color) => `<svg class="ico" width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" style="${color ? 'color:' + color : ''}">${P[name] || ''}</svg>`;

  // unit portrait icons (canvas -> data URL)
  const unitIcoCache = {};
  UI.unitIcon = function (type, color) {
    const key = type + color;
    if (unitIcoCache[key]) return unitIcoCache[key];
    const c = document.createElement('canvas'); c.width = 64; c.height = 44;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 44);
    bg.addColorStop(0, '#2c3a48'); bg.addColorStop(1, '#10161c');
    g.fillStyle = bg; g.fillRect(0, 0, 64, 44);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 44; i += 3) g.fillRect(0, i, 64, 1);
    const dark = U.shade(color, -0.45);
    const soldier = (x, y, gun) => {
      g.fillStyle = '#222'; g.fillRect(x - 3, y - 10, 2.5, 10); g.fillRect(x + 1, y - 10, 2.5, 10);
      g.fillStyle = color; g.fillRect(x - 4, y - 22, 9, 13);
      g.fillStyle = '#e2b892'; g.beginPath(); g.arc(x + 0.5, y - 25, 3.5, 0, 7); g.fill();
      g.fillStyle = dark; g.beginPath(); g.arc(x + 0.5, y - 26, 4.2, Math.PI, 0); g.fill();
      if (gun === 'at') { g.fillStyle = '#4a5a3a'; g.save(); g.translate(x, y - 22); g.rotate(-0.25); g.fillRect(-6, -3, 22, 5); g.fillStyle = '#222'; g.fillRect(14, -3.5, 3, 6); g.restore(); }
      else { g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 17); g.lineTo(x + 12, y - 21); g.stroke(); }
    };
    if (type === 'mg') {
      soldier(18, 38); soldier(34, 39);
      g.fillStyle = '#1a1a1a'; g.fillRect(40, 26, 20, 3.5); g.fillRect(44, 24, 6, 7);
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(46, 30); g.lineTo(42, 38); g.moveTo(46, 30); g.lineTo(52, 38); g.stroke();
      g.fillStyle = '#5a4a2a'; g.fillRect(50, 34, 8, 5);
    } else if (type === 'at') {
      soldier(22, 39, 'at'); soldier(42, 38);
    } else if (type === 'recon') {
      g.fillStyle = '#222'; [16, 28, 40, 50].forEach((x) => { g.beginPath(); g.arc(x, 35, 5, 0, 7); g.fill(); });
      g.fillStyle = '#555'; [16, 28, 40, 50].forEach((x) => { g.beginPath(); g.arc(x, 35, 2, 0, 7); g.fill(); });
      g.fillStyle = color; g.beginPath(); g.moveTo(8, 32); g.lineTo(12, 22); g.lineTo(50, 22); g.lineTo(58, 28); g.lineTo(58, 32); g.closePath(); g.fill();
      g.fillStyle = U.shade(color, 0.15); g.fillRect(26, 15, 13, 8);
      g.fillStyle = '#1a1a1a'; g.fillRect(37, 17, 14, 2);
    } else if (type === 'heavy') {
      g.fillStyle = '#1e1e1e'; g.fillRect(3, 27, 58, 12);
      g.fillStyle = '#555'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(8 + i * 8, 33, 3.4, 0, 7); g.fill(); }
      g.fillStyle = U.shade(color, -0.1); g.beginPath(); g.moveTo(4, 27); g.lineTo(9, 17); g.lineTo(55, 17); g.lineTo(60, 27); g.closePath(); g.fill();
      g.fillStyle = color; g.fillRect(17, 7, 24, 11);
      g.fillStyle = '#151515'; g.fillRect(39, 10, 25, 4.5);
    } else if (type === 'rocket') {
      g.fillStyle = '#222'; [14, 26, 46].forEach((x) => { g.beginPath(); g.arc(x, 36, 5, 0, 7); g.fill(); });
      g.fillStyle = color; g.fillRect(6, 24, 50, 9); g.fillRect(44, 16, 12, 9);
      g.save(); g.translate(12, 22); g.rotate(-0.4);
      g.fillStyle = '#3a3a30'; g.fillRect(0, -6, 30, 8);
      g.fillStyle = '#c0b080'; for (let i = 0; i < 4; i++) g.fillRect(30, -5.5 + i * 2, 4, 1.2);
      g.restore();
    } else if (type === 'inf') {
      for (let k = 0; k < 3; k++) {
        const x = 16 + k * 15, y = 38 - (k === 1 ? 2 : 0);
        g.fillStyle = '#222'; g.fillRect(x - 3, y - 10, 2.5, 10); g.fillRect(x + 1, y - 10, 2.5, 10);
        g.fillStyle = color; g.fillRect(x - 4, y - 22, 9, 13);
        g.fillStyle = '#e2b892'; g.beginPath(); g.arc(x + 0.5, y - 25, 3.5, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.arc(x + 0.5, y - 26, 4.2, Math.PI, 0); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 17); g.lineTo(x + 12, y - 21); g.stroke();
      }
    } else if (type === 'tank') {
      g.fillStyle = '#222'; g.beginPath(); g.roundRect ? g.roundRect(8, 28, 48, 10, 5) : g.rect(8, 28, 48, 10); g.fill();
      g.fillStyle = '#555'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(13 + i * 7.6, 33, 3, 0, 7); g.fill(); }
      g.fillStyle = color; g.beginPath(); g.moveTo(10, 28); g.lineTo(14, 20); g.lineTo(52, 20); g.lineTo(56, 28); g.closePath(); g.fill();
      g.fillStyle = U.shade(color, 0.15); g.fillRect(22, 12, 18, 9);
      g.fillStyle = '#1a1a1a'; g.fillRect(38, 14, 22, 3.5);
    } else {
      g.fillStyle = '#222'; g.fillRect(10, 30, 40, 8);
      g.fillStyle = '#444'; g.beginPath(); g.arc(18, 36, 5, 0, 7); g.arc(42, 36, 5, 0, 7); g.fill();
      g.fillStyle = color; g.fillRect(12, 22, 34, 9);
      g.fillStyle = U.shade(color, 0.1); g.fillRect(14, 16, 14, 7);
      g.save(); g.translate(26, 19); g.rotate(-0.45); g.fillStyle = '#1a1a1a'; g.fillRect(0, -2.5, 36, 5); g.restore();
    }
    const url = c.toDataURL();
    unitIcoCache[key] = url;
    return url;
  };
})();
