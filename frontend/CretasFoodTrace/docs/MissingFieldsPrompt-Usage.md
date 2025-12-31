# MissingFieldsPrompt 使用指南

## 概述

`MissingFieldsPrompt` 是一个用于处理 AI 表单解析中缺失必填字段的交互式弹窗组件。当 AI 成功解析用户输入但检测到某些必填字段缺失时，会自动弹出此组件引导用户补充信息。

## 功能特性

1. **智能追问** - 显示 AI 生成的针对性问题
2. **多种输入方式** - 支持文本输入和语音输入
3. **字段对应** - 每个缺失字段对应一个专门的输入区域
4. **友好提示** - 清晰的 UI 指引和状态反馈
5. **灵活控制** - 用户可以选择补充或跳过

## 架构集成

### 数据流

```
用户语音/文本输入
    ↓
AI 解析表单字段
    ↓
检测到缺失必填字段
    ↓
触发 onMissingFields 回调
    ↓
显示 MissingFieldsPrompt
    ↓
用户补充信息
    ↓
再次调用 AI 解析
    ↓
自动填充表单
```

### 组件集成位置

```
AIAssistantButton
  ├── useFormAIAssistant (Hook)
  │     └── onMissingFields 回调
  └── MissingFieldsPrompt (组件)
```

## 基础用法

### 1. 自动集成（推荐）

如果您使用 `DynamicForm` 并启用了 AI 助手，`MissingFieldsPrompt` 已经自动集成，无需额外配置：

```tsx
import { DynamicForm } from '../formily/core/DynamicForm';
import { EntityType } from '../services/api/formTemplateApiClient';

function MyFormScreen() {
  const formRef = useRef<DynamicFormRef>(null);

  return (
    <DynamicForm
      ref={formRef}
      schema={mySchema}
      enableAIAssistant={true}
      entityType={EntityType.MATERIAL_BATCH}
      onSubmit={handleSubmit}
    />
  );
}
```

**工作流程：**
1. 用户点击 AI 助手按钮
2. 用户输入："添加一个带鱼批次，500公斤"（缺少温度）
3. AI 解析成功，填充部分字段
4. 检测到 `temperature` 缺失
5. 自动弹出 `MissingFieldsPrompt`，询问："请问温度是多少度？"
6. 用户补充："零下20度"
7. AI 再次解析并填充温度字段

### 2. 手动使用

如果需要单独使用此组件：

```tsx
import { MissingFieldsPrompt } from '../components/form/MissingFieldsPrompt';

function CustomFormComponent() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);

  const handleSubmit = (answers: Record<string, string>) => {
    console.log('用户补充的信息:', answers);
    // answers 格式: { temperature: '-20', quantity: '500' }

    // 将答案应用到表单
    Object.entries(answers).forEach(([field, value]) => {
      form.setFieldValue(field, value);
    });

    setShowPrompt(false);
  };

  return (
    <MissingFieldsPrompt
      visible={showPrompt}
      onDismiss={() => setShowPrompt(false)}
      missingFields={missingFields}
      suggestedQuestions={questions}
      followUpQuestion="还需要补充以下信息"
      onSubmit={handleSubmit}
      onCancel={() => setShowPrompt(false)}
    />
  );
}
```

## Props 说明

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | 是 | 是否显示弹窗 |
| `onDismiss` | `() => void` | 是 | 关闭弹窗的回调 |
| `missingFields` | `string[]` | 是 | 缺失的字段名列表，如 `['temperature', 'quantity']` |
| `suggestedQuestions` | `string[]` | 是 | AI 生成的问题列表，与 `missingFields` 一一对应 |
| `followUpQuestion` | `string` | 否 | 主要追问问题（用于标题），如 "还需要补充温度和数量信息" |
| `onSubmit` | `(answers: Record<string, string>) => void` | 是 | 用户提交答案的回调 |
| `onCancel` | `() => void` | 是 | 用户取消/跳过的回调 |
| `isLoading` | `boolean` | 否 | 是否正在处理（显示加载状态） |

## 示例场景

### 场景 1：原料批次录入

**用户输入：** "添加一个带鱼批次，500公斤"

**AI 解析结果：**
```json
{
  "fieldValues": {
    "materialType": "带鱼",
    "quantity": 500
  },
  "missingRequiredFields": ["temperature", "expiryDate"],
  "suggestedQuestions": [
    "请问储存温度是多少度？",
    "保质期到什么时候？"
  ],
  "followUpQuestion": "还需要补充温度和保质期信息"
}
```

**弹窗显示：**
- 标题："还需要补充温度和保质期信息"
- 字段 1：temperature - "请问储存温度是多少度？"
- 字段 2：expiryDate - "保质期到什么时候？"

### 场景 2：质检记录

**用户输入：** "质检合格"

**AI 解析结果：**
```json
{
  "fieldValues": {
    "status": "PASS"
  },
  "missingRequiredFields": ["inspector", "checkTime"],
  "suggestedQuestions": [
    "请问检验员是谁？",
    "检验时间是什么时候？"
  ]
}
```

