// 테스트 전용 (빌드 전 삭제)
window.T = {
  C: () => window.__cafe,
  boot() {
    const c = window.__cafe;
    const b = document.querySelector('.intro [data-a="continue"]:not([disabled])') || document.querySelector('.intro [data-a="new"]');
    if (c.intro?.isOpen) c.intro.close?.();
    document.querySelector('.intro')?.remove();
    return !!b;
  },
  bench(id) {
    const c = window.__cafe;
    if (c.workbench.isOpen) c.workbench.close();
    const r = c.registry.recipes.get(id);
    const st = c.furniture.stations(r.station)[0] ?? c.furniture.stations('master')[0];
    const persona = c.registry.personas ? [...(c.registry.personas.values?.() ?? [])][0] : null;
    const order = { recipe: r, steps: c.registry.stepsFor(r, null), customer: { persona: persona ?? { name: '테스트' } }, option: null, status: 'cooking' };
    c.workbench.open(order, st, { onDone: () => {}, onCancel: () => {} });
    c.advance(1.2);
    return { steps: order.steps.map((s) => s.type), station: st.def.station };
  },
  // 화면(앱) 좌표 → 워크벤치 터치 레이어에 포인터 이벤트
  ev(type, x, y) {
    const t = document.querySelector('.wb-touch');
    const r = t.getBoundingClientRect();
    void r;
    // 앱 좌표 → 화면 좌표 (가로 회전 모드면 화면 (W - y, x))
    t.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'touch', bubbles: true }));
  },
  drag(pts, adv = 0.05) {
    T.ev('pointerdown', pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) {
      T.ev('pointermove', p[0], p[1]);
      window.__cafe.advance(adv);
    }
    const l = pts[pts.length - 1];
    T.ev('pointerup', l[0], l[1]);
  },
  // 벤치 로컬 점의 화면 좌표
  scr(x, y, z) {
    const c = window.__cafe;
    const wb = c.workbench;
    const v = new (wb.stage.position.constructor)(x, y, z);
    wb.stage.localToWorld(v);
    v.project(c.sm.camera);
    return [(v.x * 0.5 + 0.5) * c.sm.w, (-v.y * 0.5 + 0.5) * c.sm.h];
  },
  results() {
    return window.__cafe.workbench.results;
  },
};
// 피자 전체 흐름 자동 진행
T.stepType = () => { const wb = window.__cafe.workbench; return wb.order?.steps[wb.stepIndex]?.type; };
T.click = (sel) => { const b = document.querySelector(sel); b && b.click(); return !!b; };
T.pizzaFlow = async (stopAt) => {
  const c = window.__cafe, wb = c.workbench, B = () => wb.bench;
  const V3 = wb.stage.position.constructor;
  const log = [];
  for (let guard = 0; guard < 40 && wb.order; guard++) {
    const st = T.stepType();
    if (!st || st === stopAt) break;
    if (st === 'stretch') {
      const D = B().pizza.position;
      for (let k = 0; k < 30 && T.stepType() === 'stretch'; k++) {
        const a = k * 0.9;
        const pts = [];
        for (let i = 0; i <= 6; i++) { const r = 0.02 + i * 0.022; pts.push(T.scr(D.x + Math.cos(a) * r, D.y, D.z + Math.sin(a) * r)); }
        T.drag(pts, 0.02);
      }
    } else if (st === 'ladle') {
      T.click('.wb-actions .wb-btn.primary');
    } else if (st === 'slice') {
      for (let k = 0; k < 14 && T.stepType() === 'slice'; k++) {
        c.advance(1.6);
        T.cut(k % 2 ? -30 : 25);
      }
    } else if (st === 'top') {
      const D = B().pizza.position;
      for (let k = 0; k < 40 && T.stepType() === 'top'; k++) {
        const a = k * 2.4, r = 0.03 + (k % 4) * 0.022;
        const s = T.scr(D.x + Math.cos(a) * r, D.y + 0.012, D.z + Math.sin(a) * r);
        T.ev('pointerdown', s[0], s[1]); T.ev('pointerup', s[0], s[1]);
        c.advance(0.2);
      }
    } else if (st === 'bake') {
      c.advance(1.2);
      const s = [wb.sm.w * 0.34, wb.sm.h * 0.8];
      const pts = []; for (let i = 0; i <= 12; i++) pts.push([s[0], s[1] - i * 25]);
      T.drag(pts, 0.05);
      c.advance(1.2);
      log.push({ pizzaAt: B().pizza.position.toArray().map((v) => +v.toFixed(3)), peel: B().peel.position.toArray().map((v) => +v.toFixed(3)) });
      if (stopAt === 'baking') return log;
      c.advance(5.0);
      T.click('.wb-actions .wb-btn.primary');
      c.advance(2.5);
    } else if (st === 'wheel') {
      const P = B().pizza.position, R = B().meanR;
      for (let i = 0; i < 4 && T.stepType() === 'wheel'; i++) {
        const a = (i * Math.PI) / 4;
        const p0 = T.scr(P.x - Math.cos(-a) * R, P.y + 0.022, P.z - Math.sin(-a) * R);
        const p1 = T.scr(P.x + Math.cos(-a) * R, P.y + 0.022, P.z + Math.sin(-a) * R);
        T.drag([p0, [(p0[0] + p1[0]) / 2 + 6, (p0[1] + p1[1]) / 2], p1]);
        c.advance(1.0);
      }
      if (stopAt === 'oil') return log;
      c.advance(3);
    } else {
      T.click('.wb-actions .wb-btn.primary');
      c.advance(1);
    }
    c.advance(1);
    log.push(st);
  }
  log.push({ results: wb.results?.map((r) => r.label + ':' + r.score) });
  return log;
};

