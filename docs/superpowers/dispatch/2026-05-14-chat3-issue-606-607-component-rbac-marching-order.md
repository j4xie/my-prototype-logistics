# Chat 3 Marching Order — #606 + #607 bundled (component-level canViewPrice)

**Date**: 2026-05-14
**Issues**: #606 (SmartBIAnalysis.vue) + #607 (TemplateCard.vue)
**Worktree**: `C:/Users/Steve/cretas-issue-606-607-component-rbac`
**Branch**: `feat/issue-606-607-component-rbac-prop`
**Expected deliverable**: 1 PR closing both issues. ~45 min work.

---

## Context (cold-start)

PR #598 (canViewPrice sweep, 15 views) deferred 2 generic chart-rendering components as AMBIGUOUS:

- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (#606)
- `web-admin/src/views/smart-bi/components/TemplateCard.vue` (#607)

Both render money-shaped data. PR #598 deferred them because there were 3 viable gate placement options. **Decision for this MO**: pick **Option C (internal store)** as the conservative default.

- Backend already strips money via `@PriceSensitive` (R7 F3 5×5 confirmed 91/91 PASS at API layer in PR #599)
- Frontend gate is defense-in-depth — removes ghost columns / empty-prefix cells
- Internal store keeps these components self-protecting regardless of parent gating

## Reference pattern (already in repo)

See `web-admin/src/views/sales/returns/detail.vue:22`:
```ts
import { usePermissionStore } from '@/store/modules/permission';
const permissionStore = usePermissionStore();
const canViewPrice = computed(() => permissionStore.canViewPrice);
```

And in template: `<el-table-column v-if="canViewPrice" prop="amount" label="金额" />`

## Steps

### 1. Open worktree

```bash
cd C:/Users/Steve/my-prototype-logistics
git fetch origin main
git worktree add ../cretas-issue-606-607-component-rbac -b feat/issue-606-607-component-rbac-prop origin/main
cd ../cretas-issue-606-607-component-rbac
```

### 2. Patch #606 SmartBIAnalysis.vue

`web-admin/src/views/smart-bi/SmartBIAnalysis.vue` is the main analyst page. It contains money-shape KPI cards, charts, and tables.

Steps:
1. Add `import { usePermissionStore } from '@/store/modules/permission';` if not present
2. Add `const permissionStore = usePermissionStore();` (after other store inits) if not present
3. Add `const canViewPrice = computed(() => permissionStore.canViewPrice);`
4. Find the money-displaying cells/columns/cards in the template. The file matches regex `unitPrice|totalAmount|amount|金额|单价|价格|formatAmount|总价|销售额|营收|毛利|利润|应收|应付`. Wrap each money KPI card / column with `v-if="canViewPrice"`.
5. Charts that bind to money fields — leave alone. Backend masking handles them (chart tooltip will show null).

**Don't wrap entire page** — wrap individual el-col / el-card / el-table-column / KPI div that contains the money render. Layout grid should still flow when wrapped elements drop out.

### 3. Patch #607 TemplateCard.vue

`web-admin/src/views/smart-bi/components/TemplateCard.vue` has `CURRENCY_KEY_RE` auto-prefix logic — it tags ¥ on keys matching the regex.

Approach (Option C):
1. Same import + computed pattern as above.
2. Find the `CURRENCY_KEY_RE` rendering branch (around L239 / L260 per PR #598 audit).
3. When `canViewPrice === false`, skip the ¥-prefix branch entirely (render placeholder `—` or omit the row).

Specific: search for where `CURRENCY_KEY_RE.test(key)` is checked. Add an additional guard: `if (CURRENCY_KEY_RE.test(key) && !canViewPrice.value) { return; /* or '—' */ }`.

### 4. Verify locally

```bash
cd web-admin
npm run build  # vite build catches import / type issues
```

If `npm run build` succeeds, proceed. If it fails, fix the specific error (likely missing import or computed not yet imported from 'vue').

(Per memory rule `feedback_vite_build_only_catches_vue_ts_import_paths` HARD — vite build is the trusted catch-all for Vue/TS import drift. Vitest's lazy resolver misses these.)

### 5. Commit + PR

Explicit paths per concurrent-edit Rule 5b:

```bash
git add web-admin/src/views/smart-bi/SmartBIAnalysis.vue
git add web-admin/src/views/smart-bi/components/TemplateCard.vue
git commit -m "feat(rbac): SmartBIAnalysis + TemplateCard component-level canViewPrice (closes #606, #607)" -- \
  web-admin/src/views/smart-bi/SmartBIAnalysis.vue \
  web-admin/src/views/smart-bi/components/TemplateCard.vue
git push -u origin feat/issue-606-607-component-rbac-prop
```

Commit body should:
- Note Option C (internal store) chosen as conservative default
- Link to PR #598's deferred section
- Note pattern mirrors `sales/returns/detail.vue`

PR body should:
- Close #606, #607 (use "Closes #606, #607" in body)
- Pattern: defense-in-depth (backend strip already handles, this removes UI ghost columns)
- Test plan: vite build green; manual eyeball on admin role to confirm KPI cards still visible

## Don'ts

- DON'T wrap the whole `<template>` block — wrap individual money elements only
- DON'T add comments explaining the change inside the file — `v-if="canViewPrice"` is self-documenting
- DON'T touch chart formatter functions (money values inside ECharts options) — backend handles
- DON'T add new files
- DON'T mass-rename existing computed properties

## Stop conditions

- **`npm run build` fails after the edit** → STOP, report build error. Don't push broken state.
- **A particular money element wraps unclear** → leave it un-wrapped + note in PR description as "deferred to follow-up audit". Better to ship 80% than block on edge case.

## Reporting back

PR description should list: which elements wrapped in each file (count). vite build status. Any deferred edges.
