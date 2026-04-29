# 05. 段 3 — 采购订单 + 三价同屏 + 财务审核 + 到货入库

**会议来源**: `研发样品至财务回款全流程文档.md` §3.1-3.3
**涉及角色**: purchase / finance / warehouse
**核心亮点**: **三价同屏 (BOM 标准价 / 移动均价 / 当前采购价)** + 差异预警
**耗时**: 20 min

---

## 5.1 流程总览

```
[前置: SO 审核通过 + 原料缺]
    ↓
采购员 新建采购单 (关联 SO)
    ↓ status=DRAFT
查看 三价对比分析 ⭐
    ↓
采购员 提交财务审核
    ↓ status=PENDING_FINANCE_REVIEW
财务 审核通过
    ↓ status=FINANCE_APPROVED
仓库 收货 (填实收数量)
    ↓ 生成收货单, status=RECEIVED
仓库 确认收货
    ↓ 自动生成物料批次, 库存 +N
    ↓ 回写 SO 状态 PARTIAL_RECEIVED / FULL_RECEIVED
```

---

## 5.2 新建采购订单 (关联 SO)

### 前置
- **账号**: `purchase / 123456`
- **URL**: `/procurement/orders`
- **前置**: 04 销售订单状态 `FINANCE_APPROVED`, 记下 SO ID
- **前置**: 至少 1 个供应商存在 (若无先到 `/procurement/suppliers` 创建)

### 步骤
1. 切账号 `purchase`
2. 侧边栏 "**采购管理**" → "**采购订单**"
3. 点 "**新建**" 按钮
4. 对话框弹出

### 字段
| 字段 | 组件 | 必填 | 示例值 |
|------|------|------|-------|
| 供应商 | el-select | ✅ | 选一个 (列表 `/suppliers`) |
| 采购类型 | el-select | ⚪ | `DIRECT` (或 URGENT) |
| **关联销售订单** | el-select | ⚪ | **选 04 的 SO ID** (关键!) |
| 期望交货日期 | el-date-picker | ⚪ | 3 天后 |
| 明细 items[] | 动态表格 | ✅ | 至少 1 行 |
| - 原料类型 | el-select | ✅ (行内) | 选一个 |
| - 数量 | el-input-number | ✅ (>0) | `50` |
| - 单价 | el-input-number | ✅ (>0) | **填一个高于均价的** (故意触发三价预警, 如 `30`) |
| 备注 | el-input textarea | ⚪ | `Part 2 测试采购单` |

### 关键: 为什么单价填高?
- 为了**触发三价对比预警**, 验证 "差异 > 10% 标红" 功能
- 若 BOM 标准价 = 25, 历史均价 = 26, 填 30 → 偏差 +20%, 触发预警
- 没数据的话, 预警验证跳过

### 操作
1. 选 **供应商**
2. 选 **关联销售订单** (下拉找 04 的 SO)
3. 添加 1 行明细:
   - 原料 → 选
   - 数量: `50`
   - 单价: `30`
4. 点 "**保存**"

### ✅ PASS
- Toast "**创建成功**"
- 采购单状态 `DRAFT`
- **Network**: `POST /api/mobile/F001/purchase/orders` 200
- **记下**: purchaseOrderNumber

### ❌ FAIL
- 供应商下拉空 → 先创建供应商
- 原料下拉空 → 后端 `/raw-material-types` 数据为空

---

## 5.3 ⭐ 三价同屏验证 (核心亮点)

### 前置
- 5.2 采购单已创建
- 采购单详情页打开

### 步骤
1. 采购单列表点采购单号进详情
2. 详情页找 **折叠面板**: "**三价对比分析**"
3. 点 ⌄ 展开面板
4. 系统自动调 API `GET /api/mobile/F001/purchase/orders/{id}/price-comparison`