T.cut = (jit = 15) => {
  const c = window.__cafe, B = c.workbench.bench;
  const it = Object.values(B.items).slice(-1)[0];
  if (!it || !it.pending.length) return null;
  const p = it.group.position, H = it.ing.kind === 'loaf' ? it.ing.h : it.ing.w;
  const s = T.scr(p.x + it.visualX(it.pending[0]), p.y + H * 0.5, p.z);
  B.sliceDbg = null;
  T.drag([[s[0] + jit, s[1] - 35], [s[0] + jit + 3, s[1]], [s[0] + jit + 7, s[1] + 35]]);
  return B.sliceDbg && Math.round(B.sliceDbg.off);
};
T.load = async () => { await new Promise((r) => setTimeout(r, 3500)); T.boot(); window.__cafe.advance(1); };
T.bltToHalve = async () => {
  const c = window.__cafe;
  T.bench('s1_blt');
  for (let k = 0; k < 10 && T.stepType() === 'slice'; k++) { c.advance(k ? 2.2 : 0.3); T.cut(k % 2 ? -28 : 22); }
  c.advance(1); T.click('.wb-actions .wb-btn.primary'); c.advance(2);
  const B = c.workbench.bench;
  const tapAt = (o) => { const p = o.position; const s = T.scr(p.x, p.y + 0.02, p.z); T.ev('pointerdown', s[0], s[1]); T.ev('pointerup', s[0], s[1]); c.advance(0.9); };
  for (const id of ['lettuce', 'bacon', 'tomato']) tapAt(B.pans[id]);
  tapAt(B.breadSlice(1));
  T.click('.wb-actions .wb-btn.primary'); c.advance(1.5);
  T.click('.wb-actions .wb-btn.primary'); c.advance(2);
  return T.stepType();
};
T.halveSwipe = () => {
  const c = window.__cafe, B = c.workbench.bench, d = B.dish, V3 = d.position.constructor, yt = B.top, h = 0.08;
  const toS = (x, z) => { const w = d.localToWorld(new V3(x, yt, z)); const l = c.workbench.stage.worldToLocal(w); return T.scr(l.x, l.y, l.z); };
  const a = toS(-h, -h), b = toS(h, h);
  T.drag([a, [(a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2], b]);
};
T.pastaToTwirl = () => {
  const c = window.__cafe, wb = c.workbench;
  T.bench('s1_pasta_truffle');
  const B = wb.bench;
  for (let k = 0; k < 16 && T.stepType() === 'roll'; k++) { const z0 = -0.02, z1 = 0.22; const pts = []; for (let i = 0; i <= 10; i++) { const z = k % 2 ? z1 - (z1 - z0) * i / 10 : z0 + (z1 - z0) * i / 10; pts.push(T.scr(-0.2, 0.93, z)); } T.drag(pts, 0.02); }
  c.advance(2.2);
  const S = B.sheet;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7 && T.stepType() === 'cut_pasta'; i++) { const x = -0.2 - S.w / 2 + S.w * (i + 1) / 8; const p = T.scr(x, 0.93 + S.t * 3, 0.1); T.drag([[p[0] + 5, p[1] - 35], [p[0] + 6, p[1]], [p[0] + 8, p[1] + 35]]); c.advance(0.5); }
  c.advance(4.5);
  const P = B.panHome;
  for (let k = 0; k < 7 && T.stepType() === 'toss'; k++) { const pts = []; for (let i = 0; i <= 5; i++) pts.push(T.scr(P.x, 0.95, P.z - i * 0.012)); for (let i = 0; i <= 4; i++) pts.push(T.scr(P.x, 0.95, P.z - 0.06 + i * 0.025)); T.drag(pts, 0.016); c.advance(0.7); }
  c.advance(1);
  return T.stepType();
};
T.audit = (label) => {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; let o = el; while (o) { const cs = getComputedStyle(o); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; o = o.parentElement; } return true; };
  const sel = 'button, .pill, .ticket, .wb-inst b, .wb-inst p, .wb-chips span, .wb-seq span, .mb-tags span, .dlg-who b, .dlg-who small, .toast, .tag, .lever-hint, .wb-readout';
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el)) continue;
    const r = document.createRange(); r.selectNodeContents(el);
    const tops = new Set([...r.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top / 4)));
    // SVG 그림은 줄 수 대상이 아니다
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.querySelector(':scope > span, :scope > b, :scope > small');
    const lines = hasText ? tops.size : 1;
    const cut = el.scrollWidth > el.clientWidth + 1;
    if (lines > 2 || cut) out.push({ t: el.textContent.trim().slice(0, 24), lines, cut, cls: el.className });
  }
  // SVG 배너: 글자가 viewBox 밖으로 나가는지
  for (const svg of document.querySelectorAll('svg.svgt')) {
    if (!vis(svg)) continue;
    const vb = svg.viewBox.baseVal;
    for (const t of svg.querySelectorAll('text')) { const b = t.getBBox(); if (b.x < -1 || b.x + b.width > vb.width + 1) out.push({ svg: t.textContent.slice(0, 24), over: Math.round(b.x + b.width - vb.width) }); }
  }
  return { label, issues: out };
};
T.faceCam = (actor, width = 0.42) => {
  const c = window.__cafe;
  let dec = null;
  actor.root.traverse((o) => { if (o.userData.face) dec = o; });
  const w = new dec.position.constructor();
  dec.getWorldPosition(w);
  c.sm.focus({ target: w, pitch: 0.05, width });
  c.advance(2.2);
  return dec.userData.face;
};
T.start = async () => { await new Promise((r) => setTimeout(r, 3500)); T.boot(); window.__cafe.sm.unfocus(); window.__cafe.advance(1); };
T.tapWorld = (v) => {
  const c = window.__cafe;
  const p = v.clone().project(c.sm.camera);
  const x = (p.x * 0.5 + 0.5) * c.sm.w, y = (-p.y * 0.5 + 0.5) * c.sm.h;
  const cv = c.sm.renderer.domElement;
  cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 9, isPrimary: true, bubbles: true }));
  cv.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 9, isPrimary: true, bubbles: true }));
  return [Math.round(x), Math.round(y)];
};
// 터치(touchstart/touchend)로 요소 누르기 (사파리 경로)
T.touch = (el) => {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const mk = (type) => { const t = new Touch({ identifier: 3, target: el, clientX: x, clientY: y }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); };
  el.dispatchEvent(mk('touchstart'));
  const ev = mk('touchend');
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
};
// 하루(손님 5명)를 빠르게: 주문 → 조리 완료(S) → 서빙
T.rushDay = (ms = 36000) => {
  const c = window.__cafe, ai = c.ai, t0 = performance.now();
  for (let loop = 0; loop < 400 && !c.daySum.isOpen; loop++) {
    c.advance(0.5);
    for (const cu of ai.customers) if (cu.state === 'awaitTalk') { cu.talk = cu.talk || {}; const av = ai.available(); ai.acceptOrder(cu, av[loop % av.length], null); }
    const o = ai.orders.find((o) => o.status === 'accepted');
    if (o && !ai.chef.carry) { o.status = 'ready'; const dish = c.dishes.buildHeroDish(o.recipe.id) || c.dishes.buildBistroDish(o.recipe.id); o.result = { score: 96, grade: 'S', steps: [] }; ai.chefCooked(o, o.result, dish); ai.serve(); }
    if (performance.now() - t0 > ms) break;
  }
  return { open: c.daySum.isOpen, stats: c.progress.p.dayStats, money: c.state.money };
};

// v14: 손가락 위치의 실제 요소에 iOS 순서로 이벤트를 보낸다.
// mode: 'both'(pointer → touch, 기본) | 'touch'(터치만) | 'pointer'(포인터만) | 'cancel'(iOS 가 포인터를 취소하고 touchend 만 옴)
T.finger = (x, y, mode = 'both', x2 = x, y2 = y) => {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const P = (type, px, py) => el.dispatchEvent(new PointerEvent(type, { clientX: px, clientY: py, pointerId: 11, isPrimary: true, pointerType: 'touch', bubbles: true, cancelable: true }));
  const mk = (type, px, py) => { const t = new Touch({ identifier: 5, target: el, clientX: px, clientY: py }); return new TouchEvent(type, { touches: type === 'touchend' || type === 'touchcancel' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); };
  const useP = mode !== 'touch', useT = mode !== 'pointer';
  if (useP) P('pointerdown', x, y);
  let prevented = false;
  if (useT) { const s = mk('touchstart', x, y); el.dispatchEvent(s); prevented = s.defaultPrevented; }
  if (x2 !== x || y2 !== y) { if (useP) P('pointermove', x2, y2); if (useT) el.dispatchEvent(mk('touchmove', x2, y2)); }
  if (mode === 'cancel') P('pointercancel', x2, y2); else if (useP) P('pointerup', x2, y2);
  if (useT) el.dispatchEvent(mk('touchend', x2, y2));
  // 브라우저가 뒤늦게 보내는 합성 click (iOS 는 touchstart 를 막으면 안 보내지만, 안 막혔을 때를 흉내)
  if (!prevented) el.dispatchEvent(new MouseEvent('click', { clientX: x2, clientY: y2, detail: 1, bubbles: true, cancelable: true }));
  return el.tagName + '.' + [...el.classList].join('.');
};
T.fingerEl = (el, mode) => { const r = el.getBoundingClientRect(); return T.finger(r.left + r.width / 2, r.top + r.height / 2, mode); };
T.worldXY = (v) => { const c = window.__cafe; const p = v.clone().project(c.sm.camera); return [(p.x * 0.5 + 0.5) * c.sm.w, (-p.y * 0.5 + 0.5) * c.sm.h]; };
T.fingerDrag = (pts, adv = 0.03) => {
  const [x, y] = pts[0];
  const el = document.elementFromPoint(x, y);
  const P = (type, px, py) => el.dispatchEvent(new PointerEvent(type, { clientX: px, clientY: py, pointerId: 12, isPrimary: true, pointerType: 'touch', bubbles: true, cancelable: true }));
  const mk = (type, px, py) => { const t = new Touch({ identifier: 6, target: el, clientX: px, clientY: py }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); };
  P('pointerdown', x, y); el.dispatchEvent(mk('touchstart', x, y));
  for (const p of pts.slice(1)) { P('pointermove', p[0], p[1]); el.dispatchEvent(mk('touchmove', p[0], p[1])); window.__cafe.advance(adv); }
  const l = pts[pts.length - 1];
  P('pointerup', l[0], l[1]); el.dispatchEvent(mk('touchend', l[0], l[1]));
};

// v15 흐름 도우미 (표준 click 기준)
T.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
T.enter = async () => {
  const c = window.__cafe;
  const b = document.querySelector('.intro [data-a="continue"]:not([disabled])') || document.querySelector('.intro [data-a="new"]');
  if (b && c.intro?.isOpen) { b.click(); c.advance(1.5); await T.sleep(700); }
};
T.toTalk = async (mode = 'pointer') => {
  const c = window.__cafe, ai = c.ai;
  ai.spawnTimer = Math.min(ai.spawnTimer, 0.1);
  for (let i = 0; i < 80 && !ai.customers.some((g) => g.state === 'awaitTalk'); i++) c.advance(0.5);
  const g = ai.customers.find((g) => g.state === 'awaitTalk');
  if (!g) return null;
  const [x, y] = T.worldXY(g.actor.root.position.clone().setY(g.actor.root.position.y + 1.2));
  T.finger(x, y, mode);
  for (let i = 0; i < 40 && !document.querySelector('.dlg:not(.hidden)'); i++) c.advance(0.3);
  await T.sleep(400);
  const txt = document.querySelector('.dlg:not(.hidden) .dlg-text');
  txt?.click(); c.advance(0.3); await T.sleep(300);
  return g;
};

// ───── v17 잘림 0건 전수 검사 ─────
T.clipAudit = (label = '') => {
  const vw = window.visualViewport?.width ?? innerWidth, vh = window.visualViewport?.height ?? innerHeight;
  const ui = document.getElementById('ui');
  const out = [];
  const shown = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || n.classList?.contains('hidden')) return false; } return true; };
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const name = (el) => { const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24); return `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}「${t}」`; };
  const cand = [...ui.querySelectorAll('button, [data-tap], .svgt, *')].filter((el) => (el.tagName === 'BUTTON' || hasText(el) || el.classList.contains('svgt')) && !el.closest('svg:not(.svgt)') );
  for (const el of new Set(cand)) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (el.closest('.bubble')) continue; // 3D 위치를 따라다니는 말풍선은 아래에서 따로
    const bad = [];
    if (r.top < -1) bad.push(`top ${r.top | 0}`);
    if (r.bottom > vh + 1) bad.push(`bottom ${r.bottom | 0}>${vh | 0}`);
    if (r.left < -1) bad.push(`left ${r.left | 0}`);
    if (r.right > vw + 1) bad.push(`right ${r.right | 0}>${vw | 0}`);
    const cs = getComputedStyle(el);
    const clipsSelf = /(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY);
    if (clipsSelf && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) bad.push(`self-clip ${el.scrollWidth}x${el.scrollHeight}>${el.clientWidth}x${el.clientHeight}`);
    for (let a = el.parentElement; a && a !== ui.parentElement; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (!/(hidden|clip|auto|scroll)/.test(acs.overflowX + acs.overflowY)) continue;
      const ar = a.getBoundingClientRect();
      if (r.top < ar.top - 2 || r.bottom > ar.bottom + 2 || r.left < ar.left - 2 || r.right > ar.right + 2) { bad.push(`clipped-by ${a.tagName.toLowerCase()}.${[...a.classList][0] ?? ''}`); break; }
    }
    if (bad.length) out.push(`${label} ${name(el)} :: ${bad.join(', ')}`);
  }
  return out;
};

