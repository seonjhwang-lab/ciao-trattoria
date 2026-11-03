// v15 플레이 설정 (기기별 편의 설정 — 저장이 안 되는 환경이어도 기본값으로 동작)
const KEY = 'ciao-trattoria-settings';
const defaults = { reactions: true };
let cur = { ...defaults };
try {
  cur = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {
  /* 저장소 차단 */
}

export function settings() {
  return cur;
}

/** 리액션 연출(줌인 · 긴 감탄 대사 · 품평 카드 · 긴 먹방)을 켤지 */
export function reactionsOn() {
  return cur.reactions !== false;
}

export function setSetting(k, v) {
  cur[k] = v;
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* 저장소 차단 */
  }
}
