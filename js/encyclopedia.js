'use strict';
(function () {
  // ======================================================================
  //  Encyclopedia: nations (power, relations, armies, generals), units,
  //  your generals and the current scenario.
  // ======================================================================
  const U = LOL.util, UI = LOL.ui, C = LOL.config;
  const E = (LOL.encyclopedia = {});
  const I = () => LOL.strategy._i;
  let tab = 'uluslar', sortKey = 'guc', filter = '', detail = null;

  function relBar(r) {
    return `<span class="relbar"><i style="left:${r >= 0 ? 50 : 50 + r / 2}%;width:${Math.abs(r) / 2}%;background:${r >= 0 ? '#63c46a' : '#e2533f'}"></i></span> <small>${Math.round(r)}</small>`;
  }
  function status(me, o) {
    const i = I();
    if (o === me) return '<span class="tag gold">SEN</span>';
    if (i.atWar(me, o)) return '<span class="tag war">SAVAŞ</span>';
    if (i.allied(me, o)) return '<span class="tag ally">MÜTTEFİK</span>';
    if (i.truce(me, o)) return '<span class="tag peace">ATEŞKES</span>';
    return '<span class="tag">BARIŞ</span>';
  }
  function unitTotals(nid) {
    const i = I(), tot = U.zeroUnits();
    i.provsOf(nid).forEach((p) => U.TYPES.forEach((t) => { tot[t] += p.units[t]; }));
    i.G().armies.filter((a) => a.owner === nid).forEach((a) => U.TYPES.forEach((t) => { tot[t] += a.units[t]; }));
    return tot;
  }
  function threatLabel(ratio) {
    return ratio > 2 ? '<span class="war">Ezici üstün</span>' : ratio > 1.3 ? '<span style="color:#e8a060">Daha güçlü</span>' : ratio > 0.77 ? 'Denk' : ratio > 0.5 ? '<span class="peace">Daha zayıf</span>' : '<span class="peace">Çok zayıf</span>';
  }

  function nationsTab() {
    const i = I(), G = i.G(), me = G.playerId, myPow = Math.max(1, i.nationPower(me));
    let list = G.nations.filter((n) => n.alive);
    const q = filter.toLocaleLowerCase('tr');
    if (q) list = list.filter((n) => n.name.toLocaleLowerCase('tr').includes(q) || (n.en || '').toLowerCase().includes(q));
    const rows = list.map((n) => ({
      n, guc: i.nationPower(n.id), bolge: i.provsOf(n.id).length, ordu: G.armies.filter((a) => a.owner === n.id).length,
      iliski: n.id === me ? 101 : i.rel(me, n.id), tek: n.techs.length,
    }));
    const keyf = { guc: (r) => -r.guc, bolge: (r) => -r.bolge, iliski: (r) => -r.iliski, ad: (r) => r.n.name };
    rows.sort((a, b) => { const ka = keyf[sortKey](a), kb = keyf[sortKey](b); return typeof ka === 'string' ? ka.localeCompare(kb, 'tr') : ka - kb; });
    const th = (k, label) => `<th class="sortable${sortKey === k ? ' on' : ''}" data-sort="${k}">${label}</th>`;
    return `<div class="ency-tools"><input id="ency-q" placeholder="Ülke ara..." value="${U.esc(filter)}"><span class="hint" style="margin:0">${rows.length} ulus · bir satıra tıkla</span></div>
      <div class="ency-scroll"><table class="ency-table"><tr>${th('ad', 'Ulus')}${th('guc', 'Güç')}<th>Sana göre</th>${th('bolge', 'Bölge')}<th>Ordu</th><th>Tekn.</th>${th('iliski', 'İlişki')}<th>Durum</th></tr>
      ${rows.slice(0, 250).map((r) => `<tr class="click" data-nat="${r.n.id}"><td>${UI.flag(r.n, 14)}<b>${U.esc(r.n.name)}</b>${r.n.great ? ' <span title="Büyük güç">👑</span>' : ''}</td>
        <td>${Math.round(r.guc)}</td><td>${r.n.id === me ? '—' : threatLabel(r.guc / myPow)}</td><td>${r.bolge}</td><td>${r.ordu}</td><td>${r.tek}</td>
        <td>${r.n.id === me ? '' : relBar(i.rel(me, r.n.id))}</td><td>${status(me, r.n.id)}</td></tr>`).join('')}</table></div>`;
  }

  function nationDetail(nid) {
    const i = I(), G = i.G(), me = G.playerId, n = i.nation(nid);
    const ec = i.economy(nid), tot = unitTotals(nid);
    const pow = i.nationPower(nid), myPow = Math.max(1, i.nationPower(me));
    const wars = G.nations.filter((o) => o.alive && i.atWar(nid, o.id));
    const allies = i.alliesOf(nid);
    const armies = G.armies.filter((a) => a.owner === nid);
    const gens = i.generalsOf(nid);
    const provs = i.provsOf(nid);
    const pop = provs.reduce((s, p) => s + p.pop, 0);
    const forts = provs.reduce((s, p) => s + p.buildings.fort, 0), facs = provs.reduce((s, p) => s + p.buildings.fac, 0);
    const chip = (o) => `<span class="ency-chip" data-nat="${o.id}">${UI.flag(o, 11)}${U.esc(o.name)}</span>`;
    return `<div class="ency-detail">
      <div class="nat-head"><img class="flagimg" src="${UI.flagURL(n)}"><div><div class="nn">${U.esc(n.name)} ${n.great ? '👑' : ''}</div>
        <div class="hint" style="margin:0">${U.esc(n.gov || '')} · ${U.esc(n.leader || '')}</div><div style="margin-top:4px">${status(me, nid)} ${nid !== me ? relBar(i.rel(me, nid)) : ''}</div></div></div>
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat"><div class="k">Askerî güç</div><div class="v">${Math.round(pow)}</div><div class="k" style="text-transform:none">${nid === me ? '' : threatLabel(pow / myPow)}</div></div>
        <div class="stat"><div class="k">Bölgeler</div><div class="v">${provs.length}</div></div>
        <div class="stat"><div class="k">Nüfus</div><div class="v">${pop >= 1000 ? (pop / 1000).toFixed(1) + 'M' : pop + 'B'}</div></div>
        <div class="stat"><div class="k">Aylık gelir</div><div class="v">${ec.net >= 0 ? '+' : ''}${ec.net}</div></div>
        <div class="stat"><div class="k">Hazine</div><div class="v">${Math.floor(n.gold)}</div></div>
        <div class="stat"><div class="k">İstikrar</div><div class="v">%${Math.round(n.stability)}</div></div>
        <div class="stat"><div class="k">Fabrika / Kale</div><div class="v">${facs} / ${forts}</div></div>
        <div class="stat"><div class="k">Teknoloji</div><div class="v">${n.techs.length}/${i.TECHS.length}</div></div>
      </div>
      <div class="sect-title">Silahlı kuvvetler</div>
      <div class="units-row">${U.TYPES.filter((t) => tot[t]).map((t) => `<div class="ucard" title="${C.unitName[t]}"><img src="${UI.unitIcon(t, n.color)}"><div class="n">${tot[t]}</div><div class="t">${C.unitShort[t]}</div></div>`).join('') || '<div class="hint">Birlik yok</div>'}</div>
      <div class="sect-title">Sahadaki ordular (${armies.length})</div>
      ${armies.length ? `<table>${armies.map((a) => { const g = i.genById(a.gen); const p = i.P(a.prov); return `<tr class="click" data-army="${a.id}"><td><b>${U.esc(a.name)}</b></td><td>${p ? U.esc(p.name) : 'Deniz'}</td><td>Güç ${Math.round(i.powerOf(a.units, nid))}</td><td>${g ? `${'★'.repeat(g.lvl)} ${U.esc(g.name)}` : '<small class="hint">generalsiz</small>'}</td></tr>`; }).join('')}</table>` : '<div class="hint">Sahada ordu yok — birlikler garnizonlarda.</div>'}
      <div class="sect-title">Generaller (${gens.length})</div>
      <div class="ency-gens">${gens.map((g) => `<div class="ency-gen"><img src="${LOL.advisor.portrait(n.color, g.seed)}"><div><b>${i.RANKS[g.lvl - 1]} ${U.esc(g.name)}</b><br><small>${'★'.repeat(g.lvl)} · ${i.TRAITS[g.trait].ad}</small></div></div>`).join('') || '<div class="hint">General yok</div>'}</div>
      <div class="sect-title">Diplomasi</div>
      <div class="row"><span>Savaşta</span><span>${wars.map(chip).join(' ') || '—'}</span></div>
      <div class="row"><span>Müttefikler</span><span>${allies.map(chip).join(' ') || '—'}</span></div>
      <div class="row"><span>Komşular</span><span>${i.neighborNations(nid).slice(0, 12).map((o) => chip(i.nation(o))).join(' ') || '—'}</span></div>
      <div class="sect-title">Teknolojiler</div>
      <div class="hint" style="margin-top:0">${n.techs.map((t) => i.TECH[t].name).join(' · ') || 'Henüz araştırma yok'}</div>
      <div class="btnrow"><button data-focus="${n.capital}">Haritada Göster</button>${nid !== me ? '<button data-open-diplo="1">Diplomasi Ekranı</button>' : ''}<button data-back="1">← Liste</button></div>
    </div>`;
  }

  function generalsTab() {
    const i = I(), G = i.G(), me = G.playerId, n = i.nation(me);
    const gens = i.generalsOf(me).sort((a, b) => b.lvl - a.lvl);
    return `<p class="hint" style="margin-top:0">Generaller ordulara bonus verir ve savaştıkça terfi eder (en fazla ${i.RANKS[4]}). Bir orduyu seçip panelden general atayabilirsin.</p>
      <div class="ency-gens big">${gens.map((g) => { const a = G.armies.find((x) => x.id === g.army); const t = i.TRAITS[g.trait]; const next = g.lvl < 5 ? i.GEN_XP[g.lvl] : null;
        return `<div class="ency-gen"><img src="${LOL.advisor.portrait(n.color, g.seed)}"><div><b>${i.RANKS[g.lvl - 1]} ${U.esc(g.name)}</b><br>
          <span style="color:#ffd860">${'★'.repeat(g.lvl)}${'☆'.repeat(5 - g.lvl)}</span> <small>${next ? Math.floor(g.xp) + '/' + next + ' tecrübe' : 'en üst rütbe'}</small><br>
          <small><b>${t.ad}</b>: ${t.desc}</small><br><small>${a ? 'Komuta: ' + U.esc(a.name) : 'Boşta'}</small></div></div>`; }).join('') || '<div class="hint">Hiç generalin yok.</div>'}</div>
      <div class="sect-title">General özellikleri</div>
      ${Object.values(i.TRAITS).map((t) => `<div class="row"><span><b>${t.ad}</b></span><span class="hint" style="margin:0">${t.desc}</span></div>`).join('')}`;
  }

  function unitsTab() {
    const UT = LOL.battle.UT;
    return `<p class="hint" style="margin-top:0">Savaş alanındaki temel değerler (teknolojiler ve generaller bunları artırır).</p>
      <table class="ency-table"><tr><th>Birlik</th><th>Can</th><th>Hasar</th><th>Menzil</th><th>Hız</th><th>Altın</th><th>İnsan gücü</th><th>Strateji gücü</th></tr>
      ${U.TYPES.map((t) => `<tr><td><img src="${UI.unitIcon(t, '#8a9aa8')}" style="width:42px;height:28px;vertical-align:middle;border-radius:3px;margin-right:6px"><b>${C.unitName[t]}</b><br><small class="hint" style="margin:0">${C.unitDesc[t]}${C.req[t] ? ' · Gerekli: ' + I().TECH[C.req[t]].name : ''}</small></td>
        <td>${UT[t].hp}</td><td>${Math.round(UT[t].dmg * 10) / 10}${UT[t].salvo ? ' ×' + UT[t].salvo : ''}</td><td>${UT[t].range}</td><td>${UT[t].speed}</td><td>${C.cost[t]}</td><td>${C.mp[t]}</td><td>${C.power[t]}</td></tr>`).join('')}</table>`;
  }

  function scenarioTab() {
    const i = I(), G = i.G();
    const sc = G.scenario && LOL.SCENARIOS[G.scenario];
    const dk = i.DIFF[G.diff || 'normal'];
    return `${sc ? `<h3 style="font-family:var(--serif);color:var(--gold2);margin:0 0 6px">${U.esc(sc.ad)}</h3><p class="event-text">${U.esc(sc.desc)}</p>` : '<p>Hayali dünya: rastgele üretilmiş kıtalar ve sekiz ulus.</p>'}
      <div class="row"><span>Zorluk</span><b>${dk.ad}</b></div>
      <div class="row"><span>Savaş ilanından sonra seferberlik</span><b>${dk.mob} gün</b></div>
      <div class="row"><span>Topraklarındaki kuşatma süresi</span><b>×${dk.siege}</b></div>
      <div class="row"><span>Düşmana karşı savaş gücü çarpanı</span><b>×${dk.ai}</b></div>
      <p class="hint">Düşman bir bölgeni kuşatınca ya da sana savaş açılınca oyun kendiliğinden durur (Ayarlar'dan kapatılabilir).</p>
      ${sc ? `<div class="sect-title">Başlangıçtaki savaşlar</div><div class="hint" style="margin-top:0">${sc.wars.map((w) => w.map((x) => (G.nations.find((n) => n.en === x) || { name: x }).name).join(' ⚔ ')).join('<br>') || 'Yok'}</div>
      <div class="sect-title">İttifaklar</div><div class="hint" style="margin-top:0">${sc.alliances.map((w) => w.map((x) => (G.nations.find((n) => n.en === x) || { name: x }).name).join(' 🤝 ')).join('<br>') || 'Yok'}</div>` : ''}`;
  }

  E.open = function (nid) {
    const i = I();
    if (!i.G() || i.G().playerId < 0) return;
    if (nid != null) { tab = 'uluslar'; detail = nid; }
    const tabs = { uluslar: 'Uluslar', generaller: 'Generallerim', birlikler: 'Birlikler', senaryo: 'Senaryo' };
    const render = (wrap) => {
      const body = tab === 'uluslar' ? (detail != null ? nationDetail(detail) : nationsTab()) : tab === 'generaller' ? generalsTab() : tab === 'birlikler' ? unitsTab() : scenarioTab();
      wrap.querySelector('.ency-body').innerHTML = body;
      wrap.querySelectorAll('.ency-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      const q = wrap.querySelector('#ency-q');
      if (q) { q.oninput = () => { filter = q.value; const pos = q.selectionStart; render(wrap); const q2 = wrap.querySelector('#ency-q'); q2.focus(); q2.setSelectionRange(pos, pos); }; }
    };
    UI.modal('', `<div class="ency-head"><span>${UI.icon('book', 22)}</span> Ansiklopedi</div>
      <div class="tabs ency-tabs">${Object.keys(tabs).map((k) => `<button data-tab="${k}">${tabs[k]}</button>`).join('')}</div><div class="ency-body"></div>`,
    [{ label: 'Kapat', value: 0 }], {
      width: 860, closeOnBack: true, cls: 'ency',
      onMount: (wrap, close) => {
        render(wrap);
        wrap.addEventListener('click', (e) => {
          const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; detail = null; LOL.audio.play('select'); render(wrap); return; }
          const so = e.target.closest('[data-sort]'); if (so) { sortKey = so.dataset.sort; render(wrap); return; }
          const nt = e.target.closest('[data-nat]'); if (nt) { detail = +nt.dataset.nat; LOL.audio.play('select'); render(wrap); wrap.querySelector('.modal-inner').scrollTop = 0; return; }
          if (e.target.closest('[data-back]')) { detail = null; render(wrap); return; }
          const fo = e.target.closest('[data-focus]'); if (fo) { close(0); LOL.strategy.focusProvince(+fo.dataset.focus); return; }
          if (e.target.closest('[data-open-diplo]')) { close(0); setTimeout(() => LOL.strategy.openDiplo(), 160); return; }
          const ar = e.target.closest('[data-army]'); if (ar) { const a = i.G().armies.find((x) => x.id === +ar.dataset.army); if (a) { close(0); i.focus(a.x, a.y); } }
        });
      },
    });
  };
})();
