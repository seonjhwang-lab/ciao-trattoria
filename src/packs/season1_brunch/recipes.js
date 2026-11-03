// 시즌 1 · 코지 비스트로 레시피 (3D 워크벤치 단계 데이터)
// 파스타:     roll(밀대) · cut_pasta{width, strands}(제면) · toss{sauce}(팬 토스/만테까레) · twirl(트위저 말기) · grate(치즈 강판)
// 화덕 피자: stretch(도우 펴기) · ladle{sauce}(국자 스월) · slice · top{layers}(토핑 올리기) · bake(화덕) · top{post:true}(구운 뒤 가니쉬)
// 샐러드:     slice · dress{dressing}(지그재그 드레싱) · toss_salad(우드 서버 토싱)
// 도마 단계:   slice{items:[{ing,cuts}]} · spread{spreads:[ing]} · plate{style:'fan'|'stack', layers:[ing|'bread_top'], distractors}
//              drizzle{liquid:'oil'|'honey'} · pepper
// 에스프레소: grind · tamp · syrup{pumps} · extract · water · steam · art{templates}
// tags 는 손님 취향 매칭(맞춤 메뉴 추천)에 쓰인다.

// 재료: 썰 수 있는 것(kind: loaf/round/oval)은 단면 텍스처 슬롯을 갖고, prepped 는 미리 준비된 토핑
export const ingredients = {
  sourdough: { name: '통밀 사워도우 식빵', kind: 'loaf', color: '#9c5f2a', inner: '#e8cf9f', len: 0.26, w: 0.12, h: 0.085, slot: 'sourdough' },
  brioche: { name: '버터 브리오슈', kind: 'loaf', color: '#a9621f', inner: '#f0d59a', len: 0.22, w: 0.1, h: 0.09, slot: 'brioche' },
  tomato: { name: '완숙 토마토', kind: 'round', color: '#b8372a', inner: '#d9533f', len: 0.075, w: 0.075, h: 0.07, slot: 'tomato' },
  avocado: { name: '아보카도', kind: 'oval', color: '#34492a', inner: '#c6d27a', len: 0.11, w: 0.07, h: 0.065, slot: 'avocado' },
  fig: { name: '무화과', kind: 'round', color: '#5a2f45', inner: '#d4746f', len: 0.055, w: 0.055, h: 0.055, slot: 'fig' },
  lettuce: { name: '로메인 상추', kind: 'prepped', shape: 'leaf', color: '#6f9a42' },
  bacon: { name: '훈연 베이컨', kind: 'prepped', shape: 'strip', color: '#8f3a28', inner: '#e3b49b' },
  egg: { name: '수란', kind: 'prepped', shape: 'egg', color: '#fbf6ec', inner: '#eea12a' },
  arugula: { name: '루꼴라', kind: 'prepped', shape: 'leaf', color: '#4c6b33' },
  ham: { name: '잠봉 햄', kind: 'prepped', shape: 'strip', color: '#d48a84', inner: '#efc0b8' },
  grain_mustard: { name: '홀그레인 머스타드', kind: 'spread', color: '#b8902f', bits: ['#6e5418', '#d9b04c'], bump: 0.6 },
  ricotta: { name: '리코타 크림치즈', kind: 'spread', color: '#f3efe6', bits: ['#ffffff', '#e2dccf'], bump: 0.8 },
  fig_compote: { name: '무화과 콩포트', kind: 'spread', color: '#6a2c38', bits: ['#c9566a', '#3d1820', '#e8b04c'], bump: 0.7 },
  basil_pesto: { name: '바질 페스토', kind: 'spread', color: '#4f6b25', bits: ['#2c4012', '#e8dcb0', '#7d9a3a'], bump: 0.6 },
  // 비스트로 재료
  mozzarella: { name: '부팔라 모짜렐라', kind: 'round', color: '#f7f4ec', inner: '#fbf9f3', len: 0.075, w: 0.07, h: 0.066, slot: 'mozzarella' },
  cucumber: { name: '오이', kind: 'oval', color: '#355f2a', inner: '#dcebb4', len: 0.14, w: 0.046, h: 0.046, slot: 'cucumber' },
  cherry_tomato: { name: '방울토마토', kind: 'round', color: '#c8321f', inner: '#e0583c', len: 0.036, w: 0.036, h: 0.036, slot: 'cherry' },
  romaine: { name: '로메인 하트', kind: 'oval', color: '#5c8c38', inner: '#e8f0c6', len: 0.2, w: 0.075, h: 0.07, slot: 'romaine' },
  basil: { name: '생바질', kind: 'prepped', shape: 'leaf', color: '#3f7f2a' },
  prosciutto: { name: '프로슈토', kind: 'prepped', shape: 'strip', color: '#c9706a', inner: '#f1d2c8' },
};

