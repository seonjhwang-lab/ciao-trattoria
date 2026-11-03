import * as THREE from 'three';
import { icon } from '../ui/icons.js';

// 하트·코인·음표·땀방울·골드 파티클·뿅 링 (실시간 기준)
export class Effects {
  constructor(scene, labels) {
    this.scene = scene;
    this.labels = labels;
    this.items = [];
    this.ringGeo = new THREE.RingGeometry(0.34, 0.46, 40);
  }

  float(pos, html, cls, { life = 1.8, delay = 0, dx = 0, dy = 0 } = {}) {
    const el = document.createElement('div');
    el.className = 'fx ' + cls;
    el.style.animationDelay = `${delay}s`;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.innerHTML = html;
    const lab = this.labels.add(el, { pos });
    this.items.push({ kind: 'label', lab, t: 0, life: life + delay });
  }

  hearts(pos, n = 3) {
    for (let i = 0; i < n; i++) this.float(pos, icon('heart'), 'fx-rise fx-heart', { delay: i * 0.16, dx: (Math.random() - 0.5) * 50 });
  }

  notes(pos) {
    for (let i = 0; i < 3; i++) this.float(pos, icon('note'), 'fx-rise fx-note', { delay: i * 0.22, dx: (i - 1) * 24 });
  }

  sweat(pos) {
    this.float(pos, icon('drop'), 'fx-drip fx-sweat', { life: 1.6, dx: 22 });
  }

  goldBurst(pos) {
    const glyphs = ['sparkle', 'star', 'heart', 'sparkle'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 60 + Math.random() * 50;
      this.float(pos, icon(glyphs[i % glyphs.length]), 'fx-burst fx-gold', { life: 1.4, delay: Math.random() * 0.15, dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8 - 20 });
    }
    this.hearts(pos, 4);
  }

  coin(pos, amount, extra = '') {
    this.float(pos, `${icon('coin')}<span>+${Math.round(amount).toLocaleString()}원</span>${extra ? `<small>${extra}</small>` : ''}`, 'fx-coin', { life: 2.4, delay: 0.3 });
  }

  poof(pos, size = 1) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff1dc, transparent: true, opacity: 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos).setY(0.03);
    this.scene.add(m);
    this.items.push({ kind: 'ring', o: m, t: 0, life: 0.5, size });
    this.float(pos.clone().setY(1), icon('sparkle'), 'fx-pop fx-gold', { life: 0.9 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.kind === 'ring') {
        const u = Math.min(1, it.t / it.life);
        const s = (0.6 + u * 1.5) * it.size;
        it.o.scale.set(s, s, s);
        it.o.material.opacity = 0.85 * (1 - u);
      }
      if (it.t >= it.life) {
        this.items.splice(i, 1);
        if (it.kind === 'label') it.lab.remove();
        else {
          this.scene.remove(it.o);
          it.o.material.dispose();
        }
      }
    }
  }
}
