// v12 장기 플레이 루프: 설비 해금 · 인테리어 카탈로그(아늑함 지수) · 일일 정산 · 단골 호감도
// v21 확장: 오늘의 특선 · 식자재 등급 · 5성 승급 · 업적 12종 · VIP 미식가 · Stage 5 돌체
import { bus } from './EventBus.js';

export const GUESTS_PER_DAY = 5;

// 설비 해금 (Stage 1 은 처음부터: 에스프레소 바 + 브런치 토스트)
export const STAGES = [
  { id: 'base', stage: 1, name: '브런치 & 에스프레소 바', price: 0, stations: ['espresso', 'sandwich'], icon: 'cafe', desc: '커피 3종 · 브런치 토스트 4종' },
  { id: 'pasta', stage: 2, name: '생면 파스타 키친', price: 45000, stations: ['pasta'], icon: 'pasta', desc: '황동 제면기 + 파스타 스토브 · 생면 파스타 3종' },
  { id: 'salad', stage: 3, name: '가든 샐러드 & 프렙 바', price: 60000, stations: ['salad'], icon: 'salad', desc: '신선 채소 바트 · 가든 샐러드 2종' },
  { id: 'pizza', stage: 4, name: '정통 나폴리 장작 화덕', price: 90000, stations: ['pizza'], icon: 'pizza', desc: '벽돌 돔 화덕 · 화덕 피자 2종' },
  { id: 'dolce', stage: 5, name: '이탈리안 돌체 바', price: 120000, stations: ['dolce'], icon: 'dolce', desc: '수제 디저트 · 티라미수와 판나코타 2종' },
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

// ───── v21 식자재 등급 (분야 = 조리대). 등급마다 그 분야 메뉴 단가 +15%, 조리 판정 여유 +12% ─────
export const ING_CATS = [
  { id: 'espresso', name: '커피 원두 & 우유', icon: 'latte', stage: 'base' },
  { id: 'sandwich', name: '브런치 빵 & 채소', icon: 'blt', stage: 'base' },
  { id: 'pasta', name: '파스타 밀 & 소스', icon: 'pasta', stage: 'pasta' },
  { id: 'salad', name: '샐러드 채소 & 오일', icon: 'salad', stage: 'salad' },
  { id: 'pizza', name: '피자 도우 & 치즈', icon: 'pizza', stage: 'pizza' },
  { id: 'dolce', name: '돌체 크림 & 과일', icon: 'dolce', stage: 'dolce' },
];
export const ING_LEVELS = [
  { lv: 1, name: '기본', price: 0 },
  { lv: 2, name: '산지 직송', price: 25000 },
  { lv: 3, name: '유기농 스페셜티', price: 50000 },
  { lv: 4, name: '미슐랭 시그니처', price: 90000 },
];
export const ING_PRICE_STEP = 0.15;
export const ING_EASE_STEP = 0.12;
export const SPECIAL_BONUS = 0.3; // 오늘의 특선 판매가 +30%

// ───── v21 트라토리아 5성 등급 (누적 매출 · S등급 접시 · 아늑함 지수 모두 충족해야 승급) ─────
export const RANKS = [
  { star: 1, name: '로컬 카페', sales: 0, s: 0, cozy: 1, reward: 0 },
  { star: 2, name: '동네 맛집', sales: 100000, s: 5, cozy: 1.5, reward: 15000 },
  { star: 3, name: '인기 트라토리아', sales: 300000, s: 15, cozy: 2.5, reward: 30000 },
  { star: 4, name: '미식 오스테리아', sales: 700000, s: 35, cozy: 3.5, reward: 50000 },
  { star: 5, name: '그랜드 비스트로', sales: 1500000, s: 70, cozy: 4.5, reward: 100000 },
];

// 업적 12종: value(ctx) 가 goal 이상이면 달성 → 등급 & 업적 창에서 보상 받기
export const ACHIEVEMENTS = [
  { id: 'first_s', name: '첫 S등급 달성', icon: 'star', goal: 1, reward: 3000, value: (x) => x.sCount },
  { id: 's10', name: 'S등급 10접시', icon: 'star', goal: 10, reward: 8000, value: (x) => x.sCount },
  { id: 's50', name: 'S등급 50접시', icon: 'crown', goal: 50, reward: 30000, value: (x) => x.sCount },
  { id: 'reg5', name: '단골 5명 확보', icon: 'book', goal: 5, reward: 6000, value: (x) => x.regulars },
  { id: 'reg10', name: '단골 10명 확보', icon: 'book', goal: 10, reward: 15000, value: (x) => x.regulars },
  { id: 'soul', name: '소울 단골 탄생', icon: 'heart', goal: 1, reward: 10000, value: (x) => x.lv3 },
  { id: 'sales500k', name: '누적 매출 50만 원', icon: 'coin', goal: 500000, reward: 20000, money: true, value: (x) => x.sales },
  { id: 'sales2m', name: '누적 매출 200만 원', icon: 'coin', goal: 2000000, reward: 50000, money: true, value: (x) => x.sales },
  { id: 'all_unlock', name: '전 설비 해금', icon: 'hammer', goal: 4, reward: 40000, value: (x) => x.unlocks },
  { id: 'cozy5', name: '아늑함 별 다섯 개', icon: 'sparkle', goal: 5, reward: 30000, value: (x) => x.cozy },
  { id: 'vip3', name: '미식가 3번 감동', icon: 'vip', goal: 3, reward: 25000, value: (x) => x.vip },
  { id: 'ing4', name: '미슐랭 식자재', icon: 'leaf', goal: 4, reward: 20000, value: (x) => x.ingMax },
];

export function defaultProgress() {
  return {
    unlocks: { pasta: false, salad: false, pizza: false, dolce: false },
    owned: { wall: ['s1_wall_sage'], floor: ['s1_floor_honey'], tableSet: ['bistro'], extra: [], props: [] },
    sel: { wall: 's1_wall_sage', floor: 's1_floor_honey', tableSet: 'bistro' },
    gifts: 0, // 단골 Lv.3 선물로 받은 장식 (아늑함 +0.5 씩)
    dayGuests: 0, // 오늘 입장한 손님 수
    dayStats: freshDay(),
    // v21
    ing: { espresso: 1, sandwich: 1, pasta: 1, salad: 1, pizza: 1, dolce: 1 },
    special: { day: 0, id: null }, // 오늘의 특선 (day = 지정한 날)
    totalSales: -1, // 누적 매출 (-1 = 예전 저장 → 처음 한 번 어림)
    rank: 1,
    vipWins: 0, // 미식가를 A등급 이상으로 대접한 횟수 (아늑함 +0.3 씩)
    vipDay: 0, // 미식가가 마지막으로 다녀간 날
    ach: {}, // 보상까지 받은 업적 id → true
    achSeen: {}, // 달성 알림을 띄운 업적
  };
}

export function freshDay() {
  return { guests: 0, S: 0, A: 0, sales: 0, tips: 0, newRegulars: [], levelUps: [] };
}

let current = null;
export function getProgress() {
  return current;
}

const round100 = (n) => Math.round(n / 100) * 100;

export class Progress {
  constructor(state) {
    this.state = state;
    current = this;
    if (!state.progress) state.progress = defaultProgress();
    const p = state.progress;
    const d = defaultProgress();
    for (const k of Object.keys(d)) if (p[k] === undefined) p[k] = d[k];
    for (const k of Object.keys(d.owned)) if (!p.owned[k]) p.owned[k] = d.owned[k];
    for (const k of Object.keys(d.unlocks)) if (p.unlocks[k] === undefined) p.unlocks[k] = false;
    for (const k of Object.keys(d.ing)) if (!p.ing[k]) p.ing[k] = 1;
    // v20 이전 저장에는 누적 매출이 없다 → 대접한 접시 수로 어림 (업적 · 등급이 0 에서 시작하지 않게)
    if (!(p.totalSales >= 0)) p.totalSales = Math.round((state.served ?? 0) * 9000);
    // 이미 조건을 넘긴 등급은 보상 연출 없이 조용히 맞춘다 (예전 저장 이어 하기)
    if (!save_hasRank(p)) p.rank = this.rankFor().star;
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

  // 아늑함 지수 (★ 1~5): 기본 1 + 구매한 인테리어 + 단골 선물 + 미식 매거진 호평
  cozy() {
    let c = 1 + this.p.gifts * 0.5 + (this.p.vipWins ?? 0) * 0.3;
    for (const [k, list] of Object.entries(CATALOG)) for (const it of list) if (this.owns(k, it.id) && it.price > 0) c += it.cozy;
    return Math.min(5, Math.round(c * 10) / 10);
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

  // ───── 식자재 등급 ─────
  ingLevel(cat) {
    return Math.max(1, Math.min(4, this.p.ing?.[cat] ?? 1));
  }

  nextIng(cat) {
    return ING_LEVELS[this.ingLevel(cat)] ?? null; // 다음 등급 (최고 등급이면 null)
  }

  upgradeIng(cat) {
    const nx = this.nextIng(cat);
    if (!nx || this.state.money < nx.price) return false;
    this.state.addMoney(-nx.price);
    this.p.ing[cat] = nx.lv;
    bus.emit('progress', { kind: 'ing', id: cat });
    return true;
  }

  // 조리 판정 여유: 각 단계 점수에서 모자란 부분의 12%씩 채워 준다 (Lv.4 = 36%)
  ease(station) {
    return (this.ingLevel(station) - 1) * ING_EASE_STEP;
  }

  // ───── 오늘의 특선 ─────
  specialId() {
    return this.p.special?.day === this.state.day ? this.p.special.id : null;
  }

  isSpecial(recipe) {
    return !!recipe && this.specialId() === recipe.id;
  }

  needsSpecial() {
    return this.p.special?.day !== this.state.day;
  }

  setSpecial(id) {
    this.p.special = { day: this.state.day, id };
    bus.emit('progress', { kind: 'special', id });
  }

  // 판매가 = 기본가 × (1 + 15% × (식자재 등급 - 1)) × (특선이면 1.3), 100원 단위
  priceOf(recipe) {
    if (!recipe) return 0;
    let v = recipe.price * (1 + ING_PRICE_STEP * (this.ingLevel(recipe.station) - 1));
    if (this.isSpecial(recipe)) v *= 1 + SPECIAL_BONUS;
    return round100(v);
  }

  // ───── VIP 미식가: 3의 배수 날, 그날의 마지막 손님 ─────
  isVipDay(day = this.state.day) {
    return day > 0 && day % 3 === 0;
  }

  // ───── 5성 등급 ─────
  sCount() {
    return this.state.grades?.S ?? 0;
  }

  rankFor() {
    let r = RANKS[0];
    for (const x of RANKS) if (this.p.totalSales >= x.sales && this.sCount() >= x.s && this.cozy() >= x.cozy) r = x;
    return r;
  }

  rank() {
    return RANKS[Math.max(0, Math.min(RANKS.length - 1, (this.p.rank ?? 1) - 1))];
  }

  // 다음 등급까지 진행도 (각 조건 0~1, 전체 = 평균)
  rankProgress() {
    const cur = this.rank();
    const nx = RANKS[cur.star] ?? null;
    if (!nx) return { next: null, parts: [], total: 1 };
    const part = (label, v, from, to, fmt) => ({ label, v, goal: to, pct: Math.max(0, Math.min(1, (v - from) / Math.max(1e-6, to - from))), text: fmt(v, to) });
    const won = (n) => `${Math.round(n / 10000).toLocaleString('ko-KR')}만`;
    const parts = [
      part('누적 매출', this.p.totalSales, cur.sales, nx.sales, (v, g) => `${won(Math.min(v, g))} / ${won(g)}원`),
      part('S등급 요리', this.sCount(), cur.s, nx.s, (v, g) => `${Math.min(v, g)} / ${g}접시`),
      part('아늑함 지수', this.cozy(), cur.cozy, nx.cozy, (v, g) => `${Math.min(v, g)} / ${g}`),
    ];
    return { next: nx, parts, total: parts.reduce((s, x) => s + x.pct, 0) / parts.length };
  }

  // 조건을 채웠으면 한 단계씩 승급 (보상 지급). 승급한 등급을 돌려준다
  checkRankUp() {
    const target = this.rankFor().star;
    if (target <= (this.p.rank ?? 1)) return null;
    this.p.rank = (this.p.rank ?? 1) + 1;
    const r = this.rank();
    if (r.reward) this.state.addMoney(r.reward);
    bus.emit('progress', { kind: 'rank', id: r.star });
    return r;
  }

  // ───── 업적 ─────
  achCtx() {
    const book = Object.values(this.state.book ?? {});
    return {
      sCount: this.sCount(),
      regulars: book.length,
      lv3: book.filter((b) => Progress.level(b.aff ?? 0) >= 3).length,
      sales: this.p.totalSales,
      unlocks: STAGES.filter((s) => s.id !== 'base' && this.unlocked(s.id)).length,
      cozy: this.cozy(),
      vip: this.p.vipWins ?? 0,
      ingMax: Math.max(...ING_CATS.map((c) => this.ingLevel(c.id))),
    };
  }

  achievements() {
    const ctx = this.achCtx();
    return ACHIEVEMENTS.map((a) => {
      const v = a.value(ctx);
      const claimed = !!this.p.ach[a.id];
      return { ...a, v, done: claimed || v >= a.goal, claimed };
    });
  }

  // 새로 달성했지만 아직 알리지 않은 업적 (알림용, 한 번만 돌려준다)
  newAchievements() {
    const out = [];
    for (const a of this.achievements()) {
      if (a.done && !this.p.achSeen[a.id]) {
        this.p.achSeen[a.id] = true;
        if (!a.claimed) out.push(a);
      }
    }
    return out;
  }

  unclaimed() {
    return this.achievements().filter((a) => a.done && !a.claimed).length;
  }

  claim(id) {
    const a = this.achievements().find((x) => x.id === id);
    if (!a || !a.done || a.claimed) return null;
    this.p.ach[id] = true;
    this.p.achSeen[id] = true;
    this.state.addMoney(a.reward);
    bus.emit('progress', { kind: 'ach', id });
    return a;
  }

  // 단골 호감도: S/A 등급 대접 1회 = 하트 1개. Lv.1 첫 인연(1) → Lv.2 단골 친구(3) → Lv.3 소울 푸드 단골(5)
  static level(aff = 0) {
    return aff >= 5 ? 3 : aff >= 3 ? 2 : aff >= 1 ? 1 : 0;
  }
}

// 저장에 등급이 이미 들어 있는가 (rank 1 이고 매출 0 인 새 게임도 '있음')
function save_hasRank(p) {
  return p.rankInit === true ? true : ((p.rankInit = true), false);
}

export const LEVEL_NAME = ['', '첫 인연', '단골 친구', '소울 푸드 단골'];
export const LEVEL_AFF = [0, 1, 3, 5]; // 레벨별 필요 하트
