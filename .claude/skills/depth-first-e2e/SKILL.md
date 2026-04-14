---
name: depth-first-e2e
description: Use when designing or executing E2E test rounds with spec §8.2-style numeric thresholds. Prevents "next round syndrome" and shallow test padding by enforcing depth-first test classification. Triggers on "5 轮测试", "E2E 综合测试", "多轮 E2E", "spec §8.2 阈值", "测试覆盖率", "轮次迭代", or any multi-round E2E testing workflow.
---

# Depth-First E2E Testing

Prevent the "shallow test padding" trap that turns multi-round E2E into a numbers game instead of a bug-discovery tool.

## Why this skill exists

We ran a 5-round E2E test cycle against web-admin. Spec §8.2 all thresholds met (L1 100% / L2 100% / L3 100% / L4 85.7%). **But we discovered only 1 real app bug in 1181 test points**. Every "L4 business flow" test was actually L1 "page accessibility" in disguise.

Root cause: every round kept saying "next round will do deep tests", but next round always had higher-priority fixes, so deep tests never happened.

This skill enforces rules that make that failure mode impossible.

## When to apply

Apply this skill when:
- User asks to run a multi-round E2E test cycle (especially with numeric thresholds)
- Agent-team audit is being used to review E2E plans/results
- Writing new L3/L4 tests (the vulnerable layers)
- Designing a new E2E test round

