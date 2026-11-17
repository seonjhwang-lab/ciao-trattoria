# 캐릭터 리그

셰프와 모든 손님은 이 폴더의 Mixamo 뼈대·애니메이션 + 게임이 만든 일체형 몸으로 만들어진다 (`src/core/ActorRig.js`, `src/core/BodyMesh.js`).

| 파일 | 내용 |
|---|---|
| `mixamo_anims.glb` | `mixamorig` 65본 뼈대(휴지 T-포즈)만 + 공유 클립 7종: Idle · Walk · SitIdle · SitTalk · Cook · CarryWalk · CarryIdle |

- X Bot 메쉬는 쓰지 않는다 (6차 지시서). 몸은 `BodyMesh.js` 가 셔츠·바지·소매·손·신발·앞치마·코트·칼라를
  단면 링을 이은 매끈한 관으로 만들어 이 뼈대에 스키닝한다 → 관절 구슬·이음새가 보이지 않는다
- 얼굴·헤어·모자·안경은 `Character.js` 의 `buildHead()` 를 머리 뼈에 부착
- 원본 FBX: `assets-src/mixamo/` (Mixamo MCP 로 받음)
- 다시 만들기: `npm run convert-mixamo` (FBX → GLB, 루트 모션 제거, 긴 클립 자르기·루프 블렌딩, 회전 키 int16)
- CarryWalk / CarryIdle 은 Walk·Idle 하체 + Cook 의 양팔 자세를 합성한 상체 마스킹 클립
- 리그가 없으면(로드 실패) 관절형 캐릭터로 대체된다
