/**
 * Workshop Supervisor 首页 Stack 导航器
 * 包含: 首页Dashboard、批次详情、员工详情、设备详情、通知、任务引导
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WSHomeStackParamList } from "../../types/navigation";

// 导入首页相关页面组件
import WSHomeScreen from "../../screens/workshop-supervisor/home/WSHomeScreen";

// 复用现有详情页
import BatchDetailScreen from "../../screens/processing/BatchDetailScreen";
import EquipmentDetailScreen from "../../screens/processing/EquipmentDetailScreen";

// 任务引导流程 (可复用或新建)
import TaskGuideScreen from "../../screens/workshop-supervisor/home/TaskGuideScreen";
import TaskGuideStep2Screen from "../../screens/workshop-supervisor/home/TaskGuideStep2Screen";
import TaskGuideStep3Screen from "../../screens/workshop-supervisor/home/TaskGuideStep3Screen";

// 通知页面 (新建或复用)
import NotificationsScreen from "../../screens/workshop-supervisor/home/NotificationsScreen";

// 员工详情 (复用或新建)
import WorkerDetailScreen from "../../screens/workshop-supervisor/workers/WorkerDetailScreen";

const Stack = createNativeStackNavigator<WSHomeStackParamList>();

export function WSHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 首页Dashboard */}
      <Stack.Screen name="WSHome" component={WSHomeScreen} />

      {/* 批次详情 (复用现有) */}
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
        options={{ title: "批次详情" }}
      />

      {/* 员工详情 */}
      <Stack.Screen
        name="WorkerDetail"
        component={WorkerDetailScreen}
        options={{ title: "员工详情" }}
      />

      {/* 设备详情 (复用现有) */}
      <Stack.Screen
        name="EquipmentDetail"
        component={EquipmentDetailScreen}
        options={{ title: "设备详情" }}
      />

      {/* 通知 */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "通知" }}
      />

      {/* 任务引导流程 - 步骤1: 前往工位 */}
      <Stack.Screen
        name="TaskGuide"
        component={TaskGuideScreen}
        options={{ title: "任务引导" }}
      />

      {/* 任务引导流程 - 步骤2: 确认设备 */}
      <Stack.Screen
        name="TaskGuideStep2"
        component={TaskGuideStep2Screen}
        options={{ title: "确认设备" }}
      />

      {/* 任务引导流程 - 步骤3: 召集人员 */}
      <Stack.Screen
        name="TaskGuideStep3"
        component={TaskGuideStep3Screen}
        options={{ title: "召集人员" }}
      />
    </Stack.Navigator>
  );
}

export default WSHomeStackNavigator;
