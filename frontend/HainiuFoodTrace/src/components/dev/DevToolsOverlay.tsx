import React from 'react';
import { View, StyleSheet } from 'react-native';
import MockControlPanel from './MockControlPanel';
import Week1FunctionalityTest from '../test/Week1FunctionalityTest';
import PermissionExamples from '../examples/PermissionExamples';
import PermissionComponentsDemo from '../examples/PermissionComponentsDemo';

/**
 * 开发工具覆盖层
 * 集成所有开发和测试工具
 */
export const DevToolsOverlay: React.FC = () => {
  // 只在开发环境显示
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Mock控制面板 */}
      <MockControlPanel />
      
      {/* 功能测试组件 */}
      <Week1FunctionalityTest />
      
      {/* 权限组件演示 */}
      <PermissionComponentsDemo />
      
      {/* 权限系统演示组件 */}
      {/* <PermissionExamples /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
});

export default DevToolsOverlay;