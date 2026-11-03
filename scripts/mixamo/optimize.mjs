// convert.src.js 가 만든 *.raw.glb 를 경량화한다 (gltf-transform + meshoptimizer)
//  anims: 회전 키를 int16 정규화로, 같은 시간축 공유
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'assets', 'models', 'characters');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);

// ── 애니메이션 ──
{
  const doc = await io.read(path.join(DIR, 'mixamo_anims.raw.glb'));
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== 'rotation') continue;
      const out = ch.getSampler().getOutput();
      const src = out.getArray();
      if (!(src instanceof Float32Array)) continue;
      const q = new Int16Array(src.length);
      for (let i = 0; i < src.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, src[i])) * 32767);
      out.setArray(q).setNormalized(true);
    }
  }
  await doc.transform(dedup(), prune());
  await io.write(path.join(DIR, 'mixamo_anims.glb'), doc);
  const n = doc.getRoot().listAnimations().map((a) => a.getName()).join(', ');
  console.log(`anims: ${n} · ${fs.statSync(path.join(DIR, 'mixamo_anims.glb')).size} bytes`);
}

for (const f of ['mixamo_anims.raw.glb']) fs.rmSync(path.join(DIR, f), { force: true });
