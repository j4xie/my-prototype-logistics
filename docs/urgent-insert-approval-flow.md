# 强制插单审批流程说明

## 一、概述

本文档描述了 S4-6 强制插单审批流程的完整实现，包括后端审批逻辑、前端审批UI、以及审批业务规则。

**版本**: 1.0.0
**日期**: 2025-12-31
**状态**: ✅ 已完成

---

## 二、架构设计

### 2.1 核心组件

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| **UrgentInsertServiceImpl** | `backend-java/.../service/impl/UrgentInsertServiceImpl.java` | 强制插单核心逻辑、审批状态管理 |
| **ApprovalChainService** | `backend-java/.../service/ApprovalChainService.java` | 审批链配置与规则引擎 |
| **SchedulingController** | `backend-java/.../controller/SchedulingController.java` | 审批REST API端点 |
| **ApprovalConfirmDialog** | `frontend/.../components/approval/ApprovalConfirmDialog.tsx` | 前端审批确认对话框 |
| **ApprovalListScreen** | `frontend/.../screens/dispatcher/plan/ApprovalListScreen.tsx` | 前端待审批列表页面 |
| **UrgentInsertScreen** | `frontend/.../screens/dispatcher/plan/UrgentInsertScreen.tsx` | 紧急插单创建页面（已更新） |

### 2.2 数据模型

#### ProductionPlan 审批字段

```java
@Column(name = "is_force_inserted")
private Boolean isForceInserted = false;  // 是否为强制插单

@Column(name = "requires_approval")
private Boolean requiresApproval = false;  // 是否需要审批

@Enumerated(EnumType.STRING)
@Column(name = "approval_status", length = 20)
private ApprovalStatus approvalStatus;  // PENDING, APPROVED, REJECTED

@Column(name = "approver_id")
private Long approverId;  // 审批人ID

@Column(name = "approver_name", length = 50)
private String approverName;  // 审批人姓名

@Column(name = "approved_at")
private LocalDateTime approvedAt;  // 审批时间

@Column(name = "approval_comment", length = 500)
private String approvalComment;  // 审批备注/理由

@Column(name = "force_insert_reason", length = 500)
private String forceInsertReason;  // 强制插单原因

@Column(name = "force_insert_by")
private Long forceInsertBy;  // 强制插单操作人ID

@Column(name = "force_inserted_at")
private LocalDateTime forceInsertedAt;  // 强制插单时间
```

---

## 三、业务规则

### 3.1 触发审批的条件

强制插单在以下情况下**需要审批**：

| 条件 | 优先级 | 说明 |
|------|--------|------|
| **影响等级 = HIGH/CRITICAL** | 高 | 影响2个以上计划，或导致紧急计划延误 |
| **高峰时段插单** | 中 | 8:00-18:00期间的插单操作 |
| **影响VIP客户** | 高 | 受影响计划中包含VIP客户订单 |
| **材料库存不足** | 中 | 资源冲突风险高 |

**判断逻辑**（ApprovalChainService）:

```java
boolean needsApproval = approvalChainService.requiresApproval(
    factoryId,
    DecisionType.URGENT_INSERT,
    context
);
```

### 3.2 自动审批规则

以下情况可**跳过审批**（自动批准）：

- 紧急程度为 `CRITICAL`（加急订单）
- 影响计划数 ≤ 1
- 影响等级为 `LOW` 或 `NONE`
- 非高峰时段 + 材料充足

### 3.3 审批超时规则

- **审批超时**: 24小时
- **超时处理**: 自动拒绝（通过定时任务实现）
- **定时任务**: `DelayDetectionScheduler`（每小时检查一次）

---

## 四、后端实现

### 4.1 API 端点

#### 1. 创建强制插单

```http
POST /api/mobile/{factoryId}/scheduling/urgent-insert/force
Content-Type: application/json

{
  "slotId": "SLOT-2025-001",
  "productTypeId": "PT001",
  "plannedQuantity": 500.0,
  "urgentReason": "客户紧急订单",
  "priority": 10,
  "forceInsert": true
}
```

