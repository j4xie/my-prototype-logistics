# 🚀 快速启动指南

## 立即查看原型

### 方法1: 直接打开（最简单）

**Windows:**
1. 找到 `prototypes` 文件夹
2. 双击 `index.html`
3. 浏览器自动打开

**macOS:**
```bash
# 在终端中执行
cd /Users/jietaoxie/my-prototype-logistics/prototypes
open index.html
```

**Linux:**
```bash
cd /path/to/prototypes
xdg-open index.html
```

### 方法2: 本地服务器（推荐用于演示）

**使用Python（预装在大多数系统）:**
```bash
cd /Users/jietaoxie/my-prototype-logistics/prototypes
python3 -m http.server 8080
```
然后访问: http://localhost:8080

**使用Node.js:**
```bash
cd /Users/jietaoxie/my-prototype-logistics/prototypes
npx http-server -p 8080 -o
```

**使用VS Code Live Server插件:**
1. 安装 "Live Server" 插件
2. 右键 `index.html`
3. 选择 "Open with Live Server"

## 📋 浏览建议

### 新手路线（10分钟快速浏览）

1. **主导航页** (`index.html`)
   - 查看系统概览
   - 了解8大模块

2. **登录页面** (`pages/auth/login.html`)
   - 查看登录界面设计
   - 测试账号: `super_admin` / `Admin@123456`

3. **批次列表页** (`pages/batch/list.html`) ⭐ 重点
   - 查看6种批次状态
   - 体验卡片交互
   - 查看筛选和搜索功能

4. **返回主导航** → 浏览其他模块

### 深度体验路线（30分钟完整浏览）

```
开始
  ↓
主导航 (index.html)
  ↓
认证模块
  ├─ 登录页 (auth/login.html)
  ├─ 注册第一步 (auth/register-phase1.html)
  └─ 设备激活 (auth/activation.html)
  ↓
批次管理（核心模块）
  ├─ 批次列表 (batch/list.html) ⭐
  ├─ 批次详情 (batch/detail.html)
  ├─ 创建批次 (batch/create.html)
  └─ 批次时间线 (batch/timeline.html)
  ↓
质检管理
  ├─ 质检列表 (quality/list.html)
  ├─ 创建质检 (quality/create.html)
  └─ 质检统计 (quality/statistics.html)
  ↓
员工管理
  ├─ 员工打卡 (employee/clock.html)
  └─ 工时统计 (employee/statistics.html)
  ↓
设备监控
  ├─ 设备列表 (equipment/list.html)
  └─ 实时监控 (equipment/monitoring.html)
  ↓
成本分析
  ├─ 成本仪表板 (cost/dashboard.html)
  ├─ 批次成本详情 (cost/batch-detail.html)
  └─ AI分析 (cost/ai-analysis.html)
  ↓
生产仪表板
  └─ 生产概览 (dashboard/overview.html)
  ↓
溯源查询
  ├─ 消费者查询 (trace/consumer.html)
  └─ 企业端追溯 (trace/enterprise.html)
```

### 演示路线（向客户/团队展示）

#### 场景1: 生产流程演示
```
1. 登录系统 (login.html)
   ↓
2. 查看生产概览 (dashboard/overview.html)
   ↓
3. 进入批次列表 (batch/list.html)
   ↓
4. 创建新批次 (batch/create.html)
   ↓
5. 查看批次详情 (batch/detail.html)
   ↓
6. 进行质检 (quality/create.html)
   ↓
7. 查看成本分析 (cost/batch-detail.html)
```

#### 场景2: 员工操作演示
```
1. 员工打卡 (employee/clock.html)
   ↓
2. 查看打卡历史 (employee/history.html)
   ↓
3. 查看工时统计 (employee/statistics.html)
```

#### 场景3: 管理者视角演示
```
1. 生产概览 (dashboard/overview.html)
   ↓
2. 批次管理 (batch/list.html)
   ↓
3. 设备监控 (equipment/monitoring.html)
   ↓
4. 成本分析 (cost/dashboard.html)
   ↓
5. 质检统计 (quality/statistics.html)
```

## 🎨 重点页面说明

### ⭐ 登录页 (auth/login.html)
- **亮点**: 渐变背景、现代UI设计
- **功能**: 支持用户名/手机号登录、记住我、生物识别
- **测试**: 输入账号密码后点击登录

### ⭐⭐⭐ 批次列表页 (batch/list.html)
- **亮点**: 卡片式设计、6种状态、实时进度条
- **包含**:
  - 进行中批次（68%进度）
  - 质检中批次
  - 已完成批次（95分）
  - 计划中批次
  - 已失败批次（质检不合格）
  - 已暂停批次（设备故障）
- **交互**:
  - 状态筛选
  - 搜索功能
  - 卡片悬停效果
  - 快捷操作按钮

## 🎯 查看要点

### 设计要点
- ✅ 统一的Material Design风格
- ✅ 渐变色彩运用
- ✅ 卡片阴影效果
- ✅ 状态徽章设计
- ✅ 响应式布局

### 功能要点
- ✅ 页面导航系统
- ✅ 用户信息展示
- ✅ 筛选和搜索
- ✅ 数据展示（表格/卡片）
- ✅ 操作按钮

### 交互要点
- ✅ 按钮悬停效果
- ✅ 卡片悬停动画
- ✅ 表单验证（部分）
- ✅ 页面跳转

## 📱 设备测试

### 桌面端测试
- 推荐分辨率: 1920x1080 或 1440x900
- 浏览器: Chrome、Firefox、Safari、Edge最新版

### 平板端测试
- iPad横屏/竖屏
- 浏览器开发者工具 → 设备模拟

### 移动端测试
- iPhone/Android手机
- 浏览器开发者工具 → 设备模拟

## 💡 提示

### 浏览器推荐
- ✅ Chrome（推荐）
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ 不建议使用IE

### 屏幕分辨率
- 最佳体验: ≥1366x768
- 支持最低: 1024x768

### 查看顺序建议
1. 先看主导航了解全局
2. 再看登录页了解入口设计
3. 重点看批次列表页（最完整）
4. 浏览其他模块了解布局

## ❓ 常见问题

**Q: 为什么有些页面比较简单?**
A: 登录页和批次列表页是高保真详细设计，其他页面是基础框架。可根据需要进一步完善。

**Q: 如何修改样式?**
A: 编辑 `assets/css/common.css` 文件即可全局修改。

**Q: 如何添加更多页面?**
A: 参考现有页面结构，复制修改即可。或运行 `node generate-pages.js` 自动生成。

**Q: 能否用于实际开发?**
A: 可以！HTML和CSS代码可直接用于React/Vue等框架的样式参考。

## 📞 需要帮助?

- 查看 `README.md` 了解详细说明
- 查看 `/docs/prd/` 了解PRD文档
- 联系开发团队获取支持

---

**祝您浏览愉快！** 🎉
