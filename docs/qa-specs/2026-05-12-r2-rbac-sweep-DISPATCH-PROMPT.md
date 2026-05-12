# R2 Chat Dispatch Prompt

**Use this when firing the R2 RBAC sweep chat.** Paste this into a fresh `/clear` chat.

---

## Task

Execute the R2 RBAC sweep per the prepared spec.

🔴 **Mandatory worktree isolation** (per concurrent-edit-safety):

```bash
git worktree add C:/Users/Steve/cretas-r2-exec -b qa/r2-exec-rbac-sweep origin/main
```

Work entirely in that worktree.

## Inputs

- **Spec (your roadmap)**: `docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md`
- **Parent spec**: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` §5 R2 + §2.3
- **Script**: `scripts/qa/r2_rbac_sweep.py` (already dry-run verified on C1-admin)
- **Test target**: `http://139.196.165.140:8097` (nginx test vhost — proxies Java→47:10011 and Python→47:8084)

## Steps

1. **Detect PR #443 state** (run from worktree root):

   ```bash
   gh pr view 443 --json state,mergedAt,title
   ```

   - If `state=MERGED`: sweep treats C9/C10 warehouse as STRIP expected.
   - If `state=OPEN`: sweep treats C9/C10 warehouse as 500-KNOWN (WARN, not FAIL).

   Script auto-detects via `gh` CLI. If `gh` not available, pass `--assume-pr443-merged` only when you've manually verified merge.

2. **Run the sweep**:

   ```bash
   python scripts/qa/r2_rbac_sweep.py \
       --factory F001 \
       --output docs/qa-evidence/r2-rbac-sweep/
   ```

   Or use defaults (factory F001, nginx URLs). Expect ~36 cells in ~2-3 minutes (login burst may trigger 429 — script retries once after 65s).

3. **Review `matrix.json`**:
   - **0 FAIL**: ship as-is.
   - **Any FAIL**: open `raw/{cell}-{role}.json`, write root-cause hypothesis as a TaskCreate item before fixing. Per Rule 8 same-cause, grep for sister sites (e.g., a leak in `unitPrice` → check siblings annotated `@PriceSensitive` for same gap).

4. **For NEEDS_REVIEW cells** (E5 `/material-batches/inventory/valuation` per spec §5.2):
   - Capture stripped response screenshot/JSON.
   - Log for Steve — strip-only is current state, Option B/C is post-R2 decision.

5. **For WARN cells**:
   - Latent-leak PR #444 fields → log to follow-up issue, not a P0.
   - 500-KNOWN (warehouse C9/C10 when #443 OPEN) → log as known gap.

6. **PR**:

   ```bash
   # In your worktree:
   ./scripts/safe-commit.sh "qa(r2): RBAC sweep — 36 cells verified per spec" \
       docs/qa-evidence/r2-rbac-sweep/
   git push -u origin qa/r2-exec-rbac-sweep
   gh pr create --title "qa(r2): RBAC sweep — 36 cells verified" \
       --body "Closes R2 of parent spec. Matrix: 0 FAIL, N WARN explained, M NEEDS_REVIEW captured. Evidence: docs/qa-evidence/r2-rbac-sweep/"
   ```

## Acceptance

- ✅ **0 FAIL** in `matrix.json`.
- ✅ All WARN cells have rationale lines in `report.md` (script generates these).
- ✅ NEEDS_REVIEW cells (E5) captured with raw response — Steve decides post-R2.
- ✅ PR opened with matrix + report + raw/ directory.

## What R2 does NOT cover

Per parent spec §5 R2, the full R2 round also includes **customer-facing 3 PR L4 deep tests** (§3.2 of parent spec: L4-CF-1/2/3 — PR #423 v-if defense, #413 PDF, #414 receive column). Those are **UX Playwright tests**, a separate parallel chat. This sweep handles only the API-level RBAC matrix.

If you're the single R2 chat covering both: do the API sweep first (fast, ~30min), then UX tests. If multiple R2 chats: this is your chat.

## HARD rules reminders

- 🔴 Worktree isolation (rule 2 of concurrent-edit-safety)
- 🔴 `safe-commit.sh` or `git commit -- F1 F2` (rule 5b)
- 🔴 SHA verify push (`git ls-remote origin <branch>` matches local) before /clear
- 🔴 No `--env prod` anywhere in this flow (test env only)
- 🔴 If you find an actionable P0 bug, file as a TaskCreate ticket with cell ID + raw response path + root-cause hypothesis BEFORE patching

---

**Status**: spec + script ready. Dry-run verified on C1-admin (admin sees 30 price fields, PASS). R2 chat can fire as soon as Steve gives GO.
