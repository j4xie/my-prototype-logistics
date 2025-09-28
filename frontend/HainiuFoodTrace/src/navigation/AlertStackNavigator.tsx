import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

// 屏幕组件
import { AlertListScreen } from '../screens/alert/AlertListScreen';
import { AlertDetailScreen } from '../screens/alert/AlertDetailScreen';

// 导航类型
export type AlertStackParamList = {
  AlertList: undefined;
  AlertDetail: { 
    alertId: string;
    alert?: any; // Alert对象，如果已有数据可以传入
  };
};

const Stack = createStackNavigator<AlertStackParamList>();

export const AlertStackNavigator: React.FC = () => {
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
        name="AlertList" 
        component={AlertListScreen}
        options={({ navigation }) => ({
          title: '告警中心',
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
                // 可以添加刷新功能
                // navigation.setParams({});
              }}
            >
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        })}
      />
      
      <Stack.Screen 
        name="AlertDetail" 
        component={AlertDetailScreen}
        options={({ navigation, route }) => ({
          title: '告警详情',
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
                // 可以添加分享或其他操作
                console.log('Alert actions');
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
};