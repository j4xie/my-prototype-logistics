# 白垩纪食品溯源系统 - 原型设计指南

## 概述

本文档详细说明了白垩纪食品溯源系统的10角色原型设计规范，包括设计理念、界面布局、交互规范及与后端API的对应关系。

**版本**: v1.0
**更新日期**: 2025-12-26
**设计者**: Claude Code

---

## 1. 设计理念与原则

### 1.1 核心设计原则

| 原则 | 说明 |
|------|------|
| **B端风格** | 简单大方、指引性强、无多余UI装饰 |
| **角色隔离** | 每个角色只看到自己职责范围内的功能 |
| **信息优先** | 首页即工作台，关键数据一目了然 |
| **操作高效** | 常用功能一键可达，减少操作步骤 |
| **移动优先** | 基于375px宽度设计，适配主流移动设备 |

### 1.2 设计语言

- **色彩系统**: 每个角色使用独特的渐变色标识
- **卡片布局**: 信息分组清晰，阴影层次分明
- **图标语义**: 使用CSS图标或中文字符，禁止使用Emoji
- **状态指示**: 颜色编码表示不同状态（绿=正常、黄=警告、红=紧急）

### 1.3 图标规范 (禁止使用 Emoji)

**重要**: 本系统**禁止使用任何 Emoji 字符**，所有图标均使用以下替代方案：

| 类型 | 替代方案 | CSS类示例 |
|------|---------|-----------|
| **状态指示** | CSS圆点 | `.status-dot--success/warning/error` |
| **导航图标** | SVG图标 | `.nav-icon-svg` |
| **角色图标** | 中文首字母 | `.role-letter--factory` (厂) |
| **功能图标** | 文字标签 | `.icon-text` ([AI]、[!]、[急]) |
| **设备状态** | CSS圆点 | `.equipment-status-dot--running/idle/maintenance/fault` |

**状态颜色映射**:
```css
/* 成功/运行中 - 绿色 */
.status-dot--success { background: #52c41a; }

/* 警告/待处理 - 黄色 */
.status-dot--warning { background: #faad14; }

/* 错误/紧急 - 红色 */
.status-dot--error { background: #ff4d4f; }

/* 空闲/未开始 - 灰色 */
.status-dot--idle { background: #d9d9d9; }
```

**角色首字母图标**:
| 角色 | 字母 | 样式类 |
|------|------|--------|
| 工厂管理员 | 厂 | `.role-letter--factory` |
| HR管理员 | 人 | `.role-letter--hr` |
| 采购员 | 采 | `.role-letter--procurement` |
| 销售员 | 销 | `.role-letter--sales` |
| 调度员 | 调 | `.role-letter--dispatcher` |
| 车间主任 | 间 | `.role-letter--workshop` |
| 操作员 | 操 | `.role-letter--operator` |
| 仓储物流 | 仓 | `.role-letter--warehouse` |
| 质检员 | 检 | `.role-letter--quality` |
| 设备管理员 | 设 | `.role-letter--equipment` |

---

## 2. 角色权限体系

### 2.1 角色层级架构

```
                    ┌─────────────────────────────┐
                    │     工厂管理员 (总监)         │
                    │   factory_super_admin       │
                    └──────────────┬──────────────┘
                                   │
        ┌──────┬──────┬──────┬─────┼─────┬──────┬──────┐
        ↓      ↓      ↓      ↓     ↓     ↓      ↓      ↓
     ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
     │ HR  ││采购 ││销售 ││调度 ││仓储 ││质检 ││设备 ││     │
     └─────┘└─────┘└─────┘└──┬──┘└─────┘└─────┘└─────┘└─────┘
                             │
                    ┌────────┴────────┐
                    ↓                 ↓
              ┌──────────┐      ┌──────────┐
              │ 车间主任  │      │  操作员   │
              └──────────┘      └──────────┘
```

### 2.2 10角色详情

