import * as THREE from 'three';
import { gaugeTexture } from '../workbench/benchTextures.js';

// ─────────────────────────────────────────────────────────────
// 상업용 2그룹 에스프레소 머신 + 하이엔드 그라인더 (매장 가구 · 바리스타 클로즈업 공용)
//  원점 = 조리대 윗면의 머신 바닥 중심, +z 정면. 단위 m.
//  바디: 상단·전면이 둥글게 꺾인 측면 실루엣을 베벨 포함 ExtrudeGeometry 로 밀어낸 하우징
//  상단: 스테인리스 컵 레일 + 타공 컵 워머 + 데미타세 잔·받침 7세트 2단 적재
//  전면: 듀얼 그룹헤드 · 포터필터(손잡이+투샷 스파우트) · 중앙 듀얼 압력 게이지 · 좌우 스팀 노브/완드 · 추출 버튼 LED
//  하단: 슬롯 타공 드립 트레이 + 추출 중인 에스프레소 잔 2개
// ─────────────────────────────────────────────────────────────
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function M(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = !(mat.transparent && mat.opacity < 0.9);
  m.receiveShadow = true;
  return m;
}

function std(color, { rough = 0.4, metal = 0, cc = 0, env = null, opacity = 1, emissive = null, ei = 1, transmission = 0 } = {}) {
  return once(`em|${color}|${rough}|${metal}|${cc}|${env}|${opacity}|${emissive}|${ei}|${transmission}`, () => {
    const phys = cc || transmission;
    const m = phys ? new THREE.MeshPhysicalMaterial({ color: lin(color), roughness: rough, metalness: metal }) : new THREE.MeshStandardMaterial({ color: lin(color), roughness: rough, metalness: metal });
    if (cc) {
      m.clearcoat = cc;
      m.clearcoatRoughness = 0.12;
    }
    if (transmission) m.transmission = transmission;
    m.envMapIntensity = env ?? (metal > 0.3 ? 1.15 : 0.6);
    if (opacity < 1) {
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
    }
    if (emissive) {
      m.emissive = lin(emissive);
      m.emissiveIntensity = ei;
    }
    return m;
  });
}

const MAT = {
  chrome: () => std('#e3e6ea', { rough: 0.12, metal: 0.95, cc: 0.5, env: 1.3 }),
  steel: () => std('#c8ccd1', { rough: 0.28, metal: 0.8, env: 1.15 }),
  black: () => std('#232325', { rough: 0.45, metal: 0.3 }),
  walnut: () => std('#5b3a24', { rough: 0.45, cc: 0.4 }),
  porcelain: () => std('#f7f4ee', { rough: 0.18, cc: 0.6, env: 0.8 }),
  espresso: () => std('#3a1d0c', { rough: 0.15, cc: 0.4 }),
  crema: () => std('#b77a43', { rough: 0.35 }),
  stream: () => std('#6b3415', { rough: 0.15, opacity: 0.88 }),
  glass: () => std('#eef4f5', { rough: 0.04, opacity: 0.28, cc: 1, env: 1.4 }),
  led: () => std('#bff5d2', { emissive: '#8ff0b4', ei: 1.4, rough: 0.3 }),
  ledAmber: () => std('#ffe0a8', { emissive: '#ffbf5a', ei: 1.2, rough: 0.3 }),
  rubber: () => std('#1b1b1c', { rough: 0.8 }),
  bean: () => std('#4a2a17', { rough: 0.55, cc: 0.3 }),
};

// 바디 색 (가구 스와치의 machine 값)
const BODY = {
  chrome: () => MAT.chrome(),
  steel: () => MAT.steel(),
  black: () => std('#2a2a2d', { rough: 0.35, metal: 0.2, cc: 0.7 }),
  brass: () => std('#c9a46a', { rough: 0.25, metal: 0.85, cc: 0.4 }),
  cream: () => std('#f1eadb', { rough: 0.3, cc: 0.8 }),
  mint: () => std('#8fcdb4', { rough: 0.32, cc: 0.8 }),
};
export const bodyMaterial = (kind) => (BODY[kind] ?? BODY.mint)();

