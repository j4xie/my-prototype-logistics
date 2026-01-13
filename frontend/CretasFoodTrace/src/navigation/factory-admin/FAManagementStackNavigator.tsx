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
import SchemaConfigScreen from "../../screens/factory-admin/config/SchemaConfigScreen";
import { FormTemplateListScreen } from "../../screens/factory-admin/config/FormTemplateListScreen";
import { FormTemplateDetailScreen } from "../../screens/factory-admin/config/FormTemplateDetailScreen";
import RuleConfigurationScreen from "../../screens/management/RuleConfigurationScreen";
import AIBusinessInitScreen from "../../screens/factory-admin/config/AIBusinessInitScreen";
import EncodingRuleConfigScreen from "../../screens/factory-admin/config/EncodingRuleConfigScreen";
import QualityCheckItemConfigScreen from "../../screens/factory-admin/config/QualityCheckItemConfigScreen";
import SopConfigScreen from "../../screens/management/SopConfigScreen";
import { FAIntentViewScreen } from "../../screens/factory-admin/management/FAIntentViewScreen";

// IoT 电子秤设备管理
import { IotDeviceListScreen } from "../../screens/factory-admin/iot/IotDeviceListScreen";
import { IotDeviceDetailScreen } from "../../screens/factory-admin/iot/IotDeviceDetailScreen";
import { IotDeviceCreateScreen } from "../../screens/factory-admin/iot/IotDeviceCreateScreen";
import { ScaleTestScreen } from "../../screens/factory-admin/iot/ScaleTestScreen";

// ISAPI 海康威视摄像头设备管理
import { IsapiDeviceListScreen } from "../../screens/factory-admin/isapi/IsapiDeviceListScreen";
import { IsapiDeviceDetailScreen } from "../../screens/factory-admin/isapi/IsapiDeviceDetailScreen";
import { IsapiDeviceCreateScreen } from "../../screens/factory-admin/isapi/IsapiDeviceCreateScreen";
import { IsapiDeviceDiscoveryScreen } from "../../screens/factory-admin/isapi/IsapiDeviceDiscoveryScreen";
import { IsapiSmartConfigScreen } from "../../screens/factory-admin/isapi/IsapiSmartConfigScreen";
import { DeviceSetupWizardScreen } from "../../screens/factory-admin/isapi/DeviceSetupWizardScreen";

// 智能设备添加
import { SmartDeviceAddScreen } from "../../screens/factory-admin/device/SmartDeviceAddScreen";
import { CameraAddMethodScreen } from "../../screens/factory-admin/device/CameraAddMethodScreen";
import { AIDeviceInputScreen } from "../../screens/factory-admin/device/AIDeviceInputScreen";

// 统一设备管理中心
import { UnifiedDeviceManagementScreen } from "../../screens/factory-admin/device/UnifiedDeviceManagementScreen";

// 标签自动识别监控
import { LabelRecognitionMonitorScreen } from "../../screens/production/LabelRecognitionMonitorScreen";

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

      {/* Schema 配置 (AI 创建字段) */}
      <Stack.Screen
        name="SchemaConfig"
        component={SchemaConfigScreen}
        options={{ title: "表单配置" }}
      />

      {/* 表单模版管理 */}
      <Stack.Screen
        name="FormTemplateList"
        component={FormTemplateListScreen}
        options={{ title: "表单模版" }}
      />
      <Stack.Screen
        name="FormTemplateDetail"
        component={FormTemplateDetailScreen}
        options={{ title: "模版详情" }}
      />

      {/* 规则配置 (Drools 规则 + 状态机) */}
      <Stack.Screen
        name="RuleConfiguration"
        component={RuleConfigurationScreen}
        options={{ title: "规则配置" }}
      />

      {/* AI 智能初始化业务数据 (P1.5) */}
      <Stack.Screen
        name="AIBusinessInit"
        component={AIBusinessInitScreen}
        options={{ title: "AI 智能初始化" }}
      />

      {/* 编码规则配置 */}
      <Stack.Screen
        name="EncodingRuleConfig"
        component={EncodingRuleConfigScreen}
        options={{ title: "编码规则" }}
      />

      {/* 质检项配置 */}
      <Stack.Screen
        name="QualityCheckItemConfig"
        component={QualityCheckItemConfigScreen}
        options={{ title: "质检项配置" }}
      />

      {/* SOP 流程配置 */}
      <Stack.Screen
        name="SopConfig"
        component={SopConfigScreen}
        options={{ title: "SOP配置" }}
      />

      {/* 意图配置查看 (只读) */}
      <Stack.Screen
        name="IntentView"
        component={FAIntentViewScreen}
        options={{ title: "意图配置" }}
      />

      {/* 统一设备管理中心 */}
      <Stack.Screen
        name="UnifiedDeviceManagement"
        component={UnifiedDeviceManagementScreen}
        options={{ title: "设备中心" }}
      />

      {/* IoT 电子秤设备管理 */}
      <Stack.Screen
        name="IotDeviceList"
        component={IotDeviceListScreen}
        options={{ title: "IoT 设备管理" }}
      />
      <Stack.Screen
        name="IotDeviceDetail"
        component={IotDeviceDetailScreen}
        options={{ title: "设备详情" }}
      />
      <Stack.Screen
        name="IotDeviceCreate"
        component={IotDeviceCreateScreen}
        options={{ title: "添加设备" }}
      />
      <Stack.Screen
        name="ScaleTest"
        component={ScaleTestScreen}
        options={{ title: "秤数据测试" }}
      />

      {/* ISAPI 海康威视摄像头设备管理 */}
      <Stack.Screen
        name="IsapiDeviceList"
        component={IsapiDeviceListScreen}
        options={{ title: "摄像头管理" }}
      />
      <Stack.Screen
        name="IsapiDeviceDetail"
        component={IsapiDeviceDetailScreen}
        options={{ title: "摄像头详情" }}
      />
      <Stack.Screen
        name="IsapiDeviceCreate"
        component={IsapiDeviceCreateScreen}
        options={{ title: "添加摄像头" }}
      />
      <Stack.Screen
        name="IsapiDeviceDiscovery"
        component={IsapiDeviceDiscoveryScreen}
        options={{ title: "设备发现" }}
      />
      <Stack.Screen
        name="IsapiSmartConfig"
        component={IsapiSmartConfigScreen}
        options={{ title: "智能分析配置" }}
      />
      <Stack.Screen
        name="DeviceSetupWizard"
        component={DeviceSetupWizardScreen}
        options={{ title: "设备配置向导" }}
      />

      {/* 智能设备添加 */}
      <Stack.Screen
        name="SmartDeviceAdd"
        component={SmartDeviceAddScreen}
        options={{ title: "添加设备" }}
      />
      <Stack.Screen
        name="CameraAddMethod"
        component={CameraAddMethodScreen}
        options={{ title: "添加摄像头" }}
      />
      <Stack.Screen
        name="AIDeviceInput"
        component={AIDeviceInputScreen}
        options={{ title: "AI识别添加" }}
      />

      {/* 标签自动识别监控 */}
      <Stack.Screen
        name="LabelRecognitionMonitor"
        component={LabelRecognitionMonitorScreen}
        options={{ title: "标签识别监控" }}
      />
    </Stack.Navigator>
  );
}

export default FAManagementStackNavigator;
