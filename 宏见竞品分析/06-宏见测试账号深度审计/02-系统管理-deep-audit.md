# 02 — 系统管理 Deep Audit (Tier 2, P7 优先级 — **配置管理战略入口**)

> Phase 2 deep dive (compact). 截图: `screenshots/nav-12-系统管理-fullpage.png` + `screenshots/系统-*`

---

## 1. 入口 + 架构

- 路径: `系统管理 → 工作流 → 工作流设置`
- 工作流设置 URL: `https://workflow.hongjian.com/workflow/workflowshow.jsp`
- **子域**: `workflow.hongjian.com` (跟创建销售单的 workflow 引擎共享子域 — 同一 engine 配置 + 执行)

---

## 2. 业务流程图 (9 节点)
待处理工作流 / 工作流设置 / 产品参数设置 / **资料定制** ⭐⭐ / 企业信息 / 产品管理 / 安全中心 / 微信管理 / 升级日志

---

## 3. 16 子菜单 (按 Tier — 13-CONFIG 主要素材)

### Tier 2 (Cretas 战略级配置入口)
- **工作流** (6 三级):
  - 待处理工作流
  - 工作流处理
  - **工作流设置** ⭐⭐⭐ (C-APPROVAL-1 配置源头)
  - **流转规则设置** ⭐⭐⭐ (审批规则引擎)
  - 我创建的工作流
  - 我参与的工作流
- **产品管理** ⭐⭐ (产品主数据 — 跟生产管理同名但这里是平台主数据)
- **看板管理** ⭐ (Cretas BentoGrid 对照源)
- **门店管理** ⭐ (餐饮多门店 QHJ 对应)
- **打印管理** ⭐⭐⭐ (C-PRT-1 配置源头 — 模板可视化设计)
- 参数设置
- **功能扩展** ⭐ (推测是模块开关 — Cretas C-FEATURE-1 已 ship)
- 系统设置 (基础配置)

### Tier 3
- 投诉管理 (合并到品质投诉)
- 微信管理 (推测是 OAuth 微信登录配置)

---

## 4. 工作流引擎 (从销售/采购实测反推)

### 4.1 实测证据
- **创建任意单据 → 走 workflow.hongjian.com 引擎** (`workno=sale` / `workno=buy` 等)
- **workflowroute.jsp** = 单据路由 (按 workno 决定流程定义)
- **workflow.jsp** = 节点界面 (含意见输入 + 提交/草稿)
- **审批历史** button → 查询完整 trace
- **节点意见** + **设置常用语** → 模板化审批回复

### 4.2 工作流设置 (推测能力)
- 可视化拖拽配置 (jsPlumb 节点 + 连线 — 跟首页流程图同库)
- 节点类型: 创建 / 审批 / 系统操作 / 通知
- 流转规则: 金额阈值 / 部门 / 角色 / 时间
- 多分支 + 并行 + 会签

---

## 5. 资料定制 (推测)

URL 推测: 系统管理 → 资料定制 (流程图节点)
推测能力 (待 Phase 3 验证):
- 字段自定义 (添加/删除字段)
- 必填规则配置
- 字段联动 (A 字段 = X 时, B 字段必填)
- 公式自定义 (从 release notes "新增高级配置中, 设置公式页面" 推断)

⭐ **直接对应 BORROW_LIST C5 行业模板 + Cretas N51 跨工厂行业模板** 

---

## 6. 跟 Cretas 对照 (战略级配置差距)

