// 아주 작은 이벤트 버스. 엔진·팩·UI가 서로를 직접 알지 않고 이벤트로만 소통한다.
export class EventBus {
  constructor() {
    this.map = new Map();
  }
  on(event, fn) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event).add(fn);
    return () => this.map.get(event)?.delete(fn);
  }
  emit(event, data) {
    this.map.get(event)?.forEach((fn) => fn(data));
  }
}

export const bus = new EventBus();
