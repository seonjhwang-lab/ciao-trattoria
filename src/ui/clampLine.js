// v16: 손님 대사 · 품평은 공백 포함 28자 이내의 단 1문장으로만 보여 준다 (화면을 덮지 않게)
//  1) 여러 문장이면 28자 이내인 첫 문장
//  2) 없으면 첫 문장을 쉼표로 나눠, 뒤쪽(핵심이 오는 쪽)부터 28자 안에 드는 만큼
//  3) 그래도 길면 28자 안의 마지막 띄어쓰기에서 자르고 '…'
export const LINE_MAX = 28;

export function clampLine(text, max = LINE_MAX) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?…~]+[.!?…~]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [t];
  const fit = sentences.find((x) => x.length <= max);
  if (fit) return fit;
  const first = sentences[0];
  const parts = first.split(/,\s*/);
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      const tail = parts.slice(i).join(', ');
      if (tail.length <= max && tail.length >= 8) return tail;
    }
  }
  const cut = first.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[,\s]+$/, '') + '…';
}
