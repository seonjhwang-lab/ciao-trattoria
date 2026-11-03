import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBox.js';
import { woodTexture, textTexture } from './Textures.js';
import { cloneModel, fitModel } from './AssetLoader.js';

// ─────────────────────────────────────────────────────────────
// 프로시저럴 키트: 팩의 build(kit, swatch) 가 이 도구로 가구를 조립한다.
// r128 + sRGB 출력이므로 모든 hex 색은 linear 로 변환해서 재질에 넣는다.
// ─────────────────────────────────────────────────────────────
export const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

const geoCache = new Map();
const matCache = new Map();
const r3 = (n) => Math.round(n * 1000) / 1000;
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

function cachedMat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

export function mat(color, opts = {}) {
  const { rough = 0.6, metal = 0, emissive = null, ei = 1, opacity = 1, side = 'front', env = null, clearcoat = 0, ccRough = 0.15, transmission = 0, sheen = null } = opts;
  const key = ['m', color, rough, metal, emissive, ei, opacity, side, env, clearcoat, ccRough, transmission, sheen].join('|');
  return cachedMat(key, () => {
    const physical = clearcoat || transmission || sheen;
    const m = physical ? new THREE.MeshPhysicalMaterial({ color: lin(color), roughness: rough, metalness: metal }) : new THREE.MeshStandardMaterial({ color: lin(color), roughness: rough, metalness: metal });
    if (physical) {
      m.clearcoat = clearcoat;
      m.clearcoatRoughness = ccRough;
      if (transmission) m.transmission = transmission;
      if (sheen) m.sheen = lin(sheen);
    }
    m.envMapIntensity = env ?? (metal > 0.3 ? 1.0 : 0.45);
    if (emissive) {
      m.emissive = lin(emissive);
      m.emissiveIntensity = ei;
    }
    if (opacity < 1) {
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
    }
    if (side === 'double') m.side = THREE.DoubleSide;
    return m;
  });
}

// 원목 톤 (가구 스와치에서 이름으로 고른다)
export const WOOD = {
  walnut: '#5e3d27',
  oak: '#a5804f',
  lightoak: '#c4a274',
  ebony: '#2f2723',
  teak: '#8a5a35',
};
export const METAL = {
  black: { c: '#262628', metal: 0.55, rough: 0.48 },
  steel: { c: '#c2c6cb', metal: 0.7, rough: 0.3 },
  chrome: { c: '#d9dde2', metal: 0.9, rough: 0.15, clearcoat: 0.6 },
  brass: { c: '#b39058', metal: 0.85, rough: 0.33 },
  copper: { c: '#b07048', metal: 0.85, rough: 0.35 },
  cream: { c: '#e4dccb', metal: 0.15, rough: 0.35 },
  mint: { c: '#a9d7c4', metal: 0.1, rough: 0.3, clearcoat: 0.8 },
  olive: { c: '#5d6450', metal: 0.5, rough: 0.5 },
  oxide: { c: '#86402e', metal: 0.5, rough: 0.5 },
};

function mesh(g, m) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = !(m.transparent && m.opacity < 0.9);
  o.receiveShadow = true;
  return o;
}
const asMat = (m, opts) => (m instanceof THREE.Material ? m : mat(m, opts));

