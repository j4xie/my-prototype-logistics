import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://139.196.165.140:10010', // 远程服务器
        // target: 'http://localhost:10010', // 本地后端
        changeOrigin: true,
      },
      // Python SmartBI 服务代理 (可选，前端直连时不需要)
      // '/smartbi': {
      //   target: 'http://139.196.165.140:8083',
      //   changeOrigin: true,
      //   rewrite: (path) => path.replace(/^\/smartbi/, '/api'),
      // },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 注意：不要使用 manualChunks 将 element-plus 和 vue 分到不同 chunk
    // element-plus 深度依赖 Vue 响应式 API，分离会导致 TDZ 错误
    // 让 Vite 自动处理代码分割
  },
});
