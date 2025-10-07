import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../types/navigation';

// 导入页面组件
import ProcessingDashboard from '../screens/processing/ProcessingDashboard';
import BatchListScreen from '../screens/processing/BatchListScreen';
import BatchDetailScreen from '../screens/processing/BatchDetailScreen';
import CreateBatchScreen from '../screens/processing/CreateBatchScreen';
import QualityInspectionListScreen from '../screens/processing/QualityInspectionListScreen';
import EquipmentMonitoringScreen from '../screens/processing/EquipmentMonitoringScreen';
import CostAnalysisDashboard from '../screens/processing/CostAnalysisDashboard';
import ProductionPlanManagementScreen from '../screens/processing/ProductionPlanManagementScreen';

const Stack = createNativeStackNavigator<ProcessingStackParamList>();

/**
 * 生产模块堆栈导航器
 * 包含所有生产相关页面的导航
 */
export function ProcessingStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // 使用自定义Appbar
      }}
    >
      {/* 生产仪表板 - 入口页 */}
      <Stack.Screen
        name="ProcessingDashboard"
        component={ProcessingDashboard}
      />

      {/* 批次管理 */}
      <Stack.Screen
        name="BatchList"
        component={BatchListScreen}
      />
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
      />
      <Stack.Screen
        name="CreateBatch"
        component={CreateBatchScreen}
      />

      {/* 质检管理 */}
      <Stack.Screen
        name="QualityInspectionList"
        component={QualityInspectionListScreen}
      />

      {/* 设备监控 */}
      <Stack.Screen
        name="EquipmentMonitoring"
        component={EquipmentMonitoringScreen}
      />

      {/* 成本分析 */}
      <Stack.Screen
        name="CostAnalysisDashboard"
        component={CostAnalysisDashboard}
      />

      {/* 生产计划管理 */}
      <Stack.Screen
        name="ProductionPlanManagement"
        component={ProductionPlanManagementScreen}
      />

      {/* TODO: 添加其他页面 */}
      {/*
      <Stack.Screen name="CreateQualityRecord" component={CreateQualityRecordScreen} />
      <Stack.Screen name="QualityInspectionDetail" component={QualityInspectionDetailScreen} />
      <Stack.Screen name="EquipmentDetail" component={EquipmentDetailScreen} />
      <Stack.Screen name="EquipmentAlerts" component={EquipmentAlertsScreen} />
      <Stack.Screen name="CostComparison" component={CostComparisonScreen} />
      <Stack.Screen name="DeepSeekAnalysis" component={DeepSeekAnalysisScreen} />
      <Stack.Screen name="DataExport" component={DataExportScreen} />
      */}
    </Stack.Navigator>
  );
}

export default ProcessingStackNavigator;