| 维度 | 宏见 | Cretas |
|---|---|---|
| **工作流可视化编辑** | ✅ jsPlumb 拖拽 | ❌ ApprovalChainConfig 后端有, 前端管理 UI 缺 |
| **流转规则引擎** | ✅ 独立子菜单 | ❌ |
| **多分支 + 并行 + 会签** | ✅ (推测) | ❌ |
| **意见模板 (常用语)** | ✅ | ❌ |
| **打印模板可视化设计** | ✅ 独立子菜单 | ❌ C-PRT-1 后端有, 前端缺 |
| **资料定制** (字段/公式) | ✅ 独立子菜单 | ❌ Cretas 是开发改 |
| **看板管理** | ✅ | BentoGridEditor 部分 |
| **功能扩展** (模块开关) | ✅ | ✅ C-FEATURE-1 已 ship |
| **门店管理** (多门店) | ✅ | 餐饮 QHJ 部分 |
| **企业信息** | ✅ | Factory entity |
| **安全中心** | ✅ | RBAC + JWT 已有 |
| **升级日志** in-app feed | ✅ 10 条 release notes | ❌ |

---

## 7. Cretas 应该抄 (战略级)

| 优先级 | 项 | 工时 | 说明 |
|---|---|---|---|
| **P0 (战略)** | **工作流可视化编辑器** (C-APPROVAL-1 前端) | 15d | 后端 ApprovalChainConfig 已实装, 缺前端 UI |
| **P0** | **流转规则引擎** (金额/部门/角色阈值) | 8d | 跟工作流编辑器配套 |
| **P1** | **打印模板可视化设计** (C-PRT-1 前端) | 10d | C-PRT-1 后端 ship, 前端编辑器缺 |
| **P1** | **意见模板 (常用语)** 库 | 2d | 审批人提效 |
| **P1** | 升级日志 in-app feed | 2d | "/system/release-notes" 推送给客户 |
| **P2** | 资料定制 (字段/公式) | 20d+ | 长期 — 客户自定义字段 |
| **P2** | 看板管理 (Cretas Bento 对照升级) | 5d | 多布局可保存 |
| **P3** | 门店管理 (餐饮 QHJ 升级) | 5d | 餐饮主线 |

---

## 8. 战略洞察 ⭐⭐⭐

### 8.1 系统管理 = "ERP 配置中台"
宏见把 ERP 的所有配置 (工作流/打印/字段/规则) 集中在系统管理, **客户可自服务**. Cretas 当前是"开发改":
- 客户要加字段 → 找开发
- 客户要改审批 → 找开发
- 客户要改打印模板 → 找开发

**结果**: 宏见客户 onboard 30 天, Cretas 客户 onboard 90 天 (开发周期).

### 8.2 战略对标: "AI + 配置中台" 双引擎
- 宏见: 配置中台 (强配置 + 弱 AI)
- Cretas: AI 中台 (强 AI + 弱配置)
- **理想**: AI 中台 + 配置中台 (Cretas Sprint 4-6 路线图加 C-APPROVAL-1 / C-PRT-1 前端)

### 8.3 销售话术
- ✅ 可说: "我们 AI Skill 让销售员一句话建单, 不用学界面"
- ✅ 可说: "我们灰色边界 4 拍板, 行业模板 C-FEATURE-1 已 ship"
- ❌ 不能说: "客户可自定义字段 / 改审批 / 设计打印模板"
- 🟡 推荐说: "客户配置需求由我们 BD + 工程响应, 比传统 ERP 快 (因为有 AI 加速)"

---

## 9. 完成度
✅ 16 子菜单 Tier 分类
✅ 工作流引擎架构 (从 sale/buy 反推)
✅ 跟 Cretas 战略级对照 12 维度
✅ MUST_COPY 增量 8 项 (含 C-APPROVAL-1/C-PRT-1 前端)
✅ 战略洞察: AI + 配置中台双引擎
🟡 工作流编辑器实操 + 资料定制 + 打印模板设计 (留 Phase 3)

---

## 10. Round 5+ 真实数字修正 (2026-05-15 amend)

| 维度 | Round 1 估算 | **Round 5 真实** |
|---|---|---|
| 子菜单数 | 16 | **45** (2.8×) |
| 后端子域 | main.hongjian.com | main (21) + print/print2/tool/log/file/image/tv/weixin/wxshop/export/import/record/sms/mail/workflow — **15+ 配套子域** |

