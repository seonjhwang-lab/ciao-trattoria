import * as THREE from 'three';
import { finishTexture } from './Textures.js';

export const GRID_W = 7; // v14: 7x8 — 뒤쪽 주방(2칸) · 패스 카운터(1칸) · 식사 홀(5칸), 현관 마당 없음
export const GRID_D = 8;
export const DOOR_TILE = [0, 6]; // 왼쪽(서쪽) 벽에 난 출입문 바로 안쪽 칸
export const KITCHEN_DEPTH = 2.5; // 뒷벽에서 패스 카운터 중심선까지 (주방 바닥 타일 구역)
// rot 0:+z(남) 1:+x(동) 2:-z(북) 3:-x(서) — 모델은 +z를 바라보게 만든다
export const FACING = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

export function tileCenter(tx, tz) {
  return new THREE.Vector3(tx - GRID_W / 2 + 0.5, 0, tz - GRID_D / 2 + 0.5);
}

export function worldToTile(x, z) {
  return [Math.floor(x + GRID_W / 2), Math.floor(z + GRID_D / 2)];
}

// 10x10 타일 격자 (7차: 아늑한 부티크 비스트로로 압축): 점유 관리, 배치 가능 판정, 바닥 렌더링, 프리뷰 하이라이트
export class GridSystem {
  constructor(scene) {
    this.scene = scene;
    this.layers = {
      object: new Array(GRID_W * GRID_D).fill(null),
      floor: new Array(GRID_W * GRID_D).fill(null),
    };
    this.reserved = new Set([this.idx(...DOOR_TILE)]);

    // 바닥
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    this.floorMat.envMapIntensity = 0.5;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(GRID_W, GRID_D), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    scene.add(this.floor);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_W + 0.4, 0.12, GRID_D + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x5a524b, roughness: 0.9 }),
    );
    slab.position.y = -0.061;
    slab.receiveShadow = true;
    scene.add(slab);

    // 꾸미기 모드용 격자선
    const pts = [];
    for (let i = 0; i <= GRID_W; i++) pts.push(i - GRID_W / 2, 0, -GRID_D / 2, i - GRID_W / 2, 0, GRID_D / 2);
    for (let j = 0; j <= GRID_D; j++) pts.push(-GRID_W / 2, 0, j - GRID_D / 2, GRID_W / 2, 0, j - GRID_D / 2);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridLines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    this.gridLines.position.y = 0.006;
    this.gridLines.visible = false;
    scene.add(this.gridLines);

    // v13 주방 바닥: 홀의 원목 마루와 구분되는 위생적인 차콜 & 크림 체크 논슬립 타일
    {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#8f877c';
      g.fillRect(0, 0, 256, 256);
      const n = 4;
      const s = 256 / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          g.fillStyle = (x + y) % 2 ? '#3b3836' : '#e4dccd';
          g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
          // 논슬립 표면 결
          g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
          for (let i = 0; i < 40; i++) g.fillRect(x * s + 2 + Math.random() * (s - 6), y * s + 2 + Math.random() * (s - 6), 2, 2);
        }
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      tex.repeat.set(GRID_W / 1.2, KITCHEN_DEPTH / 1.2);
      const km = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
      km.envMapIntensity = 0.4;
      const kitchen = new THREE.Mesh(new THREE.PlaneGeometry(GRID_W, KITCHEN_DEPTH), km);
      kitchen.rotation.x = -Math.PI / 2;
      kitchen.position.set(0, 0.003, -GRID_D / 2 + KITCHEN_DEPTH / 2);
      kitchen.receiveShadow = true;
      kitchen.userData.noOutline = true;
      scene.add(kitchen);
      this.kitchenFloor = kitchen;
    }

    // 하이라이트 타일 풀
    this.tileGeo = new THREE.PlaneGeometry(0.92, 0.92);
    this.pools = { preview: [], select: [] };
    this.door = this.makeDoorMarker();
  }

  makeDoorMarker() {
    const m = new THREE.Mesh(
      this.tileGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(tileCenter(...DOOR_TILE)).setY(0.01);
    this.scene.add(m);
    // v14: 왼쪽 벽 출입문 안쪽 코코넛 도어매트
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95), new THREE.MeshStandardMaterial({ color: new THREE.Color('#b98e6a').convertSRGBToLinear(), roughness: 0.95 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.copy(tileCenter(...DOOR_TILE)).setY(0.006);
    mat.position.x -= 0.12;
    mat.receiveShadow = true;
    this.scene.add(mat);
    return m;
  }

  idx(tx, tz) {
    return tz * GRID_W + tx;
  }

  inBounds(tx, tz) {
    return tx >= 0 && tz >= 0 && tx < GRID_W && tz < GRID_D;
  }

  footprint(def, rot) {
    const [w, d] = def.size;
    return rot % 2 ? [d, w] : [w, d];
  }

  cells(def, tx, tz, rot) {
    const [fw, fd] = this.footprint(def, rot);
    const out = [];
    for (let x = 0; x < fw; x++) for (let z = 0; z < fd; z++) out.push([tx + x, tz + z]);
    return out;
  }

  anchorFromPointer(def, tile, rot) {
    const [fw, fd] = this.footprint(def, rot);
    return [tile[0] - Math.floor((fw - 1) / 2), tile[1] - Math.floor((fd - 1) / 2)];
  }

  centerOf(def, tx, tz, rot) {
    const [fw, fd] = this.footprint(def, rot);
    return new THREE.Vector3(tx - GRID_W / 2 + fw / 2, 0, tz - GRID_D / 2 + fd / 2);
  }

  canPlace(def, tx, tz, rot, ignoreId = null) {
    const layer = this.layers[def.layer] ?? this.layers.object;
    for (const [x, z] of this.cells(def, tx, tz, rot)) {
      if (!this.inBounds(x, z)) return { ok: false, reason: '매장 밖에는 놓을 수 없어요' };
      const occ = layer[this.idx(x, z)];
      if (occ !== null && occ !== ignoreId) return { ok: false, reason: '이미 다른 가구가 있어요' };
      if (def.layer !== 'floor' && this.reserved.has(this.idx(x, z))) return { ok: false, reason: '입구는 손님을 위해 비워 둘게요' };
    }
    return { ok: true };
  }

  occupy(inst) {
    const layer = this.layers[inst.def.layer] ?? this.layers.object;
    for (const [x, z] of this.cells(inst.def, inst.tx, inst.tz, inst.rot)) layer[this.idx(x, z)] = inst.id;
  }

  release(inst) {
    const layer = this.layers[inst.def.layer] ?? this.layers.object;
    for (const [x, z] of this.cells(inst.def, inst.tx, inst.tz, inst.rot)) {
      if (layer[this.idx(x, z)] === inst.id) layer[this.idx(x, z)] = null;
    }
  }

  objectAt(tx, tz) {
    return this.inBounds(tx, tz) ? this.layers.object[this.idx(tx, tz)] : null;
  }

  isWalkable(tx, tz) {
    return this.inBounds(tx, tz) && this.layers.object[this.idx(tx, tz)] === null;
  }

  setFloorFinish(fin) {
    const tex = finishTexture(fin.texture);
    const m = fin.texture.tileMeters ?? 2;
    tex.repeat.set(GRID_W / m, GRID_D / m);
    this.floorMat.map = tex;
    this.floorMat.roughness = fin.rough ?? 0.6;
    this.floorMat.needsUpdate = true;
  }

  showGrid(v) {
    this.gridLines.visible = v;
    this.door.material.opacity = v ? 0.55 : 0;
  }

  showCells(pool, cells, color, opacity = 0.5) {
    const list = this.pools[pool];
    while (list.length < cells.length) {
      const m = new THREE.Mesh(
        this.tileGeo,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      this.scene.add(m);
      list.push(m);
    }
    list.forEach((m, i) => {
      if (i < cells.length) {
        m.visible = true;
        m.material.color.set(color);
        m.material.opacity = opacity;
        m.position.copy(tileCenter(...cells[i])).setY(pool === 'select' ? 0.014 : 0.018);
      } else m.visible = false;
    });
  }

  hideCells(pool) {
    this.pools[pool].forEach((m) => (m.visible = false));
  }
}
