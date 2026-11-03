import * as THREE from 'three';

// 아주 작은 트윈: 위치/회전/스케일을 부드럽게 옮긴다
export class Tweens {
  constructor() {
    this.list = [];
  }

  to(obj, { pos, quat, scale, dur = 0.45, arc = 0, delay = 0, onDone } = {}) {
    this.list = this.list.filter((t) => t.obj !== obj);
    this.list.push({
      obj,
      t: -delay,
      dur,
      arc,
      p0: obj.position.clone(),
      p1: pos ? pos.clone() : null,
      q0: obj.quaternion.clone(),
      q1: quat ? quat.clone() : null,
      s0: obj.scale.clone(),
      s1: scale ? scale.clone() : null,
      onDone,
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.t += dt;
      if (t.t < 0) continue;
      const u = Math.min(1, t.t / t.dur);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      if (t.p1) {
        t.obj.position.lerpVectors(t.p0, t.p1, e);
        t.obj.position.y += Math.sin(u * Math.PI) * t.arc;
      }
      if (t.q1) THREE.Quaternion.slerp(t.q0, t.q1, t.obj.quaternion, e);
      if (t.s1) t.obj.scale.lerpVectors(t.s0, t.s1, e);
      if (u >= 1) {
        this.list.splice(i, 1);
        t.onDone?.();
      }
    }
  }

  get busy() {
    return this.list.length > 0;
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

// 골든존 점수: 구간 안이면 90~100, 벗어날수록 낮아진다 (최저 15)
export function zoneScore(v, [lo, hi]) {
  const half = (hi - lo) / 2;
  const c = (lo + hi) / 2;
  if (v >= lo && v <= hi) return Math.round(100 - (Math.abs(v - c) / half) * 10);
  const d = v < lo ? lo - v : v - hi;
  return Math.max(15, Math.round(88 - (d / (hi - lo)) * 45));
}

export function scoreWord(s) {
  if (s >= 95) return '완벽해요';
  if (s >= 85) return '아주 좋아요';
  if (s >= 70) return '좋아요';
  if (s >= 50) return '괜찮아요';
  return '아쉬워요';
}