| # | 角色代码 | 中文名称 | 渐变色 | Tab数量 |
|---|----------|----------|--------|---------|
| 1 | `factory_super_admin` | 工厂管理员 | 深蓝→紫色 | 5 |
| 2 | `hr_admin` | HR管理员 | 粉红→橙色 | 5 |
| 3 | `procurement` | 采购员 | 青色→绿色 | 5 |
| 4 | `sales` | 销售员 | 橙色→红色 | 5 |
| 5 | `dispatcher` | 调度员 | 蓝色→紫色 | 5 |
| 6 | `workshop_supervisor` | 车间主任 | 靛蓝→紫色 | 5 |
| 7 | `operator` | 操作员 | 紫色→粉色 | **4** |
| 8 | `warehouse` | 仓储/物流 | 粉色→珊瑚 | 5 |
| 9 | `quality_inspector` | 质检员 | 绿色→黄绿 | 5 |
| 10 | `equipment_admin` | 设备管理员 | 天蓝→青绿 | 5 |

---

## 3. 界面布局规范

### 3.1 屏幕尺寸

```
宽度: 375px (iPhone 基准)
高度: 812px (iPhone X 基准)
圆角: 40px (模拟真机效果)
```

### 3.2 区域划分

```
┌─────────────────────────────────────┐
│             Header (渐变色)          │  ~110px
│  头像 + 用户名 + 角色 | 通知 + 设置   │
├─────────────────────────────────────┤
│                                     │
│           Content Area              │  ~562px
│        (可滚动内容区域)               │
│                                     │
├─────────────────────────────────────┤
│          Bottom Navigation          │  ~70px
│    4-5个Tab (根据角色权限)           │
└─────────────────────────────────────┘
```

### 3.3 Header 规范

```css
.header {
  background: linear-gradient(135deg, #color1 0%, #color2 100%);
  padding: 50px 20px 25px;  /* 顶部留空给状态栏 */
  color: white;
}
```

### 3.4 卡片规范

```css
.card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
```

---

## 4. 各角色渐变色配置

| 角色 | 渐变起点色 | 渐变终点色 | CSS代码 |
|------|-----------|-----------|---------|
| 工厂管理员 | `#667eea` | `#764ba2` | `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` |
| HR管理员 | `#f093fb` | `#f5576c` | `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)` |
| 采购员 | `#4facfe` | `#00f2fe` | `linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)` |
| 销售员 | `#fa709a` | `#fee140` | `linear-gradient(135deg, #fa709a 0%, #fee140 100%)` |
| 调度员 | `#a18cd1` | `#fbc2eb` | `linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)` |
| 车间主任 | `#667eea` | `#764ba2` | `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` |
| 操作员 | `#667eea` | `#764ba2` | `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` |
| 仓储物流 | `#f093fb` | `#f5576c` | `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)` |
| 质检员 | `#00b09b` | `#96c93d` | `linear-gradient(135deg, #00b09b 0%, #96c93d 100%)` |
| 设备管理员 | `#0093E9` | `#80D0C7` | `linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)` |

---

## 5. 交互规范

### 5.1 底部导航

- 固定在屏幕底部，高度70px
- 图标使用CSS样式类或SVG，禁止使用Emoji
- 标签字号11px，与图标间距4px
- 激活状态使用角色主题色

### 5.2 页面切换

```javascript
function switchPage(pageId) {
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  // 显示目标页面
  document.getElementById(pageId).classList.add('active');
  // 更新导航激活状态
  updateNavigation(pageId);
}
```

### 5.3 状态颜色

