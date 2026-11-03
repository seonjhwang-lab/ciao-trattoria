import * as THREE from 'three';
import { kit } from '../core/Kit.js';
import { gaugeTexture, drawCrema } from './benchTextures.js';
import { Tweens, clamp, zoneScore, scoreWord } from './tween.js';
import { buildEspressoMachine, buildGrinder } from '../core/EspressoMachine.js';
import { buildHeroDish } from '../core/HeroDish.js';

// 에스프레소 바 워크벤치: 그라인딩 → 수평 탬핑 → (시럽) → 9 Bar 레버 추출 → 온수/스티밍 → 프리푸어 라떼아트
const Y0 = 0.92;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// 머신(공용 고디테일 모델)을 MACHINE 에 놓으면 오른쪽 그룹헤드가 조작용 GROUP
const MACHINE = V(0, Y0, -0.1);
const MACHINE_OPT = { w: 0.54, d: 0.44, groups: [-0.135, 0.135] };
const GROUP = V(MACHINE.x + 0.135, Y0 + 0.235 - 0.017, MACHINE.z + (0.44 / 2 - 0.11) + 0.07); // 포터필터 바스켓 중심
const GRINDER = V(-0.4, Y0, -0.02);
const PITCHER = V(0.37, Y0, 0.2);

function artPath(template, cx, cy, R) {
  const p = new Path2D();
  if (template === 'tulip') {
    p.ellipse(cx, cy + R * 0.42, R * 0.44, R * 0.2, 0, 0, Math.PI * 2);
    p.ellipse(cx, cy + R * 0.04, R * 0.36, R * 0.17, 0, 0, Math.PI * 2);
    p.ellipse(cx, cy - R * 0.3, R * 0.25, R * 0.14, 0, 0, Math.PI * 2);
    p.rect(cx - R * 0.03, cy - R * 0.55, R * 0.06, R * 1.05);
  } else if (template === 'rosetta') {
    for (let i = 0; i < 7; i++) {
      const y = cy + R * 0.55 - i * R * 0.16;
      const w = R * (0.5 - i * 0.05);
      p.ellipse(cx, y, w, R * 0.07, 0, 0, Math.PI * 2);
    }
    p.rect(cx - R * 0.025, cy - R * 0.6, R * 0.05, R * 1.2);
  } else {
    const s = R * 0.66;
    p.moveTo(cx, cy + s * 0.75);
    p.bezierCurveTo(cx - s * 1.25, cy - s * 0.05, cx - s * 0.65, cy - s * 0.95, cx, cy - s * 0.38);
    p.bezierCurveTo(cx + s * 0.65, cy - s * 0.95, cx + s * 1.25, cy - s * 0.05, cx, cy + s * 0.75);
    p.closePath();
  }
  return p;
}
const ART_NAME = { heart: '하트', tulip: '튤립', rosetta: '로제타' };

export class EspressoBench {
  constructor(ctx) {
    this.ctx = ctx;
    this.stage = ctx.stage;
    this.tw = new Tweens();
    this.t = 0;
    this.decaf = ctx.order.option === 'decaf';
    this.oat = ctx.order.option === 'oat_milk';
    this.latte = ctx.order.steps.some((s) => s.type === 'steam');
    this.build();
  }

