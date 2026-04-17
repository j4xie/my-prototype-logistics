# 50. 工厂 SmartBI 大模块 (制造业专用)

> **🟡 R18 QA Smoke (2026-04-17 07:08)**: /smartbi-config/thresholds?factoryId=F001 (全局路径) **200** ✅. /F001/smartbi-config/thresholds (工厂路径) 404. 解决 memory §99.2#2 待确认项: **全局路径存在**, 工厂路径不可用. Config API 可用.

**说明**: 工厂版 SmartBI — 聚焦**制造/生产/财务/供应链**分析.
**⚠️ 必跑**: 本节与 [51-smartbi-restaurant.md](51-smartbi-restaurant.md) **两者都要跑**, 不能省任一边. 两者内容不交叉, 但都是产品核心功能.
**对象**: 全系统 (不论当前客户是哪类工厂都要测)
**涉及角色**: admin / finance / purchase / production / warehouse
**耗时**: 90-120 min

---

## 50.1 工厂 SmartBI 模块总览

适用: 制造业财务 / 供应链 / 生产 / 采购 / 库存

### 核心入口

| URL | 功能 |
|-----|------|
| `/smart-bi/excel-upload` | Excel 上传解析 |
| `/smart-bi/financial-dashboard` | 财务分析看板 |
| `/smart-bi/query-templates` | 查询模板 |
| `/smart-bi/ai-query` | AI 问答 |
| `/smart-bi/whatif` | What-If 模拟 |
| `/finance/sku-margin` | SKU 毛利分析 |
| `/warehouse/material-price-trend` | 物料均价趋势 |
| `/system/smartbi-config/**` | 配置管理 |
| `/analytics/ai-reports` | AI 自动报告 |
| `/analytics/supply-chain` | 进销存闭环 |
| `/analytics/kpi` | KPI 看板 |
| `/production-analytics/production` | 生产数据分析 |
| `/production-analytics/efficiency` | 人效分析 |

### ⚠️ 与餐饮 BI 的隔离
- 工厂版**不测试**: 菜品四象限 / 门店对比 / 大众点评 / 餐饮 V2 / 损耗
- 若工厂 factoryType=FACTORY, 侧边栏**不显示**餐饮 BI 菜单

---

## 50.2 Excel 上传 + 解析

### 50.2.1 上传
1. admin 进 `/smart-bi/excel-upload`
2. 拖拽 `.xlsx` / `.csv` (< 60MB)
3. 填:
   - 数据类型: **财务 / 销售 / 采购 / 库存** (不含餐饮)
   - 表头行数
   - 业务说明
4. "解析"

### ✅ PASS
- 进度 0→100%
- 预览 (前 10 行) + 字段映射推荐
- **60MB 大文件流式** (Bug-2) 不 OOM ⭐⭐

### 50.2.2 字段映射 + 保存数据集

---

## 50.3 财务分析看板 ⭐ (工厂财务)

### 50.3.1 数据源
顶部下拉: 系统数据 / 上传数据 / **演示数据 (工厂)**

### 50.3.2 Bug #2 回归: 无 cancelled
- 点 "演示数据" 等 10-20s
- ✅ Console 无 `TypeError: Failed to fetch`
- 切菜单再回 → unmount 守护生效

### 50.3.3 Bug #12 回归: divisor 修复
- 12 chart 都渲染含 small_multiples
- 无 Python `divisor referenced before assignment`

### 50.3.4 12 chart 类型 (工厂版, R6 补全)

| # | Chart 类型 | 验证 DOM 选择器 |
|---|-----------|---------------|
| 1 | KPI 营收卡 | `.kpi-card[data-key="revenue"]` |
| 2 | KPI 利润卡 | `.kpi-card[data-key="profit"]` |
| 3 | KPI 成本卡 | `.kpi-card[data-key="cost"]` |
| 4 | KPI 毛利率卡 | `.kpi-card[data-key="margin"]` |
| 5 | 趋势线 (月度营收) | `.echart[data-chart="revenue_trend"]` |
| 6 | 占比饼 (成本结构) | `.echart[data-chart="cost_pie"]` |
| 7 | 对比柱 (产品 TOP10) | `.echart[data-chart="product_top10"]` |
| 8 | Small multiples | `.small-multiples-grid` |
| 9 | 环比分析 | `.echart[data-chart="mom"]` |
| 10 | YoY 对比 | `.echart[data-chart="yoy"]` |
| 11 | 库存周转 | `.echart[data-chart="inventory_turnover"]` |
| 12 | 现金流 | `.echart[data-chart="cashflow"]` |

### 验证方法
- F12 Console 执行 `document.querySelectorAll('.echart, .kpi-card').length` → 应返回 **12** 或更多
- Network 面板过滤 `/api/smartbi/chart/` → 应有 12 次成功调用

### 50.3.5-50.3.7 AI 分析 / 追问 / 总结

### 50.3.8 Bug #13 回归: 导出 PPT/Excel/PDF 3min

---

## 50.4 查询模板 (Bug #15 回归)

### 50.4.1 列表 + 一键执行 (loading 切换)

### 50.4.2 新建模板
- **SQL**: `SELECT month, SUM(amount) FROM sales_orders GROUP BY month`
- **NL AI**: `列出本月销售额 TOP10 客户`

### 50.4.3 工厂场景示例模板
- 月度生产完成率
- 原料采购均价趋势
- 车间 OEE
- SKU 毛利 TOP/BOTTOM
- 供应商交货及时率

---

## 50.5 AI 问答 ⭐ (Bug #14 180s)

