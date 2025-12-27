/**
 * Workshop Supervisor Tab 导航器
 * 5个主Tab: 首页、批次、人员、设备、我的
 * 用于车间主任 (department_admin) 角色
 */

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Icon } from "react-native-paper";
import { WorkshopSupervisorTabParamList } from "../types/navigation";

// 导入5个Stack导航器
import WSHomeStackNavigator from "./workshop-supervisor/WSHomeStackNavigator";
import WSBatchesStackNavigator from "./workshop-supervisor/WSBatchesStackNavigator";
import WSWorkersStackNavigator from "./workshop-supervisor/WSWorkersStackNavigator";
import WSEquipmentStackNavigator from "./workshop-supervisor/WSEquipmentStackNavigator";
import WSProfileStackNavigator from "./workshop-supervisor/WSProfileStackNavigator";

const Tab = createBottomTabNavigator<WorkshopSupervisorTabParamList>();

// Tab栏配色 - 车间主任专属主题色
const TAB_COLORS = {
  active: "#667eea",  // 紫蓝渐变主色
  inactive: "#757575",
};

export function WorkshopSupervisorTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_COLORS.active,
        tabBarInactiveTintColor: TAB_COLORS.inactive,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e0e0e0",
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      {/* 首页Tab */}
      <Tab.Screen
        name="WSHomeTab"
        component={WSHomeStackNavigator}
        options={{
          title: "首页",
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" size={size} color={color} />
          ),
        }}
      />

      {/* 批次Tab */}
      <Tab.Screen
        name="WSBatchesTab"
        component={WSBatchesStackNavigator}
        options={{
          title: "批次",
          tabBarIcon: ({ color, size }) => (
            <Icon source="view-grid" size={size} color={color} />
          ),
        }}
      />

      {/* 人员Tab */}
      <Tab.Screen
        name="WSWorkersTab"
        component={WSWorkersStackNavigator}
        options={{
          title: "人员",
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-group" size={size} color={color} />
          ),
        }}
      />

      {/* 设备Tab */}
      <Tab.Screen
        name="WSEquipmentTab"
        component={WSEquipmentStackNavigator}
        options={{
          title: "设备",
          tabBarIcon: ({ color, size }) => (
            <Icon source="tools" size={size} color={color} />
          ),
        }}
      />

      {/* 我的Tab */}
      <Tab.Screen
        name="WSProfileTab"
        component={WSProfileStackNavigator}
        options={{
          title: "我的",
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default WorkshopSupervisorTabNavigator;
