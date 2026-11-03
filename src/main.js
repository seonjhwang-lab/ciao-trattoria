import './ui/styles.css';
import './ui/styles-v3.css';
import './ui/styles-v4.css';
import './ui/styles-v7.css';
import './ui/styles-v8.css';
import './ui/styles-v10.css';
import './ui/styles-v12.css';
import './ui/styles-v15.css';
import './ui/styles-v16.css';
import './ui/styles-v17.css';
import * as THREE from 'three';
import { registry } from './packs/index.js';
import { bus } from './core/EventBus.js';
import { GameState, LAYOUT_VER } from './core/GameState.js';
import { reactionsOn } from './core/Settings.js';
import { installViewportSync, viewport } from './core/Viewport.js';
installViewportSync(); // v17: --vvh / --vvt 를 가장 먼저
import { SceneManager } from './core/SceneManager.js';
import { LabelLayer } from './core/Labels.js';
import { DayCycle } from './core/DayCycle.js';
import { GridSystem, worldToTile, tileCenter } from './core/GridSystem.js';
import { WallCutaway } from './core/WallCutaway.js';
import { FurnitureManager } from './core/FurnitureManager.js';
import { CafeAI } from './core/CafeAI.js';
import { Effects } from './core/Effects.js';
import { BuildController } from './core/BuildMode.js';
import { SoundManager } from './core/SoundManager.js';
import { DialogueEngine } from './core/DialogueEngine.js';
import { preloadAssets } from './core/AssetLoader.js';
import { buildDiorama } from './core/Diorama.js';
import { HUD, mountToast } from './ui/HUD.js';
import { BuildUI } from './ui/BuildUI.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { Workbench3D } from './workbench/Workbench3D.js';
import { RegularsBook } from './ui/RegularsBook.js';
import { IntroModal, ConfirmModal, TastingCard } from './ui/Overlays.js';
import { installHiddenGuard } from './ui/hiddenGuard.js';
import { buildHeroDish } from './core/HeroDish.js';
import { buildBistroDish } from './core/BistroDish.js';
import { Progress, STAGES, CATALOG, GUESTS_PER_DAY, freshDay } from './core/Progress.js';
import { CatalogUI, DaySummary, LetterModal } from './ui/Trattoria.js';

const SKIP_INTRO = 'cozy-bistro.skipIntro';
const session = {
  get(k) {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v === null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch {
      /* 저장소가 막혀 있으면 인트로가 한 번 더 뜰 뿐 */
    }
  },
};

const toast = (m) => bus.emit('toast', m);