**响应**:

```json
{
  "success": true,
  "message": "强制插单已提交，等待审批",
  "data": {
    "id": "PLAN-2025-001",
    "planNumber": "PLAN-2025-001",
    "approvalStatus": "PENDING",
    "requiresApproval": true,
    "forceInsertReason": "客户紧急订单"
  }
}
```

#### 2. 获取待审批列表

```http
GET /api/mobile/{factoryId}/scheduling/approvals/pending
```

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "PLAN-2025-001",
      "planNumber": "PLAN-2025-001",
      "approvalStatus": "PENDING",
      "forceInsertReason": "客户紧急订单",
      "priority": 10,
      "plannedQuantity": 500.0
    }
  ]
}
```

#### 3. 批准强制插单

```http
POST /api/mobile/{factoryId}/scheduling/approvals/{planId}/approve?comment=同意插单
```

**响应**:

```json
{
  "success": true,
  "message": "审批通过",
  "data": {
    "id": "PLAN-2025-001",
    "approvalStatus": "APPROVED",
    "approverId": 22,
    "approverName": "张经理",
    "approvedAt": "2025-12-31T14:30:00",
    "approvalComment": "同意插单"
  }
}
```

#### 4. 拒绝强制插单

```http
POST /api/mobile/{factoryId}/scheduling/approvals/{planId}/reject?reason=产能不足
```

**响应**:

```json
{
  "success": true,
  "message": "已拒绝",
  "data": {
    "id": "PLAN-2025-001",
    "approvalStatus": "REJECTED",
    "status": "CANCELLED",
    "approvalComment": "产能不足"
  }
}
```

### 4.2 核心方法实现

#### evaluateGuard() - 审批守卫

```java
@Override
public boolean evaluateGuard(String factoryId, Map<String, Object> context) {
    // 获取影响分析结果
    ChainImpactResult impact = (ChainImpactResult) context.get("chainImpact");
    if (impact == null) {
        return false;
    }

    // 规则1: 高影响必须审批
    if ("high".equals(impact.getImpactLevel()) || "critical".equals(impact.getImpactLevel())) {
        return true;
    }

    // 规则2: 影响超过2个计划
    if (impact.getDirectConflicts() >= 2) {
        return true;
    }

    // 规则3: 影响VIP客户
    if (Boolean.TRUE.equals(impact.getAffectsVipCustomer())) {
        return true;
    }

    // 规则4: 高峰时段 (8:00-18:00)
    int hour = LocalDateTime.now().getHour();
    if (hour >= 8 && hour < 18) {
        return true;
    }

    return false;
}
```

#### approveForceInsert() - 审批处理

```java
@Override
@Transactional
public ProductionPlanDTO approveForceInsert(
        String factoryId, String planId, Long approverId, boolean approved, String comment) {

    ProductionPlan plan = productionPlanRepository.findById(planId)
            .orElseThrow(() -> new RuntimeException("计划不存在"));

    // 验证计划状态
    if (!plan.isPendingApproval()) {
        throw new RuntimeException("该计划不在待审批状态");
    }

    User approver = userRepository.findById(approverId)
            .orElseThrow(() -> new RuntimeException("审批人不存在"));

    if (approved) {
        // 批准
        plan.approve(approverId, approver.getFullName(), comment);
        plan.setStatus(ProductionPlanStatus.PENDING);
    } else {
        // 拒绝
        plan.reject(approverId, approver.getFullName(), comment);
        plan.setStatus(ProductionPlanStatus.CANCELLED);

        // 释放时段
        releaseInsertSlot(factoryId, plan.getStartTime());
    }

    // 记录审批日志
    decisionAuditService.logApproval(
        factoryId, "ProductionPlan", planId,
        approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        comment, approverId, approver.getFullName()
    );

    return productionPlanMapper.toDTO(productionPlanRepository.save(plan));
}
```

---

## 五、前端实现

### 5.1 ApprovalConfirmDialog 组件

**功能**:
- 显示计划信息（计划编号、产品、数量、客户）
- 显示影响分析（影响等级、受影响计划数）
- 显示强制插单原因
- 提供批准/拒绝按钮
- 批准时可选填写备注
- 拒绝时必须填写拒绝原因

**使用示例**:

```tsx
<ApprovalConfirmDialog
  visible={showDialog}
  onClose={() => setShowDialog(false)}
  onApprove={async (comment) => {
    await schedulingApiClient.approveForceInsert(planId, comment);
  }}
  onReject={async (reason) => {
    await schedulingApiClient.rejectForceInsert(planId, reason);
  }}
  planData={{
    planNumber: "PLAN-2025-001",
    productName: "带鱼片",
    quantity: 500,
    impactLevel: "high",
    impactedPlanCount: 3,
    forceInsertReason: "客户紧急订单",
    customerName: "华联超市"
  }}
