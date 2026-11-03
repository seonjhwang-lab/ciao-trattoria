import * as THREE from 'three';
import { mat, mesh, once, M, rng, canvasTex, basilLeaf, arugula, scatter, figWedge, cherryHalf, avocadoSlice } from './HeroDish.js';
import { sectionTexture } from '../workbench/benchTextures.js';
import { RoundedBoxGeometry } from './RoundedBox.js';

// ─────────────────────────────────────────────────────────────
// 비스트로 완성품 전용 고디테일 모델 (생면 파스타 3 · 화덕 피자 2 · 가든 샐러드 2)
//  원점 = 그릇/보드 바닥 중심, +z 정면, 단위 m.
//  파스타: 넓은 림 파스타 볼 + 트위저로 돌돌 말아 올린 윤기 나는 생면 타워 + 소스 + 눈꽃 파르미지아노 + 바질
//  피자:   나무 페들 보드 + 8조각으로 자른 화덕 피자(부푼 코르니초네 · 레오파드 그을음) + 녹아내린 부팔라 · 루꼴라
//  샐러드: 원목 볼 + 형형색색 단면이 보이는 채소 · 과일 + 리코타/크루통 + 드레싱
// ─────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;

// ── 파스타 볼: 굽 + 깊지 않은 우묵한 가운데 + 넓은 림 ──
function pastaBowl() {
  const prof = [
    [0, 0.006],
    [0.05, 0.006],
    [0.054, 0.002],
    [0.058, 0],
    [0.066, 0],
    [0.07, 0.006],
    [0.085, 0.022],
    [0.096, 0.03],
    [0.14, 0.036],
    [0.152, 0.04],
    [0.154, 0.043],
    [0.15, 0.044],
    [0.138, 0.04],
    [0.094, 0.034],
    [0.082, 0.026],
    [0.064, 0.013],
    [0.04, 0.0095],
    [0, 0.0092],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  g.add(mesh(once('pastaBowl', () => new THREE.LatheGeometry(prof, 64)), M('pastaGlaze', () => mat('#f7f3ea', { rough: 0.16, cc: 0.8, ccRough: 0.06, env: 0.8 }))));
  g.add(mesh(once('pastaBowlRim', () => new THREE.TorusGeometry(0.149, 0.0013, 6, 72)), M('pastaRimLine', () => mat('#3f5f78', { rough: 0.35 })), 0, 0.0435, 0, Math.PI / 2));
  g.userData.top = 0.0095;
  return g;
}

// 곡선을 따라 납작한 리본 (폭 방향 = 위쪽 + 바깥쪽을 섞은 방향) → 탈리아텔레·파파르델레
export function ribbonGeo(curve, width, thick, segs = 160) {
  const pos = [];
  const nor = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    const radial = new THREE.Vector3(P.x, 0, P.z).normalize();
    W.copy(up).multiplyScalar(0.85).addScaledVector(radial, 0.35);
    W.addScaledVector(T, -W.dot(T)).normalize();
    N.crossVectors(T, W).normalize();
    // 단면 4점 (납작한 사각)
    const c = [
      [width / 2, thick / 2],
      [-width / 2, thick / 2],
      [-width / 2, -thick / 2],
      [width / 2, -thick / 2],
    ];
    for (const [w, n] of c) {
      pos.push(P.x + W.x * w + N.x * n, P.y + W.y * w + N.y * n, P.z + W.z * w + N.z * n);
      const nn = N.clone().multiplyScalar(Math.sign(n)).addScaledVector(W, Math.sign(w) * 0.25).normalize();
      nor.push(nn.x, nn.y, nn.z);
    }
    if (i < segs) {
      const a = i * 4;
      const b = a + 4;
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        idx.push(a + k, b + k2, b + k, a + k, a + k2, b + k2); // 바깥을 향하는 감김 (외곽선 헐이 면을 덮지 않게)
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

// 돌돌 말린 생면 타워: 아래가 넓고 위로 갈수록 좁아지는 나선 여러 겹
export function pastaNest({ width = 'thin', color = '#efcf7a', gloss = 0.8, seed = 7, r0 = 0.052, h = 0.05 } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  const m = mat(color, { rough: 0.32, cc: gloss, ccRough: 0.12, env: 0.8 });
  const strands = width === 'thin' ? 9 : width === 'medium' ? 6 : 4;
  for (let s = 0; s < strands; s++) {
    const pts = [];
    const turns = 3.2 + r() * 1.2;
    const phase = r() * TAU;
    const n = 70;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = phase + u * turns * TAU;
      const rad = r0 * (1 - u * 0.72) * (0.85 + 0.15 * Math.sin(a * 0.5 + s)) + (r() - 0.5) * 0.002;
      const y = 0.004 + u * h + Math.sin(a * 2 + s) * 0.003;
      pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = width === 'thin' ? new THREE.TubeGeometry(curve, 220, 0.0018, 6, false) : ribbonGeo(curve, width === 'medium' ? 0.0075 : 0.016, 0.0012, 220);
    const strand = mesh(geo, m);
    strand.userData.noOutline = true; // 가는 면발은 잉크 외곽선을 빼야 윤기가 산다
    g.add(strand);
  }
  // 꼭대기 소용돌이 마무리
  const top = [];
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    const a = u * 2.2 * TAU;
    top.push(new THREE.Vector3(Math.cos(a) * r0 * 0.25 * (1 - u * 0.8), h + 0.004 + u * 0.004, Math.sin(a) * r0 * 0.25 * (1 - u * 0.8)));
  }
  const cap = mesh(width === 'thin' ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), 80, 0.0018, 6, false) : ribbonGeo(new THREE.CatmullRomCurve3(top), width === 'medium' ? 0.007 : 0.012, 0.0012, 80), m);
  cap.userData.noOutline = true;
  g.add(cap);
  g.userData.h = h;
  return g;
}

