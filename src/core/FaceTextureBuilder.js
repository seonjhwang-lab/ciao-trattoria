import * as THREE from 'three';

// v12: 심즈4 · 동물의 숲 느낌의 2D 얼굴. 512×512 캔버스에 이목구비를 그려 머리 앞면 곡면(데칼)에 입힌다.
// 작은 3D 눈·입 조각에 잉크 외곽선이 덮여 까만 점처럼 뭉개지던 문제를 없앤다.
//  · 눈 6종(아몬드 · 반달 · 고양이 · 처진 · 초롱 · 지적) + 홍채색 · 하이라이트
//  · 눈썹 각도 · 볼터치 · 주근깨 · 미인점 · 콧수염
//  · 표정 5단계: idle(깜빡임 · 온화한 미소) / talk(입 열고 닫기) / delighted(별눈 · 활짝) / eating(볼 빵빵 · 오물오물) / satisfied(감동)
// 상태(눈 감음 · 입 모양)가 바뀔 때만 다시 그리므로 매 프레임 업로드하지 않는다.

const S = 512; // 그리는 좌표계 (실제 캔버스는 FACE_PX)
const FACE_PX = 256; // v15: 모바일 메모리 — 256×256
const FACE_K = FACE_PX / S;
// 데칼 구면 범위 (머리 구 기준): 가로 phi 1.8rad, 세로 theta 0.95~2.30
export const FACE_PHI = 1.8;
export const FACE_THETA0 = 0.95;
export const FACE_THETA = 1.35;
// 캔버스 좌표 (머리 형태에 맞춰 잡은 위치)
const EYE_Y = 196;
const EYE_DX = 102;
const BROW_Y = 110;
const MOUTH_Y = 360;
const CHEEK_Y = 302;
const CHEEK_DX = 168;

export const EYE_SHAPES = ['almond', 'crescent', 'cat', 'droopy', 'sparkly', 'smart'];
const IRIS = ['#5a3a22', '#3b2a1f', '#2f4a6a', '#3f5f3a', '#6b4a2a', '#4a3a5c', '#7a5530'];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// 외모(look)에 값이 없으면 외모 문자열로 정해지는 고정 개성 (같은 손님 = 항상 같은 얼굴)
export function faceTraits(L) {
  const h = hash(`${L.skin}|${L.hair}|${L.top}|${L.style}|${L.bottom}|${L.name ?? ''}`);
  const r = (n, k) => ((h >>> (k * 3)) % n);
  return {
    eye: L.eye ?? EYE_SHAPES[r(6, 0)],
    iris: L.iris ?? IRIS[r(IRIS.length, 1)],
    brow: L.brow ?? [-0.18, -0.06, 0.04, 0.14][r(4, 2)],
    blush: L.blush ?? r(3, 3) !== 0,
    freckles: L.freckles ?? r(5, 4) === 0,
    mole: L.mole ?? r(6, 5) === 0,
    mustache: L.mustache ?? (L.hat === 'chef' ? false : r(7, 6) === 0),
    lip: L.lip ?? ['#b8574a', '#c46a5a', '#a44a40'][r(3, 7)],
    browColor: L.style === 'bald' ? shade(L.skin, -0.35) : L.hair,
  };
}

function shade(hex, l) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, l);
  return `#${c.getHexString()}`;
}

// ───── v15 얼굴 텍스처 풀: 4장을 미리 만들어 돌려 쓴다 (동시에 더 필요할 때만 늘리고, 절대 버리지 않는다) ─────
const POOL = [];
function makeSlot() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FACE_PX;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 2;
  // 구면 u 는 정면에서 볼 때 오른쪽→왼쪽으로 늘어나므로 좌우를 뒤집어 캔버스와 같은 방향으로
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1;
  tex.offset.x = 1;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.userData.noToon = true;
  mat.userData.shared = true;
  tex.userData = { shared: true };
  const slot = { canvas, g, tex, mat, busy: false };
  POOL.push(slot);
  return slot;
}
function acquireSlot() {
  if (!POOL.length) for (let i = 0; i < 4; i++) makeSlot();
  const s = POOL.find((x) => !x.busy) ?? makeSlot();
  s.busy = true;
  return s;
}
/** 손님이 떠날 때 얼굴 텍스처를 풀에 돌려준다 (GPU 자원은 그대로 재사용) */
export function releaseFace(face) {
  if (face?.slot) face.slot.busy = false;
}
export function facePoolSize() {
  return { total: POOL.length, busy: POOL.filter((s) => s.busy).length };
}

