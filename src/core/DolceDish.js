import * as THREE from 'three';
import { kit } from './Kit.js';

// v21 Stage 5 돌체(이탈리안 디저트) — 조리대 재료 조각과 완성 접시.
// 모든 조각은 원점이 바닥 가운데(y = 0 이 놓이는 면)이고 userData.h = 쌓이는 높이.
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const COL = {
  biscuit: '#e2b673',
  biscuitDark: '#a9763c',
  soaked: '#8a5a2c',
  cream: '#f7f0df',
  cocoa: '#4a2b19',
  panna: '#fbf5e6',
  coulis: '#b3122f',
  berry: '#2c3566',
  berryBloom: '#5a67a0',
  rasp: '#c21f3d',
  mint: '#4f9a4a',
};

const cream = () => kit.mat(COL.cream, { rough: 0.5, sheen: '#ffffff', clearcoat: 0.15 });
const biscuit = (soaked) => kit.mat(soaked ? COL.soaked : COL.biscuit, { rough: 0.85 });

// 사보이아르디(레이디핑거) 한 줄: 길쭉한 비스킷 4개
export function savoiardi({ n = 3, soaked = false } = {}) {
  const g = new THREE.Group();
  const m = biscuit(soaked);
  const top = kit.mat(soaked ? COL.biscuitDark : '#f0d39a', { rough: 0.95 });
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * 0.0255;
    const b = kit.rbox(0.088, 0.014, 0.023, m, { r: 0.0065 });
    b.position.set((i % 2) * 0.002 - 0.001, 0.007, z);
    b.userData.biscuit = 'body';
    g.add(b);
    // 윗면의 설탕 결
    const s = kit.rbox(0.07, 0.003, 0.014, top, { r: 0.0014 });
    s.position.set(b.position.x, 0.0138, z);
    s.userData.biscuit = 'top';
    g.add(s);
  }
  g.userData.h = 0.0155;
  return g;
}

// 에스프레소 시럽을 머금은 비스킷: 색만 짙게 바꾼다
export function soak(group) {
  group.traverse((o) => {
    if (o.userData.biscuit === 'body') o.material = biscuit(true);
    if (o.userData.biscuit === 'top') o.material = kit.mat(COL.biscuitDark, { rough: 0.95 });
  });
}

// 마스카포네 크림 한 층 + 짤주머니로 짠 봉긋한 물결
export function mascarpone() {
  const g = new THREE.Group();
  const m = cream();
  const slab = kit.rbox(0.088, 0.014, 0.078, m, { r: 0.006 });
  slab.position.y = 0.007;
  g.add(slab);
  for (let ix = 0; ix < 3; ix++)
    for (let iz = 0; iz < 3; iz++) {
      const d = kit.scl(kit.sphere(0.0125, m), 1, 0.62, 1);
      d.position.set((ix - 1) * 0.027, 0.0135, (iz - 1) * 0.0245);
      g.add(d);
    }
  g.userData.h = 0.021;
  return g;
}

// 판나코타 푸딩 (틀에서 뒤집어 낸 사다리꼴, 윗모서리는 둥글게)
export const PANNA = { r0: 0.04, r1: 0.031, h: 0.044 };
export function pannacotta() {
  const { r0, r1, h } = PANNA;
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r0, 0), new THREE.Vector2(r0 + 0.0008, 0.004)];
  for (let i = 1; i <= 6; i++) {
    const u = i / 6;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * u, 0.004 + (h - 0.01) * u));
  }
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r1 - 0.006 + Math.cos(a) * 0.006, h - 0.006 + Math.sin(a) * 0.006));
  }
  pts.push(new THREE.Vector2(0, h));
  const m = new THREE.MeshPhysicalMaterial({ color: lin(COL.panna), roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  m.envMapIntensity = 0.8;
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), m);
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  // 바닐라 빈 점
  const speck = kit.mat('#3a2a1c', { rough: 0.7 });
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.006 + (i % 4) * 0.005;
    const s = kit.sphere(0.0007, speck, { ws: 6, hs: 4 });
    s.position.set(Math.cos(a) * r, h + 0.0002, Math.sin(a) * r);
    s.castShadow = false;
    g.add(s);
  }
  g.userData.h = h;
  return g;
}

