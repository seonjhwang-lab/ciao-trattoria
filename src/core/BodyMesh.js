import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// 심즈풍 일체형 인체 메쉬 (Mixamo 뼈대에 씌우는 매끈한 옷 입은 몸)
//  · 몸통·팔·다리·손·신발을 단면 링을 이어 만든 하나의 관으로 만든다 → 관절 구슬·이음새가 없다
//  · 링마다 인접한 두 뼈의 가중치를 섞어 팔꿈치·무릎·어깨가 고무처럼 부드럽게 굽는다
//  · 좌표: Mixamo T-포즈(cm, 발바닥 y=0, +z 정면). 뼈 위치는 P(name) 로 받는다
//  · 옷 경계(셔츠/바지/벨트/소매 끝)는 같은 자리에 링을 두 번 넣어 색이 칼같이 나뉜다
//  · 앞치마·코트 자락·칼라는 겉감 메쉬(양면)로 따로 만든다
// ─────────────────────────────────────────────────────────────
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const X = V(1, 0, 0);
const Y = V(0, 1, 0);
const Z = V(0, 0, 1);
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const clamp = THREE.MathUtils.clamp;
const SIDED = /^(Shoulder|Arm|ForeArm|Hand|HandMiddle1|HandMiddle2|HandThumb1|HandThumb2|HandThumb3|UpLeg|Leg|Foot|ToeBase)$/;

function lerpW(a, b, u) {
  const o = {};
  for (const k in a) o[k] = (o[k] ?? 0) + a[k] * (1 - u);
  for (const k in b) o[k] = (o[k] ?? 0) + b[k] * u;
  return o;
}

// 키 사이 보간 링 (+ 옷 경계 이중 링 + 둥근 끝)
function rings(keys, { cuts = [], color, domeA = 0, domeB = 0 }) {
  const lerpKey = (a, b, u) => ({
    s: a.s + (b.s - a.s) * u,
    c: a.c.clone().lerp(b.c, u),
    ru: a.ru + (b.ru - a.ru) * u,
    rv: a.rv + (b.rv - a.rv) * u,
    w: typeof a.w === 'function' ? a.w : lerpW(a.w, b.w, u),
    arc: a.arc && b.arc ? [a.arc[0] + (b.arc[0] - a.arc[0]) * u, a.arc[1] + (b.arc[1] - a.arc[1]) * u] : a.arc,
  });
  const mk = (k, cs) => ({ c: k.c, ru: k.ru, rv: k.rv, w: k.w, arc: k.arc, col: color(cs) });
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i];
    out.push(mk(a, a.s));
    const b = keys[i + 1];
    if (!b) break;
    const inside = cuts.filter((c) => (c - a.s) * (c - b.s) < 0).sort((x, y) => Math.abs(x - a.s) - Math.abs(y - a.s));
    for (const c of inside) {
      const k = lerpKey(a, b, (c - a.s) / (b.s - a.s));
      const e = 1e-3 * Math.sign(b.s - a.s);
      out.push(mk(k, c - e), mk({ ...k }, c + e));
    }
  }
  const dome = (r0, r1, depth, atStart) => {
    const dir = r0.c.clone().sub(r1.c).normalize();
    const extra = [0.55, 0.95, 1.28].map((t) => ({ ...r0, c: r0.c.clone().addScaledVector(dir, depth * Math.sin(t)), ru: r0.ru * Math.cos(t), rv: r0.rv * Math.cos(t) }));
    const tip = r0.c.clone().addScaledVector(dir, depth);
    if (atStart) out.unshift(...extra.reverse());
    else out.push(...extra);
    return tip;
  };
  let tipA = null;
  let tipB = null;
  if (domeA) tipA = dome(out[0], out[1], domeA, true);
  if (domeB) tipB = dome(out[out.length - 1], out[out.length - 2], domeB, false);
  out.tipA = tipA;
  out.tipB = tipB;
  return out;
}

class Weave {
  constructor(boneIndex) {
    this.bi = boneIndex;
    this.P = [];
    this.C = [];
    this.SI = [];
    this.SW = [];
    this.I = [];
  }

