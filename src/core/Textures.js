import * as THREE from 'three';

// 현실 톤 프로시저럴 텍스처 (외부 이미지 없음): 원목 결, 적벽돌, 회벽, 세라믹 타일, 헤링본, 테라조, 콘크리트
const cache = new Map();
const SIZE = 512;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}

function noise(ctx, size, alpha, seed, count = 9000) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
}

// 큰 얼룩(회벽/콘크리트) — 가장자리를 넘어가면 반대편에도 그려 이음새 없이 반복
function blotches(ctx, size, colors, seed, n = 40, rmin = 30, rmax = 140, alpha = 0.22) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = rmin + r() * (rmax - rmin);
    const col = new THREE.Color(colors[Math.floor(r() * colors.length)]);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
        g.addColorStop(0, `rgba(${rgb},${alpha})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }
}

function woodGrain(ctx, w, h, base, seed, vertical = false) {
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const len = vertical ? h : w;
  const across = vertical ? w : h;
  for (let i = 0; i < across * 0.55; i++) {
    const p = r() * across;
    const dark = r() > 0.45;
    ctx.strokeStyle = dark ? `rgba(30,15,5,${0.05 + r() * 0.14})` : `rgba(255,235,200,${0.03 + r() * 0.08})`;
    ctx.lineWidth = 0.6 + r() * 2.2;
    ctx.beginPath();
    const amp = 2 + r() * 6;
    const freq = 0.004 + r() * 0.01;
    const ph = r() * 10;
    for (let t = 0; t <= len; t += 8) {
      const q = p + Math.sin(t * freq + ph) * amp + Math.sin(t * freq * 3.1 + ph) * amp * 0.25;
      if (vertical) t === 0 ? ctx.moveTo(q, t) : ctx.lineTo(q, t);
      else t === 0 ? ctx.moveTo(t, q) : ctx.lineTo(t, q);
    }
    ctx.stroke();
  }
  // 옹이
  for (let k = 0; k < 2; k++) {
    if (r() > 0.6) continue;
    const x = r() * w;
    const y = r() * h;
    for (let ring = 0; ring < 5; ring++) {
      ctx.strokeStyle = `rgba(35,18,8,${0.12 - ring * 0.02})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, (vertical ? 4 : 14) + ring * 4, (vertical ? 14 : 4) + ring * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

const painters = {
  plain(ctx, [c0]) {
    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, SIZE, SIZE);
    noise(ctx, SIZE, 0.05, 3);
  },
  wood(ctx, [c0], seed = 5) {
    woodGrain(ctx, SIZE, SIZE, c0, seed);
    noise(ctx, SIZE, 0.04, seed + 1, 4000);
  },
  brick(ctx, colors, spec) {
    const mortar = spec.mortar ?? '#b8ada0';
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, SIZE, SIZE);
    noise(ctx, SIZE, 0.12, 9);
    const rows = 12;
    const cols = 4;
    const bh = SIZE / rows;
    const bw = SIZE / cols;
    const r = rng(17);
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? bw / 2 : 0;
      for (let x = -1; x <= cols; x++) {
        const bx = x * bw + off + 3;
        const by = y * bh + 3;
        const col = colors[Math.floor(r() * colors.length)];
        ctx.fillStyle = shade(col, (r() - 0.5) * 0.06);
        ctx.fillRect(bx, by, bw - 6, bh - 6);
        // 벽돌 표면 얼룩
        for (let s = 0; s < 18; s++) {
          ctx.fillStyle = `rgba(${r() > 0.5 ? '255,220,190' : '40,15,8'},${0.05 + r() * 0.08})`;
          ctx.fillRect(bx + r() * (bw - 10), by + r() * (bh - 10), 3 + r() * 10, 2 + r() * 4);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(bx, by + bh - 9, bw - 6, 3);
      }
    }
  },
  plaster(ctx, colors) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, SIZE, SIZE);
    blotches(ctx, SIZE, colors.slice(1), 21, 46, 40, 150, 0.28);
    noise(ctx, SIZE, 0.06, 22, 14000);
  },
  concrete(ctx, colors) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, SIZE, SIZE);
    blotches(ctx, SIZE, colors.slice(1), 31, 30, 50, 180, 0.3);
    noise(ctx, SIZE, 0.08, 32, 16000);
    ctx.strokeStyle = 'rgba(60,55,50,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, SIZE, SIZE);
  },
  subway(ctx, [c0, grout]) {
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rows = 8;
    const cols = 4;
    const th = SIZE / rows;
    const tw = SIZE / cols;
    const r = rng(41);
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? tw / 2 : 0;
      for (let x = -1; x <= cols; x++) {
        const g = ctx.createLinearGradient(0, y * th, 0, y * th + th);
        const c = shade(c0, (r() - 0.5) * 0.03);
        g.addColorStop(0, shade(c, 0.03));
        g.addColorStop(1, shade(c, -0.04));
        ctx.fillStyle = g;
        ctx.fillRect(x * tw + off + 3, y * th + 3, tw - 6, th - 6);
      }
    }
  },
  wainscot(ctx, [top, panel, rail], spec) {
    // 텍스처 1장 = 벽 전체 높이(2.8m). 아래 1m(36%)가 웨인스코팅(원목 또는 페인트 패널)
    painters.plaster(ctx, [top, shade(top, -0.025), shade(top, 0.02)]);
    const y0 = SIZE * 0.64;
    const H = SIZE - y0;
    if (spec.painted) {
      // 페인트 패널: 판재 사이 V홈 + 테두리 몰딩의 밝은 윗면 / 그늘진 아랫면
      ctx.fillStyle = panel;
      ctx.fillRect(0, y0, SIZE, H);
      noise(ctx, SIZE, 0.025, 63, 2500);
      for (let x = 0; x < SIZE; x += SIZE / 4) {
        const px = x + 18;
        const py = y0 + 30;
        const pw = SIZE / 4 - 36;
        const ph = H - 78;
        ctx.fillStyle = shade(panel, 0.05);
        ctx.fillRect(px, py, pw, ph);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(px - 5, py - 5, pw + 10, 4);
        ctx.fillRect(px - 5, py - 5, 4, ph + 10);
        ctx.fillStyle = 'rgba(40,50,30,0.22)';
        ctx.fillRect(px - 5, py + ph + 1, pw + 10, 4);
        ctx.fillRect(px + pw + 1, py - 5, 4, ph + 10);
      }
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = SIZE;
      tmp.height = H;
      woodGrain(tmp.getContext('2d'), SIZE, H, panel, 77, true);
      ctx.drawImage(tmp, 0, y0);
      for (let x = 0; x < SIZE; x += SIZE / 4) {
        ctx.strokeStyle = 'rgba(60,35,15,0.3)';
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 16, y0 + 24, SIZE / 4 - 32, H - 70);
        ctx.strokeStyle = 'rgba(255,235,205,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 20, y0 + 28, SIZE / 4 - 40, H - 78);
      }
    }
    // 체어레일 몰딩 (위 밝은 선 · 아래 그림자)
    ctx.fillStyle = rail;
    ctx.fillRect(0, y0 - 12, SIZE, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(0, y0 - 12, SIZE, 3);
    ctx.fillStyle = 'rgba(60,45,30,0.18)';
    ctx.fillRect(0, y0 + 4, SIZE, 4);
  },
  ceramic(ctx, colors, spec) {
    const grout = spec.grout ?? '#7d766d';
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const n = 4;
    const s = SIZE / n;
    const r = rng(51);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = colors[Math.floor(r() * colors.length)];
        ctx.fillStyle = shade(c, (r() - 0.5) * 0.04);
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        // 유약 얼룩
        const g = ctx.createRadialGradient(x * s + s * r(), y * s + s * r(), 0, x * s + s / 2, y * s + s / 2, s * 0.8);
        g.addColorStop(0, 'rgba(255,255,255,0.07)');
        g.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = g;
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      }
    }
    noise(ctx, SIZE, 0.05, 52, 7000);
  },
  // v12 시칠리아 체크 타일: 두 색이 번갈아 (줄눈 포함)
  checker(ctx, colors, spec) {
    ctx.fillStyle = spec.grout ?? '#cfc4b0';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const n = 4;
    const s = SIZE / n;
    const r = rng(77);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = shade(colors[(x + y) % 2], (r() - 0.5) * 0.04);
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
    noise(ctx, SIZE, 0.04, 78, 5000);
  },
  herringbone(ctx, colors) {
    const cw = 128;
    const ph = 64;
    const n = SIZE / ph;
    const cols = SIZE / cw;
    const plank = document.createElement('canvas');
    plank.width = 256;
    plank.height = 64;
    const pctx = plank.getContext('2d');
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      for (let k = -4; k < n + 4; k++) {
        const y = k * ph;
        const ki = ((k % n) + n) % n;
        const col = colors[(c * 7 + ki * 3 + ((ki * c) % 5)) % colors.length];
        woodGrain(pctx, 256, 64, col, c * 31 + ki);
        // 결은 은은하게 (멀리서 줄무늬로 보이지 않도록)
        pctx.globalAlpha = 0.5;
        pctx.fillStyle = col;
        pctx.fillRect(0, 0, 256, 64);
        pctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath();
        if (c % 2 === 0) {
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + cw, y - cw);
          ctx.lineTo(x0 + cw, y - cw + ph);
          ctx.lineTo(x0, y + ph);
        } else {
          ctx.moveTo(x0, y - cw);
          ctx.lineTo(x0 + cw, y);
          ctx.lineTo(x0 + cw, y + ph);
          ctx.lineTo(x0, y - cw + ph);
        }
        ctx.closePath();
        ctx.clip();
        ctx.translate(x0, y);
        ctx.rotate(c % 2 === 0 ? -Math.PI / 4 : Math.PI / 4);
        ctx.drawImage(plank, -cw * 1.25, -cw * 1.25, cw * 3, cw * 2.5); // 회전한 평행사변형을 빈틈없이 덮는다
        ctx.restore();
        ctx.strokeStyle = 'rgba(110,70,35,0.32)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  },
  terrazzo(ctx, [c0, ...chips]) {
    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, SIZE, SIZE);
    noise(ctx, SIZE, 0.05, 61, 8000);
    const r = rng(62);
    for (let i = 0; i < 340; i++) {
      const cx = r() * SIZE;
      const cy = r() * SIZE;
      const rad = 2 + r() * 8;
      const sides = 4 + Math.floor(r() * 3);
      ctx.fillStyle = chips[Math.floor(r() * chips.length)];
      for (const ox of [-SIZE, 0, SIZE]) {
        for (const oy of [-SIZE, 0, SIZE]) {
          ctx.beginPath();
          for (let s = 0; s < sides; s++) {
            const a = (s / sides) * Math.PI * 2 + i;
            const rr = rad * (0.55 + 0.45 * Math.sin(i * 1.7 + s));
            ctx.lineTo(cx + ox + Math.cos(a) * rr, cy + oy + Math.sin(a) * rr);
          }
          ctx.fill();
        }
      }
    }
  },
};

