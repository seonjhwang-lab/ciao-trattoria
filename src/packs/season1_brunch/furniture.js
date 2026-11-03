import { buildEspressoMachine, buildGrinder } from '../../core/EspressoMachine.js';
import { briocheLoaf } from '../../core/HeroDish.js';
import { buildForno } from '../../core/Forno.js';
import { getProgress } from '../../core/Progress.js';
// 시즌 1 · 브런치 카페 가구 (현실 톤: 월넛/오크 원목, 매트 블랙 철제, 스테인리스, 콘크리트)
// 모든 모델은 +z(앞)를 바라보고, 칸 중심이 원점. build(k, sw) — k = core/Kit.js, sw = 선택된 톤 스와치
import { WOOD, METAL } from '../../core/Kit.js';

const chip = (wood, metal) => [WOOD[wood] ?? wood, METAL[metal]?.c ?? metal];

const TABLE_SW = [
  { name: '월넛 & 블랙 스틸', wood: 'walnut', metal: 'black', chip: chip('walnut', 'black') },
  { name: '오크 & 블랙 스틸', wood: 'oak', metal: 'black', chip: chip('oak', 'black') },
  { name: '라이트 오크 & 스테인리스', wood: 'lightoak', metal: 'steel', chip: chip('lightoak', 'steel') },
  { name: '에보니 & 브라스', wood: 'ebony', metal: 'brass', chip: chip('ebony', 'brass') },
];
const BENTWOOD_SW = [
  { name: '블랙 벤트우드', wood: 'ebony', cushion: '#2c2a28', chip: chip('ebony', '#2c2a28') },
  { name: '내추럴 오크', wood: 'oak', cushion: '#6b5644', chip: chip('oak', '#6b5644') },
  { name: '월넛', wood: 'walnut', cushion: '#3a3633', chip: chip('walnut', '#3a3633') },
  { name: '라이트 오크', wood: 'lightoak', cushion: '#8a7a66', chip: chip('lightoak', '#8a7a66') },
];
const METALCHAIR_SW = [
  { name: '매트 블랙', metal: 'black', chip: chip('walnut', 'black') },
  { name: '올리브', metal: 'olive', chip: chip('oak', 'olive') },
  { name: '옥사이드 레드', metal: 'oxide', chip: chip('oak', 'oxide') },
  { name: '아연 스틸', metal: 'steel', chip: chip('lightoak', 'steel') },
];
const LEATHER_SW = [
  { name: '코냑 가죽 & 월넛', leather: '#8a4e2b', wood: 'walnut', chip: ['#8a4e2b', WOOD.walnut] },
  { name: '다크 브라운 & 오크', leather: '#4a3022', wood: 'oak', chip: ['#4a3022', WOOD.oak] },
  { name: '올리브 가죽 & 오크', leather: '#545a3c', wood: 'oak', chip: ['#545a3c', WOOD.oak] },
  { name: '크림 부클레 & 월넛', fabric: '#ddd5c6', wood: 'walnut', chip: ['#ddd5c6', WOOD.walnut] },
];
const STATION_SW = [
  { name: '라이트 오크 & 파스텔 민트', wood: 'lightoak', machine: 'mint', top: '#ece7df', chip: chip('lightoak', 'mint') },
  { name: '월넛 & 크롬', wood: 'walnut', machine: 'chrome', top: '#d4d0c8', chip: chip('walnut', 'chrome') },
  { name: '오크 & 매트 블랙', wood: 'oak', machine: 'black', top: '#8f8b86', chip: chip('oak', 'black') },
  { name: '에보니 & 브라스', wood: 'ebony', machine: 'brass', top: '#e1ddd6', chip: chip('ebony', 'brass') },
  { name: '라이트 오크 & 크림', wood: 'lightoak', machine: 'cream', top: '#cfc9bf', chip: chip('lightoak', 'cream') },
];
const PREP_SW = [
  { name: '스테인리스 & 오크', metal: 'steel', wood: 'oak', chip: chip('oak', 'steel') },
  { name: '스테인리스 & 월넛', metal: 'steel', wood: 'walnut', chip: chip('walnut', 'steel') },
  { name: '매트 블랙 & 오크', metal: 'black', wood: 'oak', chip: chip('oak', 'black') },
  { name: '브라스 & 에보니', metal: 'brass', wood: 'ebony', chip: chip('ebony', 'brass') },
];
const COUNTER_SW = [
  { name: '오크 슬랫 & 콘크리트', wood: 'oak', top: '#9e9b96', chip: chip('oak', '#9e9b96') },
  { name: '월넛 & 화이트 마블', wood: 'walnut', top: '#e3e0da', chip: chip('walnut', '#e3e0da') },
  { name: '에보니 & 테라조', wood: 'ebony', top: '#c9c3b8', chip: chip('ebony', '#c9c3b8') },
  { name: '라이트 오크 & 블랙 스톤', wood: 'lightoak', top: '#3a3938', chip: chip('lightoak', '#3a3938') },
];
const POT_SW = [
  { name: '콘크리트', pot: '#98958f', rough: 0.9, chip: ['#98958f', '#3f6a3c'] },
  { name: '테라코타', pot: '#9e5a3c', rough: 0.85, chip: ['#9e5a3c', '#3f6a3c'] },
  { name: '매트 블랙', pot: '#2a2a2b', rough: 0.6, chip: ['#2a2a2b', '#3f6a3c'] },
  { name: '화이트 세라믹', pot: '#e7e3dc', rough: 0.3, chip: ['#e7e3dc', '#3f6a3c'] },
];

const LEAF = ['#2f5530', '#3a6337', '#2a4a2b', '#44703f'];

// ───────── 테이블 ─────────
function roundTable(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  g.add(k.at(k.cyl(0.24, 0.26, 0.03, m), 0, 0.015, 0));
  g.add(k.at(k.cyl(0.035, 0.035, 0.68, m), 0, 0.37, 0));
  g.add(k.at(k.cyl(0.14, 0.14, 0.02, m), 0, 0.705, 0));
  g.add(k.at(k.cyl(0.42, 0.42, 0.04, k.wood(sw.wood), { seg: 48 }), 0, 0.735, 0));
  g.add(candle(k, 0.04, 0.755, -0.06));
  return g;
}

function candle(k, x, y, z) {
  const g = k.group();
  g.add(k.at(k.cyl(0.032, 0.032, 0.045, k.glass()), x, y + 0.0225, z));
  g.add(k.at(k.cyl(0.026, 0.026, 0.03, k.mat('#efe6d4', { rough: 0.8 })), x, y + 0.016, z));
  g.add(k.at(k.sphere(0.008, k.glow('#ffb35c', 2)), x, y + 0.04, z));
  return g;
}

function squareTable(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(k.at(k.box(0.035, 0.71, 0.035, m), x * 0.37, 0.355, z * 0.37));
  for (const r of [0, 1]) {
    g.add(k.at(k.box(0.74, 0.03, 0.025, m), 0, 0.69, r ? 0.37 : -0.37));
    g.add(k.at(k.box(0.025, 0.03, 0.74, m), r ? 0.37 : -0.37, 0.69, 0));
  }
  g.add(k.at(k.rbox(0.86, 0.04, 0.86, k.wood(sw.wood), { r: 0.008 }), 0, 0.735, 0));
  g.add(k.at(k.cyl(0.018, 0.02, 0.07, k.glass()), 0.06, 0.79, -0.08));
  g.add(k.at(k.cyl(0.018, 0.02, 0.07, k.metal('black')), 0.1, 0.79, -0.08));
  return g;
}

function longTable(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.33, 0.33]) g.add(k.at(k.box(0.05, 0.7, 0.05, m), x, 0.35, z));
    g.add(k.at(k.box(0.05, 0.05, 0.71, m), x, 0.04, 0));
    g.add(k.at(k.box(0.05, 0.05, 0.71, m), x, 0.68, 0));
  }
  g.add(k.at(k.box(1.5, 0.04, 0.04, m), 0, 0.22, 0));
  g.add(k.at(k.rbox(1.9, 0.06, 0.86, k.wood(sw.wood), { r: 0.01 }), 0, 0.73, 0));
  g.add(k.at(k.box(1.3, 0.004, 0.3, k.fabric('#cfc6b4')), 0, 0.762, 0));
  g.add(candle(k, -0.25, 0.764, 0));
  g.add(candle(k, 0.3, 0.764, 0.02));
  g.add(k.at(k.cyl(0.045, 0.035, 0.08, k.ceramic('#e7e3dc')), 0.02, 0.804, 0));
  for (let i = 0; i < 5; i++) g.add(k.at(k.scl(k.sphere(0.035, k.mat(LEAF[i % 4], { rough: 0.85 })), 1, 0.8, 1), 0.02 + Math.cos(i * 1.3) * 0.03, 0.87, Math.sin(i * 1.3) * 0.03));
  return g;
}

