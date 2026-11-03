import { registry } from '../core/PackRegistry.js';

// src/packs/*/index.js 를 전부 찾아 자동 등록한다.
// 시즌 2(파스타 비스트로)를 추가하려면 src/packs/season2_pasta/index.js 를 만들기만 하면 된다.
const modules = import.meta.glob('./*/index.js', { eager: true });
for (const path of Object.keys(modules).sort()) {
  registry.register(modules[path].default);
}

export { registry };
