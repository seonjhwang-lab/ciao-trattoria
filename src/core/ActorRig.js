import * as THREE from 'three';
import { kit } from './Kit.js';
import { randomLook, buildHead } from './Character.js';
import { SkeletonUtils } from './skeleton.js';
import { mixamoKit } from './AssetLoader.js';
import { buildBodyGeometry } from './BodyMesh.js';

// ─────────────────────────────────────────────────────────────
// 심즈풍 리그 캐릭터 (셰프 + 모든 손님)
//  · 뼈대·애니메이션: Mixamo mixamorig 스켈레톤 + mixamo_anims.glb 의 공유 클립 1세트
//    (SkeletonUtils.clone 으로 손님마다 복제, 캐릭터별 AnimationMixer)
//  · 몸: X Bot 메쉬는 쓰지 않는다. BodyMesh.js 가 셔츠·바지·소매·신발·앞치마·코트를
//    이음새 없는 일체형 관으로 만들어 같은 뼈대에 스키닝 → 관절 구슬이 보이지 않는다
//  · 재질: 공용 템플릿을 mat.clone() 해 캐릭터마다 분리, 손님 외모 색은 정점 색
//  · 머리: 게임 공용 얼굴·헤어(buildHead)를 머리 뼈에 부착
// ─────────────────────────────────────────────────────────────
const FADE = 0.22;
const SEAT_HIP = 0.1; // 앉았을 때 고관절이 좌석 윗면보다 높은 정도 (m)
const SEAT_BACK = -0.1; // 좌석 중심 대비 엉덩이 위치 (+z 가 테이블 쪽)
const SEAT_ROOT_DROP = 0.75; // CafeAI.seatPose 가 루트를 좌석 높이보다 내리는 양 (0.78 - 0.03)
const WALK_REF = 1.15; // 키 1.62m 기준 제자리 걷기 클립 1배속이 표현하는 이동 속도 (m/s)
const FACE = { y: 168.2, z: 0.6, width: 20.5 }; // 리그 cm: 얼굴 중심·폭

const BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.74, metalness: 0 });
BODY_MAT.envMapIntensity = 0.5;
const OVER_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
OVER_MAT.envMapIntensity = 0.45;

// ── 리그 분석 (1회): 휴지 자세 뼈 위치 · 앉은 자세 엉덩이 위치 ──
let base = null;
function analyze(K) {
  if (base) return base;
  const scene = K.base;
  scene.updateMatrixWorld(true);
  const rest = new Map();
  scene.traverse((o) => {
    if (o.name.startsWith('mixamorig')) rest.set(o.name.slice(9), o.getWorldPosition(new THREE.Vector3()));
  });
  const P = (n) => rest.get(n)?.clone() ?? new THREE.Vector3();
  // 앉은 자세 엉덩이 위치 (SitIdle 첫 프레임을 임시 복제본에 적용해 측정)
  let sitHips = null;
  const sitClip = K.clips.SitIdle;
  if (sitClip && SkeletonUtils) {
    const t = SkeletonUtils.clone(scene);
    const mixer = new THREE.AnimationMixer(t);
    mixer.clipAction(sitClip).play();
    mixer.update(0);
    t.updateMatrixWorld(true);
    sitHips = t.getObjectByName('mixamorigHips').getWorldPosition(new THREE.Vector3());
    mixer.stopAllAction();
  }
  base = { P, sitHips };
  return base;
}

