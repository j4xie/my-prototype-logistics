/**
 * i18n 类型定义
 * 提供类型安全的翻译键支持
 */
import 'i18next';

// 支持的语言
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

// 语言显示名称
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

// 命名空间列表
export const NAMESPACES = [
  'common',
  'auth',
  'home',
  'processing',
  'quality',
  'warehouse',
  'hr',
  'dispatcher',
  'reports',
  'management',
  'alerts',
  'profile',
  'errors',
  'platform',
  'workshop',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

// 类型安全的翻译键扩展
// 注意：当添加新的翻译文件后，需要在这里更新类型定义
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    // 暂时使用 string 类型，后续可以根据 JSON 文件生成精确类型
    resources: Record<Namespace, Record<string, unknown>>;
  }
}
