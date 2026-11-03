import * as THREE from 'three';
import { registry } from '../core/PackRegistry.js';
import { bus } from '../core/EventBus.js';
import { buildFurniture } from '../core/FurnitureManager.js';
import { finishCanvas } from '../core/Textures.js';
import { makeEnvironment } from '../core/SceneManager.js';
import { icon } from './icons.js';

// 카탈로그 썸네일 렌더러 (한 번씩 찍어서 이미지로)
class Thumbnailer {
  constructor() {
    this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setPixelRatio(1);
    this.r.setSize(180, 180);
    this.r.outputEncoding = THREE.sRGBEncoding;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.environment = makeEnvironment(this.r);
    this.scene.add(new THREE.HemisphereLight(0xfff3e6, 0x6b5a4a, 0.7));
    const d = new THREE.DirectionalLight(0xffeedd, 2.2);
    d.position.set(3, 6, 5);
    this.scene.add(d);
    this.cam = new THREE.PerspectiveCamera(24, 1, 0.05, 60);
    this.cache = new Map();
  }
  shot(def) {
    if (this.cache.has(def.id)) return this.cache.get(def.id);
    const obj = buildFurniture(def, 0);
    this.scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z) * 2.6 + 0.3;
    this.cam.position.set(c.x + dist * 0.62, c.y + dist * 0.5, c.z + dist * 0.75);
    this.cam.lookAt(c);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(obj);
    this.cache.set(def.id, url);
    return url;
  }
}

// 꾸미기: 하단 카탈로그 시트 + 가구 위에 뜨는 플로팅 터치 메뉴
export class BuildUI {
  constructor(root, { build, state, actions }) {
    this.build = build;
    this.state = state;
    this.actions = actions;
    this.thumbs = null;
    this.cats = [...registry.listCategories(), { id: '__finish', name: '벽·바닥', icon: 'spread' }];
    this.cat = this.cats[0].id;

    const sheet = document.createElement('div');
    sheet.className = 'build-sheet hidden';
    sheet.innerHTML = `<div class="cats">${this.cats.map((c) => `<button data-cat="${c.id}">${icon(c.icon)}${c.name}</button>`).join('')}</div><div class="cards"></div>`;
    root.appendChild(sheet);
    this.sheet = sheet;
    this.cards = sheet.querySelector('.cards');
    sheet.querySelectorAll('[data-cat]').forEach((b) =>
      b.addEventListener('click', () => {
        this.cat = b.dataset.cat;
        this.render();
      }),
    );

    this.menu = document.createElement('div');
    this.menu.className = 'float-menu hidden';
    root.appendChild(this.menu);
    bus.on('build:changed', () => this.renderMenu());
    bus.on('state:money', () => this.sheet.classList.contains('hidden') || this.markAffordable());
  }

  setVisible(v) {
    this.sheet.classList.toggle('hidden', !v);
    if (v) this.render();
    else this.menu.classList.add('hidden');
  }

  render() {
    this.thumbs = this.thumbs ?? new Thumbnailer();
    this.sheet.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === this.cat));
    this.cards.innerHTML = '';
    this.cards.scrollLeft = 0;
    if (this.cat === '__finish') return this.renderFinishes();
    for (const def of registry.listFurniture(this.cat)) {
      const card = document.createElement('button');
      card.className = 'card';
      card.dataset.id = def.id;
      card.innerHTML = `<img alt="" width="72" height="72" src="${this.thumbs.shot(def)}"/><span class="nm">${def.name}</span><span class="pr">${def.price.toLocaleString()}원</span>`;
      card.addEventListener('click', () => this.actions.startPlacing(def.id));
      this.cards.appendChild(card);
    }
    this.markAffordable();
  }

  renderFinishes() {
    for (const kind of ['wall', 'floor']) {
      for (const fin of registry.finishes[kind].values()) {
        const card = document.createElement('button');
        card.className = 'card finish' + (this.state.finishes[kind] === fin.id ? ' on' : '');
        if (!fin._thumb) fin._thumb = finishCanvas(fin.texture).toDataURL('image/jpeg', 0.8);
        card.innerHTML = `<img alt="" width="72" height="72" src="${fin._thumb}"/><span class="nm">${fin.name}</span><span class="pr">${kind === 'wall' ? '벽' : '바닥'} · 무료</span>`;
        card.addEventListener('click', () => {
          this.actions.applyFinish(kind, fin.id);
          this.render();
        });
        this.cards.appendChild(card);
      }
    }
  }

  markAffordable() {
    this.cards.querySelectorAll('.card[data-id]').forEach((c) => {
      const def = registry.getFurniture(c.dataset.id);
      c.classList.toggle('poor', !!def && def.price > this.state.money);
    });
  }

  renderMenu() {
    const b = this.build;
    const p = b.placing;
    const inst = b.selected;
    if (!p && !inst) {
      this.menu.classList.add('hidden');
      return;
    }
    const def = p ? p.def : inst.def;
    const sw = def.swatches[p ? p.swatch : inst.swatch];
    const chip = sw.chip ? `<i style="background:linear-gradient(135deg, ${sw.chip[0]} 50%, ${sw.chip[1] ?? sw.chip[0]} 50%)"></i>` : '';
    const head = `<div class="fm-head"><b>${def.name}</b><small>${chip}${sw.name}${p && !p.moving ? ` · ${def.price.toLocaleString()}원` : ''}</small></div>`;
    const btn = (a, label, cls = '') => `<button data-a="${a}" class="${cls}">${label}</button>`;
    const buttons = p
      ? btn('ok', `${icon('check')}<span>${p.moving ? '여기로' : '배치'}</span>`, b.canConfirm ? 'ok' : 'ok off') + btn('rot', `${icon('rotR')}<span>90°</span>`) + btn('tone', `${icon('spread')}<span>톤</span>`) + btn('x', `${icon('close')}<span>취소</span>`)
      : btn('rot', `${icon('rotR')}<span>90° 회전</span>`) + btn('tone', `${icon('spread')}<span>톤 변경</span>`) + btn('move', `${icon('walk')}<span>이동</span>`) + btn('sell', `${icon('coin')}<span>판매</span>`, 'sell');
    this.menu.innerHTML = head + `<div class="fm-btns">${buttons}</div>` + (p ? `<div class="fm-tip">바닥을 탭하거나 가구를 끌어서 옮겨요</div>` : '');
    const on = (a, fn) => this.menu.querySelector(`[data-a="${a}"]`)?.addEventListener('click', fn);
    on('ok', () => b.confirm());
    on('rot', () => b.rotate());
    on('tone', () => b.cycleSwatch());
    on('x', () => b.cancel());
    on('move', () => b.startMoving(inst));
    on('sell', () => b.sell());
    this.menu.classList.remove('hidden');
  }

  // 가구 위로 메뉴 위치 맞추기 (매 프레임)
  update(camera, w, h) {
    if (this.menu.classList.contains('hidden')) return;
    const fp = this.build.focusPoint();
    if (!fp) return;
    fp.project(camera);
    const mw = this.menu.offsetWidth;
    const mh = this.menu.offsetHeight;
    let x = (fp.x * 0.5 + 0.5) * w - mw / 2;
    let y = (-fp.y * 0.5 + 0.5) * h - mh - 12;
    const sheetTop = this.sheet.getBoundingClientRect().top || h;
    x = Math.max(8, Math.min(w - mw - 8, x));
    y = Math.max(64, Math.min(sheetTop - mh - 8, y));
    this.menu.style.transform = `translate(${x}px, ${y}px)`;
  }
}
