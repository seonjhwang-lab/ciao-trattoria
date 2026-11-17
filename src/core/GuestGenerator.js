import { registry } from './PackRegistry.js';
import { randomLook } from './Character.js';
import { getProgress, Progress } from './Progress.js';

// 절차적 손님 생성기: [직업] × [이름] × [외모 조합] × [기분/날씨 인사] × [취향 태그 + 숨은 옵션]
// S등급 대접을 받은 손님은 단골 수첩(state.book)에 남아, 다시 오면 단골 전용 대사로 인사한다.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
let gid = 1;
// 수첩은 가장 친한 단골 위주로 최대 40명 (저장 용량 · 수첩 화면이 끝없이 늘지 않게)
const BOOK_MAX = 40;

export class GuestGenerator {
  constructor(state) {
    this.state = state;
    this.specialLooks = new Map();
  }

  get D() {
    return registry.guestData;
  }

  // 모든 손님은 Actor 에서 Mixamo 리그로 만들어진다 (look 의 색·키가 그대로 염색·스케일에 쓰임)
  withGlb(look) {
    return look;
  }

  // 다음 손님 (단골 25% · 시즌 고정 손님 15% · 나머지는 새로 조합)
  next(available, presentIds, opts = {}) {
    if (opts.vip) return this.critic(available);
    const r = Math.random();
    const book = Object.values(this.state.book ?? {}).filter((b) => !presentIds.has(b.id));
    if (book.length && r < 0.25) return this.fromBook(pick(book), available);
    const special = [...registry.personas.values()].filter((p) => !presentIds.has(p.id));
    if (special.length && r < 0.4) {
      const p = pick(special);
      if (!this.specialLooks.has(p.id)) this.specialLooks.set(p.id, this.withGlb({ ...randomLook(), ...p.look }));
      return { ...p, look: this.specialLooks.get(p.id) };
    }
    return this.generate(available);
  }

  hintsFor(tags, option) {
    const D = this.D;
    const h = tags.map((t) => pick(D.TAG_HINTS[t] ?? ['음, 잘 모르겠어요.']));
    if (option) h.push(pick(D.OPTION_HINTS[option]));
    return h;
  }

  reviewFor(tags) {
    const D = this.D;
    const parts = tags.slice(0, 2).map((t) => D.PRAISE[t]).filter(Boolean);
    return `${parts.join(' ')}, ${pick(D.REVIEW_END)}`;
  }

  generate(available) {
    const D = this.D;
    const present = new Set(this.state.presentNames ?? []);
    const name = pick(D.NAMES.filter((n) => !present.has(n))) ?? pick(D.NAMES);
    const [job, g1, g2] = pick(D.JOBS);
    // v21 오늘의 특선: 손님 10명 중 4명은 특선 메뉴가 취향인 사람
    const sp = this.special(available);
    const target = sp && Math.random() < 0.4 ? sp : pick(available);
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    const tags = shuffle(target.tags).slice(0, Math.min(n, target.tags.length));
    const opts = (target.options ?? []).filter((o) => registry.options[o]);
    const option = opts.length && Math.random() < 0.5 ? pick(opts) : null;
    const others = available.filter((r) => r.id !== target.id);
    return {
      id: `g${Date.now().toString(36)}${gid++}`,
      name,
      job,
      look: this.withGlb(randomLook()),
      tags,
      option,
      self: sp && Math.random() < 0.5 ? sp.id : (others.length ? pick(others) : target).id,
      greet: [g1, g2, pick(D.MOODS)],
      hints: this.hintsFor(tags, option),
      match: pick(D.MATCH),
      optYes: option ? pick(D.OPTION_YES[option]) : null,
      review: this.reviewFor(tags),
      generated: true,
    };
  }

  special(available) {
    const id = getProgress()?.specialId();
    return id ? available.find((r) => r.id === id) ?? null : null;
  }