function blueberry(r = 0.0068) {
  const g = new THREE.Group();
  const b = kit.sphere(r, kit.mat(COL.berry, { rough: 0.45, clearcoat: 0.3 }));
  b.position.y = r;
  g.add(b);
  const c = kit.cyl(r * 0.34, r * 0.24, r * 0.2, kit.mat(COL.berryBloom, { rough: 0.8 }), { seg: 8 });
  c.position.y = r * 1.95;
  g.add(c);
  return g;
}

// 생블루베리 세 알 (삼각으로 모아서)
export function blueberries() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const b = blueberry(0.0066 + (i % 2) * 0.0006);
    b.position.set(Math.cos(a) * 0.0085, 0, Math.sin(a) * 0.0085);
    b.rotation.set(0.3 * i, i, 0.2);
    g.add(b);
  }
  g.userData.h = 0.0125;
  return g;
}

function mintLeaf(len = 0.02) {
  const geo = new THREE.PlaneGeometry(len, len * 0.62, 6, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (len / 2);
    const y = pos.getY(i) / (len * 0.31);
    const taper = Math.sqrt(Math.max(0, 1 - x * x));
    pos.setY(i, pos.getY(i) * taper);
    pos.setZ(i, (1 - x * x) * 0.0022 - Math.abs(y) * taper * 0.0014);
  }
  geo.computeVertexNormals();
  const m = kit.mat(COL.mint, { rough: 0.55, side: 'double' });
  const leaf = new THREE.Mesh(geo, m);
  leaf.rotation.x = -Math.PI / 2;
  leaf.castShadow = true;
  return leaf;
}

// 민트 잎 한 쌍
export function mint() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const l = mintLeaf(0.021);
    l.position.set(s * 0.008, 0.0035, 0);
    l.rotation.z = s * 0.35;
    l.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(l);
  }
  g.userData.h = 0.006;
  return g;
}

// 조리대 재료 밧드에 담기는 한 접시 분량 (BoardBench.panPortion 이 부른다). 없으면 null
export function dolcePortion(id) {
  if (id === 'savoiardi') return savoiardi();
  if (id === 'mascarpone') return mascarpone();
  if (id === 'pannacotta') return pannacotta();
  if (id === 'blueberry') return blueberries();
  if (id === 'mint') return mint();
  return null;
}

// ───── 완성 접시 ─────
function plate(r = 0.13) {
  const g = new THREE.Group();
  const m = kit.ceramic('#efebe3');
  g.add(kit.at(kit.cyl(r, r * 0.8, 0.014, m, { seg: 40 }), 0, 0.007, 0));
  g.add(kit.at(kit.torus(r - 0.004, 0.006, m), 0, 0.014, 0, Math.PI / 2));
  return g;
}
const PLATE_TOP = 0.014;

function cocoaDust(g, y, half, n = 60, seed = 3) {
  const m = kit.mat(COL.cocoa, { rough: 1 });
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647), s / 2147483647);
  for (let i = 0; i < n; i++) {
    const d = kit.box(0.0018, 0.0008, 0.0018, m);
    d.castShadow = false;
    d.position.set((rnd() * 2 - 1) * half[0], y, (rnd() * 2 - 1) * half[1]);
    d.rotation.y = rnd() * 3;
    g.add(d);
  }
}