// 눈꽃 파르미지아노 (아주 얇은 조각 인스턴스)
export function parmesanSnow(spots, seed = 11, size = 1) {
  const r = rng(seed);
  const inst = new THREE.InstancedMesh(once('parmFlake', () => new THREE.BoxGeometry(0.0026, 0.0004, 0.0018)), M('parmMat', () => mat('#fffaf0', { rough: 0.6 })), spots.length);
  const o = new THREE.Object3D();
  spots.forEach(([x, y, z], i) => {
    o.position.set(x, y, z);
    o.rotation.set(r() * 0.8, r() * TAU, r() * 0.8);
    o.scale.setScalar((0.6 + r() * 0.9) * size);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  });
  inst.castShadow = false;
  return inst;
}

// 나선 타워 표면 위의 점들 (치즈·소스가 올라앉을 자리)
function nestSurface(n, r0, h, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const u = Math.pow(r(), 0.6);
    const a = r() * TAU;
    const rad = r0 * (1 - u * 0.72) * (0.6 + r() * 0.45);
    return [Math.cos(a) * rad, 0.006 + u * h + 0.004, Math.sin(a) * rad];
  });
}

function blob(rad, color, { seed = 1, flat = 0.55, bumps = 0.18, rough = 0.35, cc = 0.6 } = {}) {
  const geo = new THREE.IcosahedronGeometry(rad, 2);
  const p = geo.attributes.position;
  const r = rng(seed);
  const off = [r() * 9, r() * 9, r() * 9];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + bumps * Math.sin(v.x * 140 + off[0]) * Math.sin(v.z * 130 + off[1]) + bumps * 0.5 * Math.sin(v.y * 160 + off[2]);
    v.multiplyScalar(k);
    v.y = Math.max(-rad * 0.15, v.y) * flat;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { rough, cc, ccRough: 0.15 }));
}

function mushroomSlice() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.006, 0);
  s.lineTo(-0.006, 0.012);
  s.bezierCurveTo(-0.018, 0.012, -0.02, 0.03, 0, 0.031);
  s.bezierCurveTo(0.02, 0.03, 0.018, 0.012, 0.006, 0.012);
  s.lineTo(0.006, 0);
  s.closePath();
  const geo = once('mushSlice', () => {
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 10 });
    e.rotateX(-Math.PI / 2);
    return e;
  });
  g.add(mesh(geo, M('mushMat', () => mat('#b88a5c', { rough: 0.45, cc: 0.5 }))));
  return g;
}

function truffleShave(seed) {
  const tex = canvasTex('truffleTex', 64, 64, (c, w) => {
    c.fillStyle = '#2b2018';
    c.fillRect(0, 0, w, w);
    const r = rng(3);
    c.strokeStyle = 'rgba(214,190,160,0.75)';
    c.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      c.beginPath();
      c.moveTo(r() * w, r() * w);
      c.bezierCurveTo(r() * w, r() * w, r() * w, r() * w, r() * w, r() * w);
      c.stroke();
    }
  });
  const m = mesh(once('truffleGeo', () => new THREE.CircleGeometry(0.011, 18)), M('truffleMat', () => mat('#ffffff', { map: tex, rough: 0.5, side: THREE.DoubleSide })));
  m.rotation.x = -Math.PI / 2 + (rng(seed)() - 0.5) * 0.6;
  return m;
}

const SAUCE = {
  truffle: { pasta: '#ead39a', sauce: '#e9d7a8', name: 'truffle' },
  ragu: { pasta: '#d9945a', sauce: '#8f2f18', name: 'ragu' },
  pesto: { pasta: '#b5bf5a', sauce: '#4f7a24', name: 'pesto' },
};

