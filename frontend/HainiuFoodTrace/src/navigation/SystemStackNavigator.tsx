import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

// 屏幕组件
import { SystemMonitorScreen } from '../screens/system/SystemMonitorScreen';
import { SystemHealthScreen } from '../screens/system/SystemHealthScreen';

// 导航类型
export type SystemStackParamList = {
  SystemMonitor: undefined;
  SystemHealth: undefined;
};

const Stack = createStackNavigator<SystemStackParamList>();

export const SystemStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4ECDC4',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="SystemMonitor" 
        component={SystemMonitorScreen}
        options={({ navigation }) => ({
          title: '系统监控',
          headerLeft: () => (
            <TouchableOpacity
              style={{ marginLeft: 15 }}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 15 }}
              onPress={() => navigation.navigate('SystemHealth')}
            >
              <Ionicons name="fitness" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        })}
      />
      
      <Stack.Screen 
        name="SystemHealth" 
        component={SystemHealthScreen}
        options={({ navigation }) => ({
          title: '系统健康检查',
          headerLeft: () => (
            <TouchableOpacity
              style={{ marginLeft: 15 }}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 15 }}
              onPress={() => {
                // 可以添加刷新健康检查
                console.log('Refresh system health');
              }}
            >
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
};