| 状态 | 背景色 | 文字色 | 用途 |
|------|--------|--------|------|
| 成功/运行中 | `#e6ffe6` | `#2ed573` | 正常状态 |
| 警告/维护中 | `#fff8e6` | `#f59f00` | 需关注 |
| 错误/故障 | `#ffe6e6` | `#ff4757` | 紧急处理 |
| 信息/提醒 | `#e6f4ff` | `#0093E9` | 一般通知 |
| 已完成 | `#e6ffe6` | `#2ed573` | 完成状态 |
| 待处理 | `#fff8e6` | `#f59f00` | 等待中 |
| 进行中 | `#e6f4ff` | `#0093E9` | 处理中 |

---

## 6. 各角色功能详解

### 6.1 工厂管理员 (factory_super_admin)

**职责**: 全局监控 + AI分析 + 整体管理

**首页Dashboard**:
- 今日生产概览（进行中批次、产量、设备状态、人员在岗）
- 生产批次进度列表
- 告警提示区域

**底部导航**:
| Tab | 图标样式类 | 功能 |
|-----|------------|------|
| 首页 | `.nav-icon--home` | 全局Dashboard |
| 报表 | `.nav-icon--report` | 各类报表和分析 |
| AI | `.nav-icon--ai` | AI成本分析 |
| 管理 | `.nav-icon--settings` | 系统设置 |
| 我的 | `.nav-icon--profile` | 个人中心 |

---

### 6.2 HR管理员 (hr_admin)

**职责**: 人员管理 + 白名单 + 部门管理

**首页Dashboard**:
- 人员概览（在岗/总人数、迟到、新入职）
- 待处理事项列表

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | HR工作台 |
| 人员 | 人员管理 |
| 考勤 | 考勤统计 |
| 白名单 | 注册白名单 |
| 我的 | 个人中心 |

---

### 6.3 采购员 (procurement)

**职责**: 供应商管理 + 原材料入库

**首页Dashboard**:
- 库存预警卡片
- 今日入库统计
- 供应商待付款

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 采购工作台 |
| 入库 | 原材料入库 |
| 供应商 | 供应商管理 |
| 库存 | 库存查询 |
| 我的 | 个人中心 |

---

### 6.4 销售员 (sales)

**职责**: 客户管理

**首页Dashboard**:
- 今日订单统计
- 客户待回访
- 出货进度跟踪

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 销售工作台 |
| 客户 | 客户管理 |
| 订单 | 订单管理 |
| 溯源 | 溯源查询 |
| 我的 | 个人中心 |

---

### 6.5 调度员 (dispatcher)

**职责**: 生产调度 + 任务分配 + 人员调动

**首页Dashboard**:
- 今日生产计划总览
- 各车间任务状态
- 人员分配情况

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 调度工作台 |
| 计划 | 生产计划管理 |
| 分配 | 任务分配 |
| 人员 | 人员调动 |
| 我的 | 个人中心 |

---

### 6.6 车间主任 (workshop_supervisor)

**职责**: 生产执行 + 消耗录入 + 自检

**首页Dashboard**:
- 我的车间今日任务
- 进行中批次列表
- 人员在岗情况

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 车间工作台 |
| 生产 | 生产执行 |
| 质检 | 自检录入 |
| 考勤 | 打卡 |
| 我的 | 个人中心 |

---

### 6.7 操作员 (operator) [注意] 最简界面

**职责**: 执行生产任务 + 打卡

**首页Dashboard**:
- 当前任务卡片（进度条）
- 快捷操作按钮
- 今日任务列表

**底部导航** (仅4个):
| Tab | 功能 |
|-----|------|
| 首页 | 我的任务 |
| 录入 | 数据录入 |
| 考勤 | 打卡 |
| 我的 | 个人中心 |

---

### 6.8 仓储/物流 (warehouse)

**职责**: 出货 + 物流追踪 + 库存

**首页Dashboard**:
- 今日入库/出库统计
- 待出货订单（含紧急标识）
- 库存预警

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 仓储工作台 |
| 入库 | 入库确认 |
| 出货 | 出货管理 |
| 库存 | 库存查询 |
| 我的 | 个人中心 |

---

### 6.9 质检员 (quality_inspector)

