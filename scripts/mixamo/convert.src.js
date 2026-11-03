// Mixamo FBX → GLB 변환기 (npm run convert-mixamo 가 esbuild 로 묶어 Node 에서 실행)
//  입력: assets-src/mixamo/*.fbx (Mixamo MCP 로 받은 원본)
//  출력: public/assets/models/characters/mixamo_anims.glb — 뼈대(휴지 T-포즈)만 + 공유 클립 7종
//  X Bot 메쉬는 내보내지 않는다 (게임의 몸은 src/core/BodyMesh.js 가 만들어 이 뼈대에 스키닝)
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'node:fs';
import path from 'node:path';

// GLTFExporter 가 기대하는 브라우저 전역 최소 대체
globalThis.window = globalThis;
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = 'data:application/octet-stream;base64,' + Buffer.from(b).toString('base64');
      this.onloadend?.();
    });
  }
}
globalThis.FileReader = NodeFileReader;

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'assets-src', 'mixamo');
const OUT = path.join(ROOT, 'public', 'assets', 'models', 'characters');

// 게임에서 쓰는 이름 · 원본 · 프레임 간격(2 = 15fps) · 최대 길이(초, 넘으면 잘라서 끝을 처음으로 이어 붙임)
const CLIPS = [
  ['Idle', 'xbot_breathing_idle_skin.fbx', 2, 0],
  ['Walk', 'walk_inplace.fbx', 1, 0],
  ['SitIdle', 'sit_idle.fbx', 2, 0],
  ['SitTalk', 'sit_talk.fbx', 2, 12],
  ['Cook', 'cook_touchscreen.fbx', 2, 10],
];

const loader = new FBXLoader();
const load = (f) => {
  const buf = fs.readFileSync(path.join(SRC, f));
  return loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
};

function exportGLB(scene, animations = []) {
  return new Promise((ok) => {
    new GLTFExporter().parse(scene, (r) => ok(Buffer.from(r)), { binary: true, animations, onlyVisible: false });
  });
}

// 키프레임 솎기: step 칸마다 하나 (마지막 키는 유지)
function thin(track, step) {
  if (step <= 1) return track;
  const n = track.times.length;
  const vs = track.getValueSize();
  const keep = [];
  for (let i = 0; i < n; i += step) keep.push(i);
  if (keep[keep.length - 1] !== n - 1) keep.push(n - 1);
  const times = new Float32Array(keep.length);
  const values = new Float32Array(keep.length * vs);
  keep.forEach((k, j) => {
    times[j] = track.times[k];
    for (let c = 0; c < vs; c++) values[j * vs + c] = track.values[k * vs + c];
  });
  return new track.constructor(track.name, times, values);
}

// 긴 클립을 maxLen 초로 자르고, 마지막 0.6초 동안 첫 프레임 자세로 섞어 이음새 없이 반복되게 한다
function trimLoop(track, maxLen) {
  if (!maxLen || track.times[track.times.length - 1] <= maxLen) return track;
  const vs = track.getValueSize();
  let n = track.times.findIndex((t) => t > maxLen);
  if (n < 0) n = track.times.length;
  const times = track.times.slice(0, n);
  const values = track.values.slice(0, n * vs);
  const end = times[n - 1];
  const isQ = track.name.endsWith('.quaternion');
  const q0 = new THREE.Quaternion().fromArray(values, 0);
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const w = THREE.MathUtils.smoothstep(times[i], end - 0.6, end);
    if (w <= 0) continue;
    if (isQ) {
      q.fromArray(values, i * vs).slerp(q0, w);
      q.toArray(values, i * vs);
    } else for (let c = 0; c < vs; c++) values[i * vs + c] += (values[c] - values[i * vs + c]) * w;
  }
  return new track.constructor(track.name, times, values);
}

// 제자리 보정: Hips 위치의 수평(x,z) 직선 이동분을 빼서 루트 모션으로 좌표를 이탈하지 않게 한다
// (Mixamo 의 In Place 가 다운로드에 반영되지 않은 경우의 안전장치. 좌우 흔들림·상하 바운스는 유지)
function stripRootMotion(track, name) {
  if (track.name !== 'mixamorigHips.position') return track;
  const v = track.values;
  const n = track.times.length;
  const T = track.times[n - 1] - track.times[0] || 1;
  const dx = v[(n - 1) * 3] - v[0];
  const dz = v[(n - 1) * 3 + 2] - v[2];
  if (Math.hypot(dx, dz) < 20) return track; // 20cm 미만이면 이미 제자리
  console.log(`  ${name}: 루트 모션 ${Math.hypot(dx, dz).toFixed(0)}cm 제거`);
  const out = v.slice();
  for (let i = 0; i < n; i++) {
    const u = (track.times[i] - track.times[0]) / T;
    out[i * 3] -= dx * u;
    out[i * 3 + 2] -= dz * u;
  }
  return new track.constructor(track.name, track.times.slice(), out);
}

