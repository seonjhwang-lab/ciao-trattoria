// 미니게임용 2D 재료 그림 (캔버스). 현실 톤 색감.
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function drawBoard(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#9c7449');
  g.addColorStop(1, '#7f5a36');
  ctx.fillStyle = g;
  roundRect(ctx, 6, 6, w - 12, h - 12, 22);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 46; i++) {
    ctx.strokeStyle = `rgba(40,22,8,${0.05 + hash(i) * 0.1})`;
    ctx.lineWidth = 1 + hash(i + 3) * 2;
    ctx.beginPath();
    const y = hash(i + 9) * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,15,5,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 6, 6, w - 12, h - 12, 22);
  ctx.stroke();
}

export function wholeSize(kind, S) {
  return (
    {
      loaf: [0.74, 0.36],
      round: [0.42, 0.42],
      leaf: [0.56, 0.44],
      oval: [0.52, 0.34],
      berry: [0.32, 0.36],
      long: [0.74, 0.16],
    }[kind] ?? [0.4, 0.3]
  ).map((v) => v * S);
}

export function drawWhole(ctx, ing, cx, cy, w, h) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  switch (ing.kind) {
    case 'loaf': {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, shade(ing.color, 25));
      g.addColorStop(1, shade(ing.color, -25));
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, h * 0.48);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = shade(ing.inner, -10);
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + w * (0.2 + i * 0.18), y + h * 0.25);
        ctx.lineTo(x + w * (0.28 + i * 0.18), y + h * 0.62);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,250,240,0.35)';
      for (let i = 0; i < 40; i++) ctx.fillRect(x + hash(i) * w, y + hash(i + 50) * h * 0.5, 2, 2);
      break;
    }
    case 'round': {
      const g = ctx.createRadialGradient(cx - w * 0.15, cy - h * 0.15, 2, cx, cy, w / 2);
      g.addColorStop(0, shade(ing.color, 30));
      g.addColorStop(1, shade(ing.color, -20));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#4b6b2e';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 8, cy - h * 0.36 + Math.sin(a) * 6, 9, 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.18, cy - h * 0.12, w * 0.07, h * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'leaf': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? ing.color : shade(ing.color, 18);
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * w * 0.18, cy + Math.sin(a) * h * 0.18, w * 0.3, h * 0.28, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = ing.inner;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * w * 0.42, cy + Math.sin(a) * h * 0.42);
        ctx.stroke();
      }
      break;
    }
    case 'oval': {
      ctx.fillStyle = ing.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 70; i++) {
        const a = hash(i) * Math.PI * 2;
        const r = Math.sqrt(hash(i + 7));
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * w * 0.45, cy + Math.sin(a) * r * h * 0.45, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.15, cy - h * 0.15, w * 0.2, h * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'berry': {
      const g = ctx.createRadialGradient(cx - w * 0.1, cy - h * 0.1, 2, cx, cy, w / 2);
      g.addColorStop(0, shade(ing.color, 25));
      g.addColorStop(1, shade(ing.color, -15));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy + h * 0.5);
      ctx.bezierCurveTo(cx - w * 0.7, cy + h * 0.1, cx - w * 0.5, cy - h * 0.45, cx, cy - h * 0.35);
      ctx.bezierCurveTo(cx + w * 0.5, cy - h * 0.45, cx + w * 0.7, cy + h * 0.1, cx, cy + h * 0.5);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#f1d27a';
      for (let i = 0; i < 18; i++) ctx.fillRect(cx + (hash(i) - 0.5) * w * 0.6, cy + (hash(i + 3) - 0.4) * h * 0.6, 2, 3);
      ctx.fillStyle = '#4b7a3a';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 10, cy - h * 0.38 + Math.sin(a) * 4, 10, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'long': {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, shade(ing.color, 20));
      g.addColorStop(1, shade(ing.color, -15));
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(200,230,170,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + h * 0.5, y + h * (0.3 + i * 0.2));
        ctx.lineTo(x + w - h * 0.5, y + h * (0.3 + i * 0.2));
        ctx.stroke();
      }
      break;
    }
    default:
      ctx.fillStyle = ing.color;
      roundRect(ctx, x, y, w, h, 12);
      ctx.fill();
  }
  ctx.restore();
}

