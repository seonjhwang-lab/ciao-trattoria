import * as THREE from 'three';

// 3D 위치에 붙는 HTML 라벨 (말풍선·이펙트). r128 코어에는 CSS2DRenderer 가 없어서 직접 구현.
// 라벨 요소 자체의 transform 은 위치용이므로, 애니메이션은 안쪽 자식에만 건다.
export class LabelLayer {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'label-layer';
    container.appendChild(this.el);
    this.items = new Set();
    this.v = new THREE.Vector3();
  }

  // obj 가 있으면 obj 를 따라다니고, 없으면 pos(월드 좌표)에 고정
  add(element, { obj = null, offset = new THREE.Vector3(), pos = null } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'label';
    wrap.appendChild(element);
    this.el.appendChild(wrap);
    const item = {
      wrap,
      element,
      obj,
      offset,
      pos: pos ? pos.clone() : null,
      visible: true,
      remove: () => {
        wrap.remove();
        this.items.delete(item);
      },
      show: (v) => {
        item.visible = v;
        wrap.style.display = v ? '' : 'none';
      },
    };
    this.items.add(item);
    return item;
  }

  update(camera, w, h) {
    for (const it of this.items) {
      if (!it.visible) continue;
      if (it.obj) {
        if (!it.obj.parent) {
          it.wrap.style.display = 'none';
          continue;
        }
        this.v.copy(it.offset);
        it.obj.localToWorld(this.v);
      } else this.v.copy(it.pos);
      this.v.project(camera);
      if (this.v.z > 1 || this.v.z < -1) {
        it.wrap.style.display = 'none';
        continue;
      }
      it.wrap.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      it.wrap.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
}
