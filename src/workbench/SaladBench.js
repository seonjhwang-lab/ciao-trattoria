import * as THREE from 'three';
import { kit } from '../core/Kit.js';
import { BoardBench } from './BoardBench.js';
import { layFlat } from './Ingredient3D.js';
import { clamp, scoreWord } from './tween.js';
import { buildBistroDish, saladBowl, leaf, quenelle, crouton } from '../core/BistroDish.js';

// 올리브우드 서버: 원점 = 머리 중심, 손잡이는 +z, 머리 끝은 -z
function woodServer(kind) {
  const k = kit;
  const wood = k.wood('lightoak');
  const g = new THREE.Group();
  g.add(k.at(k.rbox(0.017, 0.008, 0.2, wood, { r: 0.003 }), 0, 0.004, 0.13));
  g.add(k.at(k.rbox(0.022, 0.009, 0.05, wood, { r: 0.004 }), 0, 0.004, 0.235));
  if (kind === 'spoon') {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), wood.clone());
    head.material.side = THREE.DoubleSide;
    head.rotation.x = Math.PI;
    head.scale.set(0.95, 0.32, 1.3);
    head.position.set(0, 0.008, -0.012);
    g.add(head);
  } else {
    g.add(k.at(k.rbox(0.05, 0.006, 0.045, wood, { r: 0.003 }), 0, 0.003, 0));
    for (let i = 0; i < 4; i++) g.add(k.at(k.rbox(0.0075, 0.005, 0.04, wood, { r: 0.0018 }), -0.018 + i * 0.012, 0.003, -0.04));
  }
  return g;
}

// 가든 샐러드 워크벤치: 가이드 따라 썰기(단면이 쓰러진다) → 드레싱 지그재그 → 양손 우드 서버로 통통 튀기며 버무리기
const Y0 = 0.9;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BOWL = V(0.25, Y0, 0.06);
const BR = 0.15; // 볼 안쪽 반지름 (윗면)
const DEPTH = 0.07;
// 볼 안쪽 바닥 높이 (반지름 r 에서)
const floorAt = (r) => Y0 + 0.012 + Math.pow(Math.min(1, r / BR), 2) * DEPTH;

export class SaladBench extends BoardBench {
  static BOARD = { x: -0.2, z: 0.1, w: 0.44, d: 0.3, t: 0.03 };
  static STAGING = [
    [-0.36, -0.24],
    [-0.22, -0.26],
    [-0.08, -0.25],
  ];

  build() {
    const k = kit;
    const g = this.stage;
    this.buildTable();
    this.buildBoard();
    this.bowl = saladBowl();
    this.bowl.position.copy(BOWL);
    this.bowl.scale.setScalar(BR / 0.155);
    g.add(this.bowl);
    this.caesar = this.ctx.order.recipe.id.includes('caesar');
    // 볼 안 바닥 잎채소 (로메인 · 버터헤드 · 래디치오)
    this.bits = [];
    const greens = this.caesar ? ['#6f9e3c', '#8fbf52', '#a9cf6a'] : ['#5c8c38', '#8a3f5a', '#7aa84a'];
    for (let i = 0; i < 12; i++) {
      const l = leaf(greens[i % 3], 0.07 + Math.random() * 0.02, i + 1);
      this.addBit(l, Math.random() * 0.1, Math.random() * Math.PI * 2, 0.004);
    }
    // 드레싱 병
    const dark = !this.caesar;
    this.bottle = k.group(
      k.at(k.cyl(0.026, 0.03, 0.15, k.mat(dark ? '#2a1410' : '#efe3c6', { opacity: dark ? 0.85 : 0.95, rough: 0.1 })), 0, 0.075, 0),
      k.at(k.cyl(0.008, 0.012, 0.04, k.metal('black')), 0, 0.17, 0),
    );
    this.bottle.position.set(0.42, Y0, -0.24);
    g.add(this.bottle);
    // 올리브우드 샐러드 서버 한 쌍 (왼손 스푼 · 오른손 포크)
    this.servers = ['spoon', 'fork'].map((kind) => {
      const sv = woodServer(kind);
      sv.visible = false;
      g.add(sv);
      return sv;
    });
    this.dressSegs = [];
    this.ctx.view(V(0.02, Y0 + 0.05, 0.02), 1.0, 0.95);
  }

  // 볼 안에서 통통 튀는 조각 (bowl 로컬이 아니라 stage 좌표로 직접 굴린다)
  addBit(o, d, a, lift = 0.006) {
    if (!o.parent) this.stage.add(o);
    const x = BOWL.x + Math.cos(a) * d;
    const z = BOWL.z + Math.sin(a) * d;
    o.position.set(x, floorAt(d) + lift, z);
    o.rotation.y = Math.random() * Math.PI * 2;
    this.bits.push({ o, v: V(0, 0, 0), spin: V(0, 0, 0), lift, rest: true });
  }

