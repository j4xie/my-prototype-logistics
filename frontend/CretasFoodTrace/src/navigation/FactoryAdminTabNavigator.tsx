/**
 * Factory Admin Tab 导航器
 * 6个主Tab: 首页、AI分析、报表、智能分析、管理、我的
 */

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Icon } from "react-native-paper";
import { FactoryAdminTabParamList } from "../types/navigation";
import { useFactoryFeatureStore } from "../store/factoryFeatureStore";

// 导入6个Stack导航器
import FAHomeStackNavigator from "./factory-admin/FAHomeStackNavigator";
import FAAIStackNavigator from "./factory-admin/FAAIStackNavigator";
import FAReportsStackNavigator from "./factory-admin/FAReportsStackNavigator";
import SmartBIStackNavigator from "./SmartBIStackNavigator";
import FAManagementStackNavigator from "./factory-admin/FAManagementStackNavigator";
import FAProfileStackNavigator from "./factory-admin/FAProfileStackNavigator";

const Tab = createBottomTabNavigator<FactoryAdminTabParamList>();

// Tab栏配色
const TAB_COLORS = {
  active: "#2196F3",
  inactive: "#757575",
};

export function FactoryAdminTabNavigator() {
  const { isScreenEnabled } = useFactoryFeatureStore();

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
        name="FAHomeTab"
        component={FAHomeStackNavigator}
        options={{
          title: "首页",
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" size={size} color={color} />
          ),
        }}
      />

      {/* AI分析Tab */}
      {isScreenEnabled('AIAnalysis') && (
      <Tab.Screen
        name="FAAITab"
        component={FAAIStackNavigator}
        options={{
          title: "AI分析",
          tabBarIcon: ({ color, size }) => (
            <Icon source="chart-line" size={size} color={color} />
          ),
        }}
      />
      )}

      {/* 报表Tab */}
      {isScreenEnabled('Reports') && (
      <Tab.Screen
        name="FAReportsTab"
        component={FAReportsStackNavigator}
        options={{
          title: "报表",
          tabBarIcon: ({ color, size }) => (
            <Icon source="file-chart" size={size} color={color} />
          ),
        }}
      />
      )}

      {/* 智能分析Tab (SmartBI) */}
      {isScreenEnabled('SmartBI') && (
      <Tab.Screen
        name="FASmartBITab"
        component={SmartBIStackNavigator}
        options={{
          title: "智能分析",
          tabBarIcon: ({ color, size }) => (
            <Icon source="chart-timeline-variant" size={size} color={color} />
          ),
        }}
      />
      )}

      {/* 管理Tab */}
      <Tab.Screen
        name="FAManagementTab"
        component={FAManagementStackNavigator}
        options={{
          title: "管理",
          tabBarIcon: ({ color, size }) => (
            <Icon source="cog" size={size} color={color} />
          ),
        }}
      />

      {/* 我的Tab */}
      <Tab.Screen
        name="FAProfileTab"
        component={FAProfileStackNavigator}
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

export default FactoryAdminTabNavigator;
