# 餐饮版产品使用手册 Phase 2 — Drift防腐 CI Handoff

**Date**: 2026-04-29  
**Branch**: `e2e/v1-framework`  
**Status**: Phase 2 未开始，Phase 0+1 全部完成并上线

---

## TL;DR (paste this as first message in next chat)

You're picking up Phase 2 of the 餐饮版产品使用手册 project. **Phase 0 + Phase 1a + Phase 1b are all shipped.** Your job: implement Phase 2 — drift防腐 CI infra (3-4 hr, 2 tasks).

**Read these 2 files first:**
1. `docs/superpowers/plans/2026-04-28-restaurant-product-manual.md` — lines 1195+ (Task 19-20)
2. `docs/superpowers/specs/2026-04-28-restaurant-product-manual-design.md` — §11 (三层防护 spec)

**Don't re-brainstorm.** Phase 2 scope is locked. Just implement Task 19 → Task 20.

---

## What was completed (Phase 0 + 1)

| Phase | Content | Status |
|-------|---------|--------|
| Phase 0 | subcategory DDL + retriever routing + domain detection | ✅ shipped |
| Phase 1a | §1/§2/§3 Tier 1 (3 production-grade chapters) | ✅ shipped |
| Phase 1b | §4-§24 Tier 2-5 skeleton + 4 training paths + §B 6 synthesis | ✅ shipped |
| Phase 2 | CI drift防腐 infra | ⏳ **this session** |

**KB state (prod cretas_prod_db):**
- `restaurant-product-manual.html` → 228 chunks, subcategory=restaurant
- Counter-test: 19/20 pass

---

## Phase 2: 4 items (~3-4 hr)

### Task 19: CI lint scripts (2 Python scripts + meta comments in HTML)

**Step 1: Add `<!-- last-verified -->` meta to §1/§2/§11 in HTML**

In `docs/plans/restaurant-product-manual.html`, inside each of §1/§2/§11 h1, add a meta comment on the next line:

```html
<section id="ch1">
  <h1>§1 智能数据分析 (AI Query)</h1>
  <!-- last-verified-against-product: 2026-04-29 -->
```

Same for ch2 and ch11.

**Step 2: Write `scripts/ci/check-kb-meta-freshness.py`**

```python
#!/usr/bin/env python3
"""CI lint: ensure §1/§2/§11 last-verified meta is not older than 6 weeks."""
import re, sys
from datetime import datetime, timedelta
from pathlib import Path

MANUAL = Path("docs/plans/restaurant-product-manual.html")
CHAPTERS = ["ch1", "ch2", "ch11"]
MAX_AGE_DAYS = 42  # 6 weeks

def main():
    text = MANUAL.read_text(encoding="utf-8")
    failures = []
    for ch in CHAPTERS:
        # Find section and look for meta comment within 3 lines of h1
        pattern = rf'id="{ch}".*?<!-- last-verified-against-product: (\d{{4}}-\d{{2}}-\d{{2}}) -->'
        m = re.search(pattern, text, re.DOTALL)
        if not m:
            failures.append(f"  {ch}: missing <!-- last-verified-against-product: YYYY-MM-DD --> meta")
            continue
        date_str = m.group(1)
        try:
            verified_date = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            failures.append(f"  {ch}: invalid date format '{date_str}'")
            continue
        age = (datetime.now() - verified_date).days
        if age > MAX_AGE_DAYS:
            failures.append(
                f"  {ch}: last verified {date_str} ({age} days ago) — exceeds {MAX_AGE_DAYS}-day limit. "
                f"Check if §{ch[2:]} UI changed; update meta when confirmed current."
            )
    if failures:
        print("FAIL: KB meta freshness check failed:")
        for f in failures:
            print(f)
        sys.exit(1)
    print(f"PASS: §1/§2/§11 last-verified meta all within {MAX_AGE_DAYS} days.")

if __name__ == "__main__":
    main()
```

**Step 3: Write `scripts/ci/check-kb-anchor-consistency.py`**

