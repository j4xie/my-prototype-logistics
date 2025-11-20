# 白垩纪食品溯源系统 - AI成本分析服务

基于 **Hugging Face Llama-3.1-8B-Instruct** 模型的智能成本分析AI助手，专为水产加工企业成本优化设计。

---

## 🎯 功能定位

### 核心功能
1. **成本分析建议** - 分析原材料、人工、设备成本合理性
2. **生产效率优化** - 分析员工效率和人员配置
3. **设备使用优化** - 分析设备利用率和维护时机
4. **利润分析** - 评估批次盈利能力和定价策略

### 应用场景
- ✅ 批次成本异常检测
- ✅ 人工成本优化建议
- ✅ 设备使用效率分析
- ✅ 利润率提升建议
- ✅ 成本趋势预测

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 检查.env文件是否存在
cat .env

# 确保包含以下配置：
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 必须配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

**获取Hugging Face Token**:
1. 访问 https://huggingface.co/settings/tokens
2. 创建新Token（需要read权限）
3. 复制到.env文件

### 3. 启动AI服务

```bash
# 方式1: 直接启动
python main.py

# 方式2: 使用uvicorn（生产环境）
uvicorn main:app --host 0.0.0.0 --port 8085 --reload
```

服务启动后：
- **API文档**: http://localhost:8085/docs
- **健康检查**: http://localhost:8085/
- **AI对话**: POST http://localhost:8085/api/ai/chat

---

## 📡 API接口说明

### 1. **AI成本分析对话** `POST /api/ai/chat`

#### 请求示例
```json
{
  "message": "这个批次的人工成本占比45%，设备成本20%，原材料35%。请分析是否合理？",
  "session_id": "可选-会话ID",
  "user_id": "可选-用户ID或批次ID"
}
```

#### 响应示例
```json
{
  "reply": "根据您提供的成本结构分析：\n\n1. **人工成本45%** - 偏高。水产加工行业标准人工成本通常在30-35%。建议：\n   - 检查员工工作效率（CCR成本率）\n   - 优化排班，避免闲置时间\n   - 考虑自动化设备投入\n\n2. **设备成本20%** - 合理范围（15-25%）\n\n3. **原材料35%** - 偏低，可能存在：\n   - 原材料质量问题\n   - 加工损耗较大\n   - 采购价格偏高\n\n**改进建议**：\n- 重点优化人工成本，目标降至35%以下\n- 分析原材料损耗率，正常应≤5%\n- 盈亏平衡分析建议...",
  "session_id": "abc123...",
  "message_count": 3
}
```

### 2. **典型对话场景**

#### 场景1: 成本结构分析
```bash
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "批次BATCH_20251003_00001：原材料500kg，成本2000元；人工8人工作6小时，成本1200元；设备使用4小时，成本400元。请分析。",
    "user_id": "factory_001"
  }'
```

#### 场景2: 效率优化建议
```bash
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "员工张三工作8小时，加工了150kg鱼类，CCR成本率是2.5元/分钟。效率如何？",
    "session_id": "上次返回的session_id",
    "user_id": "factory_001"
  }'
```

#### 场景3: 设备利用率分析
```bash
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "切割机使用了10小时，但只加工了200kg，小时成本50元。是否需要优化？",
    "session_id": "上次返回的session_id",
    "user_id": "factory_001"
  }'
```

### 3. **获取会话历史** `GET /api/ai/session/{session_id}`

```bash
curl http://localhost:8085/api/ai/session/abc123?user_id=factory_001
```

### 4. **重置会话** `POST /api/ai/reset`

```bash
curl -X POST http://localhost:8085/api/ai/reset \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc123",
    "user_id": "factory_001"
  }'
```

---

## 🏗️ 架构集成

```
React Native移动端
    ↓
海牛后端API (Node.js)
    ↓
AI成本分析服务 (FastAPI)
    ↓
Hugging Face Llama-3.1-8B
```

### 集成流程

1. **前端调用后端API**
   ```typescript
   // React Native
   const response = await fetch('http://localhost:3001/api/mobile/ai/analyze', {
     method: 'POST',
     body: JSON.stringify({
       batchId: 'BATCH_20251003_00001',
       costData: { /* 成本数据 */ }
     })
   });
   ```

2. **后端转发到AI服务**
   ```javascript
   // Node.js backend
   const aiResponse = await fetch('http://localhost:8085/api/ai/chat', {
     method: 'POST',
     body: JSON.stringify({
       message: `批次${batchId}成本数据：${JSON.stringify(costData)}，请分析`,
       user_id: factoryId
     })
   });
   ```

3. **AI返回分析建议**
   ```json
   {
     "reply": "成本分析：...",
     "session_id": "...",
     "message_count": 1
   }
   ```

---

## 🔧 配置优化

### 模型参数调整

编辑 `main.py` 第154-158行：