T.auditScreens = async (opts = {}) => {
  const c = window.__cafe, wb = c.workbench, ai = c.ai;
  const res = [];
  const A = (l) => res.push(...T.clipAudit(l));
  const m = [...c.furniture.items.values()].find((i) => i.def.station === 'master');
  if (opts.intro) A('[intro]');
  await T.enter();
  if (c.daySum?.isOpen) { [...document.querySelectorAll('.daysum button')].find((b) => /다음 날/.test(b.textContent))?.click(); await T.sleep(400); }
  c.progress.p.dayGuests = 0; c.progress.p.dayStats.guests = 0;
  c.advance(1); await T.sleep(250); A('[hall]');
  const g = await T.toTalk('both');
  if (g) {
    await T.sleep(300); A('[dialog]');
    [...document.querySelectorAll('.dlg:not(.hidden) .dlg-btn')].find((b) => /맞춤 메뉴/.test(b.textContent))?.click();
    c.advance(0.3); await T.sleep(300);
    const board = document.querySelector('#menu-board');
    for (const t of [...board.querySelectorAll('.mb16-tab')]) { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true })); await T.sleep(80); A(`[menu:${t.dataset.cat}]`); }
    board.querySelector('.mb16-x').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true }));
    await T.sleep(200);
    { const x = document.querySelector('.dlg:not(.hidden) .dlg-x'); if (x) T.fingerEl(x, 'both'); } c.advance(0.3); await T.sleep(150);
    if (document.querySelector('.dlg:not(.hidden)')) res.push('[dialog] X did not close');
  } else res.push('[dialog] no guest');
  // 모든 조리대 · 모든 단계 · 완성 결과창
  const recipes = opts.recipes ?? [...c.registry.recipes.values()];
  for (const r of recipes) {
    if (wb.isOpen) wb.close();
    await T.sleep(60);
    const steps = c.registry.stepsFor(r, null);
    wb.open({ recipe: r, steps, customer: { persona: { name: '테스트' } }, option: null, status: 'cooking' }, m, { onDone() {}, onCancel() {} });
    c.advance(1.2);
    for (let i = 0; i < steps.length; i++) {
      wb.stepIndex = i;
      try { wb.startStep(); } catch (e) { res.push(`[${r.id}:${steps[i].type}] startStep ERR ${e.message}`); continue; }
      c.advance(0.7); await T.sleep(60);
      A(`[${r.id}:${i + 1}.${steps[i].type}]`);
    }
    try { wb.stepIndex = steps.length - 1; wb.stepDone(90, 'audit'); c.advance(2.6); await T.sleep(120); A(`[${r.id}:result]`); } catch (e) { res.push(`[${r.id}:result] ERR ${e.message}`); }
  }
  if (wb.isOpen) wb.close();
  return res;
};

// ═════ v19 3D 무결성 자동 감사 (관통 · 동선 · 겹침) ═════
// 판정: 1차 AABB(Box3 와 같은 min/max 박스) 교차 → 2차 메쉬별 xz 볼록 윤곽(convex hull) + 높이 구간 겹침.
//  캐릭터 = 원기둥 r 0.14m, 높이 0.05~1.55m. 바닥 장식(러그 · 도어매트 · 높이 4cm 미만) · 투명 히트박스 제외.
const G3 = {
  R: 0.14, Y0: 0.05, Y1: 1.55, PULL: 0.36,
  hull(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop();
    return lo.concat(up);
  },
  part(m, owner) {
    const g = m.geometry, pos = g?.attributes?.position;
    if (!pos) return null;
    m.updateMatrixWorld(true);
    const e = m.matrixWorld.elements, pts = [];
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const step = Math.max(1, Math.floor(pos.count / 600));
    for (let i = 0; i < pos.count; i += step) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      pts.push([wx, wz]);
      if (wy < y0) y0 = wy; if (wy > y1) y1 = wy; if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
    }
    const out = { m, owner, y0, y1, box: [x0, z0, x1, z1], hull: G3.hull(pts) };
    // 벽은 출입문 구멍이 있어 볼록 윤곽이 문을 막아 버린다 → 삼각형 단위로 정밀 판정
    if (owner?.wall) {
      const idx = g.index, n = idx ? idx.count : pos.count, tris = [];
      const W = (i) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
      for (let i = 0; i < n; i += 3) {
        const a = W(idx ? idx.getX(i) : i), b = W(idx ? idx.getX(i + 1) : i + 1), c2 = W(idx ? idx.getX(i + 2) : i + 2);
        tris.push({ y0: Math.min(a[1], b[1], c2[1]), y1: Math.max(a[1], b[1], c2[1]), p: [[a[0], a[2]], [b[0], b[2]], [c2[0], c2[2]]] });
      }
      out.tris = tris;
    }
    return out;
  },
  distTri(px, pz, t) {
    const [a, b, c] = t;
    const cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
    const q = [px, pz];
    const d1 = cr(a, b, q), d2 = cr(b, c, q), d3 = cr(c, a, q);
    const area = Math.abs(cr(a, b, c));
    if (area > 1e-8 && ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0))) return 0;
    let best = Infinity;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const ex = v[0] - u[0], ez = v[1] - u[1], L = ex * ex + ez * ez || 1e-12;
      const k = Math.max(0, Math.min(1, ((px - u[0]) * ex + (pz - u[1]) * ez) / L));
      best = Math.min(best, Math.hypot(px - u[0] - k * ex, pz - u[1] - k * ez));
    }
    return best;
  },
  solidMeshes(root, owner, out, opts = {}) {
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isMesh || m.isSprite) return;
      if (m.userData.hitbox || m.material?.visible === false) return;
      for (let p = m; p; p = p.parent) if (p.visible === false) return;
      if (m.material?.transparent && m.material.opacity < 0.2) return;
      const pt = G3.part(m, owner);
      if (!pt || pt.y1 < (opts.minTop ?? 0.04)) return;
      out.push(pt);
    });
    return out;
  },
  // 매장 고정 장애물: 가구(바닥층 제외) + 4면 벽 + 뒷벽 소품
  solids() {
    const c = window.__cafe, out = [];
    for (const inst of c.furniture.items.values()) {
      if (inst.def.layer === 'floor' || !inst.object) continue;
      G3.solidMeshes(inst.object, inst, out);
    }
    for (const w of c.walls.walls) G3.solidMeshes(w.group, { wall: w.name }, out);
    G3.solidMeshes(c.walls.northGroup, { wall: 'north-props' }, out);
    return out;
  },
  // 점 - 볼록 다각형 부호 거리 (안쪽이면 음수)
  distPoly(px, pz, h) {
    let inside = true, best = Infinity;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length];
      const ex = b[0] - a[0], ez = b[1] - a[1];
      if (ex * (pz - a[1]) - ez * (px - a[0]) < 0) inside = false;
      const L = ex * ex + ez * ez || 1e-9;
      const t = Math.max(0, Math.min(1, ((px - a[0]) * ex + (pz - a[1]) * ez) / L));
      best = Math.min(best, Math.hypot(px - a[0] - t * ex, pz - a[1] - t * ez));
    }
    return inside ? -best : best;
  },
  circleHit(px, pz, r, parts, skip) {
    const hits = [];
    for (const p of parts) {
      if (skip && skip(p)) continue;
      if (p.y1 < G3.Y0 || p.y0 > G3.Y1) continue;
      const [x0, z0, x1, z1] = p.box;
      if (px + r < x0 || px - r > x1 || pz + r < z0 || pz - r > z1) continue; // AABB 1차
      let d;
      if (p.tris) { d = Infinity; for (const t of p.tris) if (t.y1 >= G3.Y0 && t.y0 <= G3.Y1) d = Math.min(d, G3.distTri(px, pz, t.p)); }
      else d = G3.distPoly(px, pz, p.hull);
      if (d < r - 0.005) hits.push({ p, depth: +(r - d).toFixed(3) });
    }
    return hits;
  },
  // 볼록 다각형 두 개 SAT 겹침 깊이 (0 = 안 겹침)
  polyOverlap(A, B) {
    let min = Infinity;
    for (const P of [A, B])
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const nx = -(b[1] - a[1]), nz = b[0] - a[0];
        const L = Math.hypot(nx, nz) || 1;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const q of A) { const d = (q[0] * nx + q[1] * nz) / L; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
        for (const q of B) { const d = (q[0] * nx + q[1] * nz) / L; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
        const o = Math.min(a1, b1) - Math.max(a0, b0);
        if (o <= 0) return 0;
        min = Math.min(min, o);
      }
    return min;
  },
  partsHit(As, Bs, skip, tol = 0.004) {
    const hits = [];
    for (const a of As)
      for (const b of Bs) {
        if (skip && skip(b)) continue;
        if (a.y1 < b.y0 + tol || b.y1 < a.y0 + tol) continue;
        if (a.box[2] < b.box[0] || b.box[2] < a.box[0] || a.box[3] < b.box[1] || b.box[3] < a.box[1]) continue;
        const o = G3.polyOverlap(a.hull, b.hull);
        if (o > tol) hits.push({ a, b, depth: +o.toFixed(3) });
      }
    return hits;
  },
  label(o) {
    if (!o) return '?';
    if (o.wall) return `벽(${o.wall})`;
    if (o.defId) return `${o.defId}@${o.tx},${o.tz}`;
    return String(o);
  },
};
T.G3 = G3;

