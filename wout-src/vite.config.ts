import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Each build gets an id; the app compares it with the deployed version.json to update itself.
const BUILD_ID = Date.now().toString(36);
const versionFile = (): Plugin => ({
  name: 'wout-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

export default defineConfig({
  // GitHub Pages serves the app from a sub-path: WOUT_BASE=/wout/ npm run build:pages
  base: process.env.WOUT_BASE ?? '/',
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    // *.min.js: Jekyll's jekyll-terser plugin skips these, so the bundle ships byte-for-byte.
    rollupOptions: { output: { entryFileNames: 'assets/[name]-[hash].min.js', chunkFileNames: 'assets/[name]-[hash].min.js' } },
  },
});
