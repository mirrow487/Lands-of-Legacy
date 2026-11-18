'use strict';
(function () {
  // ======================================================================
  //  Procedural audio engine: layered weapon sounds with distance filtering,
  //  stereo panning and convolution reverb, generative music, ambience and
  //  radio voice acknowledgements. No audio files needed.
  // ======================================================================
  const A = (LOL.audio = {
    enabled: true, voice: true,
    vol: { master: 0.85, music: 0.45, sfx: 0.9 },
    ctx: null, last: {},
  });
  let C = null, master, sfxBus, musicBus, revIn, noiseBuf, comp;

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('lol_audio') || 'null');
      if (s) { Object.assign(A.vol, s.vol || {}); A.voice = s.voice !== false; A.enabled = s.enabled !== false; }
    } catch (e) { /* ignore */ }
  }
  A.saveSettings = function () {
    try { localStorage.setItem('lol_audio', JSON.stringify({ vol: A.vol, voice: A.voice, enabled: A.enabled })); } catch (e) { /* ignore */ }
  };
  loadSettings();

  function makeIR(seconds, decay) {
    const len = Math.floor(C.sampleRate * seconds);
    const buf = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections + diffuse tail
        const er = i < C.sampleRate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay)) * 0.6 + er;
      }
    }
    return buf;
  }

  A.init = function () {
    if (C) { if (C.state === 'suspended') C.resume(); return; }
    try {
      C = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    comp = C.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = C.createGain(); master.connect(comp); comp.connect(C.destination);
    sfxBus = C.createGain(); sfxBus.connect(master);
    musicBus = C.createGain(); musicBus.connect(master);
    const conv = C.createConvolver(); conv.buffer = makeIR(2.8, 3.2);
    revIn = C.createGain(); revIn.gain.value = 1;
    const revOut = C.createGain(); revOut.gain.value = 0.55;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    const len = C.sampleRate * 3;
    noiseBuf = C.createBuffer(1, len, C.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolumes();
    loadVoices();
    if (A.pendingMusic) A.music(A.pendingMusic);
  };

  A.applyVolumes = function () {
    if (!C) return;
    master.gain.value = A.enabled ? A.vol.master : 0;
    sfxBus.gain.value = A.vol.sfx;
    musicBus.gain.value = A.vol.music * 0.6;
  };

  // ---------------- building blocks ----------------
  function noise(out, t, dur, type, freq, q, vol, attack, sweepTo) {
    const s = C.createBufferSource(); s.buffer = noiseBuf;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (q) f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
    return g;
  }
  function osc(out, t, dur, type, f0, f1, vol, attack) {
    const o = C.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  const shaperCache = {};
  function shaper(amount) {
    if (shaperCache[amount]) return shaperCache[amount];
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    shaperCache[amount] = curve;
    return curve;
  }
  // positional output chain: distance low-pass, pan, gain, reverb send
  function chain(vol, pan, wetBase, dist) {
    const near = vol;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 500 + 17000 * near * near;
    const ws = C.createWaveShaper(); ws.curve = shaper(dist || 1.5);
    const p = C.createStereoPanner ? C.createStereoPanner() : null;
    const g = C.createGain(); g.gain.value = Math.max(0.05, vol);
    ws.connect(lp);
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan || 0)); lp.connect(p); p.connect(g); } else lp.connect(g);
    g.connect(sfxBus);
    const send = C.createGain(); send.gain.value = (wetBase || 0.25) + (1 - near) * 0.6;
    g.connect(send); send.connect(revIn);
    setTimeout(() => { try { g.disconnect(); send.disconnect(); } catch (e) { /* ignore */ } }, 4000);
    return ws;
  }
  function uiOut(wet) {
    const g = C.createGain(); g.gain.value = 1;
    g.connect(sfxBus);
    if (wet) { const s = C.createGain(); s.gain.value = wet; g.connect(s); s.connect(revIn); }
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* ignore */ } }, 6000);
    return g;
  }
  function brass(out, t, freq, dur, vol) {
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.07, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(freq * 5, t + 0.08);
    f.frequency.exponentialRampToValueAtTime(freq * 2.6, t + 0.4);
    const lfo = C.createOscillator(); lfo.frequency.value = 5.2;
    const lg = C.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(freq * 0.008, t + 0.4);
    lfo.connect(lg);
    [-5, 4].forEach((det) => {
      const o = C.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = freq; o.detune.value = det;
      lg.connect(o.frequency);
      o.connect(f); o.start(t); o.stop(t + dur + 0.5);
    });
    lfo.start(t); lfo.stop(t + dur + 0.5);
    f.connect(g); g.connect(out);
  }
  function timpani(out, t, freq, vol) {
    osc(out, t, 1.4, 'sine', freq * 1.2, freq, vol, 0.004);
    osc(out, t, 0.6, 'sine', freq * 2.4, freq * 2.1, vol * 0.3, 0.004);
    noise(out, t, 0.12, 'lowpass', 900, 0, vol * 0.4, 0.002);
  }
  function bell(out, t, freq, vol, dur) {
    [1, 2.76, 5.4, 8.93].forEach((m, i) => osc(out, t, (dur || 1.6) / (i + 1), 'sine', freq * m, null, vol / (i + 1.3), 0.002));
  }

  // ---------------- sound library ----------------
  const GAP = { rifle: 35, mg: 140, bazooka: 120, rocketfire: 400, rocket: 90, cannon: 70, artfire: 120, boom: 60, small: 45, click: 25, whistle: 250, radio: 300, hit: 40 };

  A.play = function (name, vol, pan) {
    if (!A.enabled || !C) return;
    vol = vol == null ? 1 : Math.max(0, Math.min(1, vol));
    if (vol < 0.03) return;
    const now = performance.now();
    if (A.last[name] && now - A.last[name] < (GAP[name] || 20)) return;
    A.last[name] = now;
    const t = C.currentTime + 0.005;
    const r = (a, b) => a + Math.random() * (b - a);
    let o;
    switch (name) {
      // ---- weapons (positional) ----
      case 'rifle':
        o = chain(vol * 0.8, pan, 0.18, 2.2);
        noise(o, t, 0.014, 'highpass', 2600, 0, 0.9, 0.0008);
        noise(o, t, r(0.07, 0.11), 'lowpass', r(1100, 1800), 0.7, 0.75, 0.001);
        osc(o, t, 0.06, 'sine', r(150, 190), 55, 0.55, 0.001);
        noise(o, t + 0.02, 0.25, 'bandpass', 900, 0.8, 0.06, 0.02);
        break;
      case 'mg': {
        // short automatic burst
        o = chain(vol * 0.75, pan, 0.2, 2.4);
        const n = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const tt = t + i * 0.065;
          noise(o, tt, 0.012, 'highpass', 2300, 0, 0.7, 0.0008);
          noise(o, tt, 0.06, 'lowpass', r(900, 1400), 0.7, 0.6, 0.001);
          osc(o, tt, 0.045, 'sine', r(130, 160), 60, 0.4, 0.001);
        }
        break;
      }
      case 'bazooka':
        o = chain(vol, pan, 0.3, 2);
        noise(o, t, 0.05, 'lowpass', 700, 0, 0.9, 0.002);
        noise(o, t, 0.6, 'bandpass', 1200, 0.8, 0.35, 0.02, 400);
        osc(o, t, 0.15, 'sine', 120, 50, 0.6, 0.002);
        break;
      case 'rocketfire':
        o = chain(vol, pan, 0.35, 2);
        noise(o, t, 1.6, 'bandpass', 900, 0.6, 0.45, 0.05, 2600);
        break;
      case 'rocket':
        o = chain(vol * 0.8, pan, 0.3, 2);
        noise(o, t, 0.5, 'bandpass', r(1400, 2200), 1, 0.4, 0.01, 500);
        osc(o, t, 0.12, 'sine', 90, 40, 0.4, 0.002);
        break;
      case 'hit':
        o = chain(vol * 0.5, pan, 0.1, 1.2);
        noise(o, t, 0.03, 'bandpass', r(3000, 5000), 3, 0.5, 0.0005);
        osc(o, t, 0.05, 'triangle', r(1800, 2600), 900, 0.12);
        break;
      case 'cannon':
        o = chain(vol, pan, 0.3, 3);
        noise(o, t, 0.025, 'highpass', 1600, 0, 1, 0.0008);
        noise(o, t, 0.8, 'lowpass', 520, 0.5, 1.1, 0.002, 140);
        osc(o, t, 0.5, 'sine', 85, 32, 1.1, 0.002);
        noise(o, t + 0.05, 0.9, 'bandpass', 300, 0.7, 0.18, 0.08);
        break;
      case 'artfire':
        o = chain(vol, pan, 0.4, 3.5);
        noise(o, t, 0.03, 'highpass', 1200, 0, 1, 0.0008);
        noise(o, t, 1.3, 'lowpass', 380, 0.6, 1.3, 0.003, 90);
        osc(o, t, 0.9, 'sine', 62, 24, 1.3, 0.003);
        osc(o, t, 0.25, 'sine', 140, 60, 0.5, 0.002);
        break;
      case 'whistle': {
        o = chain(vol * 0.6, pan, 0.2, 1);
        const dur = Math.max(0.4, Math.min(2.5, A._whistleDur || 1));
        const ox = C.createOscillator(); ox.type = 'sine';
        ox.frequency.setValueAtTime(r(1900, 2300), t);
        ox.frequency.exponentialRampToValueAtTime(r(500, 700), t + dur);
        const g = C.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        ox.connect(g); g.connect(o); ox.start(t); ox.stop(t + dur + 0.05);
        break;
      }
      case 'boom':
        o = chain(vol, pan, 0.45, 4);
        noise(o, t, 0.02, 'highpass', 800, 0, 1, 0.0008);
        noise(o, t, 1.8, 'lowpass', 2600, 0.7, 1.4, 0.004, 120);
        osc(o, t, 1.3, 'sine', 58, 22, 1.4, 0.003);
        for (let i = 0; i < 14; i++) noise(o, t + r(0.08, 1.1), r(0.01, 0.04), 'highpass', r(2500, 6000), 0, r(0.05, 0.22), 0.001);
        noise(o, t + 0.25, 2.2, 'lowpass', 500, 0.5, 0.25, 0.4);
        break;
      case 'small':
        o = chain(vol * 0.9, pan, 0.35, 3);
        noise(o, t, 0.015, 'highpass', 1500, 0, 0.9, 0.0008);
        noise(o, t, 0.8, 'lowpass', 1800, 0.6, 1.1, 0.003, 160);
        osc(o, t, 0.5, 'sine', 90, 35, 0.9, 0.002);
        for (let i = 0; i < 6; i++) noise(o, t + r(0.05, 0.6), 0.02, 'highpass', r(3000, 6000), 0, r(0.05, 0.15), 0.001);
        break;
      // ---- interface ----
      case 'click':
        o = uiOut(0.05);
        noise(o, t, 0.022, 'bandpass', 2800, 2.5, 0.35, 0.001);
        osc(o, t, 0.04, 'sine', 520, 300, 0.12, 0.001);
        break;
      case 'select':
        o = uiOut(0.05);
        noise(o, t, 0.03, 'bandpass', 1800, 3, 0.2, 0.001);
        break;
      case 'radio':
        o = uiOut(0.02);
        noise(o, t, 0.13, 'bandpass', 1700, 1.4, 0.22, 0.004);
        osc(o, t + 0.01, 0.07, 'square', 1250, null, 0.035, 0.002);
        break;
      case 'coin':
        o = uiOut(0.25);
        bell(o, t, 1760, 0.12, 0.6);
        bell(o, t + 0.07, 2350, 0.09, 0.6);
        noise(o, t, 0.02, 'highpass', 5000, 0, 0.12);
        break;
      case 'build':
        o = uiOut(0.35);
        for (let i = 0; i < 3; i++) { bell(o, t + i * 0.18, 620 + i * 3, 0.13, 0.5); noise(o, t + i * 0.18, 0.04, 'bandpass', 3000, 2, 0.4); }
        break;
      case 'research':
        o = uiOut(0.6);
        [784, 988, 1175, 1568].forEach((f, i) => bell(o, t + i * 0.09, f, 0.08, 1.4));
        break;
      case 'turn':
        o = uiOut(0.3);
        noise(o, t, 0.45, 'bandpass', 500, 1.2, 0.3, 0.12, 3200);
        timpani(o, t + 0.05, 62, 0.45);
        break;
      case 'event':
        o = uiOut(0.5);
        noise(o, t, 0.5, 'bandpass', 700, 1, 0.2, 0.15, 2500);
        brass(o, t + 0.1, 196, 0.7, 0.07); brass(o, t + 0.1, 294, 0.7, 0.05);
        break;
      case 'war':
        o = uiOut(0.7);
        for (let i = 0; i < 8; i++) timpani(o, t + i * 0.07, 55, 0.12 + i * 0.03);
        [73.4, 110, 146.8, 174.6].forEach((f) => brass(o, t + 0.55, f, 1.1, 0.07));
        timpani(o, t + 0.55, 55, 0.9);
        break;
      case 'peace':
        o = uiOut(0.7);
        [261.6, 329.6, 392].forEach((f, i) => brass(o, t + i * 0.02, f, 1.4, 0.05));
        bell(o, t, 1046, 0.05, 2);
        break;
      case 'victory': {
        o = uiOut(0.8);
        const seq = [[392, 0, 0.18], [392, 0.2, 0.18], [392, 0.4, 0.18], [523, 0.62, 0.9], [659, 1.0, 0.25], [784, 1.3, 1.6]];
        seq.forEach(([f, d, l]) => { brass(o, t + d, f, l, 0.09); brass(o, t + d, f / 2, l, 0.05); });
        timpani(o, t + 0.62, 65, 0.8); timpani(o, t + 1.3, 49, 0.9);
        break;
      }
      case 'defeat': {
        o = uiOut(0.8);
        const seq = [[220, 0, 0.9], [207.6, 0.9, 0.9], [174.6, 1.8, 1.8]];
        seq.forEach(([f, d, l]) => { brass(o, t + d, f, l, 0.07); brass(o, t + d, f * 0.75, l, 0.05); });
        timpani(o, t + 1.8, 44, 0.8);
        break;
      }
    }
  };
  // looping weather bed (rain / snow wind / dust storm)
  let wxNodes = null;
  A.weather = function (kind) {
    if (!C) return;
    if (wxNodes) { wxNodes.forEach((n) => { try { n.stop(); } catch (e) { /* ignore */ } }); wxNodes = null; }
    if (!kind) return;
    const s = C.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = C.createBiquadFilter();
    const g = C.createGain();
    if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = 0.07; }
    else if (kind === 'snow') { f.type = 'bandpass'; f.frequency.value = 350; f.Q.value = 0.4; g.gain.value = 0.09; }
    else { f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5; g.gain.value = 0.08; }
    const lfo = C.createOscillator(); lfo.frequency.value = 0.09;
    const lg = C.createGain(); lg.gain.value = g.gain.value * 0.5;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(); lfo.start();
    wxNodes = [s, lfo];
  };
  A.whistle = function (dur, vol, pan) {
    A._whistleDur = dur;
    A.play('whistle', vol, pan);
  };

  // ---------------- voice (radio acknowledgements) ----------------
  let trVoice = null, lastSay = 0;
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      trVoice = vs.find((v) => /^tr/i.test(v.lang)) || null;
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  }
  const LINES = {
    select: { inf: ['Komutanım?', 'Emrinizdeyiz.', 'Piyade hazır.', 'Dinliyoruz.'], tank: ['Zırhlı birlik hazır.', 'Tank komutanı dinliyor.', 'Motorlar çalışıyor.'], art: ['Topçu mevzide.', 'Koordinat bekliyoruz.', 'Toplar hazır.'] },
    move: { inf: ['Emredersiniz!', 'İlerliyoruz!', 'Hemen!', 'Anlaşıldı!'], tank: ['Paletler dönüyor!', 'Yoldayız!', 'Tam gaz!'], art: ['Mevzi değiştiriyoruz.', 'Anlaşıldı, hareket.'] },
    attack: { inf: ['Hücum!', 'Ateş serbest!', 'Saldırıya!'], tank: ['Hedef kilitlendi!', 'Ateş!', 'Ezin onları!'], art: ['Hedef koordinatları alındı!', 'Bombardıman başlıyor!', 'Ateş!'] },
  };
  A.say = function (kind, utype) {
    A.play('radio');
    if (!A.voice || !A.enabled || !trVoice || !('speechSynthesis' in window)) return;
    const now = performance.now();
    if (now - lastSay < 1100) return;
    lastSay = now;
    const arr = (LINES[kind] || LINES.move)[utype || 'inf'] || LINES.move.inf;
    const u = new SpeechSynthesisUtterance(arr[Math.floor(Math.random() * arr.length)]);
    u.voice = trVoice; u.lang = trVoice.lang; u.rate = 1.15; u.pitch = utype === 'tank' ? 0.7 : 0.85;
    u.volume = Math.min(1, A.vol.master * A.vol.sfx * 0.9);
    speechSynthesis.cancel();
    setTimeout(() => speechSynthesis.speak(u), 120);
  };
  A.hasVoice = () => !!trVoice;

  // ---------------- generative music ----------------
  let musicTimer = null, musicMode = null, nextBar = 0, bar = 0, ambNodes = null;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // D minor progression (strategy) — Dm Bb F C Gm A
  const PROG = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 58, 62], [45, 52, 57, 61]];
  const SCALE = [62, 64, 65, 67, 69, 70, 72, 74];

  function pad(t, notes, dur, vol) {
    notes.forEach((n) => {
      const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 0.4;
      const g = C.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
      g.gain.setValueAtTime(vol, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
      [-7, 6].forEach((det) => {
        const o = C.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = midi(n); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 1.6);
      });
      f.connect(g); g.connect(musicBus);
      const s = C.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(revIn);
    });
  }
  function horn(t, n, dur, vol) {
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = C.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n);
    const o2 = C.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = midi(n); o2.detune.value = 3;
    const g2 = C.createGain(); g2.gain.value = 0.25;
    o.connect(f); o2.connect(g2); g2.connect(f);
    f.connect(g); g.connect(musicBus);
    const s = C.createGain(); s.gain.value = 0.9; g.connect(s); s.connect(revIn);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function drum(t, f, vol) {
    osc(musicBus, t, 0.7, 'sine', f * 1.6, f, vol, 0.003);
    noise(musicBus, t, 0.15, 'lowpass', 700, 0, vol * 0.35, 0.002);
  }
  function pluck(t, n, vol) {
    const f = C.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.35);
    const g = C.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.45);
  }

  function scheduleStrategy() {
    const barLen = 6.4;
    while (nextBar < C.currentTime + 1.5) {
      const t = nextBar;
      const ch = PROG[bar % PROG.length];
      pad(t, ch, barLen, 0.022);
      pad(t, [ch[0] - 12], barLen, 0.03);
      if (bar % 2 === 0) drum(t, 55, 0.25);
      drum(t + barLen * 0.75, 55, 0.12);
      if (bar % 3 !== 2) {
        let n = SCALE[Math.floor(Math.random() * SCALE.length)];
        for (let k = 0; k < 3; k++) {
          horn(t + 1.2 + k * 1.4, n, 1.6, 0.03);
          n = SCALE[Math.max(0, Math.min(SCALE.length - 1, SCALE.indexOf(n) + Math.floor(Math.random() * 3) - 1))];
        }
      }
      bar++; nextBar += barLen;
    }
  }
  const OST = [38, 38, 41, 38, 40, 38, 36, 38];
  function scheduleBattle() {
    const beat = 0.5, barLen = beat * 8;
    while (nextBar < C.currentTime + 1.2) {
      const t = nextBar;
      const root = bar % 4 === 3 ? 36 : 38;
      pad(t, [root, root + 7], barLen, 0.03);
      for (let i = 0; i < 8; i++) {
        pluck(t + i * beat, OST[i] + (root - 38) + 12, 0.035);
        if (i % 4 === 0) drum(t + i * beat, 50, 0.32);
        if (i % 4 === 2) drum(t + i * beat, 70, 0.14);
        if (i === 7) { drum(t + i * beat + beat / 2, 70, 0.1); }
      }
      if (bar % 2 === 1) horn(t + 2, 62 + (bar % 4 === 3 ? -2 : 0), 2, 0.025);
      bar++; nextBar += barLen;
    }
  }

  A.music = function (mode) {
    A.pendingMusic = mode;
    if (!C) return;
    if (mode === musicMode) return;
    musicMode = mode;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    // fade the music bus for the switch
    const now = C.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    musicBus.gain.linearRampToValueAtTime(A.vol.music * 0.6, now + 1.6);
    if (!mode) return;
    nextBar = now + 0.8; bar = 0;
    const fn = mode === 'battle' ? scheduleBattle : scheduleStrategy;
    fn();
    musicTimer = setInterval(() => { if (A.enabled) fn(); else nextBar = C.currentTime + 0.5; }, 300);
  };

  // battle ambience: wind + distant gunfire
  A.ambience = function (on) {
    if (!C) return;
    if (ambNodes) {
      ambNodes.forEach((n) => { try { n.stop ? n.stop() : clearInterval(n); } catch (e) { /* ignore */ } });
      ambNodes = null;
    }
    if (!on) return;
    const s = C.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.5;
    const g = C.createGain(); g.gain.value = 0.05;
    const lfo = C.createOscillator(); lfo.frequency.value = 0.13;
    const lg = C.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = C.createOscillator(); lfo2.frequency.value = 0.07;
    const lg2 = C.createGain(); lg2.gain.value = 220;
    lfo2.connect(lg2); lg2.connect(f.frequency);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(); lfo.start(); lfo2.start();
    const iv = setInterval(() => {
      if (!A.enabled || Math.random() < 0.4) return;
      const pan = Math.random() * 2 - 1;
      const n = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) setTimeout(() => A.play(Math.random() < 0.12 ? 'boom' : 'rifle', 0.12 + Math.random() * 0.08, pan), i * (60 + Math.random() * 120));
    }, 1800);
    ambNodes = [s, lfo, lfo2, iv];
  };
})();
