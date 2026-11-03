import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages(https://<user>.github.io/ciao-trattoria/) 하위 경로와 로컬 모두에서 동작하도록 상대 경로
  base: './',
  server: { port: 5173, strictPort: true },
});
