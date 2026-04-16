# 23. 仓储深度 (供应商/批次/库存调整/统计仪表板)

**补充 §05**: 05 走采购收货, 这里覆盖**仓储独立 CRUD 和管理功能**
**涉及角色**: `warehouse` / `purchase` (供应商) / `admin`
**耗时**: 25 min

---

## 23.1 模块总览

| 模块 | URL |
|------|-----|
| 供应商管理 | `/procurement/suppliers` |
| 价格表 | `/procurement/price-lists` (可选) |
| 物料批次 | `/warehouse/materials` (或 `/batches`) |
| 库存调整 | `/warehouse/inventory` |
| 库存统计 | `/warehouse/inventory` 顶部 KPI |
| 仓库出货 | `/warehouse/shipments` |

---

## 23.2 供应商管理 (`/procurement/suppliers`)

### 23.2.1 新建供应商
**账号**: `purchase`
1. 进 `/procurement/suppliers`
2. 点 "**新建供应商**"
3. 字段:
   - 供应商编号 code (必填): `SUP-001`
   - 供应商名 name (必填): `上海 XX 食材公司`
   - 联系人 contact: `李总`
   - 电话 phone: `13900001234`
   - 地址 address: 上海...
   - 税号 taxNumber: `91310...`
   - 银行账户 bankAccount
   - 银行名 bankName
   - 结算方式 paymentTerm: 月结 / 季结 / 现结
   - 信用额度 creditLimit: 100000
   - 评级 rating (1-5 星)
   - 主营原料 (多选)
   - 合作状态 status: 合作中 / 已停用
4. 保存

### 23.2.2 编辑/删除供应商
- 编辑: 行级 "编辑" 按钮
- 删除: **软删除**, 若有采购单引用应阻止

### 23.2.3 搜索/筛选
- 按名称/编号
- 按评级
- 按合作状态

### 23.2.4 启用/停用
- 行点 "停用" → 状态 `INACTIVE`
- 停用后, 新建采购单下拉不显示此供应商

### 23.2.5 供应商评级
- 基于历史采购:
  - 到货及时率
  - 质检合格率
  - 价格稳定性
- 系统自动或人工评 5 星

### 23.2.6 详情 Tab
- 基本信息
- 历史订单
- 价格记录
- 质检记录
- 对账单

---

## 23.3 物料批次管理 (`/warehouse/materials`)

### 23.3.1 批次列表
**账号**: `warehouse`
- 显示所有原料批次
- 字段: 批次号 / 原料 / 数量 / 单位 / 入库日期 / 过期日期 / 状态 / 仓位

### 23.3.2 手动新建批次
**适用**: 期初库存 / 捐赠 / 非采购入库
1. 点 "**新建批次**"
2. 字段 (8 字段):
   - 批次号 batchNo (可自动生成): `BATCH-20260416-001`
   - 原料类型 rawMaterialTypeId (必填)
   - 数量 quantity (必填, > 0)
   - 单位 unit
   - 单价 unitPrice
   - **totalWeight** (自动计算 = qty × unitWeight)
   - **totalValue** (自动计算 = qty × unitPrice)
   - 入库日期 inDate (默认今日)
   - 过期日期 expiryDate
   - 仓位 location
   - 来源 source: 手动 / 采购 / 期初
   - 备注
3. 保存

### ✅ PASS
- totalWeight / totalValue **自动联动**
- 库存实时更新

### 23.3.3 编辑批次
- 修改数量/过期日期/仓位
- 不可改批次号

### 23.3.4 批次详情
- Tab 基本信息
- Tab **使用历史** (哪些生产消耗了)
- Tab **质检记录**

### 23.3.5 批次状态
- `ACTIVE` — 可用
- `FRESH` — 新鲜
- `FROZEN` — 冷冻
- `RESERVED` — 预留
- `DEPLETED` — 用完
- `EXPIRED` — 过期
- `SCRAPPED` — 报废

### 23.3.6 过期日期高亮 (三级预警)
- **已过期**: 红色背景
- **30 天内到期**: 黄色高亮
- **60 天内到期**: 淡黄

### 23.3.7 批次转仓 (可选, 如有)
- 从仓位 A 移到仓位 B
- 记录移仓时间和操作人

### 23.3.8 批次搜索/筛选
- 关键字 (批次号/原料名)
- 按状态
- 按过期时间筛选 (已过期/30天内)

---

## 23.4 库存调整 (`/warehouse/inventory`) ⭐

### 场景
盘点 → 实际库存 vs 系统库存有差异 → 调整

