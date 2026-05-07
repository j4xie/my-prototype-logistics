# ⚡ IMMEDIATE — task #28: receivable 3 Rule 10 sites defensive fix (chat 1 fill-in)

**From**: organizer chat
**Date**: 2026-05-07
**Task**: #28 [FOLLOWUP] 3 ambiguous Rule 10 sites in receivable analysis
**Scope**: ~30 min single-PR defensive sweep
**Block**: T6.4 100% factories cutover (real customer data may trigger boundary errors that F001/F999 don't)

---

## 背景

`backend/python/smartbi_compat/api/analysis_finance.py` 在 receivable analysis 部分有 3 个 Rule 10 violations (BigDecimal divide-then-multiply 中间步 round):

| Site | Context | Current code |
|---|---|---|
| L2126 | `_get_receivable_aging_chart` percentage | `amount / total_ar * Decimal("100")` |
| L2194 | `_get_receivable_metrics` COLLECTION_RATE | `total_collection / total_receivable * Decimal("100")` |
| L2226 | `_get_receivable_metrics` concentration ratio | `ratio_value / total_for_ratio * Decimal("100")` |

3 个都是 **同样反 pattern**: `(n/d * K).quantize(0.01)` 一次性算完再 quantize。

Per `.claude/rules/python-java-port.md` Rule 10:
- Java: `BigDecimal.divide(d, 4, HALF_UP).multiply(K)` 然后 setScale(2, HALF_UP)
- Python wrong (current): `(n / d * K).quantize(Decimal("0.01"), HALF_UP)` — Decimal 28-digit precision 会让中间步累积误差
- Python correct: `(n / d).quantize(Decimal("0.0001"), HALF_UP) * K` 然后 quantize(Decimal("0.01"), HALF_UP)

之前 audit 标 "ambiguous" 因为 F001 数据 same scale-2 output for most inputs。但 T6.4 100% factories 真实数据可能 trigger boundary cases (e.g. 1/3 * 100 → "33.33" Java vs "33.3300" Python 一致 by luck,但其他比例下不一定)。Defensive sweep 现在做掉。

---

## 你的任务

修 3 sites + 加 boundary test cases + test env smoke + PR + ping organizer。

⛔ **不 deploy prod** — chat 2's territory? No,你 (chat 1) 是 PR-3 24h soak owner,prod 不能动 PG conn 调试期。Test env (8084) deploy 验证 OK。

---

## Step 0 — 新 worktree (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/receivable-rule10 -b ops-receivable-rule10 origin/main
cd .worktrees/receivable-rule10
pwd
git branch --show-current
```

⛔ **不在 ops-uvicorn-workers worktree** 工作 — 那个跟 PR-3 关联,保持 24h soak observation clean。

---

## Step 1 — Reference

- `.claude/rules/python-java-port.md` Rule 10 段落 (BigDecimal divide-then-multiply)
- `backend/python/smartbi_compat/api/analysis_finance.py` 已有 Rule 10 fix sites 作 pattern reference (e.g. profitMetrics gross/net margin / ROI sites,通过 `git log --oneline -20 -- backend/python/smartbi_compat/api/analysis_finance.py` 找到)

---

## Step 2 — 修 3 sites

每 site 改 1-2 行,加 inline comment reference Rule 10。

### 2.1 L2126 (aging chart percentage)

```python
# Before:
percentage = (
    amount / total_ar * Decimal("100")
    if total_ar > Decimal("0")
    else Decimal("0")
)

# After (Rule 10 — divide quantize 4 first, then multiply, then final quantize 2):
percentage = (
    (amount / total_ar).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) * Decimal("100")
    if total_ar > Decimal("0")
    else Decimal("0")
)
# Note: final quantize(0.01) happens at L2133 _decimal_to_number.quantize site, no double-quantize.
```

### 2.2 L2194 (collection rate)

Same transform. 注意 L2202 `formatted_value=str(collection_rate.quantize(...)) + "%"` 可能也涉及 — 看 quantize 顺序。

### 2.3 L2226 (concentration ratio)

Same transform.

### 2.4 Verify pattern consistency

Grep 文件其他已修 Rule 10 sites 看 idiom:
```bash
grep -n -B1 -A2 'quantize(Decimal("0.0001")' backend/python/smartbi_compat/api/analysis_finance.py | head -30
```

确保你的 fix 跟现有 idiom 一致 (variable naming / 注释 style)。

---

## Step 3 — Add boundary test cases

`backend/python/tests/smartbi_compat/test_*receivable*.py` 文件 (找 existing receivable test file):

```bash
find backend/python/tests/smartbi_compat/ -name '*receivable*' -o -name 'test_*finance*' | head -5
```

加 3 个 boundary test (per Rule 10 audit pattern):

```python
def test_aging_percentage_rule10_boundary():
    # 1/3 * 100 = 33.333..., Java BigDecimal divide(scale=4, HALF_UP) → 0.3333 * 100 = 33.3300
    # Python wrong: (1/3 * 100).quantize(0.01) → 33.33
    # Python correct (Rule 10): (1/3).quantize(0.0001).multiply(100) → 33.3300 → quantize(0.01) → 33.33
    # 在 scale-2 上一致 by accident,但中间精度 0.0001 vs 0.0033 不同。
    # 真正 boundary 是 ratio = X.XX5 类边界,quantize HALF_UP 在不同中间精度下可能 round 到不同方向。
    # 选 ratio = 0.5005 类: 0.5005 * 100 = 50.05 → quantize(0.01) HALF_UP → 50.05 vs 50.06 (depends on intermediate)
    ...
