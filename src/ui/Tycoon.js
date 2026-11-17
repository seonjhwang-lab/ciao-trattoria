// v21 타이쿤 확장 UI: 오늘의 특선 선택창 · 트라토리아 등급 & 업적 · 축하 카드(미식 매거진 헤드라인 / 승급) · 예고 배너
// 규칙: 이모지 없음(SVG 아이콘만) · 표준 click · 높이는 내용만큼(자르지 않음)
import { icon } from './icons.js';
import { bindTap } from './Tap.js';
import { setHidden } from './hiddenGuard.js';
import { CATEGORIES } from './DialogueUI.js';
import { RANKS, SPECIAL_BONUS } from '../core/Progress.js';

const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const man = (n) => `${Math.floor(n / 10000).toLocaleString('ko-KR')}만`;
// 짧은 금액 (업적 칸): 3,000 → 3천 원 · 15,000 → 1.5만 원
const short = (n) => (n >= 10000 ? `${+(n / 10000).toFixed(1)}만 원` : `${+(n / 1000).toFixed(1)}천 원`);
export const starRow = (n, max = 5) => `<span class="st5" aria-label="별 ${n}개">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">${icon('starFill')}</i>`).join('')}</span>`;

// ───────── 아침 오픈 전: 오늘의 특선 메뉴(Chef's Special) 고르기 ─────────
// 코너 탭(해금한 코너만) + 그 코너의 메뉴(최대 4개) → 하나를 고르고 [이 메뉴로 오픈하기]
export class SpecialPicker {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'spk hidden';
    el.innerHTML = `
      <div class="spk-card" role="dialog" aria-label="오늘의 특선 메뉴 고르기">
        <div class="spk-head"><span class="spk-ic">${icon('starFill')}</span><div><b>오늘의 특선</b><small></small></div></div>
        <p class="spk-vip hidden">${icon('vip')}<span>오늘 마지막 손님으로 미식 칼럼니스트가 방문합니다!</span></p>
        <p class="spk-sub">특선은 판매가 +${Math.round(SPECIAL_BONUS * 100)}% · 주문이 늘고 호감도가 더 올라요</p>
        <div class="spk-tabs" role="tablist"></div>
        <div class="spk-list"></div>
        <button type="button" class="ds-btn primary spk-ok">${icon('sunrise')}<span>이 메뉴로 오픈하기</span></button>
      </div>`;
    root.appendChild(el);
    this.el = el;
    bindTap(el.querySelector('.spk-ok'), () => this.confirm());
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  // recipes: 지금 팔 수 있는 메뉴, current: 미리 골라 둘 메뉴 id, basePrice(r) / specialPrice(r): 가격 표시
  show({ day, vip, recipes, current, basePrice, specialPrice }, { onPick, onTap }) {
    this.cb = { onPick, onTap };
    this.recipes = recipes;
    this.price = { basePrice, specialPrice };
    this.sel = recipes.find((r) => r.id === current)?.id ?? recipes[0]?.id ?? null;
    this.el.querySelector('.spk-head small').textContent = `Day ${day} · Piatto del Giorno`;
    this.el.querySelector('.spk-vip').classList.toggle('hidden', !vip);
    this.cats = CATEGORIES.map((c) => ({ ...c, list: recipes.filter((r) => r.station === c.id) })).filter((c) => c.list.length);
    this.cat = this.cats.find((c) => c.list.some((r) => r.id === this.sel))?.id ?? this.cats[0]?.id;
    this.render();
    setHidden(this.el, false);
    this.el.classList.remove('hidden');
  }

  render() {
    const tabs = this.el.querySelector('.spk-tabs');
    tabs.innerHTML = '';
    tabs.style.setProperty('--n', String(Math.max(1, this.cats.length)));
    for (const c of this.cats) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spk-tab' + (c.id === this.cat ? ' on' : '') + (c.list.some((r) => r.id === this.sel) ? ' has' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', c.name);
      b.innerHTML = `${icon(c.ic)}<span>${c.short}</span>`;
      bindTap(b, () => {
        this.cat = c.id;
        this.cb.onTap?.();
        this.render();
      });
      tabs.appendChild(b);
    }
    const list = this.el.querySelector('.spk-list');
    list.innerHTML = '';
    const cat = this.cats.find((c) => c.id === this.cat);
    for (const r of (cat?.list ?? []).slice(0, 4)) {
      const b = document.createElement('button');
      b.type = 'button';
      const on = r.id === this.sel;
      b.className = 'spk-item' + (on ? ' on' : '');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = `
        <span class="spk-mi">${icon(r.icon)}</span>
        <span class="spk-txt"><b>${r.name}</b><small>₩${this.price.basePrice(r).toLocaleString('ko-KR')} → <em>₩${this.price.specialPrice(r).toLocaleString('ko-KR')}</em></small></span>
        <i class="spk-badge">${on ? `${icon('starFill')}특선` : '고르기'}</i>`;
      bindTap(b, () => {
        this.sel = r.id;
        this.cb.onTap?.();
        this.render();
      });
      list.appendChild(b);
    }
    const ok = this.el.querySelector('.spk-ok');
    const pick = this.recipes.find((r) => r.id === this.sel);
    ok.querySelector('span').textContent = pick ? `${pick.name} · 오픈하기` : '오픈하기';
  }

  confirm() {
    if (!this.isOpen) return;
    this.el.classList.add('hidden');
    this.cb.onPick?.(this.sel);
  }
}

// ───────── 트라토리아 등급 & 업적 ─────────
export class RankUI {
  constructor(root, { progress, onClaim, onClose, onTap }) {
    Object.assign(this, { progress, onClaim, onClose, onTap });
    this.tab = 'rank';
    const el = document.createElement('div');
    el.className = 'rank hidden';
    el.innerHTML = `
      <div class="rank-card" role="dialog" aria-label="트라토리아 등급과 업적">
        <header class="cat-head">
          <div><b>트라토리아 등급 & 업적</b><small>Stelle e Traguardi</small></div>
          <button type="button" class="cat-x" aria-label="닫기">${icon('close')}</button>
        </header>
        <div class="rank-tabs" role="tablist">
          <button type="button" data-t="rank" role="tab">${icon('crown')}<span>등급</span></button>
          <button type="button" data-t="ach" role="tab">${icon('trophy')}<span>업적</span><i class="rk-n"></i></button>
        </div>
        <div class="rank-body"></div>
      </div>`;
    root.appendChild(el);
    this.el = el;
    bindTap(el.querySelector('.cat-x'), () => this.close());
    for (const b of el.querySelectorAll('.rank-tabs button'))
      bindTap(b, () => {
        this.tab = b.dataset.t;
        this.onTap?.();
        this.render();
      });
    el.addEventListener('click', (e) => e.target === el && this.close());
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(tab) {
    if (tab) this.tab = tab;
    else if (this.progress.unclaimed()) this.tab = 'ach';
    this.render();
    setHidden(this.el, false);
    this.el.classList.remove('hidden');
  }

  close() {
    this.el.classList.add('hidden');
    this.onClose?.();
  }

  render() {
    const P = this.progress;
    for (const b of this.el.querySelectorAll('.rank-tabs button')) {
      const on = b.dataset.t === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    const n = P.unclaimed();
    this.el.querySelector('.rk-n').textContent = n ? String(n) : '';
    const body = this.el.querySelector('.rank-body');
    body.innerHTML = '';
    if (this.tab === 'rank') {
      const r = P.rank();
      const pr = P.rankProgress();
      const box = document.createElement('div');
      box.className = 'rk-now';
      box.innerHTML = `
        <div class="rk-stars">${starRow(r.star)}</div>
        <b class="rk-name">${r.star}성 · ${r.name}</b>
        <div class="rk-bar big" role="progressbar" aria-valuenow="${Math.round(pr.total * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.round(pr.total * 100)}%"></i></div>
        <small class="rk-next">${pr.next ? `다음 등급 · ${pr.next.star}성 ${pr.next.name} · 승급 보상 ${won(pr.next.reward)}` : '최고 등급 그랜드 비스트로에 올랐어요'}</small>`;
      body.appendChild(box);
      const ul = document.createElement('ul');
      ul.className = 'rk-parts';
      for (const p of pr.parts) {
        const li = document.createElement('li');
        li.className = p.pct >= 1 ? 'ok' : '';
        li.innerHTML = `<span class="rk-pl">${p.pct >= 1 ? icon('check') : ''}${p.label}</span><span class="rk-pv">${p.text}</span><div class="rk-bar"><i style="width:${Math.round(p.pct * 100)}%"></i></div>`;
        ul.appendChild(li);
      }
      body.appendChild(ul);
      const ladder = document.createElement('ol');
      ladder.className = 'rk-ladder';
      ladder.innerHTML = RANKS.map((x) => `<li class="${x.star === r.star ? 'now' : x.star < r.star ? 'done' : ''}"><i>${x.star}</i><span>${x.name}</span></li>`).join('');
      body.appendChild(ladder);
    } else {
      const grid = document.createElement('div');
      grid.className = 'ach-grid';
      for (const a of P.achievements()) {
        const st = a.claimed ? 'done' : a.done ? 'claim' : 'todo';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ach s-${st}`;
        const prog = a.money ? `${man(Math.min(a.v, a.goal))} / ${man(a.goal)}` : `${Math.min(a.v, a.goal)} / ${a.goal}`;
        b.innerHTML = `<span class="ach-ic">${icon(a.claimed ? 'check' : a.icon)}</span><span class="ach-t"><b>${a.name}</b><small>${st === 'claim' ? `보상 받기 · ${short(a.reward)}` : st === 'done' ? `완료 · ${short(a.reward)}` : `${prog} · ${short(a.reward)}`}</small></span>`;
        b.setAttribute('aria-label', `${a.name} ${st === 'claim' ? '보상 받기' : st === 'done' ? '완료' : prog}`);
        if (st === 'claim') bindTap(b, () => this.onClaim?.(a.id));
        else b.setAttribute('aria-disabled', 'true');
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
  }
}