// ───────── 의자 ─────────
function bentwoodChair(k, sw) {
  const g = k.group();
  const w = k.wood(sw.wood);
  const z0 = 0.08;
  for (const [x, z, rx, rz] of [
    [0.15, 0.13, -0.06, -0.06],
    [-0.15, 0.13, -0.06, 0.06],
    [0.13, -0.12, 0.1, -0.05],
    [-0.13, -0.12, 0.1, 0.05],
  ])
    g.add(k.at(k.cyl(0.015, 0.013, 0.46, w), x, 0.225, z0 + z, rx, 0, rz));
  g.add(k.at(k.torus(0.16, 0.009, w), 0, 0.2, z0, Math.PI / 2));
  g.add(k.at(k.cyl(0.21, 0.21, 0.035, w, { seg: 32 }), 0, 0.455, z0));
  g.add(k.at(k.cyl(0.19, 0.19, 0.02, k.fabric(sw.cushion), { seg: 32 }), 0, 0.48, z0));
  const back = k.group();
  back.position.set(0, 0.47, z0 - 0.17);
  back.rotation.x = -0.12;
  for (const s of [-1, 1]) back.add(k.at(k.cyl(0.015, 0.015, 0.36, w), s * 0.15, 0.18, 0));
  back.add(k.at(k.torus(0.15, 0.015, w, { arc: Math.PI }), 0, 0.36, 0));
  back.add(k.at(k.torus(0.1, 0.012, w, { arc: Math.PI }), 0, 0.3, 0));
  g.add(back);
  return g;
}

function metalChair(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  const z0 = 0.07;
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(k.at(k.cyl(0.016, 0.011, 0.46, m), x * 0.17, 0.225, z0 + z * 0.16, -z * 0.07, 0, x * 0.07));
  g.add(k.at(k.rbox(0.4, 0.03, 0.38, m, { r: 0.01 }), 0, 0.455, z0));
  g.add(k.at(k.box(0.4, 0.05, 0.01, m), 0, 0.43, z0 + 0.19));
  const back = k.cyl(0.24, 0.22, 0.26, m, { open: true, t0: Math.PI * 0.72, tl: Math.PI * 0.56, seg: 18 });
  back.material = back.material.clone();
  back.material.side = 2;
  g.add(k.at(back, 0, 0.66, z0 + 0.04, -0.12));
  return g;
}

function armchair(k, sw) {
  const g = k.group();
  const cover = sw.fabric ? k.fabric(sw.fabric) : k.leather(sw.leather);
  const w = k.wood(sw.wood);
  const z0 = 0.05;
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(k.at(k.cyl(0.02, 0.014, 0.16, w), x * 0.28, 0.08, z0 + z * 0.24));
  g.add(k.at(k.rbox(0.7, 0.12, 0.62, w, { r: 0.02 }), 0, 0.2, z0));
  g.add(k.at(k.rbox(0.56, 0.14, 0.52, cover, { r: 0.05 }), 0, 0.33, z0 + 0.04));
  g.add(k.at(k.rbox(0.62, 0.48, 0.14, cover, { r: 0.06 }), 0, 0.55, z0 - 0.24, -0.12));
  for (const s of [-1, 1]) {
    g.add(k.at(k.rbox(0.08, 0.2, 0.6, w, { r: 0.02 }), s * 0.32, 0.36, z0));
    g.add(k.at(k.rbox(0.09, 0.03, 0.58, cover, { r: 0.012 }), s * 0.32, 0.47, z0));
  }
  return g;
}

// ───────── 조리기구 ─────────
function cabinet(k, sw, h = 0.86) {
  const g = k.group();
  const w = k.wood(sw.wood);
  g.add(k.at(k.box(0.9, 0.08, 0.78, k.mat('#1e1d1c')), 0, 0.04, -0.02));
  g.add(k.at(k.box(0.94, h - 0.08, 0.82, w), 0, 0.08 + (h - 0.08) / 2, 0));
  for (const s of [-1, 1]) {
    g.add(k.at(k.box(0.43, h - 0.2, 0.02, w), s * 0.225, 0.08 + (h - 0.08) / 2 - 0.02, 0.415));
    g.add(k.at(k.box(0.012, 0.18, 0.02, k.metal('black')), s * 0.04, h * 0.62, 0.435));
  }
  g.add(k.at(k.box(0.98, 0.05, 0.86, k.stone(sw.top)), 0, h + 0.025, 0.01));
  return g;
}

function espressoStation(k, sw) {
  const g = cabinet(k, sw);
  const y0 = 0.91;
  // 고디테일 2그룹 머신 + 하이엔드 그라인더 (src/core/EspressoMachine.js)
  const m = buildEspressoMachine({ body: sw.machine, w: 0.58, d: 0.44 });
  m.root.position.set(-0.12, y0, -0.07);
  g.add(m.root);
  const gr = buildGrinder({ body: sw.machine === 'mint' || sw.machine === 'cream' ? 'black' : sw.machine });
  gr.position.set(0.33, y0, -0.06);
  g.add(gr);
  // 스팀 피처
  g.add(k.at(k.cyl(0.034, 0.042, 0.1, k.metal('steel')), 0.25, y0 + 0.05, 0.27));
  return g;
}

function sandwichStation(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(k.at(k.box(0.04, 0.88, 0.04, m), x * 0.44, 0.44, z * 0.38));
  g.add(k.at(k.box(0.92, 0.03, 0.8, m), 0, 0.22, 0));
  g.add(k.at(k.box(0.96, 0.04, 0.84, m), 0, 0.9, 0));
  g.add(k.at(k.box(0.96, 0.22, 0.02, m), 0, 1.03, -0.41));
  // 아래 선반: 빵 바구니
  g.add(k.at(k.rbox(0.36, 0.14, 0.26, k.mat('#8a6a48', { rough: 0.95 }), { r: 0.03 }), -0.2, 0.31, 0));
  g.add(k.at(briocheLoaf({ len: 0.26, w: 0.12, h: 0.11 }), -0.2, 0.38, 0, 0, 0.1, 0));
  g.add(k.at(k.rbox(0.3, 0.2, 0.3, k.metal('steel'), { r: 0.02 }), 0.25, 0.34, 0));
  const y0 = 0.92;
  // 도마 + 사워도우 + 칼
  g.add(k.at(k.rbox(0.44, 0.035, 0.3, k.wood(sw.wood), { r: 0.01 }), -0.17, y0 + 0.018, 0.12));
  g.add(k.at(briocheLoaf({ len: 0.18, w: 0.11, h: 0.1, color: '#9c5f2a' }), -0.25, y0 + 0.035, 0.1));
  // 잘라 둔 슬라이스 (단면이 위로 누운 식빵 한 장)
  g.add(k.at(k.box(0.1, 0.02, 0.11, k.mat('#ecd3a2', { rough: 0.9 })), -0.09, y0 + 0.045, 0.12));
  // 얇고 긴 빵칼 (날 높이 2.2cm · 두께 2mm)
  g.add(k.at(k.box(0.24, 0.002, 0.022, k.metal('chrome')), -0.15, y0 + 0.037, 0.24, 0, 0.3, 0));
  g.add(k.at(k.rbox(0.1, 0.016, 0.022, k.wood('walnut'), { r: 0.006 }), -0.01, y0 + 0.042, 0.28, 0, 0.3, 0));
  // 파니니 프레스
  g.add(k.at(k.rbox(0.32, 0.07, 0.28, k.metal('black'), { r: 0.015 }), 0.24, y0 + 0.035, -0.17));
  const lid = k.group();
  lid.position.set(0.24, y0 + 0.08, -0.3);
  lid.rotation.x = -0.45;
  lid.add(k.at(k.rbox(0.32, 0.06, 0.28, k.metal('black'), { r: 0.015 }), 0, 0.03, 0.14));
  lid.add(k.at(k.box(0.22, 0.025, 0.03, k.metal('steel')), 0, 0.05, 0.3));
  g.add(lid);
  // 재료 통 (밧드)
  [
    ['#c8402f', -0.3],
    ['#7fae4e', -0.15],
    ['#a8452f', 0.0],
  ].forEach(([c, bx]) => {
    g.add(k.at(k.box(0.13, 0.05, 0.12, k.metal('steel')), bx, y0 + 0.025, -0.27));
    for (let i = 0; i < 4; i++) g.add(k.at(k.scl(k.sphere(0.03, k.mat(c, { rough: 0.6 })), 1, 0.45, 1), bx - 0.03 + (i % 2) * 0.06, y0 + 0.05, -0.29 + Math.floor(i / 2) * 0.05));
  });
  return g;
}

