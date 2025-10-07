# AI成本分析集成 - 文件清单

**创建日期**: 2025-10-06  
**总计**: 14个文件修改/创建 + 4个测试文档

---

## ✅ 后端文件（8个）

### 1. 数据库
- [x] `backend/prisma/schema.prisma` - 模型扩展
  - Line 59-60: Factory添加aiWeeklyQuota和aiUsageLogs
  - Line 282: FactorySettings添加aiSettings
  - Line 157: User添加aiUsageLogs
  - Line 1361-1381: 新建AIUsageLog模型

### 2. 中间件
- [x] `backend/src/middleware/aiRateLimit.js` - 新建，120行
  - getCurrentWeek() - 计算ISO周数
  - aiRateLimitMiddleware - 限流中间件
  - logAIUsage() - 记录日志

### 3. API路由
- [x] `backend/src/routes/platform.js` - 修改，添加3个端点
  - Line 419-448: GET /api/platform/ai-quota
  - Line 450-480: PUT /api/platform/ai-quota/:factoryId
  - Line 482-541: GET /api/platform/ai-usage-stats

- [x] `backend/src/routes/factorySettings.js` - 新建，200行
  - GET /api/mobile/factory-settings/ai
  - PUT /api/mobile/factory-settings/ai
  - GET /api/mobile/factory-settings/ai/usage-stats
  - requireSuperAdmin中间件

- [x] `backend/src/routes/mobile.js` - 修改
  - Line 19: import factorySettingsRoutes
  - Line 716: 注册factorySettings路由

- [x] `backend/src/routes/processing.js` - 修改
  - Line 3: import aiRateLimitMiddleware
  - Line 98: AI分析路由添加限流中间件

### 4. 控制器
- [x] `backend/src/controllers/processingController.js` - 修改
  - Line 1649-1740: getAICostAnalysis函数增强
  - Line 1824-1926: formatCostDataForAI支持AI设置

### 5. 配置
- [x] `backend/.env` - 修改
  - Line 21-22: AI_SERVICE_URL=http://localhost:8085

---

## ✅ 前端文件（6个）

### 1. 类型定义
- [x] `frontend/src/types/processing.ts` - 新建，200行
  - BatchCostAnalysis接口
  - AISettings接口
  - AIQuota接口
  - AIUsageStats接口
  - PlatformAIUsageStats接口
  - FactoryAIQuota接口
  - AI_TONE_OPTIONS常量
  - AI_GOAL_OPTIONS常量
  - AI_DETAIL_OPTIONS常量

### 2. API客户端
- [x] `frontend/src/services/api/platformApiClient.ts` - 已存在（之前创建）
  - getFactoryAIQuotas()
  - updateFactoryAIQuota()
  - getPlatformAIUsageStats()

- [x] `frontend/src/services/api/factorySettingsApiClient.ts` - 新建，50行
  - getAISettings()
  - updateAISettings()
  - getAIUsageStats()

- [x] `frontend/src/services/api/processingApiClient.ts` - 修改
  - Line 103-113: getBatchCostAnalysis()
  - Line 115-141: aiCostAnalysis()

### 3. UI界面
- [x] `frontend/src/screens/processing/CostAnalysisDashboard.tsx` - 完全重写，724行
  - 成本数据展示
  - AI智能分析区域
  - 配额显示
  - 快速提问
  - 自定义问题
  - 完整交互逻辑

- [x] `frontend/src/screens/management/AISettingsScreen.tsx` - 新建，400行
  - 配额显示（只读）
  - AI设置表单
  - 使用统计
  - 保存功能

- [x] `frontend/src/screens/platform/AIQuotaManagementScreen.tsx` - 新建，350行
  - 平台概览
  - 工厂列表
  - 在线编辑
  - 配额建议

### 4. 导航配置
- [x] `frontend/src/navigation/ManagementStackNavigator.tsx` - 修改
  - Line 9: import AISettingsScreen
  - Line 16: 添加AISettings路由类型
  - Line 52-56: 添加AISettings Stack.Screen

