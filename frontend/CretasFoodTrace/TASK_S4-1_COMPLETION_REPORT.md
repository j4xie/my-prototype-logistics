# S4-1 多轮追问 UI 组件 - 完成报告

## 任务概述

实现了 AI 表单助手的多轮追问功能，当 AI 检测到用户输入缺失必填字段时，会自动弹出友好的 UI 组件引导用户补充信息。

## 实现内容

### 1. 核心组件: `MissingFieldsPrompt.tsx`

**文件路径**: `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/components/form/MissingFieldsPrompt.tsx`

**功能特性**:
- ✅ 展示缺失字段列表（字段名 + AI 生成的追问）
- ✅ 支持文本输入补充信息
- ✅ 支持语音输入补充信息（集成讯飞语音识别）
- ✅ 实时录音状态指示器
- ✅ 友好的 UI/UX 设计（react-native-paper）
- ✅ 完整的 TypeScript 类型定义
- ✅ 键盘避让优化（KeyboardAvoidingView）

**组件接口**:
```typescript
export interface MissingFieldsPromptProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onDismiss: () => void;
  /** 缺失的字段名列表 */
  missingFields: string[];
  /** AI生成的追问列表（与 missingFields 一一对应） */
  suggestedQuestions: string[];
  /** 主要追问问题（用于弹窗标题） */
  followUpQuestion?: string;
  /** 提交回调（用户回答 -> 字段值映射） */
  onSubmit: (answers: Record<string, string>) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在处理 */
  isLoading?: boolean;
}
```

**使用示例**:
```tsx
<MissingFieldsPrompt
  visible={showPrompt}
  onDismiss={() => setShowPrompt(false)}
  missingFields={['quantity', 'temperature']}
  suggestedQuestions={['请问数量是多少？', '温度是多少度？']}
  followUpQuestion="还需要补充数量和温度信息"
  onSubmit={(answers) => {
    // 将答案合并到表单
    form.setValues({ ...form.values, ...answers });
  }}
  onCancel={() => setShowPrompt(false)}
/>
```

---

### 2. Hook 集成: `useFormAIAssistant.ts`

**文件路径**: `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/formily/hooks/useFormAIAssistant.ts`

**增强内容**:

#### 2.1 新增类型定义
```typescript
export interface UseFormAIAssistantOptions {
  // ... 其他配置 ...

  /**
   * P1-1: 缺失必填字段的回调
   * 当 AI 解析成功但检测到缺失必填字段时触发
   */
  onMissingFields?: (
    missingFields: string[],
    suggestedQuestions: string[],
    followUpQuestion?: string
  ) => void;
}

export interface AIParseResult {
  // ... 其他字段 ...

  // P1-1: 缺字段自动追问
  /** 缺失的必填字段名列表 */
  missingRequiredFields?: string[];
  /** AI生成的追问问题列表 */
  suggestedQuestions?: string[];
  /** 主要追问问题 (便于简单场景使用) */
  followUpQuestion?: string;
  /** 是否需要用户补充信息 */
  needsFollowUp?: boolean;
}
```

#### 2.2 parseWithAI 增强逻辑
```typescript
const parseWithAI = useCallback(async (userInput: string): Promise<AIParseResult> => {
  // ... 调用 API ...

  // P1-1: 检测是否需要追问
  const hasMissingFields = response.missingRequiredFields && response.missingRequiredFields.length > 0;
  const needsFollowUp = hasMissingFields ?? false;

  // P1-1: 如果有缺失字段，触发回调
  if (needsFollowUp && response.missingRequiredFields && response.suggestedQuestions) {
    onMissingFields?.(
      response.missingRequiredFields,
      response.suggestedQuestions,
      response.followUpQuestion
    );
  }

  return result;
}, [entityType, formFields, context, fillFormWithValues, onAIFill, onError, onMissingFields]);
```

---

### 3. UI 组件集成: `AIAssistantButton.tsx`

**文件路径**: `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/formily/components/AIAssistantButton.tsx`

**集成内容**:

