# SmartBI 智能分析报告

测试文件: test_complex_5sheets.xlsx

## 0. 利润表

### 场景检测
- 场景: **profit_statement**
- 置信度: 0.50
- 检测依据: 标题包含'利润表', 数据包含'一、营业收入', 数据包含'二、营业成本'

### 字段映射
| 原始列名 | 标准字段 | 角色 | 置信度 |
|----------|----------|------|--------|
| 项目 | category | dimension | 0.90 |
| 01月_预算数 | budget | measure | 0.95 |
| 01月_实际数 | actual | measure | 0.95 |
| 02月_预算数 | budget | measure | 0.95 |
| 02月_实际数 | actual | measure | 0.95 |
| 累计_预算数 | budget | measure | 0.95 |
| 累计_实际数 | actual | measure | 0.95 |

### 推荐分析
- [1] **预算实际对比** (bar_comparison)
- [2] **预算完成率趋势** (line)

### 分析结果

#### 预算实际对比
**摘要:**
```json
{
  "totalBudget": 5069.5,
  "totalActual": 5066.7,
  "totalVariance": -2.800000000000182,
  "overallAchievement": 99.9
}
```
**洞察:**
- 预算完成率 99.9%，接近目标
**警告:**
- ⚠️ 存在预算缺口 3，建议分析原因

推荐图表: bar_comparison

#### 预算完成率趋势
**摘要:**
```json
{
  "totalBudget": 10139.0,
  "totalActual": 10133.4,
  "overallAchievement": 99.9,
  "periodCount": 3
}
```

推荐图表: line

---

## 1. 销售明细

### 场景检测
- 场景: **sales_detail**
- 置信度: 1.00
- 检测依据: 列名包含'客户', 列名包含'产品', 列名包含'数量'

### 字段映射
| 原始列名 | 标准字段 | 角色 | 置信度 |
|----------|----------|------|--------|
| 日期 | date | time | 0.90 |
| 客户名称 | customer | dimension | 0.70 |
| 产品名称 | product | dimension | 0.70 |
| 数量 | quantity | measure | 0.90 |
| 单价 | price | measure | 0.90 |
| 金额 | amount | measure | 0.90 |
| 业务员 | salesperson | dimension | 0.90 |

### 推荐分析
- [1] **销售KPI概览** (kpi_cards)
- [2] **产品销售排名** (bar_horizontal)
- [3] **销售员排名** (bar_horizontal)
- [4] **客户分析** (pie)

### 分析结果

#### 销售KPI概览
**洞察:**
- 总销售额 857,521，共 51 笔订单
- 平均订单金额 16,814

推荐图表: kpi_cards

#### 产品销售排名
**排名:**
```json
[
  {
    "rank": 1,
    "name": "火锅底料",
    "amount": 186670.96000000002
  },
  {
    "rank": 2,
    "name": "番茄底料",
    "amount": 180532.79
  },
  {
    "rank": 3,
    "name": "酸菜鱼底料",
    "amount": 180472.02000000002
  },
  {
    "rank": 4,
    "name": "麻辣烫底料",
    "amount": 165219.2
  },
  {
    "rank": 5,
    "name": "菌菇底料",
    "amount": 144626.39
  }
]
```
**洞察:**
- 排名第一: 火锅底料，业绩 186,671

推荐图表: bar_horizontal

#### 销售员排名
**排名:**
```json
[
  {
    "rank": 1,
    "name": "李四",
    "amount": 339340.5800000001
  },
  {
    "rank": 2,
    "name": "张三",
    "amount": 253018.56
  },
  {
    "rank": 3,
    "name": "赵六",
    "amount": 176723.5
  },
  {
    "rank": 4,
    "name": "王五",
    "amount": 88438.72
  }
]
```
**洞察:**
- 排名第一: 李四，业绩 339,341

推荐图表: bar_horizontal

---

## 2. 部门预算对比

### 场景检测
- 场景: **department_report**
- 置信度: 1.00
- 检测依据: 标题包含'部门', 列名包含'部门', 列名包含'完成率'

### 字段映射
| 原始列名 | 标准字段 | 角色 | 置信度 |
|----------|----------|------|--------|
| 2025年各部门预算完成情况_部门 | budget | dimension | 0.95 |
| 2025年各部门预算完成情况_年度预算 | budget | measure | 0.95 |
| 2025年各部门预算完成情况_1月完成 | budget | measure | 0.95 |
| 2025年各部门预算完成情况_2月完成 | budget | measure | 0.95 |
| 2025年各部门预算完成情况_累计完成 | budget | measure | 0.95 |
| 2025年各部门预算完成情况_完成率 | budget | dimension | 0.90 |
| 2025年各部门预算完成情况_排名 | budget | measure | 0.95 |


---

## 3. 产品成本分析

### 场景检测
- 场景: **cost_analysis**
- 置信度: 1.00
- 检测依据: 标题包含'成本', 列名包含'原料', 列名包含'人工'

### 字段映射
| 原始列名 | 标准字段 | 角色 | 置信度 |
|----------|----------|------|--------|
| 产品 | product | dimension | 0.90 |
| 直接成本_原料 | cost | measure | 0.70 |
| 毛利率 | profit | dimension | 0.70 |


---

## 4. 待补充数据

### 场景检测
- 场景: **general_table**
- 置信度: 0.50
- 检测依据: 未匹配到特定场景


---

