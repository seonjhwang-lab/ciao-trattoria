import { furniture, kenneyFurniture, finishes } from './furniture.js';
import { recipes, ingredients, applyOption } from './recipes.js';
import { personas, OPTIONS, TAGS } from './personas.js';
import * as guests from './guests.js';

// 시즌 1 확장팩. 새 시즌은 src/packs/<폴더>/index.js 하나만 추가하면 자동 등록된다.
export default {
  id: 'season1_brunch',
  name: '시즌 1 · 차오, 트라토리아!',
  version: '7.0.0',
  startingMoney: 30000, // v12: 돈을 모아 설비를 해금해 가는 성장 루프

  categories: [
    { id: 'table', name: '테이블', icon: 'plate', order: 0 },
    { id: 'seat', name: '의자', icon: 'user', order: 1 },
    { id: 'station', name: '조리대', icon: 'knife', order: 2 },
    { id: 'counter', name: '카운터', icon: 'receipt', order: 3 },
    { id: 'decor', name: '장식', icon: 'pesto', order: 4 },
  ],

  stations: [
    { id: 'espresso', name: '에스프레소 바', icon: 'cafe' },
    { id: 'sandwich', name: '샌드위치 워크벤치', icon: 'knife' },
    { id: 'pasta', name: '생면 파스타 스토브', icon: 'pasta' },
    { id: 'pizza', name: '화덕 피자 오븐', icon: 'pizza' },
    { id: 'salad', name: '가든 샐러드 바', icon: 'salad' },
    { id: 'master', name: '통합 마스터 조리대', icon: 'knife' },
  ],

  ingredients,
  furniture: [...furniture, ...kenneyFurniture],
  recipes,
  personas,
  guests,
  options: OPTIONS,
  tags: TAGS,
  applyOption,
  finishes,
  defaultFinish: { wall: 's1_wall_sage', floor: 's1_floor_honey' },

  // v13 시작 매장 (6x7): 뒤 2칸 주방(마스터 조리대 · 셰프 동선) → 패스 카운터(+오른쪽 끝 주방 통로) → 앞 4칸 식사 홀
  // 45° 쿼터뷰(카메라가 +x +z 쪽)라 의자는 테이블 뒤(+z 를 봄)와 왼쪽(+x 를 봄)에 둔다 → 손님 표정이 늘 카메라를 향한다
  defaultLayout: [
    { id: 's1_master', x: 0, z: 0 },
    { id: 's1_plant_fig', x: 6, z: 0, s: 3 },
    { id: 's1_pass', x: 0, z: 2 },
    { id: 'k_plant_small', x: 6, z: 2, s: 2 },
    { id: 's1_rug', x: 1, z: 4, s: 0 },
    { id: 's1_table_round', x: 2, z: 4 },
    { id: 's1_chair_bentwood', x: 2, z: 3, r: 0 },
    { id: 's1_chair_bentwood', x: 1, z: 4, r: 1 },
    // 주방 통로(x=5) 바로 앞 칸은 비워 둔다 — 셰프가 드나드는 길
    { id: 's1_table_round', x: 4, z: 4 },
    { id: 's1_chair_bentwood', x: 4, z: 3, r: 0 },
    { id: 's1_chair_bentwood', x: 3, z: 4, r: 1 },
    { id: 'k_plant_small', x: 0, z: 7, s: 1 },
  ],
};
