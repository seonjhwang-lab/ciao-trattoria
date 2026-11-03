// 숨김 이중 안전장치: .hidden 클래스가 붙은 패널(대화창 · 단골 수첩 · 인테리어 카탈로그 · 취향 저격 배너 · 워크벤치 …)은
// CSS 가 안 불러와져도 화면 아래로 줄줄이 나열되지 않도록 el.hidden + style.display='none' 까지 함께 건다.
export function setHidden(el, hide) {
  if (!el) return;
  el.classList.toggle('hidden', !!hide);
  apply(el, !!hide);
}

function apply(el, hide) {
  if (hide) {
    if (el.dataset.hg !== '1') {
      el.dataset.hg = '1';
      el.dataset.hgd = el.style.display || '';
    }
    el.hidden = true;
    el.style.display = 'none';
  } else if (el.dataset.hg === '1') {
    el.hidden = false;
    el.style.display = el.dataset.hgd ?? '';
    delete el.dataset.hg;
    delete el.dataset.hgd;
  }
}

const sweep = (root) => {
  if (root.nodeType !== 1) return;
  if (root.classList.contains('hidden')) apply(root, true);
  for (const el of root.querySelectorAll('.hidden')) apply(el, true);
};

// 모든 .hidden 토글을 자동으로 따라간다 (새로 붙는 요소 · 클래스 변경 둘 다)
export function installHiddenGuard(root = document.body) {
  sweep(root);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') apply(m.target, m.target.classList.contains('hidden'));
      else for (const n of m.addedNodes) sweep(n);
    }
  }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
}
