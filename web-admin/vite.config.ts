import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
          target: env.VITE_BACKEND_URL || 'http://localhost:10010',
          changeOrigin: true,
        },
        // Python SmartBI 服务代理 - 解决跨域问题
        // /smartbi-api/api/chart/build → http://localhost:8083/api/chart/build
        '/smartbi-api': {
          target: env.VITE_PYTHON_URL || 'http://localhost:8083',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/smartbi-api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 800,
      // Only preload chunks that the entry synchronously needs — skip transitive lazy chunks
      // (otherwise Vite preloads echarts/pdf-lib on every page load even though they're lazy)
      modulePreload: {
        resolveDependencies: (_filename, deps) => {
          return deps.filter(
            (dep) =>
              !dep.includes('echarts-') &&
              !dep.includes('pdf-lib-') &&
              !dep.includes('xlsx-lib-') &&
              !dep.includes('vue-flow-'),
          );
        },
      },
      rollupOptions: {
        output: {
          // 注意: 不要拆 element-plus / vue / pinia / vue-router (会 TDZ)
          // 只拆独立重包: echarts / xlsx / pdf / vue-flow canvas 编辑器
          manualChunks: {
            'echarts': ['echarts', 'vue-echarts'],
            'xlsx-lib': ['xlsx'],
            'pdf-lib': ['jspdf', 'html2canvas'],
            'vue-flow': [
              '@vue-flow/core',
              '@vue-flow/controls',
            ],
          },
        },
      },
    },
  };
});
