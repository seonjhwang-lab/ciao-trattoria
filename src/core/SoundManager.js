// 절차적 카페 ASMR 사운드 — 외부 파일 없이 Web Audio API 로 합성한다.
// 모바일 브라우저는 사용자 터치 후에만 소리를 낼 수 있어서 첫 터치에 unlock() 한다.
export class SoundManager {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
    this.loops = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.7 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 브라운 노이즈 (에스프레소·물 소리용)
      this.brownBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const b = this.brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        b[i] = last * 3.5;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  get ready() {
    return !!this.ctx && this.enabled;
  }

  // ───── 기본 도구 ─────
  env(node, t, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  noise(buf = this.noiseBuf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    return s;
  }

  tone(freq, { type = 'sine', t = 0, a = 0.005, d = 0.4, peak = 0.3, detune = 0 } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const now = c.currentTime + t;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = c.createGain();
    this.env(g, now, a, peak, d);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + a + d + 0.05);
  }

  burst({ t = 0, dur = 0.05, type = 'bandpass', freq = 2000, q = 1, peak = 0.4, buf } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const now = c.currentTime + t;
    const s = this.noise(buf);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, now, 0.003, peak, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(now, Math.random());
    s.stop(now + dur + 0.05);
  }

  // 지속음(추출·스팀·바르기): start → (선택) intensity → stop
  loopStart(name, { buf, type = 'lowpass', freq = 800, q = 0.7, gain = 0.3, lfo = 0, lfoDepth = 0 } = {}) {
    if (!this.ready || this.loops.has(name)) return;
    const c = this.ctx;
    const s = this.noise(buf ?? this.noiseBuf);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(gain, c.currentTime, 0.04);
    s.connect(f).connect(g).connect(this.master);
    let osc = null;
    if (lfo) {
      osc = c.createOscillator();
      osc.frequency.value = lfo;
      const lg = c.createGain();
      lg.gain.value = lfoDepth;
      osc.connect(lg).connect(g.gain);
      osc.start();
    }
    s.start();
    this.loops.set(name, { s, g, f, osc, gain });
  }

  loopLevel(name, level) {
    const l = this.loops.get(name);
    if (l) l.g.gain.setTargetAtTime(l.gain * level, this.ctx.currentTime, 0.05);
  }

  loopStop(name) {
    const l = this.loops.get(name);
    if (!l) return;
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(0.0001, t, 0.06);
    l.s.stop(t + 0.3);
    l.osc?.stop(t + 0.3);
    this.loops.delete(name);
  }

  // ───── 카페 사운드 ─────
  step(level = 1) {
    // 나무·타일 바닥 발소리: 짧은 저역 노이즈 + 아주 작은 탁음
    this.alt = !this.alt;
    this.burst({ dur: 0.05, type: 'lowpass', freq: this.alt ? 520 : 460, q: 0.7, peak: 0.12 * level });
    this.tone(this.alt ? 90 : 82, { d: 0.05, peak: 0.07 * level });
  }

  blip(i = 0) {
    // 대화창 글자 출력음
    this.tone(520 + (i % 3) * 40, { d: 0.03, peak: 0.025, type: 'triangle' });
  }

  lever() {
    this.tone(70, { d: 0.25, peak: 0.25 });
    this.burst({ dur: 0.06, freq: 1200, q: 2, peak: 0.12 });
  }
  tap() {
    this.tone(1400, { d: 0.05, peak: 0.06, type: 'triangle' });
  }

  chop() {
    // 도마 위 칼질 '탁!' — 짧은 노이즈 + 낮은 나무 울림
    this.burst({ dur: 0.04, freq: 2600, q: 1.2, peak: 0.5 });
    this.tone(190, { d: 0.09, peak: 0.35, type: 'sine' });
    this.tone(95, { d: 0.12, peak: 0.25 });
  }

  swish() {
    if (!this.ready) return;
    const c = this.ctx;
    const now = c.currentTime;
    const s = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(900, now);
    f.frequency.exponentialRampToValueAtTime(4200, now + 0.18);
    const g = c.createGain();
    this.env(g, now, 0.02, 0.18, 0.18);
    s.connect(f).connect(g).connect(this.master);
    s.start(now);
    s.stop(now + 0.3);
  }

  spreadStart() {
    this.loopStart('spread', { type: 'bandpass', freq: 1500, q: 0.9, gain: 0.16 });
  }
  spreadMove(speed) {
    this.loopLevel('spread', Math.min(1.4, 0.15 + speed * 0.9));
  }
  spreadStop() {
    this.loopStop('spread');
  }

  grind() {
    if (!this.ready) return;
    for (let i = 0; i < 10; i++) this.burst({ t: i * 0.08, dur: 0.07, freq: 3000 + Math.random() * 2000, q: 3, peak: 0.12 });
    this.tone(110, { type: 'sawtooth', d: 0.85, a: 0.05, peak: 0.05 });
  }

  tamp() {
    this.tone(120, { d: 0.12, peak: 0.4 });
    this.burst({ dur: 0.03, freq: 800, peak: 0.25 });
  }

  pourStart() {
    this.loopStart('pour', { buf: this.brownBuf, type: 'lowpass', freq: 900, gain: 0.5, lfo: 7, lfoDepth: 0.15 });
  }
  pourStop() {
    this.loopStop('pour');
  }