function pastaDish(kind) {
  const S = SAUCE[kind];
  const g = new THREE.Group();
  const bowl = pastaBowl();
  g.add(bowl);
  const base = bowl.userData.top;
  const width = kind === 'truffle' ? 'thin' : kind === 'ragu' ? 'wide' : 'medium';
  // 바닥 소스 웅덩이
  // 걸쭉한 소스 웅덩이: 가장자리가 표면장력으로 둥글게 말린 도톰한 층 + 물결 요철 (평평한 원판 금지)
  const poolGeo = once('saucePool', () => {
    const prof = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const r = 0.078 * u;
      const h = 0.0045 * Math.sqrt(Math.max(0, 1 - Math.pow(u, 8)));
      prof.push(new THREE.Vector2(r, h));
    }
    prof.reverse();
    const e = new THREE.LatheGeometry(prof, 48);
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const r = Math.hypot(x, z);
      const k = 1 + Math.sin(a * 5) * 0.06 + Math.sin(a * 11 + 1) * 0.03;
      p.setXYZ(i, Math.cos(a) * r * k, p.getY(i) * (1 + Math.sin(r * 300) * 0.08), Math.sin(a) * r * k);
    }
    e.computeVertexNormals();
    return e;
  });
  const pool = mesh(poolGeo, mat(S.sauce, { rough: 0.16, cc: 1, ccRough: 0.05, env: 0.9 }), 0, base, 0);
  pool.userData.noOutline = true;
  g.add(pool);
  // 소스 위 반짝이는 오일 방울
  const rr = rng(kind.length * 9);
  for (let i = 0; i < 9; i++) {
    const a = rr() * TAU;
    const d = 0.03 + rr() * 0.04;
    const dot = mesh(once('oilBead', () => new THREE.SphereGeometry(0.0025, 10, 6, 0, TAU, 0, Math.PI / 2)), M('oilBeadMat', () => mat('#f2c45a', { rough: 0.02, cc: 1, opacity: 0.75 })), Math.cos(a) * d, base + 0.004, Math.sin(a) * d);
    dot.scale.set(1, 0.4, 1);
    g.add(dot);
  }
  const nest = pastaNest({ width, color: S.pasta, seed: kind.length * 3, r0: 0.068, h: 0.06 });
  nest.position.y = base;
  nest.rotation.y = 0.4;
  g.add(nest);
  const top = base + nest.userData.h;
  if (kind === 'ragu') {
    // 꾸덕한 라구 한 국자 (고기 알갱이)
    const rag = blob(0.026, '#8a2c16', { seed: 4, flat: 0.5, bumps: 0.22, rough: 0.4, cc: 0.5 });
    rag.position.set(0.004, top - 0.004, 0.002);
    g.add(rag);
    const r = rng(9);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.024;
      g.add(mesh(once('mince', () => new THREE.IcosahedronGeometry(0.0022, 0)), M('minceMat', () => mat('#5a2414', { rough: 0.7 })), Math.cos(a) * d, top + 0.004 + r() * 0.004, Math.sin(a) * d, r() * 3, r() * 3, 0));
    }
  } else if (kind === 'truffle') {
    const r = rng(5);
    for (let i = 0; i < 5; i++) {
      const m = mushroomSlice();
      const a = (i / 5) * TAU + 0.3;
      m.position.set(Math.cos(a) * 0.022, top - 0.012 + r() * 0.006, Math.sin(a) * 0.022);
      m.rotation.set(0.4, a, 0.3);
      g.add(m);
    }
    for (let i = 0; i < 7; i++) {
      const t = truffleShave(i + 1);
      const a = r() * TAU;
      t.position.set(Math.cos(a) * 0.014 * r(), top + 0.004 + i * 0.0008, Math.sin(a) * 0.014 * r());
      g.add(t);
    }
  } else {
    const pe = blob(0.017, '#3f6a1c', { seed: 6, flat: 0.45, bumps: 0.25, rough: 0.3, cc: 0.7 });
    pe.position.set(0, top - 0.003, 0);
    g.add(pe);
    const r = rng(12);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU;
      const nut = mesh(once('pine', () => new THREE.SphereGeometry(0.0022, 8, 6)), M('pineMat', () => mat('#f0dcaa', { rough: 0.5 })), Math.cos(a) * 0.03, top - 0.01 + r() * 0.01, Math.sin(a) * 0.03, 0, a, 0);
      nut.scale.set(1, 0.6, 1.6);
      g.add(nut);
    }
    // 볼 가장자리 방울토마토 세 알
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.7;
      const c = cherryHalf();
      c.position.set(Math.cos(a) * 0.075, base + 0.004, Math.sin(a) * 0.075);
      g.add(c);
    }
  }
  // 눈꽃 파르미지아노 + 바질
  g.add(parmesanSnow(nestSurface(180, 0.066, nest.userData.h, kind.length), kind.length * 7, 1.5));
  for (let i = 0; i < (kind === 'ragu' ? 2 : 3); i++) {
    const b = basilLeaf(kind === 'pesto' ? 1.15 : 0.95);
    b.position.set(-0.004 + i * 0.008, top + 0.006 + i * 0.002, -0.003 + i * 0.004);
    b.rotation.y = 0.6 + i * 2.1;
    b.rotation.x = -0.35;
    g.add(b);
  }
  // 림 위 후추 · 올리브오일 점
  const r = rng(kind.length * 5);
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const d = 0.105 + r() * 0.03;
    g.add(mesh(once('rimPep', () => new THREE.IcosahedronGeometry(0.0009, 0)), M('pepMat2', () => mat('#1c1714', { rough: 0.7 })), Math.cos(a) * d, 0.0375 + (d - 0.105) * 0.12, Math.sin(a) * d));
  }
  return g;
}

