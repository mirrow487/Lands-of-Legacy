'use strict';
(function () {
  // ======================================================================
  //  Advisor ("Danışman"): rule-based recommendations every turn, plus an
  //  optional AI chat powered by Claude when the player adds an API key.
  // ======================================================================
  const U = LOL.util, UI = LOL.ui;
  const A = (LOL.advisor = {});
  const KEY_STORE = 'lol_api_key';
  const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.4.0';
  const MODEL = 'claude-opus-5-5';
  let open = false, chat = [], busy = false, tips = [];
  let portraitCache = {};

  const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } };
  const setKey = (k) => { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ } };

  function portrait(color, seed) {
    const k = color + seed;
    if (portraitCache[k]) return portraitCache[k];
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(48, 40, 10, 48, 48, 60);
    bg.addColorStop(0, '#3a4a5e'); bg.addColorStop(1, '#0d131c');
    g.fillStyle = bg; g.fillRect(0, 0, 96, 96);
    const rng = U.rng(seed);
    // shoulders / uniform
    g.fillStyle = U.shade(color, -0.45);
    g.beginPath(); g.moveTo(8, 96); g.quadraticCurveTo(14, 66, 48, 62); g.quadraticCurveTo(82, 66, 88, 96); g.closePath(); g.fill();
    g.fillStyle = '#d6b25e'; g.fillRect(16, 72, 14, 4); g.fillRect(66, 72, 14, 4);
    g.fillStyle = U.shade(color, -0.25); g.beginPath(); g.moveTo(40, 64); g.lineTo(48, 82); g.lineTo(56, 64); g.closePath(); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = ['#c0392b', '#d6b25e', '#2e86c1'][i]; g.fillRect(30 + i * 5, 80, 4, 6); }
    // neck & face
    const skin = rng.pick(['#e2b892', '#d4a276', '#c08a5a', '#f0c8a0']);
    g.fillStyle = skin; g.fillRect(42, 52, 12, 12);
    g.beginPath(); g.ellipse(48, 42, 14, 17, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(53, 44, 8, 14, 0, 0, 7); g.fill();
    // moustache, eyes
    g.fillStyle = rng.pick(['#3a2a1a', '#6a6a6a', '#1a1a1a', '#8a6a4a']);
    if (rng.chance(0.7)) { g.beginPath(); g.ellipse(48, 50, 7, 2.2, 0, 0, 7); g.fill(); }
    g.fillStyle = '#1a1a1a'; g.fillRect(41, 39, 4, 2); g.fillRect(51, 39, 4, 2);
    // cap
    g.fillStyle = U.shade(color, -0.35);
    g.beginPath(); g.ellipse(48, 27, 19, 8, 0, Math.PI, 0); g.fill();
    g.fillRect(29, 26, 38, 6);
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(48, 32, 17, 3.5, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#d6b25e'; g.beginPath(); g.arc(48, 25, 3, 0, 7); g.fill();
    const url = c.toDataURL();
    portraitCache[k] = url;
    return url;
  }

  // ---------------- rule-based tips ----------------
  A.refresh = function () {
    const st = LOL.strategy.analysis && LOL.strategy.analysis();
    const root = U.el('advisor');
    if (!st) { root.classList.add('hidden'); return; }
    root.classList.remove('hidden');
    tips = buildTips(st);
    render(st);
  };

  function buildTips(st) {
    const t = [];
    if (!st.research) t.push({ pr: 10, ico: 'sci', col: '#2f6a8a', text: 'Bilim insanlarımız boş oturuyor. Hemen bir <b>araştırma</b> seçelim.', act: 'tech' });
    if (st.ec.net < 0) t.push({ pr: 9, ico: 'gold', col: '#8a3a1a', text: `Hazine her ay <b>${-st.ec.net} altın</b> eriyor. Ordu bakımı gelirimizi aşıyor; fabrika kurmalı ya da yeni topraklar almalıyız.` });
    st.threats.slice(0, 2).forEach((th) => t.push({ pr: 8, ico: 'alert', col: '#a83226', text: `<b>${U.esc(th.name)}</b> tehlikede! Sınırda ${U.esc(th.enemy)} ordusu toplanıyor (güç ${th.enemyPower} - bizim ${th.myPower}). Takviye gönderelim ya da tahkimat kuralım.`, act: 'focus', id: th.id }));
    st.opportunities.slice(0, 2).forEach((op) => t.push({ pr: 7, ico: 'sword', col: '#3c7a3a', text: `<b>${U.esc(op.toName)}</b> zayıf savunuluyor (${op.def} güce karşı bizim ${op.att}). <b>${U.esc(op.fromName)}</b> üzerinden saldırabiliriz.`, act: 'focus', id: op.from }));
    if (st.stability < 35) t.push({ pr: 8, ico: 'stab', col: '#9a5a1a', text: `İstikrar <b>%${Math.round(st.stability)}</b>. Halk huzursuz; savaşları azaltmalı ya da propaganda teknolojisine yatırım yapmalıyız.` });
    if (st.stronger.length) t.push({ pr: 6, ico: 'dove', col: '#3c6a8a', text: `${st.stronger.map(U.esc).join(', ')} bizden çok daha güçlü. Barış ya da müttefik aramak akıllıca olabilir.`, act: 'diplo' });
    if (st.gold > 90) t.push({ pr: 5, ico: 'factory', col: '#5a4a2a', text: `Hazinede <b>${Math.floor(st.gold)} altın</b> birikti. Fabrika kurmak uzun vadede geliri ve araştırmayı artırır.`, act: 'focus', id: st.capital });
    if (st.manpower < 2500) t.push({ pr: 5, ico: 'man', col: '#2a5a8a', text: 'İnsan gücü tükeniyor. Kışla inşa etmek ve kayıpları azaltmak gerekiyor.' });
    if (!st.wars.length && st.weakNeighbor && st.turn > 2) t.push({ pr: 4, ico: 'flag', col: '#6a4a2a', text: `Komşumuz <b>${U.esc(st.weakNeighbor)}</b> zayıf görünüyor. Genişlemek istersek iyi bir hedef olabilir.`, act: 'diplo' });
    if (!t.length) t.push({ pr: 1, ico: 'crown', col: '#a8741a', text: 'Durum kontrol altında, efendim. Orduyu güçlendirip fırsat kollayalım.' });
    return t.sort((a, b) => b.pr - a.pr).slice(0, 5);
  }

  function render(st) {
    const root = U.el('advisor');
    const name = st.advisorName;
    const img = portrait(st.color, st.seed);
    const urgent = tips.filter((x) => x.pr >= 8).length;
    if (!open) {
      root.className = 'advisor collapsed';
      root.innerHTML = `<img class="adv-face" src="${img}" alt=""><div class="adv-mini"><div class="adv-name">${U.esc(name)}</div><div class="adv-role">Baş Danışman</div></div>
        <span class="adv-badge${urgent ? ' urgent' : ''}">${tips.length}</span>`;
      return;
    }
    const hasKey = !!getKey();
    root.className = 'advisor';
    root.innerHTML = `<div class="adv-head"><img class="adv-face" src="${img}" alt=""><div><div class="adv-name">${U.esc(name)}</div><div class="adv-role">Baş Danışman · ${U.esc(st.nationName)}</div></div><button class="adv-x" data-adv="close">–</button></div>
      <div class="adv-body">
        <div class="adv-sect">Raporum</div>
        ${tips.map((x, i) => `<div class="adv-tip${x.act ? ' click' : ''}" data-tip="${i}"><span class="adv-ico" style="background:${x.col}">${UI.icon(x.ico, 14)}</span><div>${x.text}</div></div>`).join('')}
        <div class="adv-sect">Danışmana Sor ${hasKey ? '<span class="tag ally">Yapay Zekâ</span>' : ''}</div>
        <div class="adv-chat" id="adv-chat">${chat.map((m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? fmt(m.content) : U.esc(m.content)}</div>`).join('') || `<div class="hint" style="margin:0">${hasKey ? 'Strateji, diplomasi ya da savaş hakkında her şeyi sorabilirsin.' : 'Danışmanla serbestçe konuşmak için bir Claude API anahtarı ekle. Anahtar olmadan da yukarıdaki raporu her ay hazırlarım.'}</div>`}
        ${busy ? '<div class="msg assistant typing"><span></span><span></span><span></span></div>' : ''}</div>
        ${hasKey ? `<form class="adv-input"><input id="adv-q" placeholder="Örn: Kime saldırmalıyım?" autocomplete="off" ${busy ? 'disabled' : ''}><button class="primary" ${busy ? 'disabled' : ''}>Sor</button></form>
          <div class="adv-foot"><a href="#" data-adv="key">API anahtarını değiştir</a> · <a href="#" data-adv="clear">Sohbeti temizle</a></div>`
          : `<button class="primary" data-adv="key" style="width:100%;margin-top:6px">Yapay Zekâ Danışmanı Etkinleştir</button>`}
      </div>`;
    const ch = U.el('adv-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
  }
  function fmt(t) {
    return U.esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  async function keyDialog() {
    const cur = getKey();
    const v = await UI.modal('Yapay Zekâ Danışman', `<p>Danışman, Claude yapay zekâsı ile çalışır ve oyunun anlık durumunu görerek sorularını yanıtlar.</p>
      <p class="hint">Anthropic Console'dan aldığın API anahtarını gir. Anahtar <b>sadece bu tarayıcıda</b> saklanır ve doğrudan Anthropic'e gönderilir. Her soru API hesabından küçük bir ücret düşer. Paylaşılan bir bilgisayarda kullanma.</p>
      <input id="adv-key" type="password" placeholder="sk-ant-..." value="${U.esc(cur)}" style="width:100%;padding:9px;border-radius:6px;border:1px solid var(--line);background:#0a0f18;color:var(--text);font:inherit">`,
    [{ label: 'İptal', value: null }, ...(cur ? [{ label: 'Anahtarı Sil', value: '', cls: 'danger' }] : []), { label: 'Kaydet', value: 'save', cls: 'primary' }], {
      width: 520,
      onMount: (wrap) => { const inp = wrap.querySelector('#adv-key'); A._keyInput = inp; setTimeout(() => inp.focus(), 50); },
    });
    if (v === null) return;
    if (v === '') setKey('');
    else setKey((A._keyInput.value || '').trim());
    A.refresh();
  }

  // ---------------- Claude chat ----------------
  let clientPromise = null;
  function client() {
    if (!clientPromise) {
      const load = window.AnthropicSDK ? Promise.resolve({ default: window.AnthropicSDK }) : import(SDK_URL);
      clientPromise = load.then((mod) => {
        const Anthropic = mod.default || mod.Anthropic;
        return new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true });
      });
    }
    return clientPromise;
  }

  async function ask(q) {
    const st = LOL.strategy.analysis();
    if (!st) return;
    chat.push({ role: 'user', content: q });
    busy = true; render(st);
    try {
      const anthropic = await client();
      const system = `Sen "Lands of Legacy" adlı büyük strateji oyununda ${st.nationName} ulusunun baş danışmanı ${st.advisorName}'sın. Yıl ${st.date}.
