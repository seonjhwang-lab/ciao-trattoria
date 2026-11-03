import * as THREE from 'three';
import { kit } from '../core/Kit.js';
import { BoardBench } from './BoardBench.js';
import { layFlat, buildPrepped } from './Ingredient3D.js';
import { clamp, scoreWord, zoneScore } from './tween.js';
import { buildBistroDish } from '../core/BistroDish.js';
import { basilLeaf, arugula } from '../core/HeroDish.js';
import { buildForno, updateForno } from '../core/Forno.js';

// 화덕 피자 워크벤치: 도우 스트레칭 → 국자 소스 스월링 → 모짜렐라·토마토 썰기(쓰러지는 단면) → 토핑 올리기 → 화덕 굽기 (→ 가니쉬)
const Y0 = 0.9;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D = V(0.04, Y0 + 0.012, 0.2); // 원목 반죽판 위 도우 자리
const OVEN = V(0.2, Y0, -0.36); // 나폴리 장작 화덕 (테이블 뒤 석재 받침 위, 입구는 +z)
const SECT = 16;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const PREP_N = { basil: 5, prosciutto: 5, arugula: 7 };
// 10차 토핑 층: 1층 도우·소스 / 2층 치즈 / 3층 육류·토마토 / 4층 허브
const LAYER = { mozzarella: 2, tomato: 3, cherry_tomato: 3, prosciutto: 3, bacon: 3, ham: 3, basil: 4, arugula: 4 };
function layerize(o, layer) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.renderOrder = layer;
    const one = (x) => {
      const c = x.clone();
      c.polygonOffset = layer >= 3;
      c.polygonOffsetFactor = layer >= 4 ? -4 : layer >= 3 ? -2 : 0;
      c.polygonOffsetUnits = c.polygonOffsetFactor;
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
}

// 도우: 방향별 반지름(16개)을 부드럽게 이은 원판 + 가운데는 얇고 가장자리(코르니초네)는 도톰하게
// 9차: 중심은 정점 하나로 완전히 닫는다 (반지름 0 링에 정점 49개가 겹쳐 외곽선이 갈라지며 '검은 구멍'이 보였다)
function doughGeometry(radii, tc, rim, ball) {
  const R = 12;
  const S = 48;
  const pos = [];
  const idx = [];
  const rad = (a) => {
    const f = ((a / (Math.PI * 2)) * SECT + SECT) % SECT;
    const i = Math.floor(f);
    const t = f - i;
    const w = (1 - Math.cos(t * Math.PI)) / 2;
    return radii[i] * (1 - w) + radii[(i + 1) % SECT] * w;
  };
  const height = (u) => {
    const flat = u < 0.8 ? tc : tc + rim * Math.sin(Math.min(1, (u - 0.8) / 0.16) * Math.PI * 0.5);
    const edge = u > 0.96 ? (1 - u) / 0.04 : 1;
    const dome = (tc + rim) * 1.6 * Math.sqrt(Math.max(0, 1 - u * u));
    return flat * edge * (1 - ball) + dome * ball;
  };
  pos.push(0, height(0), 0); // 0 = 중심
  for (let j = 1; j <= R; j++) {
    const u = j / R;
    for (let i = 0; i <= S; i++) {
      const a = (i / S) * Math.PI * 2;
      const r = u * rad(a);
      pos.push(Math.cos(a) * r, height(u), Math.sin(a) * r);
    }
  }
  const ring = (j, i) => 1 + (j - 1) * (S + 1) + i;
  for (let i = 0; i < S; i++) idx.push(0, ring(1, i + 1), ring(1, i));
  for (let j = 1; j < R; j++)
    for (let i = 0; i < S; i++) {
      const a = ring(j, i);
      const b = ring(j + 1, i);
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = [];
  for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 0.4 + 0.5, pos[k + 2] / 0.4 + 0.5);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 9차 금속 피자 필: 얇은 알루미늄 원형 날(타공) + 긴 원목 손잡이. 원점 = 날 중심, 손잡이는 +z
function metalPeel() {
  const k = kit;
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: lin('#c9ccd0'), metalness: 0.85, roughness: 0.32 });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.158, 0.003, 48), alu);
  blade.position.y = 0.0015;
  g.add(blade);
  // 타공 구멍 (덧가루가 빠지는 구멍)
  const holeMat = new THREE.MeshBasicMaterial({ color: lin('#5c5f63') });
  for (let r = 0.03; r < 0.14; r += 0.028)
    for (let a = 0; a < Math.PI * 2; a += 0.034 / r) {
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 8), holeMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(Math.cos(a) * r, 0.0032, Math.sin(a) * r);
      h.userData.noOutline = true;
      g.add(h);
    }
  // 목 부분 + 손잡이
  g.add(k.at(k.box(0.05, 0.006, 0.07, alu), 0, 0.004, 0.18));
  g.add(k.at(k.cyl(0.013, 0.013, 0.42, k.wood('walnut'), { seg: 14 }), 0, 0.012, 0.42, Math.PI / 2, 0, 0));
  g.add(k.at(k.cyl(0.016, 0.016, 0.02, k.metal('steel'), { seg: 14 }), 0, 0.012, 0.215, Math.PI / 2, 0, 0));
  return g;
}

// 9차 원형 피자 휠 커터: 스테인리스 원판 날 + 포크 + 손잡이. 원점 = 날 바닥(피자에 닿는 점), 손잡이는 +x
function pizzaWheel() {
  const k = kit;
  const g = new THREE.Group();
  const steel = k.metal('chrome');
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.002, 40), steel);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 0.042;
  g.add(disc);
  g.userData.disc = disc;
  g.add(k.at(k.cyl(0.008, 0.008, 0.012, steel, { seg: 16 }), 0, 0.042, 0, Math.PI / 2, 0, 0));
  for (const s of [-1, 1]) g.add(k.at(k.box(0.06, 0.008, 0.003, k.metal('steel')), 0.03, 0.05, s * 0.007, 0, 0, 0.35));
  g.add(k.at(k.cyl(0.011, 0.013, 0.12, k.mat('#2b1d14', { rough: 0.5 }), { seg: 14 }), 0.11, 0.075, 0, 0, 0, Math.PI / 2 + 0.35));
  return g;
}

