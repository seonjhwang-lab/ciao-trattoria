import * as THREE from 'three';
import { kit } from './Kit.js';
import { finishTexture } from './Textures.js';
import { GRID_W, GRID_D } from './GridSystem.js';

export const WALL_H = 2.8;
const T = 0.22;
const LOW = 0.34;
const INSET = 0.04; // 창틀은 벽 안쪽 면에서 4cm 들여서 (같은 평면 겹침 방지)

// 박스 UV 를 월드 미터 단위로 다시 계산 — 벽 조각이 나뉘어도 벽돌 무늬가 이어진다
function worldUV(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (nz > 0.5) uv.setXY(i, x, y);
    else if (nx > 0.5) uv.setXY(i, z, y);
    else uv.setXY(i, x, z);
  }
  uv.needsUpdate = true;
}

// 창가 바닥에 드리우는 햇살 (위로 갈수록 옅어지는 그라데이션)
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,222,170,0.95)');
  grad.addColorStop(1, 'rgba(255,222,170,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  // 블라인드 사이로 들어오는 줄무늬
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < 256; y += 22) {
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, y, 64, 7);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// 심즈식 벽: 카메라 쪽 벽은 자동으로 낮아진다(Cutaway).
// 디오라마 위에 떠 있으므로 벽을 땅속으로 내리지 않고 높이를 줄이며, 텍스처 반복을 보정해 벽돌이 찌그러지지 않는다.
export class WallCutaway {
  constructor(scene) {
    this.scene = scene;
    this.lamps = [];
    this.beams = [];
    // 바깥면: 크림색 페인트 벽돌 (컷어웨이로 낮아진 앞벽이 화사하게 보이도록)
    this.brick = finishTexture({ pattern: 'brick', colors: ['#efe7da', '#e9e0d1', '#f4ede3', '#e4dacb'], mortar: '#d6cab8' });
    this.capMat = kit.mat('#f1e9dc', { rough: 0.7 });
    // 간유리: 같은 깊이에서 깜빡이지 않도록 polygonOffset
    this.frosted = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#f4e7d0').convertSRGBToLinear(), roughness: 0.55, transparent: true, opacity: 0.62, transmission: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    this.frosted.emissive = new THREE.Color('#ffd9a0').convertSRGBToLinear();
    this.frosted.emissiveIntensity = 0.3;
    this.beamTex = beamTexture();
    this.walls = [];
    this.finishSpec = null;

    const L = GRID_W + T * 2;
    const half = GRID_W / 2 + T / 2; // 동 · 서 벽 x
    const halfZ = GRID_D / 2 + T / 2; // 남 · 북 벽 z (v14: 세로가 더 길다)
    this.addWall('north', L, [], new THREE.Vector3(0, 0, -halfZ), 0, new THREE.Vector3(0, 0, -1), (g, h, w) => this.northProps(g, w));
    // 남쪽(정면) 벽 — 로컬 x = -월드 x. 문은 월드 x 0~1
    this.addWall(
      'south',
      L,
      [
        { a: -3.1, b: -0.9, bottom: 0.5, top: 2.35, kind: 'window' },
        { a: 0.9, b: 3.1, bottom: 0.5, top: 2.35, kind: 'window' },
      ],
      new THREE.Vector3(0, 0, halfZ),
      Math.PI,
      new THREE.Vector3(0, 0, 1),
      (g, h, w) => this.southProps(g, h, w),
    );
    this.addWall(
      'east',
      GRID_D,
      [
        { a: -1.3, b: 1.3, bottom: 0.75, top: 2.3, kind: 'window' },
      ],
      new THREE.Vector3(half, 0, 0),
      -Math.PI / 2,
      new THREE.Vector3(1, 0, 0),
      (g, h, w) => this.sconce(g, w, 2.1, 1.95),
    );
    this.addWall(
      'west',
      GRID_D,
      [
        { a: -3.0, b: -2.0, bottom: 0, top: 2.3, kind: 'door' },
        { a: -1.5, b: 0.3, bottom: 0.75, top: 2.3, kind: 'window' },
      ],
      new THREE.Vector3(-half, 0, 0),
      Math.PI / 2,
      new THREE.Vector3(-1, 0, 0),
      (g, h, w) => this.westProps(g, w),
    );
  }

