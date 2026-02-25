/**
 * Viewer 导航器
 * 仅 viewer 角色使用 — 全模块只读访问
 * 4个Tab: 首页 | 销售 | 采购 | 我的
 *
 * 注意: viewer 角色所有页面均为只读（依赖后端 @RequirePermission 阻止写操作）
 * 前端复用现有 List 页面（列表页本身就是只读的），Detail 页面中的操作按钮
 * 由后端权限拦截器保护。
 */

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Icon } from "react-native-paper";

// 首页
import HomeScreen from "../screens/main/HomeScreen";

// 销售只读 - 列表 + 详情
import SalesOrderListScreen from "../screens/factory-admin/inventory/SalesOrderListScreen";
import SalesOrderDetailScreen from "../screens/factory-admin/inventory/SalesOrderDetailScreen";
import PriceListScreen from "../screens/factory-admin/inventory/PriceListScreen";
import ArApOverviewScreen from "../screens/factory-admin/inventory/ArApOverviewScreen";

// 采购只读
import PurchaseOrderListScreen from "../screens/factory-admin/inventory/PurchaseOrderListScreen";
import PurchaseOrderDetailScreen from "../screens/factory-admin/inventory/PurchaseOrderDetailScreen";

// 成品库存只读
import FinishedGoodsListScreen from "../screens/factory-admin/inventory/FinishedGoodsListScreen";

// 个人中心
import ProfileStackNavigator from "./ProfileStackNavigator";

const Tab = createBottomTabNavigator<any>();
const SalesViewStack = createNativeStackNavigator<any>();
const PurchaseViewStack = createNativeStackNavigator<any>();

const TAB_COLORS = {
  active: "#607D8B",
  inactive: "#757575",
};

function SalesViewStackNavigator() {
  return (
    <SalesViewStack.Navigator screenOptions={{ headerShown: false }}>
      <SalesViewStack.Screen name="SalesOrderList" component={SalesOrderListScreen} />
      <SalesViewStack.Screen name="SalesOrderDetail" component={SalesOrderDetailScreen} />
      <SalesViewStack.Screen name="PriceList" component={PriceListScreen} />
      <SalesViewStack.Screen name="ArApOverview" component={ArApOverviewScreen} />
    </SalesViewStack.Navigator>
  );
}

function PurchaseViewStackNavigator() {
  return (
    <PurchaseViewStack.Navigator screenOptions={{ headerShown: false }}>
      <PurchaseViewStack.Screen name="PurchaseOrderList" component={PurchaseOrderListScreen} />
      <PurchaseViewStack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
      <PurchaseViewStack.Screen name="FinishedGoodsList" component={FinishedGoodsListScreen} />
    </PurchaseViewStack.Navigator>
  );
}

export function ViewerNavigator() {
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
      <Tab.Screen
        name="VWHomeTab"
        component={HomeScreen}
        options={{
          title: "首页",
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="VWSalesTab"
        component={SalesViewStackNavigator}
        options={{
          title: "销售",
          tabBarIcon: ({ color, size }) => (
            <Icon source="cart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="VWPurchaseTab"
        component={PurchaseViewStackNavigator}
        options={{
          title: "采购",
          tabBarIcon: ({ color, size }) => (
            <Icon source="package-down" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="VWProfileTab"
        component={ProfileStackNavigator}
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

export default ViewerNavigator;
