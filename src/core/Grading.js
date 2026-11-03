// 요리 완성도 등급. 시간 초과·화내기는 없지만, 정성에 따라 보상과 리액션이 확실히 달라진다.
export const GRADES = [
  { g: 'S', min: 90, pay: 1, tip: 0.5, rep: 3, line: '완벽해요! 인생 브런치예요!', fx: 'gold', sound: 'fanfare', note: 'S등급 특급 팁 +50%' },
  { g: 'A', min: 75, pay: 1, tip: 0.2, rep: 1.5, line: '정말 맛있어요. 정성이 느껴져요.', fx: 'hearts', sound: 'success', note: 'A등급 팁 +20%' },
  { g: 'B', min: 50, pay: 1, tip: 0, rep: 0.3, line: '무난하게 먹을 만하네요.', fx: 'notes', sound: 'soft', note: '정가 결제' },
  { g: 'C', min: 0, pay: 0.7, tip: 0, rep: -1, line: '음... 레시피랑 좀 다른 것 같은데요?', fx: 'sweat', sound: 'aww', note: '아쉬워서 70%만 결제' },
];

export function gradeFor(score) {
  return GRADES.find((x) => score >= x.min) ?? GRADES[GRADES.length - 1];
}

export function payment(price, grade) {
  return Math.round((price * (grade.pay + grade.tip)) / 100) * 100;
}

