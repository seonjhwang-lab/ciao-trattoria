import * as THREE from 'three';

// 나폴리 장작 화덕(Forno a Legna) 공용 모델: 헤링본으로 쌓은 테라코타 벽돌 돔 + 구리 연통 + 아치형 석재 입구
// 워크벤치(클로즈업)와 매장 스테이션이 같은 모델을 쓴다. 원점 = 화덕 바닥 중심, 입구는 +z.
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
let brickTex = null;
// 9차: 돔 UV(가로 = 둘레, 세로 = 바닥→꼭대기)에 맞춘 '가로 줄쌓기' 벽돌. 헤링본은 구면에서 격자처럼 일그러져 보였다.
export function brickTexture() {
  if (brickTex) return brickTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#cdb595'; // 줄눈 (따뜻한 석회 모르타르)
  g.fillRect(0, 0, 512, 256);
  const tones = ['#b84a27', '#a9431f', '#c35a2f', '#9c3d1d', '#b9552d', '#ad4a25', '#c2643a'];
  const rows = 8;
  const bh = 256 / rows;
  const per = 4; // 한 줄에 벽돌 4장 (repeat.x 로 둘레를 채운다)
  const bw = 512 / per;
  const gap = 3;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let i = -1; i <= per; i++) {
      const x = i * bw + off + gap / 2;
      const y = r * bh + gap / 2;
      const w = bw - gap;
      const h = bh - gap;
      g.fillStyle = tones[(n++ * 3 + r) % tones.length];
      g.beginPath();
      g.roundRect ? g.roundRect(x, y, w, h, 3) : g.rect(x, y, w, h);
      g.fill();
      // 벽돌 결: 위 밝은 테두리 · 아래 그림자 · 점 얼룩
      g.fillStyle = 'rgba(255,215,170,0.16)';
      g.fillRect(x + 2, y + 1, w - 4, 3);
      g.fillStyle = 'rgba(60,20,10,0.22)';
      g.fillRect(x + 2, y + h - 4, w - 4, 3);
      for (let k = 0; k < 14; k++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(70,25,10,0.18)' : 'rgba(240,180,130,0.14)';
        g.fillRect(x + Math.random() * w, y + Math.random() * h, 2 + Math.random() * 4, 1 + Math.random() * 2);
      }
    }
  }
  // 아래쪽(입구 높이)은 그을음으로 살짝 거뭇하게, 꼭대기는 열에 바래 밝게
  const soot = g.createLinearGradient(0, 0, 0, 256);
  soot.addColorStop(0, 'rgba(255,235,210,0.12)');
  soot.addColorStop(0.7, 'rgba(40,20,10,0)');
  soot.addColorStop(1, 'rgba(40,20,10,0.16)');
  g.fillStyle = soot;
  g.fillRect(0, 0, 512, 256);
  brickTex = new THREE.CanvasTexture(c);
  brickTex.encoding = THREE.sRGBEncoding;
  brickTex.wrapS = THREE.RepeatWrapping;
  brickTex.wrapT = THREE.ClampToEdgeWrapping;
  brickTex.repeat.set(3, 1);
  brickTex.anisotropy = 4;
  brickTex.userData = { shared: true };
  return brickTex;
}

let stoneTex = null;
function volcanicTexture() {
  if (stoneTex) return stoneTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5b5550';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(30,26,24,0.5)' : 'rgba(150,140,130,0.35)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  stoneTex = new THREE.CanvasTexture(c);
  stoneTex.encoding = THREE.sRGBEncoding;
  stoneTex.userData = { shared: true };
  return stoneTex;
}

