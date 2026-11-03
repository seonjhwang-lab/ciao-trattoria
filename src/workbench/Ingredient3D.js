import * as THREE from 'three';
import { kit } from '../core/Kit.js';
import { crumbTexture, crustTexture, sectionTexture, skinTexture, traceLoaf } from './benchTextures.js';

// 썰 수 있는 3D 재료. 긴 축은 로컬 x. 칼이 지나간 자리에서 조각(piece)이 둘로 나뉘고,
// 새로 생긴 단면에는 기공·씨앗·과육층 단면 텍스처가 보인다.
const H = Math.PI / 2;

function loafShape() {
  const s = new THREE.Shape();
  traceLoaf(s);
  return s;
}
const LOAF = loafShape();
export const LOAF_SHAPE = LOAF;

// 브리오슈 윗면의 봉긋한 결(낭테르식 봉우리 4개). 정규화 단면 v>0 인 정점만 위로 부풀린다. 양 끝에서는 0
export function lobeTop(geo, ing, x0) {
  const lobes = ing.slot === 'brioche' ? 4 : 0;
  const pos = geo.attributes.position;
  const L = ing.len;
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getY(i);
    if (v <= 0.05) continue;
    const ax = x0 + pos.getX(i) + L / 2; // 0..L
    const t = Math.max(0, Math.min(1, ax / L));
    const end = Math.sin(Math.PI * t) ** 0.35; // 양 끝은 살짝 처진다
    const lobe = lobes ? Math.sin(Math.PI * t * lobes) ** 2 : 1;
    const w = THREE.MathUtils.smoothstep(v, 0.05, 0.5);
    pos.setY(i, v + w * (lobes ? 0.035 + 0.06 * lobe : 0.06) * end - w * 0.03 * (1 - end));
  }
  geo.computeVertexNormals();
}

let capGeo = null;
function loafCapGeo() {
  if (capGeo) return capGeo;
  const s = new THREE.Shape();
  traceLoaf(s, (u, v) => [u * 0.9, v * 0.9 - 0.01]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.001, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.05, bevelSegments: 5, curveSegments: 14 });
  g.rotateY(H); // 압출 방향 → +x
  // 한쪽 반(+x)만 보이게: 안쪽 절반은 빵 속에 묻힌다
  capGeo = g;
  return g;
}

// 식재료 실사 재질: 텍스처 자체를 범프로 써 기공·씨앗 요철을 살리고, 빵은 sheen(벨벳), 과즙은 clearcoat(윤기)
function std(map, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({ map, roughness: opts.rough ?? 0.75, side: opts.side ?? THREE.FrontSide });
  m.bumpMap = map;
  m.bumpScale = opts.bump ?? 0.003;
  m.roughnessMap = opts.roughMap ? map : null;
  if (opts.clearcoat) {
    m.clearcoat = opts.clearcoat;
    m.clearcoatRoughness = opts.ccRough ?? 0.2;
  }
  if (opts.sheen) m.sheen = new THREE.Color(opts.sheen).convertSRGBToLinear();
  m.envMapIntensity = opts.env ?? 0.45;
  return m;
}

const matCache = new Map();
function mats(ing) {
  if (matCache.has(ing.slot)) return matCache.get(ing.slot);
  let m;
  if (ing.kind === 'loaf') {
    const sec = crumbTexture(ing).clone();
    sec.needsUpdate = true;
    sec.offset.set(0.5, 0.5);
    m = { section: std(sec, { rough: 0.92, sheen: '#f6e2bd', bump: 0.006, roughMap: true }), skin: std(crustTexture(ing), { rough: 0.62, bump: 0.005, clearcoat: 0.12, ccRough: 0.5 }) };
  } else {
    const juicy = !['avocado', 'mozzarella', 'romaine'].includes(ing.slot);
    m = {
      section: std(sectionTexture(ing), { rough: juicy ? 0.3 : 0.42, clearcoat: juicy ? 0.85 : 0.35, ccRough: 0.12, bump: 0.002, env: 0.7 }),
      skin: std(skinTexture(ing), { rough: ing.slot === 'mozzarella' ? 0.35 : juicy ? 0.22 : 0.85, clearcoat: juicy || ing.slot === 'mozzarella' ? 0.9 : 0, bump: ing.slot === 'avocado' || ing.slot === 'cucumber' ? 0.008 : 0.001, env: 0.8 }),
    };
  }
  matCache.set(ing.slot, m);
  return m;
}