// ───────── 7차 비스트로 스테이션 ─────────
// 생면 파스타 스토브: 스테인리스 레인지 + 가스 화구 2개(팬 · 육수 냄비) + 생면 건조대 + 밀가루 도마
function pastaStation(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  const steel = k.metal('steel');
  g.add(k.at(k.box(0.94, 0.84, 0.82, steel), 0, 0.42, 0));
  for (const s of [-1, 1]) {
    g.add(k.at(k.box(0.43, 0.5, 0.02, steel), s * 0.225, 0.4, 0.415));
    g.add(k.at(k.box(0.3, 0.02, 0.025, k.metal('black')), s * 0.225, 0.68, 0.43));
  }
  for (let i = 0; i < 4; i++) g.add(k.at(k.cyl(0.022, 0.022, 0.03, k.metal('black')), -0.33 + i * 0.22, 0.75, 0.43, Math.PI / 2));
  g.add(k.at(k.box(0.98, 0.05, 0.86, k.stone(sw.top ?? '#2f2f31')), 0, 0.865, 0));
  const y0 = 0.89;
  // 가스 화구 (주철 삼발이 + 파란 불꽃)
  for (const [x, z] of [[0.2, -0.12], [-0.22, -0.16]]) {
    g.add(k.at(k.cyl(0.09, 0.09, 0.012, k.metal('black')), x, y0 + 0.006, z));
    for (let i = 0; i < 4; i++) g.add(k.at(k.box(0.15, 0.012, 0.012, k.metal('black')), x, y0 + 0.02, z, 0, (i * Math.PI) / 4, 0));
    for (let i = 0; i < 10; i++) g.add(k.at(k.cone(0.008, 0.02, k.glow('#4f8cff', 1.6)), x + Math.cos(i * 0.63) * 0.045, y0 + 0.022, z + Math.sin(i * 0.63) * 0.045));
  }
  // 프라이팬 (손잡이는 오른쪽 앞) + 라구
  const pan = k.group(k.at(k.cyl(0.13, 0.11, 0.045, k.metal('black'), { seg: 32 }), 0, 0.022, 0), k.at(k.cyl(0.118, 0.118, 0.004, k.mat('#8a2a18', { rough: 0.35 })), 0, 0.035, 0), k.at(k.rbox(0.2, 0.018, 0.03, k.wood('walnut'), { r: 0.008 }), 0.21, 0.04, 0.05, 0, -0.35, 0.12));
  g.add(k.at(pan, 0.2, y0 + 0.026, -0.12));
  for (let i = 0; i < 8; i++) g.add(k.at(k.torus(0.035 + (i % 3) * 0.02, 0.004, k.mat('#e9c35a', { rough: 0.4 }), { arc: 4 }), 0.2 + Math.cos(i) * 0.03, y0 + 0.068, -0.12 + Math.sin(i * 1.7) * 0.03, Math.PI / 2, 0, i));
  // 육수 냄비 + 김
  g.add(k.at(k.cyl(0.11, 0.11, 0.16, steel, { seg: 28, open: true }), -0.22, y0 + 0.1, -0.16));
  g.add(k.at(k.cyl(0.105, 0.105, 0.004, k.mat('#e9dcc0', { rough: 0.2, opacity: 0.8 })), -0.22, y0 + 0.15, -0.16));
  for (let i = 0; i < 3; i++) g.add(k.at(k.sphere(0.03 + i * 0.01, k.mat('#ffffff', { opacity: 0.18, rough: 1 })), -0.22 + (i - 1) * 0.03, y0 + 0.24 + i * 0.07, -0.16));
  // 생면 건조대 (원목 막대에 노란 면이 주렁주렁)
  const wood = k.wood(sw.wood);
  g.add(k.at(k.cyl(0.05, 0.06, 0.02, wood), -0.32, y0 + 0.01, 0.2));
  g.add(k.at(k.cyl(0.008, 0.008, 0.36, wood), -0.32, y0 + 0.19, 0.2));
  for (let a = 0; a < 3; a++) {
    const arm = k.group();
    arm.position.set(-0.32, y0 + 0.33, 0.2);
    arm.rotation.y = (a * Math.PI) / 3;
    arm.add(k.at(k.cyl(0.005, 0.005, 0.24, wood), 0, 0, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 7; i++) arm.add(k.at(k.box(0.006, 0.16, 0.002, k.mat('#efd27a', { rough: 0.6 })), -0.1 + i * 0.033, -0.08, 0));
    g.add(arm);
  }
  // 밀가루 도마 + 반죽 + 밀대
  g.add(k.at(k.rbox(0.36, 0.025, 0.26, wood, { r: 0.008 }), 0.08, y0 + 0.012, 0.22));
  g.add(k.at(k.scl(k.sphere(0.05, k.mat('#f0d27a', { rough: 0.7 })), 1, 0.55, 1), 0.02, y0 + 0.035, 0.22));
  g.add(k.at(k.cyl(0.018, 0.018, 0.3, k.wood('lightoak')), 0.16, y0 + 0.043, 0.25, 0, 0.3, Math.PI / 2));
  for (let i = 0; i < 40; i++) g.add(k.at(k.box(0.006, 0.001, 0.006, k.mat('#fbf7ee', { rough: 1 })), 0.08 + (Math.random() - 0.5) * 0.3, y0 + 0.026, 0.22 + (Math.random() - 0.5) * 0.2));
  return g;
}

// 화덕 피자 오븐: 돌 받침 위 나폴리 벽돌 돔 화덕 + 피자 필
function pizzaStation(k, sw) {
  const g = k.group();
  const stone = k.mat(sw.base ?? '#8f8679', { rough: 0.9 });
  g.add(k.at(k.rbox(0.96, 0.78, 0.86, stone, { r: 0.03 }), 0, 0.39, 0));
  // 장작 수납 아치
  g.add(k.at(k.box(0.6, 0.36, 0.02, k.mat('#2a2522', { rough: 1 })), 0, 0.26, 0.425));
  for (let i = 0; i < 9; i++) g.add(k.at(k.cyl(0.035, 0.035, 0.5, k.wood('walnut', { seed: 30 + i })), -0.24 + (i % 5) * 0.12, 0.12 + Math.floor(i / 5) * 0.07, 0.32, 0, 0, Math.PI / 2));
  g.add(k.at(k.box(0.98, 0.05, 0.88, k.stone(sw.top ?? '#e7e1d6')), 0, 0.805, 0));
  const y0 = 0.83;
  // 나폴리 장작 화덕: 헤링본 테라코타 벽돌 돔 + 구리 연통 + 아치형 석재 입구 (워크벤치와 같은 모델)
  const oven = buildForno({ R: 0.36, mouthW: 0.3, mouthH: 0.19, detail: 'shop' });
  oven.position.set(0, y0, -0.08);
  g.add(oven);
  // 명판 + 피자 필
  const peel = k.group(k.at(k.cyl(0.12, 0.12, 0.008, k.wood('lightoak'), { seg: 24 }), 0, 0, 0, Math.PI / 2), k.at(k.cyl(0.012, 0.012, 0.6, k.wood('lightoak')), 0, -0.4, 0));
  g.add(k.at(peel, 0.43, 0.58, 0.3, 0, 0, -0.12));
  // 바질 화분
  g.add(k.at(k.cyl(0.05, 0.04, 0.08, k.mat('#b0603c', { rough: 0.8 })), -0.38, y0 + 0.04, 0.3));
  for (let i = 0; i < 7; i++) g.add(k.at(k.scl(k.sphere(0.025, k.mat('#3f7f2a', { rough: 0.6 })), 1, 0.6, 1.4), -0.38 + Math.cos(i) * 0.03, y0 + 0.1 + (i % 2) * 0.02, 0.3 + Math.sin(i) * 0.03));
  return g;
}

// 가든 샐러드 바: 라이트 오크 상판 + 큰 원목 샐러드 볼 + 채소 크레이트 + 드레싱 병
function saladStation(k, sw) {
  const g = cabinet(k, { ...sw, top: sw.top ?? '#ece7df' });
  const y0 = 0.91;
  const wood = k.wood(sw.wood);
  // 원목 볼
  g.add(k.at(k.cyl(0.21, 0.12, 0.11, k.wood('walnut'), { seg: 32, open: true }), -0.1, y0 + 0.055, 0.04));
  g.add(k.at(k.cyl(0.12, 0.12, 0.01, k.wood('walnut'), { seg: 32 }), -0.1, y0 + 0.005, 0.04));
  const greens = ['#5c8c38', '#7aa84a', '#3f6b2a', '#a8c968'];
  for (let i = 0; i < 16; i++) g.add(k.at(k.scl(k.sphere(0.045, k.mat(greens[i % 4], { rough: 0.6 })), 1.3, 0.45, 1), -0.1 + Math.cos(i * 2.4) * 0.12 * Math.sqrt(i / 16), y0 + 0.1 + (i % 3) * 0.01, 0.04 + Math.sin(i * 2.4) * 0.12 * Math.sqrt(i / 16), 0, i, 0));
  for (let i = 0; i < 5; i++) g.add(k.at(k.sphere(0.016, k.mat('#c8321f', { rough: 0.25 })), -0.1 + Math.cos(i * 1.3) * 0.09, y0 + 0.125, 0.04 + Math.sin(i * 1.3) * 0.09));
  for (let i = 0; i < 3; i++) g.add(k.at(k.scl(k.sphere(0.02, k.mat('#6a2f48', { rough: 0.4 })), 1, 1.2, 1), -0.05 + i * 0.04, y0 + 0.13, -0.02 + (i % 2) * 0.05));
  // 우드 서버 한 쌍
  for (const s of [-1, 1]) g.add(k.at(k.rbox(0.03, 0.006, 0.26, wood, { r: 0.002 }), -0.1 + s * 0.05, y0 + 0.14, 0.12, -0.9, s * 0.15, 0));
  // 채소 크레이트 (토마토 · 오이 · 레몬)
  [['#c8321f', 0.27, -0.2, 'sphere'], ['#355f2a', 0.27, 0.06, 'cuke'], ['#e9cf4a', 0.3, 0.27, 'sphere']].forEach(([c, x, z, kind]) => {
    g.add(k.at(k.box(0.2, 0.07, 0.18, k.wood('lightoak')), x, y0 + 0.035, z));
    for (let i = 0; i < 6; i++) {
      const px = x - 0.06 + (i % 3) * 0.06;
      const pz = z - 0.04 + Math.floor(i / 3) * 0.08;
      if (kind === 'cuke') g.add(k.at(k.capsule(0.018, 0.12, k.mat(c, { rough: 0.4 })), px, y0 + 0.085, pz, 0, 0.2, Math.PI / 2));
      else g.add(k.at(k.sphere(0.03, k.mat(c, { rough: 0.3 })), px, y0 + 0.09, pz));
    }
  });
  // 드레싱 병 (발사믹 · 올리브오일)
  g.add(k.at(k.cyl(0.025, 0.03, 0.18, k.mat('#2a1410', { opacity: 0.85, rough: 0.1 })), -0.36, y0 + 0.09, -0.28));
  g.add(k.at(k.cyl(0.025, 0.03, 0.17, k.mat('#8a8a2a', { opacity: 0.8, rough: 0.1 })), -0.3, y0 + 0.085, -0.3));
  return g;
}

function counter(k, sw) {
  const g = k.group();
  const w = k.wood(sw.wood);
  g.add(k.at(k.box(1.88, 0.08, 0.74, k.mat('#1e1d1c')), 0, 0.04, -0.02));
  g.add(k.at(k.box(1.94, 0.92, 0.78, w), 0, 0.54, 0));
  for (let i = 0; i < 16; i++) g.add(k.at(k.box(0.085, 0.86, 0.025, k.wood(sw.wood, { seed: 9 + (i % 3) })), -0.9 + i * 0.12, 0.52, 0.4));
  g.add(k.at(k.box(2.0, 0.05, 0.84, k.stone(sw.top)), 0, 1.025, 0.01));
  const y0 = 1.05;
  // POS 태블릿
  g.add(k.at(k.box(0.05, 0.1, 0.05, k.metal('black')), 0.5, y0 + 0.05, -0.08));
  g.add(k.at(k.box(0.26, 0.17, 0.012, k.mat('#1b1b1c', { emissive: '#7fa3b8', ei: 0.25, rough: 0.2 })), 0.5, y0 + 0.16, -0.06, -0.4));
  // 유리 쇼케이스 + 빵
  const cx = -0.45;
  g.add(k.at(k.box(0.7, 0.03, 0.46, k.metal('steel')), cx, y0 + 0.015, 0));
  g.add(k.at(k.box(0.68, 0.34, 0.44, k.glass()), cx, y0 + 0.2, 0));
  g.add(k.at(k.box(0.66, 0.01, 0.42, k.glass()), cx, y0 + 0.2, 0));
  for (let i = 0; i < 4; i++) {
    const t = k.torus(0.04, 0.022, k.mat('#c98a3f', { rough: 0.6 }), { arc: Math.PI * 1.1 });
    g.add(k.at(t, cx - 0.22 + i * 0.15, y0 + 0.055, 0.05, Math.PI / 2, 0, 0.3));
  }
  for (let i = 0; i < 3; i++) {
    g.add(k.at(k.cyl(0.035, 0.03, 0.04, k.mat('#c9b18c', { rough: 0.8 })), cx - 0.18 + i * 0.18, y0 + 0.225, -0.05));
    g.add(k.at(k.sphere(0.04, k.mat(['#5a3622', '#8a5a2e', '#3d2a20'][i], { rough: 0.8 }), { tl: Math.PI / 2 }), cx - 0.18 + i * 0.18, y0 + 0.245, -0.05));
  }
  // Kenney 소품 (토스터 · 블렌더)
  const toaster = k.model('toaster', { height: 0.17, maxW: 0.26, maxD: 0.18 });
  if (toaster) g.add(k.at(toaster, 0.82, y0, -0.18));
  const blender = k.model('kitchenBlender', { height: 0.3, maxW: 0.16, maxD: 0.16 });
  if (blender) g.add(k.at(blender, 0.25, y0, -0.24));
  // 팁 저금통 · 원두 봉투
  g.add(k.at(k.cyl(0.045, 0.045, 0.12, k.glass()), 0.8, y0 + 0.06, 0.18));
  g.add(k.at(k.cyl(0.04, 0.04, 0.035, k.metal('brass')), 0.8, y0 + 0.018, 0.18));
  g.add(k.at(k.rbox(0.1, 0.18, 0.06, k.mat('#8a7259', { rough: 0.95 }), { r: 0.01 }), 0.2, y0 + 0.09, -0.15));
  g.add(k.at(k.rbox(0.1, 0.18, 0.06, k.mat('#2f2f31', { rough: 0.9 }), { r: 0.01 }), 0.08, y0 + 0.09, -0.15));
  return g;
}

// ───────── 장식 ─────────
function pot(k, sw, h = 0.42, r = 0.2) {
  const g = k.group();
  g.add(k.at(k.cyl(r, r * 0.82, h, k.mat(sw.pot, { rough: sw.rough })), 0, h / 2, 0));
  g.add(k.at(k.cyl(r - 0.012, r - 0.012, 0.02, k.mat('#3a2a1f', { rough: 1 })), 0, h - 0.02, 0));
  return g;
}

function monstera(k, sw) {
  const g = pot(k, sw, 0.42, 0.21);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.35;
    const len = 0.4 + (i % 3) * 0.16;
    const pivot = k.group();
    pivot.position.set(0, 0.4, 0);
    pivot.rotation.y = a;
    const arm = k.group();
    arm.rotation.x = 0.4 + (i % 3) * 0.2;
    arm.add(k.at(k.cyl(0.007, 0.01, len, k.mat('#3d5a32')), 0, len / 2, 0));
    arm.add(k.at(k.scl(k.sphere(0.19, k.mat(LEAF[i % 4], { rough: 0.55, side: 'double' })), 0.8, 0.06, 1), 0, len + 0.02, 0.1, -0.55));
    pivot.add(arm);
    g.add(pivot);
  }
  return g;
}

