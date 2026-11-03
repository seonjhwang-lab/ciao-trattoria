# Ciao, Trattoria! — 프로젝트 인수인계 (CLAUDE.md)

이 파일은 다른 PC · 다른 Claude 세션에서 이 저장소를 열었을 때 지금까지의 맥락을 바로 파악하기 위한 문서입니다.
**응답 · 커밋 설명은 한국어로.** 작업이 끝날 때마다 빌드 → 검증 → 배포(아래 "배포")까지 한 번에 진행합니다.

## 1. 무엇인가

- 《Ciao, Trattoria!》 — 모바일 세로 화면 전용, **스트레스 없는** 아늑한 이탈리안 트라토리아 운영 · 요리 시뮬레이션.
  - 인내심 타이머 · 실패 · 화난 손님 · 게임 오버 **없음**. 보상은 하트 · 팁 · 단골 · 해금 등 긍정 강화뿐.
- 기술: **Vite 8 + Three.js r128 (버전 고정 — 올리지 말 것)**, 순수 JS 모듈 (프레임워크 없음).
- 사양 문서는 사용자가 붙여 넣는 "N차 지시서"(Gemini 작성)로 내려온다. 지시서의 번호 항목을 빠짐없이 반영하고, 마지막의 검증 지침을 375×812 에서 확인한다.
- 출시 경로 두 가지:
  1. **GitHub Pages** (실기 테스트용, `main` push 시 자동 배포 — `.github/workflows/deploy.yml`)
  2. **Claude 아티팩트** 단일 HTML (`public/artifact.html` → 스크래치패드 `strip.cjs` 로 doctype/html/head/body 태그를 벗긴 사본을 발행). 링크: https://claude.ai/artifact/D68YgE1MvjZZ9JXke2TCFW

## 2. 명령어

```bash
npm install
npm run dev          # vite --host, http://localhost:5173 (같은 Wi-Fi 휴대폰은 http://<PC IP>:5173)
npm run build        # vite build → dist/  +  build:artifact → public/artifact.html  +  이모티콘 검사
npm run check-emoji  # src · artifact 에 이모지/♥ 같은 그림 문자가 있으면 실패
npm run fetch-assets # Kenney CC0 모델 다시 받기 → public/assets/models/kenney/
```

- `vite.config.js` 의 `base: './'` — GitHub Pages 하위 경로(`/ciao-trattoria/`)와 로컬 모두에서 상대 경로로 동작한다. 바꾸지 말 것.
- 아티팩트 빌드(`scripts/build-artifact.mjs`)는 Three.js r128 + GLTFLoader + SkeletonUtils 를 jsDelivr CDN 에서 불러오고, CSS 를 `<body>` 맨 앞 `#bistro-critical` + `#bistro-css` 두 `<style>` 로 넣는다(없으면 빌드 실패).

## 3. 절대 규칙 (어기면 안 됨)

1. **Native Portrait 세로 고정.** 가로 모드(CSS 회전) 는 거절된 방식. 화면은 `100dvh`, 조리대는 위 3D + 아래 바(`min(26%, 185px)`).
2. **`OutlineEffect` 사용 금지** (v15). 메쉬마다 외곽선 복제본을 쌓아 모바일 웹뷰가 튕겼다. 렌더는 `renderer.render(scene, camera)` 단일 패스. `.hdr` / `RGBELoader` 도 금지. 픽셀 비율 ≤ 1.25, 그림자 맵 512.
3. **표준 `<button type="button">` + `addEventListener('click')` 만.** 전역 touchstart/touchend/pointercancel 가로채기, `elementFromPoint` 재탐색, 디바운스 락, UI 위 `preventDefault` 금지 (v12 · v14 의 커스텀 터치 매니저는 실기에서 탭을 먹통으로 만들어 폐기). `src/ui/Tap.js` 의 `bindTap` 은 이름만 남은 순수 click 래퍼. 버튼 안 아이콘/글씨는 CSS `#ui button * { pointer-events: none }`. 매장 3D 탭은 캔버스 자신의 pointer 이벤트로만 판정.
   - **예외 (v16): 메뉴판 `#menu-board`** 의 카테고리 탭 · 메뉴 카드 · 닫기 버튼은 `onpointerdown` 으로 즉시 실행한다(`DialogueUI.press`). 메뉴판은 스크롤 없는 4행 고정 그리드(카드 68px)이고 잠금 조건 · `disabled` 가 없다. 열려 있는 동안 `body.mb-open` 으로 다른 레이어는 `pointer-events: none`, 닫힌 직후 유령 click 을 한 번 흡수한다.