  start(step) {
    // 10차: 짙은 월넛 도마는 썰기 단계에서만 꺼내 두고, 다른 단계 화면에는 끼어들지 않게 치운다
    if (this.board) this.board.visible = step.type === 'slice';
    const fn = { dress: () => this.dress(step), toss_salad: () => this.tossSalad() }[step.type];
    return fn ? fn() : super.start(step);
  }

  update(dt) {
    super.update(dt);
    // 볼 안 조각 물리: 중력 + 볼 곡면 바닥 + 벽
    for (const b of this.bits) {
      if (b.rest) continue;
      b.v.y -= 2.8 * dt;
      b.o.position.addScaledVector(b.v, dt);
      b.o.rotation.x += b.spin.x * dt;
      b.o.rotation.z += b.spin.z * dt;
      const dx = b.o.position.x - BOWL.x;
      const dz = b.o.position.z - BOWL.z;
      let r = Math.hypot(dx, dz);
      if (r > BR * 0.82) {
        const k = (BR * 0.82) / r;
        b.o.position.x = BOWL.x + dx * k;
        b.o.position.z = BOWL.z + dz * k;
        b.v.x *= -0.4;
        b.v.z *= -0.4;
        r = BR * 0.82;
      }
      const fl = floorAt(r) + b.lift;
      if (b.o.position.y < fl) {
        b.o.position.y = fl;
        if (Math.abs(b.v.y) < 0.12) {
          b.rest = true;
          b.spin.set(0, 0, 0);
          b.o.rotation.x *= 0.3;
          b.o.rotation.z *= 0.3;
        } else {
          b.v.y *= -0.35;
          b.v.x *= 0.6;
          b.v.z *= 0.6;
        }
      }
    }
  }

  // 썬 조각과 치즈 토핑을 볼에 담는다
  fillBowl() {
    if (this.filled) return;
    this.filled = true;
    for (const it of Object.values(this.items)) {
      for (const p of it.cutPieces()) {
        const w = p.mesh.getWorldPosition(new THREE.Vector3());
        const f = p.flat ?? layFlat(p, it.ing);
        p.flat = f;
        this.stage.add(f);
        f.position.copy(this.stage.worldToLocal(w));
        const d = Math.random() * 0.1;
        const a = Math.random() * Math.PI * 2;
        const target = V(BOWL.x + Math.cos(a) * d, floorAt(d) + 0.02, BOWL.z + Math.sin(a) * d);
        this.tw.to(f, { pos: target, dur: 0.5, arc: 0.1, delay: Math.random() * 0.3, onDone: () => this.addBit(f, d, a, 0.014) });
      }
      it.group.visible = false;
    }
    if (this.caesar) {
      for (let i = 0; i < 8; i++) this.addBit(crouton(i + 1), Math.random() * 0.1, Math.random() * 6.3, 0.016);
    } else for (let i = 0; i < 4; i++) this.addBit(quenelle(i + 8), Math.random() * 0.08, Math.random() * 6.3, 0.012);
  }

