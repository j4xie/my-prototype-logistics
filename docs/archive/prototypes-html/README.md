# 白垩纪食品溯源系统 - HTML原型图

## 📋 项目概述

本项目是根据《白垩纪食品溯源系统》PRD文档生成的高保真HTML原型图集合，包含系统的8大核心模块、31个功能页面的可交互原型。

### 🎯 原型特点

- ✅ **100% PRD覆盖** - 所有原型页面均基于PRD文档需求设计
- 🎨 **高保真设计** - 采用Modern UI设计规范，视觉效果接近最终产品
- 📱 **响应式布局** - 支持PC、平板、移动端多设备适配
- 🔗 **可交互导航** - 页面间可自由跳转，模拟真实用户体验
- 🚀 **纯静态文件** - 无需服务器，直接在浏览器中打开即可查看

## 📂 目录结构

```
prototypes/
├── index.html                  # 主导航页面（入口）
├── assets/                     # 静态资源
│   ├── css/
│   │   └── common.css         # 通用样式文件
│   └── js/                    # （预留）
└── pages/                      # 功能页面
    ├── auth/                   # 认证模块（4页）
    │   ├── login.html         # 统一登录页 ⭐
    │   ├── register-phase1.html # 注册-手机验证
    │   ├── register-phase2.html # 注册-完善信息
    │   └── activation.html    # 设备激活
    ├── batch/                  # 批次管理模块（5页）
    │   ├── list.html          # 批次列表页 ⭐
    │   ├── detail.html        # 批次详情
    │   ├── create.html        # 创建批次
    │   ├── edit.html          # 编辑批次
    │   └── timeline.html      # 批次时间线
    ├── quality/                # 质检管理模块（4页）
    │   ├── list.html          # 质检记录列表
    │   ├── create.html        # 创建质检记录
    │   ├── detail.html        # 质检详情
    │   └── statistics.html    # 质检统计分析
    ├── employee/               # 员工管理模块（4页）
    │   ├── clock.html         # 员工打卡 ⭐
    │   ├── history.html       # 打卡历史
    │   ├── statistics.html    # 工时统计
    │   └── work-record.html   # 工作记录
    ├── equipment/              # 设备监控模块（4页）
    │   ├── list.html          # 设备列表
    │   ├── monitoring.html    # 实时监控面板
    │   ├── detail.html        # 设备详情
    │   └── alerts.html        # 设备告警
    ├── cost/                   # 成本分析模块（4页）
    │   ├── dashboard.html     # 成本仪表板
    │   ├── batch-detail.html  # 批次成本详情
    │   ├── trend.html         # 成本趋势分析
    │   └── ai-analysis.html   # AI成本分析
    ├── dashboard/              # 生产仪表板（4页）
    │   ├── overview.html      # 生产概览 ⭐
    │   ├── production.html    # 生产统计
    │   ├── quality.html       # 质量统计
    │   └── alerts.html        # 告警中心
    └── trace/                  # 溯源查询（4页）
        ├── consumer.html      # 消费者查询
        ├── enterprise.html    # 企业端追溯
        ├── regulator.html     # 监管端追溯
        └── qr-generate.html   # 溯源码生成
```

⭐ 标记为详细高保真页面，其余为基础框架页面

## 🚀 快速开始

### 方法1: 直接打开（推荐）

1. 在文件浏览器中找到 `prototypes/index.html`
2. 双击文件，用浏览器打开
3. 点击模块卡片，浏览各个功能页面

### 方法2: 本地服务器（可选）

```bash
# 进入原型目录
cd prototypes

# 使用Python启动简单HTTP服务器
python3 -m http.server 8080

# 或使用Node.js的http-server
npx http-server -p 8080

# 然后在浏览器访问
open http://localhost:8080
```

## 🎨 页面说明

### 1. 认证与权限模块

