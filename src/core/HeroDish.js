import * as THREE from 'three';
import { traceLoaf } from '../workbench/benchTextures.js';

// ─────────────────────────────────────────────────────────────
// 완성품 전용 고디테일 모델 (Hero Dish Prefab)
//  조리 과정 메쉬를 그대로 쓰지 않고, 조리 완료 쇼케이스 · 쟁반 · 손님 테이블에서는 메뉴별로 디자인된 이 모델을 쓴다.
//  원점 = 접시/받침 바닥 중심, +z 정면, 단위 m.
//  토스트류: 테두리가 올라온 세라믹 플레이트 + 노릇한 두툼한 브리오슈 + 스프레드 층 + 메뉴별 토핑 + 가니쉬 + 통후추
//  커피류: 받침접시 + 티스푼 + 도자기 잔 + 크레마 테두리 + 입체 밀크폼 아트(하트/로제타/튤립)
// ─────────────────────────────────────────────────────────────
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const cache = new Map();
const once = (k, f) => {
  if (!cache.has(k)) cache.set(k, f());
  return cache.get(k);
};
function mat(color, { rough = 0.5, metal = 0, cc = 0, ccRough = 0.15, sheen = null, opacity = 1, map = null, bump = null, bumpScale = 0.002, side = THREE.FrontSide, env = null, transmission = 0 } = {}) {
  const phys = cc || sheen || transmission;
  const m = phys ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
  m.color = lin(color);
  m.roughness = rough;
  m.metalness = metal;
  if (cc) {
    m.clearcoat = cc;
    m.clearcoatRoughness = ccRough;
  }
  if (sheen) m.sheen = lin(sheen);
  if (transmission) m.transmission = transmission;
  if (map) m.map = map;
  if (bump) {
    m.bumpMap = bump;
    m.bumpScale = bumpScale;
  }
  if (opacity < 1) {
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = false;
  }
  m.side = side;
  m.envMapIntensity = env ?? (metal > 0.3 ? 1.2 : 0.55);
  return m;
}
const M = (key, make) => once('m|' + key, make);
function mesh(geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = !m.transparent;
  o.receiveShadow = true;
  return o;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function canvasTex(key, w, h, draw, srgb = true) {
  return once('t|' + key, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  });
}

// ── 세라믹 플레이트: 굽 + 넓은 바닥 + 살짝 올라온 테두리 + 갈색 림 라인 ──
function plate(r = 0.135) {
  const g = new THREE.Group();
  const k = r / 0.138;
  const prof = [
    [0, 0.0085],
    [0.07, 0.0085],
    [0.074, 0.003],
    [0.078, 0],
    [0.086, 0],
    [0.094, 0.004],
    [0.11, 0.0075],
    [0.124, 0.0145],
    [0.134, 0.0225],
    [0.138, 0.025],
    [0.1385, 0.0268],
    [0.1355, 0.027],
    [0.131, 0.024],
    [0.12, 0.0175],
    [0.104, 0.011],
    [0.09, 0.0092],
    [0, 0.0092],
  ].map(([x, y]) => new THREE.Vector2(x * k, y));
  const glaze = M('plateGlaze', () => mat('#f6f1e7', { rough: 0.18, cc: 0.7, ccRough: 0.08, env: 0.75 }));
  g.add(mesh(once(`plate|${r}`, () => new THREE.LatheGeometry(prof, 56)), glaze));
  g.add(mesh(once(`plateRim|${r}`, () => new THREE.TorusGeometry(0.1372 * k, 0.0014, 6, 64)), M('rimLine', () => mat('#9b7a5c', { rough: 0.4 })), 0, 0.0262, 0, Math.PI / 2));
  g.userData.top = 0.0092;
  return g;
}

