# AI成本分析服务 - 集成指南

## 📋 集成概述

本指南说明如何将AI成本分析服务集成到白垩纪食品溯源系统的Phase 2成本核算模块中。

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│  React Native 移动端 (frontend/CretasFoodTrace)            │
│                                                              │
│  └─ CostAnalysisDashboard.tsx                               │
│     └─ "AI分析建议" 按钮                                     │
│        └─ 调用后端API                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Node.js 后端API (backend/)                                 │
│                                                              │
│  POST /api/mobile/processing/ai-cost-analysis               │
│  └─ 接收成本数据                                             │
│  └─ 格式化为AI提示                                           │
│  └─ 调用AI服务                                               │
│  └─ 返回分析建议                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  FastAPI AI服务 (cretas-backend-system-main/backend-ai-chat/)                          │
│                                                              │
│  POST /api/ai/chat                                          │
│  └─ Llama-3.1-8B-Instruct                                   │
│  └─ 成本分析专用Prompt                                       │
│  └─ 返回优化建议                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 步骤1: 启动AI服务

### 1.1 确保环境配置

```bash
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat

# 检查.env文件
cat .env

# 确保包含：
# HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# REDIS_HOST=localhost
# REDIS_PORT=6379
```

### 1.2 启动AI服务

```bash
# 激活虚拟环境
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# 启动服务（端口8085）
python main.py
```

### 1.3 验证服务

```bash
# 健康检查
curl http://localhost:8085/

# 应返回：
{
  "service": "白垩纪 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0",
  "model": "Llama-3.1-8B-Instruct",
  "purpose": "水产加工成本优化分析",
  "redis_available": true
}
```

---

## 🔌 步骤2: 后端API集成

### 2.1 创建AI成本分析端点

在 `backend/src/routes/processing.js` 中添加：

```javascript
import fetch from 'node-fetch';

const AI_SERVICE_URL = 'http://localhost:8085';

/**
 * AI成本分析
 * POST /api/mobile/processing/ai-cost-analysis
 */
router.post(
  '/ai-cost-analysis',
  mobileAuthMiddleware,
  checkPermission(['processing:cost_analysis']),
  async (req, res) => {
    try {
      const { batchId, costData, question } = req.body;

      // 1. 格式化成本数据为AI提示
      const prompt = formatCostDataForAI(costData, question);

      // 2. 调用AI服务
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          session_id: req.body.session_id,
          user_id: `factory_${req.user.factoryId}_batch_${batchId}`
        })
      });

      const aiResult = await aiResponse.json();

      // 3. 返回AI建议
      res.json({
        success: true,
        data: {
          analysis: aiResult.reply,
          session_id: aiResult.session_id,
          message_count: aiResult.message_count
        }
      });

    } catch (error) {
      console.error('AI分析失败:', error);
      res.status(500).json({
        success: false,
        message: 'AI分析服务暂时不可用'
      });
    }
  }
);

/**
 * 格式化成本数据为AI提示
 */
function formatCostDataForAI(costData, userQuestion = null) {
  const { batch, laborStats, equipmentStats, costBreakdown, profitAnalysis } = costData;

  let prompt = `请分析以下批次的成本数据：

**批次信息**：
- 批次号: ${batch.batchNumber}
- 原材料: ${batch.rawMaterialCategory} ${batch.rawMaterialWeight}kg
- 原材料成本: ¥${batch.rawMaterialCost.toFixed(2)} (${(batch.rawMaterialCost / batch.rawMaterialWeight).toFixed(2)}元/kg)
- 产品类别: ${batch.productCategory === 'fresh' ? '鲜品' : '冻品'}
${batch.expectedPrice ? `- 预期售价: ¥${batch.expectedPrice}/kg` : ''}

**成本结构**：
- 原材料成本: ¥${costBreakdown.rawMaterialCost.toFixed(2)} (${costBreakdown.rawMaterialPercentage})
- 人工成本: ¥${costBreakdown.laborCost.toFixed(2)} (${costBreakdown.laborPercentage})
- 设备成本: ¥${costBreakdown.equipmentCost.toFixed(2)} (${costBreakdown.equipmentPercentage})
- 其他成本: ¥${costBreakdown.otherCosts.toFixed(2)} (${costBreakdown.otherCostsPercentage})
- **总成本**: ¥${costBreakdown.totalCost.toFixed(2)}

**人工统计**：
- 参与员工: ${laborStats.totalEmployees}人
- 总工时: ${Math.floor(laborStats.totalMinutes / 60)}小时${laborStats.totalMinutes % 60}分钟
- 人工成本: ¥${laborStats.totalCost.toFixed(2)}`;

  if (laborStats.sessions && laborStats.sessions.length > 0) {
    prompt += `\n- 员工明细: ${laborStats.sessions.map(s =>
      `${s.user.fullName}(${Math.floor(s.totalMinutes / 60)}h, ¥${s.laborCost.toFixed(2)})`
    ).join(', ')}`;
  }

  prompt += `

