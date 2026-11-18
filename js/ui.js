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
    if (type === 'inf') {
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
