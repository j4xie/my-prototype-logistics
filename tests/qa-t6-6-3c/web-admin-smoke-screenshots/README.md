# Web-admin UI smoke screenshots

**DEFERRED — current Vue SPA does not exercise T6.6 endpoints.**

The web-admin SPA's only smart-bi production-related view is
`src/views/smart-bi/ProductionAnalysis.vue` which calls
`/api/mobile/{factoryId}/smart-bi/production-analysis/{dashboard,data}` —
**not** the T6.6 endpoints `/api/mobile/{factoryId}/smart-bi/analysis/(production|quality)`.

Grep evidence (run from worktree root):

```bash
$ grep -rlE "analysis/production|analysis/quality" web-admin/src/
# (0 hits — confirms SPA doesn't call T6.6 endpoints)

$ grep -rE "smart-bi.*production|smart-bi.*quality" web-admin/src/
web-admin/src/views/smart-bi/ProductionAnalysis.vue:    const res = await get<TableRow>(`/${factoryId.value}/smart-bi/production-analysis/dashboard`, {
web-admin/src/views/smart-bi/ProductionAnalysis.vue:    const res = await get<TableRow[]>(`/${factoryId.value}/smart-bi/production-analysis/data`, {
# (only ProductionAnalysis.vue, and it hits /smart-bi/production-analysis/* not /smart-bi/analysis/production)
```

A UI smoke would therefore only verify general login/render, not the specific
T6.6.3c routing change. The equivalent (and stronger) evidence is captured in
`../tenant-sample-matrix.md`:

- Real qhj_prod login → `RES_3101_009/smart-bi/analysis/production` → HTTP 200,
  `"tenantType":"RESTAURANT"`, Python access-log entry present
- Same for `/quality`

When future SPA work adds `/smart-bi/analysis/production` consumption, a
proper UI smoke can be added here with screenshots.