  // ───────── 드레싱 지그재그 ─────────
  dress(step) {
    const ctx = this.ctx;
    const self = this;
    this.fillBowl();
    const caesar = step.dressing === 'caesar';
    const mat = kit.mat(caesar ? '#efe2c0' : '#2a0f0a', { rough: 0.08, opacity: 0.9, env: 1.2 });
    const home = this.bottle.position.clone();
    ctx.view(V(BOWL.x, Y0 + 0.08, BOWL.z), 0.42, 1.05);
    ctx.ui.step(caesar ? '시저 드레싱' : '발사믹 드레싱', '볼 위를 지그재그 4번');
    let path = null;
    let rev = 0;
    let lastDir = 0;
    let turnX = 0;
    let done = false;
    const y = Y0 + DEPTH + 0.03;
    const refresh = () => ctx.ui.meter(`<div class="wb-chips"><span>지그재그 ${rev} / 4</span></div>`);
    refresh();
    const finish = () => {
      if (done) return;
      done = true;
      ctx.sound.pourStop();
      self.tw.to(self.bottle, { pos: home, quat: new THREE.Quaternion(), dur: 0.4 });
      const score = clamp(Math.round(40 + rev * 15), 0, 100);
      ctx.ui.pop(`드레싱 ${scoreWord(score)}`, score >= 70);
      ctx.ui.actions([]);
      ctx.done(score, `드레싱 지그재그 ${rev}번`);
    };
    ctx.ui.actions([{ label: '완료', icon: 'check', primary: true, onClick: finish }]);
    return {
      down(e, ndc) {
        const p = ctx.planeHit(ndc, y);
        if (!p) return;
        path = [p];
        ctx.sound.pourStart();
      },
      move(e, ndc) {
        if (done) return;
        const w = ctx.planeHit(ndc, y + 0.12);
        if (w) {
          self.bottle.position.copy(w);
          self.bottle.quaternion.setFromEuler(new THREE.Euler(0, 0, path ? 2.3 : 0.4));
        }
        if (!path) return;
        const p = ctx.planeHit(ndc, y);
        if (!p) return;
        const q = path[path.length - 1];
        const d = p.distanceTo(q);
        if (d < 0.006) return;
        const dir = Math.sign(p.x - q.x);
        if (dir && dir !== lastDir) {
          if (lastDir && Math.abs(p.x - turnX) > 0.03) rev++;
          lastDir = dir;
          turnX = p.x;
        }
        // 샐러드 더미 위에 얹히는 높이로
        const r = Math.hypot(p.x - BOWL.x, p.z - BOWL.z);
        if (r < BR * 0.9) {
          const a = q.clone().setY(floorAt(Math.hypot(q.x - BOWL.x, q.z - BOWL.z)) + 0.02);
          const b = p.clone().setY(floorAt(r) + 0.02);
          const seg = kit.cyl(0.0014, 0.0014, a.distanceTo(b), mat, { seg: 6 });
          seg.position.copy(a).add(b).multiplyScalar(0.5);
          seg.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
          seg.castShadow = false;
          self.stage.add(seg);
          self.dressSegs.push(seg);
        }
        path.push(p);
        refresh();
      },
      up() {
        path = null;
        ctx.sound.pourStop();
        self.bottle.quaternion.setFromEuler(new THREE.Euler(0, 0, 0.4));
      },
      update() {},
      destroy() {
        ctx.sound.pourStop();
      },
    };
  }

