import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../types/navigation';

// 导入页面组件
import ProcessingDashboard from '../screens/processing/ProcessingDashboard';
import BatchListScreen from '../screens/processing/BatchListScreen';
import BatchDetailScreen from '../screens/processing/BatchDetailScreen';
import CreateBatchScreen from '../screens/processing/CreateBatchScreen';
import QualityInspectionListScreen from '../screens/processing/QualityInspectionListScreen';
import CostAnalysisDashboard from '../screens/processing/CostAnalysisDashboard';
import ProductionPlanManagementScreen from '../screens/processing/ProductionPlanManagementScreen';
import MaterialBatchManagementScreen from '../screens/processing/MaterialBatchManagementScreen';
import MaterialReceiptScreen from '../screens/processing/MaterialReceiptScreen';

const Stack = createNativeStackNavigator<ProcessingStackParamList>();

/**
 * 生产模块堆栈导航器
 * 包含所有生产相关页面的导航
 */
export function ProcessingStackNavigator() {
  return (
    <Stack.Navigator
      id="ProcessingStackNavigator"
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

      {/* 原材料管理 - Phase 2新增 */}
      <Stack.Screen
        name="MaterialBatchManagement"
        component={MaterialBatchManagementScreen}
      />
      <Stack.Screen
        name="MaterialReceipt"
        component={MaterialReceiptScreen}
      />

      {/*
        Phase 3+ 计划的页面:
        - CreateQualityRecord (质检记录)
        - QualityInspectionDetail (质检详情)
        - EquipmentDetail (设备详情)
        - EquipmentAlerts (设备告警)
        - CostComparison (成本对比)
        - DeepSeekAnalysis (AI分析详情)
        - DataExport (数据导出)

        详见: docs/prd/PRD-Phase3-完善计划.md
      */}
    </Stack.Navigator>
  );
}

export default ProcessingStackNavigator;