### 表格结构 (6 列)
| 列 | 说明 | 示例 |
|----|------|------|
| 原料名称 | - | 辣椒 |
| **BOM 标准价** | 从样品 BOM 拉取 | ¥25.00 |
| **移动均价** | 近 N 次采购均值 | ¥26.50 |
| **当前采购价** | 本单单价 | ¥30.00 |
| BOM 偏差 | (当前 - BOM)/BOM | **+20%** (红色, variance-up) |
| 均价偏差 | (当前 - 均价)/均价 | +13.2% (红色) |
| 预警 | 差异 > 10% | 🔴 `异常` tag |

### 表头橙色提示
若任一行偏差 > 10%, 表头显示:
```
⚠️ 存在价格偏差超过 10% 的原料, 请关注标红行
```

### ✅ PASS ⭐
- 面板能展开
- 3 列价格都有**数值** (非 null / "-")
- 偏差列用**颜色区分**:
  - 正偏差 (上涨): 红色 `.variance-up`
  - 负偏差 (下降): 绿色 `.variance-down`
- **> 10% 差异** 预警列显示 `el-tag type="danger"` "异常"
- 表头若有预警显示橙色文字

### ❌ FAIL
- 面板展开后数据空 (空白表格)
- 所有价格都是 0 或 null → 后端价格服务异常
- 偏差 > 10% 但未标红 → 前端逻辑漏

### 边缘情况
- **首次采购**: 没有移动均价 (历史均价), 应显示 "无历史" 或 N/A, 不报错
- **样品无 BOM**: BOM 标准价 N/A, 不阻止显示

