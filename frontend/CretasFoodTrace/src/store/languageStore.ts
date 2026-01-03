/**
 * 语言状态管理
 * 使用 Zustand 管理语言偏好，支持持久化
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from '../i18n';
import {
  type SupportedLanguage,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
} from '../i18n/types';

interface LanguageState {
  /** 当前语言 */
  language: SupportedLanguage;
  /** 是否跟随系统语言 */
  isSystemLanguage: boolean;

  /** 设置语言（手动切换） */
  setLanguage: (lang: SupportedLanguage) => void;
  /** 设置是否跟随系统 */
  setSystemLanguage: (follow: boolean) => void;
  /** 初始化语言（App 启动时调用） */
  initializeLanguage: () => void;
  /** 获取系统语言 */
  getSystemLanguage: () => SupportedLanguage;
}

/**
 * 检测系统语言
 */
const detectSystemLanguage = (): SupportedLanguage => {
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode ?? 'zh';

    if (deviceLang.startsWith('en')) {
      return 'en-US';
    }
    return 'zh-CN';
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: DEFAULT_LANGUAGE,
      isSystemLanguage: true,

      setLanguage: (lang: SupportedLanguage) => {
        // 验证语言是否支持
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
          console.warn(`[LanguageStore] Unsupported language: ${lang}`);
          return;
        }

        i18n.changeLanguage(lang);
        set({ language: lang, isSystemLanguage: false });
      },

      setSystemLanguage: (follow: boolean) => {
        if (follow) {
          const systemLang = detectSystemLanguage();
          i18n.changeLanguage(systemLang);
          set({ language: systemLang, isSystemLanguage: true });
        } else {
          set({ isSystemLanguage: false });
        }
      },

      initializeLanguage: () => {
        const { language, isSystemLanguage } = get();

        if (isSystemLanguage) {
          // 跟随系统时，检测当前系统语言
          const systemLang = detectSystemLanguage();
          if (systemLang !== language) {
            set({ language: systemLang });
          }
          i18n.changeLanguage(systemLang);
        } else {
          // 手动设置时，使用存储的语言
          i18n.changeLanguage(language);
        }
      },

      getSystemLanguage: () => {
        return detectSystemLanguage();
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化这些字段
      partialize: (state) => ({
        language: state.language,
        isSystemLanguage: state.isSystemLanguage,
      }),
      onRehydrateStorage: () => (state) => {
        // 恢复存储后应用语言设置
        if (state) {
          const lang = state.isSystemLanguage
            ? detectSystemLanguage()
            : state.language;
          i18n.changeLanguage(lang);
        }
      },
    }
  )
);

// 导出常用值
export { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, DEFAULT_LANGUAGE };
export type { SupportedLanguage };