- [x] `frontend/src/screens/management/ManagementScreen.tsx` - 修改
  - Line 95-109: 添加"高级功能"分组
  - 包含"AI分析设置"入口

- [x] `frontend/src/screens/management/index.ts` - 修改
  - Line 5: export AISettingsScreen

- [x] `frontend/src/screens/platform/index.ts` - 新建
  - export AIQuotaManagementScreen

- [x] `frontend/src/screens/processing/BatchDetailScreen.tsx` - 修改
  - Line 196: 修复成本分析跳转（添加batchId参数）

---

## 📚 文档文件（4个）

### 测试文档
- [x] `/tmp/AI_TESTING_GUIDE.md` - 完整测试指南，500+行
  - 7个测试套件
  - 50+测试用例
  - curl命令示例
  - 问题排查指南

- [x] `AI_QUICK_TEST_CHECKLIST.md` - 快速测试清单，200行
  - 10步核心测试
  - 一键测试脚本
  - 15分钟快速验证

- [x] `NAVIGATION_VERIFICATION_CHECKLIST.md` - 导航验证，400行
  - 完整导航路径图
  - 30+按钮清单
  - 交互验证矩阵
  - 端到端测试流程

### 总结文档
- [x] `AI_INTEGRATION_FINAL_SUMMARY.md` - 最终总结，350行
  - 完整功能清单
  - API端点总览
  - 成本分析
  - 测试指南
  - 验收标准

---

## 🔍 快速定位指南

### 需要修改某功能时，查找对应文件：

#### AI分析核心逻辑
- 后端: `backend/src/controllers/processingController.js:1649-1926`
- 前端: `frontend/src/screens/processing/CostAnalysisDashboard.tsx`

#### 配额限流逻辑
- 中间件: `backend/src/middleware/aiRateLimit.js`
- 路由: `backend/src/routes/processing.js:98`

#### AI设置管理
- API: `backend/src/routes/factorySettings.js`
- UI: `frontend/src/screens/management/AISettingsScreen.tsx`

#### 平台配额管理
- API: `backend/src/routes/platform.js:419-541`
- UI: `frontend/src/screens/platform/AIQuotaManagementScreen.tsx`

#### 类型定义
- 所有类型: `frontend/src/types/processing.ts`

#### API客户端
- 平台: `frontend/src/services/api/platformApiClient.ts`
- 工厂: `frontend/src/services/api/factorySettingsApiClient.ts`
- 生产: `frontend/src/services/api/processingApiClient.ts:103-141`

---

## 🧩 依赖关系图

```
CostAnalysisDashboard
    ↓ 调用
processingAPI.getBatchCostAnalysis()
    ↓ 请求
GET /api/mobile/processing/batches/:batchId/cost-analysis
    ↓ 执行
processingController.getBatchCostAnalysis()
    ↓ 返回
成本数据展示

[点击"获取AI优化建议"]
    ↓ 调用
processingAPI.aiCostAnalysis()
    ↓ 请求（经过限流）
aiRateLimitMiddleware → POST /api/mobile/processing/ai-cost-analysis
    ↓ 检查配额
Factory.aiWeeklyQuota + AIUsageLog统计
    ↓ 如果通过
processingController.getAICostAnalysis()
    ↓ 加载设置
FactorySettings.aiSettings
    ↓ 格式化Prompt
formatCostDataForAI(data, question, aiSettings)
    ↓ 调用AI
fetch(http://localhost:8085/api/ai/chat)
    ↓ 记录日志
logAIUsage() → AIUsageLog表
    ↓ 返回
AI分析结果 + 配额信息
```

---

## 📋 Git提交建议

