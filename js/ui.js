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
      wrap.innerHTML = `<div class="modal ${opts.cls || ''}"><h2>${title}</h2><div class="modal-body">${bodyHtml}</div><div class="modal-btns"></div></div>`;
      const close = (v) => { wrap.remove(); resolve(v); };
      const bb = wrap.querySelector('.modal-btns');
      buttons.forEach((b) => {
        const e = document.createElement('button');
        e.textContent = b.label;
        if (b.cls) e.className = b.cls;
        e.onclick = () => { LOL.audio.play('click'); close(b.value); };
        bb.appendChild(e);
      });
      root.appendChild(wrap);
      if (opts.onMount) opts.onMount(wrap, close);
    });
  };

  UI.isModalOpen = () => U.el('modal-root').children.length > 0;

  UI.tooltip = function (html, x, y) {
    const t = U.el('tooltip');
    if (!html) { t.classList.add('hidden'); return; }
    t.innerHTML = html;
    t.classList.remove('hidden');
    const w = t.offsetWidth, h = t.offsetHeight;
    let tx = x + 16, ty = y + 16;
    if (tx + w > window.innerWidth - 4) tx = x - w - 12;
    if (ty + h > window.innerHeight - 4) ty = y - h - 12;
    t.style.left = tx + 'px';
    t.style.top = ty + 'px';
  };

  UI.flag = (color) => `<span class="flag" style="background:${color}"></span>`;
})();
