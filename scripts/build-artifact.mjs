// 단일 파일 빌드: src/ 전체를 하나의 HTML(public/artifact.html)로 묶는다.
// Three.js 는 CDN(r128) 전역 THREE 를 쓰고, CSS/JS 는 모두 인라인. 스마트폰에 파일 하나만 보내도 실행된다.
//   npm run build:artifact
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'artifact.html');
const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const EX = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
const CDN_EXTRAS = ['loaders/GLTFLoader.js', 'utils/SkeletonUtils.js'].map((p) => EX + p); // v15: RGBELoader · OutlineEffect 제거

// 'three' import → 전역 THREE, examples 모듈 → 전역 THREE.GLTFLoader / RGBELoader / SkeletonUtils (CDN 스크립트)
const EXAMPLES = new Set(['GLTFLoader', 'SkeletonUtils']);
const threeGlobal = {
  name: 'three-global',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'three-global' }));
    b.onResolve({ filter: /(GLTFLoader|SkeletonUtils)\.js$/ }, (a) => ({ path: path.basename(a.path, '.js'), namespace: 'three-global' }));
    b.onLoad({ filter: /.*/, namespace: 'three-global' }, (a) => ({
      contents: EXAMPLES.has(a.path) ? `module.exports = { ${a.path}: window.THREE.${a.path} };` : 'module.exports = window.THREE;',
      loader: 'js',
    }));
  },
};

// Vite 의 import.meta.glob 대신, 빌드 시점에 packs 폴더를 스캔해 정적 import 로 바꾼다
const packsIndex = {
  name: 'packs-index',
  setup(b) {
    b.onLoad({ filter: /src[\\/]packs[\\/]index\.js$/ }, () => {
      const dir = path.join(ROOT, 'src', 'packs');
      const packs = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'index.js')))
        .map((d) => d.name)
        .sort();
      const lines = [`import { registry } from '../core/PackRegistry.js';`];
      packs.forEach((p, i) => lines.push(`import p${i} from './${p}/index.js';`));
      packs.forEach((_, i) => lines.push(`registry.register(p${i});`));
      lines.push('export { registry };');
      return { contents: lines.join('\n'), loader: 'js', resolveDir: dir };
    });
  },
};

const result = await build({
  entryPoints: [path.join(ROOT, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  outdir: 'out',
  plugins: [threeGlobal, packsIndex],
  logLevel: 'warning',
});

const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';

// Kenney 모델을 base64 로 내장 (아티팩트는 외부 파일을 불러올 수 없다)
const models = {};
const man = path.join(ROOT, 'public', 'assets', 'models', 'manifest.json');
if (fs.existsSync(man)) {
  for (const f of JSON.parse(fs.readFileSync(man, 'utf8')).files ?? []) {
    const p = path.join(ROOT, 'public', 'assets', 'models', f);
    if (fs.existsSync(p)) models[path.basename(f, '.glb')] = fs.readFileSync(p).toString('base64');
  }
}
// 스튜디오 HDRI · 캐릭터 GLB 도 내장
const hdrPath = path.join(ROOT, 'public', 'assets', 'hdri', 'studio.hdr');
const hdr = null; // v15: .hdr Base64 내장 제거 (VRAM · 용량)
void hdrPath;
const chars = {};
const cdir = path.join(ROOT, 'public', 'assets', 'models', 'characters');
if (fs.existsSync(path.join(cdir, 'manifest.json'))) {
  for (const f of JSON.parse(fs.readFileSync(path.join(cdir, 'manifest.json'), 'utf8')).files ?? []) {
    const p = path.join(cdir, f);
    if (fs.existsSync(p)) chars[path.basename(f, '.glb')] = fs.readFileSync(p).toString('base64');
  }
}
const embed = [
  `window.__EMBEDDED_MODELS = ${JSON.stringify(models)};`,
  'window.__EMBEDDED_TEXTURES = true;',
  hdr ? `window.__EMBEDDED_HDR = "${hdr}";` : '',
  Object.keys(chars).length ? `window.__EMBEDDED_CHARACTERS = ${JSON.stringify(chars)};` : '',
].join(' ');

// 아티팩트 호스트는 doctype/html/head/body 를 다시 씌우므로, 스타일은 <head> 가 아니라 <body> 맨 앞에 넣는다.
// (예전엔 <title> 문자열 자리에 끼워 넣어서, 제목이 바뀌자 CSS 가 조용히 빠졌다 → 이제는 못 넣으면 빌드 실패)
if (css.length < 20000) throw new Error(`[build-artifact] CSS 번들이 비어 있거나 너무 작아요 (${css.length}B)`);
// 핵심 레이아웃 안전장치: 어떤 컨테이너 안에서도 화면에 꽉 차고 스크롤되지 않게, 숨김 패널은 무조건 숨김, 아이콘은 절대 폭발하지 않게
const CRITICAL = [
  'html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;background:#e8dfd5}',
  '#app,#ui{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;overflow:hidden}',
  '#ui{z-index:5;pointer-events:none}',
  '.hidden,[hidden]{display:none!important}',
  'svg.ic{max-width:48px;max-height:48px}',
  '#loading{position:fixed;inset:0;overflow:hidden}',
].join('\n');
const STYLE_BLOCK = `<style id="bistro-critical">\n${CRITICAL}\n</style>\n    <style id="bistro-css">\n${css}\n    </style>`;
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (!/<body[^>]*>/.test(src)) throw new Error('[build-artifact] index.html 에 <body> 가 없어요');
if (!src.includes('<script type="module" src="/src/main.js"></script>')) throw new Error('[build-artifact] main.js 스크립트 태그를 못 찾았어요');
const html = src
  .replace(/<body[^>]*>/, (m) => `${m}\n    ${STYLE_BLOCK}`)
  .replace(
    '<script type="module" src="/src/main.js"></script>',
    () => `<script src="${THREE_CDN}"></script>\n${CDN_EXTRAS.map((u) => `    <script src="${u}"></script>\n`).join('')}    <script>${embed}</script>\n    <script>\n${js.replace(/<\/script/gi, '<\\/script')}\n    </script>`,
  );

if (!html.includes('id="bistro-css"') || html.indexOf('id="bistro-css"') > html.indexOf('<div id="app">')) throw new Error('[build-artifact] CSS 가 본문 맨 앞에 들어가지 않았어요');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)}KB) — Three.js r128 CDN + GLTF/RGBE/SkeletonUtils · 내장 모델 ${Object.keys(models).length}개 · HDRI ${hdr ? 'O' : 'X'} · 캐릭터 GLB ${Object.keys(chars).length}개`);
