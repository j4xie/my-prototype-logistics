/**
 * 应用根导航器
 * 处理认证状态和角色路由
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider } from "react-native-paper";
import { useAuthStore } from "../store/authStore";
import { getUserRole } from "../types/auth";
import { theme } from "../theme";

// 认证页面
import EnhancedLoginScreen from "../screens/auth/EnhancedLoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";

// 主导航器
import MainNavigator from "./MainNavigator";
import FactoryAdminNavigator from "./FactoryAdminNavigator";
import WorkshopSupervisorNavigator from "./WorkshopSupervisorNavigator";
import WarehouseManagerNavigator from "./WarehouseManagerNavigator";
import HRNavigator from "./HRNavigator";
import DispatcherNavigator from "./DispatcherNavigator";
import QualityInspectorNavigator from "./QualityInspectorNavigator";
import OperatorNavigator from "./OperatorNavigator";

const Stack = createNativeStackNavigator();

/**
 * 根据用户角色选择导航器
 */
function RoleBasedNavigator() {
  const { user } = useAuthStore();
  const userRole = getUserRole(user);

  // factory_super_admin 使用工厂管理员界面
  if (userRole === "factory_super_admin") {
    return <FactoryAdminNavigator />;
  }

  // hr_admin (HR管理员) 使用HR专属界面
  if (userRole === "hr_admin") {
    return <HRNavigator />;
  }

  // workshop_supervisor (车间主任) 使用车间主任专属界面
  if (userRole === "workshop_supervisor" || userRole === "department_admin") {
    return <WorkshopSupervisorNavigator />;
  }

  // warehouse_manager / warehouse_worker 使用仓储专属界面
  if (userRole === "warehouse_manager" || userRole === "warehouse_worker") {
    return <WarehouseManagerNavigator />;
  }

  // dispatcher (调度员) 使用调度专属界面
  if (userRole === "dispatcher") {
    return <DispatcherNavigator />;
  }

  // quality_inspector (质检员) 使用质检专属界面
  if (userRole === "quality_inspector") {
    return <QualityInspectorNavigator />;
  }

  // operator (操作员) 使用操作员专属界面
  if (userRole === "operator") {
    return <OperatorNavigator />;
  }

  // 其他角色使用原有界面
  return <MainNavigator />;
}

export function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!isAuthenticated ? (
            // 未登录 - 显示登录流程
            <>
              <Stack.Screen
                name="Login"
                component={EnhancedLoginScreen}
              />
              <Stack.Screen
                name="EnhancedLogin"
                component={EnhancedLoginScreen}
              />
              <Stack.Screen
                name="LoginScreen"
                component={EnhancedLoginScreen}
              />
              <Stack.Screen
                name="RegisterScreen"
                component={RegisterScreen}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
              />
            </>
          ) : (
            // 已登录 - 根据角色显示不同界面
            <Stack.Screen
              name="Main"
              component={RoleBasedNavigator}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default AppNavigator;