// ── 화덕 피자 ──
// 부풀어 오른 테두리: 토러스 조각을 정점 변형 — 링 반지름이 손으로 편 듯 출렁이고, 윗면에 불규칙한 공기 주머니가 솟는다
const blisterSeeds = new Map();
function blisterRim(R0, tube, len, a0, seed) {
  if (!blisterSeeds.has(seed)) {
    const r = rng(seed * 97 + 5);
    blisterSeeds.set(seed, Array.from({ length: 26 }, () => [r() * TAU, 0.18 + r() * 0.5, 0.05 + r() * 0.12, r() * 1.6 - 0.8]));
  }
  const bl = blisterSeeds.get(seed);
  const geo = new THREE.TorusGeometry(R0, tube, 14, 28, len);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.atan2(v.y, v.x);
    const tg = th + a0;
    const c = new THREE.Vector3(Math.cos(th) * R0, Math.sin(th) * R0, 0);
    const off = v.clone().sub(c);
    // 윗면(로컬 -z) 쪽일수록 부푼다
    const up = Math.max(0, -off.z / tube);
    let b = 0;
    for (const [ba, amp, wid, side] of bl) {
      const d = Math.atan2(Math.sin(tg - ba), Math.cos(tg - ba));
      b += amp * Math.exp(-((d / wid) ** 2)) * Math.max(0, 1 - Math.abs(off.x * Math.cos(th) + off.y * Math.sin(th)) / tube * 0.3 * side);
    }
    const k = 1 + b * (0.35 + up * 0.9) + Math.sin(tg * 23) * 0.04;
    const Rv = R0 * (1 + Math.sin(tg * 3 + 1) * 0.016 + Math.sin(tg * 7 + 2) * 0.008);
    const cr = new THREE.Vector3(Math.cos(th) * Rv, Math.sin(th) * Rv, 0);
    v.copy(cr).add(off.multiplyScalar(k));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// 녹아 퍼진 부팔라 모짜렐라 패치: 가장자리가 불규칙하게 흘러내린 유백색 막 + 노릇한 반점
function meltedMozz(seed, rad) {
  const r = rng(seed * 13 + 1);
  const geo = new THREE.RingGeometry(0.0001, rad, 40, 5);
  const p = geo.attributes.position;
  const lobes = Array.from({ length: 5 }, () => [r() * TAU, 0.12 + r() * 0.25, 0.3 + r() * 0.5]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const a = Math.atan2(y, x);
    const d = Math.hypot(x, y);
    let k = 1 + Math.sin(a * 7 + seed) * 0.06;
    for (const [la, amp, w] of lobes) k += amp * Math.exp(-((Math.atan2(Math.sin(a - la), Math.cos(a - la)) / w) ** 2));
    const t = d / rad;
    const h = 0.0042 * Math.pow(Math.max(0, 1 - t * t), 0.55) + (r() - 0.5) * 0.0004;
    p.setXYZ(i, Math.cos(a) * d * k, Math.sin(a) * d * k, h);
  }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const tex = canvasTex('mozzPatch', 128, 128, (c, w) => {
    const rr = rng(21);
    const g = c.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(0.7, '#fbf3e0');
    g.addColorStop(1, '#efe0bf');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (rr() - 0.5) * w * 0.7;
      const y = w / 2 + (rr() - 0.5) * w * 0.7;
      const s = 3 + rr() * 7;
      const gg = c.createRadialGradient(x, y, 0, x, y, s);
      gg.addColorStop(0, 'rgba(200,130,50,0.75)');
      gg.addColorStop(1, 'rgba(230,180,100,0)');
      c.fillStyle = gg;
      c.beginPath();
      c.arc(x, y, s, 0, TAU);
      c.fill();
    }
  });
  const m = mesh(geo, M('mozzPatchMat', () => mat('#ffffff', { map: tex, rough: 0.28, cc: 0.65, ccRough: 0.2, sheen: '#ffffff' })));
  return m;
}
function pizzaTexture(kind) {
  return canvasTex('pizzaTop|' + kind, 512, 512, (c, w) => {
    const R = w / 2;
    const r = rng(kind.length * 31);
    c.fillStyle = '#e8c17c';
    c.fillRect(0, 0, w, w);
    // 소스 (토마토: 붉은 결 / 트러플 크림: 아이보리)
    const sauce = kind === 'truffle' ? ['#efe3c3', '#e3cf9e', '#f6ecd2'] : ['#b8341c', '#9e2914', '#cf4a28'];
    c.fillStyle = sauce[0];
    c.beginPath();
    c.arc(R, R, R * 0.86, 0, TAU);
    c.fill();
    for (let i = 0; i < 70; i++) {
      c.strokeStyle = sauce[1 + (i % 2)];
      c.globalAlpha = 0.35;
      c.lineWidth = 5 + r() * 8;
      c.beginPath();
      const a = r() * TAU;
      const d = r() * R * 0.78;
      c.arc(R, R, d, a, a + 0.6 + r());
      c.stroke();
    }
    c.globalAlpha = 1;
    // 오일 반짝임 + 그을린 점
    for (let i = 0; i < 90; i++) {
      c.fillStyle = r() < 0.6 ? 'rgba(255,214,120,0.35)' : 'rgba(60,25,10,0.35)';
      c.beginPath();
      c.arc(R + (r() - 0.5) * R * 1.6, R + (r() - 0.5) * R * 1.6, 2 + r() * 5, 0, TAU);
      c.fill();
    }
  });
}

function crustTex() {
  return canvasTex('crustLeopard', 256, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f1d39a');
    g.addColorStop(0.5, '#d9a35a');
    g.addColorStop(1, '#c78a44');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = rng(17);
    // 레오파드 그을음 (나폴리 화덕 특유의 검은 반점)
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = r() * h;
      const s = 1.5 + r() * 5;
      const gr = c.createRadialGradient(x, y, 0, x, y, s * 1.6);
      gr.addColorStop(0, 'rgba(40,20,10,0.9)');
      gr.addColorStop(0.6, 'rgba(90,45,15,0.5)');
      gr.addColorStop(1, 'rgba(120,60,20,0)');
      c.fillStyle = gr;
      c.beginPath();
      c.arc(x, y, s * 1.6, 0, TAU);
      c.fill();
    }
    for (let i = 0; i < 200; i++) {
      c.fillStyle = 'rgba(255,250,235,0.35)';
      c.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
}

function prosciuttoRibbon(seed) {
  const r = rng(seed * 7 + 3);
  const geo = new THREE.PlaneGeometry(0.072, 0.026, 36, 8);
  const p = geo.attributes.position;
  const ph = r() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    // 접혀 쌓인 주름 + 가장자리 프릴 + 살짝 비틀림
    const fold = Math.sin(x * 120 + ph) * 0.0045 * (0.6 + Math.sin(x * 37 + ph) * 0.4);
    const frill = Math.sin(x * 260 + y * 40) * 0.0008 * (Math.abs(y) / 0.013) ** 2;
    p.setZ(i, fold + frill + y * Math.sin(x * 40 + ph) * 0.15);
    p.setY(i, y * (1 + Math.sin(x * 90 + ph) * 0.12));
  }
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.005, 0);
  geo.computeVertexNormals();
  const tex = canvasTex('prosTex2', 256, 96, (c, w, h) => {
    const rr = rng(9);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f6e6dc'); // 지방 테두리
    g.addColorStop(0.16, '#f1d6c8');
    g.addColorStop(0.24, '#d4776f');
    g.addColorStop(0.6, '#c45d5a');
    g.addColorStop(1, '#b84e4f');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // 근섬유 결 + 마블링
    for (let i = 0; i < 90; i++) {
      c.strokeStyle = rr() < 0.7 ? 'rgba(150,40,45,0.25)' : 'rgba(250,225,215,0.5)';
      c.lineWidth = 0.6 + rr() * 1.4;
      c.beginPath();
      const y = h * (0.25 + rr() * 0.75);
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + (rr() - 0.5) * 10, w * 0.7, y + (rr() - 0.5) * 10, w, y + (rr() - 0.5) * 6);
      c.stroke();
    }
  });
  const m = mesh(geo, M('prosMat2', () => mat('#ffffff', { map: tex, rough: 0.36, cc: 0.55, ccRough: 0.2, side: THREE.DoubleSide, sheen: '#ffd8d0' })));
  m.userData.noOutline = true;
  return m;
}