```python
payload = {
    "model": "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai",
    "max_tokens": 1000,      # 回复长度（建议800-1200）
    "temperature": 0.7,      # 随机性
    # 0.3 = 更保守、一致性高（适合成本分析）
    # 0.7 = 平衡（当前设置）
    # 1.0 = 更有创意
}
```

### 系统提示词优化

系统提示词位于 `main.py` 第220-257行，可根据需要调整：
- 成本标准范围
- 分析重点
- 回复格式
- 专业术语

---

## 📊 系统提示词

当前AI助手的系统提示：

```
你是白垩纪食品溯源系统的AI成本分析助手，专门帮助水产加工企业进行成本优化和分析。

主要任务：
1. 成本分析建议（原材料、人工、设备）
2. 生产效率优化（CCR成本率、员工配置）
3. 设备使用优化（利用率、维护时机）
4. 利润分析（盈利能力、定价策略）

回复要求：
- 简洁专业
- 具体数字和百分比
- 可操作的改进建议
- 数据不足时说明需求
- 始终用中文
```

---

## 🧪 测试案例

### 测试脚本

```bash
# 1. 测试服务健康
curl http://localhost:8085/

# 2. 测试基础对话
python test_chat.py

# 3. 测试成本分析
python test_api.py
```

### 预期输出

```bash
✅ Redis连接成功
INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8085

# 访问 http://localhost:8085/
{
  "service": "海牛 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0",
  "model": "Llama-3.1-8B-Instruct",
  "purpose": "水产加工成本优化分析",
  "redis_available": true
}
```

---

## 🚨 常见问题

### Q1: 如何提高分析准确性？

**A**: 在提问时提供更多上下文数据：
```json
{
  "message": "批次BATCH001：\n- 原材料：大黄鱼500kg，成本2000元（4元/kg）\n- 人工：8人×6小时，总成本1200元\n- 设备：切割机4小时，成本400元\n- 产品：鲜品，预期售价12元/kg\n请分析成本结构和利润空间",
  "user_id": "factory_001"
}
```

### Q2: 如何保持对话上下文？

**A**: 使用同一个 `session_id`：
```bash
# 第一次对话
response1=$(curl -X POST http://localhost:8085/api/ai/chat -d '{"message":"..."}')
SESSION_ID=$(echo $response1 | jq -r '.session_id')

# 继续对话
curl -X POST http://localhost:8085/api/ai/chat \
  -d "{\"message\":\"基于上述分析，如何降低人工成本？\",\"session_id\":\"$SESSION_ID\"}"
```

### Q3: Redis连接失败怎么办？

**A**:
- 服务会自动切换到内存模式
- 重启服务会丢失会话历史
- 建议安装Redis：`docker run -d -p 6379:6379 redis:alpine`

### Q4: AI回复太长或太短？

**A**: 调整 `max_tokens` 参数（main.py 第156行）：
```python
"max_tokens": 800,  # 减少到800获得更简洁回复
"max_tokens": 1500, # 增加到1500获得更详细分析
```

---

## 🔐 安全建议

1. **生产环境必须**：
   - 移除CORS的 `"*"` 配置
   - 添加API认证（JWT Token）
   - 启用HTTPS
   - 限制请求速率

2. **数据隐私**：
   - 不要在提示中包含敏感信息（员工姓名、工资等）
   - 使用匿名化数据（如"员工A"、"批次001"）

3. **成本控制**：
   - Hugging Face API按Token计费
   - 建议设置月度预算上限
   - 缓存常见问题的回答

---

## 📈 性能优化

### 1. 缓存常见问题

```python
# 添加简单缓存
COMMON_QA = {
    "人工成本占比多少合理": "水产加工行业标准人工成本通常在30-35%...",
    "如何降低设备成本": "设备成本优化建议：1. 提高设备利用率...",
}

# 在chat端点中检查
if request.message in COMMON_QA:
    return ChatResponse(
        reply=COMMON_QA[request.message],
        session_id=session_id,
        message_count=len(history)
    )
```

### 2. 限制会话长度

```python
# 保留最近10轮对话
if len(history) > 20:  # 10轮 × 2（用户+AI）
    history = history[:1] + history[-19:]  # 保留系统提示 + 最近19条
```

---

## 🛠️ 下一步计划

- [ ] 添加流式返回（实时显示分析过程）
- [ ] 集成到海牛后端API
- [ ] 添加成本异常自动检测
- [ ] 支持批量批次分析
- [ ] 添加历史对比功能
- [ ] 成本预测模型

---

## 📞 技术支持

**项目文档**: [CLAUDE.md](../CLAUDE.md)
**后端集成**: 将在 Phase 3 完成
**原始README**: [README.md](README.md)

---

**版本**: 1.0.0 (海牛定制版)
**最后更新**: 2025-10-03
**状态**: ✅ 可用于Phase 2 MVP测试
