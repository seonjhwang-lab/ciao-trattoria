// 무료 CC0 3D 에셋(Kenney Furniture Kit) 다운로드 → public/assets/models/kenney/ + manifest.json
//   npm run fetch-assets          모델 배치
//   npm run fetch-assets -- --list zip 안의 GLB 목록
// 출처: https://kenney.nl/assets/furniture-kit (Creative Commons CC0 1.0)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'models');
const CACHE = path.join(os.tmpdir(), 'cozy-brunch-3d-assets');
const URL = 'https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip';
const FILES = ['tableRound', 'table', 'tableCoffee', 'loungeSofa', 'loungeChair', 'pottedPlant', 'plantSmall1', 'plantSmall2', 'plantSmall3', 'toaster', 'kitchenBlender', 'radio', 'books', 'lampRoundTable', 'cardboardBoxClosed'];

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP 형식이 아니에요');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    entries.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen), method, csize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const extract = (e) => {
    const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const data = buf.subarray(start, start + e.csize);
    return e.method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data);
  };
  return { entries, extract };
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const zipPath = path.join(CACHE, 'kenney_furniture-kit.zip');
  if (!fs.existsSync(zipPath)) {
    console.log('Kenney Furniture Kit 다운로드 중...');
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  const zip = readZip(fs.readFileSync(zipPath));
  if (process.argv.includes('--list')) return zip.entries.filter((e) => e.name.endsWith('.glb')).forEach((e) => console.log(e.name));
  const dir = path.join(OUT, 'kenney');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of FILES) {
    const e = zip.entries.find((x) => x.name.endsWith(`GLTF format/${f}.glb`));
    if (!e) { console.warn('없음:', f); continue; }
    fs.writeFileSync(path.join(dir, `${f}.glb`), zip.extract(e));
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => `kenney/${f}`);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ license: 'CC0 1.0 (Kenney)', files }, null, 2));
  console.log(`모델 ${files.length}개 배치 완료`);
}
// 스튜디오 HDRI (Poly Haven CC0) → public/assets/hdri/studio.hdr
async function fetchHdri() {
  const out = path.join(ROOT, 'public', 'assets', 'hdri', 'studio.hdr');
  if (fs.existsSync(out)) return console.log('HDRI 이미 있음');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const urls = [
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
    'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.toString('ascii', 0, 10).includes('#?')) {
        fs.writeFileSync(out, buf);
        return console.log(`HDRI 받음: ${u.split('/').pop()} (${(buf.length / 1024).toFixed(0)}KB)`);
      }
    } catch {
      /* 다음 후보 */
    }
  }
  console.warn('HDRI 다운로드 실패 — 절차적 스튜디오 라이트박스로 대체합니다');
}

Promise.all([main(), fetchHdri()]).catch((e) => console.warn('에셋 다운로드 실패 — 절차적 모델로 계속 동작합니다:', e.message));