// 10차 토핑 층: 나중에 올린 재료가 먼저 깔린 치즈 밑으로 파고들지 않게 (renderOrder · polygonOffset)
function layerize(o, layer) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.renderOrder = layer;
    const ms = Array.isArray(m.material) ? m.material : [m.material];
    m.material = ms.map((x) => {
      const c = x.clone();
      c.polygonOffset = true;
      c.polygonOffsetFactor = layer >= 4 ? -4 : layer >= 3 ? -2 : 0;
      c.polygonOffsetUnits = layer >= 4 ? -4 : layer >= 3 ? -2 : 0;
      return c;
    });
    if (m.material.length === 1) m.material = m.material[0];
  });
}

function pizzaDish(kind) {
  const g = new THREE.Group();
  // 나무 페들 보드 (손잡이 오른쪽 앞)
  const wood = M('peelWood', () => mat('#c9a173', { rough: 0.55 }));
  g.add(mesh(once('peelBoard', () => new THREE.CylinderGeometry(0.185, 0.185, 0.016, 56)), wood, 0, 0.008, 0));
  g.add(mesh(once('peelHandle', () => new THREE.BoxGeometry(0.16, 0.016, 0.05)), wood, 0.25, 0.008, 0.0));
  g.add(mesh(once('peelHole', () => new THREE.TorusGeometry(0.01, 0.003, 6, 18)), M('peelDark', () => mat('#7a5a3a', { rough: 0.7 })), 0.31, 0.0165, 0, Math.PI / 2));
  const y0 = 0.016;
  const R = 0.155;
  const top = pizzaTexture(kind);
  const baseMat = M('pizzaBase|' + kind, () => mat('#ffffff', { map: top, rough: 0.42, cc: 0.4, ccRough: 0.3 }));
  const crust = M('pizzaCrust', () => mat('#ffffff', { map: crustTex(), rough: 0.6, cc: 0.15 }));
  const gap = 0.012; // 8조각 칼집
  const pie = new THREE.Group();
  pie.position.y = y0;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU + gap / 2;
    const len = TAU / 8 - gap;
    const wedge = new THREE.Group();
    // 바닥: 원판 조각 (UV 를 상판 텍스처 좌표로)
    const geo = new THREE.CylinderGeometry(R - 0.012, R - 0.012, 0.006, 16, 1, false, a0, len);
    const uv = geo.attributes.uv;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) / (2 * R) + 0.5, 0.5 - p.getZ(k) / (2 * R));
    const base = mesh(geo, baseMat, 0, 0.003, 0);
    base.userData.noOutline = true; // 8조각 칼집이 가운데로 모이며 검은 구멍처럼 보이지 않게
    wedge.add(base);
    // 부풀어 오른 테두리 (코르니초네)
    const rim = mesh(blisterRim(R - 0.012, 0.0132, len, a0, kind.length), crust, 0, 0.009, 0, Math.PI / 2, 0, 0);
    rim.rotation.z = a0;
    rim.scale.set(1, 1, 0.82);
    wedge.add(rim);
    pie.add(wedge);
  }
  g.add(pie);
  const yt = y0 + 0.0065;
  const r = rng(kind.length * 13);
  // 녹아내린 부팔라 모짜렐라 (반투명 크리미 + 살짝 그을린 점)
  const mozz = kind === 'truffle' ? 9 : 7;
  for (let i = 0; i < mozz; i++) {
    const a = (i / mozz) * TAU + r() * 0.4;
    const d = i === 0 ? 0 : 0.06 + r() * 0.04;
    const m = meltedMozz(i + kind.length, 0.024 + r() * 0.007);
    m.position.set(Math.cos(a) * d, yt + 0.0004, Math.sin(a) * d);
    m.rotation.y = r() * TAU;
    g.add(m);
    for (let k = 0; k < 2; k++) g.add(mesh(once('mozBrown', () => new THREE.CircleGeometry(0.004, 10)), M('mozBrownMat', () => mat('#c88a3e', { rough: 0.6, opacity: 0.75 })), Math.cos(a) * d + (r() - 0.5) * 0.02, yt + 0.006, Math.sin(a) * d + (r() - 0.5) * 0.02, -Math.PI / 2));
  }
  if (kind === 'margherita') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.5;
      const b = basilLeaf(1.25);
      b.position.set(Math.cos(a) * 0.075, yt + 0.012, Math.sin(a) * 0.075);
      layerize(b, 4);
      b.rotation.y = a + 1;
      g.add(b);
    }
    const b = basilLeaf(1.4);
    b.position.set(0.004, yt + 0.014, 0);
    layerize(b, 4);
    g.add(b);
    // 올리브오일 반짝임
    for (let i = 0; i < 12; i++) {
      const a = r() * TAU;
      const d = r() * 0.12;
      g.add(mesh(once('oilDot', () => new THREE.CircleGeometry(0.003, 10)), M('oilDotMat', () => mat('#d8b43a', { rough: 0.05, cc: 1, opacity: 0.7 })), Math.cos(a) * d, yt + 0.0045, Math.sin(a) * d, -Math.PI / 2));
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const pr = prosciuttoRibbon(i + 2);
      const a = (i / 6) * TAU + 0.2;
      pr.position.set(Math.cos(a) * 0.08, yt + 0.012, Math.sin(a) * 0.08);
      layerize(pr, 3);
      pr.rotation.y = -a;
      g.add(pr);
    }
    // 가운데 루꼴라 산 + 트러플 슬라이스 + 파르미지아노
    for (let i = 0; i < 14; i++) {
      const l = arugula();
      const a = r() * TAU;
      const d = r() * 0.05;
      l.position.set(Math.cos(a) * d, yt + 0.018 + r() * 0.01, Math.sin(a) * d);
      layerize(l, 4);
      l.rotation.set((r() - 0.5) * 0.8, r() * TAU, (r() - 0.5) * 0.5);
      l.scale.setScalar(1.3);
      g.add(l);
    }
    for (let i = 0; i < 6; i++) {
      const t = truffleShave(i + 4);
      const a = r() * TAU;
      t.position.set(Math.cos(a) * 0.1 * r(), yt + 0.016, Math.sin(a) * 0.1 * r());
      g.add(t);
    }
    g.add(parmesanSnow(scatter(90, 0.12, 0.12, yt + 0.01, 41), 41, 1.4));
  }
  return g;
}

