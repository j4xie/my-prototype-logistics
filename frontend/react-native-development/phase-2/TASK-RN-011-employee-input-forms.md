# TASK-RN-011: 员工录入系统 - 表单设计

> React Native Android开发 - Phase 2 Week 1
>
> 任务编号: TASK-RN-011
> 工期: 2天 (16小时)
> 优先级: 高
> 状态: 待开始
> 依赖: TASK-RN-010

## 🎯 任务目标

设计和实现完整的员工录入系统表单界面，支持多步骤录入流程，包括原料接收、生产记录、质检数据、成品包装等环节，优化移动端用户体验。

## 📋 具体工作内容

### 1. 多步骤表单组件设计 (6小时)

#### 步骤流程定义
```typescript
// src/modules/processing/types/employeeInput.ts
export enum InputStep {
  MATERIAL_RECEIPT = 'material_receipt',    // 原料接收
  PRODUCTION_RECORD = 'production_record',  // 生产记录  
  QUALITY_CHECK = 'quality_check',          // 质检数据
  PACKAGING = 'packaging',                  // 成品包装
  REVIEW = 'review'                         // 确认提交
}

export interface StepConfig {
  id: InputStep;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  estimatedTime: number; // 预估填写时间(分钟)
}

export const INPUT_STEPS: StepConfig[] = [
  {
    id: InputStep.MATERIAL_RECEIPT,
    title: '原料接收',
    description: '记录原料信息和验收结果',
    icon: '📦',
    required: true,
    estimatedTime: 3
  },
  {
    id: InputStep.PRODUCTION_RECORD,
    title: '生产记录',
    description: '记录生产过程和工艺参数',
    icon: '🏭',
    required: true,
    estimatedTime: 5
  },
  {
    id: InputStep.QUALITY_CHECK,
    title: '质检数据',
    description: '记录质量检测结果',
    icon: '🔬',
    required: true,
    estimatedTime: 4
  },
  {
    id: InputStep.PACKAGING,
    title: '成品包装',
    description: '记录包装信息和标签',
    icon: '📋',
    required: true,
    estimatedTime: 2
  },
  {
    id: InputStep.REVIEW,
    title: '确认提交',
    description: '确认所有信息并提交',
    icon: '✅',
    required: true,
    estimatedTime: 1
  }
];
```

#### 步骤导航组件
```typescript
// src/modules/processing/components/forms/StepIndicator.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { InputStep, StepConfig } from '../../types/employeeInput';

interface StepIndicatorProps {
  steps: StepConfig[];
  currentStep: InputStep;
  completedSteps: InputStep[];
  onStepPress: (step: InputStep) => void;
}

export function StepIndicator({ 
  steps, 
  currentStep, 
  completedSteps, 
  onStepPress 
}: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;
        const isAccessible = isCompleted || isCurrent || 
          (index > 0 && completedSteps.includes(steps[index - 1].id));

        return (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.step,
              isCurrent && styles.currentStep,
              isCompleted && styles.completedStep,
              !isAccessible && styles.disabledStep
            ]}
            onPress={() => isAccessible && onStepPress(step.id)}
            disabled={!isAccessible}
          >
            <Text style={styles.stepIcon}>{step.icon}</Text>
            <Text style={[
              styles.stepTitle,
              isCurrent && styles.currentStepTitle,
              isCompleted && styles.completedStepTitle
            ]}>
              {step.title}
            </Text>
            {isCompleted && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
```

### 2. 各步骤表单实现 (8小时)

