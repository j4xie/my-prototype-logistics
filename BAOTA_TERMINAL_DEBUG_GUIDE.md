# 宝塔终端调试完整指南

## 📍 前提条件
- 你已经打开了宝塔终端
- Java 后端应该已经在运行
- AI 服务应该已经在运行

---

## 🔍 【第1步】在宝塔终端检查两个服务是否都运行

### 检查 Java 后端（端口 10010）

```bash
lsof -i :10010
```

**正常输出应该显示**:
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
java    xxxxx  root   xx   IPv6 0x...       0t0  TCP *:10010 (LISTEN)
```

**如果什么都没显示，说明 Java 后端没启动** → 需要启动它

---

### 检查 AI 服务（端口 8085）

```bash
lsof -i :8085
```

**正常输出应该显示**:
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
python  xxxxx  root   xx   IPv6 0x...       0t0  TCP *:8085 (LISTEN)
```

**如果什么都没显示，说明 AI 服务没启动** → 需要启动它

---

## 🚀 【第2步】启动 Java 后端（如果没运行）

### 在宝塔终端执行

```bash
cd /www/wwwroot/project && \
mkdir -p logs && \
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > logs/cretas-backend.log 2>&1 &
```

**看到这样的输出说明启动成功**:
```
[1] 12345
```

### 等待 Java 启动（通常需要 10-15 秒）

```bash
sleep 15 && echo "Java 后端应该已启动完成"
```

### 验证 Java 已启动

```bash
lsof -i :10010
```

---

## 🚀 【第3步】启动 AI 服务（如果没运行）

### 在宝塔终端执行

```bash
cd /www/wwwroot/project/backend-ai-chat && \
nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
```

**看到这样的输出说明启动成功**:
```
[1] 67890
```

### 等待 AI 服务启动

```bash
sleep 5 && echo "AI 服务应该已启动"
```

### 验证 AI 服务已启动

```bash
lsof -i :8085
```

---

## 🧪 【第4步】在宝塔终端测试 Java → AI 调用

### 方式1️⃣: 简单的单行测试

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" -H "Content-Type: application/json" -d '{"batchId":"BATCH_TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'
```

**按 Enter 后，应该立即看到 JSON 响应**

---

### 方式2️⃣: 更容易读的多行测试

如果上面的单行太长，可以分多行：

```bash
curl -X POST \
  http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
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

**每行末尾的反斜杠 `\` 表示命令继续到下一行，然后按最后的 Enter 执行**

---

### 方式3️⃣: 保存到文件再执行

```bash
cat > /tmp/test-java-ai.sh << 'EOF'
#!/bin/bash

echo "=========================================="
echo "测试 Java 后端 → AI 服务"
echo "=========================================="
echo ""

echo "【1】测试 Java 后端是否运行"
lsof -i :10010 && echo "✅ Java 后端运行中" || echo "❌ Java 后端未运行"
echo ""

echo "【2】测试 AI 服务是否运行"
lsof -i :8085 && echo "✅ AI 服务运行中" || echo "❌ AI 服务未运行"
echo ""

echo "【3】调用 Java API"
echo "执行: curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch ..."
echo ""

curl -X POST \
  http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"BATCH_TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
EOF

chmod +x /tmp/test-java-ai.sh
bash /tmp/test-java-ai.sh
```

---

## 🔍 【第5步】调试 - 查看实时日志

### 实时监控 Java 后端日志

```bash
tail -f /www/wwwroot/project/logs/cretas-backend.log
```

**在另一个宝塔终端执行 curl 命令，然后看这里的日志输出**

按 `Ctrl+C` 退出日志监控

---

### 实时监控 AI 服务日志

```bash
tail -f /www/wwwroot/project/logs/ai-service.log
```

**在另一个宝塔终端执行 curl 命令，然后看这里的日志输出**

按 `Ctrl+C` 退出日志监控

---

### 同时监控两个日志

```bash
# 终端1
tail -f /www/wwwroot/project/logs/cretas-backend.log

# 终端2（新打开一个宝塔终端）
tail -f /www/wwwroot/project/logs/ai-service.log

# 终端3（新打开一个宝塔终端）
# 执行 curl 测试命令
```

---

## 📊 【第6步】完整的调试流程

### 1. 打开 3 个宝塔终端窗口

- **终端1**: 监控 Java 日志
- **终端2**: 监控 AI 日志
- **终端3**: 执行测试命令

---

### 2. 在终端1 执行

```bash
tail -f /www/wwwroot/project/logs/cretas-backend.log
```

---

### 3. 在终端2 执行

```bash
tail -f /www/wwwroot/project/logs/ai-service.log
```

---

### 4. 在终端3 执行测试

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"BATCH_TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'
```

---

### 5. 观察三个终端的输出

- **终端1**: 看 Java 后端是否收到请求，处理过程如何
- **终端2**: 看 AI 服务是否收到请求，模型推理过程
- **终端3**: 看最终的 API 响应结果

---

## ✅ 成功的完整流程

```
终端3执行curl
    ↓
终端1显示: "收到请求: /api/mobile/CRETAS_2024_001/ai/analysis/cost/batch"
    ↓
终端1显示: "调用 AIAnalysisService.analyzeCost()"
    ↓
终端2显示: "收到请求: POST /api/ai/chat"
    ↓
终端2显示: "调用 Llama 模型进行推理..."
    ↓
终端2显示: "模型推理完成，返回结果"
    ↓
终端1显示: "AI 分析成功"
    ↓
终端3看到 JSON 响应:
{
  "code": 200,
  "message": "success",
  "data": {
    "success": true,
    "aiAnalysis": "【**成本结构分析**】...",
    "sessionId": "session_xxx",
    "messageCount": 1
  }
}
```

---

## 🐛 常见问题调试

### Q1: 看不到 curl 响应

**可能原因1**: 没有等待 Java 启动完成
```bash
# 再等几秒
sleep 10
# 再次执行 curl 命令
```

**可能原因2**: AI 服务没启动
```bash
# 检查 AI 服务
lsof -i :8085

# 如果没有，启动它
cd /www/wwwroot/project/backend-ai-chat && \
nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &
```

### Q2: 看到错误信息

**查看详细的错误日志**:
```bash
tail -50 /www/wwwroot/project/logs/cretas-backend.log | grep -i error
```

```bash
tail -50 /www/wwwroot/project/logs/ai-service.log | grep -i error
```

---

## 📋 快速命令清单

| 操作 | 命令 |
|------|------|
| 检查 Java | `lsof -i :10010` |
| 检查 AI | `lsof -i :8085` |
| 启动 Java | `cd /www/wwwroot/project && nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > logs/cretas-backend.log 2>&1 &` |
| 启动 AI | `cd /www/wwwroot/project/backend-ai-chat && nohup ./venv/bin/python scripts/main.py > /www/wwwroot/project/logs/ai-service.log 2>&1 &` |
| 测试调用 | `curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch -H "Authorization: Bearer ..." -H "Content-Type: application/json" -d '{...}'` |
| 监控 Java 日志 | `tail -f /www/wwwroot/project/logs/cretas-backend.log` |
| 监控 AI 日志 | `tail -f /www/wwwroot/project/logs/ai-service.log` |

---

**现在就在宝塔终端开始调试吧！** 🚀