// 둥근 재료의 반지름 (x: -L/2..L/2)
export function radiusAt(ing, x) {
  const t = Math.max(-1, Math.min(1, x / (ing.len / 2)));
  const base = Math.sqrt(Math.max(0, 1 - t * t));
  const r = ing.w / 2;
  if (ing.slot === 'avocado') return r * base * (0.86 + 0.14 * t);
  if (ing.slot === 'fig') return r * base * (0.9 - 0.15 * t);
  // 오이: 길쭉한 원통 + 둥근 양 끝
  if (ing.slot === 'cucumber') return r * Math.sqrt(Math.max(0, 1 - Math.abs(t) ** 6)) * (0.94 + 0.06 * t);
  // 로메인 하트: 밑동 쪽(-x)이 좁고 잎 쪽(+x)이 넓게 퍼진다
  if (ing.slot === 'romaine') return r * Math.sqrt(Math.max(0, 1 - Math.abs(t) ** 4)) * (0.62 + 0.38 * (t * 0.5 + 0.5));
  if (ing.slot === 'mozzarella') return r * Math.sqrt(Math.max(0, 1 - t * t * t * t)) * (0.92 + 0.08 * base);
  return r * base;
}

export class SliceableItem {
  constructor(ing) {
    this.ing = ing;
    this.group = new THREE.Group();
    this.m = mats(ing);
    this.pieces = [];
    this.addPiece(-ing.len / 2, ing.len / 2, 0);
  }

