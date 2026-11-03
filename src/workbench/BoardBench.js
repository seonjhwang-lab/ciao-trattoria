import * as THREE from 'three';
import { getFoodTopY, keepAbove, lowestPoint } from './toolClear.js';
import { kit } from '../core/Kit.js';
import { SliceableItem, layFlat, buildPrepped, lobeTop, radiusAt } from './Ingredient3D.js';
import { endgrainTexture, traceLoaf } from './benchTextures.js';
import { Tweens, clamp, lcs, scoreWord } from './tween.js';
import { ingIcon } from '../ui/ingIcon.js';
import { buildHeroDish, bacon as heroBacon, lettuce as heroLettuce, poachedEgg as heroEgg, tomatoSlice as heroTomato, avocadoSlice, figWedge, arugula, basilLeaf } from '../core/HeroDish.js';

// 샌드위치 워크벤치: 엔드그레인 월넛 도마 위에서 썰기 → 바르기 → 플레이팅 → 드리즐/통후추
const Y0 = 0.9; // 프렙 테이블 상판
const BOARD = { x: -0.1, z: 0.07, w: 0.56, d: 0.34, t: 0.035 };
const YB = Y0 + BOARD.t;
const PLATE = { x: 0.33, z: 0.08, r: 0.13 };
const STAGING = [
  [-0.24, -0.2],
  [0.04, -0.21],
  [0.17, -0.21],
];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LOAF_SHIFT = 0.07; // 빵은 도마 오른쪽에 놓아 왼쪽에 슬라이스가 쓰러질 자리를 둔다
// 버터나이프: 손잡이가 화면 우측 하단 40°를 향하는 오른손잡이 고정 각도
const SP_YAW = Math.PI - (40 * Math.PI) / 180;
const SP_BLADE = 0.05; // 원점 → 날 중심
const SP_OFF = V(-Math.cos(SP_YAW) * SP_BLADE, 0, Math.sin(SP_YAW) * SP_BLADE); // 날 중심이 커서 아래 오도록 보정
const WRIST = (6 * Math.PI) / 180;

