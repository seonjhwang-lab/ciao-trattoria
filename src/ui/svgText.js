// 10차: 줄바꿈 원천 차단용 'SVG 글자 배너'.
// 글자를 실제 폭으로 재서 viewBox 를 딱 맞게 잡으므로, 화면이 좁아지면 글자가 다음 줄로 떨어지는 대신
// 그림 전체가 비율 그대로 줄어든다 (CSS: width 100%, height auto).
const ctx = document.createElement('canvas').getContext('2d');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const FONT = {
  title: "'Playfair Display', 'Gowun Batang', serif",
  head: "'Gowun Batang', 'Playfair Display', serif",
  body: "'Pretendard', 'Noto Sans KR', system-ui, sans-serif",
};

function measure(l) {
  ctx.font = `${l.italic ? 'italic ' : ''}${l.weight ?? 700} ${l.size}px ${l.family ?? FONT.head}`;
  // 웹폰트가 아직 안 왔을 때를 대비해 8% 여유
  return ctx.measureText(l.text).width * 1.08 + (l.letter ?? 0) * l.text.length;
}

// lines: [{ text, size, weight, family, color, italic, letter }]
// opts: { pad, padY, gap, align: 'start'|'middle', minW, cls, label }
export function svgBanner(lines, opts = {}) {
  const pad = opts.pad ?? 6;
  const padY = opts.padY ?? 2;
  const gap = opts.gap ?? 2;
  const ws = lines.map(measure);
  const W = Math.ceil(Math.max(opts.minW ?? 0, ...ws) + pad * 2);
  let y = padY;
  const texts = lines.map((l) => {
    const lh = l.size * 1.22;
    y += lh;
    const base = y - l.size * 0.26;
    const x = opts.align === 'start' ? pad : W / 2;
    const out = `<text x="${x}" y="${base.toFixed(1)}" text-anchor="${opts.align === 'start' ? 'start' : 'middle'}" font-family="${esc(l.family ?? FONT.head)}" font-size="${l.size}" font-weight="${l.weight ?? 700}"${l.italic ? ' font-style="italic"' : ''}${l.letter ? ` letter-spacing="${l.letter}"` : ''} fill="${l.color ?? 'currentColor'}">${esc(l.text)}</text>`;
    y += gap;
    return out;
  });
  const H = Math.ceil(y - gap + padY);
  const label = esc(opts.label ?? lines.map((l) => l.text).join(' '));
  return `<svg class="svgt ${opts.cls ?? ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="${opts.align === 'start' ? 'xMinYMid' : 'xMidYMid'} meet" role="img" aria-label="${label}">${texts.join('')}</svg>`;
}

// 한 줄 요약: 쉼표·마침표 앞까지 (너무 길면 n자에서 자른다)
export function oneLine(t, n = 22) {
  const s = String(t ?? '').split(/[,.!?·]/)[0].trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