function speckle(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.7 ? 'rgba(255,252,240,0.5)' : 'rgba(190,140,70,0.2)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

export class PizzaBench extends BoardBench {
  static BOARD = { x: -0.27, z: 0.13, w: 0.36, d: 0.28, t: 0.03 };
  static STAGING = [
    [-0.4, -0.25],
    [-0.27, -0.27],
    [-0.14, -0.26],
  ];

  build() {
    const k = kit;
    const g = this.stage;
    this.buildTable();
    this.buildBoard();
    this.prepped = {};
    this.placed = [];
    // 흰 마블 작업대 + 덧가루
    g.add(k.at(k.rbox(0.36, 0.012, 0.4, k.wood('oak'), { r: 0.005 }), D.x, Y0 + 0.006, D.z));
    for (let i = 0; i < 45; i++) g.add(k.at(k.box(0.0028, 0.0006, 0.0028, k.mat('#fbf7ee', { rough: 1 })), D.x + (Math.random() - 0.5) * 0.32, Y0 + 0.0125, D.z + (Math.random() - 0.5) * 0.36));
    // 나폴리 장작 화덕: 헤링본 테라코타 벽돌 돔 + 구리 연통 + 아치형 석재 입구, 안쪽 왼편엔 장작불 · 숯불 · 불티
    g.add(k.at(k.rbox(0.72, Y0, 0.72, k.mat('#8f8679', { rough: 0.9 }), { r: 0.02 }), OVEN.x, Y0 / 2, OVEN.z - 0.04));
    this.oven = buildForno({ R: 0.3, mouthW: 0.34, mouthH: 0.2, detail: 'bench' });
    this.oven.position.copy(OVEN);
    g.add(this.oven);
    // 피자 (도우 · 소스 · 토핑)
    this.radii = new Array(SECT).fill(0.07).map((r, i) => r * (1 + Math.sin(i * 1.7) * 0.06));
    this.doughMat = new THREE.MeshStandardMaterial({ map: speckle('#e8cf9a'), roughness: 0.72 });
    this.pizza = new THREE.Group();
    this.pizza.position.copy(D);
    g.add(this.pizza);
    this.doughMesh = new THREE.Mesh(doughGeometry(this.radii, 0.006, 0.0, 1), this.doughMat);
    this.doughMesh.castShadow = this.doughMesh.receiveShadow = true;
    this.doughMesh.userData.noOutline = true; // 상판 안쪽에 외곽선(실금 · 구멍)이 생기지 않게
    this.pizza.add(this.doughMesh);
    this.stretchP = 0;
    this.rimH = 0;
    // 소스 캔버스 (국자로 그린다)
    const S = 256;
    this.sauceCv = document.createElement('canvas');
    this.sauceCv.width = this.sauceCv.height = S;
    this.sauceTex = new THREE.CanvasTexture(this.sauceCv);
    this.sauceTex.encoding = THREE.sRGBEncoding;
    this.sauceMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ map: this.sauceTex, transparent: true, alphaTest: 0.3, roughness: 0.35, clearcoat: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.sauceMesh.rotation.x = -Math.PI / 2;
    this.sauceMesh.visible = false;
    this.pizza.add(this.sauceMesh);
    this.tops = new THREE.Group();
    this.pizza.add(this.tops);
    // 국자 + 피자 필
    this.ladle = k.group(k.at(k.sphere(0.03, k.metal('steel'), { t0: Math.PI / 2, tl: Math.PI / 2 }), 0, 0.03, 0), k.at(k.cyl(0.004, 0.004, 0.24, k.metal('steel')), 0.06, 0.13, 0.06, 0.5, 0, -0.5));
    this.ladle.visible = false;
    g.add(this.ladle);
    this.peel = metalPeel();
    this.peel.visible = false;
    g.add(this.peel);
    this.wheel = pizzaWheel();
    this.wheel.visible = false;
    g.add(this.wheel);
    // 토핑 밧드 (바질 · 프로슈토 · 루꼴라)
    const needs = new Set();
    for (const s of this.ctx.order.steps) if (s.type === 'top') s.layers.forEach((x) => needs.add(x));
    let bx = 0.44;
    for (const id of needs) {
      const ing = this.ctx.ing(id);
      if (ing.kind !== 'prepped') continue;
      const tray = k.group(k.at(k.box(0.1, 0.03, 0.09, k.metal('steel')), 0, 0.015, 0));
      const sample = id === 'basil' ? basilLeaf(1.3) : id === 'arugula' ? arugula() : buildPrepped(ing, 2);
      sample.position.y = 0.032;
      tray.add(sample);
      tray.position.set(bx, Y0, 0.33 - Object.keys(this.prepped).length * 0.1);
      g.add(tray);
      this.prepped[id] = tray;
    }
    this.ctx.view(V(0, Y0 + 0.05, 0.02), 1.0, 0.95);
  }

  start(step) {
    // 10차: 짙은 월넛 도마는 썰기 단계에서만 꺼내 두고, 다른 단계 화면에는 끼어들지 않게 치운다
    if (this.board) this.board.visible = step.type === 'slice';
    const fn = { stretch: () => this.stretch(), ladle: () => this.ladleStep(step), top: () => this.topStep(step), bake: () => this.bake(), wheel: () => this.wheelStep(step) }[step.type];
    return fn ? fn() : super.start(step);
  }

  update(dt) {
    super.update(dt);
    updateForno(this.oven, dt, this.baking ? 1 : 0.55);
  }

  rebuildDough(ball) {
    this.doughMesh.geometry.dispose();
    this.doughMesh.geometry = doughGeometry(this.radii, 0.006 + (1 - this.stretchP) * 0.004, this.rimH, ball);
  }

  get meanR() {
    return this.radii.reduce((s, r) => s + r, 0) / SECT;
  }

  // ───────── 1. 수제 도우 스트레칭 ─────────
  stretch() {
    const ctx = this.ctx;
    const self = this;
    ctx.view(V(D.x, Y0 + 0.02, D.z), 0.5, 1.0);
    ctx.ui.step('수제 도우 스트레칭', '바깥으로 문질러 30cm');
    let last = null;
    let done = false;
    const refresh = () => {
      const p = clamp((self.meanR - 0.07) / 0.08, 0, 1);
      ctx.ui.meter(`<div class="wb-cover"><div class="bar"><i class="${p >= 1 ? 'good' : ''}" style="width:${Math.round(p * 100)}%"></i></div><span>지름 ${Math.round(self.meanR * 200)}cm / 30cm</span></div>`);
    };
    refresh();
    ctx.ui.actions([]);
    const finish = () => {
      done = true;
      const m = self.meanR;
      const sd = Math.sqrt(self.radii.reduce((s, r) => s + (r - m) ** 2, 0) / SECT);
      const round = clamp(1 - (sd / m) * 6, 0, 1);
      const score = Math.round(60 + round * 40);
      ctx.ui.pop(round > 0.7 ? `동그랗게 잘 폈어요 · ${scoreWord(score)}` : `조금 찌그러졌어요 · ${score}점`, score >= 70);
      ctx.done(score, `도우 원형도 ${Math.round(round * 100)}%`);
    };
    return {
      down(e, ndc) {
        last = ctx.planeHit(ndc, D.y + 0.01);
      },
      move(e, ndc) {
        if (done || !last) return;
        const p = ctx.planeHit(ndc, D.y + 0.01);
        if (!p) return;
        const dx = p.x - D.x;
        const dz = p.z - D.z;
        const r = Math.hypot(dx, dz);
        const mv = Math.hypot(p.x - last.x, p.z - last.z);
        last = p;
        if (r > self.meanR * 1.25 || mv < 0.0005) return;
        // 문지른 방향(바깥쪽) 섹터가 늘어나고, 이웃 섹터도 조금 따라 늘어난다
        const a = Math.atan2(dz, dx);
        const f = (((a / (Math.PI * 2)) * SECT) % SECT + SECT) % SECT;
        for (let i = 0; i < SECT; i++) {
          let d = Math.abs(i - f);
          d = Math.min(d, SECT - d);
          const w = Math.exp(-d * d * 0.35);
          self.radii[i] = Math.min(0.16, self.radii[i] + mv * 0.16 * w);
        }
        self.stretchP = clamp((self.meanR - 0.07) / 0.08, 0, 1);
        self.rimH = 0.012 * self.stretchP;
        self.rebuildDough(Math.max(0, 1 - self.stretchP * 2.2));
        if (Math.random() < 0.15) ctx.sound.roll();
        refresh();
        if (self.meanR >= 0.15) finish();
      },
      up() {
        last = null;
      },
      update() {},
      destroy() {},
    };
  }

  // ───────── 2. 국자 소스 스월링 ─────────
  ladleStep(step) {
    const ctx = this.ctx;
    const self = this;
    const S = 256;
    const g = this.sauceCv.getContext('2d');
    const cream = step.sauce === 'truffle';
    const col = cream ? ['#efe3c3', '#e2cf9c', '#f8efd8'] : ['#b8341c', '#962611', '#d04a2a'];
    const R = this.meanR * 0.86;
    this.sauceMesh.scale.setScalar(R);
    this.sauceMesh.position.y = 0.0075;
    this.sauceMesh.visible = true;
    this.ladle.visible = true;
    ctx.view(V(D.x, Y0 + 0.03, D.z), 0.42, 1.05);
    ctx.ui.step(cream ? '트러플 크림 스월링' : '산마르자노 소스 스월링', '가운데서 바깥으로 나선');
    const samples = [];
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
      const x = (i + 0.5) / 24 - 0.5;
      const y = (j + 0.5) / 24 - 0.5;
      if (Math.hypot(x, y) < 0.46) samples.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, on: false });
    }
    let lastPx = null;
    let lastA = null;
    let spiral = 0;
    let startedCenter = false;
    let done = false;
    const cov = () => samples.filter((s) => s.on).length / samples.length;
    const refresh = () => ctx.ui.meter(`<div class="wb-cover"><div class="bar"><i class="${cov() >= 0.85 ? 'good' : ''}" style="width:${Math.round(cov() * 100)}%"></i><b style="left:85%"></b></div><span>소스 ${Math.round(cov() * 100)}% · 나선 ${(spiral / (Math.PI * 2)).toFixed(1)}바퀴</span></div>`);
    refresh();
    const finish = () => {
      if (done) return;
      done = true;
      self.ladle.visible = false;
      const c = cov();
      const score = Math.round(clamp(c / 0.85, 0, 1) * 80 + Math.min(1, spiral / (Math.PI * 6)) * 20);
      ctx.ui.pop(`결이 살아 있는 소스 · ${scoreWord(score)}`, score >= 70);
      ctx.ui.actions([]);
      ctx.done(score, `소스 도포 ${Math.round(c * 100)}%`);
    };
    ctx.ui.actions([{ label: '완료', icon: 'check', primary: true, onClick: finish }]);
    const toPx = (p) => ({ x: ((p.x - D.x) / R / 2 + 0.5) * S, y: ((p.z - D.z) / R / 2 + 0.5) * S });
    return {
      down(e, ndc) {
        const p = ctx.planeHit(ndc, D.y + 0.01);
        if (!p) return;
        lastPx = toPx(p);
        startedCenter = startedCenter || Math.hypot(lastPx.x - S / 2, lastPx.y - S / 2) < S * 0.2;
        lastA = null;
        ctx.sound.pourStart();
      },
      move(e, ndc) {
        const p = ctx.planeHit(ndc, D.y + 0.01);
        if (!p || done) return;
        self.ladle.position.set(p.x, D.y + 0.012, p.z);
        if (!lastPx) return;
        const q = toPx(p);
        g.save();
        g.beginPath();
        g.arc(S / 2, S / 2, S * 0.49, 0, Math.PI * 2);
        g.clip();
        g.lineCap = 'round';
        g.strokeStyle = col[0];
        g.lineWidth = 40;
        g.beginPath();
        g.moveTo(lastPx.x, lastPx.y);
        g.lineTo(q.x, q.y);
        g.stroke();
        // 국자 결 (나선 방향 줄무늬)
        g.strokeStyle = col[1];
        g.globalAlpha = 0.5;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(lastPx.x + 8, lastPx.y + 8);
        g.lineTo(q.x + 8, q.y + 8);
        g.stroke();
        g.strokeStyle = col[2];
        g.beginPath();
        g.moveTo(lastPx.x - 9, lastPx.y - 6);
        g.lineTo(q.x - 9, q.y - 6);
        g.stroke();
        g.restore();
        self.sauceTex.needsUpdate = true;
        for (const s of samples) if (!s.on && Math.hypot(s.x - q.x, s.y - q.y) < 22) s.on = true;
        const a = Math.atan2(q.y - S / 2, q.x - S / 2);
        if (lastA !== null) {
          let d = a - lastA;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.hypot(q.x - S / 2, q.y - S / 2) > 10) spiral += Math.abs(d);
        }
        lastA = a;
        lastPx = q;
        refresh();
        if (cov() >= 0.9) ctx.later(0.3, finish);
      },
      up() {
        lastPx = null;
        ctx.sound.pourStop();
      },
      update() {},
      destroy() {
        ctx.sound.pourStop();
        self.ladle.visible = false;
      },
    };
  }

  // ───────── 3/5. 토핑 올리기 (탭한 자리에 한 조각씩) ─────────
  topStep(step) {
    const ctx = this.ctx;
    const self = this;
    const queue = [];
    for (const id of step.layers) {
      const it = this.items[id];
      if (it) for (const p of it.cutPieces()) queue.push({ id, piece: p, ing: it.ing });
      else for (let i = 0; i < (PREP_N[id] ?? 4); i++) queue.push({ id, ing: ctx.ing(id) });
    }
    const total = queue.length;
    const R = this.meanR;
    const topY = 0.012 + (this.baked ? 0.004 : 0);
    ctx.view(V(D.x, Y0 + 0.03, D.z), 0.46, 1.1);
    ctx.ui.step(step.label ?? '토핑 올리기', '피자 위를 탭해 골고루');
    const spots = [];
    let done = false;
    const refresh = () => {
      const left = {};
      queue.forEach((q) => (left[q.id] = (left[q.id] ?? 0) + 1));
      ctx.ui.meter(`<div class="wb-seq">${step.layers.map((id) => `<span class="${left[id] ? '' : 'ok'}"><i>${left[id] ?? 0}</i>${ctx.ing(id).name}</span>`).join('')}</div>`);
    };
    refresh();
    ctx.ui.actions([]);
    const finish = () => {
      done = true;
      // 고르게 흩어졌는지: 최근접 거리 평균
      let sum = 0;
      for (const a of spots) {
        let best = 1;
        for (const b of spots) if (a !== b) best = Math.min(best, Math.hypot(a.x - b.x, a.z - b.z));
        sum += best;
      }
      const ideal = R * 1.6 / Math.sqrt(Math.max(1, spots.length));
      const even = clamp(sum / Math.max(1, spots.length) / ideal, 0, 1);
      const score = Math.round(65 + even * 35);
      ctx.ui.pop(`토핑 배치 · ${scoreWord(score)}`, score >= 70);
      ctx.done(score, `토핑 ${total}개`);
    };
    return {
      down() {},
      move() {},
      up(e, ndc) {
        if (done || !queue.length) return;
        const p = ctx.planeHit(ndc, D.y + topY);
        if (!p) return;
        const lx = p.x - D.x;
        const lz = p.z - D.z;
        if (Math.hypot(lx, lz) > R * 0.82) return ctx.ui.pop('테두리 안쪽에 올려요', false);
        const q = queue.shift();
        let obj;
        if (q.piece) {
          obj = q.piece.flat ?? layFlat(q.piece, q.ing);
          const w = q.piece.mesh.getWorldPosition(new THREE.Vector3());
          self.stage.add(obj);
          obj.position.copy(self.stage.worldToLocal(w));
          q.piece.flat = obj;
        } else {
          obj = q.id === 'basil' ? basilLeaf(1.4) : q.id === 'arugula' ? arugula() : buildPrepped(q.ing, 1);
          if (q.id === 'arugula') obj.scale.setScalar(1.6);
          const tray = self.prepped[q.id];
          self.stage.add(obj);
          obj.position.copy(tray ? tray.position.clone().setY(Y0 + 0.05) : V(0.3, Y0 + 0.1, 0));
        }
        self.pizza.attach(obj);
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
        const layer = LAYER[q.id] ?? 3;
        layerize(obj, layer);
        // 이 재료의 두께 (눕힌 상태)
        const bb = new THREE.Box3().setFromObject(obj);
        const th = Math.max(0.001, bb.max.y - bb.min.y);
        let base = topY;
        for (const pl of self.placed) if (pl.layer < layer) base = Math.max(base, pl.y + pl.th * (pl.layer === 2 ? 0.9 : 0.6));
        const y = base + self.placed.filter((pl) => pl.layer === layer).length * 0.0004;
        self.tw.to(obj, { pos: V(lx, y, lz), quat: rot, dur: 0.4, arc: 0.06 });
        self.placed.push({ obj, id: q.id, layer, y, th });
        spots.push({ x: lx, z: lz });
        ctx.sound.plop();
        refresh();
        if (!queue.length) ctx.later(0.5, finish);
      },
      update() {},
      destroy() {},
    };
  }

  // ───────── 4. 화덕 굽기 ─────────
  // 9차: 금속 피자 필이 도우 밑으로 미끄러져 들어가 피자를 받치고 → 플레이어가 위로 밀면 입구 정면으로 돌아
  // 아치 터널을 똑바로 통과 → 화덕 돌바닥에 피자만 내려놓고 필은 '툭' 빼낸다. 꺼낼 때는 반대로 필이 들어가 떠낸다.
  bake() {
    const ctx = this.ctx;
    const self = this;
    const home = this.pizza.position.clone();
    const mouthZ = OVEN.z + (this.oven.userData.mouthZ ?? 0.35);
    const lift = Y0 + 0.028; // 랜딩 턱을 넘는 높이
    const front = V(OVEN.x, lift, mouthZ + 0.17);
    const throat = V(OVEN.x, lift, OVEN.z + 0.06);
    const inside = V(OVEN.x + 0.04, Y0 + 0.0155, OVEN.z + 0.03); // 장작불 반대편(오른쪽) 화산석 위
    const path = [home.clone().setY(lift), front, throat];
    const seg = path.slice(1).map((p, i) => p.distanceTo(path[i]));
    const total = seg.reduce((x, y) => x + y, 0);
    const along = (u) => {
      let d = u * total;
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) return path[i].clone().lerp(path[i + 1], clamp(d / seg[i], 0, 1));
        d -= seg[i];
      }
      return path[path.length - 1].clone();
    };
    const PEEL_DY = -0.0035; // 날이 도우 바로 밑
    const peelOut = home.clone().add(V(0.06, 0, 0.36)).setY(Y0 + 0.012);
    this.peel.visible = true;
    this.peel.position.copy(peelOut);
    this.peel.rotation.set(0, 0, 0);
    ctx.view(V((D.x + OVEN.x) / 2, Y0 + 0.06, -0.02), 0.85, 0.62);
    ctx.ui.step('화덕에 굽기', '위로 쭉 밀어 화덕에 넣기');
    ctx.sound.fireStart();
    let drag = null;
    let phase = 'load'; // load → push → drop → bake → out
    let b = 0;
    let crackT = 0;
    let u = 0;
    const cheese = this.placed.filter((x) => x.id === 'mozzarella').map((x) => ({ o: x.obj, s0: x.obj.scale.clone() }));
    const pale = lin('#ffffff');
    const gold = lin('#e0b070');
    const bubbles = [];
    // 터닝 필 (작은 원형 금속 날 + 아주 긴 손잡이)
    let turned = false;
    let turn = null;
    const turner = new THREE.Group();
    {
      const alu = new THREE.MeshStandardMaterial({ color: lin('#c9ccd0'), metalness: 0.85, roughness: 0.32 });
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.002, 32), alu);
      turner.add(head);
      turner.add(kit.at(kit.cyl(0.006, 0.006, 0.6, alu, { seg: 10 }), 0, 0.006, 0.33, Math.PI / 2 - 0.05, 0, 0));
      turner.add(kit.at(kit.cyl(0.011, 0.011, 0.12, kit.wood('walnut'), { seg: 10 }), 0, 0.03, 0.66, Math.PI / 2 - 0.05, 0, 0));
      turner.visible = false;
      this.stage.add(turner);
    }
    const cheeseItems = this.placed.filter((x) => x.layer === 2);
    const cheeseTh = cheeseItems.length ? Math.max(...cheeseItems.map((x) => x.th)) : 0;
    const refresh = () =>
      ctx.ui.meter(
        phase === 'load' || phase === 'push'
          ? `<div class="wb-cover"><div class="bar"><i style="width:${Math.round(u * 100)}%"></i></div><span>화덕 입구까지 ${Math.round(u * 100)}%</span></div>`
          : phase === 'drop'
            ? `<div class="wb-chips"><span>돌바닥에 내려놓고 필 빼기</span></div>`
            : `<div class="wb-cover"><div class="bar"><i class="${b >= 0.75 && b <= 0.95 ? 'good' : ''}" style="width:${Math.round(Math.min(1, b) * 100)}%"></i><b style="left:75%"></b><b style="left:95%"></b></div><span>${b < 0.75 ? '굽는 중' : b <= 0.95 ? '지금! 노릇노릇' : '조금 탔어요'} · ${Math.round(b * 90)}초</span></div>`,
      );
    refresh();
    ctx.ui.actions([]);
    // 1) 필이 도우 밑으로 쓱 (앞쪽에서 밀어 넣는다)
    this.tw.to(this.peel, {
      pos: home.clone().setY(home.y + PEEL_DY),
      dur: 0.55,
      onDone: () => {
        ctx.sound.swish();
        self.tw.to(self.pizza, { pos: home.clone().setY(lift), dur: 0.25 });
        self.tw.to(self.peel, { pos: home.clone().setY(lift + PEEL_DY), dur: 0.25 });
        ctx.later(0.25, () => (phase = 'push'));
      },
    });
    const place = (v) => {
      u = v;
      const p = along(u);
      self.pizza.position.copy(p);
      self.peel.position.copy(p).setY(p.y + PEEL_DY);
    };
    const drop = () => {
      phase = 'drop';
      drag = null;
      ctx.sound.plop();
      // 피자를 돌바닥으로 내려놓고, 필만 재빨리 뒤로 뺀다
      self.tw.to(self.pizza, { pos: inside, dur: 0.35 });
      self.tw.to(self.peel, { pos: inside.clone().setY(inside.y + PEEL_DY), dur: 0.35 });
      ctx.later(0.4, () => {
        ctx.sound.swish();
        self.tw.to(self.peel, { pos: throat.clone().setY(Y0 + 0.014), dur: 0.16 });
        ctx.later(0.17, () => self.tw.to(self.peel, { pos: peelOut, dur: 0.45 }));
      });
      ctx.later(0.75, () => {
        phase = 'bake';
        self.baking = true;
        ctx.ui.actions([{ label: '꺼내기', icon: 'serve', primary: true, onClick: pullOut }]);
        // 아치형 입구 안쪽을 정면에서 비스듬히 들여다본다
        ctx.view(V(OVEN.x + 0.02, Y0 + 0.05, OVEN.z + 0.1), 0.6, 0.3, 0.2);
      });
    };
    const pullOut = () => {
      if (phase !== 'bake') return;
      phase = 'out';
      self.baking = false;
      self.baked = true;
      ctx.ui.actions([]);
      ctx.sound.fireStop();
      const score = zoneScore(b, [0.75, 0.95]);
      // 필이 다시 들어가 떠낸 뒤 반죽판으로
      self.tw.to(self.peel, { pos: throat.clone().setY(Y0 + 0.014), dur: 0.35 });
      ctx.later(0.36, () => self.tw.to(self.peel, { pos: inside.clone().setY(inside.y + PEEL_DY), dur: 0.2 }));
      ctx.later(0.6, () => {
        ctx.sound.swish();
        const back = [throat, front, home.clone().setY(lift), home];
        let t0 = 0;
        for (const to of back) {
          const d = 0.24;
          ctx.later(t0, () => {
            self.tw.to(self.pizza, { pos: to, dur: d });
            self.tw.to(self.peel, { pos: to.clone().setY(to.y + PEEL_DY), dur: d });
          });
          t0 += d;
        }
        ctx.later(t0 + 0.05, () => self.tw.to(self.peel, { pos: peelOut, dur: 0.4 }));
        ctx.later(t0 + 0.5, () => {
          self.peel.visible = false;
          for (const x of bubbles) x.parent?.remove(x);
          ctx.ui.pop(b > 0.95 ? `살짝 그을렸어요 · ${score}점` : `테두리가 노릇하게 부풀었어요 · ${scoreWord(score)}`, score >= 70);
          ctx.done(score, `굽기 ${Math.round(b * 90)}초`);
        });
      });
    };
    return {
      down(e, ndc) {
        if (phase === 'push') drag = { px: ctx.ndcToPx(ndc), p: ctx.planeHit(ndc, Y0 + 0.02), u0: u };
      },
      move(e, ndc) {
        if (phase !== 'push' || !drag) return;
        // 위로 민 만큼(화면 px · 바닥 평면 중 큰 쪽) 필이 경로를 따라간다
        const q = ctx.ndcToPx(ndc);
        const byPx = (drag.px.y - q.y) / (ctx.viewW() * 0.55);
        const p = ctx.planeHit(ndc, Y0 + 0.02);
        const byPlane = p && drag.p ? (drag.p.z - p.z) / total : 0;
        place(clamp(drag.u0 + Math.max(byPx, byPlane), 0, 1));
        if (Math.random() < 0.2) ctx.sound.roll?.();
        if (u >= 0.97) drop();
      },
      up() {
        if (phase === 'push' && drag) {
          drag = null;
          // 손을 떼도 입구 근처(70%)면 그대로 밀어 넣는다
          if (u >= 0.7) {
            place(1);
            drop();
          }
        }
      },
      update(dt = 1 / 60) {
        if (phase !== 'bake') return refresh();
        b += dt / 6;
        // 굽기 50%: 긴 금속 터닝 필이 입구로 들어와 피자를 살짝 들어 180도 돌려놓고 빠진다
        if (!turned && b >= 0.5) {
          turned = true;
          turn = { t: 0, r0: self.pizza.rotation.y };
          turner.visible = true;
          ctx.ui.pop('터닝 필로 180도 돌려요', true);
        }
        if (turn) {
          turn.t += dt;
          const tt = turn.t;
          const tip = inside.clone().add(V(0, 0.004, 0.02));
          const out = V(OVEN.x + 0.04, Y0 + 0.03, mouthZ + 0.32);
          if (tt < 0.45) turner.position.lerpVectors(out, tip, tt / 0.45);
          else if (tt < 1.15) {
            const k = (tt - 0.45) / 0.7;
            const e = k * k * (3 - 2 * k);
            self.pizza.position.y = inside.y + Math.sin(k * Math.PI) * 0.012;
            self.pizza.rotation.y = turn.r0 + Math.PI * e;
            turner.position.copy(tip);
            turner.rotation.y = Math.PI * e * 0.15;
          } else if (tt < 1.6) {
            self.pizza.position.y = inside.y;
            turner.position.lerpVectors(tip, out, (tt - 1.15) / 0.45);
          } else {
            turner.visible = false;
            turn = null;
            ctx.sound.swish();
          }
        }
        // 테두리가 부풀고 노릇해지며, 치즈가 녹아 퍼지고 보글보글
        self.rimH = 0.012 + Math.min(1, b) * 0.01;
        self.rebuildDough(0);
        self.doughMat.color.copy(pale).lerp(gold, Math.min(1, b * 0.95));
        if (b > 0.95) self.doughMat.color.lerp(lin('#8a5a2a'), Math.min(0.6, (b - 0.95) * 1.5));
        const melt = Math.min(1, b * 1.2);
        for (const c of cheese) c.o.scale.set(c.s0.x * (1 + melt * 0.35), c.s0.y * (1 - melt * 0.55), c.s0.z * (1 + melt * 0.35));
        // 치즈가 녹아 낮아진 만큼 그 위층(토마토 · 허브)도 함께 내려앉는다 (공중에 뜨거나 치즈 밑으로 파고들지 않음)
        for (const pl of self.placed) if (pl.layer > 2) pl.obj.position.y = pl.y - cheeseTh * 0.9 * 0.55 * melt;
        crackT -= dt;
        if (crackT <= 0) {
          crackT = 0.12 + Math.random() * 0.2;
          ctx.sound.crackle();
          if (b > 0.3 && bubbles.length < 24) {
            const bb = kit.sphere(0.004, kit.mat('#fff4dc', { rough: 0.3, clearcoat: 0.8 }), { ws: 8, hs: 6 });
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * self.meanR * 0.7;
            bb.position.set(Math.cos(a) * d, 0.016, Math.sin(a) * d);
            self.pizza.add(bb);
            bubbles.push(bb);
          }
        }
        // 호피 무늬(레오파드) 그을음: 코르니초네(가장자리)에 검은 점이 하나둘 번진다
        if (b > 0.3 && Math.random() < dt * (b > 0.9 ? 14 : 8)) {
          const cv = self.doughMat.map.image;
          const gx = cv.getContext('2d');
          const a = Math.random() * Math.PI * 2;
          const rr = (0.3 + Math.random() * 0.085) * 256;
          const x = 128 + Math.cos(a) * rr;
          const y = 128 + Math.sin(a) * rr;
          const s = 2 + Math.random() * 5;
          const gr = gx.createRadialGradient(x, y, 0, x, y, s * 1.8);
          gr.addColorStop(0, 'rgba(35,18,8,0.95)');
          gr.addColorStop(0.55, 'rgba(90,45,15,0.55)');
          gr.addColorStop(1, 'rgba(140,80,30,0)');
          gx.fillStyle = gr;
          gx.beginPath();
          gx.arc(x, y, s * 1.8, 0, Math.PI * 2);
          gx.fill();
          self.doughMat.map.needsUpdate = true;
        }
        for (const bb of bubbles) bb.scale.setScalar(0.6 + Math.abs(Math.sin(performance.now() / 200 + bb.id)) * 0.7);
        refresh();
        if (b >= 1.25) pullOut();
      },
      destroy() {
        ctx.sound.fireStop();
        self.baking = false;
        self.stage.remove(turner);
      },
    };
  }

  // ───────── 5. 피자 휠 커팅 & 마감 ─────────
  // 구워 나온 피자 위를 원형 휠 커터가 가로질러 굴러가며 8조각으로 자르고, 생바질/루꼴라 + 올리브오일로 마감
  wheelStep(step) {
    const ctx = this.ctx;
    const self = this;
    const R = this.meanR;
    const yTop = 0.022;
    const P = this.pizza.position;
    ctx.view(V(P.x, Y0 + 0.03, P.z), 0.5, 1.05);
    ctx.ui.step(step.label ?? '피자 휠 커팅 & 마감', '골드 점선 따라 4번 긋기');
    const lines = [0, 1, 2, 3].map((i) => ({ a: (i * Math.PI) / 4, cut: false }));
    const goldMat = new THREE.MeshBasicMaterial({ color: lin('#ffc95a'), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
    for (const l of lines) {
      l.guide = new THREE.Group();
      for (let k = -6; k <= 6; k += 2) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(R * 0.13, 0.002, 0.003), goldMat);
        d.position.set((k / 7) * R, 0, 0);
        d.renderOrder = 31;
        l.guide.add(d);
      }
      l.guide.position.set(P.x, P.y + yTop + 0.004, P.z);
      l.guide.rotation.y = l.a;
      self.stage.add(l.guide);
    }
    const wheel = this.wheel;
    wheel.visible = true;
    wheel.position.set(P.x + R + 0.08, P.y + 0.06, P.z + 0.04);
    const cutMat = new THREE.MeshStandardMaterial({ color: lin('#5a2412'), roughness: 0.6, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -4 });
    const scores = [];
    let anim = null;
    let down = null;
    let finishing = false;
    const refresh = () => ctx.ui.meter(`<div class="wb-chips"><span>${scores.length * 2} / 8 조각</span><span>휠 커터</span></div>`);
    refresh();
    ctx.ui.actions([]);
    const center = () => ctx.toScreen(V(P.x, P.y + yTop, P.z));
    const finish = () => {
      finishing = true;
      wheel.visible = false;
      // 생잎 가니쉬: 위에서 살랑 떨어진다
      const fresh = ctx.order.recipe.id.includes('truffle') ? 'arugula' : 'basil';
      for (let i = 0; i < 6; i++) {
        const leaf = fresh === 'basil' ? basilLeaf(1.3) : arugula();
        if (fresh === 'arugula') leaf.scale.setScalar(1.5);
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const d = R * (0.3 + (i % 2) * 0.28);
        leaf.position.set(Math.cos(a) * d, 0.12, Math.sin(a) * d);
        leaf.rotation.y = Math.random() * 6;
        self.pizza.add(leaf);
        self.tw.to(leaf, { pos: V(Math.cos(a) * d, yTop + 0.002, Math.sin(a) * d), dur: 0.5, delay: i * 0.08 });
      }
      // 엑스트라 버진 올리브오일: 오일병이 기울어 나선형으로 둘러진다
      const cruet = kit.group(kit.at(kit.cyl(0.022, 0.026, 0.12, kit.mat('#6b7a2a', { opacity: 0.78, rough: 0.1 })), 0, 0.06, 0), kit.at(kit.cyl(0.004, 0.008, 0.05, kit.metal('steel')), 0, 0.14, 0));
      self.stage.add(cruet);
      self.cruet = cruet;
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const a = t * Math.PI * 6;
        const r = R * (0.15 + 0.65 * t);
        pts.push(V(Math.cos(a) * r, yTop + 0.003, Math.sin(a) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 240, 0.0018, 6, false);
      const oil = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: lin('#d6b93a'), roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.75 }));
      oil.userData.noOutline = true;
      geo.setDrawRange(0, 0);
      self.pizza.add(oil);
      const full = geo.index.count;
      ctx.sound.pourStart?.();
      let t = 0;
      self.oilAnim = (dt) => {
        t += dt;
        const k = Math.min(1, t / 1.4);
        const n = Math.floor(full * k);
        geo.setDrawRange(0, n - (n % 3));
        const p = curve.getPoint(k).applyAxisAngle(V(0, 1, 0), self.pizza.rotation.y);
        cruet.position.set(P.x + p.x + 0.03, P.y + 0.1, P.z + p.z);
        cruet.rotation.set(0, 0, 2.1);
        if (k >= 1) {
          self.oilAnim = null;
          ctx.sound.pourStop?.();
          self.tw.to(cruet, { pos: V(P.x + R + 0.15, P.y - 0.012, P.z - 0.1), quat: new THREE.Quaternion(), dur: 0.4 });
          const avg = scores.reduce((x, y) => x + y, 0) / scores.length;
          ctx.ui.pop(`8조각 완성 · ${scoreWord(avg)}`, true);
          ctx.later(0.5, () => ctx.done(avg, '피자 휠 커팅'));
        }
      };
    };
    return {
      down(e, ndc) {
        if (anim || finishing) return;
        down = ctx.ndcToPx(ndc);
      },
      move(e, ndc) {
        if (anim || finishing) return;
        const p = ctx.planeHit(ndc, P.y + yTop);
        if (p) wheel.position.set(p.x, P.y + yTop + 0.001 + (down ? 0 : 0.03), p.z);
      },
      up(e, ndc) {
        if (anim || finishing || !down) return;
        const a = down;
        const b = ctx.ndcToPx(ndc);
        down = null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 30) return ctx.ui.pop('피자를 가로질러 길게 그어요', false);
        // 스트로크와 각 가이드 선의 화면 각도 차이 → 가장 가까운 선으로 스냅 (중심과의 거리 허용 = 뷰포트 폭 18%)
        const c = center();
        const distC = Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx) / len;
        const tol = ctx.viewW() * 0.18;
        if (distC > tol) return ctx.ui.pop('피자 한가운데를 지나가게 그어요', false);
        const sa = Math.atan2(dy, dx);
        let best = null;
        let bestD = Infinity;
        for (const l of lines) {
          if (l.cut) continue;
          const e1 = ctx.toScreen(V(P.x + Math.cos(-l.a) * R, P.y + yTop, P.z + Math.sin(-l.a) * R));
          const la = Math.atan2(e1.y - c.y, e1.x - c.x);
          let d = Math.abs(sa - la) % Math.PI;
          d = Math.min(d, Math.PI - d);
          if (d < bestD) {
            bestD = d;
            best = l;
          }
        }
        if (!best) return;
        const score = clamp(Math.round(100 - 15 * Math.min(1, (bestD / 0.6 + distC / tol) / 2)), 85, 100);
        scores.push(score);
        best.cut = true;
        self.stage.remove(best.guide);
        anim = { l: best, t: 0, score };
        ctx.sound.swish();
      },
      update(dt = 1 / 60) {
        if (self.oilAnim) self.oilAnim(dt);
        if (!anim) return;
        anim.t += dt;
        const k = Math.min(1, anim.t / 0.55);
        const l = anim.l;
        const dir = V(Math.cos(-l.a), 0, Math.sin(-l.a));
        const s = -R * 1.05 + 2.1 * R * k;
        wheel.position.set(P.x + dir.x * s, P.y + yTop + 0.001, P.z + dir.z * s);
        wheel.rotation.y = l.a;
        wheel.userData.disc.rotation.y -= dt * 40;
        if (Math.random() < 0.5) ctx.sound.roll?.();
        if (k >= 1) {
          // 잘린 자국 (토핑을 가로지르는 칼집) — 피자가 구울 때 돈 만큼 되돌려 화면 기준 선에 맞춘다
          const cut = new THREE.Mesh(new THREE.BoxGeometry(R * 2 * 0.98, 0.0012, 0.0022), cutMat);
          cut.position.set(0, yTop + 0.001, 0);
          cut.rotation.y = l.a - self.pizza.rotation.y;
          cut.userData.noOutline = true;
          self.pizza.add(cut);
          ctx.sound.chop();
          ctx.ui.popAt(V(P.x, P.y + 0.06, P.z), `${anim.score}점 · ${scoreWord(anim.score)}`, true);
          anim = null;
          wheel.position.y += 0.03;
          refresh();
          if (lines.every((x) => x.cut)) ctx.later(0.4, finish);
        }
      },
      destroy() {
        for (const l of lines) self.stage.remove(l.guide);
        wheel.visible = false;
        self.oilAnim = null;
        ctx.sound.pourStop?.();
      },
    };
  }

  // 완성: 나무 페들 보드 위 8조각 화덕 피자
  showcase() {
    const hero = buildBistroDish(this.ctx.order.recipe.id);
    const spot = D.clone().setY(Y0 + 0.012);
    if (hero) {
      this.pizza.visible = false;
      hero.position.copy(spot);
      hero.rotation.y = -0.5;
      hero.scale.setScalar(0.6);
      this.stage.add(hero);
      this.hero = hero;
      this.heroT = 0;
      this.ctx.sound.plate?.();
    }
    this.ctx.view(V(spot.x + 0.04, Y0 + 0.04, spot.z), 0.5, 0.7);
  }

  takeDish() {
    const d = this.hero ?? this.pizza;
    this.stage.remove(d);
    d.position.set(0, 0, 0);
    d.scale.setScalar(1);
    d.visible = true;
    return d;
  }

  destroy() {
    this.ctx.sound.fireStop?.();
    if (this.cruet) this.stage.remove(this.cruet);
  }
}
