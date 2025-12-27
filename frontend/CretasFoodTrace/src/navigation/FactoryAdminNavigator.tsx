/**
 * Factory Admin 导航器入口
 * 仅 factory_super_admin 角色使用的新界面
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FactoryAdminTabNavigator from './FactoryAdminTabNavigator';

const Stack = createNativeStackNavigator();

export function FactoryAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FactoryAdminMain" component={FactoryAdminTabNavigator} />
    </Stack.Navigator>
  );
}

export default FactoryAdminNavigator;
