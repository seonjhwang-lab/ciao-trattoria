import * as THREE from 'three';
import { lin } from './Kit.js';

// 시간대별 채광: 오전 자연광 → 오후 오렌지빛 노을 → 저녁엔 실외가 어두워지고 2700K 전구가 켜진다
// 키프레임(분 단위)을 보간하고, 값이 갑자기 바뀌어도(22시→7시) 부드럽게 따라가도록 스무딩한다.
// 8차 카툰 톤: 쨍하게 날아가지 않도록 노출 0.95 · 태양광 1.05로 낮추고, 반구광을 살짝 올려 그림자가 탁해지지 않게
// 그림자가 시커멓게 죽지 않는 화사한 파스텔 음영. 저녁에도 실내가 칙칙해지지 않게 하늘빛을 높게 유지한다.
const KEYS = [
  { t: 420, az: 105, el: 14, sun: '#ffe7cc', si: 0.89, sky: '#fff7ee', gnd: '#e3cfb3', hi: 0.99, bg: '#e8dfd5', lamp: 0.3, moon: 0, exp: 0.93 },
  { t: 540, az: 130, el: 34, sun: '#fff6e5', si: 1.05, sky: '#fffdf9', gnd: '#e6d2b5', hi: 1.06, bg: '#e8dfd5', lamp: 0, moon: 0, exp: 0.95 },
  { t: 720, az: 175, el: 56, sun: '#fff6e5', si: 1.05, sky: '#fffdf9', gnd: '#e6d2b5', hi: 1.06, bg: '#e8dfd5', lamp: 0, moon: 0, exp: 0.95 },
  { t: 900, az: 222, el: 40, sun: '#fff2df', si: 1.05, sky: '#fffcf6', gnd: '#e6d0b0', hi: 1.06, bg: '#e8dfd5', lamp: 0, moon: 0, exp: 0.95 },
  { t: 1035, az: 250, el: 20, sun: '#ffdcae', si: 1.01, sky: '#fff1e2', gnd: '#e6c9a5', hi: 1.01, bg: '#e6d8c8', lamp: 0.2, moon: 0, exp: 0.94 },
  { t: 1125, az: 262, el: 8, sun: '#ffb47e', si: 0.74, sky: '#f2dccb', gnd: '#cfb196', hi: 0.92, bg: '#dccbbb', lamp: 0.7, moon: 0.05, exp: 0.92 },
  { t: 1185, az: 266, el: 2, sun: '#e48c66', si: 0.31, sky: '#c4bbd0', gnd: '#a8968a', hi: 0.81, bg: '#c9bfc4', lamp: 1, moon: 0.25, exp: 0.9 },
  { t: 1250, az: 266, el: -6, sun: '#8090c0', si: 0.0, sky: '#9ca2c4', gnd: '#827a74', hi: 0.74, bg: '#b8b6c4', lamp: 1, moon: 0.35, exp: 0.9 },
  { t: 1320, az: 266, el: -6, sun: '#8090c0', si: 0.0, sky: '#969cbe', gnd: '#7c7470', hi: 0.72, bg: '#b3b1c0', lamp: 1, moon: 0.35, exp: 0.9 },
];

// LP 무드별 조명 덧씌우기 (시간대 조명 위에 섞는다)
const MOOD_LIGHT = {
  acoustic: { si: 1.12, hi: 1.05, sun: '#fff0d6', sunMix: 0.25, sky: '#f2e6d2', skyMix: 0.2, lamp: 0, exp: 1.03, beam: 1.15 },
  rain: { si: 0.22, hi: 0.95, sun: '#a9b8c8', sunMix: 0.8, sky: '#8e9cad', skyMix: 0.65, lamp: 0.55, exp: 0.94, beam: 0.08 },
  lofi: { si: 0.4, hi: 0.72, sun: '#ff9a5a', sunMix: 0.55, sky: '#8a6a5a', skyMix: 0.45, lamp: 1, exp: 1.0, beam: 0.35 },
  off: null,
};

function sample(min) {
  let i = 0;
  while (i < KEYS.length - 1 && KEYS[i + 1].t <= min) i++;
  const a = KEYS[i];
  const b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const u = b.t === a.t ? 0 : THREE.MathUtils.clamp((min - a.t) / (b.t - a.t), 0, 1);
  const mix = (x, y) => x + (y - x) * u;
  const col = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), u);
  return {
    az: mix(a.az, b.az),
    el: mix(a.el, b.el),
    sun: col(a.sun, b.sun),
    si: mix(a.si, b.si),
    sky: col(a.sky, b.sky),
    gnd: col(a.gnd, b.gnd),
    hi: mix(a.hi, b.hi),
    bg: col(a.bg, b.bg),
    lamp: mix(a.lamp, b.lamp),
    moon: mix(a.moon, b.moon),
    exp: mix(a.exp, b.exp),
  };
}