// 제과용 빵칼: 날 길이 28cm · 높이 2.2cm · 두께 2mm, 물결 톱니 날 + 둥근 원목 손잡이(리벳 3개)
// 로컬 +x = 칼끝 방향, +y = 칼등, 원점 = 날 뒤꿈치 아래 (손잡이는 -x)
function breadKnife() {
  const g = new THREE.Group();
  const L = 0.28;
  const Hb = 0.022;
  const T = 0.002;
  const s = new THREE.Shape();
  s.moveTo(0, 0.003);
  s.lineTo(0.008, 0.0012);
  for (let x = 0.008; x < L - 0.03; x += 0.0065) s.quadraticCurveTo(x + 0.00325, 0.0036, x + 0.0065, 0);
  s.quadraticCurveTo(L - 0.004, 0.0004, L, Hb * 0.55);
  s.quadraticCurveTo(L - 0.002, Hb, L - 0.022, Hb);
  s.lineTo(0, Hb);
  s.lineTo(0, 0.003);
  const bladeGeo = new THREE.ExtrudeGeometry(s, { depth: T - 0.0008, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0003, bevelSegments: 1, curveSegments: 6 });
  bladeGeo.translate(0, 0, -(T - 0.0008) / 2);
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e4e7ea').convertSRGBToLinear(), metalness: 0.92, roughness: 0.16 });
  steel.envMapIntensity = 1.3;
  g.add(new THREE.Mesh(bladeGeo, steel));
  // 볼스터 + 원목 손잡이 (둥근 타원 단면)
  const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.011, 0.008, 18), steel);
  bol.rotation.z = Math.PI / 2;
  bol.position.set(-0.004, Hb / 2, 0);
  bol.scale.set(1, 1, 0.72);
  g.add(bol);
  const prof = [
    [0.0, 0],
    [0.0105, 0.002],
    [0.0118, 0.025],
    [0.0112, 0.075],
    [0.0128, 0.105],
    [0.0118, 0.116],
    [0.006, 0.12],
    [0.0, 0.1205],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const hg = new THREE.LatheGeometry(prof, 20);
  hg.rotateZ(Math.PI / 2); // 축 y → -x
  const handle = new THREE.Mesh(hg, kit.wood('walnut', { rough: 0.45 }));
  handle.position.set(-0.008, Hb / 2, 0);
  handle.scale.set(1, 1, 0.72);
  g.add(handle);
  for (const x of [-0.03, -0.065, -0.1]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0184, 12), steel);
    r.rotation.x = Math.PI / 2;
    r.position.set(x, Hb / 2, 0);
    g.add(r);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export class BoardBench {
  constructor(ctx) {
    this.ctx = ctx;
    this.stage = ctx.stage;
    this.B = this.constructor.BOARD ?? BOARD; // 하위 벤치(샐러드·피자)가 도마 위치를 바꿀 수 있다
    this.staging = this.constructor.STAGING ?? STAGING;
    this.tw = new Tweens();
    this.items = {}; // ing id → SliceableItem
    this.prepped = {};
    this.parts = [];
    this.shake = 0;
    this.knifeAnim = null;
    this.build();
  }

  build() {
    this.buildTable();
    this.buildBoard();
    this.buildExtras();
    this.ctx.view(V(0.05, YB, 0), 1.05, 0.95);
  }

  // 스테인리스 프렙 테이블
  buildTable() {
    const k = kit;
    const g = this.stage;
    const steel = k.metal('steel');
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      g.add(k.at(k.box(0.04, Y0 - 0.02, 0.04, steel), x * 0.44, (Y0 - 0.02) / 2, z * 0.38));
    g.add(k.at(k.box(0.92, 0.03, 0.8, steel), 0, 0.22, 0));
    g.add(k.at(k.box(0.98, 0.04, 0.86, steel), 0, Y0 - 0.02, 0));
    g.add(k.at(k.box(0.98, 0.26, 0.02, steel), 0, Y0 + 0.13, -0.42));
  }

  // 도마 + 빵칼 + 버터나이프
  buildBoard() {
    const k = kit;
    const g = this.stage;
    const BOARD = this.B;
    // 엔드그레인 월넛 도마
    const top = new THREE.MeshStandardMaterial({ map: endgrainTexture(), roughness: 0.55 });
    top.envMapIntensity = 0.4;
    const side = k.wood('walnut');
    const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w, BOARD.t, BOARD.d), [side, side, top, side, side, side]);
    board.position.set(BOARD.x, Y0 + BOARD.t / 2, BOARD.z);
    board.castShadow = board.receiveShadow = true;
    g.add(board);
    this.board = board;
    this.boardY = Y0 + BOARD.t / 2;
    // 칼 (썰기) / 버터나이프 (바르기)
    this.knife = breadKnife();
    this.knife.visible = false;
    g.add(this.knife);
    this.spatula = k.group(
      k.at(k.rbox(0.09, 0.002, 0.026, k.metal('steel'), { r: 0.001 }), 0.05, 0, 0),
      k.at(k.rbox(0.09, 0.014, 0.018, k.wood('oak'), { r: 0.005 }), -0.045, 0.004, 0),
    );
    this.spatula.visible = false;
    g.add(this.spatula);
  }

  // 접시 · 오일/꿀/페퍼밀 · 토핑 밧드
  buildExtras() {
    const k = kit;
    const g = this.stage;
    // 접시 (완성품은 이 접시째로 서빙된다)
    this.dish = new THREE.Group();
    this.dish.position.set(PLATE.x, Y0, PLATE.z);
    this.dish.add(k.at(k.cyl(PLATE.r, PLATE.r * 0.8, 0.014, k.ceramic('#efebe3'), { seg: 40 }), 0, 0.007, 0));
    this.dish.add(k.at(k.torus(PLATE.r - 0.004, 0.006, k.ceramic('#efebe3')), 0, 0.014, 0, Math.PI / 2));
    for (const c of this.dish.children) c.userData.plate = true;
    g.add(this.dish);
    this.top = 0.014;
    // 뒷줄 소품: 오일병, 꿀병, 페퍼밀
    this.oil = k.group(k.at(k.cyl(0.028, 0.03, 0.17, k.mat('#6b7a2a', { opacity: 0.75, rough: 0.1 })), 0, 0.085, 0), k.at(k.cyl(0.01, 0.012, 0.05, k.metal('black')), 0, 0.19, 0));
    this.oil.position.set(0.36, Y0, -0.26);
    g.add(this.oil);
    this.honey = k.group(k.at(k.cyl(0.035, 0.035, 0.09, k.mat('#d49529', { opacity: 0.8, rough: 0.1 })), 0, 0.045, 0), k.at(k.cyl(0.037, 0.037, 0.02, k.wood('oak')), 0, 0.1, 0));
    this.honey.position.set(0.27, Y0, -0.27);
    g.add(this.honey);
    this.mill = k.group(k.at(k.cyl(0.022, 0.026, 0.16, k.wood('walnut')), 0, 0.08, 0), k.at(k.sphere(0.022, k.wood('walnut')), 0, 0.165, 0), k.at(k.cyl(0.006, 0.006, 0.02, k.metal('steel')), 0, 0.19, 0));
    this.mill.position.set(0.44, Y0, -0.2);
    g.add(this.mill);
    // 9차: 스테인리스 호텔 팬(GN 1/6)에 담긴 3D 재료 + 스프레드 병 (도마 뒤 한 줄 / 병은 왼쪽 앞)
    const panIds = new Set();
    const spreads = new Set();
    for (const s of this.ctx.order.steps) {
      // v13: 헷갈리게 하는 재료(distractors) 바트는 두지 않는다 — 이 메뉴에 들어가는 재료만
      if (s.type === 'plate') s.layers.forEach((x) => x !== 'bread_top' && panIds.add(x));
      if (s.type === 'spread') s.spreads.forEach((x) => spreads.add(x));
    }
    this.pans = {};
    this.panFood = {};
    const panList = [...panIds].filter((id) => {
      const ing = this.ctx.ing(id);
      return ing && ing.kind !== 'loaf' && ing.kind !== 'spread';
    });
    const gap = panList.length > 3 ? 0.133 : 0.135;
    panList.forEach((id, i) => {
      const ing = this.ctx.ing(id);
      const pan = hotelPan(ing.name);
      // 가운데 정렬: 3개면 -0.135 ~ +0.135, 4개면 -0.2 ~ +0.2
      pan.position.set((i - (panList.length - 1) / 2) * gap, Y0, -0.27);
      g.add(pan);
      this.pans[id] = pan;
      this.prepped[id] = pan;
      // 썰지 않는 재료는 팬 안에 바로 담아 둔다 (썰 재료는 플레이팅 때 슬라이스를 옮겨 담는다)
      const willSlice = this.ctx.order.steps.some((st) => st.type === 'slice' && st.items.some((i) => i.ing === id));
      if (!willSlice) {
        const food = panPortion(id, ing);
        food.position.copy(pan.position).add(V(0, 0.006, 0));
        g.add(food);
        this.panFood[id] = food;
      }
    });
    let jz = 0.24;
    for (const id of spreads) {
      const ing = this.ctx.ing(id);
      const jar = k.group(k.at(k.cyl(0.035, 0.035, 0.08, k.glass()), 0, 0.04, 0), k.at(k.cyl(0.032, 0.032, 0.06, k.mat(ing.color, { rough: 0.5 })), 0, 0.03, 0), k.at(k.cyl(0.038, 0.038, 0.012, k.metal('brass')), 0, 0.086, 0));
      jar.position.set(-0.445, Y0, jz);
      g.add(jar);
      jz -= 0.1;
    }
  }

  start(step) {
    const fn = {
      slice: () => this.slice(step),
      spread: () => this.spread(step),
      plate: () => this.plate(step),
      drizzle: () => this.drizzle(step),
      pepper: () => this.pepper(step),
      halve: () => this.halve(step),
    }[step.type];
    return fn ? fn() : { update() {}, destroy() {} };
  }

  update(dt) {
    this.tw.update(dt);
    if (this.hero && this.heroT < 1) {
      this.heroT = Math.min(1, this.heroT + dt / 0.45);
      const u = this.heroT;
      this.hero.scale.setScalar(0.6 + 0.4 * (1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2));
    }
    for (const it of Object.values(this.items)) it.update(dt);
    // 칼 궤적: 빵은 앞뒤로 톱질하며 내려가고, 과채는 뒤쪽 위 → 앞쪽 아래 푸시컷
    const a = this.knifeAnim;
    if (a) {
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      const e = u * u * (3 - 2 * u);
      if (a.saw) {
        const ph = u * Math.PI * 2 * 3; // 세 번 왕복
        this.knife.position.set(a.x, a.y0 + (a.y1 - a.y0) * e, a.zc + Math.sin(ph) * 0.055 * (1 - 0.35 * u));
        this.knife.rotation.set(0, Math.PI / 2, -0.05 + Math.cos(ph) * 0.025);
        const stroke = Math.floor(ph / Math.PI);
        if (stroke !== a.stroke && u < 1) {
          a.stroke = stroke;
          this.ctx.sound.swish();
          if (u > 0.15) this.crumbs(a.item, a.x, 4);
        }
      } else {
        this.knife.position.set(a.x, a.y0 + (a.y1 - a.y0) * Math.pow(e, 1.2), a.z0 + (a.z1 - a.z0) * e);
        this.knife.rotation.set(0, Math.PI / 2, -0.32 + e * 0.32);
      }
      if (u >= 1 && !a.hit) {
        a.hit = true;
        a.item.cut(a.xm);
        this.ctx.sound.chop();
        this.shake = 0.14;
        this.crumbs(a.item, a.x);
        a.onCut?.();
      }
      if (a.t > a.dur + 0.12) {
        this.knife.position.y = a.y0 + 0.04;
        this.knifeAnim = null;
      }
    }
    // 도마가 '탁' 울리는 진동
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.board.position.y = this.boardY + Math.sin(this.shake * 120) * 0.0012 * (this.shake / 0.14);
    }
    // 부스러기 / 과즙 입자
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (!p.rest) {
        p.v.y -= 2.6 * dt;
        p.m.position.addScaledVector(p.v, dt);
        if (p.m.position.y < YB + 0.0012) {
          p.m.position.y = YB + 0.0012;
          p.rest = true;
        }
      }
      if (p.life < 0.4) p.m.scale.setScalar(Math.max(0.01, p.life / 0.4));
      if (p.life <= 0) {
        this.stage.remove(p.m);
        this.parts.splice(i, 1);
      }
    }
  }

  // xm = 원래 좌표의 절단 위치, xv = 지금 보이는 위치 (조각이 밀려난 만큼)
  pushCut(item, xm, onCut, xv = xm) {
    const ing = item.ing;
    const Hh = ing.kind === 'loaf' ? ing.h : ing.w;
    const base = item.group.position;
    if (ing.kind === 'loaf')
      // 칼날 가운데(원점에서 14cm)가 빵 위에 오도록, 봉긋한 윗면 바로 위에서 시작
      this.knifeAnim = { saw: true, t: 0, dur: 1.05, item, xm, onCut, x: base.x + xv, zc: base.z + 0.14, y0: YB + Hh * 1.12 + 0.006, y1: YB + 0.0015, stroke: -1 };
    else this.knifeAnim = { t: 0, dur: 0.26, item, xm, onCut, x: base.x + xv, z0: base.z - ing.w * 0.8 + 0.14, z1: base.z + ing.w * 0.5 + 0.14, y0: YB + Hh + 0.04, y1: YB + 0.004 };
  }

  crumbs(item, x, count = 16) {
    const ing = item.ing;
    const colors = ing.kind === 'loaf' ? ['#d9b26e', ing.color, '#c99a55'] : ing.slot === 'tomato' ? ['#c9402f', '#f0c64e', '#e05a40'] : [ing.inner, ing.color];
    const Hh = ing.kind === 'loaf' ? ing.h : ing.w;
    for (let i = 0; i < count; i++) {
      const s = ing.kind === 'loaf' ? 0.0009 + Math.random() * 0.0014 : 0.0015 + Math.random() * 0.0025;
      const m = kit.sphere(s, kit.mat(colors[i % colors.length], { rough: ing.kind === 'loaf' ? 0.9 : 0.25, clearcoat: ing.kind === 'loaf' ? 0 : 0.8 }), { ws: 6, hs: 4 });
      m.castShadow = false;
      m.position.set(x, YB + Hh * (0.3 + Math.random() * 0.5), item.group.position.z + (Math.random() - 0.5) * ing.w);
      this.stage.add(m);
      this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.25 + Math.random() * 0.45, (Math.random() - 0.2) * 0.3), life: 2.2 + Math.random() });
    }
  }

  // ───────── 1. 결 살려 썰기 ─────────
  // 가이드: 재료 윗면을 감싸는 반투명 민트 평면 + 골드 점선 아치(항상 위에 그림) + 위아래로 움직이는 가상 칼날과 '↓ 여기를 따라 긋기'
  slice(step) {
    const ctx = this.ctx;
    const BOARD = this.B;
    const STAGING = this.staging;
    const queue = step.items.map((i) => ({ ...i, ing: ctx.ing(i.ing) }));
    let idx = -1;
    let item;
    let guides = [];
    let scores = [];
    let down = null;
    let t = 0;
    const self = this;
    const arrow = guideArrow();
    const blade = guideBlade();
    this.stage.add(arrow, blade);

    const clearGuides = () => {
      for (const g of guides) g.parts.forEach((m) => m.parent?.remove(m));
      guides = [];
    };

    const setup = () => {
      idx++;
      clearGuides();
      if (idx >= queue.length) {
        this.knife.visible = false;
        arrow.visible = blade.visible = false;
        const avg = scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length);
        return ctx.done(avg, `칼질 정확도 ${Math.round(avg)}점`);
      }
      const { ing, cuts } = queue[idx];
      item = new SliceableItem(ing);
      const ix = BOARD.x + (ing.kind === 'loaf' ? LOAF_SHIFT : 0.02);
      item.group.position.set(ix, YB + 0.15, BOARD.z);
      this.stage.add(item.group);
      this.tw.to(item.group, { pos: V(ix, YB, BOARD.z), dur: 0.35 });
      this.items[ing.id] = item;
      const H = ing.kind === 'loaf' ? ing.h : ing.w;
      // 빵은 꽁다리 4.5cm 뒤부터 2.2cm 두께로, 과채는 고르게 나눠 썬다
      const gx = (i) => (ing.kind === 'loaf' ? -ing.len / 2 + 0.045 + (i - 1) * 0.022 : -ing.len / 2 + (ing.len * i) / (cuts + 1));
      for (let i = 1; i <= cuts; i++) guides.push(makeGuide(item, gx(i), H));
      item.pending = guides.map((g) => g.x);
      ctx.view(V(BOARD.x + (ing.kind === 'loaf' ? LOAF_SHIFT * 0.4 : -0.02), YB + 0.03, BOARD.z), Math.max(0.34, ing.len + (ing.kind === 'loaf' ? 0.24 : 0.2)), 0.72, 0.36); // 살짝 비스듬히 봐야 윗면을 감싸는 아치가 입체로 보인다
      const thick = ((cuts > 1 ? gx(2) - gx(1) : ing.len / 2) * 100).toFixed(1);
      ctx.ui.step(`${ing.name} 썰기 (${idx + 1}/${queue.length})`, '골드 선을 따라 아래로 쓱');
      ctx.ui.meter(`<div class="wb-chips"><span>${cuts}번 썰기</span><span>단면이 옆으로 쓰러져요</span></div>`);
      ctx.ui.actions([]);
      this.knife.visible = true;
    };

    const local = (ndc) => {
      const H = item.ing.kind === 'loaf' ? item.ing.h : item.ing.w;
      const p = ctx.planeHit(ndc, YB + H * 0.55);
      return p ? p.sub(item.group.position) : null;
    };

    setup();
    // 9차 판정: 화면(px) 기준. 3D 뷰포트 폭의 ±18% 안에서 아래(또는 대각선)로 30px 이상 그으면 유효한 칼질,
    // 칼날은 가장 가까운 가이드로 자석처럼 스냅되어 그 선을 따라 썰린다. 유효한 칼질은 85~100점.
    const guidePx = (g) => {
      const base = item.group.position;
      return ctx.toScreen(V(base.x + g.vx, YB + g.top * 0.5, base.z));
    };
    void local;
    return {
      down(e, ndc) {
        down = item ? ctx.ndcToPx(ndc) : null;
      },
      move(e, ndc) {
        const p = ctx.planeHit(ndc, YB + 0.13);
        if (p && !self.knifeAnim) {
          self.knife.position.copy(p);
          self.knife.rotation.set(0, Math.PI / 2, down ? -0.6 : -0.25);
        }
      },
      up(e, ndc) {
        if (!down || !item) return;
        if (self.knifeAnim) {
          down = null;
          return; // 톱질이 끝날 때까지 다음 칼질은 받지 않는다
        }
        const a = down;
        const b = ctx.ndcToPx(ndc);
        down = null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 30 || Math.abs(dy) < Math.abs(dx) * 0.45) {
          ctx.sound.swish();
          ctx.ui.pop('재료 위를 위에서 아래로 쓱 그어요', false);
          return;
        }
        // 스트로크 직선이 각 가이드 높이(y)를 지나는 x 와 가이드의 화면 x 차이
        const tol = ctx.viewW() * 0.18;
        let g = null;
        let off = Infinity;
        for (const q of guides) {
          if (q.cut) continue;
          const gp = guidePx(q);
          const t = clamp((gp.y - a.y) / dy, -0.25, 1.25);
          const o = Math.abs(a.x + dx * t - gp.x);
          if (o < off) {
            off = o;
            g = q;
          }
        }
        if (!g || off > tol) return ctx.ui.pop('골드 아치 근처를 지나가게 그어요', false);
        // 정확할수록 100점, 허용 폭 끝이어도 85점 (기울기는 감점하지 않는다: 칼날이 가이드로 스냅되므로)
        const score = clamp(Math.round(100 - 15 * Math.pow(off / tol, 1.15)), 85, 100);
        g.cut = true;
        g.parts.forEach((m) => m.parent?.remove(m));
        item.pending = guides.filter((q) => !q.cut).map((q) => q.x);
        scores.push(score);
        // 칼이 가이드 위에서 내려가 도마에 닿는 순간 잘리고, 조각이 옆으로 쓰러진다
        const it2 = item;
        self.pushCut(it2, g.x, () => ctx.ui.popAt(V(it2.group.position.x + g.vx, YB + 0.12, BOARD.z), `${score}점 · ${scoreWord(score)}`, score >= 70), g.vx);
        if (guides.every((q) => q.cut)) {
          const it = item;
          const [sx, sz] = STAGING[Math.min(idx, STAGING.length - 1)];
          const wait = it.ing.kind === 'loaf' ? 2.05 : 1.15; // 칼질 + 조각이 쓰러지는 걸 보여준 뒤 옮긴다
          ctx.later(wait, () => self.tw.to(it.group, { pos: V(sx, Y0, sz), dur: 0.5, arc: 0.05 }));
          item = null;
          ctx.later(wait + 0.5, setup);
        }
      },
      update(dt = 1 / 60) {
        t += dt;
        // 가이드는 밀려난 조각을 따라 움직이고, 다음에 썰 가이드 위에 화살표와 가상 칼날
        let next = null;
        for (const g of guides) {
          if (g.cut) continue;
          g.vx = item ? item.visualX(g.x) : g.x;
          for (const m of g.parts) m.position.x = g.vx;
          g.plane.material.opacity = 0.2 + Math.sin(t * 4) * 0.06;
          if (!next) next = g;
        }
        const show = !!(next && item && !self.knifeAnim);
        arrow.visible = blade.visible = show;
        if (show) {
          const base = item.group.position;
          const top = next.top;
          arrow.position.set(base.x + next.vx, YB + top + 0.05 + Math.abs(Math.sin(t * 3)) * 0.012, base.z - item.ing.w * 0.15);
          const u = (t * 0.9) % 1;
          blade.position.set(base.x + next.vx, YB + top + 0.03 - u * (top + 0.03), base.z);
          blade.material.opacity = 0.55 * Math.sin(u * Math.PI);
        }
      },
      destroy() {
        clearGuides();
        self.stage.remove(arrow, blade);
        self.knife.visible = false;
      },
    };
  }

  // 빵 슬라이스 하나를 눕혀서 반환 (첫 번째 = 바닥, 두 번째 = 윗면)
  breadSlice(n = 0) {
    const loaf = Object.values(this.items).find((i) => i.ing.kind === 'loaf');
    if (!loaf) return null;
    const pieces = loaf.slices();
    const piece = pieces[n] ?? pieces[pieces.length - 1] ?? loaf.pieces[0];
    if (piece.flat) return piece.flat;
    // 쓰러진 슬라이스는 누운 자리의 중심(힌지 왼쪽으로 빵 높이 절반)에서 이어 받는다
    const world = piece.hinge ? piece.hinge.localToWorld(V(-loaf.ing.h / 2, 0, 0)) : piece.mesh.getWorldPosition(new THREE.Vector3());
    const flat = layFlat(piece, loaf.ing);
    flat.position.copy(this.stage.worldToLocal(world));
    this.stage.add(flat);
    piece.flat = flat;
    flat.userData.ing = loaf.ing;
    flat.userData.face = piece.mesh.userData.face;
    flat.userData.x1 = piece.x1;
    return flat;
  }

  // ───────── 2. '쓰윽, 쓰윽' 리본 스프레드 ─────────
  // 빵 가운데 봉긋한 스쿱(돌롭)을 버터나이프로 길게 한 번 그을 때마다, 칼날 폭만큼 넓고 도톰한 리본 층이
  // 양옆 크림 결(리지)을 세우며 빵 면적의 30~35%씩 펴 발린다. 3~4번이면 100%.
  // 층은 96x96 격자 + 높이 캔버스 변위(displacementMap)로 실제 입체 두께가 있고, 나이프는 항상 빵 윗면 + 1.5cm 이상.
  spread(step) {
    const ctx = this.ctx;
    const self = this;
    const BOARD = this.B;
    const slice = this.breadSlice(0);
    const S = 256;
    const BW = 66; // 칼날 폭 (캔버스 px) ≈ 빵 면적의 1/3
    const thick = slice.userData.thickness ?? 0.022;
    const breadTopY = YB + thick;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c2 = cv.getContext('2d');
    const hv = document.createElement('canvas');
    hv.width = hv.height = S;
    const h2 = hv.getContext('2d');
    h2.fillStyle = '#000';
    h2.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const htex = new THREE.CanvasTexture(hv);
    const spreads = step.spreads.map((id) => ctx.ing(id));
    const glossy = spreads.some((s) => s.id !== 'ricotta');
    const mat = new THREE.MeshPhysicalMaterial({ map: tex, bumpMap: htex, bumpScale: 0.006, displacementMap: htex, displacementScale: 0.0058, roughness: glossy ? 0.3 : 0.55, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.clearcoat = glossy ? 0.75 : 0.25;
    mat.clearcoatRoughness = 0.18;
    if (!glossy) mat.sheen = new THREE.Color('#ffffff').convertSRGBToLinear();
    mat.envMapIntensity = 0.8;
    // 단면 좌표(u ∈ -0.5..0.5, v ∈ -0.55..0.65)를 덮는 촘촘한 격자. 빵 단면과 같은 봉우리 리프트를 준다
    const face = slice.userData.face;
    face.geometry.computeBoundingBox();
    const depth = face.geometry.boundingBox.max.x;
    const layerGeo = new THREE.PlaneGeometry(1, 1.2, 96, 96);
    layerGeo.translate(0, 0.05, 0);
    layerGeo.rotateY(Math.PI / 2);
    if (slice.userData.ing && slice.userData.x1 !== undefined) lobeTop(layerGeo, slice.userData.ing, slice.userData.x1);
    const layer = new THREE.Mesh(layerGeo, mat);
    layer.position.x = depth + 0.0012;
    layer.renderOrder = 3;
    layer.castShadow = false;
    face.add(layer);
    // 단면 좌표 → 캔버스 px
    const toPx = (u, v) => [(u + 0.5) * S, (1 - (v + 0.55) / 1.2) * S];
    const shapePath = (g, inset = 0.035) => {
      const k = 1 - inset * 2;
      g.beginPath();
      traceLoaf(g, (u, v) => toPx(u * k, v * k));
      g.closePath();
    };
    this.tw.to(slice, { pos: V(BOARD.x, YB, BOARD.z), dur: 0.5, arc: 0.06 });
    ctx.view(V(BOARD.x, breadTopY, BOARD.z), 0.3, 0.78, 0.25); // 비스듬히 봐야 리본의 두께와 크림 결이 보인다
    this.spatula.visible = true;
    this.spatula.rotation.order = 'YXZ';
    this.spatula.rotation.set(0.35, SP_YAW, 0); // 수평 각도는 고정 (커서 방향으로 돌지 않는다)
    const spGoal = V(BOARD.x + SP_OFF.x, breadTopY + 0.035, BOARD.z + SP_OFF.z);
    this.spatula.position.copy(spGoal);
    let wrist = 0;
    let wristGoal = 0;

    // 도포율 샘플 (단면 안쪽 점들)
    const samples = [];
    const probe = document.createElement('canvas').getContext('2d');
    shapePath(probe, 0.06);
    for (let i = 0; i < 28; i++) for (let j = 0; j < 28; j++) {
      const x = ((i + 0.5) / 28) * S;
      const y = ((j + 0.5) / 28) * S;
      if (probe.isPointInPath(x, y)) samples.push({ x, y, on: false });
    }

    // 스쿱 덩어리 (돌롭): 소용돌이 결이 있는 봉긋한 크림 — 그을 때마다 낮아진다
    const dollopAt = () => self.stage.worldToLocal(face.localToWorld(V(depth, 0.02, 0)));
    let dollop = null;
    const makeDollop = (sp) => {
      if (dollop) self.stage.remove(dollop);
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        pts.push(new THREE.Vector2(Math.max(0.0005, 0.026 * Math.sin(Math.PI * (1 - u) * 0.5) ** 0.7 * (1 - 0.18 * Math.sin(u * 9))), u * 0.022));
      }
      const geo = new THREE.LatheGeometry(pts, 36);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = pos.getY(i);
        const a = Math.atan2(z, x) + y * 180;
        const k = 1 + Math.sin(a * 3) * 0.08;
        pos.setX(i, x * k);
        pos.setZ(i, z * k);
      }
      geo.computeVertexNormals();
      const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(sp.color).convertSRGBToLinear(), roughness: sp.id === 'ricotta' ? 0.55 : 0.28, clearcoat: sp.id === 'ricotta' ? 0.3 : 0.8, clearcoatRoughness: 0.15 });
      dollop = new THREE.Mesh(geo, m);
      dollop.castShadow = true;
      dollop.position.copy(dollopAt());
      dollop.scale.setScalar(0.01);
      self.stage.add(dollop);
      self.tw.to(dollop, { scale: V(1, 1, 1), dur: 0.35, delay: 0.45 });
    };

    let si = 0;
    let strokes = 0;
    let stroke = null; // { pts:[{x,y}], snap: ImageData x2, len }
    let pressed = false;
    const scores = [];
    const coverage = () => samples.filter((s) => s.on).length / samples.length;
    const refresh = () => {
      const c = coverage();
      ctx.ui.meter(`<div class="wb-cover"><div class="bar"><i class="${c >= 0.85 ? 'good' : ''}" style="width:${Math.round(c * 100)}%"></i><b style="left:85%"></b></div><span>도포율 ${Math.round(c * 100)}% · 쓰윽 ${strokes}번</span></div>`);
    };
    const setup = () => {
      samples.forEach((s) => (s.on = false));
      strokes = 0;
      const sp = spreads[si];
      makeDollop(sp);
      ctx.ui.step(`${sp.name} 바르기 (${si + 1}/${spreads.length})`, '빵 위를 길게 쓰윽 3~4번');
      ctx.ui.actions([{ label: '다 발랐어요', icon: 'check', primary: true, onClick: finish }]);
      refresh();
    };

    // 리본 한 줄 (전체 획을 한 번에 그려 이음매가 없다)
    const drawRibbon = (pts, sp) => {
      if (pts.length < 2) return;
      const trace = (g, off = 0) => {
        g.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const l = Math.hypot(dx, dy) || 1;
          const x = pts[i].x - (dy / l) * off;
          const y = pts[i].y + (dx / l) * off;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
      };
      for (const g of [c2, h2]) {
        g.save();
        shapePath(g);
        g.clip();
        g.lineCap = 'round';
        g.lineJoin = 'round';
      }
      // 색: 바탕 리본 → 가장자리 크림 결(그림자 + 하이라이트) → 칼날 결
      c2.strokeStyle = shade(sp.color, 0, 1);
      c2.lineWidth = BW;
      trace(c2);
      c2.stroke();
      for (const s of [-1, 1]) {
        c2.strokeStyle = shade(sp.color, 0.09, 0.85);
        c2.lineWidth = 5;
        trace(c2, s * (BW / 2 - 6));
        c2.stroke();
        c2.strokeStyle = shade(sp.color, -0.12, 0.55);
        c2.lineWidth = 2.5;
        trace(c2, s * (BW / 2 - 1.5));
        c2.stroke();
      }
      for (let k = -3; k <= 3; k++) {
        c2.strokeStyle = shade(sp.color, k % 2 ? 0.05 : -0.06, 0.35);
        c2.lineWidth = 1.2;
        trace(c2, k * 7.5);
        c2.stroke();
      }
      // 알갱이 (페스토 잣·머스타드 씨·콩포트 과육)
      for (let i = 0; i < pts.length; i += 2) {
        for (let j = 0; j < 3; j++) {
          c2.fillStyle = sp.bits[Math.floor(Math.random() * sp.bits.length)];
          c2.beginPath();
          c2.ellipse(pts[i].x + (Math.random() - 0.5) * BW * 0.85, pts[i].y + (Math.random() - 0.5) * BW * 0.85, 1 + Math.random() * 2, 0.8 + Math.random() * 1.3, Math.random() * 3, 0, Math.PI * 2);
          c2.fill();
        }
      }
      // 높이: 도톰한 바탕 + 양옆 솟은 리지 + 가운데 얕은 칼 자국
      h2.strokeStyle = 'rgb(120,120,120)';
      h2.lineWidth = BW;
      trace(h2);
      h2.stroke();
      for (const s of [-1, 1]) {
        h2.strokeStyle = 'rgb(245,245,245)';
        h2.lineWidth = 7;
        trace(h2, s * (BW / 2 - 5));
        h2.stroke();
      }
      for (let k = -2; k <= 2; k++) {
        h2.strokeStyle = 'rgb(92,92,92)';
        h2.lineWidth = 2;
        trace(h2, k * 9);
        h2.stroke();
      }
      c2.restore();
      h2.restore();
      tex.needsUpdate = true;
      htex.needsUpdate = true;
    };

    const mark = (pts) => {
      for (const s of samples) {
        if (s.on) continue;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const l2 = dx * dx + dy * dy || 1;
          const t = clamp(((s.x - a.x) * dx + (s.y - a.y) * dy) / l2, 0, 1);
          if (Math.hypot(a.x + dx * t - s.x, a.y + dy * t - s.y) < BW / 2 + 2) {
            s.on = true;
            break;
          }
        }
      }
    };

    // 마지막 마무리: 남은 틈을 매끈하게 채워 100% (나이프로 한 번 쓸어 정리한 결)
    const smoothFill = (sp) => {
      const pts = [];
      for (let y = 0.2; y <= 0.82; y += 0.155) {
        const row = [];
        for (let x = 0.08; x <= 0.92; x += 0.04) row.push({ x: x * S, y: y * S + Math.sin(x * 9) * 3 });
        pts.push(row);
      }
      for (const row of pts) drawRibbon(row, sp);
      samples.forEach((s) => (s.on = true));
    };

    const hitUV = (ndc) => {
      const hit = ctx.raycast(ndc, [layer, face]).find((h) => h.uv && (h.object === layer || h.face?.materialIndex === 0));
      if (!hit) return null;
      if (hit.object === layer) return { x: hit.uv.x * S, y: (1 - hit.uv.y) * S };
      const [x, y] = toPx(hit.uv.x, hit.uv.y);
      return { x, y };
    };

    const endStroke = () => {
      if (!stroke) return;
      const st = stroke;
      stroke = null;
      ctx.sound.spreadStop();
      if (st.len < S * 0.32) return ctx.ui.pop('더 길게 "쓰윽-" 그어요', false);
      strokes++;
      ctx.sound.plop();
      const c = coverage();
      ctx.ui.popAt(dollopAt().setY(breadTopY + 0.03), `쓰윽 ${strokes} · ${Math.round(c * 100)}%`, true);
      if (dollop) self.tw.to(dollop, { scale: V(1 - 0.12 * strokes, Math.max(0.05, 1 - 0.3 * strokes), 1 - 0.12 * strokes), dur: 0.25 });
      if (c >= 0.85 || strokes >= 4) {
        smoothFill(spreads[si]);
        refresh();
        ctx.later(0.35, finish);
      } else refresh();
    };

    function finish() {
      if (finish.lock) return;
      finish.lock = true;
      const c = coverage();
      // 3~4번 만에 덮으면 만점, 더 많이 문지를수록 · 덜 덮을수록 감점
      const strokeScore = strokes <= 4 ? 100 : Math.max(70, 100 - (strokes - 4) * 8);
      const score = Math.round(c >= 0.85 ? strokeScore : (c / 0.85) * 85);
      scores.push(score);
      if (dollop) {
        self.stage.remove(dollop);
        dollop = null;
      }
      ctx.ui.pop(`${spreads[si].name} ${score}점 · ${scoreWord(score)}`, score >= 70);
      si++;
      if (si < spreads.length) {
        finish.lock = false;
        return setup();
      }
      self.spatula.visible = false;
      ctx.ui.actions([]);
      this.spreadIds = step.spreads;
      ctx.done(scores.reduce((s, v) => s + v, 0) / scores.length, '리본 스프레드');
    }
    setup();
    return {
      down(e, ndc) {
        pressed = true;
        const h = hitUV(ndc);
        if (h) {
          stroke = { pts: [h], snapC: c2.getImageData(0, 0, S, S), snapH: h2.getImageData(0, 0, S, S), len: 0 };
          ctx.sound.spreadStart();
        }
      },
      move(e, ndc) {
        const h = hitUV(ndc);
        // 나이프는 빵 윗면보다 절대 아래로 내려가지 않는다
        const p = ctx.planeHit(ndc, breadTopY + 0.015);
        if (p) spGoal.set(p.x + SP_OFF.x, breadTopY + (pressed && h ? 0.015 : 0.035), p.z + SP_OFF.z);
        if (!pressed) return;
        if (!stroke && h) {
          stroke = { pts: [h], snapC: c2.getImageData(0, 0, S, S), snapH: h2.getImageData(0, 0, S, S), len: 0 };
          ctx.sound.spreadStart();
          return;
        }
        if (!stroke || !h) return;
        const last = stroke.pts[stroke.pts.length - 1];
        const d = Math.hypot(h.x - last.x, h.y - last.y);
        if (d < 3) return;
        wristGoal = clamp((h.x - last.x) / 18, -1, 1) * WRIST; // 좌우 속도만큼 손목을 살짝 (±6° 이내)
        stroke.pts.push(h);
        stroke.len += d;
        c2.putImageData(stroke.snapC, 0, 0);
        h2.putImageData(stroke.snapH, 0, 0);
        drawRibbon(stroke.pts, spreads[si]);
        mark(stroke.pts.slice(-3));
        ctx.sound.spreadMove(Math.min(1, d / 30));
        if (dollop) dollop.scale.y = Math.max(0.05, dollop.scale.y - d * 0.0009);
        refresh();
      },
      up() {
        pressed = false;
        wristGoal = 0;
        endStroke();
      },
      update(dt = 1 / 60) {
        // 스쿱은 빵 단면 가운데에 붙어 있는다 (빵이 도마로 미끄러져 오는 동안에도)
        if (dollop) dollop.position.copy(dollopAt());
        // 위치(x·z, 높이)만 부드럽게 따라가고, 회전은 고정 자세 + 미세한 손목 기울기
        self.spatula.position.lerp(spGoal, 1 - Math.exp(-dt * 20));
        wristGoal *= Math.exp(-dt * 6);
        wrist += (wristGoal - wrist) * (1 - Math.exp(-dt * 14));
        self.spatula.rotation.set(0.35, SP_YAW, wrist);
      },
      destroy() {
        ctx.sound.spreadStop();
        if (dollop) self.stage.remove(dollop);
        self.spatula.visible = false;
      },
    };
  }

  // ───────── 3. 플레이팅 (부채꼴 / 쌓기) ─────────
  // 9차: 2D 아이콘 버튼을 없애고, 도마 뒤 스테인리스 호텔 팬(GN 팬)에 담긴 3D 재료를 직접 탭하거나 빵 위로 끌어다 놓는다.
  // 재료는 부드러운 포물선을 그리며 날아가 빵 위에 겹겹이 안착한다. 방금 썬 토마토·아보카도도 팬으로 옮겨 담긴다.
  plate(step) {
    const ctx = this.ctx;
    const self = this;
    const BOARD = this.B;
    this.stack = [];
    const base = this.breadSlice(0);
    if (base) {
      this.dish.attach(base);
      this.tw.to(base, { pos: V(0, this.top, 0), dur: 0.55, arc: 0.08 });
      const th = base.userData.thickness ?? 0.02;
      this.stack.push({ id: 'bread', y0: this.top, y1: this.top + th });
      this.top += th;
      if (this.spreadIds?.length) this.stack.push({ id: this.spreadIds[0], y0: this.top - 0.001, y1: this.top + 0.0025 });
    }
    ctx.view(V((BOARD.x + PLATE.x) / 2 - 0.04, YB, -0.11), 0.96, 1.0);
    // v13: 도마 위에 남은 통식빵 덩어리는 바로 치운다 (바닥 · 윗면 빵은 이미 따로 떼어 둠)
    const target = step.layers;
    const placed = [];
    const layers = new Map();
    // 팬 안의 자리 (각 조각이 팬 바닥에서 살짝 겹쳐 놓인다)
    const panSpot = (id, i, n) => {
      const pan = self.pans[id];
      const t = n > 1 ? i / (n - 1) - 0.5 : 0;
      return pan.position.clone().add(V(t * 0.05, 0.006 + i * 0.002, (i % 2) * 0.012 - 0.006));
    };
    // 1) 썬 재료를 호텔 팬으로 옮겨 담고, 준비 재료는 팬에 담긴 3D 모형을 쓴다
    for (const id of Object.keys(this.pans)) {
      const it = self.items[id];
      let pieces;
      if (it && it.ing.kind !== 'loaf') {
        pieces = it.slices().map((p) => {
          if (p.flat) return p.flat;
          const w = p.mesh.getWorldPosition(new THREE.Vector3());
          const f = layFlat(p, it.ing);
          f.position.copy(self.stage.worldToLocal(w));
          self.stage.add(f);
          p.flat = f;
          return f;
        });
        // 조각의 실제 가운데가 팬 자리에 오도록 (layFlat 원점은 조각 모서리 쪽일 수 있다)
        pieces.forEach((f, i) => {
          f.updateMatrixWorld(true);
          const bb = new THREE.Box3().setFromObject(f);
          const c = self.stage.worldToLocal(bb.getCenter(new THREE.Vector3()));
          const off = c.sub(f.position).setY(0);
          self.tw.to(f, { pos: panSpot(id, i, pieces.length).sub(off), dur: 0.5, arc: 0.06, delay: 0.1 + i * 0.05 });
        });
        it.group.visible = false; // 남은 꽁다리(끝 조각)는 팬 밖에 널브러지지 않게 치운다
      } else pieces = [self.panFood[id]].filter(Boolean);
      layers.set(id, pieces);
    }
    // 윗면 빵은 도마 왼쪽에 대기
    const topBread = target.includes('bread_top') ? this.breadSlice(1) : null;
    for (const it of Object.values(self.items)) if (it.ing.kind === 'loaf') it.group.visible = false;
    if (topBread) {
      this.tw.to(topBread, { pos: V(BOARD.x - 0.13, YB, BOARD.z + 0.02), quat: new THREE.Quaternion(), dur: 0.5, arc: 0.05 });
      layers.set('bread_top', [topBread]);
    }
    const homeOf = new Map();
    for (const [id, ps] of layers) homeOf.set(id, ps.map((p, i) => (id === 'bread_top' ? V(BOARD.x - 0.13, YB, BOARD.z + 0.02) : panSpot(id, i, ps.length))));

    const put = (id) => {
      if (placed.includes(id)) return ctx.ui.pop('이미 올렸어요', false);
      const pieces = layers.get(id);
      if (!pieces?.length) return ctx.ui.pop('먼저 재료를 썰어야 해요', false);
      placed.push(id);
      const fan = step.style === 'fan' && id !== 'bread_top' && pieces.length > 1;
      const n = pieces.length;
      let h = 0;
      const y0 = self.top;
      pieces.forEach((p, i) => {
        self.dish.attach(p);
        const t = n > 1 ? i / (n - 1) - 0.5 : 0;
        const pos = fan ? V(t * 0.1, self.top + i * 0.002, Math.abs(t) * -0.03 + 0.01) : V((i - (n - 1) / 2) * (n > 2 ? 0.035 : 0.02), self.top, 0);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(fan ? 0.12 : 0, fan ? t * 0.9 : i * 0.6, fan ? -t * 0.15 : 0));
        // 부드러운 포물선 (팬에서 높이 떠올랐다가 빵 위로 사뿐히)
        self.tw.to(p, { pos, quat: q, dur: 0.62, arc: 0.11, delay: i * 0.06 });
        h = Math.max(h, (p.userData.thickness ?? p.userData.h ?? 0.01) * (fan ? 1.2 : 1));
      });
      self.top += h;
      self.stack.push({ id, y0, y1: self.top });
      ctx.later(0.62 + (n - 1) * 0.06, () => ctx.sound.plop());
      refresh();
    };

    const undo = () => {
      const id = placed.pop();
      if (!id) return;
      const pieces = layers.get(id);
      const homes = homeOf.get(id);
      let h = 0;
      pieces.forEach((p, i) => {
        h = Math.max(h, p.userData.thickness ?? p.userData.h ?? 0.01);
        self.stage.attach(p);
        self.tw.to(p, { pos: homes[i], dur: 0.45, arc: 0.06 });
      });
      self.top -= h * (step.style === 'fan' ? 1.2 : 1);
      self.stack.pop();
      ctx.sound.tap();
      refresh();
    };

    const refresh = () => {
      ctx.ui.meter(`<div class="wb-seq">${target.map((id, i) => `<span class="${placed[i] === id ? 'ok' : placed[i] ? 'ng' : ''}"><i>${i + 1}</i>${id === 'bread_top' ? '윗면 빵' : ctx.ing(id).name}</span>`).join('')}</div>`);
      ctx.ui.actions([
        { label: '하나 빼기', icon: 'undo', onClick: undo, disabled: !placed.length },
        { label: '완성', icon: 'check', primary: true, onClick: done, disabled: !placed.length },
      ]);
      for (const [id, pan] of Object.entries(self.pans)) pan.userData.label.visible = !placed.includes(id);
      if (topBread) topBread.userData.ring = !placed.includes('bread_top');
    };

    const done = () => {
      const l = lcs(placed, target);
      const wrong = placed.length - l;
      const score = clamp(Math.round((100 * l) / target.length - wrong * 12), 0, 100);
      ctx.ui.pop(score >= 95 ? '레시피 그대로, 정갈해요' : `레시피 정확도 ${score}점`, score >= 70);
      ctx.sound.plate();
      ctx.ui.actions([]);
      for (const pan of Object.values(self.pans)) pan.userData.label.visible = false;
      ctx.done(score, `레시피 정확도 ${score}점`);
    };

    // 화면 탭/드래그 → 어떤 팬(또는 윗면 빵)인가
    const pickId = (ndc) => {
      const objs = [...Object.values(self.pans), ...(topBread && !placed.includes('bread_top') ? [topBread] : [])];
      const hit = ctx.raycast(ndc, objs)[0];
      if (!hit) return null;
      let o = hit.object;
      while (o && o.parent !== self.stage) o = o.parent;
      if (o === topBread) return 'bread_top';
      return Object.entries(self.pans).find(([, p]) => p === o)?.[0] ?? null;
    };
    let drag = null;
    ctx.ui.step(step.style === 'fan' ? '부채꼴로 정갈하게 올리기' : '레시피 순서대로 쌓기', '팬의 재료를 순서대로 탭');
    refresh();
    return {
      down(e, ndc) {
        const id = pickId(ndc);
        if (!id || placed.includes(id)) return;
        const pieces = layers.get(id);
        if (!pieces?.length) return ctx.ui.pop('먼저 재료를 썰어야 해요', false);
        drag = { id, px: ctx.ndcToPx(ndc), moved: 0, lead: pieces[0], home: pieces[0].position.clone() };
        ctx.sound.tap();
      },
      move(e, ndc) {
        if (!drag) return;
        const q = ctx.ndcToPx(ndc);
        drag.moved = Math.max(drag.moved, Math.hypot(q.x - drag.px.x, q.y - drag.px.y));
        if (drag.moved < 10) return;
        // 끌고 있는 재료가 손가락을 따라 테이블 위로 떠서 움직인다
        const p = ctx.planeHit(ndc, Y0 + 0.09);
        if (p) drag.lead.position.lerp(p, 0.6);
      },
      up(e, ndc) {
        if (!drag) return;
        const d = drag;
        drag = null;
        const p = ctx.planeHit(ndc, Y0 + self.top);
        const nearPlate = p && Math.hypot(p.x - PLATE.x, p.z - PLATE.z) < PLATE.r * 1.7;
        if (d.moved < 10 || nearPlate) put(d.id);
        else {
          self.tw.to(d.lead, { pos: d.home, dur: 0.35, arc: 0.04 });
          ctx.ui.pop('빵 위에 놓아야 올라가요', false);
        }
      },
      update(dt = 1 / 60) {
        // 다음에 올릴 재료 팬을 살짝 반짝여 안내
        const next = target[placed.length];
        for (const [id, pan] of Object.entries(self.pans)) {
          const glow = pan.userData.glow;
          if (glow) glow.material.opacity = id === next ? 0.35 + Math.sin(performance.now() / 180) * 0.2 : 0;
        }
        void dt;
      },
      destroy() {
        for (const pan of Object.values(self.pans)) pan.userData.label.visible = false;
      },
    };
  }

  // ───────── 샌드위치 대각선 반 자르기 ─────────
  // 빵칼이 대각선을 따라 '사각-' 내려가 자르면, 두 조각이 벌어지며 상추·토마토·베이컨 층의 단면이 드러난다.
  // 실제 자르기: 같은 재료를 두 벌로 나눠 서로 반대쪽 클리핑 평면으로 잘라 내고, 잘린 면에는 층 단면 텍스처 캡을 붙인다.
  halve(step) {
    const ctx = this.ctx;
    const self = this;
    const dish = this.dish;
    const contents = dish.children.filter((c) => !c.userData.plate);
    // 단면 크기는 빵 슬라이스 기준 (옆으로 삐져나온 상추 잎은 빼고)
    const box = new THREE.Box3();
    const breads = contents.filter((c) => c.userData.ing?.kind === 'loaf');
    for (const c of breads.length ? breads : contents) box.expandByObject(c);
    const inv = new THREE.Matrix4().copy(dish.matrixWorld).invert();
    box.applyMatrix4(inv);
    const yTop = box.max.y;
    const yTopStack = this.stack?.length ? this.stack[this.stack.length - 1].y1 : yTop;
    const yBot = box.min.y;
    const diag = V(1, 0, 1).normalize();
    const half = Math.min(0.11, Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.01);
    ctx.view(V(PLATE.x, Y0 + 0.05, PLATE.z), 0.38, 0.8, 0.15);
    ctx.ui.step(step.label ?? '대각선 반 자르기', '골드 점선 따라 대각선으로');
    ctx.ui.meter(`<div class="wb-chips"><span>대각선 한 번</span><span>단면이 벌어져요</span></div>`);
    ctx.ui.actions([]);
    // 가이드: 샌드위치 위 대각선 골드 점선
    const guide = new THREE.Group();
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc95a').convertSRGBToLinear(), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
    for (let k = -5; k <= 5; k += 2) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(half * 0.14, 0.002, 0.003), gm);
      d.position.set((k / 6) * half, 0, 0);
      d.renderOrder = 31;
      guide.add(d);
    }
    guide.position.set(0, yTop + 0.006, 0);
    guide.rotation.y = -Math.PI / 4;
    dish.add(guide);
    const arrow = guideArrow();
    self.stage.add(arrow);
    let down = null;
    let anim = null;
    let t = 0;
    let finished = false;
    const toWorld = (v) => dish.localToWorld(v.clone());
    const center = () => ctx.toScreen(self.stage.worldToLocal(toWorld(V(0, yTop, 0))));
    const split = (score) => {
      const n = V(1, 0, -1).normalize(); // 대각선에 수직
      const mk = (sign) => {
        const g = new THREE.Group();
        dish.add(g);
        const plane = new THREE.Plane();
        g.userData.local = new THREE.Plane(n.clone().multiplyScalar(sign), 0);
        g.userData.plane = plane;
        return g;
      };
      const A = mk(1);
      const Bh = mk(-1);
      for (const c of contents) {
        const c2 = c.clone(true);
        A.attach(c);
        Bh.add(c2);
        c2.position.copy(c.position);
        c2.quaternion.copy(c.quaternion);
        c2.scale.copy(c.scale);
        for (const [grp, root] of [
          [A, c],
          [Bh, c2],
        ])
          root.traverse((m) => {
            if (!m.isMesh) return;
            const cl = (mt) => {
              const x = mt.clone();
              x.clippingPlanes = [grp.userData.plane];
              x.clipShadows = true;
              x.side = THREE.DoubleSide;
              return x;
            };
            m.material = Array.isArray(m.material) ? m.material.map(cl) : cl(m.material);
          });
      }
      // 잘린 면 캡 (층 단면)
      const tex = sectionTexture(self.stack ?? [], yBot, yTopStack);
      const H = (yTop - yBot) * 0.97;
      // 대각선이 빵 사각형을 지나는 길이 (짧은 변 기준)
    const L = 2 * Math.SQRT2 * Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 * 0.94;
      for (const [grp, sign] of [
        [A, 1],
        [Bh, -1],
      ]) {
 const cap = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.6, side: THREE.DoubleSide }));
        cap.userData.noOutline = true;
        cap.position.copy(n.clone().multiplyScalar(sign * 0.0006)).setY(yBot + H / 2);
        cap.rotation.y = sign > 0 ? -Math.PI / 4 : (3 * Math.PI) / 4;
        grp.add(cap);
      }
      self.halves = [A, Bh];
      // 두 조각이 벌어지며 각자 제자리에서 돌아, 잘린 단면 두 개가 나란히 정면(손님 쪽)을 보게 놓인다
      const q = (a) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0));
      const cA = n.clone().multiplyScalar(0.026); // 각 삼각 조각의 대략적인 무게중심
      const cB = n.clone().multiplyScalar(-0.026);
      // 각 조각의 잘린 면은 그룹 원점(접시 중심)을 지나므로, 원점 기준으로 돌리면 단면이 제자리에서 정면을 본다
      const place = (g, c0, ang, to, tilt, lean = 0) => {
        const qq = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), tilt).multiply(q(ang + lean));
        // 먼저 살짝 벌어졌다가 → 돌아서 단면을 보인다
        self.tw.to(g, { pos: c0.clone().multiplyScalar(0.7), dur: 0.35 });
        ctx.later(0.38, () => self.tw.to(g, { pos: to, quat: qq, dur: 0.6, arc: 0.02 }));
      };
      // 왼쪽 조각: 단면이 정면, 살짝 비스듬히 세움 / 오른쪽 조각: 옆에 약 35° 눕혀 기대어 단면이 위 · 앞을 본다
      place(Bh, cB, (5 * Math.PI) / 4, V(-0.04, 0.004, 0.03), -0.16, -0.12);
      place(A, cA, Math.PI / 4, V(0.05, 0.045, -0.005), -0.61, 0.3);
      ctx.sound.plop();
      ctx.later(1.6, () => {
        ctx.ui.pop(`단면이 살아 있어요 · ${scoreWord(score)}`, true);
        ctx.done(score, '대각선 반 자르기');
      });
    };
    return {
      down(e, ndc) {
        if (anim || finished) return;
        down = ctx.ndcToPx(ndc);
      },
      move(e, ndc) {
        if (anim || finished) return;
        const p = ctx.planeHit(ndc, Y0 + yTop + 0.05);
        if (p) {
          self.knife.visible = true;
          self.knife.position.copy(p);
          self.knife.rotation.set(0, -Math.PI / 4, -0.4);
        }
      },
      up(e, ndc) {
        if (anim || finished || !down) return;
        const a = down;
        const b = ctx.ndcToPx(ndc);
        down = null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 30) return ctx.ui.pop('샌드위치를 가로질러 길게 그어요', false);
        const c = center();
        const distC = Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx) / len;
        const tol = ctx.viewW() * 0.18;
        if (distC > tol) return ctx.ui.pop('샌드위치 한가운데를 지나가게 그어요', false);
        const e1 = ctx.toScreen(self.stage.worldToLocal(toWorld(diag.clone().multiplyScalar(half).setY(yTop))));
        const la = Math.atan2(e1.y - c.y, e1.x - c.x);
        let dA = Math.abs(Math.atan2(dy, dx) - la) % Math.PI;
        dA = Math.min(dA, Math.PI - dA);
        if (dA > 0.75) return ctx.ui.pop('골드 점선처럼 대각선으로 그어요', false);
        const score = clamp(Math.round(100 - 15 * Math.min(1, (dA / 0.75 + distC / tol) / 2)), 85, 100);
        dish.remove(guide);
        arrow.visible = false;
        anim = { t: 0, score };
        self.knife.visible = true;
        ctx.sound.swish();
      },
      update(dt = 1 / 60) {
        t += dt;
        if (!anim && !finished) {
          arrow.visible = true;
          const w = self.stage.worldToLocal(toWorld(V(0, yTop + 0.05 + Math.abs(Math.sin(t * 3)) * 0.012, 0)));
          arrow.position.copy(w);
        }
        // 클리핑 평면은 각 조각을 따라 움직인다
        if (self.halves)
          for (const g of self.halves) {
            g.updateMatrixWorld(true);
            g.userData.plane.copy(g.userData.local).applyMatrix4(g.matrixWorld);
          }
        if (!anim) return;
        anim.t += dt;
        const u = Math.min(1, anim.t / 0.9);
        // 대각선을 따라 앞뒤로 톱질하며 내려간다 (사각- 사각-)
        const ph = u * Math.PI * 4;
        const along = Math.sin(ph) * 0.03;
        const pLocal = diag.clone().multiplyScalar(along).setY(yTop + 0.02 - (yTop + 0.02 - yBot) * u);
        // 칼날 중심(원점에서 14cm)이 샌드위치 위에 오도록 손잡이 쪽으로 물린다
        const w = self.stage.worldToLocal(toWorld(pLocal.add(diag.clone().multiplyScalar(-0.14))));
        self.knife.position.copy(w);
        self.knife.rotation.set(0, -Math.PI / 4, -0.05 + Math.cos(ph) * 0.03);
        const stroke = Math.floor(ph / Math.PI);
        if (stroke !== anim.stroke) {
          anim.stroke = stroke;
          ctx.sound.swish();
        }
        if (u >= 1) {
          const s = anim.score;
          anim = null;
          finished = true;
          ctx.sound.chop();
          self.shake = 0.14;
          self.knife.visible = false;
          split(s);
        }
      },
      destroy() {
        dish.remove(guide);
        self.stage.remove(arrow);
        self.knife.visible = false;
      },
    };
  }

  // ───────── 4. 드리즐 (지그재그) ─────────
  drizzle(step) {
    const ctx = this.ctx;
    const self = this;
    const honey = step.liquid === 'honey';
    const bottle = honey ? this.honey : this.oil;
    const home = bottle.position.clone();
    const mat = kit.mat(honey ? '#c98a1f' : '#a8a02a', { rough: 0.05, opacity: 0.82, env: 1.4 });
    const y = this.top + 0.004;
    // v16: 접시 위 음식의 실제 최고점. 병 노즐 끝은 항상 그보다 8cm 위 허공, 줄기만 표면(+3mm)에 내려앉는다
    const foodTop = getFoodTopY(self.dish);
    const NOZZLE_Y = foodTop + 0.08;
    const surfY = y; // 줄기가 닿는 곳 = 실제 빵 · 재료 윗면(+3~4mm)
    const stream = kit.cyl(0.0016, 0.0016, 1, mat, { seg: 6 });
    stream.visible = false;
    stream.castShadow = false;
    this.stage.add(stream);
    this.drizzleStream = stream;
    const placeStream = (pDish) => {
      const nz = lowestPoint(bottle);
      if (!nz || !pDish) return (stream.visible = false);
      const a = this.stage.worldToLocal(nz.clone());
      const b = this.stage.worldToLocal(self.dish.localToWorld(pDish.clone().setY(surfY)));
      const len = a.distanceTo(b);
      stream.visible = len > 0.01;
      stream.position.copy(a).add(b).multiplyScalar(0.5);
      stream.scale.set(1, len, 1);
      stream.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    };
    ctx.view(V(PLATE.x, Y0 + 0.05, PLATE.z), 0.36, 1.15);
    ctx.ui.step(honey ? '꿀 드리즐' : '엑스트라 버진 올리브오일', '접시 위를 지그재그로');
    let path = null;
    let reversals = 0;
    let lastDir = 0;
    let lastTurnX = 0;
    let inside = 0;
    let total = 0;
    const segs = [];
    const finish = () => {
      const ratio = total ? inside / total : 0;
      const score = Math.round(clamp(30 + reversals * 14, 0, 100) * Math.sqrt(ratio || 0.3));
      ctx.ui.pop(`지그재그 ${reversals}번 · ${score}점`, score >= 70);
      stream.visible = false;
      this.tw.to(bottle, { pos: home, quat: new THREE.Quaternion(), dur: 0.4 });
      ctx.sound.pourStop();
      ctx.done(score, '드리즐');
    };
    ctx.ui.meter(`<div class="wb-chips"><span>지그재그 4번 이상</span></div>`);
    ctx.ui.actions([{ label: '완료', icon: 'check', primary: true, onClick: finish }]);
    return {
      down(e, ndc) {
        const p = ctx.planeHit(ndc, Y0 + y);
        if (!p) return;
        path = [p.sub(self.dish.position)];
        ctx.sound.pourStart();
      },
      move(e, ndc) {
        const w = ctx.planeHit(ndc, NOZZLE_Y + 0.05);
        if (w) {
          bottle.position.copy(w);
          bottle.quaternion.setFromEuler(new THREE.Euler(0, 0, path ? 2.2 : 0.4));
          keepAbove(bottle, NOZZLE_Y); // 기울어진 병 몸체 · 노즐이 빵을 뚫지 않게
        }
        if (!path) return (stream.visible = false);
        const p = ctx.planeHit(ndc, Y0 + y);
        if (!p) return;
        p.sub(self.dish.position);
        placeStream(p);
        const q = path[path.length - 1];
        const d = p.distanceTo(q);
        if (d < 0.006) return;
        const dir = Math.sign(p.x - q.x);
        if (dir && dir !== lastDir) {
          if (lastDir && Math.abs(p.x - lastTurnX) > 0.012) reversals++;
          lastDir = dir;
          lastTurnX = p.x;
        }
        total++;
        if (Math.hypot(p.x, p.z) < PLATE.r * 0.85) inside++;
        const seg = kit.cyl(0.0022, 0.0022, d, mat, { seg: 6 });
        seg.position.copy(p).add(q).multiplyScalar(0.5).setY(y);
        seg.quaternion.setFromUnitVectors(V(0, 1, 0), p.clone().sub(q).normalize());
        seg.castShadow = false;
        self.dish.add(seg);
        segs.push(seg);
        path.push(p);
      },
      up() {
        path = null;
        stream.visible = false;
        ctx.sound.pourStop();
        bottle.quaternion.setFromEuler(new THREE.Euler(0, 0, 0.4));
        keepAbove(bottle, NOZZLE_Y);
      },
      update() {},
      destroy() {
        ctx.sound.pourStop();
        stream.visible = false;
        bottle.position.copy(home);
        bottle.quaternion.identity();
      },
    };
  }

  // ───────── 5. 통후추 그라인딩 ─────────
  pepper() {
    const ctx = this.ctx;
    const self = this;
    const home = this.mill.position.clone();
    // v13: 뒤집힌 페퍼밀은 원점에서 아래로 약 0.2m (노즐) → 노즐이 윗면 + 0.10m 이상
    const topSurfaceY = Y0 + this.top;
    const millAt = V(PLATE.x, topSurfaceY + 0.1 + 0.2, PLATE.z);
    const millMinY = Math.max(getFoodTopY(this.dish), topSurfaceY) + 0.1; // v16: 노즐 끝 ≥ 음식 최고점 + 10cm
    this.tw.to(this.mill, { pos: millAt, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0.1)), dur: 0.45 });
    ctx.view(V(PLATE.x, Y0 + this.top + 0.1, PLATE.z), 0.5, 0.62);
    ctx.ui.step('통후추 갈기', '빙글빙글 3바퀴 돌려요');
    let angle = null;
    let acc = 0;
    let turns = 0;
    let emitted = 0;
    const speck = kit.mat('#1e1a17', { rough: 0.8 });
    const refresh = () => ctx.ui.meter(`<div class="wb-chips"><span>${turns.toFixed(1)} / 3 바퀴</span></div>`);
    const finish = () => {
      const score = Math.max(30, Math.round(100 - Math.abs(turns - 3) * 22));
      ctx.ui.pop(`${score}점 · ${scoreWord(score)}`, score >= 70);
      self.tw.to(self.mill, { pos: home, quat: new THREE.Quaternion(), dur: 0.4 });
      ctx.done(score, '통후추');
    };
    refresh();
    ctx.ui.actions([{ label: '완료', icon: 'check', primary: true, onClick: finish }]);
    const center = () => {
      const v = self.stage.localToWorld(millAt.clone());
      return v;
    };
    return {
      down(e) {
        angle = screenAngle(e);
        void center;
      },
      move(e) {
        if (angle === null) return;
        const a = screenAngle(e);
        let d = a - angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        angle = a;
        acc += Math.abs(d);
        self.mill.rotation.y += d;
        keepAbove(self.mill, millMinY);
        turns = acc / (Math.PI * 2);
        while (emitted < acc / 0.35) {
          emitted++;
          ctx.sound.burst({ dur: 0.03, freq: 3200, q: 3, peak: 0.08 });
          for (let i = 0; i < 3; i++) {
            const s = kit.box(0.0015, 0.0012, 0.0015, speck);
            s.castShadow = false;
            s.position.set(PLATE.x - 0.02 - self.dish.position.x, self.top + 0.095, PLATE.z - 0.02 - self.dish.position.z);
            self.dish.add(s);
            const r = Math.sqrt(Math.random()) * 0.05;
            const t = Math.random() * Math.PI * 2;
            self.tw.to(s, { pos: V(Math.cos(t) * r, self.top + 0.003, Math.sin(t) * r), dur: 0.35 + Math.random() * 0.2 });
          }
        }
        refresh();
      },
      up() {
        angle = null;
      },
      update() {},
      destroy() {
        self.mill.position.copy(home);
        self.mill.quaternion.identity();
      },
    };
  }

  // 조리 완료: 과정 메쉬 대신 메뉴 전용 고디테일 완성품(Hero Dish)을 접시 자리에 '퐁' 하고 내놓는다
  showcase() {
    const hero = buildHeroDish(this.ctx.order.recipe.id);
    if (hero) {
      this.dish.visible = false;
      hero.position.set(PLATE.x, Y0, PLATE.z);
      hero.rotation.y = -0.25;
      hero.scale.setScalar(0.6);
      this.stage.add(hero);
      this.hero = hero;
      this.heroT = 0;
      this.ctx.sound.plate?.();
    }
    this.ctx.view(V(PLATE.x, Y0 + 0.05, PLATE.z), 0.36, 0.62);
  }

  // 완성 접시를 꺼내 쟁반으로
  takeDish() {
    const d = this.hero ?? this.dish;
    this.stage.remove(d);
    d.position.set(0, 0, 0);
    d.scale.setScalar(1);
    return d;
  }

  destroy() {}
}

