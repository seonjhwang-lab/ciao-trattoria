import * as THREE from 'three';
import { kit } from '../core/Kit.js';
import { RoundedBoxGeometry } from '../core/RoundedBox.js';
import { Tweens, clamp, scoreWord } from './tween.js';
import { guideArrow } from './BoardBench.js';
import { buildBistroDish, pastaBowl, pastaNest, parmesanSnow, ribbonGeo, mushroomSlice, blob } from '../core/BistroDish.js';
import { basilLeaf } from '../core/HeroDish.js';

// 생면 파스타 워크벤치: 밀대로 반죽 밀기 → 제면 롤러로 가닥 내기 → 프라이팬 토스/만테까레 → 트위저로 말아 올리기 → 파르미지아노 갈기
const Y0 = 0.9;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PB = { x: -0.2, z: 0.1, w: 0.44, d: 0.34, t: 0.03 }; // 원목 파스타 보드
const YB = Y0 + PB.t;
const BURNER = V(0.22, Y0, -0.14);
const BOWL = V(0.27, Y0, 0.24);
const SAUCE = {
  truffle: { color: '#e6d3a4', coat: '#e7cf96', name: '트러플 크림' },
  ragu: { color: '#8f2f18', coat: '#c0582f', name: '라구' },
  pesto: { color: '#4f7a24', coat: '#9fb24a', name: '바질 페스토' },
};
const DOUGH = '#f1cf6c';

function flourTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = DOUGH;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.7 ? 'rgba(255,250,235,0.45)' : 'rgba(200,150,60,0.25)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class PastaBench {
  constructor(ctx) {
    this.ctx = ctx;
    this.stage = ctx.stage;
    this.tw = new Tweens();
    this.t = 0;
    this.parts = [];
    const r = ctx.order.recipe.id;
    this.kind = r.includes('ragu') ? 'ragu' : r.includes('pesto') ? 'pesto' : 'truffle';
    this.sauce = SAUCE[this.kind];
    this.doughMat = new THREE.MeshStandardMaterial({ map: flourTexture(), roughness: 0.78 });
    this.build();
  }

  build() {
    const k = kit;
    const g = this.stage;
    const steel = k.metal('steel');
    // 스테인리스 레인지 테이블
    g.add(k.at(k.box(0.94, Y0 - 0.04, 0.82, steel), 0, (Y0 - 0.04) / 2, 0));
    g.add(k.at(k.box(0.98, 0.04, 0.86, k.stone('#2f2f31')), 0, Y0 - 0.02, 0));
    g.add(k.at(k.box(0.98, 0.26, 0.02, steel), 0, Y0 + 0.13, -0.42));
    // 원목 파스타 보드 + 밀가루
    const board = k.rbox(PB.w, PB.t, PB.d, k.wood('lightoak'), { r: 0.006 });
    board.position.set(PB.x, Y0 + PB.t / 2, PB.z);
    board.receiveShadow = true;
    g.add(board);
    for (let i = 0; i < 50; i++) g.add(k.at(k.box(0.0028, 0.0006, 0.0028, k.mat('#fbf7ee', { rough: 1 })), PB.x + (Math.random() - 0.5) * PB.w * 0.9, YB + 0.0004, PB.z + (Math.random() - 0.5) * PB.d * 0.9));
    // 반죽 (밀대로 펴지는 시트)
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 1, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const e = Math.max(Math.abs(x), Math.abs(z)) * 2;
      if (p.getY(i) > 0) p.setY(i, 0.5 - Math.max(0, e - 0.6) * 0.5); // 가장자리가 둥글게 내려간다
      p.setX(i, x * (1 + Math.sin(z * 9) * 0.03));
      p.setZ(i, z * (1 + Math.sin(x * 11) * 0.03));
    }
    geo.translate(0, 0.5, 0);
    geo.computeVertexNormals();
    this.dough = new THREE.Mesh(geo, this.doughMat);
    this.dough.castShadow = this.dough.receiveShadow = true;
    this.dough.position.set(PB.x, YB, PB.z);
    g.add(this.dough);
    this.initSheet();
    // 밀대
    const pin = new THREE.Group();
    pin.add(k.at(k.cyl(0.02, 0.02, 0.3, k.wood('lightoak'), { seg: 20 }), 0, 0, 0, 0, 0, Math.PI / 2));
    for (const s of [-1, 1]) pin.add(k.at(k.cyl(0.011, 0.013, 0.08, k.wood('walnut'), { seg: 12 }), s * 0.19, 0, 0, 0, 0, Math.PI / 2));
    pin.position.set(PB.x, YB + 0.06, PB.z + 0.2);
    g.add(pin);
    this.pin = pin;
    // 가스 화구 + 프라이팬
    g.add(k.at(k.cyl(0.1, 0.1, 0.012, k.metal('black')), BURNER.x, Y0 + 0.006, BURNER.z));
    for (let i = 0; i < 4; i++) g.add(k.at(k.box(0.17, 0.012, 0.012, k.metal('black')), BURNER.x, Y0 + 0.02, BURNER.z, 0, (i * Math.PI) / 4, 0));
    this.flames = [];
    for (let i = 0; i < 14; i++) {
      const f = k.cone(0.007, 0.022, k.glow('#4f8cff', 1.8));
      f.position.set(BURNER.x + Math.cos(i * 0.45) * 0.05, Y0 + 0.024, BURNER.z + Math.sin(i * 0.45) * 0.05);
      f.visible = false;
      g.add(f);
      this.flames.push(f);
    }
    // 프라이팬: 두께 2.5cm 불투명 통주물 바닥 + 양면 벽. 삼발이(Y0+0.026)보다 4cm 위에 떠 있어 흔들어도 화구가 뚫고 나오지 않는다
    this.pan = new THREE.Group();
    this.pan.position.set(BURNER.x, Y0 + 0.026 + 0.04, BURNER.z);
    const cast = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3634').convertSRGBToLinear(), metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide });
    const PAN_T = 0.025;
    this.pan.add(k.at(new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.104, PAN_T, 40), cast), 0, PAN_T / 2, 0));
    const wallProf = [
      [0.104, 0],
      [0.112, PAN_T],
      [0.13, 0.062],
      [0.134, 0.064],
      [0.127, 0.064],
      [0.106, PAN_T + 0.002],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    this.pan.add(new THREE.Mesh(new THREE.LatheGeometry(wallProf, 40), cast));
    this.pan.add(k.at(k.rbox(0.2, 0.018, 0.028, k.wood('walnut'), { r: 0.007 }), 0.215, 0.058, 0.062, 0, -0.3, 0.12));
    this.pan.add(k.at(k.cyl(0.008, 0.008, 0.05, k.metal('steel')), 0.138, 0.058, 0.04, 0, -0.3, Math.PI / 2));
    this.pan.traverse((o) => o.isMesh && (o.castShadow = true));
    g.add(this.pan);
    this.panHome = this.pan.position.clone();
    this.panFloor = PAN_T + 0.015; // 내용물은 바닥 윗면 +1.5cm 아래로 내려가지 않는다
    // 팬 내용물 (소스 · 면 · 재료)
    this.contents = new THREE.Group();
    this.contents.position.y = this.panFloor;
    this.pan.add(this.contents);
    this.sauceDisc = new THREE.Mesh(new THREE.CircleGeometry(0.1, 36), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.sauce.color).convertSRGBToLinear(), roughness: 0.5, clearcoat: 0.2, transparent: true, opacity: 0 }));
    this.sauceDisc.rotation.x = -Math.PI / 2;
    this.sauceDisc.position.y = 0.001;
    this.contents.add(this.sauceDisc);
    // 파스타 볼 (플레이팅)
    this.bowl = pastaBowl();
    this.bowl.position.copy(BOWL);
    g.add(this.bowl);
    // 파르미지아노 레지아노 웨지 + 타공 핸드 그레이터 (마지막 단계)
    this.cheese = cheeseWedge();
    this.cheese.position.set(BOWL.x - 0.19, Y0, BOWL.z + 0.08);
    g.add(this.cheese);
    this.grater = handGrater();
    this.grater.visible = false;
    g.add(this.grater);
    this.ctx.view(V(0.02, Y0 + 0.05, 0.03), 1.0, 0.95);
  }

  // 반죽 → 얇은 시트 (pr 0~1)
  setSheet(pr) {
    this.sheet = { pr, w: 0.11 + 0.17 * pr, d: 0.09 + 0.19 * pr, t: 0.032 - 0.029 * pr };
    this.dough.scale.set(this.sheet.w, this.sheet.t, this.sheet.d);
    this.doughMat.map.repeat.set(1 + pr * 2, 1 + pr * 2);
  }

  start(step) {
    const fn = { roll: () => this.roll(), cut_pasta: () => this.cutPasta(step), toss: () => this.toss(), twirl: () => this.twirl(), grate: () => this.grate() }[step.type];
    return fn ? fn() : { update() {}, destroy() {} };
  }

  update(dt) {
    this.t += dt;
    this.tw.update(dt);
    if (this.hero && this.heroT < 1) {
      this.heroT = Math.min(1, this.heroT + dt / 0.45);
      const u = this.heroT;
      this.hero.scale.setScalar(0.6 + 0.4 * (1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2));
    }
    // 불꽃 흔들림
    for (const [i, f] of this.flames.entries()) if (f.visible) f.scale.y = 0.8 + Math.sin(this.t * 30 + i) * 0.25;
    // 탄력 있는 생면 가닥 (잘린 뒤 출렁)
    for (const s of this.strips ?? []) {
      if (!s.wob) continue;
      s.wob -= dt;
      const w = Math.max(0, s.wob);
      s.m.position.y = s.y0 + Math.abs(Math.sin(w * 22)) * 0.006 * w;
      s.m.rotation.z = Math.sin(w * 26 + s.i) * 0.12 * w;
    }
    // 입자 (밀가루 · 치즈 눈꽃 · 기포)
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.v) {
        p.v.y -= 2.2 * dt;
        p.m.position.addScaledVector(p.v, dt);
        if (p.floor !== undefined && p.m.position.y < p.floor) {
          p.m.position.y = p.floor;
          p.v = null;
          if (p.stay) {
            this.parts.splice(i, 1);
            continue;
          }
        }
      }
      if (p.grow) p.m.scale.setScalar(Math.max(0.01, p.grow * (1 - p.life / p.max)));
      if (p.life <= 0) {
        p.m.parent?.remove(p.m);
        this.parts.splice(i, 1);
      }
    }
  }

  puff(at, color = '#fbf7ee', n = 10, spread = 0.05) {
    for (let i = 0; i < n; i++) {
      const m = kit.sphere(0.002 + Math.random() * 0.003, kit.mat(color, { rough: 1, opacity: 0.7 }), { ws: 6, hs: 4 });
      m.castShadow = false;
      m.position.copy(at).add(V((Math.random() - 0.5) * spread, 0.005, (Math.random() - 0.5) * spread));
      this.stage.add(m);
      this.parts.push({ m, v: V((Math.random() - 0.5) * 0.2, 0.12 + Math.random() * 0.2, (Math.random() - 0.5) * 0.2), life: 0.8 });
    }
  }

  // 10차 생면 시트: 밀대 방향(z)으로 N줄. 줄마다 두께가 따로 줄고, 부피가 같도록 그 줄의 길이가 늘어난다.
  // 위 면만 있는 높이장(가장자리는 도마까지 둥글게 내려감) · UV 는 시트 전체 0~1 (덧가루 자국 캔버스)
  initSheet() {
    const N = 24;
    this.rows = Array.from({ length: N }, () => ({ len: 0.09 / N, t: 0.032 }));
    this.sheetW = 0.11;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f1cf6c';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.6 ? 'rgba(255,250,235,0.35)' : 'rgba(200,150,60,0.18)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    this.sheetCv = c;
    this.sheetTex = new THREE.CanvasTexture(c);
    this.sheetTex.encoding = THREE.sRGBEncoding;
    this.doughMat.map = this.sheetTex;
    this.doughMat.needsUpdate = true;
    this.rebuildSheet();
  }

  rebuildSheet() {
    const M = 14;
    const rows = this.rows;
    const L = rows.reduce((s, r) => s + r.len, 0);
    const W = this.sheetW;
    const zs = [-L / 2];
    for (const r of rows) zs.push(zs[zs.length - 1] + r.len);
    const tAt = (j) => {
      const a = rows[Math.max(0, j - 1)].t;
      const b = rows[Math.min(rows.length - 1, j)].t;
      return (a + b) / 2;
    };
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= rows.length; j++) {
      const ez = Math.min(j, rows.length - j) / 1.5; // 앞뒤 끝은 둥글게
      for (let i = 0; i <= M; i++) {
        const u = i / M;
        const ex = Math.min(u, 1 - u) * M / 1.5;
        const e = Math.min(1, ex, ez);
        const h = tAt(j) * Math.sin((e * Math.PI) / 2);
        // 손으로 민 반죽처럼 가장자리가 살짝 울퉁불퉁
        const wob = 1 + Math.sin(j * 1.7 + i) * 0.015;
        pos.push((u - 0.5) * W * wob, h, zs[j]);
        uv.push(u, j / rows.length);
      }
    }
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < M; i++) {
        const a = j * (M + 1) + i;
        const b = a + M + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.dough.geometry.dispose();
    this.dough.geometry = geo;
    this.dough.scale.set(1, 1, 1);
    const tAvg = rows.reduce((s, r) => s + r.t * r.len, 0) / L;
    this.sheet = { pr: Math.min(1, (0.032 - tAvg) / 0.029), w: W, d: L, t: tAvg };
  }

  // ───────── 1. 밀대로 생면 반죽 밀기 ─────────
  // 밀대가 지나간 줄만 얇아지며 그만큼 밀대 방향으로 길게 늘어나고, 지나간 자리에 덧가루 자국이 남는다
  roll() {
    const ctx = this.ctx;
    const self = this;
    if (!this.rows) this.initSheet();
    ctx.view(V(PB.x, YB + 0.02, PB.z), 0.52, 0.85);
    ctx.ui.step('생면 반죽 밀기', '밀대를 위아래로 밀어요');
    let pressed = false;
    let lastZ = null;
    let passes = 0;
    let dir = 0;
    let done = false;
    const refresh = () => ctx.ui.meter(`<div class="wb-cover"><div class="bar"><i class="${self.sheet.pr >= 1 ? 'good' : ''}" style="width:${Math.round(self.sheet.pr * 100)}%"></i></div><span>두께 ${(self.sheet.t * 1000).toFixed(1)}mm → 3mm · 길이 ${Math.round(self.sheet.d * 100)}cm</span></div>`);
    refresh();
    ctx.ui.actions([]);
    const finish = () => {
      done = true;
      const ts = self.rows.map((r) => r.t);
      const even = 1 - Math.min(1, (Math.max(...ts) - Math.min(...ts)) / 0.012);
      const score = Math.round(70 + even * 30);
      ctx.ui.pop(`고르게 폈어요 · ${scoreWord(score)}`, score >= 70);
      self.tw.to(self.pin, { pos: V(PB.x + 0.28, YB + 0.02, PB.z - 0.2), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.6, 0)), dur: 0.5 });
      ctx.done(score, `반죽 밀기 (왕복 ${passes}번)`);
    };
    const flourStreak = (v) => {
      const g = self.sheetCv.getContext('2d');
      const y = (1 - v) * 256;
      const gr = g.createLinearGradient(0, y - 10, 0, y + 10);
      gr.addColorStop(0, 'rgba(255,252,240,0)');
      gr.addColorStop(0.5, 'rgba(255,252,240,0.12)');
      gr.addColorStop(1, 'rgba(255,252,240,0)');
      g.fillStyle = gr;
      g.fillRect(0, y - 10, 256, 20);
      for (let i = 0; i < 12; i++) {
        g.fillStyle = 'rgba(255,255,250,0.4)';
        g.fillRect(Math.random() * 256, y + (Math.random() - 0.5) * 14, 6 + Math.random() * 18, 1);
      }
      self.sheetTex.needsUpdate = true;
    };
    return {
      down(e, ndc) {
        pressed = true;
        const p = ctx.planeHit(ndc, YB + self.sheet.t);
        lastZ = p ? p.z : null;
      },
      move(e, ndc) {
        if (done) return;
        const p = ctx.planeHit(ndc, YB + self.sheet.t);
        if (!p) return;
        const z = clamp(p.z, PB.z - PB.d / 2 + 0.03, PB.z + PB.d / 2 - 0.03);
        self.pin.position.set(PB.x, YB + (pressed ? self.sheet.t + 0.02 : 0.06), z);
        if (!pressed || lastZ === null) return;
        const dz = z - lastZ;
        self.pin.rotation.x -= dz / 0.02;
        const L = self.sheet.d;
        const local = z - (PB.z - L / 2);
        if (local > -0.02 && local < L + 0.02 && Math.abs(dz) > 0.0004) {
          // 밀대 아래(±2cm) 줄만 눌린다 → 그 줄이 길어진다 (부피 보존 len·t 일정, 폭도 조금 넓어짐)
          let acc = 0;
          for (const r of self.rows) {
            const c = acc + r.len / 2;
            acc += r.len;
            const k = Math.exp(-(((c - local) / 0.02) ** 2));
            if (k < 0.02 || r.t <= 0.003) continue;
            const nt = Math.max(0.003, r.t - Math.abs(dz) * 0.11 * k);
            r.len *= (r.t / nt) * 0.97 + 0.03; // 대부분은 길이로, 약간은 폭으로
            r.t = nt;
          }
          self.sheetW = Math.min(0.16, self.sheetW + Math.abs(dz) * 0.012);
          // 도마를 넘지 않게
          const total = self.rows.reduce((s, r) => s + r.len, 0);
          if (total > PB.d - 0.02) for (const r of self.rows) r.len *= (PB.d - 0.02) / total;
          self.rebuildSheet();
          if (Math.random() < 0.18) flourStreak(clamp(local / L, 0, 1));
          const d = Math.sign(dz);
          if (d && d !== dir) {
            if (dir) {
              passes++;
              ctx.sound.roll();
              self.puff(V(PB.x + (Math.random() - 0.5) * 0.2, YB + self.sheet.t, z));
            }
            dir = d;
          }
          refresh();
          if (self.sheet.t <= 0.0042 && passes >= 2) finish();
        }
        lastZ = z;
      },
      up() {
        pressed = false;
        lastZ = null;
      },
      update() {},
      destroy() {},
    };
  }

  // ───────── 2. 접어서 일자 식도로 제면 ─────────
  // 시트를 두 번 접어 납작한 띠로 만든 뒤, 칼날 방향이 고정된(rotation.y = 0) 파스타 식도가 위에서 아래로 곧게 내려와 썬다
  cutPasta(step) {
    const ctx = this.ctx;
    const self = this;
    const k = kit;
    const width = step.width ?? 'thin';
    this.width = width;
    const n = width === 'thin' ? 26 : width === 'medium' ? 16 : 9;
    const S = this.sheet;
    const sw = S.w / n;
    this.pin.visible = false;
    this.stage.remove(this.pin);
    // 1) 접기: 시트가 앞뒤에서 접혀 들어와 3겹 띠가 된다
    const foldD = Math.max(0.05, S.d / 3);
    const fold = new THREE.Mesh(new RoundedBoxGeometry(S.w, Math.max(0.006, S.t * 3.2), foldD, 3, 0.004), this.doughMat);
    fold.castShadow = fold.receiveShadow = true;
    fold.position.set(PB.x, YB + S.t * 1.6, PB.z);
    fold.scale.set(1, 0.3, S.d / foldD);
    fold.visible = false;
    this.stage.add(fold);
    this.tw.to(this.dough, { scale: V(1, 1, 0.34), dur: 0.45 });
    ctx.later(0.45, () => {
      self.dough.visible = false;
      fold.visible = true;
      self.tw.to(fold, { scale: V(1, 1, 1), dur: 0.25 });
      ctx.sound.plop();
    });
    // 2) 썰 자리: 면 폭 간격 중 일부를 칼질 가이드로 (나머지는 그 사이 가닥으로 함께 갈라진다)
    const cuts = width === 'thin' ? 7 : width === 'medium' ? 6 : 5;
    const lanes = Array.from({ length: cuts }, (_, i) => ({ x: PB.x - S.w / 2 + (S.w * (i + 1)) / (cuts + 1), done: false }));
    const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc95a').convertSRGBToLinear(), depthTest: false, transparent: true, opacity: 0.95 });
    for (const l of lanes) {
      l.line = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0022, foldD + 0.02), lineMat);
      l.line.position.set(l.x, YB + S.t * 3.4 + 0.002, PB.z);
      l.line.renderOrder = 31;
      this.stage.add(l.line);
    }
    const arrow = guideArrow();
    this.stage.add(arrow);
    // 일자 파스타 식도 (칼날은 z 방향으로 고정, 회전하지 않는다)
    const knife = new THREE.Group();
    knife.add(k.at(k.box(0.0018, 0.045, 0.2, k.metal('chrome')), 0, 0.0225, 0));
    knife.add(k.at(k.rbox(0.014, 0.024, 0.1, k.wood('walnut'), { r: 0.006 }), 0, 0.034, 0.15));
    knife.rotation.set(0, 0, 0);
    knife.position.set(PB.x + S.w / 2 + 0.05, YB + 0.07, PB.z);
    this.stage.add(knife);
    ctx.view(V(PB.x, YB + 0.02, PB.z), 0.42, 0.95);
    ctx.ui.step(`${step.label ?? '생면 제면'}`, '골드 선 위를 아래로 쓱');
    ctx.ui.actions([]);
    const scores = [];
    let down = null;
    let anim = null;
    let t = 0;
    const refresh = () => ctx.ui.meter(`<div class="wb-chips"><span>${lanes.filter((l) => l.done).length} / ${cuts} 칼질</span><span>면 ${n}가닥</span></div>`);
    refresh();
    const finish = () => {
      knife.visible = false;
      arrow.visible = false;
      self.stage.remove(fold);
      // 접힌 띠를 풀면 가닥가닥 생면 (기존 가닥 메쉬를 펼쳐 놓는다)
      self.strips = [];
      const geo = new THREE.BoxGeometry(sw * 0.94, S.t, S.d, 1, 1, 10);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, self.doughMat);
        m.castShadow = m.receiveShadow = true;
        const x = PB.x - S.w / 2 + sw * (i + 0.5) + (i - n / 2) * 0.0012;
        m.position.set(x, YB + S.t / 2, PB.z);
        m.scale.z = 0.34;
        self.stage.add(m);
        self.tw.to(m, { scale: V(1, 1, 1), dur: 0.4, delay: i * 0.01 });
        self.strips.push({ m, i, x, y0: YB + S.t / 2, cut: true, wob: 0.6 });
      }
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      ctx.ui.pop(`탄력 있는 생면 완성 · ${scoreWord(avg)}`, avg >= 70);
      ctx.later(0.5, () => ctx.done(avg, '제면 정확도'));
    };
    return {
      down(e, ndc) {
        if (!anim) down = ctx.ndcToPx(ndc);
      },
      move(e, ndc) {
        if (anim) return;
        const p = ctx.planeHit(ndc, YB + 0.05);
        if (p) knife.position.set(p.x, YB + 0.07, PB.z); // 칼은 좌우로만 따라온다 (각도 고정)
      },
      up(e, ndc) {
        if (anim || !down) return;
        const a = down;
        const b = ctx.ndcToPx(ndc);
        down = null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.hypot(dx, dy) < 30 || Math.abs(dy) < Math.abs(dx) * 0.45) return ctx.ui.pop('위에서 아래로 쓱 그어요', false);
        const tol = ctx.viewW() * 0.18;
        let lane = null;
        let off = Infinity;
        for (const l of lanes) {
          if (l.done) continue;
          const gp = ctx.toScreen(V(l.x, YB + S.t * 3, PB.z));
          const tt = clamp((gp.y - a.y) / dy, -0.25, 1.25);
          const o = Math.abs(a.x + dx * tt - gp.x);
          if (o < off) {
            off = o;
            lane = l;
          }
        }
        if (!lane || off > tol) return ctx.ui.pop('골드 선 근처를 그어요', false);
        scores.push(clamp(Math.round(100 - 15 * Math.pow(off / tol, 1.15)), 85, 100));
        lane.done = true;
        self.stage.remove(lane.line);
        anim = { t: 0, lane };
      },
      update(dt = 1 / 60) {
        t += dt;
        const next = lanes.find((l) => !l.done);
        arrow.visible = !!next && !anim;
        if (next) arrow.position.set(next.x, YB + 0.05 + Math.abs(Math.sin(t * 3)) * 0.01, PB.z - foldD / 2);
        if (!anim) return;
        anim.t += dt;
        const u = Math.min(1, anim.t / 0.3);
        // 수직 직선 이동: 위 → 도마 → 위 (회전 없음)
        const down2 = u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4;
        knife.position.set(anim.lane.x, YB + 0.07 - down2 * (0.07 - 0.001), PB.z);
        knife.rotation.set(0, 0, 0);
        if (!anim.hit && u >= 0.6) {
          anim.hit = true;
          ctx.sound.chop();
          self.puff(V(anim.lane.x, YB + S.t * 3, PB.z), '#fbf7ee', 4, 0.03);
          // 칼집: 접힌 띠에 얇은 홈
          const groove = new THREE.Mesh(new THREE.BoxGeometry(0.0012, S.t * 3.3, foldD + 0.002), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c49a3e').convertSRGBToLinear() }));
          groove.position.set(anim.lane.x, YB + S.t * 1.65, PB.z);
          groove.userData.noOutline = true;
          self.stage.add(groove);
          (self.grooves = self.grooves ?? []).push(groove);
          refresh();
        }
        if (u >= 1) {
          anim = null;
          if (lanes.every((l) => l.done)) {
            for (const gr of self.grooves ?? []) self.stage.remove(gr);
            finish();
          }
        }
      },
      destroy() {
        self.stage.remove(knife, arrow, fold);
        for (const l of lanes) self.stage.remove(l.line);
      },
    };
  }

  // 팬 속 면 더미 (가닥 수로 면 폭을 정한다) + 토핑
  buildPanNoodles() {
    const width = this.strips?.length >= 20 ? 'thin' : this.strips?.length >= 12 ? 'medium' : 'wide';
    this.width = width;
    const g = new THREE.Group();
    this.noodleMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(DOUGH).convertSRGBToLinear(), roughness: 0.45, clearcoat: 0.15, clearcoatRoughness: 0.2 });
    for (let o = 0; o < 16; o++) {
      const pts = [];
      const a0 = Math.random() * Math.PI * 2;
      for (let c = 0; c < 10; c++) {
        const a = a0 + c * 0.55 + Math.sin(c + o) * 0.3;
        const r = 0.02 + ((c * 0.37 + o * 0.13) % 1) * 0.07;
        pts.push(V(Math.cos(a) * r, 0.006 + Math.random() * 0.012, Math.sin(a) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = width === 'thin' ? new THREE.TubeGeometry(curve, 60, 0.0018, 5, false) : ribbonGeo(curve, width === 'medium' ? 0.007 : 0.014, 0.0012, 60);
      const m = new THREE.Mesh(geo, this.noodleMat);
      m.castShadow = true;
      m.userData.noOutline = true;
      g.add(m);
    }
    for (let o = 0; o < 7; o++) {
      const c = kit.cyl(0.006, 0.006, 0.0015, kit.mat('#f4ead2', { rough: 0.5 }));
      c.position.set((Math.random() - 0.5) * 0.15, 0.012, (Math.random() - 0.5) * 0.15);
      c.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(c);
    }
    if (this.kind === 'truffle')
      for (let o = 0; o < 6; o++) {
        const ms = mushroomSlice();
        ms.position.set((Math.random() - 0.5) * 0.14, 0.012, (Math.random() - 0.5) * 0.14);
        ms.rotation.set(0.3, Math.random() * 6, 0.2);
        g.add(ms);
      }
    if (this.kind === 'ragu')
      for (let o = 0; o < 8; o++) {
        const b = blob(0.008, '#7a2a14', { seed: o + 2, flat: 0.6, bumps: 0.3 });
        b.position.set((Math.random() - 0.5) * 0.14, 0.012, (Math.random() - 0.5) * 0.14);
        g.add(b);
      }
    return g;
  }

  // ───────── 3. 프라이팬 소테 & 만테까레 팬 토스 ─────────
  toss() {
    const ctx = this.ctx;
    const self = this;
    // 가닥들이 팬으로 '촤르르'
    this.noodles = this.buildPanNoodles();
    this.noodles.scale.setScalar(0.01);
    this.contents.add(this.noodles);
    for (const s of this.strips ?? []) {
      this.tw.to(s.m, { pos: this.pan.position.clone().add(V((Math.random() - 0.5) * 0.08, 0.05, (Math.random() - 0.5) * 0.08)), dur: 0.5, arc: 0.12, delay: Math.random() * 0.2, onDone: () => this.stage.remove(s.m) });
    }
    this.tw.to(this.noodles, { scale: V(1, 1, 1), dur: 0.4, delay: 0.5 });
    this.flames.forEach((f) => (f.visible = true));
    // 10차 만테까레 준비: 묽고 뿌연 면수 웅덩이에서 시작한다
    const watery = new THREE.Color('#e8e0cc').convertSRGBToLinear();
    const creamy = new THREE.Color(this.sauce.color).convertSRGBToLinear();
    const sm = this.sauceDisc.material;
    sm.color.copy(watery);
    sm.opacity = 0.0;
    sm.roughness = 0.04;
    sm.clearcoat = 1;
    this.sauceDisc.scale.setScalar(1.15);
    const ladle = kit.group(kit.at(kit.sphere(0.03, kit.metal('steel'), { t0: Math.PI / 2, tl: Math.PI / 2 }), 0, 0.03, 0), kit.at(kit.cyl(0.004, 0.004, 0.24, kit.metal('steel')), 0.08, 0.12, 0, 0, 0, -0.9));
    const panTop = this.pan.position.clone().add(V(-0.02, 0.16, 0));
    ladle.position.copy(panTop).add(V(0.25, 0.1, 0.05));
    this.stage.add(ladle);
    const stream = kit.cyl(0.004, 0.003, 1, kit.mat('#efe8d6', { opacity: 0.7, rough: 0.05 }), { seg: 8 });
    stream.visible = false;
    this.stage.add(stream);
    const butter = [];
    let intro = 0; // 0~1.9초: 면수 → 버터 → 오일
    const pourTo = (h) => {
      stream.visible = h > 0;
      stream.scale.set(1, Math.max(0.001, h), 1);
      stream.position.copy(panTop).add(V(0, -h / 2 + 0.01, 0));
    };
    ctx.sound.sizzleStart();
    ctx.view(V(BURNER.x - 0.02, Y0 + 0.06, BURNER.z + 0.04), 0.46, 0.7);
    ctx.ui.step(`${this.sauce.name} 만테까레`, '면수와 버터를 넣어요');
    let tosses = 0;
    let ready = false;
    let last = null;
    let vz = 0;
    let push = 0;
    let fly = null;
    let stirA = null;
    let stirAcc = 0;
    let done = false;
    let bubbleT = 0;
    const base = new THREE.Color(DOUGH).convertSRGBToLinear();
    const coat = new THREE.Color(this.sauce.coat).convertSRGBToLinear();
    const refresh = () => {
      const e = Math.min(1, tosses / 6);
      const state = !ready ? '면수 · 버터 넣는 중' : e < 0.35 ? '묽어요' : e < 0.8 ? '뽀얗게 유화 중' : '크리미한 에멀전';
      ctx.ui.meter(`<div class="wb-cover"><div class="bar"><i class="${e >= 1 ? 'good' : ''}" style="width:${Math.round(e * 100)}%"></i></div><span>만테까레 ${Math.round(e * 100)}% · ${state}</span></div>`);
      self.noodleMat.color.copy(base).lerp(coat, e * 0.85);
      self.noodleMat.clearcoat = 0.15 + e * 0.8;
      self.noodleMat.roughness = 0.45 - e * 0.25;
      if (!ready) return;
      // 소스: 묽고 투명한 면수 → 뽀얗고 걸쭉하며 윤기 나는 에멀전 (색 · 불투명도 · 광택 · 면적이 함께 변한다)
      sm.color.copy(watery).lerp(creamy, e);
      sm.opacity = 0.55 + e * 0.43;
      sm.roughness = 0.04 + e * 0.22;
      sm.clearcoat = 1 - e * 0.2;
      self.sauceDisc.scale.setScalar(1.15 - e * 0.35);
      self.sauceDisc.position.y = 0.001 + e * 0.003;
      for (const b of butter) b.scale.setScalar(Math.max(0.01, 1 - e * 1.6));
    };
    const finish = () => {
      if (done) return;
      done = true;
      ctx.sound.sizzleStop();
      self.flames.forEach((f) => (f.visible = false));
      const score = tosses >= 6 ? 100 : Math.round(40 + (tosses / 6) * 55);
      ctx.ui.pop(`윤기 나게 코팅됐어요 · ${scoreWord(score)}`, score >= 70);
      ctx.ui.actions([]);
      ctx.done(score, `팬 토스 ${Math.floor(tosses)}번`);
    };
    const addToss = (amt, big) => {
      tosses += amt;
      if (big) {
        fly = { t: 0, vy: 0.55 };
        const e0 = Math.min(1, tosses / 6);
        for (let i = 0; i < 14 - e0 * 8; i++) {
          const b = kit.sphere(0.003 + Math.random() * 0.004 * (1 - e0), kit.mat('#fffaf0', { rough: 0.05, clearcoat: 1, opacity: 0.75 }), { ws: 8, hs: 6 });
          const a = Math.random() * Math.PI * 2;
          const d = 0.03 + Math.random() * 0.06;
          b.position.set(Math.cos(a) * d, 0.006, Math.sin(a) * d);
          self.contents.add(b);
          self.parts.push({ m: b, life: 0.9, max: 0.9, grow: 1.2 });
        }
        ctx.sound.sizzleLevel(1.4);
        ctx.sound.toss();
      }
      refresh();
      if (tosses >= 6) {
        ctx.ui.actions([{ label: '불 끄고 완성', icon: 'check', primary: true, onClick: finish }]);
        ctx.later(1.4, finish);
      }
    };
    refresh();
    ctx.ui.actions([{ label: '완료', icon: 'check', onClick: finish }]);
    return {
      down(e, ndc) {
        last = ready ? ctx.planeHit(ndc, Y0 + 0.05) : null;
        stirA = null;
      },
      move(e, ndc) {
        if (!last || done || !ready) return;
        const p = ctx.planeHit(ndc, Y0 + 0.05);
        if (!p) return;
        const dz = p.z - last.z;
        const dx = p.x - last.x;
        const nv = dz / (1 / 60);
        // 앞으로 밀었다가(-z) 휙 당기면(+z) 토스
        if (vz < -0.25 && nv > 0.35 && push < -0.015) {
          addToss(1, true);
          push = 0;
        }
        vz = vz * 0.5 + nv * 0.5;
        push = clamp(push + dz, -0.06, 0.03);
        // 원을 그리며 젓기 (팬 중심 기준 각도 누적)
        const c = self.pan.position;
        if (Math.hypot(p.x - c.x, p.z - c.z) < 0.14) {
          const a = Math.atan2(p.z - c.z, p.x - c.x);
          if (stirA !== null) {
            let d = a - stirA;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            stirAcc += Math.abs(d);
            self.noodles.rotation.y += d * 0.6;
            if (stirAcc > Math.PI * 2) {
              stirAcc = 0;
              addToss(0.5, false);
              ctx.sound.bubble();
            }
          }
          stirA = a;
        }
        void dx;
        last = p;
      },
      up() {
        last = null;
        stirA = null;
      },
      update(dt = 1 / 60) {
        // 만테까레 도입: 면수 한 국자 → 차가운 버터 조각 → 올리브오일 한 바퀴
        if (!ready) {
          intro += dt;
          if (intro < 0.7) {
            ladle.position.lerp(panTop.clone().add(V(0.02, 0.02, 0)), Math.min(1, dt * 8));
            ladle.rotation.z = Math.min(1.6, intro * 3);
            pourTo(intro > 0.25 ? 0.12 : 0);
            sm.opacity = Math.min(0.55, intro);
            if (Math.random() < 0.3) ctx.sound.bubble();
          } else if (intro < 1.2) {
            pourTo(0);
            ladle.position.add(V(0.3 * dt, 0.2 * dt, 0));
            if (!butter.length) {
              for (let i = 0; i < 3; i++) {
                const b = kit.rbox(0.016, 0.012, 0.016, kit.mat('#f6e7a8', { rough: 0.4, clearcoat: 0.4 }), { r: 0.003 });
                b.position.set((i - 1) * 0.03, 0.12, (i % 2) * 0.02);
                self.contents.add(b);
                self.tw.to(b, { pos: V((i - 1) * 0.03, 0.008, (i % 2) * 0.02), dur: 0.3, delay: i * 0.08 });
                butter.push(b);
              }
              ctx.sound.plop();
            }
          } else if (intro < 1.8) {
            // 올리브오일 한 바퀴 (금빛 줄기)
            stream.material.color.set('#c8b13a');
            const a = (intro - 1.2) * 10;
            stream.visible = true;
            stream.scale.set(0.6, 0.12, 0.6);
            stream.position.copy(self.pan.position).add(V(Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05));
          } else {
            stream.visible = false;
            self.stage.remove(ladle, stream);
            ready = true;
            ctx.ui.step(`${self.sauce.name} 만테까레`, '팬을 앞뒤로 휙 토스');
            refresh();
          }
        }
        // 팬 앞뒤 들썩임
        const target = self.panHome.z + push;
        self.pan.position.z += (target - self.pan.position.z) * Math.min(1, dt * 18);
        self.pan.rotation.x = clamp(-push * 3, -0.16, 0.1); // 화구와 절대 교차하지 않는 범위
        push *= Math.exp(-dt * 2.5);
        ctx.sound.sizzleLevel(0.3 + Math.min(1, Math.abs(vz) * 0.6));
        // 공중으로 뒤집히는 면
        if (fly) {
          fly.t += dt;
          const y = fly.vy * fly.t - 4.4 * fly.t * fly.t;
          self.noodles.position.y = Math.max(0, y); // 바닥 윗면 +1.5cm(contents 원점) 아래로는 안 내려간다
          // 파도치듯: 앞으로 말려 뒤집히며 옆으로도 출렁
          self.noodles.rotation.x = Math.sin(Math.min(1, fly.t / 0.25) * Math.PI) * 0.9;
          self.noodles.rotation.z = Math.sin(fly.t * 18) * 0.12;
          if (y < 0 && fly.t > 0.05) {
            fly = null;
            self.noodles.position.y = 0;
            self.noodles.rotation.x = 0;
            self.puff(self.pan.position.clone().setY(Y0 + 0.07), self.sauce.color, 6, 0.08);
          }
        }
        // 보글보글 기포 + 김
        bubbleT -= dt;
        if (bubbleT <= 0 && !done) {
          bubbleT = 0.08;
          const b = kit.sphere(0.004, kit.mat(self.sauce.color, { rough: 0.1, clearcoat: 1 }), { ws: 8, hs: 6 });
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * 0.08;
          b.position.set(Math.cos(a) * d, 0.003, Math.sin(a) * d);
          self.contents.add(b);
          self.parts.push({ m: b, life: 0.5, max: 0.5, grow: 1 });
          if (Math.random() < 0.25) ctx.sound.bubble();
          if (Math.random() < 0.3) {
            const s = kit.sphere(0.012, kit.mat('#ffffff', { opacity: 0.12, rough: 1 }), { ws: 8, hs: 6 });
            s.position.copy(self.pan.position).add(V((Math.random() - 0.5) * 0.1, 0.06, (Math.random() - 0.5) * 0.1));
            self.stage.add(s);
            self.parts.push({ m: s, v: V(0, 0.25, 0), life: 1, max: 1, grow: 2.2 });
          }
        }
      },
      destroy() {
        ctx.sound.sizzleStop();
        self.flames.forEach((f) => (f.visible = false));
        self.stage.remove(ladle, stream);
      },
    };
  }

  // ───────── 4. 트위저로 돌돌 말아 올리기 ─────────
  twirl() {
    const ctx = this.ctx;
    const self = this;
    const width = this.width ?? 'thin';
    const nest = pastaNest({ width, color: this.sauce.coat, gloss: 0.9, seed: 5, r0: 0.068, h: 0.06 });
    const baseY = Y0 + this.bowl.userData.top;
    nest.position.copy(BOWL).setY(baseY);
    this.stage.add(nest);
    this.nest = nest;
    const geos = [];
    let noodleMat = null;
    nest.traverse((o) => {
      if (!o.isMesh) return;
      geos.push(o.geometry);
      noodleMat = noodleMat ?? o.material;
    });
    const setGrow = (g) => {
      for (const geo of geos) {
        const n = geo.index.count;
        geo.setDrawRange(0, Math.floor((n * g) / 3) * 3);
      }
    };
    setGrow(0);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.06, 36), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.sauce.color).convertSRGBToLinear(), roughness: 0.2, clearcoat: 0.9 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.copy(BOWL).setY(baseY + 0.001);
    pool.scale.setScalar(0.01);
    this.stage.add(pool);
    // 9차 셰프 플레이팅 핀셋: 길고 날렵한 두 다리를 거의 수직으로 세워 끝으로 면 다발을 집고, 수직축으로 돌려 말아 올린다
    const tw = platingTweezers();
    tw.position.copy(BOWL).setY(baseY + 0.14);
    this.stage.add(tw);
    tw.userData.setGap(0.014);
    this.tw.to(tw, { pos: V(BOWL.x, baseY + 0.006, BOWL.z), dur: 0.45 });
    // 집게 끝에 감겨 올라가는 면 코일 (나선 튜브, 돌릴수록 길어진다)
    const tube = width === 'wide' ? 0.0036 : width === 'medium' ? 0.0026 : 0.0018;
    const helixPts = [];
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      const a = u * Math.PI * 2 * 6;
      const r = 0.009 + u * 0.012 + Math.sin(u * 37) * 0.0015;
      helixPts.push(V(Math.cos(a) * r, 0.004 + u * 0.05, Math.sin(a) * r));
    }
    const coilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 480, tube, 6, false);
    const coil = new THREE.Mesh(coilGeo, noodleMat ?? kit.mat('#f0d48a', { rough: 0.35 }));
    coil.userData.noOutline = true;
    coilGeo.setDrawRange(0, 0);
    tw.userData.spin.add(coil);
    // 팬의 면을 접시 위에 넓게 쏟아 두고 (퍼진 면 다발), 핀셋으로 돌리면 이 다발이 함께 돌며 가운데로 모인다
    const bundle = this.noodles;
    if (bundle) {
      this.stage.attach(bundle);
      bundle.position.copy(BOWL).setY(baseY + 0.002);
      bundle.rotation.set(0, 0, 0);
      bundle.scale.set(1.15, 0.45, 1.15);
    }
    let spinT = 0;
    ctx.view(V(BOWL.x + 0.03, Y0 + 0.12, BOWL.z), 0.5, 0.55);
    ctx.ui.step('핀셋으로 돌돌 말아 올리기', '빙글빙글 원을 4바퀴');
    let angle = null;
    let acc = 0;
    let rev = 0;
    let lastD = 0;
    let done = false;
    let pinched = false;
    const refresh = () => ctx.ui.meter(`<div class="wb-chips"><span>${(acc / (Math.PI * 2)).toFixed(1)} / 4 바퀴</span><span>${pinched ? '면 다발을 집었어요' : '면을 집어요'}</span></div>`);
    refresh();
    ctx.ui.actions([]);
    const finish = () => {
      done = true;
      setGrow(1);
      // 말아 올린 타워를 볼 가운데 내려놓고, 핀셋을 벌려 위로 빼낸다
      self.tw.to(nest, { pos: V(BOWL.x, baseY, BOWL.z), dur: 0.35 });
      self.tw.to(tw, { pos: V(BOWL.x, baseY + 0.006, BOWL.z), dur: 0.35 });
      ctx.later(0.4, () => {
        tw.userData.setGap(0.016);
        coil.visible = false;
        ctx.sound.plop();
        self.tw.to(tw, { pos: V(BOWL.x + 0.06, baseY + 0.2, BOWL.z + 0.08), dur: 0.5 });
      });
      ctx.later(0.95, () => self.stage.remove(tw));
      if (bundle) self.tw.to(bundle, { scale: V(0.01, 0.01, 0.01), dur: 0.3 });
      self.tw.to(pool, { scale: V(1, 1, 1), dur: 0.4 });
      const score = clamp(100 - rev * 6, 60, 100);
      ctx.ui.pop(`봉긋한 생면 타워 · ${scoreWord(score)}`, score >= 70);
      ctx.later(0.6, () => ctx.done(score, '핀셋 플레이팅'));
    };
    return {
      down(e, ndc) {
        const p = ctx.planeHit(ndc, Y0 + 0.06);
        angle = p ? Math.atan2(p.z - BOWL.z, p.x - BOWL.x) : null;
        if (!pinched && !done) {
          // 첫 터치: 다리를 오므려 면 다발을 집는다
          pinched = true;
          tw.userData.setGap(0.0045);
          ctx.sound.tap();
          refresh();
        }
      },
      move(e, ndc) {
        if (done) return;
        const p = ctx.planeHit(ndc, Y0 + 0.06);
        if (!p || angle === null) return;
        const a = Math.atan2(p.z - BOWL.z, p.x - BOWL.x);
        let d = a - angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        angle = a;
        if (Math.abs(d) < 0.001) return;
        if (lastD && Math.sign(d) !== Math.sign(lastD) && Math.abs(d) > 0.05) rev++;
        lastD = d;
        acc += Math.abs(d);
        const g = Math.min(1, acc / (Math.PI * 8));
        setGrow(g);
        // 핀셋과 면이 함께 수직축으로 돌며 실린더로 감긴다
        tw.userData.spin.rotation.y -= d * 1.8;
        nest.rotation.y -= d * 1.8;
        const n = coilGeo.index.count;
        coilGeo.setDrawRange(0, Math.floor((n * Math.min(1, g * 1.15)) / 3) * 3);
        // 감길수록 핀셋이 조금씩 들리고, 면 타워가 위로 길쭉해진다
        const lift = Math.sin(Math.min(1, g) * Math.PI) * 0.025;
        tw.position.y = baseY + 0.006 + lift;
        nest.position.y = baseY + lift * 0.6;
        // 높은 원뿔형 둥지: 위로 길어지고 아래 폭은 조금 좁아진다
        nest.scale.set(1 - g * 0.18, 0.8 + g * 0.75, 1 - g * 0.18);
        if (bundle) {
          const k2 = Math.max(0.02, 1 - g);
          bundle.scale.set(1.15 * k2, 0.45 + 0.3 * g, 1.15 * k2);
        }
        spinT = 0.25;
        if (Math.random() < 0.2) ctx.sound.spreadMove?.(0.3);
        refresh();
        if (g >= 1) finish();
      },
      up() {
        angle = null;
      },
      update(dt = 1 / 60) {
        // 돌리는 동안 면 다발 자체가 핀셋 축을 중심으로 빙글빙글
        if (spinT > 0 && !done) {
          spinT -= dt;
          if (bundle) bundle.rotation.y += dt * 8;
          nest.rotation.y += dt * 8;
          tw.userData.spin.rotation.y += dt * 8;
        }
      },
      destroy() {
        if (tw.parent) self.stage.remove(tw);
        if (bundle && done) self.stage.remove(bundle);
      },
    };
  }

  // ───────── 5. 파르미지아노 눈꽃 갈기 ─────────
  grate() {
    const ctx = this.ctx;
    const self = this;
    const top = Y0 + this.bowl.userData.top + (this.nest?.userData.h ?? 0.05);
    // 강판은 볼 위에 비스듬히 걸쳐 두고, 치즈 웨지를 강판 구멍 위로 옮겨 쥔다
    this.grater.visible = true;
    this.grater.position.set(BOWL.x, top + 0.075, BOWL.z - 0.035);
    this.grater.rotation.set(0.75, 0, 0); // 타공 면이 카메라를 향하게
    const surf = this.grater.userData.surface;
    surf.attach(this.cheese);
    this.cheese.position.set(0, 0.001, 0);
    this.cheese.rotation.set(0, 0, 0);
    this.cheese.scale.setScalar(0.8);
    ctx.view(V(BOWL.x, top + 0.03, BOWL.z), 0.4, 0.62);
    ctx.ui.step('파르미지아노 눈꽃', '좌우로 쓱싹 8번');
    let lastX = null;
    let dir = 0;
    let strokes = 0;
    let turnX = 0;
    let done = false;
    const snow = [];
    const refresh = () => ctx.ui.meter(`<div class="wb-chips"><span>${strokes} / 8 번</span></div>`);
    refresh();
    ctx.ui.actions([{ label: '완료', icon: 'check', onClick: () => finish() }]);
    const flakes = (x) => {
      for (let i = 0; i < 14; i++) {
        const m = kit.box(0.0026, 0.0005, 0.0018, kit.mat('#fbf3da', { rough: 0.6 }));
        m.castShadow = false;
        m.position.set(x + (Math.random() - 0.5) * 0.03, top + 0.045, BOWL.z + (Math.random() - 0.5) * 0.03);
        m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        self.stage.add(m);
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 0.035;
        const floor = top - 0.004 - (d / 0.035) * 0.02;
        self.parts.push({ m, v: V(Math.cos(a) * d * 2, 0.05, Math.sin(a) * d * 2), floor, stay: true, life: 99 });
        snow.push(m);
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      self.grater.visible = false;
      self.cheese.visible = false;
      // 마지막 바질 한 잎
      const b = basilLeaf(1.1);
      b.position.set(BOWL.x, top + 0.006, BOWL.z);
      b.rotation.set(-0.3, 0.7, 0);
      self.stage.add(b);
      const score = strokes >= 8 ? 100 : Math.round(40 + (strokes / 8) * 55);
      ctx.ui.pop(`소복한 눈꽃 · ${scoreWord(score)}`, score >= 70);
      ctx.ui.actions([]);
      ctx.done(score, `치즈 ${strokes}번`);
    };
    return {
      down(e, ndc) {
        const p = ctx.planeHit(ndc, top + 0.08);
        lastX = p ? p.x : null;
      },
      move(e, ndc) {
        if (done) return;
        const p = ctx.planeHit(ndc, top + 0.08);
        if (!p) return;
        // 치즈가 강판 구멍 표면을 따라 좌우로 미끄러진다 (강판은 제자리)
        self.cheese.position.x = clamp(p.x - BOWL.x, -0.085, 0.085);
        self.cheese.position.y = 0.001 + Math.abs(Math.sin(p.x * 120)) * 0.0008;
        if (lastX === null) return;
        const dx = p.x - lastX;
        const d = Math.sign(dx);
        if (Math.abs(dx) > 0.001 && d !== dir) {
          if (dir && Math.abs(p.x - turnX) > 0.025) {
            strokes++;
            ctx.sound.grate();
            flakes(BOWL.x + self.cheese.position.x * 0.6);
            self.cheese.scale.y = Math.max(0.45, self.cheese.scale.y - 0.035);
            refresh();
            if (strokes >= 8) ctx.later(0.8, finish);
          }
          dir = d;
          turnX = p.x;
        }
        lastX = p.x;
      },
      up() {
        lastX = null;
      },
      update() {},
      destroy() {
        self.grater.visible = false;
      },
    };
  }

  // 완성: 메뉴 전용 완성품(생면 타워 + 소스 + 눈꽃 치즈 + 바질)을 볼 자리에 '퐁'
  showcase() {
    const hero = buildBistroDish(this.ctx.order.recipe.id);
    if (hero) {
      for (const o of [...this.stage.children]) if (o !== this.bowl && o.position.distanceTo(BOWL) < 0.2 && o.position.y > Y0 - 0.01 && o.position.y < Y0 + 0.2) o.visible = false;
      this.bowl.visible = false;
      if (this.nest) this.nest.visible = false;
      hero.position.copy(BOWL);
      hero.rotation.y = -0.3;
      hero.scale.setScalar(0.6);
      this.stage.add(hero);
      this.hero = hero;
      this.heroT = 0;
      this.ctx.sound.plate?.();
    }
    this.ctx.view(V(BOWL.x, Y0 + 0.05, BOWL.z), 0.4, 0.62);
  }

  takeDish() {
    const d = this.hero ?? this.bowl;
    this.stage.remove(d);
    d.position.set(0, 0, 0);
    d.scale.setScalar(1);
    d.visible = true;
    return d;
  }

  destroy() {
    this.ctx.sound.sizzleStop?.();
  }
}

