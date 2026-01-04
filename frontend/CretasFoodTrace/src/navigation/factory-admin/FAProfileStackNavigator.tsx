/**
 * Factory Admin 个人中心 Stack 导航器
 * 包含: 个人中心、个人信息、修改密码、通知设置、系统设置、帮助中心、关于、反馈
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FAProfileStackParamList } from "../../types/navigation";

// 导入页面组件
import FAProfileScreen from "../../screens/factory-admin/profile/FAProfileScreen";
import PersonalInfoScreen from "../../screens/factory-admin/profile/PersonalInfoScreen";
import ChangePasswordScreen from "../../screens/factory-admin/profile/ChangePasswordScreen";
import NotificationSettingsScreen from "../../screens/factory-admin/profile/NotificationSettingsScreen";
import SystemSettingsScreen from "../../screens/factory-admin/profile/SystemSettingsScreen";
import HelpCenterScreen from "../../screens/factory-admin/profile/HelpCenterScreen";
import AboutScreen from "../../screens/factory-admin/profile/AboutScreen";

// 复用现有Profile页面
import FeedbackScreen from "../../screens/profile/FeedbackScreen";
import MembershipScreen from "../../screens/profile/MembershipScreen";
import DataExportScreen from "../../screens/reports/DataExportScreen";

const Stack = createNativeStackNavigator<FAProfileStackParamList>();

export function FAProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 个人中心主页 */}
      <Stack.Screen name="FAProfile" component={FAProfileScreen} />

      {/* 个人信息 */}
      <Stack.Screen
        name="PersonalInfo"
        component={PersonalInfoScreen}
        options={{ title: "个人信息" }}
      />

      {/* 修改密码 */}
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: "修改密码" }}
      />

      {/* 通知设置 */}
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: "通知设置" }}
      />

      {/* 系统设置 */}
      <Stack.Screen
        name="SystemSettings"
        component={SystemSettingsScreen}
        options={{ title: "系统设置" }}
      />

      {/* 帮助中心 */}
      <Stack.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{ title: "帮助中心" }}
      />

      {/* 关于 */}
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: "关于" }}
      />

      {/* 意见反馈 (复用现有) */}
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ title: "意见反馈" }}
      />

      {/* 会员中心 */}
      <Stack.Screen
        name="Membership"
        component={MembershipScreen}
        options={{ title: "会员中心" }}
      />

      {/* 数据导出 (复用现有) */}
      <Stack.Screen
        name="DataExport"
        component={DataExportScreen}
        options={{ title: "数据导出" }}
      />
    </Stack.Navigator>
  );
}

export default FAProfileStackNavigator;
