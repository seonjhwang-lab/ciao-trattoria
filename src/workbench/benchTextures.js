import * as THREE from 'three';
import { slotTexture } from '../core/AssetLoader.js';
import { rng } from '../core/Textures.js';

// 워크벤치 클로즈업용 고밀도 절차적 텍스처. 같은 이름의 PNG 슬롯이 있으면 그 그림이 우선한다.
const cache = new Map();
const N = 256;

function canvas(size = N) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function cached(name, make) {
  if (!cache.has(name)) cache.set(name, slotTexture(name, make));
  return cache.get(name);
}

const rgba = (hex, a) => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};
const shade = (hex, l) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, l);
  return '#' + c.getHexString();
};

// 빵 단면: 크러스트 테두리 + 크기가 제각각인 기공 (천연발효는 큰 기공, 브리오슈는 촘촘)
export function drawCrumb(ctx, size, ing, { shape = 'loaf', open = 1 } = {}) {
  const r = rng(ing.slot.length * 31 + 7);
  ctx.save();
  ctx.fillStyle = ing.inner;
  ctx.fillRect(0, 0, size, size);
  const holes = ing.slot === 'sourdough' ? 140 : 260;
  for (let i = 0; i < holes; i++) {
    const x = r() * size;
    const y = r() * size;
    const big = r() < (ing.slot === 'sourdough' ? 0.16 : 0.04);
    const rad = (big ? 6 + r() * 12 : 1 + r() * 3.5) * open;
    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    g.addColorStop(0, rgba(shade(ing.inner, -0.32), 0.85));
    g.addColorStop(0.7, rgba(shade(ing.inner, -0.18), 0.6));
    g.addColorStop(1, rgba(shade(ing.inner, -0.05), 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rad * (0.7 + r() * 0.6), rad, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 결 방향의 미세한 섬유질
  ctx.strokeStyle = rgba(shade(ing.inner, 0.08), 0.25);
  for (let i = 0; i < 120; i++) {
    const x = r() * size;
    const y = r() * size;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y - 6, x + 2 + r() * 6, y - 10);
    ctx.stroke();
  }
  // 크러스트 쪽으로 갈수록 노릇해지는 그라데이션 (안쪽은 버터 크림)
  if (shape === 'loaf') {
    for (const [inset, col, lw] of [
      [0.06, rgba(shade(ing.inner, -0.06), 0.35), 0.09],
      [0.05, rgba(shade(ing.color, 0.28), 0.4), 0.06],
      [0.042, rgba(shade(ing.color, 0.12), 0.55), 0.04],
    ]) {
      ctx.lineWidth = size * lw;
      ctx.strokeStyle = col;
      ctx.beginPath();
      loafPath(ctx, size, inset);
      ctx.stroke();
    }
  }
  // 크러스트 테두리 (단면 모양을 따라)
  if (shape === 'loaf') {
    ctx.lineWidth = size * 0.075;
    ctx.strokeStyle = ing.color;
    ctx.beginPath();
    loafPath(ctx, size, 0.035);
    ctx.stroke();
    ctx.lineWidth = size * 0.02;
    ctx.strokeStyle = shade(ing.color, -0.14);
    ctx.beginPath();
    loafPath(ctx, size, 0.012);
    ctx.stroke();
  }
  ctx.restore();
}

// 빵 단면 윤곽 (프로필 셰이프와 같은 모양, 캔버스 좌표)
// 식빵(브리오슈·통밀) 단면 윤곽: 아래는 틀에 구운 네모반듯한 몸통, 위는 틀 위로 살짝 넘쳐 봉긋하게 부푼 구름 봉우리.
// 좌표 u(폭)·v(높이) ∈ -0.5..0.5. THREE.Shape 와 Canvas 2D 경로가 같은 함수를 쓴다 (m 으로 좌표 변환)
export function traceLoaf(p, m = (u, v) => [u, v]) {
  p.moveTo(...m(-0.41, -0.5));
  p.lineTo(...m(0.41, -0.5));
  p.quadraticCurveTo(...m(0.455, -0.5), ...m(0.455, -0.45));
  p.lineTo(...m(0.465, 0.02));
  p.quadraticCurveTo(...m(0.468, 0.1), ...m(0.5, 0.14));
  p.bezierCurveTo(...m(0.53, 0.3), ...m(0.33, 0.5), ...m(0, 0.5));
  p.bezierCurveTo(...m(-0.33, 0.5), ...m(-0.53, 0.3), ...m(-0.5, 0.14));
  p.quadraticCurveTo(...m(-0.468, 0.1), ...m(-0.465, 0.02));
  p.lineTo(...m(-0.455, -0.45));
  p.quadraticCurveTo(...m(-0.455, -0.5), ...m(-0.41, -0.5));
}

export function loafPath(ctx, size, inset = 0) {
  const P = (u, v) => [(u + 0.5) * size, (1 - (v + 0.5)) * size];
  const k = 1 - inset * 2;
  traceLoaf(ctx, (u, v) => P(u * k, v * k));
  ctx.closePath();
}

export function crumbTexture(ing) {
  return cached(`section_${ing.slot}`, () => {
    const [c, ctx] = canvas();
    drawCrumb(ctx, N, ing);
    return c;
  });
}

export function crustTexture(ing) {
  return cached(`crust_${ing.slot}`, () => {
    const [c, ctx] = canvas();
    const r = rng(91);
    const g = ctx.createLinearGradient(0, 0, 0, N);
    g.addColorStop(0, shade(ing.color, 0.08));
    g.addColorStop(1, shade(ing.color, -0.1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? rgba(shade(ing.color, -0.25), 0.25) : rgba('#fff4e0', 0.12);
      ctx.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 2);
    }
    // 칼집(쿠프)과 밀가루
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = rgba(shade(ing.inner, -0.05), 0.75);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(20 + i * 60, 40);
      ctx.quadraticCurveTo(45 + i * 60, 128, 30 + i * 60, 220);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,250,240,0.35)';
    for (let i = 0; i < 260; i++) ctx.fillRect(r() * N, r() * N, 1.5, 1.5);
    return c;
  });
}

// 둥근 과채 단면
export function sectionTexture(ing) {
  return cached(`section_${ing.slot}`, () => {
    const [c, ctx] = canvas();
    const cx = N / 2;
    const r = rng(ing.slot.length * 13);
    ctx.fillStyle = ing.color;
    ctx.fillRect(0, 0, N, N);
    if (ing.slot === 'tomato') {
      ctx.fillStyle = shade(ing.inner, 0.02);
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.47, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const x = cx + Math.cos(a) * N * 0.22;
        const y = cx + Math.sin(a) * N * 0.22;
        const g = ctx.createRadialGradient(x, y, 2, x, y, N * 0.16);
        g.addColorStop(0, rgba('#e98a5c', 0.95));
        g.addColorStop(1, rgba('#c94a35', 0.2));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, N * 0.15, N * 0.11, a, 0, Math.PI * 2);
        ctx.fill();
        for (let s = 0; s < 9; s++) {
          ctx.fillStyle = rgba('#f3dc8a', 0.95);
          ctx.beginPath();
          ctx.ellipse(x + (r() - 0.5) * N * 0.16, y + (r() - 0.5) * N * 0.1, 3.5, 2.2, r() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = rgba('#f2b29a', 0.6);
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (ing.slot === 'avocado') {
      const g = ctx.createRadialGradient(cx, cx, N * 0.12, cx, cx, N * 0.5);
      g.addColorStop(0, '#e4e09a');
      g.addColorStop(0.62, '#c6d27a');
      g.addColorStop(0.86, '#8fae4a');
      g.addColorStop(0.95, '#4d6a2a');
      g.addColorStop(1, ing.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.5, 0, Math.PI * 2);
      ctx.fill();
      const pit = ctx.createRadialGradient(cx - 8, cx - 8, 4, cx, cx, N * 0.18);
      pit.addColorStop(0, '#a8774e');
      pit.addColorStop(1, '#6b4429');
      ctx.fillStyle = pit;
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.17, 0, Math.PI * 2);
      ctx.fill();
    } else if (ing.slot === 'fig') {
      const g = ctx.createRadialGradient(cx, cx, 4, cx, cx, N * 0.5);
      g.addColorStop(0, '#f6d3b8');
      g.addColorStop(0.45, '#d4746f');
      g.addColorStop(0.8, '#b8485a');
      g.addColorStop(0.93, '#e8d6b8');
      g.addColorStop(1, ing.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.5, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 140; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * N * 0.38;
        ctx.fillStyle = rgba(r() < 0.5 ? '#f2e1a0' : '#7a2b33', 0.9);
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 2.2, 1.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ing.slot === 'cherry') {
      ctx.fillStyle = '#e05a3c';
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.48, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.3;
        const x = cx + Math.cos(a) * N * 0.2;
        const y = cx + Math.sin(a) * N * 0.2;
        ctx.fillStyle = rgba('#f09a68', 0.95);
        ctx.beginPath();
        ctx.ellipse(x, y, N * 0.15, N * 0.12, a, 0, Math.PI * 2);
        ctx.fill();
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = rgba('#f6e29a', 0.95);
          ctx.beginPath();
          ctx.ellipse(x + (r() - 0.5) * N * 0.14, y + (r() - 0.5) * N * 0.1, 4, 2.6, r() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = rgba('#f5b8a0', 0.8);
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (ing.slot === 'cucumber') {
      ctx.fillStyle = '#2f5a24';
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.5, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(cx, cx, 4, cx, cx, N * 0.46);
      g.addColorStop(0, '#eef5cf');
      g.addColorStop(0.55, '#d6e8a6');
      g.addColorStop(0.9, '#bcd98a');
      g.addColorStop(1, '#8fbf5e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.46, 0, Math.PI * 2);
      ctx.fill();
      // 씨앗 방 (세 갈래) + 반투명 씨앗
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = rgba('#e9f2c4', 0.95);
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * N * 0.13, cx + Math.sin(a) * N * 0.13, N * 0.13, N * 0.08, a, 0, Math.PI * 2);
        ctx.fill();
        for (let s = 0; s < 5; s++) {
          ctx.fillStyle = rgba('#f8fbe6', 0.95);
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * N * (0.07 + s * 0.03), cx + Math.sin(a) * N * (0.07 + s * 0.03), 4.5, 2.4, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (ing.slot === 'mozzarella') {
      const g = ctx.createRadialGradient(cx, cx, 4, cx, cx, N * 0.5);
      g.addColorStop(0, '#fffdf7');
      g.addColorStop(0.7, '#f8f4ea');
      g.addColorStop(1, '#ece5d4');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // 결 (늘어난 커드 섬유) + 우유 방울 기공
      ctx.strokeStyle = rgba('#e3dac6', 0.55);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(cx + (r() - 0.5) * 20, cx + (r() - 0.5) * 20, N * (0.1 + r() * 0.36), r() * 6, r() * 6 + 1.2);
        ctx.stroke();
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rgba('#e7dfcd', 0.7);
        ctx.beginPath();
        ctx.ellipse(cx + (r() - 0.5) * N * 0.7, cx + (r() - 0.5) * N * 0.7, 1 + r() * 2.5, 0.8 + r() * 1.5, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ing.slot === 'romaine') {
      // 잎이 겹겹이 말린 단면: 연노랑 속잎 → 초록 겉잎 동심 물결
      ctx.fillStyle = '#4f7f2e';
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.5, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 9; i >= 0; i--) {
        const rr = N * (0.05 + i * 0.047);
        const c2 = new THREE.Color('#f2f5d0').lerp(new THREE.Color('#7fae4a'), i / 9);
        ctx.fillStyle = '#' + c2.getHexString();
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) {
          const w = rr * (1 + Math.sin(a * 5 + i) * 0.06);
          ctx.lineTo(cx + Math.cos(a) * w, cx + Math.sin(a) * w * 0.8);
        }
        ctx.fill();
        ctx.strokeStyle = rgba('#3f6b2a', 0.35);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = ing.inner;
      ctx.beginPath();
      ctx.arc(cx, cx, N * 0.46, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

export function skinTexture(ing) {
  return cached(`skin_${ing.slot}`, () => {
    const [c, ctx] = canvas();
    const r = rng(ing.slot.length * 5);
    ctx.fillStyle = ing.color;
    ctx.fillRect(0, 0, N, N);
    if (ing.slot === 'cucumber') {
      for (let x = 0; x < N; x += 18) {
        ctx.fillStyle = rgba('#7fa856', 0.35);
        ctx.fillRect(x + r() * 4, 0, 5, N);
      }
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = rgba(r() < 0.5 ? '#c8dc9a' : '#1d3a14', 0.5);
        ctx.beginPath();
        ctx.arc(r() * N, r() * N, 0.8 + r() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ing.slot === 'romaine') {
      const g = ctx.createLinearGradient(0, 0, N, 0);
      g.addColorStop(0, '#e9f0c4');
      g.addColorStop(0.45, '#9cc463');
      g.addColorStop(1, '#4f7f2e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
      ctx.strokeStyle = rgba('#f4f8dc', 0.6);
      ctx.lineWidth = 2;
      for (let y = 10; y < N; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(N * 0.3, y + 6, N * 0.6, y - 6, N, y + 4);
        ctx.stroke();
      }
    } else if (ing.slot === 'mozzarella') {
      const g = ctx.createLinearGradient(0, 0, 0, N);
      g.addColorStop(0, '#fffdf8');
      g.addColorStop(1, '#efe8d8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
    } else if (ing.slot === 'avocado') {
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = rgba(r() < 0.5 ? '#1d2a14' : '#5b7a3a', 0.35);
        ctx.beginPath();
        ctx.arc(r() * N, r() * N, 0.8 + r() * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, N, N);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = rgba('#ffffff', 0.05);
        ctx.fillRect(r() * N, r() * N, 2, 1);
      }
    }
    return c;
  });
}

// 엔드그레인 월넛 도마: 나이테가 보이는 블록 모자이크
export function endgrainTexture() {
  return cached('board_endgrain', () => {
    const S = 512;
    const [c, ctx] = canvas(S);
    const r = rng(77);
    const bw = S / 8;
    const bh = S / 5;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 8; x++) {
        const base = ['#4a2f1e', '#5a3a25', '#3e2717', '#64432b'][Math.floor(r() * 4)];
        ctx.fillStyle = base;
        ctx.fillRect(x * bw, y * bh, bw, bh);
        const ox = x * bw + r() * bw;
        const oy = y * bh + (r() < 0.5 ? -bh * 0.6 : bh * 1.6);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x * bw, y * bh, bw, bh);
        ctx.clip();
        for (let ring = 0; ring < 34; ring++) {
          ctx.strokeStyle = `rgba(${ring % 3 ? '20,10,4' : '150,105,70'},${0.18 + r() * 0.12})`;
          ctx.lineWidth = 1 + r() * 1.6;
          ctx.beginPath();
          ctx.ellipse(ox, oy, 8 + ring * 6, 6 + ring * 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x * bw, y * bh, bw, 2);
        ctx.fillRect(x * bw, y * bh, 2, bh);
      }
    }
    return c;
  });
}

// 호랑이 무늬 크레마 (헤이즐넛 바탕 + 짙은 줄무늬 + 밝은 반점)
export function drawCrema(ctx, size, tiger = 1) {
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, size * 0.05, cx, cx, size * 0.5);
  g.addColorStop(0, '#c89262');
  g.addColorStop(0.65, '#a86a3c');
  g.addColorStop(1, '#6b3a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const r = rng(5);
  for (let i = 0; i < 70 * tiger; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * size * 0.45;
    ctx.strokeStyle = `rgba(70,32,12,${0.18 + r() * 0.25})`;
    ctx.lineWidth = 1 + r() * 2.5;
    ctx.beginPath();
    ctx.arc(cx, cx, d, a, a + 0.3 + r() * 0.8);
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(235,190,140,${0.12 + r() * 0.2})`;
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, 0.8 + r() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function cremaTexture() {
  return cached('crema', () => {
    const [c, ctx] = canvas();
    drawCrema(ctx, N);
    return c;
  });
}

// 황동 압력계 다이얼 (0~15 bar, 8.5~9.5 최적 구간)
export function gaugeTexture() {
  return cached('gauge_dial', () => {
    const S = 256;
    const [c, ctx] = canvas(S);
    const cx = S / 2;
    ctx.fillStyle = '#f1ead9';
    ctx.beginPath();
    ctx.arc(cx, cx, S / 2, 0, Math.PI * 2);
    ctx.fill();
    const ang = (bar) => (-225 + (bar / 15) * 270) * (Math.PI / 180);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(79,138,95,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cx, S * 0.38, ang(8.5), ang(9.5));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(166,94,63,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cx, S * 0.38, ang(12), ang(15));
    ctx.stroke();
    ctx.strokeStyle = '#2b2522';
    ctx.fillStyle = '#2b2522';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let b = 0; b <= 15; b++) {
      const a = ang(b);
      const major = b % 3 === 0;
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * S * 0.44, cx + Math.sin(a) * S * 0.44);
      ctx.lineTo(cx + Math.cos(a) * S * (major ? 0.36 : 0.4), cx + Math.sin(a) * S * (major ? 0.36 : 0.4));
      ctx.stroke();
      if (major) {
        ctx.font = 'bold 22px "Gowun Batang", serif';
        ctx.fillText(String(b), cx + Math.cos(a) * S * 0.27, cx + Math.sin(a) * S * 0.27);
      }
    }
    ctx.font = 'bold 18px "Gowun Batang", serif';
    ctx.fillText('BAR', cx, cx + S * 0.2);
    return c;
  });
}