export class DayCycle {
  constructor(sm) {
    this.sm = sm;
    const scene = sm.scene;
    this.hemi = new THREE.HemisphereLight(0xfffdf9, 0xe6d2b5, 1.06);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff6e5, 1.05);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(512, 512); // v15: 모바일 VRAM
    Object.assign(this.sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    this.moon = new THREE.DirectionalLight(lin('#8ea4d8'), 0);
    this.moon.position.set(-12, 20, -8);
    scene.add(this.moon);
    this.cur = null;
    this.lampFactor = 0;
    this.glowMats = []; // 밤에 빛나는 재질(이웃 창문·간판 등)
    this.focus = null; // 워크벤치 클로즈업 중심
    this.shadowSize = 15;
    this.mood = 'off';
    this.beamMul = 1;
  }

  setMood(m) {
    this.mood = m;
  }

  addGlow(material, base = 1) {
    material.userData.glowBase = base;
    this.glowMats.push(material);
  }

  update(dt, minutes, lamps) {
    const target = sample(minutes);
    const M = MOOD_LIGHT[this.mood];
    if (M) {
      target.si *= M.si;
      target.hi *= M.hi;
      target.sun.lerp(new THREE.Color(M.sun), M.sunMix);
      target.sky.lerp(new THREE.Color(M.sky), M.skyMix);
      target.lamp = Math.max(target.lamp, M.lamp);
      target.exp *= M.exp;
    }
    this.beamMul += ((M?.beam ?? 1) - this.beamMul) * Math.min(1, dt * 2.5);
    this.siMul = (this.siMul ?? 1) + ((M?.si ?? 1) - (this.siMul ?? 1)) * Math.min(1, dt * 2.5);
    if (!this.cur) this.cur = target;
    const k = Math.min(1, dt * 2.5);
    const c = this.cur;
    for (const key of ['az', 'el', 'si', 'hi', 'lamp', 'moon', 'exp']) c[key] += (target[key] - c[key]) * k;
    for (const key of ['sun', 'sky', 'gnd', 'bg']) c[key].lerp(target[key], k);

    const az = THREE.MathUtils.degToRad(c.az);
    const el = THREE.MathUtils.degToRad(Math.max(c.el, 3));
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const center = this.focus ?? new THREE.Vector3();
    const size = this.focus ? 1.4 : 15;
    if (size !== this.shadowSize) {
      this.shadowSize = size;
      Object.assign(this.sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size });
      this.sun.shadow.camera.updateProjectionMatrix();
      this.sun.shadow.bias = this.focus ? -0.0002 : -0.0005;
      this.sun.shadow.normalBias = this.focus ? 0.004 : 0.03;
    }
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).add(dir.multiplyScalar(30));
    this.sun.color.copy(c.sun).convertSRGBToLinear();
    this.sun.intensity = c.si * (this.focus ? 0.85 : 1);
    this.hemi.color.copy(c.sky).convertSRGBToLinear();
    this.hemi.groundColor.copy(c.gnd).convertSRGBToLinear();
    // 워크벤치 클로즈업: 가까이서 보는 음식·크롬이 하얗게 날아가지 않도록 살짝 낮춘다
    const fx = this.focus ? 0.82 : 1;
    this.hemi.intensity = c.hi * fx;
    this.moon.intensity = c.moon;
    this.sm.renderer.toneMappingExposure = c.exp * (this.focus ? 0.9 : 1);
    this.lampFactor = c.lamp;
    this.sunFactor = Math.min(1.2, Math.max(0, Math.min(1, c.si / Math.max(0.1, this.siMul) / 1.05)) * Math.max(0, Math.min(1, (c.el + 2) / 12)) * this.beamMul);

    for (const l of lamps) {
      const on = l.userData.enabled ? l.userData.enabled() : true;
      l.intensity = on ? l.userData.base * c.lamp : 0;
    }
    for (const m of this.glowMats) m.emissiveIntensity = m.userData.glowBase * c.lamp;
  }

  get isNight() {
    return (this.cur?.lamp ?? 0) > 0.6;
  }
}
