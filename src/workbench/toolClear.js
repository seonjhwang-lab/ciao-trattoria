import * as THREE from 'three';

// v16: 조리 도구가 음식을 뚫고 들어가지 않게 하는 공통 높이 계산
//  getFoodTopY(root)  : root 아래 보이는 음식 메쉬들의 실제 바운딩 박스 최고점 (월드 Y)
//  lowestPoint(tool)  : 도구(병 · 후추통 · 강판 · 휠)의 실제 최저점 (월드 좌표, 노즐 끝)
//  keepAbove(tool, y) : 도구 최저점이 y 보다 낮으면 그만큼 도구를 들어 올린다 (매 프레임 호출 가능)
const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();

function isUnder(o, roots) {
  for (let p = o; p; p = p.parent) if (roots.includes(p)) return true;
  return false;
}

function visibleChain(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function meshBox(o) {
  const g = o.geometry;
  if (!g) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  if (!g.boundingBox || g.boundingBox.isEmpty()) return null;
  return tmpBox.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
}

/**
 * @param {THREE.Object3D} root 음식이 담긴 그룹 (접시 · 볼 · 무대)
 * @param {{ exclude?: THREE.Object3D[], center?: THREE.Vector3, radius?: number }} opts
 *   center/radius(월드 xz) 를 주면 그 원 안에 있는 메쉬만 음식으로 본다 (무대 뒤쪽 병 · 소품 제외)
 */
export function getFoodTopY(root, opts = {}) {
  const exclude = opts.exclude ?? [];
  root.updateMatrixWorld(true);
  let top = -Infinity;
  root.traverse((o) => {
    if (!o.isMesh || o.isSprite) return;
    if (o.userData.hitbox || o.material?.visible === false) return;
    if (exclude.length && isUnder(o, exclude)) return;
    if (!visibleChain(o)) return;
    const b = meshBox(o);
    if (!b) return;
    if (opts.center && opts.radius) {
      b.getCenter(tmpCenter);
      if (Math.hypot(tmpCenter.x - opts.center.x, tmpCenter.z - opts.center.z) > opts.radius) return;
    }
    if (b.max.y > top) top = b.max.y;
  });
  return top;
}

/** 도구의 최저점 (월드). 가장 낮은 메쉬의 바운딩 박스 바닥 중심을 노즐 끝으로 본다 */
export function lowestPoint(tool) {
  tool.updateMatrixWorld(true);
  let lo = Infinity;
  const at = new THREE.Vector3();
  tool.traverse((o) => {
    if (!o.isMesh || !visibleChain(o)) return;
    const b = meshBox(o);
    if (!b) return;
    if (b.min.y < lo) {
      lo = b.min.y;
      b.getCenter(at);
      at.y = b.min.y;
    }
  });
  return lo === Infinity ? null : at;
}

/** 도구 최저점이 worldY 보다 낮으면 들어 올린다. 들어 올린 양(m)을 돌려준다 */
export function keepAbove(tool, worldY) {
  const p = lowestPoint(tool);
  if (!p || p.y >= worldY) return 0;
  const dy = worldY - p.y;
  const s = tool.parent ? tool.parent.getWorldScale(new THREE.Vector3()).y : 1;
  tool.position.y += dy / (s || 1);
  tool.updateMatrixWorld(true);
  return dy;
}
