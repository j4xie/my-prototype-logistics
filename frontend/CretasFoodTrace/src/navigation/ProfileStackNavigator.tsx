import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types/navigation';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Phase 3 P2 - 意见反馈
import FeedbackScreen from '../screens/profile/FeedbackScreen';

// Phase 3 P2 - 数据导出
import DataExportScreen from '../screens/reports/DataExportScreen';

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
    </Stack.Navigator>
  );
}

export default ProfileStackNavigator;
