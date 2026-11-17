import * as THREE from 'three';

// v21 서빙된 요리 위의 은은한 김(따뜻한 요리) + S등급 금빛 별 입자.
// 매장은 멀리서 내려다보는 아이소 화면이라 실제 김보다 크게 과장해서 그린다.
// 스프라이트를 미리 정해진 수만큼만 만들어 두고 돌려 쓴다 (풀) → 손님이 몇 명 다녀가도 GPU 자원이 늘지 않는다.
// 접시(dish)를 등록해 두면 쟁반 위든 테이블 위든 그 월드 위치를 따라가고, 접시가 씬에서 빠지면 저절로 멈춘다.
const STEAM_N = 26;
const STAR_N = 18;
let texSteam = null;
let texStar = null;

function steamTex() {
  if (texSteam) return texSteam;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.32)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  texSteam = new THREE.CanvasTexture(c);
  texSteam.userData = { shared: true };
  return texSteam;
}

function starTex() {
  if (texStar) return texStar;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.fillStyle = '#ffd866';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 11 : 29;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#fff6cf';
  g.beginPath();
  g.arc(0, 0, 7, 0, Math.PI * 2);
  g.fill();
  texStar = new THREE.CanvasTexture(c);
  texStar.encoding = THREE.sRGBEncoding;
  texStar.userData = { shared: true };
  return texStar;
}

export class DishFx {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = 'dish-fx';
    parent.add(this.group);
    this.emitters = [];
    this.free = { steam: [], star: [] };
    this.live = [];
    this.tmp = new THREE.Vector3();
    this.box = new THREE.Box3();
    const make = (kind, n) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.SpriteMaterial({ map: kind === 'steam' ? steamTex() : starTex(), transparent: true, depthWrite: false, opacity: 0, blending: kind === 'star' ? THREE.AdditiveBlending : THREE.NormalBlending });
        m.userData.shared = true; // 풀 재질 — 접시를 치울 때 해제하지 않는다
        const s = new THREE.Sprite(m);
        s.visible = false;
        s.renderOrder = 12;
        s.userData.kind = kind;
        this.group.add(s);
        this.free[kind].push(s);
      }
    };
    make('steam', STEAM_N);
    make('star', STAR_N);
  }

  // hot = 김, gold = 금빛 별
  attach(dish, { hot = false, gold = false } = {}) {
    if (!dish || (!hot && !gold)) return;
    dish.updateWorldMatrix(true, true);
    this.box.setFromObject(dish);
    const h = Math.max(0.03, Math.min(0.14, this.box.max.y - this.box.min.y));
    const r = Math.max(0.04, Math.min(0.13, (this.box.max.x - this.box.min.x) / 2));
    this.emitters.push({ dish, hot, gold, h, r, st: Math.random() * 0.3, gt: Math.random() * 0.2 });
  }

  spawn(kind, e) {
    const s = this.free[kind].pop();
    if (!s) return;
    e.dish.getWorldPosition(this.tmp);
    const sc = e.dish.scale.x || 1;
    if (kind === 'steam') {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * e.r * 0.45 * sc;
      s.position.set(this.tmp.x + Math.cos(a) * rr, this.tmp.y + e.h * sc * 0.9, this.tmp.z + Math.sin(a) * rr);
      this.live.push({ s, kind, t: 0, life: 1.5 + Math.random() * 0.5, s0: 0.11, grow: 1.7, rise: 0.2 + Math.random() * 0.06, sway: Math.random() * 6, peak: 0.46 });
    } else {
      const a = Math.random() * Math.PI * 2;
      const rr = (0.6 + Math.random() * 1.3) * e.r * sc;
      s.position.set(this.tmp.x + Math.cos(a) * rr, this.tmp.y + e.h * sc * (0.6 + Math.random() * 2.2), this.tmp.z + Math.sin(a) * rr);
      this.live.push({ s, kind, t: 0, life: 0.75 + Math.random() * 0.4, s0: 0.075 + Math.random() * 0.045, grow: 0.5, rise: 0.12, sway: 0, peak: 0.95, spin: (Math.random() - 0.5) * 3 });
    }
    s.visible = true;
    s.material.opacity = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      // 접시를 치웠으면(씬에서 빠짐) 그만
      let root = e.dish;
      while (root.parent) root = root.parent;
      if (!root.isScene) {
        this.emitters.splice(i, 1);
        continue;
      }
      if (e.hot) {
        e.st -= dt;
        if (e.st <= 0) {
          e.st = 0.34;
          this.spawn('steam', e);
        }
      }
      if (e.gold) {
        e.gt -= dt;
        if (e.gt <= 0) {
          e.gt = 0.3;
          this.spawn('star', e);
        }
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt;
      const u = Math.min(1, p.t / p.life);
      p.s.material.opacity = p.peak * Math.sin(u * Math.PI);
      p.s.scale.setScalar(p.s0 * (1 + p.grow * u));
      p.s.position.y += p.rise * dt;
      if (p.sway) p.s.position.x += Math.sin(p.t * 2.6 + p.sway) * 0.012 * dt;
      if (p.spin) p.s.material.rotation += p.spin * dt;
      if (u >= 1) {
        p.s.visible = false;
        this.free[p.kind].push(p.s);
        this.live.splice(i, 1);
      }
    }
  }
}