**设备统计**：
- 使用设备: ${equipmentStats.totalEquipment}台
- 总使用时长: ${Math.floor(equipmentStats.totalMinutes / 60)}小时${equipmentStats.totalMinutes % 60}分钟
- 设备成本: ¥${equipmentStats.totalCost.toFixed(2)}`;

  if (equipmentStats.usages && equipmentStats.usages.length > 0) {
    prompt += `\n- 设备明细: ${equipmentStats.usages.map(u =>
      `${u.equipment.equipmentName}(${Math.floor(u.totalMinutes / 60)}h, ¥${u.equipmentCost.toFixed(2)})`
    ).join(', ')}`;
  }

  if (profitAnalysis && profitAnalysis.expectedRevenue) {
    prompt += `

**利润分析**：
- 预期收入: ¥${profitAnalysis.expectedRevenue.toFixed(2)}
- 利润: ¥${profitAnalysis.profitMargin.toFixed(2)} (${profitAnalysis.profitMarginPercentage})
- 盈亏平衡价: ¥${profitAnalysis.breakEvenPrice.toFixed(2)}/kg`;
  }

  if (userQuestion) {
    prompt += `\n\n**用户问题**: ${userQuestion}`;
  } else {
    prompt += `\n\n请从以下角度分析：
1. 成本结构是否合理？各项成本占比是否正常？
2. 是否存在成本异常点？
3. 有哪些优化建议？
4. 如何提高利润率？`;
  }

  return prompt;
}
```

### 2.2 添加路由导出

在 `backend/src/routes/processing.js` 末尾确保导出：

```javascript
export default router;
```

---

## 📱 步骤3: React Native前端集成

### 3.1 扩展API客户端

在 `frontend/CretasFoodTrace/src/services/api/processingApiClient.ts` 中添加：

```typescript
/**
 * AI成本分析
 */
async aiCostAnalysis(data: {
  batchId: string;
  costData: CostAnalysis;
  question?: string;
  sessionId?: string;
}): Promise<ApiResponse<{
  analysis: string;
  session_id: string;
  message_count: number;
}>> {
  return await apiClient.post(`${this.BASE_PATH}/ai-cost-analysis`, data);
}
```

### 3.2 更新CostAnalysisDashboard

在 `frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard.tsx` 中添加AI分析功能：

```typescript
import { useState } from 'react';
import { BigButton } from '../../components/processing';
import { processingApiClient } from '../../services/api/processingApiClient';

export const CostAnalysisDashboard: React.FC<CostAnalysisDashboardProps> = ({ route, navigation }) => {
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiSessionId, setAiSessionId] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ... 现有代码

  /**
   * 获取AI分析建议
   */
  const handleAiAnalysis = async () => {
    if (!analysis) return;

    setIsAiLoading(true);
    try {
      const response = await processingApiClient.aiCostAnalysis({
        batchId: analysis.batch.id,
        costData: analysis,
        sessionId: aiSessionId
      });

      if (response.success) {
        setAiAnalysis(response.data.analysis);
        setAiSessionId(response.data.session_id);
      }
    } catch (error) {
      Alert.alert('错误', 'AI分析失败，请稍后重试');
    } finally {
      setIsAiLoading(false);
    }
  };

  /**
   * 自定义问题分析
   */
  const handleCustomQuestion = async (question: string) => {
    if (!analysis) return;

    setIsAiLoading(true);
    try {
      const response = await processingApiClient.aiCostAnalysis({
        batchId: analysis.batch.id,
        costData: analysis,
        question,
        sessionId: aiSessionId
      });

      if (response.success) {
        setAiAnalysis(response.data.analysis);
        setAiSessionId(response.data.session_id);
      }
    } catch (error) {
      Alert.alert('错误', 'AI分析失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ... 现有UI */}

      {/* AI分析区域 */}
      <View style={styles.aiSection}>
        <Text style={styles.sectionTitle}>🤖 AI智能分析</Text>

        <BigButton
          title={aiAnalysis ? "重新分析" : "获取AI优化建议"}
          icon="sparkles"
          variant="primary"
          size="large"
          onPress={handleAiAnalysis}
          loading={isAiLoading}
        />

        {aiAnalysis && (
          <View style={styles.aiResultCard}>
            <Text style={styles.aiResultText}>{aiAnalysis}</Text>

            {/* 快速提问 */}
            <View style={styles.quickQuestions}>
              <Text style={styles.quickQuestionsTitle}>快速提问：</Text>
              <TouchableOpacity
                style={styles.quickQuestionButton}
                onPress={() => handleCustomQuestion('如何降低人工成本？')}
              >
                <Text style={styles.quickQuestionText}>如何降低人工成本？</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickQuestionButton}
                onPress={() => handleCustomQuestion('设备利用率如何优化？')}
              >
                <Text style={styles.quickQuestionText}>设备利用率如何优化？</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ... 现有样式

  aiSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
  },
  aiResultCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  aiResultText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1F2937',
  },
  quickQuestions: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  quickQuestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  quickQuestionButton: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  quickQuestionText: {
    fontSize: 13,
    color: '#3B82F6',
  },
});
```

