import * as THREE from 'three';

// v15 조리대 GPU 자원 회수: 열려 있는 동안 무대에 한 번이라도 올라온 지오메트리 · 재질 · 본 텍스처를 모아 두었다가
// 닫을 때 (서빙할 접시만 빼고) 한꺼번에 해제한다. 단계가 바뀌며 무대에서 조용히 빠진 도구 · 조각도 놓치지 않는다
function collectInto(root, bag) {
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) bag.sk.add(o.skeleton);
    if (o.geometry && !o.isSprite && !o.geometry.userData?.shared) bag.geo.add(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!m.userData?.shared) bag.mat.add(m); // 스프라이트(안내 라벨 등)의 재질 · 캔버스 텍스처도
  });
}
function disposeBag(bag, keepRoot) {
  const keep = { geo: new Set(), mat: new Set(), sk: new Set() };
  if (keepRoot) collectInto(keepRoot, keep);
  for (const g of bag.geo) if (!keep.geo.has(g)) g.dispose();
  for (const m of bag.mat) {
    if (keep.mat.has(m)) continue;
    for (const k of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'alphaMap', 'displacementMap', 'emissiveMap']) {
      const t = m[k];
      if (t?.isCanvasTexture && !t.userData?.shared && !t.userData?.cached) {
        let used = false;
        for (const km of keep.mat) if (km[k] === t || km.map === t) used = true;
        if (!used) t.dispose();
      }
    }
    m.dispose();
  }
  for (const sk of bag.sk) if (!keep.sk.has(sk)) sk.dispose?.();
  bag.geo.clear();
  bag.mat.clear();
  bag.sk.clear();
}
import { registry } from '../core/PackRegistry.js';
import { gradeFor, payment } from '../core/Grading.js';
import { icon } from '../ui/icons.js';
import { svgBanner, FONT } from '../ui/svgText.js';
import { BoardBench } from './BoardBench.js';
import { EspressoBench } from './EspressoBench.js';
import { PastaBench } from './PastaBench.js';
import { PizzaBench } from './PizzaBench.js';
import { SaladBench } from './SaladBench.js';

const BENCHES = { espresso: EspressoBench, sandwich: BoardBench, pasta: PastaBench, pizza: PizzaBench, salad: SaladBench };

const STEP_NAME = {
  slice: '결 살려 썰기',
  spread: '스프레드 바르기',
  plate: '플레이팅',
  drizzle: '드리즐',
  pepper: '통후추',
  grind: '그라인딩',
  tamp: '수평 탬핑',
  syrup: '시럽',
  extract: '9 Bar 추출',
  water: '온수',
  steam: '스티밍',
  art: '라떼아트',
  roll: '반죽 밀기',
  cut_pasta: '생면 제면',
  toss: '팬 토스',
  twirl: '트위저 플레이팅',
  grate: '치즈 갈기',
  stretch: '도우 스트레칭',
  ladle: '소스 스월링',
  top: '토핑 올리기',
  bake: '화덕 굽기',
  dress: '드레싱',
  toss_salad: '샐러드 토싱',
  wheel: '피자 휠 커팅',
  halve: '대각선 반 자르기',
};

// 3D 워크벤치: 메인 카메라가 실제 조리대 위로 비스듬히 클로즈업하고, 그 자리에 고디테일 조리대가 펼쳐진다.
export class Workbench3D {
  constructor({ sm, sound, furniture, day, root, ai }) {
    Object.assign(this, { sm, sound, furniture, day, ai });
    this.scene = sm.scene;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.timers = [];
    this.panels = [];
    this.light = new THREE.PointLight(new THREE.Color('#fff1dc').convertSRGBToLinear(), 0, 3, 2);
    this.scene.add(this.light);
    this.buildUI(root);
  }

  get isOpen() {
    return !!this.order;
  }

