# 13. 已知 UI 缺失 / V2 Roadmap

**作用**: 测试**前先读**, 避免把这些当 bug
**来源**: 3 个 agent 调研 + playwright 真实验证发现

> **§13 vs §99 分工**:
> - **§13 (本文)** = **对客户**交付时的"已知边界 + V2 roadmap", 带客户话术, 外部可见.
> - **§99** = **内部 QA/Backend Lead** 的遗留追踪表, 带验证脚本 + 工作量估算, 不对外.
> - V2 项两边都有时, **客户看 §13.6, 内部看 §99.2-B**, 互相指引不重复解释.

---

## 13.1 已知 UI 缺失 (6 项)

测试遇到下面任一情况**不算 bug**, 跳过即可:

### 13.1.1 生产领料无 UI

**会议需求** (4.2): "生产人员通过扫码或手动录入方式, 录入领料信息, 系统自动扣库存"

**实际情况**:
- 前端**无页面**
- 后端有 API: `POST /api/mobile/{factoryId}/production/material-requisitions`
- 扣库存逻辑在**报工审批时批量执行**

**影响**:
- 客户看不到领料单
- 扣减时机晚 (理论上应领料就扣)

**V2 需求**:
- `/production/material-requisitions` 页面: 列表 + 新建 + 扫码
- 关联生产计划 + 选择原料批次 (FIFO)

### 13.1.2 研发样品 `request-quotation` 后端缺失

**前端按钮存在**: 样品 APPROVED 状态时, 销售点 "提交报价申请"
**后端 endpoint 缺失**: `POST /rd/samples/{id}/request-quotation` 404

**当前绕过**:
- 样品审核通过时后端**已自动创建报价任务**, 无需销售手动提交
- 报价人员直接在 Tab "报价任务" 列表执行

**V2 需求**:
- 后端补 endpoint, 让销售可补充: 报价优先级 / 期望交期 / 客户备注

### 13.1.3 销售订单财务审核无角色区分

**现象**: 审核按钮 (通过/驳回) 按**订单状态**显示, 不检查用户是否 finance

**影响**:
- 理论上 sales 能自己审自己的 SO (如果按钮可见)
- 实际上 sales 看不到按钮 (`canWrite('sales')` 控制整页, 但按钮内部未区分)

**V2 补救**: 前端加 `v-if="permissionStore.isFinance()"`

### 13.1.4 销售订单成本无分项拆解

**会议需求** (2.2): "系统自动拉取 BOM 标准成本 + 历史生产成本, 计算总成本 + 预期利润"

**实际**:
- UI 只显示最终 `estimatedProfit`
- **没有** BOM 成本 / 历史成本的分项显示

**V2 需求**:
详情页补 "**成本构成**" 折叠面板:
```
BOM 标准成本: ¥XXX
历史均价成本: ¥XXX
实际预计成本: ¥XXX
----
销售总金额: ¥XXX
预估毛利: ¥XXX (XX%)
```

### 13.1.5 到货入库无扫码

**会议需求** (3.3): "仓库通过扫码或手动录入方式"

**实际**:
- 只有**手动** el-input-number 输入
- 无相机/扫码组件

**V2 需求**:
- 接入浏览器相机 API (或 USB 扫码枪)
- 扫条码后自动填充实收数量

### 13.1.6 生产任务不自动从 SO 触发

**会议需求** (4.1): "系统自动动作: 根据已审核的销售订单 + BOM + 库存, 自动生成生产任务单"

**实际**:
- Production **必须手动**创建
- sourceType 虽有 `CUSTOMER_ORDER` 选项, 但不是自动

**V2 需求**:
- 接入 `TriggerChainService` 触发链
- SO `FINANCE_APPROVED` 事件后 auto-create 生产计划 draft
- 人工确认后下达

---

## 13.2 "死代码" / 认定非 bug (客户问起的话)

### 13.2.1 RBAC `*:*` 通配符

**现象**: `PermissionServiceImpl.hasPermission()` 里有 `*:*` 通配符匹配逻辑, 但**永远不执行**

**原因**: L213 `if (role == factory_super_admin) return true;` 已经前置短路

**影响**: 无 (不影响功能, 只是冗余代码)

**建议**: 若清理, V2 删除 matchPermission() 及相关死代码

---

## 13.3 部分修复项 (Apr-14 bug 清单)

### 13.3.1 Bug #3: 经营驾驶舱上传 "数据处理失败"

**修了**: 前端错误提示升级 → "请重新上传或选择系统数据"
**未修**: Java `DynamicAnalysisServiceImpl.analyzeDynamic()` 的真 SQL exception 被 `ErrorSanitizer` 吞掉

**V2 补救**: `SmartBIDashboardController.java:390` 加 `log.error("Dynamic analysis SQL detail", e)`

### 13.3.2 Bug #7: 工作流校验 404

**修了**: 新增 `/api/mobile/workflow/validate` endpoint + JwtAuth 排除列表加 "workflow"
**实际**: 前端 `validateWorkflow` 是**纯 JS 函数**, 不调这个 endpoint. 客户看到的 404 另有来源.

**V2 补救**:
- 排查前端 `getPublishedStateMachine` 等 API 路径拼接
- 或前端校验迁移到服务端

---

## 13.4 与客户沟通话术

客户发现以上任一 "缺失" 时:

| 情况 | 话术 |
|------|------|
| 生产领料没 UI | "当前 V1 聚焦核心流程, 领料数据在报工审批时批量扣减. V2 会补独立领料页面 + 扫码" |
| BOM 成本不显示 | "V1 默认看预估利润, 后续 V2 会加详细成本拆解面板 (BOM + 历史 + 实际)" |
| 收货没扫码 | "V1 手工录入. V2 会接扫码枪" |
| 生产不自动触发 | "V1 需手动确认 (避免误触发), V2 会接触发链自动化" |
| 研发报价按钮报错 | "后端调整中, 本周内修复. 现阶段审核通过后报价任务已自动生成, 直接去 Tab '报价任务' 操作" |

---

## 13.5 交付说明

以上 6 项**V1 不交付**, 客户应**提前知晓** (合同/SOW 里明确).

如果客户要求 V1 就完成, 评估工作量:

| 项 | 工作量 | 风险 |
|----|-------|------|
| 生产领料 UI | 3 天 | 低 |
| BOM 成本拆解 | 2 天 | 低 |
| 到货扫码 | 5 天 | 中 (硬件兼容) |
| 生产自动触发 | 3 天 | 中 (触发链稳定性) |
| 研发 request-quotation | 1 天 | 低 |

合计: ~14 天 (2 个 dev, 7 天)

---

## 13.6 V2 Roadmap 优先级 (供项目经理参考)

### P0 (V2 必做)
1. 生产领料 UI + 扫码
2. 到货扫码
3. 生产自动触发链

### P1 (V2 建议做)
4. SO 成本分项
5. 研发 request-quotation endpoint
6. 财务角色区分按钮

### P2 (未来迭代)
7. `*:*` 死代码清理
8. 更细粒度 RBAC
9. 多工厂跨域访问管控增强

---

## 13.7 下一步

读完本节, QA 知道什么不算 bug. 继续:
- [14-requirements-matrix.md](14-requirements-matrix.md) 正式对照表
- [15-automation.md](15-automation.md) 自动化测试
