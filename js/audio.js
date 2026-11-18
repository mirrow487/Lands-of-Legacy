'use strict';
(function () {
  // Synthesized sound effects (no asset files needed)
  const A = (LOL.audio = { enabled: true, ctx: null, master: null, last: {} });

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.3;
      A.master.connect(A.ctx.destination);
      const len = A.ctx.sampleRate * 2;
      A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { A.ctx = null; }
  };

  function noise(dur, type, freq, vol, delay) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const src = c.createBufferSource(); src.buffer = A.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const GAP = { rifle: 45, cannon: 90, artfire: 140, boom: 70, small: 50, click: 30, ack: 120 };

  A.play = function (name, vol) {
    if (!A.enabled || !A.ctx) return;
    vol = vol == null ? 1 : Math.max(0, Math.min(1, vol));
    if (vol < 0.04) return;
    const now = performance.now();
    if (A.last[name] && now - A.last[name] < (GAP[name] || 30)) return;
    A.last[name] = now;
    switch (name) {
      case 'rifle': noise(0.07, 'highpass', 1400 + Math.random() * 600, 0.45 * vol); break;
      case 'cannon': noise(0.3, 'lowpass', 1000, 0.9 * vol); tone(110, 0.22, 'sine', 0.6 * vol, 40); break;
      case 'artfire': noise(0.5, 'lowpass', 600, 1 * vol); tone(70, 0.4, 'sine', 0.8 * vol, 28); break;
      case 'boom': noise(0.9, 'lowpass', 380, 1 * vol); tone(65, 0.6, 'sine', 0.8 * vol, 22); break;
      case 'small': noise(0.35, 'lowpass', 900, 0.6 * vol); break;
      case 'click': tone(900, 0.04, 'square', 0.12 * vol); break;
      case 'ack': tone(520, 0.06, 'square', 0.1 * vol, 760); tone(760, 0.06, 'square', 0.08 * vol, null, 0.07); break;
      case 'turn': tone(330, 0.18, 'triangle', 0.25, 520); break;
      case 'war': tone(196, 0.35, 'sawtooth', 0.18); tone(147, 0.5, 'sawtooth', 0.18, null, 0.3); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.3, null, i * 0.14)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.3, null, i * 0.18)); break;
      case 'coin': tone(1200, 0.07, 'square', 0.08); tone(1600, 0.1, 'square', 0.07, null, 0.06); break;
    }
  };
})();
