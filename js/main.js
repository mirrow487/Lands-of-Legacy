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
  U.el('m-settings').onclick = () => { LOL.audio.init(); LOL.audio.play('click'); LOL.strategy.settings(); };
  // start music on the first interaction (browsers block autoplay)
  const firstGesture = () => { LOL.audio.init(); LOL.audio.music('strategy'); window.removeEventListener('pointerdown', firstGesture); };
  window.addEventListener('pointerdown', firstGesture);
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
      <h3>Büyük Strateji</h3>
      <p>Her tur bir aydır. <b>Hazine</b>, <b>İnsan Gücü</b>, <b>İstikrar</b> ve <b>Araştırma</b> ulusunun damarlarıdır. Bölgelerde <b>Fabrika</b>, <b>Tahkimat</b> ve <b>Kışla</b> inşa et; <b>Teknoloji</b> ekranından araştırma seç.</p>
      <p><b>Diplomasi</b> ekranında hediye gönderip ilişkileri geliştirebilir, ittifak kurabilir, savaş ilan edebilir veya barış isteyebilirsin. Müttefikler savaşa birlikte girer. Rastgele <b>olaylar</b> kararlarını sınar; <b>Dünya Gazetesi</b> olup biteni anlatır.</p>
      <p>Alttaki <b>harita modları</b> ile siyasi, diplomatik, ekonomik, arazi ve askerî görünümler arasında geçiş yap.</p>
      <h3>Sefer Haritası (Bannerlord tarzı)</h3>
      <p>Zaman sürekli akar; sağ alttan duraklat ya da hızlandır (<b>Boşluk</b>, <b>1-2-3</b>). Bir bölgeni seçip <b>Ordu</b> sekmesinden <b>Ordu Kur</b>: ordun bayrağıyla haritada belirir. Orduya tıklayıp seç, haritada istediğin yere <b>sağ tıkla</b>. Düşman bölgesine varırsa kuşatma, düşman ordusuyla karşılaşırsa meydan muharebesi başlar. Düşman ordusuna sağ tıklarsan peşine düşer. <b>F</b>: kamerayla ordunu izle.</p>
      <h3>Strateji Haritası</h3>
      <p>Haritada bir ulus seç ve dünyayı fethetmeye başla. Her bölge her tur altın getirir; başkentin ekstra gelir sağlar.</p>
      <p><b>Sol tık</b>: bölge seç &middot; <b>Sürükle</b>: haritayı kaydır &middot; <b>Tekerlek</b>: yakınlaştır</p>
      <p>Kendi bölgeni seçip <b>Asker Topla</b> ile birlik üret; bunlar bölgenin garnizonu olur. Kaydırıcılarla seçtiğin birliklerden ordu kur.</p>
      <p>Barışta olduğun bir ulusun topraklarına girmek için önce savaş ilan etmelisin. Kesikli çizgiler deniz yollarıdır; ordular bunları kullanarak adalara geçebilir.</p>
      <h3>Savaş Alanı (İzometrik)</h3>
      <p>Bir muharebe başladığında <b>Savaşı Yönet</b> seçeneğiyle savaş alanına girersin. Ya da sonucu <b>Otomatik Çöz</b>.</p>
      <p><b>Sol tık / sürükle</b>: birlik seç &middot; <b>Sağ tık</b>: hareket et / saldır &middot; <b>Ctrl+Sağ tık</b> veya <b>A</b>: saldırı hareketi (yolda düşmanla çatışır)</p>
      <p><b>S</b>: dur &middot; <b>Q</b>: tümünü seç &middot; <b>Ctrl+1-9</b>: grup kur &middot; <b>P</b>: duraklat &middot; Ok tuşları / ekran kenarı / orta tuş: kamera</p>
      <h3>Birlikler</h3>
      <p>${LOL.util.TYPES.map((t) => `<b>${LOL.config.unitName[t]}</b> — ${LOL.config.unitDesc[t]}`).join('<br>')}</p>
      <p>Ağır Tank ve Roket Topçusu için önce ilgili teknolojiyi araştırmalısın. Düşman öldüren birlikler tecrübe kazanır (★).</p>
      <h3>Savaş Alanı</h3>
      <p>Sis perdesi: yalnızca birliklerinin gördüğü yerleri görürsün. Hava durumu (yağmur, sis, kar, kum fırtınası) ve mevsim savaş alanını değiştirir. Topçu ve roketler ağaçları devirir, evleri yıkar.</p>
      <h3>Danışman</h3>
      <p>Sol alttaki danışman her ay durumu değerlendirir ve öneriler sunar. Claude API anahtarı eklersen onunla serbestçe sohbet edebilirsin.</p>
      </div>`, [{ label: 'Anladım', value: 1, cls: 'primary' }]);
  };

  // ---------------- boot ----------------
  LOL.strategy.init();
  LOL.strategy.bindUI();
  LOL.advisor.bind();
  LOL.campaign.bind();
  resize();
  LOL.strategy.newMap((Math.random() * 1e9) >>> 0, 'world');
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