function oliveTree(k, sw) {
  const g = pot(k, sw, 0.45, 0.2);
  g.add(k.at(k.cyl(0.025, 0.04, 0.85, k.mat('#5c4a3a', { rough: 0.95 })), 0, 0.85, 0, 0, 0, 0.05));
  g.add(k.at(k.cyl(0.014, 0.02, 0.38, k.mat('#5c4a3a', { rough: 0.95 })), 0.08, 1.1, 0, 0, 0, -0.6));
  const leaves = ['#6f7d5a', '#7d8a63', '#65744f'];
  [
    [0, 1.42, 0, 0.26],
    [0.2, 1.28, 0.08, 0.2],
    [-0.18, 1.32, -0.05, 0.21],
    [0.05, 1.62, -0.05, 0.19],
    [0.13, 1.47, -0.17, 0.17],
    [-0.08, 1.5, 0.16, 0.17],
  ].forEach(([x, y, z, r], i) => g.add(k.at(k.sphere(r, k.mat(leaves[i % 3], { rough: 0.85 }), { ws: 14, hs: 10 }), x, y, z)));
  return g;
}

function fiddleFig(k, sw) {
  const g = pot(k, sw, 0.4, 0.18);
  g.add(k.at(k.cyl(0.018, 0.025, 1.3, k.mat('#5c4a3a', { rough: 0.95 })), 0, 1.0, 0));
  for (let i = 0; i < 14; i++) {
    const y = 0.75 + i * 0.065;
    const a = i * 2.4;
    const leaf = k.scl(k.sphere(0.11, k.mat(LEAF[i % 4], { rough: 0.4, side: 'double' })), 0.8, 0.08, 1.15);
    g.add(k.at(leaf, Math.cos(a) * 0.12, y, Math.sin(a) * 0.12, 0.5 * Math.sin(a), -a, 0.5 * Math.cos(a)));
  }
  return g;
}

function shelf(k, sw) {
  const g = k.group();
  const m = k.metal(sw.metal);
  const z = -0.22;
  for (const x of [-0.43, 0.43]) for (const dz of [-0.14, 0.14]) g.add(k.at(k.box(0.025, 1.8, 0.025, m), x, 0.9, z + dz));
  const ys = [0.08, 0.5, 0.92, 1.34, 1.76];
  ys.forEach((y) => g.add(k.at(k.box(0.9, 0.03, 0.32, k.wood(sw.wood)), 0, y, z)));
  const books = ['#6b4f3a', '#3e4a5a', '#7a5b45', '#a39a87', '#5a3b3b', '#2f3b33', '#c2b8a3', '#46403a'];
  for (let s = 0; s < 3; s++) {
    let x = -0.4;
    let n = 0;
    while (x < 0.38 - (s === 1 ? 0.3 : 0)) {
      const bw = 0.035 + ((n * 37 + s * 11) % 4) * 0.01;
      const bh = 0.2 + ((n * 53 + s * 7) % 5) * 0.025;
      g.add(k.at(k.box(bw, bh, 0.22, k.mat(books[(n + s * 3) % books.length], { rough: 0.85 })), x + bw / 2, ys[s] + 0.015 + bh / 2, z, 0, 0, n % 7 === 6 ? 0.12 : 0));
      x += bw + 0.006;
      n++;
    }
  }
  g.add(k.at(k.cyl(0.06, 0.05, 0.14, k.glass()), 0.25, ys[1] + 0.085, z));
  g.add(k.at(k.cyl(0.05, 0.045, 0.08, k.mat('#3c2416', { rough: 0.7 })), 0.25, ys[1] + 0.055, z));
  g.add(k.at(k.cyl(0.06, 0.05, 0.1, k.mat('#98958f', { rough: 0.9 })), -0.2, ys[3] + 0.065, z));
  for (let i = 0; i < 6; i++) g.add(k.at(k.scl(k.sphere(0.05, k.mat(LEAF[i % 4], { rough: 0.8 })), 1, 0.7, 1), -0.2 + Math.cos(i) * 0.05, ys[3] + 0.18, z + Math.sin(i) * 0.04));
  ['#e9e4da', '#2e2e30', '#b9a68e'].forEach((c, i) => g.add(k.at(k.cyl(0.035, 0.03, 0.07, k.ceramic(c)), 0.05 + i * 0.1, ys[3] + 0.05, z)));
  const radio = k.model('radio', { height: 0.2, maxW: 0.3, maxD: 0.2, sw: { wood: sw.wood } });
  if (radio) g.add(k.at(radio, 0.18, ys[2] + 0.015, z));
  return g;
}