### Round 5 真实 45 子菜单分组
- **system** (12): 系统参数设置 / 高端 key 管理 / 系统预警 / 操作日志 / 系统体检 / 体验查询 / 体验设置 / 系统更新 等
- **product** (8): 产品管理 / 单据修改 / 全局工序设置 / 计量单位 / 单据删除 / 税务产品 / 国家区域 / 产品参数
- **workflow** (6): 待处理 / 我的 / 配置 / 流转规则 / 我创建 / 我参与
- **store** (5): 门店补货 / 店面管理 / 入库 / 库存 / 出库
- **printmanager** (3): 动态打印 / **打印模板** ⭐⭐ / 字体管理
- **complaint** (3): 投诉管理 / 投诉处理 / 我的投诉
- **screen** (2): 看板账号 / 看板配置
- **weixin** (2): 微信服务号 / 公众号授权
- **thirdext** (2): 第三方账单 / 第三方授权
- **parameter** (2): 编号规则设置 / 财务规则设置

### Round 7-8 新发现 (15+ 子域配套)
- **print.hongjian.com**: 真打印模板编辑器 (20 模板分类 + 25+ 具体模板, **称重模板** ⭐)
- **print2.hongjian.com**: 静态打印模板 (区分动态)
- **tool.hongjian.com**: 工具房列表
- **log.hongjian.com**: 系统操作日志 (5 列 + 查询导出)
- **file.hongjian.com**: 文件夹树状图
- **image.hongjian.com → publicimage.hongjian.com**: 公共图片库 (跨企业共享)
- **tv.hongjian.com**: TV 大屏看板 + **HoanTV.apk Android APK 下载** ⭐⭐⭐
- **weixin.hongjian.com**: 微信绑定
- **wxshop.hongjian.com → mp.weixin.qq.com OAuth**: 接入腾讯微分销
- **export.hongjian.com**: 数据导出规则中心 (跨 12 模块)
- **import.hongjian.com**: 数据导入规则中心 (含校验/未导入/成功/失败)
- **record.hongjian.com**: 外呼通话统计 (15s/30s/60s/120s 多档)
- **sms.hongjian.com**: 短信模板 (3 tab)
- **mail.hongjian.com**: 邮件 (需设 SMTP)
- **workflow.hongjian.com**: 126 个独立工作流 (Round 4 实测)

### Cretas 累计借鉴 (系统/平台域)
- **P0 战略**: C-APPROVAL-EDITOR-1 (15d, 工作流可视化编辑器) / C-PRT-EDITOR-1 (10d, 打印模板可视化) / C-CHECKPOWER-1 (3d, RBAC 统一函数)
- **P1**: C-WF-RULE-1 (流转规则引擎, 10d) / C-WF-VAR-1 (系统变量库) / C-OPINION-1 (意见模板) / C-VOUCHER-TPL-1 (凭证模板) / C-LOG-AUDIT-1 (3d, 操作日志) / C-EXPORT-CENTER-1 (5d, 导出规则中心) / C-IMPORT-CENTER-1 (5d, 导入规则中心)
- **P2**: C-BOARD-1 (看板配置 5d) / C-STORE-1 (门店管理 5d) / C-PRINTER-FONT-1 (字体管理 3d) / C-MENU-ENGINE-1 (8d, 配置驱动菜单)
- **P3 战略**: **C-TV-DASHBOARD-1** ⭐⭐⭐ (15d, TV 大屏 Android app, 跟 SmartBI 集成) / C-MICROSERVICE-1 (38 子域微服务架构) / C-RBAC-FNO-1 (15d, 细粒度 1591 RBAC) / C-DOCS-DOMAIN-1 / C-SERVICE-CODE-1

详见 `28-CRETAS-PRIORITIZED-BACKLOG.md`.
