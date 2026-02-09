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
    host: '127.0.0.1',  // Bind to IPv4 to fix connection issues on Windows
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:10010',
        changeOrigin: true,
      },
      // Python SmartBI 服务代理 - 解决跨域问题
      // /smartbi-api/api/chart/build → http://localhost:8083/api/chart/build
      '/smartbi-api': {
        target: process.env.VITE_PYTHON_URL || 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smartbi-api/, ''),
      },
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
