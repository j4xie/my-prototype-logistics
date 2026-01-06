import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types/navigation';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Phase 3 P2 - 意见反馈
import FeedbackScreen from '../screens/profile/FeedbackScreen';

// Phase 3 P2 - 数据导出
import DataExportScreen from '../screens/reports/DataExportScreen';

// 开发者工具 - 服务器连接测试
import ServerConnectivityTestScreen from '../screens/test/ServerConnectivityTestScreen';

// 开发者工具 - 意图执行测试
import IntentExecutionTestScreen from '../screens/test/IntentExecutionTestScreen';

// S4-4 通知中心 - 所有角色可访问
import NotificationCenterScreen from '../screens/common/NotificationCenterScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * 个人中心模块导航器
 * Phase 3 P2新增
 */
export function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: '个人中心' }}
      />

      {/* Phase 3 P2 - 意见反馈 */}
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ title: '意见反馈' }}
      />

      {/* Phase 3 P2 - 数据导出 */}
      <Stack.Screen
        name="DataExport"
        component={DataExportScreen}
        options={{ title: '数据导出' }}
      />

      {/* 开发者工具 - 服务器连接测试 */}
      <Stack.Screen
        name="ServerConnectivityTest"
        component={ServerConnectivityTestScreen}
        options={{ title: '服务器连接测试' }}
      />

      {/* 开发者工具 - 意图执行测试 */}
      <Stack.Screen
        name="IntentExecutionTest"
        component={IntentExecutionTestScreen}
        options={{ title: '意图执行测试' }}
      />

      {/* S4-4 通知中心 - 所有角色可访问 */}
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ title: '通知中心' }}
      />
    </Stack.Navigator>
  );
}

export default ProfileStackNavigator;
