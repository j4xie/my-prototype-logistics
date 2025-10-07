# AI成本分析 - 快速测试清单 ⚡

**⏱️ 预计时间**: 15-20分钟

---

## 🚀 快速启动（3步）

### 1️⃣ 启动AI服务
```bash
cd backend-ai-chat
source venv/bin/activate
python main.py
```
✅ 看到: `Uvicorn running on http://0.0.0.0:8085`

### 2️⃣ 启动后端
```bash
cd backend
npm run dev
```
✅ 看到: `服务器运行在端口: 3001`

### 3️⃣ 启动React Native
```bash
cd frontend/CretasFoodTrace
npx expo start
# 按 a 键启动Android模拟器
```
✅ 看到: Expo开发服务器运行

---

## ✅ 核心功能测试（10步）

### 第1步: 登录
- 用户名: `processing_admin`
- 密码: `123456`

### 第2步: 进入批次列表
- 导航: 生产模块 → 批次列表

### 第3步: 选择批次
- 点击任意批次进入详情

### 第4步: 进入成本分析
- 点击"成本分析"或从菜单进入

### 第5步: 验证成本数据显示
**检查项**:
- [ ] 批次信息卡片正确
- [ ] 成本4格网格显示（原材料、人工、设备、总成本）
- [ ] 人工详情卡片
- [ ] 设备详情卡片
- [ ] AI智能分析卡片（蓝色）

### 第6步: 点击AI分析
- 点击"获取AI优化建议"按钮

**检查项**:
- [ ] 显示加载动画（3-8秒）
- [ ] AI结果正确显示
- [ ] 配额显示："本周剩余: X/20次"

### 第7步: 测试快速提问
- 点击"如何降低人工成本？"

**检查项**:
- [ ] AI回答针对人工成本
- [ ] 配额减1

### 第8步: 测试自定义问题
- 点击"输入自定义问题"
- 输入："如何提高利润？"
- 点击"发送"

**检查项**:
- [ ] AI回答自定义问题
- [ ] 配额再减1

### 第9步: 测试配额限制
```bash
# 在另一个终端设置配额为1次
mysql -u root cretas_db -e "UPDATE factories SET ai_weekly_quota = 1;"
```
- 在RN中点击"重新分析"

**检查项**:
- [ ] 弹出超限提示
- [ ] 按钮变灰禁用
- [ ] 显示"本周次数已用完"

### 第🔟步: 查看使用日志
```bash
npx prisma studio
# 查看ai_usage_logs表
```

**检查项**:
- [ ] 每次调用都有记录
- [ ] requestType正确（analysis/question）
- [ ] year和weekNumber正确

---

## 🎯 必须通过的测试

### ✅ 核心功能 (P0)
- [ ] AI分析按钮可点击
- [ ] AI返回分析结果
- [ ] 配额信息显示正确
- [ ] 达到上限后正确提示

### ✅ API正确性 (P0)
- [ ] `/api/mobile/processing/ai-cost-analysis` 正常工作
- [ ] 返回包含quota字段
- [ ] 超限返回429错误

### ✅ 限流正确性 (P0)
- [ ] 按周计算（weekNumber）
- [ ] 达到上限后拒绝请求
- [ ] 使用日志正确记录

---

## 🔧 一键测试脚本

```bash
#!/bin/bash
# 保存为 test-ai-integration.sh

echo "🧪 AI成本分析集成测试"
echo "========================"

# 1. 测试AI服务
echo "1️⃣ 测试AI服务..."
curl -s http://localhost:8085/ | jq -r '.status' || echo "❌ AI服务未启动"

# 2. 测试后端
echo "2️⃣ 测试后端服务..."
curl -s http://localhost:3001/api/mobile/health | jq -r '.status' || echo "❌ 后端未启动"

# 3. 登录获取token
echo "3️⃣ 登录系统..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "processing_admin",
    "password": "123456",
    "deviceInfo": {"deviceId": "TEST", "deviceModel": "Test", "platform": "test", "osVersion": "1.0"}
  }' | jq -r '.tokens.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  exit 1
fi

echo "✅ Token: ${TOKEN:0:20}..."

# 4. 获取批次列表
echo "4️⃣ 获取批次列表..."
BATCHES=$(curl -s http://localhost:3001/api/mobile/processing/batches \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

if [ "$BATCHES" == "null" ] || [ -z "$BATCHES" ]; then
  echo "⚠️ 没有批次数据，请先创建批次"
  exit 1
fi

BATCH_ID=$BATCHES
echo "✅ 批次ID: $BATCH_ID"

# 5. 获取成本分析
echo "5️⃣ 获取成本分析数据..."
COST=$(curl -s "http://localhost:3001/api/mobile/processing/batches/$BATCH_ID/cost-analysis" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.success')

if [ "$COST" != "true" ]; then
  echo "❌ 获取成本数据失败"
else
  echo "✅ 成本数据获取成功"
fi

# 6. 调用AI分析
echo "6️⃣ 调用AI分析..."
AI_RESULT=$(curl -s -X POST http://localhost:3001/api/mobile/processing/ai-cost-analysis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"batchId\": \"$BATCH_ID\"}" | jq -r '.success')

if [ "$AI_RESULT" != "true" ]; then
  echo "❌ AI分析失败"
else
  echo "✅ AI分析成功"
  
  # 获取配额信息
  REMAINING=$(curl -s -X POST http://localhost:3001/api/mobile/processing/ai-cost-analysis \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"batchId\": \"$BATCH_ID\", \"question\": \"测试\"}" | jq -r '.data.quota.remaining')
  
  echo "✅ 剩余配额: $REMAINING"
fi

echo ""
echo "========================"
echo "✅ 核心功能测试完成！"
echo "📱 现在可以在React Native中手动测试UI"
```

**使用方法**:
```bash
chmod +x test-ai-integration.sh
./test-ai-integration.sh
```

---

## 📱 React Native测试（5分钟）

### 必测场景
1. [ ] 进入成本分析页面
2. [ ] 点击"获取AI优化建议"
3. [ ] 看到AI结果和配额
4. [ ] 点击一个快速提问
5. [ ] 验证配额减少

### 通过标准
- ✅ 所有按钮可点击
- ✅ AI结果正确显示
- ✅ 配额计数正确
- ✅ 无报错或崩溃

---

## 🎉 测试成功标志

看到以下输出即为成功：

**AI服务**:
```
✅ Redis连接成功
INFO: Uvicorn running on http://0.0.0.0:8085
```

**后端**:
```
✅ 数据库连接成功
🚀 服务器运行在端口: 3001
```

**React Native AI分析**:
```
📋 分析结果

根据成本数据分析：
1. 成本结构分析：...
2. 优化建议：...

本周剩余: 19/20次
```

---

**如果上述3个服务都正常，且React Native能显示AI结果和配额，说明集成完全成功！🎉**
