import { registry } from '../core/PackRegistry.js';
import { slotImage } from '../core/AssetLoader.js';
import { WEATHER_NAME } from '../core/DialogueEngine.js';
import { icon } from './icons.js';
import { oneLine } from './svgText.js';
import { bindTap } from './Tap.js';
import { clampLine } from './clampLine.js';

// 9차 메뉴판 카테고리 (조리대 = 카테고리)
const CATEGORIES = [
  { id: 'pasta', short: '파스타', ic: 'pasta', name: '파스타', it: 'Pasta Fresca' },
  { id: 'pizza', short: '화덕 피자', ic: 'pizza', name: '화덕 피자', it: 'Pizza al Forno' },
  { id: 'salad', short: '샐러드', ic: 'salad', name: '가든 샐러드', it: 'Insalata' },
  { id: 'espresso', short: '커피 & 바', ic: 'latte', name: '에스프레소 & 바', it: 'Caffè' },
  { id: 'sandwich', short: '브런치', ic: 'blt', name: '브런치 & 토스트', it: 'Brunch' },
];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 손님 초상화: portrait_<id>.png 슬롯이 있으면 그 그림, 없으면 페르소나 외모로 그린 일러스트
export function portrait(p) {
  const img = slotImage(`portrait_${p.id}`);
  if (img) return img.src;
  const S = 200;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#3a322c');
  bg.addColorStop(1, '#5a4a3e');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  const L = p.look;
  // 어깨
  g.fillStyle = L.coat ?? L.top;
  g.beginPath();
  g.ellipse(S / 2, S * 1.02, S * 0.42, S * 0.3, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = L.skin;
  g.fillRect(S * 0.45, S * 0.6, S * 0.1, S * 0.12);
  // 뒷머리
  g.fillStyle = L.hair;
  if (L.style === 'long' || L.style === 'bob') {
    g.beginPath();
    g.ellipse(S / 2, S * 0.5, S * 0.25, L.style === 'long' ? S * 0.33 : S * 0.26, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 얼굴
  g.fillStyle = L.skin;
  g.beginPath();
  g.ellipse(S / 2, S * 0.45, S * 0.19, S * 0.23, 0, 0, Math.PI * 2);
  g.fill();
  // 앞머리
  g.fillStyle = L.hair;
  g.beginPath();
  g.ellipse(S / 2, S * 0.3, S * 0.21, S * 0.12, 0, Math.PI, 0);
  g.fill();
  g.beginPath();
  g.ellipse(S * 0.42, S * 0.3, S * 0.13, S * 0.07, -0.4, 0, Math.PI * 2);
  g.fill();
  if (L.style === 'bun') {
    g.beginPath();
    g.arc(S / 2, S * 0.17, S * 0.07, 0, Math.PI * 2);
    g.fill();
  }
  // 눈·눈썹·입
  g.fillStyle = '#1e1916';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(S / 2 + s * S * 0.07, S * 0.46, S * 0.014, S * 0.02, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(S / 2 + s * S * 0.07 - S * 0.03, S * 0.405, S * 0.06, S * 0.008);
  }
  g.strokeStyle = 'rgba(90,40,30,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(S / 2, S * 0.53, S * 0.04, 0.2, Math.PI - 0.2);
  g.stroke();
  g.fillStyle = 'rgba(220,120,110,0.25)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(S / 2 + s * S * 0.11, S * 0.52, S * 0.03, S * 0.018, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (L.scarf) {
    g.fillStyle = L.scarf;
    g.fillRect(S * 0.36, S * 0.68, S * 0.28, S * 0.07);
  }
  if (L.glasses) {
    g.strokeStyle = '#2a211c';
    g.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      g.beginPath();
      if (L.glasses === 'round') g.arc(S / 2 + s * S * 0.075, S * 0.46, S * 0.045, 0, Math.PI * 2);
      else g.rect(S / 2 + s * S * 0.075 - S * 0.05, S * 0.43, S * 0.1, S * 0.065);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(S * 0.475, S * 0.455);
    g.lineTo(S * 0.525, S * 0.455);
    g.stroke();
  }
  if (L.hat && L.hat !== 'chef') {
    g.fillStyle = L.hatColor ?? '#3c4a3e';
    g.beginPath();
    if (L.hat === 'beret') g.ellipse(S * 0.53, S * 0.24, S * 0.23, S * 0.08, -0.15, 0, Math.PI * 2);
    else if (L.hat === 'beanie') g.ellipse(S / 2, S * 0.27, S * 0.21, S * 0.13, 0, Math.PI, 0);
    else {
      g.ellipse(S / 2, S * 0.27, S * 0.2, S * 0.11, 0, Math.PI, 0);
      g.rect(S * 0.5, S * 0.255, S * 0.24, S * 0.03);
    }
    g.fill();
  }
  return c.toDataURL('image/png');
}

export class DialogueUI {
  constructor(root, { engine, sound, state }) {
    this.engine = engine;
    this.sound = sound;
    this.state = state;
    this.el = document.createElement('div');
    this.el.className = 'dlg hidden';
    this.el.innerHTML = `
      <div class="dlg-card">
        <div class="dlg-who"><img class="dlg-face" alt="" width="56" height="56"/><div><b></b><small></small><div class="dlg-tags"></div></div>
          <button class="icon-btn dlg-x" aria-label="대화 끝내기">${icon('close')}</button></div>
        <div class="dlg-banner hidden"><span>★ 취향 완벽 저격! 손님의 기대치 MAX ★</span></div>
        <p class="dlg-text"></p>
        <div class="dlg-choices"></div>
      </div>`;
    root.appendChild(this.el);
    // v16 메뉴판: 스크롤 없는 한 화면 고정 그리드 + pointerdown 즉시 실행 (click · 스크롤 · 잠금 조건 없음)
    this.board = document.createElement('div');
    this.board.id = 'menu-board';
    this.board.className = 'menu-board v16 hidden';
    this.board.innerHTML = `
      <div class="mb16-card" role="dialog" aria-label="메뉴판">
        <div class="mb16-head"><b>Il Menù</b><small>오늘의 메뉴판</small><button type="button" class="mb16-x" aria-label="메뉴판 닫기">${icon('close')}</button></div>
        <div class="mb16-known"></div>
        <div class="mb16-tabs" role="tablist"></div>
        <div class="mb16-list menu-list"></div>
      </div>`;
    root.appendChild(this.board);
    // 손가락이 닿는 즉시 실행. 키보드(Enter/Space)로 누른 click(detail 0)만 같은 동작으로 받는다
    this.press = (el, fn) => {
      el.onpointerdown = (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        fn(e);
      };
      el.onclick = (e) => e.detail === 0 && fn(e);
    };
    this.press(this.board.querySelector('.mb16-x'), () => {
      this.sound.tap();
      this.closeBoard();
      this.main();
    });
    // 바깥(어두운 배경)을 눌러도 즉시 닫힘
    this.board.onpointerdown = (e) => {
      if (e.target !== this.board) return;
      e.preventDefault();
      this.closeBoard();
      this.main();
    };
    this.q = (s) => this.el.querySelector(s);
    bindTap(this.q('.dlg-x'), () => this.close(true));
    this.q('.dlg-text').addEventListener('click', () => this.skip());
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(customer, available, { onOrder, onClose, onMatch, onBack }) {
    this.c = customer;
    this.available = available;
    this.cb = { onOrder, onClose, onMatch, onBack };
    this.banner(false);
    const p = customer.persona;
    this.q('.dlg-face').src = portrait(p);
    this.q('.dlg-who b').textContent = p.name;
    const memo = this.state.regulars[p.id];
    this.q('.dlg-who small').textContent = `${p.job} · 날씨 ${WEATHER_NAME[this.state.weather] ?? '맑음'}${memo?.visits ? ` · ${memo.visits}번째 방문` : ''}`;
    this.el.classList.remove('hidden');
    document.body.classList.add('talking');
    const lines = this.engine.start(customer, { minutes: this.state.minutes, weather: this.state.weather });
    this.tags();
    this.say(lines.join(' '), () => this.main());
  }

  tags() {
    const t = this.engine.revealedTags(this.c);
    this.q('.dlg-tags').innerHTML = t.length ? `<span>알게 된 취향</span>${t.map((x) => `<i>${registry.tags[x] ?? x}</i>`).join('')}` : '';
  }

  // [★ 취향 완벽 저격! ★] 배너
  banner(on) {
    const b = this.q('.dlg-banner');
    b.classList.toggle('hidden', !on);
    this.el.querySelector('.dlg-card').classList.toggle('matched', !!on);
    if (on) {
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
    }
  }

  say(text, then, speed = 24) {
    text = clampLine(text); // v16: 28자 이내 1문장
    clearInterval(this.typer);
    const el = this.q('.dlg-text');
    el.textContent = '';
    this.full = text;
    this.then = then;
    this.q('.dlg-choices').innerHTML = '';
    let i = 0;
    this.typer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i % 3 === 0) this.sound.blip(i);
      if (i >= text.length) this.skip();
    }, speed);
  }

  skip() {
    if (!this.typer) return;
    clearInterval(this.typer);
    this.typer = null;
    this.q('.dlg-text').textContent = this.full;
    const t = this.then;
    this.then = null;
    t?.();
  }

  choices(list) {
    const box = this.q('.dlg-choices');
    box.innerHTML = '';
    for (const ch of list) {
      const b = document.createElement('button');
      b.className = 'dlg-btn' + (ch.primary ? ' primary' : '') + (ch.wide ? ' wide' : '');
      b.innerHTML = `${ch.icon ? icon(ch.icon) : ''}<span>${ch.label}</span>${ch.sub ? `<small>${ch.sub}</small>` : ''}`;
      if (ch.disabled) b.disabled = true;
      bindTap(b, () => {
        if (b.disabled) return;
        this.sound.tap();
        ch.onClick();
      });
      box.appendChild(b);
    }
  }

  main() {
    const t = this.c.talk;
    const list = [
      { label: '취향 깊이 묻기', icon: 'search', onClick: () => this.ask() },
      { label: '맞춤 메뉴 추천', icon: 'wand', onClick: () => this.menu() },
    ];
    if (t.recipe) {
      const r = registry.recipes.get(t.recipe);
      if (this.engine.optionsFor(r).length) list.push({ label: '스페셜 옵션 제안', icon: 'sparkle', onClick: () => this.optionsMenu() });
      list.push({ label: '주문 확정', icon: 'check', primary: true, wide: true, sub: `${r.name}${t.option ? ` · ${registry.options[t.option].name}` : ''}`, onClick: () => this.confirm() });
    } else list.push({ label: '그냥 주문 듣기', icon: 'receipt', onClick: () => this.selfOrder() });
    this.choices(list);
  }

  ask() {
    this.banner(false);
    const r = this.engine.askDeeper(this.c);
    this.tags();
    this.say(r.line, () => this.main());
  }

  // 9차: 메뉴를 한 줄로 쏟아내지 않고, 이탈리안 카테고리 탭 → 정갈한 그리드 카드
  menu() {
    this.q('.dlg-text').textContent = '어떤 메뉴를 추천할까요?';
    this.choices([{ label: '메뉴판 다시 펼치기', icon: 'book', onClick: () => this.openBoard() }, { label: '돌아가기', icon: 'undo', onClick: () => this.main() }]);
    this.openBoard();
  }

  openBoard() {
    const known = new Set(this.engine.revealedTags(this.c));
    const cats = CATEGORIES.map((c) => ({ ...c, list: this.available.filter((r) => r.station === c.id) }));
    const kb = this.board.querySelector('.mb16-known');
    kb.innerHTML = known.size ? `<span>${esc(this.c.persona.name)} 님 취향</span>${[...known].map((x) => `<i>#${esc(registry.tags[x] ?? x)}</i>`).join('')}` : '';
    const tabs = this.board.querySelector('.mb16-tabs');
    const list = this.board.querySelector('.mb16-list');
    tabs.innerHTML = cats
      .map((c) => `<button type="button" class="mb16-tab${c.list.length ? '' : ' soon'}" role="tab" data-cat="${c.id}" aria-label="${c.name}">${icon(c.ic)}<span>${c.short}</span></button>`)
      .join('');
    const show = (id) => {
      this.cat = id;
      for (const b of tabs.children) {
        const on = b.dataset.cat === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      const cat = cats.find((c) => c.id === id);
      list.textContent = '';
      if (!cat?.list.length) {
        list.innerHTML = `<p class="mb16-empty">이 코너는 ‘꾸미기 &amp; 설비 해금’에서 열 수 있어요</p>`;
        return;
      }
      for (const r of cat.list.slice(0, 4)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mb16-item';
        const hit = r.tags.some((x) => known.has(x));
        b.setAttribute('aria-label', `${r.name} ${r.price}원 주문`);
        b.innerHTML = `
          <span class="mb16-ic">${icon(r.icon)}</span>
          <span class="mb16-txt">
            <span class="mb16-row"><b>${esc(r.name)}</b>${hit ? '<i class="mb16-hit">취향</i>' : ''}<span class="mb16-price">₩${(r.price ?? 0).toLocaleString('ko-KR')}</span></span>
            <span class="mb16-desc">${esc(r.desc ?? r.it ?? '')}</span>
          </span>`;
        // 누르는 즉시: 메뉴판 · 대화창이 함께 닫히고 이 메뉴로 주문 확정
        this.press(b, () => {
          this.sound.tap();
          this.closeBoard();
          this.orderNow(r);
        });
        list.appendChild(b);
      }
    };
    for (const b of tabs.children)
      this.press(b, () => {
        this.sound.tap();
        show(b.dataset.cat);
      });
    const first = cats.find((c) => c.id === this.cat && c.list.length) ?? cats.find((c) => c.list.length);
    show(first?.id ?? 'espresso');
    this.board.classList.remove('hidden');
    document.body.classList.add('mb-open');
  }

  closeBoard() {
    if (this.board.classList.contains('hidden')) return;
    this.board.classList.add('hidden');
    document.body.classList.remove('mb-open');
    // 메뉴판을 닫은 '그 손가락'이 떼어질 때 생기는 click 한 번만 흡수한다.
    // 새 손가락이 닿으면(pointerdown) 흡수를 바로 해제 — 닫자마자 누른 다른 버튼은 절대 씹히지 않는다
    let armed = true;
    const off = () => {
      armed = false;
      window.removeEventListener('click', eat, true);
      window.removeEventListener('pointerdown', fresh, true);
    };
    const eat = (e) => {
      if (!armed) return;
      e.preventDefault();
      e.stopPropagation();
      off();
    };
    const fresh = () => off();
    window.addEventListener('click', eat, true);
    setTimeout(() => window.addEventListener('pointerdown', fresh, true), 0);
    setTimeout(off, 500);
  }

  // 추천 = 곧바로 주문 확정. 취향 적중이면 손님이 기뻐하는 연출(onMatch)과 함께, 대사는 손님 말풍선으로
  orderNow(r) {
    const res = this.engine.recommend(this.c, r, this.available);
    const t = this.c.talk;
    const cb = this.cb;
    const c = this.c;
    this.close(false);
    if (res.matched) cb.onMatch?.(r);
    cb.onOrder?.(r, t.option, { line: res.line, matched: res.matched, customer: c });
  }

  recommendRecipe(r) {
    const res = this.engine.recommend(this.c, r, this.available);
    this.banner(res.matched);
    if (res.matched) this.cb.onMatch?.(r);
    else this.cb.onBack?.();
    this.say(res.line, () => this.main(), res.matched ? 20 : 24);
  }

  selfOrder() {
    const res = this.engine.selfOrder(this.c, this.available);
    this.say(res.line, () => this.main());
  }

  optionsMenu() {
    const r = registry.recipes.get(this.c.talk.recipe);
    this.q('.dlg-text').textContent = `${r.name}에 어떤 디테일을 더할까요?`;
    this.choices([
      ...this.engine.optionsFor(r).map((o) => ({
        label: o.name,
        icon: o.icon,
        onClick: () => {
          const res = this.engine.suggestOption(this.c, o.id);
          this.say(res.line, () => this.main());
        },
      })),
      { label: '돌아가기', icon: 'undo', onClick: () => this.main() },
    ]);
  }

  confirm() {
    const t = this.c.talk;
    const r = registry.recipes.get(t.recipe);
    this.say('그럼 그걸로 부탁드려요. 천천히 해주세요.', () => {
      const cb = this.cb;
      this.close(false);
      cb.onOrder?.(r, t.option);
    });
  }

  close(cancelled) {
    this.closeBoard();
    clearInterval(this.typer);
    this.typer = null;
    this.el.classList.add('hidden');
    document.body.classList.remove('talking');
    if (cancelled) this.cb?.onClose?.();
  }
}