function tiramisuPlate() {
  const g = plate();
  const body = new THREE.Group();
  let y = PLATE_TOP;
  // 시럽에 적신 비스킷 → 크림 → 비스킷 → 크림 → 코코아
  const layers = [
    [0.015, biscuit(true), 0.004],
    [0.013, cream(), 0.005],
    [0.013, biscuit(true), 0.004],
    [0.015, cream(), 0.006],
  ];
  for (const [h, m, r] of layers) {
    const b = kit.rbox(0.088, h, 0.08, m, { r });
    b.position.y = y + h / 2;
    body.add(b);
    y += h - 0.0006;
  }
  const top = kit.rbox(0.086, 0.0022, 0.078, kit.mat(COL.cocoa, { rough: 1 }), { r: 0.001 });
  top.position.y = y + 0.0011;
  body.add(top);
  y += 0.0022;
  // 짤주머니 크림 세 송이 + 민트
  for (let i = 0; i < 3; i++) {
    const d = kit.scl(kit.sphere(0.011, cream()), 1, 0.75, 1);
    d.position.set(-0.024 + i * 0.024, y + 0.004, -0.022);
    body.add(d);
    const tip = kit.cone(0.004, 0.007, cream(), { seg: 10 });
    tip.position.set(-0.024 + i * 0.024, y + 0.0135, -0.022);
    body.add(tip);
  }
  const mt = mint();
  mt.position.set(0.02, y, 0.018);
  mt.rotation.y = 0.6;
  body.add(mt);
  body.rotation.y = 0.3;
  g.add(body);
  cocoaDust(g, PLATE_TOP + 0.0006, [0.1, 0.1], 46, 11);
  return g;
}

function pannacottaPlate() {
  const g = plate();
  const p = pannacotta();
  p.position.y = PLATE_TOP;
  g.add(p);
  const coul = new THREE.MeshPhysicalMaterial({ color: lin(COL.coulis), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  coul.envMapIntensity = 1.2;
  // 접시에 고인 쿨리 + 윗면을 덮고 흘러내리는 쿨리
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.068, 0.0016, 40), coul);
  pool.position.y = PLATE_TOP + 0.0008;
  pool.scale.set(1, 1, 0.86);
  g.add(pool);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), coul);
  cap.scale.set(1, 0.14, 1);
  cap.position.y = PLATE_TOP + PANNA.h - 0.0012;
  g.add(cap);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.07 + 0.3;
    const len = 0.014 + (i % 3) * 0.008;
    const r = PANNA.r1 + 0.0034 + (len / PANNA.h) * (PANNA.r0 - PANNA.r1) * 0.5;
    const d = kit.capsule(0.0026, len, coul);
    d.position.set(Math.cos(a) * r, PLATE_TOP + PANNA.h - 0.006 - len / 2, Math.sin(a) * r);
    d.rotation.set(Math.sin(a) * -0.2, 0, Math.cos(a) * 0.2);
    d.castShadow = false;
    g.add(d);
  }
  const bb = blueberries();
  bb.position.y = PLATE_TOP + PANNA.h + 0.0028;
  g.add(bb);
  const mt = mint();
  mt.position.set(0.004, PLATE_TOP + PANNA.h + 0.0125, -0.004);
  mt.rotation.y = 0.9;
  g.add(mt);
  // 접시 가장자리의 베리 두세 알
  for (const [x, z, r] of [
    [0.062, 0.03, 0.0066],
    [-0.058, 0.04, 0.007],
    [0.03, -0.066, 0.0062],
  ]) {
    const b = blueberry(r);
    b.position.set(x, PLATE_TOP + 0.0014, z);
    g.add(b);
  }
  const rasp = kit.mat(COL.rasp, { rough: 0.4, clearcoat: 0.4 });
  for (const [x, z] of [
    [-0.066, -0.02],
    [0.07, -0.022],
  ]) {
    const r = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = kit.sphere(0.0034, rasp, { ws: 10, hs: 8 });
      s.position.set(i < 6 ? Math.cos(a) * 0.0042 : 0, i < 6 ? 0.004 : 0.0078, i < 6 ? Math.sin(a) * 0.0042 : 0);
      r.add(s);
    }
    r.position.set(x, PLATE_TOP + 0.0014, z);
    g.add(r);
  }
  return g;
}

export function buildDolceDish(recipeId) {
  if (recipeId === 's1_tiramisu') return tiramisuPlate();
  if (recipeId === 's1_pannacotta') return pannacottaPlate();
  return null;
}
