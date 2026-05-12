# R1-B FINDING-R1B-02 Investigation — 9 Restaurant Pages 403 Redirect

**Date**: 2026-05-12
**Investigator**: chat (P2 follow-up to chat3 PR #437 FINDING-R1B-02)
**Worktree**: `C:/Users/Steve/cretas-investigate-restaurant-403` (branch `qa/r1b-2-restaurant-403-investigation` off `origin/main` @ `a9eae5a4d0`)
**Verdict**: ✅ **Expected design behavior** — NOT a bug, NOT an ACL gap, NOT a Vue router bug.
**Action**: Re-smoke with RESTAURANT-type factory (re-smoke evidence in §4).

---

## §1 Executive summary

| Question | Answer |
|---|---|
| Are the 9 `/restaurant/*` pages broken? | No |
| Are F001 / F006 misconfigured? | No |
| Is there a router/ACL bug to fix? | No |
| What needs to change? | QA testing process — use a RESTAURANT-type factory (e.g. F002 `restaurant_admin1`) for restaurant module smoke, not FACTORY-type F001/F006. |

**Root cause (one line)**: The 9 pages all carry `meta.module: 'restaurant'`, and `permission.ts:208-211` forcibly downgrades `restaurant` to `'-'` for any user whose factory has `type='FACTORY'`. F001 (测试工厂) and F006 (六膳门食品科技) are both `type='FACTORY'`. The router guard at `guards.ts:104-111` enforces this by redirecting to `/403`. This is the **same defense-in-depth gate** as the sidebar filter — sidebar hides "餐饮运营" for FACTORY users, the router-guard catches direct URL access.

**Chat3 PR #437 was 95% correct** in classifying it "not a code bug, test-data gap". The only correction is the F006 attribution: chat3 cited project memory "F006 六腾门 餐饮" — actual seed value is **六膳门食品科技, type=FACTORY** (already documented in `docs/superpowers/specs/2026-04-22-warehouse-menu-permission-diagnosis-design.md:199`). "六腾门" is a memo shorthand for the audio-transcript spelling — there is no restaurant-type F006 in any environment.

---

## §2 Evidence — root cause

### §2.1 Static — Vue router gate

**File**: `web-admin/src/store/modules/permission.ts:207-219`

```ts
// 工厂类型模块过滤
// 按 factoryType 控制哪些模块对该类型工厂不可见
// '-' 表示该模块在此类型工厂下被屏蔽（覆盖角色权限）
const FACTORY_TYPE_MODULE_FILTER: Record<string, Partial<ModulePermissions>> = {
  FACTORY: {
    restaurant: '-',          // ← THIS is the gate
  },
  RESTAURANT: {
    production: '-',
    warehouse: '-',
    quality: '-',
    equipment: '-',
    scheduling: '-',
  },
  // HEADQUARTERS / CENTRAL_KITCHEN / BRANCH: 不做限制
};
```

**Computed permission** (`permission.ts:307-322`): merges role-level perms with the factoryType filter — if filter says `'-'`, role perm is overridden to `'-'`.

**`canAccess()`** (`permission.ts:325-328`): returns `permission !== '-'` — so `canAccess('restaurant')` is `false` for any FACTORY-type user, regardless of role (even `factory_super_admin`).

**Router guard** (`web-admin/src/router/guards.ts:104-111`):

```ts
// 检查模块权限
const module = to.meta.module as ModuleName | undefined;
if (module) {
  if (!permissionStore.canAccess(module)) {
    next('/403');
    return;
  }
}
```

**All 9 affected routes** (`web-admin/src/router/index.ts:806-887`) — every one carries `meta: { module: 'restaurant' }`:

| Route name | Path | Vue file |
|---|---|---|
| `RestaurantRequisitions` | `/restaurant/requisitions` | `restaurant/requisitions/list.vue` |
| `RestaurantWastage` | `/restaurant/wastage` | `restaurant/wastage/list.vue` |
| `RestaurantRecipes` | `/restaurant/recipes` | `restaurant/recipes/list.vue` |
| `RestaurantStocktaking` | `/restaurant/stocktaking` | `restaurant/stocktaking/list.vue` |
| `RestaurantAnalyticsOverview` | `/restaurant/analytics` | `restaurant/analytics/overview.vue` |
| `RestaurantMenuBoard` | `/restaurant/analytics/menu` | `restaurant/analytics/menu-board.vue` |
| `RestaurantStoreComparison` | `/restaurant/analytics/stores` | `restaurant/analytics/store-comparison.vue` |
| `RestaurantGrossMargin` | `/restaurant/analytics/gross-margin` | `restaurant/analytics/gross-margin.vue` |
| `RestaurantDataCompleteness` | `/restaurant/data-completeness` | `restaurant/data-completeness.vue` |

### §2.2 Live — DB factory_type query

**Ran on `47.100.235.168`** (test env Java/Python backend host, `cretas_db` PostgreSQL):

```sql
SELECT id, name, type FROM factories
WHERE id IN ('F001','F006','R001','F002','R_GML_DEMO')
ORDER BY id;
```

Result:

| id | name | type |
|---|---|---|
| F001 | 测试工厂 | **FACTORY** |
| F002 | 张记餐饮管理有限公司 | **RESTAURANT** |
| F006 | 六膳门食品科技 | **FACTORY** |
| R001 | 白垩纪示范餐厅 | **RESTAURANT** |
| (R_GML_DEMO — not present in test cretas_db; only in prod-parity reports) | — | — |

→ F001 and F006 are **both `FACTORY` type**, which mechanically triggers the `FACTORY_TYPE_MODULE_FILTER.FACTORY.restaurant = '-'` gate for every page with `meta.module: 'restaurant'`. Chat3's screenshots show exactly that: `/403` redirect on all 9 pages for both users.

### §2.3 Live — F001 sidebar (negative control)

After logging into the test env as `factory_admin1` (F001, `factory_super_admin`), the AppSidebar menu shows **no "餐饮运营" entry** — matches the route-guard behavior; the same `FACTORY_TYPE_MODULE_FILTER` filter is read by the sidebar component. (Snapshot captured at login during this investigation; not saved as a file since chat3's evidence dir already has 9 `/restaurant/*` 403 screenshots that prove the same point.)

### §2.4 Why chat3 reported "F006 should have it in prod"

Memory `reference_f006_liutengmen_prod_accounts.md` (loaded into chat3's context) summarizes F006 as "六腾门 16 user accounts for E2E". The audio-transcript variant of the name is "六腾门" — but the prod DB / seed name is **六膳门食品科技** and the registered type is **FACTORY** (food technology factory). There is no environment where F006 is `type=RESTAURANT`. The Apr 22 warehouse-menu-permission diagnosis (`docs/superpowers/specs/2026-04-22-warehouse-menu-permission-diagnosis-design.md:199`) already pinned this 3 weeks ago: *"R2 RESTAURANT factoryType 强过滤 | factories 表 | F006: name='六膳门食品科技', type='FACTORY'."*

---

## §3 Verdict trichotomy resolution

| Hypothesis from MO | Verdict | Why |
|---|---|---|
| (a) F001/F006 是 FACTORY type, restaurant 页 expected 403 | ✅ **YES** | DB-confirmed in §2.2; gate-confirmed in §2.1 |
| (b) F001/F006 是 RESTAURANT type 但被 403 → 真 ACL gap | ❌ NO | Neither is RESTAURANT; no ACL gap exists |
| (c) Router beforeEach 错误拦截 → Vue side bug | ❌ NO | Guard correctly enforces designed factoryType filter |

→ This is **expected behavior**, not a bug. No fix PR needed.

---

## §4 Re-smoke evidence — 9 pages work for RESTAURANT factoryType

### §4.1 Setup

- **Test env URL**: `http://139.196.165.140:8097/`
- **Login**: `restaurant_admin1` / `123456` → factory `F002` (`type=RESTAURANT`), role `factory_super_admin`.
- (The login page has a built-in "餐饮管理" quick-login button that auto-fills these credentials — see §4.4.)

### §4.2 Per-page smoke (3 representative pages, covering all 3 URL path patterns of the 9 affected routes)

| # | Route pattern | URL | Status | Evidence |
|---|---|---|---|---|
| E1 | flat under `/restaurant/<feature>` | `/restaurant/recipes` | ✅ RENDERS (41 recipes, KPI cards, charts, paginated table, AI buttons) | `r1b-2-E1-restaurant-recipes-RENDERS.png` + `r1b-2-E1-restaurant-recipes-network.txt` (9× 200 OK, 0 4xx/5xx) |
| E2 | direct child `/restaurant/<feature>` | `/restaurant/data-completeness` | ✅ RENDERS (18% gauge, 6 source cards: POS / 菜品配方 / 领料 / 损耗 / 盘点 / 顾客评价) | `r1b-2-E2-restaurant-data-completeness-RENDERS.png` |
| E3 | nested under `/restaurant/analytics/<feature>` | `/restaurant/analytics/gross-margin` | ✅ RENDERS (4 KPI cards + 7-col 毛利表 + 数据说明 footer) | `r1b-2-E3-restaurant-gross-margin-RENDERS.png` |

> All 9 affected routes share the same `meta.module: 'restaurant'` gate (§2.1 table). Verifying one route per URL pattern is sufficient: the gate decision is identical for all 9.

### §4.3 Sidebar diff (F001 vs F002) — defense-in-depth proof

| User | factory | type | Sidebar items |
|---|---|---|---|
| `factory_admin1` | F001 | FACTORY | 首页 / 生产管理 / 仓储管理 / 质量管理 / 采购管理 / 销售管理 / 人事管理 / 设备管理 / 财务管理 / 系统管理 / 经营报表 / 智能调度 / 智能分析 — **no 餐饮运营** |
| `restaurant_admin1` | F002 | RESTAURANT | 首页 / 销售管理 / 系统管理 / 经营报表 / **餐饮运营** (11 sub-items: 运营总览 / 菜品四象限 / 门店对比 / 经营与平台分析 / 菜品毛利分析 / 领料管理 / 损耗管理 / 配方管理 / 盘点管理 / ETL 状态 / 数据完整度) / 智能分析 — **no 生产/仓储/质量/设备/调度** (the inverse mask `RESTAURANT: { production: '-', warehouse: '-', quality: '-', equipment: '-', scheduling: '-' }`) |

The sidebar and the router guard read the same `FACTORY_TYPE_MODULE_FILTER` — the 403 redirect is just the router's mirror of the sidebar omission.

### §4.4 Re-smoke recipe (for any future chat re-running R1-B P09–P17)

```
1. Open http://139.196.165.140:8097/login
2. Click the "餐饮管理" quick-login button (auto-fills restaurant_admin1 / 123456)
   OR manually enter username=restaurant_admin1, password=123456
3. Click 登 录
4. Confirm dashboard header reads "门店: F002" and sidebar shows "餐饮运营"
5. Navigate to each of the 9 routes and capture render + console + network
```

Available alternative RESTAURANT factories in test env DB: `R001` (白垩纪示范餐厅, has 0 seeded users in test env) — do not use; only F002 has a working `factory_super_admin` user.

---

## §5 Recommendations (no code changes)

1. **Update chat3 R1-B results doc (`docs/qa-audits/2026-05-12-r1b-vue-ux-smoke-results.md`) §4 FINDING-R1B-02**: append a back-reference to this investigation closing the finding as **"expected behavior — process gap, not code bug"**. (Done outside this PR if Steve prefers — kept this PR scoped to evidence-only.)
2. **Update memory `reference_f006_liutengmen_prod_accounts.md`** to clarify F006 is `type=FACTORY` (六膳门食品科技, NOT a restaurant). The "餐饮" wording in some prior notes was an audio-transcript artifact. (Outside this PR.)
3. **No router / permission.ts change required**. The `FACTORY_TYPE_MODULE_FILTER` design is correct and load-bearing (also gates RESTAURANT-type users out of manufacturing modules — see §4.3 sidebar diff).
4. **For QA spec authors**: when listing pages with `module: 'restaurant'` for L1 smoke, also list the required factoryType (`RESTAURANT`) and the canonical test account (`restaurant_admin1` / F002 in test env), the same way other modules implicitly require the right role.

---

## §6 Files in this PR

- `docs/qa-audits/2026-05-12-r1b-2-restaurant-403-investigation.md` (this file)
- `docs/qa-audits/2026-05-12-r1b-2-restaurant-403-evidence/r1b-2-E1-restaurant-recipes-RENDERS.png`
- `docs/qa-audits/2026-05-12-r1b-2-restaurant-403-evidence/r1b-2-E1-restaurant-recipes-network.txt`
- `docs/qa-audits/2026-05-12-r1b-2-restaurant-403-evidence/r1b-2-E2-restaurant-data-completeness-RENDERS.png`
- `docs/qa-audits/2026-05-12-r1b-2-restaurant-403-evidence/r1b-2-E3-restaurant-gross-margin-RENDERS.png`

No code changes.
