import { registry } from './PackRegistry.js';

// 커피톡 스타일 대화 엔진: 손님 페르소나의 숨겨진 취향을 대화로 알아내고, 맞춤 메뉴·특별 옵션을 역제안한다.
const WEATHER = {
  clear: ['햇살이 참 좋네요.', '하늘이 맑아서 걷기 좋았어요.', '오늘은 볕이 따뜻하네요.'],
  cloudy: ['하늘이 잔뜩 흐리네요.', '구름이 낮게 깔렸어요.', '날이 좀 꾸물꾸물하네요.'],
  rain: ['밖에 비가 추적추적 와요.', '우산 털고 들어왔어요. 비가 꽤 오네요.', '빗소리가 좋아서 천천히 걸어왔어요.'],
  chilly: ['바람이 꽤 차갑네요.', '아침 공기가 쌀쌀해요.', '손이 시려서 따뜻한 데 들어오고 싶었어요.'],
};
const TIME = {
  morning: ['좋은 아침이에요.', '아침 일찍 열려 있어서 다행이에요.'],
  afternoon: ['안녕하세요.', '점심 지나고 한숨 돌리러 왔어요.'],
  evening: ['저녁이네요, 안녕하세요.', '불빛이 예뻐서 들어왔어요.'],
};
const MORE = ['음, 그 정도면 충분히 말씀드린 것 같아요.', '나머지는 사장님 감을 믿어볼게요.', '이제 사장님 추천이 궁금해요.'];
const MISS = ['좋아요, 그걸로 해볼게요.', '오, 한번 먹어볼게요.', '추천해 주시니 믿고 먹어볼게요.'];
const OPT_NO = ['아, 그건 괜찮아요. 그대로 주세요.', '그건 안 해주셔도 돼요.', '음, 오늘은 기본으로 할게요.'];
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

export class DialogueEngine {
  constructor(state) {
    this.state = state;
  }

  memo(pid) {
    const m = (this.state.regulars[pid] = this.state.regulars[pid] ?? { visits: 0, matches: 0, greet: -1 });
    return m;
  }

  start(customer, { minutes, weather }) {
    const p = customer.persona;
    const m = this.memo(p.id);
    m.greet = (m.greet + 1) % p.greet.length; // 방문마다 다른 첫인사
    const tod = minutes < 11 * 60 ? 'morning' : minutes < 17 * 60 ? 'afternoon' : 'evening';
    const seed = this.state.day + m.visits;
    const lines = p.regular
      ? [p.greet[0], pick(WEATHER[weather] ?? WEATHER.clear, seed + p.id.length)]
      : [`${pick(TIME[tod], seed)} ${pick(WEATHER[weather] ?? WEATHER.clear, seed + p.id.length)}`, p.greet[m.greet]];
    customer.talk = { hint: 0, recipe: null, option: null, matched: false, optMatched: false, lines };
    return lines;
  }

  // [취향 깊이 묻기] — 같은 방문에서 같은 답을 반복하지 않는다
  askDeeper(customer) {
    const p = customer.persona;
    const t = customer.talk;
    if (t.hint < p.hints.length) {
      const line = p.hints[t.hint++];
      return { line, tags: this.revealedTags(customer) };
    }
    return { line: pick(MORE, t.hint++), tags: this.revealedTags(customer) };
  }

  // 지금까지 들은 힌트 수만큼 취향 태그를 알려준다 (마지막 힌트는 옵션 단서일 수 있음)
  revealedTags(customer) {
    const n = Math.min(customer.talk.hint, customer.persona.tags.length);
    return customer.persona.tags.slice(0, n);
  }

  scoreRecipe(persona, recipe) {
    return recipe.tags.filter((t) => persona.tags.includes(t)).length;
  }

  bestRecipes(persona, available) {
    const scored = available.map((r) => [r, this.scoreRecipe(persona, r)]);
    const max = Math.max(...scored.map((x) => x[1]));
    return scored.filter((x) => x[1] === max && max > 0).map((x) => x[0].id);
  }

  // [맞춤 메뉴 추천]
  recommend(customer, recipe, available) {
    const t = customer.talk;
    t.recipe = recipe.id;
    t.option = null;
    t.matched = this.bestRecipes(customer.persona, available).includes(recipe.id);
    const line = t.matched ? this.excite(customer, recipe) : pick(MISS, this.state.served + customer.persona.id.length);
    return { line, matched: t.matched };
  }

  // 취향 적중 추천: 설레는 어조의 감탄 3~4문장 (손님 말버릇 + 적중한 취향 + 메뉴별 기대 + 마무리)
  excite(customer, recipe) {
    const p = customer.persona;
    const D = registry.guestData ?? {};
    const seed = this.state.served + p.id.length + recipe.id.length;
    const hit = recipe.tags.filter((x) => p.tags.includes(x));
    const s2 = hit
      .slice(0, 2)
      .map((x, i) => pick(D.EXCITE?.[x] ?? [], seed + i))
      .filter(Boolean)
      .join(' ');
    const s3 = recipe.hype ? pick(recipe.hype, seed) : `${recipe.name}, 이름만 들어도 벌써 설레요.`;
    const s4 = pick(D.EXCITE_END ?? ['빨리 맛보고 싶어서 두근거려요!'], seed);
    return [p.match, s2, s3, s4].filter(Boolean).join(' ');
  }

  // [그냥 주문 듣기]
  selfOrder(customer, available) {
    const p = customer.persona;
    const r = available.find((x) => x.id === p.self) ?? available[Math.floor(Math.random() * available.length)];
    const t = customer.talk;
    t.recipe = r.id;
    t.matched = false;
    return { line: `음... 그냥 ${r.name}로 할게요.`, recipe: r };
  }

  optionsFor(recipe) {
    return (recipe.options ?? []).map((id) => ({ id, ...registry.options[id] })).filter((o) => o.name);
  }

  // [스페셜 옵션 제안]
  suggestOption(customer, optionId) {
    const p = customer.persona;
    const t = customer.talk;
    if (p.option === optionId) {
      t.option = optionId;
      t.optMatched = true;
      return { line: p.optYes ?? '오, 그거 좋네요. 그렇게 해주세요.', accepted: true };
    }
    return { line: pick(OPT_NO, t.hint + optionId.length), accepted: false };
  }

  // 서빙 후 감상평 (취향이 맞았으면 특별 대사)
  review(customer, grade) {
    const t = customer.talk;
    const m = this.memo(customer.persona.id);
    m.visits += 1;
    if (t?.matched && (grade === 'S' || grade === 'A')) {
      m.matches += 1;
      return { line: customer.persona.review, special: true, regular: m.matches };
    }
    return { line: null, special: false, regular: m.matches };
  }
}

export const WEATHER_KEYS = Object.keys(WEATHER);
export const WEATHER_NAME = { clear: '맑음', cloudy: '흐림', rain: '비', chilly: '쌀쌀함' };
