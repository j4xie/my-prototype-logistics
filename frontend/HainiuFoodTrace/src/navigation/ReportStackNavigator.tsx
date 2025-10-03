import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

// 屏幕组件
import { ReportListScreen } from '../screens/report/ReportListScreen';
import { ReportTemplateScreen } from '../screens/report/ReportTemplateScreen';

// 导航类型
export type ReportStackParamList = {
  ReportList: undefined;
  ReportTemplate: {
    templateId?: string;
    mode?: 'create' | 'edit' | 'view';
  };
};

const Stack = createStackNavigator<ReportStackParamList>();

export const ReportStackNavigator: React.FC = () => {
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
        name="ReportList" 
        component={ReportListScreen}
        options={({ navigation }) => ({
          title: '报表中心',
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
              onPress={() => navigation.navigate('ReportTemplate', { mode: 'create' })}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        })}
      />
      
      <Stack.Screen 
        name="ReportTemplate" 
        component={ReportTemplateScreen}
        options={({ navigation, route }) => {
          const { mode = 'view' } = route.params || {};
          return {
            title: mode === 'create' ? '创建报表' : mode === 'edit' ? '编辑报表' : '报表详情',
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
                  // 可以添加保存或导出功能
                  console.log('Report actions');
                }}
              >
                <Ionicons name="save" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ),
          };
        }}
      />
    </Stack.Navigator>
  );
};