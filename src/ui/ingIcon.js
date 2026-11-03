import { drawWhole, drawLayer, shade } from './minigames/draw.js';

// 재료 아이콘 (캔버스 그림 → 이미지). 이모티콘 대신 쓴다.
const cache = new Map();

export function ingIcon(ing) {
  if (cache.has(ing.id)) return cache.get(ing.id);
  const S = 96;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const inner = ing.inner ?? shade(ing.color, 25);
  if (ing.kind === 'loaf') drawWhole(g, { ...ing, kind: 'loaf' }, S / 2, S / 2, S * 0.8, S * 0.42);
  else if (ing.kind === 'round') drawWhole(g, { ...ing, kind: 'round', inner }, S / 2, S / 2 + 4, S * 0.6, S * 0.6);
  else if (ing.kind === 'oval') drawWhole(g, { ...ing, kind: 'oval', inner }, S / 2, S / 2, S * 0.7, S * 0.5);
  else if (ing.shape === 'leaf') drawWhole(g, { ...ing, kind: 'leaf', inner }, S / 2, S / 2, S * 0.72, S * 0.6);
  else if (ing.shape === 'strip') drawLayer(g, { ...ing, kind: 'strip', inner }, S / 2, S * 0.62, S * 0.8);
  else if (ing.shape === 'egg') drawLayer(g, { ...ing, kind: 'egg' }, S / 2, S * 0.7, S * 0.9);
  else if (ing.kind === 'spread') {
    g.fillStyle = ing.color;
    g.beginPath();
    g.ellipse(S / 2, S / 2, S * 0.34, S * 0.24, -0.3, 0, Math.PI * 2);
    g.fill();
    for (const [i, b] of (ing.bits ?? []).entries()) {
      g.fillStyle = b;
      for (let k = 0; k < 8; k++) g.fillRect(S * 0.3 + ((k * 37 + i * 11) % 40), S * 0.38 + ((k * 23 + i * 7) % 22), 3, 3);
    }
  } else {
    g.fillStyle = ing.color;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  const url = c.toDataURL('image/png');
  cache.set(ing.id, url);
  return url;
}

export function breadTopIcon(ing) {
  return ingIcon({ ...ing, id: ing.id + '_top' });
}
