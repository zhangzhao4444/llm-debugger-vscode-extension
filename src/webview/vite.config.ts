import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'out',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'webview.[hash].js',
        assetFileNames: 'webview.[hash][extname]',
      },
    },
  },
  plugins: [react()],
}); 