  waterStart() {
    this.loopStart('water', { buf: this.brownBuf, type: 'bandpass', freq: 1400, q: 0.6, gain: 0.55, lfo: 11, lfoDepth: 0.12 });
  }
  waterStop() {
    this.loopStop('water');
  }

  steamStart() {
    this.loopStart('steam', { type: 'highpass', freq: 3200, q: 0.8, gain: 0.22, lfo: 4, lfoDepth: 0.05 });
  }
  steamLevel(v) {
    const l = this.loops.get('steam');
    if (l) l.f.frequency.setTargetAtTime(2600 + v * 2200, this.ctx.currentTime, 0.1);
  }
  steamStop() {
    this.loopStop('steam');
  }

  // 모바일 진동 (효과음을 끄면 진동도 끈다 · 지원하지 않는 기기/샌드박스에서는 조용히 무시)
  vibrate(pattern) {
    if (!this.enabled || !navigator.vibrate) return false;
    // 사용자가 화면을 한 번이라도 터치하기 전에는 브라우저가 진동을 막는다 (콘솔 경고 방지)
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    try {
      return !!navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  // ───── 비스트로 조리 ASMR ─────
  // 프라이팬 지글거림 (팬을 흔들수록 커진다)
  sizzleStart() {
    this.loopStart('sizzle', { type: 'highpass', freq: 2400, q: 0.5, gain: 0.2, lfo: 23, lfoDepth: 0.08 });
  }
  sizzleLevel(v) {
    this.loopLevel('sizzle', Math.min(1.8, 0.4 + v));
  }
  sizzleStop() {
    this.loopStop('sizzle');
  }
  // 화덕 장작 타닥타닥
  fireStart() {
    this.loopStart('fire', { buf: this.brownBuf, type: 'lowpass', freq: 500, q: 0.6, gain: 0.35, lfo: 3, lfoDepth: 0.1 });
  }
  fireStop() {
    this.loopStop('fire');
  }
  crackle() {
    this.burst({ dur: 0.02, freq: 1800 + Math.random() * 2500, q: 4, peak: 0.12 });
  }
  // 밀대가 반죽 위를 구르는 둔탁한 소리
  roll() {
    this.burst({ dur: 0.12, type: 'lowpass', freq: 380, q: 0.8, peak: 0.16 });
  }
  // 치즈 강판 사각사각
  grate() {
    this.burst({ dur: 0.07, freq: 5200, q: 2.5, peak: 0.1 });
    this.burst({ t: 0.03, dur: 0.05, freq: 3800, q: 3, peak: 0.06 });
  }
  // 채소가 볼 안에서 통통 튀는 소리
  toss() {
    for (let i = 0; i < 4; i++) this.burst({ t: i * 0.04 + Math.random() * 0.02, dur: 0.03, type: 'bandpass', freq: 900 + Math.random() * 900, q: 2, peak: 0.1 });
  }
  // 소스 보글보글
  bubble() {
    this.tone(300 + Math.random() * 260, { d: 0.05, peak: 0.04, type: 'sine' });
  }

  pump() {
    this.tone(320, { d: 0.06, peak: 0.12, type: 'triangle' });
    this.burst({ t: 0.04, dur: 0.06, freq: 700, q: 2, peak: 0.12 });
  }

  plop() {
    this.tone(260, { d: 0.12, peak: 0.18, type: 'sine' });
    this.tone(180, { t: 0.02, d: 0.1, peak: 0.1 });
  }

  plate() {
    // 세라믹 접시 '딸깍'
    this.tone(2600, { d: 0.18, peak: 0.08 });
    this.tone(3920, { d: 0.12, peak: 0.05 });
    this.burst({ dur: 0.02, freq: 5000, peak: 0.15 });
  }

  doorBell() {
    // 문 풍경 '딸랑~' — 비조화 배음 종소리 두 번
    for (const [t, base] of [
      [0, 1568],
      [0.16, 1760],
    ]) {
      for (const [ratio, amp] of [
        [1, 0.16],
        [2.76, 0.06],
        [5.4, 0.03],
      ])
        this.tone(base * ratio, { t, d: 1.4, peak: amp });
    }
  }

  coin() {
    this.tone(988, { type: 'square', d: 0.08, peak: 0.06 });
    this.tone(1319, { type: 'square', t: 0.08, d: 0.25, peak: 0.06 });
  }

  fanfare() {
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      this.tone(f, { t: i * 0.09, d: 0.9, peak: 0.14 });
      this.tone(f * 2.01, { t: i * 0.09, d: 0.5, peak: 0.04 });
    });
    for (let i = 0; i < 6; i++) this.tone(2600 + Math.random() * 2000, { t: 0.4 + i * 0.06, d: 0.3, peak: 0.03 });
    this.coin();
  }

  success() {
    this.tone(880, { d: 0.5, peak: 0.12 });
    this.tone(1319, { t: 0.1, d: 0.6, peak: 0.12 });
  }

  soft() {
    this.tone(660, { d: 0.4, peak: 0.1 });
  }

  aww() {
    this.tone(523, { d: 0.25, peak: 0.1, type: 'triangle' });
    this.tone(415, { t: 0.18, d: 0.45, peak: 0.1, type: 'triangle' });
  }
}