  // 조각 메쉬 만들기
  buildPiece(x0, x1) {
    const ing = this.ing;
    const g = new THREE.Group();
    const L = ing.len / 2;
    const outerA = x0 <= -L + 1e-4;
    const outerB = x1 >= L - 1e-4;
    if (ing.kind === 'loaf') {
      const steps = Math.max(1, Math.round((x1 - x0) / 0.008));
      const geo = new THREE.ExtrudeGeometry(LOAF, { depth: x1 - x0, bevelEnabled: false, curveSegments: 14, steps });
      geo.rotateY(H);
      lobeTop(geo, ing, x0);
      const mesh = new THREE.Mesh(geo, [this.m.section, this.m.skin]);
      mesh.scale.set(1, ing.h, ing.w);
      mesh.position.set(x0, ing.h / 2, 0);
      g.add(mesh);
      g.userData.face = mesh;
      for (const [outer, x, s] of [
        [outerA, x0, -1],
        [outerB, x1, 1],
      ]) {
        if (!outer) continue;
        // 꽁다리: 단면과 같은 윤곽을 베벨로 부풀린 둥근 끝 (네모난 아랫단까지 딱 맞는다)
        const cap = new THREE.Mesh(loafCapGeo(), this.m.skin);
        cap.scale.set(s, ing.h, ing.w);
        cap.position.set(x, ing.h / 2, 0);
        g.add(cap);
      }
    } else {
      const pts = [];
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        pts.push(new THREE.Vector2(Math.max(0.0008, radiusAt(ing, x)), x));
      }
      const side = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), this.m.skin);
      const rot = new THREE.Group();
      rot.rotation.z = -H;
      rot.add(side);
      for (const [outer, x, dir] of [
        [outerA, x0, -1],
        [outerB, x1, 1],
      ]) {
        if (outer) continue;
        const rr = radiusAt(ing, x);
        const cap = new THREE.Mesh(new THREE.CircleGeometry(rr, 28), this.m.section);
        cap.position.y = x;
        cap.rotation.x = dir > 0 ? -H : H;
        rot.add(cap);
        if (!g.userData.face || dir > 0) g.userData.face = cap;
      }
      rot.position.y = ing.w / 2;
      g.add(rot);
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.userData.x0 = x0;
    g.userData.x1 = x1;
    return g;
  }

  addPiece(x0, x1, offset) {
    const mesh = this.buildPiece(x0, x1);
    const p = { x0, x1, offset, mesh };
    mesh.position.x = offset;
    this.group.add(mesh);
    this.pieces.push(p);
    this.pieces.sort((a, b) => a.x0 - b.x0);
    return p;
  }

  // 원래 좌표 x 가 지금 화면(그룹 로컬)에서 보이는 위치 (조각이 밀려난 만큼 더한다)
  visualX(x) {
    const p = this.pieces.find((q) => !q.hinge && x >= q.x0 - 1e-4 && x <= q.x1 + 1e-4);
    return x + (p ? p.offset : 0);
  }

  // 아직 썰지 않은 가이드가 들어 있는 조각인지
  hasPending(q) {
    return (this.pending ?? []).some((gx) => gx > q.x0 + 1e-4 && gx < q.x1 - 1e-4);
  }

  // x(로컬)에서 자르기. 조각들이 살짝 벌어진다
  cut(x) {
    const p = this.pieces.find((q) => !q.hinge && x > q.x0 + 0.004 && x < q.x1 - 0.004);
    if (!p) return false;
    this.group.remove(p.mesh);
    // v15: 둘로 나뉘어 사라지는 조각의 지오메트리 해제 (재질은 재료별 공유 캐시라 그대로)
    p.mesh.traverse((o) => o.isMesh && !o.geometry?.userData?.shared && o.geometry !== capGeo && o.geometry?.dispose?.());
    this.pieces = this.pieces.filter((q) => q !== p);
    const a = this.addPiece(p.x0, x, p.offset);
    const b = this.addPiece(x, p.x1, p.offset);
    if (p.target !== undefined) a.target = b.target = p.target;
    // 자른 자리 기준으로 오른쪽은 밀고 왼쪽은 당긴다
    for (const q of this.pieces) {
      q.target = (q.target ?? q.offset) + (q.x0 >= x ? 0.006 : -0.006);
    }
    // 더 썰 가이드가 없는 조각은 아래 모서리를 축으로 옆으로 스르륵 쓰러져 단면이 하늘을 본다
    //  빵: 양쪽이 잘린 슬라이스만 (꽁다리는 세워 둔다)
    //  과채·치즈: 모든 조각 (오른쪽 끝 조각은 오른쪽으로 쓰러져 왼쪽 단면이 위로)
    const L = this.ing.len / 2;
    for (const q of [a, b]) {
      if (this.hasPending(q)) continue;
      const leftEnd = q.x0 <= -L + 1e-4;
      const rightEnd = q.x1 >= L - 1e-4;
      if (this.ing.kind === 'loaf') {
        if (!leftEnd && !rightEnd) this.topple(q, 1);
      } else if (rightEnd) {
        if (!leftEnd) this.topple(q, -1);
      } else this.topple(q, 1);
    }
    return true;
  }

  // v15 자연스러운 슬라이스 쓰러짐
  //  1) 칼날 웨지: 칼에 밀려 3~5mm 벌어지며 바깥으로 8~12° 천천히 기운다
  //  2) 중력 낙하: 무게중심이 넘어가면 t² 가속으로 빠르게 쓰러진다
  //  3) 감쇠 탄성: 닿는 순간 한 번 톡 튀고, 조금 미끄러지며 멈춘다 (둥근 재료는 옆으로 살짝 구르듯 워블)
  //  쓰러질 자리(누울 방향) 바로 옆 조각이 이미 누워 있으면, 그 가장자리에 걸쳐 62~76° 로 비스듬히 기댄다 (도미노 겹침)
  topple(q, dir = 1) {
    const H = this.ing.kind === 'loaf' ? this.ing.h : this.ing.w;
    const thick = q.x1 - q.x0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    // 누울 쪽 이웃: dir>0 이면 왼쪽(x1 == q.x0), dir<0 이면 오른쪽
    const nb = this.pieces.find((o) => o !== q && (dir > 0 ? Math.abs(o.x1 - q.x0) < 1e-4 : Math.abs(o.x0 - q.x1) < 1e-4));
    const lean = !!(nb && nb.hinge);
    const ang = lean ? rnd(62, 76) : rnd(86, 90);
    const rad = (ang * Math.PI) / 180;
    // 비켜 줄 거리: 처음 조각은 다 누울 자리, 겹치는 조각은 앞 조각 가장자리에 걸칠 만큼만
    let gap;
    if (!lean) gap = H * Math.sin(rad) + 0.012;
    else {
      const tp = Math.max(0.006, nb.x1 - nb.x0) * (nb.fallAng && nb.fallAng < 80 ? 1.35 : 1);
      gap = Math.min(H * Math.sin(rad) * 0.85, tp * Math.tan(rad) + 0.004);
    }
    const side = (o) => (dir > 0 ? o.x1 <= q.x0 + 1e-4 : o.x0 >= q.x1 - 1e-4);
    for (const o of this.pieces) if (o !== q && side(o)) o.target = (o.target ?? o.offset) - dir * gap;
    const hx = dir > 0 ? q.x0 : q.x1;
    const hinge = new THREE.Group();
    hinge.position.set(hx + (q.target ?? q.offset), 0, 0);
    this.group.remove(q.mesh);
    q.mesh.position.x = -hx;
    hinge.add(q.mesh);
    this.group.add(hinge);
    q.hinge = hinge;
    q.hx = hx;
    q.dir = dir;
    q.fallAng = ang;
    const round = this.ing.kind === 'round' || this.ing.slot === 'cucumber' || this.ing.slot === 'mozzarella';
    q.fall = {
      t: 0,
      phase: 'wedge',
      wedgeDur: rnd(0.13, 0.19),
      wedgeAng: (rnd(8, 12) * Math.PI) / 180,
      wedgeSlide: rnd(0.003, 0.005),
      fallDur: rnd(0.24, 0.3) * (lean ? 0.85 : 1) * Math.sqrt(H / 0.085),
      final: rad,
      slide: rnd(0.012, 0.024) * (lean ? 0.5 : 1),
      bounce: (rnd(5, 9) * Math.PI) / 180,
      yaw: (Math.random() - 0.5) * 0.24,
      dz: (Math.random() - 0.5) * 0.014,
      round,
      wobble: round ? rnd(0.06, 0.1) : 0,
    };
    q.slideNow = 0;
    void thick;
  }

  // 한 조각의 쓰러짐 진행 (update 에서 매 프레임)
  stepFall(p, dt) {
    const f = p.fall;
    const d = p.dir ?? 1;
    f.t += dt;
    let ang = 0;
    let slide = 0;
    if (f.phase === 'wedge') {
      // 칼날에 밀려 천천히: ease-out
      const u = Math.min(1, f.t / f.wedgeDur);
      const e = 1 - (1 - u) * (1 - u);
      ang = f.wedgeAng * e;
      slide = f.wedgeSlide * e;
      if (u >= 1) {
        f.phase = 'fall';
        f.t = 0;
      }
    } else if (f.phase === 'fall') {
      // 중력 가속 t² (Ease-In): 처음엔 느리게, 닿기 직전 가장 빠르게
      const u = Math.min(1, f.t / f.fallDur);
      const e = u * u;
      ang = f.wedgeAng + (f.final - f.wedgeAng) * e;
      slide = f.wedgeSlide + f.slide * 0.7 * e;
      if (u >= 1) {
        f.phase = 'settle';
        f.t = 0;
      }
    } else {
      // 감쇠 탄성: 한 번 톡 튀어 올랐다가(각도가 살짝 줄었다가) 미끄러지며 멈춘다
      const t = f.t;
      const k = Math.exp(-7 * t);
      ang = f.final - f.bounce * k * Math.abs(Math.sin(t * 15));
      slide = f.wedgeSlide + f.slide * (0.7 + 0.3 * (1 - Math.exp(-6 * t)));
      if (f.round) p.hinge.rotation.x = f.wobble * Math.exp(-4.5 * t) * Math.sin(t * 17);
      if (t > 0.9) {
        ang = f.final;
        p.hinge.rotation.x = 0;
        p.fall = null;
      }
    }
    p.hinge.rotation.z = d * ang;
    p.hinge.rotation.y = f.yaw * Math.min(1, (ang / Math.max(0.01, f.final)) * 1.2);
    p.hinge.position.z = f.dz * Math.min(1, ang / Math.max(0.01, f.final));
    p.slideNow = -d * slide;
    p.restAng = d * ang;
    p.restYaw = p.hinge.rotation.y;
    p.restZ = p.hinge.position.z;
  }

  // 플레이팅/토싱용: 쓰러진 모든 조각 (빵은 가운데 슬라이스만)
  cutPieces() {
    if (this.ing.kind === 'loaf') return this.slices();
    return this.pieces.filter((p) => p.hinge);
  }

  // 양 끝(껍질 쪽)을 뺀 가운데 조각들 = 플레이팅용 슬라이스
  slices() {
    const L = this.ing.len / 2;
    return this.pieces.filter((p) => p.x0 > -L + 1e-4 && p.x1 < L - 1e-4);
  }

  update(dt) {
    for (const p of this.pieces) {
      if (p.flat) continue; // 접시로 옮긴 조각은 건드리지 않는다
      if (p.target !== undefined) p.offset += (p.target - p.offset) * Math.min(1, dt * 14);
      if (p.hinge) {
        if (p.fall) this.stepFall(p, dt);
        p.hinge.position.x = (p.hx ?? p.x0) + p.offset + (p.slideNow ?? 0);
      } else if (p.target !== undefined) p.mesh.position.x = p.offset;
    }
  }
}

