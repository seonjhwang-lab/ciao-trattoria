// 심즈식 확장팩 레지스트리.
// 팩은 { id, name, categories, stations, ingredients, furniture, recipes, finishes, defaultLayout } 데이터만 넘긴다.
// 엔진(core)은 팩 내용을 모른 채 레지스트리만 조회한다.
export class PackRegistry {
  constructor() {
    this.packs = [];
    this.furniture = new Map();
    this.recipes = new Map();
    this.stations = new Map();
    this.categories = new Map();
    this.ingredients = new Map();
    this.finishes = { wall: new Map(), floor: new Map() };
    this.personas = new Map();
    this.options = {};
    this.tags = {};
    this.guestData = null;
  }

  register(pack) {
    if (!pack || !pack.id) throw new Error('[PackRegistry] pack.id 가 필요합니다');
    if (this.packs.some((p) => p.id === pack.id)) return;
    this.packs.push(pack);

    for (const c of pack.categories ?? []) {
      if (!this.categories.has(c.id)) this.categories.set(c.id, { order: this.categories.size, ...c });
    }
    for (const s of pack.stations ?? []) this.stations.set(s.id, { ...s, pack: pack.id });
    for (const [id, ing] of Object.entries(pack.ingredients ?? {})) this.ingredients.set(id, { id, ...ing });
    for (const f of pack.furniture ?? []) {
      if (!f.id || typeof f.build !== 'function') {
        console.warn('[PackRegistry] build() 가 없는 가구는 건너뜁니다', f);
        continue;
      }
      this.furniture.set(f.id, { size: [1, 1], layer: 'object', price: 0, decor: 0, swatches: [{ name: '기본' }], ...f, pack: pack.id });
    }
    for (const r of pack.recipes ?? []) this.recipes.set(r.id, { ...r, pack: pack.id, applyOption: pack.applyOption });
    for (const p of pack.personas ?? []) this.personas.set(p.id, { ...p, pack: pack.id });
    Object.assign(this.options, pack.options ?? {});
    Object.assign(this.tags, pack.tags ?? {});
    if (pack.guests) this.guestData = pack.guests;
    for (const kind of ['wall', 'floor']) {
      for (const fin of pack.finishes?.[kind] ?? []) this.finishes[kind].set(fin.id, { ...fin, pack: pack.id });
    }
    console.info(`[PackRegistry] ${pack.name} — 가구 ${pack.furniture?.length ?? 0}, 레시피 ${pack.recipes?.length ?? 0}`);
  }

  getFurniture(id) {
    return this.furniture.get(id);
  }

  ingredient(id) {
    return this.ingredients.get(id) ?? { id, name: id, kind: 'prepped', shape: 'leaf', color: '#999999' };
  }

  listFurniture(category) {
    return [...this.furniture.values()].filter((f) => !f.hidden && (!category || f.category === category));
  }

  listCategories() {
    return [...this.categories.values()].sort((a, b) => a.order - b.order);
  }

  // 손님 주문 단계 (특별 옵션 반영)
  stepsFor(recipe, option) {
    return option && recipe.applyOption ? recipe.applyOption(recipe, option) : recipe.steps;
  }

  recipesForStations(stationTypes) {
    return [...this.recipes.values()].filter((r) => stationTypes.has(r.station));
  }

  get basePack() {
    return this.packs.find((p) => p.defaultLayout) ?? this.packs[0];
  }

  defaultFinish(kind) {
    return this.basePack?.defaultFinish?.[kind] ?? [...this.finishes[kind].keys()][0];
  }
}

export const registry = new PackRegistry();