Do NOT apply to:
- Single ad-hoc E2E tests
- Pure L1 page navigation smoke tests (they're allowed to be shallow)
- Unit tests (different contract)

## The core hard rules

### Rule 1: Every test has a `depth` label

Every E2E test record MUST include a `depth` field. Valid values:

| depth | Criteria |
|-------|----------|
| **smoke** | Page renders / keyword exists / table visible / row count change — no submit, no persistence, no detail verification |
| **medium** | Fill + submit + API 200 captured — but no detail page verification |
| **deep** | Fill + submit + toast captured + list +1 exact + detail page field readback |

Example:
```js
record('L4', '25', 'so_spec_box_fields', 'PASS', {
  depth: 'smoke',  // ← REQUIRED FIELD
  evidence: { hasSpecification: true, hasBoxQuantity: true },
});
```

Tests without `depth` field are considered INVALID and rejected by the audit.

### Rule 2: Each round must produce at least 1 new deep L4 test

Regardless of what the round's main focus is (infrastructure / bug fix / audit), each round MUST write at least 1 new `depth: 'deep'` L4 test.

The deep test MUST pass this checklist:
- [ ] `navigateTo(createPath)` — real navigation
- [ ] `await clickButton(page, '新建')` — open create dialog
- [ ] `await waitForDialog(page)` — wait for dialog
- [ ] `await fillAllRequiredFields(page, baseName)` — real field fill
- [ ] `await submitAndCheckResponse(page, [...], { factoryId, module })` — real submit with precise API filter
- [ ] `expect(submitResult.status).toBe(200)` — API status check
- [ ] `const toastText = await page.waitForSelector('.el-message--success').then(el => el.innerText())` — capture exact toast text
- [ ] `await navigateTo(listPath)` — back to list page (fresh nav, not router.push)
- [ ] `const rowsAfter = await countTableRows(page)` — count fresh
- [ ] `expect(rowsAfter - rowsBefore).toBe(1)` — strict delta
- [ ] `await page.click('table tr:first-child .edit-button')` — open detail
- [ ] `const detailFields = await page.evaluate(() => ({ ... }))` — read field values
- [ ] `expect(detailFields.name).toBe(testName)` — verify roundtrip

If even 1 step is missing, it's not deep, it's medium or smoke.

### Rule 3: Audit MUST question bug-discovery capability

Each round's audit (step ② Agent independent audit) MUST answer for each L4 test:

```
对每条 L4 测试, 逐个回答:
1. 如果被测 backend API 整个返回 500, 这条测试会 FAIL 吗?
2. 如果被测 frontend 组件崩溃不渲染, 这条测试会 FAIL 吗?
3. 如果该功能真有 bug 但 UI 表面正常, 这条测试会 FAIL 吗?
4. 这条测试发现过任何真实 bug 吗?

如果 4 个问题答案全是"不会/没有", 这条测试是 smoke 不是 L4.
```

Audit output must include:
```
### Depth Analysis
Total L4: N
- smoke (⚠️): K tests
- medium: M tests
- deep (✅): D tests

Bug-discovery capability:
- Can catch backend API failure: X tests
- Can catch frontend render failure: Y tests
- Actual bugs found this round: Z
```

### Rule 4: "Next round" is a red flag

Audit reports must not contain phrases like:
- ❌ "deferred to next round"
- ❌ "will be done in Phase 2"
- ❌ "R4 will handle this"
- ❌ "下一轮做"

Allowed alternatives:
- ✅ "not done in this round because [specific technical blocker: X]"
- ✅ "accepted as smoke test, not targeting deep" (with explicit depth: 'smoke' label)
- ✅ "this round BLOCKED, rework required"

If any "next round" phrase appears, the audit MUST treat it as a hard stop and demand the depth work be done in-round.

### Rule 5: Critic must scrutinize depth, not just feasibility

When using agent-team skill for audit ② step, the Critic prompt MUST include:

```
MANDATORY depth scrutiny — answer these BEFORE discussing feasibility/math:

1. How many tests are depth:smoke vs medium vs deep?
2. Would any test fail if its backend API returns 500?
3. Has the plan's L4 expansion added any deep tests, or just smoke tests?
4. Does the plan commit to at least 1 new deep test per round?
5. Is Analyst recommending a path that hits numeric targets via smoke padding?

If smoke padding detected, CHALLENGE the plan, even if numerically compliant.
```

### Rule 6: Spec §1.3 hard rules beat spec §8.2 numeric targets

When spec §8.2 (e.g. "L4 ≥85%") and spec §1.3 hard rules (e.g. "filled + toast + list after 三行缺一不可") conflict:

- **Spec §1.3 wins** — test must have `filled`, `toast`, `list after` evidence
- **Don't compromise on §1.3 to hit §8.2 numbers**
- **If hitting §8.2 requires violating §1.3, report as BLOCKED and escalate to user**

A round passes the audit only if both §8.2 numbers AND §1.3 hard rules pass.

### Rule 7: Summary must report spec-denominator, not script-denominator

Results JSON summary must use:
```json
{
  "round": N,
  "schema_v3": {
    "specTotal": 30,
    "p2Deferred": ["L4-16", "L4-19"],
    "expectedFail": ["L4-03"],
    "effectiveTotal": 28,
    "actualExecuted": 24,
    "actualPass": 24,
    "depthBreakdown": {
      "smoke": 22,
      "medium": 0,
      "deep": 2
    },
    "pctOfSpec": 85.7,
    "pctDeep": 7.1
  }
}
```

**Do not** report just `{pass: 24, total: 24}` — it hides the depth problem.

## Round lifecycle with depth enforcement

### Step ① 审计A (Self-audit)
Plan must include:
- L4 deep tests planned this round: at least 1
- Depth distribution target: `{smoke: X, medium: Y, deep: Z}` with Z ≥ 1

### Step ② 审计B (Agent audit)
Critic must apply Rule 5's depth scrutiny checklist. If plan doesn't commit to deep tests, audit must BLOCK.

### Step ③ 修复 (Fix plan)
Adjust plan to include at least 1 deep test if missing.

### Step ④ 执行 (Execute)
Execute includes writing at least 1 deep test.

### Step ⑤ 审计结果 (Audit results)
Audit output includes Depth Analysis block per Rule 3.

### Step ⑥ 修复 bug (Fix bugs)
Real bugs (from deep tests) fixed here.

### Step ⑦ 验证修复 (Verify fixes)
Must include rerun of deep test to confirm bug fix.

## Detection: Is this E2E suite compromised?

Run this diagnostic on any existing E2E test suite:

```bash
# Check 1: How many tests have depth field?
grep -c "depth:" tests/e2e-comprehensive/e2e-L3L4-flows.mjs
# If 0 → Rule 1 violated

# Check 2: How many tests submit forms?
grep -c "submitAndCheckResponse\|submitBtn.click" tests/e2e-comprehensive/e2e-L3L4-flows.mjs
# Divide by total L4 function count. If < 50% → suspicious

# Check 3: How many tests read detail pages?
grep -c "navigateTo.*detail\|/detail/\|click.*row.*edit" tests/e2e-comprehensive/e2e-L3L4-flows.mjs
# If 0 → no deep tests exist

# Check 4: How many tests use body.innerText.includes?
grep -c "innerText.*includes\|text.includes\|textContent.*includes" tests/e2e-comprehensive/e2e-L3L4-flows.mjs
# If high → lots of shallow keyword checks

# Check 5: checkDropdownContains usage?
grep -c "checkDropdownContains(" tests/e2e-comprehensive/e2e-L3L4-flows.mjs
# If 0 and function is defined → dead code / facade engineering
```

If any check fails, the suite has the "shallow padding" problem and needs remediation.

## Bug patterns to watch for (seen in the wild)

### Pattern 1: `hasFormField` facade

```js
// ❌ Shallow — matches any label containing "客户" substring
async function hasFormField(page, labelText) {
  return page.evaluate((text) => {
    const labels = Array.from(document.querySelectorAll('.el-form-item__label'));
    return labels.some(l => l.textContent.includes(text));
  }, labelText);
}
```

"客户" matches "客户经理", "客户备注", "客户等级", and the sidebar menu item. Passes even if the form has no customer dropdown.

### Pattern 2: "Click new + count labels"

```js
// ❌ Shallow — never submits
async function L4_N_Test(page) {
  await navigateTo(page, '/some/page');
  await clickButton(page, '新建');
  await page.waitForTimeout(3000);
  const fields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.el-form-item__label'))
      .map(l => l.textContent).slice(0, 15);
  });
  record('L4', 'N', 'xxx', fields.length > 0 ? 'PASS' : 'FAIL', { fieldCount: fields.length });
}
```

Never calls submit. If backend `POST /orders` is totally broken, this test still passes.

### Pattern 3: `text.includes('关键字')` keyword matching

```js
// ❌ Shallow — checks for substring anywhere on page
const hasFields = await page.evaluate(() => ({
  hasSpec: text.includes('规格'),
  hasBox: text.includes('箱数'),
}));
```

"规格" appears in page title, column headers, placeholder text, sidebar, help tooltips. Passes even if those fields don't exist in the form.

### Pattern 4: `rowsAfter > rowsBefore` lax persistence

```js
// ❌ Shallow — accepts delta=6 from dirty data
const persisted = rowsAfter > rowsBefore;
```

Correct form: `rowsAfter === rowsBefore + expectedDelta` where `expectedDelta` is usually 1.

### Pattern 5: `checkDropdownContains` defined but not called

```js
// Defined at line 111 ...
async function checkDropdownContains(page, selectSelector, searchText) { ... }

// ... but nowhere in the file is it called
```

Dead code / facade engineering. Either wire it up to L3-1/L3-2 or delete.

## Correct patterns

### Correct: Deep L4 test template

```js
async function L4_deepTemplate(page) {
  const testId = 'L4-deep-N';
  console.log(`\n--- ${testId} ---`);

  // Step 1: Navigate to list (record baseline)
  const nav1 = await navigateTo(page, '/sales/orders', { waitForTable: true });
  if (nav1 !== 'OK') { record('L4', 'deep-N', 'navigate', 'FAIL', { result: nav1 }); return; }
  const beforeResult = await countTableRows(page);
  if (beforeResult.error) { record('L4', 'deep-N', 'list', 'FAIL', { error: beforeResult.error }); return; }
  const rowsBefore = beforeResult.count;

  // Step 2: Click create button
  const clicked = await clickButton(page, '新建');
  if (!clicked) { record('L4', 'deep-N', 'click_create', 'FAIL', { depth: 'deep' }); return; }

  // Step 3: Wait for dialog
  const dialog = await waitForDialog(page);
  if (!dialog) { record('L4', 'deep-N', 'open_dialog', 'FAIL', { depth: 'deep' }); return; }

  // Step 4: Fill all required fields (handles Element Plus compound fields)
  const testName = `E2E_DEEP_${Date.now().toString(36)}`;
  await fillDialogInput(page, testName);
  const filledFields = await fillAllRequiredFields(page, testName);

  // Step 5: Submit with precise API filter
  const submitResult = await submitAndCheckResponse(page, ['确定', '保存', '提交'], {
    factoryId: FACTORY_ID,
    module: 'sales/orders',
  });
  if (!submitResult.ok) {
    record('L4', 'deep-N', 'submit', 'FAIL', {
      depth: 'deep',
      reason: submitResult.reason,
      status: submitResult.status,
      filledFields,
    });
    return;
  }

  // Step 6: Capture toast text
  let toastText = '';
  try {
    const toast = await page.waitForSelector('.el-message--success', { timeout: 3000 });
    toastText = await toast.innerText();
  } catch { toastText = '(not captured)'; }

  // Step 7: Navigate back to list with fresh goto (not router.push)
  await page.goto(`${BASE}/sales/orders`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if (await page.$('.el-table__body-wrapper')) break;
  }
  await page.waitForTimeout(1000);

  // Step 8: Verify list +1 exactly
  const afterResult = await countTableRows(page);
  const delta = afterResult.count - rowsBefore;
  if (delta !== 1) {
    record('L4', 'deep-N', 'persistence', delta > 1 ? 'WARNING' : 'FAIL', {
      depth: 'deep',
      delta,
      rowsBefore,
      rowsAfter: afterResult.count,
    });
    return;
  }

  // Step 9: Open detail and verify roundtrip
  await page.click('.el-table__body-wrapper .el-table__row:first-child');
  await page.waitForTimeout(2000);
  const detailValue = await page.evaluate((name) => {
    return document.body.innerText.includes(name);
  }, testName);

  // Step 10: Record PASS with full evidence
  record('L4', 'deep-N', 'full_roundtrip', detailValue ? 'PASS' : 'FAIL', {
    depth: 'deep',
    filled: testName,
    filledFields,
    apiStatus: submitResult.status,
    apiUrl: submitResult.url,
    toastText,
    rowsBefore,
    rowsAfter: afterResult.count,
    delta: 1,
    detailRoundtrip: detailValue,
  });
}
```

### Correct: Deep L3 test template (real dropdown)

```js
async function L3_deep_customerDropdown(page) {
  // Step 1: Create customer (first, via deep flow)
  const customerName = `E2E_Cust_DEEP_${Date.now()}`;
  await createEntityDeep(page, '/sales/customers', customerName);

  // Step 2: Navigate to SO create
  await navigateTo(page, '/sales/orders');
  await clickButton(page, '新建');
  await page.waitForTimeout(2000);

  // Step 3: Click customer select to open dropdown
  const customerSelect = await page.$('.el-dialog .el-select[placeholder*="客户"], .el-drawer .el-select[placeholder*="客户"]');
  if (!customerSelect) {
    record('L3', 'deep-1', 'find_customer_select', 'FAIL', { depth: 'deep' });
    return;
  }
  await customerSelect.click();
  await page.waitForTimeout(1500);

  // Step 4: Type customer name to filter
  const searchInput = await page.$('.el-select-dropdown__search input, .el-popover input');
  if (searchInput) {
    await searchInput.fill(customerName);
    await page.waitForTimeout(1000);
  }

  // Step 5: Verify customer appears in dropdown options
  const options = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.el-select-dropdown__item'))
      .map(o => o.textContent?.trim())
      .filter(Boolean);
  });
  const found = options.some(o => o.includes(customerName));

  record('L3', 'deep-1', 'customer_in_so_dropdown', found ? 'PASS' : 'FAIL', {
    depth: 'deep',
    searchedFor: customerName,
    optionsFound: options.length,
    optionsSample: options.slice(0, 5),
    customerInDropdown: found,
  });
}
```

## Remediation for existing compromised suites

If a suite has the shallow padding problem:

1. **Don't delete existing tests** — they have smoke value
2. **Relabel them with `depth: 'smoke'`**
3. **Add new `depth: 'deep'` tests alongside** (minimum 3-5 per L4 major area)
4. **Update summary schema** to show depth breakdown
5. **Rewrite the final report** to honestly present depth distribution
6. **Mark old rounds as "framework + smoke tests"** rather than "complete E2E"

Don't pretend the old rounds were deep. Own the gap, fix it forward.

## References

- `references/anti-patterns.md` — 5 shallow test anti-patterns with examples
- `references/depth-checklist.md` — 12-step deep test checklist
- `references/audit-rules.md` — Round-by-round audit rules enforcing depth

## Activation rules

**MUST apply when**:
- User mentions "5 轮 / 多轮 E2E 测试"
- User mentions "spec §8.2 阈值" or numeric pass rate targets
- Agent-team skill is being used for E2E audit
- Writing new L3/L4 test functions
- Reviewing E2E test results

**CANNOT skip** Rule 2 (min 1 deep per round). If user asks to skip depth work, respond:
> "I cannot write another round of shallow tests. Spec §1.3 hard rules 3-4 require deep testing. If we hit blockers on deep tests, let's document them and slow down, but I won't add more smoke tests that look like L4."

**Escalate to user when**:
- Spec §8.2 and §1.3 are in conflict
- Deep test is blocked by real technical constraint (e.g. missing backend feature)
- Round audit reveals depth: 0 after executing
