/**
 * 应用入口
 * 使用异步引导模式，确保模块按正确顺序加载
 */

// 先同步导入 Vue 核心（无依赖）
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// 异步引导函数
async function bootstrap() {
  // 1. 创建 Vue 应用
  const app = createApp(App);

  // 2. 加载并注册 Element Plus（必须在其他依赖之前）
  const ElementPlus = await import('element-plus');
  await import('element-plus/dist/index.css');
  const zhCn = await import('element-plus/es/locale/lang/zh-cn');

  app.use(ElementPlus.default, {
    locale: zhCn.default,
  });

  // 3. 注册 Element Plus 图标
  const ElementPlusIconsVue = await import('@element-plus/icons-vue');
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    if (key !== 'default') {
      app.component(key, component as any);
    }
  }

  // 4. 注册 Pinia（必须在路由守卫之前）
  const pinia = await import('./store');
  app.use(pinia.default);

  // 5. 加载路由并设置守卫（pinia 已就绪）
  const routerModule = await import('./router');
  const router = routerModule.default;
  const { setupRouterGuards } = routerModule;

  setupRouterGuards(router);
  app.use(router);

  // 6. 挂载应用
  app.mount('#app');
}

// 启动应用
bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
});