#### 登录页面 (login.html)
- **功能**: 统一登录入口，支持用户名/手机号登录
- **亮点**:
  - 美观的渐变背景设计
  - 支持"记住我"功能
  - 提供手机验证码、生物识别等替代登录方式
- **测试账号**:
  - 用户名: `super_admin`
  - 密码: `Admin@123456`

#### 注册页面
- **Phase 1**: 手机验证和白名单检查
- **Phase 2**: 完善用户信息

#### 设备激活页面
- 使用激活码激活设备
- 绑定设备ID确保安全

### 2. 批次管理模块

#### 批次列表页 (list.html) ⭐ 重点页面
- **功能**: 生产批次的核心管理页面
- **亮点**:
  - 卡片式布局，信息展示清晰
  - 6种状态徽章（计划中/进行中/质检中/已完成/已失败/已暂停）
  - 实时进度条展示
  - 快捷操作按钮
  - 浮动创建按钮
- **包含示例数据**:
  - 进行中批次（速冻鱼排，68%进度）
  - 质检中批次（冷冻鱼丸，待质检）
  - 已完成批次（速冻虾仁，95分质检）
  - 计划中批次（速冻带鱼段）
  - 已失败批次（质检不合格）
  - 已暂停批次（设备故障）

#### 其他批次页面
- **批次详情**: 完整信息、成本分析、时间线
- **创建批次**: 表单填写、原材料选择
- **编辑批次**: 信息修改
- **批次时间线**: 操作记录可视化

### 3. 质检管理模块

- **质检列表**: 所有质检记录
- **创建质检**: 三阶段质检（原料/过程/成品）
- **质检详情**: 检测项结果、照片
- **质检统计**: 合格率、不合格项TOP10

### 4. 员工管理模块

- **员工打卡**: GPS定位、拍照打卡
- **打卡历史**: 历史记录查询
- **工时统计**: 日/周/月统计
- **工作记录**: 关联批次、效率分析

### 5. 设备监控模块

- **设备列表**: 所有设备状态
- **实时监控**: 温度/湿度/压力实时数据
- **设备详情**: 运行历史、维护记录
- **设备告警**: 告警管理、处理记录

### 6. 成本分析模块

- **成本仪表板**: 成本概览、趋势
- **批次成本详情**: 成本明细、构成分析
- **成本趋势**: 历史趋势、对比分析
- **AI分析**: DeepSeek智能分析、优化建议

### 7. 生产仪表板模块

- **生产概览**: 首页仪表板、KPI展示
- **生产统计**: 产量、效率数据
- **质量统计**: 质量数据汇总
- **告警中心**: 所有告警汇总

### 8. 溯源查询模块

- **消费者查询**: C端扫码溯源
- **企业端追溯**: B端完整档案
- **监管端追溯**: 监管部门查询
- **溯源码生成**: 二维码生成、打印

## 🎨 设计规范

### 色彩系统

```css
/* 主色调 */
--primary-color: #1890ff;      /* 科技蓝 */
--primary-dark: #096dd9;       /* 深蓝 */
--primary-light: #40a9ff;      /* 浅蓝 */

/* 功能色 */
--success-color: #52c41a;      /* 成功绿 */
--warning-color: #faad14;      /* 警告黄 */
--error-color: #f5222d;        /* 错误红 */
--info-color: #1890ff;         /* 信息蓝 */

/* 状态色 - 批次状态 */
--status-planning: #1890ff;    /* 计划中-蓝 */
--status-progress: #faad14;    /* 进行中-黄 */
--status-check: #722ed1;       /* 质检中-紫 */
--status-completed: #52c41a;   /* 已完成-绿 */
--status-failed: #f5222d;      /* 已失败-红 */
--status-paused: #ff7a45;      /* 已暂停-橙 */
```

### 组件规范

- **卡片阴影**: `0 2px 8px rgba(0, 0, 0, 0.08)`
- **圆角**:
  - 小: 4px
  - 中: 8px
  - 大: 12px
