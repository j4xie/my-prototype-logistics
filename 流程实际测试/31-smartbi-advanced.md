# 31. SmartBI 高级 (查询模板深度 / What-If / 财务 V2)

> **✅ R18 QA Medium + Bug #258 Fixed (2026-04-17 22:50, test 139:8097)**: /smart-bi/query-templates 真 UI 新增模板 → fill "R18 月度销售TOP10" + 描述 + queryTemplate → 提交 → **400 "请求格式不正确"** ❌. 诊断: 后端 `SmartBiQueryTemplate.parameters` 字段类型 `String` (JSONB 文本), 前端发 `TemplateParam[]` 数组, Jackson 解析失败. 修: QueryTemplateManager.vue 新加 `serializeTemplate()` — `JSON.stringify(template.parameters || [])` 后 POST. 验证: POST /F001/smart-bi/query-templates 200 + createdId=42 ✅. commit `65b560c2d`. depth: medium (真 UI 填表 + 提交 + fix, 但**非 list +1 UI 回读, 只 API verify createdId** → medium 不是 deep).
>
> **🟡 未深度**: What-If 情景模拟 / 财务 BI V2 面板 / 跨 sheet 分析 / drill-down. 待后续.

**对比 21**: 21 测 Excel/基础查询/AI 问答, 本节测**高级功能**
**耗时**: 15 min

---

## 31.1 模块总览

| 功能 | URL |
|------|-----|
| 查询模板深度 | `/smart-bi/query-templates` (已测一键执行, 这里测 CRUD) |
| What-If 模拟 | `/smart-bi/whatif` |
| 财务 V2 Dashboard | `/smart-bi/financial-dashboard` (已测基础) |
| SKU 毛利分析 | `/finance/sku-margin` |
| 物料均价趋势 | `/warehouse/material-price-trend` |
| SmartBI 配置 | `/system/smartbi-config/*` |

---

## 31.2 查询模板 CRUD (`/smart-bi/query-templates`)

### 31.2.1 新建模板
1. 点 "**新建模板**"
2. 字段:
   - 模板名: `月度销售 TOP10`
   - 分类: 销售 / 采购 / 财务 / 库存
   - SQL 或自然语言:
     - 方式 A (SQL): `SELECT ... FROM sales_orders WHERE ...`
     - 方式 B (NL): `列出本月销售额 TOP10 的客户`
   - 参数 (可选): 年份/月份/客户类型
   - 图表类型: 表格 / 柱状 / 饼图 / 折线
   - 预览 → 确认
3. 保存

### 31.2.2 编辑/删除/收藏

### 31.2.3 权限分享
- 私有 / 本部门 / 工厂所有人

### 31.2.4 参数化执行
- 有参数的模板, 点执行弹参数输入
- 填后查询

### 31.2.5 执行历史
- 每次执行记录查询时间 + 返回行数

---

## 31.3 What-If 模拟 (`/smart-bi/whatif`)

### 背景
"如果提价 5%, 销量会变多少? 利润呢?"

### 31.3.1 场景配置
1. 选基础数据源 (如去年销售)
2. 调整变量:
   - 价格 +5%
   - 销量 -3%
   - 成本 -2%
3. 运行模拟

### 31.3.2 结果对比
- 原场景 vs 模拟场景并排
- KPI 变化 + 趋势图
- 敏感度分析

---

## 31.4 SKU 毛利分析 (`/finance/sku-margin`)

### 31.4.1 SKU 级利润
- 每 SKU: 销量 / 收入 / 成本 / 毛利 / 毛利率
- 排序

### 31.4.2 低毛利预警
- 毛利率 < 10% 标红
- 毛利率 < 0 (亏本) 红色感叹

### 31.4.3 时间维度
- 月/季度/年

---

## 31.5 物料均价趋势 (`/warehouse/material-price-trend`)

### 31.5.1 每原料历史价格
- 折线图显示近 6-12 月采购均价
- 波动分析

### 31.5.2 涨幅预警
- 月涨幅 > 10% 标红
- 联动采购审核 (三价对比 §05.3)

---

## 31.6 SmartBI 配置 (`/system/smartbi-config/*`)

### 31.6.1 数据源管理
- 添加外部 DB / API
- 测试连接

### 31.6.2 图表模板
- 自定义图表配色/布局
- 保存为模板

---

## 31.7 本节 Checklist (12 项)

| # | 项目 | 勾选 |
|---|------|------|
| 1 | 31.2.1 新建模板 (SQL) | ☐ |
| 2 | 31.2.1 新建模板 (NL AI) | ☐ |
| 3 | 31.2.4 参数化执行 | ☐ |
| 4 | 31.2.5 执行历史 | ☐ |
| 5 | 31.3.1 What-If 场景配置 | ☐ |
| 6 | 31.3.2 结果对比 | ☐ |
| 7 | 31.4.1 SKU 毛利列表 | ☐ |
| 8 | 31.4.2 低毛利预警 | ☐ |
| 9 | 31.5.1 物料价格趋势 | ☐ |
| 10 | 31.5.2 涨幅预警联动采购 | ☐ ⭐ |
| 11 | 31.6.1 数据源管理 | ☐ |
| 12 | 31.6.2 图表模板 | ☐ |
