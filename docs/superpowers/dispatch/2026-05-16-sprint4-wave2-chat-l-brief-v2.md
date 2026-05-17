# Sprint 4 Wave 2 Chat L — Brief v2

**Created**: 2026-05-16
**Total**: 24 days, 8 items (Vue web-admin + minimal Java backend)
**Worktree**: `.claude/worktrees/sprint4-wave2-chat-l` on branch `worktree-sprint4-wave2-chat-l`

## §0 Pre-flight verified facts

| Item | Verified |
|---|---|
| `web-admin/src/views/{sales,procurement,production,...}` | 27 view dirs exist (NOT `purchase/`) |
| `frontend/CretasFoodTrace/src/screens/{factory-admin,warehouse,restaurant,dispatcher,...}` | RN role-keyed dirs |
| `web-admin/src/components/smartbi/DashboardBuilder.vue` | drag-drop layout pattern (C-WIDGET-1 reuse) |
| `web-admin/src/views/platform/canvas-editor/components/WorkflowDesigner.vue` | drag-drop reuse |
| `backend/.../entity/CustomerTrackingRecord.java` + Repository | EXIST (Sprint 1) |
| `backend/.../controller/CustomerTrackingRecord*` | **DOES NOT EXIST** — S-CRM-1 needs Controller |
| PR #678 (Sprint2-H U-ACT-1) `RowActionBottomSheet`/`RowActionMenu` + 16 lists wired | shipped 2026-05-16 |
| PR #694 (Sprint3-H BomVersion) | shipped 2026-05-16 |
| `marked` markdown lib in web-admin | TBD (Day 12 verify) |

## §0.5 Brief drift fixes (from v1 brief audit)

1. **`purchase/` → `procurement/`** (path) — U-VIEW-1 wiring corrected.
2. **U-MARKER-1 "Wave 1 Chat A done" was unverified** — 0 PR / 0 commit / 0 source ref. Steve confirmed Chat L owns 1d. v2 = 8 items 24d.
3. **U-ICON-1 vs PR #678 U-ACT-1 scope distinction**:
   - U-ACT-1 (shipped) = long-press / "▾" button → dropdown menu, 8-14 secondary actions
   - U-ICON-1 (Chat L) = hover-on-row → row末 inline icons, 7 primary actions, single-click
   - Reuse `useRowActions.ts` core (computeRowActions for RBAC), add `inlineIcons()` helper
4. **S-CRM-1 needs +1d Java Controller** (entity/repository exist, controller missing). Steve confirmed Chat L owns Java+Vue.

## 8 items × 24 days

### 1. U-VIEW-1 (3d) — List view 5-mode switcher
- **New**: `web-admin/src/components/list/ViewModeSwitcher.vue`
- Modes: `table` (existing) / `grid` (new) / `kanban` (new) / `timeline` (placeholder + Sprint 5 TODO) / `calendar` (placeholder + Sprint 5 TODO)
- Pilot: `sales/orders/list.vue` + `procurement/orders/list.vue`
- localStorage persistence per `route.name`
- vitest: `ViewModeSwitcher.spec.ts` (5-mode switch + persistence)

### 2. U-NEW-1 (4d) — Create dialog 4-mode selector
- **New**: `web-admin/src/components/dialog/CreateModeSelector.vue`
- Modes: 普通 (normal form) / 一维快速 (single-row inline) / 二维表格 (el-table multi-row batch) / BOM展开 (recursive from BomVersion)
- Pilot: `sales/orders/create` + `procurement/orders/create` + `production/plans/create`
- BOM mode reuses PR #694 `BomVersion` recursive expansion