// ── 가든 샐러드 ──
function saladBowl() {
  const prof = [
    [0, 0],
    [0.07, 0],
    [0.076, 0.004],
    [0.1, 0.02],
    [0.135, 0.05],
    [0.155, 0.075],
    [0.16, 0.082],
    [0.152, 0.083],
    [0.146, 0.076],
    [0.127, 0.05],
    [0.094, 0.022],
    [0.06, 0.012],
    [0, 0.011],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tex = canvasTex('bowlWood', 256, 256, (c, w) => {
    c.fillStyle = '#7a4f30';
    c.fillRect(0, 0, w, w);
    const r = rng(8);
    for (let i = 0; i < 60; i++) {
      c.strokeStyle = `rgba(${40 + r() * 40},${25 + r() * 20},${10 + r() * 10},0.45)`;
      c.lineWidth = 1 + r() * 2;
      c.beginPath();
      const y = r() * w;
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 20, w * 0.6, y + (r() - 0.5) * 20, w, y + (r() - 0.5) * 10);
      c.stroke();
    }
  });
  const g = new THREE.Group();
  g.add(mesh(once('saladBowl', () => new THREE.LatheGeometry(prof, 64)), M('bowlWoodMat', () => mat('#ffffff', { map: tex, rough: 0.45, cc: 0.35, side: THREE.DoubleSide }))));
  g.userData.top = 0.011;
  return g;
}

function leaf(color, size, seed) {
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(1, 1, 24, 10);
  const p = geo.attributes.position;
  const ph = r() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); // -0.5..0.5 (밑동 → 잎끝)
    let y = p.getY(i);
    const t = x + 0.5;
    // 잎 윤곽: 밑동은 좁고 끝으로 갈수록 넓어지다 둥글게 마무리
    const hw = 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.75) * (0.55 + 0.45 * t) + 0.02;
    y *= hw * 2;
    const e = Math.abs(y) / hw; // 0 = 줄기, 1 = 가장자리
    // 가장자리 프릴 (작은 물결 여러 겹) + 오목하게 말린 곡면 + 줄기를 따라 접힌 V자
    const frill = (Math.sin(t * 46 + ph) * 0.05 + Math.sin(t * 97 + ph * 2) * 0.025) * Math.pow(e, 2.2);
    const cup = e * e * 0.12 + Math.abs(y) * 0.12;
    const arch = Math.sin(Math.PI * t) * 0.1 - t * 0.06;
    p.setXYZ(i, x, y, frill + cup + arch);
  }
  geo.scale(size, size * 0.62, size);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const tex = canvasTex('leafTex2|' + color, 128, 128, (c, w) => {
    const base = new THREE.Color(color);
    // 가운데는 밝고 가장자리는 짙은 초록 (UV v=0.5 가 줄기)
    const g = c.createLinearGradient(0, 0, 0, w);
    g.addColorStop(0, base.clone().offsetHSL(0, 0.04, -0.06).getStyle());
    g.addColorStop(0.42, base.clone().offsetHSL(0, -0.08, 0.14).getStyle());
    g.addColorStop(0.5, '#eef4d6');
    g.addColorStop(0.58, base.clone().offsetHSL(0, -0.08, 0.14).getStyle());
    g.addColorStop(1, base.clone().offsetHSL(0, 0.04, -0.06).getStyle());
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    // 하얀 가운데 줄기 (밑동 쪽이 굵다)
    c.fillStyle = 'rgba(248,252,236,0.95)';
    c.beginPath();
    c.moveTo(0, w / 2 - 6);
    c.lineTo(w, w / 2 - 1.2);
    c.lineTo(w, w / 2 + 1.2);
    c.lineTo(0, w / 2 + 6);
    c.fill();
    // 곁맥
    c.strokeStyle = 'rgba(235,245,215,0.65)';
    c.lineWidth = 1.1;
    for (let x = 10; x < w; x += 11) {
      c.beginPath();
      c.moveTo(x, w / 2);
      c.quadraticCurveTo(x + 8, w * 0.3, x + 16, 6);
      c.moveTo(x, w / 2);
      c.quadraticCurveTo(x + 8, w * 0.7, x + 16, w - 6);
      c.stroke();
    }
  });
  const m = mesh(geo, M('leafMat2|' + color, () => mat('#ffffff', { map: tex, rough: 0.42, cc: 0.4, ccRough: 0.2, side: THREE.DoubleSide })));
  m.userData.noOutline = true;
  return m;
}

