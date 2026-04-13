# Canvas V3 Handoff — R10-R28 (Apr 11-12 2026)

## 一句话总结

Canvas V3 执行履行度从 27% 推到 80%+, 经过 88 项 E2E 验证 (84 PASS), 12 个 bug 修复, 18 次部署, 配置传播全链路在 prod 真实工作.

## 关键成果

| 指标 | 开始 | 结束 |
|---|---|---|
| Canvas 执行履行度 | 27% | 80%+ |
| E2E 验证项 | 0 | 88 (84 PASS + 4 WARN) |
| Rounds | R10 | R28 (19 rounds) |
| Deploys | 0 | 18 (0 failures) |
| JUnit tests | 0 | 30 |
| Bugs found + fixed | 0 | 12 |
| HANDLED_EVENTS | 16 | 25 |
| Template-covered services | 5 | 18/18 |
| Frontend components | 0 | CanvasDynamicFields + CanvasAwareWrapper |
| Canvas editor tabs verified | 4/7 | 7/7 |

## 12 Bugs Fixed

| # | Bug | Round | Severity |
|---|---|---|---|
| 1 | DynamicModulePage missing defineProps | R22c | HIGH |
| 2 | DDLExecutor STRING→VARCHAR(500) mapping | R24 | HIGH |
| 3 | computedWhen infinite loop (deep watcher) | R22 | HIGH |
| 4-7 | Form reset drops customFields (×4 modules) | R22 | MEDIUM |
| 8 | WorkflowDesigner reads config.workflow (undefined) | R25 | MEDIUM |
| 9 | PermissionMatrix save() is a no-op stub | R25 | MEDIUM |
| 10 | findByModuleCodeForFactory includes DISABLED fields | R26 | MEDIUM |
| 11 | change-type SQL error on PENDING_DDL fields | R26 | MEDIUM |
| 12 | Browser back button exits DynamicModulePage | R28 | LOW |

Plus R27 fixes (not Canvas bugs but found during Canvas testing):
- taxRate not persisted to sales_order_items
- Sub-table JDBC uuid cast (?::uuid → CAST(? AS uuid))

## E2E Verification Coverage

### Infrastructure (R10-R22)
- Login, Canvas rendering switch, DynamicModulePage CRUD
- Data persistence (write→read consistent)
- Cross-factory isolation (field + order level)
- Trigger chain execution (prod log evidence)
- Validation rule real blocking (<500元 拦截)
- Onboarding wizard 4 steps
- Editor 7/7 tabs
- Full field lifecycle (add→publish→DDL→form render)

### Deep Verification (R24-R26)
- Sub-table CRUD, Import/Export, Rollback
- Permission matrix enforcement (Worker 5 fields hidden)
- Optimistic lock, Pagination, Audit log
- visibleWhen UI (23→24 fields), computedWhen UI ("普通"→"加急")
- Required validation (empty submit blocked)

### Security (R26)
- SQL injection: fieldCode regex whitelist ✅
- RBAC: Worker→admin endpoints 403 ✅
- Cross-factory: read/update/cancel all blocked ✅

### User Journey (R28)
- Full CRUD through browser UI: 12/12 PASS
- Config propagation: add field→publish→form shows it immediately ✅

## Known Limitations

1. **DynamicModulePage 不支持 URL 直接访问详情** — 用 selectedRow state 不是 URL params
2. **Token 过期不主动重定向** — 401 interceptor 被动处理
3. **tax_group_sum formula 空** — expression 用 SUM('amount') 但 items 表无 amount 列 (需改为 SUM(quantity * unit_price))
4. **Custom labels 未配** — 功能存在但 FOOD_3101_038 工厂没用
5. **Search/filter in DynamicModulePage** — SchemaTableRenderer 无搜索框

## Worktree

`my-prototype-logistics-r12` on main branch. 所有代码和测试都在这里.

## 测试脚本

```
tests/canvas-e2e/
├── test-canvas-final-e2e.mjs          # 基础 11 项
├── test-canvas-final-results.json
├── test-canvas-modules-e2e.mjs        # 多模块
├── test-canvas-modules-results.json
├── test-canvas-completeness-e2e.mjs   # 完整性 16 项
├── test-canvas-completeness-results.json
├── test-canvas-e2e-fullstack.mjs      # 前后端一体 15 项
├── test-canvas-security.mjs           # 安全 10 项
├── test-canvas-security-results.json
└── test-canvas-user-journey.mjs       # 用户旅程 12 项
```

## 下一步建议

1. **SmartBI P5.6 smoke test** — 运行时验证未跑
2. **客户 demo 路径** — 六扇门完整业务链路
3. **tax_group_sum formula fix** — 改 expression 匹配表结构
4. **DynamicModulePage search** — 加 SchemaTableRenderer 搜索能力
5. **更多工厂切 CANVAS mode** — 目前只有 sales_order + bom 是非 LEGACY
