import * as THREE from 'three';
import { kit } from './Kit.js';
import { faceDecal } from './FaceTextureBuilder.js';

// ─────────────────────────────────────────────────────────────
// 관절형 캐릭터: 고관절·무릎·어깨·팔꿈치·목 관절 + 레이어드 복장
// 엉덩이 0.78 · 머리 1.5 (키 약 1.65m, height 배율로 0.92~1.08). +z 를 바라본다.
// look 옵션: skin hair top bottom shoe style(short|long|bun|crop|bob|pony|curly|spiky|bald)
//            build(slim|regular|broad) height glasses hat(chef|beret|beanie|cap) hatColor
//            scarf coat apron jacket collar sleeve
// ─────────────────────────────────────────────────────────────
export const SKIN = ['#f3d6bd', '#e9c2a0', '#d9a77f', '#c08a63', '#a06c47', '#7c5136', '#5c3a26'];
export const HAIR = ['#1d1b1a', '#2a211c', '#3b2c22', '#5a3f2c', '#7b5a3c', '#9c7d5b', '#c9b08a', '#6b6460', '#d8d2c8', '#7a3324'];
export const TOPS = ['#2f3a4a', '#6b5b4a', '#4f5a3f', '#7a3e35', '#c9bfae', '#3c3c40', '#8a7a62', '#5b6f80', '#a7907a', '#40342e', '#e9e2d4', '#2f4a3a', '#8c6e8a', '#b8763a'];
export const BOTTOMS = ['#2c3040', '#3e3a36', '#5c5247', '#24262b', '#6d6255', '#41505e', '#8a7a62', '#1f2a36'];
export const STYLES = ['short', 'long', 'bun', 'crop', 'bob', 'pony', 'curly', 'spiky', 'bald'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function randomLook(extra = {}) {
  const r = Math.random;
  return {
    skin: pick(SKIN),
    hair: pick(HAIR),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    shoe: pick(['#2a2522', '#4a3a30', '#e8e4dc', '#3a3a3a', '#6b4a33']),
    style: pick(STYLES),
    build: pick(['slim', 'regular', 'regular', 'broad']),
    height: 0.93 + r() * 0.14,
    glasses: r() < 0.3 ? pick(['round', 'square']) : null,
    hat: r() < 0.28 ? pick(['beret', 'beanie', 'cap']) : null,
    hatColor: pick(['#3c4a3e', '#7a3e35', '#2b2b2e', '#c9b79c', '#5b6f80']),
    scarf: r() < 0.25 ? pick(['#a65e3f', '#c9b79c', '#5b6f80', '#7a3e35', '#d8cfc0']) : null,
    coat: r() < 0.3 ? pick(['#6b5544', '#3a3633', '#8a7a62', '#2f3a4a', '#9a8670']) : null,
    collar: r() < 0.5,
    ...extra,
  };
}

export function buildPawn(look = {}) {
  const k = kit;
  const L = { ...randomLook(), ...look };
  const mSkin = k.mat(L.skin, { rough: 0.62, env: 0.25, sheen: '#ffe9dc' });
  const mTop = k.fabric(L.top);
  const mBottom = k.fabric(L.bottom);
  const mShoe = k.mat(L.shoe, { rough: 0.45 });
  const mHair = k.mat(L.hair, { rough: 0.55, env: 0.4, sheen: k.shade(L.hair, 0.2) });
  const W = L.build === 'slim' ? 0.9 : L.build === 'broad' ? 1.14 : 1;

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(L.height ?? 1);
  root.add(body);

  // 다리: 허벅지 → 무릎 → 정강이 → 발
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.09 * W, 0.78, 0);
    hip.add(k.at(k.capsule(0.07 * W, 0.25, mBottom), 0, -0.18, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.37;
    knee.add(k.at(k.sphere(0.06 * W, mBottom), 0, 0, 0));
    knee.add(k.at(k.capsule(0.056 * W, 0.26, mBottom), 0, -0.17, 0));
    const foot = new THREE.Group();
    foot.position.y = -0.35;
    foot.add(k.at(k.rbox(0.1, 0.075, 0.25, mShoe, { r: 0.035 }), 0, -0.02, 0.045));
    foot.add(k.at(k.box(0.102, 0.012, 0.25, k.mat(k.shade(L.shoe, -0.15), { rough: 0.8 })), 0, -0.055, 0.045));
    knee.add(foot);
    hip.add(knee);
    body.add(hip);
    return { hip, knee, foot };
  });

  // 골반 · 상체 (체형에 따라 폭)
  body.add(k.at(k.rbox(0.33 * W, 0.17, 0.21, mBottom, { r: 0.07 }), 0, 0.82, 0));
  const chest = new THREE.Group();
  chest.position.y = 0.86;
  body.add(chest);
  const torso = k.at(k.rbox(0.36 * W, 0.48, 0.22, mTop, { r: 0.1 }), 0, 0.22, 0);
  chest.add(torso);
  chest.add(k.at(k.rbox(0.38 * W, 0.12, 0.23, mTop, { r: 0.06 }), 0, 0.42, 0)); // 어깨선
  if (L.collar) {
    for (const s of [-1, 1]) chest.add(k.at(k.box(0.07, 0.11, 0.012, k.fabric(k.shade(L.top, 0.12))), s * 0.05, 0.4, 0.114, 0, 0, s * 0.45));
  }
  if (L.coat) {
    const mc = k.fabric(L.coat);
    for (const s of [-1, 1]) chest.add(k.at(k.rbox(0.19 * W, 0.78, 0.04, mc, { r: 0.015 }), s * 0.1 * W, 0.08, 0.1));
    chest.add(k.at(k.rbox(0.39 * W, 0.78, 0.04, mc, { r: 0.015 }), 0, 0.08, -0.105));
    for (const s of [-1, 1]) {
      chest.add(k.at(k.rbox(0.04, 0.78, 0.22, mc, { r: 0.015 }), s * 0.19 * W, 0.08, 0));
      chest.add(k.at(k.box(0.08, 0.16, 0.014, k.fabric(k.shade(L.coat, -0.08))), s * 0.06, 0.38, 0.122, 0, 0, s * 0.5));
    }
    for (let i = 0; i < 3; i++) chest.add(k.at(k.sphere(0.01, k.mat('#2a2522')), 0.02, 0.28 - i * 0.12, 0.124));
  }
  if (L.apron) {
    chest.add(k.at(k.rbox(0.32 * W, 0.66, 0.02, k.fabric(L.apron), { r: 0.01 }), 0, 0.06, 0.118));
    chest.add(k.at(k.box(0.34 * W, 0.03, 0.235, k.fabric(L.apron)), 0, 0.0, 0));
    for (const s of [-1, 1]) chest.add(k.at(k.box(0.025, 0.2, 0.012, k.fabric(L.apron)), s * 0.1, 0.38, 0.118, 0, 0, s * 0.25));
    chest.add(k.at(k.rbox(0.12, 0.08, 0.012, k.fabric(k.shade(L.apron, -0.08)), { r: 0.005 }), 0.06, 0.12, 0.13));
  }
  if (L.jacket) {
    for (const s of [-1, 1]) chest.add(k.at(k.sphere(0.012, k.mat('#2a2a2a')), s * 0.05, 0.28, 0.115));
    for (const s of [-1, 1]) chest.add(k.at(k.sphere(0.012, k.mat('#2a2a2a')), s * 0.05, 0.16, 0.115));
    chest.add(k.at(k.box(0.24, 0.05, 0.02, k.fabric(k.shade(L.top, -0.06))), 0, 0.43, 0.11));
  }

  // 팔: 어깨 → 위팔 → 팔꿈치 → 아래팔 → 손
  const sleeve = L.coat ? k.fabric(L.coat) : mTop;
  const arms = [-1, 1].map((s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.215 * W, 0.4, 0);
    shoulder.rotation.z = s * 0.08;
    shoulder.add(k.at(k.sphere(0.06, sleeve), 0, -0.01, 0));
    shoulder.add(k.at(k.capsule(0.053, 0.17, sleeve), 0, -0.13, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    elbow.add(k.at(k.capsule(0.046, 0.16, L.sleeve === 'short' ? mSkin : sleeve), 0, -0.12, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.25;
    hand.add(k.at(k.scl(k.sphere(0.045, mSkin), 0.85, 1.1, 0.7), 0, -0.01, 0.005));
    hand.add(k.at(k.scl(k.sphere(0.018, mSkin), 1, 1.6, 1), s * -0.03, 0.0, 0.03));
    elbow.add(hand);
    shoulder.add(elbow);
    chest.add(shoulder);
    return { shoulder, elbow, hand };
  });

  // 목 · 머리
  const neck = new THREE.Group();
  neck.position.y = 0.48;
  chest.add(neck);
  neck.add(k.at(k.cyl(0.048, 0.055, 0.1, mSkin), 0, 0.02, 0));
  if (L.scarf) {
    neck.add(k.at(k.torus(0.07, 0.03, k.fabric(L.scarf)), 0, 0.0, 0, Math.PI / 2));
    neck.add(k.at(k.rbox(0.07, 0.2, 0.03, k.fabric(L.scarf), { r: 0.012 }), 0.05, -0.1, 0.1, 0.1, 0, 0.12));
  }
  const { head, eyes } = buildHead(L, mSkin, mHair);
  head.position.y = 0.16;
  neck.add(head);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { root, body, chest, neck, legs, arms, head, eyes, torso, look: L };
}

// 얼굴 · 헤어 · 안경 · 모자. 원점 = 머리 중심, +z 정면, 폭 약 0.29m.
// 관절형 캐릭터와 Mixamo 리그(머리 뼈에 부착) 모두 이 함수를 쓴다.
export function buildHead(L, mSkin = null, mHair = null) {
  const k = kit;
  mSkin ??= k.mat(L.skin, { rough: 0.62, env: 0.25, sheen: '#ffe9dc' });
  mHair ??= k.mat(L.hair, { rough: 0.55, env: 0.4, sheen: k.shade(L.hair, 0.2) });
  const head = new THREE.Group();
  head.add(k.scl(k.sphere(0.15, mSkin), 0.96, 1.08, 1));
  head.add(k.at(k.scl(k.sphere(0.1, mSkin), 1, 0.7, 0.9), 0, -0.09, 0.03)); // 턱
  head.add(k.at(k.scl(k.sphere(0.022, mSkin), 0.75, 1, 1.1), 0, -0.015, 0.152)); // 코
  // 귀
  for (const s of [-1, 1]) {
    const ear = k.at(k.scl(k.sphere(0.03, mSkin), 0.45, 1, 0.75), s * 0.145, 0, 0);
    head.add(ear);
    head.add(k.at(k.scl(k.sphere(0.012, k.mat(k.shade(L.skin, -0.1))), 0.3, 0.8, 0.6), s * 0.158, 0, 0.004));
  }
  // v12: 눈 · 눈썹 · 입 · 볼은 3D 조각 대신 512px 캔버스 얼굴 데칼 (표정 전환 · 깜빡임은 FaceTexture 가 그린다)
  const eyes = [];
  const decal = faceDecal(L);
  head.add(decal);
  head.userData.face = decal.userData.face;

  // 헤어 (입체)
  const st = L.style;
  if (st !== 'bald') head.add(k.at(k.scl(k.sphere(0.158, mHair, { tl: Math.PI * 0.5 }), 1, 1.12, 1.02), 0, 0.012, -0.012, -0.32));
  if (st === 'long') {
    head.add(k.at(k.rbox(0.3, 0.34, 0.12, mHair, { r: 0.05 }), 0, -0.12, -0.08));
    for (const s of [-1, 1]) head.add(k.at(k.rbox(0.05, 0.26, 0.1, mHair, { r: 0.02 }), s * 0.14, -0.08, 0.02));
  }
  if (st === 'bob') head.add(k.at(k.scl(k.sphere(0.168, mHair, { tl: Math.PI * 0.62 }), 1.03, 1.0, 1), 0, -0.02, -0.03, -0.7));
  if (st === 'bun') {
    head.add(k.at(k.sphere(0.065, mHair), 0, 0.13, -0.13));
    head.add(k.at(k.torus(0.04, 0.008, k.mat('#2a2522')), 0, 0.1, -0.11, 0.9));
  }
  if (st === 'crop') head.add(k.at(k.scl(k.sphere(0.1, mHair), 1.4, 0.4, 0.9), 0, 0.13, 0.07));
  if (st === 'pony') {
    head.add(k.at(k.capsule(0.04, 0.16, mHair), 0, -0.04, -0.17, 0.4));
    head.add(k.at(k.torus(0.03, 0.008, k.mat('#a65e3f')), 0, 0.05, -0.15, 1.2));
  }
  if (st === 'curly') for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    head.add(k.at(k.sphere(0.05, mHair), Math.cos(a) * 0.12, 0.08 + Math.sin(i * 1.7) * 0.04, Math.sin(a) * 0.1 - 0.03));
  }
  if (st === 'spiky') for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    head.add(k.at(k.cone(0.035, 0.09, mHair, { seg: 6 }), Math.cos(a) * 0.07, 0.15, Math.sin(a) * 0.06 - 0.02, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5));
  }
  // 안경 · 모자
  if (L.glasses) {
    const fm = k.mat(L.glasses === 'round' ? '#3a2a1f' : '#1d1d1f', { rough: 0.3, metal: 0.4 });
    for (const s of [-1, 1]) {
      if (L.glasses === 'round') head.add(k.at(k.torus(0.03, 0.0045, fm), s * 0.052, 0.018, 0.148));
      else {
        head.add(k.at(k.box(0.06, 0.006, 0.006, fm), s * 0.052, 0.043, 0.148));
        head.add(k.at(k.box(0.06, 0.006, 0.006, fm), s * 0.052, -0.005, 0.148));
        head.add(k.at(k.box(0.006, 0.048, 0.006, fm), s * 0.082, 0.019, 0.148));
        head.add(k.at(k.box(0.006, 0.048, 0.006, fm), s * 0.022, 0.019, 0.148));
      }
      head.add(k.at(k.box(0.004, 0.004, 0.13, fm), s * 0.14, 0.02, 0.085));
      head.add(k.at(k.box(0.03, 0.04, 0.003, k.glass()), s * 0.052, 0.018, 0.149));
    }
    head.add(k.at(k.box(0.022, 0.005, 0.005, fm), 0, 0.022, 0.15));
  }
  if (L.hat === 'chef') {
    head.add(k.at(k.cyl(0.135, 0.125, 0.13, k.fabric('#f4f1ea')), 0, 0.19, -0.01));
    head.add(k.at(k.scl(k.sphere(0.155, k.fabric('#f7f4ee')), 1.05, 0.62, 1.05), 0, 0.3, -0.01));
    for (let i = 0; i < 6; i++) head.add(k.at(k.box(0.004, 0.12, 0.004, k.fabric('#e9e4da')), Math.cos(i) * 0.128, 0.19, Math.sin(i) * 0.118 - 0.01));
  }
  if (L.hat === 'beret') head.add(k.at(k.scl(k.sphere(0.17, k.fabric(L.hatColor), { tl: Math.PI * 0.5 }), 1.12, 0.38, 1.12), 0.03, 0.12, -0.02, -0.12, 0, -0.15));
  if (L.hat === 'beanie') {
    head.add(k.at(k.scl(k.sphere(0.163, k.fabric(L.hatColor), { tl: Math.PI * 0.46 }), 1, 1.14, 1), 0, 0.025, 0, -0.12));
    head.add(k.at(k.torus(0.15, 0.022, k.fabric(k.shade(L.hatColor, -0.06))), 0, 0.05, 0, Math.PI / 2 - 0.12));
  }
  if (L.hat === 'cap') {
    head.add(k.at(k.scl(k.sphere(0.16, k.fabric(L.hatColor), { tl: Math.PI * 0.48 }), 1, 1.05, 1), 0, 0.03, 0, -0.1));
    head.add(k.at(k.scl(k.cyl(0.1, 0.1, 0.012, k.fabric(L.hatColor)), 1, 1, 0.7), 0, 0.06, 0.15, 0.25));
  }

  return { head, eyes, face: decal.userData.face };
}