export const kit = {
  THREE,
  mat,
  lin,
  wood(tone = 'oak', opts = {}) {
    const base = WOOD[tone] ?? tone;
    return cachedMat(`wood|${base}|${opts.rough ?? 0.55}|${opts.seed ?? 5}`, () => {
      const m = new THREE.MeshStandardMaterial({ map: woodTexture(base, opts.seed ?? 5), roughness: opts.rough ?? 0.55 });
      m.envMapIntensity = 0.5;
      return m;
    });
  },
  metal(kind = 'black') {
    const m = METAL[kind] ?? METAL.black;
    return mat(m.c, { metal: m.metal, rough: m.rough, clearcoat: m.clearcoat ?? 0, env: m.metal > 0.3 ? 1.1 : null });
  },
  fabric: (c) => mat(c, { rough: 0.95, env: 0.2 }),
  leather: (c) => mat(c, { rough: 0.45, env: 0.5 }),
  ceramic: (c = '#efebe3') => mat(c, { rough: 0.22, env: 0.7 }),
  stone: (c = '#d6d2ca') => mat(c, { rough: 0.32, env: 0.6 }),
  glass: () => mat('#dfe9ec', { rough: 0.05, metal: 0.1, opacity: 0.22, env: 1.2 }),
  // 투명 호퍼·유리잔 (transmission)
  clearGlass: (c = '#e8f0f2', t = 0.5) => mat(c, { rough: 0.06, opacity: 0.5, transmission: t, clearcoat: 1, env: 1.3 }),
  glow: (c, ei = 1) => mat(c, { emissive: c, ei, rough: 0.6 }),

  rbox(w, h, d, m, opts = {}) {
    const r = Math.max(0.002, Math.min(opts.r ?? 0.015, Math.min(w, h, d) / 2 - 0.001));
    const seg = opts.seg ?? 2;
    return mesh(geo(`rb|${r3(w)}|${r3(h)}|${r3(d)}|${seg}|${r3(r)}`, () => new RoundedBoxGeometry(w, h, d, seg, r)), asMat(m, opts));
  },
  box(w, h, d, m, opts) {
    return mesh(geo(`bx|${r3(w)}|${r3(h)}|${r3(d)}`, () => new THREE.BoxGeometry(w, h, d)), asMat(m, opts));
  },
  cyl(rt, rb, h, m, opts = {}) {
    const seg = opts.seg ?? 24;
    const t0 = opts.t0 ?? 0;
    const tl = opts.tl ?? Math.PI * 2;
    return mesh(
      geo(`cy|${r3(rt)}|${r3(rb)}|${r3(h)}|${seg}|${!!opts.open}|${r3(t0)}|${r3(tl)}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open, t0, tl)),
      asMat(m, opts),
    );
  },
  sphere(r, m, opts = {}) {
    const t0 = opts.t0 ?? 0;
    const tl = opts.tl ?? Math.PI;
    return mesh(geo(`sp|${r3(r)}|${r3(t0)}|${r3(tl)}`, () => new THREE.SphereGeometry(r, opts.ws ?? 24, opts.hs ?? 16, 0, Math.PI * 2, t0, tl)), asMat(m, opts));
  },
  torus(r, tube, m, opts = {}) {
    const arc = opts.arc ?? Math.PI * 2;
    return mesh(geo(`to|${r3(r)}|${r3(tube)}|${r3(arc)}`, () => new THREE.TorusGeometry(r, tube, 10, 32, arc)), asMat(m, opts));
  },
  cone(r, h, m, opts = {}) {
    return mesh(geo(`co|${r3(r)}|${r3(h)}|${opts.seg ?? 20}`, () => new THREE.ConeGeometry(r, h, opts.seg ?? 20)), asMat(m, opts));
  },
  // r128 에는 CapsuleGeometry 가 없어 Lathe 로 만든다 (중심 원점, 세로 방향)
  capsule(r, len, m, opts = {}) {
    return mesh(
      geo(`ca|${r3(r)}|${r3(len)}`, () => {
        const pts = [];
        const seg = 6;
        for (let i = 0; i <= seg; i++) {
          const a = -Math.PI / 2 + (i / seg) * (Math.PI / 2);
          pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r - len / 2));
        }
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * (Math.PI / 2);
          pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r + len / 2));
        }
        return new THREE.LatheGeometry(pts, 14);
      }),
      asMat(m, opts),
    );
  },
  plane(w, h, m) {
    const o = new THREE.Mesh(geo(`pl|${r3(w)}|${r3(h)}`, () => new THREE.PlaneGeometry(w, h)), m);
    o.receiveShadow = true;
    return o;
  },
  label(lines, w, h, opts = {}) {
    const tex = textTexture(lines, { w: 512, h: Math.round((512 * h) / w), ...opts });
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    m.envMapIntensity = 0.2;
    return kit.plane(w, h, m);
  },
  // Kenney GLB 모델 (없으면 null → 호출한 쪽이 절차적 모델로 대체)
  // Kenney 재질 이름을 현실 톤 재질로 바꿔 끼운다: wood/woodDark → 원목, metal → 스틸, carpet → 패브릭, plant → 잎
  model(name, { height = null, maxW = 0.95, maxD = 0.95, sw = {} } = {}) {
    const obj = cloneModel(name, (mname) => {
      const n = (mname || '').toLowerCase();
      if (n === 'wooddark') return kit.wood(sw.wood2 ?? 'walnut');
      if (n.startsWith('wood')) return kit.wood(sw.wood ?? 'oak');
      if (n === 'metalmedium') return kit.metal(sw.metal2 ?? 'black');
      if (n.startsWith('metal')) return kit.metal(sw.metal ?? 'steel');
      if (n === 'carpetwhite') return kit.fabric('#e6dfd2');
      if (n.startsWith('carpet')) return kit.fabric(sw.fabric ?? '#6b4f3a');
      if (n === 'plant') return kit.mat(sw.leaf ?? '#3f6a3c', { rough: 0.7 });
      if (n === 'glass') return kit.glass();
      if (n === 'lamp') return kit.glow('#ffd9a0', 1.2);
      return null;
    });
    return obj ? fitModel(obj, { height, maxW, maxD }) : null;
  },
  // 조명 가구용 PointLight — DayCycle 이 시간대에 맞춰 밝기를 조절한다
  lamp(color = '#ffb46b', intensity = 1.1, distance = 5.5) {
    const l = new THREE.PointLight(lin(color), 0, distance, 2);
    l.userData.lamp = true;
    l.userData.base = intensity;
    return l;
  },
  at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    obj.position.set(x, y, z);
    obj.rotation.set(rx, ry, rz);
    return obj;
  },
  scl(obj, sx, sy = sx, sz = sx) {
    obj.scale.set(sx, sy, sz);
    return obj;
  },
  group(...children) {
    const g = new THREE.Group();
    children.forEach((c) => c && g.add(c));
    return g;
  },
  shade(hex, amount) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amount);
    return '#' + c.getHexString();
  },
};