### Network 验证
`GET /api/mobile/F001/purchase/orders/{id}/price-comparison` 返回:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "materialName": "辣椒",
        "bomStandardPrice": 25,
        "movingAvgPrice": 26.5,
        "currentPrice": 30,
        "varianceFromBom": 0.20,
        "varianceFromAvg": 0.132,
        "priceAlert": true
      }
    ]
  }
}
```

---

## 5.4 采购单提交财务审核

### 步骤
1. 采购单详情页点 "**提交审核**" 按钮
2. 弹确认
3. 点 "**确定**"

### ✅ PASS
- 状态变 `PENDING_FINANCE_REVIEW`

---

## 5.5 财务审核采购单

### 前置
- **账号**: `finance / 123456` (**切号!**)
- 采购单状态 `PENDING_FINANCE_REVIEW`

### 步骤
1. 切 finance
2. 进采购单详情
3. 详情页右上角两按钮:
   - "**财务通过**" (绿)
   - "**财务驳回**" (红)
4. **先看三价对比** (验证 finance 也能看到差异预警)
5. 点 "**财务通过**" (或驳回)
6. 弹 prompt 输意见 (通过可选, 驳回必填)
7. 点 "**确定**"

### ✅ PASS
- Toast "**审核通过**" / "**驳回成功**"
- 状态变 `FINANCE_APPROVED` / `FINANCE_REJECTED`
- **Network**: 
  - `POST /api/mobile/F001/purchase/orders/{id}/finance-approve` 200
  - 或 `.../finance-reject` 200

### ❌ FAIL
- finance 看不到审核按钮 (权限漏)

---

## 5.6 到货收货 (仓库)

### 前置
- **账号**: `warehouse / 123456` (**切号!**)
- 采购单状态 `FINANCE_APPROVED` 或 `PARTIAL_RECEIVED`

### 步骤
1. 切 warehouse
2. 进采购单详情
3. 状态符合时, 右上角出现 "**收货**" 按钮
4. 点 "**收货**"
5. 弹对话框 `receiveDialogVisible`

### 字段 (对话框)
| 字段 | 组件 | 必填 | 默认/示例 |
|------|------|------|---------|
| 供应商 | el-input (**只读**) | - | 自动填 (来自采购单) |
| 收货日期 | el-date-picker | ⚪ | 默认今天 |
| 明细 items[] | 动态表格 | ✅ | 自动填采购数量, 可改 |
| - 原料名称 | 只读 | - | - |
| - 订购数量 | 只读 | - | 50 |
| - **实收数量** | el-input-number | ✅ | 50 (可调) |
| - 批次号 | el-input | ⚪ | 可空 (自动生成) |
| - 仓位 | el-input | ⚪ | 可空 |

### 操作
1. 检查供应商/收货日期正确
2. 每行 **实收数量** 默认等于订购数量
3. 如部分到货, 调整为实际到货数 (如 50 → 30)
4. 点 "**确认收货**"

### ✅ PASS
- Toast "**收货成功**"
- 生成**收货单号** (记下, 可能需要)
- 采购单状态变:
  - 完全到货 → `RECEIVED`
  - 部分到货 → `PARTIAL_RECEIVED` (下次可再收)

### Network
- `POST /api/mobile/F001/purchase/receives` 200 (创建收货单)

### ⚠️ 已知限制
**无扫码 UI**. 客户需求说 "扫码或手动录入", 当前**只有手动 el-input-number**. 收货员需要手动核对到货单据后填数.

V2 补救: 接入相机组件或 USB 扫码枪.

---

## 5.7 确认入库 (生成物料批次)

### 步骤
1. 收货单列表找刚创建的收货单
2. 点 "**确认入库**" 按钮

### ✅ PASS
- Toast "**入库成功**"
- **生成物料批次** (MaterialBatch, 后续生产领料用)
- **库存自动增加**: 对应原料库存 +30 (实收数量)
- **回写采购单状态** (ALL_RECEIVED 或 PARTIAL)

### Network
- `POST /api/mobile/F001/purchase/receives/{id}/confirm` 200

### 验证库存
1. 切到 `/warehouse/materials` 或 `/warehouse/materials`
2. 找对应原料的批次
3. 应该看到新批次, 数量 = 实收数量, 状态 ACTIVE

---

## 5.8 跨模块数据流 (段 3 → 段 4)

完成段 3 后:
- **原料库存** 增加 (段 4 生产领料可扣减)
- **采购单状态** 更新到 SO 的采购进度
- **SO 详情页 Tab "采购订单"** 应能看到关联的采购单
- **生产计划**若已创建 (sourceType=CUSTOMER_ORDER 关联 SO), 原料充足后可以开始

跳到 [06-production.md](06-production.md) §6.2 创建生产计划.

---

## 5.9 本节 Checklist (13 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 5.2 采购单创建 toast | purchase | ☐ |
| 2 | 5.2 关联销售订单下拉有选项 | purchase | ☐ |
| 3 | 5.3 三价对比面板能展开 | purchase | ☐ ⭐ |
| 4 | 5.3 3 列价格都有值 | purchase | ☐ ⭐ |
| 5 | 5.3 > 10% 偏差标红 + 预警 tag | purchase | ☐ ⭐ |
| 6 | 5.3 表头橙色提示 (如有预警) | purchase | ☐ |
| 7 | 5.4 采购单提交审核 状态变化 | purchase | ☐ |
| 8 | 5.5 finance 审核通过 | finance | ☐ ⭐ |
| 9 | 5.5 finance 能看到三价对比 | finance | ☐ |
| 10 | 5.6 收货对话框弹出 | warehouse | ☐ |
| 11 | 5.6 实收数量默认=订购数量可改 | warehouse | ☐ |
| 12 | 5.7 确认入库 + 库存增加 | warehouse | ☐ ⭐ |
| 13 | 5.8 SO 详情页显示关联采购单 | sales/admin | ☐ |

⭐ = 核心验证

---

## 5.10 已知限制

| 项 | 影响 | V2 补救 |
|---|------|---------|
| 收货无扫码 UI | 员工手动录入易出错 | 补相机/扫码枪组件 |
| 首次采购无历史均价 | 三价只有 2 价 | 显示 "无历史" 不阻塞 |
| 无供应商评分联动 | 采购时不提示供应商质量 | V2 接入 supplier_rating |

---

## 5.11 下一步

段 3 完成 (原料入库). 下一步:
- 段 4 [06-production.md](06-production.md) 开始生产
