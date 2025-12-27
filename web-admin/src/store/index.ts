/**
 * Pinia Store 入口
 * 注意：不要在这里重新导出 store 模块，避免循环依赖
 * 需要使用 store 时直接从对应模块导入，如：
 * import { useAuthStore } from '@/store/modules/auth';
 */
import { createPinia } from 'pinia';

const pinia = createPinia();

export default pinia;
