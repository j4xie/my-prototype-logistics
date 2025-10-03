import React from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';

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
 */
export default function App() {
  return <AppNavigator />;
}