**职责**: 独立质检 + 抽检/复检

**首页Dashboard**:
- 今日质检统计
- 合格率圆形显示
- 待质检批次列表

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 质检工作台 |
| 质检 | 创建质检记录 |
| 记录 | 历史记录 |
| 考勤 | 打卡 |
| 我的 | 个人中心 |

---

### 6.10 设备管理员 (equipment_admin)

**职责**: 设备管理 + 维护 + 告警处理

**首页Dashboard**:
- 设备状态总览（运行/停止/维护/故障）
- 未处理告警列表
- 今日维护任务
- 设备效率统计

**底部导航**:
| Tab | 功能 |
|-----|------|
| 首页 | 设备工作台 |
| 设备 | 设备管理 |
| 告警 | 告警处理 |
| 维护 | 维护记录 |
| 我的 | 个人中心 |

---

## 7. 与后端API对应关系

### 7.1 API路径规范

所有移动端API路径前缀: `/api/mobile/{factoryId}/`

### 7.2 各角色API映射

| 角色 | 主要API路径 |
|------|-------------|
| 工厂管理员 | `/reports/dashboard/*`, `/ai/*` |
| HR管理员 | `/users/*`, `/whitelist/*`, `/departments/*` |
| 采购员 | `/suppliers/*`, `/material-batches/*` |
| 销售员 | `/customers/*`, `/orders/*`, `/shipments/*` |
| 调度员 | `/production-plans/*`, `/task-assignments/*` |
| 车间主任 | `/processing/batches/*`, `/quality-inspections/*` |
| 操作员 | `/processing/batches/{id}/*`, `/timeclock/*` |
| 仓储物流 | `/material-batches/*`, `/shipments/*` |
| 质检员 | `/quality-inspections/*` |
| 设备管理员 | `/equipment/*`, `/equipment-alerts/*`, `/maintenance/*` |

### 7.3 Dashboard API

| 端点 | 说明 | 使用角色 |
|------|------|---------|
| `/reports/dashboard/overview` | 生产概览 | 管理员 |
| `/reports/dashboard/production` | 生产统计 | 管理员、调度 |
| `/reports/dashboard/quality` | 质量统计 | 管理员、质检 |
| `/reports/dashboard/equipment` | 设备统计 | 管理员、设备 |

---

## 8. 文件清单

```
docs/prd/prototype/
├── index.html                    # 角色选择入口页
├── styles.css                    # 公共样式表
├── components.js                 # 公共组件
├── 1-factory-admin.html          # 工厂管理员
├── 2-hr-admin.html               # HR管理员
├── 3-procurement.html            # 采购员
├── 4-sales.html                  # 销售员
├── 5-dispatcher.html             # 调度员
├── 6-workshop-supervisor.html    # 车间主任
├── 7-operator.html               # 操作员
├── 8-warehouse.html              # 仓储物流
├── 9-quality-inspector.html      # 质检员
├── 10-equipment-admin.html       # 设备管理员
└── DESIGN_GUIDE.md               # 本文档
```

---

## 9. 使用说明

### 9.1 查看原型

1. 在浏览器中打开 `index.html`
2. 点击任意角色卡片进入对应原型
3. 每个原型都是独立的完整页面

### 9.2 开发参考

1. 参考本文档中的颜色、间距、布局规范
2. 保持各角色界面的一致性
3. 按照权限矩阵控制功能可见性

### 9.3 注意事项

- 操作员界面最简单，只有4个Tab
- 每个角色Header使用独特渐变色
- 状态颜色统一使用规定的色值
- 所有卡片使用相同的阴影和圆角

---

## 10. 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2025-12-27 | v1.1 | 移除所有Emoji引用，添加"禁止使用Emoji"规范，使用CSS图标替代方案 |
| 2025-12-26 | v1.0 | 初始版本，完成10角色原型设计 |

---

*本文档由 Claude Code 自动生成*
