import { GRID_W, GRID_D } from './GridSystem.js';

// 2D 그리드 A* (8방향, 모서리 끼어들기 금지). 목표 칸은 의자처럼 막혀 있어도 도착 허용.
export function findPath(start, goal, walkable) {
  const [sx, sz] = start;
  const [gx, gz] = goal;
  if (sx === gx && sz === gz) return [[sx, sz]];
  const key = (x, z) => z * GRID_W + x;
  const inside = (x, z) => x >= 0 && z >= 0 && x < GRID_W && z < GRID_D;
  const canEnter = (x, z) => inside(x, z) && ((x === gx && z === gz) || walkable(x, z));
  const h = (x, z) => {
    const dx = Math.abs(x - gx);
    const dz = Math.abs(z - gz);
    return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  const g = new Map([[key(sx, sz), 0]]);
  const came = new Map();
  const open = [{ x: sx, z: sz, f: h(sx, sz) }];
  const closed = new Set();

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.z);
    if (closed.has(ck)) continue;
    if (cur.x === gx && cur.z === gz) {
      const path = [[gx, gz]];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k);
        path.unshift([k % GRID_W, Math.floor(k / GRID_W)]);
      }
      return path;
    }
    closed.add(ck);
    for (const [dx, dz, cost] of dirs) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      if (!canEnter(nx, nz)) continue;
      if (dx && dz && !(walkable(cur.x + dx, cur.z) && walkable(cur.x, cur.z + dz))) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const ng = g.get(ck) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, z: nz, f: ng + h(nx, nz) });
      }
    }
  }
  return null;
}