export class FaceTexture {
  constructor(L) {
    this.L = L;
    this.t = faceTraits(L);
    // v15: 손님마다 캔버스 · 텍스처 · 재질을 새로 만들지 않고 풀에서 빌려 쓴다
    this.slot = acquireSlot();
    this.canvas = this.slot.canvas;
    this.g = this.slot.g;
    this.tex = this.slot.tex;
    this.key = '';
    this.blinkT = 2 + Math.random() * 3;
    this.time = Math.random() * 10;
    this.draw('idle', false, 0);
  }

  // expression: idle | talk | delighted | eating | satisfied
  update(dt, expression = 'idle') {
    this.time += dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.13) this.blinkT = 2.2 + Math.random() * 3.4;
    const blink = this.blinkT < 0 && (expression === 'idle' || expression === 'talk');
    let mouth = 0;
    if (expression === 'talk') mouth = Math.floor(this.time * 7) % 3; // 0 다묾 · 1 반 · 2 열림
    if (expression === 'eating') mouth = Math.floor(this.time * 5) % 2; // 오물오물
    if (expression === 'delighted') mouth = Math.floor(this.time * 3) % 2; // 별눈 반짝
    const key = `${expression}|${blink ? 1 : 0}|${mouth}`;
    if (key !== this.key) this.draw(expression, blink, mouth);
  }

  draw(expr, blink, mouth) {
    this.key = `${expr}|${blink ? 1 : 0}|${mouth}`;
    const g = this.g;
    const T = this.t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, FACE_PX, FACE_PX);
    g.setTransform(FACE_K, 0, 0, FACE_K, 0, 0); // 512 좌표로 그리고 256 캔버스에 축소
    // 볼터치 (기쁠 때 · 먹을 때 더 진하게)
    const blushA = (T.blush ? 0.32 : 0.12) + (expr === 'delighted' ? 0.3 : expr === 'eating' || expr === 'satisfied' ? 0.18 : 0);
    for (const s of [-1, 1]) {
      const cx = S / 2 + s * CHEEK_DX;
      const puff = expr === 'eating' ? 1.25 : 1;
      const gr = g.createRadialGradient(cx, CHEEK_Y, 4, cx, CHEEK_Y, 46 * puff);
      gr.addColorStop(0, `rgba(240,128,118,${blushA})`);
      gr.addColorStop(1, 'rgba(240,128,118,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(cx, CHEEK_Y, 52 * puff, 34 * puff, 0, 0, Math.PI * 2);
      g.fill();
      if (expr === 'eating') {
        // 볼이 볼록 (하이라이트)
        g.fillStyle = 'rgba(255,240,230,0.35)';
        g.beginPath();
        g.ellipse(cx - s * 8, CHEEK_Y - 12, 14, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (T.freckles) {
      g.fillStyle = 'rgba(150,90,60,0.45)';
      for (const s of [-1, 1])
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          g.arc(S / 2 + s * (120 + (i % 3) * 14 + Math.floor(i / 3) * 7), CHEEK_Y - 30 + Math.floor(i / 3) * 12, 3, 0, Math.PI * 2);
          g.fill();
        }
    }
    if (T.mole) {
      g.fillStyle = '#4a2e22';
      g.beginPath();
      g.arc(S / 2 + 62, MOUTH_Y - 14, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    // 심즈 · 동숲처럼 큼직한 이목구비: 각 부위를 제자리 중심으로 키워 그린다
    const big = (cx, cy, k, fn) => {
      g.save();
      g.translate(cx, cy);
      g.scale(k, k);
      g.translate(-cx, -cy);
      fn();
      g.restore();
    };
    big(S / 2, BROW_Y, 1.18, () => this.brows(expr));
    for (const s of [-1, 1]) big(S / 2 + s * EYE_DX, EYE_Y, 1.5, () => this.eye(S / 2 + s * EYE_DX, EYE_Y, s, expr, blink));
    if (T.mustache) {
      g.fillStyle = T.browColor;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(S / 2 + s * 26, MOUTH_Y - 30, 30, 11, s * 0.25, 0, Math.PI * 2);
        g.fill();
      }
    }
    big(S / 2, MOUTH_Y, 1.4, () => this.mouth(expr, mouth));
    this.tex.needsUpdate = true;
  }

  brows(expr) {
    const g = this.g;
    const T = this.t;
    g.strokeStyle = T.browColor;
    g.lineCap = 'round';
    g.lineWidth = 14;
    const lift = expr === 'delighted' ? -14 : expr === 'satisfied' ? -6 : 0;
    for (const s of [-1, 1]) {
      const cx = S / 2 + s * (EYE_DX + 4);
      const ang = T.brow + (expr === 'delighted' ? -0.12 : 0);
      const dx = 40;
      g.beginPath();
      g.moveTo(cx - s * dx, BROW_Y + lift + ang * 60 * 0.5);
      g.quadraticCurveTo(cx, BROW_Y + lift - 10, cx + s * dx, BROW_Y + lift - ang * 60);
      g.stroke();
    }
  }

  eye(cx, cy, s, expr, blink) {
    const g = this.g;
    const T = this.t;
    const ink = '#2b1d14';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // 눈을 감는 표정: 반달(행복) / 먹방 / 감동
    if (expr === 'eating' || expr === 'satisfied' || (expr === 'delighted' && T.eye !== 'sparkly' && T.eye !== 'almond')) {
      g.strokeStyle = ink;
      g.lineWidth = 10;
      g.beginPath();
      // ^ 모양 웃는 눈
      g.moveTo(cx - 34, cy + 10);
      g.quadraticCurveTo(cx, cy - 30, cx + 34, cy + 10);
      g.stroke();
      if (expr === 'satisfied') {
        // 감동의 눈물 반짝
        g.fillStyle = 'rgba(160,210,255,0.9)';
        g.beginPath();
        g.ellipse(cx + s * 30, cy + 26, 6, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    if (expr === 'delighted') {
      // 반짝이는 별눈
      this.star(cx, cy, 36, 15, '#f2b632', ink);
      return;
    }
    if (blink) {
      g.strokeStyle = ink;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(cx - 32, cy + 4);
      g.quadraticCurveTo(cx, cy + 16, cx + 32, cy + 4);
      g.stroke();
      return;
    }
    const shape = T.eye;
    let w = 36;
    let h = 26;
    let tilt = 0;
    if (shape === 'almond') (w = 38), (h = 25);
    if (shape === 'crescent') (w = 36), (h = 18);
    if (shape === 'cat') (w = 37), (h = 22), (tilt = -0.22);
    if (shape === 'droopy') (w = 35), (h = 24), (tilt = 0.2);
    if (shape === 'sparkly') (w = 34), (h = 34);
    if (shape === 'smart') (w = 34), (h = 20);
    g.save();
    g.translate(cx, cy);
    g.rotate(tilt * s);
    // 흰자 (아몬드꼴)
    g.fillStyle = '#fbf8f2';
    g.beginPath();
    g.moveTo(-w, 0);
    g.bezierCurveTo(-w * 0.55, -h * 1.15, w * 0.55, -h * 1.15, w, 0);
    g.bezierCurveTo(w * 0.55, h * (shape === 'crescent' ? 0.5 : 1.05), -w * 0.55, h * (shape === 'crescent' ? 0.5 : 1.05), -w, 0);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    // 홍채 + 동공 + 하이라이트
    const ir = shape === 'sparkly' ? 25 : 21;
    const gr = g.createRadialGradient(0, -3, 3, 0, 2, ir);
    gr.addColorStop(0, shade(T.iris, 0.18));
    gr.addColorStop(0.7, T.iris);
    gr.addColorStop(1, shade(T.iris, -0.18));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 2, ir, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a120d';
    g.beginPath();
    if (shape === 'cat') g.ellipse(0, 2, 5, 13, 0, 0, Math.PI * 2);
    else g.arc(0, 2, 10, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // 위 속눈썹 라인
    g.strokeStyle = '#2b1d14';
    g.lineWidth = shape === 'smart' ? 6 : 8;
    g.beginPath();
    g.moveTo(-w - 2, 1);
    g.bezierCurveTo(-w * 0.55, -h * 1.18, w * 0.55, -h * 1.18, w + 3, -2);
    g.stroke();
    if (shape === 'cat' || shape === 'almond') {
      g.beginPath();
      g.moveTo(w + 1, -2);
      g.lineTo(w + 12, -9);
      g.stroke();
    }
    // 하이라이트 (초롱초롱)
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(-7, -7, shape === 'sparkly' ? 8 : 6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(7, 8, shape === 'sparkly' ? 4.5 : 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (shape === 'smart') {
      // 지적인 눈: 아래 눈매 라인 살짝
      g.strokeStyle = 'rgba(43,29,20,0.45)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - 24, cy + 18);
      g.quadraticCurveTo(cx, cy + 24, cx + 24, cy + 18);
      g.stroke();
    }
  }

  star(cx, cy, R, r, fill, ink) {
    const g = this.g;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r : R;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = ink;
    g.stroke();
    g.fillStyle = '#fffbe8';
    g.beginPath();
    g.arc(cx - 8, cy - 8, 6, 0, Math.PI * 2);
    g.fill();
  }

  mouth(expr, m) {
    const g = this.g;
    const T = this.t;
    const cx = S / 2;
    const cy = MOUTH_Y;
    const ink = '#3a160f';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const openMouth = (w, h, tongue = true) => {
      g.fillStyle = '#6a2a22';
      g.beginPath();
      g.moveTo(cx - w, cy - 4);
      g.quadraticCurveTo(cx, cy - 10, cx + w, cy - 4);
      g.quadraticCurveTo(cx, cy + h * 2, cx - w, cy - 4);
      g.fill();
      if (tongue) {
        g.fillStyle = '#e2797a';
        g.beginPath();
        g.ellipse(cx, cy + h * 0.9, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fffaf2';
      g.fillRect(cx - w * 0.6, cy - 6, w * 1.2, Math.min(6, h * 0.3));
    };
    if (expr === 'delighted') return openMouth(40, 24);
    if (expr === 'talk') {
      if (m === 0) return this.smile(cx, cy, 26, 8, ink, T.lip);
      return openMouth(m === 1 ? 18 : 24, m === 1 ? 9 : 15);
    }
    if (expr === 'eating') {
      // 오물오물: 작은 입이 좌우로 움직이며 다물었다 폈다
      g.fillStyle = T.lip;
      g.beginPath();
      g.ellipse(cx + (m ? 6 : -6), cy + 2, m ? 16 : 12, m ? 7 : 10, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 4;
      g.stroke();
      return;
    }
    if (expr === 'satisfied') return this.smile(cx, cy, 34, 16, ink, T.lip);
    return this.smile(cx, cy, 28, 10, ink, T.lip);
  }

  smile(cx, cy, w, curve, ink, lip) {
    const g = this.g;
    g.strokeStyle = ink;
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(cx - w, cy - 2);
    g.quadraticCurveTo(cx, cy + curve * 2, cx + w, cy - 2);
    g.stroke();
    g.strokeStyle = lip;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - w * 0.5, cy + curve * 0.9);
    g.quadraticCurveTo(cx, cy + curve * 1.4, cx + w * 0.5, cy + curve * 0.9);
    g.stroke();
  }
}

// 머리 구(반지름 0.15 · 배율 0.96/1.08/1) 앞면을 감싸는 얇은 데칼 곡면
let decalGeo = null;
export function faceDecal(L) {
  const face = new FaceTexture(L);
  decalGeo =
    decalGeo ??
    new THREE.SphereGeometry(0.1512, 40, 28, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_THETA0, FACE_THETA);
  decalGeo.userData.shared = true;
  const m = new THREE.Mesh(decalGeo, face.slot.mat);
  m.scale.set(0.96, 1.08, 1);
  m.userData.noOutline = true;
  m.renderOrder = 3;
  m.castShadow = false;
  m.userData.face = face;
  return m;
}
