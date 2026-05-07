# ⚡ IMMEDIATE — Phase 2A Rule 10 latent audit (chat 1 fill-in)

**From**: organizer chat
**Date**: 2026-05-07
**Scope**: Defensive grep + fix any未 audit Rule 10 violations across `smartbi_compat/api/*.py`
**Block**: T6.4 100% factories — real customer data may trigger boundary cases F001 doesn't
**Parallel**: chat 2 在做 task #25 region tie-break (改 `analysis_region.py`),你**避开**这文件

---

## 背景

Task #28 PR #111 提到 "8 other already-fixed Rule 10 sites in same file" — 说明 `analysis_finance.py` 已 audit 过 (receivable section + 8 finance sites)。但其他 file (`analysis_sales.py` / `analysis_inventory.py` / `analysis_procurement.py` / `analysis_department.py` / `analysis_drilldown.py` 等) 可能还有 latent Rule 10 violations。

Rule 10 (per `.claude/rules/python-java-port.md`):
- ❌ Bad: `(n / d * K).quantize(scale_2)` — Decimal 28-digit precision compounded
- ✅ Good: `(n / d).quantize(Decimal("0.0001"), HALF_UP) * K` 然后 final quantize(0.01)

T6.1 dryrun 100% match 是 F001 数据下,但 latent boundary cases (e.g. ratios → 0.5005, 1/3, X.X995) 在 F001 不 trigger,T6.4 customer data 可能 trigger。

---

## 你的任务

Phase 2A 全文件 grep + identify Rule 10 latent + (if found) fix per canonical idiom + audit report。