// 슬롯 타공 텍스처 (드립 트레이 그릴 · 컵 워머)
function slotTexture() {
  return once('slotTex', () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#d3d6da';
    g.fillRect(0, 0, 256, 128);
    for (let x = 10; x < 250; x += 14) {
      g.fillStyle = '#2b2d30';
      g.beginPath();
      g.roundRect ? g.roundRect(x, 14, 7, 100, 3.5) : g.rect(x, 14, 7, 100);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x + 7, 16, 1.5, 96);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  });
}
const slotMat = () => once('slotMat', () => {
  const m = new THREE.MeshStandardMaterial({ map: slotTexture(), roughness: 0.3, metalness: 0.75 });
  m.envMapIntensity = 1.1;
  return m;
});

// 측면 실루엣 (z, y): 아래 앞쪽이 드립 트레이 자리로 들어가 있고, 전면 위·뒤 모서리는 둥글다
function bodyGeometry(w, d, h) {
  return once(`body|${w}|${d}|${h}`, () => {
    const zb = -d / 2;
    const zf = d / 2 - 0.11; // 전면 (그룹헤드가 이 면에서 튀어나온다)
    const s = new THREE.Shape();
    s.moveTo(zb + 0.02, 0.03);
    s.lineTo(zf - 0.1, 0.03);
    s.lineTo(zf - 0.1, 0.11);
    s.quadraticCurveTo(zf - 0.1, 0.15, zf - 0.05, 0.155);
    s.lineTo(zf, 0.16);
    s.lineTo(zf, h - 0.07);
    s.quadraticCurveTo(zf, h, zf - 0.07, h);
    s.lineTo(zb + 0.045, h);
    s.quadraticCurveTo(zb, h, zb, h - 0.045);
    s.lineTo(zb, 0.05);
    s.quadraticCurveTo(zb, 0.03, zb + 0.02, 0.03);
    const bev = 0.012;
    const g = new THREE.ExtrudeGeometry(s, { depth: w - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 4, curveSegments: 10 });
    g.rotateY(-Math.PI / 2);
    g.translate((w - bev * 2) / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  });
}

// 데미타세 잔 (속이 빈 도자기 회전체) · 받침접시
const cupGeo = () =>
  once('demitasse', () => {
    const p = [
      [0.0, 0],
      [0.021, 0],
      [0.023, 0.006],
      [0.027, 0.03],
      [0.03, 0.05],
      [0.031, 0.055],
      [0.028, 0.055],
      [0.026, 0.05],
      [0.023, 0.03],
      [0.02, 0.008],
      [0.0, 0.007],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, 28);
  });
const saucerGeo = () =>
  once('saucer', () => {
    const p = [
      [0.0, 0],
      [0.03, 0],
      [0.034, 0.004],
      [0.05, 0.007],
      [0.058, 0.012],
      [0.056, 0.013],
      [0.048, 0.009],
      [0.025, 0.006],
      [0.0, 0.006],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, 32);
  });
const handleGeo = () => once('cupHandle', () => new THREE.TorusGeometry(0.012, 0.0035, 8, 16, Math.PI * 1.3));

export function demitasse({ upsideDown = false, coffee = false } = {}) {
  const g = new THREE.Group();
  g.add(M(saucerGeo(), MAT.porcelain()));
  const cup = new THREE.Group();
  cup.add(M(cupGeo(), MAT.porcelain()));
  cup.add(M(handleGeo(), MAT.porcelain(), 0.031, 0.03, 0, 0, 0, -Math.PI * 0.65));
  if (coffee) {
    cup.add(M(once('cupLiquid', () => new THREE.CircleGeometry(0.025, 24)), MAT.espresso(), 0, 0.04, 0, -Math.PI / 2));
    cup.add(M(once('cupCrema', () => new THREE.RingGeometry(0.017, 0.025, 24)), MAT.crema(), 0, 0.0405, 0, -Math.PI / 2));
  }
  if (upsideDown) {
    cup.rotation.x = Math.PI;
    cup.position.y = 0.006 + 0.055;
  } else cup.position.y = 0.006;
  g.add(cup);
  return g;
}

// 포터필터: 바스켓 + 귀 + 테이퍼 손잡이 + 투샷 스파우트. 원점 = 바스켓 윗면 중심
export function portafilter(handleMat = MAT.walnut()) {
  const g = new THREE.Group();
  g.add(M(once('pfBasket', () => new THREE.CylinderGeometry(0.043, 0.039, 0.03, 28)), MAT.chrome(), 0, -0.015, 0));
  for (const s of [-1, 1]) g.add(M(once('pfEar', () => new THREE.BoxGeometry(0.018, 0.008, 0.014)), MAT.chrome(), s * 0.048, -0.006, 0));
  // 손잡이: 앞으로 뻗으며 살짝 아래로
  const arm = new THREE.Group();
  arm.position.set(0, -0.016, 0.04);
  arm.rotation.x = 0.22;
  arm.add(M(once('pfNeck', () => new THREE.CylinderGeometry(0.009, 0.011, 0.04, 12)), MAT.chrome(), 0, 0, 0.02, Math.PI / 2));
  const hp = [
    [0.0, 0],
    [0.012, 0],
    [0.015, 0.03],
    [0.017, 0.08],
    [0.016, 0.11],
    [0.012, 0.125],
    [0.0, 0.128],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  arm.add(M(once('pfHandle', () => new THREE.LatheGeometry(hp, 16)), handleMat, 0, 0, 0.04, Math.PI / 2));
  arm.add(M(once('pfCap', () => new THREE.SphereGeometry(0.0125, 14, 10)), MAT.chrome(), 0, 0, 0.168));
  g.add(arm);
  // 투샷 스파우트 (Y 자로 갈라지는 두 주둥이)
  g.add(M(once('pfSpoutHub', () => new THREE.CylinderGeometry(0.011, 0.014, 0.016, 14)), MAT.chrome(), 0, -0.038, 0));
  for (const s of [-1, 1]) g.add(M(once('pfSpout', () => new THREE.CylinderGeometry(0.0045, 0.006, 0.026, 10)), MAT.chrome(), s * 0.011, -0.055, 0, 0, 0, s * 0.45));
  g.userData.spoutY = -0.066; // 바스켓 윗면 기준 주둥이 끝 높이
  return g;
}

export function buildEspressoMachine({ body = 'mint', w = 0.58, d = 0.44, h = 0.4, groups = [-0.14, 0.14], portafilters = [true, true], brewCups = [true, true], gauge = true } = {}) {
  const root = new THREE.Group();
  const bodyMat = bodyMaterial(body);
  const zf = d / 2 - 0.11;
  // 바디 하우징 + 크롬 다리
  root.add(M(bodyGeometry(w, d, h), bodyMat));
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    root.add(M(once('foot', () => new THREE.CylinderGeometry(0.016, 0.02, 0.03, 16)), MAT.chrome(), x * (w / 2 - 0.05), 0.015, z > 0 ? zf - 0.13 : -d / 2 + 0.06));
  // 측면 크롬 몰딩 (위 테두리)
  for (const s of [-1, 1]) root.add(M(once(`sideTrim|${d}`, () => new THREE.BoxGeometry(0.006, 0.012, d - 0.13)), MAT.chrome(), s * (w / 2 + 0.003), h - 0.055, -0.03));
  root.add(M(once(`frontTrim|${w}`, () => new THREE.BoxGeometry(w - 0.02, 0.01, 0.008)), MAT.chrome(), 0, 0.165, zf + 0.004));

  // ── 상단 컵 워머 + 스테인리스 레일 + 데미타세 2단 ──
  const top = h + 0.002;
  const cwD = d - 0.2;
  const cwZ = zf - 0.07 - cwD / 2;
  root.add(M(once(`warmer|${w}|${cwD}`, () => new THREE.BoxGeometry(w - 0.08, 0.006, cwD)), slotMat(), 0, top + 0.003, cwZ));
  const railY = top + 0.045;
  const rx = w / 2 - 0.03;
  const rz0 = cwZ - cwD / 2 - 0.01;
  const rz1 = cwZ + cwD / 2 + 0.01;
  const rod = (len) => once(`rod|${len.toFixed(3)}`, () => new THREE.CylinderGeometry(0.0055, 0.0055, len, 10));
  for (const z of [rz0, rz1]) root.add(M(rod(rx * 2), MAT.chrome(), 0, railY, z, 0, 0, Math.PI / 2));
  for (const x of [-rx, rx]) root.add(M(rod(rz1 - rz0), MAT.chrome(), x, railY, (rz0 + rz1) / 2, Math.PI / 2));
  for (const x of [-rx, 0, rx]) for (const z of [rz0, rz1]) root.add(M(rod(0.045), MAT.chrome(), x, top + 0.0225, z));
  for (const x of [-rx, rx]) for (const z of [rz0, rz1]) root.add(M(once('railBall', () => new THREE.SphereGeometry(0.0085, 12, 8)), MAT.chrome(), x, railY, z));
  const row = [-0.19, -0.065, 0.065, 0.19].map((x) => x * (w / 0.58));
  for (const x of row) {
    const c = demitasse({ upsideDown: true });
    c.position.set(x, top + 0.006, cwZ - 0.005);
    root.add(c);
  }
  for (let i = 0; i < 3; i++) {
    const c = demitasse({ upsideDown: true });
    c.position.set((row[i] + row[i + 1]) / 2, top + 0.006 + 0.061, cwZ - 0.005);
    c.rotation.y = 0.4 + i;
    root.add(c);
  }

  // ── 전면: 그룹헤드 · 포터필터 · LED 버튼 ──
  const gY = 0.235; // 그룹헤드 아랫면
  const gZ = zf + 0.07;
  const pfs = [];
  groups.forEach((gx, i) => {
    root.add(M(once('gMount', () => new THREE.BoxGeometry(0.085, 0.055, 0.08)), MAT.chrome(), gx, gY + 0.045, zf + 0.03));
    const bell = [
      [0.0, 0.0],
      [0.042, 0.0],
      [0.05, 0.012],
      [0.052, 0.03],
      [0.046, 0.045],
      [0.03, 0.052],
      [0.0, 0.053],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    root.add(M(once('gBell', () => new THREE.LatheGeometry(bell, 28)), MAT.chrome(), gx, gY, gZ));
    root.add(M(once('gGasket', () => new THREE.TorusGeometry(0.041, 0.004, 8, 28)), MAT.rubber(), gx, gY + 0.002, gZ, Math.PI / 2));
    // 추출 버튼 패널 + LED 램프
    root.add(M(once('btnPanel', () => new THREE.BoxGeometry(0.075, 0.03, 0.01)), MAT.black(), gx, 0.325, zf + 0.005));
    for (const b of [-1, 0, 1]) root.add(M(once('btn', () => new THREE.CylinderGeometry(0.007, 0.007, 0.006, 14)), b === 0 ? MAT.ledAmber() : MAT.led(), gx + b * 0.022, 0.325, zf + 0.011, Math.PI / 2));
    if (portafilters[i]) {
      const pf = portafilter();
      pf.position.set(gx, gY - 0.002, gZ);
      root.add(pf);
      pfs.push(pf);
      if (brewCups[i]) {
        const cup = demitasse({ coffee: true });
        cup.position.set(gx, 0.031, gZ + 0.005);
        cup.rotation.y = -0.6;
        root.add(cup);
        // 추출 줄기 두 가닥
        const top = gY - 0.002 + pf.userData.spoutY;
        const bot = 0.031 + 0.006 + 0.04;
        for (const s of [-1, 1]) root.add(M(once(`stream|${(top - bot).toFixed(3)}`, () => new THREE.CylinderGeometry(0.0022, 0.0016, top - bot, 8)), MAT.stream(), gx + s * 0.013, (top + bot) / 2, gZ));
      }
    }
  });

  // ── 중앙 듀얼 압력 게이지 (보일러 · 펌프) ──
  let gaugeGroup = null;
  if (gauge) {
    gaugeGroup = new THREE.Group();
    gaugeGroup.position.set(0, 0.3, zf + 0.012);
    const R = 0.046;
    const dial = new THREE.Mesh(once('gaugeDial', () => new THREE.CircleGeometry(R, 40)), once('gaugeMat', () => new THREE.MeshStandardMaterial({ map: gaugeTexture(), roughness: 0.4 })));
    gaugeGroup.add(dial);
    gaugeGroup.add(M(once('gaugeBezel', () => new THREE.TorusGeometry(R + 0.003, 0.0065, 12, 40)), MAT.chrome(), 0, 0, 0.003));
    gaugeGroup.add(M(once('gaugeBack', () => new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.012, 40)), MAT.chrome(), 0, 0, -0.006, Math.PI / 2));
    // 볼록한 유리 커버 (반지름 0.1 구의 일부, 테두리 반지름 = 다이얼)
    gaugeGroup.add(M(once('gaugeGlass', () => new THREE.SphereGeometry(0.1, 28, 6, 0, Math.PI * 2, 0, Math.asin(R / 0.1))), MAT.glass(), 0, 0, 0.006 - 0.1 * Math.cos(Math.asin(R / 0.1)), Math.PI / 2));
    gaugeGroup.add(M(once('gaugeHub', () => new THREE.CylinderGeometry(0.005, 0.005, 0.004, 12)), MAT.black(), 0, 0, 0.003, Math.PI / 2));
    // 바늘: 펌프(검정, 길게) · 보일러(빨강, 짧게). rotation.z = -(−225° + bar/15·270°)
    const needle = (len, color, bar) => {
      const n = new THREE.Group();
      n.add(M(once(`needle|${len}|${color}`, () => new THREE.BoxGeometry(len, 0.0028, 0.0015)), std(color, { rough: 0.4 }), len / 2 - 0.006, 0, 0));
      n.position.z = 0.004;
      n.rotation.z = -((-225 + (bar / 15) * 270) * Math.PI) / 180;
      gaugeGroup.add(n);
      return n;
    };
    gaugeGroup.userData.boiler = needle(0.03, '#a8321f', 1.2);
    gaugeGroup.userData.pump = needle(0.042, '#1d1d1f', brewCups.some(Boolean) ? 9 : 0);
    gaugeGroup.userData.R = R;
    root.add(gaugeGroup);
  }

  // ── 좌우 스팀 노브 + 대각선 스팀 완드 ──
  for (const s of [-1, 1]) {
    const kx = s * (w / 2 - 0.05);
    root.add(M(once('knobBase', () => new THREE.CylinderGeometry(0.024, 0.026, 0.012, 24)), MAT.chrome(), kx, 0.29, zf + 0.006, Math.PI / 2));
    root.add(M(once('knob', () => new THREE.CylinderGeometry(0.019, 0.021, 0.03, 18)), MAT.black(), kx, 0.29, zf + 0.026, Math.PI / 2));
    root.add(M(once('knobFlag', () => new THREE.BoxGeometry(0.012, 0.042, 0.012)), MAT.black(), kx, 0.29, zf + 0.04, 0, 0, s * 0.5));
    // 완드: 바디 옆면 볼조인트에서 바깥·아래로
    const joint = new THREE.Vector3(s * (w / 2 + 0.012), 0.225, zf - 0.02);
    root.add(M(once('wandJoint', () => new THREE.SphereGeometry(0.014, 16, 12)), MAT.chrome(), joint.x, joint.y, joint.z));
    const dir = new THREE.Vector3(s * 0.32, -1, 0.42).normalize();
    const len = 0.17;
    const mid = joint.clone().addScaledVector(dir, len / 2);
    const wand = M(once('wand', () => new THREE.CylinderGeometry(0.0055, 0.0055, len, 12)), MAT.chrome(), mid.x, mid.y, mid.z);
    wand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    root.add(wand);
    const tip = joint.clone().addScaledVector(dir, len);
    const nz = M(once('wandTip', () => new THREE.CylinderGeometry(0.008, 0.006, 0.022, 12)), MAT.chrome(), tip.x, tip.y, tip.z);
    nz.quaternion.copy(wand.quaternion);
    root.add(nz);
  }
  // 위 루프에서 손잡이 피복은 quaternion 이 필요해 따로 만든다
  for (const s of [-1, 1]) {
    const joint = new THREE.Vector3(s * (w / 2 + 0.012), 0.225, zf - 0.02);
    const dir = new THREE.Vector3(s * 0.32, -1, 0.42).normalize();
    const grip = M(once('wandGrip', () => new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 12)), MAT.black());
    grip.position.copy(joint).addScaledVector(dir, 0.045);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    root.add(grip);
  }

  // ── 드립 트레이: 스테인리스 받침 + 슬롯 그릴 + 앞 립 ──
  const tz0 = zf - 0.1;
  const tz1 = d / 2 + 0.01;
  const tW = w - 0.04;
  root.add(M(once(`tray|${tW}|${tz1 - tz0}`, () => new THREE.BoxGeometry(tW, 0.024, tz1 - tz0)), MAT.steel(), 0, 0.012, (tz0 + tz1) / 2));
  root.add(M(once(`grate|${tW}|${tz1 - tz0}`, () => new THREE.BoxGeometry(tW - 0.02, 0.004, tz1 - tz0 - 0.02)), slotMat(), 0, 0.027, (tz0 + tz1) / 2));
  root.add(M(once(`lip|${tW}`, () => new THREE.BoxGeometry(tW, 0.03, 0.008)), MAT.chrome(), 0, 0.016, tz1));

  return { root, gauge: gaugeGroup, portafilters: pfs, groupY: gY, groupZ: gZ, frontZ: zf };
}

// 하이엔드 그라인더: 원두가 가득 찬 투명 호퍼 · 분쇄도 다이얼 · 포터필터 거치 포크 · 디스플레이
export function buildGrinder({ body = 'black' } = {}) {
  const g = new THREE.Group();
  const bm = body === 'chrome' ? MAT.chrome() : bodyMaterial(body);
  // 받침 + 몸통 (앞뒤로 둥근 측면 실루엣)
  g.add(M(once('grBase', () => new THREE.BoxGeometry(0.16, 0.022, 0.22)), MAT.black(), 0, 0.011, 0.005));
  const s = new THREE.Shape();
  s.moveTo(-0.085, 0.02);
  s.lineTo(0.03, 0.02);
  s.lineTo(0.03, 0.16);
  s.quadraticCurveTo(0.075, 0.18, 0.075, 0.24);
  s.lineTo(0.075, 0.27);
  s.quadraticCurveTo(0.075, 0.31, 0.035, 0.31);
  s.lineTo(-0.05, 0.31);
  s.quadraticCurveTo(-0.085, 0.31, -0.085, 0.275);
  s.lineTo(-0.085, 0.02);
  const bev = 0.01;
  const geo = once('grBody', () => {
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.13 - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 10 });
    e.rotateY(-Math.PI / 2);
    e.translate((0.13 - bev * 2) / 2, 0, 0);
    e.computeVertexNormals();
    return e;
  });
  g.add(M(geo, bm));
  // 디스플레이 + 버튼
  g.add(M(once('grScreen', () => new THREE.BoxGeometry(0.06, 0.03, 0.004)), std('#1d2a2a', { emissive: '#7fe0c8', ei: 0.35, rough: 0.2 }), 0, 0.255, 0.087, -0.5));
  g.add(M(once('grBtn', () => new THREE.CylinderGeometry(0.007, 0.007, 0.006, 14)), MAT.ledAmber(), 0, 0.225, 0.084, Math.PI / 2 - 0.5));
  // 분쇄 토출구 (앞으로 비스듬히)
  g.add(M(once('grChute', () => new THREE.CylinderGeometry(0.012, 0.016, 0.05, 14)), MAT.chrome(), 0, 0.175, 0.06, -0.9));
  // 포터필터 거치 포크 (두 갈래)
  for (const x of [-1, 1]) g.add(M(once('grFork', () => new THREE.BoxGeometry(0.01, 0.01, 0.07)), MAT.chrome(), x * 0.03, 0.115, 0.06));
  g.add(M(once('grForkBar', () => new THREE.BoxGeometry(0.07, 0.012, 0.012)), MAT.chrome(), 0, 0.115, 0.03));
  // 가루 받이
  g.add(M(once('grCatch', () => new THREE.BoxGeometry(0.1, 0.012, 0.07)), MAT.steel(), 0, 0.028, 0.07));
  // 모터 위 칼라 + 분쇄도 다이얼 (눈금 + 손잡이)
  g.add(M(once('grCollar', () => new THREE.CylinderGeometry(0.068, 0.072, 0.03, 32)), MAT.chrome(), 0, 0.325, -0.01));
  g.add(M(once('grDial', () => new THREE.CylinderGeometry(0.082, 0.082, 0.024, 40)), MAT.black(), 0, 0.352, -0.01));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    g.add(M(once('grTick', () => new THREE.BoxGeometry(0.003, 0.012, 0.004)), i % 5 === 0 ? MAT.chrome() : std('#c9c2b4', { rough: 0.5 }), Math.sin(a) * 0.083, 0.352, -0.01 + Math.cos(a) * 0.083, 0, a, 0));
  }
  g.add(M(once('grDialKnob', () => new THREE.CylinderGeometry(0.008, 0.008, 0.03, 12)), MAT.chrome(), 0.06, 0.352, 0.055, Math.PI / 2));
  // 투명 호퍼 + 가득 찬 원두
  const hopY = 0.364;
  g.add(M(once('grHopNeck', () => new THREE.CylinderGeometry(0.05, 0.05, 0.02, 28)), MAT.chrome(), 0, hopY + 0.01, -0.01));
  g.add(M(once('grBeans', () => new THREE.CylinderGeometry(0.084, 0.046, 0.14, 28)), MAT.bean(), 0, hopY + 0.09, -0.01));
  const beanGeo = once('beanGeo', () => new THREE.SphereGeometry(0.009, 8, 6));
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const r = 0.012 + (i % 6) * 0.012;
    const b = M(beanGeo, MAT.bean(), Math.cos(a) * r, hopY + 0.162 + (i % 3) * 0.004, -0.01 + Math.sin(a) * r, a, a * 0.7, 0);
    b.scale.set(1, 0.6, 1.35);
    b.castShadow = false;
    g.add(b);
  }
  g.add(M(once('grHopper', () => new THREE.CylinderGeometry(0.092, 0.05, 0.2, 32, 1, true)), MAT.glass(), 0, hopY + 0.12, -0.01));
  g.add(M(once('grLid', () => new THREE.CylinderGeometry(0.096, 0.094, 0.014, 32)), MAT.black(), 0, hopY + 0.226, -0.01));
  g.add(M(once('grLidKnob', () => new THREE.SphereGeometry(0.014, 14, 10)), MAT.chrome(), 0, hopY + 0.238, -0.01));
  return g;
}