// 반구 돔에서 입구 아치 자리 삼각형을 뺀다
function domeWithMouth(R, mouthW, mouthH, segW = 48, segH = 24) {
  const geo = new THREE.SphereGeometry(R, segW, segH, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
  const p = geo.attributes.position;
  const keep = [];
  const inArch = (x, y, z) => z > 0 && Math.abs(x) < mouthW / 2 && y < mouthH - (mouthH * 0.35 * (2 * x) ** 2) / (mouthW * mouthW);
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (!inArch(cx, cy, cz)) keep.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name];
    const arr = new Float32Array(keep.length * 3 * a.itemSize);
    keep.forEach((i, k) => {
      for (let v = 0; v < 3; v++) for (let j = 0; j < a.itemSize; j++) arr[(k * 3 + v) * a.itemSize + j] = a.array[(i + v) * a.itemSize + j];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}

// detail: 'bench'(클로즈업: 장작 · 숯불 · 불꽃 · 불티) | 'shop'(매장)
export function buildForno({ R = 0.3, mouthW = 0.32, mouthH = 0.2, detail = 'bench' } = {}) {
  const g = new THREE.Group();
  const brick = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.85 });
  const inner = new THREE.MeshStandardMaterial({ color: lin('#5a2a18'), roughness: 0.95, side: THREE.BackSide, emissive: lin('#ff6a2a'), emissiveIntensity: 0.18 });
  // 석재: 안쪽 터널 벽이 새까맣게 죽지 않도록 아주 약한 온기(emissive)
  const stone = new THREE.MeshStandardMaterial({ color: lin('#ddd2bf'), roughness: 0.8, emissive: lin('#3a2416'), emissiveIntensity: 0.35 });
  const domeGeo = domeWithMouth(R, mouthW, mouthH);
  const dome = new THREE.Mesh(domeGeo, brick);
  dome.castShadow = true;
  g.add(dome);
  const domeIn = new THREE.Mesh(domeWithMouth(R - 0.03, mouthW, mouthH), inner);
  g.add(domeIn);
  // 바닥: 화산석
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.014, 48), new THREE.MeshStandardMaterial({ map: volcanicTexture(), roughness: 0.9 }));
  floor.position.y = 0.007;
  g.add(floor);
  // 꼭대기 석회 캡 (구면 극점의 벽돌 몰림을 덮는다)
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(R + 0.006, 32, 6, 0, Math.PI * 2, 0, 0.36), stone);
  g.add(capTop);
  // 9차 입구: 기둥 상자 대신 하나로 이어진 매끈한 석재 아치 포털(U자 단면을 앞뒤로 압출).
  // 포털 뒤쪽이 돔 벽 안으로 파고들어 돔과 입구 사이 틈(검은 사각형)이 생기지 않는다. 안쪽 벽이 곧 아치형 터널.
  const Wh = mouthW / 2 + 0.07;
  const springY = mouthH * 0.62;
  const H1 = mouthH * 0.55;
  const ryo = mouthH * 0.62;
  const frame = new THREE.Shape();
  frame.moveTo(-Wh, 0);
  frame.lineTo(-mouthW / 2, 0);
  frame.lineTo(-mouthW / 2, springY);
  for (let i = 1; i < 24; i++) {
    const t = Math.PI - (i / 24) * Math.PI;
    frame.lineTo(Math.cos(t) * (mouthW / 2), springY + Math.sin(t) * mouthH * 0.38);
  }
  frame.lineTo(mouthW / 2, springY);
  frame.lineTo(mouthW / 2, 0);
  frame.lineTo(Wh, 0);
  frame.lineTo(Wh, H1);
  for (let i = 1; i < 24; i++) {
    const t = (i / 24) * Math.PI;
    frame.lineTo(Math.cos(t) * Wh, H1 + Math.sin(t) * ryo);
  }
  frame.lineTo(-Wh, H1);
  frame.lineTo(-Wh, 0);
  const depth = 0.17;
  const zBack = R - 0.12;
  const portalGeo = new THREE.ExtrudeGeometry(frame, { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 12 });
  const portal = new THREE.Mesh(portalGeo, stone);
  portal.position.z = zBack;
  portal.castShadow = true;
  portal.receiveShadow = true;
  g.add(portal);
  // 아치 키스톤 + 정면 테두리 띠 (석재 디테일)
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), stone);
  key.position.set(0, mouthH + 0.034, zBack + depth + 0.008);
  g.add(key);
  // 터널 바닥: 화산석 판이 입구 앞까지 이어진다 (포털 아래가 비어 보이지 않게)
  const tunnelFloor = new THREE.Mesh(new THREE.BoxGeometry(mouthW + 0.004, 0.014, depth + 0.1), new THREE.MeshStandardMaterial({ map: volcanicTexture(), roughness: 0.9 }));
  tunnelFloor.position.set(0, 0.007, zBack + depth / 2 - 0.05);
  g.add(tunnelFloor);
  // 앞쪽 석재 랜딩 (피자 필을 걸치는 턱)
  const landing = new THREE.Mesh(new THREE.BoxGeometry(Wh * 2 + 0.02, 0.022, 0.09), stone);
  landing.position.set(0, 0.011, zBack + depth + 0.045);
  g.add(landing);
  const topY = H1 + ryo;
  // 구리 연통 (포털 위)
  const copper = new THREE.MeshStandardMaterial({ color: lin('#b87333'), metalness: 0.8, roughness: 0.35 });
  const flueZ = zBack + depth * 0.45;
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 20), copper);
  flue.position.set(0, topY + 0.15, flueZ);
  g.add(flue);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.05, 20), copper);
  cap.position.set(0, topY + 0.34, flueZ);
  g.add(cap);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.03, 20), copper);
  collar.position.set(0, topY - 0.005, flueZ);
  g.add(collar);
  // 10차 장작불: 왼쪽 · 안쪽 · 오른쪽 세 무더기 + 안쪽 둘레 전체를 따라 이글거리는 숯불 → 화덕 안이 고르게 뜨겁게
  const fire = { flames: [], embers: [], sparks: [], lights: [], light: null, t: 0, spots: [] };
  const logMat = new THREE.MeshStandardMaterial({ color: lin('#5b3a22'), roughness: 0.9 });
  const charMat = new THREE.MeshStandardMaterial({ color: lin('#2a1a12'), roughness: 1, emissive: lin('#ff4a10'), emissiveIntensity: 0.35 });
  const bench = detail === 'bench';
  const spots = [
    [-R * 0.62, -R * 0.18, 0.5],
    [0, -R * 0.66, 0],
    [R * 0.62, -R * 0.18, -0.5],
  ].map(([x, z, rot]) => ({ x, z, rot }));
  fire.spots = spots;
  for (const sp of spots) {
    for (let i = 0; i < (bench ? 3 : 2); i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.12, 10), i % 2 ? charMat : logMat);
      log.rotation.set(Math.PI / 2, 0, sp.rot + i * 0.9);
      log.position.set(sp.x + Math.cos(i * 1.9) * 0.018, 0.026 + Math.floor(i / 2) * 0.024, sp.z + Math.sin(i * 1.9) * 0.014);
      g.add(log);
    }
  }
  const emberMat = new THREE.MeshStandardMaterial({ color: lin('#ff5a1a'), emissive: lin('#ff3a00'), emissiveIntensity: 1.6, roughness: 0.6 });
  const nEmb = bench ? 46 : 16;
  for (let i = 0; i < nEmb; i++) {
    // 안쪽 둘레(뒤쪽 반원 + 양옆)를 따라
    const a = Math.PI * (0.95 + (i / nEmb) * 1.1) + (Math.random() - 0.5) * 0.12;
    const r = R * (0.62 + Math.random() * 0.22);
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.005 + Math.random() * 0.006, 0), emberMat);
    e.position.set(Math.cos(a) * r, 0.016, Math.sin(a) * r);
    e.userData.noOutline = true;
    g.add(e);
    fire.embers.push(e);
  }
  const flameMats = ['#ffe08a', '#ffb347', '#ff7a2a'].map((c, i) => new THREE.MeshBasicMaterial({ color: lin(c), transparent: true, opacity: 0.85 - i * 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const sp of spots)
    for (let i = 0; i < (bench ? 6 : 3); i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.02 - (i % 3) * 0.004, 0.09 + (i % 3) * 0.045, 10, 1, true), flameMats[i % 3]);
      f.position.set(sp.x + Math.cos(i * 2.3) * 0.03, 0.07, sp.z + Math.sin(i * 2.3) * 0.025);
      f.userData.base = f.position.clone();
      f.userData.ph = Math.random() * 6;
      g.add(f);
      fire.flames.push(f);
    }
  for (const sp of [spots[0], spots[2]]) {
    const l = new THREE.PointLight(lin('#ff8a3c'), bench ? 0.9 : 0.5, R * 3, 2);
    l.position.set(sp.x * 0.7, 0.12, sp.z * 0.5);
    g.add(l);
    fire.lights.push(l);
  }
  fire.light = fire.lights[0];
  if (bench) {
    const sparkMat = new THREE.MeshBasicMaterial({ color: lin('#ffcf6a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 4), sparkMat.clone());
      s.userData.t = Math.random();
      g.add(s);
      fire.sparks.push(s);
    }
  }
  fire.fx = spots[0].x;
  fire.fz = spots[0].z;
  fire.inner = inner;
  g.userData.fire = fire;
  g.userData.mouthZ = zBack + depth;
  g.userData.innerZ = zBack;
  g.userData.mouthW = mouthW;
  return g;
}

// 불꽃 일렁임 · 숯불 맥동 · 불티 (bench 의 update 에서 호출)
export function updateForno(oven, dt, hot = 1) {
  const f = oven.userData.fire;
  if (!f) return;
  f.t += dt;
  const t = f.t;
  for (const fl of f.flames) {
    const ph = fl.userData.ph;
    fl.scale.set(1 + Math.sin(t * 9 + ph) * 0.15, (0.8 + Math.sin(t * 13 + ph) * 0.25 + Math.sin(t * 23 + ph * 2) * 0.1) * (0.7 + hot * 0.4), 1);
    fl.position.x = fl.userData.base.x + Math.sin(t * 7 + ph) * 0.004;
    fl.rotation.z = Math.sin(t * 5 + ph) * 0.12;
  }
  for (const e of f.embers) e.material.emissiveIntensity = 1.3 + Math.sin(t * 6) * 0.3 * hot;
  for (const s of f.sparks) {
    s.userData.t += dt * (0.5 + hot * 0.6);
    if (s.userData.t > 1) {
      s.userData.t = 0;
      const sp = f.spots[Math.floor(Math.random() * f.spots.length)] ?? { x: f.fx, z: f.fz };
      s.userData.x = sp.x + (Math.random() - 0.5) * 0.06;
      s.userData.z = sp.z + (Math.random() - 0.5) * 0.06;
    }
    const u = s.userData.t;
    s.position.set((s.userData.x ?? f.fx) + Math.sin(u * 9) * 0.01, 0.06 + u * 0.2, (s.userData.z ?? f.fz) + u * 0.04);
    s.material.opacity = 1 - u;
  }
  f.lights.forEach((l, i) => (l.intensity = (0.7 + hot * 0.5) + Math.sin(t * 17 + i * 2) * 0.13 + Math.sin(t * 29 + i) * 0.07));
  f.inner.emissiveIntensity = 0.14 + hot * 0.14 + Math.sin(t * 9) * 0.03;
}
