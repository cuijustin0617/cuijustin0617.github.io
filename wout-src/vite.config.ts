import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the app from a sub-path: WOUT_BASE=/wout/ npm run build:pages
  base: process.env.WOUT_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    // *.min.js: Jekyll's jekyll-terser plugin skips these, so the bundle ships byte-for-byte.
    rollupOptions: { output: { entryFileNames: 'assets/[name]-[hash].min.js', chunkFileNames: 'assets/[name]-[hash].min.js' } },
  },
});
