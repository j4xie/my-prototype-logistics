# ClarificationDialog 集成指南

## 概述

`ClarificationDialog` 是一个用于收集用户澄清信息的对话框组件。当 AI 意图执行需要更多信息时，显示此对话框来引导用户提供必要的参数。

## 功能特性

- ✅ 自动根据参数类型生成合适的输入组件
- ✅ 支持多种参数类型：STRING, NUMBER, BOOLEAN, DATE, ENUM
- ✅ 必填字段验证
- ✅ 优雅的 UI 设计，符合项目整体风格
- ✅ 完整的 TypeScript 类型支持

## 快速开始

### 1. 导入组件和类型

```typescript
import { ClarificationDialog } from '../../components/ai';
import { IntentExecuteResponse, MissingParameter } from '../../types/intent';
```

### 2. 添加状态管理

```typescript
// 澄清问题对话框状态
const [showClarification, setShowClarification] = useState(false);
const [clarificationData, setClarificationData] = useState<{
  questions: string[];
  missingParameters?: MissingParameter[];
  originalRequest: any;
} | null>(null);
```

### 3. 在 API 响应处理中检查是否需要澄清

```typescript
const executeIntent = async (request: { intentCode: string; parameters?: Record<string, any> }) => {
  try {
    const response: IntentExecuteResponse = await aiApiClient.executeIntent(
      request.intentCode,
      request.parameters
    );

    // 检查是否需要澄清
    if (response.status === 'NEED_MORE_INFO' && response.clarificationQuestions) {
      setClarificationData({
        questions: response.clarificationQuestions,
        missingParameters: response.missingParameters,
        originalRequest: request,
      });
      setShowClarification(true);
      return;
    }

    // 处理成功响应...
  } catch (error) {
    // 错误处理...
  }
};
```

### 4. 处理用户提交的澄清答案

```typescript
const handleClarificationSubmit = async (answers: Record<string, any>) => {
  setShowClarification(false);

  if (!clarificationData) return;

  // 将答案合并到原请求的参数中
  const newRequest = {
    ...clarificationData.originalRequest,
    parameters: {
      ...clarificationData.originalRequest.parameters,
      ...answers,
    },
  };

  // 重新执行意图
  await executeIntent(newRequest);
  setClarificationData(null);
};
```

### 5. 处理用户取消操作

```typescript
const handleClarificationCancel = () => {
  setShowClarification(false);
  setClarificationData(null);
  Alert.alert('已取消', '操作已取消');
};
```

### 6. 渲染对话框

```tsx
{showClarification && clarificationData && (
  <ClarificationDialog
    visible={showClarification}
    questions={clarificationData.questions}
    missingParameters={clarificationData.missingParameters}
    onSubmit={handleClarificationSubmit}
    onCancel={handleClarificationCancel}
  />
)}
```

## Props 说明

### ClarificationDialogProps

| Prop | 类型 | 必需 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | ✅ | 对话框是否可见 |
| `questions` | `string[]` | ✅ | 澄清问题列表 |
| `missingParameters` | `MissingParameter[]` | ❌ | 缺失参数列表（用于结构化输入） |
| `onSubmit` | `(answers: Record<string, any>) => void` | ✅ | 提交回调 |
| `onCancel` | `() => void` | ✅ | 取消回调 |

### MissingParameter

| 字段 | 类型 | 说明 |
|------|------|------|
| `parameterName` | `string` | 参数名称 |
| `displayName` | `string` | 显示名称（用户友好） |
| `parameterType` | `'STRING' \| 'NUMBER' \| 'BOOLEAN' \| 'DATE' \| 'ENUM'` | 参数类型 |
| `required` | `boolean` | 是否必需 |
| `description` | `string` | 参数描述 |
| `possibleValues` | `string[]` | 可选值列表（ENUM 类型） |
| `validationHint` | `string` | 验证提示 |

## 使用场景

### 场景1：仅使用文本问题

当后端返回 `clarificationQuestions` 但没有 `missingParameters` 时，组件会显示自由文本输入框：

```typescript
<ClarificationDialog
  visible={true}
  questions={['请提供批次编号', '请输入供应商名称']}
  onSubmit={(answers) => {
    // answers = { answer_0: "批次编号值", answer_1: "供应商名称值" }
  }}
  onCancel={() => {}}
/>
```

### 场景2：使用结构化参数

当后端返回 `missingParameters` 时，组件会根据参数类型自动生成合适的输入控件：

```typescript
<ClarificationDialog
  visible={true}
  questions={['请提供以下信息以创建批次：']}
  missingParameters={[
    {
      parameterName: 'batchNumber',
      displayName: '批次编号',
      parameterType: 'STRING',
      required: true,
      description: '请输入批次编号（格式：BATCH-YYYYMMDD-XXX）',
    },
    {
      parameterName: 'quantity',
      displayName: '数量',
      parameterType: 'NUMBER',
      required: true,
      description: '请输入批次数量',
    },
    {
      parameterName: 'priority',
      displayName: '优先级',
      parameterType: 'ENUM',
      required: false,
      description: '选择批次优先级',
      possibleValues: ['高', '中', '低'],
    },
  ]}
  onSubmit={(answers) => {
    // answers = { batchNumber: "BATCH-20260106-001", quantity: 100, priority: "高" }
  }}
  onCancel={() => {}}
/>
```

## 参数类型渲染说明

| 参数类型 | 渲染组件 | 说明 |
|----------|----------|------|
| `STRING` | `TextInput` | 单行或多行文本输入框 |
| `NUMBER` | `TextInput` | 数字键盘的文本输入框 |
| `BOOLEAN` | 两个按钮 | "是" / "否" 按钮组 |
| `DATE` | `TextInput` | 日期格式输入（YYYY-MM-DD） |
| `ENUM` | 按钮组 | 根据 `possibleValues` 生成选项按钮 |

## 表单验证

组件会自动进行以下验证：

1. 必填字段验证（`required: true`）
2. 数字类型验证（`NUMBER` 类型）
3. 日期格式验证（`DATE` 类型）

验证失败时会在输入框下方显示错误提示。

## 样式定制

组件使用了项目的统一样式系统：

- 主色调：`#667eea` 到 `#764ba2` 渐变
- 按钮样式：圆角12px，渐变背景
- 输入框样式：圆角8px，边框1px
- 错误提示：红色 `#ff4d4f`

## 完整示例

参考 `ClarificationDialogIntegrationExample.tsx` 文件查看完整的集成示例。

## 注意事项

1. **类型安全**：确保使用 TypeScript 类型定义，避免使用 `any`
2. **错误处理**：始终处理 API 调用的错误情况
3. **用户体验**：提供清晰的问题描述和验证提示
4. **数据格式**：确保前后端的参数名称和类型一致

## 相关文件

- 类型定义：`/src/types/intent.ts`
- API 客户端：`/src/services/api/aiApiClient.ts`
- 组件导出：`/src/components/ai/index.ts`
- 集成示例：`/src/components/ai/ClarificationDialogIntegrationExample.tsx`

## 后续扩展

可能的扩展方向：

- [ ] 支持日期选择器组件
- [ ] 支持多选 ENUM 类型
- [ ] 支持文件上传参数
- [ ] 支持嵌套对象参数
- [ ] 支持条件显示（某些参数依赖其他参数）
