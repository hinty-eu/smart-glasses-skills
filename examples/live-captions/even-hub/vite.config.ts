import { defineConfig } from 'vite'

// Relative asset paths: the Even app serves the packed plugin from an origin you do not control.
// The plugin imports ../web-glasses/fit.js and link.js (shared with the web target), so the dev server may read one level up.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173, fs: { allow: ['..'] } },
  preview: { host: '127.0.0.1', port: 5180 },
  build: { target: 'es2020', outDir: 'dist', emptyOutDir: true, sourcemap: false },
})
