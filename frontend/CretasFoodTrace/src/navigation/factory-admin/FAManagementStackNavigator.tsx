/**
 * Factory Admin 管理 Stack 导航器
 * 包含: 管理中心、员工管理、设备管理、各类基础数据管理
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FAManagementStackParamList } from "../../types/navigation";

// 导入页面组件
import FAManagementScreen from "../../screens/factory-admin/management/FAManagementScreen";

// 复用现有管理页面
import UserManagementScreen from "../../screens/management/UserManagementScreen";
import DepartmentManagementScreen from "../../screens/management/DepartmentManagementScreen";
import ProductTypeManagementScreen from "../../screens/management/ProductTypeManagementScreen";
import MaterialTypeManagementScreen from "../../screens/management/MaterialTypeManagementScreen";
import SupplierManagementScreen from "../../screens/management/SupplierManagementScreen";
import CustomerManagementScreen from "../../screens/management/CustomerManagementScreen";
import ShipmentManagementScreen from "../../screens/management/ShipmentManagementScreen";
import ConversionRateScreen from "../../screens/management/ConversionRateScreen";
import DisposalRecordManagementScreen from "../../screens/management/DisposalRecordManagementScreen";
import EquipmentManagementScreen from "../../screens/processing/EquipmentManagementScreen";
import EquipmentDetailScreen from "../../screens/processing/EquipmentDetailScreen";

const Stack = createNativeStackNavigator<FAManagementStackParamList>();

export function FAManagementStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 管理中心主页 */}
      <Stack.Screen name="FAManagement" component={FAManagementScreen} />

      {/* 员工管理 (复用现有) */}
      <Stack.Screen
        name="EmployeeList"
        component={UserManagementScreen}
        options={{ title: "员工管理" }}
      />

      {/* 设备管理 (复用现有) */}
      <Stack.Screen
        name="EquipmentList"
        component={EquipmentManagementScreen}
        options={{ title: "设备管理" }}
      />

      {/* 员工详情 - 临时使用员工列表 */}
      <Stack.Screen
        name="EmployeeDetail"
        component={UserManagementScreen}
        options={{ title: "员工详情" }}
      />

      {/* 设备详情 (复用现有) */}
      <Stack.Screen
        name="EquipmentDetail"
        component={EquipmentDetailScreen}
        options={{ title: "设备详情" }}
      />

      {/* 产品类型管理 (复用现有) */}
      <Stack.Screen
        name="ProductTypeManagement"
        component={ProductTypeManagementScreen}
        options={{ title: "产品类型" }}
      />

      {/* 原材料类型管理 (复用现有) */}
      <Stack.Screen
        name="MaterialTypeManagement"
        component={MaterialTypeManagementScreen}
        options={{ title: "原材料类型" }}
      />

      {/* 部门管理 (复用现有) */}
      <Stack.Screen
        name="DepartmentManagement"
        component={DepartmentManagementScreen}
        options={{ title: "部门管理" }}
      />

      {/* 供应商管理 (复用现有) */}
      <Stack.Screen
        name="SupplierManagement"
        component={SupplierManagementScreen}
        options={{ title: "供应商管理" }}
      />

      {/* 客户管理 (复用现有) */}
      <Stack.Screen
        name="CustomerManagement"
        component={CustomerManagementScreen}
        options={{ title: "客户管理" }}
      />

      {/* 出货管理 (复用现有) */}
      <Stack.Screen
        name="ShipmentManagement"
        component={ShipmentManagementScreen}
        options={{ title: "出货管理" }}
      />

      {/* 转换率管理 (复用现有) */}
      <Stack.Screen
        name="ConversionRate"
        component={ConversionRateScreen}
        options={{ title: "转换率配置" }}
      />

      {/* 报废记录管理 (复用现有) */}
      <Stack.Screen
        name="DisposalRecordManagement"
        component={DisposalRecordManagementScreen}
        options={{ title: "报废记录" }}
      />
    </Stack.Navigator>
  );
}

export default FAManagementStackNavigator;