/>
```

### 5.2 ApprovalListScreen 页面

**功能**:
- 显示所有待审批的强制插单列表
- 按紧急程度排序（加急 > 紧急 > 普通）
- 点击卡片打开审批对话框
- 实时刷新列表
- 显示统计信息（待审批总数、加急数、紧急数）

**导航路由**:

```tsx
// 在 DSPlanStackNavigator.tsx 中添加
<Stack.Screen
  name="ApprovalList"
  component={ApprovalListScreen}
  options={{ headerShown: false }}
/>
```

### 5.3 UrgentInsertScreen 更新

**更新内容**:

1. 修复审批状态判断逻辑：

```tsx
// ❌ 旧代码
const needsApproval = plan.requiresApproval === true && plan.approvalStatus === 'PENDING';

// ✅ 新代码
const needsApproval = plan.approvalStatus === 'PENDING';
```

2. 优化提示信息：

```tsx
Alert.alert(
  needsApproval ? '提交审批成功' : '插单成功',
  needsApproval
    ? `紧急计划 ${plan.planNumber} 已创建，等待工厂经理审批。\n\n影响等级: 高\n受影响计划: 3 个`
    : `紧急计划 ${plan.planNumber} 已创建，可立即执行。`,
  [{ text: '确定', onPress: () => navigation.goBack() }]
);
```

---

## 六、测试指南

### 6.1 测试场景

#### 场景1: 正常审批流程

1. 调度员创建强制插单（影响等级=HIGH）
2. 系统自动标记为待审批（approvalStatus=PENDING）
3. 工厂经理在审批列表中查看
4. 工厂经理批准插单
5. 系统更新状态为APPROVED，计划状态变为PENDING
6. 调度员可以开始执行该计划

**预期结果**:
- ✅ 审批状态正确流转
- ✅ 审批日志正确记录
- ✅ 通知发送给相关人员

#### 场景2: 拒绝审批流程

1. 调度员创建强制插单
2. 工厂经理拒绝插单，填写拒绝原因"产能不足"
3. 系统更新状态为REJECTED，计划状态变为CANCELLED
4. 时段自动释放，可供其他插单使用

**预期结果**:
- ✅ 计划被取消
- ✅ 时段释放
- ✅ 通知发送

#### 场景3: 自动审批（跳过审批）

1. 调度员创建紧急插单（urgencyLevel=CRITICAL）
2. 影响等级=LOW
3. 系统自动批准，无需审批流程

**预期结果**:
- ✅ requiresApproval=false
- ✅ approvalStatus=null
- ✅ 计划直接进入PENDING状态

#### 场景4: 审批超时

1. 创建待审批计划
2. 等待24小时无人审批
3. 定时任务自动拒绝

**预期结果**:
- ✅ 状态变更为REJECTED
- ✅ 审批备注显示"审批超时自动拒绝"

### 6.2 API 测试命令

```bash
# 1. 创建强制插单
curl -X POST "http://localhost:10010/api/mobile/F001/scheduling/urgent-insert/force" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "SLOT-001",
    "productTypeId": "PT001",
    "plannedQuantity": 500,
    "urgentReason": "客户紧急订单",
    "priority": 10,
    "forceInsert": true
  }'

