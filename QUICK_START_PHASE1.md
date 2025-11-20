# Phase 1 快速启动指南

**实施日期**: 2025-11-18
**状态**: ✅ **Phase 1 完成 - 7个API已实现**

---

## 🚀 快速启动

### 1. 启动后端服务

```bash
cd /Users/jietaoxie/my-prototype-logistics/backend-java

# 方法1: 使用Maven (如果已安装)
mvn clean package -DskipTests
java -jar target/cretas-backend-system-1.0.0.jar

# 方法2: 使用IDE
# 在IntelliJ IDEA或Eclipse中直接运行Application.java主类
```

**验证服务启动**:
```bash
curl http://localhost:10010/api/mobile/health
```

### 2. 获取JWT Token

```bash
# 登录获取token
curl -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123456"
  }'

# 复制响应中的accessToken
# 将token保存到test_dashboard_apis.sh脚本中
```

### 3. 测试Dashboard API

```bash
cd /Users/jietaoxie/my-prototype-logistics

# 编辑test_dashboard_apis.sh，替换JWT_TOKEN
nano test_dashboard_apis.sh  # 或使用你喜欢的编辑器

# 运行测试
./test_dashboard_apis.sh
```

### 4. 启动前端应用

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 启动React Native开发服务器
npx expo start

# 在手机或模拟器上打开应用
# Android: 按 'a' 键
# iOS: 按 'i' 键
```

### 5. 验证前端功能

**登录应用**:
- 用户名: `admin`
- 密码: `Admin@123456`

**测试功能**:
1. ✅ **首页 (HomeScreen)**
   - 查看QuickStatsPanel是否显示数据
   - 今日批次数、完成率、在岗人数

2. ✅ **生产仪表板 (ProcessingDashboard)**
   - 点击"生产"Tab
   - 查看生产统计图表
   - 查看质量统计面板
   - 查看设备状态

3. ✅ **成本分析 (CostAnalysisDashboard)**
   - 点击"生产"Tab → "成本分析"
   - 查看时间范围成本趋势
   - 查看成本构成饼图

---

## 📋 Phase 1 完成清单

### ✅ 新增文件（6个）

1. **DashboardController.java** (578行)
   - 6个仪表板API端点
   - 15个DTO类

2. **DashboardService.java** (330行)
   - 6个业务方法
   - 完整的统计逻辑

3. **ReportsController.java** (135行)
   - 1个成本分析API端点
   - ApiResponse类

4. **ReportsService.java** (240行)
   - 成本分析业务逻辑
   - 5个辅助方法

5. **PHASE1_BACKEND_IMPLEMENTATION_COMPLETE.md**
   - 完整的实施文档
   - API使用示例
   - 测试指南

6. **test_dashboard_apis.sh**
   - 自动化API测试脚本
   - 11个测试用例

### ✅ 实现的API（7个）

#### Dashboard API (6个)
1. `GET /dashboard/overview` - 生产概览
2. `GET /dashboard/production` - 生产统计
3. `GET /dashboard/equipment` - 设备统计
4. `GET /dashboard/quality` - 质量统计
5. `GET /dashboard/alerts` - 告警统计
6. `GET /dashboard/trends` - 趋势分析

#### Reports API (1个)
7. `GET /reports/cost-analysis/time-range` - 成本分析

---

## 🎯 API完成度

| 阶段 | API数 | 完成度 |
|------|-------|--------|
| Phase 1前 | 77个 | 38.5% |
| **Phase 1后** | **84个** | **42%** |
| 提升 | +7个 | +3.5% |

---

## ⚠️ 已知限制

### 模拟数据
以下API当前返回模拟数据，需要Phase 3实现后集成真实数据:

1. **设备统计API** (`/dashboard/equipment`)
   - 需要EquipmentController实现

2. **告警统计API** (`/dashboard/alerts`)
   - 需要AlertController实现

### 性能优化TODO
- 考勤数据查询应使用缓存
- 大数据量查询应使用数据库聚合
- 时间序列数据可以优化GROUP BY查询

---

## 🔜 下一步: Phase 2

### Phase 2 计划 (2周)

1. **AIController** (7天)
   - 11个AI分析端点
   - DeepSeek API集成

2. **ProductionPlanController** (4天)
   - 12个生产计划端点

3. **MaterialBatchController** (5天)
   - 22个原料批次端点

**总计**: 45个API端点

---

## 📞 问题排查

### 后端启动失败
```bash
# 检查端口占用
lsof -i :10010

# 检查MySQL服务
# 如果使用MySQL，确保服务已启动
```

### API返回401 Unauthorized
```bash
# Token已过期，重新登录获取
curl -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123456"}'
```

### 前端无法连接后端
```bash
# 检查API基础URL配置
# frontend/CretasFoodTrace/src/constants/config.ts
# 确保API_BASE_URL指向http://localhost:10010
```

---

## 📚 相关文档

- **详细实施报告**: [PHASE1_BACKEND_IMPLEMENTATION_COMPLETE.md](./PHASE1_BACKEND_IMPLEMENTATION_COMPLETE.md)
- **API集成状态**: [frontend/CretasFoodTrace/API_INTEGRATION_STATUS.md](./frontend/CretasFoodTrace/API_INTEGRATION_STATUS.md)
- **API修复报告**: [frontend/CretasFoodTrace/API_FIXES_COMPLETE.md](./frontend/CretasFoodTrace/API_FIXES_COMPLETE.md)

---

**Phase 1 完成**: 2025-11-18 ✅
**执行者**: Claude Code
**状态**: 所有API已实现，可以进行测试
