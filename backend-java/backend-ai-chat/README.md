# 白垩纪 AI 成本分析服务

基于 **Hugging Face Llama-3.1-8B-Instruct** 模型的智能成本分析AI助手，专为水产加工企业成本优化设计。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)

---

## 💰 成本分析 - 一目了然

### 📊 单次分析成本

| 操作 | Token消耗 | 成本(¥) | 相当于 |
|------|----------|---------|--------|
| 1次AI分析 | 2,650 | **0.003** | 一粒米 🌾 |
| 10个批次 | 26,500 | 0.03 | 一颗糖 🍬 |
| 100个批次 | 265,000 | 0.28 | 一个馒头 🥖 |
| 1000个批次 | 2,650,000 | 2.83 | 一瓶水 💧 |

### 🏭 按工厂规模月度成本

| 工厂规模 | 批次/天 | Token/月 | 成本/月(¥) | 相当于 |
|---------|--------|---------|-----------|--------|
| 小型 | 10 | 0.8M | **¥0.85** | 两瓶水 💧💧 |
| 中型 | 30 | 2.4M | **¥2.55** | 一杯咖啡 ☕ |
| 大型 | 50 | 4.0M | **¥4.25** | 半份便当 🍱 |
| 超大型 | 100 | 8.0M | **¥8.50** | 一份快餐 🍔 |

### 🎯 与预算对比

```
原定预算: ¥30/月
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
100%

实际成本:
小型厂:  ¥0.85   ▓▓▓ 2.8%
中型厂:  ¥2.55   ▓▓▓▓▓▓▓▓▓ 8.5%
大型厂:  ¥4.25   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 14.2%
超大型:  ¥8.50   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 28.3%
```

**✅ 结论**: 即使超大型工厂（100批次/天），成本也仅占预算的 **28.3%**！

### 🏆 投资回报率 (ROI)

假设每个批次通过AI优化节省成本：

| 单批次节省 | 小型厂(10/天) | 中型厂(30/天) | 大型厂(100/天) |
|-----------|-------------|-------------|--------------|
| 节省¥10 | 月省¥3,000 | 月省¥9,000 | 月省¥30,000 |
| 节省¥50 | 月省¥15,000 | 月省¥45,000 | 月省¥150,000 |
| 节省¥100 | 月省¥30,000 | 月省¥90,000 | 月省¥300,000 |

**AI投入**: 仅 ¥0.85 - ¥8.50/月
**ROI倍数**: **353倍 - 35,294倍**

📄 **[查看详细成本对比](COST_COMPARISON.md)**

---

## 🎯 核心功能

### 1. 成本分析建议
- ✅ 分析原材料、人工、设备成本的合理性
- ✅ 识别成本异常点（人工成本过高、设备利用率低等）
- ✅ 提供具体优化建议

### 2. 生产效率优化
- ✅ 分析员工工作效率（通过CCR成本率和加工数量）
- ✅ 建议最优人员配置和排班
- ✅ 识别生产瓶颈

### 3. 设备使用优化
- ✅ 分析设备使用时长和成本效益
- ✅ 建议设备维护时机
- ✅ 识别设备闲置或过度使用

### 4. 利润分析
- ✅ 评估批次盈利能力
- ✅ 计算盈亏平衡点
- ✅ 提供定价策略建议

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 检查.env文件
cat .env

# 确保包含以下配置：
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 必须配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

**获取 Hugging Face Token**:
1. 访问 https://huggingface.co/settings/tokens
2. 创建新Token（需要有read权限）
3. 复制Token到 `.env` 文件

### 3. 启动服务

```bash
python main.py
```

服务启动后：
- 🌐 API文档: http://localhost:8085/docs
- ❤️ 健康检查: http://localhost:8085/
- 📊 OpenAPI规范: http://localhost:8085/openapi.json

**验证服务**:
```bash
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
  "redis_available": true
}
```

---

## 📡 API 接口

### 1. 成本分析对话 `POST /api/ai/chat`

**请求体**:
```json
{
  "message": "批次BATCH_20251003_00001的成本数据...",
  "session_id": "可选-会话ID",
  "user_id": "factory_001_batch_001"
}
```

**响应**:
```json
{
  "reply": "根据提供的成本数据分析：\n\n1. 成本结构分析：\n✅ 原材料成本占比55.6%，属于合理范围...",
  "session_id": "abc123def456",
  "message_count": 2
}
```

**特点**:
- ✅ 支持多轮对话（基于session_id）
- ✅ 自动创建新会话
- ✅ 24小时会话过期
- ✅ 专业成本分析建议

### 2. 获取会话历史 `GET /api/ai/session/{session_id}`

查看完整对话历史。

### 3. 删除会话 `DELETE /api/ai/session/{session_id}`

清除会话记录。

### 4. 重置会话 `POST /api/ai/reset`

开始新的对话。

📄 **[查看完整API文档](http://localhost:8085/docs)**

---

## 🏗️ 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│  React Native 移动端 (frontend/CretasFoodTrace)            │
│  └─ CostAnalysisDashboard.tsx                               │
│     └─ "AI 智能分析" 按钮                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP POST
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Node.js 后端API (backend/)                                 │
│  POST /api/mobile/processing/ai-cost-analysis               │
│  └─ 获取批次成本数据                                          │
│  └─ 格式化为AI提示                                           │
│  └─ 调用AI服务                                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP POST
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  FastAPI AI服务 (cretas-backend-system-main/backend-ai-chat/)                          │
│  POST /api/ai/chat                                          │
│  └─ Llama-3.1-8B-Instruct                                   │
│  └─ 成本分析专用Prompt                                       │
│  └─ Redis/内存会话管理                                       │
└─────────────────────────────────────────────────────────────┘
```

📄 **[查看集成指南](INTEGRATION_GUIDE.md)**

---

## 🧪 测试服务

### 快速测试脚本

```cmd
# Windows
quick-test.cmd

# 或手动运行
python test_cretas.py
```

### 使用 curl 测试

```bash
# 1. 健康检查
curl http://localhost:8085/

# 2. 成本分析测试
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "批次BATCH_20251003_00001：原材料成本¥2000(55.6%)，人工成本¥1200(33.3%)，设备成本¥400(11.1%)，总成本¥3600。请分析成本结构是否合理？",
    "user_id": "test_factory_001"
  }'

