/**
 * Workshop Supervisor 个人中心 Stack 导航器
 * 包含: 个人中心、个人信息、修改密码、通知设置、系统设置、关于
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WSProfileStackParamList } from "../../types/navigation";

// 导入页面组件
import WSProfileScreen from "../../screens/workshop-supervisor/profile/WSProfileScreen";

// 复用现有Profile页面
import FeedbackScreen from "../../screens/profile/FeedbackScreen";

const Stack = createNativeStackNavigator<WSProfileStackParamList>();

export function WSProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 个人中心主页 */}
      <Stack.Screen name="WSProfile" component={WSProfileScreen} />

      {/* 个人信息 - 临时使用主页组件 */}
      <Stack.Screen
        name="PersonalInfo"
        component={WSProfileScreen}
        options={{ title: "个人信息" }}
      />

      {/* 修改密码 - 临时使用主页组件 */}
      <Stack.Screen
        name="ChangePassword"
        component={WSProfileScreen}
        options={{ title: "修改密码" }}
      />

      {/* 通知设置 - 临时使用主页组件 */}
      <Stack.Screen
        name="NotificationSettings"
        component={WSProfileScreen}
        options={{ title: "通知设置" }}
      />

      {/* 系统设置 - 临时使用主页组件 */}
      <Stack.Screen
        name="Settings"
        component={WSProfileScreen}
        options={{ title: "系统设置" }}
      />

      {/* 关于 - 临时使用主页组件 */}
      <Stack.Screen
        name="About"
        component={WSProfileScreen}
        options={{ title: "关于" }}
      />
    </Stack.Navigator>
  );
}

export default WSProfileStackNavigator;
