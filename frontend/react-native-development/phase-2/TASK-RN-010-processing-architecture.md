# TASK-RN-010: 加工模块架构搭建

> React Native Android开发 - Phase 2 Week 1
>
> 任务编号: TASK-RN-010
> 工期: 1.5天 (12小时)
> 优先级: 高
> 状态: 待开始
> 依赖: Phase 1所有任务

## 🎯 任务目标

为加工模块建立完整的基础架构，包括目录结构、路由配置、状态管理、API服务层等，为后续的员工录入、设备接入和智能分析功能奠定基础。

## 📋 具体工作内容

### 1. 目录结构创建 (2小时)

#### 创建加工模块目录
```
src/modules/processing/
├── components/           # 加工模块专用组件
│   ├── common/          # 通用组件
│   ├── forms/           # 表单组件
│   ├── charts/          # 图表组件
│   └── modals/          # 弹窗组件
├── screens/             # 页面组件
│   ├── ProcessingHome.tsx
│   ├── EmployeeInput.tsx
│   ├── DeviceData.tsx
│   ├── Dashboard.tsx
│   └── Analytics.tsx
├── services/            # API服务
│   ├── api.ts
│   ├── device.ts
│   └── analytics.ts
├── store/               # 状态管理
│   ├── processingStore.ts
│   ├── deviceStore.ts
│   └── analyticsStore.ts
├── types/               # 类型定义
│   ├── processing.ts
│   ├── device.ts
│   └── analytics.ts
├── utils/               # 工具函数
│   ├── validation.ts
│   ├── formatting.ts
│   └── calculations.ts
└── index.ts             # 模块导出
```

#### 文件结构验证
- [ ] 目录结构完整创建
- [ ] 各文件有基础模板代码
- [ ] 导入导出关系正确

### 2. 路由配置与权限集成 (3小时)

#### 路由配置
```typescript
// src/modules/processing/routes.ts
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from './types/navigation';
import ProcessingHome from './screens/ProcessingHome';
import EmployeeInput from './screens/EmployeeInput';
import DeviceData from './screens/DeviceData';
import Dashboard from './screens/Dashboard';
import Analytics from './screens/Analytics';

const Stack = createNativeStackNavigator<ProcessingStackParamList>();

export function ProcessingNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProcessingHome" component={ProcessingHome} />
      <Stack.Screen name="EmployeeInput" component={EmployeeInput} />
      <Stack.Screen name="DeviceData" component={DeviceData} />
      <Stack.Screen name="Dashboard" component={Dashboard} />
      <Stack.Screen name="Analytics" component={Analytics} />
    </Stack.Navigator>
  );
}
```

#### 权限集成
```typescript
// src/modules/processing/components/common/ProcessingGuard.tsx
import { RouteGuard } from '@/components/permissions';

interface ProcessingGuardProps {
  children: React.ReactNode;
  requiredLevel?: number;
  feature?: string;
}

export function ProcessingGuard({ 
  children, 
  requiredLevel = 30, 
  feature = "processing" 
}: ProcessingGuardProps) {
  return (
    <RouteGuard requiredModule={feature} requiredLevel={requiredLevel}>
      {children}
    </RouteGuard>
  );
}
```

### 3. 状态管理架构 (Zustand store) (3小时)

#### 主状态管理
```typescript
// src/modules/processing/store/processingStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProcessingState {
  // 基础数据
  currentBatch: BatchInfo | null;
  productionLines: ProductionLine[];
  qualityMetrics: QualityMetrics;
  
  // 录入状态
  employeeInputs: EmployeeInput[];
  deviceInputs: DeviceInput[];
  
  // UI状态
  isLoading: boolean;
  error: string | null;
  selectedLine: string | null;
  
  // Actions
  setCurrentBatch: (batch: BatchInfo) => void;
  addEmployeeInput: (input: EmployeeInput) => void;
  updateQualityMetrics: (metrics: QualityMetrics) => void;
  clearError: () => void;
}

export const useProcessingStore = create<ProcessingState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentBatch: null,
      productionLines: [],
      qualityMetrics: { efficiency: 0, quality: 0, output: 0 },
      employeeInputs: [],
      deviceInputs: [],
      isLoading: false,
      error: null,
      selectedLine: null,
      
      // Actions implementation
      setCurrentBatch: (batch) => set({ currentBatch: batch }),
      addEmployeeInput: (input) => set(state => ({
        employeeInputs: [...state.employeeInputs, input]
      })),
      updateQualityMetrics: (metrics) => set({ qualityMetrics: metrics }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'processing-storage',
      partialize: (state) => ({
        employeeInputs: state.employeeInputs,
        qualityMetrics: state.qualityMetrics,
      })
    }
  )
);
```

