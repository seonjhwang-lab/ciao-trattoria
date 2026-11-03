import * as THREE from 'three';
import { kit } from './Kit.js';
import { GRID_W, GRID_D } from './GridSystem.js';

// 스튜디오 디오라마: 밝은 원목 베벨 받침 위에 매장이 떠 있고, 배경은 심즈4 건축 모드 같은 웜 크림 스튜디오 톤
export function studioBackground() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 210, 30, 256, 256, 420);
  grad.addColorStop(0, '#f2ebe2');
  grad.addColorStop(0.5, '#e8dfd5');
  grad.addColorStop(1, '#d8cbb8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // 아주 옅은 필름 그레인
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(150,120,90,${Math.random() * 0.02})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

export function buildDiorama(scene) {
  const k = kit;
  const g = new THREE.Group();
  const W = GRID_W + 1.4;
  const D = GRID_D + 1.4; // v14: 현관 마당 없음 — 매장 바로 둘레만
  const cz = 0;
  // 두툼한 월넛 받침 + 아래 단
  g.add(k.at(k.rbox(W, 0.55, D, k.wood('oak', { rough: 0.5 }), { r: 0.1, seg: 3 }), 0, -0.36, cz));
  g.add(k.at(k.rbox(W - 0.3, 0.16, D - 0.3, k.mat('#cdbba3', { rough: 0.7 }), { r: 0.06 }), 0, -0.7, cz));
  // 윗면 테두리 황동 인레이
  for (const [w, d, x, z] of [
    [W - 0.18, 0.025, 0, cz - D / 2 + 0.09],
    [W - 0.18, 0.025, 0, cz + D / 2 - 0.09],
    [0.025, D - 0.18, -W / 2 + 0.09, cz],
    [0.025, D - 0.18, W / 2 - 0.09, cz],
  ])
    g.add(k.at(k.box(w, 0.006, d, k.metal('brass')), x, -0.083, z));
  // 앞면 황동 명판
  g.add(k.at(k.box(1.6, 0.18, 0.02, k.metal('brass')), 0, -0.36, cz + D / 2 + 0.005));
  const plate = k.label(['CIAO, TRATTORIA! · STAGIONE 1'], 1.5, 0.14, { bg: '#b39058', fg: '#2b1d14', font: 'Playfair Display' });
  g.add(k.at(plate, 0, -0.36, cz + D / 2 + 0.017));
  g.traverse((o) => {
    if (o.isMesh) {
      o.receiveShadow = true;
      o.castShadow = o.position.y > -0.1;
    }
  });
  scene.add(g);
  return { group: g };
}
