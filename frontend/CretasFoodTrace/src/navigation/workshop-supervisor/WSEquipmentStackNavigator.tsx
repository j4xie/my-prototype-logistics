/**
 * Workshop Supervisor 设备管理 Stack 导航器
 * 包含: 设备列表、设备详情、设备告警、设备维护
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WSEquipmentStackParamList } from "../../types/navigation";

// 导入设备相关页面组件
import WSEquipmentScreen from "../../screens/workshop-supervisor/equipment/WSEquipmentScreen";
import EquipmentAlertScreen from "../../screens/workshop-supervisor/equipment/EquipmentAlertScreen";
import EquipmentMaintenanceScreen from "../../screens/workshop-supervisor/equipment/EquipmentMaintenanceScreen";

// 复用现有详情页
import EquipmentDetailScreen from "../../screens/processing/EquipmentDetailScreen";

const Stack = createNativeStackNavigator<WSEquipmentStackParamList>();

export function WSEquipmentStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 设备列表主页 */}
      <Stack.Screen name="WSEquipment" component={WSEquipmentScreen} />

      {/* 设备详情 (复用现有) */}
      <Stack.Screen
        name="EquipmentDetail"
        component={EquipmentDetailScreen}
        options={{ title: "设备详情" }}
      />

      {/* 设备告警详情 */}
      <Stack.Screen
        name="EquipmentAlert"
        component={EquipmentAlertScreen}
        options={{ title: "告警详情" }}
      />

      {/* 设备维护记录 */}
      <Stack.Screen
        name="EquipmentMaintenance"
        component={EquipmentMaintenanceScreen}
        options={{ title: "维护记录" }}
      />
    </Stack.Navigator>
  );
}

export default WSEquipmentStackNavigator;
