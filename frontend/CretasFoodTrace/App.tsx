import React, { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useLanguageStore } from './src/store/languageStore';

// 初始化 i18n（必须在 App 组件之前导入）
import './src/i18n';

/**
 * 白垩纪食品溯源系统 - React Native 移动端
 *
 * 功能特性:
 * - 多角色认证系统 (8种角色: developer, platform_admin, factory roles...)
 * - 基于权限的动态导航
 * - 生物识别登录
 * - 自动登录
 * - 离线支持
 * - Token管理
 * - Toast消息提示 (react-native-toast-message)
 * - 多语言支持 (i18n: zh-CN, en-US)
 */
export default function App() {
  const initializeLanguage = useLanguageStore((state) => state.initializeLanguage);

  useEffect(() => {
    // 初始化语言设置
    initializeLanguage();
  }, [initializeLanguage]);

  return (
    <>
      <AppNavigator />
      <Toast />
    </>
  );
}
