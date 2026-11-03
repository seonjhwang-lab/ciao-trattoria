import * as THREE from 'three';
import { studioBackground } from './Diorama.js';
import { installToon } from './Toon.js';

// 스테인리스·유리 반사용 간단한 실내 환경맵 (r128 코어 PMREM 사용)
export function makeEnvironment(renderer) {
  // v15: 무거운 .hdr 내장 없이, 한 번만 굽는 가벼운 절차적 스튜디오 라이트박스
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), new THREE.MeshBasicMaterial({ color: 0x5a4c40, side: THREE.BackSide }));
  env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x3a2e26 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.9;
  env.add(floor);
  for (const [x, z, w] of [
    [-6, -6, 4],
    [6, 2, 3],
    [0, 7, 5],
  ]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.5), new THREE.MeshBasicMaterial({ color: 0xfff1dc }));
    panel.position.set(x, 3.8, z);
    panel.rotation.x = Math.PI / 2;
    env.add(panel);
  }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ color: 0xdce8f2 }));
  win.position.set(0, 1, -9.9);
  env.add(win);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.04).texture;
  pm.dispose();
  return tex;
}


// 렌더러(ACES 톤매핑·부드러운 그림자) + 쿼터뷰 정사영 카메라 리그
// 조작: 탭 이동(셰프를 부드럽게 따라감) · 핀치/슬라이더 확대 · 90도 스냅 회전 버튼
export class SceneManager {
  constructor(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); // v15: 모바일 웹뷰 VRAM 보호
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true; // 샌드위치 대각선 단면 (클리핑 평면)
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    // 감성 카툰 렌더링: 툰 램프(재질 훅)만. v15: OutlineEffect(메쉬마다 외곽선 복제본을 쌓던 2번째 패스)는 제거
    installToon();

    this.scene = new THREE.Scene();
    this.scene.background = studioBackground();
    this.scene.fog = null;
    this.scene.environment = makeEnvironment(this.renderer);