// ── 노릇하게 구운 두툼한 브리오슈 토스트 (단면 윤곽 = 게임 공용 식빵 윤곽) ──
const TOAST = { w: 0.118, d: 0.108, t: 0.027 };
function toastShape(scale = 1) {
  const s = new THREE.Shape();
  traceLoaf(s, (u, v) => [u * TOAST.w * scale, v * TOAST.d * scale]);
  return s;
}
function toastTop() {
  return canvasTex('toastTop2', 512, 512, (c, w) => {
    const r = rng(7);
    // 식빵 단면 윤곽을 따라 안쪽으로 갈수록 크림색: 윤곽을 여러 번 줄여 가며 칠한다
    const P = (k) => (u, v) => [(u * k + 0.5) * w, (0.5 - v * k) * w];
    const steps = [
      [1.0, '#8f4f1a'],
      [0.97, '#b06a26'],
      [0.93, '#c98a3e'],
      [0.88, '#dcaa62'],
      [0.82, '#e8c487'],
      [0.74, '#f1d7a4'],
      [0.62, '#f6e4bf'],
      [0.48, '#f8e9c8'],
    ];
    for (const [k, col] of steps) {
      c.fillStyle = col;
      c.beginPath();
      traceLoaf(c, P(k));
      c.closePath();
      c.fill();
    }
    // 경계를 부드럽게 (살짝 블러)
    c.filter = 'blur(6px)';
    c.drawImage(c.canvas, 0, 0);
    c.filter = 'none';
    // 미세 기공: 그림자 진 가장자리 + 밝은 안쪽
    for (let i = 0; i < 1600; i++) {
      const x = r() * w;
      const y = r() * w;
      const rad = r() < 0.08 ? 3 + r() * 5 : 0.8 + r() * 2.2;
      const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
      g.addColorStop(0, 'rgba(120,70,25,0.55)');
      g.addColorStop(0.7, 'rgba(160,100,40,0.25)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, rad * (0.7 + r() * 0.6), rad, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // 구운 자국: 가장자리 쪽 진한 반점
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.36 + r() * 0.12;
      c.fillStyle = `rgba(110,55,15,${0.12 + r() * 0.2})`;
      c.beginPath();
      c.arc(w / 2 + Math.cos(a) * d * w, w / 2 + Math.sin(a) * d * w * 0.95, 1 + r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
}
// 기공 범프: 밝은 바탕에 기공은 움푹(어둡게)
function toastBump() {
  return canvasTex('toastBump2', 512, 512, (c, w) => {
    const r = rng(7);
    c.fillStyle = '#c8c8c8';
    c.fillRect(0, 0, w, w);
    for (let i = 0; i < 1600; i++) {
      const x = r() * w;
      const y = r() * w;
      const rad = r() < 0.08 ? 3 + r() * 5 : 0.8 + r() * 2.2;
      c.fillStyle = `rgba(20,20,20,${0.5 + r() * 0.4})`;
      c.beginPath();
      c.ellipse(x, y, rad * (0.7 + r() * 0.6), rad, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }, false);
}
function crustSide() {
  return canvasTex('toastCrust', 128, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8d4f1c');
    g.addColorStop(0.5, '#a9621f');
    g.addColorStop(1, '#7a4116');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 300; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '60,30,10' : '230,170,100'},${0.15 + r() * 0.2})`;
      c.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
    }
  });
}
function toast() {
  const geo = once('toastGeo', () => {
    const e = new THREE.ExtrudeGeometry(toastShape(0.96), { depth: TOAST.t - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0035, bevelSegments: 3, curveSegments: 18 });
    e.rotateX(-Math.PI / 2);
    e.translate(0, 0.003, 0);
    // UV: 윗면 텍스처를 토스트 크기에 맞춘다
    const uv = e.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (TOAST.w * 0.96) + 0.5, uv.getY(i) / (TOAST.d * 0.96) + 0.5);
    return e;
  });
  const top = M('toastTopMat2', () => mat('#ffffff', { map: toastTop(), bump: toastBump(), bumpScale: 0.0022, rough: 0.82, sheen: '#ffe8c0' }));
  const side = M('toastSideMat', () => mat('#ffffff', { map: crustSide(), rough: 0.55, cc: 0.25, ccRough: 0.5 }));
  return mesh(geo, [top, side]);
}

// 스프레드 층 (리코타·크림치즈 / 바질 페스토): 토스트 위에 도톰하게, 가장자리 1cm 안쪽까지
function spreadTex(kind) {
  return canvasTex('spread|' + kind, 256, 256, (c, w) => {
    const r = rng(kind.length * 17);
    const base = kind === 'pesto' ? '#5c8a2f' : kind === 'fig' ? '#f3ece2' : '#f7f2e8';
    c.fillStyle = base;
    c.fillRect(0, 0, w, w);
    // 나이프 결
    for (let i = 0; i < 26; i++) {
      c.strokeStyle = kind === 'pesto' ? `rgba(40,70,20,${0.2 + r() * 0.2})` : `rgba(210,200,185,${0.35 + r() * 0.3})`;
      c.lineWidth = 2 + r() * 5;
      c.beginPath();
      const y = r() * w;
      c.moveTo(-10, y);
      c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 40, w * 0.7, y + (r() - 0.5) * 40, w + 10, y + (r() - 0.5) * 30);
      c.stroke();
    }
    if (kind === 'pesto') {
      for (let i = 0; i < 500; i++) {
        c.fillStyle = r() < 0.6 ? `rgba(30,60,15,${0.4 + r() * 0.4})` : r() < 0.7 ? 'rgba(240,230,190,0.6)' : 'rgba(120,170,60,0.7)';
        c.fillRect(r() * w, r() * w, 1 + r() * 3, 1 + r() * 2);
      }
    }
  });
}
function spreadLayer(kind) {
  const geo = once('spreadGeo', () => {
    const e = new THREE.ExtrudeGeometry(toastShape(0.8), { depth: 0.0015, bevelEnabled: true, bevelThickness: 0.0022, bevelSize: 0.005, bevelSegments: 4, curveSegments: 18 });
    e.rotateX(-Math.PI / 2);
    const uv = e.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TOAST.w + 0.5, uv.getY(i) / TOAST.d + 0.5);
    // 가운데가 도톰하게
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.001) p.setY(i, p.getY(i) + 0.0018 * (1 - Math.min(1, Math.hypot(p.getX(i) / 0.05, p.getZ(i) / 0.045))));
    e.computeVertexNormals();
    return e;
  });
  const t = spreadTex(kind);
  return mesh(geo, M('spreadMat|' + kind, () => mat('#ffffff', { map: t, bump: t, bumpScale: 0.002, rough: kind === 'pesto' ? 0.35 : 0.55, cc: kind === 'pesto' ? 0.6 : 0.2, sheen: kind === 'pesto' ? null : '#ffffff' })));
}

// 아보카도 슬라이스 (초승달 단면, 노랑→연두→진녹색 껍질 그라데이션)
function avocadoSlice() {
  const geo = once('avoGeo', () => {
    const s = new THREE.Shape();
    const L = 0.088;
    // 반달 단면: 바깥 껍질 쪽은 크게, 씨가 있던 안쪽은 얕게 휜다 (폭 약 2cm). 원점 = 뾰족한 한쪽 끝
    s.moveTo(0, 0);
    s.bezierCurveTo(L * 0.2, 0.034, L * 0.75, 0.036, L, 0.004);
    s.bezierCurveTo(L * 0.72, 0.012, L * 0.25, 0.01, 0, 0);
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 16 });
    e.rotateX(-Math.PI / 2);
    const uv = e.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / L, uv.getY(i) / 0.028);
    return e;
  });
  const tex = canvasTex('avoTex2', 64, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1f3812'); // 껍질
    g.addColorStop(0.06, '#3f6a1e');
    g.addColorStop(0.16, '#7fae3c'); // 바깥 과육 (연녹)
    g.addColorStop(0.42, '#b8d468');
    g.addColorStop(0.72, '#e4e594'); // 안쪽 과육 (크림 옐로우)
    g.addColorStop(1, '#efe9b0');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  return mesh(geo, M('avoMat2', () => mat('#ffffff', { map: tex, rough: 0.32, cc: 0.35, ccRough: 0.15 })));
}

// 반으로 가른 방울토마토 (단면 위)
function cherryHalf() {
  const g = new THREE.Group();
  const skin = M('tomSkin', () => mat('#d8341f', { rough: 0.2, cc: 1, ccRough: 0.06, env: 0.9 }));
  g.add(mesh(once('tomDome', () => new THREE.SphereGeometry(0.0145, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), skin, 0, 0.012, 0));
  const sec = canvasTex('tomSec', 128, 128, (c, w) => {
    c.fillStyle = '#d8341f';
    c.beginPath();
    c.arc(64, 64, 64, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ee6a4a';
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      c.fillStyle = '#f4b54a';
      c.beginPath();
      c.ellipse(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 17, 12, a, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f6e27a';
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.ellipse(64 + Math.cos(a) * (18 + k * 3) + (k % 2) * 4, 64 + Math.sin(a) * (18 + k * 3), 2.5, 1.6, a, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = '#f7c0a8';
    c.beginPath();
    c.arc(64, 64, 9, 0, Math.PI * 2);
    c.fill();
    void w;
  });
  g.add(mesh(once('tomFace', () => new THREE.CircleGeometry(0.0145, 24)), M('tomFaceMat', () => mat('#ffffff', { map: sec, rough: 0.25, cc: 0.9, ccRough: 0.1 })), 0, 0.012, 0, -Math.PI / 2));
  // 젤리 로큘: 반투명 과즙 볼록 층 3개 + 씨앗
  const jelly = M('tomJelly', () => mat('#ffb48a', { rough: 0.02, cc: 1, ccRough: 0.02, opacity: 0.42, env: 1.2 }));
  const seedMat = M('tomSeed', () => mat('#f6e08a', { rough: 0.3, cc: 0.8 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 0.0068;
    const z = -Math.sin(a) * 0.0068;
    const lo = mesh(once('locule', () => new THREE.SphereGeometry(0.0042, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), jelly, x, 0.0122, z);
    lo.scale.set(1.25, 0.32, 0.95);
    lo.rotation.y = -a;
    g.add(lo);
    for (let k = 0; k < 3; k++) {
      const sd = mesh(once('tomSeedG', () => new THREE.SphereGeometry(0.0009, 8, 6)), seedMat, x + Math.cos(a + k) * 0.0022, 0.0128, z - Math.sin(a + k) * 0.0018);
      sd.scale.set(1.4, 0.5, 1);
      g.add(sd);
    }
  }
  g.scale.set(1, 0.85, 1.05);
  return g;
}

// 수란: 울퉁불퉁한 흰자 + 윤기 나는 노른자 + 살짝 흘러내린 노른자
function poachedEgg() {
  const g = new THREE.Group();
  const geo = once('eggWhite', () => {
    const e = new THREE.SphereGeometry(0.026, 28, 18);
    const p = e.attributes.position;
    const r = rng(11);
    const bumps = Array.from({ length: 7 }, () => [r() * Math.PI * 2, r() * 0.6, 0.12 + r() * 0.2]);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const a = Math.atan2(v.z, v.x);
      let d = 1;
      for (const [ba, bb, amp] of bumps) d += amp * Math.exp(-((Math.atan2(Math.sin(a - ba), Math.cos(a - ba)) / 0.6) ** 2)) * (0.6 + bb);
      v.x *= d;
      v.z *= d * 0.92;
      v.y *= v.y > 0 ? 0.62 : 0.25;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    e.computeVertexNormals();
    return e;
  });
  g.add(mesh(geo, M('eggWhiteMat', () => mat('#fbf8f1', { rough: 0.3, cc: 0.6, ccRough: 0.2, sheen: '#ffffff' })), 0, 0.006, 0));
  const yolk = M('yolkMat', () => mat('#f2a51d', { rough: 0.12, cc: 1, ccRough: 0.05, env: 1 }));
  g.add(mesh(once('yolk', () => new THREE.SphereGeometry(0.0145, 20, 14)), yolk, 0.002, 0.0175, 0.004));
  // 터진 노른자 줄기: 꼭대기에서 흰자 비탈을 따라 흘러내린다 (반지름이 점점 가늘어지는 튜브)
  const dripGeo = once('yolkDrip2', () => {
    const pts = [
      new THREE.Vector3(0.004, 0.026, 0.008),
      new THREE.Vector3(0.008, 0.022, 0.016),
      new THREE.Vector3(0.012, 0.015, 0.024),
      new THREE.Vector3(0.015, 0.008, 0.03),
      new THREE.Vector3(0.017, 0.004, 0.036),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 24, 0.0032, 10, false);
    const p = geo.attributes.position;
    // 끝으로 갈수록 가늘게 (튜브 중심선 쪽으로 당긴다)
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 11) / 24;
      const c = curve.getPoint(seg);
      const k = 1 - seg * 0.55;
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k * 0.7, c.z + (p.getZ(i) - c.z) * k);
    }
    geo.computeVertexNormals();
    return geo;
  });
  g.add(mesh(dripGeo, yolk));
  const pool = mesh(once('yolkPool', () => new THREE.SphereGeometry(0.0065, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), yolk, 0.017, 0.002, 0.037);
  pool.scale.set(1.4, 0.35, 1.2);
  g.add(pool);
  // 노른자 위 반사 하이라이트
  g.add(mesh(once('yolkHi', () => new THREE.SphereGeometry(0.003, 10, 6)), M('yolkHiMat', () => mat('#fff6d8', { rough: 0.02, cc: 1, opacity: 0.7 })), -0.002, 0.03, 0.001));
  return g;
}

// 바질 잎 (잎맥 + 살짝 휜 잎)
function basilLeaf(size = 1) {
  const geo = once('basil', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.012, 0.006, 0.014, 0.024, 0, 0.036);
    s.bezierCurveTo(-0.014, 0.024, -0.012, 0.006, 0, 0);
    const e = new THREE.ShapeGeometry(s, 10);
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, x * x * 14 - y * 0.12 + Math.sin(y * 90) * 0.0006);
    }
    e.rotateX(-Math.PI / 2);
    e.computeVertexNormals();
    const uv = e.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.03 + 0.5, uv.getY(i) / 0.036);
    return e;
  });
  const tex = canvasTex('basilTex', 64, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#2f6e22');
    g.addColorStop(0.5, '#4f9a33');
    g.addColorStop(1, '#2f6e22');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(190,230,140,0.7)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.lineTo(w / 2, h);
    c.stroke();
    c.lineWidth = 0.8;
    for (let y = 8; y < h; y += 10) {
      c.beginPath();
      c.moveTo(w / 2, y);
      c.lineTo(w * 0.18, y - 8);
      c.moveTo(w / 2, y);
      c.lineTo(w * 0.82, y - 8);
      c.stroke();
    }
  });
  const m = mesh(geo, M('basilMat', () => mat('#ffffff', { map: tex, rough: 0.35, cc: 0.5, side: THREE.DoubleSide })));
  m.scale.setScalar(size);
  return m;
}

// 루꼴라 (톱니 잎)
function arugula() {
  const geo = once('arugula', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    const pts = [
      [0.004, 0.01],
      [0.009, 0.012],
      [0.006, 0.02],
      [0.011, 0.024],
      [0.006, 0.032],
      [0.008, 0.04],
      [0, 0.046],
    ];
    for (const [x, y] of pts) s.lineTo(x, y);
    for (const [x, y] of pts.slice(0, -1).reverse()) s.lineTo(-x, y);
    s.lineTo(0, 0);
    const e = new THREE.ShapeGeometry(s, 2);
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getX(i) ** 2 * 18 + Math.sin(p.getY(i) * 120) * 0.0012);
    e.rotateX(-Math.PI / 2);
    e.computeVertexNormals();
    return e;
  });
  return mesh(geo, M('arugulaMat', () => mat('#3f7d2a', { rough: 0.4, cc: 0.4, side: THREE.DoubleSide })));
}

// 무화과 1/4 쪽 (보랏빛 껍질 + 붉은 속과 씨)
function figWedge() {
  const g = new THREE.Group();
  const skin = M('figSkin', () => mat('#5a2a4a', { rough: 0.45, cc: 0.3 }));
  const sec = canvasTex('figSec', 128, 128, (c, w) => {
    c.fillStyle = '#5a2a4a';
    c.fillRect(0, 0, w, w);
    c.fillStyle = '#efe2c8';
    c.beginPath();
    c.ellipse(64, 70, 54, 56, 0, 0, Math.PI * 2);
    c.fill();
    const g2 = c.createRadialGradient(64, 76, 4, 64, 76, 44);
    g2.addColorStop(0, '#f2b3a0');
    g2.addColorStop(0.5, '#c8384a');
    g2.addColorStop(1, '#a3233c');
    c.fillStyle = g2;
    c.beginPath();
    c.ellipse(64, 74, 42, 46, 0, 0, Math.PI * 2);
    c.fill();
    const r = rng(5);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = 'rgba(250,225,170,0.9)';
      c.fillRect(64 + (r() - 0.5) * 70, 74 + (r() - 0.5) * 76, 1.6, 1.2);
    }
  });
  // 반구를 세워 자른 쪽 (단면은 위를 보는 반원판)
  const dome = mesh(once('figDome', () => new THREE.SphereGeometry(0.02, 16, 10, 0, Math.PI, 0, Math.PI)), skin, 0, 0.0, 0, Math.PI / 2, 0, 0);
  dome.scale.set(1, 1.25, 0.9);
  g.add(dome);
  const face = mesh(once('figFace', () => new THREE.CircleGeometry(0.02, 24)), M('figFaceMat', () => mat('#ffffff', { map: sec, rough: 0.3, cc: 0.7 })), 0, 0.0005, 0, -Math.PI / 2);
  face.scale.set(1, 1.25, 1);
  g.add(face);
  // 촉촉한 과즙 광택 + 씨앗 알갱이 (입체)
  const juice = mesh(once('figJuice', () => new THREE.CircleGeometry(0.017, 24)), M('figJuiceMat', () => mat('#d8455a', { rough: 0.02, cc: 1, ccRough: 0.02, opacity: 0.28, env: 1.2 })), 0, 0.0011, 0.002, -Math.PI / 2);
  juice.scale.set(1, 1.2, 1);
  g.add(juice);
  const r = rng(13);
  const seed = M('figSeedMat', () => mat('#f2df9a', { rough: 0.35, cc: 0.7 }));
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.012;
    const sd = mesh(once('figSeedG', () => new THREE.SphereGeometry(0.0007, 6, 4)), seed, Math.cos(a) * d, 0.0012, Math.sin(a) * d * 1.25 + 0.002);
    sd.scale.set(1.3, 0.6, 1);
    g.add(sd);
  }
  return g;
}

// 바삭한 베이컨 / 상추 (BLT)
function bacon() {
  const geo = once('bacon2', () => {
    const e = new THREE.BoxGeometry(0.1, 0.0035, 0.024, 40, 1, 4);
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // 굽히며 오그라든 물결 + 가장자리 말림 + 살짝 비틀림
      const wave = Math.sin(x * 95) * 0.0045 + Math.sin(x * 41 + 1.3) * 0.0018;
      const curl = (Math.abs(z) / 0.012) ** 2 * 0.0018;
      p.setY(i, p.getY(i) + wave + curl + z * Math.sin(x * 30) * 0.08);
      p.setZ(i, z * (1 + Math.sin(x * 70) * 0.06));
    }
    e.computeVertexNormals();
    return e;
  });
  const tex = canvasTex('baconTex2', 256, 64, (c, w, h) => {
    const r = rng(4);
    // 살코기(적갈색)와 지방(호박빛 크림)이 길이 방향으로 번갈아
    const bands = [
      [0, 0.18, '#7a2a16'],
      [0.18, 0.32, '#e9c08e'],
      [0.32, 0.55, '#8c3218'],
      [0.55, 0.66, '#f0cf9d'],
      [0.66, 0.88, '#7d2c17'],
      [0.88, 1, '#e3b27c'],
    ];
    for (const [a0, a1, col] of bands) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, a0 * h);
      for (let x = 0; x <= w; x += 8) c.lineTo(x, a0 * h + Math.sin(x * 0.07 + a0 * 9) * 2.5);
      for (let x = w; x >= 0; x -= 8) c.lineTo(x, a1 * h + Math.sin(x * 0.07 + a1 * 9) * 2.5);
      c.fill();
    }
    // 바삭하게 그을린 가장자리 · 기름 반짝임
    const edge = c.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, 'rgba(50,18,8,0.7)');
    edge.addColorStop(0.08, 'rgba(50,18,8,0)');
    edge.addColorStop(0.92, 'rgba(50,18,8,0)');
    edge.addColorStop(1, 'rgba(50,18,8,0.7)');
    c.fillStyle = edge;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      c.fillStyle = r() < 0.55 ? `rgba(60,20,8,${0.2 + r() * 0.3})` : 'rgba(255,230,180,0.35)';
      c.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
  });
  return mesh(geo, M('baconMat2', () => mat('#ffffff', { map: tex, bump: tex, bumpScale: 0.0012, rough: 0.38, cc: 0.55, ccRough: 0.25 })));
}
function lettuce(size = 0.13) {
  const geo = once('lettuce|' + size, () => {
    const e = new THREE.CircleGeometry(size / 2, 40, 0, Math.PI * 2);
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const r = Math.hypot(x, y) / (size / 2);
      const a = Math.atan2(y, x);
      p.setZ(i, r * r * (0.004 + 0.004 * Math.sin(a * 11)));
      const k = 1 + 0.06 * Math.sin(a * 11) * r;
      p.setX(i, x * k);
      p.setY(i, y * k);
    }
    e.rotateX(-Math.PI / 2);
    e.computeVertexNormals();
    return e;
  });
  return mesh(geo, M('lettuceMat', () => mat('#7fb64a', { rough: 0.4, cc: 0.5, side: THREE.DoubleSide })));
}
function tomatoSlice() {
  const g = new THREE.Group();
  const face = canvasTex('tomSliceTex', 128, 128, (c) => {
    c.fillStyle = '#c9301f';
    c.beginPath();
    c.arc(64, 64, 64, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8553a';
    c.beginPath();
    c.arc(64, 64, 58, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      c.fillStyle = '#f2a94a';
      c.beginPath();
      c.ellipse(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30, 14, 9, a, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#f5b39a';
    c.beginPath();
    c.arc(64, 64, 10, 0, Math.PI * 2);
    c.fill();
  });
  g.add(mesh(once('tomSlice', () => new THREE.CylinderGeometry(0.03, 0.03, 0.006, 28)), [M('tomSliceSide', () => mat('#c9301f', { rough: 0.25, cc: 0.9 })), M('tomSliceFace', () => mat('#ffffff', { map: face, rough: 0.25, cc: 0.9 })), M('tomSliceFace', () => mat('#ffffff', { map: face, rough: 0.25, cc: 0.9 }))], 0, 0.003, 0));
  return g;
}

// 통후추 · 플레이크 소금 (인스턴스)
function seasoning(spots, seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  const pep = new THREE.InstancedMesh(once('pepGeo', () => new THREE.IcosahedronGeometry(0.0011, 0)), M('pepMat', () => mat('#1c1714', { rough: 0.7 })), spots.length);
  const salt = new THREE.InstancedMesh(once('saltGeo', () => new THREE.BoxGeometry(0.0016, 0.0006, 0.0013)), M('saltMat', () => mat('#ffffff', { rough: 0.2, cc: 0.5 })), Math.ceil(spots.length / 3));
  const o = new THREE.Object3D();
  spots.forEach(([x, y, z], i) => {
    o.position.set(x, y, z);
    o.rotation.set(r() * 3, r() * 3, r() * 3);
    o.scale.setScalar(0.7 + r() * 0.8);
    o.updateMatrix();
    pep.setMatrixAt(i, o.matrix);
    if (i % 3 === 0) salt.setMatrixAt(i / 3, o.matrix);
  });
  g.add(pep, salt);
  return g;
}
const scatter = (n, rx, rz, y, seed) => {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return [Math.cos(a) * rx * d, y, Math.sin(a) * rz * d];
  });
};

// 꿀 / 올리브오일 드리즐 (토스트 위를 지나가는 가는 줄기)
function drizzle(color, seed = 3, y = 0.04) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 9; i++) pts.push(new THREE.Vector3(-0.045 + i * 0.011, y + r() * 0.002, Math.sin(i * 1.7) * 0.028));
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 60, 0.0012, 6, false);
  return mesh(geo, mat(color, { rough: 0.08, cc: 1, ccRough: 0.04, opacity: 0.85, env: 1.1 }));
}

function toastPlate(menu) {
  const g = new THREE.Group();
  const p = plate();
  g.add(p);
  const base = p.userData.top;
  const t = toast();
  t.position.set(-0.008, base, 0.004);
  t.rotation.y = 0.18;
  g.add(t);
  const yTop = base + TOAST.t;
  const onToast = new THREE.Group();
  onToast.position.copy(t.position).setY(yTop);
  onToast.rotation.y = t.rotation.y;
  g.add(onToast);
  const layer = spreadLayer(menu === 'pesto' ? 'pesto' : 'ricotta');
  onToast.add(layer);
  const sy = 0.0055; // 스프레드 윗면
  let pepperY = sy + 0.004;
  if (menu === 'avocado') {
    // 아보카도 5조각 부채꼴 + 수란 + 방울토마토 반쪽 + 바질 + 통후추 · 올리브오일
    // 뾰족한 끝을 한 점에 모아 5조각을 부채꼴로 겹친다 (뒤 조각 위에 앞 조각)
    const fan = new THREE.Group();
    fan.position.set(-0.05, sy, 0.03);
    for (let i = 0; i < 5; i++) {
      const a = avocadoSlice();
      a.position.set(0.002 * i, 0.0016 * i, -0.001 * i);
      a.rotation.set(0, 0.62 - i * 0.2, -0.03 * i);
      fan.add(a);
    }
    onToast.add(fan);
    const egg = poachedEgg();
    egg.position.set(0.03, sy + 0.005, -0.012);
    onToast.add(egg);
    for (const [x, z, ry] of [
      [0.078, 0.042, 0.3],
      [0.092, 0.012, 1.1],
      [-0.075, 0.05, 2],
    ]) {
      const ch = cherryHalf();
      ch.position.set(x, base - yTop, z);
      ch.rotation.y = ry;
      onToast.add(ch);
    }
    for (const [x, z, ry, s] of [
      [0.03, -0.01, 0.6, 0.8],
      [0.012, 0.028, 2.4, 0.7],
      [0.085, 0.03, -0.6, 0.9],
    ]) {
      const l = basilLeaf(s);
      l.position.set(x, sy + 0.022, z);
      l.rotation.y = ry;
      onToast.add(l);
    }
    onToast.add(drizzle('#c9b13a', 4, sy + 0.012));
    pepperY = sy + 0.009;
  } else if (menu === 'pesto') {
    for (let i = 0; i < 6; i++) {
      const ch = cherryHalf();
      const a = (i / 6) * Math.PI * 2;
      ch.position.set(Math.cos(a) * 0.028, sy, Math.sin(a) * 0.024);
      ch.rotation.y = a;
      onToast.add(ch);
    }
    for (let i = 0; i < 7; i++) {
      const l = arugula();
      l.position.set((i - 3) * 0.012, sy + 0.012 + (i % 2) * 0.002, ((i * 7) % 5) * 0.008 - 0.016);
      l.rotation.y = i * 0.9;
      onToast.add(l);
    }
    for (let i = 0; i < 4; i++) {
      const sh = mesh(once('parm', () => new THREE.BoxGeometry(0.018, 0.0008, 0.008)), M('parmMat', () => mat('#f2e4bf', { rough: 0.45 })), (i - 1.5) * 0.016, sy + 0.017, (i % 2) * 0.01, 0.2, i, 0.1);
      onToast.add(sh);
    }
    onToast.add(basilLeaf(1.1));
    onToast.children[onToast.children.length - 1].position.set(0.004, sy + 0.02, 0);
    pepperY = sy + 0.012;
  } else if (menu === 'fig') {
    for (let i = 0; i < 5; i++) {
      const f = figWedge();
      const a = -0.6 + i * 0.3;
      f.position.set(-0.026 + i * 0.013, sy + 0.007, Math.sin(a) * 0.02);
      f.rotation.y = a;
      onToast.add(f);
    }
    onToast.add(drizzle('#e0a020', 7, sy + 0.016));
    for (const [x, z] of [
      [0.04, -0.03],
      [-0.04, 0.03],
    ]) {
      const l = basilLeaf(0.6);
      l.position.set(x, sy + 0.01, z);
      onToast.add(l);
    }
    // 피스타치오 조각
    for (let i = 0; i < 14; i++) onToast.add(mesh(once('pist', () => new THREE.IcosahedronGeometry(0.0022, 0)), M('pistMat', () => mat('#8fb04a', { rough: 0.5 })), (Math.sin(i * 2.3) * 0.04), sy + 0.012, Math.cos(i * 1.7) * 0.03));
    pepperY = -1;
  }
  if (pepperY > 0) onToast.add(seasoning(scatter(34, 0.045, 0.04, pepperY, 9)));
  return g;
}

// 클래식 BLT: 대각선으로 자른 두 쪽, 한쪽을 기대 세워 단면(상추·토마토·베이컨)이 보이게 + 이쑤시개 깃발
function bltPlate() {
  const g = new THREE.Group();
  const p = plate();
  g.add(p);
  const base = p.userData.top;
  const tri = once('bltTri', () => {
    const s = new THREE.Shape();
    const a = 0.052;
    s.moveTo(-a, -a);
    s.lineTo(a, -a);
    s.quadraticCurveTo(a + 0.006, -a, a, -a + 0.006);
    s.lineTo(-a + 0.004, a - 0.002);
    s.quadraticCurveTo(-a, a, -a, a - 0.006);
    s.lineTo(-a, -a);
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    e.rotateX(-Math.PI / 2);
    const uv = e.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.11 + 0.5, uv.getY(i) / 0.11 + 0.5);
    return e;
  });
  const top = M('toastTopMat', () => mat('#ffffff', { map: toastTop(), rough: 0.85, sheen: '#ffe8c0' }));
  const side = M('toastSideMat', () => mat('#ffffff', { map: crustSide(), rough: 0.55, cc: 0.25 }));
  const half = (lean) => {
    const h = new THREE.Group();
    let y = 0.002;
    h.add(mesh(tri, [top, side], 0, y, 0));
    y += 0.016;
    const l = lettuce(0.12);
    l.position.y = y;
    h.add(l);
    y += 0.004;
    for (const [x, z] of [
      [-0.02, -0.018],
      [0.012, 0.012],
    ]) {
      const t = tomatoSlice();
      t.position.set(x, y, z);
      h.add(t);
    }
    y += 0.007;
    for (let i = 0; i < 3; i++) {
      const b = bacon();
      b.position.set(-0.004, y + i * 0.003, -0.024 + i * 0.022);
      b.rotation.y = -0.75 + i * 0.1;
      b.scale.set(0.85, 1, 1);
      h.add(b);
    }
    y += 0.012;
    h.add(mesh(tri, [top, side], 0, y, 0));
    // 이쑤시개 + 깃발
    h.add(mesh(once('pick', () => new THREE.CylinderGeometry(0.0012, 0.0012, 0.07, 8)), M('pickMat', () => mat('#e9d6a8', { rough: 0.7 })), -0.018, y + 0.02, -0.018));
    h.add(mesh(once('frill', () => new THREE.ConeGeometry(0.0045, 0.012, 10)), M('frillMat', () => mat('#5f9a6e', { rough: 0.6 })), -0.018, y + 0.052, -0.018, Math.PI));
    // v13: 왼쪽 조각은 단면을 정면으로 비스듬히 세우고, 오른쪽 조각은 그 옆에 약 35° 눕혀 기대어 놓는다
    // (삼각 조각의 빗변 = 잘린 단면이 원점을 지나므로, 원점 기준으로 돌리면 단면이 그대로 앞을 본다)
    const yaw = (5 * Math.PI) / 4;
    if (lean) {
      h.position.set(0.05, base + 0.045, -0.01);
      h.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.61).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + 0.3));
    } else {
      h.position.set(-0.04, base + 0.004, 0.03);
      h.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.16).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw - 0.12));
    }
    return h;
  };
  g.add(half(false), half(true));
  // 피클 + 감자칩 곁들임
  for (let i = 0; i < 5; i++) {
    const chip = mesh(once('chip', () => new THREE.SphereGeometry(0.016, 12, 6, 0, Math.PI * 2, 0, 0.5)), M('chipMat', () => mat('#e7b85a', { rough: 0.45, cc: 0.4, side: THREE.DoubleSide })), 0.07 + (i % 2) * 0.012, base + 0.003 + i * 0.002, -0.06 + i * 0.012, 0.3 * i, i, 0.2);
    chip.scale.set(1, 0.25, 1);
    g.add(chip);
  }
  g.add(seasoning(scatter(12, 0.03, 0.03, base + 0.06, 3)));
  return g;
}

// ── 커피: 받침 + 티스푼 + 도자기 잔 + 크레마 + 입체 라떼아트 ──
function artTexture(kind) {
  return canvasTex('art|' + kind, 512, 512, (c, S) => {
    const cx = S / 2;
    const g = c.createRadialGradient(cx, cx, S * 0.05, cx, cx, S * 0.5);
    if (kind === 'americano') {
      g.addColorStop(0, '#b07a46');
      g.addColorStop(0.55, '#8a5328');
      g.addColorStop(0.85, '#6a3818');
      g.addColorStop(1, '#3d1d0a');
    } else {
      g.addColorStop(0, '#c99566');
      g.addColorStop(0.7, '#a8693a');
      g.addColorStop(0.9, '#7a4220');
      g.addColorStop(1, '#4a2410');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    const r = rng(kind.length);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '235,195,150' : '90,45,20'},${0.08 + r() * 0.14})`;
      c.beginPath();
      c.arc(r() * S, r() * S, 1 + r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    if (kind === 'americano') return;
    c.fillStyle = '#fbf6ee';
    c.save();
    c.shadowColor = 'rgba(120,70,30,0.5)';
    c.shadowBlur = 6;
    const R = S * 0.36;
    if (kind === 'rosetta') {
      for (let i = 0; i < 8; i++) {
        const y = cx + R * 0.62 - i * R * 0.17;
        const w = R * (0.62 - i * 0.055);
        c.beginPath();
        c.ellipse(cx, y, w, R * 0.085, 0, Math.PI, Math.PI * 2);
        c.ellipse(cx, y + R * 0.02, w * 0.92, R * 0.05, 0, 0, Math.PI, false);
        c.fill();
      }
      c.beginPath();
      c.moveTo(cx, cx - R * 0.78);
      c.lineTo(cx, cx + R * 0.8);
      c.lineWidth = R * 0.05;
      c.strokeStyle = '#fbf6ee';
      c.stroke();
      c.beginPath();
      c.arc(cx, cx - R * 0.7, R * 0.09, 0, Math.PI * 2);
      c.fill();
    } else if (kind === 'tulip') {
      for (const [y, w, h] of [
        [0.45, 0.5, 0.24],
        [0.08, 0.4, 0.2],
        [-0.26, 0.28, 0.16],
      ]) {
        c.beginPath();
        c.ellipse(cx, cx + R * y, R * w, R * h, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillRect(cx - R * 0.025, cx - R * 0.5, R * 0.05, R * 1.1);
    } else {
      const s = R * 0.95;
      c.beginPath();
      c.moveTo(cx, cx + s * 0.78);
      c.bezierCurveTo(cx - s * 1.3, cx - s * 0.02, cx - s * 0.66, cx - s * 0.98, cx, cx - s * 0.38);
      c.bezierCurveTo(cx + s * 0.66, cx - s * 0.98, cx + s * 1.3, cx - s * 0.02, cx, cx + s * 0.78);
      c.fill();
    }
    c.restore();
  });
}
// 입체감: 아트 모양을 흰색으로 그린 범프맵
function artBump(kind) {
  return canvasTex(
    'artBump|' + kind,
    256,
    256,
    (c, S) => {
      const src = artTexture(kind).image;
      c.drawImage(src, 0, 0, S, S);
      const d = c.getImageData(0, 0, S, S);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = d.data[i] > 225 && d.data[i + 2] > 200 ? 255 : 60;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      }
      c.putImageData(d, 0, 0);
      c.filter = 'blur(3px)';
      c.drawImage(c.canvas, 0, 0);
    },
    false,
  );
}

function teaspoon() {
  const g = new THREE.Group();
  const steel = M('spoonSteel', () => mat('#e2e5e8', { metal: 0.95, rough: 0.14, env: 1.3 }));
  const bowl = mesh(once('spoonBowl', () => new THREE.SphereGeometry(0.011, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), M('spoonSteelD', () => mat('#e2e5e8', { metal: 0.95, rough: 0.14, env: 1.3, side: THREE.DoubleSide })), 0, 0.0045, 0);
  bowl.scale.set(0.72, 0.35, 1.05);
  g.add(bowl);
  const stem = mesh(once('spoonStem', () => new THREE.BoxGeometry(0.0042, 0.0016, 0.058)), steel, 0, 0.0045, 0.04, 0.05);
  g.add(stem);
  const tip = mesh(once('spoonTip', () => new THREE.CylinderGeometry(0.0045, 0.0045, 0.0016, 14)), steel, 0, 0.0062, 0.069);
  tip.scale.set(1.3, 1, 1);
  g.add(tip);
  return g;
}

function coffeeCup(kind, { glassy = false } = {}) {
  const g = new THREE.Group();
  const porcelain = M('cupPorcelain', () => mat('#f8f5ef', { rough: 0.14, cc: 0.8, ccRough: 0.06, env: 0.85 }));
  // 받침접시
  const saucer = [
    [0, 0.002],
    [0.035, 0.002],
    [0.038, 0],
    [0.046, 0],
    [0.06, 0.006],
    [0.072, 0.012],
    [0.075, 0.0135],
    [0.0735, 0.0148],
    [0.06, 0.0095],
    [0.044, 0.0068],
    [0.03, 0.0068],
    [0, 0.0068],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(once('heroSaucer', () => new THREE.LatheGeometry(saucer, 48)), porcelain));
  g.add(mesh(once('saucerWell', () => new THREE.TorusGeometry(0.031, 0.0012, 6, 40)), porcelain, 0, 0.0068, 0, Math.PI / 2));
  // 잔: 넓은 라떼 볼 / 아메리카노는 조금 높은 잔
  const tall = kind === 'americano';
  const H = tall ? 0.068 : 0.058;
  const Rt = tall ? 0.04 : 0.049;
  const cup = [
    [0, 0.0068],
    [0.022, 0.0068],
    [0.024, 0.009],
    [0.028, 0.012],
    [Rt * 0.82, H * 0.45],
    [Rt * 0.97, H * 0.85],
    [Rt, H],
    [Rt - 0.0018, H + 0.001],
    [Rt - 0.004, H * 0.86],
    [Rt * 0.78, H * 0.45],
    [0.022, 0.012],
    [0, 0.012],
  ].map(([x, y]) => new THREE.Vector2(x, y + 0.0068));
  g.add(mesh(once('heroCup|' + kind, () => new THREE.LatheGeometry(cup, 56)), porcelain));
  // 손잡이
  const handle = mesh(once('heroHandle|' + kind, () => new THREE.TorusGeometry(0.014, 0.0042, 10, 24, Math.PI * 1.35)), porcelain, Rt * 0.92 + 0.008, 0.0068 + H * 0.55, 0, 0, 0, -Math.PI * 0.67);
  g.add(handle);
  // 표면: 살짝 봉긋한 밀크폼 돔 + 크레마/아트 텍스처 + 범프
  const surfR = Rt - 0.004;
  const domeR = 0.3;
  const theta = Math.asin(surfR / domeR);
  const surfGeo = once('foam|' + kind, () => {
    const s = new THREE.SphereGeometry(domeR, 48, 6, 0, Math.PI * 2, 0, theta);
    // UV: 위에서 내려다본 평면 좌표
    const p = s.attributes.position;
    const uv = s.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (surfR * 2) + 0.5, 0.5 - p.getZ(i) / (surfR * 2));
    return s;
  });
  const art = artTexture(kind);
  const foamMat = M('foamMat|' + kind, () => mat('#ffffff', { map: art, bump: kind === 'americano' ? null : artBump(kind), bumpScale: 0.0018, rough: kind === 'americano' ? 0.18 : 0.42, cc: kind === 'americano' ? 0.6 : 0.15, sheen: kind === 'americano' ? null : '#ffffff' }));
  // 테두리는 잔 안쪽 4.5mm 아래, 가운데는 살짝(약 3mm) 봉긋
  const foam = mesh(surfGeo, foamMat, 0, 0.0068 + H - 0.0045 - domeR * Math.cos(theta), 0);
  // 하트·로제타의 뾰족한 끝이 정면(+z, 보는 사람 쪽)을 향한다
  g.add(foam);
  void glassy;
  // 티스푼 (받침 위, 손잡이는 오른쪽 앞)
  const sp = teaspoon();
  sp.position.set(0.05, 0.0072, 0.018);
  sp.rotation.y = -0.64; // 받침 오른쪽 앞 테두리를 따라 눕힌다 (손잡이 끝이 받침 안쪽에 머문다)
  g.add(sp);
  return g;
}

// 장식용 통 브리오슈 식빵 (매장 소품): 네모난 아랫단 + 봉긋한 윗면, 양 끝은 베벨로 둥글게. 원점 = 바닥 중심, 긴 축 x
export function briocheLoaf({ len = 0.22, w = 0.1, h = 0.09, color = '#a9621f' } = {}) {
  const geo = once(`loaf|${len}|${w}|${h}`, () => {
    const s = new THREE.Shape();
    traceLoaf(s, (u, v) => [u * w * 0.9, (v + 0.5) * h * 0.9]);
    const b = Math.min(w, h) * 0.06;
    const e = new THREE.ExtrudeGeometry(s, { depth: len - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 16 });
    e.translate(0, 0, -(len - b * 2) / 2);
    e.rotateY(Math.PI / 2);
    e.translate(0, b * 0.6, 0);
    return e;
  });
  const crust = M('loafCrust|' + color, () => mat(color === '#a9621f' ? '#ffffff' : '#e6d6c4', { map: crustSide(), rough: 0.5, cc: 0.35, ccRough: 0.4 }));
  return mesh(geo, crust);
}

// 메뉴 id → 완성품 모델
export function buildHeroDish(recipeId, { art = null } = {}) {
  let g;
  switch (recipeId) {
    case 's1_avocado_toast':
      g = toastPlate('avocado');
      break;
    case 's1_pesto_toast':
      g = toastPlate('pesto');
      break;
    case 's1_fig_toast':
      g = toastPlate('fig');
      break;
    case 's1_blt':
      g = bltPlate();
      break;
    case 's1_americano':
      g = coffeeCup('americano');
      break;
    case 's1_vanilla_latte': {
      g = coffeeCup(art ?? 'rosetta');
      // 바닐라 빈 꼬투리 한 줄기
      const pod = mesh(once('vanillaPod', () => new THREE.CylinderGeometry(0.0016, 0.0012, 0.07, 8)), M('podMat', () => mat('#3a2416', { rough: 0.6, cc: 0.3 })), -0.045, 0.009, 0.02, 0, 0.4, Math.PI / 2);
      g.add(pod);
      break;
    }
    case 's1_latte':
      g = coffeeCup(art ?? 'heart');
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
  g.userData.hero = true;
  return g;
}

// 비스트로 완성품(BistroDish.js)이 같은 재질·가니쉬를 쓰도록 공개
export { lin, mat, mesh, once, M, rng, canvasTex, plate, basilLeaf, arugula, seasoning, scatter, figWedge, cherryHalf, avocadoSlice, drizzle, bacon, lettuce, poachedEgg, tomatoSlice };