  // v21 미식 칼럼니스트 (3의 배수 날의 마지막 손님): 중절모에 수트 차림, 취향은 물어봐야 알 수 있다
  critic(available) {
    const D = this.D;
    const target = pick(available);
    const tags = shuffle(target.tags).slice(0, Math.min(3, target.tags.length));
    const name = pick(['로렌초', '비앙카', '알레시오', '키아라']);
    const hello = pick(['미식 매거진에서 왔습니다. 오늘의 한 접시를 부탁드려요.', '소문을 듣고 찾아왔습니다. 천천히 맛보고 싶군요.', '칼럼에 실을 한 접시를 찾고 있습니다.']);
    return {
      id: `vip${this.state.day}`,
      name,
      job: '미식 매거진 칼럼니스트',
      look: this.withGlb({ ...randomLook(), hat: 'fedora', hatColor: '#3a3633', coat: '#2f3138', top: '#efe9dc', bottom: '#2a2c33', shoe: '#2a2522', scarf: null, glasses: 'round', style: 'short', collar: true, height: 1.03, build: 'regular' }),
      tags,
      option: null,
      self: target.id,
      greet: [hello, hello, hello],
      hints: this.hintsFor(tags, null),
      match: '오, 제 취향을 정확히 읽으셨군요.',
      optYes: null,
      review: this.reviewFor(tags),
      generated: true,
      vip: true,
    };
  }

  fromBook(b, available) {
    const D = this.D;
    const fav = registry.recipes.get(b.fav);
    // v21 단골 특별 의뢰: 호감도 Lv.1 이상 단골이 가끔 '오늘은 꼭 부탁해요' 하고 온다 (S등급이면 팁 2배 + 호감도 1레벨)
    const request = Progress.level(b.aff ?? 0) >= 1 && Progress.level(b.aff ?? 0) < 3 && Math.random() < 0.4;
    const line = request ? '사장님, 오늘은 특별히 부탁드릴 게 있어요.' : pick(D.REGULAR_GREET).replace('{fav}', fav?.name ?? '그 메뉴');
    return {
      request,
      id: b.id,
      name: b.name,
      job: b.job,
      look: b.look,
      tags: b.tags,
      option: b.option,
      self: b.fav,
      greet: [line, line, line],
      hints: this.hintsFor(b.tags, b.option),
      match: '역시 사장님은 제 취향을 아시네요.',
      optYes: b.option ? pick(D.OPTION_YES[b.option]) : null,
      review: this.reviewFor(b.tags),
      regular: true,
    };
  }

  // S등급 손님을 단골 수첩에 기록
  register(persona, recipe) {
    const book = (this.state.book = this.state.book ?? {});
    const prev = book[persona.id];
    const look = { ...persona.look };
    delete look.glb;
    book[persona.id] = {
      id: persona.id,
      name: persona.name,
      job: persona.job,
      look,
      tags: persona.tags,
      option: persona.option,
      fav: recipe.id,
      visits: (prev?.visits ?? 0) + 1,
      sCount: (prev?.sCount ?? 0) + 1,
      day: this.state.day,
      aff: prev?.aff ?? 0, // v12 호감도 하트는 유지
      gift: prev?.gift ?? false,
    };
    this.prune(persona.id);
    return !prev;
  }

  // 수첩이 가득 차면 호감도 · 방문이 가장 적고 가장 오래된 손님부터 뺀다 (방금 적은 손님 · 매장에 있는 손님은 남긴다)
  prune(keepId) {
    const book = this.state.book;
    const ids = Object.keys(book);
    if (ids.length <= BOOK_MAX) return;
    const here = new Set(this.state.presentIds ?? []);
    const rank = (b) => (b.aff ?? 0) * 1000 + (b.sCount ?? 0) * 50 + (b.visits ?? 0) * 10 + (b.day ?? 0) * 0.01;
    const out = ids.filter((id) => id !== keepId && !here.has(id)).sort((a, b) => rank(book[a]) - rank(book[b]));
    for (const id of out.slice(0, ids.length - BOOK_MAX)) delete book[id];
  }
}