```python
#!/usr/bin/env python3
"""CI lint: ensure §B synthesis anchor refs match actual section IDs."""
import re, sys
from pathlib import Path

MANUAL = Path("docs/plans/restaurant-product-manual.html")

def main():
    text = MANUAL.read_text(encoding="utf-8")
    # Collect all section IDs
    all_ids = set(re.findall(r'<section\s+id="([^"]+)"', text))
    # Find synthesis section content
    m = re.search(r'<section id="synthesis">(.*?)</section>', text, re.DOTALL)
    if not m:
        print("FAIL: <section id='synthesis'> not found")
        sys.exit(1)
    synthesis_html = m.group(1)
    # Find all anchor hrefs in synthesis
    hrefs = re.findall(r'href="#([^"]+)"', synthesis_html)
    bad = [h for h in hrefs if h not in all_ids]
    if bad:
        print(f"FAIL: §B synthesis has {len(bad)} broken anchor(s): {bad}")
        sys.exit(1)
    print(f"PASS: §B synthesis anchor consistency OK ({len(hrefs)} refs, all valid).")

if __name__ == "__main__":
    main()
```

**Step 4: Commit scripts + meta**

```bash
# Commit scripts
mkdir -p scripts/ci
# (write the two scripts)
git commit -m "feat(ci): KB drift防腐 — meta freshness + anchor consistency lint scripts" -- scripts/ci/check-kb-meta-freshness.py scripts/ci/check-kb-anchor-consistency.py docs/plans/restaurant-product-manual.html web-admin/public/restaurant-product-manual.html
```

---

### Task 20: CI workflow + PR gates

**Step 5: Write `.github/workflows/kb-drift-check.yml`**

```yaml
name: KB Drift Check

on:
  push:
    paths:
      - 'docs/plans/restaurant-product-manual.html'
  pull_request:
    paths:
      - 'docs/plans/restaurant-product-manual.html'
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday 09:00 UTC

jobs:
  kb-drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Check meta freshness (§1/§2/§11)
        run: python scripts/ci/check-kb-meta-freshness.py
      - name: Check synthesis anchor consistency
        run: python scripts/ci/check-kb-anchor-consistency.py
```

**Step 6: Update/create `.github/CODEOWNERS`**

Add (or create if absent):
```
# KB-related changes require PM review
/docs/plans/restaurant-product-manual.html @stevenj4xie
/web-admin/src/views/smart-bi/ @stevenj4xie
/backend/python/smartbi/ @stevenj4xie
```

**Step 7: Update/create `.github/pull_request_template.md`**

Add a KB impact section near the bottom:
```markdown
## KB 知识库影响

- [ ] 本 PR 是否影响 §1 AI Query / §2 财务PBI / §11 菜品管理 的界面或逻辑？
  - 若**是**：请在同一 PR 中更新 `docs/plans/restaurant-product-manual.html` 对应章节，并更新章节头 `<!-- last-verified-against-product: YYYY-MM-DD -->`
  - 若**否**：无需操作
```

**Step 8: Commit PR gates**

```bash
git commit -m "feat(ci): KB drift防腐 — CODEOWNERS + PR template KB impact checkbox + kb-drift-check workflow" -- .github/workflows/kb-drift-check.yml .github/CODEOWNERS .github/pull_request_template.md
```

---

## Guardrails

1. **Concurrent-safe commits**: `git commit -m "..." -- file1 file2` (--only mode, rule 5b)
2. **No server deploy needed**: Phase 2 is pure CI/tooling — no Python deploy, no DB changes
3. **No brainstorming**: Spec is locked at Round 3 APPROVE
4. **CODEOWNERS**: Check if `.github/CODEOWNERS` already exists before creating — if so, append, don't overwrite

---

## Recommended first message

> 已读完 Phase 2 handoff。准备开始 Task 19 (CI lint scripts + §1/§2/§11 meta comments)，然后 Task 20 (workflow + CODEOWNERS + PR template)。先确认：`.github/CODEOWNERS` 和 `.github/pull_request_template.md` 是否已存在？

---

**End of handoff. Phase 2 is ~3-4 hr, all local file work, no server operations.**
