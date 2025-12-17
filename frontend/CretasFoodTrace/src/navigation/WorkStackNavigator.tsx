import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorkStackParamList } from '../types/navigation';
import { WorkTypeListScreen, WorkTypeFormScreen } from '../screens/work';

const Stack = createNativeStackNavigator<WorkStackParamList>();

/**
 * 工作模块导航器
 * Operator专用 - 工作类型和工作记录
 */
export function WorkStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {/* 工作类型列表 */}
      <Stack.Screen
        name="WorkTypeList"
        component={WorkTypeListScreen}
        options={{
          title: '我的工作',
          headerShown: false, // 列表页自己有标题
        }}
      />

      {/* 工作记录表单 */}
      <Stack.Screen
        name="WorkTypeForm"
        component={WorkTypeFormScreen}
        options={({ route }) => ({
          title: route.params.workTypeName || '工作记录',
        })}
      />
    </Stack.Navigator>
  );
}

export default WorkStackNavigator;
