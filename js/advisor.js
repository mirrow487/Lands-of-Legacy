'use strict';
(function () {
  // ======================================================================
  //  Advisor ("Danışman"): rule-based recommendations every turn, plus an
  //  optional AI chat powered by Claude when the player adds an API key.
  // ======================================================================
  const U = LOL.util, UI = LOL.ui, C = LOL.config;
  const A = (LOL.advisor = {});
  const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.4.0';
  const MODEL = 'claude-opus-5-5';
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const GEMINI_FALLBACK = 'gemini-2.5-flash';
  const PROVIDERS = { gemini: 'Google Gemini', claude: 'Anthropic Claude' };
  let open = false, chat = [], busy = false, tips = [];
  let portraitCache = {};

  const ls = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  // migrate the old single Claude key
  if (ls.get('lol_api_key') && !ls.get('lol_key_claude')) { ls.set('lol_key_claude', ls.get('lol_api_key')); ls.set('lol_api_key', ''); if (!ls.get('lol_ai_provider')) ls.set('lol_ai_provider', 'claude'); }
  const provider = () => ls.get('lol_ai_provider') || 'gemini';
  const keyFor = (p) => ls.get('lol_key_' + p);
  const getKey = () => keyFor(provider());
  const geminiModel = () => ls.get('lol_model_gemini') || GEMINI_FALLBACK;

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

  A.portrait = (color, seed) => portrait(color, seed);
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
        <div class="adv-sect">Danışmana Sor ${hasKey ? `<span class="tag ally">${provider() === 'gemini' ? 'Gemini' : 'Claude'}</span>` : ''}</div>
        <div class="adv-chat" id="adv-chat">${chat.map((m, idx) => (m.hidden ? '' : m.role !== 'assistant' ? `<div class="msg user">${U.esc(m.content)}</div>` : `<div class="msg assistant">${fmt(m.reply != null ? m.reply : m.content)}${m.actions && m.actions.length ? `<div class="adv-acts">${m.actions.map((a, k) => `<div class="adv-act${m.results ? (m.results[k].ok ? ' ok' : ' bad') : ''}">${actLabel(a)}${m.results ? `<small>${m.results[k].ok ? '✔' : '✖'} ${U.esc(m.results[k].msg)}</small>` : ''}</div>`).join('')}
          ${m.status === 'pending' ? `<div class="adv-act-btns"><button class="primary" data-run="${idx}">✔ Onayla ve Uygula</button><button data-cancel="${idx}">Vazgeç</button></div>` : m.status === 'cancelled' ? '<small class="hint">İptal edildi.</small>' : ''}</div>` : ''}</div>`)).join('') || `<div class="hint" style="margin:0">${hasKey ? 'Soru sorabilir ya da emir verebilirsin. Örn: "Suriye\'ye savaş ilan et ve başkentteki birliklerle ordu kurup saldır" ya da "Sınır bölgelerine tahkimat kur". Emirleri uygulamadan önce onayını isterim.' : 'Danışmanla serbestçe konuşmak için kendi Gemini ya da Claude API anahtarını bağla. Anahtar olmadan da yukarıdaki raporu her ay hazırlarım.'}</div>`}
        ${busy ? '<div class="msg assistant typing"><span></span><span></span><span></span></div>' : ''}</div>
        ${hasKey ? `<form class="adv-input"><input id="adv-q" placeholder="Soru sor ya da emir ver..."  autocomplete="off" ${busy ? 'disabled' : ''}><button class="primary" ${busy ? 'disabled' : ''}>Sor</button></form>
          <div class="adv-foot"><a href="#" data-adv="key">Yapay zekâ ayarları</a> · <a href="#" data-adv="clear">Sohbeti temizle</a></div>`
          : `<button class="primary" data-adv="key" style="width:100%;margin-top:6px">Yapay Zekâ Bağla (Gemini / Claude)</button>`}
      </div>`;
    const ch = U.el('adv-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
  }
  function fmt(t) {
    return U.esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  async function listGeminiModels(key) {
    const r = await fetch(`${GEMINI_BASE}/models?pageSize=200&key=${encodeURIComponent(key)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { status: r.status, message: (j.error && j.error.message) || r.statusText };
    return (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name }));
  }
  // Text-chat-capable models ranked best-first: newest stable flash, then previews, then lite / pro.
  function rankGemini(ids) {
    const ver = (id) => { const m = id.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
    const ok = ids.filter((id) => !/image|tts|audio|live|embed|vision|robotics|computer|native/.test(id));
    const tier = (id) => (/flash/.test(id) && !/lite/.test(id) ? 0 : /flash-lite|lite/.test(id) ? 1 : /pro/.test(id) ? 2 : 3)
      + (/preview|exp/.test(id) ? 0.5 : 0);
    return ok.sort((a, b) => tier(a) - tier(b) || ver(b) - ver(a) || a.length - b.length);
  }
  function bestGemini(list) {
    const r = rankGemini(list.map((m) => m.id));
    return r[0] || GEMINI_FALLBACK;
  }
  // Models to try in order when the chosen one is overloaded or unavailable
  function geminiCandidates(model) {
    let known = [];
    try { known = JSON.parse(ls.get('lol_models_gemini') || '[]'); } catch (e) { known = []; }
    const ranked = rankGemini(known.slice());
    const out = [model || geminiModel()];
    for (const id of ranked) if (!out.includes(id) && out.length < 4) out.push(id);
    if (!out.includes(GEMINI_FALLBACK) && out.length < 5) out.push(GEMINI_FALLBACK);
    return out;
  }

  // AI settings screen: everyone connects their own key
  A.openSettings = async function () {
    const prov = provider();
    const body = `<p class="hint" style="margin-top:0">Danışmanla serbestçe konuşmak için <b>kendi</b> yapay zekâ API anahtarını bağla. Anahtar sadece bu tarayıcıda saklanır ve doğrudan seçtiğin sağlayıcıya gönderilir; oyun sunucusu yoktur. Paylaşılan bilgisayarlarda kullanma.</p>
      <div class="ai-prov">${Object.keys(PROVIDERS).map((p) => `<label class="ai-card${p === prov ? ' on' : ''}"><input type="radio" name="aiprov" value="${p}" ${p === prov ? 'checked' : ''}><b>${PROVIDERS[p]}</b><small>${p === 'gemini' ? 'Google AI Studio anahtarı (AIza...)' : 'Anthropic Console anahtarı (sk-ant-...)'}</small><span class="ai-st">${keyFor(p) ? '● Bağlı' : '○ Anahtar yok'}</span></label>`).join('')}</div>
      <div class="ai-field" data-for="gemini">
        <label>Gemini API anahtarı</label>
        <input id="ai-key-gemini" type="password" placeholder="AIza..." value="${U.esc(keyFor('gemini'))}" autocomplete="off">
        <label>Model</label>
        <div class="ai-row"><select id="ai-model"><option value="${U.esc(geminiModel())}">${U.esc(geminiModel())}</option></select><button id="ai-load">Modelleri Yükle</button></div>
        <div class="hint">Anahtarı <b>aistudio.google.com</b> adresinden ücretsiz alabilirsin. "Modelleri Yükle" anahtarının erişebildiği modelleri listeler.</div>
      </div>
      <div class="ai-field" data-for="claude">
        <label>Claude API anahtarı</label>
        <input id="ai-key-claude" type="password" placeholder="sk-ant-..." value="${U.esc(keyFor('claude'))}" autocomplete="off">
        <div class="hint">Anahtarı <b>console.anthropic.com</b> adresinden alabilirsin. Model: ${MODEL}. Her soru hesabından küçük bir ücret düşer.</div>
      </div>
      <div class="ai-row" style="margin-top:10px"><button id="ai-test">Bağlantıyı Dene</button><span id="ai-msg" class="hint" style="margin:0"></span></div>`;
    let wrapEl = null;
    const read = () => ({
      prov: wrapEl.querySelector('input[name=aiprov]:checked').value,
      gk: wrapEl.querySelector('#ai-key-gemini').value.trim(),
      ck: wrapEl.querySelector('#ai-key-claude').value.trim(),
      model: wrapEl.querySelector('#ai-model').value,
    });
    const v = await UI.modal('Yapay Zekâ Danışman Ayarları', body, [{ label: 'İptal', value: false }, { label: 'Kaydet', value: true, cls: 'primary' }], {
      width: 600,
      onMount: (wrap) => {
        wrapEl = wrap;
        const sync = () => {
          const p = wrap.querySelector('input[name=aiprov]:checked').value;
          wrap.querySelectorAll('.ai-card').forEach((c) => c.classList.toggle('on', c.querySelector('input').checked));
          wrap.querySelectorAll('.ai-field').forEach((f2) => { f2.style.display = f2.dataset.for === p ? '' : 'none'; });
        };
        wrap.querySelectorAll('input[name=aiprov]').forEach((r) => { r.onchange = sync; });
        sync();
        const msg = wrap.querySelector('#ai-msg');
        wrap.querySelector('#ai-load').onclick = async () => {
          const k = wrap.querySelector('#ai-key-gemini').value.trim();
          if (!k) { msg.textContent = 'Önce anahtarı gir.'; return; }
          msg.textContent = 'Modeller yükleniyor...';
          try {
            const list = await listGeminiModels(k);
            ls.set('lol_models_gemini', JSON.stringify(list.map((m) => m.id)));
            const best = bestGemini(list);
            const sel = wrap.querySelector('#ai-model');
            const cur = sel.value;
            sel.innerHTML = list.map((m) => `<option value="${U.esc(m.id)}">${U.esc(m.id)}${m.id === best ? ' (önerilen)' : ''}</option>`).join('');
            sel.value = list.some((m) => m.id === cur) && cur !== GEMINI_FALLBACK ? cur : best;
            msg.textContent = `${list.length} model bulundu.`;
          } catch (e) { msg.textContent = 'Hata: ' + errText(e); }
        };
        wrap.querySelector('#ai-test').onclick = async () => {
          const r = read();
          msg.textContent = 'Deneniyor...';
          try {
            A.workingModel = null;
            const t = await callModel(r.prov, r.prov === 'gemini' ? r.gk : r.ck, r.model, 'Kısa yanıt ver.', [{ role: 'user', content: 'Sadece "Emrinizdeyim, efendim." de.' }], 200,
              { timeout: 15000, onTry: (m) => { msg.textContent = `Deneniyor: ${m}...`; } });
            const alt = r.prov === 'gemini' && A.lastModel && A.lastModel !== r.model ? ` <span style="color:#e8c050">(${U.esc(r.model)} yoğundu, yedek model <b>${U.esc(A.lastModel)}</b> kullanıldı)</span>` : '';
            msg.innerHTML = '<span style="color:var(--good)">✔ Bağlantı çalışıyor:</span> ' + U.esc(t.slice(0, 80)) + alt;
          } catch (e) { msg.innerHTML = '<span style="color:var(--bad)">✖ ' + U.esc(errText(e)) + '</span>'; }
        };
      },
    });
    if (!v) return;
    const r = read();
    ls.set('lol_ai_provider', r.prov);
    ls.set('lol_key_gemini', r.gk);
    ls.set('lol_key_claude', r.ck);
    if (r.model) ls.set('lol_model_gemini', r.model);
    clientPromise = null;
    UI.toast(getKey() ? `Danışman ${PROVIDERS[r.prov]} ile bağlandı.` : 'Yapay zekâ anahtarı kaldırıldı.', getKey() ? 'good' : '');
    A.refresh();
  };
  function errText(e) {
    if (!e) return 'Bilinmeyen hata';
    if (e.status === 401 || e.status === 403) return 'API anahtarı geçersiz ya da yetkisiz.';
    if (e.status === 429) return 'Kota/oran sınırı aşıldı, biraz bekle.';
    if (e.status === 404) return 'Model bulunamadı — "Modelleri Yükle" ile başka model seç.';
    if (e.status === 503 || e.status === 500 || e.status === 502 || e.status === 504) return 'Gemini sunucuları şu an çok yoğun (Google tarafında geçici bir durum). Yedek modeller de denendi; biraz sonra tekrar dene ya da listeden başka bir model seç.';
    return e.message || String(e);
  }

  // ---------------- model calls ----------------
  let clientPromise = null;
  function claudeClient(key) {
    if (!clientPromise) {
      const load = window.AnthropicSDK ? Promise.resolve({ default: window.AnthropicSDK }) : import(SDK_URL);
      clientPromise = load.then((mod) => {
        const Anthropic = mod.default || mod.Anthropic;
        return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
      });
    }
    return clientPromise;
  }
  async function callModel(prov, key, model, system, messages, maxTokens, opts) {
    opts = opts || {};
    if (!key) throw { message: 'Anahtar girilmedi.' };
    if (prov === 'gemini') {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: Math.max(1024, maxTokens || 4096), temperature: 0.8 },
      });
      if (!ls.get('lol_models_gemini')) {
        try { const list = await listGeminiModels(key); ls.set('lol_models_gemini', JSON.stringify(list.map((x) => x.id))); } catch (e) { /* use what we have */ }
      }
      const transient = (st) => st === 429 || st === 500 || st === 502 || st === 503 || st === 504;
      let lastErr = null;
      const cands = geminiCandidates(model);
      if (A.workingModel && cands.includes(A.workingModel)) { cands.splice(cands.indexOf(A.workingModel), 1); cands.unshift(A.workingModel); }
      for (const m of cands) {
        for (let attempt = 0; attempt < 1; attempt++) {
          let r, j;
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), opts.timeout || 30000);
          if (opts.onTry) opts.onTry(m);
          try {
            r = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctl.signal,
            });
            j = await r.json().catch(() => ({}));
          } catch (e) {
            clearTimeout(timer);
            lastErr = e.name === 'AbortError' ? { status: 503, message: m + ' zaman aşımı' } : { message: 'Ağ hatası: ' + (e.message || e) };
            break;
          }
          clearTimeout(timer);
          if (r.ok) {
            A.lastModel = m; A.workingModel = m;
            if (j.promptFeedback && j.promptFeedback.blockReason) return 'Bu konuda size yardımcı olamam, efendim.';
            const c = j.candidates && j.candidates[0];
            const text = c && c.content && c.content.parts ? c.content.parts.map((p) => p.text || '').join('').trim() : '';
            return text || 'Telsizde parazit var, efendim. Soruyu tekrar eder misiniz?';
          }
          lastErr = { status: r.status, message: (j.error && j.error.message) || r.statusText };
          if (r.status === 401 || r.status === 403 || r.status === 400) throw lastErr; // key / request problem: no point retrying
          if (r.status === 404) break; // model gone: try the next one
          if (!transient(r.status)) throw lastErr;
          if (A.workingModel === m) A.workingModel = null;
          break; // overloaded / quota: move straight to the next model
        }
      }
      throw lastErr || { message: 'Bilinmeyen hata' };
    }
    const anthropic = await claudeClient(key);
    const resp = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens || 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system,
      messages,
    });
    if (resp.stop_reason === 'refusal') return 'Bu konuda size yardımcı olamam, efendim.';
    return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || '...';
  }

  const ACTIONS_DOC = `Yanıtını YALNIZCA tek bir JSON nesnesi olarak ver (başka metin, markdown ya da kod bloğu yok):
{"cevap": "oyuncuya söyleyeceğin kısa Türkçe metin", "eylemler": [ ... ]}
"eylemler" listesine sadece oyuncu senden bir şey YAPMANI istediğinde eylem koy. Oyuncu sadece soru soruyor ya da fikir istiyorsa liste boş kalsın ([]) ve önerini "cevap" içinde anlat.
Oyuncu "sen karar ver", "gerekeni yap" gibi şeyler derse en mantıklı eylemleri sen seç. Eylemleri oyuncu onayladıktan sonra oyun uygular; kurallara uymayan eylemler reddedilir.
İzinli eylemler (adları oyun durumundaki adlarla BİREBİR yaz):
{"type":"declare_war","nation":"Ülke"}
{"type":"propose_peace","nation":"Ülke"}
{"type":"send_gift","nation":"Ülke"}            (25 altın, ilişki +15)
{"type":"propose_alliance","nation":"Ülke"}     (ilişki en az 40 olmalı)
{"type":"recruit","province":"Bizim bölge","unit":"inf|mg|at|recon|tank|heavy|art|rocket","count":3}
{"type":"build","province":"Bizim bölge","building":"fac|fort|bar"}
{"type":"research","tech":"teknoloji id"}
{"type":"form_army","province":"Bizim bölge","units":"all" ya da {"inf":4,"tank":2}}
{"type":"move_army","army":"Ordu adı ya da az önce kurulan için \"yeni\"","province":"Hedef bölge"}   (düşman bölgesiyse kuşatır)
{"type":"attack_army","army":"Ordu adı ya da \"yeni\"","target":"Düşman ordusu adı ya da ülke adı"}
{"type":"merge_army","army":"Ordu adı"}
Kaynakları (altın, insan gücü) aşma; maliyetler durumda var. Barışta olduğun ülkeye ordu göndermek için önce declare_war gerekir.`;

  function parseReply(text) {
    let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const i0 = t.indexOf('{'), i1 = t.lastIndexOf('}');
    if (i0 >= 0 && i1 > i0) {
      try {
        const j = JSON.parse(t.slice(i0, i1 + 1));
        const acts = Array.isArray(j.eylemler) ? j.eylemler : Array.isArray(j.actions) ? j.actions : [];
        return { reply: String(j.cevap || j.reply || '').trim() || (acts.length ? 'Emirlerinizi hazırladım, efendim.' : '...'), actions: acts.filter((x) => x && typeof x.type === 'string').slice(0, 12) };
      } catch (e) { /* fall through */ }
    }
    return { reply: t, actions: [] };
  }
  const ACT_LABEL = {
    declare_war: (a) => `⚔ <b>${U.esc(a.nation)}</b> ulusuna savaş ilan et`,
    propose_peace: (a) => `🕊 <b>${U.esc(a.nation)}</b> ile barış teklif et`,
    send_gift: (a) => `💰 <b>${U.esc(a.nation)}</b> ulusuna hediye gönder`,
    propose_alliance: (a) => `🤝 <b>${U.esc(a.nation)}</b> ile ittifak teklif et`,
    recruit: (a) => `🪖 <b>${U.esc(a.province)}</b>: ${a.count || 1} × ${U.esc(C.unitName[a.unit] || a.unit)} topla`,
    build: (a) => `🏗 <b>${U.esc(a.province)}</b>: ${U.esc({ fac: 'Fabrika', fort: 'Tahkimat', bar: 'Kışla' }[a.building] || a.building)} kur`,
    research: (a) => `🔬 Araştırma: <b>${U.esc(a.tech)}</b>`,
    form_army: (a) => `⚑ <b>${U.esc(a.province)}</b> garnizonundan ordu kur (${a.units === 'all' || !a.units ? 'tüm birlikler' : U.esc(Object.entries(a.units).map(([k, v]) => `${v} ${C.unitShort[k] || k}`).join(', '))})`,
    move_army: (a) => `➜ <b>${U.esc(a.army || 'yeni ordu')}</b> → ${U.esc(a.province)}`,
    attack_army: (a) => `🎯 <b>${U.esc(a.army || 'yeni ordu')}</b>, ${U.esc(a.target)} ordusuna saldırsın`,
    merge_army: (a) => `⤓ <b>${U.esc(a.army)}</b> garnizona katılsın`,
  };
  const actLabel = (a) => (ACT_LABEL[a.type] ? ACT_LABEL[a.type](a) : U.esc(a.type));

  async function ask(q) {
    const st = LOL.strategy.analysis();
    if (!st) return;
    chat.push({ role: 'user', content: q });
    busy = true; render(st);
    try {
      const system = `Sen "Lands of Legacy" adlı büyük strateji oyununda ${st.nationName} ulusunun baş danışmanı ${st.advisorName}'sın. Tarih: ${st.date}.
Oyuncuya "efendim" diye hitap eden, sadık, zeki ve biraz dramatik bir 1930'lar devlet adamı gibi konuş. Her zaman Türkçe yaz.
"cevap" kısa olsun (en fazla 4-6 cümle). Sadece verilen oyun durumuna dayan; somut bölge, ordu ve ülke adları ver.
Oyun kuralları: zaman sürekli akar (ay sonunda ekonomi işlenir). Bölgelerde garnizon tutulur; garnizondan "ordu" kurulur ve ordular haritada yürür, düşman bölgesine varınca kuşatma, düşman ordusuyla karşılaşınca meydan muharebesi olur.
Birlikler (kod: ad): inf Piyade, mg Makineli Tüfek, at Tanksavar, recon Zırhlı Keşif, tank Tank, heavy Ağır Tank (tank2 gerekir), art Topçu, rocket Roket Topçusu (art2 gerekir). Binalar: fac Fabrika (+gelir, +araştırma), fort Tahkimat (savunma), bar Kışla (+insan gücü). Savaş ilanı istikrarı düşürür.

${ACTIONS_DOC}`;
      const state = JSON.stringify(st.forLLM);
      const messages = chat.filter((m) => !m.local).slice(-10).map((m, i, arr) => ({
        role: m.role,
        content: i === arr.length - 1 && m.role === 'user' ? `Güncel oyun durumu (JSON):\n${state}\n\nOyuncu: ${m.content}` : m.content,
      }));
      // merge consecutive same-role turns and make sure the conversation starts with the player
      const merged = [];
      for (const m of messages) {
        if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1].content += '\n\n' + m.content;
        else merged.push({ role: m.role, content: m.content });
      }
      while (merged.length && merged[0].role !== 'user') merged.shift();
      const raw = await callModel(provider(), getKey(), geminiModel(), system, merged, 4000);
      const pr = parseReply(raw);
      chat.push({ role: 'assistant', content: pr.reply + (pr.actions.length ? `\n[Önerilen eylemler: ${JSON.stringify(pr.actions)}]` : ''), reply: pr.reply, actions: pr.actions, status: pr.actions.length ? 'pending' : null });
      LOL.audio.play('radio');
    } catch (e) {
      chat.push({ role: 'assistant', local: true, content: 'Telsiz bağlantısı koptu, efendim. (' + errText(e) + ')' });
      if (e && (e.status === 401 || e.status === 403)) clientPromise = null;
    }
    busy = false;
    render(LOL.strategy.analysis());
  }

  function execute(idx) {
    const m = chat[idx];
    if (!m || m.status !== 'pending') return;
    LOL.campaign.lastFormed = null;
    const results = m.actions.map((a) => {
      try { return LOL.strategy.cmd.run(a); } catch (e) { return { ok: false, msg: 'Hata: ' + (e.message || e) }; }
    });
    m.status = 'done';
    m.results = results;
    LOL.strategy.cmd.after();
    const okN = results.filter((r) => r.ok).length;
    LOL.audio.play(okN ? 'ack' : 'click');
    chat.push({ role: 'user', local: false, content: `[Oyun: eylemler uygulandı — ${results.map((r) => (r.ok ? '✔ ' : '✖ ') + r.msg).join(' | ')}]`, hidden: true });
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
        else if (k === 'key') A.openSettings();
        else if (k === 'clear') { chat = []; A.refresh(); }
        return;
      }
      const run = e.target.closest('[data-run]');
      if (run) { execute(+run.dataset.run); return; }
      const cancel = e.target.closest('[data-cancel]');
      if (cancel) { const m = chat[+cancel.dataset.cancel]; if (m) { m.status = 'cancelled'; chat.push({ role: 'user', content: '[Oyuncu önerilen eylemleri iptal etti]', hidden: true }); } A.refresh(); return; }
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
      if (q && !busy) ask(q);
    });
  };
  A.reset = () => { chat = []; open = false; };
})();