```

具体 boundary 数据用 spec doc / Rule 10 examples 找一组 trigger Python 跟 Java diverge 的 input。如果找不到 boundary case for current 3 sites (e.g. 数据 distribution 永不 trigger),test 写 "regression guard"  pattern (Decimal-equality check on golden value)。

⚠️ 如果**找不到** boundary input let 3 sites diverge (audit 之前评估 "ambiguous" 因为 same scale-2 output),老实在 PR description 说: "fixed defensively per Rule 10, no observed boundary case in F001/F999 data — guard for T6.4 customer data"。**不要膨胀 spec**。

---

## Step 4 — Test env smoke

⛔ **不 deploy prod**,只 test env:

```bash
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code && git pull && bash /www/wwwroot/cretas/restart-test.sh"
sleep 30

# Smoke 5 finance endpoints on F001 test env:
TOKEN=$(...)  # 用 PR-1 spike token 生成 pattern, 但是 8084 不是 8083
for path in \
  "analysis/finance?startDate=2026-01-01&endDate=2026-05-07&analysisType=receivable" \
  "analysis/finance?startDate=2026-01-01&endDate=2026-05-07&analysisType=profit" \
  "analysis/finance?startDate=2026-01-01&endDate=2026-05-07&analysisType=cost" \
  "analysis/sales?startDate=2026-01-01&endDate=2026-05-07" \
  "alerts"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8084/api/mobile/F001/smart-bi/$path")
  echo "$code $path"
done
```

期望: 5/5 = 200。**Any 5xx → STOP + ping organizer**。

---

## Step 5 — Commit + push + PR + ping

```bash
git add backend/python/smartbi_compat/api/analysis_finance.py
git add backend/python/tests/smartbi_compat/test_*.py  # whichever test file you used
git status --short  # ← 验证 ≤2 文件
git commit -- backend/python/smartbi_compat/api/analysis_finance.py \
  backend/python/tests/smartbi_compat/test_*.py \
  -m "fix(phase2a): receivable 3 Rule 10 sites (aging % / collection rate / concentration ratio)"
git push -u origin ops-receivable-rule10
gh pr create --title "fix(phase2a): receivable 3 Rule 10 sites (defensive sweep)" \
  --body "Task #28 — 3 sites in analysis_finance.py L2126/2194/2226 fixed per Rule 10 (BigDecimal divide-then-multiply intermediate quantize). Boundary test cases added (or regression guard if no diverging input found). Test env smoke 5/5 200. Prod NOT deployed yet (chat 1 owns PR-3 24h soak, organizer schedules prod deploy after soak)."
```

Ping organizer:
> Task #28 done. PR <URL>. 3 sites fixed, test env smoke 5/5 OK. Prod deploy holding for organizer GO post PR-3 24h soak.

---

## ⛔ HOLD blocks

| Block | Trigger |
|---|---|
| ⛔ DO NOT deploy prod (--env prod) | PR-3 24h soak observation period — prod 状态 frozen until 2026-05-08 11:36 CST |
| ⛔ DO NOT touch cretas-python.service | systemd unit frozen during PR-3 soak |
| ⛔ DO NOT touch postgresql.conf, .env.prod, nginx vhost | prod state frozen |
| ⛔ DO NOT chain to T6.3 cutover execution | 那是 chat 2 范围 (or 单独派) |
| ⛔ DO NOT 改 ops-uvicorn-workers worktree | 用新 .worktrees/receivable-rule10/ |
| ⛔ DO NOT 改 Rule 10 helper if it exists | 使用现有 idiom,不发明 |

---

## Stop-and-ping 触发条件

- Test env smoke 任何 5xx (不仅 receivable,可能你 fix 改坏其他)
- Test env startup error (asyncpg 连接 fail / import error)
- Boundary test 找不到 diverging input + Java golden 没法 record (e.g. F999 data 不 cover boundary range)
- Existing Rule 10 idiom 跟 marching order pattern 冲突 (e.g. 现有 sites 用了不同 helper)
- File 远超 30min 工作 (e.g. 改动连锁影响其他 endpoint)
- prod 8083 任何信号受影响 (NRestarts != 0 等)

---

## Resumption checklist

- [ ] `cd .worktrees/receivable-rule10 && git pull origin main` 拿最新
- [ ] Read this marching order
- [ ] Read Rule 10 in .claude/rules/python-java-port.md
- [ ] Step 2 修 L2126 + L2194 + L2226
- [ ] Step 2.4 verify 跟现有 idiom 一致
- [ ] Step 3 add boundary test (or regression guard)
- [ ] Step 4 test env smoke
- [ ] Step 5 commit + push + PR + ping
- [ ] **STOP** — prod deploy 等 organizer 在 PR-3 24h soak 之后给 GO

---

## 注意

3 sites 是同 pattern,改动机械。但 verify Step 2.4 找现有已修 Rule 10 idiom 很重要,避免 "fixing" with a non-canonical pattern。如果你搜 grep 后发现 receivable 部分**只有这 3 sites** 是 Rule 10 violation (其他都已修),你的 fix 直接抄其他 site 的 idiom 即可。

如果发现**更多** Rule 10 violations 不在 task #28 描述里 (e.g. L2226 之外又有 L2280),老实告诉 organizer,不要扩展 scope **修一次** 把后面 backlog 也带上 (右-sized PR is best PR)。