// Pathfinding 모듈과 같은 규칙(8방향, 모서리 끼어들기 금지, 목표 칸은 막혀 있어도 도착)으로 도달 가능 여부
T._fp = (start, goal) => {
  const w = window.__cafe.ai.walkable, W = 7, D = 8;
  const ok = (x, z) => x >= 0 && z >= 0 && x < W && z < D && ((x === goal[0] && z === goal[1]) || w(x, z));
  const seen = new Set([start.join()]), q = [start];
  while (q.length) {
    const [x, z] = q.shift();
    if (x === goal[0] && z === goal[1]) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!ok(nx, nz) || seen.has(nx + ',' + nz)) continue;
      if (dx && dz && !(w(x + dx, z) && w(x, z + dz))) continue;
      seen.add(nx + ',' + nz); q.push([nx, nz]);
    }
  }
  return false;
};

// 해금 가구 · 소품을 모두 들이고 테이블 세트를 고른다 (감사용)
T.setupFull = (set = 'bistro') => {
  const c = window.__cafe, P = c.progress.p, ai = c.ai;
  // 테이블 세트는 손님이 없어야 바꿀 수 있다 → 감사용으로 매장을 비운다
  for (const cu of [...ai.customers]) ai.despawn(cu);
  ai.orders.length = 0;
  if (ai.chef.carry) { ai.chef.tray.remove(ai.chef.carry.dish); ai.chef.carry = null; ai.chef.tray.visible = false; }
  ai.spawnTimer = 99;
  c.advance(0.6);
  for (const [k, id] of [['extra', 'table3'], ['props', 'olive'], ['props', 'wine'], ['props', 'pendant'], ['tableSet', set]]) {
    if (!P.owned[k].includes(id)) P.owned[k].push(id);
    c.applyDecor(k, id);
  }
  c.advance(0.1);
  return c.furniture.seats().length;
};

// [검사 1] 정적: 모든 좌석 의자 빼기 겹침 · 손님 서는 자리 · 셰프/손님 길찾기
T.auditSeats = () => {
  const c = window.__cafe, ai = c.ai, out = [];
  const seats = c.furniture.seats();
  const chairParts = (s) => G3.solidMeshes(s.chair.object, s.chair, []);
  for (const s of seats) {
    const tag = `좌석 ${s.chair.defId}@${s.tile}`;
    const ap = ai.seatApproach(s, [0, 6]);
    if (!ap) { out.push(`${tag}: 문에서 접근할 옆/뒤 칸 없음`); continue; }
    ai.setChairOffset(s, ai.plan(s).k);
    const solids = G3.solids();
    const cp = chairParts(s);
    for (const h of G3.partsHit(cp, solids, (b) => b.owner === s.chair || b.owner === s.table)) out.push(`${tag}: 뺀 의자 vs ${G3.label(h.b.owner)} 겹침 ${h.depth}m`);
    for (const s2 of seats) {
      if (s2 === s) continue;
      ai.setChairOffset(s2, ai.plan(s2).k);
      const h = G3.partsHit(cp, chairParts(s2));
      if (h.length) out.push(`${tag}: 동시에 뺀 의자 ${s2.tile} 와 겹침 ${Math.max(...h.map((x) => x.depth))}m`);
      ai.setChairOffset(s2, 0);
    }
    for (const [nm, v] of [['접근점', ap.point], ['앉기 직전 자리', ai.standSpot(s)]])
      for (const h of G3.circleHit(v.x, v.z, G3.R, solids)) out.push(`${tag}: ${nm} 손님 vs ${G3.label(h.p.owner)} ${h.depth}m`);
    ai.setChairOffset(s, 0);
    if (!T._fp(ap.tile, [0, 6])) out.push(`${tag}: 접근 칸에서 문까지 길 없음`);
  }
  // 셰프: 대기 칸에서 모든 좌석으로 (접시 놓는 자리에서 1.6m 안의 빈 칸)
  const home = ai.homeTile();
  const tables = [...new Set(seats.map((s) => s.table))];
  for (const s of seats) {
    const spot = ai.dishSpot(s);
    let ok = false;
    for (let x = 0; x < 7 && !ok; x++) for (let z = 0; z < 8 && !ok; z++) {
      if (!ai.walkable(x, z)) continue;
      const cx = x - 3.5 + 0.5, cz = z - 4 + 0.5;
      if (Math.hypot(cx - spot.x, cz - spot.z) >= 1.6) continue;
      if (T._fp(home, [x, z])) ok = true;
    }
    if (!ok) out.push(`셰프: 좌석 ${s.tile} (테이블 ${s.table.tx},${s.table.tz}) 서빙 거리로 갈 수 없음`);
  }
  const master = c.furniture.stations('master')[0];
  const ft = master ? c.furniture.frontTile(master) : home;
  // 조리대 앞에서 못 가는 빈 칸: 가구에 완전히 둘러싸인 1칸짜리 틈(아무도 쓰지 않음)은 참고, 2칸 이상 덩어리가 끊기면 동선 단절
  const notes = [];
  const cut = [];
  for (let x = 0; x < 7; x++) for (let z = 0; z < 8; z++) if (ai.walkable(x, z) && !T._fp(ft, [x, z])) cut.push([x, z]);
  for (const t of cut) {
    const nb = cut.filter((u) => Math.max(Math.abs(u[0] - t[0]), Math.abs(u[1] - t[1])) === 1);
    if (nb.length) out.push(`동선 단절: 조리대 앞에서 빈 칸 ${t} 로 가는 길 없음`);
    else notes.push(`가구로 둘러싸인 빈 칸 ${t} (셰프 탭 이동 대상에서 제외됨)`);
  }
  const plans = seats.map((s) => { const p = ai.plan(s); return `${s.tile}: 빼기 ${p.k.toFixed(2)}m · 서는 자리 ${p.s.toFixed(2)}m`; });
  return { seats: seats.length, tables: tables.length, issues: out, notes, plans };
};

