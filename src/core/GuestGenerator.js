import { registry } from './PackRegistry.js';
import { randomLook } from './Character.js';

// 절차적 손님 생성기: [직업] × [이름] × [외모 조합] × [기분/날씨 인사] × [취향 태그 + 숨은 옵션]
// S등급 대접을 받은 손님은 단골 수첩(state.book)에 남아, 다시 오면 단골 전용 대사로 인사한다.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
let gid = 1;

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
  next(available, presentIds) {
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
    const target = pick(available);
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
      self: (others.length ? pick(others) : target).id,
      greet: [g1, g2, pick(D.MOODS)],
      hints: this.hintsFor(tags, option),
      match: pick(D.MATCH),
      optYes: option ? pick(D.OPTION_YES[option]) : null,
      review: this.reviewFor(tags),
      generated: true,
    };
  }

  fromBook(b, available) {
    const D = this.D;
    const fav = registry.recipes.get(b.fav);
    const line = pick(D.REGULAR_GREET).replace('{fav}', fav?.name ?? '그 메뉴');
    return {
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
    return !prev;
  }
}
