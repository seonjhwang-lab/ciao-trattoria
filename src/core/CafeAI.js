import * as THREE from 'three';
import { Actor, buildTray } from './Actors.js';
import { kit } from './Kit.js';
import { findPath } from './Pathfinding.js';
import { tileCenter, worldToTile, DOOR_TILE, GRID_W, GRID_D } from './GridSystem.js';
import { registry } from './PackRegistry.js';
import { bus } from './EventBus.js';
import { gradeFor, payment } from './Grading.js';
import { GuestGenerator } from './GuestGenerator.js';
import { icon } from '../ui/icons.js';
import { releaseFace } from './FaceTextureBuilder.js';
import { clampLine } from '../ui/clampLine.js';
import { reactionsOn } from './Settings.js';
import { getProgress, GUESTS_PER_DAY, Progress, LEVEL_NAME } from './Progress.js';

// 1인 오너 셰프 카페.
// 손님: 입장 → 착석 → 대화를 기다림 → (셰프가 다가가 대화·주문) → 기다림 → (셰프가 직접 서빙) → 감상 → 퇴장
// 셰프: 바닥·손님·조리대를 탭하면 A* 로 걸어가고, 도착하면 바로 대화/서빙/워크벤치로 이어진다.
// v14: 현관 마당 없음. 출입문은 왼쪽(서쪽) 높은 벽에 있고, 손님은 그 벽 뒤에서 나타나 문턱을 넘어 들어온다
const SILL_X = -GRID_W / 2 - 0.05; // 문턱 (벽 두께 가운데쯤)
const OUT_X = -GRID_W / 2 - 0.6; // 벽 바깥 — 높은 벽에 가려 카메라에 보이지 않는다
const HALF = GRID_W / 2 - 0.14;
const EAT_TIME = 10;
// v12 먹방: 포크/컵을 들어 접시 → 입으로 반복하며 오물오물 먹는 시간 / 다 먹고 박수 · 품평 · 팁
// v15: 리액션 OFF 면 짧게 (게임이 막힘없이)
const tasteTime = () => (reactionsOn() ? 3.5 : 1.4);
const afterTime = () => (reactionsOn() ? 3.2 : 0.9);
const TALK_RANGE = 1.6;
const STATION_RANGE = 1.35;
const CHEF_SPEED = 2.3;
let uid = 1;

export const ORDER_STATUS = { accepted: '조리 전', cooking: '조리 중', ready: '서빙 대기' };

export class CafeAI {
  constructor({ scene, grid, furniture, state, effects, labels, sound, dialogue }) {
    Object.assign(this, { scene, grid, furniture, state, effects, labels, sound, dialogue });
    this.customers = [];
    this.orders = [];
    this.spawnTimer = 3;
    this.root = new THREE.Group();
    this.root.name = 'people';
    scene.add(this.root);
    this.walkable = (x, z) => this.grid.isWalkable(x, z);
    this.door = tileCenter(...DOOR_TILE);
    this.guests = new GuestGenerator(state);
    this.chef = this.makeChef();
    this.marker = this.makeMarker();
    this.tableDishes = new Map(); // '테이블id:의자id' → 테이블 위 완성 요리 메쉬
    this.props = this.makeProps();
  }

  // ───────── 테이블 위 접시 (손님이 일어서면 반드시 치운다) ─────────
  dishKey(table, chair) {
    return `${table.id}:${chair?.id ?? '*'}`;
  }

  placeTableDish(seat, dish) {
    const key = this.dishKey(seat.table, seat.chair);
    this.clearTableDish(seat.table, seat.chair);
    this.scene.add(dish);
    this.tableDishes.set(key, dish);
  }

  // 테이블의 완성 요리를 씬에서 빼고 GPU 메모리까지 정리한다 (chair 를 주면 그 자리만)
  clearTableDish(table, chair = null) {
    if (!table) return 0;
    let n = 0;
    for (const [key, dish] of [...this.tableDishes]) {
      if (!key.startsWith(`${table.id}:`)) continue;
      if (chair && key !== this.dishKey(table, chair)) continue;
      dish.parent?.remove(dish);
      disposeObject(dish);
      this.tableDishes.delete(key);
      n++;
    }
    for (const c of this.customers) if (c.dish && !c.dish.parent) c.dish = null;
    return n;
  }

  // 손님 손에 드는 시식 소품 (포크 · 잔)
  makeProps() {
    const k = kit;
    const steel = k.metal('steel');
    const fork = k.group(
      k.at(k.box(0.006, 0.11, 0.003, steel), 0, 0.055, 0),
      ...[-1, 0, 1].map((i) => k.at(k.box(0.0014, 0.03, 0.0016, steel), i * 0.0035, 0.125, 0)),
    );
    const cup = k.group(k.at(k.cyl(0.032, 0.025, 0.06, k.ceramic('#f2ede4'), { seg: 18 }), 0, 0.03, 0), k.at(k.torus(0.014, 0.004, k.ceramic('#f2ede4')), 0.036, 0.032, 0));
    return { fork, cup };
  }

  toast(m) {
    bus.emit('toast', m);
  }

  changed() {
    bus.emit('orders:changed');
  }

  // ───────── 공용 ─────────
  bubble(actor, y = 1.95) {
    const el = document.createElement('div');
    el.className = 'bubble';
    const lab = this.labels.add(el, { obj: actor.root, offset: new THREE.Vector3(0, y, 0) });
    lab.show(false);
    return {
      el,
      set(html, cls = '') {
        if (el.innerHTML !== html) el.innerHTML = html;
        el.className = 'bubble ' + cls;
        lab.show(true);
      },
      hide: () => lab.show(false),
      remove: () => lab.remove(),
    };
  }

