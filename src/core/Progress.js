// v12 장기 플레이 루프: 설비 해금 · 인테리어 카탈로그(아늑함 지수) · 일일 정산 · 단골 호감도
import { bus } from './EventBus.js';

export const GUESTS_PER_DAY = 5;

// 설비 해금 (Stage 1 은 처음부터: 에스프레소 바 + 브런치 토스트)
export const STAGES = [
  { id: 'base', stage: 1, name: '브런치 & 에스프레소 바', price: 0, stations: ['espresso', 'sandwich'], icon: 'cafe', desc: '커피 3종 · 브런치 토스트 4종' },
  { id: 'pasta', stage: 2, name: '생면 파스타 키친', price: 45000, stations: ['pasta'], icon: 'pasta', desc: '황동 제면기 + 파스타 스토브 · 생면 파스타 3종' },
  { id: 'salad', stage: 3, name: '가든 샐러드 & 프렙 바', price: 60000, stations: ['salad'], icon: 'salad', desc: '신선 채소 바트 · 가든 샐러드 2종' },
  { id: 'pizza', stage: 4, name: '정통 나폴리 장작 화덕', price: 90000, stations: ['pizza'], icon: 'pizza', desc: '벽돌 돔 화덕 · 화덕 피자 2종' },
];

// 인테리어 카탈로그 (원터치 적용). cozy = 아늑함 지수에 더하는 별 수 (0.5 단위)
export const CATALOG = {
  wall: [
    { id: 's1_wall_sage', name: '크림 세이지', price: 0, cozy: 0, sw: ['#f4ede2', '#98ab88'] },
    { id: 'v12_wall_terracotta', name: '토스카나 테라코타 브릭', price: 26000, cozy: 0.5, sw: ['#b8603e', '#e3cdb3'] },
    { id: 'v12_wall_amalfi', name: '아말피 레몬 타일', price: 32000, cozy: 0.5, sw: ['#f2d45c', '#f7f2e2'] },
    { id: 'v12_wall_milano', name: '밀라노 다크 월넛', price: 38000, cozy: 0.5, sw: ['#4a3122', '#c9b79c'] },
  ],
  floor: [
    { id: 's1_floor_honey', name: '허니 오크 헤링본', price: 0, cozy: 0, sw: ['#c98a4b', '#d39a5c'] },
    { id: 'v12_floor_sicily', name: '시칠리아 체크 타일', price: 28000, cozy: 0.5, sw: ['#2f5a6a', '#efe6d4'] },
    { id: 'v12_floor_terrazzo', name: '앤티크 테라조 스톤', price: 34000, cozy: 0.5, sw: ['#d9cfbf', '#a5765e'] },
  ],
  tableSet: [
    { id: 'bistro', name: '비스트로 우드', price: 0, cozy: 0, table: 's1_table_round', chair: 's1_chair_bentwood', sw: ['#5a3a26', '#2c2a28'] },
    { id: 'velvet', name: '벨벳 골드 라운지', price: 48000, cozy: 0.5, table: 'v12_table_marble', chair: 'v12_chair_velvet', sw: ['#7a2e3a', '#c9a24a'] },
    { id: 'rattan', name: '올리브 가든 라탄', price: 42000, cozy: 0.5, table: 'v12_table_garden', chair: 'v12_chair_rattan', sw: ['#c9a774', '#6b7a3a'] },
  ],
  extra: [{ id: 'table3', name: '3번째 손님 테이블 확장', price: 36000, cozy: 0.5, sw: ['#8a5a36', '#e3cdb3'] }],
  props: [
    { id: 'olive', name: '창가 올리브 나무 화분', price: 18000, cozy: 0.5, sw: ['#6f8a4a', '#e7dccb'] },
    { id: 'pendant', name: '천장 빈티지 펜던트 조명', price: 24000, cozy: 0.5, sw: ['#c9a24a', '#ffd79a'] },
    { id: 'wine', name: '벽면 와인 랙 & 액자', price: 22000, cozy: 0.5, sw: ['#5a2230', '#3a2a1f'] },
  ],
};

export function defaultProgress() {
  return {
    unlocks: { pasta: false, salad: false, pizza: false },
    owned: { wall: ['s1_wall_sage'], floor: ['s1_floor_honey'], tableSet: ['bistro'], extra: [], props: [] },
    sel: { wall: 's1_wall_sage', floor: 's1_floor_honey', tableSet: 'bistro' },
    gifts: 0, // 단골 Lv.3 선물로 받은 장식 (아늑함 +0.5 씩)
    dayGuests: 0, // 오늘 입장한 손님 수
    dayStats: freshDay(),
  };
}

export function freshDay() {
  return { guests: 0, S: 0, A: 0, sales: 0, tips: 0, newRegulars: [], levelUps: [] };
}

let current = null;
export function getProgress() {
  return current;
}

export class Progress {
  constructor(state) {
    this.state = state;
    current = this;
    if (!state.progress) state.progress = defaultProgress();
    const p = state.progress;
    const d = defaultProgress();
    for (const k of Object.keys(d)) if (p[k] === undefined) p[k] = d[k];
    for (const k of Object.keys(d.owned)) if (!p.owned[k]) p.owned[k] = d.owned[k];
  }

  get p() {
    return this.state.progress;
  }

  unlocked(id) {
    return id === 'base' || !!this.p.unlocks[id];
  }

  stations() {
    const out = [];
    for (const s of STAGES) if (this.unlocked(s.id)) out.push(...s.stations);
    return out;
  }

  // 아늑함 지수 (★ 1~5): 기본 1 + 구매한 인테리어
  cozy() {
    let c = 1 + this.p.gifts * 0.5;
    for (const [k, list] of Object.entries(CATALOG)) for (const it of list) if (this.owns(k, it.id) && it.price > 0) c += it.cozy;
    return Math.min(5, c);
  }

  // 아늑함 ★ 마다 팁 +10% (★5 = +40%)
  tipBonus() {
    return Math.round((this.cozy() - 1) * 10);
  }

  owns(kind, id) {
    return (this.p.owned[kind] ?? []).includes(id);
  }

  buy(kind, id) {
    const it = CATALOG[kind]?.find((x) => x.id === id);
    if (!it || this.owns(kind, id)) return false;
    if (this.state.money < it.price) return false;
    this.state.addMoney(-it.price);
    this.p.owned[kind].push(id);
    bus.emit('progress', { kind, id });
    return true;
  }

  unlock(id) {
    const st = STAGES.find((s) => s.id === id);
    if (!st || this.unlocked(id) || this.state.money < st.price) return false;
    this.state.addMoney(-st.price);
    this.p.unlocks[id] = true;
    bus.emit('progress', { kind: 'unlock', id });
    return true;
  }

  // 단골 호감도: S/A 등급 대접 1회 = 하트 1개. Lv.1 첫 인연(1) → Lv.2 단골 친구(3) → Lv.3 소울 푸드 단골(5)
  static level(aff = 0) {
    return aff >= 5 ? 3 : aff >= 3 ? 2 : aff >= 1 ? 1 : 0;
  }
}

export const LEVEL_NAME = ['', '첫 인연', '단골 친구', '소울 푸드 단골'];
