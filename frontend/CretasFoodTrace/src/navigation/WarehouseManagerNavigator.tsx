/**
 * Warehouse Manager 导航器入口
 * 仅 warehouse_manager 和 warehouse_worker 角色使用
 * 5个Tab: 首页 | 入库 | 出货 | 库存 | 我的
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WarehouseManagerTabNavigator from './WarehouseManagerTabNavigator';

const Stack = createNativeStackNavigator();

export function WarehouseManagerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WarehouseManagerMain" component={WarehouseManagerTabNavigator} />
    </Stack.Navigator>
  );
}

export default WarehouseManagerNavigator;
