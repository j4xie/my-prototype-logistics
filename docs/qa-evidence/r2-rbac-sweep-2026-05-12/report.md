# R2 RBAC Sweep — Result Report

PR #443 state: OPEN

## Verdict summary

| Cell | Role | Expected | Status | Verdict | Rationale |
|---|---|---|---|---|---|
| C1 | admin | REAL | 200 | ✅ PASS | admin sees 30 non-null price field(s) (sampled: $.data.content[0].totalValue=3000.0) |
| C1 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C1 | operator | STRIP | 200 | ✅ PASS | operator sees all annotated price fields stripped |
| C2 | admin | REAL | 200 | ✅ PASS | admin sees 3 non-null price field(s) (sampled: $.data.totalValue=3000.0) |
| C2 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C2 | operator | STRIP | 200 | ✅ PASS | operator sees all annotated price fields stripped |
| C3 | admin | REAL | 200 | ⚠️ WARN | admin got 200 but payload has no price fields visible — possibly empty factory data, cell uninformative |
| C3 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C3 | operator | STRIP | 200 | ✅ PASS | operator sees all annotated price fields stripped |
| C4 | admin | REAL | 200 | ⚠️ WARN | admin got 200 but payload has no price fields visible — possibly empty factory data, cell uninformative |
| C4 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C4 | operator | STRIP | 200 | ✅ PASS | operator sees all annotated price fields stripped |
| C5 | admin | REAL | 200 | ⚠️ WARN | admin got 200 but payload has no price fields visible — possibly empty factory data, cell uninformative |
| C5 | warehouse_mgr | NEEDS_REVIEW | 200 | 🟡 NEEDS_REVIEW | E5 valuation: warehouse_mgr sees 0 non-null price field(s). Strip-only design per §5.2 — Steve decides if whole-endpoint deny needed. |
| C5 | operator | NEEDS_REVIEW | 200 | 🟡 NEEDS_REVIEW | E5 valuation: operator sees 0 non-null price field(s). Strip-only design per §5.2 — Steve decides if whole-endpoint deny needed. |
| C6 | admin | REAL | 200 | ✅ PASS | admin sees 60 non-null price field(s) (sampled: $.data.content[0].totalAmount=3000.0) |
| C6 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C6 | operator | 403 | 403 | ✅ PASS | operator correctly denied: 您的角色 [操作员] 在 [采购管理] 模块无 [读写 / 读取] 权限 |
| C7 | admin | REAL | 200 | ✅ PASS | admin sees 6 non-null price field(s) (sampled: $.data.totalAmount=3000.0) |
| C7 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C7 | operator | 403 | 403 | ✅ PASS | operator correctly denied: 您的角色 [操作员] 在 [采购管理] 模块无 [读写 / 读取] 权限 |
| C8 | admin | REAL | 200 | ✅ PASS | admin sees 25 non-null price field(s) (sampled: $.data.content[0].totalAmount=3000.0) |
| C8 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C8 | operator | 403 | 403 | ✅ PASS | operator correctly denied: 您的角色 [操作员] 在 [采购管理] 模块无 [读写 / 读取] 权限 |
| C9 | admin | REAL | 200 | ✅ PASS | admin sees 79 non-null price field(s) (sampled: $.data.content[0].totalAmount=5000.0) |
| C9 | warehouse_mgr | 500 | 200 | ⚠️ WARN | unexpected: expected 500-KNOWN but got 200 — PR #443 may have merged; rerun with detection |
| C9 | operator | 403 | 403 | ✅ PASS | operator correctly denied: 您的角色 [操作员] 在 [销售管理] 模块无 [读写 / 读取] 权限 |
| C10 | admin | REAL | 200 | ✅ PASS | admin sees 8 non-null price field(s) (sampled: $.data.totalAmount=5000.0) |
| C10 | warehouse_mgr | 500 | 200 | ⚠️ WARN | unexpected: expected 500-KNOWN but got 200 — PR #443 may have merged; rerun with detection |
| C10 | operator | 403 | 403 | ✅ PASS | operator correctly denied: 您的角色 [操作员] 在 [销售管理] 模块无 [读写 / 读取] 权限 |
| C11 | admin | REAL | 200 | ✅ PASS | admin sees 6 non-null price field(s) (sampled: $.data.overview.kpiCards[0].rawValue=0) |
| C11 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C11 | operator | STRIP | 200 | ✅ PASS | operator sees all annotated price fields stripped |
| C12 | admin | REAL | 200 | ⚠️ WARN | admin got 200 but payload has no price fields visible — possibly empty factory data, cell uninformative |
| C12 | warehouse_mgr | STRIP | 200 | ✅ PASS | warehouse_mgr sees all annotated price fields stripped |
| C12 | operator | STRIP | 200 | ✅ PASS | operator sees all annotated price fields stripped |

## Summary counts

- 🟡 NEEDS_REVIEW: 2
- ✅ PASS: 28
- ⚠️ WARN: 6

## Acceptance

- 0 FAIL: ✅
- WARN/NEEDS_REVIEW need explanation: 8

## Per-cell leak detail
