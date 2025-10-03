import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import FactoryListScreen from '../screens/platform/FactoryListScreen';

export type PlatformStackParamList = {
  PlatformDashboard: undefined;
  FactoryList: { mode: 'view' | 'manage' };
  FactoryDetail: { factoryId: string; mode: 'view' };
  FactoryEdit: { factoryId: string };
  FactoryCreate: undefined;
  UserManagement: undefined;
  SystemMonitor: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<PlatformStackParamList>();

export const PlatformStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="PlatformDashboard"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="PlatformDashboard" component={PlatformDashboardScreen} />
      <Stack.Screen name="FactoryList" component={FactoryListScreen} />
      {/* TODO: Add other platform screens */}
    </Stack.Navigator>
  );
};

export default PlatformStackNavigator;