  vert(p, col, w) {
    const list = Object.entries(w)
      .map(([n, v]) => [this.bi(n), v])
      .filter(([i, v]) => i >= 0 && v > 1e-4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (!list.length) list.push([Math.max(0, this.bi('Hips')), 1]);
    const sum = list.reduce((s, e) => s + e[1], 0);
    this.P.push(p.x, p.y, p.z);
    this.C.push(col.r, col.g, col.b);
    for (let k = 0; k < 4; k++) {
      const e = list[k];
      this.SI.push(e ? e[0] : 0);
      this.SW.push(e ? e[1] / sum : 0);
    }
    return this.P.length / 3 - 1;
  }

  // 링 목록을 관으로 잇는다. u·v = 단면 타원의 두 축 (ru 는 u 방향, rv 는 v 방향 반지름)
  tube(R, { u, v, seg = 18, clampY = null }) {
    const arc = R[0].arc;
    const closed = !arc;
    const cols = closed ? seg : seg + 1;
    const D = R[R.length - 1].c.clone().sub(R[0].c);
    const flip = new THREE.Vector3().crossVectors(u, v).dot(D) < 0;
    const base = this.P.length / 3;
    const p = new THREE.Vector3();
    const at = (r, t) => {
      p.copy(r.c).addScaledVector(u, Math.cos(t) * r.ru).addScaledVector(v, Math.sin(t) * r.rv);
      if (clampY != null && p.y < clampY) p.y = clampY;
      return p;
    };
    for (const r of R) {
      for (let j = 0; j < cols; j++) {
        const t = r.arc ? r.arc[0] + ((r.arc[1] - r.arc[0]) * j) / seg : (j / seg) * Math.PI * 2;
        at(r, t);
        this.vert(p, typeof r.col === 'function' ? r.col(p, t) : r.col, typeof r.w === 'function' ? r.w(p) : r.w);
      }
    }
    const tri = (a, b, c) => (flip ? this.I.push(a, c, b) : this.I.push(a, b, c));
    for (let i = 0; i < R.length - 1; i++)
      for (let j = 0; j < seg; j++) {
        const a = base + i * cols + j;
        const b = base + i * cols + (closed ? (j + 1) % cols : j + 1);
        tri(a, b, a + cols);
        tri(b, b + cols, a + cols);
      }
    if (closed) {
      const cap = (ri, tip, end) => {
        const r = R[ri];
        const c = (tip ?? r.c).clone();
        if (clampY != null && c.y < clampY) c.y = clampY;
        const ctr = this.vert(c, typeof r.col === 'function' ? r.col(c, 0) : r.col, typeof r.w === 'function' ? r.w(c) : r.w);
        for (let j = 0; j < seg; j++) {
          const a = base + ri * cols + j;
          const b = base + ri * cols + ((j + 1) % cols);
          if (end) tri(a, b, ctr);
          else tri(b, a, ctr);
        }
      };
      cap(0, R.tipA, false);
      cap(R.length - 1, R.tipB, true);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setIndex(this.P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeVertexNormals();
    smoothSeams(g);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// 같은 자리에 겹친 정점(옷 경계 이중 링)의 법선을 평균 → 색만 나뉘고 음영은 이어진다
function smoothSeams(g) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`;
    let a = groups.get(key);
    if (!a) groups.set(key, (a = []));
    a.push(i);
  }
  const n = new THREE.Vector3();
  for (const a of groups.values()) {
    if (a.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of a) n.x += nor.getX(i), (n.y += nor.getY(i)), (n.z += nor.getZ(i));
    n.normalize();
    for (const i of a) nor.setXYZ(i, n.x, n.y, n.z);
  }
}

// 축 D 에 수직인 단면 축 한 쌍
function frameOf(D) {
  const d = D.clone().normalize();
  const ref = Math.abs(d.y) > 0.9 ? X : Y;
  const u = new THREE.Vector3().crossVectors(ref, d).normalize();
  const v = new THREE.Vector3().crossVectors(d, u).normalize();
  return { u, v };
}

export function buildBodyGeometry(P, L, boneIndex) {
  const W = L.build === 'slim' ? 0.92 : L.build === 'broad' ? 1.1 : 1;
  const Wd = 0.5 + 0.5 * W;
  const coat = L.coat ?? null;
  const shoeLight = new THREE.Color(L.shoe).getHSL({}).l > 0.55;
  const col = {
    skin: lin(L.skin),
    top: lin(L.top),
    outer: lin(coat ?? L.top),
    bottom: lin(L.bottom),
    belt: lin('#3b2a20'),
    shoe: lin(L.shoe),
    sole: shoeLight ? lin('#bfb5a6') : lin('#efe9df'),
    apron: L.apron ? lin(L.apron) : null,
    apronHem: L.apron ? lin(L.apron).multiplyScalar(0.72) : null,
    coat: coat ? lin(coat) : null,
  };
  const body = new Weave(boneIndex);
  const over = new Weave(boneIndex);
  const side = (w, s) => {
    const o = {};
    for (const k in w) o[SIDED.test(k) ? (s > 0 ? 'Left' : 'Right') + k : k] = w[k];
    return o;
  };

  // ── 몸통 (y 위로) ──
  const TORSO = [
    [88, 12.5, 9.0, 1.0, { Hips: 1 }],
    [93, 16.2, 10.8, 1.2, { Hips: 1 }],
    [100, 16.4, 10.4, 1.5, { Hips: 1 }],
    [105, 15.4, 10.0, 1.6, { Hips: 0.6, Spine: 0.4 }],
    [112, 14.3, 9.8, 1.8, { Spine: 1 }],
    [120, 14.9, 10.3, 1.0, { Spine: 0.5, Spine1: 0.5 }],
    [128, 16.0, 11.0, -0.3, { Spine1: 0.5, Spine2: 0.5 }],
    [136, 17.0, 10.6, -1.6, { Spine2: 1 }],
    [141, 17.2, 9.7, -2.6, { Spine2: 1 }],
    [145, 15.6, 8.3, -3.0, { Spine2: 0.85, Neck: 0.15 }],
    [148, 11.5, 7.0, -3.2, { Spine2: 0.5, Neck: 0.5 }],
    [150.5, 6.4, 5.6, -3.2, { Neck: 1 }],
  ];
  const torsoKey = ([y, ru, rv, zc, w], pad = 0) => ({ s: y, c: V(0, y, zc), ru: ru * W + pad, rv: rv * Wd + pad, w });
  const torsoAt = (y, pad = 0, arc = null) => {
    let i = 0;
    while (i < TORSO.length - 2 && TORSO[i + 1][0] < y) i++;
    const a = TORSO[i];
    const b = TORSO[i + 1];
    const u = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    const k = { s: y, c: V(0, y, a[3] + (b[3] - a[3]) * u), ru: (a[1] + (b[1] - a[1]) * u) * W + pad, rv: (a[2] + (b[2] - a[2]) * u) * Wd + pad, w: lerpW(a[4], b[4], u) };
    if (arc) k.arc = arc;
    return k;
  };
  // 9차: 겉옷 레이어(칼라 · 코트 · 앞치마)는 그 높이의 몸통 반경보다 최소 0.7cm(7mm) 크게 → 어떤 각도에서도 옷끼리 겹쳐 깨지지 않는다
  const CLOTH = 0.7;
  const outerRing = (k) => {
    const t = torsoAt(k.s);
    return { ...k, ru: Math.max(k.ru, t.ru + CLOTH), rv: Math.max(k.rv, t.rv + CLOTH) };
  };
  const HEM = 101;
  const BELT = 103.6;
  body.tube(
    rings(
      TORSO.map((k) => torsoKey(k)),
      { cuts: [HEM, BELT], color: (y) => (y < HEM ? col.bottom : y < BELT ? (coat ? col.outer : col.belt) : col.outer), domeA: 4 },
    ),
    { u: X, v: Z, seg: 24 },
  );

  // ── 목 ──
  body.tube(
    rings(
      [
        { s: 144, c: V(0, 144, -3.0), ru: 5.6, rv: 5.4, w: { Spine2: 0.5, Neck: 0.5 } },
        { s: 150, c: V(0, 150, -2.8), ru: 5.0, rv: 4.9, w: { Neck: 1 } },
        { s: 156, c: V(0, 156, -2.0), ru: 4.7, rv: 4.7, w: { Neck: 0.6, Head: 0.4 } },
        { s: 162, c: V(0, 162, -1.0), ru: 4.6, rv: 4.5, w: { Head: 1 } },
      ],
      { color: () => col.skin },
    ),
    { u: X, v: Z, seg: 14 },
  );

  for (const s of [-1, 1]) {
    const legX = Math.abs(P((s > 0 ? 'Left' : 'Right') + 'UpLeg').x);
    const knee = P((s > 0 ? 'Left' : 'Right') + 'Leg').y;
    const Wl = 0.5 + 0.5 * W;
    // ── 다리 (y 아래로): 허벅지~무릎~종아리가 한 관, 무릎 앞뒤로 가중치가 섞여 접힌다 ──
    const LEG = [
      [104, 8.4, 8.8, 0.6, { Hips: 1 }],
      [97, 8.8, 9.0, 0.6, { Hips: 0.5, UpLeg: 0.5 }],
      [90, 8.5, 8.7, 0.7, { UpLeg: 1 }],
      [74, 7.3, 7.5, 0.9, { UpLeg: 1 }],
      [knee + 8, 6.0, 6.1, 0.7, { UpLeg: 0.85, Leg: 0.15 }],
      [knee, 5.5, 5.7, 0.8, { UpLeg: 0.5, Leg: 0.5 }],
      [knee - 7, 5.6, 5.8, 0.3, { Leg: 0.85, UpLeg: 0.15 }],
      [36, 5.7, 6.2, -0.6, { Leg: 1 }],
      [22, 4.5, 4.7, -1.2, { Leg: 1 }],
      [14, 4.9, 5.1, -1.6, { Leg: 0.75, Foot: 0.25 }],
      [10.5, 4.9, 5.1, -1.7, { Leg: 0.5, Foot: 0.5 }],
    ];
    body.tube(
      rings(
        LEG.map(([y, ru, rv, zc, w]) => ({ s: y, c: V(s * legX, y, zc), ru: ru * Wl, rv: rv * Wl, w: side(w, s) })),
        { color: () => col.bottom },
      ),
      { u: X, v: Z, seg: 16 },
    );

    // ── 신발 (z 앞으로): 둥근 앞코 + 평평한 밑창 ──
    const SHOE = [
      [-6.2, 4.3, 5.4, 5.8, { Foot: 1 }],
      [-3, 4.7, 6.2, 6.3, { Foot: 1 }],
      [1.5, 4.9, 5.0, 5.0, { Foot: 1 }],
      [6.5, 4.9, 3.8, 3.8, { Foot: 0.5, ToeBase: 0.5 }],
      [11.5, 4.7, 3.2, 3.2, { ToeBase: 1 }],
      [15.5, 4.1, 2.8, 2.9, { ToeBase: 1 }],
      [18, 3.1, 2.3, 2.5, { ToeBase: 1 }],
    ];
    const shoeKeys = (padU, padV, yc) => SHOE.map(([z, ru, rv, y, w]) => ({ s: z, c: V(s * legX, yc ?? y, z), ru: ru + padU, rv: rv + padV, w: side(w, s) }));
    body.tube(rings(shoeKeys(0, 0), { color: () => col.shoe, domeA: 1.4, domeB: 1.6 }), { u: X, v: Y, seg: 16, clampY: 0.75 });
    body.tube(rings(shoeKeys(0.35, 0, 0.9).map((k) => ({ ...k, rv: 0.9 })), { color: () => col.sole, domeA: 1.6, domeB: 1.8 }), { u: X, v: Y, seg: 16, clampY: 0 });

    // ── 팔 (어깨→손목 한 관). 어깨 쪽 링은 척추·쇄골에 묶여 팔을 내려도 어깨가 솟지 않는다 ──
    const elbow = Math.abs(P((s > 0 ? 'Left' : 'Right') + 'ForeArm').x);
    const sleeveCut = L.sleeve === 'short' ? 27 : 65.5;
    const ARM = [
      [10, 6.0, 6.2, 143.0, -4.5, { Spine2: 0.6, Shoulder: 0.4 }],
      [15, 6.2, 6.2, 143.4, -5.2, { Shoulder: 0.5, Arm: 0.5 }],
      [21, 5.5, 5.6, 143.9, -5.5, { Arm: 0.9, Shoulder: 0.1 }],
      ...(L.sleeve === 'short' ? [[26.6, 5.5, 5.6, 144, -5.5, { Arm: 1 }], [28, 4.6, 4.8, 144, -5.5, { Arm: 1 }]] : [[30, 4.8, 5.0, 144.0, -5.5, { Arm: 1 }]]),
      [elbow - 5, 4.3, 4.5, 144.0, -5.5, { Arm: 0.85, ForeArm: 0.15 }],
      [elbow, 4.1, 4.3, 144.0, -5.5, { Arm: 0.5, ForeArm: 0.5 }],
      [elbow + 5, 4.1, 4.4, 144.0, -5.5, { ForeArm: 0.85, Arm: 0.15 }],
      [58, 3.8, 4.1, 144.0, -5.5, { ForeArm: 1 }],
      ...(L.sleeve === 'short' ? [] : [[65, 3.75, 4.05, 144.0, -5.6, { ForeArm: 1 }], [66.2, 3.2, 3.6, 144.0, -5.6, { ForeArm: 1 }]]),
      [70.5, 2.9, 3.3, 144.0, -5.7, { ForeArm: 0.5, Hand: 0.5 }],
    ];
    body.tube(
      rings(
        ARM.map(([d, ru, rv, yc, zc, w]) => ({ s: d, c: V(s * d, yc, zc), ru: ru * Wl, rv: rv * Wl, w: side(w, s) })),
        { cuts: [sleeveCut], color: (d) => (d < sleeveCut ? col.outer : col.skin) },
      ),
      { u: Y, v: Z, seg: 16 },
    );

    // ── 손 (벙어리장갑형 손바닥 + 엄지) ──
    const HAND = [
      [69, 2.4, 3.3, 143.9, -5.7, { Hand: 0.6, ForeArm: 0.4 }],
      [73, 2.5, 4.0, 143.8, -5.8, { Hand: 1 }],
      [78, 2.4, 4.5, 143.7, -6.0, { Hand: 1 }],
      [82.5, 1.9, 4.3, 143.7, -6.1, { Hand: 0.6, HandMiddle1: 0.4 }],
      [86.5, 1.5, 3.8, 143.7, -6.1, { HandMiddle1: 0.5, HandMiddle2: 0.5 }],
      [88.5, 1.25, 3.1, 143.7, -6.1, { HandMiddle2: 1 }],
    ];
    body.tube(rings(HAND.map(([d, ru, rv, yc, zc, w]) => ({ s: d, c: V(s * d, yc, zc), ru, rv, w: side(w, s) })), { color: () => col.skin, domeB: 1.4 }), { u: Y, v: Z, seg: 14 });
    const pre = s > 0 ? 'Left' : 'Right';
    const t1 = P(pre + 'HandThumb1');
    const t3 = P(pre + 'HandThumb3');
    const tip = t3.clone().add(t3.clone().sub(t1).multiplyScalar(0.3));
    const tf = frameOf(tip.clone().sub(t1));
    body.tube(
      rings(
        [
          { s: 0, c: t1.clone().lerp(P(pre + 'Hand'), 0.35), ru: 1.6, rv: 1.4, w: side({ Hand: 0.7, HandThumb1: 0.3 }, s) },
          { s: 1, c: t1.clone().lerp(tip, 0.45), ru: 1.45, rv: 1.3, w: side({ HandThumb1: 0.5, HandThumb2: 0.5 }, s) },
          { s: 2, c: tip, ru: 1.2, rv: 1.1, w: side({ HandThumb3: 1 }, s) },
        ],
        { color: () => col.skin, domeB: 1.1 },
      ),
      { u: tf.u, v: tf.v, seg: 10 },
    );
  }

  // ── 겉감: 칼라 ──
  if (L.collar || L.jacket) {
    const cc = L.jacket ? col.top : coat ? col.coat : col.top;
    const open = L.jacket ? 0.08 : 0.42;
    const w = { Neck: 0.5, Spine2: 0.5 };
    over.tube(
      rings(
        [
          outerRing({ s: 149, c: V(0, 149, -3.2), ru: 9.0 * W, rv: 7.2, w, arc: [Math.PI / 2 + open, Math.PI / 2 + Math.PI * 2 - open] }),
          { s: 151.2, c: V(0, 151.2, -3.0), ru: 7.4, rv: 6.6, w, arc: [Math.PI / 2 + open, Math.PI / 2 + Math.PI * 2 - open] },
          { s: 153, c: V(0, 153, -2.8), ru: 6.4, rv: 6.0, w: { Neck: 1 }, arc: [Math.PI / 2 + open, Math.PI / 2 + Math.PI * 2 - open] },
        ],
        { color: () => cc },
      ),
      { u: X, v: Z, seg: 20 },
    );
  }

  // 치마형 자락 가중치: 아래로 갈수록 양쪽 허벅지를 따라간다 (걷기·앉기에 자연스럽게 펄럭)
  const skirtW = (maxK) => (p) => {
    const k = clamp((101 - p.y) / 35, 0, 1) * maxK;
    const f = clamp(p.x / 10, -1, 1);
    return { Hips: 1 - k, LeftUpLeg: k * (0.5 + 0.5 * f), RightUpLeg: k * (0.5 - 0.5 * f) };
  };

  // ── 코트: 안쪽 셔츠가 보이는 V 앞섶 + 허벅지 중간까지 오는 자락 ──
  if (coat) {
    const V0 = Math.PI / 2;
    over.tube(
      rings(
        [118, 125, 132, 139, 146].map((y) => {
          const a = 0.02 + ((y - 118) / 28) * 0.4;
          return torsoAt(y, CLOTH, [V0 - a, V0 + a]);
        }),
        { color: () => col.top },
      ),
      { u: X, v: Z, seg: 8 },
    );
    over.tube(
      rings(
        [
          outerRing({ s: 104, c: V(0, 104, 1.6), ru: 16.3 * W, rv: 10.9 * Wd, w: skirtW(0.6), arc: [V0 + 0.16, V0 + Math.PI * 2 - 0.16] }),
          outerRing({ s: 96, c: V(0, 96, 1.2), ru: 17.6 * W, rv: 11.8 * Wd, w: skirtW(0.6), arc: [V0 + 0.16, V0 + Math.PI * 2 - 0.16] }),
          { s: 78, c: V(0, 78, 1.0), ru: 18.8 * W, rv: 12.3 * Wd, w: skirtW(0.6), arc: [V0 + 0.2, V0 + Math.PI * 2 - 0.2] },
        ],
        { color: () => col.coat },
      ),
      { u: X, v: Z, seg: 30 },
    );
  }

  // ── 앞치마: 가슴받이 + 허리끈 + 무릎 위 치마 + 목끈 ──
  if (col.apron) {
    const V0 = Math.PI / 2;
    // 셰프(더블 재킷)는 단추가 보이도록 허리 앞치마(비스트로)만
    if (!L.jacket) over.tube(
      rings(
        [102, 110, 118, 126, 132, 137.5].map((y) => {
          const a = y < 112 ? 0.95 : 0.95 - ((y - 112) / 25.5) * 0.42;
          return torsoAt(y, (coat ? CLOTH * 2 : CLOTH) + 0.05, [V0 - a, V0 + a]);
        }),
        { color: () => col.apron },
      ),
      { u: X, v: Z, seg: 12 },
    );
    over.tube(rings([torsoAt(102.2, CLOTH + 0.35), torsoAt(104.8, CLOTH + 0.35)], { color: () => col.apron }), { u: X, v: Z, seg: 24 });
    const A = [V0 - 1.12, V0 + 1.12];
    over.tube(
      rings(
        [
          outerRing({ s: 104, c: V(0, 104, 1.6), ru: 16.2 * W + (coat ? CLOTH : 0), rv: 10.8 * Wd + (coat ? CLOTH : 0), w: skirtW(0.8), arc: A }),
          outerRing({ s: 97, c: V(0, 97, 1.4), ru: 17.2 * W + (coat ? CLOTH : 0), rv: 11.5 * Wd + (coat ? CLOTH : 0), w: skirtW(0.8), arc: A }),
          { s: 84, c: V(0, 84, 1.6), ru: 18.2 * W, rv: 11.9 * Wd, w: skirtW(0.8), arc: A },
          { s: 64, c: V(0, 64, 2.2), ru: 18.8 * W, rv: 11.7 * Wd, w: skirtW(0.8), arc: A },
        ],
        { cuts: [67.5], color: (y) => (y < 67.5 ? col.apronHem : col.apron) },
      ),
      { u: X, v: Z, seg: 22 },
    );
    // 목끈: 가슴받이 위 모서리 → 목 옆
    for (const s of L.jacket ? [] : [-1, 1]) {
      const top = torsoAt(137.5, CLOTH + 0.05);
      const a = 0.53;
      const p0 = V(s * Math.cos(V0 - a) * top.ru, 137.2, top.c.z + Math.sin(V0 - a) * top.rv);
      const p1 = V(s * 6.4, 150.2, -2.4);
      const f = frameOf(p1.clone().sub(p0));
      over.tube(
        rings(
          [
            { s: 0, c: p0, ru: 1.1, rv: 0.35, w: { Spine2: 1 } },
            { s: 1, c: p1, ru: 1.1, rv: 0.35, w: { Spine2: 0.6, Neck: 0.4 } },
          ],
          { color: () => col.apron },
        ),
        { u: f.v, v: f.u, seg: 8 },
      );
    }
  }

  return { body: body.geometry(), over: over.P.length ? over.geometry() : null };
}