---

## 🧪 步骤4: 测试集成

### 4.1 测试AI服务

```bash
# 终端1: 启动AI服务
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat
python main.py

# 终端2: 测试AI服务
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "批次BATCH001: 原材料500kg成本2000元，人工8人6小时成本1200元，设备4小时成本400元。请分析。",
    "user_id": "test_factory_001"
  }'
```

### 4.2 测试后端API

```bash
# 终端3: 启动后端
cd backend
npm run dev

# 终端4: 测试后端AI接口
curl -X POST http://localhost:3001/api/mobile/processing/ai-cost-analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "batchId": "批次ID",
    "costData": { /* 成本分析数据 */ }
  }'
```

### 4.3 测试移动端

```bash
# 终端5: 启动React Native
cd frontend/CretasFoodTrace
npx expo start

# 在模拟器中：
# 1. 登录系统
# 2. 进入成本分析界面
# 3. 点击"获取AI优化建议"按钮
# 4. 查看AI分析结果
```

---

## 📊 预期效果

### AI分析示例

**输入**：
```
批次BATCH_20251003_00001:
- 原材料: 大黄鱼 500kg, 成本¥2000
- 人工: 8人×6小时, 成本¥1200
- 设备: 切割机4小时, 成本¥400
- 总成本: ¥3600
```

**输出**：
```
根据您提供的成本数据分析：

**成本结构分析**：
1. 原材料成本: ¥2000 (55.6%) - 合理范围
2. 人工成本: ¥1200 (33.3%) - 略高，建议优化
3. 设备成本: ¥400 (11.1%) - 正常

**存在的问题**：
- 人工成本占比33.3%，水产加工行业标准为25-30%
- 8人工作6小时处理500kg，人均效率约10.4kg/h，偏低

**优化建议**：
1. 人工优化：
   - 建议减少至6人或提高加工效率至15kg/h/人
   - 优化排班，避免空闲时间
   - 目标：降低人工成本至¥900（25%）

2. 设备优化：
   - 切割机4小时处理500kg，效率125kg/h，正常
   - 建议保持当前使用强度

3. 成本控制：
   - 当前总成本¥3600，成本¥7.2/kg
   - 优化后预计降至¥3300，成本¥6.6/kg
   - 预计利润提升8.3%
```

---

## 🔒 安全和性能

### 1. 错误处理

```javascript
// 后端API错误处理
try {
  const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, ...);

  if (!aiResponse.ok) {
    throw new Error(`AI服务返回错误: ${aiResponse.status}`);
  }

  const aiResult = await aiResponse.json();
  // ...
} catch (error) {
  console.error('AI分析失败:', error);

  // 返回降级响应
  res.json({
    success: true,
    data: {
      analysis: 'AI服务暂时不可用，请稍后重试。',
      session_id: null,
      message_count: 0
    }
  });
}
```

### 2. 超时处理

```javascript
// 设置超时（10秒）
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

try {
  const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(timeout);
  // ...
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('AI服务响应超时');
  }
}
```

### 3. 成本控制

```javascript
// 缓存常见分析结果（Redis）
const cacheKey = `ai_analysis:${batchId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return res.json({ success: true, data: JSON.parse(cached) });
}

// 调用AI服务
const aiResult = await callAiService(...);

// 缓存结果（30分钟）
await redis.setex(cacheKey, 1800, JSON.stringify(aiResult));
```

---

## 📈 监控和日志

### 记录AI调用

```javascript
// 记录每次AI调用
await prisma.aiAnalysisLog.create({
  data: {
    batchId,
    factoryId: req.user.factoryId,
    prompt: prompt.substring(0, 500), // 截取前500字符
    response: aiResult.reply.substring(0, 1000),
    tokenUsage: aiResult.message_count,
    responseTime: Date.now() - startTime,
    success: true
  }
});
```

---

## 🎯 下一步优化

- [ ] 添加流式返回（实时显示分析过程）
- [ ] 批量批次对比分析
- [ ] 历史趋势分析
- [ ] 成本预测功能
- [ ] 自定义分析规则

---

**集成完成后，用户可以在成本分析界面点击"AI分析"按钮，获得智能化的成本优化建议！**
