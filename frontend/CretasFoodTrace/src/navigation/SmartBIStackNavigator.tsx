/**
 * SmartBI Stack 导航器
 *
 * 智能商业分析模块的导航堆栈
 * 包含: 首页、经营驾驶舱、销售分析、财务分析、Excel上传、AI问答
 * 新增: 生产分析、质量分析、库存分析、采购分析、销售漏斗、客户RFM、现金流、财务比率
 *
 * @version 1.1.0
 * @since 2026-01-18
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SmartBIStackParamList } from '../types/smartbi';

// 屏幕组件 - 基础模块
import SmartBIHomeScreen from '../screens/smartbi/SmartBIHomeScreen';
import ExecutiveDashboardScreen from '../screens/smartbi/ExecutiveDashboardScreen';
import SalesAnalysisScreen from '../screens/smartbi/SalesAnalysisScreen';
import FinanceAnalysisScreen from '../screens/smartbi/FinanceAnalysisScreen';
import ExcelUploadScreen from '../screens/smartbi/ExcelUploadScreen';
import NLQueryScreen from '../screens/smartbi/NLQueryScreen';

// 屏幕组件 - 生产与质量
import ProductionDashboardScreen from '../screens/smartbi/ProductionDashboardScreen';
import QualityDashboardScreen from '../screens/smartbi/QualityDashboardScreen';

// 屏幕组件 - 库存与采购
import InventoryDashboardScreen from '../screens/smartbi/InventoryDashboardScreen';
import ProcurementDashboardScreen from '../screens/smartbi/ProcurementDashboardScreen';

// 屏幕组件 - 销售与客户
import SalesFunnelScreen from '../screens/smartbi/SalesFunnelScreen';
import CustomerRFMScreen from '../screens/smartbi/CustomerRFMScreen';

// 屏幕组件 - 财务深度分析
import CashFlowScreen from '../screens/smartbi/CashFlowScreen';
import FinancialRatiosScreen from '../screens/smartbi/FinancialRatiosScreen';

const Stack = createNativeStackNavigator<SmartBIStackParamList>();

export function SmartBIStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: '返回',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      {/* SmartBI 首页 */}
      <Stack.Screen
        name="SmartBIHome"
        component={SmartBIHomeScreen}
        options={{ headerShown: false }}
      />

      {/* 经营驾驶舱 */}
      <Stack.Screen
        name="ExecutiveDashboard"
        component={ExecutiveDashboardScreen}
        options={{ title: '经营驾驶舱' }}
      />

      {/* 销售分析 */}
      <Stack.Screen
        name="SalesAnalysis"
        component={SalesAnalysisScreen}
        options={{ title: '销售分析' }}
      />

      {/* 财务分析 */}
      <Stack.Screen
        name="FinanceAnalysis"
        component={FinanceAnalysisScreen}
        options={{ title: '财务分析' }}
      />

      {/* Excel 上传 */}
      <Stack.Screen
        name="ExcelUpload"
        component={ExcelUploadScreen}
        options={{ title: 'Excel上传' }}
      />

      {/* AI 问答 */}
      <Stack.Screen
        name="NLQuery"
        component={NLQueryScreen}
        options={{ title: 'AI问答' }}
      />

      {/* ==================== 生产与质量分析 ==================== */}

      {/* OEE生产分析 */}
      <Stack.Screen
        name="ProductionDashboard"
        component={ProductionDashboardScreen}
        options={{ title: 'OEE生产分析' }}
      />

      {/* 质量分析 */}
      <Stack.Screen
        name="QualityDashboard"
        component={QualityDashboardScreen}
        options={{ title: '质量分析' }}
      />

      {/* ==================== 库存与采购分析 ==================== */}

      {/* 库存分析 */}
      <Stack.Screen
        name="InventoryDashboard"
        component={InventoryDashboardScreen}
        options={{ title: '库存分析' }}
      />

      {/* 采购分析 */}
      <Stack.Screen
        name="ProcurementDashboard"
        component={ProcurementDashboardScreen}
        options={{ title: '采购分析' }}
      />

      {/* ==================== 销售与客户分析 ==================== */}

      {/* 销售漏斗 */}
      <Stack.Screen
        name="SalesFunnel"
        component={SalesFunnelScreen}
        options={{ title: '销售漏斗' }}
      />

      {/* 客户RFM分析 */}
      <Stack.Screen
        name="CustomerRFM"
        component={CustomerRFMScreen}
        options={{ title: '客户RFM分析' }}
      />

      {/* ==================== 财务深度分析 ==================== */}

      {/* 现金流分析 */}
      <Stack.Screen
        name="CashFlow"
        component={CashFlowScreen}
        options={{ title: '现金流分析' }}
      />

      {/* 财务比率分析 */}
      <Stack.Screen
        name="FinancialRatios"
        component={FinancialRatiosScreen}
        options={{ title: '财务比率分析' }}
      />
    </Stack.Navigator>
  );
}

export default SmartBIStackNavigator;
