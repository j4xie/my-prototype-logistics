/**
 * Factory Admin 首页 Stack 导航器
 * 包含: 首页Dashboard、今日生产、今日批次、原材料批次、AI预警详情
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FAHomeStackParamList } from "../../types/navigation";

// 导入首页相关页面组件
import FAHomeScreen from "../../screens/factory-admin/home/FAHomeScreen";
import TodayProductionScreen from "../../screens/factory-admin/home/TodayProductionScreen";
import TodayBatchesScreen from "../../screens/factory-admin/home/TodayBatchesScreen";
import MaterialBatchScreen from "../../screens/factory-admin/home/MaterialBatchScreen";
import AIAlertsScreen from "../../screens/factory-admin/home/AIAlertsScreen";

// 复用现有详情页
import BatchDetailScreen from "../../screens/processing/BatchDetailScreen";
import MaterialBatchDetailScreen from "../../screens/factory-admin/home/MaterialBatchDetailScreen";

const Stack = createNativeStackNavigator<FAHomeStackParamList>();

export function FAHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 首页Dashboard */}
      <Stack.Screen name="FAHome" component={FAHomeScreen} />

      {/* 今日生产统计 */}
      <Stack.Screen
        name="TodayProduction"
        component={TodayProductionScreen}
        options={{ title: "今日生产" }}
      />

      {/* 今日批次列表 */}
      <Stack.Screen
        name="TodayBatches"
        component={TodayBatchesScreen}
        options={{ title: "今日批次" }}
      />

      {/* 原材料批次管理 */}
      <Stack.Screen
        name="MaterialBatch"
        component={MaterialBatchScreen}
        options={{ title: "原材料批次" }}
      />

      {/* AI预警详情 */}
      <Stack.Screen
        name="AIAlerts"
        component={AIAlertsScreen}
        options={{ title: "AI预警" }}
      />

      {/* 批次详情 (复用现有) */}
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
        options={{ title: "批次详情" }}
      />

      {/* 原材料批次详情 (复用现有) */}
      <Stack.Screen
        name="MaterialBatchDetail"
        component={MaterialBatchDetailScreen}
        options={{ title: "原材料详情" }}
      />
    </Stack.Navigator>
  );
}

export default FAHomeStackNavigator;
