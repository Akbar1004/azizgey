import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: true, hmr: false, ws: false },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