  buildUI(root) {
    const el = document.createElement('div');
    el.className = 'wb hidden';
    // 10차 (세로 고정): 위 74% = 아무것도 가리지 않는 3D 조리대, 아래 26%(최대 185px) = 슬림 하단 바.
    // 요리 제목은 SVG 배너(줄바꿈 없이 통째로 축소), 레버 같은 도구는 3D 화면 오른쪽에 떠 있는 오버레이.
    el.innerHTML = `
      <div class="wb-touch"></div>
      <div class="wb-head">
        <span class="wb-ic"></span>
        <div class="wb-banner"></div>
        <button class="icon-btn wb-close" aria-label="조리 그만두기">${icon('close')}</button>
      </div>
      <ol class="wb-steps"></ol>
      <div class="wb-tools"></div>
      <aside class="wb-side">
        <div class="wb-bottom">
          <div class="wb-inst"><b></b><p></p></div>
          <div class="wb-meter"></div>
          <div class="wb-actions"></div>
        </div>
        <div class="wb-result hidden"></div>
      </aside>
      <div class="wb-pops"></div>`;
    root.appendChild(el);
    this.el = el;
    this.q = (s) => el.querySelector(s);
    this.q('.wb-close').addEventListener('click', () => this.cancel());
    const touch = this.q('.wb-touch');
    const send = (type) => (e) => {
      if (!this.ctrl) return;
      if (type === 'down') {
        try {
          touch.setPointerCapture(e.pointerId);
        } catch {
          /* 합성 이벤트 */
        }
      }
      this.setNdc(e);
      this.ctrl[type]?.(e, this.ndc);
    };
    touch.addEventListener('pointerdown', send('down'));
    touch.addEventListener('pointermove', send('move'));
    touch.addEventListener('pointerup', send('up'));
    touch.addEventListener('pointercancel', send('up'));
    touch.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // 3D 뷰포트 영역: 가로 = 왼쪽 68%, 세로 = 위쪽 60%
  applyViewRect() {
    // 10차: 세로 고정. 위 74%(하단 바가 185px 보다 커지지 않게) = 3D 조리대
    const bar = Math.min(185, this.sm.h * 0.26);
    this.sm.setViewRect({ x0: 0, x1: 1, y0: 0, y1: 1 - bar / this.sm.h });
  }

  setNdc(e) {
    this.ndc.set((e.clientX / this.sm.w) * 2 - 1, -(e.clientY / this.sm.h) * 2 + 1);
  }

  // ───────── 벤치가 쓰는 도구 ─────────
  makeCtx() {
    const wb = this;
    return {
      stage: this.stage,
      sound: this.sound,
      order: this.order,
      ing: (id) => registry.ingredient(id),
      // 벤치 로컬 좌표의 한 점을 화면 중앙에 두고, 가로 width(m)가 보이게 클로즈업
      view(local, width, pitch = 0.95, yawOff = 0) {
        const world = wb.stage.localToWorld(local.clone());
        wb.sm.focus({ target: world, yaw: wb.yaw + yawOff, pitch, width });
        wb.light.position.copy(world).add(new THREE.Vector3(0, 0.9, 0));
        wb.day.focus = world.clone();
      },
      // 화면 좌표 → 벤치 로컬 수평면(y) 위의 점
      planeHit(ndc, localY) {
        wb.ray.setFromCamera(ndc, wb.sm.camera);
        const n = new THREE.Vector3(0, 1, 0);
        const p0 = wb.stage.localToWorld(new THREE.Vector3(0, localY, 0));
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p0);
        const v = new THREE.Vector3();
        if (!wb.ray.ray.intersectPlane(plane, v)) return null;
        return wb.stage.worldToLocal(v);
      },
      // 벤치 로컬 점 → 화면(앱) 픽셀
      toScreen(local) {
        const v = wb.stage.localToWorld(local.clone()).project(wb.sm.camera);
        return { x: (v.x * 0.5 + 0.5) * wb.sm.w, y: (-v.y * 0.5 + 0.5) * wb.sm.h };
      },
      ndcToPx(ndc) {
        return { x: (ndc.x * 0.5 + 0.5) * wb.sm.w, y: (-ndc.y * 0.5 + 0.5) * wb.sm.h };
      },
      // 3D 뷰포트(사이드바를 뺀 영역)의 가로 폭(px)
      viewW() {
        const r = wb.sm.rectTarget;
        return (r.x1 - r.x0) * wb.sm.w;
      },
      raycast(ndc, objects) {
        wb.ray.setFromCamera(ndc, wb.sm.camera);
        return wb.ray.intersectObjects(objects, true);
      },
      ui: {
        step(title, hint = '') {
          wb.q('.wb-inst b').textContent = title;
          wb.q('.wb-inst p').textContent = hint;
        },
        meter(html) {
          wb.q('.wb-meter').innerHTML = html;
        },
        actions(list) {
          const box = wb.q('.wb-actions');
          box.innerHTML = '';
          for (const a of list) {
            const b = document.createElement('button');
            b.className = 'wb-btn' + (a.primary ? ' primary' : '') + (a.hold ? ' hold' : '');
            b.innerHTML = `${a.icon ? icon(a.icon) : ''}<span>${a.label}</span>`;
            if (a.disabled) b.disabled = true;
            if (a.hold) {
              b.dataset.raw = '1'; // 길게 누르는 버튼은 직접 pointer 를 받는다
              let held = false;
              b.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                try {
                  b.setPointerCapture(e.pointerId);
                } catch {
                  /* 합성 이벤트 */
                }
                held = true;
                b.classList.add('down');
                a.onDown?.();
              });
              const up = () => {
                if (!held) return;
                held = false;
                b.classList.remove('down');
                a.onUp?.();
              };
              b.addEventListener('pointerup', up);
              b.addEventListener('pointercancel', up);
              b.addEventListener('lostpointercapture', up);
              b.addEventListener('contextmenu', (e) => e.preventDefault());
            } else b.addEventListener('click', () => a.onClick?.());
            if (a.id) b.dataset.id = a.id;
            box.appendChild(b);
          }
        },
        // 벤치 전용 화면 패널 (레버 등) — 단계가 바뀌면 자동으로 지워진다
        panel(html) {
          const p = document.createElement('div');
          p.className = 'wb-panel';
          p.innerHTML = html;
          wb.q('.wb-tools').appendChild(p);
          wb.panels.push(p);
          return p;
        },
        pop(text, good = true) {
          const c = wb.sm.viewCenter();
          wb.pop(text, good, c.x, c.y * 0.62);
        },
        popAt(local, text, good = true) {
          const v = wb.stage.localToWorld(local.clone()).project(wb.sm.camera);
          wb.pop(text, good, (v.x * 0.5 + 0.5) * wb.sm.w, (-v.y * 0.5 + 0.5) * wb.sm.h);
        },
      },
      done: (score, detail) => this.stepDone(score, detail),
      later: (sec, fn) => this.later(sec, fn),
    };
  }

  // 게임 루프 기준 지연 실행 (setTimeout 대신)
  later(sec, fn) {
    this.timers.push({ t: sec, fn });
  }

  pop(text, good, x, y) {
    const p = document.createElement('div');
    p.className = 'wb-pop' + (good ? '' : ' bad');
    p.textContent = text;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    this.q('.wb-pops').appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }

  // ───────── 열기 / 진행 / 닫기 ─────────
  open(order, station, { onDone, onCancel }) {
    this.order = order;
    this.station = station;
    this.cb = { onDone, onCancel };
    this.results = [];
    this.stepIndex = 0;
    this.yaw = (station.rot * Math.PI) / 2;
    station.object.visible = false;
    // 10차: 조리 중에는 다른 조리대 · 가구 · 손님을 모두 숨겨, 옆 칸 도마 같은 것이 화면에 끼어들지 않는 독립 스튜디오로
    this.hidden = [];
    const hide = (o) => {
      if (o && o.visible) {
        o.visible = false;
        this.hidden.push(o);
      }
    };
    for (const c of this.furniture.root.children) hide(c);
    if (this.ai?.root) for (const c of this.ai.root.children) hide(c);
    // v13: 뒷벽 후드 · 선반 · 와인 랙도 클로즈업 화면을 가리지 않게 잠시 숨긴다
    hide(this.walls?.northGroup);
    this.applyViewRect();
    this.stage = new THREE.Group();
    this.stage.position.copy(this.furniture.worldCenter(station));
    this.stage.rotation.y = this.yaw;
    this.scene.add(this.stage);
    this.stage.updateMatrixWorld(true);
    this.light.intensity = 0.3;
    const ctx = this.makeCtx();
    // v12: 통합 마스터 조리대 → 주문 메뉴에 맞는 클로즈업 워크벤치
    const Bench = BENCHES[order.recipe.station] ?? BENCHES[station.def.station] ?? BoardBench;
    this.bench = new Bench(ctx);
    const r = order.recipe;
    const opt = order.option ? registry.options[order.option]?.name : null;
    this.q('.wb-ic').innerHTML = icon(r.icon);
    this.q('.wb-banner').innerHTML = svgBanner(
      [
        { text: r.name, size: 20, family: FONT.head, color: '#2b1d14' },
        { text: `${order.customer.persona.name} 님 주문${opt ? ` · ${opt}` : ''}${r.it ? ` · ${r.it}` : ''}`, size: 11, weight: 600, family: FONT.title, italic: true, color: '#b84a27' },
      ],
      { align: 'start', pad: 2, gap: 0 },
    );
    // 단계는 번호 점으로만 (이름은 하단 바에 한 줄)
    this.q('.wb-steps').innerHTML = order.steps.map((s, i) => `<li data-i="${i}" title="${s.label ?? STEP_NAME[s.type]}"><i>${i + 1}</i><em></em></li>`).join('');
    this.q('.wb-result').classList.add('hidden');
    this.q('.wb-bottom').classList.remove('hidden');
    this.el.classList.remove('hidden');
    document.body.classList.add('workbench');
    this.startStep();
  }

  clearPanels() {
    for (const p of this.panels) p.remove();
    this.panels = [];
  }

  startStep() {
    this.ctrl?.destroy?.();
    this.clearPanels();
    const step = this.order.steps[this.stepIndex];
    this.el.querySelectorAll('.wb-steps li').forEach((li, i) => {
      li.classList.toggle('now', i === this.stepIndex);
      li.classList.toggle('done', i < this.stepIndex);
    });
    this.q('.wb-meter').innerHTML = '';
    this.ctrl = this.bench.start(step);
  }

  stepDone(score, detail) {
    const step = this.order.steps[this.stepIndex];
    this.results.push({ label: step.label ?? STEP_NAME[step.type], score: Math.round(score), detail });
    const em = this.q(`.wb-steps li[data-i="${this.stepIndex}"] em`);
    if (em) em.textContent = Math.round(score);
    this.stepIndex++;
    this.later(0.65, () => {
      if (!this.order) return;
      if (this.stepIndex < this.order.steps.length) this.startStep();
      else this.showResult();
    });
  }

  showResult() {
    this.ctrl?.destroy?.();
    this.ctrl = null;
    this.clearPanels();
    const total = Math.round(this.results.reduce((s, r) => s + r.score, 0) / this.results.length);
    const G = gradeFor(total);
    this.result = { score: total, grade: G.g, steps: this.results };
    const order = this.order;
    const pay = payment(order.recipe.price, G);
    this.bench.showcase?.();
    this.finishFx();
    this.q('.wb-bottom').classList.add('hidden');
    const box = this.q('.wb-result');
    const word = { S: '최고의 한 접시', A: '정성 가득', B: '무난한 완성', C: '조금 아쉬워요' }[G.g];
    box.innerHTML = `
      <div class="rs-row">
        <div class="badge badge-${G.g}"><span>${G.g}</span></div>
        <div class="rs-txt">${svgBanner(
          [
            { text: `${G.g}등급 ${total}점 · ${word}${order.matched ? ' · 취향 적중' : ''}`, size: 17, color: '#2b1d14' },
            { text: `예상 결제 ${pay.toLocaleString()}원`, size: 13, weight: 700, family: FONT.body, color: '#b84a27' },
          ],
          { align: 'start', pad: 2, gap: 0 },
        )}</div>
      </div>
      <button class="wb-btn primary big serve">${icon('serve')}<span>쟁반에 담고 서빙하러 가기</span></button>`;
    box.classList.remove('hidden');
    this.sound[{ S: 'fanfare', A: 'success', B: 'soft', C: 'aww' }[G.g]]?.();
    box.querySelector('.serve').addEventListener('click', () => {
      if (!this.bench) return; // 두 번 눌려도 한 번만 서빙
      this.sound.tap();
      const dish = this.bench.takeDish();
      this.keepDish = dish;
      const res = this.result;
      const cb = this.cb;
      this.close();
      cb.onDone?.(res, dish);
    });
  }

  cancel() {
    const cb = this.cb;
    this.close();
    cb?.onCancel?.();
  }

  close() {
    // v15: 이번 조리대에서 쓴 GPU 자원 회수 (서빙할 접시 = keepDish 는 남긴다)
    if (this.stage && this.bag) {
      try {
        collectInto(this.stage, this.bag);
        disposeBag(this.bag, this.keepDish);
      } catch (e) {
        console.warn('bench dispose', e);
      }
    }
    this.keepDish = null;
    this.timers = [];
    for (const f of this.fx ?? []) f.m.parent?.remove(f.m);
    this.fx = [];
    this.clearPanels();
    this.ctrl?.destroy?.();
    this.ctrl = null;
    this.bench?.destroy?.();
    if (this.stage) this.scene.remove(this.stage); // (서빙할 접시는 이미 takeDish 로 떼어 냈다)
    if (this.station) this.station.object.visible = true;
    for (const o of this.hidden ?? []) o.visible = true;
    this.hidden = [];
    this.stage = null;
    this.bench = null;
    this.order = null;
    this.light.intensity = 0;
    this.day.focus = null;
    this.sm.setViewRect(null);
    this.sm.unfocus();
    this.el.classList.add('hidden');
    document.body.classList.remove('workbench');
  }

  // 완성 연출: 조리 조각이 '퐁' 하는 김에 가려지며 완성품(Hero Dish)으로 바뀌고, 따뜻한 김이 모락모락 + 골드 스파클
  finishFx() {
    const hero = this.bench?.hero;
    if (!hero || !this.stage) return;
    const at = hero.position.clone();
    const tex = (kind) => {
      const key = '_fx' + kind;
      if (Workbench3D[key]) return Workbench3D[key];
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      if (kind === 'steam') {
        const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
        gr.addColorStop(0, 'rgba(255,255,255,0.85)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      } else {
        g.translate(32, 32);
        g.fillStyle = '#ffe08a';
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? 6 : 30;
          const a = (i / 8) * Math.PI * 2;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.fill();
        g.fillStyle = '#fff8dc';
        g.beginPath();
        g.arc(0, 0, 6, 0, Math.PI * 2);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.userData = { ...(t.userData || {}), shared: true }; // 김 · 반짝이 텍스처는 조리대마다 재사용
      return (Workbench3D[key] = t);
    };
    this.fx = this.fx ?? [];
    const add = (kind, opts) => {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(kind), transparent: true, depthWrite: false, blending: kind === 'spark' ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0 }));
      m.position.copy(at).add(opts.p);
      m.scale.setScalar(opts.s);
      m.renderOrder = 20;
      this.stage.add(m);
      this.fx.push({ m, t: -(opts.delay ?? 0), ...opts });
    };
    // 조각 → 완성품 전환을 가리는 부드러운 김 한 덩이
    add('steam', { p: new THREE.Vector3(0, 0.05, 0), s: 0.12, life: 0.8, grow: 2.6, rise: 0.02, peak: 0.95, delay: -0.3 });
    // 김이 가장 짙을 때 완성품이 '퐁' 나타난다
    hero.visible = false;
    this.later(0.18, () => {
      hero.visible = true;
      if (this.bench) this.bench.heroT = 0;
    });
    // 모락모락 김 (3초 동안 여러 줄기)
    for (let i = 0; i < 14; i++) add('steam', { p: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.06, (Math.random() - 0.5) * 0.06), s: 0.05, life: 1.8, grow: 2.2, rise: 0.16, peak: 0.45, delay: 0.2 + i * 0.2, sway: Math.random() * 6 });
    // 골드 스파클
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      add('spark', { p: new THREE.Vector3(0, 0.06, 0), s: 0.02, life: 0.9, grow: 0.4, vel: new THREE.Vector3(Math.cos(a) * 0.18, 0.12 + Math.random() * 0.1, Math.sin(a) * 0.18), peak: 1, delay: 0.1 + Math.random() * 0.15 });
    }
    this.sound.success?.();
  }

  updateFx(dt) {
    if (!this.fx?.length) return;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t < 0) continue;
      const u = Math.min(1, f.t / f.life);
      f.m.material.opacity = f.peak * Math.sin(u * Math.PI);
      f.m.scale.setScalar(f.s * (1 + f.grow * u));
      if (f.vel) {
        f.m.position.addScaledVector(f.vel, dt);
        f.vel.y -= 0.3 * dt;
      } else {
        f.m.position.y += f.rise * dt;
        if (f.sway) f.m.position.x += Math.sin(f.t * 3 + f.sway) * 0.004 * dt * 10;
      }
      if (u >= 1) {
        f.m.parent?.remove(f.m);
        f.m.material.dispose();
        this.fx.splice(i, 1);
      }
    }
  }

  update(dt) {
    if (this.stage) {
      this.bag = this.bag ?? { geo: new Set(), mat: new Set(), sk: new Set() };
      collectInto(this.stage, this.bag);
    }
    this.updateFx(dt);
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }
    if (!this.order) return;
    this.ctrl?.update?.(dt);
    this.bench?.update?.(dt);
  }
}
