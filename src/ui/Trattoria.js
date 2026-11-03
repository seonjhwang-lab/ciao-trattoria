import { icon } from './icons.js';
import { bindTap } from './Tap.js';
import { STAGES, CATALOG, GUESTS_PER_DAY } from '../core/Progress.js';
import { setHidden } from './hiddenGuard.js';

const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const stars = (c) => {
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<i class="st ${c >= i ? 'on' : c >= i - 0.5 ? 'half' : ''}">★</i>`;
  return out;
};

// ───────── 트라토리아 꾸미기 & 설비 해금 카탈로그 (원터치 적용) ─────────
export class CatalogUI {
  constructor(root, { state, progress, onBuy, onClose }) {
    Object.assign(this, { state, progress, onBuy, onClose });
    const el = document.createElement('div');
    el.className = 'cat hidden';
    el.innerHTML = `
      <div class="cat-card" role="dialog" aria-label="트라토리아 꾸미기와 설비 해금">
        <header class="cat-head">
          <div><b>트라토리아 꾸미기</b><small>설비 해금 · 인테리어</small></div>
          <button class="cat-x" aria-label="닫기">${icon('close')}</button>
        </header>
        <div class="cat-sum"></div>
        <div class="cat-body"></div>
      </div>`;
    root.appendChild(el);
    this.el = el;
    bindTap(el.querySelector('.cat-x'), () => this.close());
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
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
    const money = this.state.money;
    this.el.querySelector('.cat-sum').innerHTML = `
      <div class="cs-money">${icon('coin')}<b>${won(money)}</b></div>
      <div class="cs-cozy"><span>아늑함 지수</span><span class="stars">${stars(P.cozy())}</span><em>팁 +${P.tipBonus()}%</em></div>`;
    const body = this.el.querySelector('.cat-body');
    body.innerHTML = '';
    const section = (title, sub) => {
      const s = document.createElement('section');
      s.className = 'cat-sec';
      s.innerHTML = `<h3>${title}<small>${sub}</small></h3><div class="cat-grid"></div>`;
      body.appendChild(s);
      return s.querySelector('.cat-grid');
    };
    // 1) 설비 해금
    const g1 = section('주방 설비 해금', '해금하면 마스터 조리대에 장비가 생기고 새 메뉴가 열려요');
    for (const st of STAGES) {
      const owned = P.unlocked(st.id);
      const prevOk = st.stage <= 2 || P.unlocked(STAGES[st.stage - 2].id);
      const card = this.card({
        ic: icon(st.icon),
        title: `Stage ${st.stage} · ${st.name}`,
        desc: st.desc,
        price: st.price,
        state: owned ? 'owned' : !prevOk ? 'lock' : money >= st.price ? 'buy' : 'short',
        lockText: '이전 단계를 먼저 해금해요',
      });
      if (!owned && prevOk) bindTap(card, () => this.onBuy({ kind: 'unlock', id: st.id }));
      g1.appendChild(card);
    }
    // 2) 인테리어
    const groups = [
      ['wall', '벽지 & 몰딩 테마', '원터치로 바로 바뀌어요'],
      ['floor', '바닥재 테마', ''],
      ['tableSet', '테이블 & 체어 세트', '모든 손님 자리가 함께 바뀌어요'],
      ['extra', '매장 확장', '손님이 앉을 자리가 늘어나요'],
      ['props', '감성 소품', ''],
    ];
    for (const [kind, title, sub] of groups) {
      const g = section(title, sub);
      for (const it of CATALOG[kind]) {
        const owned = P.owns(kind, it.id);
        const selected = P.p.sel[kind] === it.id;
        const card = this.card({
          sw: it.sw,
          title: it.name,
          desc: it.cozy ? `아늑함 +${it.cozy}★` : '기본',
          price: it.price,
          state: selected ? 'on' : owned ? (kind === 'extra' || kind === 'props' ? 'owned' : 'apply') : money >= it.price ? 'buy' : 'short',
        });
        if (!(owned && (kind === 'extra' || kind === 'props')) && !selected) bindTap(card, () => this.onBuy({ kind, id: it.id }));
        g.appendChild(card);
      }
    }
  }

  card({ ic = '', sw = null, title, desc, price, state, lockText = '' }) {
    const c = document.createElement('button');
    c.className = `cat-item s-${state}`;
    const chip = sw ? `<span class="ci-sw" style="background:linear-gradient(135deg, ${sw[0]} 50%, ${sw[1]} 50%)"></span>` : `<span class="ci-ic">${ic}</span>`;
    const tag = { owned: '보유 중', on: '적용 중', apply: '적용하기', buy: won(price), short: `${won(price)} · 부족`, lock: '잠김' }[state] ?? '';
    c.innerHTML = `${chip}<span class="ci-txt"><b>${title}</b><small>${state === 'lock' ? lockText : desc}</small></span><em class="ci-tag">${price === 0 && state === 'buy' ? '무료' : tag}</em>`;
    if (state === 'short' || state === 'lock') c.setAttribute('aria-disabled', 'true');
    return c;
  }
}

// ───────── Day N 영업 마감 정산서 ─────────
export class DaySummary {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'daysum hidden';
    el.innerHTML = `<div class="ds-card" role="dialog" aria-label="영업 마감 정산서"></div>`;
    root.appendChild(el);
    this.el = el;
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  show({ day, stats, money, cozy, tipBonus }, { onNext, onUpgrade }) {
    const card = this.el.querySelector('.ds-card');
    const regs = stats.newRegulars.length ? stats.newRegulars.join(', ') : '없음';
    const ups = stats.levelUps.length ? stats.levelUps.join(', ') : '';
    card.innerHTML = `
      <div class="ds-ribbon"><span>Chiusura</span></div>
      <h2>Day ${day} 영업 마감 정산서</h2>
      <p class="ds-sub">오늘도 따뜻한 한 끼를 대접했어요</p>
      <ul class="ds-list">
        <li><span>방문 손님</span><b>${stats.guests} / ${GUESTS_PER_DAY}명</b></li>
        <li><span>S등급 요리</span><b>${stats.S}접시${stats.A ? ` · A ${stats.A}` : ''}</b></li>
        <li><span>매출</span><b>${won(stats.sales)}</b></li>
        <li><span>팁</span><b>${won(stats.tips)}</b></li>
        <li class="total"><span>오늘 번 돈</span><b>${won(stats.sales + stats.tips)}</b></li>
        <li><span>새 단골</span><b>${regs}</b></li>
        ${ups ? `<li><span>호감도 상승</span><b>${ups}</b></li>` : ''}
        <li><span>아늑함 지수</span><b>${'★'.repeat(Math.floor(cozy))}${cozy % 1 ? '☆' : ''} · 팁 +${tipBonus}%</b></li>
      </ul>
      <p class="ds-money">${icon('coin')}보유 자금 <b>${won(money)}</b></p>
      <div class="ds-btns">
        <button class="ds-btn up">${icon('hammer')}<span>번 돈으로 트라토리아 업그레이드</span></button>
        <button class="ds-btn next primary">${icon('sunrise')}<span>다음 날 오픈하기</span></button>
      </div>`;
    bindTap(card.querySelector('.up'), () => onUpgrade());
    bindTap(card.querySelector('.next'), () => {
      this.hide();
      onNext();
    });
    setHidden(this.el, false);
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }
}

// ───────── 단골 Lv.3 감사 편지 ─────────
export class LetterModal {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'letter hidden';
    el.innerHTML = `<div class="lt-card" role="dialog" aria-label="단골 손님의 편지"></div>`;
    root.appendChild(el);
    this.el = el;
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  show({ name, text, gift }, onClose) {
    const card = this.el.querySelector('.lt-card');
    card.innerHTML = `
      <div class="lt-seal">${icon('heart')}</div>
      <h2>${name} 님의 편지</h2>
      <p class="lt-text">${text}</p>
      <p class="lt-gift">${icon('sparkle')}<span>${gift}</span></p>
      <button class="ds-btn primary lt-ok">${icon('check')}<span>고마워요!</span></button>`;
    bindTap(card.querySelector('.lt-ok'), () => {
      this.el.classList.add('hidden');
      onClose?.();
    });
    setHidden(this.el, false);
    this.el.classList.remove('hidden');
  }
}
