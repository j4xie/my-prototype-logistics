# Task #371 RBAC Gap 修复 (DepartmentController + WorkOrderController)

> **✅ FIXED in test (2026-04-20 11:28 CST)** · Prod 未部

## 范围纠正

原 sweep agent 列了 10 个 controller 为 same-cause gap. 实际深入 review 发现:

- **Customer/Supplier/BOM/Shipment/PriceList**: 文件注释明确标记 Bug #318 (Apr 18 2026) 的**有意设计** — reads 保留开放, 只 gate POST/PUT/DELETE. 不改.
- **UserController**: 虽然 agent 列为 gap, 实际已 gated 8/16 (剩余 7 个是 self-data / cross-module / form 校验, 合理保留开放).
- **真实 gap**: DepartmentController + WorkOrderController

## 修复清单

### DepartmentController
| GET | 改动 | 理由 |
|---|---|---|
| `@GetMapping` (getDepartments) | +`@RequirePermission({"hr:read"})` | HR 模块核心读 |
| `@GetMapping("/active")` | +`@RequirePermission({"hr:read"})` | HR 下拉源 |
| `@GetMapping("/{id}")` | +`@RequirePermission({"hr:read"})` | 详情 |
| `@GetMapping("/search")` | +`@RequirePermission({"hr:read"})` | 搜索 |
| `@GetMapping("/tree")` | +`@RequirePermission({"hr:read"})` | 树形 |
| `@GetMapping("/check-code")` | **保留开放** | 创建前表单校验 |

### WorkOrderController
| GET | 改动 | 理由 |
|---|---|---|
| `@GetMapping` (getWorkOrders) | +`@RequirePermission({"production:read"})` | 生产模块核心读 |
| `@GetMapping("/stats")` | +`@RequirePermission({"production:read"})` | 生产 dashboard 数据 |
| `@GetMapping("/overdue")` | +`@RequirePermission({"production:read"})` | 逾期工单 |
| `@GetMapping("/my")` | **保留开放** | 自己的工单 (self-data 类, operator 需访问) |
| `@GetMapping("/{id}")` | +`@RequirePermission({"production:read"})` | 工单详情 |

## E2E 验证 (test 10011)

```
factory_admin1 (super_admin 短路) — 全通过:
  GET /departments → 200
  GET /work-orders → 200
  GET /rd/samples → 200

dispatcher (L2 hr=- / production=-):
  GET /departments → 403
    body.message:  "您的角色 [调度] 在 [人事管理] 模块无 [读取] 权限"
    body.actionHint: "请联系工厂管理员在 Canvas → 模块权限 矩阵为角色 [调度] 开通 [人事管理] 的 [读取] 权限, 或切换到有权限的账号重试"
  GET /work-orders → 403
    body.message:  "您的角色 [调度] 在 [生产管理] 模块无 [读取] 权限"
    body.actionHint: 对应 [生产管理] 开通指引
  GET /work-orders/my → 200 (self-data 保留开放 ✅)

L2 reset 后 dispatcher 恢复 200.
```

## 本轮 vs 延后

**本轮 (test deploy completed)**:
- DepartmentController (5 gate + 1 open)
- WorkOrderController (4 gate + 1 open)

**延后 (Bug #318 design, 故意开放 — 不改)**:
- CustomerController, SupplierController, BomController, ShipmentController, PriceListController

**P2 (低优先级, 另起 task 评估)**:
- EquipmentController, VehicleController, ProductTypeController

## Prod 未部

按用户硬规则, 等明确授权后再 `--env prod`.

## 签名

Claude, session `00bad8b0`, 2026-04-20 11:28 CST.