// ───────── Kenney 3D 모델 기반 가구 (모델이 없으면 절차적 모델로 대체) ─────────
function kenney(name, opts, fallback) {
  return (k, sw) => k.model(name, { ...opts, sw }) ?? fallback(k, sw);
}
const KENNEY_TABLE_SW = [
  { name: '오크', wood: 'oak', metal: 'black', chip: chip('oak', 'black') },
  { name: '월넛', wood: 'walnut', metal: 'black', chip: chip('walnut', 'black') },
  { name: '라이트 오크', wood: 'lightoak', metal: 'steel', chip: chip('lightoak', 'steel') },
  { name: '에보니', wood: 'ebony', metal: 'brass', chip: chip('ebony', 'brass') },
];
const SOFA_SW = [
  { name: '모카 패브릭 & 오크', fabric: '#6b4f3a', wood: 'oak', chip: ['#6b4f3a', WOOD.oak] },
  { name: '올리브 패브릭 & 월넛', fabric: '#545a3c', wood: 'walnut', chip: ['#545a3c', WOOD.walnut] },
  { name: '차콜 패브릭 & 에보니', fabric: '#3a3836', wood: 'ebony', chip: ['#3a3836', WOOD.ebony] },
  { name: '오트밀 부클레 & 라이트 오크', fabric: '#d9d0bf', wood: 'lightoak', chip: ['#d9d0bf', WOOD.lightoak] },
];
const KPOT_SW = [
  { name: '테라코타', wood: '#9e5a3c', wood2: '#7a4430', chip: ['#9e5a3c', '#3f6a3c'] },
  { name: '콘크리트', wood: '#98958f', wood2: '#77746f', chip: ['#98958f', '#3f6a3c'] },
  { name: '매트 블랙', wood: '#2a2a2b', wood2: '#1d1d1e', chip: ['#2a2a2b', '#3f6a3c'] },
  { name: '화이트', wood: '#e7e3dc', wood2: '#cfcac2', chip: ['#e7e3dc', '#3f6a3c'] },
];
export const kenneyFurniture = [
  { id: 'k_table_round', name: '오크 라운드 테이블 (Kenney)', category: 'table', table: true, surfaceHeight: 0.75, price: 46000, swatches: KENNEY_TABLE_SW, build: kenney('tableRound', { height: 0.75, maxW: 0.9, maxD: 0.9 }, roundTable), menuHeight: 1.1 },
  { id: 'k_table', name: '오크 다이닝 테이블 (Kenney)', category: 'table', table: true, surfaceHeight: 0.75, price: 44000, swatches: KENNEY_TABLE_SW, build: kenney('table', { height: 0.75, maxW: 0.92, maxD: 0.92 }, squareTable), menuHeight: 1.1 },
  { id: 'k_sofa', name: '라운지 소파 (Kenney)', category: 'decor', size: [2, 1], decor: 2, price: 68000, swatches: SOFA_SW, build: kenney('loungeSofa', { height: 0.8, maxW: 1.9, maxD: 0.9 }, armchair), menuHeight: 1.2 },
  { id: 'k_lounge_chair', name: '라운지 체어 (Kenney)', category: 'decor', decor: 1, price: 36000, swatches: SOFA_SW, build: kenney('loungeChair', { height: 0.8, maxW: 0.9, maxD: 0.9 }, armchair), menuHeight: 1.2 },
  { id: 'k_plant', name: '대형 화분 (Kenney)', category: 'decor', decor: 3, price: 20000, swatches: KPOT_SW, build: kenney('pottedPlant', { height: 1.15, maxW: 0.7, maxD: 0.7 }, monstera), menuHeight: 1.5 },
  { id: 'k_plant_small', name: '미니 화분 (Kenney)', category: 'decor', decor: 1, price: 9000, swatches: KPOT_SW, build: kenney('plantSmall2', { height: 0.55, maxW: 0.5, maxD: 0.5 }, monstera), menuHeight: 0.9 },
  { id: 'k_coffee_table', name: '로우 커피 테이블 (Kenney)', category: 'decor', decor: 1, price: 30000, swatches: KENNEY_TABLE_SW, build: kenney('tableCoffee', { height: 0.42, maxW: 0.9, maxD: 0.9 }, squareTable), menuHeight: 0.9 },
];

function floorLamp(k, sw) {
  const g = k.group();
  const legs = sw.metal ? k.metal(sw.metal) : k.wood(sw.wood);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(k.at(k.cyl(0.012, 0.016, 1.45, legs), Math.cos(a) * 0.1, 0.72, Math.sin(a) * 0.1, Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14));
  }
  const shade = k.cyl(0.17, 0.2, 0.28, k.mat('#e6dccb', { emissive: '#ffb46b', ei: 0.1, rough: 0.95, side: 'double' }), { open: true, seg: 28 });
  shade.material = shade.material.clone();
  shade.userData.glow = true;
  g.add(k.at(shade, 0, 1.52, 0));
  g.add(k.at(k.sphere(0.045, k.glow('#ffd4a0', 1.5)), 0, 1.45, 0));
  const l = k.lamp('#ffb46b', 1.6, 6.5);
  l.position.set(0, 1.42, 0);
  g.add(l);
  return g;
}

// LP 턴테이블 (낮은 월넛 레코드장 위). 플래터와 톤암은 무드에 맞춰 돌아간다.
function rug(k, sw) {
  const g = k.group();
  g.add(k.at(k.box(2.8, 0.014, 1.8, k.fabric(sw.border)), 0, 0.008, 0));
  g.add(k.at(k.box(2.56, 0.016, 1.56, k.fabric(sw.field)), 0, 0.009, 0));
  g.add(k.at(k.box(2.2, 0.017, 1.2, k.fabric(sw.border)), 0, 0.0095, 0));
  g.add(k.at(k.box(2.1, 0.018, 1.1, k.fabric(sw.field)), 0, 0.01, 0));
  for (const s of [-1, 1]) for (let i = 0; i < 18; i++) g.add(k.at(k.box(0.012, 0.006, 0.07, k.fabric('#d9d0bf')), -1.36 + i * 0.16, 0.004, s * 0.93));
  return g;
}

// A형 칠판 입간판: 위쪽 경첩에서 두 판이 아래로 벌어지는 A자 (예전엔 아래가 붙고 위가 벌어진 V자로 뒤집혀 있었다)
function aBoard(k, sw) {
  const g = k.group();
  const H = 1.0;
  const tilt = 0.2;
  for (const s of [-1, 1]) {
    const leg = k.group();
    leg.position.set(0, H, 0);
    leg.rotation.x = -s * tilt; // 아래쪽이 앞(+z)/뒤(-z)로 벌어진다
    leg.add(k.at(k.box(0.62, H, 0.03, k.wood(sw.wood)), 0, -H / 2, s * 0.018));
    const face = k.label(['OGGI', 'Tagliarini', 'Margherita', 'Insalata'], 0.5, 0.78, { bg: '#262b28' });
    face.position.set(0, -H / 2 + 0.02, s * 0.0345);
    if (s < 0) face.rotation.y = Math.PI;
    leg.add(face);
    g.add(leg);
  }
  // 위쪽 경첩
  g.add(k.at(k.cyl(0.012, 0.012, 0.64, k.metal('black')), 0, H + 0.004, 0, 0, 0, Math.PI / 2));
  return g;
}