4. **7×8 매장 + 통합 마스터 조리대 유지.** `GRID_W 7`, `GRID_D 8`, 문은 왼쪽(서쪽) 높은 벽 `DOOR_TILE [0,6]` (현관 마당 없음). 뒤쪽 2줄 = 주방(체커 타일), 3번째 줄 = 패스 카운터 `s1_pass`(x=5 칸이 "Cucina" 아치 통로), 나머지 = 식사 홀. 조리대는 5칸짜리 `s1_master` 하나이고, 메뉴별 조리대는 `order.recipe.station` 으로 고른다. 통로 바로 앞 (5,3) 은 비워 둬야 셰프가 주방을 드나든다.
5. **이모지 0개.** 아이콘은 전부 SVG (`src/ui/icons.js`). ♥ ♡ ↔ 💬 같은 문자도 `check-emoji` 에서 빌드가 실패한다.
6. **45° 마름모 아이소 카메라 고정** (yaw π/4, `SceneManager.fitZoom()`), 확대/회전 UI 없음. 손님 얼굴이 보이도록 의자 방향 유지.
7. **GPU 자원은 반드시 회수.** 손님 퇴장 시 `disposeObject`(스켈레톤 본 텍스처 포함), 조리대 닫을 때 `Workbench3D` 가 무대에 올라왔던 지오메트리 · 재질을 모두 해제(서빙 접시 `keepDish` 제외). 여러 곳에서 재사용하는 캐시 텍스처 · 재질은 `userData.shared = true`. 얼굴 텍스처는 256px 풀(`releaseFace`).
8. **잘림 0건 원칙 (v17).** 하단 패널 · 대화창 · 품평창 · 메뉴판은 `height:auto` / `max-height:none` / `overflow:visible`. `max-height`+`overflow:hidden` 로 높이를 자르는 것, `-webkit-line-clamp`, `line-height` 1.35 미만 금지(v16 의 120px 하드락이 실기에서 버튼을 잘라 철거). 짧게 만들고 싶으면 내용을 줄인다: 대사 · 품평은 `src/ui/clampLine.js` 로 28자 이내 1문장, 메뉴 설명은 레시피 `desc`. `~라니` 말투 금지.
   - 화면 높이는 `src/core/Viewport.js` 가 `visualViewport` 를 재서 `--vvh` / `--vvt` 에 넣는다(이벤트 + 0.4초 감시). `#app` · `#ui` 는 `height: var(--vvh)`, 렌더러도 `viewport()` 크기. `100vh` / `100dvh` 로 직접 높이를 잡지 말 것.
   - 조리대 하단 패널은 2줄: `.wb-row1`(제목 · 힌트 - 진행 수치 배지) + `.wb-actions`(버튼). 패널 높이는 내용만큼이고 `ResizeObserver` 가 3D 뷰포트와 `--bar` 를 맞춘다.
   - 검증: `tools/__t.js`(→ public 에 복사) 의 `T.auditScreens()` / `T.clipAudit()` 로 360×520 · 375×620 · 390×844 · 412×732 에서 인트로 · 홀 · 대화창 · 메뉴판 5탭 · 모든 조리대 전 단계 · 결과창을 전수 검사해 0건이어야 한다.
