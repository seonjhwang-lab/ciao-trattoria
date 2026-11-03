import * as THREE from 'three';
import { registry } from './PackRegistry.js';
import { bus } from './EventBus.js';
import { buildFurniture } from './FurnitureManager.js';
import { GRID_W, GRID_D } from './GridSystem.js';

const OK = 0x6fcf97;
const BAD = 0xeb6b6b;
const SEL = 0x7cc4f0;

// 터치 꾸미기: 카탈로그 탭 → 고스트가 화면 중앙 빈자리에 등장 → 바닥 탭/드래그로 위치 → 확인 버튼으로 배치
// 놓인 가구를 탭하면 플로팅 메뉴(회전·톤·이동·판매). 키보드는 쓰지 않는다.
export class BuildController {
  constructor({ scene, grid, furniture, state, ai, effects, sound }) {
    Object.assign(this, { scene, grid, furniture, state, ai, effects, sound });
    this.placing = null; // { def, rot, swatch, moving, anchor }
    this.ghost = null;
    this.selected = null;
  }

  toast(m) {
    bus.emit('toast', m);
  }

  setActive(on) {
    if (!on) {
      this.cancel();
      this.deselect();
    }
    this.grid.showGrid(on);
  }

  emit() {
    bus.emit('build:changed');
  }

