# 考勤打卡功能测试指南

## 📋 测试前准备

### 1. 确认后端服务运行状态
```bash
# 检查后端服务是否运行
curl http://localhost:8080/api/mobile/1/timeclock/status?userId=1
```

### 2. 确认前端配置
- 检查 `API_BASE_URL` 是否正确配置
- 确认用户已登录并获取到有效的 token
- 确认用户有 `factoryId`

## 🧪 测试用例

### 测试用例 1: 上班打卡
**步骤**:
1. 打开应用，登录工厂用户账号
2. 导航到"考勤"Tab → "打卡"页面
3. 等待GPS定位完成（显示"定位成功"）
4. 点击"上班打卡"按钮
5. 在确认对话框中点击"确认打卡"

**预期结果**:
- ✅ 显示成功提示："上班打卡成功！"
- ✅ 状态显示更新为"工作中"
- ✅ 今日打卡记录中显示上班打卡记录
- ✅ 记录显示正确的打卡时间、位置信息

**验证点**:
- [ ] API请求: `POST /api/mobile/{factoryId}/timeclock/clock-in?userId={userId}&location={location}&device=Mobile App`
- [ ] 请求头包含有效的 Authorization token
- [ ] 响应状态码: 200
- [ ] 响应数据包含打卡记录信息

### 测试用例 2: 下班打卡
**前置条件**: 已完成上班打卡

**步骤**:
1. 在打卡页面点击"下班打卡"按钮
2. 在确认对话框中点击"确认打卡"

**预期结果**:
- ✅ 显示成功提示："下班打卡成功！"
- ✅ 状态显示更新为"已下班"
- ✅ 今日打卡记录中显示下班打卡记录

**验证点**:
- [ ] API请求: `POST /api/mobile/{factoryId}/timeclock/clock-out?userId={userId}`
- [ ] 响应状态码: 200
- [ ] 响应数据包含打卡记录信息

### 测试用例 3: 查看今日打卡记录
**步骤**:
1. 打开打卡页面
2. 等待记录加载完成

**预期结果**:
- ✅ 显示今日所有打卡记录（上班、下班、休息等）
- ✅ 记录按时间倒序排列
- ✅ 每条记录显示：类型、时间、位置（如果有）
- ✅ 状态正确显示当前打卡状态

**验证点**:
- [ ] API请求: `GET /api/mobile/{factoryId}/timeclock/history?userId={userId}&startDate={today}&endDate={today}&page=1&size=50`
- [ ] 如果历史记录为空，显示"今日暂无打卡记录"
- [ ] 记录正确解析和显示

### 测试用例 4: 错误处理 - 未获取GPS位置
**步骤**:
1. 在GPS定位完成前（或模拟GPS获取失败）
2. 尝试点击"上班打卡"或"下班打卡"

**预期结果**:
- ✅ 显示提示："正在获取GPS位置，请稍候..."
- ✅ 打卡按钮禁用状态

### 测试用例 5: 错误处理 - 网络错误
**步骤**:
1. 断开网络连接
2. 尝试进行打卡操作

**预期结果**:
- ✅ 显示错误提示
- ✅ 应用不会崩溃
- ✅ 可以重新尝试操作

### 测试用例 6: 颜色显示修复验证
**步骤**:
1. 打开打卡页面
2. 查看状态徽章和记录类型徽章

**预期结果**:
- ✅ 所有颜色正确显示（无 `#99920` 错误）
- ✅ 背景色使用 rgba 格式，透明度正确
- ✅ 不同状态使用不同颜色：
  - 未打卡: 灰色 (#999)
  - 工作中: 绿色 (#4CAF50)
  - 已下班: 蓝色 (#2196F3)
  - 休息中: 橙色 (#FF9800)

## 🔍 API 测试脚本

### 使用 curl 测试后端 API

```bash
# 设置变量
FACTORY_ID="1"
USER_ID="1"
TOKEN="your_access_token_here"
BASE_URL="http://localhost:8080"

# 1. 上班打卡
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/clock-in?userId=${USER_ID}&location=测试位置&device=Test" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

# 2. 下班打卡
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/clock-out?userId=${USER_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

# 3. 获取今日打卡记录
curl -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/today?userId=${USER_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

# 4. 获取打卡历史
curl -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/history?userId=${USER_ID}&startDate=2025-01-15&endDate=2025-01-15&page=1&size=50" \
  -H "Authorization: Bearer ${TOKEN}"

# 5. 获取打卡状态
curl -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/status?userId=${USER_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

## 📱 前端功能测试清单

### UI 测试
- [ ] 时间显示正确更新（每秒更新）
- [ ] GPS定位状态正确显示
- [ ] 打卡按钮状态正确（禁用/启用）
- [ ] 加载状态正确显示
- [ ] 错误提示正确显示
- [ ] 记录列表正确显示
- [ ] 刷新功能正常工作

### 功能测试
- [ ] 上班打卡功能正常
- [ ] 下班打卡功能正常
- [ ] 打卡记录加载正常
- [ ] 状态判断正确
- [ ] 重复打卡检查（如果后端有）
- [ ] GPS位置正确传递

### 边界测试
- [ ] 用户未登录时的处理
- [ ] 用户ID不存在时的处理
- [ ] 网络超时处理
- [ ] 服务器错误（500）处理
- [ ] 权限错误（403）处理
- [ ] 未授权（401）处理

## 🐛 已知问题和修复

### ✅ 已修复
1. **颜色解析错误** - 修复了 `#99920` 无效颜色值问题
   - 使用 `rgba()` 格式替代字符串拼接
   - 添加 `getStatusBadgeColor()` 函数处理颜色转换

2. **API客户端创建** - 创建了 `timeclockApiClient`
   - 正确对接后端 `/api/mobile/{factoryId}/timeclock/` 路径
   - 实现所有11个API接口

3. **记录加载逻辑** - 优化了打卡记录加载
   - 优先加载历史记录（包含所有打卡点）
   - 如果失败，降级到获取今日记录
   - 正确处理404错误

### ⚠️ 待优化
1. **GPS定位** - 当前使用模拟GPS，需要集成真实GPS定位
2. **设备信息** - 当前使用固定值 "Mobile App"，可以获取真实设备信息
3. **错误提示** - 可以添加更详细的错误信息

## 📊 测试结果记录

### 测试日期: ___________

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| 上班打卡 | ⬜ 通过 / ⬜ 失败 | |
| 下班打卡 | ⬜ 通过 / ⬜ 失败 | |
| 查看记录 | ⬜ 通过 / ⬜ 失败 | |
| 错误处理 | ⬜ 通过 / ⬜ 失败 | |
| 颜色显示 | ⬜ 通过 / ⬜ 失败 | |

### 发现的问题:
1. 
2. 
3. 

### 性能指标:
- 打卡响应时间: _____ ms
- 记录加载时间: _____ ms
- GPS定位时间: _____ ms