9. **조리 도구는 음식을 뚫지 않는다 (v16).** `src/workbench/toolClear.js` 의 `getFoodTopY` / `keepAbove` 로 매 프레임 도구 실제 최저점을 음식 최고점 위로: 드리즐 · 드레싱 병 노즐 +8cm, 후추통 +10cm, 강판 +3cm, 피자 휠은 윗면에 닿기만.
10. three.js 는 r128 고정. r128 재질에서 스키닝은 `skinning: true` 필요.
11. **배포 전 자동 감사 0건 의무 (v19).** 어떤 수정 · 기능 추가든 `git push` 전에 아래 5가지 감사를 모두 돌려 **issues 0건일 때만** push 한다. 1건이라도 나오면 고치고 다시 돌린다. 사람이 눈으로 찾아 지적하기 전에 코드로 먼저 잡는 것이 목적.
    1. UI 잘림: `T.auditScreens()` — 360×520 · 375×620 · 390×844 · 412×732 네 뷰포트 모두 0건.
    2. 좌석 · 동선(정적): `T.setupFull(set)` 후 `T.auditSeats()` — 테이블 세트 3종(bistro · velvet · rattan) × 3번째 테이블 포함 6좌석. 뺀 의자 vs 가구 · 벽 · 다른 의자, 손님이 서는 자리, 문까지 길, 셰프가 모든 좌석에 서빙 거리로 가는 길, 동선 단절.
    3. 이동 관통(동적): `T.auditMotion(n)` — 세트마다 손님 10명 이상. 셰프 · 손님 원기둥(r 0.14m)이 가구 · 카운터 · 벽을 뚫는 프레임, 빠진 의자 vs 다른 사람, 같은 좌석 이중 배정, 진행 멈춤.
    4. 조리 도구 관통: `T.auditBenches()` — 14개 메뉴 전 단계를 실제 손짓(드래그 · 탭 · 길게 누르기 · 레버)으로 진행하며 매 프레임: 도구가 도마 · 접시 · 그릇 · 팬 · 컵 · 화덕 · 작업대 속으로 3mm 넘게 들어가는지, 병 · 후추통 · 강판이 음식 위 여유(8 · 10 · 3cm)를 지키는지. 조리대를 열 때 고정물끼리 겹침(`B3.staticOverlap`)도 본다. '속' 판정은 위 · 아래로 쏜 광선이 만나는 면의 방향으로 한다(덮개 아래 빈 공간은 '밖'). 결과 `coverage` 의 `*` 는 자동 조작으로 못 끝내 강제로 넘긴 단계 — 0개가 목표.
    5. 완성 요리 높이: `T.auditDishes()` — 14종을 셰프 쟁반과 모든 좌석 테이블에 놓았을 때 파묻힘 · 뜸 ±3mm 이내.
    - 새 가구 · 테이블 세트 · 해금 배치를 넣으면 `T.setupFull` 에 추가하고, 새 조리 도구는 벤치 속성으로 두거나 `userData.tool = '이름'` 을 달아 `T.B3.config` 가 찾게 한다.
    - 감사는 개발 서버(`npm run dev`)에서 `public/__t.js` 로 복사해 실행하고(긴 감사는 `T.auditBenches().then(r => window.__B = r)` 처럼 백그라운드로), 끝나면 `public/__t.js` 를 지운 뒤 빌드한다. 감사 중에 `src` 를 고치면 Vite 가 페이지를 새로 고쳐 감사가 끊긴다.

## 4. 구조와 핵심 파일