#### 3.1 状态管理
```typescript
// P1-1: 缺失字段追问状态
const [isMissingFieldsPromptVisible, setIsMissingFieldsPromptVisible] = useState(false);
const [currentMissingFields, setCurrentMissingFields] = useState<string[]>([]);
const [currentSuggestedQuestions, setCurrentSuggestedQuestions] = useState<string[]>([]);
const [currentFollowUpQuestion, setCurrentFollowUpQuestion] = useState<string | undefined>();
const [isProcessingFollowUp, setIsProcessingFollowUp] = useState(false);
```

#### 3.2 回调处理
```typescript
// AI 助手 Hook 配置
const { parseWithAI, ... } = useFormAIAssistant({
  formRef,
  entityType,
  schema,
  context,
  // P1-1: 缺失字段追问回调
  onMissingFields: (missingFields, suggestedQuestions, followUpQuestion) => {
    console.log('[AIAssistantButton] 检测到缺失字段，打开追问弹窗');
    setCurrentMissingFields(missingFields);
    setCurrentSuggestedQuestions(suggestedQuestions);
    setCurrentFollowUpQuestion(followUpQuestion);
    setIsMissingFieldsPromptVisible(true);
  },
});
```

#### 3.3 用户补充处理
```typescript
/**
 * P1-1: 处理缺失字段追问提交
 * 用户补充的答案会被合并成一段文本，再次调用 AI 解析
 */
const handleMissingFieldsSubmit = useCallback(async (answers: Record<string, string>) => {
  setIsProcessingFollowUp(true);

  try {
    // 将答案转换为自然语言
    const answerText = Object.entries(answers)
      .map(([field, value]) => `${field}: ${value}`)
      .join('，');

    // 再次调用 AI 解析
    const result = await parseWithAI(answerText);

    setIsMissingFieldsPromptVisible(false);

    if (result.success) {
      showSnackbar('补充信息已成功填充', 'success');
    }
  } catch (err) {
    showSnackbar('处理补充信息失败', 'error');
  } finally {
    setIsProcessingFollowUp(false);
  }
}, [formRef, parseWithAI, showSnackbar]);
```

#### 3.4 组件渲染
```tsx
{/* P1-1: 缺失字段追问弹窗 */}
<MissingFieldsPrompt
  visible={isMissingFieldsPromptVisible}
  onDismiss={handleMissingFieldsCancel}
  missingFields={currentMissingFields}
  suggestedQuestions={currentSuggestedQuestions}
  followUpQuestion={currentFollowUpQuestion}
  onSubmit={handleMissingFieldsSubmit}
  onCancel={handleMissingFieldsCancel}
  isLoading={isProcessingFollowUp}
/>
```

---

## 后端 API 对接

### FormParseResponse 扩展

**文件路径**: `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/services/api/formAssistantApiClient.ts`

```typescript
export interface FormParseResponse {
  success: boolean;
  fieldValues: Record<string, unknown>;
  confidence: number;
  unparsedText?: string;
  message?: string;

  // P1-1: 缺字段自动追问
  /** 缺失的必填字段名列表 */
  missingRequiredFields?: string[];
  /** AI生成的追问问题列表 */
  suggestedQuestions?: string[];
  /** 主要追问问题 (便于简单场景使用) */
  followUpQuestion?: string;
}
```

**后端需实现**:
```java
@PostMapping("/parse")
public ApiResponse<FormParseResponse> parseFormInput(@RequestBody FormParseRequest request) {
    FormParseResponse response = new FormParseResponse();

    // 1. AI 解析用户输入
    Map<String, Object> fieldValues = aiService.parseUserInput(request);

    // 2. 检测缺失必填字段
    List<String> missingFields = detectMissingRequiredFields(request.getFormFields(), fieldValues);

    if (!missingFields.isEmpty()) {
        // 3. AI 生成追问
        response.setMissingRequiredFields(missingFields);
        response.setSuggestedQuestions(aiService.generateQuestions(missingFields));
        response.setFollowUpQuestion("还需要补充以下信息：" + String.join("、", missingFields));
    }

    response.setFieldValues(fieldValues);
    response.setSuccess(true);

    return ApiResponse.success(response);
}
```

---

## 用户体验流程

### 场景: 用户创建物料批次