#### 原料接收表单
```typescript
// src/modules/processing/components/forms/MaterialReceiptForm.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormInput, FormPicker, FormDatePicker, FormCamera } from '@/components/ui/forms';
import { QRCodeScanner } from '@/components/ui';

interface MaterialReceiptData {
  batchCode: string;
  supplierName: string;
  materialType: string;
  quantity: number;
  unit: string;
  receivedDate: Date;
  quality: 'excellent' | 'good' | 'acceptable' | 'rejected';
  temperature: number;
  photos: string[];
  notes: string;
}

export function MaterialReceiptForm({ onDataChange, initialData }: MaterialReceiptFormProps) {
  const [data, setData] = useState<MaterialReceiptData>(initialData || {});
  const [showScanner, setShowScanner] = useState(false);

  const handleQRScan = (code: string) => {
    // 解析二维码获取批次信息
    const batchInfo = parseBatchCode(code);
    setData(prev => ({ ...prev, ...batchInfo }));
    setShowScanner(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>原料信息</Text>
      
      <FormInput
        label="批次编号"
        value={data.batchCode}
        onChangeText={(text) => updateField('batchCode', text)}
        placeholder="扫码或手动输入"
        rightIcon={
          <TouchableOpacity onPress={() => setShowScanner(true)}>
            <Text>📱</Text>
          </TouchableOpacity>
        }
        required
      />

      <FormPicker
        label="原料类型"
        value={data.materialType}
        onValueChange={(value) => updateField('materialType', value)}
        options={[
          { label: '生鲜肉类', value: 'fresh_meat' },
          { label: '冷冻食品', value: 'frozen_food' },
          { label: '调料香料', value: 'seasoning' },
          { label: '包装材料', value: 'packaging' }
        ]}
        required
      />

      <View style={styles.row}>
        <FormInput
          label="数量"
          value={data.quantity?.toString()}
          onChangeText={(text) => updateField('quantity', parseFloat(text))}
          keyboardType="numeric"
          style={styles.halfWidth}
          required
        />
        <FormPicker
          label="单位"
          value={data.unit}
          onValueChange={(value) => updateField('unit', value)}
          options={[
            { label: '千克(kg)', value: 'kg' },
            { label: '箱', value: 'box' },
            { label: '袋', value: 'bag' }
          ]}
          style={styles.halfWidth}
          required
        />
      </View>

      <FormDatePicker
        label="接收时间"
        value={data.receivedDate}
        onDateChange={(date) => updateField('receivedDate', date)}
        required
      />

      <Text style={styles.sectionTitle}>质量检查</Text>

      <FormPicker
        label="质量等级"
        value={data.quality}
        onValueChange={(value) => updateField('quality', value)}
        options={[
          { label: '优秀', value: 'excellent' },
          { label: '良好', value: 'good' },
          { label: '合格', value: 'acceptable' },
          { label: '不合格', value: 'rejected' }
        ]}
        required
      />

      <FormInput
        label="温度 (°C)"
        value={data.temperature?.toString()}
        onChangeText={(text) => updateField('temperature', parseFloat(text))}
        keyboardType="numeric"
        placeholder="测量温度"
      />

      <FormCamera
        label="拍照记录"
        photos={data.photos}
        onPhotosChange={(photos) => updateField('photos', photos)}
        maxPhotos={3}
        placeholder="拍摄原料照片"
      />

      <FormInput
        label="备注"
        value={data.notes}
        onChangeText={(text) => updateField('notes', text)}
        multiline
        numberOfLines={3}
        placeholder="其他需要记录的信息"
      />

      {showScanner && (
        <QRCodeScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </View>
  );
}
```

#### 生产记录表单
```typescript
// src/modules/processing/components/forms/ProductionRecordForm.tsx
export function ProductionRecordForm({ onDataChange, initialData }: ProductionRecordFormProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>生产工艺</Text>
      
      <FormPicker
        label="生产线"
        value={data.productionLine}
        onValueChange={(value) => updateField('productionLine', value)}
        options={productionLines}
        required
      />

      <FormDatePicker
        label="开始时间"
        value={data.startTime}
        onDateChange={(date) => updateField('startTime', date)}
        mode="datetime"
        required
      />

      <Text style={styles.sectionTitle}>工艺参数</Text>

      <View style={styles.row}>
        <FormInput
          label="加工温度 (°C)"
          value={data.temperature?.toString()}
          onChangeText={(text) => updateField('temperature', parseFloat(text))}
          keyboardType="numeric"
          style={styles.halfWidth}
          required
        />
        <FormInput
          label="加工时间 (分钟)"
          value={data.duration?.toString()}
          onChangeText={(text) => updateField('duration', parseInt(text))}
          keyboardType="numeric"
          style={styles.halfWidth}
          required
        />
      </View>

      <FormInput
        label="设备编号"
        value={data.equipmentId}
        onChangeText={(text) => updateField('equipmentId', text)}
        placeholder="扫码或手动输入设备编号"
        required
      />

      <FormPicker
        label="工艺类型"
        value={data.processType}
        onValueChange={(value) => updateField('processType', value)}
        options={[
          { label: '清洗', value: 'cleaning' },
          { label: '切割', value: 'cutting' },
          { label: '腌制', value: 'marinating' },
          { label: '烹饪', value: 'cooking' },
          { label: '冷却', value: 'cooling' }
        ]}
        required
      />

      <FormCamera
        label="过程照片"
        photos={data.processPhotos}
        onPhotosChange={(photos) => updateField('processPhotos', photos)}
        maxPhotos={5}
        placeholder="记录生产过程"
      />
    </View>
  );
}
```