// 리코타 퀸넬: 스푼 두 개로 떠낸 길쭉한 럭비공 모양 + 스푼 결(세로 홈) + 몽글몽글한 질감
function quenelle(seed) {
  const r = rng(seed * 5 + 2);
  const geo = new THREE.SphereGeometry(0.012, 28, 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.y, v.z); // 긴 축(x)을 도는 각도
    const k = 1 + Math.sin(a * 3) * 0.06 + (r() - 0.5) * 0.03;
    v.y *= k;
    v.z *= k;
    v.x *= 1.75;
    v.y = v.y > 0 ? v.y * 0.85 : v.y * 0.35;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const tex = canvasTex('ricottaTex', 64, 64, (c, w) => {
    const rr = rng(4);
    c.fillStyle = '#fbf8ef';
    c.fillRect(0, 0, w, w);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = rr() < 0.5 ? 'rgba(225,215,195,0.6)' : 'rgba(255,255,255,0.8)';
      c.beginPath();
      c.arc(rr() * w, rr() * w, 0.6 + rr() * 1.4, 0, TAU);
      c.fill();
    }
  });
  return mesh(geo, M('ricottaMat', () => mat('#ffffff', { map: tex, bump: tex, bumpScale: 0.0016, rough: 0.62, sheen: '#ffffff' })));
}

function cucumberSlice() {
  const sec = sectionTexture({ slot: 'cucumber', color: '#355f2a', inner: '#dcebb4' });
  const g = new THREE.Group();
  g.add(mesh(once('cukeSide', () => new THREE.CylinderGeometry(0.019, 0.019, 0.004, 22, 1, true)), M('cukeSkin', () => mat('#2f5a24', { rough: 0.3, cc: 0.6 })), 0, 0.002, 0));
  g.add(mesh(once('cukeFace', () => new THREE.CircleGeometry(0.019, 22)), M('cukeFace', () => mat('#ffffff', { map: sec, rough: 0.3, cc: 0.8 })), 0, 0.0041, 0, -Math.PI / 2));
  return g;
}

function crouton(seed) {
  const r = rng(seed);
  const geo = new RoundedBoxGeometry(0.014, 0.012, 0.013, 3, 0.0022);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.92 + r() * 0.16), p.getY(i) * (0.92 + r() * 0.16), p.getZ(i) * (0.92 + r() * 0.16));
  geo.computeVertexNormals();
  const tex = canvasTex('croutonTex', 64, 64, (c, w) => {
    const rr = rng(6);
    const g = c.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w * 0.7);
    g.addColorStop(0, '#f0c77e');
    g.addColorStop(0.6, '#d99b48');
    g.addColorStop(1, '#a8652a');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = rr() < 0.6 ? 'rgba(120,70,25,0.5)' : 'rgba(255,240,200,0.45)';
      c.beginPath();
      c.arc(rr() * w, rr() * w, 0.6 + rr() * 1.8, 0, TAU);
      c.fill();
    }
  });
  return mesh(geo, M('croutonMat2', () => mat('#ffffff', { map: tex, bump: tex, bumpScale: 0.0012, rough: 0.7, cc: 0.2 })));
}

function parmShaving(seed) {
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(0.024, 0.012, 6, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) / 0.012) ** 2 * 0.003 + r() * 0.0005);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return mesh(geo, M('parmShaveMat', () => mat('#f6ecc9', { rough: 0.55, side: THREE.DoubleSide, opacity: 0.95 })));
}

