# 质检处置 UI - 快速开始

## 5 分钟集成指南

### 步骤 1: 导入组件

```tsx
import {
  DispositionSuggestion,
  DispositionHistory,
  DispositionActionPicker,
} from '@/components/quality';
```

### 步骤 2: 基础使用

#### 显示 AI 处置建议

```tsx
<DispositionSuggestion
  batchId={12345}
  inspectionId="INS-2025-001"
  qualityScore={92.5}
  onDispositionComplete={(result) => {
    console.log('处置完成:', result);
  }}
/>
```

#### 显示处置历史

```tsx
<DispositionHistory
  batchId={12345}
  inspectionId="INS-2025-001"
/>
```

#### 手动选择处置动作

```tsx
const [selectedAction, setSelectedAction] = useState(null);
const [comment, setComment] = useState('');

<DispositionActionPicker
  selectedAction={selectedAction}
  onActionChange={setSelectedAction}
  operatorComment={comment}
  onCommentChange={setComment}
/>
```

### 步骤 3: 集成到质检详情页

```tsx
import { TabView } from 'react-native-tab-view';

function QualityDetailScreen({ route }) {
  const { batchId, inspectionId } = route.params;

  return (
    <TabView
      renderScene={({ route }) => {
        if (route.key === 'disposition') {
          return (
            <DispositionSuggestion
              batchId={batchId}
              inspectionId={inspectionId}
              qualityScore={95}
              onDispositionComplete={(result) => {
                Alert.alert('成功', result.message);
              }}
            />
          );
        }
        if (route.key === 'history') {
          return <DispositionHistory batchId={batchId} />;
        }
      }}
    />
  );
}
```

---

## 核心概念

### 处置动作类型

| 动作 | 代码 | 颜色 | 需审批 |
|------|------|------|--------|
| 放行 | `RELEASE` | 🟢 绿色 | ❌ |
| 条件放行 | `CONDITIONAL_RELEASE` | 🟡 黄色 | ❌ |
| 返工 | `REWORK` | 🟠 橙色 | ❌ |
| 报废 | `SCRAP` | 🔴 红色 | ✅ |
| 特批 | `SPECIAL_APPROVAL` | 🟣 紫色 | ✅ |
| 暂扣 | `HOLD` | 🔵 蓝色 | ❌ |

### 工具函数

```typescript
import {
  getActionLabel,      // 获取中文标签
  getActionColor,      // 获取颜色
  getActionIcon,       // 获取图标
  requiresApproval,    // 是否需要审批
} from '@/types/qualityDisposition';

const label = getActionLabel(DispositionAction.RELEASE);  // "直接放行"
const color = getActionColor(DispositionAction.RELEASE);  // "#00C853"
const icon = getActionIcon(DispositionAction.RELEASE);    // "check-circle"
const needsApproval = requiresApproval(DispositionAction.SCRAP); // true
```

---

## 常见场景

### 场景 1: 质检合格自动放行

```tsx
// 质检分数 >= 95%，系统推荐 RELEASE
<DispositionSuggestion
  batchId={123}
  inspectionId="INS-001"
  qualityScore={96}
  onDispositionComplete={(result) => {
    // result.status === "EXECUTED"
    // result.executedAction === "RELEASE"
    navigation.navigate('NextStep');
  }}
/>
```

### 场景 2: 质检不合格需返工

```tsx
// 质检分数 < 70%，系统推荐 REWORK
<DispositionSuggestion
  batchId={123}
  inspectionId="INS-002"
  qualityScore={65}
  onDispositionComplete={(result) => {
    // result.executedAction === "REWORK"
    Alert.alert('已安排返工', result.nextSteps);
  }}
/>
```

### 场景 3: 严重不合格需审批报废

```tsx
// 质检分数 < 50%，系统推荐 SCRAP (需厂长审批)
<DispositionSuggestion
  batchId={123}
  inspectionId="INS-003"
  qualityScore={45}
  onDispositionComplete={(result) => {
    if (result.approvalInitiated) {
      Alert.alert('已提交审批', `审批请求ID: ${result.approvalRequestId}`);
    }
  }}
/>
```

---

## API 调用示例

```typescript
import { qualityDispositionAPI } from '@/services/api/qualityDispositionApiClient';
import { useAuthStore } from '@/store/authStore';

const { user } = useAuthStore();

// 1. 评估处置建议
const evaluation = await qualityDispositionAPI.evaluateDisposition(
  user.factoryId,
  {
    inspectionId: 'INS-001',
    productionBatchId: 123,
    inspectorId: user.id,
    sampleSize: 100,
    passCount: 95,
    failCount: 5,
  }
);

// 2. 执行处置
const result = await qualityDispositionAPI.executeDisposition(
  user.factoryId,
  {
    batchId: 123,
    inspectionId: 'INS-001',
    actionCode: 'RELEASE',
    operatorComment: '质检合格',
    executorId: user.id,
  }
);

// 3. 查看历史
const history = await qualityDispositionAPI.getDispositionHistory(
  user.factoryId,
  123
);
```

---

## 错误处理

所有组件都内置了错误处理，你只需要关注业务逻辑：

```tsx
<DispositionSuggestion
  batchId={123}
  inspectionId="INS-001"
  qualityScore={95}
  onDispositionComplete={(result) => {
    // 处置成功，result 包含完整信息
    console.log(result);
  }}
  // 组件内部会自动处理:
  // - 网络错误 -> Alert 提示
  // - 加载状态 -> ActivityIndicator
  // - 空数据 -> 友好提示
/>
```

---

## 样式自定义

如需自定义样式，可以修改组件内的 StyleSheet：

```tsx
// DispositionSuggestion.tsx (示例)
const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 2,
    // 添加自定义样式
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  // ...
});
```

---

## 类型定义参考

完整的类型定义位于 `/src/types/qualityDisposition.ts`

```typescript
import type {
  DispositionAction,
  DispositionEvaluation,
  DispositionResult,
  DispositionHistory,
  InspectionSummary,
  AlternativeAction,
  DispositionStatus,
} from '@/types/qualityDisposition';
```

---

## 完整示例项目

查看 `README.md` 获取完整的集成示例和最佳实践。

---

## 需要帮助？

- 📖 完整文档: `/src/components/quality/README.md`
- 💻 类型定义: `/src/types/qualityDisposition.ts`
- 🔧 API 客户端: `/src/services/api/qualityDispositionApiClient.ts`

---

**版本**: v1.0.0
**更新时间**: 2025-12-31
