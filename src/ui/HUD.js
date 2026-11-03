import { bus } from '../core/EventBus.js';
import { ORDER_STATUS } from '../core/CafeAI.js';
import { icon } from './icons.js';
import { reactionsOn, setSetting } from '../core/Settings.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const MENU_IC = '<svg class="ic" width="18" height="18" style="width:var(--icw,18px);height:var(--ich,18px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

// 10차 HUD: 상단은 왼쪽 '보유 자금' 배지 + 오른쪽 '≡ 메뉴' 버튼 하나뿐.
// 메뉴 팝업 안에 단골 수첩 · 인테리어 편집 · 효과음 · 처음부터. 주문 티켓은 화면 아래쪽 한 줄.
// (시계 · 배속 · 카메라 회전 버튼 없음: 카메라는 정면 쿼터뷰 고정)
export class HUD {
  constructor(root, { state, ai, actions }) {
    this.state = state;
    this.ai = ai;
    this.actions = actions;

    const top = document.createElement('div');
    top.className = 'hud-top';
    top.innerHTML = `
      <div class="pill money">${icon('coin')}<b data-k="money"></b></div>
      <button type="button" class="hud-react" aria-label="손님 리액션 켜고 끄기">${icon('chat')}<span>리액션</span><b></b></button>
      <button type="button" class="hud-menu-btn" aria-label="메뉴 열기">${MENU_IC}<span>메뉴</span></button>`;
    root.appendChild(top);
    this.top = top;
    // v15: 리액션 OFF = 메뉴를 누르면 줌인 · 감탄 대사 없이 바로 주문, 서빙 뒤에도 품평 카드 없이 금액만
    const rb = top.querySelector('.hud-react');
    const paintReact = () => {
      const on = reactionsOn();
      rb.classList.toggle('off', !on);
      rb.querySelector('b').textContent = on ? 'ON' : 'OFF';
      rb.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    rb.addEventListener('click', () => {
      setSetting('reactions', !reactionsOn());
      paintReact();
      actions.onReactionsToggled?.(reactionsOn());
    });
    paintReact();

    const pop = document.createElement('div');
    pop.className = 'hud-menu hidden';
    pop.innerHTML = `
      <div class="hm-card" role="menu">
        <button data-m="book">${icon('book')}<span>단골 수첩</span><i class="hm-n"></i></button>
        <button data-m="build">${icon('hammer')}<span>꾸미기 & 설비 해금</span></button>
        <button data-m="sound">${icon('soundOn')}<span>효과음</span><small></small></button>
        <button data-m="restart">${icon('restart')}<span>처음부터 하기</span></button>
      </div>`;
    root.appendChild(pop);
    this.pop = pop;
    const close = () => pop.classList.add('hidden');
    top.querySelector('.hud-menu-btn').onclick = () => {
      this.refreshToggles();
      pop.classList.toggle('hidden');
    };
    pop.addEventListener('click', (e) => {
      if (e.target === pop) close();
    });
    const on = (k, f) =>
      (pop.querySelector(`[data-m="${k}"]`).onclick = () => {
        close();
        f();
      });
    on('book', () => actions.openBook());
    on('build', () => actions.openCatalog());
    on('sound', () => actions.toggleSound());
    on('restart', () => actions.askRestart());

    const tickets = document.createElement('div');
    tickets.className = 'tickets';
    root.appendChild(tickets);
    this.ticketBox = tickets;

    bus.on('state:money', () => this.refreshMoney(true));
    bus.on('state', (k) => ['mode', 'sound', 'book'].includes(k) && this.refreshToggles());
    bus.on('orders:changed', () => this.refreshTickets());
    this.refreshMoney(false);
    this.refreshToggles();
    this.refreshTickets();
  }

  refreshMoney(bump) {
    this.top.querySelector('[data-k="money"]').textContent = `${fmt(this.state.money)}원`;
    if (bump) {
      const p = this.top.querySelector('.money');
      p.classList.remove('bump');
      void p.offsetWidth;
      p.classList.add('bump');
    }
  }

  refreshToggles() {
    const s = this.state;
    const b = this.pop.querySelector('[data-m="build"]');
    const n = Object.keys(s.book ?? {}).length;
    this.pop.querySelector('.hm-n').textContent = n ? String(n) : '';
    const snd = this.pop.querySelector('[data-m="sound"]');
    snd.classList.toggle('on', s.sound);
    snd.querySelector('.ic').outerHTML = icon(s.sound ? 'soundOn' : 'soundOff');
    snd.querySelector('small').textContent = s.sound ? 'ON' : 'OFF';
    this.ticketBox.classList.toggle('hidden', s.mode === 'build');
  }

  refreshTickets() {
    const box = this.ticketBox;
    const orders = this.ai.orders;
    const waiting = this.ai.customers.filter((c) => c.state === 'awaitTalk').length;
    box.innerHTML = '';
    if (!orders.length) {
      box.innerHTML = `<div class="ticket empty">${waiting ? `손님 ${waiting}명이 기다려요 · 손님을 탭` : '손님을 탭해 주문을 받아요'}</div>`;
      return;
    }
    for (const o of orders) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'ticket' + (o.status === 'ready' ? ' ready' : '') + (this.ai.chef.carry?.order === o ? ' serve-target' : '');
      // 주문 티켓 탭: 들고 있는 요리면 그 손님에게 서빙, 조리 전이면 조리대로
      d.addEventListener('click', () => this.actions.tapOrder?.(o));
      d.innerHTML = `<span class="emo">${icon(o.recipe.icon)}</span><span class="nm">${o.recipe.name}</span><small>${o.customer.persona.name} · ${ORDER_STATUS[o.status] ?? ''}</small>`;
      box.appendChild(d);
    }
  }
}

export function mountToast(root) {
  const box = document.createElement('div');
  box.className = 'toast-box';
  root.appendChild(box);
  let last = '';
  let lastAt = 0;
  bus.on('toast', (msg) => {
    const now = performance.now();
    if (msg === last && now - lastAt < 1200) return;
    last = msg;
    lastAt = now;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), 2800);
  });
}
