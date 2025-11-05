# 白垩纪食品溯源系统 - AI功能完整集成指南

**版本**: 1.0.0
**日期**: 2025-11-05
**状态**: ✅ 全部实施完成

---

## 📊 系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                   React Native Frontend                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIReportListScreen          (报告列表)              │  │
│  │  AIAnalysisDetailScreen      (报告详情)              │  │
│  │  BatchComparisonScreen       (批次对比)              │  │
│  │  AIConversationHistoryScreen (对话历史)              │  │
│  │  TimeRangeCostAnalysisScreen (时间范围分析+AI)       │  │
│  │  ProcessingDashboard         (AI快捷入口)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ HTTP/REST                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Spring Boot Backend (Port 10010)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIController (统一AI接口)                           │  │
│  │  - 成本分析: /ai/analysis/cost/*                     │  │
│  │  - 配额管理: /ai/quota                               │  │
│  │  - 对话管理: /ai/conversations/*                     │  │
│  │  - 报告管理: /ai/reports/*                           │  │
│  │  - 健康检查: /ai/health                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIEnterpriseService (企业级AI服务)                  │  │
│  │  - 配额管理、缓存、审计日志                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIAnalysisService (AI分析服务)                      │  │
│  │  - 调用Python AI服务                                 │  │
│  │  - 格式化成本数据                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ HTTP                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Python AI Service (Port 8085) - FastAPI              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  main.py - AI成本分析服务                            │  │
│  │  - POST /api/ai/chat (成本分析对话)                  │  │
│  │  - 会话管理、上下文保持                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ HTTPS                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           Hugging Face Inference API                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Model: meta-llama/Llama-3.1-8B-Instruct             │  │
│  │  Provider: Fireworks AI                              │  │
│  │  Endpoint: router.huggingface.co/v1/chat/completions │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 已实现功能清单

### ✅ Phase 1: 时间范围分析 + AI报告列表

#### 1.1 TimeRangeCostAnalysisScreen (增强版)
**文件**: `frontend/CretasFoodTrace/src/screens/processing/TimeRangeCostAnalysisScreen.tsx`

**功能**:
- ✅ 选择日期范围进行成本分析
- ✅ AI智能分析按钮
- ✅ AI配额显示和管理
- ✅ 快速问题追问 (3个预设问题)
- ✅ 自定义问题输入
- ✅ 会话ID显示和追踪
- ✅ 加载状态和错误处理

**API调用**:
```typescript
aiApiClient.analyzeTimeRangeCost({
  factoryId,
  userId: Number(userId),
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  dimension: 'overall',
  question: '可选的自定义问题',
})
```

#### 1.2 AIReportListScreen (新建)
**文件**: `frontend/CretasFoodTrace/src/screens/processing/AIReportListScreen.tsx`

**功能**:
- ✅ 展示所有历史AI报告
- ✅ 按类型筛选 (批次/周报/月报/自定义)
- ✅ 报告卡片显示 (标题、类型、时间、成本)
- ✅ 报告统计信息 (发现数、建议数)
- ✅ 下拉刷新
- ✅ 点击跳转到详情页

**API调用**:
```typescript
aiApiClient.getReports({
  reportType: 'batch', // 可选: batch, weekly, monthly
  startDate: '2024-01-01',
  endDate: '2024-12-31',
}, factoryId)
```

---

### ✅ Phase 2: 批次对比 + AI详情页

#### 2.1 BatchComparisonScreen (新建)
**文件**: `frontend/CretasFoodTrace/src/screens/processing/BatchComparisonScreen.tsx`

**功能**:
- ✅ 选择2-5个已完成批次
- ✅ 批次多选UI (Checkbox)
- ✅ 4种对比维度 (成本/效率/质量/综合)
- ✅ AI对比分析
- ✅ 快速追问
- ✅ 自定义问题
- ✅ 配额管理

**API调用**:
```typescript
aiApiClient.compareBatchCosts({
  batchIds: [1, 2, 3],
  dimension: 'comprehensive', // cost, efficiency, quality, comprehensive
  question: '可选问题',
}, factoryId)
```

#### 2.2 AIAnalysisDetailScreen (新建)
**文件**: `frontend/CretasFoodTrace/src/screens/processing/AIAnalysisDetailScreen.tsx`

**功能**:
- ✅ 展示完整AI报告内容
- ✅ 报告元数据 (类型、时间、会话ID)
- ✅ 性能信息 (缓存命中、响应时间)
- ✅ 分享报告功能
- ✅ 复制内容功能
- ✅ 配额进度条
- ✅ 错误信息展示

**API调用**:
```typescript
aiApiClient.getReportDetail(reportId, factoryId)
```

---

### ✅ Phase 3: 对话历史 + Dashboard优化

#### 3.1 AIConversationHistoryScreen (新建)
**文件**: `frontend/CretasFoodTrace/src/screens/processing/AIConversationHistoryScreen.tsx`

**功能**:
- ✅ 展示完整对话历史
- ✅ 消息气泡UI (用户/AI区分)
- ✅ 会话信息卡片
- ✅ 消息时间戳
- ✅ Token消耗显示
- ✅ 关闭会话功能
- ✅ 下拉刷新

**API调用**:
```typescript
// 获取对话历史
aiApiClient.getConversation(sessionId, factoryId)

// 关闭会话
aiApiClient.closeConversation(sessionId, factoryId)
```

#### 3.2 ProcessingDashboard (增强)
**文件**: `frontend/CretasFoodTrace/src/screens/processing/ProcessingDashboard.tsx`

**新增**:
- ✅ AI智能分析卡片
- ✅ 3个快捷入口按钮:
  - AI分析报告 (紫色)
  - 批次对比分析 (橙色)
  - 时间范围分析 (outlined)

---

## 🚀 快速启动指南

### 1️⃣ 启动Python AI服务 (Port 8085)

```bash
# 进入AI服务目录
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat

# 检查环境变量
cat .env
# 确保包含: HF_TOKEN=YOUR_HF_TOKEN_HERE

# 激活虚拟环境 (如果有)
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 启动服务
python main.py

# 验证服务
curl http://localhost:8085/
# 应返回: {"service":"食品加工数据分析 API","status":"running",...}
```

### 2️⃣ 启动Spring Boot后端 (Port 10010)

```bash
cd /Users/jietaoxie/Downloads/cretas-backend-system-main

# 检查配置
cat src/main/resources/application.yml | grep -A5 "ai:"
# 确保: url: http://localhost:8085

# 启动后端
mvn spring-boot:run
# 或使用已编译的JAR
java -jar target/cretas-backend-system-1.0.0.jar

# 验证AI配置
curl http://localhost:10010/api/mobile/F001/ai/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3️⃣ 启动React Native前端 (Port 3010)

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 启动Expo开发服务器
npm start

# 在手机或模拟器上打开应用
# 导航: 生产模块 → AI智能分析
```

---

## 📡 API接口文档

### 后端API端点 (Spring Boot)

**Base URL**: `http://localhost:10010/api/mobile/{factoryId}/ai`

#### 1. **成本分析接口**

##### 1.1 批次成本分析
```http
POST /api/mobile/F001/ai/analysis/cost/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "batchId": "1",
  "question": "可选: 自定义问题",
  "sessionId": "可选: 会话ID用于追问"
}
```

##### 1.2 时间范围分析
```http
POST /api/mobile/F001/ai/analysis/cost/time-range
Authorization: Bearer {token}
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "dimension": "overall",
  "question": "可选问题"
}
```

##### 1.3 批次对比分析
```http
POST /api/mobile/F001/ai/analysis/cost/compare
Authorization: Bearer {token}
Content-Type: application/json

{
  "batchIds": [1, 2, 3],
  "dimension": "comprehensive",
  "question": "可选问题"
}
```

#### 2. **配额管理接口**

##### 2.1 查询配额
```http
GET /api/mobile/F001/ai/quota
Authorization: Bearer {token}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "weeklyQuota": 100,
    "usedQuota": 35,
    "remainingQuota": 65,
    "resetDate": "2024-11-11",
    "usagePercentage": 35.0,
    "status": "active"
  }
}
```

##### 2.2 更新配额 (仅平台管理员)
```http
PUT /api/mobile/F001/ai/quota?newQuotaLimit=150
Authorization: Bearer {token}
```

#### 3. **对话管理接口**

##### 3.1 获取对话历史
```http
GET /api/mobile/F001/ai/conversations/{sessionId}
Authorization: Bearer {token}
```

##### 3.2 关闭对话
```http
DELETE /api/mobile/F001/ai/conversations/{sessionId}
Authorization: Bearer {token}
```

#### 4. **报告管理接口**

##### 4.1 获取报告列表
```http
GET /api/mobile/F001/ai/reports?reportType=batch&startDate=2024-01-01
Authorization: Bearer {token}
```

##### 4.2 获取报告详情
```http
GET /api/mobile/F001/ai/reports/{reportId}
Authorization: Bearer {token}
```

##### 4.3 生成新报告
```http
POST /api/mobile/F001/ai/reports/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "reportType": "batch",
  "batchId": 1
}
```

#### 5. **健康检查**

```http
GET /api/mobile/F001/ai/health
Authorization: Bearer {token}
```

---

## 🧪 测试指南

### 测试脚本

项目已包含完整测试脚本: `/Users/jietaoxie/my-prototype-logistics/test_ai_todo_apis.sh`

```bash
cd /Users/jietaoxie/my-prototype-logistics

# 执行AI功能测试
chmod +x test_ai_todo_apis.sh
./test_ai_todo_apis.sh
```

**测试覆盖**:
- ✅ 登录获取Token
- ✅ P0: 查询AI配额
- ✅ P1: 时间范围成本分析
- ✅ P1: 批次对比分析
- ✅ P0: 获取报告列表
- ✅ P2: 配额更新
- ✅ P2: 报告生成
- ✅ P0: 会话关闭

### 手动测试步骤

#### 1. 测试AI批次分析

```bash
# 1. 登录获取Token
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# 保存返回的token
TOKEN="返回的token"

# 2. 查询AI配额
curl -X GET "http://localhost:10010/api/mobile/F001/ai/quota" \
  -H "Authorization: Bearer $TOKEN"

# 3. 批次成本分析
curl -X POST "http://localhost:10010/api/mobile/F001/ai/analysis/cost/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "1",
    "question": "这个批次的成本如何优化?"
  }'
```

#### 2. 测试前端界面

1. **启动应用**: `npm start` in CretasFoodTrace
2. **登录**: 使用 admin/123456
3. **导航**: 生产模块 → AI智能分析
4. **测试流程**:
   - 点击"AI分析报告" → 查看报告列表
   - 点击"批次对比分析" → 选择批次 → AI分析
   - 点击"时间范围分析" → 选择日期 → AI分析
   - 查看对话历史
   - 查看报告详情

---

## 🔧 故障排查

### 问题1: Python AI服务启动失败

**症状**: `python main.py` 报错

**解决**:
```bash
# 检查HF_TOKEN
cat .env | grep HF_TOKEN

# 检查依赖
pip list | grep fastapi

# 重新安装依赖
pip install -r requirements.txt

# 检查端口占用
lsof -i :8085
```

### 问题2: 后端无法连接AI服务

**症状**: `AI服务暂时不可用，请稍后重试`

**解决**:
```bash
# 1. 检查Python AI服务是否运行
curl http://localhost:8085/

# 2. 检查Spring Boot配置
grep -A5 "ai:" src/main/resources/application.yml

# 3. 查看后端日志
tail -f logs/cretas-backend.log | grep AI

# 4. 测试连接
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"测试","user_id":"test"}'
```

### 问题3: 前端调用失败

**症状**: 前端显示"AI分析失败"

**解决**:
```bash
# 1. 检查后端服务
curl http://localhost:10010/api/mobile/F001/ai/health \
  -H "Authorization: Bearer $TOKEN"

# 2. 检查React Native日志
# 在Expo控制台查看错误信息

# 3. 检查网络配置
# 确保手机/模拟器可以访问localhost:10010

# 4. 查看API响应
# 使用Chrome DevTools Network tab
```

### 问题4: AI配额不足

**症状**: "本周AI分析次数已用完"

**解决**:
```bash
# 查询当前配额
curl http://localhost:10010/api/mobile/F001/ai/quota \
  -H "Authorization: Bearer $TOKEN"

# 平台管理员更新配额
curl -X PUT "http://localhost:10010/api/mobile/F001/ai/quota?newQuotaLimit=200" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 性能优化建议

### 1. AI响应时间优化

**当前**: 平均3-5秒
**目标**: <3秒

**优化措施**:
- ✅ 启用缓存 (5分钟)
- ✅ 减少Token消耗
- ✅ 数据预处理优化

### 2. 配额管理

**当前配置**:
- 默认周配额: 100次
- 重置周期: 每周一

**建议**:
- 工厂级别: 100-200次/周
- 平台管理员: 无限制
- 单次分析: 消耗1-3次配额

### 3. 成本控制

**Hugging Face API成本**:
- 免费额度: 有限
- 按Token计费
- 建议: 监控使用量

---

## 📝 开发者注意事项

### 前端开发

1. **API调用**: 所有AI API都在 `aiApiClient.ts`
2. **类型定义**: 在 `aiApiClient.ts` 中已定义完整类型
3. **错误处理**: 使用 Alert.alert 显示错误
4. **配额检查**: 每次调用前检查 `aiQuota.remaining`

### 后端开发

1. **Controller**: `AIController.java` - 所有AI端点
2. **Service**: `AIEnterpriseService.java` - 企业级功能
3. **Basic Service**: `AIAnalysisService.java` - 调用Python AI
4. **配置**: `application.yml` - AI服务URL

### Python AI服务

1. **主文件**: `main.py`
2. **端点**: `/api/ai/chat`
3. **模型**: Llama-3.1-8B-Instruct
4. **Provider**: Hugging Face + Fireworks AI

---

## 🎉 总结

### ✅ 已完成

1. **前端**: 4个新界面 + 2个增强界面
2. **后端**: 完整的AI Controller和Service
3. **Python AI**: Llama-3.1-8B集成
4. **API**: 15+个AI接口
5. **文档**: 完整使用指南

### 🚀 下一步

1. **数据准备**: 创建测试批次数据
2. **性能测试**: 压力测试AI接口
3. **用户培训**: 编写用户手册
4. **生产部署**: 部署到生产环境

---

**联系方式**: Cretas Team
**文档版本**: 1.0.0
**最后更新**: 2025-11-05
