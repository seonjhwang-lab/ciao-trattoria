// 이모티콘 금지 검사: src/, index.html, public/artifact.html 에 유니코드 이모티콘이 있으면 실패한다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RE = /[\p{Extended_Pictographic}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/u;
const targets = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(js|mjs|css|html|json|md)$/.test(f.name)) targets.push(p);
  }
};
walk(path.join(ROOT, 'src'));
targets.push(path.join(ROOT, 'index.html'));
const art = path.join(ROOT, 'public', 'artifact.html');
if (fs.existsSync(art)) targets.push(art);
let bad = 0;
for (const f of targets) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (RE.test(line)) {
      bad++;
      if (bad <= 60) console.log(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 110)}`);
    }
  });
}
if (bad) {
  console.error(`이모티콘 ${bad}줄 발견`);
  process.exit(1);
}
console.log('이모티콘 없음');