  addWall(name, L, openings, position, rotY, normal, props) {
    const group = new THREE.Group();
    // 벽마다 재질/텍스처 복제본 (낮아질 때 벽마다 반복값을 따로 보정)
    const ext = new THREE.MeshStandardMaterial({ map: this.brick.clone(), roughness: 0.9 });
    ext.map.needsUpdate = true;
    ext.envMapIntensity = 0.25;
    const inner = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    inner.envMapIntensity = 0.3;
    const mats = [ext, ext, this.capMat, ext, inner, ext];
    const seg = (x0, x1, y0, y1) => {
      if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, T);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
      worldUV(g);
      const m = new THREE.Mesh(g, mats);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.seg = true;
      group.add(m);
    };
    let cursor = -L / 2;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) {
      seg(cursor, o.a, 0, WALL_H);
      seg(o.a, o.b, 0, o.bottom);
      seg(o.a, o.b, o.top, WALL_H);
      this.frame(group, o);
      cursor = o.b;
    }
    seg(cursor, L / 2, 0, WALL_H);
    const base = kit.box(L - 0.02, 0.12, 0.02, kit.mat('#f6f1e8', { rough: 0.5 }));
    base.position.set(0, 0.05, T / 2 + 0.011);
    base.userData.seg = true;
    group.add(base);

    const holder = new THREE.Group();
    holder.position.copy(position);
    holder.rotation.y = rotY;
    holder.add(group);
    this.scene.add(holder);
    const wall = { name, group, holder, normal, center: position.clone(), h: WALL_H, ext, inner, scale: 1 };
    this.walls.push(wall);
    // 창 아래 바닥 햇살 (벽 안쪽 = 로컬 +z)
    for (const o of openings) {
      if (o.kind !== 'window') continue;
      const w = o.b - o.a;
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.92, 2.1),
        new THREE.MeshBasicMaterial({ map: this.beamTex, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }),
      );
      beam.rotation.x = -Math.PI / 2;
      beam.position.set((o.a + o.b) / 2, 0.012, T / 2 + 1.05);
      beam.renderOrder = 2;
      holder.add(beam);
      this.beams.push(beam);
    }
    props?.(group, holder, wall);
  }

  // 창틀은 개구부 안쪽에만, 벽 안쪽 면에서 INSET 만큼 들여서 놓는다 (벽 단면과 같은 평면을 공유하지 않음)
  frame(group, o) {
    const k = kit;
    const oak = k.wood('oak');
    const w = o.b - o.a;
    const h = o.top - o.bottom;
    const cx = (o.a + o.b) / 2;
    const zc = T / 2 - INSET - 0.04; // 틀 중심 (깊이 8cm → 안쪽 면은 벽면에서 4cm 안)
    const bar = 0.05;
    const gap = 0.004;
    const y0 = o.bottom + (o.kind === 'window' ? 0.035 : 0);
    group.add(k.at(k.box(w - gap * 2, bar, 0.08, oak), cx, o.top - gap - bar / 2, zc));
    group.add(k.at(k.box(bar, o.top - y0 - gap - bar, 0.08, oak), o.a + gap + bar / 2, (y0 + o.top - gap - bar) / 2, zc));
    group.add(k.at(k.box(bar, o.top - y0 - gap - bar, 0.08, oak), o.b - gap - bar / 2, (y0 + o.top - gap - bar) / 2, zc));
    if (o.kind === 'window') {
      // 실내 창턱 (아래 벽 윗면 위에 올라앉음)
      group.add(k.at(k.box(w + 0.12, 0.035, 0.16, k.wood('walnut')), cx, o.bottom + 0.0175, T / 2 - 0.02));
      group.add(k.at(k.box(w - bar * 2 - gap * 2, 0.04, 0.08, oak), cx, y0 + 0.02, zc));
      const gw = w - bar * 2 - gap * 2;
      const gh = o.top - y0 - bar * 2 - gap;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), this.frosted);
      glass.position.set(cx, y0 + 0.04 + gh / 2, zc);
      glass.renderOrder = 1;
      group.add(glass);
      const panes = Math.max(1, Math.round(w / 1.1));
      for (let i = 1; i < panes; i++) group.add(k.at(k.box(0.035, gh, 0.06, oak), o.a + (w * i) / panes, y0 + 0.04 + gh / 2, zc));
      // 원목 블라인드 (위쪽 45%)
      const slats = Math.floor((gh * 0.45) / 0.055);
      for (let i = 0; i < slats; i++) group.add(k.at(k.box(gw - 0.02, 0.008, 0.03, k.wood('lightoak')), cx, o.top - bar - 0.03 - i * 0.055, zc + 0.055, 0.55));
      for (const s of [-1, 1]) group.add(k.at(k.box(0.004, slats * 0.055, 0.004, k.mat('#d9d0bf')), cx + s * gw * 0.3, o.top - bar - (slats * 0.055) / 2, zc + 0.06));
    } else {
      // 문: 바깥으로 열린 원목 프레임 유리문
      const door = new THREE.Group();
      door.position.set(o.a, 0, -T / 2);
      door.rotation.y = 1.3;
      const dw = w - 0.04;
      const dh = o.top - 0.04;
      const wood = k.wood('walnut');
      door.add(k.at(k.box(0.09, dh, 0.045, wood), 0.045, dh / 2, 0));
      door.add(k.at(k.box(0.09, dh, 0.045, wood), dw - 0.045, dh / 2, 0));
      door.add(k.at(k.box(dw, 0.1, 0.045, wood), dw / 2, dh - 0.05, 0));
      door.add(k.at(k.box(dw, 0.32, 0.045, wood), dw / 2, 0.16, 0));
      const dg = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.18, dh - 0.42), this.frosted);
      dg.position.set(dw / 2, 0.32 + (dh - 0.42) / 2, 0);
      door.add(dg);
      door.add(k.at(k.cyl(0.012, 0.012, 0.4, k.metal('brass')), dw - 0.14, 1.05, -0.05));
      group.add(door);
    }
  }

  sconce(g, wall, x, y) {
    const k = kit;
    const z = T / 2;
    g.add(k.at(k.cyl(0.05, 0.05, 0.02, k.metal('brass')), x, y, z + 0.01, Math.PI / 2));
    g.add(k.at(k.cyl(0.008, 0.008, 0.18, k.metal('black')), x, y, z + 0.1, Math.PI / 2));
    const shade = k.cyl(0.05, 0.09, 0.12, k.mat('#e9dcc4', { emissive: '#ffb46b', ei: 0.4, rough: 0.8 }), { open: true });
    shade.material.side = THREE.DoubleSide;
    g.add(k.at(shade, x, y - 0.03, z + 0.2));
    g.add(k.at(k.sphere(0.03, k.glow('#ffcf8f', 1.2)), x, y - 0.06, z + 0.2));
    const light = k.lamp('#ffb46b', 1.35, 7);
    light.position.set(x, y - 0.15, z + 0.35);
    light.userData.enabled = () => wall.h > WALL_H * 0.8;
    g.add(light);
    this.lamps.push(light);
  }

  northProps(g, wall) {
    const k = kit;
    const z = T / 2;
    // v12 6m 뒷벽: 메뉴 칠판 · 오픈 선반 · (와인 랙 자리) · 벽시계
    g.add(k.at(k.box(1.42, 0.86, 0.05, k.wood('walnut')), -2.65, 1.95, z + 0.025));
    const board = k.label(['Ciao, Trattoria!', 'Caffè · Pane · Pasta', 'Pizza · Insalate'], 1.3, 0.74, { bg: '#262b28' });
    g.add(k.at(board, -2.65, 1.95, z + 0.055));
    // v13 스테인리스 주방 후드 (파스타 스토브 위)
    const steel = k.metal('steel');
    g.add(k.at(k.box(1.1, 0.06, 0.62, steel), -1.0, 2.0, z + 0.31));
    g.add(k.at(k.box(1.0, 0.22, 0.5, steel), -1.0, 2.14, z + 0.26, -0.12));
    g.add(k.at(k.box(0.36, 0.55, 0.3, steel), -1.0, 2.5, z + 0.16));
    g.add(k.at(k.box(0.9, 0.02, 0.02, k.metal('black')), -1.0, 1.97, z + 0.61));
    for (let i = 0; i < 3; i++) g.add(k.at(k.sphere(0.02, k.glow('#ffe2a8', 1.1)), -1.35 + i * 0.35, 1.965, z + 0.45));
    // 오픈 선반 (후드 오른쪽)
    g.add(k.at(k.box(0.9, 0.04, 0.24, k.wood('oak')), 0.25, 1.78, z + 0.12));
    for (const s of [-1, 1]) g.add(k.at(k.box(0.02, 0.14, 0.2, k.metal('black')), 0.25 + s * 0.38, 1.7, z + 0.1));
    ['#e9e4da', '#3b3b3d', '#c9b49a'].forEach((c, i) => g.add(k.at(k.cyl(0.045, 0.036, 0.09, k.ceramic(c)), -0.08 + i * 0.17, 1.845, z + 0.12)));
    for (let i = 0; i < 6; i++) g.add(k.at(k.scl(k.sphere(0.05, k.mat('#3f6a3c', { rough: 0.8 })), 1, 0.7, 1), 0.53 + Math.cos(i) * 0.05, 1.86, z + 0.12 + Math.sin(i) * 0.04));
    g.add(k.at(k.cyl(0.22, 0.22, 0.04, k.ceramic('#efebe3')), 3.05, 2.35, z + 0.02, Math.PI / 2));
    g.add(k.at(k.torus(0.22, 0.025, k.metal('black')), 3.05, 2.35, z + 0.03));
    g.add(k.at(k.box(0.018, 0.14, 0.01, k.metal('black')), 3.05, 2.41, z + 0.05));
    g.add(k.at(k.box(0.1, 0.018, 0.01, k.metal('black')), 3.1, 2.35, z + 0.05));
    this.northGroup = g;
  }

  southProps() {
    // v14: 앞벽에는 출입문이 없다 (문은 왼쪽 벽). 낮게 잘린 벽이라 바깥 소품도 두지 않는다
  }

  westProps(g, wall) {
    const k = kit;
    const z = T / 2;
    for (const [x, c1, c2] of [
      [1.25, '#c9b79c', '#5f6b5a'],
      [2.95, '#9aa3a8', '#7a5b45'],
    ]) {
      g.add(k.at(k.box(0.86, 1.1, 0.04, k.wood('ebony')), x, 1.6, z + 0.02));
      g.add(k.at(k.box(0.7, 0.94, 0.01, k.mat('#efe9de', { rough: 0.9 })), x, 1.6, z + 0.045));
      g.add(k.at(k.box(0.5, 0.6, 0.01, k.mat(c1, { rough: 0.9 })), x, 1.65, z + 0.052));
      g.add(k.at(k.cyl(0.12, 0.12, 0.01, k.mat(c2, { rough: 0.9 })), x + 0.05, 1.7, z + 0.058, Math.PI / 2));
    }
  }

  setFinish(fin) {
    this.finishSpec = fin;
    const base = finishTexture(fin.texture);
    for (const w of this.walls) {
      const tex = base.clone();
      tex.needsUpdate = true;
      if (fin.texture.fullHeight) tex.repeat.set(1 / 2, 1 / WALL_H);
      else {
        const m = fin.texture.tileMeters ?? 1;
        tex.repeat.set(1 / m, 1 / m);
      }
      tex.userData = { ry: tex.repeat.y };
      w.inner.map = tex;
      w.inner.roughness = fin.rough ?? 0.85;
      w.inner.needsUpdate = true;
      w.ext.map.userData = { ry: 1 };
    }
  }

  // 낮 햇살 세기 (DayCycle 이 넘겨준다)
  setSun(f) {
    for (const b of this.beams) b.material.opacity = 0.2 * Math.min(1, f);
    this.frosted.emissiveIntensity = this.rainOn ? 0.85 : 0.12 + 0.35 * Math.min(1, f);
  }

  // 비 오는 무드: 유리창에 빗줄기가 흘러내리고 유리 빛이 블루그레이로 바뀐다
  setRain(on) {
    this.rainOn = on;
    if (!this.rainTex) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 256;
        const l = 10 + Math.random() * 40;
        g.strokeStyle = `rgba(220,232,245,${0.25 + Math.random() * 0.45})`;
        g.lineWidth = 0.6 + Math.random() * 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (Math.random() - 0.5) * 2, y + l);
        g.stroke();
        g.fillStyle = 'rgba(235,242,250,0.7)';
        g.beginPath();
        g.arc(x, y + l, 1 + Math.random() * 1.4, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(230,238,248,${0.2 + Math.random() * 0.4})`;
        g.beginPath();
        g.arc(Math.random() * 128, Math.random() * 256, 0.6 + Math.random() * 1.2, 0, Math.PI * 2);
        g.fill();
      }
      this.rainTex = new THREE.CanvasTexture(c);
      this.rainTex.wrapS = this.rainTex.wrapT = THREE.RepeatWrapping;
      this.rainTex.repeat.set(1.5, 1);
      this.baseEmissive = this.frosted.emissive.clone();
      this.rainEmissive = new THREE.Color('#9fb4cc').convertSRGBToLinear();
    }
    this.frosted.emissiveMap = on ? this.rainTex : null;
    this.frosted.emissive.copy(on ? this.rainEmissive : this.baseEmissive);
    this.frosted.needsUpdate = true;
  }

  update(dt, camera) {
    if (this.rainOn) this.rainTex.offset.y += dt * 0.35;
    for (const w of this.walls) {
      const toCam = camera.position.clone().sub(w.center);
      toCam.y = 0;
      const target = w.normal.dot(toCam) > 0.5 ? LOW : WALL_H;
      w.h += (target - w.h) * Math.min(1, dt * 7);
      const s = w.h / WALL_H;
      // 10차: 벽이 낮아지기 시작하면 벽에 붙은 소품(선반 · 화분 · 병 · 창틀)은 찌그러뜨리지 않고 즉시 숨긴다
      const showProps = target === WALL_H && s > 0.97;
      if (w.propsShown !== showProps) {
        w.propsShown = showProps;
        for (const c of w.group.children) if (!c.userData.seg) c.visible = showProps;
        for (const c of w.holder.children) if (c !== w.group && !this.beams.includes(c)) c.visible = showProps;
      }
      if (Math.abs(s - w.scale) < 1e-4) continue;
      w.scale = s;
      w.group.scale.y = s;
      // 벽이 낮아져도 벽돌/벽지 크기가 그대로 보이도록 세로 반복을 보정
      if (w.inner.map?.userData) w.inner.map.repeat.y = w.inner.map.userData.ry * s;
      w.ext.map.repeat.y = (w.ext.map.userData?.ry ?? 1) * s;
    }
  }
}
