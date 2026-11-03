// v17: 실제로 눈에 보이는 영역(visualViewport) 동기화
// 모바일 브라우저(사파리 · 삼성 인터넷 · 크롬 · 인앱)는 주소창 · 하단 툴바 때문에 100vh/100dvh 가
// 실제 보이는 화면보다 클 수 있다. visualViewport 의 높이 · 위치를 CSS 변수로 넣고, #app · #ui · 렌더러가 그 크기를 따른다.
//   --vvh : 보이는 높이(px)   --vvw : 보이는 너비(px)   --vvt : 보이는 영역의 위쪽 오프셋(px)
const listeners = new Set();
let cur = measure();

function measure() {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth ?? 0) || window.innerWidth || 800;
  const h = Math.round(vv?.height ?? window.innerHeight ?? 0) || window.innerHeight || 600;
  const top = Math.max(0, Math.round(vv?.offsetTop ?? 0));
  const left = Math.max(0, Math.round(vv?.offsetLeft ?? 0));
  return { w, h, top, left };
}

function apply() {
  const s = measure();
  const changed = s.w !== cur.w || s.h !== cur.h || s.top !== cur.top || s.left !== cur.left;
  cur = s;
  const r = document.documentElement.style;
  r.setProperty('--vvh', `${s.h}px`);
  r.setProperty('--vvw', `${s.w}px`);
  r.setProperty('--vvt', `${s.top}px`);
  r.setProperty('--vvl', `${s.left}px`);
  r.setProperty('--ah', `${s.h}px`);
  r.setProperty('--aw', `${s.w}px`);
  if (changed) for (const f of listeners) f(s);
}

let installed = false;
export function installViewportSync() {
  if (installed) return;
  installed = true;
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
  }
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
  // 주소창이 접히거나 펴지는 애니메이션 중에도 따라가도록 잠시 동안 몇 번 더 잰다
  window.addEventListener('scroll', apply, { passive: true });
  apply();
  for (const t of [100, 400, 1000]) setTimeout(apply, t);
  // 이벤트를 빠뜨리는 인앱 브라우저 · 툴바 애니메이션 대비: 0.4초마다 실제 크기를 재서 바뀌었을 때만 반영
  setInterval(() => {
    const s = measure();
    if (s.w !== cur.w || s.h !== cur.h || s.top !== cur.top || s.left !== cur.left) apply();
  }, 400);
}

/** 지금 보이는 영역 {w, h, top, left} */
export function viewport() {
  return cur;
}

export function onViewportChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