### 23.4.1 库存调整
**账号**: `warehouse`
1. 进 `/warehouse/inventory` 或从批次详情
2. 点 "**库存调整**" 按钮
3. 字段:
   - 批次: 选
   - 调整类型 adjustmentType (必填):
     - `INCREASE` — 盘盈 (实际 > 系统)
     - `DECREASE` — 盘亏 (实际 < 系统)
     - `SCRAP` — 报损 (变质/损坏)
     - `CORRECTION` — 错账修正
   - 调整数量 adjustQty (必填, > 0)
   - 调整后数量 (自动 = 原数量 ± adjustQty)
   - **调整原因 reason (必填, 多行)**: `盘点发现实际少 5kg, 疑似被盗` 或 `仓库湿度高, 2kg 霉变`
   - 附件 (可选): 照片
4. 保存

### ✅ PASS ⭐
- Toast "调整成功"
- 批次数量 +/- 调整量
- 总库存相应变化
- 生成 **调整记录** (审计追溯用)

### ❌ FAIL
- 调整原因为空能提交 → 必填校验 bug
- 调整后数量为负 → 应阻止

### 23.4.2 调整历史查询
- 侧边 Tab "调整历史"
- 每次调整记录: 时间/操作人/类型/数量/原因

---

## 23.5 库存统计仪表板 (`/warehouse/inventory` 顶部)

### 23.5.1 KPI 卡片 × 4
| 卡片 | 说明 |
|------|------|
| 批次总数 | count(*) |
| 库存总量 | sum(quantity) |
| 低库存预警 | < safetyStock 的原料数 |
| 即将过期 | expiryDate < today + 30 |

### ✅ PASS
- 4 卡片实时更新
- 点卡片跳转到**筛选后列表** (如点 "低库存" 跳到低库存批次)

### 23.5.2 图表
- 各原料库存占比 (饼图)
- 库存趋势 (月度)

---

## 23.6 仓库出货 (`/warehouse/shipments`)

### 23.6.1 与 /sales/shipments 的区别
| 角度 | /sales/shipments | /warehouse/shipments |
|------|-----------------|--------------------|
| 角色 | sales | warehouse |
| 价格字段 | 可见 | **隐藏** (商业机密) |
| 发货触发 | 创建发货单 | 执行发货 |
| 数据 | 同一数据源, 不同视图 |

### 23.6.2 仓库新建出货单
**场景**: 无 SO 的临时出货 (如内部调拨/样品)
1. warehouse 进 `/warehouse/shipments`
2. 点 "**新建出货**"
3. 字段:
   - 出库类型: 销售 / 内部调拨 / 样品 / 报废
   - 产品
   - 数量
   - 目的地 / 收货方
   - 物流公司 / 司机 / 车牌
   - 备注
4. 保存

### 23.6.3 出货搜索/筛选
- 按状态 / 日期 / 产品

---

## 23.7 本节 Checklist (24 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 23.2.1 新建供应商 | purchase | ☐ |
| 2 | 23.2.2 编辑供应商 | purchase | ☐ |
| 3 | 23.2.2 删除 (有引用阻止) | purchase | ☐ |
| 4 | 23.2.3 搜索供应商 | purchase | ☐ |
| 5 | 23.2.4 启用/停用 | purchase | ☐ |
| 6 | 23.2.5 供应商评级 | purchase | ☐ |
| 7 | 23.2.6 详情 Tab 切换 | purchase | ☐ |
| 8 | 23.3.1 批次列表加载 | warehouse | ☐ |
| 9 | 23.3.2 手动新建批次 | warehouse | ☐ |
| 10 | 23.3.2 totalWeight/totalValue 自动 | warehouse | ☐ ⭐ |
| 11 | 23.3.3 编辑批次 | warehouse | ☐ |
| 12 | 23.3.4 批次详情 Tab | warehouse | ☐ |
| 13 | 23.3.5 批次状态流转 | warehouse | ☐ |
| 14 | 23.3.6 过期日期三级高亮 | warehouse | ☐ ⭐ |
| 15 | 23.3.8 批次筛选 (已过期) | warehouse | ☐ |
| 16 | 23.4.1 库存调整 (盘盈) | warehouse | ☐ ⭐ |
| 17 | 23.4.1 库存调整 (盘亏) | warehouse | ☐ ⭐ |
| 18 | 23.4.1 库存调整 (报损) | warehouse | ☐ ⭐ |
| 19 | 23.4.1 调整原因必填 | warehouse | ☐ |
| 20 | 23.4.2 调整历史查询 | warehouse | ☐ |
| 21 | 23.5.1 4 KPI 卡片 | warehouse | ☐ ⭐ |
| 22 | 23.5.1 点卡片跳转筛选列表 | warehouse | ☐ |
| 23 | 23.6.1 warehouse 出货价格隐藏 | warehouse | ☐ ⭐ |
| 24 | 23.6.2 仓库独立新建出货 | warehouse | ☐ |