  actorTile(a) {
    const p = a.root.position;
    const [x, z] = worldToTile(p.x, p.z);
    if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_D) return DOOR_TILE;
    return [x, z];
  }

  exitPath(a) {
    const tiles = findPath(this.actorTile(a), DOOR_TILE, this.walkable) ?? [DOOR_TILE];
    return [...tiles.map(([x, z]) => tileCenter(x, z)), new THREE.Vector3(SILL_X, 0, this.door.z), new THREE.Vector3(OUT_X, 0, this.door.z)];
  }

  homeTile() {
    // v13: 셰프는 패스 카운터 안쪽, 마스터 조리대 바로 앞(주방)에서 대기한다
    const master = [...this.furniture.items.values()].find((i) => i.def.station === 'master');
    if (master) {
      const t = this.furniture.frontTile(master);
      if (t && t[1] <= 1) return [2, t[1]];
      return [2, 1];
    }
    const counter = [...this.furniture.items.values()].find((i) => i.def.counter);
    if (counter) return this.furniture.frontTile(counter);
    return [2, 1];
  }

  available() {
    // v12: 통합 마스터 조리대 하나 + 해금한 설비의 메뉴만
    const types = this.furniture.stationTypes();
    const P = getProgress();
    if (types.has('master') && P) return registry.recipesForStations(new Set(P.stations()));
    return registry.recipesForStations(types);
  }

  freeSeats() {
    const taken = new Set(this.customers.filter((c) => c.seat).map((c) => c.seat.chair.id));
    return this.furniture.seats().filter((s) => !taken.has(s.chair.id));
  }

  isInUse(id) {
    if (this.customers.some((c) => c.seat && (c.seat.chair.id === id || c.seat.table.id === id))) return true;
    return this.orders.some((o) => o.station?.id === id && o.status === 'cooking');
  }

  customerFromObject(obj) {
    let o = obj;
    while (o) {
      if (o.userData.customerId) return this.customers.find((c) => c.id === o.userData.customerId) ?? null;
      o = o.parent;
    }
    return null;
  }

  // v18 의자 옆 접근 지점: 의자 칸의 좌/우(없으면 뒤) 빈 칸, 그 칸 안에서 의자 바로 옆 위치
  seatApproach(seat, from) {
    const [fx, fz] = seat.facing;
    const [tx, tz] = seat.tile;
    const px = -fz;
    const pz = fx; // 의자 기준 오른쪽
    const c = tileCenter(tx, tz);
    const opts = [
      { d: [px, pz], side: true },
      { d: [-px, -pz], side: true },
      { d: [-fx, -fz], side: false },
    ];
    let best = null;
    for (const o of opts) {
      const nt = [tx + o.d[0], tz + o.d[1]];
      if (!this.walkable(...nt)) continue;
      const path = from ? findPath(from, nt, this.walkable) : [nt];
      if (!path) continue;
      if (!best || path.length < best.path.length) best = { ...o, tile: nt, path };
    }
    if (!best) return null;
    // 옆이면: 의자 옆 0.55m · 테이블 쪽으로 0.1m (의자를 뒤로 빼도 부딪히지 않는 자리)
    // 뒤면: 의자 뒤 0.62m · 옆으로 0.4m (빼낸 의자를 비켜 선다)
    const pt = best.side
      ? c.clone().add(new THREE.Vector3(best.d[0] * 0.55 + fx * 0.1, 0, best.d[1] * 0.55 + fz * 0.1))
      : c.clone().add(new THREE.Vector3(-fx * 0.62 + px * 0.4, 0, -fz * 0.62 + pz * 0.4));
    return { ...best, point: pt };
  }

  // 의자 3D 를 뒤(테이블 반대쪽)로 k 미터 뺀 위치로
  setChairOffset(seat, k) {
    const obj = seat.chair.object;
    if (!obj) return;
    if (!obj.userData.base) obj.userData.base = obj.position.clone();
    const b = obj.userData.base;
    obj.position.set(b.x - seat.facing[0] * k, b.y, b.z - seat.facing[1] * k);
    seat.chair.pulled = k;
  }

  // 의자 혼자 움직이는 짧은 애니메이션 (손님이 떠난 뒤 의자를 넣는 마무리 등)
  animChair(seat, to, dur) {
    this.chairAnims = (this.chairAnims ?? []).filter((x) => x.seat.chair !== seat.chair);
    this.chairAnims.push({ seat, from: seat.chair.pulled ?? 0, to, dur, t: 0 });
  }

  stepChairs(dt) {
    if (!this.chairAnims?.length) return;
    for (const a of this.chairAnims) {
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      const e = u * u * (3 - 2 * u);
      this.setChairOffset(a.seat, a.from + (a.to - a.from) * e);
    }
    this.chairAnims = this.chairAnims.filter((a) => a.t < a.dur);
  }

  // 앉은 자세 위치 (의자를 k 만큼 뺀 상태 기준)
  seatPoseAt(seat, k) {
    const p = this.seatPose(seat);
    p.pos.x -= seat.facing[0] * k;
    p.pos.z -= seat.facing[1] * k;
    return p;
  }

  // 빼낸 의자와 테이블 사이, 앉기 직전에 서는 자리
  standSpot(seat) {
    const v = tileCenter(...seat.tile);
    v.x += seat.facing[0] * 0.1;
    v.z += seat.facing[1] * 0.1;
    v.y = 0;
    return v;
  }

  seatPose(seat) {
    const v = tileCenter(...seat.tile);
    v.x += seat.facing[0] * 0.08;
    v.z += seat.facing[1] * 0.08;
    v.y = (seat.chair.def.seatHeight ?? 0.47) + 0.03 - 0.78;
    return { pos: v, yaw: Math.atan2(seat.facing[0], seat.facing[1]) };
  }

  dishSpot(seat) {
    const v = tileCenter(...seat.tableTile);
    v.x -= seat.facing[0] * 0.24;
    v.z -= seat.facing[1] * 0.24;
    v.y = seat.table.def.surfaceHeight ?? 0.75;
    return v;
  }

  stationPoint(st) {
    return tileCenter(...this.furniture.frontTile(st));
  }

  // ───────── 손님 ─────────
  interval() {
    return 22 - this.state.reputation * 0.08 + Math.random() * 6;
  }

  trySpawn() {
    const P = getProgress();
    if (P && P.p.dayGuests >= GUESTS_PER_DAY) return false; // 오늘 영업 손님 다 받음
    const present = new Set(this.customers.map((c) => c.persona.id));
    const available = this.available();
    if (!available.length) return false;
    this.state.presentNames = this.customers.map((c) => c.persona.name);
    const seats = this.freeSeats().sort(() => Math.random() - 0.5);
    for (const seat of seats) {
      const ap = this.seatApproach(seat, DOOR_TILE);
      if (!ap) continue;
      const tiles = ap.path;
      const persona = this.guests.next(available, present);
      const a = new Actor(persona.look, { speed: 1.3 });
      // 벽 뒤에서 제 키 그대로 걸어 들어온다 (바닥에서 솟아오르는 연출 없음)
      a.root.position.set(OUT_X, 0, this.door.z);
      a.root.rotation.y = Math.PI / 2;
      a.setPath([new THREE.Vector3(SILL_X, 0, this.door.z), ...tiles.map(([x, z]) => tileCenter(x, z)), ap.point]);
      const c = { id: uid++, actor: a, persona, state: 'walkIn', seat, approach: ap, t: 0, order: null, dish: null };
      // v12: 보이지 않는 넉넉한 터치 원기둥 (손님 몸의 약 2.2배) — 대충 근처만 눌러도 손님으로 인식
      a.root.add(hitbox(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 12), 1.2));
      a.root.traverse((o) => (o.userData.customerId = c.id));
      c.bubble = this.bubble(a);
      c.bubble.el.addEventListener('click', () => bus.emit('customer:tap', c));
      this.root.add(a.root);
      this.customers.push(c);
      if (P) P.p.dayGuests += 1;
      return true;
    }
    return false;
  }

  updateCustomer(c, dt) {
    const a = c.actor;
    c.t += dt;
    if (c.exprT > 0) c.exprT -= dt;
    const baseExpr = { talking: 'talk', served: 'eating', satisfied: 'satisfied' }[c.state] ?? 'idle';
    a.expression = c.exprT > 0 ? c.expr : baseExpr;
    a.talking = c.state === 'awaitTalk' || c.state === 'talking' || c.state === 'served';
    switch (c.state) {
      case 'walkIn':
        if (!c.belled && a.root.position.x > SILL_X) {
          c.belled = true;
          this.sound.doorBell();
        }
        if (a.move(dt)) {
          c.state = 'pullChair';
          c.t = 0;
          a.pose = 'idle';
          a.gesture = { type: 'chair', t: 0, dur: 0.75 };
        }
        break;
      case 'pullChair': {
        // 의자 등받이를 잡고 뒤로 스윽 뺀다
        const back = this.standSpot(c.seat).sub(new THREE.Vector3(c.seat.facing[0] * 0.61, 0, c.seat.facing[1] * 0.61));
        a.faceTo(back, dt);
        const u = Math.min(1, Math.max(0, (c.t - 0.12) / 0.5));
        this.setChairOffset(c.seat, 0.36 * u * u * (3 - 2 * u));
        if (c.t >= 0.7) {
          c.state = 'stepIn';
          c.t = 0;
          c.from = a.root.position.clone();
        }
        break;
      }
      case 'stepIn': {
        // 빼낸 의자와 테이블 사이로 들어서며 테이블 쪽으로 돌아선다
        const to = this.standSpot(c.seat);
        const u = Math.min(1, c.t / 0.55);
        a.root.position.lerpVectors(c.from, to, u * u * (3 - 2 * u));
        a.face(this.seatPose(c.seat).yaw, dt, 9);
        a.pose = 'idle';
        a.manual = u < 1 ? 0.6 : 0; // 몇 걸음 옮기는 동안 걷기 동작
        if (u >= 1) {
          c.state = 'sitDown';
          c.t = 0;
          c.from = a.root.position.clone();
        }
        break;
      }
      case 'sitDown': {
        // 빼 둔 의자 위로 천천히 앉는다
        const { pos, yaw } = this.seatPoseAt(c.seat, 0.36);
        const u = Math.min(1, c.t / 0.5);
        a.root.position.lerpVectors(c.from, pos, u * u * (3 - 2 * u));
        a.face(yaw, dt, 14);
        a.pose = 'sit';
        if (u >= 1) {
          c.state = 'scootIn';
          c.t = 0;
          a.gesture = { type: 'chair', t: 0, dur: 0.6, seated: true };
        }
        break;
      }
      case 'scootIn': {
        // 앉은 채로 의자를 테이블 쪽으로 당겨 붙인다 (손님과 의자가 함께)
        const u = Math.min(1, c.t / 0.55);
        const k = 0.36 * (1 - u * u * (3 - 2 * u));
        this.setChairOffset(c.seat, k);
        const { pos, yaw } = this.seatPoseAt(c.seat, k);
        a.root.position.copy(pos);
        a.face(yaw, dt, 14);
        a.pose = 'sit';
        if (u >= 1) {
          // 이전 손님 접시가 남아 있으면 앉기 전에 치운다 (안전장치)
          this.clearTableDish(c.seat.table, c.seat.chair);
          const P = getProgress();
          if (P && P.cozy() >= 2.5 && Math.random() < 0.6) {
            c.bubble.set('<span>우와, 가게 인테리어가 너무 예뻐요!</span>', 'soft');
            c.expr = 'delighted';
            c.exprT = 2.2;
          }
          c.state = 'awaitTalk';
          c.t = 0;
          this.changed();
        }
        break;
      }
      case 'awaitTalk':
        if (c.exprT <= 0 || c.t > 2.2) c.bubble.set(`${icon('chat')}<span>${c.persona.name}</span>`, 'talk');
        a.pawn.head.rotation.y = Math.sin(c.t * 0.6 + c.id) * 0.4;
        break;
      case 'talking':
        a.pawn.head.rotation.y *= 0.9;
        c.bubble.hide();
        break;
      case 'ordered': {
        if (c.sayT > 0) {
          c.sayT -= dt;
          c.bubble.set(`<span>${c.sayText}</span>`, 'soft talkline');
          break;
        }
        const st = c.order.status;
        c.bubble.set(`${icon(c.order.recipe.icon)}<span>${st === 'ready' ? '곧 나와요' : '기다리는 중'}</span>`, 'soft');
        a.pawn.head.rotation.y = Math.sin(c.t * 0.5 + c.id) * 0.3;
        break;
      }
      case 'served': {
        // v12 먹방: 오른손의 포크(음료는 잔)를 접시 → 입가로 반복, 고개를 끄덕이며 오물오물 (약 3.5초)
        a.pose = 'eat';
        if (!a.gesture || a.gesture.type !== 'eat') a.gesture = { type: 'eat', t: 0, dur: tasteTime() };
        this.holdProp(c);
        if (c.dish) c.dish.scale.setScalar(Math.max(0.62, 1 - (c.t / tasteTime()) * 0.38));
        c.fxT = (c.fxT ?? 0) - dt;
        if (c.fxT <= 0) {
          c.fxT = 0.9;
          const head = c.actor.root.position.clone().setY(1.95);
          if (Math.random() < 0.5) this.effects.hearts(head, 2);
          else this.effects.notes(head);
          if (c.dish) this.effects.notes?.(c.dish.position.clone().setY(c.dish.position.y + 0.25));
        }
        if (c.t > tasteTime()) {
          this.dropProp(c);
          a.gesture = null;
          this.react(c);
        }
        break;
      }
      case 'satisfied':
        // 다 먹고 감동한 표정으로 박수 → 일어난다
        a.pose = 'eat';
        if (c.t > 2.4) c.bubble.hide();
        if (c.t >= afterTime()) this.finishVisit(c);
        break;
      case 'scootOut': {
        // 앉은 채로 의자를 뒤로 밀어 일어날 공간을 만든다
        const s = c.leaveSeat;
        const u = Math.min(1, c.t / 0.5);
        const k = 0.36 * u * u * (3 - 2 * u);
        this.setChairOffset(s, k);
        const { pos } = this.seatPoseAt(s, k);
        a.root.position.copy(pos);
        a.pose = 'sit';
        if (u >= 1) {
          c.state = 'standUp';
          c.t = 0;
          c.from = a.root.position.clone();
        }
        break;
      }
      case 'standUp': {
        const s = c.leaveSeat;
        const u = Math.min(1, c.t / 0.45);
        const to = s ? this.standSpot(s) : c.from.clone().setY(0);
        a.root.position.lerpVectors(c.from, to, u * u * (3 - 2 * u));
        a.pose = u < 0.35 ? 'sit' : 'idle';
        if (u >= 1) {
          c.state = s ? 'stepOut' : 'walkOut';
          c.t = 0;
          c.from = a.root.position.clone();
          if (!s) a.setPath(this.exitPath(a));
        }
        break;
      }
      case 'stepOut': {
        // 의자 옆으로 비켜 나와서, 의자 등받이를 잡고 다시 넣어 둔다
        const s = c.leaveSeat;
        const ap = c.approach ?? this.seatApproach(s, null);
        const to = ap?.point ?? c.from;
        const u = Math.min(1, c.t / 0.55);
        a.root.position.lerpVectors(c.from, to, u * u * (3 - 2 * u));
        a.faceTo(to.clone().add(to.clone().sub(c.from)), dt);
        a.pose = 'idle';
        a.manual = u < 1 ? 0.6 : 0; // 몇 걸음 옮기는 동안 걷기 동작
        if (u >= 1 && !c.pushed) {
          c.pushed = true;
          a.gesture = { type: 'chair', t: 0, dur: 0.6 };
          this.animChair(s, 0, 0.5);
        }
        if (u >= 1) a.faceTo(this.standSpot(s), dt);
        if (c.t >= 1.1) {
          a.pose = 'idle';
          a.setPath(this.exitPath(a));
          c.state = 'walkOut';
          c.t = 0;
        }
        break;
      }
      case 'walkOut': {
        const done = a.move(dt);
        // 문 밖(벽 뒤)으로 나가면 끝. 경로가 막혔을 때만 10초 뒤 살짝 작아지며 정리한다
        const outside = a.root.position.x < OUT_X + 0.15;
        if (c.t > 10) a.root.scale.setScalar(Math.max(0.01, a.root.scale.x - dt * 4));
        if (done || outside || c.t > 10.3 || !a.path.length) this.despawn(c);
        break;
      }
    }
    a.animate(dt);
  }

  // 대화창에서 주문이 확정됐을 때
  acceptOrder(c, recipe, option) {
    const order = {
      id: uid++,
      customer: c,
      recipe,
      option,
      steps: registry.stepsFor(recipe, option),
      matched: !!c.talk?.matched,
      optMatched: !!c.talk?.optMatched,
      status: 'accepted',
      result: null,
      station: null,
    };
    c.order = order;
    c.state = 'ordered';
    c.t = 0;
    this.orders.push(order);
    this.sound.tap();
    this.changed();
    return order;
  }

  // 손님 말풍선에 대사를 잠깐 띄운다 (주문 직후 반응 등)
  say(c, text, seconds = 3) {
    c.sayText = clampLine(text); // v16: 말풍선도 28자 이내 1문장
    c.sayT = seconds;
  }

  beginTalk(c) {
    c.state = 'talking';
    c.bubble.hide();
    this.chef.actor.faceTo(c.actor.root.position, 1);
  }

  endTalkWithoutOrder(c) {
    if (c.state === 'talking') c.state = 'awaitTalk';
  }

  react(c) {
    const G = gradeFor(c.order.result.score);
    const price = c.order.recipe.price;
    const matched = c.order.matched;
    let pay = payment(price, G);
    if (matched) pay += Math.round((price * 0.1) / 100) * 100;
    if (c.order.optMatched) pay += Math.round((price * 0.05) / 100) * 100;
    // v12 아늑함 지수 팁 보너스 (★ 하나당 +10%, 최대 +40%)
    const P = getProgress();
    const cozyPct = P ? P.tipBonus() : 0;
    const cozyTip = Math.round((price * cozyPct) / 100 / 100) * 100;
    pay += cozyTip;
    const review = this.dialogue.review(c, G.g);
    const head = c.actor.root.position.clone().setY(2.05);
    this.state.addMoney(pay);
    this.state.addRep(G.rep + (review.special ? 2 : 0) + (c.order.optMatched ? 0.5 : 0));
    this.state.grades[G.g] = (this.state.grades[G.g] ?? 0) + 1;
    this.state.set('served', this.state.served + 1);
    // 미식 품평: 메뉴별 맛 표현 (S/A 는 재료 디테일을 짚는 극찬)
    const critique = tasteLine(c.order.recipe, G.g, c.id);
    const line = review.special ? review.line : critique;
    c.bubble.set(`<b class="g g-${G.g}">${G.g}</b><span>${clampLine(critique)}</span>`, `react react-${G.g}${review.special ? ' special' : ''}`);
    if (G.fx === 'gold') {
      this.effects.goldBurst(head);
      this.effects.hearts(head.clone().add(new THREE.Vector3(0.2, 0.1, 0)), 5);
    } else if (G.fx === 'hearts') {
      this.effects.hearts(head, 5);
      this.effects.goldBurst(head);
    }
    else if (G.fx === 'notes') this.effects.notes(head);
    else this.effects.sweat(head);
    const notes = [G.note];
    if (cozyPct) notes.push(`아늑함 팁 +${cozyPct}%`);
    if (matched) notes.push('취향 적중 +10%');
    if (c.order.optMatched) notes.push('옵션 센스 +5%');
    this.effects.coin(head.clone().setY(2.6), pay, notes.join(' · '));
    this.sound[G.sound]?.();
    if (G.g !== 'C') setTimeout(() => this.sound.coin(), 500);
    if (G.g !== 'S' && this.state.book?.[c.persona.id]) this.state.book[c.persona.id].visits += 1;
    if (G.g === 'S') {
      const first = this.guests.register(c.persona, c.order.recipe);
      if (first) getProgress()?.p.dayStats.newRegulars.push(c.persona.name);
      bus.emit('state', 'book');
      setTimeout(() => this.toast(first ? `${c.persona.name} 님이 단골 수첩에 등록됐어요` : `단골 ${c.persona.name} 님 · S등급 ${this.state.book[c.persona.id].sCount}회째`), 900);
    } else if (review.special) setTimeout(() => this.toast(`${c.persona.name} 님 취향 적중`), 700);
    const tip = pay - Math.round((price * G.pay) / 100) * 100;
    // 일일 정산
    if (P) {
      const d = P.p.dayStats;
      d.guests += 1;
      if (G.g === 'S') d.S += 1;
      if (G.g === 'A') d.A += 1;
      d.sales += pay - Math.max(0, tip);
      d.tips += Math.max(0, tip);
    }
    this.bumpAffinity(c, G.g);
    bus.emit('tasting', { customer: c, recipe: c.order.recipe, grade: G.g, critique, review: review.special ? line : null, pay, tip, matched });
    bus.emit('customer:paid', { grade: G.g, pay });
    // 다 먹고 감동: 박수 + 만족 표정
    c.state = 'satisfied';
    c.t = 0;
    this.cheer(c, 2.4);
  }

  // v12 단골 호감도: S/A 대접마다 하트 +1 → Lv.1 첫 인연 · Lv.2 단골 친구 · Lv.3 소울 푸드 단골
  bumpAffinity(c, g) {
    if (g !== 'S' && g !== 'A') return;
    const book = (this.state.book = this.state.book ?? {});
    let e = book[c.persona.id];
    if (!e) {
      this.guests.register(c.persona, c.order.recipe);
      e = book[c.persona.id];
      if (g !== 'S') e.sCount = 0;
      getProgress()?.p.dayStats.newRegulars.push(c.persona.name);
    }
    const before = Progress.level(e.aff ?? 0);
    e.aff = (e.aff ?? 0) + 1;
    const after = Progress.level(e.aff);
    if (after > before) {
      getProgress()?.p.dayStats.levelUps.push(`${c.persona.name} Lv.${after}`);
      setTimeout(() => this.toast(`${c.persona.name} 님 호감도 Lv.${after} · ${LEVEL_NAME[after]}`), 1400);
      if (after === 3 && !e.gift) {
        e.gift = true;
        bus.emit('regular:lv3', e);
      }
    }
    bus.emit('state', 'book');
  }

  holdProp(c) {
    const drink = c.order?.recipe.station === 'espresso';
    const prop = drink ? this.props.cup : this.props.fork;
    if (c.prop !== prop) {
      this.dropProp(c);
      c.prop = prop;
      this.root.add(prop);
    }
    const rh = c.actor.pawn.rig?.bones.rh;
    if (rh) {
      c.actor.root.updateWorldMatrix(true, true);
      rh.getWorldPosition(prop.position);
      prop.quaternion.copy(c.actor.root.quaternion);
      prop.rotateX(drink ? 0 : -0.6);
    } else prop.position.copy(c.actor.root.position).add(new THREE.Vector3(0, 1.1, 0.2));
  }

  dropProp(c) {
    if (c.prop) this.root.remove(c.prop);
    c.prop = null;
  }

  // 추천 메뉴가 취향 적중일 때: 손뼉 + 크게 끄덕이는 상체 모션
  cheer(c, seconds = 2.6, expr = null) {
    c.actor.gesture = { type: 'cheer', t: 0, dur: seconds };
    if (expr) {
      c.expr = expr;
      c.exprT = seconds + 0.4;
    }
  }

  finishVisit(c) {
    // 식사를 마치면 테이블의 완성 요리를 즉시 치운다 (다음 손님 자리에 남지 않게)
    if (c.seat) this.clearTableDish(c.seat.table, c.seat.chair);
    c.dish = null;
    this.dropProp(c);
    c.bubble.set('<span>잘 먹고 가요</span>', 'soft');
    setTimeout(() => c.bubble.hide(), 1600);
    c.fromY = c.actor.root.position.y;
    c.leaveSeat = c.seat; // 일어서며 의자를 밀고 · 다시 넣을 때 쓴다
    c.seat = null;
    c.state = 'scootOut';
    c.t = 0;
  }

  despawn(c) {
    this.dropProp(c);
    if (c.dish) {
      c.dish.parent?.remove(c.dish);
      disposeObject(c.dish);
      c.dish = null;
    }
    // v18: 빼 둔 의자가 남지 않게 (경로가 막혀 강제 퇴장한 경우 등)
    for (const st of [c.seat, c.leaveSeat]) if (st?.chair?.pulled) this.animChair(st, 0, 0.4);
    c.bubble.remove();
    this.root.remove(c.actor.root);
    this.customers = this.customers.filter((x) => x !== c);
    // v13: 다음 손님은 1.5초 안에 바로 들어온다
    this.spawnTimer = Math.min(this.spawnTimer, 1.5);
    // v15: 얼굴 텍스처는 풀에 돌려주고, 손님 몸 · 옷 · 머리 지오메트리와 재질은 GPU 에서 해제 (공유 자원은 건너뜀)
    try {
      c.actor.root.traverse((o) => {
        if (o.userData.face) releaseFace(o.userData.face);
      });
      disposeObject(c.actor.root);
    } catch (e) {
      console.warn('guest dispose', e);
    }
  }

  // ───────── 셰프 (직접 조작) ─────────
  makeChef() {
    const look = { top: '#f1eee7', bottom: '#2b2b2e', apron: '#3a3029', hat: 'chef', jacket: true, skin: '#e3b894', hair: '#2a211c', style: 'short', shoe: '#1f1f1f', glasses: null, scarf: null, coat: null, height: 1.02, build: 'regular' };
    const a = new Actor(look, { speed: CHEF_SPEED });
    const tray = buildTray();
    tray.visible = false;
    a.root.add(tray);
    a.tray = tray;
    this.root.add(a.root);
    a.root.position.copy(tileCenter(...this.homeTile()));
    a.root.position.z += 0.2;
    return { actor: a, tray, carry: null, stepPhase: 0 };
  }

  chefBlocked(x, z) {
    const r = 0.24;
    for (const [ox, oz] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r * 0.7, r * 0.7],
      [-r * 0.7, -r * 0.7],
      [r * 0.7, -r * 0.7],
      [-r * 0.7, r * 0.7],
    ]) {
      const px = x + ox;
      const pz = z + oz;
      if (Math.abs(px) > HALF || Math.abs(pz) > HALF) return true;
      if (!this.grid.isWalkable(...worldToTile(px, pz))) return true;
      for (const c of this.customers) {
        if (!c.seat || c.state === 'walkIn') continue;
        const p = c.actor.root.position;
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < 0.16) return true;
      }
    }
    return false;
  }

  // 입력 벡터(월드 xz, 길이 0~1)로 셰프를 움직인다
  moveChef(vx, vz, dt) {
    const a = this.chef.actor;
    const mag = Math.min(1, Math.hypot(vx, vz));
    if (mag < 0.05) {
      if (!this.chef.goto) a.manual = 0;
      return;
    }
    this.cancelWalk();
    a.manual = mag;
    const step = CHEF_SPEED * mag * dt;
    const p = a.root.position;
    const dx = (vx / Math.hypot(vx, vz)) * step;
    const dz = (vz / Math.hypot(vx, vz)) * step;
    if (!this.chefBlocked(p.x + dx, p.z)) p.x += dx;
    if (!this.chefBlocked(p.x, p.z + dz)) p.z += dz;
    a.face(Math.atan2(vx, vz), dt, 12);
  }

  // 지금 셰프 근처에서 할 수 있는 행동
  interaction() {
    const p = this.chef.actor.root.position;
    const d2 = (v) => Math.hypot(v.x - p.x, v.z - p.z);
    const carry = this.chef.carry;
    if (carry) {
      const cu = carry.order.customer;
      const near = cu.seat && Math.min(d2(this.dishSpot(cu.seat)), d2(cu.actor.root.position)) < TALK_RANGE;
      if (near) return { type: 'serve', customer: cu, label: '직접 서빙하기', icon: 'serve' };
      return { type: 'hint', label: `${cu.persona.name} 님 테이블로 가요`, icon: 'walk' };
    }
    let best = null;
    for (const st of this.furniture.stations()) {
      const d = d2(this.stationPoint(st));
      if (d < STATION_RANGE && (!best || d < best.d)) best = { st, d };
    }
    if (best) {
      const order = this.orders.find((o) => o.status === 'accepted' && o.recipe.station === best.st.def.station);
      if (order) return { type: 'cook', station: best.st, order, label: '조리대 클로즈업', icon: best.st.def.station === 'espresso' ? 'cafe' : 'knife', sub: order.recipe.name };
      return { type: 'hint', label: '이 조리대로 받은 주문이 없어요', icon: 'receipt' };
    }
    let talk = null;
    for (const c of this.customers) {
      if (c.state !== 'awaitTalk') continue;
      const d = d2(c.actor.root.position);
      if (d < TALK_RANGE && (!talk || d < talk.d)) talk = { c, d };
    }
    if (talk) return { type: 'talk', customer: talk.c, label: '대화 및 주문받기', icon: 'chat', sub: talk.c.persona.name };
    return null;
  }

  // ───────── 탭 이동 (Point & Click) ─────────
  chefTile() {
    return this.actorTile(this.chef.actor);
  }

  // 막힌 칸이면 가장 가까운 걸을 수 있는 칸
  nearestWalkable([tx, tz]) {
    if (this.grid.isWalkable(tx, tz)) return [tx, tz];
    for (let r = 1; r < 4; r++) {
      let best = null;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const t = [tx + dx, tz + dz];
          if (!this.grid.isWalkable(...t)) continue;
          const d = Math.hypot(dx, dz);
          if (!best || d < best.d) best = { t, d };
        }
      if (best) return best.t;
    }
    return null;
  }

  // 손님 곁에 설 칸: 의자·테이블 둘레의 빈 칸 중 셰프에게서 가장 가까운 곳
  approachTile(c) {
    const around = [];
    const tiles = [c.seat?.tile, c.seat?.tableTile].filter(Boolean);
    if (!tiles.length) tiles.push(this.actorTile(c.actor));
    for (const [x, z] of tiles)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const t = [x + dx, z + dz];
        if (this.grid.isWalkable(...t)) around.push(t);
      }
    const from = this.chefTile();
    let best = null;
    for (const t of around) {
      const path = findPath(from, t, this.walkable);
      if (!path) continue;
      const len = path.length + (c.seat ? Math.hypot(t[0] - c.seat.tile[0], t[1] - c.seat.tile[1]) * 0.3 : 0);
      if (!best || len < best.len) best = { t, len };
    }
    return best?.t ?? null;
  }

  // 목표 칸까지 걸어가고 도착하면 arrive() (face = 도착 후 바라볼 점)
  walkChefTo(tile, { arrive, face } = {}) {
    if (!tile) return false;
    const a = this.chef.actor;
    const tiles = findPath(this.chefTile(), tile, this.walkable);
    if (!tiles) return false;
    const pts = tiles.slice(1).map(([x, z]) => tileCenter(x, z));
    if (!pts.length) pts.push(tileCenter(...tile));
    this.chef.prep = null;
    a.setPath(pts);
    this.chef.goto = { arrive, face: face?.clone() ?? null, tile };
    return true;
  }

  cancelWalk() {
    if (!this.chef.goto) return;
    this.chef.goto = null;
    this.chef.actor.path = [];
  }

  get chefWalking() {
    return !!this.chef.goto;
  }

  // 조리대 앞에서 잠깐 손질 모션(Cook)을 보여준 뒤 워크벤치 클로즈업으로 넘어간다
  chefPrep(target, done, seconds = 1.1) {
    this.chef.prep = { target: target.clone(), done, t: seconds };
    this.chef.actor.path = [];
    this.chef.actor.manual = 0;
  }

  // 워크벤치에서 만든 음식을 쟁반에 올린다
  chefCooked(order, result, dish) {
    order.result = result;
    order.status = 'ready';
    dish.traverse((m) => m.isMesh && (m.castShadow = true));
    dish.position.set(0, 0.012, 0);
    dish.rotation.set(0, 0, 0);
    dish.scale.setScalar(1);
    this.chef.tray.add(dish);
    this.chef.tray.visible = true;
    this.chef.carry = { order, dish };
    this.chef.actor.pose = 'carry';
    this.changed();
  }

  serve() {
    const carry = this.chef.carry;
    if (!carry) return;
    const { order, dish } = carry;
    const c = order.customer;
    const spot = this.dishSpot(c.seat);
    this.chef.tray.remove(dish);
    dish.position.copy(spot);
    dish.rotation.set(0, Math.atan2(c.seat.facing[0], c.seat.facing[1]) + Math.PI, 0);
    dish.scale.setScalar(1);
    this.placeTableDish(c.seat, dish);
    this.sound.plate();
    this.chef.tray.visible = false;
    this.chef.carry = null;
    this.chef.actor.pose = 'idle';
    this.chef.actor.faceTo(spot, 1);
    c.dish = dish;
    c.state = 'served';
    c.t = 0;
    c.bubble.set(`${icon('sparkle')}<span>잘 먹겠습니다</span>`, 'soft');
    this.orders = this.orders.filter((o) => o !== order);
    order.status = 'done';
    this.changed();
  }

  // ───────── 길안내 링 (다음에 갈 곳) ─────────
  makeMarker() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 40), new THREE.MeshBasicMaterial({ color: 0xd8b878, transparent: true, opacity: 0.7, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 3;
    m.visible = false;
    this.scene.add(m);
    return m;
  }

  updateMarker(t) {
    let target = null;
    if (this.chef.carry) target = this.chef.carry.order.customer.actor.root.position;
    else {
      const o = this.orders.find((x) => x.status === 'accepted');
      if (o) {
        const st = this.furniture.stations(o.recipe.station)[0] ?? this.furniture.stations('master')[0]; // v14: 통합 마스터 조리대
        if (st) target = this.stationPoint(st);
      } else {
        const c = this.customers.find((x) => x.state === 'awaitTalk');
        if (c) target = c.actor.root.position;
      }
    }
    this.marker.visible = !!target;
    if (target) {
      this.marker.position.set(target.x, 0.03, target.z);
      const s = 1 + Math.sin(t * 4) * 0.08;
      this.marker.scale.set(s, s, s);
    }
  }

  // ───────── 메인 루프 ─────────
  update(dt, t) {
    this.updateMarker(t);
    if (dt <= 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) this.spawnTimer = this.trySpawn() ? this.interval() : 4;
    for (const c of [...this.customers]) this.updateCustomer(c, dt);
    this.stepChairs(dt);
  }

  // 셰프 애니메이션·발소리는 게임 속도와 무관하게 실시간으로
  updateChef(dt) {
    const a = this.chef.actor;
    const before = Math.floor(a.phase / Math.PI);
    const prep = this.chef.prep;
    const go = this.chef.goto;
    if (go) {
      a.manual = 0;
      if (a.move(dt)) {
        this.chef.goto = null;
        if (go.face) a.faceTo(go.face, 1);
        go.arrive?.();
      }
    }
    if (prep) {
      a.pose = 'work';
      a.faceTo(prep.target, dt);
      prep.t -= dt;
      if (prep.t <= 0) {
        this.chef.prep = null;
        a.pose = 'idle';
        prep.done();
      }
    } else if (this.chef.carry) a.pose = 'carry';
    a.animate(dt);
    const stepping = a.manual > 0.05 || a.path.length > 0;
    if (stepping && Math.floor(a.phase / Math.PI) !== before) this.sound.step(Math.max(0.7, a.manual));
  }
}

