import * as THREE from 'three';
import { registry } from './PackRegistry.js';
import { FACING, tileCenter } from './GridSystem.js';
import { kit } from './Kit.js';

const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

export function buildFurniture(def, swatchIndex = 0) {
  const sw = def.swatches[swatchIndex] ?? def.swatches[0];
  const obj = def.build(kit, sw, def);
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = def.layer !== 'floor' && !(o.material.transparent && o.material.opacity < 0.9);
      o.receiveShadow = true;
    }
  });
  return obj;
}

// 배치된 가구 인스턴스 관리 (배치/이동/회전/색상/철거 + 손님 AI가 쓰는 조회)
export class FurnitureManager {
  constructor(scene, grid) {
    this.grid = grid;
    this.items = new Map();
    this.nextId = 1;
    this.root = new THREE.Group();
    this.root.name = 'furniture';
    scene.add(this.root);
  }

  place(defId, tx, tz, rot = 0, swatch = 0) {
    const def = registry.getFurniture(defId);
    if (!def) return null;
    if (!this.grid.canPlace(def, tx, tz, rot).ok) return null;
    const inst = { id: this.nextId++, defId, def, tx, tz, rot, swatch: Math.min(swatch, def.swatches.length - 1), object: null };
    this.items.set(inst.id, inst);
    this.grid.occupy(inst);
    this.rebuild(inst);
    return inst;
  }

  rebuild(inst) {
    if (inst.object) this.root.remove(inst.object);
    const obj = buildFurniture(inst.def, inst.swatch);
    const holder = new THREE.Group();
    holder.add(obj);
    // v12: 조리대는 보이지 않는 넉넉한 터치 상자 (앞쪽으로 0.6m 더)
    if (inst.def.station) {
      const [w, d] = inst.def.size ?? [1, 1];
      const hb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 2.2, d + 0.6), HIT_MAT);
      hb.position.set(0, 1.1, 0.3);
      hb.userData.hitbox = true;
      hb.userData.noOutline = true;
      holder.add(hb);
    }
    holder.position.copy(this.grid.centerOf(inst.def, inst.tx, inst.tz, inst.rot));
    holder.rotation.y = (inst.rot * Math.PI) / 2;
    holder.traverse((o) => (o.userData.furnitureId = inst.id));
    inst.object = holder;
    this.root.add(holder);
  }

  remove(id) {
    const inst = this.items.get(id);
    if (!inst) return;
    this.grid.release(inst);
    this.root.remove(inst.object);
    this.items.delete(id);
  }

  move(id, tx, tz, rot) {
    const inst = this.items.get(id);
    if (!inst || !this.grid.canPlace(inst.def, tx, tz, rot, id).ok) return false;
    this.grid.release(inst);
    Object.assign(inst, { tx, tz, rot });
    this.grid.occupy(inst);
    inst.object.position.copy(this.grid.centerOf(inst.def, tx, tz, rot));
    inst.object.rotation.y = (rot * Math.PI) / 2;
    return true;
  }

  recolor(id, swatch) {
    const inst = this.items.get(id);
    if (!inst) return;
    inst.swatch = swatch;
    this.rebuild(inst);
  }

  fromObject(obj) {
    let o = obj;
    while (o) {
      if (o.userData.furnitureId) return this.items.get(o.userData.furnitureId) ?? null;
      o = o.parent;
    }
    return null;
  }

  cellsOf(inst) {
    return this.grid.cells(inst.def, inst.tx, inst.tz, inst.rot);
  }

  // 테이블을 마주 보고 있는 의자만 '좌석'으로 인정
  seats() {
    const out = [];
    for (const chair of this.items.values()) {
      if (!chair.def.seat) continue;
      const [dx, dz] = FACING[chair.rot];
      const tableTile = [chair.tx + dx, chair.tz + dz];
      const table = this.items.get(this.grid.objectAt(...tableTile));
      if (!table || !table.def.table) continue;
      out.push({ chair, table, tile: [chair.tx, chair.tz], facing: [dx, dz], tableTile });
    }
    return out;
  }

  stations(type) {
    return [...this.items.values()].filter((i) => i.def.station && (!type || i.def.station === type));
  }

  stationTypes() {
    return new Set(this.stations().map((s) => s.def.station));
  }

  // 조리기구 앞(바라보는 방향) 칸 — 바리스타가 서는 자리
  frontTile(inst) {
    const [dx, dz] = FACING[inst.rot];
    const cells = this.cellsOf(inst);
    const key = (x, z) => `${x},${z}`;
    const own = new Set(cells.map(([x, z]) => key(x, z)));
    const fronts = cells.map(([x, z]) => [x + dx, z + dz]).filter(([x, z]) => !own.has(key(x, z)));
    const mid = fronts[Math.floor((fronts.length - 1) / 2)] ?? fronts[0];
    if (mid && this.grid.isWalkable(...mid)) return mid;
    return fronts.find((t) => this.grid.isWalkable(...t)) ?? mid ?? cells[0];
  }

  worldCenter(inst) {
    return this.grid.centerOf(inst.def, inst.tx, inst.tz, inst.rot);
  }

  decorScore() {
    let s = 0;
    for (const i of this.items.values()) s += i.def.decor ?? 0;
    return s;
  }

  // 조명 가구 안의 PointLight 목록 (DayCycle 이 밤에 켠다)
  lamps() {
    const out = [];
    for (const i of this.items.values()) i.object.traverse((o) => o.isLight && o.userData.lamp && out.push(o));
    return out;
  }

  // 테이블에서 음식을 놓을 때 서는 칸: 테이블 옆 빈 칸 중 손님 의자와 가장 가까운 곳
  serveTile(seat) {
    const [tx, tz] = seat.tableTile;
    const [cx, cz] = seat.tile;
    let best = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = tx + dx;
      const z = tz + dz;
      if (!this.grid.isWalkable(x, z)) continue;
      const d = Math.hypot(x - cx, z - cz) + (dx && dz ? 0.3 : 0);
      if (!best || d < best.d) best = { x, z, d };
    }
    return best ? [best.x, best.z] : null;
  }

  serialize() {
    return [...this.items.values()].map((i) => ({ id: i.defId, x: i.tx, z: i.tz, r: i.rot, s: i.swatch }));
  }

  load(list) {
    for (const it of list ?? []) {
      // 설치되지 않은 확장팩의 가구는 조용히 건너뛴다
      if (!registry.getFurniture(it.id)) continue;
      this.place(it.id, it.x, it.z, it.r ?? 0, it.s ?? 0);
    }
  }

  clear() {
    for (const id of [...this.items.keys()]) this.remove(id);
  }
}

