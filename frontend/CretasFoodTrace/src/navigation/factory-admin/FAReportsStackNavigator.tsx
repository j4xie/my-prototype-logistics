/**
 * Factory Admin 报表 Stack 导航器
 * 包含: 报表仪表盘及11个报表子页面
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ReportStackParamList } from "../../types/navigation";

// 导入报表页面组件
import ReportDashboardScreen from "../../screens/reports/ReportDashboardScreen";
import ProductionReportScreen from "../../screens/reports/ProductionReportScreen";
import QualityReportScreen from "../../screens/reports/QualityReportScreen";
import CostReportScreen from "../../screens/reports/CostReportScreen";
import EfficiencyReportScreen from "../../screens/reports/EfficiencyReportScreen";
import TrendReportScreen from "../../screens/reports/TrendReportScreen";
import PersonnelReportScreen from "../../screens/reports/PersonnelReportScreen";
import KPIReportScreen from "../../screens/reports/KPIReportScreen";
import ForecastReportScreen from "../../screens/reports/ForecastReportScreen";
import AnomalyReportScreen from "../../screens/reports/AnomalyReportScreen";
import RealtimeReportScreen from "../../screens/reports/RealtimeReportScreen";
import DataExportScreen from "../../screens/reports/DataExportScreen";

const Stack = createNativeStackNavigator<ReportStackParamList>();

export function FAReportsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 报表仪表盘 (入口) */}
      <Stack.Screen
        name="ReportDashboard"
        component={ReportDashboardScreen}
      />

      {/* 生产报表 */}
      <Stack.Screen
        name="ProductionReport"
        component={ProductionReportScreen}
        options={{ title: "生产报表" }}
      />

      {/* 质量报表 */}
      <Stack.Screen
        name="QualityReport"
        component={QualityReportScreen}
        options={{ title: "质量报表" }}
      />

      {/* 成本报表 */}
      <Stack.Screen
        name="CostReport"
        component={CostReportScreen}
        options={{ title: "成本报表" }}
      />

      {/* 效率报表 */}
      <Stack.Screen
        name="EfficiencyReport"
        component={EfficiencyReportScreen}
        options={{ title: "效率报表" }}
      />

      {/* 趋势报表 */}
      <Stack.Screen
        name="TrendReport"
        component={TrendReportScreen}
        options={{ title: "趋势报表" }}
      />

      {/* 人员报表 */}
      <Stack.Screen
        name="PersonnelReport"
        component={PersonnelReportScreen}
        options={{ title: "人员报表" }}
      />

      {/* KPI报表 */}
      <Stack.Screen
        name="KPIReport"
        component={KPIReportScreen}
        options={{ title: "KPI报表" }}
      />

      {/* 预测报表 */}
      <Stack.Screen
        name="ForecastReport"
        component={ForecastReportScreen}
        options={{ title: "预测报表" }}
      />

      {/* 异常报表 */}
      <Stack.Screen
        name="AnomalyReport"
        component={AnomalyReportScreen}
        options={{ title: "异常报表" }}
      />

      {/* 实时报表 */}
      <Stack.Screen
        name="RealtimeReport"
        component={RealtimeReportScreen}
        options={{ title: "实时报表" }}
      />

      {/* 数据导出 */}
      <Stack.Screen
        name="DataExport"
        component={DataExportScreen}
        options={{ title: "数据导出" }}
      />
    </Stack.Navigator>
  );
}

export default FAReportsStackNavigator;