// 첫 입 품평 (레시피 taste 문장 → 등급별 일반 문장)
const TASTE_GENERIC = {
  S: ['한 입 먹자마자 눈이 번쩍 떠져요. 완벽한 밸런스예요!', '이건 정말 셰프의 작품이에요. 향과 식감이 다 살아 있어요!'],
  A: ['정성이 그대로 느껴지는 맛이에요. 정말 맛있어요!', '재료 하나하나가 살아 있어요. 기분 좋은 맛이에요.'],
  B: ['무난하게 맛있어요. 편하게 먹기 좋네요.', '괜찮아요. 다음엔 조금 더 기대할게요.'],
  C: ['음... 레시피랑은 조금 다른 맛이네요.', '조금 아쉽지만, 정성은 느껴져요.'],
};
function tasteLine(recipe, g, seed = 0) {
  const own = g === 'S' || g === 'A' ? recipe.taste : null;
  const list = own?.length ? own : TASTE_GENERIC[g] ?? TASTE_GENERIC.B;
  return list[seed % list.length];
}

// 씬에서 뺀 메쉬의 지오메트리·재질·텍스처를 GPU 에서 해제 (공유 자원은 다음에 쓸 때 다시 올라간다)
// 터치 판정 전용 메쉬 (그리지 않고 레이캐스트만 맞는다)
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
export function hitbox(geo, y = 0) {
  const m = new THREE.Mesh(geo, HIT_MAT);
  m.position.y = y;
  m.userData.hitbox = true;
  m.userData.noOutline = true;
  m.castShadow = m.receiveShadow = false;
  return m;
}

export function disposeObject(root) {
  const skeletons = new Set();
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) skeletons.add(o.skeleton);
    if (!o.isMesh && !o.isLine && !o.isPoints) return;
    if (!o.geometry?.userData?.shared) o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || m.userData?.shared) continue;
      for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'alphaMap', 'displacementMap', 'emissiveMap']) if (m[key]?.isCanvasTexture && !m[key].userData?.shared) m[key].dispose();
      m.dispose?.();
    }
  });
  // v15: 스키닝 메쉬마다 GPU 에 올라가는 본 텍스처(boneTexture)도 해제 — 손님 1명당 1장씩 쌓이던 누수
  for (const sk of skeletons) sk.dispose?.();
}

export { kit };
