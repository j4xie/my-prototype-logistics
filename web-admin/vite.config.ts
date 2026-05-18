import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

/**
 * P3 #89 服务代码 footer badge — build-time injected constants.
 * Read package.json version + git short SHA so client can report
 * a unique "service code" string for customer issue reports.
 */
function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getCommitSha(): string {
  // CI / deploy may pre-set this; fall back to git in dev / local build.
  if (process.env.VITE_COMMIT_SHA) return process.env.VITE_COMMIT_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
  } catch {
    return 'unknown';
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [vue()],
    define: {
      __APP_VERSION__: JSON.stringify(getAppVersion()),
      __COMMIT_SHA__: JSON.stringify(getCommitSha()),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
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
              !dep.includes('vue-flow-') &&
              // Round 6: el-icons 也 skip preload — 登录页仅需极少 icon, runtime lazy
              !dep.includes('el-icons-'),
          );
        },
      },
      rollupOptions: {
        output: {
          // 注意: 不要拆 element-plus / vue / pinia / vue-router (会 TDZ)
          // UX Round 6: 只拆独立重包 + icons (纯 SVG, 无循环依赖)
          manualChunks: {
            'echarts': ['echarts', 'vue-echarts'],
            'xlsx-lib': ['xlsx'],
            'pdf-lib': ['jspdf', 'html2canvas'],
            'vue-flow': [
              '@vue-flow/core',
              '@vue-flow/controls',
            ],
            // Round 6: icons 独立 chunk (~50KB, 纯数据, 登录页仅用少数可 tree-shake)
            'el-icons': ['@element-plus/icons-vue'],
          },
        },
      },
    },
  };
});
