# 🚀 Java → AI 快速测试（3步）

## 【第1步】检查 Java 后端是否运行

在宝塔终端执行：

```bash
lsof -i :10010
```

**应该看到**:
```
COMMAND   PID    java  ... LISTEN  *:10010
```

如果没有，需要启动：
```bash
cd /www/wwwroot/project && nohup java -jar cretas-backend-system-1.0.0.jar > logs/cretas-backend.log 2>&1 &
```

---

## 【第2步】检查 AI 服务是否运行

```bash
lsof -i :8085
```

**应该看到**:
```
COMMAND   PID    python  ... LISTEN  *:8085
```

---

## 【第3步】测试 Java 后端调用 AI 服务

**完整命令**（复制粘贴）:

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "BATCH_TEST_001",
    "costData": {
      "totalMaterialCost": 1000,
      "totalLaborCost": 500,
      "totalEquipmentCost": 300
    }
  }'
```

---

## ✅ 成功标志

看到这样的响应就说明完全成功：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "success": true,
    "aiAnalysis": "【**成本结构分析**】\n\n根据批次的成本数据，总成本为 ¥1,800，成本结构如下...",
    "sessionId": "session_xxx",
    "messageCount": 1
  }
}
```

---

## 🔄 请求流程

```
你的请求
    ↓
Java 后端 (10010)
    ↓
调用 AIAnalysisService
    ↓
发送请求到 AI 服务 (8085)
    ↓
AI 服务处理并返回
    ↓
Java 后端格式化响应
    ↓
返回给你
```

---

## 📝 如果失败了

### 检查日志

**Java 后端日志**:
```bash
tail -50 /www/wwwroot/project/logs/cretas-backend.log
```

**AI 服务日志**:
```bash
tail -50 /www/wwwroot/project/logs/ai-service.log
```

---

## 🎯 现在就执行测试吧！

在宝塔终端直接执行那个完整的 curl 命令！
