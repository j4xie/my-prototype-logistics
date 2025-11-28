/**
 * 环境变量类型声明
 * 用于 react-native-dotenv 的 TypeScript 类型支持
 *
 * 配置位置：
 * - 开发环境: .env.local
 * - 测试环境: .env.test
 * - 生产环境: .env.production
 * - 默认: .env
 */

declare module '@env' {
  export const REACT_APP_API_URL: string;
  export const REACT_APP_DEBUG: string;
  export const REACT_APP_NAME: string;
  export const REACT_APP_ENV: string;
  export const REACT_APP_LOG_LEVEL: string;
  export const REACT_APP_ENABLE_ANALYTICS: string;
}