export function finishCanvas(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  (painters[spec.pattern] ?? painters.plain)(ctx, spec.colors ?? ['#999999'], spec);
  return canvas;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  return tex;
}

export function finishTexture(spec) {
  const key = JSON.stringify(spec);
  if (!cache.has(key)) cache.set(key, toTexture(finishCanvas(spec)));
  return cache.get(key);
}

// 가구용 원목 결 텍스처 (톤별로 하나씩 캐시)
export function woodTexture(base, seed = 5) {
  const key = `wood|${base}|${seed}`;
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    woodGrain(c.getContext('2d'), 256, 256, base, seed);
    cache.set(key, toTexture(c));
  }
  return cache.get(key);
}

// 칠판 / 간판 글씨
export function textTexture(lines, { w = 512, h = 384, bg = '#2b302c', fg = '#f1ede4', font = 'Nanum Pen Script', frame = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (bg !== 'transparent') blotches(ctx, Math.max(w, h), ['#ffffff'], 8, 10, 40, 120, 0.035);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const size = i === 0 ? Math.round(h * 0.2) : Math.round(h * 0.13);
    ctx.font = `${size}px "${font}", "Gowun Batang", serif`;
    const y = lines.length === 1 ? h / 2 : h * (0.2 + (i * 0.66) / (lines.length - 1));
    ctx.fillText(line, w / 2, y);
  });
  if (frame) {
    ctx.strokeStyle = frame;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  return tex;
}
