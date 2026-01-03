/**
 * i18n 国际化配置
 * 使用 i18next + react-i18next + expo-localization
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import 'intl-pluralrules'; // Android polyfill

import { resources } from './resources';
import { DEFAULT_LANGUAGE, NAMESPACES, type SupportedLanguage } from './types';

/**
 * 获取设备语言
 * 根据系统语言返回支持的语言代码
 */
const getDeviceLanguage = (): SupportedLanguage => {
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode ?? 'zh';

    // 映射设备语言到支持的语言
    if (deviceLang.startsWith('en')) {
      return 'en-US';
    }
    // 默认中文
    return 'zh-CN';
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

// 初始化 i18n
i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,

  // 命名空间配置
  defaultNS: 'common',
  ns: [...NAMESPACES],

  // 插值配置
  interpolation: {
    escapeValue: false, // React 已自动转义
  },

  // React Native 特定配置
  react: {
    useSuspense: false, // React Native 不使用 Suspense
  },

  // 兼容性配置
  compatibilityJSON: 'v4',

  // 调试模式（仅开发环境）
  debug: __DEV__,

  // 缺失翻译处理
  saveMissing: __DEV__,
  missingKeyHandler: (lngs, ns, key) => {
    if (__DEV__) {
      console.warn(`[i18n] Missing translation: ${ns}:${key} for ${lngs.join(', ')}`);
    }
  },
});

export default i18n;

// 导出常用类型和工具
export { useTranslation, Trans, withTranslation } from 'react-i18next';
export type { TFunction } from 'i18next';
export * from './types';
