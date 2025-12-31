/**
 * 调度员计划 Stack 导航器
 *
 * 包含生产计划相关的所有页面:
 * - PlanListScreen - 生产计划列表
 * - PlanCreateScreen - 创建生产计划
 * - TaskAssignmentScreen - 任务分配
 * - BatchWorkersScreen - 批次工人管理
 * - PlanGanttScreen - 甘特图视图
 * - UrgentInsertScreen - 紧急插单
 * - MixedBatchScreen - 混批排产
 * - ResourceOverviewScreen - 资源总览
 *
 * @version 1.2.0
 * @since 2025-12-28
 * @updated 2025-12-29 - 添加 PlanGantt/UrgentInsert/MixedBatch/ResourceOverview
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PlanListScreen from '../../screens/dispatcher/plan/PlanListScreen';
import PlanDetailScreen from '../../screens/dispatcher/plan/PlanDetailScreen';
import PlanCreateScreen from '../../screens/dispatcher/plan/PlanCreateScreen';
import TaskAssignmentScreen from '../../screens/dispatcher/plan/TaskAssignmentScreen';
import BatchWorkersScreen from '../../screens/dispatcher/plan/BatchWorkersScreen';
import PlanGanttScreen from '../../screens/dispatcher/plan/PlanGanttScreen';
import UrgentInsertScreen from '../../screens/dispatcher/plan/UrgentInsertScreen';
import MixedBatchScreen from '../../screens/dispatcher/plan/MixedBatchScreen';
import ResourceOverviewScreen from '../../screens/dispatcher/plan/ResourceOverviewScreen';

type DSPlanStackParamList = {
  PlanList: undefined;
  PlanDetail: { planId: string };
  PlanCreate: undefined;
  TaskAssignment: { planId?: string };
  BatchWorkers: { batchId: string; batchName: string };
  PlanGantt: undefined;
  UrgentInsert: undefined;
  MixedBatch: undefined;
  ResourceOverview: undefined;
};

const Stack = createStackNavigator<DSPlanStackParamList>();

export function DSPlanStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PlanList" component={PlanListScreen} />
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
      <Stack.Screen name="PlanCreate" component={PlanCreateScreen} />
      <Stack.Screen name="TaskAssignment" component={TaskAssignmentScreen} />
      <Stack.Screen name="BatchWorkers" component={BatchWorkersScreen} />
      <Stack.Screen name="PlanGantt" component={PlanGanttScreen} />
      <Stack.Screen name="UrgentInsert" component={UrgentInsertScreen} />
      <Stack.Screen name="MixedBatch" component={MixedBatchScreen} />
      <Stack.Screen name="ResourceOverview" component={ResourceOverviewScreen} />
    </Stack.Navigator>
  );
}

export default DSPlanStackNavigator;