// 서빙용 기본 모양 (워크벤치를 거치지 않을 때의 예비 모델)
function cupDish(k, { body = '#efebe3', coffee = '#2a160c', wide = false }) {
  const g = k.group();
  g.add(k.at(k.cyl(0.08, 0.07, 0.012, k.ceramic(body), { seg: 28 }), 0, 0.006, 0));
  const r = wide ? 0.058 : 0.045;
  g.add(k.at(k.cyl(r, r * 0.72, wide ? 0.065 : 0.07, k.ceramic(body), { seg: 24 }), 0, 0.048, 0));
  g.add(k.at(k.cyl(r - 0.005, r - 0.005, 0.003, k.mat(coffee, { rough: 0.25 })), 0, wide ? 0.08 : 0.083, 0));
  return g;
}

export const recipes = [
  // ───────── 생면 파스타 ─────────
  {
    id: 's1_pasta_truffle',
    it: 'Tajarin al Tartufo e Funghi',
    name: '트러플 머쉬룸 따야린',
    desc: '노른자 생면 따야린과 블랙 트러플 크림 소스', // v16 메뉴판 1줄 설명
    icon: 'pasta',
    station: 'pasta',
    price: 16500,
    tags: ['umami', 'creamy', 'chewy', 'savory'],
    options: [],
    hype: ['트러플 향 생면, 오늘 하루의 보상이에요.', '버섯 향 가득한 생면이 기대돼요.'],
    taste: ['따야린이 쫄깃하게 살아 있고 트러플 크림이 실크처럼 감겨요!', '버섯 감칠맛이 깊게 배었어요. 면발 하나하나에 소스가 완벽하게 코팅됐네요!'],
    steps: [
      { type: 'roll', label: '생면 반죽 밀기' },
      { type: 'cut_pasta', label: '따야린 제면', width: 'thin', strands: 12 },
      { type: 'toss', label: '트러플 크림 만테까레', sauce: 'truffle' },
      { type: 'twirl', label: '트위저로 돌돌 말기' },
      { type: 'grate', label: '파르미지아노 눈꽃' },
    ],
  },
  {
    id: 's1_pasta_ragu',
    it: 'Pappardelle al Ragù Classico',
    name: '클래식 라구 파파르델레',
    desc: '넓적한 생면 파파르델레와 진한 소고기 라구', // v16 메뉴판 1줄 설명
    icon: 'pasta',
    station: 'pasta',
    price: 17000,
    tags: ['hearty', 'umami', 'chewy', 'savory'],
    options: [],
    hype: ['진한 라구 생면, 벌써 든든해요.', '푹 끓인 라구 향이 벌써 느껴져요.'],
    taste: ['넓은 생면에 라구가 꾸덕하게 감겼어요. 고기 감칠맛이 깊어요!', '생면 파스타에 소스가 완벽하게 코팅되었네요! 씹을수록 진해요.'],
    steps: [
      { type: 'roll', label: '생면 반죽 밀기' },
      { type: 'cut_pasta', label: '파파르델레 제면', width: 'wide', strands: 6 },
      { type: 'toss', label: '라구 소스 팬 토스', sauce: 'ragu' },
      { type: 'twirl', label: '트위저로 돌돌 말기' },
      { type: 'grate', label: '파르미지아노 눈꽃' },
    ],
  },
  {
    id: 's1_pasta_pesto',
    it: 'Tagliatelle al Pesto Genovese',
    name: '바질페스토 생면 파스타',
    desc: '수제 탈리아텔레와 제노바식 생바질 페스토', // v16 메뉴판 1줄 설명
    icon: 'pasta',
    station: 'pasta',
    price: 15000,
    tags: ['herbal', 'fresh', 'chewy', 'nutty'],
    options: [],
    hype: ['바질 향 가득한 생면이 기대돼요.', '잣 고소함에 바질 향, 정말 좋아요.'],
    taste: ['바질 향이 정원처럼 퍼지고 생면이 탱글하게 씹혀요!', '페스토가 면에 윤기 나게 유화됐어요. 잣의 고소함까지 살아 있네요!'],
    steps: [
      { type: 'roll', label: '생면 반죽 밀기' },
      { type: 'cut_pasta', label: '탈리아텔레 제면', width: 'medium', strands: 9 },
      { type: 'toss', label: '바질 페스토 만테까레', sauce: 'pesto' },
      { type: 'twirl', label: '트위저로 돌돌 말기' },
      { type: 'grate', label: '파르미지아노 눈꽃' },
    ],
  },
  // ───────── 화덕 피자 ─────────
  {
    id: 's1_pizza_margherita',
    it: 'Pizza Margherita di Bufala',
    name: '마르게리타 부팔라 피자',
    desc: '산마르자노 토마토 소스와 생 부팔라 모짜렐라', // v16 메뉴판 1줄 설명
    icon: 'pizza',
    station: 'pizza',
    price: 18000,
    tags: ['cheesy', 'tangy', 'herbal', 'crispy'],
    options: [],
    hype: ['갓 구운 마르게리타, 정말 기대돼요.', '나폴리 그대로의 맛이 기대돼요.'],
    taste: ['코르니초네가 바삭하게 부풀고 부팔라가 크리미하게 녹았어요!', '새콤한 토마토소스에 바질 향, 치즈가 쭉 늘어나요. 완벽한 나폴리예요!'],
    steps: [
      { type: 'stretch', label: '수제 도우 스트레칭' },
      { type: 'ladle', label: '산마르자노 소스 스월링', sauce: 'tomato' },
      { type: 'slice', label: '모짜렐라 · 토마토 썰기', items: [{ ing: 'mozzarella', cuts: 3 }, { ing: 'tomato', cuts: 3 }] },
      { type: 'top', label: '토핑 올리기', layers: ['mozzarella', 'tomato', 'basil'] },
      { type: 'bake', label: '화덕에 굽기' },
      { type: 'wheel', label: '피자 휠 커팅 & 올리브오일' },
    ],
  },
  {
    id: 's1_pizza_truffle',
    it: 'Pizza Tartufo, Rucola e Crudo',
    name: '트러플 루꼴라 프로슈토 피자',
    desc: '트러플 크림 위에 프로슈토와 생 루꼴라를 올린 피자', // v16 메뉴판 1줄 설명
    icon: 'pizza',
    station: 'pizza',
    price: 21000,
    tags: ['cheesy', 'smoky', 'savory', 'umami'],
    options: [],
    hype: ['트러플에 프로슈토, 오늘은 사치할래요.', '장작 향 도우에 트러플, 황홀해요.'],
    taste: ['트러플 크림이 고소하고 프로슈토가 짭조름하게 녹아요!', '화덕 향 밴 테두리가 바삭하고 루꼴라가 산뜻하게 마무리해요!'],
    steps: [
      { type: 'stretch', label: '수제 도우 스트레칭' },
      { type: 'ladle', label: '트러플 크림 스월링', sauce: 'truffle' },
      { type: 'slice', label: '모짜렐라 썰기', items: [{ ing: 'mozzarella', cuts: 4 }] },
      { type: 'top', label: '모짜렐라 올리기', layers: ['mozzarella'] },
      { type: 'bake', label: '화덕에 굽기' },
      { type: 'top', label: '프로슈토 · 루꼴라 가니쉬', layers: ['prosciutto', 'arugula'], post: true },
      { type: 'wheel', label: '피자 휠 커팅 & 올리브오일' },
    ],
  },
  // ───────── 가든 샐러드 ─────────
  {
    id: 's1_salad_fig',
    it: 'Insalata di Fichi e Ricotta',
    name: '리코타 무화과 가든 샐러드',
    desc: '어린잎 채소와 무화과, 리코타 발사믹 샐러드', // v16 메뉴판 1줄 설명
    icon: 'salad',
    station: 'salad',
    price: 14000,
    tags: ['veggie', 'fresh', 'fruity', 'sweet'],
    options: [],
    hype: ['무화과와 리코타, 색감부터 설레요.', '발사믹 채소에 몸이 벌써 좋아해요.'],
    taste: ['무화과가 달콤하게 터지고 리코타가 부드럽게 감싸요!', '채소가 아삭하게 살아 있고 발사믹이 골고루 버무려졌어요!'],
    steps: [
      { type: 'slice', label: '무화과 · 오이 · 방울토마토 썰기', items: [{ ing: 'fig', cuts: 3 }, { ing: 'cucumber', cuts: 5 }, { ing: 'cherry_tomato', cuts: 1 }] },
      { type: 'dress', label: '발사믹 드레싱 지그재그', dressing: 'balsamic' },
      { type: 'toss_salad', label: '우드 서버로 버무리기' },
    ],
  },
  {
    id: 's1_salad_caesar',
    it: "Insalata Cesare all'Avocado",
    name: '아보카도 시저 샐러드',
    desc: '로메인 상추와 바삭한 크루통, 파르미지아노', // v16 메뉴판 1줄 설명
    icon: 'salad',
    station: 'salad',
    price: 14500,
    tags: ['veggie', 'creamy', 'savory', 'crispy'],
    options: [],
    hype: ['로메인에 시저 드레싱, 최고 조합이죠.', '크루통까지 바삭하고 고소하겠어요.'],
    taste: ['로메인이 아삭하고 시저 드레싱이 크리미하게 코팅됐어요!', '크루통이 바삭하고 아보카도가 부드러워요. 식감의 축제예요!'],
    steps: [
      { type: 'slice', label: '로메인 · 아보카도 · 방울토마토 썰기', items: [{ ing: 'romaine', cuts: 3 }, { ing: 'avocado', cuts: 3 }, { ing: 'cherry_tomato', cuts: 1 }] },
      { type: 'dress', label: '시저 드레싱 지그재그', dressing: 'caesar' },
      { type: 'toss_salad', label: '우드 서버로 버무리기' },
    ],
  },
  {
    id: 's1_blt',
    it: 'Panino BLT Classico',
    hype: ['바삭한 베이컨 BLT, 클래식이 최고죠.'],
    taste: ['베이컨이 바삭하고 토마토가 새콤하게 받쳐줘요. 클래식의 정석이에요!'],
    name: '클래식 BLT 샌드위치',
    desc: '훈연 베이컨과 완숙 토마토, 로메인 샌드위치', // v16 메뉴판 1줄 설명
    icon: 'blt',
    station: 'sandwich',
    price: 9500,
    tags: ['savory', 'hearty', 'smoky', 'crispy'],
    options: ['extra_avocado', 'oil_pepper'],
    steps: [
      { type: 'slice', label: '빵과 토마토 썰기', items: [{ ing: 'sourdough', cuts: 3 }, { ing: 'tomato', cuts: 3 }] },
      { type: 'spread', label: '머스타드 바르기', spreads: ['grain_mustard'] },
      { type: 'plate', label: '레시피대로 쌓기', style: 'stack', layers: ['lettuce', 'bacon', 'tomato', 'bread_top'], distractors: ['egg', 'fig'] },
      { type: 'pepper', label: '통후추 갈기' },
      { type: 'halve', label: '대각선 반 자르기' },
    ],
    dish: (k) => cupDish(k, {}),
  },
  {
    id: 's1_avocado_toast',
    it: 'Bruschetta Avocado e Ricotta',
    hype: ['아보카도 부채꼴, 사진부터 찍을래요.'],
    taste: ['겉은 바삭한 브리오슈에 부드러운 리코타 결이 살아있어요!', '아보카도가 크리미하게 녹고 수란 노른자가 흘러요. 완벽해요!'],
    name: '아보카도 리코타 토스트',
    desc: '수제 리코타 치즈와 생 아보카도 오픈 토스트', // v16 메뉴판 1줄 설명
    icon: 'avocado',
    station: 'sandwich',
    price: 11000,
    tags: ['savory', 'creamy', 'fresh', 'crispy'],
    options: ['extra_avocado', 'oil_pepper'],
    steps: [
      { type: 'slice', label: '빵과 아보카도 썰기', items: [{ ing: 'sourdough', cuts: 2 }, { ing: 'avocado', cuts: 4 }] },
      { type: 'spread', label: '리코타 바르기', spreads: ['ricotta'] },
      { type: 'plate', label: '부채꼴 플레이팅', style: 'fan', layers: ['avocado', 'egg'], distractors: ['bacon', 'fig'] },
      { type: 'drizzle', label: '올리브오일 드리즐', liquid: 'oil' },
    ],
    dish: (k) => cupDish(k, {}),
  },
  {
    id: 's1_fig_toast',
    it: 'Brioche ai Fichi e Ricotta',
    hype: ['폭신한 브리오슈, 디저트 같은 브런치네요.'],
    taste: ['브리오슈가 구름처럼 폭신하고 무화과 콩포트가 달콤하게 퍼져요!'],
    name: '무화과 리코타 브리오슈',
    desc: '버터 브리오슈 위에 올린 무화과와 꿀 리코타', // v16 메뉴판 1줄 설명
    icon: 'fig',
    station: 'sandwich',
    price: 10500,
    tags: ['sweet', 'fruity', 'soft', 'creamy'],
    options: [],
    steps: [
      { type: 'slice', label: '브리오슈와 무화과 썰기', items: [{ ing: 'brioche', cuts: 2 }, { ing: 'fig', cuts: 3 }] },
      { type: 'spread', label: '리코타 & 무화과 콩포트', spreads: ['ricotta', 'fig_compote'] },
      { type: 'plate', label: '부채꼴 플레이팅', style: 'fan', layers: ['fig'], distractors: ['bacon', 'tomato'] },
      { type: 'drizzle', label: '꿀 드리즐', liquid: 'honey' },
    ],
    dish: (k) => cupDish(k, {}),
  },
  {
    id: 's1_pesto_toast',
    it: 'Tartina al Pesto e Pomodoro',
    hype: ['바질 페스토 향이 벌써 나요.'],
    taste: ['바질 향이 확 퍼지고 토마토가 새콤하게 터져요!'],
    name: '바질 페스토 토마토 오픈샌드',
    desc: '생바질 페스토와 방울토마토 사워도우 토스트', // v16 메뉴판 1줄 설명
    icon: 'pesto',
    station: 'sandwich',
    price: 10000,
    tags: ['savory', 'herbal', 'fresh', 'tangy'],
    options: ['oil_pepper', 'extra_avocado'],
    steps: [
      { type: 'slice', label: '빵과 토마토 썰기', items: [{ ing: 'sourdough', cuts: 2 }, { ing: 'tomato', cuts: 3 }] },
      { type: 'spread', label: '바질 페스토 바르기', spreads: ['basil_pesto'] },
      { type: 'plate', label: '부채꼴 플레이팅', style: 'fan', layers: ['tomato', 'arugula'], distractors: ['bacon', 'fig'] },
    ],
    dish: (k) => cupDish(k, {}),
  },
  {
    id: 's1_americano',
    it: 'Caffè Americano',
    hype: ['깔끔한 아메리카노, 딱 지금 필요했어요.'],
    taste: ['크레마가 고소하고 뒷맛이 깨끗하게 떨어져요!'],
    name: '아메리카노',
    desc: '9 Bar로 추출한 고소한 다크 로스트 커피', // v16 메뉴판 1줄 설명
    icon: 'americano',
    station: 'espresso',
    price: 4500,
    tags: ['clean', 'strong', 'light'],
    options: ['decaf'],
    steps: [
      { type: 'grind', label: '원두 분쇄 18g' },
      { type: 'tamp', label: '수평 탬핑' },
      { type: 'extract', label: '9 Bar 추출' },
      { type: 'water', label: '뜨거운 물 붓기' },
    ],
    dish: (k) => cupDish(k, { body: '#2e2e30' }),
  },
  {
    id: 's1_latte',
    it: 'Caffè Latte',
    hype: ['벨벳 같은 라떼에 마음이 풀려요.'],
    taste: ['밀크폼이 벨벳처럼 부드럽고 라떼아트까지 예뻐요!'],
    name: '카페라떼',
    desc: '진한 에스프레소와 부드러운 벨벳 스팀 밀크', // v16 메뉴판 1줄 설명
    icon: 'latte',
    station: 'espresso',
    price: 5500,
    tags: ['milky', 'smooth', 'mild', 'nutty'],
    options: ['decaf', 'oat_milk'],
    steps: [
      { type: 'grind', label: '원두 분쇄 18g' },
      { type: 'tamp', label: '수평 탬핑' },
      { type: 'extract', label: '9 Bar 추출' },
      { type: 'steam', label: '벨벳 스티밍' },
      { type: 'art', label: '프리푸어 라떼아트', templates: ['heart', 'tulip', 'rosetta'] },
    ],
    dish: (k) => cupDish(k, { wide: true, coffee: '#a87a52' }),
  },
  {
    id: 's1_vanilla_latte',
    it: 'Latte alla Vaniglia',
    hype: ['바닐라 빈 향이 벌써 달콤해요.'],
    taste: ['바닐라 향이 은은하고 우유가 매끄럽게 넘어가요!'],
    name: '바닐라 빈 라떼',
    desc: '천연 마다가스카르 바닐라 빈이 들어간 라떼', // v16 메뉴판 1줄 설명
    icon: 'vanilla',
    station: 'espresso',
    price: 6000,
    tags: ['sweet', 'milky', 'smooth'],
    options: ['decaf', 'oat_milk'],
    steps: [
      { type: 'grind', label: '원두 분쇄 18g' },
      { type: 'tamp', label: '수평 탬핑' },
      { type: 'syrup', label: '바닐라 시럽 2펌프', pumps: 2 },
      { type: 'extract', label: '9 Bar 추출' },
      { type: 'steam', label: '벨벳 스티밍' },
      { type: 'art', label: '프리푸어 라떼아트', templates: ['tulip', 'heart', 'rosetta'] },
    ],
    dish: (k) => cupDish(k, { wide: true, coffee: '#b48a5e' }),
  },
];

// 특별 옵션이 레시피 단계에 주는 변화
export function applyOption(recipe, option) {
  const steps = recipe.steps.map((s) => ({ ...s, items: s.items?.map((i) => ({ ...i })), layers: s.layers ? [...s.layers] : undefined }));
  if (option === 'extra_avocado') {
    const slice = steps.find((s) => s.type === 'slice');
    if (slice && !slice.items.some((i) => i.ing === 'avocado')) slice.items.push({ ing: 'avocado', cuts: 3 });
    const plate = steps.find((s) => s.type === 'plate');
    if (plate && !plate.layers.includes('avocado')) {
      const top = plate.layers.indexOf('bread_top');
      if (top >= 0) plate.layers.splice(top, 0, 'avocado');
      else plate.layers.push('avocado');
    }
  }
  if (option === 'oil_pepper') {
    if (!steps.some((s) => s.type === 'drizzle')) steps.push({ type: 'drizzle', label: '올리브오일 드리즐', liquid: 'oil' });
    if (!steps.some((s) => s.type === 'pepper')) steps.push({ type: 'pepper', label: '통후추 갈기' });
  }
  return steps;
}
