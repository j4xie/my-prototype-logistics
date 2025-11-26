# AI 服务测试命令

## 🧪 快速测试（复制粘贴到宝塔终端）

### 测试1：单行简单测试

```bash
curl -X POST http://localhost:8085/api/ai/chat -H "Content-Type: application/json" -d '{"message":"请介绍一下自己","user_id":"test_factory"}'
```

**按 Enter 后应该立即看到 JSON 响应**

---

### 测试2：测试食品加工分析

```bash
curl -X POST http://localhost:8085/api/ai/food-processing-analysis -H "Content-Type: application/json" -d '{"batch_id":"BATCH_001","raw_material_cost":1000,"labor_cost":500,"equipment_cost":300,"processing_weight":100}'
```

---

### 测试3：成本分析对话

```bash
curl -X POST http://localhost:8085/api/ai/chat -H "Content-Type: application/json" -d '{"message":"这个批次的人工成本占比45%，设备成本20%，原材料35%。请分析是否合理？","user_id":"factory_001"}'
```

---

## 📋 如果上面不行，检查以下几点

### 1️⃣ 检查服务是否还在运行

```bash
ps aux | grep python | grep main
```

**应该看到类似**:
```
root  891462  0.2  1.5 1234567 123456 ?  Sl  06:51 ./venv/bin/python scripts/main.py
```

如果看不到，说明服务崩溃了，需要重启：

```bash
cd /www/wwwroot/project/backend-ai-chat && \
nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
```

### 2️⃣ 检查 8085 端口是否监听

```bash
lsof -i :8085
```

**应该看到监听状态**

### 3️⃣ 查看最新日志

```bash
tail -100 /www/wwwroot/project/logs/ai-service.log
```

**查看是否有错误信息**

---

## 🔍 如果仍有问题

可能的原因：

1. **服务崩溃** - 检查日志找错误原因
2. **内存不足** - 大型 AI 模型需要很多内存
3. **HF_TOKEN 无效** - 检查 `.env` 文件
4. **首次启动很慢** - 模型下载需要 10-30 分钟

---

## ✅ 成功的响应示例

```json
{
  "reply": "你好！我是白垩纪食品溯源系统的AI成本分析助手...",
  "session_id": "abc123def456",
  "message_count": 1
}
```

如果看到这样的 JSON，说明完全成功了！ 🎉