1. **用户语音输入**: "帮我创建一个带鱼批次，温度零下20度"

2. **AI 解析**:
   - 成功识别: `materialType = "带鱼"`, `temperature = -20`
   - 检测缺失必填字段: `quantity`, `supplierId`

3. **自动弹出追问弹窗**:
   ```
   标题: 还需要补充数量和供应商信息

   [字段卡片 1]
   字段名: quantity (必填)
   追问: 请问这批带鱼的数量是多少？
   [文本输入框] [麦克风按钮]

   [字段卡片 2]
   字段名: supplierId (必填)
   追问: 请选择供应商
   [文本输入框] [麦克风按钮]

   [跳过] [继续]
   ```

4. **用户补充**:
   - 点击麦克风: "500公斤，供应商是张三水产"
   - 或手动输入: "500kg, 张三水产"

5. **二次 AI 解析**:
   - 解析补充信息: `quantity = 500`, `supplierId = "张三水产"`
   - 自动填充到表单

6. **完成**: 表单所有必填字段填充完毕，用户可提交

---

## 技术亮点

### 1. TypeScript 类型安全
- ✅ 严格类型定义，禁止 `as any`
- ✅ 使用类型守卫和泛型
- ✅ 完整的接口文档

### 2. 用户体验优化
- ✅ 友好的错误提示
- ✅ 实时状态反馈（录音中、AI 分析中）
- ✅ 键盘避让（KeyboardAvoidingView）
- ✅ 支持跳过（用户可手动填写）

### 3. 语音集成
- ✅ 支持语音输入每个缺失字段
- ✅ 实时录音状态指示
- ✅ 权限检查和错误处理

### 4. 代码质量
- ✅ 完整的 JSDoc 注释
- ✅ 清晰的文件组织
- ✅ 符合项目规范（参考 `ValidationCorrectionModal` 模式）

---

## 文件清单

### 新建文件
1. `/src/components/form/MissingFieldsPrompt.tsx` - 缺失字段追问组件（已创建）

### 修改文件
1. `/src/formily/hooks/useFormAIAssistant.ts` - 增加 `onMissingFields` 回调（已完成）
2. `/src/formily/components/AIAssistantButton.tsx` - 集成追问组件（已完成）
3. `/src/components/form/index.ts` - 导出新组件（已完成）
4. `/src/services/api/formAssistantApiClient.ts` - 扩展 API 响应类型（已完成）

---

## 验证清单

- [x] 组件正确导出到 `src/components/form/index.ts`
- [x] TypeScript 类型定义完整且无 `as any`
- [x] 集成到 `AIAssistantButton.tsx`
- [x] Hook `useFormAIAssistant.ts` 支持 `onMissingFields` 回调
- [x] 支持文本输入
- [x] 支持语音输入
- [x] 符合 react-native-paper 设计规范
- [x] 参考现有模式（ValidationCorrectionModal）
- [x] 完整的错误处理
- [x] 友好的用户提示

---

## 下一步建议

### 1. 后端实现
- 实现 `/api/mobile/{factoryId}/form-assistant/parse` 的缺失字段检测逻辑
- AI 生成追问问题（根据字段类型和描述）

### 2. 测试
- 单元测试: `MissingFieldsPrompt.test.tsx`
- 集成测试: 完整流程测试（语音输入 -> 缺失检测 -> 追问 -> 补充 -> 填充）

### 3. 优化
- 支持更智能的追问（基于上下文）
- 支持多轮追问（递归检测缺失字段）
- 支持字段间依赖关系（如选择供应商后自动填充联系方式）

---

## 总结

✅ **任务完成**: S4-1 多轮追问 UI 组件已完整实现并集成到 AI 表单助手系统中。

✅ **代码质量**: 符合项目规范，TypeScript 类型安全，无 `as any` 滥用。

✅ **用户体验**: 提供友好的 UI 引导用户补充缺失信息，支持文本和语音双模式输入。

✅ **可扩展性**: 清晰的接口设计，便于后续扩展（如多轮追问、智能建议等）。

---

**作者**: Claude Code
**日期**: 2025-12-31
**版本**: 1.0.0
