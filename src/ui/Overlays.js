import { icon } from './icons.js';
import { portrait } from './DialogueUI.js';
import { setHidden } from './hiddenGuard.js';
import { clampLine } from './clampLine.js';
import { svgBanner, FONT } from './svgText.js';

// 인트로 타이틀 (IntroModal): 뒤에서는 카메라가 밝은 비스트로 카운터를 천천히 패닝한다
export class IntroModal {
  constructor(root, { hasSave, onContinue, onNew }) {
    const el = document.createElement('div');
    el.className = 'intro';
    el.innerHTML = `
      <div class="intro-glow"></div>
      <div class="intro-card">
        <svg class="intro-emblem" width="132" height="112" style="width:132px;height:112px;display:block;margin:0 auto" viewBox="0 0 132 112" aria-hidden="true">
          <defs><pattern id="brk" width="12" height="7" patternUnits="userSpaceOnUse"><rect width="12" height="7" fill="#b84a27"/><path d="M0 6.5h12M6 0v3.2M0 3.2h12M0 3.2v3.3M12 3.2v3.3" stroke="#f3dcc0" stroke-width="0.9"/></pattern></defs>
          <path d="M20 96 V58 a46 46 0 0 1 92 0 V96 Z" fill="url(#brk)" stroke="#2b1d14" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M44 96 V70 a22 22 0 0 1 44 0 V96 Z" fill="#2b1d14"/>
          <path d="M50 96 c3-10 7-8 9-16 c2 8 6 6 7 14 c2-9 6-10 6-18 c4 8 9 10 6 20 Z" fill="#f2a33a" stroke="#d9531f" stroke-width="1.2"/>
          <path d="M57 96 c2-6 4-5 6-10 c1 5 4 4 4 10 Z" fill="#ffe08a"/>
          <rect x="14" y="94" width="104" height="8" rx="2" fill="#e9dcc4" stroke="#2b1d14" stroke-width="2"/>
          <rect x="60" y="2" width="12" height="16" rx="2" fill="#b87333" stroke="#2b1d14" stroke-width="2"/>
          <g fill="#4a6338" stroke="#2b1d14" stroke-width="1.1">
            <path d="M6 104 C30 84 40 98 64 108" fill="none" stroke="#5a4428" stroke-width="2"/>
            <ellipse cx="18" cy="96" rx="7" ry="2.8" transform="rotate(-30 18 96)"/><ellipse cx="30" cy="92" rx="7" ry="2.8" transform="rotate(-10 30 92)"/>
            <ellipse cx="42" cy="96" rx="7" ry="2.8" transform="rotate(20 42 96)"/><ellipse cx="26" cy="102" rx="6" ry="2.4" transform="rotate(15 26 102)"/>
            <path d="M126 104 C102 84 92 98 68 108" fill="none" stroke="#5a4428" stroke-width="2"/>
            <ellipse cx="114" cy="96" rx="7" ry="2.8" transform="rotate(30 114 96)"/><ellipse cx="102" cy="92" rx="7" ry="2.8" transform="rotate(10 102 92)"/>
            <ellipse cx="90" cy="96" rx="7" ry="2.8" transform="rotate(-20 90 96)"/><ellipse cx="106" cy="102" rx="6" ry="2.4" transform="rotate(-15 106 102)"/>
          </g>
          <circle cx="36" cy="100" r="2.6" fill="#2f3a22"/><circle cx="96" cy="100" r="2.6" fill="#2f3a22"/>
        </svg>
        <div class="intro-ribbon"><span>Cucina Artigianale</span></div>
        <h1 class="intro-title" aria-label="Ciao, Trattoria!">${svgBanner([{ text: 'Ciao, Trattoria!', size: 44, family: FONT.title, italic: true, weight: 700, color: '#2b1d14' }], { pad: 2 })}</h1>
        <div class="intro-subt">${svgBanner(
          [
            { text: '차오, 트라토리아!', size: 18, family: FONT.head, color: '#b84a27' },
            { text: '손끝으로 빚는 작은 이탈리안 키친', size: 14, weight: 400, family: FONT.head, color: '#6e5a48' },
          ],
          { gap: 2 },
        )}</div>
        <div class="intro-btns">
          <button class="intro-btn primary" data-a="continue" ${hasSave ? '' : 'disabled'} aria-label="이어서 운영하기">${icon('play')}${svgBanner(
            [
              { text: '이어서 운영하기', size: 17, family: FONT.head, color: '#fbf6ec' },
              { text: hasSave ? '저장된 트라토리아로 돌아가요' : '저장된 데이터가 없어요', size: 11.5, weight: 500, family: FONT.body, color: '#e7dcc6' },
            ],
            { align: 'start', pad: 1, gap: 0 },
          )}</button>
          <button class="intro-btn" data-a="new" aria-label="새 트라토리아 시작하기">${icon('sparkle')}${svgBanner(
            [
              { text: '새 트라토리아 시작하기', size: 17, family: FONT.head, color: '#2b1d14' },
              { text: hasSave ? '저장 데이터를 지우고 처음부터' : '처음부터 시작해요', size: 11.5, weight: 500, family: FONT.body, color: '#6e5a48' },
            ],
            { align: 'start', pad: 1, gap: 0 },
          )}</button>
        </div>
        <div class="intro-foot">${svgBanner([{ text: 'Pasta Fresca · Pizza al Forno · Insalata · Caffè', size: 12, family: FONT.title, italic: true, weight: 600, color: '#4a6338' }], { pad: 2 })}</div>
      </div>`;
    root.appendChild(el);
    this.el = el;
    el.querySelector('[data-a="continue"]').addEventListener('click', () => onContinue());
    el.querySelector('[data-a="new"]').addEventListener('click', () => onNew());
  }