  // ───────── 양손 우드 서버로 버무리기 ─────────
  // 9차: 스와이프할 때마다 양손의 우드 스푼 & 포크가 볼 양쪽 가장자리에서 벽을 타고 바닥까지 내려가
  // 채소 밑으로 파고든 뒤, 손목을 뒤집으며 안쪽 위로 퍼 올린다 → 채소와 드레싱이 아래에서 위로 뒤집혀 섞인다.
  tossSalad() {
    const ctx = this.ctx;
    const self = this;
    this.fillBowl();
    this.servers.forEach((s) => (s.visible = true));
    ctx.view(V(BOWL.x, Y0 + 0.06, BOWL.z), 0.46, 0.8);
    ctx.ui.step('우드 서버로 버무리기', '볼 위를 크게 스와이프 5번');
    let tosses = 0;
    let done = false;
    let down = null;
    let anim = null; // { t, axis }
    let axis = 0; // 서버가 들어오는 방향 (스와이프 방향에 수직)
    let t = 0;
    const refresh = () => ctx.ui.meter(`<div class="wb-cover"><div class="bar"><i class="${tosses >= 5 ? 'good' : ''}" style="width:${Math.min(100, tosses * 20)}%"></i></div><span>버무리기 ${tosses} / 5</span></div>`);
    refresh();
    const finish = () => {
      if (done) return;
      done = true;
      const score = tosses >= 5 ? 100 : Math.round(40 + tosses * 12);
      ctx.ui.pop(`골고루 버무렸어요 · ${scoreWord(score)}`, score >= 70);
      ctx.ui.actions([]);
      ctx.later(0.5, () => self.servers.forEach((s) => (s.visible = false)));
      ctx.done(score, `토싱 ${tosses}번`);
    };
    ctx.ui.actions([{ label: '완료', icon: 'check', onClick: finish }]);
    const up = V(0, 1, 0);
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    // 한 번의 '퍼 올리기' 동작에서 서버 머리 위치/자세 (u: 0~1, side: -1 | 1)
    const pose = (sv, side, u, sway) => {
      const th = axis + (side > 0 ? 0 : Math.PI);
      const cx = Math.cos(th);
      const cz = Math.sin(th);
      let r;
      let y;
      let roll; // 0 = 머리가 아래(채소 밑으로 파고듦) → 1 = 뒤집혀 위를 봄(퍼 올림)
      if (u < 0.32) {
        // 가장자리 → 벽을 타고 바닥으로
        const k = u / 0.32;
        r = BR * (0.95 - 0.55 * k);
        y = floorAt(r) + 0.012 + (1 - k) * 0.03;
        roll = 0;
      } else if (u < 0.68) {
        // 바닥에서 안쪽·위로 퍼 올리며 손목을 뒤집는다
        const k = (u - 0.32) / 0.36;
        const e = k * k * (3 - 2 * k);
        r = BR * (0.4 - 0.32 * e);
        y = floorAt(r) + 0.012 + Math.sin(e * Math.PI * 0.5) * 0.085;
        roll = e;
      } else {
        // 다시 가장자리로
        const k = (u - 0.68) / 0.32;
        const e = k * k * (3 - 2 * k);
        r = BR * (0.08 + 0.87 * e);
        y = floorAt(r) + 0.012 + 0.085 * (1 - e) + e * 0.03;
        roll = 1 - e;
      }
      sv.position.set(BOWL.x + cx * r, y + sway, BOWL.z + cz * r);
      // 손잡이는 바깥쪽 위로 비스듬히 (손이 볼 밖에 있다)
      const lean = 0.55 + roll * 0.25;
      const dir = V(cx * Math.cos(lean), Math.sin(lean), cz * Math.cos(lean)).normalize();
      qa.setFromUnitVectors(V(0, 0, 1), dir);
      // 손목 뒤집기: 손잡이 축으로 회전 (머리 오목면이 아래 → 위)
      qb.setFromAxisAngle(dir, side * (Math.PI * 0.5 - roll * Math.PI * 0.95));
      sv.quaternion.copy(qb).multiply(qa);
      void up;
    };
    const scoop = () => {
      // 채소가 서버를 따라 아래에서 위로 뒤집히며 볼 가운데로 모인다
      ctx.sound.toss();
      for (const b of self.bits) {
        b.rest = false;
        const cx = BOWL.x - b.o.position.x;
        const cz = BOWL.z - b.o.position.z;
        const rr = Math.hypot(cx, cz);
        const lift = 0.5 + (1 - Math.min(1, rr / BR)) * 0.25 + Math.random() * 0.35;
        b.v.set(cx * 1.5 + (Math.random() - 0.5) * 0.3, lift, cz * 1.5 + (Math.random() - 0.5) * 0.3);
        // 위아래가 뒤집히도록 크게 공중제비
        b.spin.set((Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 6), 0, (Math.random() - 0.5) * 10);
      }
      for (const s of self.dressSegs) s.scale.x = s.scale.z = Math.max(0.2, 1 - tosses * 0.18);
    };
    return {
      down(e, ndc) {
        down = ctx.ndcToPx(ndc);
      },
      move() {},
      up(e, ndc) {
        if (!down || done) return;
        const a = down;
        const b = ctx.ndcToPx(ndc);
        down = null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.hypot(dx, dy) < 30) return ctx.ui.pop('볼 위를 크게 쓱 스와이프해요', false);
        if (anim) return;
        // 화면 스와이프 방향에 수직인 축으로 서버가 들어온다 (매번 각도가 달라져 골고루 섞인다)
        axis = Math.atan2(dx, dy) + (Math.random() - 0.5) * 0.4;
        anim = { t: 0, scooped: false };
        ctx.sound.swish();
      },
      update(dt = 1 / 60) {
        t += dt;
        if (anim) {
          anim.t += dt;
          const u = Math.min(1, anim.t / 1.0);
          self.servers.forEach((sv, i) => pose(sv, i ? 1 : -1, u, 0));
          if (!anim.scooped && u >= 0.42) {
            anim.scooped = true;
            tosses++;
            scoop();
            refresh();
          }
          if (u >= 1) {
            anim = null;
            if (tosses >= 5) ctx.later(0.6, finish);
          }
        } else if (!done) self.servers.forEach((sv, i) => pose(sv, i ? 1 : -1, 0, Math.sin(t * 2 + i) * 0.003));
      },
      destroy() {
        self.servers.forEach((s) => (s.visible = false));
      },
    };
  }

  showcase() {
    const hero = buildBistroDish(this.ctx.order.recipe.id);
    if (hero) {
      this.bowl.visible = false;
      for (const b of this.bits) b.o.visible = false;
      for (const s of this.dressSegs) s.visible = false;
      hero.position.copy(BOWL);
      hero.rotation.y = -0.4;
      hero.scale.setScalar(0.6);
      this.stage.add(hero);
      this.hero = hero;
      this.heroT = 0;
      this.ctx.sound.plate?.();
    }
    this.ctx.view(V(BOWL.x, Y0 + 0.05, BOWL.z), 0.42, 0.62);
  }

  takeDish() {
    const d = this.hero ?? this.bowl;
    this.stage.remove(d);
    d.position.set(0, 0, 0);
    d.scale.setScalar(1);
    d.visible = true;
    return d;
  }
}