```
index.html                 진입점 (#app 캔버스 · #ui 오버레이)
src/main.js                부트 · 게임 루프(try/catch 로 다음 프레임 보장) · 탭 → 이동/대화/조리/서빙 연결 · 하루 정산 · 인테리어
src/core/
  SceneManager.js          렌더러 · 아이소 정사영 카메라 · fitZoom · 절차적 환경맵
  Toon.js                  툰 램프 셰이더 훅 (외곽선 없음)
  GridSystem.js            7x8 격자 · 문 · 주방 바닥 · 도어매트
  WallCutaway.js           벽(카메라 쪽은 낮아짐) · 서쪽 출입문 · 뒷벽 후드/선반/메뉴판 (northGroup)
  Diorama.js               원목 받침 (현관 마당 없음)
  CafeAI.js                손님 상태 기계(입장→주문→식사→퇴장) · 셰프 길찾기 · 서빙 · 정산 · disposeObject
  FurnitureManager.js / BuildMode.js   가구 배치 · 꾸미기 모드
  Actors.js / ActorRig.js / BodyMesh.js / Character.js   Mixamo 리그 + 절차적 몸 · 옷
  FaceTextureBuilder.js    캔버스 얼굴(5표정) · 256px 텍스처 풀
  Progress.js              해금 단계 · 인테리어 카탈로그 · 하루 5명 정산 · 단골 친밀도
  GameState.js             저장(localStorage) · LAYOUT_VER (배치가 바뀌면 올려서 기본 배치로 초기화)
  Settings.js              기기별 설정 — reactionsOn() (리액션 ON/OFF)
  HeroDish.js / BistroDish.js   완성 요리 프리팹
  DayCycle.js              하루 조명 (PointLight 는 userData.base 필수, 없으면 NaN 으로 씬이 까맣게 됨)
src/packs/season1_brunch/  레시피 · 손님 · 가구 · 기본 배치 (import.meta.glob 으로 자동 등록되는 시즌 팩)
src/workbench/
  Workbench3D.js           조리대 클로즈업 공통 (단계 진행 · 결과 · 완성 연출 · GPU 회수)
  BoardBench.js            샌드위치 (썰기 · 바르기 · 바트 플레이팅 · 후추 · 반 자르기)
  Ingredient3D.js          썰 수 있는 재료 · 자연스러운 슬라이스 쓰러짐(stepFall)
  EspressoBench.js / PastaBench.js / PizzaBench.js / SaladBench.js
src/ui/                    HUD(보유 자금 · 리액션 토글 · 메뉴) · DialogueUI(대화 · 메뉴판) · Trattoria(카탈로그 · 정산 · 편지) · Overlays(인트로 · 확인 · 품평 카드) · styles-v*.css (나중 파일이 앞 파일을 덮는다, 최신 = styles-v15.css)
scripts/                   build-artifact.mjs · check-emoji.mjs · fetch-assets.mjs · mixamo/ (FBX → mixamo_anims.glb 변환)
public/assets/             Kenney CC0 GLB · mixamo_anims.glb · 텍스처 매니페스트
```

- `assets-src/`(Mixamo 원본 FBX)는 재배포 문제로 저장소에 올리지 않는다(.gitignore). 변환 결과 `public/assets/models/characters/mixamo_anims.glb` 만 커밋.

## 5. 검증 방법

- 375×812(모바일) 에서 확인. 브라우저 pane 은 requestAnimationFrame 이 잘 돌지 않으므로 `__cafe.advance(초)` 로 시뮬레이션을 진행한다.
- 테스트 도우미 원본은 `tools/__t.js`. `public/__t.js` 로 잠깐 복사해 브라우저 콘솔에서 `await import('/__t.js')` 로 쓰고 **빌드 전에 반드시 삭제**(빌드에 섞이지 않게, `public/__t.js` 는 .gitignore). `T.finger(x, y, 'both'|'pointer'|'touch'|'cancel')`, `T.toTalk()`, `T.auditScreens()`, `T.clipAudit()`.
- 메모리: 손님 받기 → 조리대 → 서빙을 수십 번 반복하며 `__cafe.sm.renderer.info.memory` (geometries · textures) 가 늘지 않는지 본다. v15 기준 약 240 / 42 에서 고정.
- 아티팩트 사본은 `<style>` 2개 · scrollHeight 812 · SVG ≤ 48px 를 확인한 뒤 발행.

## 6. 버전 메모 (최근)