### 4. API服务层搭建 (3小时)

#### 主API服务
```typescript
// src/modules/processing/services/api.ts
import { apiClient } from '@/lib/api-client';
import { 
  BatchInfo, 
  EmployeeInput, 
  QualityMetrics,
  ProcessingResponse 
} from '../types/processing';

class ProcessingAPI {
  private baseURL = '/api/processing';

  // 获取生产批次信息
  async getCurrentBatch(): Promise<BatchInfo> {
    const response = await apiClient.get<ProcessingResponse<BatchInfo>>(
      `${this.baseURL}/current-batch`
    );
    return response.data.data;
  }

  // 提交员工录入数据
  async submitEmployeeInput(input: EmployeeInput): Promise<void> {
    await apiClient.post(`${this.baseURL}/employee-input`, input);
  }

  // 获取质量指标
  async getQualityMetrics(): Promise<QualityMetrics> {
    const response = await apiClient.get<ProcessingResponse<QualityMetrics>>(
      `${this.baseURL}/quality-metrics`
    );
    return response.data.data;
  }

  // 获取生产线状态
  async getProductionLineStatus(): Promise<ProductionLine[]> {
    const response = await apiClient.get<ProcessingResponse<ProductionLine[]>>(
      `${this.baseURL}/production-lines`
    );
    return response.data.data;
  }
}

export const processingAPI = new ProcessingAPI();
```

### 5. 基础页面框架 (1小时)

#### 加工模块主页
```typescript
// src/modules/processing/screens/ProcessingHome.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProcessingGuard } from '../components/common/ProcessingGuard';
import { useProcessingStore } from '../store/processingStore';

export default function ProcessingHome() {
  const { currentBatch, isLoading } = useProcessingStore();

  return (
    <ProcessingGuard>
      <View style={styles.container}>
        <Text style={styles.title}>加工管理</Text>
        {/* 基础框架 - 后续任务中完善 */}
        <View style={styles.placeholder}>
          <Text>加工模块主页框架已搭建完成</Text>
        </View>
      </View>
    </ProcessingGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f0f2f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});
```

## ✅ 验收标准

### 技术验收
- [ ] **目录结构完整**: 所有必要的目录和文件已创建
- [ ] **路由配置正确**: 可以正常导航到各个页面
- [ ] **权限集成成功**: 权限控制正常工作
- [ ] **状态管理可用**: Zustand store 可以正常读写
- [ ] **API服务就绪**: 基础API调用框架搭建完成

### 功能验收
- [ ] **模块可访问**: 加工模块可以正常访问
- [ ] **导航正常**: 页面间导航切换正常
- [ ] **权限控制**: 基于用户角色控制访问
- [ ] **状态持久**: 关键数据可以持久化存储
- [ ] **错误处理**: 基础错误处理机制就绪

### 代码质量
- [ ] **TypeScript类型**: 所有类型定义完整
- [ ] **代码规范**: 遵循项目代码规范
- [ ] **注释完整**: 关键代码有清晰注释
- [ ] **测试就绪**: 代码结构支持后续测试

## 🔗 依赖关系

### 输入依赖
- Phase 1认证系统完成
- 权限控制架构可用
- 基础组件库就绪
- 导航系统框架完成

### 输出交付
- 完整的加工模块基础架构
- 可扩展的代码结构
- 集成权限控制的路由系统
- 状态管理和API服务基础

## 🚨 风险提醒

### 主要风险
1. **权限集成复杂**: 可能需要适配现有权限系统
2. **状态管理设计**: 需要考虑数据流和性能
3. **API接口变更**: 后端接口可能需要调整

### 应对策略
1. **提前测试权限**: 确保权限系统集成正确
2. **模块化设计**: 保持代码的可维护性
3. **接口规范**: 与后端团队确认API设计

## 📝 后续任务接口

### 输出给 TASK-RN-011
- 完整的加工模块架构
- 员工录入页面基础框架
- 状态管理和API服务基础

### 技术栈依赖
- React Native + TypeScript
- Zustand (状态管理)
- React Navigation (导航)
- 现有权限系统

---

**任务负责人**: [待分配]
**预估开始时间**: Phase 1完成后
**预估完成时间**: 1.5个工作日后

*本任务完成后，加工模块将具备完整的基础架构，为后续功能开发提供坚实基础。*