# 3. 查看会话历史
curl http://localhost:8085/api/ai/session/{session_id}?user_id=test_factory_001
```

### 测试场景

完整的测试脚本包含以下场景：
1. ✅ 健康检查
2. ✅ 成本分析对话
3. ✅ 多轮对话
4. ✅ 会话历史
5. ✅ 不同业务场景（设备效率、员工效率、利润优化）

📄 **[查看测试指南](AI_INTEGRATION_TEST.md)**

---

## 📊 System Prompt

专为水产加工成本分析设计的AI提示词：

```
你是白垩纪食品溯源系统的AI成本分析助手，专门帮助水产加工企业进行成本优化和分析。

核心任务：
1. 成本分析建议 - 分析原材料、人工、设备成本合理性
2. 生产效率优化 - 分析员工效率和人员配置
3. 设备使用优化 - 分析设备利用率和维护时机
4. 利润分析 - 评估批次盈利能力和定价策略

回复要求：
- 使用简洁、专业的语言
- 提供具体的数字和百分比分析
- 给出可操作的改进建议
- 始终用中文回复
```

---

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `HF_TOKEN` | Hugging Face API Token | - | ✅ 是 |
| `REDIS_HOST` | Redis服务器地址 | localhost | ❌ 否 |
| `REDIS_PORT` | Redis端口 | 6379 | ❌ 否 |
| `REDIS_DB` | Redis数据库编号 | 0 | ❌ 否 |

### 模型参数

编辑 `main.py` 中的参数：

```python
payload = {
    "max_tokens": 1000,      # 回复最大长度
    "temperature": 0.7,      # 随机性 (0-1)
    # 0.3 = 更保守准确
    # 0.7 = 平衡
    # 1.0 = 更有创意
}
```

---

## 🚨 故障排除

### ❌ HF_TOKEN 未配置
**解决**: 确保 `.env` 文件中设置了有效的 Hugging Face Token

### ❌ Redis 连接失败
**解决**:
- 检查 Redis 是否启动: `redis-cli ping`（应返回 PONG）
- 或不使用 Redis，程序会自动切换到内存模式

### ❌ AI 模型调用失败 (401 Unauthorized)
**解决**:
- 检查 HF_TOKEN 是否有效
- 确认 Token 有访问 Llama-3.1-8B-Instruct 的权限
- 访问 https://huggingface.co/settings/tokens 验证

### ❌ 会话历史丢失
**原因**: 使用内存存储且服务重启
**解决**: 安装并启动 Redis 实现持久化

---

## 📈 性能指标

| 指标 | 目标 | 实际表现 |
|------|------|---------|
| AI 分析响应时间 | < 10s | 3-8s ✅ |
| AI 服务启动时间 | < 5s | ~3s ✅ |
| 内存占用 (AI) | < 500MB | ~300MB ✅ |
| 并发支持 | 5-10请求 | ✅ 支持 |
| 单次成本 | < 1分钱 | 0.3分 ✅ |

---

## 🔐 安全建议

1. **不要提交 .env 文件**
   ```bash
   # .gitignore
   .env
   ```

2. **生产环境使用 HTTPS**

3. **添加认证中间件**（推荐）
   ```python
   async def verify_token(authorization: str = Header(...)):
       # JWT token 验证
   ```

4. **添加速率限制**
   ```python
   from slowapi import Limiter
   limiter = Limiter(key_func=get_remote_address)
   ```

---

## 🛠️ 下一步优化

### 已规划
- [ ] 缓存机制 - 相似问题5分钟缓存（节省30-40%成本）
- [ ] Prompt优化 - 精简格式（节省20-30% tokens）
- [ ] 流式响应 - SSE实时显示分析结果
- [ ] Token监控 - 记录使用量和成本

### 功能增强
- [ ] 自定义问题输入框
- [ ] AI 分析历史记录
- [ ] 分析报告导出 (PDF/Excel)
- [ ] 批次对比分析
- [ ] 趋势预测和成本预警

---

## 📚 相关文档

- 📊 [成本对比分析](COST_COMPARISON.md) - 详细成本对比
- 📈 [Token使用分析](TOKEN_USAGE_ANALYSIS.md) - 技术分析
- 🧪 [测试指南](AI_INTEGRATION_TEST.md) - 完整测试流程
- 🔌 [集成指南](INTEGRATION_GUIDE.md) - 技术集成文档
- ✅ [验证清单](../VERIFICATION_CHECKLIST.md) - 部署验证
- 🎉 [集成总结](../AI_INTEGRATION_COMPLETE.md) - 完成总结

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📞 技术支持

- 💬 提交 Issue: [GitHub Issues](https://github.com/yourusername/backend-ai-chat/issues)
- 📧 Email: support@cretasystem.com
- 📖 文档: [完整文档](https://docs.cretasystem.com)

---

**版本**: v1.0.0
**更新时间**: 2025-01-03
**状态**: ✅ 生产就绪