```bash
# 创建feature分支
git checkout -b feature/ai-cost-analysis-integration

# 分批提交

# 提交1: 数据库模型
git add backend/prisma/schema.prisma
git commit -m "feat(db): 添加AI配额和使用日志模型

- Factory添加aiWeeklyQuota字段
- FactorySettings添加aiSettings字段
- 创建AIUsageLog模型（按周统计）
- 支持平台级配额管理和工厂级AI设置"

# 提交2: 后端中间件和API
git add backend/src/middleware/aiRateLimit.js
git add backend/src/routes/platform.js
git add backend/src/routes/factorySettings.js
git add backend/src/routes/mobile.js
git add backend/src/routes/processing.js
git add backend/src/controllers/processingController.js
git add backend/.env
git commit -m "feat(backend): 实现AI成本分析API和限流机制

- 创建aiRateLimit中间件（按周限流）
- 平台管理员API（配额管理）
- 工厂管理员API（AI设置管理）
- Processing API增强（支持AI设置）
- 动态Prompt生成（语气/目标/详细度）"

# 提交3: 前端类型和API客户端
git add frontend/CretasFoodTrace/src/types/processing.ts
git add frontend/CretasFoodTrace/src/services/api/
git commit -m "feat(frontend): 添加AI成本分析类型定义和API客户端

- 完整的TypeScript类型定义
- 平台API客户端（配额管理）
- 工厂API客户端（AI设置）
- Processing API扩展（AI分析）"

# 提交4: 前端UI界面
git add frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard.tsx
git add frontend/CretasFoodTrace/src/screens/management/AISettingsScreen.tsx
git add frontend/CretasFoodTrace/src/screens/platform/AIQuotaManagementScreen.tsx
git commit -m "feat(frontend): 实现AI成本分析完整UI

- CostAnalysisDashboard（成本展示+AI分析）
- AISettingsScreen（工厂AI设置管理）
- AIQuotaManagementScreen（平台配额管理）
- 支持按需AI调用、配额显示、多轮对话"

# 提交5: 导航配置
git add frontend/CretasFoodTrace/src/navigation/
git add frontend/CretasFoodTrace/src/screens/management/ManagementScreen.tsx
git add frontend/CretasFoodTrace/src/screens/management/index.ts
git add frontend/CretasFoodTrace/src/screens/platform/index.ts
git add frontend/CretasFoodTrace/src/screens/processing/BatchDetailScreen.tsx
git commit -m "feat(frontend): 配置AI功能导航和入口

- ManagementScreen添加AI设置入口
- ManagementStackNavigator添加AISettings路由
- BatchDetailScreen修复成本分析跳转
- 创建platform screens导出"

# 提交6: 测试文档
git add AI_*.md NAVIGATION_*.md
git commit -m "docs: 添加AI成本分析测试指南

- 完整测试指南（50+用例）
- 快速测试清单（15分钟）
- 导航验证清单（30+按钮）
- 最终实施总结"
```

---

## 🎯 代码审查要点

### 后端代码
- [x] 限流中间件正确计算weekNumber
- [x] 配额检查在AI调用前执行
- [x] 使用日志异步记录（不阻塞响应）
- [x] AI设置正确传递给Prompt生成
- [x] 错误处理完整（429, 403, 500等）
- [x] 权限检查正确（requireSuperAdmin）

### 前端代码
- [x] 类型定义完整且准确
- [x] API调用有错误处理
- [x] 配额为0时按钮正确禁用
- [x] 加载状态正确显示
- [x] 多轮对话session_id正确传递
- [x] 样式使用Material Design 3规范

---

## 📞 支持和帮助

### 如果遇到问题

1. **数据库问题**: 查看`AI_TESTING_GUIDE.md`的"问题3: 数据库迁移失败"
2. **AI服务问题**: 查看`AI_TESTING_GUIDE.md`的"问题1-2"
3. **导航问题**: 查看`NAVIGATION_VERIFICATION_CHECKLIST.md`
4. **API问题**: 使用curl测试（见`AI_TESTING_GUIDE.md`测试套件3）

### 快速调试命令

```bash
# 查看后端日志
cd backend && npm run dev
# 观察console输出

# 查看AI服务日志
cd backend-ai-chat
source venv/bin/activate
python main.py
# 观察请求日志

# 查看数据库数据
npx prisma studio
# 检查ai_usage_logs表

# 查看React Native日志
# 在模拟器中按 Cmd+D（iOS）或 Cmd+M（Android）
# 选择"Toggle Element Inspector"查看组件树
```

---

**所有文件已完成！现在可以开始测试了！🚀**
