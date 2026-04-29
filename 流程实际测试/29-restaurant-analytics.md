# 29. 餐饮专属分析 (配方/菜品/门店/经营)

> **⚠️ R18 QA Medium (2026-04-17 07:00, blocked by factory-type gate)**: factory_admin1 登录 F001 (FACTORY 类型) 访问 `/restaurant/recipes` 返回 **403** (frontend factory-type gate). API /F001/restaurant/recipes GET 200 (empty, F001 非餐饮), POST 400 "must not be blank × 3" (必填字段名不明). Recipe.factoryId @NotBlank 已在之前 session 修 (RCP-8e6fc901 DB 验证). 完整 deep 需 **RESTAURANT 类型 factory 账号** (F_DEMO 或餐厅测试号), 本次 session 范围外. 待后续切号测.

**路由**: `/restaurant/**` (餐饮行业, 鼎鲜火锅等客户用)
**耗时**: 20 min

---

## 29.1 模块总览

| 子模块 | URL |
|-------|-----|
| 配方管理 | `/restaurant/recipes` (已在 02 测过基础) |
| 盘点管理 | `/restaurant/stocktaking` (已测) |
| 菜品四象限 | `/restaurant/analytics/menu` |
| 门店对比 | `/restaurant/analytics/stores` |
| 大众点评经营差距 | `/restaurant/analytics/dianping-gap` |
| 损耗分析 | `/restaurant/wastage` |
| 餐饮 V2 Dashboard | `/smart-bi/restaurant-v2` |

---

## 29.2 菜品四象限 (`/restaurant/analytics/menu`)

### 背景
BCG 矩阵: 按**销量** x **毛利率** 把菜品分 4 象限
- 明星 (高销高利)
- 金牛 (高销低利)
- 问题 (低销高利)
- 瘦狗 (低销低利)

### 29.2.1 散点图
- X: 销量, Y: 毛利率
- 每菜品一个点
- 4 象限分色

### 29.2.2 筛选
- 时间范围
- 门店
- 菜品类别

### 29.2.3 决策建议
- 瘦狗菜品 → 建议下架
- 问题菜品 → 建议营销推广

### ✅ PASS
- 4 象限划分正确
- 点击点跳转菜品详情

---

## 29.3 门店对比 (`/restaurant/analytics/stores`)

### 29.3.1 多门店指标对比
- 营收 / 客单价 / 翻台率 / 人效 / 食材成本

### 29.3.2 排名
- 按任一指标排

### 29.3.3 时间序列
- 各门店同期对比

---

## 29.4 大众点评经营差距 (`/restaurant/analytics/dianping-gap`)

### 29.4.1 数据源
- 大众点评爬取数据 vs 门店自报
- 差距分析 (评价/客流)

### 29.4.2 Insight
- "某门店线上评分 4.2, 低于同区域均值 4.5, 建议..."

---

## 29.5 损耗分析 (`/restaurant/wastage`) ⭐

### 核心业务: 食品损耗管理

### 29.5.1 新增损耗记录
1. 进 `/restaurant/wastage`
2. 点 "新建损耗"
3. 字段:
   - 日期
   - 食材
   - 损耗数量 + 单位
   - 损耗金额 (自动计算)
   - 损耗原因 (下拉): 变质/过期/操作失误/客户退菜
   - 备注
4. 保存

### 29.5.2 损耗趋势
- 日 / 周 / 月
- 按食材分类
- TOP 损耗食材

### 29.5.3 损耗率
- = 损耗金额 / 采购金额
- 门店对比, 超 5% 预警

### 29.5.4 下游联动 (25.1.13 类似)
- 库存自动扣减
- 成本核算自动冲销

---

## 29.6 餐饮 V2 Dashboard (`/smart-bi/restaurant-v2`)

### 客户专属版 (鼎鲜火锅)
- 整合: 营收 + 菜品 + 门店 + 损耗 + 人效
- 每日自动邮件/钉钉推送

---

## 29.7 本节 Checklist (12 项)

| # | 项目 | 勾选 |
|---|------|------|
| 1 | 菜品四象限散点图 | ☐ |
| 2 | 4 象限分色正确 | ☐ |
| 3 | 点击点跳菜品详情 | ☐ |
| 4 | 门店对比多维度 | ☐ |
| 5 | 门店时间序列 | ☐ |
| 6 | 大众点评差距 | ☐ |
| 7 | 损耗记录新建 | ☐ ⭐ |
| 8 | 损耗原因下拉 | ☐ |
| 9 | 损耗趋势图 | ☐ |
| 10 | 损耗率计算 | ☐ |
| 11 | 损耗 → 库存扣减 | ☐ ⭐ |
| 12 | V2 Dashboard 集成 | ☐ |