  nearestFree(def, rot, tile, ignoreId = null) {
    const [cx, cz] = tile ?? [6, 6];
    for (let r = 0; r < 12; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = cx + dx;
          const z = cz + dz;
          if (this.grid.canPlace(def, x, z, rot, ignoreId).ok) return [x, z];
        }
      }
    }
    return [Math.min(GRID_W - 1, Math.max(0, cx)), Math.min(GRID_D - 1, Math.max(0, cz))];
  }

  startPlacing(defId, viewTile) {
    const def = registry.getFurniture(defId);
    if (!def) return;
    this.cancel();
    this.deselect();
    const rot = def.defaultRot ?? 0;
    this.placing = { def, rot, swatch: 0, moving: null, anchor: this.nearestFree(def, rot, viewTile) };
    this.makeGhost();
    this.refresh();
    this.sound.tap();
    this.emit();
  }

  startMoving(inst) {
    if (this.ai.isInUse(inst.id)) return this.toast('지금 사용 중이에요. 잠시 후에 옮겨 주세요');
    this.deselect();
    this.placing = { def: inst.def, rot: inst.rot, swatch: inst.swatch, moving: inst, anchor: [inst.tx, inst.tz] };
    inst.object.visible = false;
    this.makeGhost();
    this.refresh();
    this.emit();
  }

  makeGhost() {
    this.removeGhost();
    const { def, swatch } = this.placing;
    const g = new THREE.Group();
    const obj = buildFurniture(def, swatch);
    obj.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.6;
        o.castShadow = false;
      }
      if (o.isLight) o.intensity = 0;
    });
    g.add(obj);
    this.ghost = g;
    this.scene.add(g);
  }

  removeGhost() {
    if (!this.ghost) return;
    this.scene.remove(this.ghost);
    this.ghost.traverse((o) => o.isMesh && o.material.dispose());
    this.ghost = null;
  }

  get canConfirm() {
    if (!this.placing) return false;
    const { def, rot, anchor, moving } = this.placing;
    return this.grid.canPlace(def, anchor[0], anchor[1], rot, moving?.id ?? null).ok;
  }

  refresh() {
    if (!this.placing) return;
    const { def, rot, anchor } = this.placing;
    this.ghost.position.copy(this.grid.centerOf(def, anchor[0], anchor[1], rot));
    this.ghost.rotation.y = (rot * Math.PI) / 2;
    this.grid.showCells('preview', this.grid.cells(def, anchor[0], anchor[1], rot), this.canConfirm ? OK : BAD, 0.55);
  }

  // 손가락 위치(타일)로 고스트 이동
  moveGhostTo(tile) {
    if (!this.placing || !tile) return;
    const { def, rot } = this.placing;
    const a = this.grid.anchorFromPointer(def, tile, rot);
    const [fw, fd] = this.grid.footprint(def, rot);
    a[0] = Math.max(0, Math.min(GRID_W - fw, a[0]));
    a[1] = Math.max(0, Math.min(GRID_D - fd, a[1]));
    if (a[0] === this.placing.anchor[0] && a[1] === this.placing.anchor[1]) return;
    this.placing.anchor = a;
    this.refresh();
    this.emit();
  }

  ghostContains(tile) {
    if (!this.placing || !tile) return false;
    const { def, rot, anchor } = this.placing;
    return this.grid.cells(def, anchor[0], anchor[1], rot).some(([x, z]) => Math.abs(x - tile[0]) <= 0 && Math.abs(z - tile[1]) <= 0);
  }

  confirm() {
    if (!this.placing) return;
    const { def, rot, swatch, moving, anchor } = this.placing;
    const chk = this.grid.canPlace(def, anchor[0], anchor[1], rot, moving?.id ?? null);
    if (!chk.ok) return this.toast(chk.reason);
    const center = this.grid.centerOf(def, anchor[0], anchor[1], rot);
    let inst;
    if (moving) {
      this.furniture.move(moving.id, anchor[0], anchor[1], rot);
      if (moving.swatch !== swatch) this.furniture.recolor(moving.id, swatch);
      moving.object.visible = true;
      inst = moving;
    } else {
      if (this.state.money < def.price) return this.toast('코인이 조금 모자라요. 손님을 맞이하면 금방 모여요');
      this.state.addMoney(-def.price);
      inst = this.furniture.place(def.id, anchor[0], anchor[1], rot, swatch);
    }
    this.placing = null;
    this.removeGhost();
    this.grid.hideCells('preview');
    this.effects.poof(center, Math.max(...def.size) * 0.9);
    this.sound.plop();
    bus.emit('layout:changed');
    if (inst) this.select(inst);
    this.emit();
  }

  rotate() {
    this.sound.tap();
    if (this.placing) {
      this.placing.rot = (this.placing.rot + 1) % 4;
      const { def, rot } = this.placing;
      const [fw, fd] = this.grid.footprint(def, rot);
      this.placing.anchor[0] = Math.min(GRID_W - fw, this.placing.anchor[0]);
      this.placing.anchor[1] = Math.min(GRID_D - fd, this.placing.anchor[1]);
      this.refresh();
      this.emit();
      return;
    }
    const inst = this.selected;
    if (!inst) return;
    if (this.ai.isInUse(inst.id)) return this.toast('지금 사용 중이에요');
    if (this.furniture.move(inst.id, inst.tx, inst.tz, (inst.rot + 1) % 4)) {
      bus.emit('layout:changed');
      this.select(inst);
    } else this.toast('돌릴 공간이 부족해요');
  }

  cycleSwatch() {
    this.sound.tap();
    if (this.placing) {
      const n = this.placing.def.swatches.length;
      this.placing.swatch = (this.placing.swatch + 1) % n;
      this.makeGhost();
      this.refresh();
      this.toast(`톤 변경 · ${this.placing.def.swatches[this.placing.swatch].name}`);
      this.emit();
      return;
    }
    const inst = this.selected;
    if (!inst) return;
    const next = (inst.swatch + 1) % inst.def.swatches.length;
    this.furniture.recolor(inst.id, next);
    this.toast(`톤 변경 · ${inst.def.swatches[next].name}`);
    bus.emit('layout:changed');
    this.emit();
  }

  sell() {
    const inst = this.selected;
    if (!inst) return;
    if (this.ai.isInUse(inst.id)) return this.toast('지금 사용 중이에요. 잠시 후에 정리해 주세요');
    const center = this.furniture.worldCenter(inst);
    this.furniture.remove(inst.id);
    this.state.addMoney(inst.def.price);
    this.effects.poof(center, Math.max(...inst.def.size) * 0.9);
    this.sound.coin();
    this.deselect();
    bus.emit('layout:changed');
    this.toast(`${inst.def.name} 판매 (+${inst.def.price.toLocaleString()}원)`);
  }

  cancel() {
    if (!this.placing) return;
    const moving = this.placing.moving;
    if (moving) moving.object.visible = true;
    this.placing = null;
    this.removeGhost();
    this.grid.hideCells('preview');
    if (moving) this.select(moving);
    this.emit();
  }

  select(inst) {
    this.selected = inst;
    this.grid.showCells('select', this.furniture.cellsOf(inst), SEL, 0.5);
    this.emit();
  }

  deselect() {
    if (!this.selected) return;
    this.selected = null;
    this.grid.hideCells('select');
    this.emit();
  }

  // 플로팅 메뉴를 띄울 3D 위치
  focusPoint() {
    if (this.placing) return this.ghost.position.clone().setY(this.placing.def.menuHeight ?? 1.5);
    if (this.selected) return this.furniture.worldCenter(this.selected).setY(this.selected.def.menuHeight ?? 1.5);
    return null;
  }

  update() {
    if (this.ghost) this.ghost.position.y = 0.02 + Math.sin(performance.now() / 260) * 0.012;
  }
}