export { parmesanSnow };

// ───────── 실사 도구 ─────────
// 파르미지아노 레지아노 웨지: 삼각기둥 단면(작은 결정 알갱이) + 황금빛 껍질
function cheeseWedge() {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-0.045, 0);
  sh.lineTo(0.045, 0);
  sh.lineTo(0.03, 0.042);
  sh.lineTo(-0.03, 0.042);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
  geo.translate(0, 0, -0.035);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f0d98e';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = Math.random() < 0.6 ? 'rgba(255,250,225,0.8)' : 'rgba(200,160,70,0.35)';
    x.beginPath();
    x.arc(Math.random() * 128, Math.random() * 128, 0.6 + Math.random() * 1.6, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, bumpMap: tex, bumpScale: 0.002 });
  const rindMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c08a3a').convertSRGBToLinear(), roughness: 0.6 });
  g.add(new THREE.Mesh(geo, [face, face]));
  // 껍질 (윗면 쪽 두툼한 황금빛 띠 + 'PARMIGIANO' 점각 느낌)
  g.add(kit.at(kit.box(0.062, 0.006, 0.074, rindMat), 0, 0.045, 0));
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

let holeTex = null;
// 촘촘한 타공 스테인리스 핸드 그레이터 (구멍 = 알파 텍스처 + 돌기) + 원목 손잡이
function handGrater() {
  if (!holeTex) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 64, 256);
    x.fillStyle = '#000';
    for (let r = 0; r < 32; r++)
      for (let k = 0; k < 6; k++) {
        x.beginPath();
        x.ellipse(6 + k * 10.5 + (r % 2) * 5, 4 + r * 8, 2.6, 1.6, 0, 0, Math.PI * 2);
        x.fill();
      }
    holeTex = new THREE.CanvasTexture(c);
  }
  const g = new THREE.Group();
  const L = 0.3;
  const W = 0.07;
  const plateMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d9dde0').convertSRGBToLinear(), metalness: 0.85, roughness: 0.28, alphaMap: holeTex, alphaTest: 0.5, bumpMap: holeTex, bumpScale: 0.004, side: THREE.DoubleSide });
  plateMat.envMapIntensity = 1.2;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(W, L * 0.75), plateMat);
  plate.rotation.set(-Math.PI / 2, 0, Math.PI / 2); // 길이 방향 = x
  g.add(plate);
  const steel = kit.metal('steel');
  for (const s of [-1, 1]) g.add(kit.at(kit.box(L * 0.75, 0.006, 0.006, steel), 0, 0.001, s * (W / 2 + 0.002)));
  for (const s of [-1, 1]) g.add(kit.at(kit.box(0.006, 0.006, W + 0.01, steel), s * (L * 0.375), 0.001, 0));
  // 원목 손잡이
  g.add(kit.at(kit.rbox(0.09, 0.02, 0.03, kit.wood('walnut'), { r: 0.008 }), L * 0.375 + 0.05, 0.004, 0));
  // 치즈가 미끄러지는 면 (강판 윗면 기준 로컬 좌표)
  const surface = new THREE.Group();
  surface.position.y = 0.002;
  g.add(surface);
  g.userData.surface = surface;
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