// 바닥에 '툭' 닿고 두어 번 작게 튀는 이징
export function bounceOut(u) {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
  if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
  return n * (u -= 2.625 / d) * u + 0.984375;
}

// 썬 조각을 '단면이 위로' 눕힌 자세로 바꾼다 (부모에서 떼어내 월드 좌표 유지)
export function layFlat(piece, ing) {
  const g = piece.mesh;
  const thick = piece.x1 - piece.x0;
  const holder = new THREE.Group();
  g.position.set(-(piece.x0 + piece.x1) / 2, 0, 0);
  if (ing.kind === 'loaf') g.position.y = 0;
  const inner = new THREE.Group();
  inner.add(g);
  // x축(두께)을 세로로 세우고, 단면이 위를 보게 (오른쪽 끝 조각은 반대로 눕혀야 왼쪽 단면이 위)
  const flip = piece.dir === -1 ? -1 : 1;
  inner.rotation.z = H * flip;
  inner.position.y = 0;
  holder.add(inner);
  holder.userData.thickness = thick;
  holder.userData.height = ing.kind === 'loaf' ? thick : thick;
  // 세운 뒤 바닥에 닿도록 중심 보정
  if (ing.kind === 'loaf') inner.position.set(ing.h / 2, 0, 0);
  else inner.position.set((flip * ing.w) / 2, 0, 0);
  inner.position.y = thick / 2;
  return holder;
}