// 리그 캐릭터 생성. 키트가 없으면 null (호출 측이 관절형 캐릭터로 대체)
export function buildRigPawn(look = {}) {
  const K = mixamoKit();
  if (!K || !SkeletonUtils) return null;
  const B = analyze(K);
  const L = { ...randomLook(), ...look };
  const k = kit;

  // 뼈대 복제 (휴지 자세, 원점) → 일체형 몸 스키닝
  const model = SkeletonUtils.clone(K.base);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const bones = [];
  model.traverse((o) => o.name.startsWith('mixamorig') && bones.push(o));
  const byName = new Map(bones.map((b, i) => [b.name.slice(9), i]));
  const { body: gBody, over: gOver } = buildBodyGeometry(B.P, L, (n) => byName.get(n) ?? -1);
  const skeleton = new THREE.Skeleton(bones);
  const skinned = [];
  for (const [g, tmpl] of [
    [gBody, BODY_MAT],
    [gOver, OVER_MAT],
  ]) {
    if (!g) continue;
    const m = new THREE.SkinnedMesh(g, tmpl.clone());
    // 9차: 겉옷은 깊이 오프셋을 걸어 몸통과 같은 깊이에서도 항상 바깥이 이긴다
    if (tmpl === OVER_MAT) {
      m.material.polygonOffset = true;
      m.material.polygonOffsetFactor = -1.5;
      m.material.polygonOffsetUnits = -4;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false; // 애니메이션 중 바운딩이 어긋나 깜빡이는 것 방지
    model.add(m);
    m.updateMatrixWorld(true);
    m.bind(skeleton, m.matrixWorld);
    skinned.push(m);
  }

  // 얼굴: 키 계산에 머리끝(헤어 포함)까지 넣는다
  const { head: face, eyes } = buildHead(L);
  const F = FACE.width / 0.288;
  const faceBox = new THREE.Box3().setFromObject(face);
  const topRig = FACE.y + faceBox.max.y * F;

  // 키 1.55~1.68m (외모 height 0.93~1.06 비례), 발바닥 y=0
  const hScale = THREE.MathUtils.clamp(L.height ?? 1, 0.93, 1.06);
  const H = 1.55 + (hScale - 0.93);
  const s = H / topRig;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(s);
  const baseY = 0;
  body.add(model);
  root.add(body);
  root.updateMatrixWorld(true);

  // 뼈에 장식 붙이기: 루트 기준(미터) 위치에 놓은 뒤 bone.attach 로 월드 변환을 유지한 채 옮긴다
  const toRoot = (x, y, z) => new THREE.Vector3(x * s, y * s + baseY, z * s);
  const bone = (n) => model.getObjectByName('mixamorig' + n);
  const attach = (obj, boneName) => {
    root.add(obj);
    obj.updateMatrixWorld(true);
    bone(boneName).attach(obj);
  };
  face.scale.setScalar(F * s);
  face.position.copy(toRoot(0, FACE.y, FACE.z));
  attach(face, 'Head');

  // 목도리
  if (L.scarf) {
    const sc = new THREE.Group();
    sc.add(k.at(k.torus(7.4 * s, 2.5 * s, k.fabric(L.scarf)), 0, 0, 0, Math.PI / 2));
    sc.add(k.at(k.rbox(5.5 * s, 15 * s, 1.8 * s, k.fabric(L.scarf), { r: 0.008 }), 3.2 * s, -8 * s, 6.8 * s, 0.12, 0, 0.12));
    sc.position.copy(toRoot(0, 150.5, -2.6));
    attach(sc, 'Neck');
  }
  // 셰프 재킷 더블 단추
  if (L.jacket) {
    const bm = k.mat('#2a2a2a', { rough: 0.35 });
    for (const sx of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const y = 137 - i * 6;
        const g = k.sphere(0.6 * s * 1.6, bm);
        const z = y >= 134 ? 9.4 : y >= 129 ? 10.1 : 10.9;
        g.position.copy(toRoot(sx * 4.6, y, z));
        attach(g, 'Spine2');
      }
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // 애니메이션: 공유 클립 → 캐릭터별 믹서 액션
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [name, clip] of Object.entries(K.clips)) actions[name] = mixer.clipAction(clip);
  const sit = B.sitHips
    ? { y: SEAT_HIP + SEAT_ROOT_DROP - (B.sitHips.y * s + baseY), z: SEAT_BACK - B.sitHips.z * s }
    : { y: 0, z: 0 };

  const rig = {
    mixer,
    actions,
    current: null,
    offY: 0,
    offZ: 0,
    sit,
    baseY,
    walkRef: WALK_REF * (H / 1.62),
    bones: {
      head: bone('Head'),
      lh: bone('LeftHand'),
      rh: bone('RightHand'),
      spine: bone('Spine2'),
      la: bone('LeftArm'),
      ra: bone('RightArm'),
      lf: bone('LeftForeArm'),
      rf: bone('RightForeArm'),
    },
    play(name) {
      const next = actions[name] ?? actions.Idle;
      if (!next || next === this.current) return;
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      if (this.current) this.current.crossFadeTo(next, FADE, true);
      this.current = next;
      this.state = name;
    },
  };
  rig.play('Idle');
  actions.Idle.time = Math.random() * actions.Idle.getClip().duration;

  const head = new THREE.Object3D(); // CafeAI 가 고개 돌림(rotation.y)을 써 넣는 자리
  return { root, body, head, eyes, legs: [], arms: [], rig, look: L, model, faceTex: face.userData.face ?? null };
}

const _q = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// Actor.animate 에서 매 프레임 호출
export function updateRig(actor, dt) {
  const p = actor.pawn;
  const rig = p.rig;
  const walking = actor.path.length > 0 || actor.manual > 0.05;
  const pose = actor.pose;
  const sitting = pose === 'sit' || pose === 'eat';
  const want = walking
    ? pose === 'carry'
      ? 'CarryWalk'
      : 'Walk'
    : pose === 'carry'
      ? 'CarryIdle'
      : pose === 'work'
        ? 'Cook'
        : sitting
          ? actor.talking
            ? 'SitTalk'
            : 'SitIdle'
          : 'Idle';
  rig.play(want);

  // 걷기 속도에 맞춰 발 구르기 속도 조절, 발소리용 위상
  const act = rig.current;
  if (walking && act) {
    const eff = actor.path.length ? actor.speed : actor.speed * Math.max(0.45, actor.manual);
    act.setEffectiveTimeScale(THREE.MathUtils.clamp(eff / rig.walkRef, 0.55, 2.1));
    actor.phase = (act.time / act.getClip().duration) * Math.PI * 2;
  } else if (act) act.setEffectiveTimeScale(1);

  // 의자 착석 보정 (엉덩이가 좌석 위, 무릎이 테이블 앞에 오도록)
  const kk = 1 - Math.exp(-dt / 0.1);
  rig.offY += ((sitting ? rig.sit.y : 0) - rig.offY) * kk;
  rig.offZ += ((sitting ? rig.sit.z : 0) - rig.offZ) * kk;
  p.body.position.set(0, rig.baseY + rig.offY, rig.offZ);

  rig.mixer.update(dt);

  // 고개 돌림 (클립 위에 더한다)
  const yaw = p.head.rotation.y;
  if (yaw && rig.bones.head) rig.bones.head.quaternion.multiply(_q.setFromAxisAngle(_y, yaw * 0.8));

  // 손님 제스처 (클립 위에 덧씌우는 상체 모션): 취향 저격 환호 · 첫 입 시식
  const gs = actor.gesture;
  if (gs) {
    if (gs.type === 'cheer' || gs.type === 'eat') gs.t += dt;
    applyGesture(actor, rig, gs);
    if (gs.dur && gs.t >= gs.dur) actor.gesture = null;
  }

  // v12 캔버스 얼굴: 표정(idle · talk · delighted · eating · satisfied) + 깜빡임 · 입 모양
  p.faceTex?.update(dt, actor.expression ?? 'idle');
  // 눈 깜빡임
  actor.blink -= dt;
  if (p.eyes) {
    const closed = actor.blink < 0.12 && actor.blink > 0;
    for (const e of p.eyes) e.scale.y = closed ? 0.15 : 1;
    if (actor.blink <= 0) actor.blink = 2.5 + Math.random() * 3.5;
  }

  // 쟁반: 양손 중점에 붙여 걸음 바운스를 그대로 따라가게
  const tray = actor.tray;
  if (tray?.visible && rig.bones.lh && rig.bones.rh) {
    p.root.updateWorldMatrix(true, true);
    rig.bones.lh.getWorldPosition(_a);
    rig.bones.rh.getWorldPosition(_b);
    _a.add(_b).multiplyScalar(0.5);
    p.root.worldToLocal(_a);
    _a.y += 0.035;
    _a.z += 0.1; // 손은 쟁반 안쪽 가장자리를 받치고, 쟁반은 몸 앞으로
    if (tray.userData.rigged) tray.position.lerp(_a, 1 - Math.exp(-dt / 0.03));
    else tray.position.copy(_a);
    tray.userData.rigged = true;
    tray.rotation.set(0, 0, 0);
  } else if (tray) tray.userData.rigged = false;
}

// 월드 기준 축으로 뼈를 돌린다 (뼈마다 로컬 축이 달라도 '몸 앞쪽으로 들기' 같은 동작을 같은 식으로)
const _pq = new THREE.Quaternion();
const _wq = new THREE.Quaternion();
const _ax = new THREE.Vector3();
function rotateWorld(b, axisRoot, angle, root) {
  if (!b || !angle) return;
  _ax.copy(axisRoot).applyQuaternion(root.quaternion).normalize();
  b.parent.getWorldQuaternion(_pq);
  _wq.setFromAxisAngle(_ax, angle);
  // q_local' = parent⁻¹ · R · parent · q_local
  const inv = _pq.clone().invert();
  b.quaternion.premultiply(_pq).premultiply(_wq).premultiply(inv);
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
function applyGesture(actor, rig, gs) {
  const B = rig.bones;
  const root = actor.root;
  root.updateWorldMatrix(true, true);
  if (gs.type === 'cheer') {
    // 0.25s 에 들어와서 끝에서 0.35s 동안 빠진다
    const w = Math.min(1, gs.t / 0.25) * Math.min(1, Math.max(0, (gs.dur - gs.t) / 0.35));
    const clap = Math.abs(Math.sin(gs.t * 9)); // 짝짝짝
    rotateWorld(B.spine, X, (-0.12 - 0.06 * Math.sin(gs.t * 9)) * w, root);
    rotateWorld(B.head, X, Math.sin(gs.t * 8) * 0.32 * w, root); // 크게 끄덕
    // 양팔을 가슴 앞으로 모아 손뼉
    rotateWorld(B.la, X, -1.05 * w, root);
    rotateWorld(B.ra, X, -1.05 * w, root);
    rotateWorld(B.la, Y, (-0.55 - 0.25 * clap) * w, root);
    rotateWorld(B.ra, Y, (0.55 + 0.25 * clap) * w, root);
    rotateWorld(B.lf, Y, (-0.9 - 0.2 * clap) * w, root);
    rotateWorld(B.rf, Y, (0.9 + 0.2 * clap) * w, root);
  } else if (gs.type === 'eat') {
    // 3.5초 먹방: 약 1.1초마다 접시에서 입가로 한 입, 씹으며 고개를 끄덕
    const t = gs.t;
    const w = Math.min(1, t / 0.35) * Math.min(1, Math.max(0, ((gs.dur ?? 3.5) - t) / 0.35));
    const cyc = (t % 1.1) / 1.1;
    const lift = Math.sin(Math.min(1, cyc / 0.55) * Math.PI) ; // 들었다 내림
    const up = cyc < 0.55 ? lift : 0;
    const nod = Math.sin(t * 9) * 0.07 * (cyc > 0.45 ? 1 : 0.3);
    rotateWorld(B.ra, X, (-0.45 - 0.6 * up) * w, root);
    rotateWorld(B.ra, Y, 0.3 * w, root);
    rotateWorld(B.rf, Y, (0.6 + 0.75 * up) * w, root);
    rotateWorld(B.rf, Z, -0.3 * up * w, root);
    rotateWorld(B.la, X, -0.35 * w, root); // 왼손은 접시 옆에
    rotateWorld(B.head, X, (0.16 - 0.08 * up + nod) * w, root);
    rotateWorld(B.spine, X, 0.06 * w, root);
  } else if (gs.type === 'taste') {
    // 오른손으로 포크/잔을 입가로 (0~0.6s 들어 올림, 끝 0.4s 내림)
    const t = gs.t;
    const w = Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (2.6 - t) / 0.4));
    const chew = Math.sin(t * 7) * 0.06 * w;
    rotateWorld(B.ra, X, -0.95 * w, root);
    rotateWorld(B.ra, Y, 0.35 * w, root);
    rotateWorld(B.rf, Y, 1.25 * w, root);
    rotateWorld(B.rf, Z, -0.35 * w, root);
    rotateWorld(B.head, X, (0.12 + chew) * w, root);
  }
}