// 길이 30cm · 폭 넓은 무광 황동 플레이팅 트위저 (끝이 볼 가운데를 향해 45도)
function platingTweezers() {
  // 9차: 30cm 무광 황동 셰프 핀셋. 원점 = 두 집게 끝 가운데, 다리는 위(+y)로 뻗어 끝에서 하나로 붙는다.
  // tilt(카메라 쪽으로 살짝 눕힘) → spin(수직축 회전) → 다리 두 개(벌림 정도 setGap)
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b8924f').convertSRGBToLinear(), metalness: 0.65, roughness: 0.5 });
  const tilt = new THREE.Group();
  tilt.rotation.set(0.22, 0, -0.2);
  const spin = new THREE.Group();
  tilt.add(spin);
  g.add(tilt);
  const L = 0.3;
  // 위로 갈수록 넓어졌다가 손잡이에서 다시 좁아지는 날렵한 다리 (가늘고 긴 판)
  const legGeo = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.0016, 0);
    shape.lineTo(0.0016, 0);
    shape.lineTo(0.0055, L * 0.3);
    shape.lineTo(0.0062, L * 0.8);
    shape.lineTo(0.0045, L);
    shape.lineTo(-0.0045, L);
    shape.lineTo(-0.0062, L * 0.8);
    shape.lineTo(-0.0055, L * 0.3);
    shape.lineTo(-0.0016, 0);
    const e = new THREE.ExtrudeGeometry(shape, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 1, steps: 1, curveSegments: 4 });
    e.translate(0, 0, -0.0009);
    e.rotateY(Math.PI / 2); // 판의 넓은 면이 서로 마주 보게 (두께 방향 = x)
    return e;
  })();
  // 다리를 가운데가 바깥으로 휜 활 모양으로 (끝은 모이고 가운데는 벌어져 두 갈래가 또렷이 보인다)
  const bowed = (side) => {
    const e = legGeo.clone().toNonIndexed();
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / L;
      p.setX(i, p.getX(i) + side * 0.0085 * Math.sin(Math.PI * Math.min(1, y * 1.15)) * (1 - y * 0.35));
    }
    e.computeVertexNormals();
    return e;
  };
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); // 손잡이 끝(위)을 축으로 벌어진다
    pivot.position.y = L;
    const leg = new THREE.Mesh(bowed(s), brass);
    leg.position.y = -L;
    pivot.add(leg);
    // 끝의 톱니(미끄럼 방지 홈)
    for (let i = 0; i < 4; i++) {
      const ridge = kit.box(0.0012, 0.0006, 0.0028, brass);
      ridge.position.set(-s * 0.0012, -L + 0.003 + i * 0.0022, 0);
      pivot.add(ridge);
    }
    spin.add(pivot);
    return { pivot, s };
  });
  // 손잡이 끝 이음새
  spin.add(kit.at(kit.rbox(0.006, 0.012, 0.009, brass, { r: 0.002 }), 0, L + 0.004, 0));
  g.userData.spin = spin;
  g.userData.setGap = (gap) => {
    for (const { pivot, s } of legs) pivot.rotation.z = -s * Math.atan2(gap / 2, L);
  };
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}
