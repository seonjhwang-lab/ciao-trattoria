// 커스텀 SVG 아이콘 (24×24 라인 일러스트, currentColor). 게임 전체에서 이모티콘 대신 쓴다.
const P = {
  book: '<path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h10.5"/><path d="M9 8.5h5M9 11h3.5" opacity=".6"/><path d="M19.5 6.5V20" opacity=".5"/>',
  restart: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V9h4.5"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5" opacity=".55"/><path d="M12 9v6M10 10.2h3a1.3 1.3 0 0 1 0 2.6h-2a1.3 1.3 0 0 0 0 2.6h3"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  sunrise: '<path d="M4 17h16M7 17a5 5 0 0 1 10 0M12 4v4M9.5 6.5 12 4l2.5 2.5M4.5 13l1.5.6M19.5 13l-1.5.6"/><path d="M6 20.5h12" opacity=".5"/>',
  sunset: '<path d="M4 17h16M7 17a5 5 0 0 1 10 0M12 8V4M9.5 5.5 12 8l2.5-2.5M4.5 13l1.5.6M19.5 13l-1.5.6"/><path d="M6 20.5h12" opacity=".5"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none"/>',
  fast: '<path d="M4 6v12l8-6zM12 6v12l8-6z" fill="currentColor" stroke="none"/>',
  soundOn: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  rotL: '<path d="M4.5 9A8 8 0 1 1 4 13.5"/><path d="M4 4.5V9h4.5"/>',
  rotR: '<path d="M19.5 9A8 8 0 1 0 20 13.5"/><path d="M20 4.5V9h-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  cafe: '<path d="M4.5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.8M8 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3"/>',
  hammer: '<path d="M14 6.5l3.5 3.5M5 19l8.2-8.2M11 4.5l5-1 4.5 4.5-1 5-3.5-3.5-2.5 2.5-3-3 2.5-2.5z"/>',
  chat: '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h0a2 2 0 0 1-2-2z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.6"/>',
  knife: '<path d="M3.5 18.5L15 7l3.5 3.5-8 7.5c-2 1.8-4.8 2-7 .5z"/><path d="M15 7l2.5-2.5 3.5 3.5L18.5 10.5"/>',
  serve: '<path d="M3.5 17.5h17M5.5 17.5a6.5 6.5 0 0 1 13 0M12 9V7.5M10.5 7.5h3"/><path d="M8 13.5a4.5 4.5 0 0 1 3-2.5" opacity=".55"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  undo: '<path d="M9 7.5L4.5 12 9 16.5"/><path d="M4.5 12h10a5 5 0 0 1 0 10h-2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.3 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  sparkle: '<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" fill="currentColor"/><path d="M19 15.5c.2 1.5.8 2.1 2.3 2.3-1.5.2-2.1.8-2.3 2.3-.2-1.5-.8-2.1-2.3-2.3 1.5-.2 2.1-.8 2.3-2.3z" fill="currentColor"/>',
  note: '<path d="M9.5 17.5V5.5l9-2v12"/><circle cx="7" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16" cy="15.5" r="2.5" fill="currentColor"/>',
  drop: '<path d="M12 3.5s6 6.6 6 10.7a6 6 0 0 1-12 0C6 10.1 12 3.5 12 3.5z" fill="currentColor"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  wand: '<path d="M5 19L15.5 8.5M14 4.5v2M18.5 9h2M17.2 5.8l1.4-1.4M12 7.5l4.5 4.5"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  arrow: '<path d="M12 20V6M6.5 11.5 12 6l5.5 5.5"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.5-6.5L15 17v4M8 11l2.5-3.5h3L16 11l2 1M12.5 14.5 13.5 8"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  // 메뉴
  americano: '<path d="M5.5 8h11l-1.2 10.2a2 2 0 0 1-2 1.8H8.7a2 2 0 0 1-2-1.8z"/><path d="M16.3 10.5h1.2a2.2 2.2 0 0 1 0 4.4h-1.7M6 11h10" opacity=".55"/>',
  latte: '<path d="M4.5 9.5h13v3.5a6.5 6.5 0 0 1-13 0z"/><path d="M17.5 11h1a2.3 2.3 0 0 1 0 4.6H17M8 11.8c1.2-1.4 2.4.5 3-1 .6 1.5 1.8-.4 3 1"/><path d="M5 21h12"/>',
  vanilla: '<path d="M7 8.5h10l-1 11a1.5 1.5 0 0 1-1.5 1.4h-5A1.5 1.5 0 0 1 8 19.5z"/><path d="M7.5 13.5h9M12 3.5c1.5 1.2 1.5 3 0 4.2-1.5-1.2-1.5-3 0-4.2z"/>',
  blt: '<path d="M4 9.5c0-2.5 3.6-4 8-4s8 1.5 8 4z"/><path d="M3.5 12.5c1.6 1 3.2-1 4.8 0s3.2-1 4.8 0 3.2-1 4.8 0 2 .5 2.6 0"/><path d="M4 15h16M5 18.5h14"/>',
  toast: '<path d="M6.5 20V10.5A4 4 0 0 1 4.5 7a3.5 3.5 0 0 1 3.5-3.5h8A3.5 3.5 0 0 1 19.5 7a4 4 0 0 1-2 3.5V20z"/><path d="M9 12.5l2 1.5 2.5-2 2 1.5" opacity=".6"/>',
  avocado: '<path d="M12 3.5c-3 0-5.5 5-5.5 9.5a5.5 5.5 0 0 0 11 0C17.5 8.5 15 3.5 12 3.5z"/><circle cx="12" cy="14" r="2.4" fill="currentColor"/>',
  fig: '<path d="M12 5.5c-1-1.2-1-2 0-2.5M12 5.5c-4 1.5-6.5 6-6.5 9a6.5 6.5 0 0 0 13 0c0-3-2.5-7.5-6.5-9z"/><path d="M9.5 15.5h.01M12 17h.01M14.5 15h.01M12 13h.01" stroke-width="2.2"/>',
  pesto: '<path d="M12 20.5c-4.5 0-8-4-8-9.5 4.5 0 8 3.5 8 9.5zM12 20.5c4.5 0 8-4 8-9.5-4.5 0-8 3.5-8 9.5zM12 20.5V8"/><path d="M12 8c0-2 1-3.5 2.5-4.5" opacity=".6"/>',
  pasta: '<path d="M4.5 12.5h15a7.5 7.5 0 0 1-15 0z"/><path d="M8 12.5c0-3 1.5-5 3-7M11 12.5c0-3.2 1.2-5.8 3.2-8M14 12.5c.2-2.6 1.4-4.6 3.5-6"/>',
  pizza: '<path d="M12 21L4 6.5a14 14 0 0 1 16 0z"/><path d="M5.5 9a11 11 0 0 1 13 0"/><circle cx="11" cy="11.5" r="1.3"/><circle cx="13.5" cy="15" r="1.1"/><circle cx="10" cy="15.5" r=".9"/>',
  salad: '<path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z"/><path d="M7 12c-.5-2.5 1-4.5 3-4.5M10.5 12c0-3 2-5 4.5-4.5M15 12c.5-2 2-3 3.5-2.5"/><circle cx="12.5" cy="9.5" r="1.2"/>',
  // 옵션
  decaf: '<path d="M5.5 9h10l-1 9a2 2 0 0 1-2 1.8h-4a2 2 0 0 1-2-1.8z"/><path d="M4 4l16 16"/>',
  oat: '<path d="M12 21V9M12 9c-2.5-.5-3.5-3-3-5.5 2.5.5 3.5 3 3 5.5zM12 13c-2.5-.5-3.5-3-3-5.5M12 13c2.5-.5 3.5-3 3-5.5M12 17c-2.5-.5-3.5-3-3-5.5M12 17c2.5-.5 3.5-3 3-5.5"/>',
  oil: '<path d="M10 3.5h4v3l1.5 2.5v10a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5V9L10 6.5z"/><path d="M8.5 13h7" opacity=".55"/>',
  pepper: '<path d="M9 3.5h6l-.8 3h-4.4zM9.2 6.5h5.6l1 13a1.5 1.5 0 0 1-1.5 1.5h-4.6a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8.5 12h7" opacity=".55"/>',
  honey: '<path d="M6.5 8.5h11v9a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3z"/><path d="M8 5.5h8v3H8zM12 12.5v4"/>',
  syrup: '<path d="M9 9h6v10.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 19.5zM11 9V5h2v4M13 5h4v2"/>',
  // 조리 도구
  grind: '<path d="M7 3.5h10l-2 5H9z"/><rect x="7.5" y="8.5" width="9" height="8" rx="1.5"/><path d="M10 20.5h4M12 16.5v4"/>',
  tamp: '<circle cx="12" cy="5.5" r="2.5"/><path d="M12 8v6M6.5 14h11v2.5h-11zM5 20.5h14"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.4" fill="currentColor"/>',
  steam: '<path d="M7 9.5h9l-1 10H8z"/><path d="M9.5 6.5c-.8-1 .8-2 0-3M13.5 6.5c-.8-1 .8-2 0-3M16 11.5h1.5a2 2 0 0 1 0 4H15.5"/>',
  pour: '<path d="M4.5 8.5l6-2 4 7-4.5 2.5z"/><path d="M14.5 13.5l2 4.5M7 21h12" opacity=".7"/>',
  spread: '<path d="M4 20l9.5-9.5M13.5 10.5l3-3a2.1 2.1 0 0 1 3 3l-3 3z"/><path d="M5 15.5c2-1 4 1 6 0" opacity=".6"/>',
  plate: '<ellipse cx="12" cy="13" rx="9" ry="5.5"/><ellipse cx="12" cy="13" rx="5" ry="2.8" opacity=".55"/>',
  joystick: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
};

// 크기는 HTML 속성(18) + 인라인 style 로 직접 박아 둔다. CSS 가 아예 안 불러와져도 아이콘이 화면 전체로 커지지 않는다.
// (CSS 의 .x .ic { width } 규칙은 --icw/--ich 로도 같은 값을 넣어 두어 디자인 크기를 그대로 쓴다)
const IC_STYLE = 'width:var(--icw,18px);height:var(--ich,18px);max-width:48px;max-height:48px;flex-shrink:0;display:inline-block;vertical-align:middle';
export function icon(name, cls = '') {
  const body = P[name] ?? P.sparkle;
  return `<svg class="ic ${cls}" width="18" height="18" style="${IC_STYLE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const ICONS = Object.keys(P);