  build() {
    const k = kit;
    const g = this.stage;
    const wood = k.wood('lightoak');
    const steel = k.metal('steel');
    const chrome = k.metal('chrome');
    // 캐비닛 + 상판
    g.add(k.at(k.box(0.94, Y0 - 0.06, 0.82, wood), 0, (Y0 - 0.06) / 2, 0));
    g.add(k.at(k.box(0.98, 0.05, 0.86, k.stone('#d4d0c8')), 0, Y0 - 0.025, 0.01));
    // 머신 본체: 공용 고디테일 2그룹 머신 (왼쪽 그룹엔 장식 포터필터, 오른쪽이 조작용)
    const mach = buildEspressoMachine({ body: 'mint', ...MACHINE_OPT, portafilters: [true, false], brewCups: [false, false] });
    mach.root.position.copy(MACHINE);
    g.add(mach.root);
    this.machine = mach.root;
    // 9차: 오른쪽 스팀 완드 노즐 끝 (공용 머신 모델과 같은 계산)
    {
      const w = MACHINE_OPT.w;
      const joint = V(w / 2 + 0.012, 0.225, mach.frontZ - 0.02);
      this.wandDir = V(0.32, -1, 0.42).normalize();
      this.wandTip = joint.addScaledVector(this.wandDir, 0.17 + 0.012).add(MACHINE);
    }
    this.steamFx = [];
    // 압력계 바늘: 머신 중앙 듀얼 게이지의 펌프 바늘을 그대로 조작한다
    this.needle = mach.gauge.userData.pump;
    this.setPressure(0);
    // 추출 패들 (오른쪽 그룹 위)
    this.lever = new THREE.Group();
    this.lever.position.set(GROUP.x, MACHINE.y + 0.31, MACHINE.z + mach.frontZ + 0.05);
    this.lever.add(k.at(k.cyl(0.006, 0.006, 0.09, chrome), 0, 0.045, 0));
    this.lever.add(k.at(k.sphere(0.017, k.wood('walnut')), 0, 0.095, 0));
    g.add(this.lever);
    // 스팀 피처
    this.pitcher = k.group(k.at(k.cyl(0.04, 0.05, 0.11, steel, { open: true }), 0, 0.055, 0), k.at(k.cyl(0.049, 0.049, 0.004, steel), 0, 0.002, 0), k.at(k.box(0.012, 0.06, 0.01, steel), 0.05, 0.06, 0));
    this.milk = k.at(k.cyl(0.038, 0.038, 0.001, k.mat(this.oat ? '#efe3cf' : '#f6f1e8', { rough: 0.6 })), 0, 0.05, 0);
    this.pitcher.add(this.milk);
    this.pitcher.position.copy(PITCHER);
    g.add(this.pitcher);
    // 그라인더 (투명 호퍼 + 분쇄도 다이얼 + 포크)
    const gr = buildGrinder({ body: 'black' });
    gr.position.copy(GRINDER);
    this.grinder = gr;
    if (this.decaf) {
      const tag = k.label(['DECAF'], 0.1, 0.035, { bg: '#e9e2d3', fg: '#3a3029', font: 'Gowun Batang' });
      gr.add(k.at(tag, 0, 0.2, 0.087));
    }
    g.add(gr);
    // 포터필터 (바스켓 + 원두 더미)
    this.pf = new THREE.Group();
    this.pf.add(k.at(k.cyl(0.042, 0.038, 0.03, steel), 0, 0, 0));
    this.pf.add(k.at(k.cyl(0.036, 0.036, 0.002, k.mat('#2a2a2a')), 0, 0.012, 0));
    this.pf.add(k.at(k.cyl(0.016, 0.012, 0.13, k.wood('walnut'), { seg: 12 }), 0, -0.004, 0.09, Math.PI / 2 - 0.15));
    this.pf.add(k.at(k.cyl(0.008, 0.004, 0.02, steel), -0.015, -0.025, 0));
    this.pf.add(k.at(k.cyl(0.008, 0.004, 0.02, steel), 0.015, -0.025, 0));
    this.heap = k.sphere(0.036, k.mat('#3a2416', { rough: 0.95 }), { tl: Math.PI / 2 });
    this.heap.position.y = 0.012;
    this.heap.scale.set(1, 0.001, 1);
    this.pf.add(this.heap);
    this.pf.position.set(GRINDER.x, GRINDER.y + 0.137, GRINDER.z + 0.1); // 그라인더 포크 위 (v19: 몸통 앞면에서 떨어지게 2.5cm 앞으로)
    g.add(this.pf);
    // 잔 (라떼는 넓은 세라믹, 아메리카노는 유리)
    this.cup = new THREE.Group();
    this.cup.position.set(GROUP.x, Y0 + 0.029, GROUP.z + 0.005); // 드립 트레이 그릴 위
    const cupR = this.latte ? 0.052 : 0.042;
    const cupH = this.latte ? 0.07 : 0.095;
    this.cupR = cupR;
    this.cupH = cupH;
    this.cup.add(k.at(k.cyl(0.08, 0.07, 0.01, k.ceramic(this.latte ? '#efebe3' : '#2e2e30'), { seg: 28 }), 0, 0.005, 0));
    const wall = this.latte ? k.ceramic('#efebe3') : k.glass();
    const body = k.cyl(cupR, cupR * 0.75, cupH, wall, { seg: 28, open: true });
    body.material = body.material.clone();
    body.material.side = THREE.DoubleSide;
    this.cup.add(k.at(body, 0, 0.01 + cupH / 2, 0));
    this.cup.add(k.at(k.cyl(cupR * 0.75, cupR * 0.75, 0.003, wall), 0, 0.012, 0));
    this.cup.add(k.at(k.torus(0.02, 0.006, wall), cupR + 0.012, 0.01 + cupH * 0.5, 0));
    // 액체 + 표면 (표면 캔버스에 크레마/라떼아트를 그린다)
    this.liquid = k.cyl(cupR * 0.95, cupR * 0.72, 1, k.mat('#2a140a', { rough: 0.2, opacity: this.latte ? 1 : 0.94 }), { seg: 28 });
    this.liquid.material = this.liquid.material.clone();
    this.liquid.scale.y = 0.0001;
    this.liquid.position.y = 0.012;
    this.cup.add(this.liquid);
    const S = 256;
    this.surfCanvas = document.createElement('canvas');
    this.surfCanvas.width = this.surfCanvas.height = S;
    this.sctx = this.surfCanvas.getContext('2d');
    drawCrema(this.sctx, S, 0.3);
    this.surfTex = new THREE.CanvasTexture(this.surfCanvas);
    this.surfTex.encoding = THREE.sRGBEncoding;
    this.surface = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ map: this.surfTex, roughness: 0.35 }));
    this.surface.material.envMapIntensity = 0.7;
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.visible = false;
    this.cup.add(this.surface);
    g.add(this.cup);
    this.level = 0; // 0~1
    // 추출 줄기 두 가닥
    this.streams = [-1, 1].map((s) => {
      const m = k.cyl(0.0025, 0.0018, 1, k.mat('#6b3415', { rough: 0.15, opacity: 0.9 }), { seg: 8 });
      m.visible = false;
      m.castShadow = false;
      g.add(m);
      return { m, s };
    });
    // 원두 가루 입자
    this.grounds = [];
    const gm = k.mat('#3a2416', { rough: 1 });
    for (let i = 0; i < 70; i++) {
      const p = k.box(0.003, 0.003, 0.003, gm);
      p.castShadow = false;
      p.visible = false;
      g.add(p);
      this.grounds.push({ m: p, t: Math.random() });
    }
    this.ctx.view(V(-0.05, Y0 + 0.2, 0.05), 1.0, 0.45);
  }

  setPressure(bar) {
    const deg = -225 + (clamp(bar, 0, 15) / 15) * 270;
    this.needle.rotation.z = -(deg * Math.PI) / 180;
  }

  setLevel(v, color) {
    this.level = clamp(v, 0, 1);
    const h = Math.max(0.0001, this.level * (this.cupH - 0.012));
    this.liquid.scale.y = h;
    this.liquid.position.y = 0.012 + h / 2;
    if (color) this.liquid.material.color.copy(new THREE.Color(color).convertSRGBToLinear());
    const r = this.cupR * (0.75 + 0.2 * this.level);
    this.surface.visible = this.level > 0.02;
    this.surface.scale.setScalar(r * 0.98);
    this.surface.position.y = 0.012 + h + 0.0006;
  }

  start(step) {
    const fn = {
      grind: () => this.grind(),
      tamp: () => this.tamp(),
      syrup: () => this.syrup(step),
      extract: () => this.extract(),
      water: () => this.water(),
      steam: () => this.steam(),
      art: () => this.art(step),
    }[step.type];
    return fn ? fn() : { update() {}, destroy() {} };
  }

  // ───── 9차 김(수증기) 파티클: 반투명 아지랑이 스프라이트가 피어올라 번지며 사라진다 ─────
  puffTex() {
    if (EspressoBench._puff) return EspressoBench._puff;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(236,240,244,0.95)');
    gr.addColorStop(0.45, 'rgba(225,230,236,0.45)');
    gr.addColorStop(1, 'rgba(225,230,236,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.userData = { shared: true };
    return (EspressoBench._puff = t);
  }

  emitSteam(pos, vel, { size = 0.02, grow = 2.5, life = 1.4, op = 0.32, drag = 1.2, sway = 0.6 } = {}) {
    if (this.steamFx.length > 140) return;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex(), transparent: true, depthWrite: false, opacity: 0 }));
    m.position.copy(pos);
    m.scale.setScalar(size);
    m.renderOrder = 25;
    this.stage.add(m);
    this.steamFx.push({ m, v: vel.clone(), t: 0, size, grow, life, op, drag, sway, ph: Math.random() * 6 });
  }

  updateSteam(dt) {
    for (let i = this.steamFx.length - 1; i >= 0; i--) {
      const f = this.steamFx[i];
      f.t += dt;
      const u = f.t / f.life;
      if (u >= 1) {
        this.stage.remove(f.m);
        f.m.material.dispose();
        this.steamFx.splice(i, 1);
        continue;
      }
      f.v.multiplyScalar(Math.max(0, 1 - f.drag * dt));
      f.v.y += 0.05 * dt; // 뜨거운 김은 위로 뜬다
      f.m.position.addScaledVector(f.v, dt);
      f.m.position.x += Math.sin(f.t * 3 + f.ph) * f.sway * 0.004 * dt * 10;
      f.m.scale.setScalar(f.size * (1 + f.grow * u));
      // 태어나자마자 짙게 피어올랐다가 천천히 옅어진다
      f.m.material.opacity = f.op * (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88);
    }
  }

  update(dt) {
    this.t += dt;
    this.tw.update(dt);
    this.updateSteam(dt);
    if (this.hero && this.heroT < 1) {
      this.heroT = Math.min(1, this.heroT + dt / 0.45);
      const u = this.heroT;
      this.hero.scale.setScalar(0.6 + 0.4 * (1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2));
    }
  }

  // ───────── 1. 그라인딩 ─────────
  grind() {
    const ctx = this.ctx;
    const self = this;
    ctx.view(V(GRINDER.x + 0.05, GRINDER.y + 0.2, GRINDER.z + 0.05), 0.7, 0.5);
    ctx.ui.step('원두 분쇄', '꾹 눌러 18.0g 맞추기');
    let grams = 0;
    let holding = false;
    const refresh = () => ctx.ui.meter(`<div class="wb-readout"><b>${grams.toFixed(1)}</b><span>g / 18.0g</span></div>`);
    const finish = () => {
      const score = clamp(Math.round(100 - Math.abs(grams - 18) * 14), 10, 100);
      ctx.ui.pop(`${grams.toFixed(1)}g · ${scoreWord(score)}`, score >= 70);
      ctx.done(score, `분쇄량 ${grams.toFixed(1)}g`);
    };
    ctx.ui.actions([
      { label: '꾹 눌러 분쇄', icon: 'grind', hold: true, onDown: () => ((holding = true), ctx.sound.grind()), onUp: () => (holding = false) },
      { label: '분쇄 완료', icon: 'check', primary: true, onClick: () => grams > 2 && finish() },
    ]);
    refresh();
    let gt = 0;
    let buzz = 0;
    return {
      update(dt) {
        const chute = V(GRINDER.x, GRINDER.y + 0.185, GRINDER.z + 0.08);
        for (const p of self.grounds) {
          p.m.visible = holding;
          if (!holding) continue;
          p.t = (p.t + dt * 2.2) % 1;
          p.m.position.set(chute.x + Math.sin(p.t * 40 + p.m.id) * 0.006, chute.y - p.t * 0.12, chute.z + Math.cos(p.t * 33 + p.m.id) * 0.006);
        }
        self.grinder.position.copy(GRINDER);
        if (!holding) return;
        // 드르륵 — 그라인더 본체와 떨어지는 가루가 잘게 떨린다 + 짧은 진동 펄스
        self.grinder.position.x += (Math.random() - 0.5) * 0.0016;
        self.grinder.position.z += (Math.random() - 0.5) * 0.0012;
        self.pf.position.x = GRINDER.x + (Math.random() - 0.5) * 0.001;
        buzz += dt;
        if (buzz > 0.12) {
          buzz = 0;
          ctx.sound.vibrate([28, 18, 28]);
        }
        grams = Math.min(24, grams + dt * 3.2);
        gt += dt;
        if (gt > 0.9) {
          gt = 0;
          ctx.sound.grind();
        }
        const f = grams / 18;
        self.heap.scale.set(clamp(0.6 + f * 0.4, 0, 1.08), clamp(f * 0.55, 0.001, 0.8), clamp(0.6 + f * 0.4, 0, 1.08));
        refresh();
      },
      destroy() {
        self.grounds.forEach((p) => (p.m.visible = false));
        self.grinder.position.copy(GRINDER);
      },
    };
  }

  // ───────── 2. 수평 탬핑 ─────────
  tamp() {
    const ctx = this.ctx;
    const self = this;
    const spot = V(GRINDER.x + 0.12, Y0 + 0.016, 0.2);
    this.tw.to(this.pf, { pos: spot, dur: 0.5, arc: 0.04 });
    ctx.view(V(spot.x, spot.y + 0.06, spot.z), 0.42, 0.45);
    const tamper = kit.group(kit.at(kit.cyl(0.035, 0.035, 0.014, kit.metal('steel')), 0, 0, 0), kit.at(kit.cyl(0.012, 0.016, 0.06, kit.wood('walnut')), 0, 0.04, 0), kit.at(kit.sphere(0.022, kit.wood('walnut')), 0, 0.075, 0));
    tamper.position.set(spot.x, spot.y + 0.07, spot.z);
    this.stage.add(tamper);
    this.tamper = tamper;
    ctx.ui.step('수평 탬핑', '좌우로 끌어 0°에 맞춰요');
    let user = 0;
    let lastX = null;
    let locked = false;
    let tilt = 0;
    const refresh = () => {
      const pos = clamp(tilt / 8, -1, 1);
      ctx.ui.meter(`<div class="wb-level"><div class="vial"><i style="left:${50 + pos * 45}%"></i><b></b></div><span>${tilt >= 0 ? '+' : ''}${tilt.toFixed(1)}°</span></div>`);
    };
    const press = () => {
      if (locked) return;
      locked = true;
      const err = Math.abs(tilt);
      const score = clamp(Math.round(100 - err * 22), 10, 100);
      ctx.sound.tamp();
      ctx.sound.vibrate(40); // 꾹 — 묵직한 한 번
      self.tw.to(tamper, { pos: V(spot.x, spot.y + 0.03, spot.z), dur: 0.18 });
      self.heap.scale.set(1, 0.08, 1);
      ctx.ui.pop(`수평 오차 ${err.toFixed(1)}° · ${scoreWord(score)}`, score >= 70);
      ctx.later(0.35, () => {
        self.tw.to(tamper, { pos: V(spot.x, spot.y + 0.3, spot.z - 0.2), dur: 0.4 });
        // 포터필터를 그룹헤드에 장착
        self.tw.to(self.pf, { pos: GROUP.clone(), dur: 0.55, arc: 0.06, delay: 0.25, onDone: () => ctx.sound.lever() });
      });
      ctx.done(score, `탬핑 수평 오차 ${err.toFixed(1)}°`);
    };
    ctx.ui.actions([{ label: '압착하기', icon: 'tamp', primary: true, onClick: press }]);
    refresh();
    return {
      down(e) {
        lastX = e.clientX;
      },
      move(e) {
        if (lastX === null || locked) return;
        const x = e.clientX;
        user += (x - lastX) * 0.05;
        lastX = x;
      },
      up() {
        lastX = null;
      },
      update() {
        if (locked) return;
        const drift = Math.sin(self.t * 1.25) * 4.5 + Math.sin(self.t * 0.53 + 1) * 2.5;
        tilt = drift + user;
        tamper.rotation.z = (tilt * Math.PI) / 180;
        refresh();
      },
      destroy() {
        if (self.tamper) self.stage.remove(self.tamper);
      },
    };
  }

  // ───────── (바닐라) 시럽 ─────────
  syrup(step) {
    const ctx = this.ctx;
    const self = this;
    const bottle = kit.group(kit.at(kit.cyl(0.03, 0.03, 0.16, kit.mat('#e9dcc0', { opacity: 0.85, rough: 0.1 })), 0, 0.08, 0), kit.at(kit.cyl(0.008, 0.008, 0.06, kit.metal('black')), 0, 0.19, 0));
    const head = kit.at(kit.rbox(0.05, 0.016, 0.02, kit.metal('black'), { r: 0.006 }), 0.01, 0.225, 0);
    bottle.add(head);
    bottle.position.set(GROUP.x + 0.1, Y0 + 0.029, GROUP.z + 0.06);
    this.stage.add(bottle);
    ctx.view(V(GROUP.x + 0.05, Y0 + 0.12, GROUP.z), 0.38, 0.4);
    let n = 0;
    ctx.ui.step('바닐라 시럽', `정확히 ${step.pumps}펌프`);
    const refresh = () => ctx.ui.meter(`<div class="wb-readout"><b>${n}</b><span>펌프 / 목표 ${step.pumps}</span></div>`);
    refresh();
    ctx.ui.actions([
      {
        label: '펌프 누르기',
        icon: 'syrup',
        onClick: () => {
          n++;
          ctx.sound.pump();
          head.position.y = 0.21;
          ctx.later(0.12, () => (head.position.y = 0.225));
          self.setLevel(self.level + 0.04, '#d9b36a');
          refresh();
        },
      },
      {
        label: '다 넣었어요',
        icon: 'check',
        primary: true,
        onClick: () => {
          const score = Math.max(20, 100 - Math.abs(n - step.pumps) * 35);
          ctx.ui.pop(n === step.pumps ? '딱 맞아요' : `${n}펌프 · ${score}점`, n === step.pumps);
          ctx.done(score, `시럽 ${n}/${step.pumps}펌프`);
        },
      },
    ]);
    return {
      update() {},
      destroy() {
        self.stage.remove(bottle);
      },
    };
  }

  // ───────── 3. 9 Bar 추출: 황동 레버를 녹색 홈까지 끌어내리면 '찰칵' 고정 → 골든 라인(36ml)에서 레버 올리기 ─────────
  extract() {
    const ctx = this.ctx;
    const self = this;
    const ZONE = [0.7, 0.8]; // 레버 위치 0(위)~1(아래) 중 9 BAR OPTIMAL 홈
    const SNAP = 0.75;
    const BAR_AT = (p) => p * 12;
    ctx.view(V(GROUP.x - 0.05, Y0 + 0.16, GROUP.z), 0.46, 0.62);
    ctx.ui.step('9 Bar 추출', '레버를 초록 9 BAR까지');
    let lever = 0; // 0~1
    let goal = 0;
    let locked = false;
    let dragging = false;
    let vol = 0;
    let done = false;
    let p = 0;
    let pumpT = 0;
    const base = this.level;
    const span = self.latte ? 0.32 : 0.28;
    // 컵 안 골든 라인 (목표 36ml, 항상 보이게) + 라벨
    const target = base + span;
    const ty = 0.012 + target * (self.cupH - 0.012);
    const tr = self.cupR * (0.75 + 0.2 * target);
    const goldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcc55').convertSRGBToLinear(), depthTest: false, transparent: true, opacity: 0.95 });
    const goldLine = new THREE.Mesh(new THREE.TorusGeometry(tr, 0.0011, 6, 48), goldMat);
    goldLine.rotation.x = Math.PI / 2;
    goldLine.position.y = ty;
    goldLine.renderOrder = 40;
    self.cup.add(goldLine);
    const tag = kit.label(['36ml'], 0.034, 0.013, { bg: '#2a221b', fg: '#ffd877' });
    tag.material.depthTest = false;
    tag.renderOrder = 41;
    tag.position.set(tr + 0.022, ty + 0.004, 0.01);
    self.cup.add(tag);

    // 화면 우측 입체 황동 레버 UI
    const panel = ctx.ui.panel(`
      <div class="lever-ui">
        <b class="lever-cap">PULL</b>
        <div class="lever-track">
          <div class="lever-zone" style="top:${ZONE[0] * 100}%;height:${(ZONE[1] - ZONE[0]) * 100}%"><span>9 BAR<br/>OPTIMAL</span></div>
          ${[0, 3, 6, 9, 12].map((b) => `<i class="lever-tick" style="top:${(b / 12) * 100}%"><em>${b}</em></i>`).join('')}
          <div class="lever-rod"></div>
          <div class="lever-knob"><span></span></div>
        </div>
        <small class="lever-hint">아래로 끌어내리기</small>
      </div>`);
    const ui = panel.querySelector('.lever-ui');
    const track = panel.querySelector('.lever-track');
    track.dataset.raw = '1'; // 레버는 직접 pointer 를 받는다 (입력 계층이 탭으로 가로채지 않게)
    const knob = panel.querySelector('.lever-knob');
    const rod = panel.querySelector('.lever-rod');
    const hint = panel.querySelector('.lever-hint');
    const setLeverUI = () => {
      knob.style.top = `${lever * 100}%`;
      rod.style.height = `${lever * 100}%`;
      ui.classList.toggle('locked', locked);
      ui.classList.toggle('inzone', !locked && lever >= ZONE[0] && lever <= ZONE[1]);
    };
    const posFromEvent = (e) => {
      const r = track.getBoundingClientRect();
      return clamp((e.clientY - r.top) / r.height, 0, 1);
    };
    const onDown = (e) => {
      if (done || locked) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        knob.setPointerCapture(e.pointerId);
      } catch {
        /* 합성 이벤트 */
      }
      dragging = true;
      goal = Math.max(lever, posFromEvent(e));
      ctx.sound.lever();
    };
    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      goal = posFromEvent(e);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (goal >= ZONE[0] - 0.05 && goal <= ZONE[1] + 0.08) {
        // 찰칵! 9 bar 에 고정
        locked = true;
        goal = SNAP;
        ctx.sound.tamp?.();
        ctx.sound.tap();
        ctx.ui.pop('찰칵! 9 bar 고정', true);
        ctx.sound.vibrate([45, 30, 20]);
        hint.textContent = '추출 중 · 골든 라인을 지켜봐요';
        ctx.ui.actions([{ id: 'stop', label: '추출 완료 (레버 올리기)', icon: 'check', primary: true, onClick: finish }]);
      } else {
        goal = 0;
        ctx.ui.pop(goal < ZONE[0] ? '초록 홈까지 끝까지 내려요' : '너무 내렸어요 · 초록 홈에 맞춰요', false);
      }
    };
    knob.addEventListener('pointerdown', onDown);
    track.addEventListener('pointerdown', onDown);
    knob.addEventListener('pointermove', onMove);
    track.addEventListener('pointermove', onMove);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) knob.addEventListener(ev, onUp);
    track.addEventListener('pointerup', onUp);
    ctx.ui.actions([]);

    const refresh = () => ctx.ui.meter(`<div class="wb-readout"><b>${p.toFixed(1)}</b><span>bar</span><b>${vol.toFixed(0)}</b><span>ml / 36ml 골든 라인</span></div>`);
    refresh();
    function finish() {
      if (done) return;
      done = true;
      goal = 0;
      locked = false;
      ctx.sound.pourStop();
      ctx.sound.lever();
      self.streams.forEach((s) => (s.m.visible = false));
      const score = zoneScore(vol, [33, 39]);
      // 9 bar 로 고정해 뽑았으니 호랑이 무늬 크레마가 선명하다 (양이 맞을수록 진하게)
      drawCrema(self.sctx, 256, 0.6 + (score / 100) * 1.1);
      self.surfTex.needsUpdate = true;
      ctx.ui.actions([]);
      ctx.ui.pop(`${vol.toFixed(0)}ml · ${scoreWord(score)}`, score >= 70);
      ctx.done(score, `추출량 ${vol.toFixed(0)}ml (목표 36ml)`);
    }
    return {
      update(dt) {
        // 레버는 손가락을 부드럽게 따라가고, 고정되면 홈에 딱 붙는다
        lever += (goal - lever) * Math.min(1, dt * (dragging ? 22 : locked ? 30 : 9));
        setLeverUI();
        self.lever.rotation.x = lever * 1.25;
        const pTarget = locked ? 9 : dragging ? BAR_AT(lever) : BAR_AT(lever) * 0.6;
        p += (pTarget - p) * Math.min(1, dt * (locked ? 5 : 3));
        self.setPressure(p + Math.sin(self.t * 30) * 0.06);
        if (done) return;
        const flow = locked ? 1 : Math.max(0, p - 4) / 10;
        // 펌프가 도는 잔잔한 진동 + 머신 · 압력계 바늘의 미세한 떨림
        self.machine.position.copy(MACHINE);
        if (flow > 0.02) {
          self.machine.position.x += (Math.random() - 0.5) * 0.0007;
          self.machine.position.y += (Math.random() - 0.5) * 0.0004;
          self.setPressure(p + (Math.random() - 0.5) * 0.35);
          pumpT += dt;
          if (pumpT > 0.22) {
            pumpT = 0;
            ctx.sound.vibrate(14);
          }
        }
        if (flow > 0.02) {
          vol += flow * 6.2 * dt;
          ctx.sound.pourStart();
        } else ctx.sound.pourStop();
        self.setLevel(base + (vol / 36) * span, '#2a140a');
        goldMat.opacity = vol > 33 && vol < 39 ? 0.6 + Math.sin(self.t * 12) * 0.4 : 0.95;
        // 두 줄기
        const top = GROUP.y - 0.035;
        const bottomY = self.cup.position.y + 0.012 + self.level * (self.cupH - 0.012);
        // 9차: 추출 중 포터필터 추출구와 잔 위로 모락모락 피어오르는 김
        if (flow > 0.02) {
          self.steamAcc = (self.steamAcc ?? 0) + dt * (10 + flow * 14);
          while (self.steamAcc > 1) {
            self.steamAcc -= 1;
            const sp = Math.random() < 0.5 ? -1 : 1;
            if (Math.random() < 0.45) self.emitSteam(V(GROUP.x + sp * 0.011 + (Math.random() - 0.5) * 0.01, top - 0.004, GROUP.z + 0.005), V((Math.random() - 0.5) * 0.02, 0.03 + Math.random() * 0.03, 0.01), { size: 0.014, grow: 2.4, life: 1.2, op: 0.4 });
            else self.emitSteam(V(GROUP.x + (Math.random() - 0.5) * self.cupR * 1.2, bottomY + 0.006, GROUP.z + 0.005 + (Math.random() - 0.5) * self.cupR), V((Math.random() - 0.5) * 0.02, 0.04 + Math.random() * 0.04, (Math.random() - 0.3) * 0.02), { size: 0.018, grow: 3, life: 1.9, op: 0.46 });
          }
        }
        for (const s of self.streams) {
          s.m.visible = flow > 0.02;
          const h = Math.max(0.001, top - bottomY);
          s.m.scale.set(0.6 + flow * 0.6, h, 0.6 + flow * 0.6);
          s.m.position.set(GROUP.x + s.s * 0.011, bottomY + h / 2, GROUP.z + 0.005);
        }
        if (self.t % 0.5 < dt) {
          drawCrema(self.sctx, 256, 0.4 + (locked ? 1.1 : 0.2));
          self.surfTex.needsUpdate = true;
        }
        refresh();
        if (vol >= 50) finish(); // 과추출
      },
      destroy() {
        ctx.sound.pourStop();
        self.streams.forEach((s) => (s.m.visible = false));
        self.cup.remove(goldLine, tag);
        self.lever.rotation.x = 0;
        self.machine.position.copy(MACHINE);
      },
    };
  }

  // ───────── 아메리카노: 온수 ─────────
  water() {
    const ctx = this.ctx;
    const self = this;
    ctx.view(V(GROUP.x, Y0 + 0.12, GROUP.z), 0.34, 0.35);
    ctx.ui.step('뜨거운 물 붓기', '170~190ml에서 손 떼기');
    let ml = 36;
    let holding = false;
    let locked = false;
    const base = this.level;
    const refresh = () => ctx.ui.meter(`<div class="wb-readout"><b>${Math.round(ml)}</b><span>ml / 170~190ml</span></div>`);
    refresh();
    const finish = () => {
      locked = true;
      ctx.sound.waterStop();
      const score = zoneScore(ml, [170, 190]);
      ctx.ui.pop(`${Math.round(ml)}ml · ${scoreWord(score)}`, score >= 70);
      ctx.done(score, `물 ${Math.round(ml)}ml`);
    };
    ctx.ui.actions([{ label: '꾹 눌러 붓기', icon: 'pour', hold: true, onDown: () => !locked && ((holding = true), ctx.sound.waterStart()), onUp: () => { holding = false; ctx.sound.waterStop(); if (ml > 50 && !locked) finish(); } }]);
    return {
      update(dt) {
        if (!holding || locked) return;
        ml = Math.min(240, ml + dt * 55);
        self.setLevel(base + ((ml - 36) / 204) * (1 - base), '#3b1e0e');
        refresh();
        if (ml >= 240) {
          holding = false;
          finish();
        }
      },
      destroy() {
        ctx.sound.waterStop();
      },
    };
  }

  // ───────── 벨벳 스티밍 ─────────
  steam() {
    const ctx = this.ctx;
    const self = this;
    ctx.view(V(PITCHER.x - 0.05, Y0 + 0.15, PITCHER.z), 0.38, 0.35);
    const lifted = V(0.33, Y0 + 0.012, 0.055); // 오른쪽 스팀 완드 끝 아래
    this.tw.to(this.pitcher, { pos: lifted, dur: 0.4 });
    ctx.ui.step('벨벳 스티밍', '60~68℃에서 손 떼기');
    // 9차: 시작하면 먼저 완드 '퍼지'(고압 수증기를 칙- 하고 빼낸다)
    let purge = 0.7;
    ctx.sound.steamStart();
    ctx.later(0.7, () => !holding && ctx.sound.steamStop());
    let temp = 6;
    let holding = false;
    let locked = false;
    let hum = 0;
    // 우유 표면에 소용돌이(Vortex) 무늬를 그려 두고 스팀이 들어가면 빙글빙글 돈다
    if (!self.milk.userData.vortex) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = self.oat ? '#efe3cf' : '#f8f4ec';
      x.fillRect(0, 0, 128, 128);
      x.strokeStyle = 'rgba(205,190,165,0.75)';
      x.lineWidth = 2.2;
      for (let k = 0; k < 3; k++) {
        x.beginPath();
        for (let i = 0; i < 120; i++) {
          const a = i * 0.16 + (k * Math.PI * 2) / 3;
          const r = i * 0.5;
          x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
        }
        x.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      self.milk.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
      self.milk.userData.vortex = true;
    }
    const refresh = () => ctx.ui.meter(`<div class="wb-readout"><b>${Math.round(temp)}</b><span>℃ / 60~68℃</span></div><div class="wb-thermo"><i style="height:${clamp(temp / 80, 0, 1) * 100}%"></i><b style="bottom:75%;height:10%"></b></div>`);
    refresh();
    const finish = () => {
      locked = true;
      ctx.sound.steamStop();
      const score = zoneScore(temp, [60, 68]);
      ctx.ui.pop(`${Math.round(temp)}℃ · ${scoreWord(score)}`, score >= 70);
      self.tw.to(self.pitcher, { pos: PITCHER.clone(), dur: 0.4 });
      ctx.done(score, `우유 ${Math.round(temp)}℃`);
    };
    ctx.ui.actions([{ label: '꾹 눌러 스팀', icon: 'steam', hold: true, onDown: () => !locked && ((holding = true), ctx.sound.steamStart()), onUp: () => { holding = false; ctx.sound.steamStop(); if (temp > 20 && !locked) finish(); } }]);
    const jet = (n, speed, spread, op) => {
      for (let i = 0; i < n; i++) {
        const d = self.wandDir.clone().add(V((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
        self.emitSteam(self.wandTip.clone(), d.multiplyScalar(speed * (0.7 + Math.random() * 0.5)), { size: 0.01, grow: 5, life: 0.9, op, drag: 2.6, sway: 0.3 });
      }
    };
    return {
      update(dt) {
        if (purge > 0) {
          purge -= dt;
          // 고압 수증기 제트: 노즐에서 아래로 힘차게 뿜어져 퍼진다
          jet(Math.ceil(dt * 70), 0.9, 0.35, 0.6);
        }
        if (holding && !locked) {
          // 노즐이 우유에 잠긴 동안: 피처 가장자리로 하얀 김 기둥이 솟고, 노즐 주변으로 짧은 제트
          const rimY = self.pitcher.position.y + 0.11;
          self.plumeAcc = (self.plumeAcc ?? 0) + dt * (14 + temp * 0.25);
          while (self.plumeAcc > 1) {
            self.plumeAcc -= 1;
            const a = Math.random() * Math.PI * 2;
            self.emitSteam(V(self.pitcher.position.x + Math.cos(a) * 0.035, rimY, self.pitcher.position.z + Math.sin(a) * 0.035), V(Math.cos(a) * 0.03, 0.05 + Math.random() * 0.07 + temp * 0.001, Math.sin(a) * 0.03), { size: 0.02, grow: 4, life: 1.5, op: 0.45 + clamp(temp / 70, 0, 1) * 0.2 });
          }
          if (Math.random() < 0.5) jet(1, 0.35, 0.8, 0.25);
        }
        if (!holding || locked) return;
        temp = Math.min(85, temp + dt * 11);
        ctx.sound.steamLevel(temp / 80);
        self.milk.position.y = 0.05 + clamp(temp / 70, 0, 1) * 0.035;
        self.milk.scale.set(1 + clamp(temp / 70, 0, 1) * 0.08, 1, 1 + clamp(temp / 70, 0, 1) * 0.08);
        self.pitcher.rotation.z = Math.sin(self.t * 25) * 0.01 + (Math.random() - 0.5) * 0.006;
        self.milk.rotation.y += dt * (8 + temp * 0.12); // 소용돌이
        hum += dt;
        if (hum > 0.2) {
          hum = 0;
          ctx.sound.vibrate(12);
        }
        refresh();
        if (temp >= 85) {
          holding = false;
          finish();
        }
      },
      destroy() {
        ctx.sound.steamStop();
      },
    };
  }

  // ───────── 프리푸어 라떼아트 ─────────
  art(step) {
    const ctx = this.ctx;
    const self = this;
    const S = 256;
    const R = S * 0.42;
    const cx = S / 2;
    // 잔을 앞으로 꺼내고 위에서 내려다본다
    const front = V(-0.13, Y0 + 0.025, 0.33);
    this.tw.to(this.cup, { pos: front, dur: 0.5, arc: 0.03 });
    this.setLevel(0.8);
    drawCrema(this.sctx, S, 0.6);
    this.surfTex.needsUpdate = true;
    ctx.view(V(front.x, front.y + 0.06, front.z), 0.2, 1.38);
    let template = null;
    let path2d = null;
    let samples = [];
    // 가이드 (반투명 점선 템플릿)
    const guideCanvas = document.createElement('canvas');
    guideCanvas.width = guideCanvas.height = S;
    const gctx = guideCanvas.getContext('2d');
    const guideTex = new THREE.CanvasTexture(guideCanvas);
    const guide = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: guideTex, transparent: true, depthWrite: false }));
    guide.rotation.x = -Math.PI / 2;
    this.cup.add(guide);
    const pitcher = this.pitcher;
    const home = PITCHER.clone();
    // 붓는 동안 피처가 잔을 가리지 않게 반투명으로
    const solid = [];
    pitcher.traverse((o) => {
      if (!o.isMesh) return;
      solid.push([o, o.material]);
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.35;
      o.material.depthWrite = false;
    });
    const restore = () => solid.forEach(([o, m]) => (o.material = m));
    const choose = (t) => {
      template = t;
      this.artTemplate = t;
      path2d = artPath(t, cx, cx, R);
      gctx.clearRect(0, 0, S, S);
      gctx.setLineDash([8, 7]);
      gctx.strokeStyle = 'rgba(255,255,255,0.7)';
      gctx.lineWidth = 2.5;
      gctx.stroke(path2d);
      guideTex.needsUpdate = true;
      const probe = document.createElement('canvas').getContext('2d');
      samples = [];
      for (let i = 0; i < 34; i++) for (let j = 0; j < 34; j++) {
        const x = ((i + 0.5) / 34) * S;
        const y = ((j + 0.5) / 34) * S;
        if ((x - cx) ** 2 + (y - cx) ** 2 > (R * 0.98) ** 2) continue;
        samples.push({ x, y, inside: probe.isPointInPath(path2d, x, y), on: false });
      }
      ctx.ui.step(`프리푸어 라떼아트 · ${ART_NAME[t]}`, '점선 안을 드래그로 채워요');
      ctx.ui.actions([{ label: '완성', icon: 'check', primary: true, onClick: finish }]);
    };
    ctx.ui.step('라떼아트 모양 고르기', '모양을 골라요');
    ctx.ui.actions((step.templates ?? ['heart']).map((t) => ({ label: ART_NAME[t], icon: 'latte', onClick: () => choose(t) })));
    let last = null;
    let pressed = false;
    const uvAt = (ndc) => {
      const hit = ctx.raycast(ndc, [self.surface])[0];
      if (!hit?.uv) return null;
      return { x: hit.uv.x * S, y: (1 - hit.uv.y) * S, point: hit.point };
    };
    const dab = (a, b) => {
      const c = self.sctx;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const steps = Math.ceil(len / 3);
      for (let i = 0; i <= steps; i++) {
        const x = a.x + (dx * i) / steps;
        const y = a.y + (dy * i) / steps;
        if ((x - cx) ** 2 + (y - cx) ** 2 > (R * 1.02) ** 2) continue;
        // 벨벳 폼이 번지듯 퍼지는 부드러운 원 + 진행 방향 결
        const r = 11;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(250,244,232,0.95)');
        g.addColorStop(0.65, 'rgba(244,234,216,0.75)');
        g.addColorStop(1, 'rgba(244,234,216,0)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x, y, r * 1.15, r * 0.9, Math.atan2(dy, dx), 0, Math.PI * 2);
        c.fill();
        for (const s of samples) if (!s.on && (s.x - x) ** 2 + (s.y - y) ** 2 < 81) s.on = true;
      }
      // 크레마와 폼 경계의 결 무늬
      c.strokeStyle = 'rgba(150,95,55,0.18)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(a.x - dy * 0.3, a.y + dx * 0.3);
      c.lineTo(b.x - dy * 0.3, b.y + dx * 0.3);
      c.stroke();
      self.surfTex.needsUpdate = true;
    };
    function finish() {
      if (!template) return;
      const ins = samples.filter((s) => s.inside);
      const outs = samples.filter((s) => !s.inside);
      const fill = ins.filter((s) => s.on).length / Math.max(1, ins.length);
      const spill = outs.filter((s) => s.on).length / Math.max(1, outs.length);
      const score = Math.round(100 * clamp(Math.min(1, fill / 0.82) - spill * 1.5, 0, 1));
      self.cup.remove(guide);
      restore();
      ctx.sound.waterStop();
      self.tw.to(pitcher, { pos: home, quat: new THREE.Quaternion(), dur: 0.4 });
      ctx.ui.pop(`${ART_NAME[template]} · ${scoreWord(score)} (${score}점)`, score >= 70);
      ctx.ui.actions([]);
      ctx.done(score, `라떼아트 ${score}점`);
    }
    return {
      down(e, ndc) {
        if (!template) return;
        pressed = true;
        last = uvAt(ndc);
        if (last) ctx.sound.waterStart();
      },
      move(e, ndc) {
        const h = uvAt(ndc);
        const w = ctx.planeHit(ndc, Y0 + 0.16);
        if (w && template) {
          // 주둥이가 붓는 지점에 오도록, 몸통은 옆으로 비켜서 기울인다
          pitcher.position.set(w.x + 0.12, Y0 + 0.2, w.z - 0.03);
          pitcher.rotation.set(0, 0, last ? 0.75 : 0.35);
        }
        if (pressed && !last && h) {
          last = h;
          ctx.sound.waterStart();
          return;
        }
        if (!last || !h) return;
        dab(last, h);
        last = h;
      },
      up() {
        pressed = false;
        last = null;
        ctx.sound.waterStop();
      },
      update() {
        guide.position.copy(self.surface.position).add(V(0, 0.0008, 0));
        guide.scale.copy(self.surface.scale);
      },
      destroy() {
        restore();
        ctx.sound.waterStop();
      },
    };
  }

  // 조리 완료: 받침·티스푼·도자기 잔·크레마·입체 라떼아트가 있는 완성품 전용 모델을 카운터 앞에 내놓는다
  showcase() {
    const hero = buildHeroDish(this.ctx.order.recipe.id, { art: this.artTemplate });
    const spot = V(GROUP.x - 0.2, Y0, 0.3);
    if (hero) {
      this.cup.visible = false;
      hero.position.copy(spot);
      hero.rotation.y = -0.5;
      hero.scale.setScalar(0.6);
      this.stage.add(hero);
      this.hero = hero;
      this.heroT = 0;
      this.ctx.sound.plate?.();
    }
    const c = hero ? spot : this.cup.position;
    this.ctx.view(V(c.x, c.y + 0.045, c.z), 0.24, 0.62);
  }

  takeDish() {
    const d = this.hero ?? this.cup;
    this.stage.remove(d);
    d.position.set(0, 0, 0);
    d.scale.setScalar(1);
    return d;
  }

  destroy() {}
}
