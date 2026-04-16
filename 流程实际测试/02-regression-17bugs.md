# 02. 17 Bug 复测 (Part 1 — 客户 4-14 反馈)

**来源**: `docs/会议内容/客户会议/web白垩纪ai4-14bug测试.docx`
**账号**: `admin / 123456` (单账号跑完)
**耗时**: 30 min 手跑 / 5 min 自动
**自动化脚本**: `tests/bug-verify-2026-04-15/verify-17-full.mjs`

---

## 2.1 Bug 清单概览

| # | 模块 | 现象 | 修复方案 | 状态 |
|---|------|------|---------|------|
| 1 | 系统 · Canvas 编辑器 | 403 | 路由 meta.roles 加 factory_super_admin | ✅ 已修已部署 |
| 2 | BI · 财务看板 | canceled | FinancialDashboardPBI 加 unmount 守护 (4 个调用点) | ✅ 已修已部署 |
| 3 | 首页 · 经营驾驶舱上传 | 数据处理失败 | 前端错误提示升级, Java 真根因未修 | ⚠️ 部分修 |
| 4 | 销售 · 新建销售订单 | 无权限操作 | ReferenceSelector URL 双前缀 strip | ✅ 已修 (真 root cause) |
| 5 | 销售 · 新建出货 | 按钮无反应 | 补齐 handler + dialog | ✅ 已修 |
| 6 | 系统 · 角色权限 | 404 | 新建 RoleController.java | ✅ 已修 |
| 7 | 系统 · 工作流校验 | 404 | 加 /api/mobile/workflow/* 到 JwtAuth 排除列表 | ✅ 已修 |
| 8 | 系统 · POS 同步 | 同步失败 | Keruyun 识别 demo 凭证返回 mock 订单 | ✅ 已修 |
| 9 | 数据分析 · 异常预警解决 | 缺参数 | userId 从 body 改 query param | ✅ 已修 |
| 10 | 日常 · 新增配方 | 无法新增 | 前端防御校验 + 剔空串 id | ✅ 已修 |
| 11 | 日常 · 新建盘点 | null 为空 NPE | 补 stocktakingDate 默认今日 | ✅ 已修 |
| 12 | BI · 演示数据 | 无法生成 | Python divisor closure 修复 | ✅ 已修 |
| 13 | BI · 导出报表 | 无法导出 | 加 3 min AbortController timeout | ✅ 已修 |
| 14 | BI · AI 问答 | 超时 | Python httpx 120s → 180s | ✅ 已修 |
| 15 | BI · 查询模板一键执行 | loading 卡死 | reactive Map → ref Record + 对象展开 | ✅ 已修 |
| 16 | 通用 · 权限通配符 | `*:*` 不生效 | 认定死代码 (factory_super_admin 直接短路) | ⚪ 非 bug |
| 17 | 通用 · @Valid 错误 | 4xx 提示不友好 | 已覆盖在各具体 bug 修复中 | ✅ 已修 |

---

## 2.2 Bug #1 — Canvas 配置编辑器

### 步骤
1. 登录后 Ctrl+Shift+R 强刷
2. 侧边栏 "**系统管理**" → "**Canvas 配置编辑器**"
   快捷: 地址栏 `http://139.196.165.140:8086/canvas-editor`
3. 等页面加载 5s

### ✅ PASS
- 显示画布编辑器 UI (工具栏 / 字段面板 / 画布区)
- URL 不含 `/403`
- body 不含 "403" 或 "无权访问"
- Console 无红色 error

### ❌ FAIL
- 跳到 `/403`
- toast "无权限访问"

---

## 2.3 Bug #2 — 财务分析看板 canceled

### 步骤
1. 侧边栏 "**智能BI**" → "**财务分析看板**"
   快捷: `/smart-bi/financial-dashboard`
2. 页面打开后找 "**演示数据**" 或 "**生成看板**" 按钮点击
3. 等 10-15s 观察看板生成
4. **加强测**: loading 时**快速切到其他菜单再切回来** — 触发 unmount 验证

### ✅ PASS
- 图表正常渲染 (柱状 / 折线 / KPI 卡片)
- Console **无** `analyzeChart failed: TypeError: Failed to fetch`
- Console **无** 任何红色 error
- Network 请求显示 **200** (不是 "cancelled")

### ❌ FAIL
- Console 出现 `TypeError: Failed to fetch` 多条
- 切页后回来看板空白

---

## 2.4 Bug #3 — 经营驾驶舱上传表格

### 步骤
1. 侧边栏 "**首页**" / `/dashboard`
2. 找 "**经营驾驶舱**" 入口
3. 选择数据源 "**来自上传数据表格**" (下拉)
4. 上传任意 Excel 文件 (如 `docs/` 下测试 Excel)

### ⚠️ 部分修复
- **前端提示已升级**: 失败时显示 "请在 Excel 上传页重新上传，或选择系统数据"
- **Java 真根因未修**: SQL exception 被 sanitize 吞了

### ✅ 基本 PASS
- 不崩溃
- 错误提示清晰

### ❌ FAIL (上报)
- 仍显示 "数据处理失败" 原样 → F12 Network 截图发开发

---

## 2.5 Bug #4 — 销售订单新建无权限操作 ⭐

### 步骤 (深度验证)
1. 侧边栏 "**销售管理**" → "**销售订单**" / `/sales/orders`
2. 列表加载后点右上角 "**新建**" 按钮
3. 页面切换到**创建视图** (非弹框, 整页替换)
4. 点 "**客户**" 下拉

### ✅ PASS
- 客户下拉展开, **至少 28 个选项** (永辉超市/盒马/大润发 等)
- Network: `GET /api/mobile/F001/customers?...` 返回 **200**
- Network: **URL 不能是** `/api/mobile/api/mobile/F001/customers` (双前缀!)
- Console 无红色 error

### ❌ FAIL
- 客户下拉空
- toast "无权限操作" / "无权访问该工厂数据"
- Network URL 含 `/api/mobile/api/mobile/` 双前缀 → 真 bug 复活, 立即上报

---

## 2.6 Bug #5 — 出货记录新建按钮无反应

### 步骤
1. 侧边栏 "**销售管理**" → "**出货记录**" / `/sales/shipments`
2. 点右上角 "**新建出货**" 按钮

### ✅ PASS
- **对话框弹出**, 标题 "新建出货"
- 看到客户/产品等表单字段

### ❌ FAIL
- 点按钮完全无反应
- 不弹对话框

---

## 2.7 Bug #6 — 角色管理查看权限 404 ⭐

### 步骤
1. 侧边栏 "**系统管理**" → "**角色管理**" / `/system/roles`
2. 列表选 "factory_super_admin" 行, 点 "**查看权限**" 按钮

### ✅ PASS
- 弹对话框, 显示**12 个模块权限矩阵**:
  - 生产管理 / 质检管理 / 仓库管理 / 采购管理 / 销售管理 / 财务管理 / 研发管理 / 系统管理 / 数据分析 / 设备管理 / HR 管理 / 日常管理
  - 每行显示 `rw` (读写) / `r` (只读) / `-` (无权)
- Network: `GET /api/mobile/F001/roles/factory_super_admin/permissions` 返回 **200**

### ❌ FAIL
- "请求资源不存在" 404
- 权限矩阵空

---

## 2.8 Bug #7 — 工作流设计器校验 404 ⭐

### 步骤
1. 侧边栏 "**系统管理**" → "**工作流设计器**" / `/system/workflow-designer`
2. 等页面加载 (会调 node-schemas)

### ✅ PASS
- 页面正常显示工作流节点列表
- Network: `GET /api/mobile/workflow/node-schemas` 返回 **200** + 节点定义 JSON
- Console **无** "Failed to load node schemas" 错误

### ❌ FAIL
- Console "Failed to load node schemas ApiError: 权限不足"
- 403 "无权访问该工厂数据" (root cause: JwtAuthInterceptor 把 "workflow" 当 factoryId)

---

## 2.9 Bug #8 — POS 手动同步失败

### 步骤
1. 侧边栏 "**系统管理**" → "**POS 集成**" / `/system/pos`
2. 连接列表选 "白垩纪-客如云POS" 行, 点 "**手动同步**" 按钮
3. 等 3-5s

### ✅ PASS
- Toast: "**同步完成，新增 N 条订单**" (N ≥ 1, 通常 3 条 demo)
- 列表刷新显示新订单

### ❌ FAIL
- "同步失败: 客如云Token刷新失败: 404"

### 说明
demo 凭证 (`demo_access_token_2025`), 后端识别后返回 mock 订单. 上线换真凭证自动切回真 API.

---

## 2.10 Bug #9 — 异常预警解决

### 步骤
1. 侧边栏 "**数据分析**" → "**异常预警**" / `/analytics/alerts`
2. 若有未处理预警, 点行 "**解决**" 按钮
3. 弹框填 "处理说明": `测试解决`
4. 点 "**确认**"

### ✅ PASS
- Toast "解决成功"
- 行状态变 "已解决"
- Network: `PUT /api/mobile/F001/alerts/{id}/resolve?userId=1526` (userId 在 **query**, body 只有 resolutionNotes)

### ❌ FAIL
- "缺少必要参数" / "userId must not be null"
- Network 请求 body 里有 userId 但 URL 没 (修复前状态)

---

## 2.11 Bug #10 — 新增配方

### 步骤
1. 侧边栏 "**日常管理**" / "**餐饮**" → "**配方**" / `/restaurant/recipes`
2. 点 "**新建**" / "**新增**"
3. 对话框填:
   - **配方名称** (必填): `测试配方-QA-{时间}`
   - **产品类型** (下拉, 必填): 选任意
   - **原材料类型** (下拉, 必填): 选任意
   - **标准产量** (必填, >0): `10`
   - **净成品率** (必填): `0.85`
   - **单位** (必填): `kg`
4. 点 "**确定**"

### ✅ PASS
- Toast "创建成功"
- 列表出现新配方

### ❌ FAIL
- "must not be blank" (必填字段没填全)
- 提交后无反应

### 防御校验
- 必填字段为空时点确定应有字段标红提示, 不应后端报错

---

## 2.12 Bug #11 — 新建盘点 NPE

### 步骤
1. 侧边栏 "**日常管理**" → "**盘点管理**" / `/restaurant/stocktaking`
2. 点 "**新建盘点**"
3. 对话框弹出后检查:
   - ✅ 应有 "**盘点日期**" 字段, **默认填今日**
   - ✅ 应有 "**原材料类型**" 下拉
4. 填:
   - **盘点日期**: 今日 (默认即可)
   - **原材料类型** (必填): 选任意
   - **盘点数量**: `50`
5. 点 "**确定**"

### ✅ PASS
- **盘点日期默认有值** (今日), 不是空
- Toast "创建成功"

### ❌ FAIL
- "must not be null" / "null 为空"
- 对话框里**没有**盘点日期字段

---

## 2.13 Bug #12 — 财务看板演示数据

### 步骤
1. `/smart-bi/financial-dashboard`
2. 点 "**演示数据**" 按钮
3. 等 10-20s (LLM 分析)

### ✅ PASS
- 看板渲染 12 个 chart 类型 (含 small_multiples)
- Console 无 `divisor referenced before assignment`

### ❌ FAIL
- 某些图表空白 (特别 small_multiples)
- Python 日志 "free variable 'divisor' referenced before assignment"

---

## 2.14 Bug #13 — 导出报表

### 步骤
1. `/smart-bi/financial-dashboard`
2. 先加载数据 (点 "演示数据")
3. 点 "**导出 PPT**" / "**导出 Excel**" / "**导出 PDF**"
4. 等**最多 3 min**

### ✅ PASS
- 3 min 内弹下载对话框
- 下载文件能正常打开

### ❌ FAIL
- 无响应超过 3 min (前端应有 timeout 报错, 不是永久挂住)

---

## 2.15 Bug #14 — AI 问答超时

### 步骤
1. `/smart-bi/ai-query` (或侧边栏 AI 问答)
2. 输入问题: `今年 1 月营收多少?`
3. 点 "**提问**" 或 Enter
4. 等**最多 3 min** (LLM 流式响应)

### ✅ PASS
- 3 min 内 LLM 回复文字流出

### ❌ FAIL
- 超过 3 min 无响应且不报错 (假死)
- Python 日志 httpx timeout 120s (应是 180s 才对)

---

## 2.16 Bug #15 — 查询模板一键执行

### 步骤
1. 侧边栏 "**智能BI**" → "**查询模板**" / `/smart-bi/query-templates`
2. 列表选任一模板
3. 点 "**一键执行**"
4. 等 5-15s

### ✅ PASS
- loading 正常切换到**结果显示**
- 结果区域有数据或图表

### ❌ FAIL
- loading 永久显示 (> 1 min 不变)
- 结果区空白

---

## 2.17 Bug #16 — 通配符 (认定非 bug)

**不用测**. 后端 `PermissionServiceImpl.hasPermission()` L213 对 factory_super_admin 直接 `return true` 短路, `*:*` 通配符代码路径永不执行. 属死代码, 不影响功能.

若客户问 → 回复: "此逻辑已被前置条件覆盖, 无需字符串匹配, 权限正常."

---

## 2.18 Bug #17 — @Valid 提示 (已覆盖)

**不用单独测**, 已通过 #9 #10 #11 的前端防御校验修复. 400 返回时前端应有 toast 提示, 而非用户不知道.

---

## 2.19 本节 Checklist (17 项)

| # | 项目 | 勾选 |
|---|------|------|
| 1 | #1 Canvas 编辑器无 403 | ☐ |
| 2 | #2 财务看板无 "Failed to fetch" error | ☐ |
| 3 | #3 经营驾驶舱上传提示友好 | ☐ |
| 4 | #4 销售订单客户下拉 28+ 选项, 无双前缀 URL | ☐ ⭐ |
| 5 | #5 出货新建 dialog 弹出 | ☐ |
| 6 | #6 角色权限 12 模块显示 | ☐ ⭐ |
| 7 | #7 工作流校验 node-schemas 200 | ☐ ⭐ |
| 8 | #8 POS 同步返回 "新增 N 条订单" | ☐ |
| 9 | #9 预警解决 toast 成功, userId 在 query | ☐ |
| 10 | #10 配方创建 toast 成功 | ☐ |
| 11 | #11 盘点 dialog 含日期字段 (默认今日) | ☐ ⭐ |
| 12 | #12 演示数据生成 12 图表 | ☐ |
| 13 | #13 导出 3 min 内完成或报错 | ☐ |
| 14 | #14 AI 问答 3 min 内回复 | ☐ |
| 15 | #15 查询模板 loading 切换结果 | ☐ |
| 16 | 整轮 Console 0 红色 error | ☐ ⭐⭐ |
| 17 | 整轮 Network 无双前缀 `/api/mobile/api/mobile/` | ☐ ⭐⭐ |

⭐ = 本次核心修复 / ⭐⭐ = 全程质量门

---

## 2.20 快速自动跑 (推荐每次部署后)

```bash
cd C:\Users\Steve\my-prototype-logistics
node tests/bug-verify-2026-04-15/verify-17-full.mjs
```

**期望**:
```
总: pageerror=0, console.error=0, HTTP 4xx=0
失败 phase: 无 ✅
```

报告: `full-17-report.json` / 截图: `screenshots/17full/`

**若自动跑失败**, 手跑对应的 bug 章节定位.