# 2. 获取待审批列表
curl -X GET "http://localhost:10010/api/mobile/F001/scheduling/approvals/pending" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. 批准插单
curl -X POST "http://localhost:10010/api/mobile/F001/scheduling/approvals/PLAN-001/approve?comment=同意" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. 拒绝插单
curl -X POST "http://localhost:10010/api/mobile/F001/scheduling/approvals/PLAN-001/reject?reason=产能不足" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 七、文件清单

### 7.1 后端文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `ProductionPlan.java` | ✅ 已完成 | 审批字段已添加 |
| `UrgentInsertServiceImpl.java` | ✅ 已完成 | 审批逻辑已实现 |
| `SchedulingController.java` | ✅ 已完成 | 审批API端点已添加 |
| `ApprovalChainServiceImpl.java` | ✅ 已完成 | 审批规则引擎已完成 |
| `DecisionAuditServiceImpl.java` | ✅ 已完成 | 审批日志记录已完成 |

### 7.2 前端文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `ApprovalConfirmDialog.tsx` | ✅ 新增 | 审批确认对话框组件 |
| `ApprovalListScreen.tsx` | ✅ 新增 | 待审批列表页面 |
| `UrgentInsertScreen.tsx` | ✅ 已更新 | 审批状态显示逻辑优化 |
| `schedulingApiClient.ts` | ✅ 已完成 | 审批API方法已添加 |
| `components/approval/index.ts` | ✅ 新增 | 组件导出文件 |

### 7.3 数据库迁移文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `V2025_12_29_8__add_production_plan_approval_fields.sql` | ✅ 已存在 | 审批字段迁移脚本 |

---

## 八、技术亮点

### 8.1 审批链配置化

使用 `ApprovalChainConfig` 实现审批规则配置化，支持：
- 动态配置触发条件
- 多级审批支持
- 自动审批/拒绝规则
- 审批人角色/用户ID配置

### 8.2 决策审计日志

所有审批操作记录到 `DecisionAuditLog`，包含：
- 决策类型
- 审批人信息
- 审批时间
- 审批理由
- 上下文数据（JSON）

### 8.3 链式影响分析

强制插单前进行完整的链式影响分析，包括：
- 直接冲突计划
- 级联延误计划
- VIP客户影响
- 资源冲突检测
- CR值变化预测

### 8.4 TypeScript 类型安全

前端严格遵守 TypeScript 类型安全规范：
- 避免使用 `as any`
- 使用明确的接口定义
- 使用类型守卫处理错误

---

## 九、后续优化建议

### 9.1 短期优化

1. **推送通知**: 审批状态变更时，推送通知给调度员和工厂经理
2. **批量审批**: 支持一次性批准/拒绝多个待审批项目
3. **审批历史**: 增加审批历史查看功能
4. **影响分析缓存**: 缓存影响分析结果，避免重复计算

### 9.2 长期优化

1. **多级审批**: 根据影响程度配置不同审批级别
2. **审批委托**: 支持审批人委托他人审批
3. **审批提醒**: 审批超过12小时未处理时发送提醒
4. **审批统计**: 审批通过率、平均审批时长等统计分析

---

## 十、总结

S4-6 强制插单审批流程已完整实现，包括：

✅ 后端审批逻辑（UrgentInsertServiceImpl）
✅ 审批链配置（ApprovalChainService）
✅ REST API端点（SchedulingController）
✅ 前端审批UI（ApprovalConfirmDialog + ApprovalListScreen）
✅ 审批状态显示（UrgentInsertScreen）
✅ 审批业务规则（影响等级、高峰时段、VIP客户）
✅ 决策审计日志（DecisionAuditLog）

**技术规范遵守**:
- ✅ TypeScript 类型安全
- ✅ 统一响应格式
- ✅ 错误处理规范
- ✅ 字段命名规范（camelCase）

**下一步**: 部署到测试环境，进行端到端测试验证。
