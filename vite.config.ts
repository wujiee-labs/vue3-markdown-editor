import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WujieeMarkdownEditor',
      cssFileName: 'style',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs'
    },
    rollupOptions: {
      external: ['vue', 'markdown-it', 'turndown'],
      output: {
        exports: 'named',
        globals: { vue: 'Vue' }
      }
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts']
  }
})
