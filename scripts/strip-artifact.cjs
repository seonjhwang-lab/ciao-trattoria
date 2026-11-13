// public/artifact.html → 아티팩트 발행용 사본 (doctype/html/head/body 태그 제거, 제목 먼저)
const fs = require('fs');
const [src, out] = process.argv.slice(2);
let h = fs.readFileSync(src, 'utf8');
const title = (h.match(/<title>[\s\S]*?<\/title>/i) || ['<title>Ciao, Trattoria!</title>'])[0];
const head = (h.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1].replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta[^>]*charset[^>]*>/i, '');
const body = (h.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1];
const res = `${title}\n${head.trim()}\n${body.trim()}\n`;
const styles = (res.match(/<style/g) || []).length;
if (styles < 2 || !res.includes('id="bistro-css"') || !res.includes('id="bistro-critical"')) throw new Error('style 태그가 빠졌어요: ' + styles);
if (/<!doctype|<html|<body|<head/i.test(res.slice(0, 5000))) throw new Error('껍데기 태그가 남았어요');
fs.writeFileSync(out, res);
console.log('ok', (res.length / 1024).toFixed(0) + 'KB', 'styles', styles);
