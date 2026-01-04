/**
 * 调度员主导航器
 *
 * 包含所有调度员模块的页面路由
 * 仅包含已实现的页面
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Tab 导航器
import DispatcherTabNavigator from './DispatcherTabNavigator';

// 详情页面 (在 Tab 外显示)
// Home 模块
import WorkshopStatusScreen from '../screens/dispatcher/home/WorkshopStatusScreen';

// Plan 模块
import PlanDetailScreen from '../screens/dispatcher/plan/PlanDetailScreen';
import TaskAssignmentScreen from '../screens/dispatcher/plan/TaskAssignmentScreen';
import BatchWorkersScreen from '../screens/dispatcher/plan/BatchWorkersScreen';

// AI 模块
import AICompletionProbScreen from '../screens/dispatcher/ai/AICompletionProbScreen';
import AIWorkerOptimizeScreen from '../screens/dispatcher/ai/AIWorkerOptimizeScreen';

// Personnel 模块
import PersonnelDetailScreen from '../screens/dispatcher/personnel/PersonnelDetailScreen';
import PersonnelScheduleScreen from '../screens/dispatcher/personnel/PersonnelScheduleScreen';
import PersonnelTransferScreen from '../screens/dispatcher/personnel/PersonnelTransferScreen';

// Alert 模块
import { AlertListScreen } from '../screens/dispatcher/alert';

// Line 模块
import { ProductionLineScreen } from '../screens/dispatcher/line';

// Stats 模块
import { UrgentInsertStatsScreen } from '../screens/dispatcher/stats';

/**
 * 调度员导航参数类型 (仅已实现的屏幕)
 */
export type DispatcherStackParamList = {
  DispatcherMain: undefined;
  // Home 模块
  WorkshopStatus: { workshopId?: string };
  // Plan 模块
  PlanDetail: { planId: string };
  TaskAssignment: { planId?: string };
  BatchWorkers: { batchId: string; batchName: string };
  // AI 模块
  AICompletionProb: undefined;
  AIWorkerOptimize: undefined;
  // Personnel 模块
  PersonnelDetail: { employeeId: string };
  PersonnelSchedule: undefined;
  PersonnelTransfer: undefined;
  // Alert 模块
  AlertList: undefined;
  // Line 模块
  ProductionLine: undefined;
  // Stats 模块
  UrgentInsertStats: undefined;
};

const Stack = createStackNavigator<DispatcherStackParamList>();

export function DispatcherNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 主Tab导航 */}
      <Stack.Screen name="DispatcherMain" component={DispatcherTabNavigator} />

      {/* Home 模块详情页 */}
      <Stack.Screen name="WorkshopStatus" component={WorkshopStatusScreen} />

      {/* Plan 模块详情页 */}
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
      <Stack.Screen name="TaskAssignment" component={TaskAssignmentScreen} />
      <Stack.Screen name="BatchWorkers" component={BatchWorkersScreen} />

      {/* AI 模块详情页 */}
      <Stack.Screen name="AICompletionProb" component={AICompletionProbScreen} />
      <Stack.Screen name="AIWorkerOptimize" component={AIWorkerOptimizeScreen} />

      {/* Personnel 模块详情页 */}
      <Stack.Screen name="PersonnelDetail" component={PersonnelDetailScreen} />
      <Stack.Screen name="PersonnelSchedule" component={PersonnelScheduleScreen} />
      <Stack.Screen name="PersonnelTransfer" component={PersonnelTransferScreen} />

      {/* Alert 模块 */}
      <Stack.Screen name="AlertList" component={AlertListScreen} />

      {/* Line 模块 */}
      <Stack.Screen name="ProductionLine" component={ProductionLineScreen} />

      {/* Stats 模块 */}
      <Stack.Screen name="UrgentInsertStats" component={UrgentInsertStatsScreen} />
    </Stack.Navigator>
  );
}

export default DispatcherNavigator;