  get isOpen() {
    return !!this.el && !this.el.classList.contains('out');
  }

  close() {
    if (!this.el) return;
    this.el.classList.add('out');
    const el = this.el;
    setTimeout(() => el.remove(), 650);
  }
}

// 확인 팝업 (window.confirm 대신 — 샌드박스에서도 동작)
export class ConfirmModal {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'confirm hidden';
    el.innerHTML = `<div class="confirm-card"><b></b><p></p><div class="confirm-btns"><button class="wb-btn" data-a="no"></button><button class="wb-btn primary" data-a="yes"></button></div></div>`;
    root.appendChild(el);
    this.el = el;
    el.querySelector('[data-a="no"]').addEventListener('click', () => this.answer(false));
    el.querySelector('[data-a="yes"]').addEventListener('click', () => this.answer(true));
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  ask({ title, text, yes = '확인', no = '취소' }) {
    this.el.querySelector('b').textContent = title;
    this.el.querySelector('p').textContent = text;
    this.el.querySelector('[data-a="yes"]').innerHTML = `${icon('check')}<span>${yes}</span>`;
    this.el.querySelector('[data-a="no"]').innerHTML = `${icon('close')}<span>${no}</span>`;
    this.el.classList.remove('hidden');
    return new Promise((r) => (this.resolve = r));
  }

  answer(v) {
    this.el.classList.add('hidden');
    this.resolve?.(v);
    this.resolve = null;
  }
}

// 첫 입 미식 품평 카드: 손님 초상 · 등급 · 맛 표현 · 결제/팁
export class TastingCard {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'taste-card hidden';
    root.appendChild(el);
    this.el = el;
    this.timer = 0;
    // v15 Tap-to-Skip: 카드가 떠 있을 때 화면 어디든 누르면 바로 닫는다 (그 탭이 하려던 일은 그대로 진행)
    window.addEventListener('pointerdown', () => this.isOpen && this.hide(), { capture: true, passive: true });
  }

  get isOpen() {
    return this.el.classList.contains('in');
  }

  hide() {
    clearTimeout(this.timer);
    this.el.classList.remove('in');
  }

  show({ customer, recipe, grade, critique, review, pay, tip, matched }) {
    const p = customer.persona;
    const el = this.el;
    setHidden(el, false); // 트랜지션 전에 바로 보이게 (숨김 안전장치 해제)
    el.className = `taste-card g-${grade}`;
    el.innerHTML = `
      <div class="tc-head"><img alt="" width="40" height="40" src="${portrait(p)}"/><div><small>${p.name} 님의 첫 입 품평</small><b>${recipe.name}</b></div><i class="tc-g">${grade}</i></div>
      <p class="tc-quote">“${clampLine(critique)}”</p>
      <div class="tc-pay">${icon('coin')}<b>+${pay.toLocaleString()}원</b>${tip > 0 ? `<span class="tc-tip">${icon('sparkle')}넉넉한 팁 +${tip.toLocaleString()}원</span>` : ''}${matched ? `<span class="tc-tip heart">${icon('heart')}취향 저격</span>` : ''}</div>
      <div class="tc-sparkles">${Array.from({ length: grade === 'S' ? 14 : grade === 'A' ? 9 : 0 }, (_, i) => `<i style="--a:${(i * 360) / 14}deg;--d:${(i % 4) * 0.08}s">${icon(i % 3 ? 'sparkle' : 'heart')}</i>`).join('')}</div>`;
    void el.offsetWidth;
    clearTimeout(this.timer);
    // 카드를 띄운 그 탭(서빙 탭)으로 바로 닫히지 않게 한 프레임 뒤에 연다
    setTimeout(() => el.classList.add('in'), 60);
    this.timer = setTimeout(() => el.classList.remove('in'), grade === 'S' || grade === 'A' ? 5200 : 3600);
  }
}