// 칼질 자국: 단면(속살 색)이 살짝 드러나는 틈
export function drawCut(ctx, ing, x1, y1, x2, y2) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = ing.inner ?? shade(ing.color, 30);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,20,8,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// 빵 슬라이스 윗면 (바르기용). 바를 수 있는 안쪽 영역을 돌려준다
export function drawSliceTop(ctx, ing, cx, cy, s) {
  const x = cx - s / 2;
  const y = cy - s / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = ing.color;
  roundRect(ctx, x, y, s, s * 0.92, s * 0.2);
  ctx.fill();
  ctx.restore();
  const inset = s * 0.07;
  const inner = { x: x + inset, y: y + inset, w: s - inset * 2, h: s * 0.92 - inset * 2, r: s * 0.15 };
  ctx.fillStyle = ing.inner;
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, inner.r);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,80,40,0.18)';
  for (let i = 0; i < 90; i++) {
    ctx.beginPath();
    ctx.ellipse(inner.x + hash(i) * inner.w, inner.y + hash(i + 40) * inner.h, 1 + hash(i + 2) * 3, 1 + hash(i + 5) * 2, hash(i) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return inner;
}

// 쌓기 화면의 옆모습 레이어. 사용한 높이를 돌려준다
export function drawLayer(ctx, ing, cx, yBottom, w, isTop = false) {
  const k = ing.kind;
  ctx.save();
  let h = w * 0.05;
  if (k === 'bread') {
    h = w * 0.13;
    ctx.fillStyle = ing.inner;
    roundRect(ctx, cx - w / 2, yBottom - h, w, h, isTop ? h * 0.7 : 8);
    ctx.fill();
    ctx.strokeStyle = ing.color;
    ctx.lineWidth = 4;
    roundRect(ctx, cx - w / 2, yBottom - h, w, h, isTop ? h * 0.7 : 8);
    ctx.stroke();
  } else if (k === 'leaf' || k === 'herb') {
    h = k === 'leaf' ? w * 0.06 : w * 0.035;
    ctx.fillStyle = ing.color;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.56, yBottom);
    for (let i = 0; i <= 12; i++) ctx.lineTo(cx - w * 0.56 + (w * 1.12 * i) / 12, yBottom - h * (i % 2 ? 1.3 : 0.5));
    ctx.lineTo(cx + w * 0.56, yBottom);
    ctx.closePath();
    ctx.fill();
  } else if (k === 'strip') {
    h = w * 0.05;
    ctx.fillStyle = ing.color;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.52, yBottom);
    for (let i = 0; i <= 10; i++) ctx.lineTo(cx - w * 0.52 + (w * 1.04 * i) / 10, yBottom - h - Math.sin(i * 1.4) * h * 0.4);
    ctx.lineTo(cx + w * 0.52, yBottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ing.inner;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, yBottom - h * 0.5);
    ctx.lineTo(cx + w * 0.5, yBottom - h * 0.5);
    ctx.stroke();
  } else if (k === 'round' || k === 'oval' || k === 'long' || k === 'berry') {
    h = w * (k === 'berry' ? 0.08 : 0.055);
    const n = k === 'long' ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const sx = cx - w * 0.42 + (w * 0.84 * i) / (n - 1);
      ctx.fillStyle = ing.color;
      ctx.beginPath();
      ctx.ellipse(sx, yBottom - h / 2, w * 0.13, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ing.inner ?? ing.color;
      ctx.beginPath();
      ctx.ellipse(sx, yBottom - h / 2, w * 0.1, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (k === 'egg') {
    h = w * 0.12;
    ctx.fillStyle = ing.color;
    ctx.beginPath();
    ctx.ellipse(cx, yBottom - h * 0.45, w * 0.3, h * 0.5, 0, Math.PI, 0);
    ctx.lineTo(cx + w * 0.3, yBottom);
    ctx.lineTo(cx - w * 0.3, yBottom);
    ctx.fill();
    ctx.fillStyle = ing.inner;
    ctx.beginPath();
    ctx.ellipse(cx, yBottom - h * 0.7, w * 0.1, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (k === 'mash') {
    h = w * 0.08;
    ctx.fillStyle = ing.color;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, yBottom);
    for (let i = 0; i <= 14; i++) ctx.lineTo(cx - w * 0.5 + (w * i) / 14, yBottom - h * (0.75 + hash(i) * 0.4));
    ctx.lineTo(cx + w * 0.5, yBottom);
    ctx.fill();
  } else if (k === 'sprinkle') {
    h = w * 0.015;
    ctx.fillStyle = ing.color;
    for (let i = 0; i < 26; i++) ctx.fillRect(cx - w * 0.45 + hash(i) * w * 0.9, yBottom - h - hash(i + 4) * 6, 3, 3);
  } else if (k === 'drizzle') {
    h = w * 0.02;
    ctx.strokeStyle = ing.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) ctx.lineTo(cx - w * 0.45 + (w * 0.9 * i) / 16, yBottom - h + Math.sin(i * 1.1) * 4);
    ctx.stroke();
  } else {
    ctx.fillStyle = ing.color;
    ctx.fillRect(cx - w / 2, yBottom - h, w, h);
  }
  ctx.restore();
  return h;
}

export function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
