'use strict';
// Historical scenarios for the real-world map. Countries are referenced by
// their Natural Earth English names (the borders are modern, so the setups
// approximate the period rather than reproduce it exactly).
(function () {
  // Great-power strength in each period: army = starting garrison multiplier,
  // gold = starting treasury multiplier, techs = researched at start.
  const GP_1936 = {
    'Germany': { army: 2.3, gold: 2, techs: ['inf1', 'tank1'], stab: 80 },
    'Russia': { army: 1.6, gold: 1.8, techs: ['art1'], stab: 70 },
    'United Kingdom': { army: 1.8, gold: 2.5, techs: ['eco1'], stab: 80 },
    'France': { army: 1.9, gold: 2, techs: ['def1'], stab: 65 },
    'Italy': { army: 1.6, gold: 1.4, techs: ['inf1'], stab: 70 },
    'Japan': { army: 1.9, gold: 1.6, techs: ['inf1', 'eco1'], stab: 80 },
    'United States of America': { army: 1.3, gold: 3, techs: ['eco1', 'eco2'], stab: 85 },
    'China': { army: 1.0, gold: 0.8, techs: [], stab: 40 },
    'Turkey': { army: 1.4, gold: 1.2, techs: ['def1'], stab: 75 },
    'Poland': { army: 1.4, gold: 1, techs: [], stab: 65 },
  };
  const merge = (base, extra) => {
    const out = JSON.parse(JSON.stringify(base));
    for (const k in extra) out[k] = Object.assign(out[k] || { army: 1, gold: 1, techs: [] }, extra[k]);
    return out;
  };

  LOL.SCENARIOS = {
    '1936': {
      ad: '1936 — Fırtına Öncesi',
      desc: 'Dünya henüz barış içinde ama büyük güçler silahlanıyor. Kendi yolunu çiz.',
      yil: 1936, ay: 1, gp: GP_1936, wars: [], alliances: [], truces: [],
    },
    '1939': {
      ad: '1939 — Avrupa\'da Savaş',
      desc: 'Eylül 1939: Almanya Polonya\'ya saldırdı, Britanya ve Fransa savaş ilan etti. Japonya Çin\'de ilerliyor; Sovyetler Almanya ile saldırmazlık paktı imzaladı.',
      yil: 1939, ay: 9,
      gp: merge(GP_1936, {
        'Germany': { army: 3.0, gold: 2.5, techs: ['inf1', 'tank1', 'tank2', 'art1'], stab: 85 },
        'Russia': { army: 2.0, techs: ['art1', 'inf1'] },
        'United Kingdom': { army: 2.0, techs: ['eco1', 'def1'] },
        'France': { army: 2.1, techs: ['def1', 'def2', 'art1'] },
        'Japan': { army: 2.2, techs: ['inf1', 'inf2', 'eco1'] },
        'Italy': { army: 1.7, techs: ['inf1', 'art1'] },
        'Poland': { army: 1.6, gold: 1, techs: ['inf1'] },
      }),
      wars: [['Germany', 'Poland'], ['Germany', 'United Kingdom'], ['Germany', 'France'], ['Japan', 'China']],
      alliances: [['United Kingdom', 'France'], ['United Kingdom', 'Poland'], ['France', 'Poland'], ['Germany', 'Italy'], ['Germany', 'Japan'], ['Italy', 'Japan']],
      truces: [['Germany', 'Russia', 20]],
    },
    '1941': {
      ad: '1941 — Doğu Cephesi',
      desc: 'Haziran 1941: Mihver orduları Sovyetler Birliği\'ne saldırdı. Britanya tek başına direniyor, Pasifik\'te gerilim tırmanıyor.',
      yil: 1941, ay: 6,
      gp: merge(GP_1936, {
        'Germany': { army: 3.4, gold: 3, techs: ['inf1', 'inf2', 'tank1', 'tank2', 'art1', 'art2', 'eco1'], stab: 85 },
        'Russia': { army: 2.6, gold: 2, techs: ['art1', 'inf1', 'tank1'] },
        'United Kingdom': { army: 2.2, techs: ['eco1', 'def1', 'tank1'] },
        'Japan': { army: 2.4, techs: ['inf1', 'inf2', 'eco1', 'eco2'] },
        'Italy': { army: 1.7, techs: ['inf1', 'art1'] },
        'Romania': { army: 1.3 }, 'Hungary': { army: 1.2 }, 'Finland': { army: 1.4, techs: ['def1'] },
        'United States of America': { army: 1.6, gold: 3.5, techs: ['eco1', 'eco2', 'eco3'] },
      }),
      wars: [['Germany', 'Russia'], ['Italy', 'Russia'], ['Romania', 'Russia'], ['Finland', 'Russia'], ['Hungary', 'Russia'],
        ['Germany', 'United Kingdom'], ['Italy', 'United Kingdom'], ['Japan', 'China']],
      alliances: [['Germany', 'Italy'], ['Germany', 'Japan'], ['Italy', 'Japan'], ['Germany', 'Romania'], ['Germany', 'Hungary'], ['Germany', 'Finland'], ['United Kingdom', 'Russia']],
      truces: [['Japan', 'Russia', 24]],
    },
  };
  LOL.SCENARIO_ORDER = ['1936', '1939', '1941'];
})();