// 미리 준비된 토핑 (상추·베이컨·수란·루꼴라·햄)
export function buildPrepped(ing, count = 1) {
  const g = new THREE.Group();
  const k = kit;
  for (let i = 0; i < count; i++) {
    const p = new THREE.Group();
    if (ing.shape === 'leaf') {
      const geo = new THREE.PlaneGeometry(0.12, 0.08, 8, 6);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        pos.setZ(j, Math.sin(x * 70) * 0.006 + Math.sin(y * 60 + x * 20) * 0.004 + (1 - (x / 0.06) ** 2) * 0.006);
      }
      geo.computeVertexNormals();
      const leaf = new THREE.Mesh(geo, k.mat(ing.color, { rough: 0.55, side: 'double' }));
      leaf.rotation.x = -H;
      leaf.castShadow = true;
      p.add(leaf);
      p.userData.h = 0.008;
    } else if (ing.shape === 'strip') {
      const geo = new THREE.BoxGeometry(0.13, 0.006, 0.03, 16, 1, 1);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) pos.setY(j, pos.getY(j) + Math.sin(pos.getX(j) * 60) * 0.004);
      geo.computeVertexNormals();
      const tex = stripTexture(ing);
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
      const strip = new THREE.Mesh(geo, m);
      strip.castShadow = true;
      p.add(strip);
      p.userData.h = 0.01;
    } else if (ing.shape === 'egg') {
      p.add(k.at(k.scl(k.sphere(0.04, k.mat(ing.color, { rough: 0.4 })), 1, 0.38, 1), 0, 0.012, 0));
      p.add(k.at(k.scl(k.sphere(0.018, k.mat(ing.inner, { rough: 0.2, env: 1 })), 1, 0.8, 1), 0.005, 0.022, 0));
      p.userData.h = 0.03;
    }
    p.position.set((i - (count - 1) / 2) * 0.03, 0, (i % 2) * 0.01);
    p.rotation.y = i * 0.5;
    g.add(p);
  }
  g.userData.h = Math.max(...g.children.map((c) => c.userData.h ?? 0.01));
  return g;
}

const stripCache = new Map();
function stripTexture(ing) {
  if (stripCache.has(ing.color)) return stripCache.get(ing.color);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = ing.color;
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = ing.inner;
  for (let y = 4; y < 32; y += 10) {
    ctx.beginPath();
    for (let x = 0; x <= 128; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2) * 2);
    ctx.lineTo(128, y + 3);
    ctx.lineTo(0, y + 3);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  stripCache.set(ing.color, t);
  return t;
}