// ── 1) 베이스 메쉬 ──
const base = load('xbot_breathing_idle_skin.fbx');
base.animations = [];
let verts = 0;
const bones = new Set();
base.traverse((o) => {
  if (o.isSkinnedMesh) {
    verts += o.geometry.attributes.position.count;
    o.skeleton.bones.forEach((b) => bones.add(b.name));
    // 게임에서 염색하므로 uv·색 정보는 빼고 위치·법선·스킨만 남긴다
    for (const k of Object.keys(o.geometry.attributes)) {
      if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) o.geometry.deleteAttribute(k);
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => new THREE.MeshStandardMaterial({ name: m.name, color: m.color ?? 0xffffff }));
    if (o.material.length === 1) o.material = o.material[0];
    console.log(`  mesh ${o.name}: ${o.geometry.attributes.position.count} verts, ${o.geometry.index ? o.geometry.index.count / 3 : '?'} tris`);
  }
});
console.log(`base: ${verts} verts, ${bones.size} bones`);
// 메쉬마다 따로 생긴 뼈대 사본을 첫 메쉬의 뼈대 하나로 합친다 (이름으로 재바인딩)
{
  const meshes = [];
  base.traverse((o) => o.isSkinnedMesh && meshes.push(o));
  const primary = new Set(meshes[0].skeleton.bones);
  const byName = new Map(meshes[0].skeleton.bones.map((b) => [b.name, b]));
  const orphans = new Set();
  for (const m of meshes.slice(1)) {
    const bones = m.skeleton.bones.map((b) => {
      const p = byName.get(b.name);
      if (p && p !== b) orphans.add(b);
      return p ?? b;
    });
    m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
  }
  // 고아 뼈대의 최상위만 떼어내면 하위도 함께 빠진다
  for (const b of orphans) if (!b.parent?.isBone || !orphans.has(b.parent)) b.parent?.remove(b);
  let n = 0;
  base.traverse((o) => o.isBone && n++);
  console.log(`  merged skeleton: ${n} bones in scene (primary ${primary.size})`);
}
fs.mkdirSync(OUT, { recursive: true });

// ── 2) 공유 클립 ──
const clips = [];
for (const [name, file, step, maxLen] of CLIPS) {
  const src = load(file);
  // 스킨 포함 파일에는 빈 'Take 001' 이 먼저 들어 있으므로 가장 긴 클립을 쓴다
  const clip = [...src.animations].sort((a, b) => b.duration - a.duration)[0];
  if (!clip) throw new Error('클립 없음: ' + file);
  // 회전은 전부, 위치는 Hips 만, 스케일은 버린다
  const tracks = clip.tracks
    .filter((t) => t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position')
    .map((t) => stripRootMotion(t, name))
    .map((t) => trimLoop(t, maxLen))
    .map((t) => thin(t, step))
    .map((t) => t.optimize());
  const c = new THREE.AnimationClip(name, maxLen ? Math.min(maxLen, clip.duration) : clip.duration, tracks);
  c.resetDuration();
  const hips = tracks.find((t) => t.name === 'mixamorigHips.position');
  console.log(`  ${name}: ${clip.duration.toFixed(2)}s, ${tracks.length} tracks, hips0=${hips ? [...hips.values.slice(0, 3)].map((v) => v.toFixed(1)).join(',') : '-'}`);
  clips.push(c);
}
// ── 3) 쟁반 서빙: 상체 마스킹 ──
// Mixamo 의 Carrying/Holding 클립은 물건을 옆구리나 한쪽에 드는 동작이라 쟁반과 맞지 않는다.
// 하체·척추·머리는 Walk/Idle 그대로, 양팔(어깨~손가락)만 Cook(태블릿을 양손으로 받친 자세) 첫 프레임으로 고정해 합성한다.
const ARMS = /^mixamorig(Left|Right)(Shoulder|Arm|ForeArm|Hand)/;
const byName = Object.fromEntries(clips.map((c) => [c.name, c]));
function holdArms(name, lower, hold) {
  const keep = lower.tracks.filter((t) => !ARMS.test(t.name.split('.')[0]));
  const arms = hold.tracks
    .filter((t) => ARMS.test(t.name.split('.')[0]))
    .map((t) => {
      const vs = t.getValueSize();
      const v0 = t.values.slice(0, vs);
      const values = new Float32Array(vs * 2);
      values.set(v0, 0);
      values.set(v0, vs);
      return new t.constructor(t.name, new Float32Array([0, lower.duration]), values);
    });
  const c = new THREE.AnimationClip(name, lower.duration, [...keep, ...arms]);
  console.log(`  ${name}: ${lower.name} 하체 + ${hold.name} 팔 (${arms.length} arm tracks)`);
  return c;
}
clips.push(holdArms('CarryWalk', byName.Walk, byName.Cook), holdArms('CarryIdle', byName.Idle, byName.Cook));

// 뼈대만 남긴 장면에 클립을 붙여 내보낸다
const rig = base.clone(true);
const drop = [];
rig.traverse((o) => o.isMesh && drop.push(o));
drop.forEach((o) => o.parent.remove(o));
fs.writeFileSync(path.join(OUT, 'mixamo_anims.raw.glb'), await exportGLB(rig, clips));
console.log('done');
