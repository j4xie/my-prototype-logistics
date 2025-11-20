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
import TimeRangeCostAnalysisScreen from '../screens/processing/TimeRangeCostAnalysisScreen';
import ProductionPlanManagementScreen from '../screens/processing/ProductionPlanManagementScreen';
import MaterialBatchManagementScreen from '../screens/processing/MaterialBatchManagementScreen';
import MaterialReceiptScreen from '../screens/processing/MaterialReceiptScreen';

// AI智能分析页面 - Phase 3
import AIReportListScreen from '../screens/processing/AIReportListScreen';
import AIAnalysisDetailScreen from '../screens/processing/AIAnalysisDetailScreen';
import BatchComparisonScreen from '../screens/processing/BatchComparisonScreen';
import AIConversationHistoryScreen from '../screens/processing/AIConversationHistoryScreen';

// 设备监控页面 - Phase 3 P0-001
import EquipmentMonitoringScreen from '../screens/processing/EquipmentMonitoringScreen';

// 设备管理页面 - Phase 3 P3-设备: CRUD、搜索、状态
import EquipmentManagementScreen from '../screens/processing/EquipmentManagementScreen';

// DeepSeek AI分析详情页 - Phase 3 P1-001
import DeepSeekAnalysisScreen from '../screens/processing/DeepSeekAnalysisScreen';

// 质检记录页面 - Phase 3 P1-002
import CreateQualityRecordScreen from '../screens/processing/CreateQualityRecordScreen';
import QualityInspectionDetailScreen from '../screens/processing/QualityInspectionDetailScreen';

// 成本对比分析 - Phase 3 P1-003
import CostComparisonScreen from '../screens/processing/CostComparisonScreen';

// 设备告警系统 - Phase 3 P1-004
import EquipmentAlertsScreen from '../screens/processing/EquipmentAlertsScreen';

// 设备详情页 - Phase 3 P1-005
import EquipmentDetailScreen from '../screens/processing/EquipmentDetailScreen';

// Phase 3 P2 - 质检统计分析
import QualityAnalyticsScreen from '../screens/processing/QualityAnalyticsScreen';

// Phase 3 P2 - 库存盘点
import InventoryCheckScreen from '../screens/processing/InventoryCheckScreen';

// Phase 3 P2 - 异常预警
import ExceptionAlertScreen from '../screens/alerts/ExceptionAlertScreen';

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
      <Stack.Screen
        name="EditBatch"
        component={CreateBatchScreen}
        options={{ title: '编辑批次' }}
      />

      {/* 质检管理 */}
      <Stack.Screen
        name="QualityInspectionList"
        component={QualityInspectionListScreen}
      />
      <Stack.Screen
        name="CreateQualityRecord"
        component={CreateQualityRecordScreen}
      />
      <Stack.Screen
        name="QualityInspectionDetail"
        component={QualityInspectionDetailScreen}
      />

      {/* 成本分析 */}
      <Stack.Screen
        name="CostAnalysisDashboard"
        component={CostAnalysisDashboard}
      />
      <Stack.Screen
        name="TimeRangeCostAnalysis"
        component={TimeRangeCostAnalysisScreen}
      />
      <Stack.Screen
        name="CostComparison"
        component={CostComparisonScreen}
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

      {/* AI智能分析 - Phase 3新增 */}
      <Stack.Screen
        name="AIReportList"
        component={AIReportListScreen}
      />
      <Stack.Screen
        name="AIAnalysisDetail"
        component={AIAnalysisDetailScreen}
      />
      <Stack.Screen
        name="BatchComparison"
        component={BatchComparisonScreen}
      />
      <Stack.Screen
        name="AIConversationHistory"
        component={AIConversationHistoryScreen}
      />

      {/* 设备监控 - Phase 3 P0-001 */}
      <Stack.Screen
        name="EquipmentMonitoring"
        component={EquipmentMonitoringScreen}
      />
      <Stack.Screen
        name="EquipmentManagement"
        component={EquipmentManagementScreen}
      />
      <Stack.Screen
        name="EquipmentAlerts"
        component={EquipmentAlertsScreen}
      />
      <Stack.Screen
        name="EquipmentDetail"
        component={EquipmentDetailScreen}
      />

      {/* DeepSeek AI分析详情 - Phase 3 P1-001 */}
      <Stack.Screen
        name="DeepSeekAnalysis"
        component={DeepSeekAnalysisScreen}
      />

      {/* Phase 3 P2 - 质检统计分析 */}
      <Stack.Screen
        name="QualityAnalytics"
        component={QualityAnalyticsScreen}
      />

      {/* Phase 3 P2 - 库存盘点 */}
      <Stack.Screen
        name="InventoryCheck"
        component={InventoryCheckScreen}
      />

      {/* Phase 3 P2 - 异常预警系统 */}
      <Stack.Screen
        name="ExceptionAlert"
        component={ExceptionAlertScreen}
      />
    </Stack.Navigator>
  );
}

export default ProcessingStackNavigator;
