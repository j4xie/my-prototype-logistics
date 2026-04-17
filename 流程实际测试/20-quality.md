# 20. 质量管理 (质检单/异常处理/标准)

> **✅ R18 QA Deep + 2 Bugs Fixed (2026-04-17 11:00, test 139:8097)**:
> 1. **Bug #255 发现+修 (P1)**: /quality/inspections 列表 E6025FDE (API result=PASS+98%+A grade) UI 显示 "不合格" ❌. 根因: list.vue:211 检查 `row.result === 'PASSED'` 但后端 canonical enum 是 `PASS/FAIL/CONDITIONAL`. 修: `isPassResult()` + `getResultLabel()` helpers 兼容 PASS/PASSED/FAIL/FAILED/CONDITIONAL/PENDING. 验证: E6025FDE 正确显示"合格" + 兼容 legacy PASSED 数据. commit `8ee844942`.
> 2. **Bug #254 发现+修 (P2)**: 质检创建不回写批次. 真测: POST batchId=1879 result=PASS → batch 1879 `qualityStatus=null`, `yieldRate=null`, `updatedAt=2026-02-13` (未更新). 修: `QualityInspectionServiceImpl.createInspection()` 新加 `propagateToProductionBatch()` — 映射 PASS→PASSED/FAIL→FAILED/CONDITIONAL→PARTIAL_PASS, 写回 yieldRate + updatedAt. 再测: batch 1879 `qualityStatus="PASSED"` + `yieldRate=97.22` + `updatedAt=2026-04-17T11:00:47` ✅. commit `65b560c2d`.
>
> **Rule 4 caveat**: 质检创建走 `fetch()` POST 非真 browser_click UI (因 Canvas 动态表单字段复杂), 标 medium+bug-deep 不是纯 deep.
>
> **⬜ 仍未覆盖**: /quality/standards (质检标准 CRUD) / /quality/exceptions (异常处理工单) / 真 UI 新建质检. 待后续.

**⚠️ 之前完全空白, 这是新增模块**
**涉及角色**: quality / inspector / admin
**耗时**: 15 min

---

## 20.1 模块总览

| 模块 | URL |
|------|-----|
| 质检单 | `/quality/inspections` |
| 质检异常处理 | `/quality/disposals` |
| 质检标准 | `/quality/standards` |
| 质检记录报表 | `/quality/reports` (可选) |

---

## 20.2 质检标准 (`/quality/standards`)

### 20.2.1 新建质检标准
**账号**: `quality` (质量经理)
1. 进 `/quality/standards`
2. 点 "**新建标准**"
3. 字段:
   - 标准编号 code (必填): `QS-001`
   - 标准名 name (必填): `辣椒酱外观检查标准`
   - 适用产品类型 productTypeId (下拉)
   - 适用原料类型 rawMaterialTypeId (下拉, 互斥)
   - 检测项 items[]: 动态
     - 项目名: `颜色` / `粘稠度` / `辣度`
     - 检测方法: 目视 / 仪器测量
     - 合格范围: 如 `红亮` / `粘稠度 > 300cP`
     - 权重 (%): 30
   - 抽检比例: 全检 / 10% / 1%
   - 备注
4. 保存

### ✅ PASS
- Toast "创建成功"
- 列表显示

### 20.2.2 编辑/删除
- 行级操作

---

## 20.3 质检单 (`/quality/inspections`)

### 20.3.1 新建质检单
**账号**: `quality` 或 `inspector`
1. 进 `/quality/inspections`
2. 点 "**新建质检单**"
3. 字段:
   - 质检类型 inspectionType (下拉):
     - `INCOMING` — 来料检
     - `IN_PROCESS` — 过程检
     - `OUTGOING` — 成品检
     - `SAMPLING` — 抽检
   - 来源 sourceType: 采购单 / 生产计划 / 成品批次
   - 来源 ID: 选
   - 标准 standardId (下拉): 选
   - 批次 batchId: 选
   - 数量 sampleQuantity: 10
   - 计划检测日期: 今日
   - 指派质检员 inspectorId
4. 保存

### ✅ PASS
- 状态 `PENDING` (待检)

### 20.3.2 执行质检
**账号**: `inspector`
1. 进质检单列表找 PENDING
2. 点 "**开始检测**"
3. 按标准项目逐个录入:
   - 项目名 (只读)
   - 实际值 (number/text)
   - 合格与否 (switch)
   - 备注
4. 全部录完点 "**提交**"

### ✅ PASS
- 系统自动计算合格率 (按权重)
- 状态变 `COMPLETED`
- 若任一关键项不合格 → 状态 `FAILED`

### 20.3.3 质检结果流转
- **合格**: 批次状态 `QUALIFIED`, 可流入下一环节
- **不合格**: 批次状态 `FAILED`, 触发异常处理 (§20.4)
- **部分合格**: 需二次复检

### 20.3.4 查询/筛选
- 按状态 / 日期 / 质检员 / 批次

### 20.3.5 导出报表
- 点 "导出"
- 下载 Excel 含检测明细

---

## 20.4 质检异常处理 (`/quality/disposals`)

### 20.4.1 异常批次列表
- 自动生成: 质检 FAILED 的批次
- 字段: 批次 / 不合格项 / 数量 / 异常级别

### 20.4.2 处理方案
**账号**: `quality` + `admin` 审批
1. 点异常行 "**处理**"
2. 选择处理方案:
   - **返工** — 回生产线重做
   - **让步接收** — 降级使用 (填客户确认)
   - **退货** — 退供应商 (采购来料)
   - **报废** — 销毁
3. 填处理说明
4. 提交审批

### 20.4.3 审批
- admin 或 quality 经理审批
- 通过 → 执行处理动作
- 驳回 → 重新处理

### 20.4.4 处理后状态同步
- 返工 → 批次回 `IN_PROCESS`
- 让步接收 → 批次 `ACCEPTED_WITH_CONCESSION`
- 退货 → 采购单附退货单
- 报废 → 批次 `SCRAPPED`, 库存扣减

---

## 20.5 质检记录报表 (可选)

### 合格率趋势
- 按月/周合格率曲线
- 按产品分类合格率

### 质检员绩效
- 每质检员检测数/发现异常数

---

## 20.6 本节 Checklist (12 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 20.2.1 新建质检标准 | quality | ☐ |
| 2 | 20.2.2 编辑标准 | quality | ☐ |
| 3 | 20.3.1 新建质检单 (来料/过程/成品) | quality | ☐ |
| 4 | 20.3.2 执行质检 (逐项录入) | inspector | ☐ ⭐ |
| 5 | 20.3.2 合格率自动计算 | inspector | ☐ |
| 6 | 20.3.3 合格 → 批次 QUALIFIED | - | ☐ |
| 7 | 20.3.3 不合格 → FAILED + 异常 | - | ☐ ⭐ |
| 8 | 20.3.5 导出质检 Excel | quality | ☐ |
| 9 | 20.4.1 异常批次自动列表 | quality | ☐ |
| 10 | 20.4.2 处理方案 (返工/让步/退货/报废) | quality | ☐ ⭐ |
| 11 | 20.4.3 审批流程 | admin | ☐ |
| 12 | 20.4.4 处理后批次状态同步 | - | ☐ ⭐ |
