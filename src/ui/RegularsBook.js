import { registry } from '../core/PackRegistry.js';
import { portrait } from './DialogueUI.js';
import { icon } from './icons.js';
import { Progress, LEVEL_NAME } from '../core/Progress.js';

// 단골 손님 수첩: S등급 대접을 받은 손님의 초상화·직업·최애 메뉴·알아낸 취향을 기록한다
export class RegularsBook {
  constructor(root, { state, onClose }) {
    this.state = state;
    this.onClose = onClose;
    const el = document.createElement('div');
    el.className = 'book hidden';
    el.innerHTML = `
      <div class="book-card" role="dialog" aria-label="단골 손님 수첩">
        <header>
          <span class="book-ic">${icon('book')}</span>
          <div><b>단골 손님 수첩</b><small></small></div>
          <button class="icon-btn" data-a="close" aria-label="닫기">${icon('close')}</button>
        </header>
        <div class="book-list"></div>
      </div>`;
    root.appendChild(el);
    this.el = el;
    el.querySelector('[data-a="close"]').onclick = () => this.close();
    el.addEventListener('click', (e) => e.target === el && this.close());
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    const list = Object.values(this.state.book ?? {}).sort((a, b) => b.sCount - a.sCount || b.visits - a.visits);
    this.el.querySelector('header small').textContent = list.length ? `단골 ${list.length}명 · 다시 오면 먼저 알아보고 인사해요` : '아직 비어 있어요';
    const box = this.el.querySelector('.book-list');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = `<p class="book-empty">S·A등급으로 대접할 때마다 호감도 하트가 차올라요.<br/>Lv.3 소울 푸드 단골이 되면 감사 선물을 받아요.</p>`;
    }
    for (const b of list) {
      const fav = registry.recipes.get(b.fav);
      const tags = (b.tags ?? []).map((t) => `<span class="tag">${registry.tags[t] ?? t}</span>`).join('');
      const opt = b.option ? `<span class="tag opt">${registry.options[b.option]?.name ?? b.option}</span>` : '';
      const row = document.createElement('article');
      row.className = 'book-row';
      row.innerHTML = `
        <img alt="" width="48" height="48" src="${portrait(b)}"/>
        <div class="book-info">
          <div class="book-name"><b>${b.name}</b><small>${b.job ?? '손님'}</small></div>
          <div class="book-fav">${icon(fav?.icon ?? 'plate')}<span>최애 ${fav?.name ?? '-'}</span></div>
          <div class="book-tags">${tags}${opt}</div>
        </div>
        <div class="book-stat"><b class="lv">Lv.${Math.max(1, Progress.level(b.aff ?? 1))}</b><small>${LEVEL_NAME[Math.max(1, Progress.level(b.aff ?? 1))]}</small><em class="hearts">${Array.from({ length: 5 }, (_, i) => `<i class="hrt ${i < (b.aff ?? 1) ? 'on' : ''}">${icon('heart')}</i>`).join('')}</em></div>`;
      box.appendChild(row);
    }
    this.el.classList.remove('hidden');
    document.body.classList.add('booking');
  }

  close() {
    this.el.classList.add('hidden');
    document.body.classList.remove('booking');
    this.onClose?.();
  }
}
