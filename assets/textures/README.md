# 커스텀 텍스처 슬롯 (Aseprite 등)

이 폴더에 PNG를 넣고 `manifest.json`의 `files`에 파일 이름을 추가하면, 게임이 절차적 텍스처 대신 그 그림을 씁니다.
도트 느낌을 살리려면 같은 이름을 `pixel`에도 넣으세요 (확대할 때 `NearestFilter`).

```json
{ "files": ["section_sourdough.png", "portrait_seoyun.png"], "pixel": ["portrait_seoyun.png"] }
```

| 슬롯 이름 | 쓰이는 곳 | 권장 크기 |
| --- | --- | --- |
| `section_sourdough` / `section_brioche` | 빵 단면 (기공) | 256×256 |
| `crust_sourdough` / `crust_brioche` | 빵 겉껍질 | 256×256 |
| `section_tomato` / `skin_tomato` | 토마토 단면 / 껍질 | 256×256 |
| `section_avocado` / `skin_avocado` | 아보카도 단면 / 껍질 | 256×256 |
| `section_cucumber` / `skin_cucumber` | 오이 단면 / 껍질 | 256×256 |
| `board_endgrain` | 엔드그레인 월넛 도마 | 512×512 |
| `crema` | 에스프레소 크레마 | 256×256 |
| `portrait_<손님id>` | 대화창 손님 초상화 (예: `portrait_seoyun`) | 256×256 |

손님 id 목록은 `src/packs/season1_brunch/personas.js`에 있습니다.