// [검사 2] 동적: 손님 · 셰프가 실제로 움직이는 모든 프레임에서 원기둥 관통 측정 + 빠진 의자 vs 다른 사람
T.auditMotion = (guests = 12, dt = 1 / 30) => {
  const c = window.__cafe, ai = c.ai, P = c.progress.p, out = new Map();
  const add = (k, depth, info) => { const o = out.get(k); if (!o || depth > o.depth) out.set(k, { depth, ...info }); };
  const SEATED = new Set(['sitDown', 'scootIn', 'awaitTalk', 'talking', 'ordered', 'served', 'satisfied', 'scootOut', 'standUp']);
  const solids = G3.solids().filter((p) => !p.owner.def?.seat); // 의자는 움직이므로 매 프레임 따로 잰다
  const cache = new Map();
  const chairs = () => c.furniture.seats().map((s) => {
    const key = (s.chair.pulled ?? 0).toFixed(3);
    const hit = cache.get(s.chair.id);
    if (hit && hit.key === key && hit.obj === s.chair.object) return { s, parts: hit.parts };
    const parts = G3.solidMeshes(s.chair.object, s.chair, []);
    cache.set(s.chair.id, { key, parts, obj: s.chair.object });
    return { s, parts };
  });
  let served = 0, frames = 0, maxCustomers = 0, seatsUsed = new Set();
  const recipes = ai.available();
  const master = c.furniture.stations('master')[0];
  let job = null, stuck = 0;
  let lastServe = 0;
  for (let f = 0; f < 30 * 60 * 8 && served < guests; f++) {
    if (f - lastServe > 30 * 90) { add('진행 멈춤: 90초 동안 서빙 없음', 1, { at: ai.customers.map((x) => x.state) }); break; }
    P.dayGuests = 0; P.dayStats.guests = 0;
    if (c.letter.isOpen) document.querySelector('.letter button')?.click(); // 단골 감사 편지 등 팝업은 닫고 계속
    if (ai.spawnTimer > 0.5 && ai.freeSeats().length) ai.spawnTimer = 0.5;
    for (const cu of ai.customers) if (cu.state === 'awaitTalk') { cu.talk = cu.talk || {}; seatsUsed.add(cu.seat.tile.join()); ai.acceptOrder(cu, recipes[(served + cu.id) % recipes.length], null); }
    if (!job && !ai.chef.carry) {
      const o = ai.orders.find((o) => o.status === 'accepted');
      if (o) { job = { o, phase: 'cook' }; if (!ai.walkChefTo(c.furniture.frontTile(master), { arrive: () => (job.phase = 'cooked') })) job.phase = 'cooked'; }
    } else if (job?.phase === 'cooked') {
      const dish = c.dishes.buildHeroDish(job.o.recipe.id) || c.dishes.buildBistroDish(job.o.recipe.id);
      ai.chefCooked(job.o, { score: 95, grade: 'S', steps: [] }, dish);
      job.phase = 'carry';
      const t = ai.approachTile(job.o.customer);
      if (!ai.walkChefTo(t, { arrive: () => (job.phase = 'serve') })) { add(`셰프 길 없음 (좌석 ${job.o.customer.seat.tile})`, 1, {}); job.phase = 'serve'; }
    } else if (job?.phase === 'serve') { ai.serve(); served++; lastServe = f; job = null; }
    if (job && !ai.chef.goto && (job.phase === 'cook' || job.phase === 'carry')) { if (++stuck > 60) { add(`셰프 멈춤 (${job.phase})`, 1, { at: ai.chefTile() }); job.phase = job.phase === 'cook' ? 'cooked' : 'serve'; stuck = 0; } } else stuck = 0;
    c.advance(dt); frames++;
    maxCustomers = Math.max(maxCustomers, ai.customers.length);
    const ch = chairs();
    const chairParts = ch.flatMap((x) => x.parts);
    const all = solids.concat(chairParts);
    const cp = ai.chef.actor.root.position;
    for (const h of G3.circleHit(cp.x, cp.z, G3.R, all)) add(`셰프 vs ${G3.label(h.p.owner)}`, h.depth, { at: [+cp.x.toFixed(2), +cp.z.toFixed(2)] });
    for (const cu of ai.customers) {
      const p = cu.actor.root.position;
      if (p.x < -3.5 - 0.3) continue; // 벽 밖(보이지 않는 구간)
      const own = cu.seat ?? cu.leaveSeat;
      const seated = SEATED.has(cu.state);
      const skip = (pt) => seated && own && (pt.owner === own.chair || pt.owner === own.table);
      for (const h of G3.circleHit(p.x, p.z, G3.R, all, skip)) add(`손님(${cu.state}) vs ${G3.label(h.p.owner)}`, h.depth, { at: [+p.x.toFixed(2), +p.z.toFixed(2)], seat: own?.tile });
    }
    for (const { s, parts } of ch) {
      if (!(s.chair.pulled > 0.01)) continue;
      const mine = ai.customers.filter((x) => x.seat?.chair === s.chair || (x.leaveSeat?.chair === s.chair && x.state !== 'walkOut'));
      if (mine.length > 1) add(`좌석 ${s.tile} 을 두 손님이 동시에 사용`, 1, {});
      const owner = mine[0];
      for (const h of G3.partsHit(parts, solids, (b) => b.owner === s.table)) add(`빠진 의자 ${s.tile} vs ${G3.label(h.b.owner)}`, h.depth, {});
      const people = ai.customers.filter((x) => !mine.includes(x)).map((x) => x.actor.root.position).concat([cp]);
      for (const q of people) for (const h of G3.circleHit(q.x, q.z, G3.R, parts)) add(`빠진 의자 ${s.tile} vs 다른 사람`, h.depth, { at: [+q.x.toFixed(2), +q.z.toFixed(2)] });
    }
  }
  return { served, frames, maxCustomers, seatsUsed: [...seatsUsed], issues: [...out].map(([k, v]) => `${k}: ${v.depth}m ${v.at ? JSON.stringify(v.at) : ''}${v.seat ? ' 좌석 ' + v.seat : ''}`) };
};

