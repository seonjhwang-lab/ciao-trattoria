import * as THREE from 'three';
import { kit } from './Kit.js';
import { buildPawn } from './Character.js';
import { SkeletonUtils } from './skeleton.js';
import { buildRigPawn, updateRig } from './ActorRig.js';

const H = Math.PI / 2;

// 걷기/앉기/먹기/쟁반 들기 포즈를 가진 캐릭터
export class Actor {
  constructor(look, { speed = 1.35 } = {}) {
    this.pawn = look?.glb ? glbPawn(look.glb) : (buildRigPawn(look) ?? buildPawn(look));
    this.talking = false;
    this.tray = null;
    this.root = this.pawn.root;
    this.blink = 2 + Math.random() * 3;
    this.path = [];
    this.speed = speed;
    this.phase = Math.random() * 6;
    this.t = 0;
    this.pose = 'idle';
    this.heading = null;
    this.manual = 0; // 직접 조작 속도 비율 (셰프)
  }

  setPath(points) {
    this.path = points.map((p) => p.clone());
  }

  // 경로를 따라 이동. 이번 프레임에 도착했으면 true
  move(dt) {
    if (!this.path.length) return false;
    const p = this.root.position;
    let remaining = this.speed * dt;
    while (remaining > 0 && this.path.length) {
      const target = this.path[0];
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-4) this.heading = Math.atan2(dx, dz);
      if (dist <= remaining) {
        p.x = target.x;
        p.z = target.z;
        this.path.shift();
        remaining -= dist;
      } else {
        p.x += (dx / dist) * remaining;
        p.z += (dz / dist) * remaining;
        remaining = 0;
      }
    }
    if (this.heading !== null) this.face(this.heading, dt);
    return this.path.length === 0;
  }

  face(yaw, dt, speed = 10) {
    let d = yaw - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * speed);
  }

  faceTo(v, dt) {
    const p = this.root.position;
    this.face(Math.atan2(v.x - p.x, v.z - p.z), dt);
  }

  animate(dt) {
    this.t += dt;
    const p = this.pawn;
    if (p.rig) return updateRig(this, dt);
    if (p.mixer) return this.animateGlb(dt);
    // 눈 깜빡임
    this.blink -= dt;
    if (p.eyes) {
      const closed = this.blink < 0.12 && this.blink > 0;
      for (const e of p.eyes) e.scale.y = closed ? 0.15 : 1;
      if (this.blink <= 0) this.blink = 2.5 + Math.random() * 3.5;
    }
    const walking = this.path.length > 0 || this.manual > 0.05;
    const pose = this.pose;
    const tgt = { hip: [0, 0], knee: [0, 0], sh: [0.04, 0.04], el: [-0.12, -0.12], bob: 0 };

    if (walking) {
      this.phase += dt * this.speed * 5.2 * (this.path.length ? 1 : Math.max(0.45, this.manual));
      const s = Math.sin(this.phase);
      const c = Math.cos(this.phase);
      tgt.hip = [s * 0.5, -s * 0.5];
      tgt.knee = [Math.max(0, -c) * 0.65, Math.max(0, c) * 0.65];
      tgt.sh = [-s * 0.38, s * 0.38];
      tgt.el = [-0.3, -0.3];
      tgt.bob = Math.abs(c) * 0.03;
    }
    if (pose === 'carry') {
      tgt.sh = [-0.5, -0.5];
      tgt.el = [-1.1, -1.1];
    } else if (pose === 'work') {
      const w = Math.sin(this.t * 7);
      tgt.sh = [-0.65 + w * 0.18, -0.65 - w * 0.18];
      tgt.el = [-0.95, -0.95];
    } else if (pose === 'sit' || pose === 'eat') {
      tgt.hip = [-H, -H];
      tgt.knee = [H, H];
      tgt.sh = [-0.55, -0.55];
      tgt.el = [-0.75, -0.75];
      if (pose === 'eat') {
        const b = Math.max(0, Math.sin(this.t * 3.6));
        tgt.sh = [-0.55, -0.95 - b * 0.45];
        tgt.el = [-0.75, -1.35];
        p.head.rotation.x = b * 0.12;
      }
    } else if (!walking) {
      p.body.scale.y = 1 + Math.sin(this.t * 2) * 0.006;
    }

    const k = walking ? 1 : Math.min(1, dt * 12);
    for (let i = 0; i < 2; i++) {
      const L = p.legs[i];
      const A = p.arms[i];
      L.hip.rotation.x += (tgt.hip[i] - L.hip.rotation.x) * k;
      L.knee.rotation.x += (tgt.knee[i] - L.knee.rotation.x) * k;
      A.shoulder.rotation.x += (tgt.sh[i] - A.shoulder.rotation.x) * Math.min(1, dt * 12);
      A.elbow.rotation.x += (tgt.el[i] - A.elbow.rotation.x) * Math.min(1, dt * 12);
    }
    p.body.position.y += (tgt.bob - p.body.position.y) * Math.min(1, dt * 14);
    // 상체: 걸을 때 살짝 앞으로 숙이고 좌우로 흔들림, 머리는 반대로 균형
    if (p.chest) {
      const lean = walking ? 0.07 : pose === 'sit' || pose === 'eat' ? 0.05 : 0;
      p.chest.rotation.x += (lean - p.chest.rotation.x) * Math.min(1, dt * 8);
      p.chest.rotation.y = walking ? Math.sin(this.phase) * 0.08 : p.chest.rotation.y * 0.9;
      p.neck.rotation.y = -p.chest.rotation.y * 0.7;
      p.neck.rotation.x = -p.chest.rotation.x * 0.6;
    }
  }

  // GLB 캐릭터: 애니메이션 클립(walk / idle / sit) 재생
  animateGlb(dt) {
    const p = this.pawn;
    const walking = this.path.length > 0 || this.manual > 0.05;
    const want = walking ? 'walk' : this.pose === 'sit' || this.pose === 'eat' ? 'sit' : 'idle';
    const next = p.clips[want] ?? p.clips.idle ?? null;
    if (next && next !== p.current) {
      next.reset().fadeIn(0.25).play();
      p.current?.fadeOut(0.25);
      p.current = next;
    }
    p.mixer.update(dt);
  }
}

