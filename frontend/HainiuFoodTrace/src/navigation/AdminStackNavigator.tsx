import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AdminScreen } from '../screens/main/AdminScreen';
import { UserManagementScreen } from '../screens/admin/UserManagementScreen';

export type AdminStackParamList = {
  AdminHome: undefined;
  UserManagement: undefined;
  RoleManagement: undefined;
  DepartmentManagement: undefined;
  SystemConfig: undefined;
  AuditLogs: undefined;
  DataStatistics: undefined;
};

const Stack = createStackNavigator<AdminStackParamList>();

export const AdminStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AdminHome" component={AdminScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      {/* 其他屏幕可以在这里添加 */}
    </Stack.Navigator>
  );
};