### 3. U-ICON-1 (3d) — Inline 7-icon row toolbar
- **New**: `web-admin/src/components/list/InlineRowIcons.vue`
- 7 icons: 复制 / 标记 / 锁定 / 转发 / 打印 / 删除 / 审计
- Hover-on-row state in row末 cell (NOT collision with `RowActionMenu` dropdown ▾)
- Reuse `web-admin/src/composables/useRowActions.ts` core + `computeRowActions` RBAC matrix
- Wire 16 list views (same 16 from PR #678): sales/{orders,returns,shipments,finished-goods}/list + procurement/{orders,receives}/list + production/{plans,batches}/list + corresponding RN (skip RN this round, Vue only)
- vitest: 50-combo (10 status × 5 RBAC) matrix mirroring PR #678

### 4. U-MARKER-1 (1d) — 5-color row marker
- **New**: `web-admin/src/components/list/RowMarkerCell.vue`
- 5 colors: red / orange / yellow / green / blue (+ none)
- Backend: `marker_color VARCHAR(16) NULL` on `sales_orders` / `purchase_orders` / `customers` (V20260516_*.sql)
- 1 standalone PR

### 5. U-FEED-1 (2d) — In-app release-notes feed
- Backend (Day 12 morning): `ReleaseNoteController` + `ReleaseNote` entity + V20260517_*.sql
- Frontend (Day 12-13): `web-admin/src/components/notification/ReleaseNoteCard.vue` (top-right toast + dismissible)
- Markdown via `marked.js` (verify in package.json Day 12)

### 6. U-DESKTOP-MODAL-1 (3d) — Enhanced ElDialog
- **New**: `web-admin/src/components/dialog/EnhancedDialog.vue` (extends `ElDialog`)
- 4 ops: 最小化 (bottom dock) / 最大化 (fullscreen) / 拉伸 (resize handle) / 关闭
- Draggable header via `@vueuse/core` `useDraggable`
- Pilot: `sales/orders/detail.vue` + `procurement/orders/detail.vue`

### 7. C-WIDGET-1 (5d) — Dashboard widget plug system
- **New**: `web-admin/src/types/dashboardWidget.ts` (DashboardWidget interface)
- 10 widget impls: `KPICardWidget` / `ChartWidget` / `ListWidget` / `AlertWidget` / `QuickActionWidget` / `CalendarWidget` / `MapWidget` / `NewsWidget` / `AIAssistantWidget` / `CustomHtmlWidget`
- Drag-drop layout reuses `web-admin/src/components/smartbi/DashboardBuilder.vue` pattern
- Backend: `dashboard_layout` table (V20260518_*.sql) + `DashboardLayoutController` for save/load
- Wire to `web-admin/src/views/dashboard/index.vue`

### 8. S-CRM-1 (4d: 1d Java + 3d Vue) — Customer tracking
- Backend (1d): `CustomerTrackingRecordController` + DTO + `@RequirePermission` (PR #717 lesson — don't ship without RBAC)
- Frontend (3d): `web-admin/src/views/sales/customers/tracking/{list,create-dialog,timeline}.vue`
- `timeline.vue` = `el-timeline` reverse-chronological by `contact_date`

## Day-by-day execution plan

| Day | Item | Deliverable |
|---|---|---|
| 1-3 | U-VIEW-1 | ViewModeSwitcher.vue + 2 pilot list + vitest. **PR 1** |
| 4-7 | U-NEW-1 | CreateModeSelector.vue + 3 pilot create + vitest. **PR 2** |
| 8-10 | U-ICON-1 | InlineRowIcons.vue + 8 web list wired + 50-combo vitest. **PR 3** |
| 11 | U-MARKER-1 | RowMarkerCell.vue + V20260516_*.sql + 3 entity column. **PR 4** |
| 12-13 | U-FEED-1 | ReleaseNoteController/Entity + V20260517_*.sql + ReleaseNoteCard.vue. **PR 5** |
| 14-16 | U-DESKTOP-MODAL-1 | EnhancedDialog.vue + 2 pilot detail + vitest. **PR 6** |
| 17-21 | C-WIDGET-1 | 10 widget + DashboardWidget interface + dashboard_layout table + dashboard/index.vue rewire. **PR 7** |
| 22-24 | S-CRM-1 | CustomerTrackingRecordController + DTO + Vue 3-view + RBAC. **PR 8** |

## HARD constraints (from .claude/rules + memory)

1. **Concurrent-edit safety rule 1**: Each item ships as **separate PR** on milestone — no batch.
2. **Concurrent-edit safety rule 5b**: `git commit -- <files>` (explicit paths) on every commit to lock scope.
3. **Concurrent-edit safety rule 5**: `git status --short` BEFORE every commit to verify staging area.
4. **`feedback_vite_build_only_catches_vue_ts_import_paths`** HARD: run BOTH `npx vitest run` AND `npx vite build` before push.
5. **`feedback_subagent_local_check_ne_ci`** HARD: don't trust local PASS — wait for CI green before merging.
6. **`feedback_test_rls_with_real_pool_not_psql_reset`** HARD (S-CRM-1): test RLS with real asyncpg pool, not psql `RESET`.
7. **`feedback_chat_must_push_before_clear`** HARD: at GO signal, push + verify `git ls-remote origin <branch>` SHA == local before /clear.
8. **`feedback_brief_must_grep_existing_endpoint_paths`** HARD: every PR §0 must cite `file:line` evidence.
9. **PR #717 RBAC lesson**: S-CRM-1 Controller MUST have `@RequirePermission` on every endpoint.

## Reporting cadence

Per PR (8 total):
- PR # + merged SHA on origin/main
- Smoke screenshot (web-admin running)
- `npx vitest run` PASS screenshot
- `npx vite build` PASS screenshot
- For S-CRM-1: `curl -i <endpoint>` 200/401/403 RBAC matrix screenshot