// 직원이 드는 원목 쟁반
export function buildTray() {
  const k = kit;
  const g = new THREE.Group();
  g.add(k.rbox(0.44, 0.02, 0.32, k.wood('walnut'), { r: 0.008 }));
  for (const [x, z, w, d] of [
    [0, 0.155, 0.44, 0.012],
    [0, -0.155, 0.44, 0.012],
    [0.215, 0, 0.012, 0.32],
    [-0.215, 0, 0.012, 0.32],
  ])
    g.add(k.at(k.box(w, 0.035, d, k.wood('walnut')), x, 0.02, z));
  g.position.set(0, 1.0, 0.36);
  return g;
}

// 캐릭터 GLB 슬롯 (Mixamo 등): 키 1.65m 로 맞추고 클립 이름으로 걷기/대기/앉기 연결
function glbPawn(entry) {
  const src = SkeletonUtils ? SkeletonUtils.clone(entry.scene) : entry.scene.clone(true);
  const box = new THREE.Box3().setFromObject(src);
  const h = Math.max(0.01, box.max.y - box.min.y);
  src.scale.multiplyScalar(1.65 / h);
  box.setFromObject(src);
  src.position.y -= box.min.y;
  src.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(src);
  root.add(body);
  const mixer = new THREE.AnimationMixer(src);
  const clips = {};
  for (const c of entry.animations) {
    const n = c.name.toLowerCase();
    for (const key of ['walk', 'idle', 'sit']) if (n.includes(key) && !clips[key]) clips[key] = mixer.clipAction(c);
  }
  if (!clips.idle && entry.animations[0]) clips.idle = mixer.clipAction(entry.animations[0]);
  const head = new THREE.Object3D();
  return { root, body, head, legs: [], arms: [], mixer, clips, current: null, glb: true };
}
