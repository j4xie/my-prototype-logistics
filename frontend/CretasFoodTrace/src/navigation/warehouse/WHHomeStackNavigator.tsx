/**
 * Warehouse 首页 Stack 导航器
 * 包含: 首页Dashboard、出货详情、入库详情、预警处理、温控监测
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WHHomeStackParamList } from "../../types/navigation";

// 导入首页相关页面组件
import WHHomeScreen from "../../screens/warehouse/home/WHHomeScreen";

// 详情页 (先用占位符，后续实现)
import WHOutboundDetailScreen from "../../screens/warehouse/outbound/WHOutboundDetailScreen";
import WHInboundDetailScreen from "../../screens/warehouse/inbound/WHInboundDetailScreen";
import WHAlertHandleScreen from "../../screens/warehouse/shared/WHAlertHandleScreen";
import WHTempMonitorScreen from "../../screens/warehouse/inventory/WHTempMonitorScreen";

const Stack = createNativeStackNavigator<WHHomeStackParamList>();

export function WHHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 首页Dashboard */}
      <Stack.Screen name="WHHome" component={WHHomeScreen} />

      {/* 出货详情 */}
      <Stack.Screen
        name="OutboundDetail"
        component={WHOutboundDetailScreen}
        options={{ title: "出货详情" }}
      />

      {/* 入库详情 */}
      <Stack.Screen
        name="InboundDetail"
        component={WHInboundDetailScreen}
        options={{ title: "入库详情" }}
      />

      {/* 预警处理 */}
      <Stack.Screen
        name="AlertHandle"
        component={WHAlertHandleScreen}
        options={{ title: "预警处理" }}
      />

      {/* 温控监测 */}
      <Stack.Screen
        name="TempMonitor"
        component={WHTempMonitorScreen}
        options={{ title: "温控监测" }}
      />
    </Stack.Navigator>
  );
}

export default WHHomeStackNavigator;
