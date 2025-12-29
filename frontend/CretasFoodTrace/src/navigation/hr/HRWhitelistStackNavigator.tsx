/**
 * HR 白名单 Stack 导航器
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WhitelistListScreen from '../../screens/hr/whitelist/WhitelistListScreen';
import WhitelistAddScreen from '../../screens/hr/whitelist/WhitelistAddScreen';
import DepartmentListScreen from '../../screens/hr/department/DepartmentListScreen';
import DepartmentAddScreen from '../../screens/hr/department/DepartmentAddScreen';
import DepartmentDetailScreen from '../../screens/hr/department/DepartmentDetailScreen';
import StaffDetailScreen from '../../screens/hr/staff/StaffDetailScreen';

import type { HRWhitelistStackParamList } from '../../types/hrNavigation';

const Stack = createNativeStackNavigator<HRWhitelistStackParamList>();

export default function HRWhitelistStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="WhitelistList" component={WhitelistListScreen} />
      <Stack.Screen name="WhitelistAdd" component={WhitelistAddScreen} />
      <Stack.Screen name="DepartmentList" component={DepartmentListScreen} />
      <Stack.Screen name="DepartmentAdd" component={DepartmentAddScreen} />
      <Stack.Screen name="DepartmentDetail" component={DepartmentDetailScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
    </Stack.Navigator>
  );
}
