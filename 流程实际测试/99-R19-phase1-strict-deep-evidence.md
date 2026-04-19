# Phase 1 严格 Deep 补验 (qa-prompt v2.2 r2)

**日期**: 2026-04-19 23:40 CST
**Task**: #352
**目的**: 补之前 Phase 1 medium 级别验证 (漏 Rule 5 console + 深度虚标为 error-deep), 达到 deep 严格标准.

---

## 证据清单

### Rule 4 真 Locator
- `browser_click({ ref: 'e45' })` → 快捷登录 "调度"
- `browser_click({ ref: 'e36' })` → 登录按钮
- `browser_click({ ref: 'e171' })` → 新建样品
- `browser_type({ ref: 'e424', text: 'phase1-strict-deep-20260419' })`
- `browser_click({ ref: 'e464' })` → 创建
- `browser_click({ ref: 'e272' })` → 追踪记录 (field readback)

全部真 Playwright Locator API, 非 JS-simulated click.

### Rule 5 Console (3 次检查全 0 error)
```
Checkpoint A (login 后): errors=0
Checkpoint B (submit 后): errors=0
Checkpoint C (追踪记录 dialog 后): errors=0
```

### Rule 6 Network
```
[GET]  /api/mobile/F001/rd/samples?page=0&size=20 => [200]  (初始加载)
[POST] /api/mobile/F001/rd/samples => [200]                (创建成功)
[GET]  /api/mobile/F001/rd/samples?page=0&size=20 => [200]  (post-create reload)
```

### Rule 7 MutationObserver
- Install BEFORE navigate (在 login 后 /dashboard 上 install)
- Reinstall AFTER full nav to /rd/samples (因 hard navigate 清除 observer)
- Reset log RIGHT BEFORE submit: `ts=1776613106970`
- 捕获结果:
  ```json
  [{
    "time": 1776613112823,
    "cls": "el-message el-message--success is-center",
    "text": "样品已创建"
  }]
  ```
- 1 success mutation, 0 error, 0 fallback.

### Deep 5 要素逐项

1. **填表**: `样品名称 = "phase1-strict-deep-20260419"` (unique marker for readback)
2. **Submit**: 真 click "创建" button
3. **Toast 文案精确**: "样品已创建" (MutationObserver log 唯一事件)
4. **List +1 精确**: baseline 6 rows → post-submit 7 rows (确切 delta +1, 通过 `.el-table__body tr` DOM 查询)
5. **详情页字段回读**: RD 样品无独立 detail 路由 (`/rd/samples/:id` 不存在), list 的 row cells 是 detail view. 新行首行:
   ```
   SP-20260419-1254  phase1-strict-deep-20260419  -  -  待研发  追踪记录  提交审核
   ```
   样品编码生成, 样品名称与填写值完全一致 — 回读通过.

### 生成的数据
- 新样品: `SP-20260419-1254` / `phase1-strict-deep-20260419`
- 状态: 待研发 (初始态)

### 附件证据
- `99-R19-phase1-strict-list.yml` — 操作前 list snapshot
- `99-R19-phase1-strict-dialog.yml` — 新建样品 dialog snapshot
- `99-R19-phase1-strict-listafter.yml` — 创建后 list snapshot (7 rows, 新样品首行)
- `99-R19-phase1-strict-network.log` — 完整 network log

---

## 第一步 8 条核对 (v2.2)

| 核对条 | 结果 |
|---|---|
| 1 数据来源 (新建 vs seed) | ✅ 新建 (样品名是 unique timestamp marker) |
| 2 跨模块联动 | N/A (RD 单模块创建) |
| 3 跨模块回写校验 | N/A |
| 4 操作方式真 Locator | ✅ |
| 5 Console 监控 | ✅ 3 次 checkpoint 全 0 error |
| 6 Network 监控 | ✅ POST 200 |
| 7 UI 文案 MutationObserver | ✅ install + reset + log |
| 8 流程依赖错误 UX | N/A (成功路径, 非 error-deep) |
| 9 数据抽检 | N/A (单记录创建, 非数据列表) |

---

## Depth 诚实标签: **deep** ✅

之前 Phase 1 误标 error-deep (应为 medium), 本次严格重做到达标 deep. 下次绝不虚标.

## 0 Bug 确认

- 无 console error
- 无 toast fallback 污染
- 无 UI 卡顿/错位
- 后端 API 清洁 (POST 200, 样品号正确生成)
- 前端 list reload 自动, table 更新正确

Phase 1 regression fix (RdController `@RequirePermission({"rd:rw"})`) 真正端到端验证成功, **可以开 Phase 3**.

---

**签名**: Claude, session `bf9bf97b`, 2026-04-19 23:40 CST.
