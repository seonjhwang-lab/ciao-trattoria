# Ciao, Trattoria!

모바일 세로 화면 전용, 스트레스 없는 아늑한 이탈리안 트라토리아 운영 · 요리 시뮬레이션 (Vite + Three.js r128).

- 플레이 (GitHub Pages): https://seonjhwang-lab.github.io/ciao-trattoria/
- 개발 맥락 · 규칙 · 구조: [CLAUDE.md](CLAUDE.md)

## 실행

```bash
npm install
npm run dev     # http://localhost:5173 (같은 Wi-Fi 휴대폰은 http://<PC IP>:5173)
npm run build   # dist/ (GitHub Pages) + public/artifact.html (Claude 아티팩트용 단일 파일)
```

`main` 브랜치에 push 하면 `.github/workflows/deploy.yml` 이 빌드해서 `gh-pages` 브랜치로 배포합니다.

## 플레이

1. 손님을 탭하면 셰프가 걸어가 대화가 열립니다. 취향을 묻거나 메뉴판에서 메뉴를 골라 주문을 받아요.
2. 아래 주문 티켓이나 주방의 마스터 조리대를 탭하면 3D 조리대 클로즈업이 열립니다 (썰기 · 바르기 · 쌓기 · 추출 …).
3. 완성하면 쟁반을 들고, 손님을 탭해 서빙합니다. 등급(S/A/B/C)에 따라 팁 · 단골 · 친밀도가 쌓여요.
4. 상단 '리액션' 버튼으로 줌인 · 감탄 · 품평 카드를 켜고 끌 수 있고, '메뉴'에서 단골 수첩 · 꾸미기 & 설비 해금을 엽니다.

에셋: Kenney (CC0) 가구 모델, Mixamo 애니메이션(변환본만 포함).