Oyuncuya "efendim" diye hitap eden, sadık, zeki ve biraz dramatik bir 1930'lar devlet adamı gibi konuş. Her zaman Türkçe yanıt ver.
Yanıtların kısa olsun (en fazla 4-6 cümle ya da kısa bir madde listesi). Sadece verilen oyun durumuna dayan; somut bölge ve ülke adları ver.
Oyun kuralları: her tur bir ay. Birlikler: Piyade, Makineli Tüfek, Tanksavar, Zırhlı Keşif, Tank, Ağır Tank, Topçu, Roket Topçusu. Binalar: Fabrika (+gelir, +araştırma), Tahkimat (savunma), Kışla (+insan gücü). Savaşlar istikrarı düşürür. Komşu bölgelere ordu gönderilerek saldırılır.`;
      const state = JSON.stringify(st.forLLM);
      const messages = chat.slice(-10).map((m, i, arr) => ({
        role: m.role,
        content: i === arr.length - 1 && m.role === 'user' ? `Güncel oyun durumu (JSON):\n${state}\n\nSoru: ${m.content}` : m.content,
      }));
      const resp = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system,
        messages,
      });
      let text;
      if (resp.stop_reason === 'refusal') text = 'Bu konuda size yardımcı olamam, efendim.';
      else text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || '...';
      chat.push({ role: 'assistant', content: text });
      LOL.audio.play('radio');
    } catch (e) {
      const msg = e && (e.status === 401 ? 'API anahtarı geçersiz görünüyor. Lütfen kontrol edin.' : e.status === 429 ? 'Çok fazla istek, biraz bekleyin.' : (e.message || String(e)));
      chat.push({ role: 'assistant', content: 'Telsiz bağlantısı koptu, efendim. (' + msg + ')' });
      if (e && e.status === 401) clientPromise = null;
    }
    busy = false;
    render(LOL.strategy.analysis());
  }

  A.bind = function () {
    const root = U.el('advisor');
    root.addEventListener('mousedown', (e) => e.stopPropagation());
    root.addEventListener('click', (e) => {
      if (root.classList.contains('collapsed')) { open = true; LOL.audio.play('select'); A.refresh(); return; }
      const a = e.target.closest('[data-adv]');
      if (a) {
        e.preventDefault();
        const k = a.dataset.adv;
        if (k === 'close') { open = false; A.refresh(); }
        else if (k === 'key') { keyDialog(); clientPromise = null; }
        else if (k === 'clear') { chat = []; A.refresh(); }
        return;
      }
      const tip = e.target.closest('[data-tip]');
      if (tip) {
        const t = tips[+tip.dataset.tip];
        if (!t || !t.act) return;
        LOL.audio.play('click');
        if (t.act === 'focus') LOL.strategy.focusProvince(t.id);
        else if (t.act === 'tech') LOL.strategy.openTech();
        else if (t.act === 'diplo') LOL.strategy.openDiplo();
      }
    });
    root.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = U.el('adv-q');
      const q = inp && inp.value.trim();
      if (q && !busy) { clientPromise = clientPromise || null; ask(q); }
    });
  };
  A.reset = () => { chat = []; open = false; };
})();