// 9차 스테인리스 호텔 팬 (GN 1/6, 깊이 4cm) + 이름표(스프라이트) + 다음 재료 안내 빛
function hotelPan(name) {
  const k = kit;
  const steel = k.metal('steel');
  const g = new THREE.Group();
  const w = 0.12;
  const d = 0.105;
  const h = 0.04;
  const t = 0.0025;
  g.add(k.at(k.box(w - 0.012, t, d - 0.012, steel), 0, t / 2, 0));
  for (const s of [-1, 1]) {
    const wx = k.box(t, h, d - 0.006, steel);
    wx.position.set(s * (w / 2 - 0.004), h / 2, 0);
    wx.rotation.z = s * 0.1;
    g.add(wx);
    const wz = k.box(w - 0.006, h, t, steel);
    wz.position.set(0, h / 2, s * (d / 2 - 0.004));
    wz.rotation.x = -s * 0.1;
    g.add(wz);
  }
  // 둥글게 말린 테두리 립
  for (const s of [-1, 1]) {
    g.add(k.at(k.box(w + 0.006, 0.004, 0.008, steel), 0, h, s * (d / 2 + 0.001)));
    g.add(k.at(k.box(0.008, 0.004, d + 0.006, steel), s * (w / 2 + 0.001), h, 0));
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.02, d + 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').convertSRGBToLinear(), transparent: true, opacity: 0, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.001;
  glow.userData.noOutline = true;
  g.add(glow);
  g.userData.glow = glow;
  const label = nameSprite(name);
  label.position.set(0, h + 0.045, -0.035);
  g.add(label);
  g.userData.label = label;
  return g;
}

function nameSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const x = c.getContext('2d');
  x.font = '700 30px "Gowun Batang", serif';
  const w = Math.min(244, x.measureText(text).width + 28);
  x.fillStyle = '#f7f1e5';
  x.strokeStyle = '#2b1d14';
  x.lineWidth = 3;
  x.beginPath();
  if (x.roundRect) x.roundRect(128 - w / 2, 8, w, 48, 14);
  else x.rect(128 - w / 2, 8, w, 48);
  x.fill();
  x.stroke();
  x.fillStyle = '#2b1d14';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 128, 33, 230);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
  sp.scale.set(0.13, 0.0325, 1);
  sp.renderOrder = 40;
  return sp;
}