// ───────── v12 통합 마스터 조리대 (5칸) ─────────
// 왼쪽부터 에스프레소 머신 · 원목 도마 · 생면 파스타 스토브 · 가든 샐러드 바트 · 나폴리 화덕.
// 아직 해금하지 않은 칸은 'Prossimamente' 명패만 놓인 빈 상판으로 보인다 (해금하면 실제 장비가 들어온다).
function masterCounter(k, sw) {
  const g = k.group();
  const W = 4.9;
  const D = 0.8;
  const h = 0.88;
  const wood = k.wood(sw.wood);
  const zc = -0.08;
  // 하나로 이어진 캐비닛 + 상판 + 걸레받이
  g.add(k.at(k.box(W - 0.06, 0.08, D - 0.04, k.mat('#1e1d1c')), 0, 0.04, zc - 0.02));
  g.add(k.at(k.box(W, h - 0.08, D, wood), 0, 0.08 + (h - 0.08) / 2, zc));
  for (let i = 0; i < 10; i++) {
    const x = -W / 2 + 0.245 + i * 0.49;
    g.add(k.at(k.box(0.45, h - 0.22, 0.02, wood), x, 0.08 + (h - 0.08) / 2 - 0.02, zc + D / 2 + 0.005));
    g.add(k.at(k.box(0.14, 0.012, 0.02, k.metal('brass')), x, h - 0.16, zc + D / 2 + 0.02));
  }
  g.add(k.at(k.box(W + 0.04, 0.05, D + 0.04, k.stone(sw.top)), 0, h + 0.025, zc + 0.01));
  const y0 = h + 0.05;
  const P = getProgress();
  const on = (id) => !P || P.unlocked(id);
  const slot = (i) => -2 + i; // 칸 중심 x
  const soon = (x, name, price) => {
    const tray = k.group(k.at(k.rbox(0.5, 0.02, 0.32, k.wood('oak'), { r: 0.008 }), 0, 0.01, 0));
    const plate = k.label(['Prossimamente', `${name} · ${price.toLocaleString('ko-KR')}원`], 0.42, 0.16, { bg: '#f7f1e5', fg: '#2b1d14', font: 'Gowun Batang' });
    tray.add(k.at(plate, 0, 0.12, -0.04, -0.25));
    tray.add(k.at(k.box(0.02, 0.18, 0.02, k.wood('walnut')), 0, 0.09, -0.08));
    tray.position.set(x, y0, zc + 0.05);
    g.add(tray);
  };

  // 0) 에스프레소 머신 + 그라인더
  {
    const m = buildEspressoMachine({ body: sw.machine, w: 0.56, d: 0.42 });
    m.root.position.set(slot(0) - 0.08, y0, zc - 0.08);
    g.add(m.root);
    const gr = buildGrinder({ body: 'black' });
    gr.position.set(slot(0) + 0.38, y0, zc - 0.08);
    g.add(gr);
  }
  // 1) 원목 도마 + 사워도우 + 빵칼 + 재료 밧드
  {
    const x = slot(1);
    g.add(k.at(k.rbox(0.46, 0.035, 0.3, k.wood('walnut'), { r: 0.01 }), x - 0.08, y0 + 0.018, zc + 0.12));
    g.add(k.at(briocheLoaf({ len: 0.18, w: 0.11, h: 0.1, color: '#9c5f2a' }), x - 0.16, y0 + 0.035, zc + 0.1));
    g.add(k.at(k.box(0.24, 0.002, 0.022, k.metal('chrome')), x - 0.04, y0 + 0.037, zc + 0.24, 0, 0.3, 0));
    [['#c8402f', -0.2], ['#7fae4e', -0.05], ['#a8452f', 0.1]].forEach(([c, bx]) => {
      g.add(k.at(k.box(0.13, 0.05, 0.12, k.metal('steel')), x + bx, y0 + 0.025, zc - 0.22));
      for (let i = 0; i < 4; i++) g.add(k.at(k.scl(k.sphere(0.03, k.mat(c, { rough: 0.6 })), 1, 0.45, 1), x + bx - 0.03 + (i % 2) * 0.06, y0 + 0.05, zc - 0.24 + Math.floor(i / 2) * 0.05));
    });
    g.add(k.at(k.rbox(0.26, 0.06, 0.22, k.metal('black'), { r: 0.015 }), x + 0.3, y0 + 0.03, zc - 0.05));
  }
  // 2) 생면 파스타 키친: 가스 화구 2구 + 팬 + 황동 제면기 + 건조대
  if (on('pasta')) {
    const x = slot(2);
    g.add(k.at(k.box(0.9, 0.012, 0.5, k.stone('#2f2f31')), x, y0 + 0.006, zc - 0.05));
    for (const [bx, bz] of [[0.2, -0.12], [-0.18, -0.12]]) {
      g.add(k.at(k.cyl(0.085, 0.085, 0.012, k.metal('black')), x + bx, y0 + 0.012, zc + bz));
      for (let i = 0; i < 4; i++) g.add(k.at(k.box(0.14, 0.012, 0.012, k.metal('black')), x + bx, y0 + 0.024, zc + bz, 0, (i * Math.PI) / 4, 0));
      for (let i = 0; i < 9; i++) g.add(k.at(k.cone(0.008, 0.02, k.glow('#4f8cff', 1.6)), x + bx + Math.cos(i * 0.7) * 0.042, y0 + 0.026, zc + bz + Math.sin(i * 0.7) * 0.042));
    }
    const pan = k.group(k.at(k.cyl(0.12, 0.1, 0.045, k.metal('black'), { seg: 32 }), 0, 0.022, 0), k.at(k.cyl(0.108, 0.108, 0.004, k.mat('#e9d6a0', { rough: 0.35 })), 0, 0.035, 0), k.at(k.rbox(0.2, 0.018, 0.03, k.wood('walnut'), { r: 0.008 }), 0.2, 0.04, 0.05, 0, -0.35, 0.12));
    g.add(k.at(pan, x + 0.2, y0 + 0.03, zc - 0.12));
    g.add(k.at(k.cyl(0.1, 0.1, 0.15, k.metal('steel'), { seg: 24, open: true }), x - 0.18, y0 + 0.1, zc - 0.12));
    // 황동 제면기 (롤러 + 크랭크)
    const brass = k.metal('brass');
    const pm = k.group();
    pm.add(k.at(k.rbox(0.16, 0.1, 0.12, brass, { r: 0.012 }), 0, 0.07, 0));
    pm.add(k.at(k.cyl(0.018, 0.018, 0.17, k.metal('chrome')), 0, 0.1, 0.0, 0, 0, Math.PI / 2));
    pm.add(k.at(k.box(0.012, 0.09, 0.012, brass), 0.1, 0.12, 0.0));
    pm.add(k.at(k.cyl(0.012, 0.012, 0.05, k.wood('walnut')), 0.12, 0.17, 0.02, Math.PI / 2));
    pm.add(k.at(k.box(0.13, 0.002, 0.05, k.mat('#f0d27a', { rough: 0.6 })), 0, 0.02, 0.09, -0.3));
    g.add(k.at(pm, x - 0.05, y0, zc + 0.2));
    // 건조대
    g.add(k.at(k.cyl(0.008, 0.008, 0.34, wood), x + 0.38, y0 + 0.17, zc + 0.2));
    const arm = k.group();
    arm.position.set(x + 0.38, y0 + 0.32, zc + 0.2);
    arm.add(k.at(k.cyl(0.005, 0.005, 0.22, wood), 0, 0, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 6; i++) arm.add(k.at(k.box(0.006, 0.15, 0.002, k.mat('#efd27a', { rough: 0.6 })), -0.09 + i * 0.035, -0.075, 0));
    g.add(arm);
  } else soon(slot(2), '생면 파스타 키친', 45000);
  // 3) 가든 샐러드 & 프렙 바: 신선 채소 바트 4칸 + 원목 볼
  if (on('salad')) {
    const x = slot(3);
    const greens = [['#6f9e3c', '#8fbf52'], ['#c8321f', '#e0583c'], ['#355f2a', '#dcebb4'], ['#8a3f5a', '#7aa84a']];
    greens.forEach(([c1, c2], i) => {
      const bx = x - 0.33 + (i % 2) * 0.17;
      const bz = zc - 0.2 + Math.floor(i / 2) * 0.17;
      g.add(k.at(k.box(0.15, 0.06, 0.15, k.metal('steel')), bx, y0 + 0.03, bz));
      for (let j = 0; j < 5; j++) g.add(k.at(k.scl(k.sphere(0.028, k.mat(j % 2 ? c1 : c2, { rough: 0.6 })), 1, 0.5, 1), bx + Math.cos(j * 1.3) * 0.04, y0 + 0.06, bz + Math.sin(j * 1.3) * 0.04));
    });
    g.add(k.at(k.cyl(0.19, 0.11, 0.1, k.wood('walnut'), { seg: 32, open: true }), x + 0.18, y0 + 0.05, zc + 0.08));
    for (let j = 0; j < 9; j++) g.add(k.at(k.scl(k.sphere(0.04, k.mat(j % 3 ? '#6f9e3c' : '#a9cf6a', { rough: 0.6 })), 1, 0.45, 1), x + 0.18 + Math.cos(j) * 0.08, y0 + 0.09, zc + 0.08 + Math.sin(j) * 0.08));
    g.add(k.at(k.cyl(0.024, 0.028, 0.15, k.mat('#2a1410', { opacity: 0.85, rough: 0.1 })), x + 0.4, y0 + 0.075, zc - 0.2));
  } else soon(slot(3), '가든 샐러드 바', 60000);
  // 4) 정통 나폴리 장작 화덕 (상판 오른쪽 끝 돌 받침 위)
  if (on('pizza')) {
    const x = slot(4);
    g.add(k.at(k.rbox(0.9, 0.06, 0.74, k.stone('#9a8f80'), { r: 0.02 }), x, y0 + 0.03, zc - 0.02));
    const oven = buildForno({ R: 0.3, mouthW: 0.26, mouthH: 0.17, detail: 'shop' });
    oven.position.set(x, y0 + 0.06, zc - 0.12);
    g.add(oven);
    const peel = k.group(k.at(k.cyl(0.11, 0.11, 0.006, k.metal('steel'), { seg: 24 }), 0, 0, 0, Math.PI / 2), k.at(k.cyl(0.011, 0.011, 0.55, k.wood('walnut')), 0, -0.36, 0));
    g.add(k.at(peel, x + 0.47, 0.62, zc + 0.36, 0, 0, -0.1));
  } else soon(slot(4), '나폴리 장작 화덕', 90000);
  return g;
}

// v12 테이블 & 체어 세트용 변형
function velvetChair(k, sw) {
  return armchair(k, { fabric: sw.fabric ?? '#7a2e3a', wood: sw.wood ?? 'ebony' });
}
function rattanChair(k, sw) {
  const g = bentwoodChair(k, { wood: sw.wood ?? 'lightoak', cushion: sw.cushion ?? '#6b7a3a' });
  // 라탄 등받이 결 (가는 가로 줄)
  for (let i = 0; i < 6; i++) g.add(k.at(k.box(0.28, 0.008, 0.012, k.mat('#c9a774', { rough: 0.9 })), 0, 0.55 + i * 0.05, -0.1));
  return g;
}


// ───────── v13 패스 카운터 (주방 - 식사 홀 경계, 5칸) ─────────
// 홀 쪽은 원목 슬랫 앞판, 위는 대리석 상판 + 유리 가드 · 메뉴 보드, 주방 쪽엔 프렙 도마와 샐러드 바트.
// 오른쪽 끝 바깥 1칸은 셰프가 드나드는 주방 통로(아치).
function passCounter(k, sw) {
  const g = k.group();
  const W = 4.9;
  const D = 0.56;
  const H = 1.0;
  const z0 = -0.12;
  const wood = k.wood(sw.wood);
  const dark = k.wood('walnut');
  g.add(k.at(k.box(W - 0.06, 0.08, D - 0.06, k.mat('#1e1d1c')), 0, 0.04, z0));
  g.add(k.at(k.box(W, H - 0.08, D, wood), 0, 0.08 + (H - 0.08) / 2, z0));
  // 홀 쪽 세로 슬랫
  for (let i = 0; i < 40; i++) g.add(k.at(k.box(0.07, H - 0.2, 0.025, i % 2 ? wood : dark), -W / 2 + 0.06 + i * 0.122, 0.08 + (H - 0.2) / 2, z0 + D / 2 + 0.01));
  g.add(k.at(k.box(W, 0.05, 0.03, k.metal('brass')), 0, 0.14, z0 + D / 2 + 0.03));
  // 대리석 상판
  g.add(k.at(k.box(W + 0.06, 0.05, D + 0.08, k.stone(sw.top ?? '#e8e3da')), 0, H + 0.025, z0));
  // 유리 가드 (스니즈 가드) + 황동 기둥
  const glass = k.glass();
  for (let i = 0; i < 4; i++) {
    const x = -1.8 + i * 1.2;
    g.add(k.at(k.cyl(0.012, 0.012, 0.34, k.metal('brass')), x - 0.55, H + 0.22, z0 - 0.05));
    g.add(k.at(k.box(1.08, 0.3, 0.012, glass), x, H + 0.22, z0 - 0.05));
  }
  g.add(k.at(k.cyl(0.012, 0.012, 0.34, k.metal('brass')), 2.25, H + 0.22, z0 - 0.05));
  // 상판 위: 빵 바구니 · 페이스트리 돔 · 메뉴 보드
  g.add(k.at(k.rbox(0.36, 0.1, 0.24, k.mat('#8a6a48', { rough: 0.95 }), { r: 0.03 }), -2.0, H + 0.1, z0 + 0.12));
  g.add(k.at(briocheLoaf({ len: 0.22, w: 0.1, h: 0.09 }), -2.0, H + 0.13, z0 + 0.12, 0, 0.2, 0));
  g.add(k.at(k.cyl(0.13, 0.15, 0.02, k.wood('walnut')), -1.2, H + 0.06, z0 + 0.14));
  g.add(k.at(k.sphere(0.13, glass, { tl: Math.PI / 2 }), -1.2, H + 0.07, z0 + 0.14));
  for (let i = 0; i < 4; i++) g.add(k.at(k.scl(k.sphere(0.035, k.mat(i % 2 ? '#c9863e' : '#e0b070', { rough: 0.6 })), 1, 0.6, 1), -1.25 + (i % 2) * 0.07, H + 0.1, z0 + 0.12 + Math.floor(i / 2) * 0.06));
  const board = k.label(['Oggi', 'Pasta · Pizza', 'Caffè'], 0.5, 0.36, { bg: '#262b28' });
  const frame = k.group(k.at(k.box(0.56, 0.42, 0.03, dark), 0, 0, 0), k.at(board, 0, 0, 0.018));
  frame.position.set(1.4, H + 0.33, z0 + 0.1);
  frame.rotation.x = -0.18;
  g.add(frame);
  g.add(k.at(k.box(0.03, 0.12, 0.12, dark), 1.4, H + 0.08, z0 + 0.05));
  // 주방 쪽: 프렙 도마 + 허브 + 샐러드 바트
  g.add(k.at(k.rbox(0.44, 0.03, 0.26, k.wood('oak'), { r: 0.008 }), 0.2, H + 0.065, z0 - 0.15));
  for (let i = 0; i < 6; i++) g.add(k.at(k.scl(k.sphere(0.02, k.mat('#3f7f2a', { rough: 0.6 })), 1, 0.5, 1.4), 0.12 + i * 0.03, H + 0.09, z0 - 0.16));
  [['#6f9e3c', '#a9cf6a'], ['#c8321f', '#e0583c'], ['#e9dcc0', '#f3eee4']].forEach(([c1, c2], i) => {
    const bx = 0.75 + i * 0.17;
    g.add(k.at(k.box(0.15, 0.06, 0.15, k.metal('steel')), bx, H + 0.08, z0 - 0.16));
    for (let j = 0; j < 4; j++) g.add(k.at(k.scl(k.sphere(0.026, k.mat(j % 2 ? c1 : c2, { rough: 0.6 })), 1, 0.5, 1), bx + Math.cos(j * 1.6) * 0.035, H + 0.11, z0 - 0.16 + Math.sin(j * 1.6) * 0.035));
  });
  // 주방 통로 아치 (오른쪽 바깥 칸, 로컬 x = +3.0)
  const ax = 3.0;
  for (const s of [-1, 1]) g.add(k.at(k.box(0.08, 2.1, 0.12, dark), ax + s * 0.46, 1.05, z0));
  g.add(k.at(k.box(1.0, 0.12, 0.14, dark), ax, 2.12, z0));
  const sign = k.label(['Cucina'], 0.46, 0.13, { bg: '#2b1d14', fg: '#e9c98a', font: 'Playfair Display' });
  g.add(k.at(sign, ax, 2.12, z0 + 0.075));
  return g;
}

export const furniture = [
  { id: 's1_table_round', name: '월넛 원형 테이블', category: 'table', table: true, surfaceHeight: 0.755, price: 48000, swatches: TABLE_SW, build: roundTable, menuHeight: 1.1 },
  { id: 's1_table_square', name: '스틸 프레임 스퀘어 테이블', category: 'table', table: true, surfaceHeight: 0.755, price: 42000, swatches: TABLE_SW, build: squareTable, menuHeight: 1.1 },
  { id: 's1_table_long', name: '커뮤널 롱 테이블', category: 'table', table: true, surfaceHeight: 0.76, size: [2, 1], price: 78000, swatches: TABLE_SW, build: longTable, menuHeight: 1.1 },
  { id: 's1_chair_bentwood', name: '벤트우드 체어', category: 'seat', seat: true, seatHeight: 0.49, price: 26000, swatches: BENTWOOD_SW, build: bentwoodChair, menuHeight: 1.2 },
  { id: 's1_chair_metal', name: '인더스트리얼 메탈 체어', category: 'seat', seat: true, seatHeight: 0.47, price: 22000, swatches: METALCHAIR_SW, build: metalChair, menuHeight: 1.2 },
  { id: 's1_armchair', name: '가죽 라운지 체어', category: 'seat', seat: true, seatHeight: 0.42, price: 52000, decor: 1, swatches: LEATHER_SW, build: armchair, menuHeight: 1.1 },
  { id: 's1_pass', name: '패스 카운터 & 주방 통로', category: 'counter', counter: true, size: [5, 1], price: 0, swatches: [{ name: '라이트 오크 & 대리석', wood: 'lightoak', top: '#e8e3da', chip: chip('lightoak', '#e8e3da') }], build: passCounter, menuHeight: 1.6 },
  // v12 통합 마스터 조리대 (모든 메뉴를 여기 한 곳에서)
  { id: 's1_master', name: '통합 마스터 조리대', category: 'station', station: 'master', size: [5, 1], price: 0, swatches: [{ name: '라이트 오크 & 민트', wood: 'lightoak', machine: 'mint', top: '#ece7df', chip: chip('lightoak', 'mint') }], build: masterCounter, menuHeight: 1.8 },
  { id: 'v12_chair_velvet', name: '벨벳 라운지 체어', category: 'seat', seat: true, seatHeight: 0.42, price: 0, decor: 1, swatches: [{ name: '버건디 벨벳 & 브라스', fabric: '#7a2e3a', wood: 'ebony', chip: ['#7a2e3a', '#c9a24a'] }], build: velvetChair, menuHeight: 1.1 },
  { id: 'v12_chair_rattan', name: '올리브 라탄 체어', category: 'seat', seat: true, seatHeight: 0.49, price: 0, swatches: [{ name: '라탄 & 올리브', wood: 'lightoak', cushion: '#6b7a3a', chip: ['#c9a774', '#6b7a3a'] }], build: rattanChair, menuHeight: 1.2 },
  { id: 'v12_table_marble', name: '마블 & 골드 원형 테이블', category: 'table', table: true, surfaceHeight: 0.755, price: 0, swatches: [{ name: '에보니 & 브라스', wood: 'ebony', metal: 'brass', chip: chip('ebony', 'brass') }], build: roundTable, menuHeight: 1.1 },
  { id: 'v12_table_garden', name: '가든 라탄 테이블', category: 'table', table: true, surfaceHeight: 0.755, price: 0, swatches: [{ name: '라이트 오크 & 블랙', wood: 'lightoak', metal: 'black', chip: chip('lightoak', 'black') }], build: squareTable, menuHeight: 1.1 },
  { id: 's1_espresso', name: '에스프레소 바', category: 'station', station: 'espresso', price: 180000, swatches: STATION_SW, build: espressoStation, menuHeight: 1.7 },
  { id: 's1_sandwich', name: '샌드위치 프렙 스테이션', category: 'station', station: 'sandwich', price: 150000, swatches: PREP_SW, build: sandwichStation, menuHeight: 1.6 },
  { id: 's1_pasta', name: '생면 파스타 스토브', category: 'station', station: 'pasta', price: 170000, swatches: PREP_SW, build: pastaStation, menuHeight: 1.6 },
  {
    id: 's1_pizza',
    name: '장작 화덕 피자 오븐',
    category: 'station',
    station: 'pizza',
    price: 220000,
    decor: 2,
    menuHeight: 1.9,
    swatches: [
      { name: '화이트 돔 & 자연석', dome: '#f1ebe1', base: '#8f8679', top: '#e7e1d6', chip: ['#f1ebe1', '#8f8679'] },
      { name: '테라코타 돔 & 차콜', dome: '#c27a55', base: '#3a3634', top: '#d4cec4', chip: ['#c27a55', '#3a3634'] },
      { name: '세이지 돔 & 라이트 스톤', dome: '#a9b89a', base: '#b8ad9c', top: '#efe9df', chip: ['#a9b89a', '#b8ad9c'] },
    ],
    build: pizzaStation,
  },
  { id: 's1_salad', name: '가든 샐러드 바', category: 'station', station: 'salad', price: 140000, swatches: PREP_SW, build: saladStation, menuHeight: 1.5 },
  { id: 's1_counter', name: '카운터 & 페이스트리 쇼케이스', category: 'counter', counter: true, size: [2, 1], price: 120000, decor: 1, swatches: COUNTER_SW, build: counter, menuHeight: 1.7 },
  { id: 's1_plant_monstera', name: '몬스테라', category: 'decor', price: 18000, decor: 3, swatches: POT_SW, build: monstera, menuHeight: 1.5 },
  { id: 's1_plant_olive', name: '올리브 나무', category: 'decor', price: 24000, decor: 3, swatches: POT_SW, build: oliveTree, menuHeight: 2 },
  { id: 's1_plant_fig', name: '떡갈고무나무', category: 'decor', price: 26000, decor: 3, swatches: POT_SW, build: fiddleFig, menuHeight: 2 },
  { id: 's1_shelf', name: '철제 오픈 선반', category: 'decor', price: 48000, decor: 2, swatches: TABLE_SW, build: shelf, menuHeight: 2.1 },
  {
    id: 's1_floor_lamp',
    name: '린넨 플로어 램프',
    category: 'decor',
    price: 28000,
    decor: 2,
    menuHeight: 2,
    swatches: [
      { name: '오크 삼각대', wood: 'oak', chip: [WOOD.oak, '#e6dccb'] },
      { name: '월넛 삼각대', wood: 'walnut', chip: [WOOD.walnut, '#e6dccb'] },
      { name: '매트 블랙', metal: 'black', chip: [METAL.black.c, '#e6dccb'] },
      { name: '브라스', metal: 'brass', chip: [METAL.brass.c, '#e6dccb'] },
    ],
    build: floorLamp,
  },
  {
    id: 's1_rug',
    name: '울 러그',
    category: 'decor',
    layer: 'floor',
    size: [3, 2],
    price: 32000,
    decor: 2,
    menuHeight: 0.6,
    swatches: [
      { name: '러스트', border: '#7a3f2c', field: '#b8876a', chip: ['#7a3f2c', '#b8876a'] },
      { name: '세이지 그레이', border: '#5e6656', field: '#a3a897', chip: ['#5e6656', '#a3a897'] },
      { name: '차콜', border: '#2e2e30', field: '#6a6866', chip: ['#2e2e30', '#6a6866'] },
      { name: '베이지', border: '#8a7a64', field: '#d3c7b2', chip: ['#8a7a64', '#d3c7b2'] },
    ],
    build: rug,
  },
  { id: 's1_aboard', name: 'A형 칠판 입간판', category: 'decor', price: 12000, decor: 1, swatches: TABLE_SW, build: aBoard, menuHeight: 1.4 },
];

export const finishes = {
  wall: [
    { id: 's1_wall_sage', name: '크림 + 세이지 웨인스코팅', rough: 0.8, texture: { pattern: 'wainscot', painted: true, colors: ['#f4ede2', '#98ab88', '#f7f2ea'], fullHeight: true } },
    { id: 's1_wall_oak_wainscot', name: '크림 + 라이트 오크 웨인스코팅', rough: 0.75, texture: { pattern: 'wainscot', colors: ['#f4ede2', '#d2a874', '#efe5d6'], fullHeight: true } },
    { id: 's1_wall_brick', name: '노출 적벽돌', rough: 0.9, texture: { pattern: 'brick', colors: ['#7f4331', '#6e3a2b', '#8b4d39', '#5f3326'], mortar: '#a89d90', tileMeters: 1 } },
    { id: 's1_wall_plaster', name: '웜그레이 회벽', rough: 0.92, texture: { pattern: 'plaster', colors: ['#aaa196', '#9c9388', '#b6aea3', '#a39a8f'], tileMeters: 2 } },
    { id: 's1_wall_subway', name: '화이트 서브웨이 타일', rough: 0.25, texture: { pattern: 'subway', colors: ['#e6e2db', '#bdb7ae'], tileMeters: 0.6 } },
    { id: 's1_wall_wainscot', name: '월넛 웨인스코팅', rough: 0.7, texture: { pattern: 'wainscot', colors: ['#a9a094', '#4a3122', '#2f1f15'], fullHeight: true } },
    { id: 'v12_wall_terracotta', name: '토스카나 테라코타 브릭', rough: 0.9, texture: { pattern: 'brick', colors: ['#b8603e', '#a9532f', '#c4704a', '#9e4b2c'], mortar: '#e3cdb3', tileMeters: 1 } },
    { id: 'v12_wall_amalfi', name: '아말피 레몬 타일', rough: 0.25, texture: { pattern: 'subway', colors: ['#f2d45c', '#f7f2e2'], tileMeters: 0.6 } },
    { id: 'v12_wall_milano', name: '밀라노 다크 월넛', rough: 0.7, texture: { pattern: 'wainscot', colors: ['#d9c7a8', '#4a3122', '#2f1f15'], fullHeight: true } },
  ],
  floor: [
    { id: 's1_floor_honey', name: '허니 오크 헤링본', rough: 0.5, texture: { pattern: 'herringbone', colors: ['#c98a4b', '#bb7d42', '#d39a5c', '#c4874a'], tileMeters: 3 } },
    { id: 's1_floor_tile', name: '웜그레이 세라믹 타일', rough: 0.35, texture: { pattern: 'ceramic', colors: ['#8f877c', '#968e83', '#8a8277'], grout: '#6a645c', tileMeters: 1.2 } },
    { id: 's1_floor_herringbone', name: '다크 오크 헤링본', rough: 0.55, texture: { pattern: 'herringbone', colors: ['#6b4a31', '#5c3f2a', '#7a5638', '#634530'], tileMeters: 3 } },
    { id: 's1_floor_terrazzo', name: '테라조', rough: 0.3, texture: { pattern: 'terrazzo', colors: ['#b9b2a6', '#7e776c', '#5a5047', '#a5765e', '#dcd6cb'], tileMeters: 2 } },
    { id: 's1_floor_concrete', name: '폴리싱 콘크리트', rough: 0.4, texture: { pattern: 'concrete', colors: ['#8e8b86', '#9a9792', '#83807b'], tileMeters: 3 } },
    { id: 'v12_floor_sicily', name: '시칠리아 체크 타일', rough: 0.3, texture: { pattern: 'checker', colors: ['#2f5a6a', '#efe6d4'], grout: '#cfc4b0', tileMeters: 1.2 } },
    { id: 'v12_floor_terrazzo', name: '앤티크 테라조 스톤', rough: 0.3, texture: { pattern: 'terrazzo', colors: ['#d9cfbf', '#a5765e', '#7e776c', '#5a5047', '#efe7da'], tileMeters: 2 } },
  ],
};
