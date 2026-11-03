import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// 감성 카툰 렌더링 (8차)
//  1) 툰 램프: 모든 MeshStandard/Physical 재질의 직사광(디퓨즈)을 부드러운 4단(0 · 1/3 · 2/3 · 1) 밴드로 양자화한다.
//     재질을 바꿔 끼우지 않고 프로토타입 셰이더 훅으로 넣어서, 캐릭터 스키닝 · 조리 중 색이 바뀌는 음식 재질도 그대로 동작한다.
//  (v15: OutlineEffect 잉크 외곽선은 모바일 메모리 문제로 제거했다)
// ─────────────────────────────────────────────────────────────
const TOON_GLSL = /* glsl */ `
{
  // 직사광 세기(재질 색 대비)를 3~4단 셀 밴드로 — 경계는 살짝 부드럽게
  float base = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  float dl = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)) / base;
  float x = dl * 3.0;
  float band = (floor(x) + smoothstep(0.38, 0.62, fract(x))) / 3.0;
  reflectedLight.directDiffuse *= band / max(dl, 1e-3);
  // 하이라이트는 또렷한 한 점으로 (약한 반사는 지운다)
  float sl = dot(reflectedLight.directSpecular, vec3(0.3333));
  reflectedLight.directSpecular *= smoothstep(0.06, 0.12, sl);
}
`;

let installed = false;
export function installToon() {
  if (installed) return;
  installed = true;
  const P = THREE.MeshStandardMaterial.prototype;
  P.onBeforeCompile = function (shader) {
    if (this.userData?.noToon) return;
    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `${TOON_GLSL}\n#include <aomap_fragment>`);
  };
  P.customProgramCacheKey = function () {
    return this.userData?.noToon ? 'std' : 'toon-ramp-4';
  };
}