⛔ **不**改 `analysis_region.py` (chat 2 task #25 在做,会冲突)。
⛔ **不**改 `analysis_finance.py` receivable section (已 fix in task #28 PR #111)。

---

## Step 0 — 新 worktree (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/rule10-latent-audit -b ops-rule10-latent-audit origin/main
cd .worktrees/rule10-latent-audit
pwd
git branch --show-current
```

---

## Step 1 — Reference

- `.claude/rules/python-java-port.md` Rule 10 段落 (your task #28 已熟)
- Canonical idiom (你 PR #111 写过的): `(n / d).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) * Decimal("K")`

---

## Step 2 — Grep + identify

### 2.1 Pattern grep (所有 smartbi_compat/api files)

```bash
# Anti-pattern: division then multiplication then quantize-without-intermediate-quantize
grep -nE '/\s*[a-z_\.]+\s*\*\s*Decimal\("?[0-9]+' \
  backend/python/smartbi_compat/api/*.py | \
  grep -v 'analysis_region.py\|analysis_finance.py:21[0-9][0-9]\|analysis_finance.py:22[0-9][0-9]'
```

(`analysis_region.py` 排除 chat 2 工作;`analysis_finance.py` L2100-2300 是 task #28 已 fix range)

记录每个 hit 的 file:line。

### 2.2 Scope check (排除 false positives)

每 hit 看 surrounding context (前后 5 行):
- 是否已经 wrap 在 `(...).quantize(0.0001, ROUND_HALF_UP)` 外? — 那就是 already-fixed canonical
- 是否在 test fixture / golden recording? — false positive,不 fix
- 是否在 comment / docstring? — false positive,不 fix
- 实际是 `(n / d).quantize(...) * Decimal(...)`? (already fixed) — false positive
- 实际是 `n / d * Decimal("K")` 后没 quantize 直接用? (Bad,但不是 Rule 10 — 是 missing quantize) — 不在本 task scope

只记录 真正 `(n / d * K).quantize(scale_2)` 反 pattern hits。

### 2.3 Output: latent sites list

写入 audit report doc `docs/qa-audits/2026-05-07-rule10-latent-audit.md`:

```markdown
# Phase 2A Rule 10 Latent Audit — 2026-05-07

**Scope**: All `backend/python/smartbi_compat/api/*.py` except:
- `analysis_region.py` (chat 2 task #25 in flight)
- `analysis_finance.py:2120-2240` (task #28 PR #111 receivable section, already fixed)

**Files audited**: <N files>

## Latent sites found (M total)

| File:Line | Function | Pattern | Canonical fix | Severity |
|---|---|---|---|---|
| ... | ... | `n / d * Decimal("100")` | `(n / d).quantize(...) * Decimal("100")` | medium |
| ... | ... | ... | ... | ... |

## Files swept clean (no latent)

- ...
- ...

## Decision

If M = 0: close audit no-op.
If M > 0: fix all M sites per canonical idiom in same PR, add inline Rule 10 comments.
```

---

## Step 3 — Fix (if M > 0)

每个 latent site fix 用 task #28 canonical idiom:

```python
# Before:
ratio = n / d * Decimal("100")

# After (Rule 10):
# Java line XXX — divide quantize 4 first, then multiply, mirrors Java
# BigDecimal.divide(scale=4, HALF_UP).multiply(K).
ratio = (n / d).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) * Decimal("100")
```

**Idiom strict** — 不要发明 new helper。Just inline the canonical pattern + comment。

如果同一文件多 sites,集中改 — 单 file 修不超 ~10 sites (右-sized PR rule)。如果 >10 sites in one file,split into multiple PR。

---

## Step 4 — Test env smoke (if M > 0)

```bash
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code && git pull && bash /www/wwwroot/cretas/restart-test.sh"
sleep 30
TOKEN=$(...)  # F001 test token (用 task #28 同方式)
for path in \
  "analysis/sales?startDate=2026-01-01&endDate=2026-05-07" \
  "analysis/inventory?startDate=2026-01-01&endDate=2026-05-07" \
  "analysis/procurement?startDate=2026-01-01&endDate=2026-05-07" \
  "analysis/department?startDate=2026-01-01&endDate=2026-05-07" \
  "analysis/finance?startDate=2026-01-01&endDate=2026-05-07&analysisType=profit" \
  "alerts"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8084/api/mobile/F001/smart-bi/$path")
  echo "$code $path"
done
```

期望: 6/6 = 200。Any 5xx → STOP + ping organizer。

---

## Step 5 — Commit + STOP ping user before push

```bash
git add backend/python/smartbi_compat/api/<files-modified>
git add docs/qa-audits/2026-05-07-rule10-latent-audit.md
git status --short
git commit -- ... -m "chore(phase2a): Rule 10 latent audit + <M> fixes (defensive sweep)"
```

⛔ STOP — ping user before `git push` (per memory `feedback_pause_before_deploy_or_push.md`):

```
Local commit done. Awaiting your GO before git push.
- Branch: ops-rule10-latent-audit
- Commit: <SHA>
- Files: <list>
- Findings: <M latent sites fixed in <N files>> OR "0 latent — sweep clean"
```

等 user GO 才 push + gh pr create + ping organizer。

If M = 0 (no fix needed):
- 仍写 audit report doc 作 reference (proves swept clean)
- Single doc-only commit,STOP ping user before push 同流程

---

## ⛔ HOLD blocks

| Block | Trigger |
|---|---|
| ⛔ DO NOT git push before STOP+ping user | Per pause rule |
| ⛔ DO NOT touch prod (8083 / cretas-python.service / .env.prod / nginx) | PR-3 24h soak frozen |
| ⛔ DO NOT touch `analysis_region.py` | chat 2 task #25 在做 |
| ⛔ DO NOT touch `analysis_finance.py:2100-2240` | Task #28 PR #111 已 fix |
| ⛔ DO NOT 改 `_decimal_to_number` / `_format_decimal_half_up` helpers | Idiom inline,不发明 helper |
| ⛔ DO NOT chain to Rule 11 / Rule 12 latent audit | Single rule scope |
| ⛔ DO NOT write impl tests | Audit report 含 site list 即可,Phase 2A test pattern 不变 |

---

## Stop-and-ping 触发条件

- Grep 找到 **>15 latent sites in one file** (说明该 file 整体没 audit 过 — 可能本 task 范围炸,需要 split)
- 找到 latent site 但 idiom 跟 task #28 canonical 不一致 (说明该 endpoint 用 different 处理 strategy,需要 organizer 决定怎么 fix)
- Test env smoke 任何 5xx
- Phase 2A 文件含 SQL `*100` patterns 不在 Python (e.g. PG 端做 percentage 计算) — 这种不 in scope
- prod 8083 任何信号受影响

---

## Resumption checklist

- [ ] `cd .worktrees/rule10-latent-audit && git pull origin main` 拿最新
- [ ] Read this marching order
- [ ] Read .claude/rules/python-java-port.md Rule 10
- [ ] Step 2.1 grep all files
- [ ] Step 2.2 scope check (false positive filter)
- [ ] Step 2.3 audit report write
- [ ] (if M > 0) Step 3 fix per canonical idiom
- [ ] (if M > 0) Step 4 test env smoke
- [ ] Step 5 local commit + ⛔ STOP ping user before push
- [ ] (user GO 后) push + gh pr create + ping organizer

---

## 注意

如果 audit 结果 M = 0 (sweep clean),老实写 "no latent found" — 不要无中生有。Right-sized PR is best PR (per task #31 lesson)。

如果 grep 抓到 false positives 让你 unclear if site 真 violate Rule 10,**ping organizer** with line ref,不要自己 judge 然后 fix (避免 fix 错地方 — 类似 PR-1 misdiagnose SQLAlchemy 教训)。
