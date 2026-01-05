/**
 * Factory Admin AI分析 Stack 导航器
 * 包含: AI分析中心、成本分析、AI报告、AI对话、质量分析、生产计划
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FAAIStackParamList } from "../../types/navigation";

// 导入AI分析模块页面
import AIAnalysisCenterScreen from "../../screens/factory-admin/ai-analysis/AIAnalysisCenterScreen";
import AICostAnalysisScreen from "../../screens/factory-admin/ai-analysis/AICostAnalysisScreen";
import AIReportScreen from "../../screens/factory-admin/ai-analysis/AIReportScreen";
import QualityAnalysisScreen from "../../screens/factory-admin/ai-analysis/QualityAnalysisScreen";
import CreatePlanScreen from "../../screens/factory-admin/ai-analysis/CreatePlanScreen";
import IntentSuggestionsListScreen from "../../screens/factory-admin/ai-analysis/IntentSuggestionsListScreen";
import IntentSuggestionDetailScreen from "../../screens/factory-admin/ai-analysis/IntentSuggestionDetailScreen";

// 复用现有AI相关页面
import AIAnalysisDetailScreen from "../../screens/processing/AIAnalysisDetailScreen";
// 使用新的独立AI对话屏幕
import AIChatScreen from "../../screens/factory-admin/ai-analysis/AIChatScreen";

const Stack = createNativeStackNavigator<FAAIStackParamList>();

export function FAAIStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* AI分析中心 - 主页 */}
      <Stack.Screen name="AIAnalysisCenter" component={AIAnalysisCenterScreen} />

      {/* 成本分析 */}
      <Stack.Screen
        name="AICostAnalysis"
        component={AICostAnalysisScreen}
        options={{ title: "成本分析" }}
      />

      {/* AI报告列表 */}
      <Stack.Screen
        name="AIReport"
        component={AIReportScreen}
        options={{ title: "数据报表" }}
      />

      {/* AI对话 (使用新的独立聊天屏幕) */}
      <Stack.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{ title: "AI对话" }}
      />

      {/* 质量分析 */}
      <Stack.Screen
        name="QualityAnalysis"
        component={QualityAnalysisScreen}
        options={{ title: "质量分析" }}
      />

      {/* 创建生产计划 */}
      <Stack.Screen
        name="CreatePlan"
        component={CreatePlanScreen}
        options={{ title: "新建计划" }}
      />

      {/* AI报告详情 (复用现有) */}
      <Stack.Screen
        name="AIReportDetail"
        component={AIAnalysisDetailScreen}
        options={{ title: "报告详情" }}
      />

      {/* 意图建议列表 */}
      <Stack.Screen
        name="IntentSuggestionsList"
        component={IntentSuggestionsListScreen}
        options={{ title: "意图优化建议" }}
      />

      {/* 意图建议详情 */}
      <Stack.Screen
        name="IntentSuggestionDetail"
        component={IntentSuggestionDetailScreen}
        options={{ title: "建议详情" }}
      />
    </Stack.Navigator>
  );
}

export default FAAIStackNavigator;