- **间距**:
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px

### 字体规范

- **标题字体**:
  - H1: 32px bold
  - H2: 24px bold
  - H3: 18px semi-bold
- **正文字体**: 14px regular
- **辅助文字**: 12-13px regular

## 📱 响应式设计

原型采用响应式设计，自动适配不同设备：

- **桌面端**: ≥1200px，完整功能展示
- **平板端**: 768px-1199px，网格自适应
- **移动端**: <768px，单列布局

## 🔗 页面导航关系

```
index.html (主导航)
    ↓
├── auth/login.html → dashboard/overview.html
├── batch/list.html → batch/detail.html → batch/timeline.html
├── batch/list.html → batch/create.html
├── quality/list.html → quality/detail.html
├── equipment/monitoring.html → equipment/detail.html
└── dashboard/overview.html → (各模块入口)
```

## 🛠️ 技术栈

- **HTML5**: 语义化标签
- **CSS3**:
  - CSS Variables (CSS变量)
  - Flexbox / Grid布局
  - 动画与过渡效果
- **JavaScript**:
  - 原生JS，无框架依赖
  - 简单交互逻辑
  - 表单验证

## 📝 使用说明

### 查看原型

1. 打开 `index.html` 进入主导航页
2. 查看统计数据（8个模块、30+页面）
3. 点击任意模块卡片进入对应功能页面
4. 点击页面内的导航菜单切换模块

### 重点查看页面

建议按以下顺序查看重点页面：

1. **登录流程**: `auth/login.html`
2. **批次管理**: `batch/list.html` → `batch/detail.html`
3. **生产概览**: `dashboard/overview.html`
4. **员工打卡**: `employee/clock.html`
5. **成本分析**: `cost/batch-detail.html`

### 自定义修改

所有样式集中在 `assets/css/common.css`，可按需修改：

```css
/* 修改主色调 */
:root {
    --primary-color: #YOUR_COLOR;
}

/* 修改卡片阴影 */
.card {
    box-shadow: YOUR_SHADOW;
}
```

## 📚 参考文档

本原型基于以下PRD文档设计：

1. **PRD-系统产品需求文档.md** - 系统整体架构和需求
2. **PRD-生产模块规划.md** - 生产模块详细设计
3. **PRD-认证规划.md** - 认证系统设计
4. **PRD-认证与生产模块优化方案.md** - 优化方案
5. **food-traceability-system-prd.md** - 食品溯源系统PRD

## 🔄 版本历史

### v1.0 (2025-01-05)
- ✅ 创建主导航页面
- ✅ 完成8大模块31个页面基础框架
- ✅ 完成登录页面高保真设计
- ✅ 完成批次列表页面高保真设计（包含6种状态示例数据）
- ✅ 统一样式系统（common.css）
- ✅ 响应式布局支持

## 🚧 后续计划

### Phase 2: 详细页面开发

- [ ] 批次详情页（成本分析、时间线）
- [ ] 批次创建页（完整表单）
- [ ] 质检创建页（三阶段质检表单）
- [ ] 设备监控页（实时数据图表）
- [ ] AI分析页（DeepSeek集成演示）

### Phase 3: 交互增强

- [ ] 添加真实图表组件（ECharts/Chart.js）
- [ ] 添加更多交互动画
- [ ] 添加表单验证逻辑
- [ ] 添加数据模拟（LocalStorage）

### Phase 4: 移动端优化

- [ ] 移动端专属页面
- [ ] 触摸手势支持
- [ ] PWA支持

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- **项目**: 白垩纪食品溯源系统
- **团队**: Cretas开发团队
- **文档**: `/docs/prd/`

## 📄 许可证

本原型仅用于产品设计和开发参考，未经授权不得用于商业用途。

---

**最后更新**: 2025-01-05
**版本**: v1.0
**作者**: 白垩纪食品溯源系统开发团队