### 3. 移动端优化 (1.5小时)

#### 大按钮设计
```typescript
// src/modules/processing/components/forms/FormButton.tsx
export function FormButton({ title, onPress, variant = 'primary', size = 'large' }: FormButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[size]
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, styles[`${variant}Text`]]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  large: {
    height: 56,
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: '#1976d2',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

### 4. 实时验证系统 (0.5小时)

#### 验证规则配置
```typescript
// src/modules/processing/utils/validation.ts
export const validationRules = {
  materialReceipt: {
    batchCode: [
      { required: true, message: '批次编号不能为空' },
      { pattern: /^[A-Z0-9]{8,12}$/, message: '批次编号格式不正确' }
    ],
    quantity: [
      { required: true, message: '数量不能为空' },
      { min: 0.1, message: '数量必须大于0' }
    ],
    temperature: [
      { range: [-20, 80], message: '温度范围应在-20°C到80°C之间' }
    ]
  }
};
```

## ✅ 验收标准

### 功能验收
- [ ] **多步骤流程**: 5个步骤可以正确切换和导航
- [ ] **表单验证**: 实时验证和错误提示正常
- [ ] **数据录入**: 所有表单字段可以正常录入
- [ ] **移动端体验**: 大按钮、清晰布局、操作便捷
- [ ] **二维码扫描**: 批次扫码功能正常工作
- [ ] **拍照功能**: 可以拍摄和管理照片

### 用户体验验收
- [ ] **操作流畅**: 表单切换无卡顿，响应快速
- [ ] **错误友好**: 验证错误提示清晰易懂
- [ ] **进度明确**: 用户能清楚了解当前进度
- [ ] **数据保存**: 表单数据可以暂存和恢复
- [ ] **离线支持**: 网络断开时仍可录入

### 技术验收
- [ ] **TypeScript**: 类型定义完整正确
- [ ] **组件复用**: 表单组件可以在其他模块复用
- [ ] **性能优化**: 大量数据录入时性能良好
- [ ] **内存管理**: 图片上传不会导致内存泄漏

## 🎨 UI/UX 设计要点

### 移动端优化
- **大按钮设计**: 按钮高度≥44dp，便于手指点击
- **清晰布局**: 使用卡片式布局，信息层次分明
- **手势支持**: 支持滑动切换步骤
- **智能键盘**: 根据输入类型显示合适键盘

### 表单体验
- **渐进式录入**: 允许分步骤保存，不强制一次完成
- **智能提示**: 基于历史数据提供输入建议
- **错误预防**: 通过UI设计减少用户输入错误
- **快速操作**: 提供常用选项的快捷按钮

## 🔗 依赖关系

### 输入依赖
- TASK-RN-010 加工模块架构完成
- 基础UI组件库可用
- 二维码扫描组件就绪
- 相机组件可用

### 输出交付
- 完整的员工录入表单系统
- 可复用的表单组件库
- 移动端优化的交互体验
- 实时验证和错误处理机制

## 🚨 风险提醒

### 主要风险
1. **复杂表单性能**: 多步骤表单可能影响性能
2. **验证规则复杂**: 业务验证规则可能经常变化
3. **移动端适配**: 不同屏幕尺寸适配挑战

### 应对策略
1. **懒加载**: 只渲染当前步骤的表单
2. **配置化验证**: 将验证规则配置化管理
3. **响应式设计**: 使用弹性布局适配不同屏幕

---

**任务负责人**: [待分配]
**预估开始时间**: TASK-RN-010完成后
**预估完成时间**: 2个工作日后

*本任务完成后，员工将能够通过友好的移动端界面完成完整的数据录入流程。*