// ───────── 축하 카드: 미식 매거진 헤드라인 · 등급 승급 (여러 장이 겹치면 차례로) ─────────
export class CelebrationCard {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'letter cele hidden';
    el.innerHTML = `<div class="lt-card cele-card" role="dialog" aria-label="축하 카드"></div>`;
    root.appendChild(el);
    this.el = el;
    this.queue = [];
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  // kind: 'news' | 'rank'
  show(card) {
    this.queue.push(card);
    if (!this.isOpen) this.next();
  }

  next() {
    const c = this.queue.shift();
    if (!c) return;
    const card = this.el.querySelector('.cele-card');
    card.className = `lt-card cele-card k-${c.kind}`;
    card.innerHTML =
      c.kind === 'news'
        ? `
      <div class="nw-mast"><span>La Gazzetta del Gusto</span></div>
      <small class="nw-date">${c.date}</small>
      <h2 class="nw-title">${c.title}</h2>
      <p class="lt-text">${c.text}</p>
      <p class="lt-gift">${icon('sparkle')}<span>${c.gift}</span></p>
      <button type="button" class="ds-btn primary lt-ok">${icon('check')}<span>${c.button ?? '영광이에요!'}</span></button>`
        : `
      <div class="lt-seal gold">${icon('crown')}</div>
      <div class="rk-stars">${starRow(c.star)}</div>
      <h2>${c.title}</h2>
      <p class="lt-text">${c.text}</p>
      <p class="lt-gift">${icon('sparkle')}<span>${c.gift}</span></p>
      <button type="button" class="ds-btn primary lt-ok">${icon('check')}<span>${c.button ?? '좋아요!'}</span></button>`;
    bindTap(card.querySelector('.lt-ok'), () => {
      this.el.classList.add('hidden');
      c.onClose?.();
      if (this.queue.length) setTimeout(() => this.next(), 250);
    });
    setHidden(this.el, false);
    this.el.classList.remove('hidden');
    c.onShow?.();
  }
}

// ───────── 화면 위쪽 예고 배너 (미식가 방문 예고 · 오늘의 특선) ─────────
export class DayBanner {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'day-banner hidden';
    el.setAttribute('role', 'status');
    root.appendChild(el);
    this.el = el;
    this.timer = 0;
  }

  show(ic, text, ms = 5200) {
    clearTimeout(this.timer);
    this.el.innerHTML = `${icon(ic)}<span>${text}</span>`;
    setHidden(this.el, false);
    this.el.classList.remove('hidden');
    this.timer = setTimeout(() => this.el.classList.add('hidden'), ms);
  }
}
