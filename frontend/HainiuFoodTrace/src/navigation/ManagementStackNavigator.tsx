import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PermissionManagementScreen from '../screens/management/PermissionManagementScreen';
import WhitelistManagementScreen from '../screens/management/WhitelistManagementScreen';

export type ManagementStackParamList = {
  PermissionManagement: undefined;
  WhitelistManagement: { scope?: 'all' | 'department'; showDepartmentFilter?: boolean };
  UserApproval: { status: 'pending' | 'active' };
  DepartmentDetail: { department: string };
  PermissionReport: { type: 'user' | 'department' };
  PermissionLog: undefined;
};

const Stack = createStackNavigator<ManagementStackParamList>();

export const ManagementStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="PermissionManagement"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="PermissionManagement" component={PermissionManagementScreen} />
      <Stack.Screen name="WhitelistManagement" component={WhitelistManagementScreen} />
      {/* TODO: 添加其他管理屏幕 */}
    </Stack.Navigator>
  );
};

export default ManagementStackNavigator;
