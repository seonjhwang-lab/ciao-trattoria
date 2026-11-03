import * as THREE from 'three';

// r128 코어에는 RoundedBoxGeometry 가 없어서 직접 구현한다.
// 잘게 나눈 정육면체의 꼭짓점을 '안쪽 박스 + 반지름' 위치로 밀어내 모서리를 둥글게 만든다.
export class RoundedBoxGeometry extends THREE.BoxGeometry {
  constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
    const seg = segments * 2 + 1;
    const r = Math.min(width / 2, height / 2, depth / 2, radius);
    super(1, 1, 1, seg, seg, seg);
    const flat = this.toNonIndexed();
    this.setIndex(null);
    this.setAttribute('position', flat.getAttribute('position'));
    this.setAttribute('normal', flat.getAttribute('normal'));
    this.setAttribute('uv', flat.getAttribute('uv'));

    const pos = this.attributes.position.array;
    const nor = this.attributes.normal.array;
    const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(r);
    const half = 0.5 / seg;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let j = 0; j < pos.length; j += 3) {
      p.fromArray(pos, j);
      n.copy(p);
      n.x -= Math.sign(n.x) * half;
      n.y -= Math.sign(n.y) * half;
      n.z -= Math.sign(n.z) * half;
      n.normalize();
      pos[j] = box.x * Math.sign(p.x) + n.x * r;
      pos[j + 1] = box.y * Math.sign(p.y) + n.y * r;
      pos[j + 2] = box.z * Math.sign(p.z) + n.z * r;
      nor[j] = n.x;
      nor[j + 1] = n.y;
      nor[j + 2] = n.z;
    }
    this.computeBoundingSphere();
  }
}