// [검사 3] 조리대: 도구가 받침(도마 · 접시 · 그릇 · 팬 · 컵 · 피처 · 화덕 · 작업대)을 뚫는지, 병 · 후추통 · 강판이 음식 위 여유를 지키는지
//  판정: 도구 꼭짓점이 받침 메쉬의 AABB(Box3) 안이면 → 그 xz 에서 위에서 아래로 레이캐스트한 받침 윗면보다 3mm 넘게 아래인지
//        (그릇 · 컵처럼 속이 빈 받침은 빈 속으로 들어가는 건 정상, 벽 · 바닥 · 테두리 속으로 들어가면 관통)
const B3 = {
  TOL: 0.003,
  vis(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; },
  meshes(root, skip) {
    const out = [];
    if (!root) return out;
    root.traverse((m) => {
      if (!m.isMesh || m.isSprite || m.userData.hitbox || m.material?.visible === false) return;
      if (skip && skip(m)) return;
      out.push(m);
    });
    return out;
  },
  under(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; },
  box(m) {
    const THREE = window.__cafe.THREE, g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    return g.boundingBox.clone().applyMatrix4(m.matrixWorld);
  },
  verts(m, max = 260) {
    const THREE = window.__cafe.THREE, pos = m.geometry.attributes.position, out = [];
    if (!pos) return out;
    const n = m.geometry.drawRange?.count < pos.count && m.geometry.index == null ? m.geometry.drawRange.count : pos.count;
    const step = Math.max(1, Math.floor(n / max));
    for (let i = 0; i < n; i += step) out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld));
    return out;
  },
  rc: null,
  topAt(x, z, yFrom, meshes) {
    const THREE = window.__cafe.THREE;
    const rc = (B3.rc ??= new THREE.Raycaster());
    rc.set(new THREE.Vector3(x, yFrom, z), new THREE.Vector3(0, -1, 0));
    rc.far = 2;
    const saved = meshes.map((m) => { const mats = Array.isArray(m.material) ? m.material : [m.material]; const s = mats.map((q) => q.side); mats.forEach((q) => (q.side = THREE.DoubleSide)); return [mats, s]; });
    const hits = rc.intersectObjects(meshes, false);
    saved.forEach(([mats, s]) => mats.forEach((q, i) => (q.side = s[i])));
    // 떨어지는 가루 · 김 · 불티 같은 1.2cm 미만 입자는 '음식 표면'으로 보지 않는다
    const hit = hits.find((h) => { const b = B3.box(h.object); return Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) >= 0.012; });
    return hit ?? null;
  },
  // 점 v 가 닫힌 메쉬 m 의 속에 있으면 빠져나오는 최소 거리(위/아래), 아니면 0.
  //  위로 쏜 첫 면의 바깥 법선이 위(+y)를 향하고, 아래로 쏜 첫 면의 법선이 아래를 향하면 '속'.
  //  (위에 덮개가 있는 빈 공간 — 머신 그룹헤드 아래 잔 · 그라인더 머리 아래 포터필터 — 는 첫 면이 아래를 보므로 '밖')
  insideDepth(v, m) {
    const THREE = window.__cafe.THREE;
    const rc = (B3.rc2 ??= new THREE.Raycaster());
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const saved = mats.map((q) => q.side);
    mats.forEach((q) => (q.side = THREE.DoubleSide));
    const shoot = (dir) => {
      rc.set(v.clone().addScaledVector(dir, -1e-5), dir);
      rc.far = 1;
      const h = rc.intersectObject(m, false)[0];
      if (!h || !h.face) return null;
      const n = h.face.normal.clone().transformDirection(m.matrixWorld);
      return { d: h.distance, ny: n.y };
    };
    const up = shoot(new THREE.Vector3(0, 1, 0));
    const dn = up && up.ny > 0.15 ? shoot(new THREE.Vector3(0, -1, 0)) : null;
    mats.forEach((q, i) => (q.side = saved[i]));
    if (!up || up.ny <= 0.15 || !dn || dn.ny >= -0.15) return 0;
    return Math.min(up.d, dn.d);
  },
  // 벤치별 받침 · 도구 목록
  config(B) {
    const name = B.constructor.name;
    const st = B.stage ?? window.__cafe.workbench.stage;
    const sup = [];
    // 받침은 불투명한 단단한 메쉬만 (불꽃 · 김 · 유리 같은 반투명 · 가산 혼합은 제외)
    const soft = (m) => { const q = Array.isArray(m.material) ? m.material[0] : m.material; return q && (q.blending === 2 || (q.transparent && q.opacity < 0.9)); };
    const addSup = (root, label, skip) => B3.meshes(root, (m) => soft(m) || (skip && skip(m))).forEach((m) => sup.push({ m, label }));
    // 작업대 상판: 무대 바로 아래 넓고 얇은 판 (스테인리스 · 석재 · 원목 작업판)
    for (const m of st.children) {
      if (!m.isMesh || !m.geometry) continue;
      const b = B3.box(m), sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, sy = b.max.y - b.min.y;
      if (m === B.board) continue;
      if (sx > 0.3 && sz > 0.3 && sy < 0.06) sup.push({ m, label: '작업대' });
    }
    if (B.board) addSup(B.board, '도마');
    if (B.dish) addSup(B.dish, '접시', (m) => !m.userData.plate);
    for (const [id, p] of Object.entries(B.pans ?? {})) addSup(p, `재료 밧드(${id})`, (m) => !B3.under(m, p) || m.parent !== p);
    if (name === 'PastaBench') {
      addSup(B.pan, '프라이팬', (m) => B3.under(m, B.contents));
      addSup(B.bowl, '파스타 볼');
    }
    if (name === 'SaladBench') addSup(B.bowl, '샐러드 볼');
    if (name === 'PizzaBench') addSup(B.oven, '화덕');
    if (name === 'EspressoBench') {
      addSup(B.cup, '컵', (m) => m === B.liquid || m === B.surface);
      addSup(B.pf, '포타필터', (m) => m === B.heap || B3.under(m, B.heap));
    }
    const tools = [];
    const T_ = (obj, label, kind, clear = 0) => obj && tools.push({ obj, label, kind, clear });
    T_(B.knife, '칼', 'cut');
    T_(B.spatula, '버터나이프', 'contact');
    if (name === 'BoardBench' || name === 'SaladBench' || name === 'PizzaBench') {
      T_(B.mill, '후추통', 'hover', 0.1);
      T_(B.oil, '올리브오일 병', 'hover', 0.08);
      T_(B.honey, '꿀 병', 'hover', 0.08);
    }
    if (name === 'SaladBench') { T_(B.bottle, '드레싱 병', 'hover', 0.08); (B.servers ?? []).forEach((s, i) => T_(s, i ? '샐러드 포크' : '샐러드 스푼', 'cut')); }
    if (name === 'PastaBench') {
      T_(B.pin, '밀대', 'contact');
      T_(B.grater, '강판', 'hover', 0.03);
      for (const o of st.children) if (o.userData?.setGap) T_(o, '트위저', 'cut');
    }
    if (name === 'PizzaBench') { T_(B.ladle, '국자', 'contact'); T_(B.peel, '피자 필', 'slide'); T_(B.wheel, '피자 휠', 'cut'); }
    if (name === 'EspressoBench') {
      T_(B.tamper, '탬퍼', 'contact');
      T_(B.pitcher, '스팀 피처', 'slide');
      for (const o of st.children) if (o.userData?.tool) T_(o, o.userData.tool, 'hover', 0);
    }
    for (const o of st.children) if (o.userData?.tool && !tools.some((t) => t.obj === o)) T_(o, o.userData.tool, o.userData.toolKind ?? 'cut', o.userData.clear ?? 0);
    return { name, sup, tools };
  },
  probe(B, cfg, tag, rec) {
    const st = B.stage ?? window.__cafe.workbench.stage;
    st.updateMatrixWorld(true);
    const supBoxes = cfg.sup.filter((s) => B3.vis(s.m)).map((s) => ({ ...s, b: B3.box(s.m) }));
    for (const t of cfg.tools) {
      if (!B3.vis(t.obj)) continue;
      const tm = B3.meshes(t.obj).filter((m) => B3.vis(m));
      let worst = null;
      for (const m of tm) {
        const vs = B3.verts(m);
        for (const s of supBoxes) {
          if (B3.under(s.m, t.obj) || B3.under(t.obj, s.m)) continue;
          // 스팀 피처는 스팀 완드 · 컵과의 관계만 (피처 자체가 받침이 아님)
          for (const v of vs) {
            if (v.x < s.b.min.x || v.x > s.b.max.x || v.z < s.b.min.z || v.z > s.b.max.z) continue;
            if (v.y > s.b.max.y - B3.TOL || v.y < s.b.min.y + B3.TOL) continue;
            const d = B3.insideDepth(v, s.m);
            if (d > B3.TOL && (!worst || d > worst.d)) worst = { d, s: s.label, at: [v.x, v.y, v.z].map((q) => +q.toFixed(3)) };
          }
        }
      }
      if (worst) { const tp = new (window.__cafe.THREE.Vector3)(); t.obj.getWorldPosition(tp); const sp = st.position; worst.toolAt = [tp.x - sp.x, tp.y, tp.z - sp.z].map((q) => +q.toFixed(3)); rec(`${tag} ${t.label} → ${worst.s} 관통`, worst.d, worst); }
      // 병 · 후추통 · 강판: 노즐(최저점) 바로 아래가 음식이면 정해진 여유 이상
      if (t.kind === 'hover' && t.clear > 0) {
        const all = B3.meshes(st, (m) => B3.under(m, t.obj) || !B3.vis(m) || m.material?.transparent && m.material.opacity < 0.05);
        let lo = null;
        for (const m of tm) for (const v of B3.verts(m, 120)) if (!lo || v.y < lo.y) lo = v;
        if (!lo) continue;
        const hit = B3.topAt(lo.x, lo.z, lo.y - 0.0005, all);
        if (!hit) continue;
        const isSup = cfg.sup.some((s) => s.m === hit.object);
        if (isSup) continue;
        const gap = lo.y - hit.point.y;
        if (gap < t.clear - 0.006) rec(`${tag} ${t.label} 음식 위 여유 ${t.clear * 100}cm 미달`, t.clear - gap, { gap: +gap.toFixed(3), at: [lo.x, lo.y, lo.z].map((q) => +q.toFixed(3)), hit: hit.object.name || hit.object.geometry.type });
      }
    }
  },
};
// 고정 받침끼리 겹침 (예: 반죽판이 화덕 입구 돌턱 속으로) — 받침 A 의 꼭짓점이 받침 B 윗면 아래 3mm 넘게 들어가 있는지
B3.staticOverlap = (B, cfg, tag, rec) => {
  const st = B.stage ?? window.__cafe.workbench.stage;
  st.updateMatrixWorld(true);
  const rootOf = (m) => { let o = m; while (o.parent && o.parent !== st) o = o.parent; return o; };
  // v19: 받침뿐 아니라 무대 위 모든 불투명 고정물(백스플래시 · 화덕 받침 · 소품 병 · 밧드 · 도구 거치 위치)끼리
  const soft = (m) => { const q = Array.isArray(m.material) ? m.material[0] : m.material; return !q || q.blending === 2 || (q.transparent && q.opacity < 0.9); };
  const sup = [];
  st.traverse((m) => {
    if (!m.isMesh || m.isSprite || m.userData.hitbox || soft(m) || !B3.vis(m)) return;
    const b = B3.box(m);
    if (Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) < 0.01) return;
    const lab = cfg.sup.find((s) => s.m === m)?.label ?? cfg.tools.find((t) => B3.under(m, t.obj))?.label ?? `${m.geometry.type.replace('Geometry', '')}@${[b.min.x - st.position.x, b.min.z - st.position.z].map((q) => q.toFixed(2))}`;
    sup.push({ m, label: lab, b, r: rootOf(m) });
  });
  const flat = (m) => /^(Plane|Circle|Ring|Shape)Geometry$/.test(m.geometry.type);
  for (const a of sup)
    for (const b of sup) {
      if (a.r === b.r) continue;
      if (flat(b.m)) continue; // 잎 · 소스 원판 같은 평면은 '속'이 없다
      // 아래에서 끼워 붙인 이음(테이블 다리 → 상판)은 한 덩어리 구조물
      if (a.b.max.y <= b.b.max.y + B3.TOL && a.b.min.y < b.b.min.y - B3.TOL) continue;
      if (a.b.max.x < b.b.min.x || a.b.min.x > b.b.max.x || a.b.max.z < b.b.min.z || a.b.min.z > b.b.max.z || a.b.max.y < b.b.min.y || a.b.min.y > b.b.max.y) continue;
      let worst = 0, at = null;
      for (const v of B3.verts(a.m, 400)) {
        if (v.x < b.b.min.x || v.x > b.b.max.x || v.z < b.b.min.z || v.z > b.b.max.z) continue;
        if (v.y > b.b.max.y - B3.TOL || v.y < b.b.min.y + B3.TOL) continue;
        const d = B3.insideDepth(v, b.m);
        if (d > worst) { worst = d; at = [v.x - st.position.x, v.y, v.z - st.position.z].map((q) => +q.toFixed(3)); }
      }
      if (worst > B3.TOL) rec(`${tag} 고정물 겹침: ${a.label} → ${b.label}`, worst, { at });
    }
};
T.B3 = B3;