## 后端 API 集成

### 请求示例

```typescript
// formAssistantApiClient.parseFormInput()
const request: FormParseRequest = {
  userInput: "添加一个带鱼批次，500公斤",
  entityType: EntityType.MATERIAL_BATCH,
  formFields: [
    { name: 'materialType', title: '原料类型', type: 'string', required: true },
    { name: 'quantity', title: '数量', type: 'number', required: true },
    { name: 'temperature', title: '温度', type: 'number', required: true },
  ]
};
```

### 响应示例

```typescript
const response: FormParseResponse = {
  success: true,
  fieldValues: {
    materialType: "带鱼",
    quantity: 500
  },
  confidence: 0.85,
  // P1-1 新增字段
  missingRequiredFields: ["temperature"],
  suggestedQuestions: ["请问储存温度是多少度？"],
  followUpQuestion: "还需要补充温度信息"
};
```

## 技术细节

### 语音输入集成

组件内置了语音识别功能，使用 `speechRecognitionService`：

```typescript
// 点击麦克风按钮
startVoiceInput(fieldIndex) → 请求录音权限 → 开始录音

// 再次点击停止
stopVoiceInput() → 语音识别 → 填充到对应字段
```

### 状态管理

```typescript
// AIAssistantButton 中的状态
const [isMissingFieldsPromptVisible, setIsMissingFieldsPromptVisible] = useState(false);
const [currentMissingFields, setCurrentMissingFields] = useState<string[]>([]);
const [currentSuggestedQuestions, setCurrentSuggestedQuestions] = useState<string[]>([]);
const [currentFollowUpQuestion, setCurrentFollowUpQuestion] = useState<string | undefined>();
const [isProcessingFollowUp, setIsProcessingFollowUp] = useState(false);
```

### 答案处理流程

```typescript
// 用户提交答案
handleMissingFieldsSubmit(answers) {
  // answers: { temperature: "-20", expiryDate: "2024-12-31" }

  // 1. 转换为自然语言
  const answerText = "temperature: -20，expiryDate: 2024-12-31";

  // 2. 再次调用 AI 解析
  const result = await parseWithAI(answerText);

  // 3. AI 自动填充到表单
  // formRef.current.setFieldValue('temperature', -20);
  // formRef.current.setFieldValue('expiryDate', '2024-12-31');
}
```

## 样式定制

组件使用 React Native Paper 主题系统，会自动适配您的应用主题：

```tsx
const theme = useTheme();

// 主题色
theme.colors.primary    // AI 提示、麦克风按钮
theme.colors.surface    // 弹窗背景
theme.colors.error      // 错误提示
```

## 最佳实践

### 1. 提供清晰的字段定义

确保传递给 AI 的 `formFields` 包含准确的 `title` 和 `description`：

```typescript
const formFields: FormFieldDefinition[] = [
  {
    name: 'temperature',
    title: '储存温度',
    type: 'number',
    required: true,
    description: '冷冻食品储存温度，单位：摄氏度'
  }
];
```

这样 AI 才能生成更准确的追问。

### 2. 处理跳过场景

用户可能选择跳过补充信息，应该优雅处理：

```typescript
const handleMissingFieldsCancel = () => {
  setIsMissingFieldsPromptVisible(false);
  showSnackbar('已跳过补充信息，您可以手动填写', 'success');
};
```

### 3. 多轮对话支持

如果首次补充后仍有缺失字段，组件会再次弹出：

```typescript
// 第一轮：补充温度
// 第二轮：补充保质期
// 直到所有必填字段完整
```

## 错误处理

### 语音识别失败

```typescript
if (result.text === '[语音识别需要配置讯飞密钥]') {
  // 静默跳过，用户可以手动输入
}
```

### AI 解析失败

```typescript
catch (err) {
  console.error('[AIAssistantButton] 处理补充信息失败:', err);
  showSnackbar('处理补充信息失败', 'error');
}
```

## 验收清单

- [x] 组件可正常渲染
- [x] 显示缺失字段和追问问题
- [x] 用户可通过文本输入答案
- [x] 用户可通过语音输入答案
- [x] 提交后回调 `onSubmit`
- [x] 取消后回调 `onCancel`
- [x] 与 `DynamicForm` 自动集成
- [x] TypeScript 类型安全
- [x] 支持多字段同时追问
- [x] 加载状态显示正确

## 相关文件

- 组件实现：`/src/components/form/MissingFieldsPrompt.tsx`
- 集成位置：`/src/formily/components/AIAssistantButton.tsx`
- Hook 实现：`/src/formily/hooks/useFormAIAssistant.ts`
- API 客户端：`/src/services/api/formAssistantApiClient.ts`

## 下一步

- [ ] 支持字段依赖关系（某些字段仅在特定条件下必填）
- [ ] 添加字段预填充建议（基于历史数据）
- [ ] 支持复杂字段类型（数组、对象）
- [ ] 优化语音识别准确率
