'use strict';
(function () {
  const U = LOL.util, UI = LOL.ui;
  const app = (LOL.app = { mode: 'menu' });
  const canvas = U.el('game');
  app.canvas = canvas;
  app.ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    LOL.strategy.onResize();
  }

  function showUI(mode) {
    U.el('menu').classList.toggle('hidden', mode !== 'menu');
    U.el('strategy-ui').classList.toggle('hidden', mode !== 'strategy');
    U.el('battle-ui').classList.toggle('hidden', mode !== 'battle');
    UI.tooltip(null);
    canvas.style.cursor = 'default';
  }

  app.toMenu = function () {
    app.mode = 'menu';
    showUI('menu');
    U.el('m-load').disabled = !LOL.strategy.hasSave();
    LOL.strategy.setPhase('menu');
  };

  app.startBattle = async function (cfg) {
    app.mode = 'battle';
    showUI('battle');
    const result = await LOL.battle.start(cfg);
    app.mode = 'strategy';
    showUI('strategy');
    LOL.strategy.refresh();
    return result;
  };

  // ---------------- input routing ----------------
  const route = (type, e) => {
    const m = app.mode === 'battle' ? LOL.battle : LOL.strategy;
    m.onInput && m.onInput(type, e);
  };
  canvas.addEventListener('mousedown', (e) => route('down', e));
  window.addEventListener('mousemove', (e) => route('move', e));
  window.addEventListener('mouseup', (e) => route('up', e));
  canvas.addEventListener('mouseleave', (e) => route('leave', e));
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); route('wheel', e); }, { passive: false });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    if (app.mode === 'battle' && (e.key.startsWith('Arrow') || (e.ctrlKey && e.key >= '1' && e.key <= '9'))) e.preventDefault();
    route('keydown', e);
  });
  window.addEventListener('keyup', (e) => route('keyup', e));
  window.addEventListener('resize', resize);

  // battle sidebar
  document.querySelector('.sb-btns').addEventListener('click', (e) => {
    const b = e.target.closest('[data-b]');
    if (b) LOL.battle.button(b.dataset.b);
  });
  const mini = U.el('minimap');
  let miniDown = false;
  mini.addEventListener('mousedown', (e) => {
    if (e.button === 2) { LOL.battle.onMinimap(e, 'right'); return; }
    miniDown = true; LOL.battle.onMinimap(e);
  });
  mini.addEventListener('mousemove', (e) => { if (miniDown) LOL.battle.onMinimap(e); });
  window.addEventListener('mouseup', () => { miniDown = false; });

  // ---------------- menu ----------------
  U.el('m-new').onclick = () => {
    LOL.audio.init(); LOL.audio.play('click');
    app.mode = 'strategy';
    showUI('strategy');
    LOL.strategy.startPick();
  };
  U.el('m-load').onclick = () => {
    LOL.audio.init(); LOL.audio.play('click');
    app.mode = 'strategy';
    showUI('strategy');
    if (!LOL.strategy.load()) app.toMenu();
  };
  U.el('m-help').onclick = () => {
    LOL.audio.init(); LOL.audio.play('click');
    UI.modal('Nasıl Oynanır', `<div class="help">
      <h3>Strateji Haritası</h3>
      <p>Haritada bir ulus seç ve dünyayı fethetmeye başla. Her bölge her tur altın getirir; başkentin ekstra gelir sağlar.</p>
      <p><b>Sol tık</b>: bölge seç &middot; <b>Sürükle</b>: haritayı kaydır &middot; <b>Tekerlek</b>: yakınlaştır</p>
      <p>Kendi bölgeni seçip <b>Asker Topla</b> ile piyade, tank ve topçu üret. Kaydırıcılarla göndereceğin kuvveti seç ve komşu bölgeye <b>sağ tıkla</b>.</p>
      <p>Barışta olduğun bir ulusa saldırmak için önce savaş ilan etmelisin. Birlikler her tur bir kez hareket edebilir. Kesikli çizgiler deniz yollarıdır.</p>
      <h3>Savaş Alanı (İzometrik)</h3>
      <p>Bir muharebe başladığında <b>Savaşı Yönet</b> seçeneğiyle savaş alanına girersin. Ya da sonucu <b>Otomatik Çöz</b>.</p>
      <p><b>Sol tık / sürükle</b>: birlik seç &middot; <b>Sağ tık</b>: hareket et / saldır &middot; <b>Ctrl+Sağ tık</b> veya <b>A</b>: saldırı hareketi (yolda düşmanla çatışır)</p>
      <p><b>S</b>: dur &middot; <b>Q</b>: tümünü seç &middot; <b>Ctrl+1-9</b>: grup kur &middot; <b>P</b>: duraklat &middot; Ok tuşları / ekran kenarı / orta tuş: kamera</p>
      <h3>Birlikler</h3>
      <p><b>Piyade</b> — ucuz, piyadeye karşı etkili, zırha karşı zayıf.<br>
      <b>Tank</b> — dayanıklı, hareket halindeyken taretiyle ateş eder, zırhlılara karşı güçlü.<br>
      <b>Topçu</b> — çok uzun menzil ve alan hasarı, ama yakın mesafede ateş edemez ve kırılgandır.</p>
      </div>`, [{ label: 'Anladım', value: 1, cls: 'primary' }]);
  };

  // ---------------- boot ----------------
  LOL.strategy.init();
  LOL.strategy.bindUI();
  resize();
  LOL.strategy.newMap((Math.random() * 1e9) >>> 0);
  app.toMenu();

  let last = performance.now();
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    try {
      if (app.mode === 'battle') LOL.battle.frame(dt);
      else LOL.strategy.frame(dt);
    } catch (err) { console.error(err); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