function saladDish(kind) {
  const g = new THREE.Group();
  const bowl = saladBowl();
  g.add(bowl);
  const r = rng(kind.length * 17);
  // 바닥에 수북한 잎 (가운데가 높은 돔 형태로)
  const greens = kind === 'caesar' ? ['#6f9e3c', '#8fbf52', '#4f7f2e', '#a9cf6a'] : ['#5c8c38', '#8a3f5a', '#7aa84a', '#3f6b2a'];
  const heap = (d) => 0.012 + (1 - (d / 0.13) ** 2) * 0.045;
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.12;
    const l = leaf(greens[i % 4], 0.06 + r() * 0.03, i + 3);
    l.position.set(Math.cos(a) * d, heap(d) + r() * 0.01, Math.sin(a) * d);
    l.rotation.set((r() - 0.5) * 0.9, r() * TAU, (r() - 0.5) * 0.9);
    g.add(l);
  }
  const placeOn = (o, d, a, lift = 0.006) => {
    o.position.set(Math.cos(a) * d, heap(d) + lift, Math.sin(a) * d);
    o.rotation.y = r() * TAU;
    g.add(o);
  };
  // 단면 토핑
  for (let i = 0; i < 5; i++) {
    const c = cherryHalf();
    c.rotation.x = 0;
    placeOn(c, 0.04 + r() * 0.06, (i / 5) * TAU + 0.3, 0.002);
  }
  if (kind === 'fig') {
    for (let i = 0; i < 6; i++) {
      const f = figWedge();
      placeOn(f, 0.03 + r() * 0.06, (i / 6) * TAU, 0.016);
    }
    for (let i = 0; i < 6; i++) {
      const c = cucumberSlice();
      placeOn(c, 0.05 + r() * 0.05, (i / 6) * TAU + 0.6, 0.004);
      c.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    }
    // 리코타 덩어리
    for (let i = 0; i < 4; i++) placeOn(quenelle(i + 8), 0.02 + r() * 0.06, (i / 4) * TAU + 1, 0.006);
    // 발사믹 글레이즈 + 호두
    for (let k = 0; k < 2; k++) {
      const pts = [];
      for (let i = 0; i < 12; i++) pts.push(new THREE.Vector3(-0.09 + i * 0.016, 0, Math.sin(i * 1.6 + k) * 0.05 + (k - 0.5) * 0.03));
      pts.forEach((p) => (p.y = heap(Math.hypot(p.x, p.z)) + 0.02));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0014, 6, false), M('balsamic', () => mat('#2a0f0a', { rough: 0.06, cc: 1, ccRough: 0.05 }))));
    }
    for (let i = 0; i < 5; i++) placeOn(blob(0.007, '#b58250', { seed: i + 20, flat: 0.7, bumps: 0.35, rough: 0.7, cc: 0 }), 0.03 + r() * 0.07, r() * TAU, 0.01);
  } else {
    for (let i = 0; i < 4; i++) {
      const a = avocadoSlice();
      a.scale.setScalar(0.8);
      placeOn(a, 0.04 + r() * 0.04, (i / 4) * TAU + 0.8, 0.008);
      a.rotation.z = 0.2;
    }
    for (let i = 0; i < 9; i++) placeOn(crouton(i + 1), 0.02 + r() * 0.08, r() * TAU, 0.012);
    for (let i = 0; i < 8; i++) placeOn(parmShaving(i + 2), 0.02 + r() * 0.08, r() * TAU, 0.018);
    // 크리미한 시저 드레싱 줄기
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i < 12; i++) pts.push(new THREE.Vector3(-0.09 + i * 0.016, 0, Math.sin(i * 1.4 + k * 2) * 0.05 + (k - 1) * 0.03));
      pts.forEach((p) => (p.y = heap(Math.hypot(p.x, p.z)) + 0.022));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0018, 6, false), M('caesarDress', () => mat('#f1e6c8', { rough: 0.25, cc: 0.7 }))));
    }
    g.add(parmesanSnow(scatter(70, 0.1, 0.1, 0.07, 9), 9, 1.2));
  }
  // 우드 서버 한 쌍 (볼 가장자리에 걸쳐 둔다)
  const server = M('serverWood', () => mat('#c9a173', { rough: 0.5 }));
  for (const s of [-1, 1]) {
    const sv = new THREE.Group();
    sv.add(mesh(once('serverHandle', () => new THREE.BoxGeometry(0.014, 0.005, 0.2)), server, 0, 0, 0.08));
    const head = mesh(once('serverHead', () => new THREE.SphereGeometry(0.024, 14, 8, 0, TAU, 0, Math.PI / 2)), server, 0, -0.004, -0.03, Math.PI, 0, 0);
    head.scale.set(1, 0.3, 1.3);
    sv.add(head);
    sv.position.set(0.1 + s * 0.02, 0.095, 0.04 + s * 0.015);
    sv.rotation.set(-0.5, 0.9 + s * 0.12, 0);
    g.add(sv);
  }
  return g;
}

// 메뉴 id → 비스트로 완성품 (없으면 null)
export function buildBistroDish(recipeId) {
  let g;
  switch (recipeId) {
    case 's1_pasta_truffle':
      g = pastaDish('truffle');
      break;
    case 's1_pasta_ragu':
      g = pastaDish('ragu');
      break;
    case 's1_pasta_pesto':
      g = pastaDish('pesto');
      break;
    case 's1_pizza_margherita':
      g = pizzaDish('margherita');
      break;
    case 's1_pizza_truffle':
      g = pizzaDish('truffle');
      break;
    case 's1_salad_fig':
      g = saladDish('fig');
      break;
    case 's1_salad_caesar':
      g = saladDish('caesar');
      break;
    default:
      return null;
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = !o.material?.transparent;
      o.receiveShadow = true;
    }
  });
  liftBelowBase(g);
  g.userData.hero = true;
  return g;
}

// v19: 접시 테두리 밖으로 늘어진 잎 끝 등 바닥(y=0) 아래로 내려간 조각은 그만큼 올린다 (시저 로메인 잎 끝이 테이블 속 2.9mm)
function liftBelowBase(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (const ch of g.children) {
    let lo = Infinity;
    ch.traverse((o) => {
      const pos = o.isMesh && o.geometry?.attributes?.position;
      if (!pos) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 300))) lo = Math.min(lo, v.fromBufferAttribute(pos, i).applyMatrix4(m).y);
    });
    if (lo < -0.0003) ch.position.y += -lo + 0.0005;
  }
  g.updateMatrixWorld(true);
}

export { pastaBowl, saladBowl, leaf, quenelle, cucumberSlice, crouton, blob, mushroomSlice };
