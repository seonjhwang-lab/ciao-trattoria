// v15: 커스텀 터치 가로채기(전역 touchstart/touchend/pointercancel 판정 · elementFromPoint 재탐색 · 디바운스)를
// 전부 폐기하고 브라우저 표준 click 만 쓴다. 버튼 안의 아이콘 · 글씨는 CSS 로 pointer-events:none.
//
// bindTap(el, cb) 는 예전 호출부를 그대로 두기 위한 이름일 뿐, 이제는 순수 addEventListener('click') 이다.
export function bindTap(el, cb) {
  if (!el) return;
  if (el.tagName === 'BUTTON' && !el.hasAttribute('type')) el.type = 'button';
  el.addEventListener('click', (e) => cb(e));
}
export const onTap = bindTap;

// 예전 v12~v14 전역 보정 코드 자리 — 아무것도 가로채지 않는다
export function installTapShim() {}
