/**
 * 调度员AI调度 Stack 导航器
 *
 * 包含AI智能调度相关的所有页面:
 * - AIScheduleScreen - AI智能调度中心
 * - AIScheduleGenerateScreen - AI自动生成排程
 * - AICompletionProbScreen - 完成概率分析
 * - AIWorkerOptimizeScreen - 人员优化建议
 *
 * @version 1.1.0
 * @since 2025-12-28
 * @updated 2025-12-29 - 添加 AIScheduleGenerateScreen
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AIScheduleScreen from '../../screens/dispatcher/ai/AIScheduleScreen';
import AIScheduleGenerateScreen from '../../screens/dispatcher/ai/AIScheduleGenerateScreen';
import AICompletionProbScreen from '../../screens/dispatcher/ai/AICompletionProbScreen';
import AIWorkerOptimizeScreen from '../../screens/dispatcher/ai/AIWorkerOptimizeScreen';

type DSAIStackParamList = {
  AISchedule: undefined;
  AIScheduleGenerate: undefined;
  AICompletionProb: undefined;
  AIWorkerOptimize: undefined;
};

const Stack = createStackNavigator<DSAIStackParamList>();

export function DSAIStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AISchedule" component={AIScheduleScreen} />
      <Stack.Screen name="AIScheduleGenerate" component={AIScheduleGenerateScreen} />
      <Stack.Screen name="AICompletionProb" component={AICompletionProbScreen} />
      <Stack.Screen name="AIWorkerOptimize" component={AIWorkerOptimizeScreen} />
    </Stack.Navigator>
  );
}

export default DSAIStackNavigator;
