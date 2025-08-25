import { defineConfig } from 'vite';

export default defineConfig({
  base: '/assets/',
  build: {
    outDir: 'dist',
    assetsDir: '',
    rollupOptions: {
      output: {
        entryFileNames: 'index-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: 'index-[hash].[ext]'
      }
    }
  }
});