// 단계별 조작: 기존 도우미가 있는 단계는 그대로, 나머지는 3D 화면 가운데를 중심으로 원 · 세로 · 가로 드래그 + 탭 + 주 버튼
T.driveStep = (rounds = 24) => {
  window.__cafe.advance(0.8); // 단계 시작 연출(접시 이동 · 도구 등장)이 끝난 뒤 조작
  const c = window.__cafe, wb = c.workbench, i0 = wb.stepIndex, type = T.stepType();
  const side = wb.el.querySelector('.wb-side');
  const H = c.sm.h - (side?.offsetHeight ?? 150), W = c.sm.w;
  const cx = W / 2, cy = H * 0.5;
  const B = wb.bench;
  if (type === 'slice') {
    for (let k = 0; k < 24 && wb.stepIndex === i0; k++) { c.advance(k ? 1.8 : 0.4); if (T.cut(k % 2 ? -26 : 22) === null) c.advance(0.6); }
  } else if (type === 'plate' && B.pans) {
    const tapAt = (o) => { const p = o.position; const s = T.scr(p.x, p.y + 0.02, p.z); T.ev('pointerdown', s[0], s[1]); T.ev('pointerup', s[0], s[1]); c.advance(0.9); };
    const st = wb.order.steps[i0];
    for (let rep = 0; rep < 5 && wb.stepIndex === i0; rep++) {
      for (const id of st.layers) { if (wb.stepIndex !== i0) break; if (id === 'bread_top') tapAt(B.breadSlice(1)); else if (B.pans[id]) tapAt(B.pans[id]); }
      if (wb.stepIndex === i0) { T.click('.wb-actions .wb-btn.primary'); c.advance(1.2); }
    }
  } else if (type === 'halve') {
    T.halveSwipe(); c.advance(1.5);
    if (wb.stepIndex === i0) { // 반대 대각선
      const d = B.dish, V3 = d.position.constructor, yt = B.top, h = 0.08;
      const toS = (x, z) => { const w = d.localToWorld(new V3(x, yt, z)); const l = wb.stage.worldToLocal(w); return T.scr(l.x, l.y, l.z); };
      const a = toS(-h, h), b = toS(h, -h);
      T.drag([a, [(a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2], b]); c.advance(3.5);
    }
  } else T.driveSpecial?.(type);
  for (let r = 0; r < rounds && wb.stepIndex === i0 && wb.order; r++) {
    const p = r % 5;
    if (p === 0) { const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([cx + Math.cos(a) * 55, cy + Math.sin(a) * 40]); } T.drag(pts, 0.04); }
    else if (p === 1) { const pts = []; for (let i = 0; i <= 10; i++) pts.push([cx + 4, cy - 70 + i * 14]); T.drag(pts, 0.04); }
    else if (p === 2) { const pts = []; for (let i = 0; i <= 10; i++) pts.push([cx - 80 + i * 16, cy + 6]); T.drag(pts, 0.04); }
    else if (p === 3) { T.ev('pointerdown', cx, cy); c.advance(1.2); T.ev('pointerup', cx, cy); }
    else T.click('.wb-actions .wb-btn.primary');
    c.advance(0.5);
  }
  return { type, natural: wb.stepIndex !== i0 || !wb.order };
};

T.auditBenches = async (opts = {}) => {
  const c = window.__cafe, wb = c.workbench, out = new Map(), coverage = [];
  const rec = (k, d, info) => { const o = out.get(k); if (!o || d > o.d) out.set(k, { d, info }); };
  const m = c.furniture.stations('master')[0];
  const recipes = opts.recipes ? opts.recipes.map((id) => c.registry.recipes.get(id)) : [...c.registry.recipes.values()];
  for (const r of recipes) {
    if (wb.isOpen) wb.close();
    await T.sleep(30);
    const steps = c.registry.stepsFor(r, null);
    const order = { recipe: r, steps, customer: { persona: { name: '테스트' } }, option: null, status: 'cooking' };
    let done = false;
    wb.open(order, m, { onDone() { done = true; }, onCancel() {} });
    const B = wb.bench;
    let cfg = B3.config(B);
    const orig = B.update?.bind(B);
    let tag = '';
    B.update = (dt) => { orig?.(dt); try { B3.probe(B, cfg, tag, rec); } catch (e) { rec(`${tag} probe ERR ${e.message}`, 1); } };
    c.advance(1.2);
    B3.staticOverlap(B, cfg, `[${r.id}:배치]`, rec);
    const cov = [];
    for (let guard = 0; guard < steps.length + 2 && wb.order && wb.stepIndex < steps.length; guard++) {
      const i = wb.stepIndex, type = T.stepType();
      tag = `[${r.id}:${i + 1}.${type}]`;
      cfg = B3.config(B); // 단계마다 새로 생긴 도구(트위저 · 시럽 병 등)까지
      let res;
      try { res = T.driveStep(); } catch (e) { rec(`${tag} drive ERR ${e.message}`, 1); res = { type, natural: false }; }
      if (wb.order && wb.stepIndex === i) { wb.stepDone(80, 'audit'); c.advance(1.6); }
      cov.push(`${type}${res.natural ? '' : '*'}`);
      await T.sleep(5);
    }
    tag = `[${r.id}:완성]`;
    c.advance(3);
    coverage.push(`${r.id}: ${cov.join(' ')}`);
  }
  if (wb.isOpen) wb.close();
  return { issues: [...out].map(([k, o]) => `${k} ${(o.d * 100).toFixed(1)}cm${opts.detail && o.info ? ' ' + JSON.stringify(o.info) : ''}`), coverage };
};

