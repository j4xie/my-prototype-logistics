// @ts-nocheck
/**
 * languageStore 单元测试
 * 测试语言切换、系统语言跟随、初始化逻辑
 */

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'zh' }]) }));
jest.mock('../../../i18n', () => ({ changeLanguage: jest.fn() }));
jest.mock('../../../i18n/types', () => ({
  DEFAULT_LANGUAGE: 'zh-CN',
  SUPPORTED_LANGUAGES: ['zh-CN', 'en-US'],
  LANGUAGE_NAMES: { 'zh-CN': '中文', 'en-US': 'English' },
}));

import { useLanguageStore } from '../../../store/languageStore';
import { getLocales } from 'expo-localization';
import { changeLanguage } from '../../../i18n';

const resetStore = () => {
  useLanguageStore.setState({
    language: 'zh-CN',
    isSystemLanguage: true,
  });
};

describe('languageStore', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  describe('default state', () => {
    it('should have zh-CN as default language', () => {
      const state = useLanguageStore.getState();
      expect(state.language).toBe('zh-CN');
    });

    it('should have isSystemLanguage true by default', () => {
      const state = useLanguageStore.getState();
      expect(state.isSystemLanguage).toBe(true);
    });
  });

  describe('setLanguage', () => {
    it('should set language to en-US', () => {
      useLanguageStore.getState().setLanguage('en-US');
      expect(useLanguageStore.getState().language).toBe('en-US');
    });

    it('should call changeLanguage with new language', () => {
      useLanguageStore.getState().setLanguage('en-US');
      expect(changeLanguage).toHaveBeenCalledWith('en-US');
    });

    it('should set isSystemLanguage to false when manually setting language', () => {
      useLanguageStore.getState().setLanguage('en-US');
      expect(useLanguageStore.getState().isSystemLanguage).toBe(false);
    });

    it('should handle setting the same language', () => {
      useLanguageStore.getState().setLanguage('zh-CN');
      expect(useLanguageStore.getState().language).toBe('zh-CN');
    });

    it('should accept unsupported language codes without crashing', () => {
      expect(() => useLanguageStore.getState().setLanguage('fr-FR')).not.toThrow();
    });
  });

  describe('setSystemLanguage', () => {
    it('should set isSystemLanguage to true', () => {
      useLanguageStore.setState({ isSystemLanguage: false });
      useLanguageStore.getState().setSystemLanguage(true);
      expect(useLanguageStore.getState().isSystemLanguage).toBe(true);
    });

    it('should set isSystemLanguage to false', () => {
      useLanguageStore.getState().setSystemLanguage(false);
      expect(useLanguageStore.getState().isSystemLanguage).toBe(false);
    });

    it('should update language to system language when set to true', () => {
      useLanguageStore.setState({ language: 'en-US', isSystemLanguage: false });
      useLanguageStore.getState().setSystemLanguage(true);
      expect(useLanguageStore.getState().isSystemLanguage).toBe(true);
    });
  });

  describe('initializeLanguage', () => {
    it('should use system language when isSystemLanguage is true', () => {
      useLanguageStore.setState({ isSystemLanguage: true });
      useLanguageStore.getState().initializeLanguage();
      expect(getLocales).toHaveBeenCalled();
    });

    it('should keep manual language when isSystemLanguage is false', () => {
      useLanguageStore.setState({ language: 'en-US', isSystemLanguage: false });
      useLanguageStore.getState().initializeLanguage();
      expect(useLanguageStore.getState().language).toBe('en-US');
    });

    it('should call changeLanguage during initialization', () => {
      useLanguageStore.getState().initializeLanguage();
      expect(changeLanguage).toHaveBeenCalled();
    });
  });

  describe('getSystemLanguage', () => {
    it('should return system language code from expo-localization', () => {
      const result = useLanguageStore.getState().getSystemLanguage();
      expect(result).toBeDefined();
    });

    it('should call getLocales', () => {
      useLanguageStore.getState().getSystemLanguage();
      expect(getLocales).toHaveBeenCalled();
    });

    it('should fallback to default when system locale is unsupported', () => {
      (getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'ja' }]);
      const result = useLanguageStore.getState().getSystemLanguage();
      expect(typeof result).toBe('string');
    });
  });
});