// 팬에 담긴 재료 한 접시 분량 (히어로 디시와 같은 고디테일 모델)
function panPortion(id, ing) {
  const g = new THREE.Group();
  const add = (o, x, z, ry = 0, y = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    g.add(o);
    return o;
  };
  if (id === 'bacon') for (let i = 0; i < 3; i++) add(heroBacon(), 0, -0.02 + i * 0.02, 0.1 * i, i * 0.003);
  else if (id === 'lettuce') {
    add(heroLettuce(0.11), 0, 0);
    add(heroLettuce(0.1), 0.006, 0.004, 1.2, 0.004);
  } else if (id === 'egg') add(heroEgg(), 0, 0);
  else if (id === 'tomato') for (let i = 0; i < 3; i++) add(heroTomato(), (i - 1) * 0.03, (i % 2) * 0.012, i, i * 0.001);
  else if (id === 'avocado') for (let i = 0; i < 4; i++) add(avocadoSlice(), (i - 1.5) * 0.02, 0, 0.2);
  else if (id === 'fig') for (let i = 0; i < 4; i++) add(figWedge(), (i - 1.5) * 0.025, (i % 2) * 0.01, i * 0.7);
  else if (id === 'arugula') for (let i = 0; i < 5; i++) add(arugula(), (i - 2) * 0.015, (i % 2) * 0.015, i);
  else if (id === 'basil') for (let i = 0; i < 4; i++) add(basilLeaf(1.2), (i - 1.5) * 0.02, (i % 2) * 0.012, i);
  else g.add(buildPrepped(ing, ing.shape === 'egg' ? 1 : 2));
  const box = new THREE.Box3().setFromObject(g);
  g.userData.h = Math.max(0.006, Math.min(0.03, box.max.y - box.min.y));
  return g;
}