async function boot() {
  installHiddenGuard(document.body);
  // v15: 전역 터치 가로채기 없음 — UI 는 표준 click, 매장(캔버스)은 캔버스 자신의 pointer 이벤트
  const app = document.getElementById('app');
  const ui = document.getElementById('ui');

  // ───────── 상태 ─────────
  const state = new GameState();
  const save = GameState.loadSave();
  if (save) state.applySave(save);
  else state.money = registry.basePack?.startingMoney ?? state.money;
  state.speed = 1; // 10차: 배속/일시정지 없음
  const progress = new Progress(state); // v12 설비 해금 · 인테리어 · 일일 정산 (마스터 조리대 모델이 읽는다)
  // 저장에는 매장 안 손님이 남지 않으므로, 오늘 입장 수는 실제로 대접을 마친 손님 수로 되돌린다
  progress.p.dayGuests = progress.p.dayStats.guests;

  await Promise.race([
    Promise.all(['40px "Nanum Pen Script"', '20px "Gowun Batang"', '700 40px "Playfair Display"', 'italic 600 20px "Playfair Display"'].map((f) => document.fonts?.load(f))).catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  await preloadAssets();

  // ───────── 씬 ─────────
  const sm = new SceneManager(app);
  const labels = new LabelLayer(app);
  const day = new DayCycle(sm);
  buildDiorama(sm.scene);
  const grid = new GridSystem(sm.scene);
  const walls = new WallCutaway(sm.scene);
  const furniture = new FurnitureManager(sm.scene, grid);
  const sound = new SoundManager(state.sound);
  const effects = new Effects(sm.scene, labels);
  const dialogue = new DialogueEngine(state);

  const applyFinish = (kind, id) => {
    const fin = registry.finishes[kind].get(id) ?? registry.finishes[kind].get(registry.defaultFinish(kind));
    if (!fin) return;
    state.finishes[kind] = fin.id;
    if (kind === 'wall') walls.setFinish(fin);
    else grid.setFloorFinish(fin);
  };
  applyFinish('wall', state.finishes.wall ?? registry.defaultFinish('wall'));
  applyFinish('floor', state.finishes.floor ?? registry.defaultFinish('floor'));
  // 7차 이전 배치(12x12 매장)는 새 10x10 비스트로 기본 매장으로 바꾼다
  const layoutOk = save?.layoutVer === LAYOUT_VER && Array.isArray(save.layout);
  furniture.load(layoutOk ? save.layout : registry.basePack?.defaultLayout ?? []);
  state.setDecor(furniture.decorScore());

  const ai = new CafeAI({ scene: sm.scene, grid, furniture, state, effects, labels, sound, dialogue });
  const build = new BuildController({ scene: sm.scene, grid, furniture, state, ai, effects, sound });
  const workbench = new Workbench3D({ sm, sound, furniture, day, root: ui, ai });
  workbench.walls = walls;
  const talkUI = new DialogueUI(ui, { engine: dialogue, sound, state });
  const book = new RegularsBook(ui, { state });
  const confirmUI = new ConfirmModal(ui);
  const tasteCard = new TastingCard(ui);
  const daySum = new DaySummary(ui);
  const letter = new LetterModal(ui);
  let catalog = null; // 아래에서 만든다 (decor 적용 함수가 필요)
  let lamps = [];
  const refreshLamps = () => {
    lamps = [...walls.lamps, ...furniture.lamps()];
  };
  refreshLamps();
  sm.target.copy(ai.chef.actor.root.position).setY(0);

  // ───────── 저장 ─────────
  let noSave = false;
  let saveTimer = 0;
  const saveNow = () => !noSave && state.save(furniture.serialize());
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  };
  bus.on('layout:changed', () => {
    state.setDecor(furniture.decorScore());
    refreshLamps();
    scheduleSave();
  });
  bus.on('customer:paid', scheduleSave);
  setInterval(saveNow, 10000);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => document.hidden && saveNow());

  let intro = null;
  const busy = () => talkUI.isOpen || workbench.isOpen || book.isOpen || confirmUI.isOpen || !!intro?.isOpen || !!ai.chef.prep || daySum.isOpen || letter.isOpen || !!catalog?.isOpen;

  // 처음부터: 세이브를 완전히 지우고 새로 시작 (인트로를 건너뛰고 바로 운영)
  const newGame = (skipIntro = true) => {
    noSave = true;
    GameState.clearSave();
    if (skipIntro) session.set(SKIP_INTRO, '1');
    location.reload();
  };

  // ───────── 액션 ─────────
  const viewTile = () => worldToTile(sm.target.x, sm.target.z);
  let hud;
  let buildUI;
  let current = null; // 지금 켜진 근접 행동
  const actions = {
    setMode(m) {
      if (m === state.mode || busy()) return;
      state.set('mode', m);
      build.setActive(m === 'build');
      buildUI.setVisible(m === 'build');
      document.body.classList.toggle('build', m === 'build');
      sound.tap();
      if (m === 'build') toast('꾸미기 모드 · 시간이 잠시 멈춰요');
    },
    toggleSound() {
      state.set('sound', !state.sound);
      sound.unlock();
      sound.setEnabled(state.sound);
      if (state.sound) sound.tap();
      toast(state.sound ? '조리 효과음 ON' : '조리 효과음 OFF');
      scheduleSave();
    },
    async askRestart() {
      if (busy()) return;
      sound.tap();
      const yes = await confirmUI.ask({ title: '처음부터 다시 할까요?', text: '저장된 트라토리아(돈 · 평판 · 단골 수첩 · 인테리어)가 모두 지워지고 인트로 화면으로 돌아가요.', yes: '처음부터', no: '계속 운영' });
      if (yes) newGame(false);
    },
    onReactionsToggled(on) {
      sound.tap?.();
      if (!on) tasteCard.hide?.();
      toast(on ? '손님 리액션 ON · 줌인 · 감탄 · 품평 카드를 보여 줘요' : '리액션 OFF · 바로 주문 · 금액만 표시해요');
    },
    tapOrder(order) {
      if (state.mode !== 'live' || busy()) return;
      if (ai.chef.carry?.order === order) return tapCustomer(order.customer);
      if (order.status === 'accepted') {
        const st = furniture.stations(order.recipe.station)[0] ?? furniture.stations('master')[0]; // v14: 통합 마스터 조리대로
        if (st) return tapStation(st);
      }
      tapCustomer(order.customer);
    },
    startPlacing(defId) {
      build.startPlacing(defId, viewTile());
    },
    applyFinish(kind, id) {
      applyFinish(kind, id);
      sound.plop();
      toast(kind === 'wall' ? '벽 마감재를 바꿨어요' : '바닥재를 바꿨어요');
      scheduleSave();
    },
    openCatalog() {
      if (workbench.isOpen || talkUI.isOpen) return;
      sound.tap();
      catalog.open();
    },
    openBook() {
      if (workbench.isOpen || talkUI.isOpen) return;
      sound.tap();
      book.open();
    },
    // 근접 행동 버튼
    interact() {
      const it = current;
      if (!it || it.type === 'hint' || busy() || state.mode !== 'live') return;
      sound.tap();
      if (it.type === 'talk') return startTalk(it.customer);
      if (it.type === 'cook') return startCook(it.order, it.station);
      if (it.type === 'serve') return ai.serve();
    },
  };

  let matchZoomT = 0;
  function startTalk(c) {
    const available = ai.available();
    if (!available.length) return toast('조리대가 없어서 주문을 받을 수 없어요. 꾸미기에서 놓아 주세요');
    ai.beginTalk(c);
    const at = c.actor.root.position.clone().setY(0.9);
    if (reactionsOn()) sm.focus({ target: at, pitch: 0.55, width: 3.2 });
    talkUI.open(c, available, {
      // 취향 저격 추천: 카메라가 손님 쪽으로 살짝 줌인 + 손뼉·끄덕임
      onMatch: () => {
        sound.success?.();
        if (!reactionsOn()) return; // v15 리액션 OFF: 줌인 · 손뼉 없이 바로 주문
        // 손님 얼굴 · 상반신이 잘 보이게 부드럽게 줌인 → 반짝이는 별눈 + 손뼉 + 상체 들썩
        sm.focus({ target: c.actor.root.position.clone().setY(1.05), pitch: 0.32, width: 1.9 });
        ai.cheer(c, 2.8, 'delighted');
        effects.hearts(c.actor.root.position.clone().setY(2.0), 6);
        clearTimeout(matchZoomT);
        matchZoomT = setTimeout(() => !workbench.isOpen && !talkUI.isOpen && sm.unfocus(), 2800);
      },
      onBack: () => reactionsOn() && sm.focus({ target: at, pitch: 0.55, width: 3.2 }),
      onOrder: (recipe, option, info) => {
        if (!info?.matched) sm.unfocus();
        ai.acceptOrder(c, recipe, option);
        if (info?.line && reactionsOn()) ai.say(c, info.line, info.matched ? 3.6 : 2.6);
        toast(`${recipe.name} 주문 접수 · 마스터 조리대를 탭해요`);
      },
      onClose: () => {
        sm.unfocus();
        ai.endTalkWithoutOrder(c);
      },
    });
  }

  function startCook(order, station) {
    order.status = 'cooking';
    bus.emit('orders:changed');
    ai.chefPrep(furniture.worldCenter(station), () => openBench(order, station));
  }

  function openBench(order, station) {
    ai.chef.actor.root.visible = false;
    workbench.open(order, station, {
      onDone: (result, dish) => {
        ai.chef.actor.root.visible = true;
        ai.chefCooked(order, result, dish);
        toast(`${order.customer.persona.name} 님께 직접 가져다드려요`);
      },
      onCancel: () => {
        ai.chef.actor.root.visible = true;
        order.status = 'accepted';
        bus.emit('orders:changed');
        toast('주문은 그대로예요. 준비되면 다시 시작해요');
      },
    });
  }

  // ───────── v12 일일 영업 사이클 · 카탈로그 · 단골 편지 ─────────
  const masterInst = () => [...furniture.items.values()].find((i) => i.def.station === 'master');
  const rebuildMaster = () => {
    const m = masterInst();
    if (m) furniture.rebuild(m);
    refreshLamps();
  };
  let dayEnding = false;
  function checkDayEnd() {
    const P = progress.p;
    if (dayEnding || daySum.isOpen || P.dayGuests < GUESTS_PER_DAY) return;
    if (ai.customers.length || ai.orders.length || ai.chef.carry || busy()) return;
    dayEnding = true;
    // 따뜻한 저녁 조명과 함께 정산서
    state.minutes = 19.5 * 60;
    sound.fanfare?.();
    setTimeout(() => {
      daySum.show(
        { day: state.day, stats: P.dayStats, money: state.money, cozy: progress.cozy(), tipBonus: progress.tipBonus() },
        {
          onUpgrade: () => catalog.open(),
          onNext: () => {
            state.nextDay();
            P.dayGuests = 0;
            P.dayStats = freshDay();
            dayEnding = false;
            ai.spawnTimer = 2;
            toast(`Day ${state.day} 영업 시작! 오늘도 손님 ${GUESTS_PER_DAY}명을 맞이해요`);
            saveNow();
          },
        },
      );
    }, 900);
  }

  // 인테리어 적용
  const decorRoot = new THREE.Group();
  sm.scene.add(decorRoot);
  let pendantLamps = [];
  function tablesNow() {
    return [...furniture.items.values()].filter((i) => i.def.table);
  }
  function buildPendants() {
    decorRoot.clear();
    pendantLamps = [];
    if (!progress.owns('props', 'pendant')) return refreshLamps();
    const k = ai.kit ?? null;
    for (const t of tablesNow()) {
      const c = furniture.worldCenter(t);
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a24a').convertSRGBToLinear(), metalness: 0.8, roughness: 0.35 });
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      cord.position.y = 2.55;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 24, 1, true), brass);
      shade.material.side = THREE.DoubleSide;
      shade.position.y = 2.22;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a8').convertSRGBToLinear() }));
      bulb.position.y = 2.15;
      bulb.userData.noOutline = true;
      // 펜던트는 낮에도 은은하게 켜 둔다 (DayCycle 램프 목록에 넣지 않음 → 세기 고정)
      const light = new THREE.PointLight(new THREE.Color('#ffc98a').convertSRGBToLinear(), 0.55, 3.2, 2);
      light.position.y = 2.05;
      g.add(cord, shade, bulb, light);
      decorRoot.add(g);
      pendantLamps.push(light);
    }
    void k;
    refreshLamps();
  }
  let wineRack = null;
  function buildWine() {
    const north = walls.northGroup;
    if (wineRack) wineRack.parent?.remove(wineRack);
    wineRack = null;
    if (!north || !progress.owns('props', 'wine')) return;
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a3a26').convertSRGBToLinear(), roughness: 0.6 });
    const z = 0.12;
    // 마름모 격자 와인 랙 + 와인병
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.74, 0.04), wood));
    g.children[0].position.set(0, 0, 0.02);
    for (let i = -2; i <= 2; i++) {
      for (const sgn of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.86, 0.04), wood);
        bar.position.set(i * 0.12, 0, 0.06);
        bar.rotation.z = sgn * 0.75;
        bar.scale.y = 0.7;
        g.add(bar);
      }
    }
    const bottleCols = ['#3a1a20', '#2c3a22', '#5a2230', '#1f2a1c'];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(bottleCols[(r + c) % 4]).convertSRGBToLinear(), roughness: 0.15, metalness: 0.1 }));
        b.rotation.x = Math.PI / 2;
        b.position.set(-0.21 + c * 0.14, -0.22 + r * 0.22, 0.1);
        g.add(b);
      }
    g.position.set(2.0, 1.95, z - 0.08);
    // 작은 액자 두 점 (선반 위)
    // 액자 두 점 (선반 위 벽, 월드 x 0.2 · 0.8)
    for (const [wx, col] of [[0.2, '#b8603e'], [0.8, '#4a6338']]) {
      const x = wx - 1.9 + 0.95;
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.03), new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b1d14').convertSRGBToLinear() }));
      f.position.set(x - 0.95, 0.45, 0);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), roughness: 0.9 }));
      art.position.set(x - 0.95, 0.45, 0.017);
      g.add(f, art);
    }
    north.add(g);
    wineRack = g;
  }
  function placeTable3() {
    if (!progress.owns('extra', 'table3')) return;
    if (tablesNow().some((t) => t.tx === 5 && t.tz === 6)) return;
    const set = CATALOG.tableSet.find((x) => x.id === progress.p.sel.tableSet) ?? CATALOG.tableSet[0];
    furniture.place(set.table, 5, 6, 0);
    furniture.place(set.chair, 5, 5, 0);
    furniture.place(set.chair, 4, 6, 1);
  }
  function swapTableSet(id) {
    const set = CATALOG.tableSet.find((x) => x.id === id);
    if (!set) return false;
    if (ai.customers.some((c) => c.seat)) return toast('손님이 모두 떠난 뒤에 바꿀 수 있어요'), false;
    for (const inst of [...furniture.items.values()]) {
      if (!inst.def.table && !inst.def.seat) continue;
      const nid = inst.def.table ? set.table : set.chair;
      if (inst.defId === nid) continue;
      const { tx, tz, rot } = inst;
      furniture.remove(inst.id);
      furniture.place(nid, tx, tz, rot);
    }
    return true;
  }
  function applyDecor(kind, id) {
    const P = progress.p;
    if (kind === 'wall' || kind === 'floor') {
      P.sel[kind] = id;
      applyFinish(kind, id);
    } else if (kind === 'tableSet') {
      if (!swapTableSet(id)) return false;
      P.sel.tableSet = id;
    } else if (kind === 'extra') placeTable3();
    else if (kind === 'props') {
      if (id === 'olive' && ![...furniture.items.values()].some((i) => i.defId === 's1_plant_olive')) furniture.place('s1_plant_olive', 6, 7, 0, 1);
      if (id === 'wine') buildWine();
    }
    buildPendants();
    bus.emit('layout:changed');
    return true;
  }
  catalog = new CatalogUI(ui, {
    state,
    progress,
    onClose: () => scheduleSave(),
    onBuy: ({ kind, id }) => {
      if (kind === 'unlock') {
        const st = STAGES.find((x) => x.id === id);
        if (state.money < st.price) return toast(`${(st.price - state.money).toLocaleString('ko-KR')}원이 더 필요해요`);
        progress.unlock(id);
        rebuildMaster();
        sound.fanfare?.();
        toast(`${st.name} 해금! 마스터 조리대에 장비가 들어왔어요`);
      } else {
        const it = CATALOG[kind].find((x) => x.id === id);
        if (!progress.owns(kind, id)) {
          if (state.money < it.price) return toast(`${(it.price - state.money).toLocaleString('ko-KR')}원이 더 필요해요`);
          if (kind === 'tableSet' && ai.customers.some((c) => c.seat)) return toast('손님이 모두 떠난 뒤에 바꿀 수 있어요');
          progress.buy(kind, id);
          sound.coin?.();
        }
        if (applyDecor(kind, id) !== false) toast(`${it.name} 적용 · 아늑함 ★${progress.cozy()}`);
      }
      catalog.render();
      scheduleSave();
    },
  });
  // 저장된 꾸미기 다시 적용
  if (progress.p.sel.wall) applyFinish('wall', progress.p.sel.wall);
  if (progress.p.sel.floor) applyFinish('floor', progress.p.sel.floor);
  placeTable3();
  if (progress.owns('props', 'olive') && ![...furniture.items.values()].some((i) => i.defId === 's1_plant_olive')) furniture.place('s1_plant_olive', 6, 7, 0, 1);
  buildWine();
  buildPendants();
  // 단골 Lv.3 감사 편지 + 선물
  bus.on('regular:lv3', (e) => {
    setTimeout(() => {
      state.addMoney(30000);
      progress.p.gifts += 1;
      letter.show(
        {
          name: e.name,
          text: `셰프님, 매번 제 마음을 꼭 맞춘 요리를 내어 주셔서 고마워요. 이제 이곳은 제 소울 푸드 트라토리아예요. 작은 선물을 놓고 가요.`,
          gift: '특별 지원금 30,000원 + 단골의 선물 액자 (아늑함 +0.5★)',
        },
        () => scheduleSave(),
      );
    }, 2200);
  });

  hud = new HUD(ui, { state, ai, actions });
  buildUI = new BuildUI(ui, { build, state, actions });
  mountToast(ui);
  // v15: 리액션 OFF 면 큰 품평 카드 없이 상단에 금액 · 등급만 (머리 위 코인 팝업은 그대로)
  bus.on('tasting', (info) => {
    if (reactionsOn()) return tasteCard.show(info);
    toast(`${info.recipe.name} ${info.grade}등급 · +${info.pay.toLocaleString()}원`);
  });

  // ───────── 입력: 화면 탭 이동(Point & Click) + WASD/방향키, 꾸미기 모드에서는 드래그·탭 ─────────
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if ((k === 'e' || k === 'enter' || k === ' ') && !e.repeat) {
      e.preventDefault();
      actions.interact();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const canvas = sm.renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const setNdc = (x, y) => ndc.set(((x - viewport().left) / sm.w) * 2 - 1, -((y - viewport().top) / sm.h) * 2 + 1);
  const tileAt = (x, y) => {
    setNdc(x, y);
    ray.setFromCamera(ndc, sm.camera);
    const v = new THREE.Vector3();
    return ray.ray.intersectPlane(floorPlane, v) ? worldToTile(v.x, v.z) : null;
  };
  const pick = (x, y, roots) => {
    setNdc(x, y);
    ray.setFromCamera(ndc, sm.camera);
    // v12: 셰프 몸은 터치를 가로막지 않는다 (조리대 앞에 서 있어도 조리대가 눌린다)
    const chefRoot = ai.chef.actor.root;
    const ofChef = (o) => {
      for (let x = o; x; x = x.parent) if (x === chefRoot) return true;
      return false;
    };
    return ray.intersectObjects(roots, true).find((h) => h.object.isMesh && h.object.visible && !ofChef(h.object) && !(h.object.material?.transparent && h.object.material.opacity < 0.5));
  };

  const pointers = new Map();
  let gesture = null;
  // iOS 는 touchend / click 안에서만 소리를 켤 수 있다 (막지 않고 듣기만 한다)
  for (const ev of ['pointerdown', 'click', 'touchend']) window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 합성 이벤트 */
    }
    const q = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, { x: q.x, y: q.y });
    if (pointers.size === 1) {
      const onGhost = state.mode === 'build' && build.placing && build.ghostContains(tileAt(q.x, q.y));
      gesture = { type: onGhost ? 'ghost' : 'pan', moved: 0, t0: performance.now() };
    } else gesture = { type: 'multi', moved: 99, t0: 0 }; // 두 손가락 핀치 줌 없음
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !gesture) return;
    const q = { x: e.clientX, y: e.clientY };
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    p.x = q.x;
    p.y = q.y;
    if (gesture.type === 'pan') {
      gesture.moved += Math.abs(dx) + Math.abs(dy);
      // 운영 모드는 카메라가 셰프를 따라가므로 꾸미기 모드에서만 화면 이동
      if (gesture.moved > 6 && state.mode === 'build') sm.panByScreen(dx, dy);
    } else if (gesture.type === 'ghost') {
      build.moveGhostTo(tileAt(q.x, q.y));
    }
  });
  const endPointer = (e) => {
    const g = gesture;
    pointers.delete(e.pointerId);
    // v15: 캔버스 자신의 pointerup 으로 탭 판정 (pointercancel 은 탭이 아니다)
    const tap = e.type === 'pointerup' && g?.type === 'pan' && g.moved <= 10 && performance.now() - g.t0 < 900 && pointers.size === 0;
    if (tap && state.mode === 'build') buildTap(e.clientX, e.clientY);
    else if (tap && state.mode === 'live' && !busy()) liveTap(e.clientX, e.clientY);
    if (pointers.size === 0) gesture = null;
    else gesture = { type: 'multi', moved: 99, t0: 0 };
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // 마우스 휠 줌 없음 (스크롤도 막는다)
  canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  // ───────── 운영 모드 탭: 바닥 = 그 자리로 걷기, 손님/조리대 = 걸어가서 바로 상호작용 ─────────
  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.16, 0.22, 48);
  function ripple(v) {
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc95a').convertSRGBToLinear(), transparent: true, opacity: 0.9, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(v.x, 0.02, v.z);
      m.renderOrder = 4;
      sm.scene.add(m);
      ripples.push({ m, t: -i * 0.16 });
    }
  }
  function updateRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.t += dt;
      const u = Math.max(0, r.t / 0.7);
      r.m.scale.setScalar(0.6 + u * 2.4);
      r.m.material.opacity = 0.9 * (1 - u);
      r.m.visible = r.t >= 0;
      if (u >= 1) {
        sm.scene.remove(r.m);
        r.m.material.dispose();
        ripples.splice(i, 1);
      }
    }
  }

  let walkTarget = null; // 걸어가는 중인 대상 (골드 링 표시용)
  const goTo = (tile, opts, target = null) => {
    const ok = ai.walkChefTo(tile, {
      ...opts,
      arrive: () => {
        walkTarget = null;
        opts.arrive?.();
      },
    });
    if (ok) walkTarget = target;
    return ok;
  };

  // 쟁반을 든 채로 손님(말풍선 · 캐릭터 · 테이블 · 의자 · 주문 티켓 · 서빙 링)을 탭하면 → 테이블 앞까지 걸어가 도착 즉시 서빙
  function serveRoute(c) {
    const cp = c.actor.root.position;
    const tile = ai.approachTile(c) ?? ai.nearestWalkable(c.seat?.tableTile ?? worldToTile(cp.x, cp.z));
    const arrive = () => ai.chef.carry?.order.customer === c && ai.serve();
    if (tile && goTo(tile, { face: cp, arrive }, { customer: c })) return true;
    // 이미 테이블 곁이면 바로 내려놓는다
    if (Math.hypot(ai.chef.actor.root.position.x - cp.x, ai.chef.actor.root.position.z - cp.z) < 1.8) return arrive(), true;
    toast('테이블로 가는 길이 막혀 있어요');
    return false;
  }

  function tapCustomer(c) {
    if (state.mode !== 'live' || busy()) return;
    sound.tap();
    const carry = ai.chef.carry;
    const cp = c.actor.root.position;
    if (carry && carry.order.customer === c) return serveRoute(c);
    if (c.state === 'awaitTalk') {
      if (carry) toast(`먼저 ${carry.order.customer.persona.name} 님께 서빙해 주세요`);
      else if (!goTo(ai.approachTile(c), { face: cp, arrive: () => c.state === 'awaitTalk' && !busy() && startTalk(c) }, { customer: c })) toast('가까이 갈 길이 없어요');
      return;
    }
    if (c.state === 'ordered') toast(`${c.persona.name} 님 주문은 ${c.order.status === 'ready' ? '쟁반에 담겨 있어요' : '조리를 기다리고 있어요'}`);
  }

  function tapStation(inst) {
    sound.tap();
    if (ai.chef.carry) return toast(`먼저 ${ai.chef.carry.order.customer.persona.name} 님께 서빙해 주세요`);
    const front = furniture.frontTile(inst);
    const center = furniture.worldCenter(inst);
    const master = inst.def.station === 'master';
    const pick = () => ai.orders.find((o) => o.status === 'accepted' && (master || o.recipe.station === inst.def.station));
    if (!pick()) toast(master ? '아직 받은 주문이 없어요 · 손님을 먼저 탭해요' : `${registry.stations.get(inst.def.station)?.name ?? '이 조리대'}로 받은 주문이 없어요`);
    goTo(
      front,
      {
        face: center,
        arrive: () => {
          const order = pick();
          if (order && !busy()) startCook(order, inst);
        },
      },
      { inst },
    );
  }

  // 화면 좌표가 손님 머리 위 말풍선 위인가 (말풍선은 pointer-events:none 이라 캔버스가 탭을 받는다)
  function bubbleAt(x, y) {
    const carryTo = ai.chef.carry?.order.customer;
    for (const c of ai.customers) {
      // 상태 표시용 말풍선은 바닥 이동을 막지 않는다: 대화 대기 · 서빙 대상 말풍선만 손님 탭으로 받는다
      if (c.state !== 'awaitTalk' && c !== carryTo) continue;
      const el = c.bubble?.el;
      if (!el || !el.isConnected || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width && x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 10) return c;
    }
    return null;
  }

  // 테이블/의자를 탭하면 거기 앉은 손님으로
  function customerAtFurniture(inst) {
    if (!inst || !(inst.def.table || inst.def.seat)) return null;
    const at = ai.customers.filter((c) => c.seat && (c.seat.table === inst || c.seat.chair === inst));
    const carryTo = ai.chef.carry?.order.customer;
    return at.find((c) => c === carryTo) ?? at.find((c) => c.state === 'awaitTalk') ?? at[0] ?? null;
  }

  function liveTap(x, y) {
    {
      setNdc(x, y);
      ray.setFromCamera(ndc, sm.camera);
      const v = new THREE.Vector3();
      if (ray.ray.intersectPlane(floorPlane, v)) ripple(v);
      sound.tap();
    }
    const bc = bubbleAt(x, y);
    if (bc) return tapCustomer(bc);
    const hit = pick(x, y, [ai.root, furniture.root]);
    const c = hit ? ai.customerFromObject(hit.object) : null;
    if (c) return tapCustomer(c);
    const inst = hit ? furniture.fromObject(hit.object) : null;
    if (inst?.def.station) return tapStation(inst);
    const fc = customerAtFurniture(inst);
    if (fc) return tapCustomer(fc);
    // 바닥(또는 가구) → 그 지점에서 가장 가까운 빈 칸으로 걷기
    setNdc(x, y);
    ray.setFromCamera(ndc, sm.camera);
    const v = new THREE.Vector3();
    if (!ray.ray.intersectPlane(floorPlane, v)) return;
    // 쟁반을 들고 있을 때 서빙 링 근처 바닥 = 서빙
    const carryTo = ai.chef.carry?.order.customer;
    if (carryTo && serveRing.visible && Math.hypot(v.x - serveRing.position.x, v.z - serveRing.position.z) < 0.95) {
      ripple(v);
      return tapCustomer(carryTo);
    }
    const tile = ai.nearestWalkable(worldToTile(v.x, v.z));
    if (!tile) return;
    ripple(v);
    goTo(tile, {}, null);
  }

  // ───────── [여기를 탭하여 서빙] 타겟 링 (쟁반을 들고 있을 때 주문한 손님 테이블 바닥) ─────────
  const serveRing = new THREE.Group();
  const srMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e3b34a').convertSRGBToLinear(), transparent: true, opacity: 0.9, depthWrite: false });
  const srMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5f8a3e').convertSRGBToLinear(), transparent: true, opacity: 0.55, depthWrite: false });
  const srA = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 64), srMat);
  const srB = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.8, 64), srMat2);
  const srC = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e3b34a').convertSRGBToLinear(), transparent: true, opacity: 0.16, depthWrite: false }));
  for (const m of [srA, srB, srC]) {
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 4;
    serveRing.add(m);
  }
  serveRing.position.y = 0.03;
  serveRing.visible = false;
  sm.scene.add(serveRing);
  const srTagEl = document.createElement('div');
  srTagEl.className = 'serve-tag';
  srTagEl.textContent = '여기를 탭하여 서빙';
  const srTag = labels.add(srTagEl, { obj: serveRing, offset: new THREE.Vector3(0, 0.25, 0.7) });
  srTag.show(false);
  let srT = 0;
  function updateServeRing(dt) {
    const c = ai.chef.carry?.order.customer;
    const on = !!(c?.seat && state.mode === 'live' && !busy());
    serveRing.visible = on;
    srTag.show(on);
    if (!on) return;
    srT += dt;
    const tc = tileCenter(...c.seat.tableTile);
    serveRing.position.x = tc.x;
    serveRing.position.z = tc.z;
    srA.scale.setScalar(1 + Math.sin(srT * 4) * 0.04);
    srB.rotation.z += dt * 0.8;
    srMat.opacity = 0.7 + Math.sin(srT * 4) * 0.2;
  }
  bus.on('customer:tap', tapCustomer);

  function buildTap(x, y) {
    if (build.placing) return build.moveGhostTo(tileAt(x, y));
    const hit = pick(x, y, [furniture.root]);
    const inst = hit ? furniture.fromObject(hit.object) : null;
    if (inst) {
      build.select(inst);
      sound.tap();
    } else build.deselect();
  }

  // 화면 기준 입력 → 월드 방향 (화면 위쪽 = 카메라가 보는 방향)
  const moveInput = () => {
    let sx = 0;
    let sy = 0;
    if (keys.has('a') || keys.has('arrowleft')) sx -= 1;
    if (keys.has('d') || keys.has('arrowright')) sx += 1;
    if (keys.has('w') || keys.has('arrowup')) sy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) sy += 1;
    const m = Math.hypot(sx, sy);
    if (m > 1) {
      sx /= m;
      sy /= m;
    }
    const yaw = sm.yaw;
    const right = [Math.cos(yaw), -Math.sin(yaw)];
    const fwd = [-Math.sin(yaw), -Math.cos(yaw)];
    return [right[0] * sx - fwd[0] * sy, right[1] * sx - fwd[1] * sy];
  };

  // ───────── 골드 하이라이트 링 (지금 상호작용할 대상) ─────────
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f0c869').convertSRGBToLinear(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ringMatB = ringMat.clone();
  const ring = new THREE.Group();
  const ringA = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 64), ringMat);
  const ringB = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.625, 64), ringMatB);
  for (const m of [ringA, ringB]) {
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 3;
    ring.add(m);
  }
  ring.position.y = 0.025;
  sm.scene.add(ring);
  let ringT = 0;
  const ringPos = new THREE.Vector3();
  function updateRing(dt) {
    ringT += dt;
    const it = walkTarget ?? (current && current.type !== 'hint' ? current : null);
    const obj = it ? it.customer?.actor.root ?? (it.station ?? it.inst)?.object : null;
    if (obj) {
      obj.getWorldPosition(ringPos);
      const k = ringMat.opacity < 0.05 ? 1 : Math.min(1, dt * 12);
      ring.position.x += (ringPos.x - ring.position.x) * k;
      ring.position.z += (ringPos.z - ring.position.z) * k;
    }
    ringMat.opacity += ((obj ? 0.85 : 0) - ringMat.opacity) * Math.min(1, dt * 8);
    ring.visible = ringMat.opacity > 0.02;
    ringA.scale.setScalar(1 + Math.sin(ringT * 4) * 0.05);
    const u = (ringT * 0.8) % 1;
    ringB.scale.setScalar(1 + u * 0.3);
    ringMatB.opacity = ringMat.opacity * (1 - u);
  }

  // ───────── 루프 ─────────
  let last = performance.now();
  let chefIdleOut = 0;
  let clockT = 0;
  const step = (dt) => {
    clockT += dt;
    const live = state.mode === 'live';
    const sim = live && !busy() ? dt : 0; // 10차: 배속/일시정지 없음
    // v12: 오늘 대접한 손님 수에 따라 아침 9시 → 저녁 7시
    state.tick(sim, 9 * 60 + (progress.p.dayStats.guests / GUESTS_PER_DAY) * 10 * 60);
    checkDayEnd();
    ai.update(sim, clockT);
    if (live && !busy()) {
      const [vx, vz] = moveInput();
      ai.moveChef(vx, vz, dt);
      sm.follow(ai.chef.actor.root.position);
      current = ai.chefWalking ? null : ai.interaction();
      if (!ai.chefWalking) walkTarget = null;
    } else {
      ai.chef.actor.manual = 0;
      current = null;
    }
    if (live && (!busy() || ai.chef.prep)) ai.updateChef(dt);
    else if (live) ai.chef.actor.animate(dt);
    // v13: 할 일이 없으면 셰프는 패스 카운터 안쪽 주방으로 돌아가 대기한다
    if (live && !busy() && !ai.chef.goto && !ai.chef.carry && !ai.chef.prep && !ai.chef.actor.path.length) {
      const tz = ai.chefTile()[1];
      chefIdleOut = tz >= 3 ? chefIdleOut + dt : 0;
      if (chefIdleOut > 2.5) {
        chefIdleOut = 0;
        goTo(ai.homeTile(), {});
      }
    } else chefIdleOut = 0;
    if (intro?.isOpen) {
      introT += dt;
      sm.yawTarget = introBase.yaw + Math.sin(introT * 0.16) * 0.16;
      sm.goal.x = introBase.x + Math.sin(introT * 0.11) * 0.6;
    }
    // 대화 중에는 게임 시간이 멈추지만, 마주 앉은 손님은 실시간으로 움직인다 (환호 · 끄덕임)
    if (talkUI.isOpen && talkUI.c) talkUI.c.actor.animate(dt);
    updateRing(dt);
    updateRipples(dt);
    updateServeRing(dt);
    workbench.update(dt);
    effects.update(dt);
    build.update();
    sm.update(dt);
    walls.update(dt, sm.camera);
    day.update(dt, state.minutes, lamps);
    walls.setSun(day.sunFactor);
    labels.update(sm.camera, sm.w, sm.h);
    buildUI.update(sm.camera, sm.w, sm.h);
    sm.render();
  };
  let loopErrors = 0;
  const frame = (now) => {
    // v13: 업데이트 중 예외가 나도 화면이 멈추지 않게 (다음 프레임은 항상 예약)
    requestAnimationFrame(frame);
    try {
      step(Math.min(0.05, (now - last) / 1000));
    } catch (e) {
      if (loopErrors++ < 5) console.error('frame', e);
      try {
        sm.render();
      } catch {
        /* 렌더도 실패하면 이번 프레임은 건너뛴다 */
      }
    }
    last = now;
  };
  requestAnimationFrame(frame);

  const loading = document.getElementById('loading');
  loading.classList.add('done');
  setTimeout(() => (loading.style.display = 'none'), 700);
  // ───────── 인트로 타이틀 ─────────
  let introT = 0;
  const introBase = { yaw: Math.PI / 4, x: 0 };
  const welcome = () => setTimeout(() => toast(save ? `Day ${state.day} · 오늘도 손님 ${GUESTS_PER_DAY}명을 맞이해요` : '손님을 탭해 주문 → 마스터 조리대를 탭해 요리해요'), 500);
  if (session.get(SKIP_INTRO)) {
    session.set(SKIP_INTRO, null);
    welcome();
  } else {
    const counterInst = [...furniture.items.values()].find((i) => i.def.counter) ?? furniture.stations()[0];
    const c0 = counterInst ? furniture.worldCenter(counterInst) : new THREE.Vector3(0, 0, -3);
    introBase.x = c0.x - 1.2;
    sm.focus({ target: new THREE.Vector3(introBase.x, 0.95, c0.z + 0.6), yaw: introBase.yaw, pitch: 0.36, width: 4.6 });
    intro = new IntroModal(ui, {
      hasSave: !!save,
      onContinue: () => {
        sound.unlock();
        sound.tap();
        intro.close();
        sm.unfocus();
        welcome();
      },
      onNew: async () => {
        sound.unlock();
        sound.tap();
        if (!save) {
          intro.close();
          sm.unfocus();
          return welcome();
        }
        const yes = await confirmUI.ask({ title: '새 트라토리아를 시작할까요?', text: '저장된 돈 · 평판 · 단골 수첩 · 인테리어가 모두 지워져요.', yes: '새로 시작', no: '취소' });
        if (yes) newGame(true);
      },
    });
  }

  // 개발/테스트용 핸들
  window.__cafe = {
    state, ai, furniture, build, sm, grid, registry, walls, actions, day, sound, workbench, talkUI, dialogue, hud, book, confirmUI, tasteCard,
    keys,
    get intro() {
      return intro;
    },
    dishes: { buildHeroDish, buildBistroDish },
    progress, catalog: () => catalog, daySum, letter,
    tap: liveTap,
    tapCustomer,
    tapStation,
    advance(seconds, dt = 1 / 30) {
      for (let t = 0; t < seconds; t += dt) step(dt);
    },
    reset() {
      noSave = true;
      GameState.clearSave();
      location.reload();
    },
  };
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  l.style.display = '';
  l.classList.remove('done');
  l.innerHTML = `<p>준비 중 문제가 생겼어요<br/><small>${e.message}</small></p>`;
});
