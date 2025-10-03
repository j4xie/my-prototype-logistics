import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 导入屏幕组件
import { TimeClockScreen } from '../screens/timeclock/TimeClockScreen';
import { ClockHistoryScreen } from '../screens/timeclock/ClockHistoryScreen';
import { TimeStatisticsScreen } from '../screens/timeclock/TimeStatisticsScreen';

export type TimeClockStackParamList = {
  TimeClock: undefined;
  ClockHistory: undefined;
  TimeStatistics: undefined;
};

const Stack = createStackNavigator<TimeClockStackParamList>();

export const TimeClockStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="TimeClock"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        },
        headerTintColor: '#1A1A1A',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
        headerBackTitleVisible: false,
        headerLeftContainerStyle: {
          paddingLeft: 16,
        },
        headerRightContainerStyle: {
          paddingRight: 16,
        },
      }}
    >
      <Stack.Screen 
        name="TimeClock" 
        component={TimeClockScreen}
        options={({ navigation }) => ({
          title: '员工打卡',
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 12 }}
              onPress={() => navigation.navigate('ClockHistory')}
            >
              <Ionicons name="time-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        })}
      />
      
      <Stack.Screen 
        name="ClockHistory" 
        component={ClockHistoryScreen}
        options={({ navigation }) => ({
          title: '打卡历史',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('TimeStatistics')}
            >
              <Ionicons name="stats-chart" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        })}
      />
      
      <Stack.Screen 
        name="TimeStatistics" 
        component={TimeStatisticsScreen}
        options={{
          title: '时间统计',
        }}
      />
    </Stack.Navigator>
  );
};