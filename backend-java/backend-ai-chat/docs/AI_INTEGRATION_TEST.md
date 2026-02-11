# 白垩纪 AI 成本分析集成测试指南

## 📋 测试环境准备

### 1. 启动所有服务

**顺序很重要！**

#### Step 1: 启动 MySQL 数据库
```cmd
net start MySQL80
```

#### Step 2: 启动 AI 服务 (端口 8085)
```cmd
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat
venv\Scripts\activate
python main.py
```

**验证 AI 服务**:
```cmd
curl http://localhost:8085/
```

预期响应:
```json
{
  "service": "白垩纪 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0",
  "model": "Llama-3.1-8B-Instruct",
  "purpose": "水产加工成本优化分析",
  "redis_available": false
}
```

#### Step 3: 启动后端 API (端口 3001)
```cmd
cd backend
npm run dev
```

**验证后端 API**:
```cmd
curl http://localhost:3001/api/health
```

#### Step 4: 启动 React Native (端口 3010)
```cmd
cd frontend/CretasFoodTrace
npm start
```

---

## 🧪 完整测试流程

### 测试场景 1: 基本 AI 分析

**前置条件**:
- 已有成本数据的批次（例如: BATCH_20251003_00001）
- 用户已登录（processing_admin / DeptAdmin@123）

**步骤**:
1. 打开 React Native App
2. 登录系统
3. 进入"加工管理" → "批次管理"
4. 选择一个已完成的批次，查看成本分析
5. 点击"AI 智能分析"按钮
6. 等待 AI 分析结果（3-10秒）
7. 查看分析建议

**预期结果**:
- AI 分析按钮从 "AI 智能分析" 变为 "AI分析中..."
- 分析完成后显示 AI 面板
- 面板标题显示 "AI 分析建议" 和 ✨ 图标
- 内容包含具体的成本分析和优化建议

### 测试场景 2: 多轮对话（后续提问）

**前提**: 已完成测试场景 1

**步骤**:
1. 保持 AI 面板打开
2. 再次点击"AI 智能分析"按钮
3. AI 应基于之前的上下文继续分析

**预期结果**:
- AI 记住之前的对话
- 提供更深入的分析或补充建议
- session_id 保持不变

### 测试场景 3: 错误处理

#### 3.1 AI 服务未启动
**步骤**:
1. 停止 AI 服务 (Ctrl+C 关闭 backend-ai-chat/main.py)
2. 点击"AI 智能分析"按钮

**预期结果**:
- 显示错误提示: "AI服务暂时不可用，请稍后重试"
- 不影响其他功能正常使用

#### 3.2 网络超时
**步骤**:
1. 设置网络延迟模拟工具
2. 点击"AI 智能分析"

**预期结果**:
- 显示加载状态
- 超时后显示错误提示

---

## 🔍 后端 API 测试

### 直接测试 AI 分析端点

```bash
# 1. 登录获取 token
curl -X POST http://localhost:3001/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "processing_admin",
    "password": "DeptAdmin@123",
    "deviceInfo": {
      "deviceId": "TEST_DEVICE",
      "deviceModel": "Test",
      "platform": "test",
      "osVersion": "1.0"
    }
  }'

# 复制返回的 accessToken

# 2. 调用 AI 成本分析
curl -X POST http://localhost:3001/api/mobile/processing/ai-cost-analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -d '{
    "batchId": "BATCH_ID_HERE",
    "question": "这个批次的人工成本占比是否合理？"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "analysis": "根据提供的成本数据分析...",
    "session_id": "session_xxxxx",
    "message_count": 2
  },
  "timestamp": "2025-01-03T10:30:00.000Z"
}
```

---

## 🐛 常见问题排查

### 问题 1: AI 服务启动失败
**错误**: `ModuleNotFoundError: No module named 'fastapi'`
**解决**:
```cmd
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat
pip install -r requirements.txt
```

### 问题 2: HF_TOKEN 未配置
**错误**: `Hugging Face API调用失败: 401 Unauthorized`
**解决**:
```cmd
# 检查 .env 文件
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat
cat .env

# 确保 HF_TOKEN 已配置
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 问题 3: 后端无法连接 AI 服务
**错误**: `AI分析服务暂时不可用，请稍后重试`
**检查**:
```cmd
# 1. 检查 AI 服务是否运行
curl http://localhost:8085/

# 2. 检查后端环境变量
# backend/.env 中添加:
AI_SERVICE_URL=http://localhost:8085
```

### 问题 4: React Native 无法调用后端
**检查**:
```cmd
# 1. 检查后端是否运行
curl http://localhost:3001/api/health

# 2. 检查 React Native 网络配置
# 确保 apiClient 配置正确:
# baseURL: 'http://localhost:3001' (开发环境)
```

---

## ✅ 验证清单

- [ ] AI 服务 (8085) 正常运行
- [ ] 后端 API (3001) 正常运行
- [ ] React Native (3010) 正常运行
- [ ] AI 分析按钮可点击
- [ ] AI 分析结果正常显示
- [ ] 多轮对话功能正常
- [ ] 错误处理正确
- [ ] 性能可接受（分析时间 < 10s）

---

## 📊 性能指标

- **AI 分析响应时间**: 目标 < 10s
- **AI 服务启动时间**: < 5s
- **内存占用**: AI 服务 < 500MB
- **并发支持**: 5-10 个同时请求

---

## 🎯 下一步优化

1. **缓存机制**: 相似问题使用缓存结果
2. **流式响应**: 支持 SSE 实时显示分析结果
3. **自定义问题**: 允许用户输入具体问题
4. **历史记录**: 保存 AI 分析历史
5. **导出功能**: 导出 AI 分析报告
