import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 하이브리드 에셋 로더
//  1) 3D 모델: public/assets/models/manifest.json 에 있는 .glb (Kenney CC0). 단일 파일 빌드에서는 base64 로 내장된 모델을 쓴다.
//  2) 텍스처 슬롯: public/assets/textures/manifest.json 에 등록된 .png (Aseprite 로 그린 단면·잼·초상화·타일 등).
//     파일이 없으면 각 슬롯은 절차적 Canvas 텍스처로 대체된다.
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
const models = new Map();
const images = new Map();
const pixelSlots = new Set();
const characters = [];

function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function json(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function preloadAssets() {
  const loader = new GLTFLoader();
  const parse = (buf) => new Promise((ok, fail) => loader.parse(buf, '', (g) => ok(g.scene), fail));

  // 모델
  const embedded = window.__EMBEDDED_MODELS;
  if (embedded) {
    for (const [name, b64] of Object.entries(embedded)) {
      try {
        models.set(name, await parse(b64ToBuffer(b64)));
      } catch (e) {
        console.warn('[AssetLoader] 내장 모델 실패', name, e?.message);
      }
    }
  } else {
    const man = await json(BASE + 'assets/models/manifest.json');
    await Promise.all(
      (man?.files ?? []).map(async (f) => {
        try {
          const res = await fetch(BASE + 'assets/models/' + f);
          if (res.ok) models.set(f.replace(/^kenney\//, '').replace(/\.glb$/, ''), await parse(await res.arrayBuffer()));
        } catch (e) {
          console.warn('[AssetLoader] 모델 실패', f, e?.message);
        }
      }),
    );
  }

  // 캐릭터 GLB 슬롯 (public/assets/models/characters/ — Mixamo 등)
  const parseFull = (buf) => new Promise((ok, fail) => loader.parse(buf, '', ok, fail));
  const charBufs = [];
  if (window.__EMBEDDED_CHARACTERS) {
    for (const [name, b64] of Object.entries(window.__EMBEDDED_CHARACTERS)) charBufs.push([name, b64ToBuffer(b64)]);
  } else {
    const cman = await json(BASE + 'assets/models/characters/manifest.json');
    for (const f of cman?.files ?? []) {
      try {
        const res = await fetch(BASE + 'assets/models/characters/' + f);
        if (res.ok) charBufs.push([f, await res.arrayBuffer()]);
      } catch {
        /* 무시 */
      }
    }
  }
  for (const [name, buf] of charBufs) {
    try {
      const gltf = await parseFull(buf);
      characters.push({ name, scene: gltf.scene, animations: gltf.animations ?? [] });
    } catch (e) {
      console.warn('[AssetLoader] 캐릭터 GLB 실패', name, e?.message);
    }
  }

  // 텍스처 슬롯
  const tman = window.__EMBEDDED_TEXTURES ? null : await json(BASE + 'assets/textures/manifest.json');
  for (const p of tman?.pixel ?? []) pixelSlots.add(p.replace(/\.png$/, ''));
  await Promise.all(
    (tman?.files ?? []).map(
      (f) =>
        new Promise((ok) => {
          const img = new Image();
          img.onload = () => {
            images.set(f.replace(/\.png$/, ''), img);
            ok();
          };
          img.onerror = ok;
          img.src = BASE + 'assets/textures/' + f;
        }),
    ),
  );
  console.info(`[AssetLoader] 모델 ${models.size}개 · 캐릭터 ${characters.length}개 · 커스텀 텍스처 ${images.size}개`);
}


export function characterModels() {
  return characters;
}

// Mixamo 키트: 뼈대 + 공유 클립이 든 GLB 하나 → { base: 뼈대 장면(휴지 T-포즈), clips: { Idle, Walk, ... } }
// (X Bot 메쉬는 쓰지 않는다. 몸은 BodyMesh.js 가 만들어 이 뼈대에 스키닝)
let kitCache;
export function mixamoKit() {
  if (kitCache !== undefined) return kitCache;
  const lib = characters.find((c) => c.animations.length && c.scene.getObjectByName('mixamorigHips'));
  kitCache = lib ? { base: lib.scene, clips: Object.fromEntries(lib.animations.map((a) => [a.name, a])) } : null;
  if (characters.length) console.info(`[AssetLoader] Mixamo 리그 ${kitCache ? Object.keys(kitCache.clips).join('/') : '없음 → 관절형 캐릭터'}`);
  return kitCache;
}

export function hasModel(name) {
  return models.has(name);
}

// 모델 복제본. Kenney 재질 이름(wood, metal, carpet, plant…)을 현실 톤 재질로 바꿔 끼운다.
export function cloneModel(name, remap) {
  const src = models.get(name);
  if (!src) return null;
  const obj = src.clone(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => remap?.(m.name, m) ?? m);
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return obj;
}

// 모델을 원하는 높이/바닥 크기에 맞춘다 (바닥 y=0, 가운데 정렬)
export function fitModel(obj, { height = null, maxW = 0.95, maxD = 0.95 } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  let s = height ? height / Math.max(1e-4, size.y) : 1;
  s = Math.min(s, maxW / Math.max(1e-4, size.x), maxD / Math.max(1e-4, size.z));
  obj.scale.multiplyScalar(s);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y;
  const g = new THREE.Group();
  g.add(obj);
  g.userData.height = box.max.y - box.min.y;
  return g;
}

// 텍스처 슬롯: 커스텀 PNG 가 있으면 그것을, 없으면 make() 가 그린 캔버스를 쓴다
export function slotTexture(name, make) {
  const img = images.get(name);
  let tex;
  if (img) {
    tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    if (pixelSlots.has(name)) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
    }
  } else tex = new THREE.CanvasTexture(make());
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  return tex;
}

// 2D 캔버스용 (초상화 등)
export function slotImage(name) {
  return images.get(name) ?? null;
}
