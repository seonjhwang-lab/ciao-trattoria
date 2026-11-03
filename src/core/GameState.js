import { bus } from './EventBus.js';

const SAVE_KEY = 'cozy-brunch-3d.save.v3';
const WEATHERS = ['clear', 'clear', 'cloudy', 'rain', 'chilly'];
export const DAY_START = 7 * 60;
export const DAY_END = 22 * 60;
// 7차 개편: 10x10 비스트로 + 파스타/화덕/샐러드 스테이션. 이전 배치는 새 기본 매장으로 바꾼다
export const LAYOUT_VER = 12; // v14: 7x8 매장 · 왼쪽 벽 출입문 // v12: 6x6 컴팩트 트라토리아 + 통합 마스터 조리대

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 게임 전역 상태. 파산·게임오버는 없다 — 돈은 0 밑으로 내려가지 않는다.
export class GameState {
  constructor() {
    this.money = 200000;
    this.rep = 40; // 서비스 평판 (0~80)
    this.decor = 0; // 인테리어 분위기 점수 (최대 20 반영)
    this.served = 0;
    this.grades = { S: 0, A: 0, B: 0, C: 0 };
    this.day = 1;
    this.minutes = 8 * 60;
    this.speed = 1; // 0 | 1 | 2
    this.mode = 'live'; // live | build
    this.sound = true;
    this.weather = 'clear';
    this.regulars = {}; // 손님별 방문/취향 적중 기록
    this.book = {}; // 단골 수첩 (S등급 손님)
    this.finishes = { wall: null, floor: null };
    this.progress = null; // v12 설비 해금 · 인테리어 · 일일 정산 (Progress.js)
  }

  get reputation() {
    return clamp(Math.round(this.rep + Math.min(20, this.decor)), 0, 100);
  }

  set(key, value) {
    if (this[key] === value) return;
    this[key] = value;
    bus.emit('state:' + key, value);
    bus.emit('state', key);
  }

  addMoney(n) {
    this.set('money', Math.max(0, Math.round(this.money + n)));
  }

  addRep(n) {
    this.rep = clamp(this.rep + n, 0, 80);
    bus.emit('state:reputation', this.reputation);
  }

  setDecor(n) {
    this.decor = n;
    bus.emit('state:reputation', this.reputation);
  }

  // v12: 시계는 실시간으로 흐르지 않고 '오늘 대접한 손님 수'를 따라 아침 → 저녁으로 부드럽게 움직인다.
  // (하루는 손님 5명을 대접하면 끝나고, 날짜는 마감 정산서에서 '다음 날 오픈'을 눌러야 바뀐다)
  tick(simDt, target) {
    if (simDt <= 0 || target === undefined) return;
    const before = Math.floor(this.minutes);
    this.minutes += (target - this.minutes) * Math.min(1, simDt * 0.6);
    if (Math.floor(this.minutes) !== before) bus.emit('state:time', this.minutes);
  }

  nextDay() {
    this.day += 1;
    this.minutes = 9 * 60;
    this.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    bus.emit('state:day', this.day);
  }

  save(layout) {
    const data = {
      v: 2,
      money: this.money,
      rep: this.rep,
      served: this.served,
      grades: this.grades,
      day: this.day,
      minutes: this.minutes,
      sound: this.sound,
      weather: this.weather,
      regulars: this.regulars,
      book: this.book,
      finishes: this.finishes,
      progress: this.progress,
      finishVer: 6,
      layoutVer: LAYOUT_VER,
      layout,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* 저장소가 막혀 있어도 게임은 계속된다 */
    }
  }

  applySave(s) {
    if (s.regulars) this.regulars = s.regulars;
    if (s.book) this.book = s.book;
    if (s.progress) this.progress = s.progress;
    for (const k of ['money', 'rep', 'served', 'day', 'minutes', 'sound', 'weather']) {
      if (typeof s[k] === typeof this[k]) this[k] = s[k];
    }
    if (s.grades) this.grades = { ...this.grades, ...s.grades };
    // 6차 개편 전 저장(어두운 적벽돌·웜그레이 타일 기본값)은 새 밝은 기본 마감재로 되돌린다
    if (s.finishes && s.finishVer === 6) this.finishes = { ...this.finishes, ...s.finishes };
  }

  static loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static hasSave() {
    return !!GameState.loadSave();
  }

  static clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* noop */
    }
  }
}