// 대각선 단면 캡 텍스처: 쌓은 층(stack: {id, y0, y1})을 아래부터 그린다
const SECTION = {
  bread: ['#f1dcae', '#b8742e'],
  bread_top: ['#f1dcae', '#b8742e'],
  lettuce: ['#7aa648', '#c4dc8a'],
  tomato: ['#d9442f', '#f2b48a'],
  bacon: ['#8c3218', '#e9c08e'],
  egg: ['#fbf6ec', '#f0a92a'],
  avocado: ['#a9cc5c', '#e4e594'],
  fig: ['#c45a64', '#f2df9a'],
  ham: ['#e2a39a', '#f6d2c8'],
  arugula: ['#4c6b33', '#86a85a'],
  basil: ['#3f7f2a', '#7fb35a'],
  grain_mustard: ['#c9a03a', '#6e5418'],
  ricotta: ['#f6f2ea', '#e2dccf'],
  basil_pesto: ['#5a7a2a', '#e8dcb0'],
  fig_compote: ['#7a2f3e', '#c9566a'],
};
function sectionTexture(stack, yBot, yTop) {
  const W = 512;
  const Hc = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hc;
  const x = c.getContext('2d');
  const s0 = stack.length ? stack[0].y0 : yBot;
  const s1 = stack.length ? stack[stack.length - 1].y1 : yTop;
  const H = Math.max(0.005, s1 - s0);
  const Y = (y) => Hc - ((y - s0) / H) * Hc;
  const r = (n) => Math.abs(Math.sin(n * 12.9898 + 78.233) * 43758.5453) % 1;
  // 양 끝이 둥근 샌드위치 윤곽 안쪽만
  x.save();
  x.beginPath();
  if (x.roundRect) x.roundRect(4, 2, W - 8, Hc - 4, 40);
  else x.rect(4, 2, W - 8, Hc - 4);
  x.clip();
  const wave = (top, amp, ph, f = 0.045) => {
    x.beginPath();
    x.moveTo(0, Hc);
    for (let px = 0; px <= W; px += 8) x.lineTo(px, top + Math.sin(px * f + ph) * amp + Math.sin(px * f * 2.3 + ph * 1.7) * amp * 0.4);
    x.lineTo(W, Hc);
    x.closePath();
  };
  // 아래 층부터 위로 덮어 그린다 (위 층의 물결 아래 경계가 아래 층을 자연스럽게 덮도록 위에서부터 역순으로 칠하지 않고, 각 층을 자기 윗선부터 바닥까지 칠한 뒤 다음 층이 덮는다)
  const order = stack.map((L, i) => ({ ...L, i })).reverse();
  for (const L of order) {
    const [c0, c1] = SECTION[L.id] ?? ['#d8c09a', '#a88a5a'];
    const top = Y(L.y1);
    const bot = Y(L.y0);
    const h = Math.max(5, bot - top);
    const isBread = L.id === 'bread' || L.id === 'bread_top';
    const amp = isBread ? 1.2 : Math.min(7, h * 0.28);
    wave(top, amp, L.i * 1.7);
    const grd = x.createLinearGradient(0, top, 0, bot);
    grd.addColorStop(0, c0);
    grd.addColorStop(1, shade(c0, isBread ? -0.04 : -0.12));
    x.fillStyle = grd;
    x.fill();
    x.save();
    wave(top, amp, L.i * 1.7);
    x.clip();
    if (isBread) {
      // 속살 기공
      for (let k = 0; k < 420; k++) {
        const ex = r(k + L.i * 91) * W;
        const ey = top + r(k * 3.1 + L.i) * h;
        const rr = 0.8 + r(k * 7.7) * (r(k) < 0.08 ? 5 : 2.2);
        x.fillStyle = `rgba(160,110,55,${0.18 + r(k * 1.3) * 0.22})`;
        x.beginPath();
        x.ellipse(ex, ey, rr * 1.4, rr, r(k) * 3, 0, Math.PI * 2);
        x.fill();
      }
      // 빵 크러스트: 잘린 단면에서는 양 끝과 바깥 면(바닥 빵의 아래, 윗 빵의 위)만 갈색
      x.fillStyle = c1;
      const outer = L.id === 'bread' ? bot - 6 : top - 1;
      x.fillRect(0, outer, W, 7);
      const g1 = x.createLinearGradient(0, 0, 46, 0);
      g1.addColorStop(0, c1);
      g1.addColorStop(1, 'rgba(184,116,46,0)');
      x.fillStyle = g1;
      x.fillRect(0, top - 2, 46, h + 4);
      const g2 = x.createLinearGradient(W, 0, W - 46, 0);
      g2.addColorStop(0, c1);
      g2.addColorStop(1, 'rgba(184,116,46,0)');
      x.fillStyle = g2;
      x.fillRect(W - 46, top - 2, 46, h + 4);
    } else if (L.id === 'bacon') {
      // 살코기와 지방이 물결치며 번갈아
      for (let k = 0; k < 5; k++) {
        x.strokeStyle = k % 2 ? c1 : shade(c0, -0.15);
        x.lineWidth = Math.max(1.5, h * 0.16);
        x.beginPath();
        for (let px = 0; px <= W; px += 8) x.lineTo(px, top + h * (0.18 + k * 0.17) + Math.sin(px * 0.06 + k) * h * 0.08);
        x.stroke();
      }
    } else if (L.id === 'tomato') {
      // 과육 방(젤리) + 씨앗
      for (let k = 0; k < 9; k++) {
        const ex = (k + 0.5) * (W / 9) + (r(k) - 0.5) * 20;
        x.fillStyle = c1;
        x.beginPath();
        x.ellipse(ex, top + h * 0.55, W / 30, h * 0.26, 0, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#f6e08a';
        for (let j = 0; j < 3; j++) {
          x.beginPath();
          x.ellipse(ex + (j - 1) * 6, top + h * (0.5 + (j % 2) * 0.12), 2.2, 1.4, 0.4, 0, Math.PI * 2);
          x.fill();
        }
      }
    } else if (L.id === 'lettuce' || L.id === 'arugula' || L.id === 'basil') {
      // 주름진 잎: 밝은 잎맥 줄 + 그늘
      for (let k = 0; k < 3; k++) {
        x.strokeStyle = k === 1 ? c1 : shade(c0, -0.2);
        x.lineWidth = Math.max(1, h * 0.12);
        x.beginPath();
        for (let px = 0; px <= W; px += 6) x.lineTo(px, top + h * (0.25 + k * 0.25) + Math.sin(px * 0.09 + k * 2) * h * 0.18);
        x.stroke();
      }
    } else if (L.id === 'egg') {
      x.fillStyle = c1;
      x.beginPath();
      x.ellipse(W / 2, top + h * 0.55, W * 0.18, h * 0.38, 0, 0, Math.PI * 2);
      x.fill();
    } else {
      x.fillStyle = c1;
      for (let k = 0; k < 40; k++) {
        x.beginPath();
        x.arc(r(k + L.i * 7) * W, top + h * (0.2 + r(k * 5) * 0.6), 1.5 + r(k) * 2.5, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.restore();
  }
  x.restore();
  // 윤곽에 잉크 선 (툰 스타일)
  x.strokeStyle = 'rgba(43,29,20,0.55)';
  x.lineWidth = 3;
  x.beginPath();
  if (x.roundRect) x.roundRect(5, 3, W - 10, Hc - 6, 40);
  else x.rect(5, 3, W - 10, Hc - 6);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

// 화면 중심(3D 뷰포트 중심) 기준 포인터 각도 (가로 회전 모드 대응)
function screenAngle(e) {
  return Math.atan2(e.clientY - window.innerHeight * 0.37, e.clientX - window.innerWidth / 2);
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function shade(hex, l, a = 1) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, l);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// ───────── 썰기 가이드 (항상 재료 위에 보이도록 depthTest: false) ─────────
const GUIDE_MINT = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8ff0d0').convertSRGBToLinear(), transparent: true, opacity: 0.22, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
const GUIDE_GOLD = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc95a').convertSRGBToLinear(), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });

// 재료의 봉긋한 윗면을 감싸는 반투명 평면 + 점선 아치 (item.group 로컬, x = 가이드 위치)
function makeGuide(item, x, H) {
  const ing = item.ing;
  const loaf = ing.kind === 'loaf';
  const r = loaf ? ing.w / 2 : radiusAt(ing, x);
  const yc = loaf ? ing.h * 0.45 : ing.w / 2;
  const top = loaf ? ing.h * (ing.slot === 'brioche' ? 1.12 : 1.07) : yc + r;
  const ph = top * 1.25 + 0.01;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(ing.w, r * 2) * 1.45, ph), GUIDE_MINT.clone());
  plane.rotation.y = Math.PI / 2;
  plane.position.set(x, ph / 2 - 0.004, 0);
  plane.renderOrder = 30;
  const arch = new THREE.Group();
  arch.position.set(x, 0, 0);
  const rz = r + 0.005;
  const ry = top - yc + 0.006;
  const N = 15;
  for (let i = 0; i < N; i += 2) {
    const a0 = (i / N) * Math.PI;
    const a1 = ((i + 1) / N) * Math.PI;
    const p0 = new THREE.Vector3(0, yc + Math.sin(a0) * ry, Math.cos(a0) * rz);
    const p1 = new THREE.Vector3(0, yc + Math.sin(a1) * ry, Math.cos(a1) * rz);
    const d = p1.clone().sub(p0);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0032, d.length()), GUIDE_GOLD);
    dash.position.copy(p0).add(p1).multiplyScalar(0.5);
    dash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    dash.renderOrder = 31;
    arch.add(dash);
  }
  // 양 끝을 도마까지 내려 주는 짧은 점선
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.0032, yc * 0.8, 0.0032), GUIDE_GOLD);
    leg.position.set(0, yc * 0.45, s * rz);
    leg.renderOrder = 31;
    arch.add(leg);
  }
  item.group.add(plane, arch);
  return { x, vx: x, top, cut: false, plane, parts: [plane, arch] };
}

let arrowTex = null;
export function guideArrow() {
  if (!arrowTex) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(38,32,26,0.82)';
    g.beginPath();
    g.roundRect ? g.roundRect(8, 18, 496, 110, 55) : g.rect(8, 18, 496, 110);
    g.fill();
    g.strokeStyle = '#ffc95a';
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = '#ffe3a1';
    g.font = 'bold 58px "Gowun Batang", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('↓ 여기를 따라 긋기', 256, 76);
    arrowTex = new THREE.CanvasTexture(c);
    arrowTex.encoding = THREE.sRGBEncoding;
    arrowTex.userData = { shared: true }; // 모든 조리대가 같이 쓰는 안내 화살표
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex, depthTest: false, depthWrite: false, transparent: true }));
  s.scale.set(0.085, 0.0266, 1);
  s.renderOrder = 33;
  s.visible = false;
  return s;
}

// 가이드를 따라 위에서 아래로 반복해서 내려가는 반투명 가상 칼날
function guideBlade() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.014), new THREE.MeshBasicMaterial({ color: new THREE.Color('#effff8').convertSRGBToLinear(), transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.y = Math.PI / 2;
  m.renderOrder = 32;
  m.visible = false;
  return m;
}