// [검사 3-2] 완성 요리 14종: 셰프 쟁반 위 · 손님 테이블 위 높이 (파묻힘 · 뜸)
T.auditDishes = () => {
  const c = window.__cafe, ai = c.ai, out = [], THREE = c.THREE;
  const lowest = (o) => { o.updateMatrixWorld(true); let lo = Infinity; o.traverse((m) => { if (!m.isMesh || !B3.vis(m)) return; for (const v of B3.verts(m, 200)) lo = Math.min(lo, v.y); }); return lo; };
  const tray = ai.chef.tray;
  const trayMeshes = B3.meshes(tray);
  const seats = c.furniture.seats();
  for (const r of c.registry.recipes.values()) {
    const dish = c.dishes.buildHeroDish(r.id) || c.dishes.buildBistroDish(r.id);
    if (!dish) { out.push(`${r.id}: 완성 요리 프리팹 없음`); continue; }
    // 쟁반 (chefCooked 와 같은 놓기)
    tray.visible = true;
    dish.position.set(0, 0.012, 0); dish.rotation.set(0, 0, 0); dish.scale.setScalar(1);
    tray.add(dish);
    tray.updateMatrixWorld(true);
    const lo = lowest(dish);
    const p = new THREE.Vector3(); dish.getWorldPosition(p);
    const hit = B3.topAt(p.x, p.z, lo + 0.3, trayMeshes.filter((m) => !B3.under(m, dish)));
    const gapT = hit ? lo - hit.point.y : null;
    tray.remove(dish);
    tray.visible = !!ai.chef.carry;
    // 테이블 (serve 와 같은 놓기) — 모든 좌석
    let worst = null;
    for (const s of seats) {
      const spot = ai.dishSpot(s);
      dish.position.copy(spot); dish.rotation.set(0, Math.atan2(s.facing[0], s.facing[1]) + Math.PI, 0);
      c.sm.scene.add(dish);
      const lo2 = lowest(dish);
      const tm = B3.meshes(s.table.object);
      const h2 = B3.topAt(spot.x, spot.z, lo2 + 0.3, tm);
      c.sm.scene.remove(dish);
      const g = h2 ? lo2 - h2.point.y : null;
      if (g === null || (worst === null || Math.abs(g) > Math.abs(worst.g))) worst = { g, seat: s.tile, table: s.table.defId };
    }
    const fmt = (g) => (g === null ? '받침 없음' : `${(g * 100).toFixed(1)}cm`);
    if (gapT === null || Math.abs(gapT) > 0.003) out.push(`${r.id}: 쟁반 위 ${gapT === null ? '쟁반 밖' : gapT < 0 ? '파묻힘' : '뜸'} ${fmt(gapT)}`);
    if (!worst || worst.g === null || Math.abs(worst.g) > 0.003) out.push(`${r.id}: 테이블(${worst?.table}) 위 ${worst?.g === null ? '받침 없음' : worst.g < 0 ? '파묻힘' : '뜸'} ${fmt(worst?.g ?? null)} 좌석 ${worst?.seat}`);
    c.dishes.dispose?.(dish);
  }
  return out;
};

// 감사용 단계별 실제 조작 (자동 조작으로 끝낼 수 있는 단계를 늘려 도구가 실제로 움직이는 동안을 검사)
T.meterNums = () => ((document.querySelector('.wb .wb-meter')?.textContent ?? '').match(/\d+(\.\d+)?/g) ?? []).map(Number);
T.holdUntil = (pred, maxSec = 12) => {
  const c = window.__cafe, b = document.querySelector('.wb-actions .wb-btn.hold');
  if (!b) return false;
  const P = (t) => b.dispatchEvent(new PointerEvent(t, { pointerId: 21, isPrimary: true, bubbles: true, cancelable: true }));
  P('pointerdown');
  for (let t = 0; t < maxSec && !pred(); t += 0.05) c.advance(0.05);
  P('pointerup');
  c.advance(0.3);
  return true;
};
T.driveSpecial = (type) => {
  const c = window.__cafe, wb = c.workbench, B = wb.bench, i0 = wb.stepIndex;
  const same = () => wb.stepIndex === i0 && wb.order;
  if (type === 'grind') { T.holdUntil(() => (T.meterNums()[0] ?? 0) >= 17.7); T.click('.wb-actions .wb-btn.primary'); c.advance(1.5); }
  else if (type === 'water') { T.holdUntil(() => (T.meterNums()[0] ?? 0) >= 178); c.advance(1.5); }
  else if (type === 'steam') { T.holdUntil(() => (T.meterNums()[0] ?? 0) >= 62); c.advance(1.5); }
  else if (type === 'extract') {
    for (let t = 0; t < 4 && !document.querySelector('.lever-track'); t += 0.1) c.advance(0.1); // 레버 패널은 잠시 뒤에 나온다
    const tr = document.querySelector('.lever-track');
    if (tr) {
      const r = tr.getBoundingClientRect();
      const P = (t, y) => tr.dispatchEvent(new PointerEvent(t, { clientX: r.left + r.width / 2, clientY: y, pointerId: 22, isPrimary: true, bubbles: true, cancelable: true }));
      P('pointerdown', r.top + 2); for (let k = 1; k <= 8; k++) { P('pointermove', r.top + r.height * 0.75 * (k / 8)); c.advance(0.04); } P('pointerup', r.top + r.height * 0.75);
      for (let t = 0; t < 14 && (T.meterNums()[1] ?? 0) < 35 && same(); t += 0.1) c.advance(0.1);
      T.click('.wb-actions .wb-btn.primary'); c.advance(1.5);
    }
  } else if (type === 'art') {
    document.querySelector('.wb-actions .wb-btn')?.click(); c.advance(0.6);
    const cup = B.cup.position, s = T.scr(cup.x, cup.y + (B.cupH ?? 0.08), cup.z);
    for (let k = 0; k < 4 && same(); k++) { const pts = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; pts.push([s[0] + Math.cos(a) * 18 * (k + 1) / 2, s[1] + Math.sin(a) * 10 * (k + 1) / 2]); } T.drag(pts, 0.04); }
    T.click('.wb-actions .wb-btn.primary'); c.advance(2);
  } else if (type === 'roll') {
    for (let k = 0; k < 16 && same(); k++) { const z0 = -0.02, z1 = 0.22; const pts = []; for (let i = 0; i <= 10; i++) { const z = k % 2 ? z1 - (z1 - z0) * i / 10 : z0 + (z1 - z0) * i / 10; pts.push(T.scr(-0.2, 0.93, z)); } T.drag(pts, 0.02); }
    c.advance(2.2);
  } else if (type === 'cut_pasta' && B.sheet) {
    const S = B.sheet;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7 && same(); i++) { const x = -0.2 - S.w / 2 + S.w * (i + 1) / 8; const p = T.scr(x, 0.93 + S.t * 3, 0.1); T.drag([[p[0] + 5, p[1] - 35], [p[0] + 6, p[1]], [p[0] + 8, p[1] + 35]]); c.advance(0.5); }
    c.advance(4.5);
  } else if (type === 'toss') {
    const P = B.panHome;
    for (let k = 0; k < 7 && same(); k++) { const pts = []; for (let i = 0; i <= 5; i++) pts.push(T.scr(P.x, 0.95, P.z - i * 0.012)); for (let i = 0; i <= 4; i++) pts.push(T.scr(P.x, 0.95, P.z - 0.06 + i * 0.025)); T.drag(pts, 0.016); c.advance(0.7); }
    c.advance(1);
  } else if (type === 'stretch') {
    const D = B.pizza.position;
    for (let k = 0; k < 30 && same(); k++) { const a = k * 0.9; const pts = []; for (let i = 0; i <= 6; i++) { const r = 0.02 + i * 0.022; pts.push(T.scr(D.x + Math.cos(a) * r, D.y, D.z + Math.sin(a) * r)); } T.drag(pts, 0.02); }
  } else if (type === 'bake') {
    for (let t = 0; t < 4 && B.pizza.position.y < 0.925; t += 0.1) c.advance(0.1); // 필이 도우를 들어 올린 뒤(밀기 단계)
    c.advance(0.4);
    const pz = B.pizza.position, s = T.scr(pz.x, pz.y, pz.z); // 피자 위에서 시작해 위로 민다
    const pts = []; for (let i = 0; i <= 14; i++) pts.push([s[0], s[1] - i * 18]);
    T.drag(pts, 0.05);
    for (let t = 0; t < 10 && !/지금/.test(document.querySelector('.wb .wb-meter')?.textContent ?? ''); t += 0.1) c.advance(0.1);
    T.click('.wb-actions .wb-btn.primary');
    c.advance(2.8);
  } else if (type === 'wheel') {
    const P = B.pizza.position, R = B.meanR;
    for (let i = 0; i < 4 && same(); i++) {
      const a = (i * Math.PI) / 4;
      const p0 = T.scr(P.x - Math.cos(-a) * R, P.y + 0.022, P.z - Math.sin(-a) * R);
      const p1 = T.scr(P.x + Math.cos(-a) * R, P.y + 0.022, P.z + Math.sin(-a) * R);
      T.drag([p0, [(p0[0] + p1[0]) / 2 + 6, (p0[1] + p1[1]) / 2], p1]);
      c.advance(1.0);
    }
    c.advance(3);
  } else if (type === 'top' && B.pizza) {
    const D = B.pizza.position;
    for (let k = 0; k < 40 && same(); k++) { const a = k * 2.4, r = 0.03 + (k % 4) * 0.022; const s = T.scr(D.x + Math.cos(a) * r, D.y + 0.012, D.z + Math.sin(a) * r); T.ev('pointerdown', s[0], s[1]); T.ev('pointerup', s[0], s[1]); c.advance(0.2); }
  }
};