- v13: 주방 · 패스 카운터 · 홀 분리, 45° 아이소 복귀, 첫 손님 퇴장 시 멈춤 수정.
- v14: 7x8 확장, 현관 제거(서쪽 벽 출입문), 손님이 벽 뒤에서 걸어 들어옴.
- v15: 튕김 대응(외곽선 · HDR 제거, 본 텍스처 · 조리대 GPU 누수 수정), 표준 click 복원, 메뉴판 탭 잠금 제거, 반투명 대화 · 품평 창, 리액션 ON/OFF, 슬라이스 웨지 → 중력 → 감쇠 탄성 + 겹침.
- v16: 메뉴판 무스크롤 · pointerdown 재작성, 28자 1문장, `~라니` 문구 삭제 · 메뉴 설명 교체, 소스병 · 도구 관통 차단(toolClear.js).
- v17: 120px 하드락 철거(잘림 원인), visualViewport 동기화, 조리대 하단 패널 2줄 구조, 4개 뷰포트 잘림 0건 전수 검사.
- v18: 손님 착석 디테일 — 의자 칸으로 걸어 들어가지 않고 옆(없으면 뒤) 빈 칸으로 접근 → 등받이를 잡고 의자를 36cm 빼기 → 의자와 테이블 사이로 들어서기 → 앉기 → 앉은 채 의자 당기기. 일어설 때는 역순(의자 밀기 → 일어나기 → 옆으로 나오기 → 의자 다시 넣기). `CafeAI.seatApproach / setChairOffset / animChair`, 제스처 `chair`(ActorRig).
- v19: 3D 무결성 자동 감사 도입(규칙 11, `tools/__t.js` 의 `T.auditSeats / auditMotion / auditBenches / auditDishes`, 판정 도우미 `T.G3`(매장) · `T.B3`(조리대)). 감사로 찾아 고친 것:
  - 매장: 3번째 테이블 (5,6) 이 매장을 동서로 갈라 셰프 · 손님 동선 단절 → (6,6) 으로 이동(`LAYOUT_VER 13`, 저장된 테이블 세트 다시 입힘) · 의자 빼는 거리 · 서는 자리를 실제 메쉬 치수로(`CafeAI.pullPlan`, 벨벳 의자 겹침) · 뒤쪽 접근 손님이 빼낸 의자를 대각선으로 뚫음(옆 접근 우선 + 우회 지점 `via`) · 일어나는 중인 자리에 다음 손님 배정 금지 · 출입문 바닥을 가로지르던 걸레받이 · 가구에 둘러싸인 빈 칸은 탭 이동 대상에서 제외 · 키보드 이동이 맨 앞줄에 못 가던 범위(HALF_Z).
  - 조리대: 겨누는 칼 · 톱질 칼 날끝이 도마에(최대 2.8cm), 반 자르기 칼이 샌드위치에 박힘(`keepAbove`) · 후추통이 BLT 위 6cm 까지(트윈 뒤 `postTween` 으로 매 프레임, 돌아가는 길 포함) · 국자가 테이블 아래 선반 속에서 대기 · 피자 필이 화덕 돌턱 · 바닥 · 반죽판을 뚫음(턱 넘는 경로) · 반죽판이 화덕 돌턱과 겹침(도우 자리 4cm 앞으로) · 스테인리스 백스플래시가 화덕 돔 관통 · 화덕 받침과 테이블 겹침 · 아치 베벨 · 불꽃이 바닥 아래로 · 샐러드 서버 · 잎이 볼 바닥을 뚫음(`liftAboveSurface`) · 밀대가 프라이팬 속에 놓임 · 재료 밧드 밖으로 삐져나온 상추 · 루꼴라(자동 맞춤) · 포터필터 · 원두 더미가 그라인더 몸통 속에, 토출구가 더미 속에(2.5cm 앞으로 · 토출구 2cm 위로).
  - 완성 요리: 시저 샐러드 잎 끝이 테이블 속 2.9mm(`BistroDish.liftBelowBase`).