    // 쿼터뷰 카메라 (정사영)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    // v12: 6x6 매장 전체가 세로 화면 한 장에 들어오는 정면 디오라마 시점으로 고정 (따라다니지 않음)
    // v13: 45° 마름모(다이아몬드) 아이소메트릭 쿼터뷰 — camera (8.5, 9.5, 8.5) → lookAt (0, 0.3, 0)
    this.home = new THREE.Vector3(0, 0.3, 0);
    this.target = this.home.clone();
    this.yaw = Math.PI / 4;
    this.yawTarget = this.yaw;
    this.pitch = Math.atan2(9.2, Math.hypot(8.5, 8.5));
    // 7차: 스마트폰에서도 셰프·손님 표정·테이블 위 음식이 큼직하게 보이도록 기본 1.7배 확대 + 셰프 추적
    this.zoom = 1.7;
    this.zoomTarget = 1.7;
    this.pitchTarget = this.pitch;
    this.goal = this.target.clone();
    this.saved = null;
    this.minZoom = 1.0;
    this.maxZoom = 4.2;
    this.w = window.innerWidth || 800;
    this.h = window.innerHeight || 600;
    // 9차: 조리 중에는 화면 일부(가로 = 왼쪽 68%, 세로 = 위쪽 60%)만 3D 쇼케이스 뷰포트로 쓰고 나머지는 사이드바.
    // 카메라 중심(lookAt)이 그 뷰포트 한가운데에 오도록 정사영 프러스텀을 옮긴다. (rect: 화면 대비 0~1 비율)
    this.rect = { x0: 0, x1: 1, y0: 0, y1: 1 };
    this.rectTarget = { ...this.rect };
    this.halfH = 8.6;
    this.halfW = 8.6 * (this.w / this.h);
    this.resize();
    this.zoom = this.zoomTarget = this.fitZoom();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 2 || h < 2) return; // 숨겨진 창 등 크기가 0일 때는 무시
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h);
    // 짧은 쪽 기준으로 매장(약 16m)이 화면에 들어오게
    const aspect = w / h;
    const half = 8.6;
    this.halfH = aspect >= 1 ? half : half / aspect;
    this.halfW = this.halfH * aspect;
    if (!this.saved && this.zoomTarget !== undefined) this.zoomTarget = this.fitZoom();
    this.applyCamera();
  }

  // v14: 45° 마름모로 돌아간 매장(7x8 + 벽) — 좌우 벽 모서리(화면 가로 약 ±5.5m)가 여백을 두고 들어오는 배율
  fitZoom() {
    return Math.min((2 * this.halfW) / 11.6, (2 * this.halfH) / 11.2);
  }

  applyCamera() {
    const c = this.camera;
    // 뷰포트 중심으로 프러스텀 이동 (줌과 무관한 중심 cx = dx·(1 - 2·fx))
    const r = this.rect;
    const sx = (1 - (r.x0 + r.x1)) * (this.halfW / this.zoom);
    const sy = ((r.y0 + r.y1) - 1) * (this.halfH / this.zoom);
    c.left = -this.halfW + sx;
    c.right = this.halfW + sx;
    c.top = this.halfH + sy;
    c.bottom = -this.halfH + sy;
    c.zoom = this.zoom;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    c.position.copy(this.target).addScaledVector(dir, 50);
    c.lookAt(this.target);
    c.updateProjectionMatrix();
  }

  // 화면 가운데로 따라갈 점 (라이브 모드의 셰프)
  follow() {
    if (this.saved) return;
    this.goal.copy(this.home); // v12: 고정 시점
  }

  // 워크벤치/대화 클로즈업: 한 점을 비스듬히 확대 (가로 width m 가 보이게)
  focus({ target, yaw = this.yawTarget, pitch = 0.95, width = 1 }) {
    if (!this.saved) this.saved = { goal: this.goal.clone(), yaw: this.yawTarget, pitch: this.pitchTarget, zoom: this.zoomTarget };
    this.goal.copy(target);
    const turns = Math.round((this.yawTarget - yaw) / (Math.PI * 2));
    this.yawTarget = yaw + turns * Math.PI * 2;
    this.pitchTarget = pitch;
    const r = this.rectTarget;
    this.zoomTarget = Math.min((2 * this.halfW * (r.x1 - r.x0)) / width, (2 * this.halfH * (r.y1 - r.y0)) / (width * 0.8));
    this.lastFocus = { target: target.clone(), yaw, pitch, width };
  }

  // 3D 뷰포트 영역 지정 (null = 전체 화면). 지정 중이면 마지막 클로즈업 배율도 새 영역에 맞춰 다시 계산
  setViewRect(rect) {
    this.rectTarget = rect ? { ...rect } : { x0: 0, x1: 1, y0: 0, y1: 1 };
    if (this.saved && this.lastFocus) this.focus(this.lastFocus);
  }

  // 화면(px) 기준 3D 뷰포트 중심
  viewCenter() {
    const r = this.rectTarget;
    return { x: ((r.x0 + r.x1) / 2) * this.w, y: ((r.y0 + r.y1) / 2) * this.h };
  }

  unfocus() {
    if (!this.saved) return;
    const s = this.saved;
    this.saved = null;
    this.goal.copy(s.goal);
    this.yawTarget = s.yaw;
    this.pitchTarget = s.pitch;
    this.zoomTarget = s.zoom;
  }

  zoomBy(f) {
    if (this.saved) return;
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * f, this.minZoom, this.maxZoom);
  }

  setZoom(z) {
    if (this.saved) return;
    this.zoomTarget = THREE.MathUtils.clamp(z, this.minZoom, this.maxZoom);
  }

  // 화면 드래그(px) → 바닥 평면 이동 (손가락을 따라 매장이 움직인다)
  panByScreen(dx, dy) {
    const wpp = (2 * this.halfH) / this.zoom / this.h;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * wpp);
    this.target.addScaledVector(fwd, (dy * wpp) / Math.sin(this.pitch));
    this.target.x = THREE.MathUtils.clamp(this.target.x, -9, 9);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -9, 9);
    this.goal.copy(this.target);
  }

  update(dt) {
    // v12 고정 시점: 클로즈업(focus)이 아닐 때는 언제나 매장 전체 정면 뷰로 돌아온다
    if (!this.saved) {
      this.yawTarget = Math.PI / 4;
      this.pitchTarget = Math.atan2(9.2, Math.hypot(8.5, 8.5));
      this.goal.copy(this.home);
      this.zoomTarget = this.fitZoom();
    }
    const k = Math.min(1, dt * (this.saved ? 4.5 : 9));
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.pitch += (this.pitchTarget - this.pitch) * k;
    // 줌은 비율로 보간해야 크게 확대할 때도 부드럽다
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(this.zoomTarget) - Math.log(this.zoom)) * k);
    this.target.lerp(this.goal, Math.min(1, dt * (this.saved ? 4.5 : 3.5)));
    for (const key of ['x0', 'x1', 'y0', 'y1']) this.rect[key] += (this.rectTarget[key] - this.rect[key]) * k;
    if (!Number.isFinite(this.zoom) || this.zoom <= 0) this.zoom = 1;
    this.applyCamera();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
