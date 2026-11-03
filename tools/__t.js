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
    const st = c.furniture.stations(r.station)[0];
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