### 50.5.1 工厂问题示例
- "今年 1 月生产总量多少?"
- "哪个车间 OEE 最高?"
- "辣椒采购均价近半年趋势?"
- "SKU-001 实际成本 vs BOM 标准?"
- "本月应收账款逾期的客户?"

### 50.5.2 上下文 / 历史 / 反馈

---

## 50.6 What-If 模拟

### 工厂场景变量
- 原料涨价 +10% → 毛利?
- 产能提升 20% → 交货周期?
- 人工成本 +15% → 每吨成品?
- 工序效率 +5% → 月产量?

---

## 50.7 SKU 毛利分析 (`/finance/sku-margin`)

### 50.7.1 每 SKU 销量/收入/成本/毛利/毛利率
### 50.7.2 低毛利预警 (<10% 红, <0 亏本感叹)
### 50.7.3 时间维度 (月/季/年)

---

## 50.8 物料均价趋势

### 50.8.1 近 12 月每原料采购均价折线
### 50.8.2 涨幅 > 10% 标红 + 联动采购 §05.3 三价对比

---

## 50.9 进销存闭环 ⭐ (`/analytics/supply-chain`)

工厂核心视图: 采购 → 库存 → 生产 → 销售 → 收款

### 50.9.1 8 KPI
- 采购入库 (¥/天) / 原料库存 / 生产完成 (件/天) / 成品库存
- 发货 (¥/天) / 应收 / 已收 / 循环周期 (采购→回款几天)

### 50.9.2 瓶颈标红
- 库存积压 / 订单积压 / 生产效率低

---

## 50.10 生产数据分析 (工厂专属)

### 50.10.1 OEE (`/production-analytics/production`)
- 可用率 × 性能率 × 质量率
- 按车间/班组对比

### 50.10.2 人效 (`/production-analytics/efficiency`)
- 每员工工时/产量/合格率
- TOP/BOTTOM 10

### 50.10.3 VL 识别人效 (若开启)
- 摄像头识别动作 + 效率自动采集

---

## 50.11 KPI 看板 (`/analytics/kpi`)

- 卡片: 销售 / 同比环比 / 利润率 / 库存周转 / 生产完成率
- 时间维度 (日/周/月/季/年)
- 筛选 (产品/车间/客户)
- 导出 PDF/Excel

---

## 50.12 AI 自动报告

- 自动月度经营分析 / 供应链健康 / 生产效率周报
- 手动触发 + 选时间范围 + 主题
- LLM 30-60s 生成 Markdown

---

## 50.13 SmartBI 配置 ⭐

### ⚠️ 路径 `/system/smartbi-config/*` (R4 已修)

### 50.13.1 R21-F4 回归
```bash
# 方式 A (全局路径, 当前 JwtAuth 排除支持)
curl -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/smartbi-config/thresholds?factoryId=F001"

# 方式 B (备选: 工厂路径, 若方式 A 404 尝试)
curl -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/F001/smartbi-config/thresholds"
```
✅ 其一 200 即可 / ❌ 两个都 403 → 排除列表回滚

### 50.13.2 数据源 / 图表模板 / 阈值

### 50.13.3 跨工厂越权: `?factoryId=F002` → 应 403

---

## 50.14 工厂 Checklist (30 项)

| # | 项目 | 勾选 |
|---|------|------|
| 1 | Excel 上传 < 60MB | ☐ |
| 2 | 60MB 流式不 OOM | ☐ ⭐⭐ |
| 3 | 字段映射 + 数据集 | ☐ |
| 4 | 财务看板 12 chart 工厂 | ☐ ⭐ |
| 5 | Bug #2 无 Failed to fetch | ☐ ⭐⭐ |
| 6 | Bug #12 small_multiples | ☐ ⭐ |
| 7 | AI 分析每图流式 | ☐ |
| 8 | 追问 + 总结 | ☐ |
| 9 | Bug #13 导出 PPT/Excel/PDF | ☐ ⭐ |
| 10 | Bug #15 一键执行 loading | ☐ ⭐ |
| 11 | 新建模板 SQL | ☐ |
| 12 | 新建模板 NL | ☐ |
| 13 | 参数化执行 | ☐ |
| 14 | Bug #14 AI 问答 180s | ☐ ⭐ |
| 15 | 5 工厂问题示例 | ☐ |
| 16 | 上下文对话 | ☐ |
| 17 | 反馈 | ☐ |
| 18 | What-If 原料涨价 | ☐ |
| 19 | What-If 产能提升 | ☐ |
| 20 | SKU 毛利 + 低毛利红 | ☐ |
| 21 | 物料价格趋势 | ☐ |
| 22 | 涨幅预警 | ☐ |
| 23 | 进销存 8 KPI | ☐ ⭐ |
| 24 | 瓶颈标红 | ☐ |
| 25 | OEE 计算 | ☐ |
| 26 | 人效排名 | ☐ |
| 27 | KPI 多维度 | ☐ |
| 28 | AI 报告手动生成 | ☐ |
| 29 | R21-F4 smartbi-config 200 | ☐ ⭐⭐ |
| 30 | 跨工厂越权 403 | ☐ ⭐⭐⭐ |

---

## 50.15 端到端 (工厂)

上传 Excel → 财务看板 → AI 分析 → 追问 → 总结 → 导出 PDF → 进销存 → OEE

全过 → 工厂 SmartBI **全绿**.

---

## 50.16 完全不覆盖 (属餐饮 BI)

以下**跳到** [51-smartbi-restaurant.md](51-smartbi-restaurant.md):
- 菜品四象限
- 门店对比
- 大众点评差距
- 损耗分析
- 餐饮 V2 Dashboard
- 餐饮 AI 问答
