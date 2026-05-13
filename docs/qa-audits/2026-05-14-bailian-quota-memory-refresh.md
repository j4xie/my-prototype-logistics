# Bailian Free-Quota Audit Pattern — Memory Refresh

**Date**: 2026-05-14
**Issue**: [#582](https://github.com/j4xie/my-prototype-logistics/issues/582) — `reference_bailian_free_quota_audit_pattern.md` May-9 data stale
**Source of truth**: [`tests/qa-llm-quota/audit-matrix.md`](../../tests/qa-llm-quota/audit-matrix.md) (PR #577 live audit, May 13 2026)
**Memory file refreshed (out of repo, user-level)**: `~/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/reference_bailian_free_quota_audit_pattern.md`

---

## §0 Why this PR exists

Memory file `reference_bailian_free_quota_audit_pattern.md` was authored 2026-05-09 with a strong claim that aliyun_a was a "雷区" (paid for bare aliases) and aliyun_b was a "免费金矿" (free for all bare aliases). PR #577 live re-audit on 2026-05-13 found this claim partially stale:

- `aliyun_a/qwen-flash` (bare) — **was paid May 9, returns 200 OK May 13** (flipped to free)
- `aliyun_a/qwen3.5-plus` (bare) — **returns 200 OK May 13** (May-9 sibling `qwen-plus` on A was paid)
- `aliyun_b/qwen3.6-flash` — **was 1M FREE May 9, returns 403 EXHAUSTED May 13** (flipped to exhausted — triggered prod incident)

PR #577 audit matrix even explicitly flags the contradiction inline: `qwen-flash … working on A too (memory said paid — re-check; may be free now)`.

Issue #582 asked for a 10-min refresh — done here, plus a tightening that this kind of point-in-time SKU claim should never be cached in long-term memory without a "re-verify before relying" warning.

---

## §1 What changed in the memory file

| Section | Before (May 9) | After (May 14) |
|---|---|---|
| Top-line description | "a/b 账号反向行为 + 裸 alias vs 版本后缀 SKU 的 paid/free 差异" | "**SKU 状态会逐周轮动 (Aliyun rotates policy), 用前必须 live re-audit**" |
| Top warning | (none) | NEW §"⚠️ 顶部警告: SKU 状态非永久, 用前必须 live re-audit" with `/tmp/audit-llm.sh` pointer |
| Core finding | "aliyun_b 是免费金矿 / aliyun_a 是雷区 — bare aliases 多数 paid" (stated as durable rule) | Kept May-9 table as **historical record (marked STALE)** + added May-13 PR #577 table + 3-point "refined rule" |
| Refined rule | (implicit "B free / A paid" pattern) | **(1)** "B 金矿 / A 雷区" 不再准 — 两个账号都有可工作 SKU + 都有 exhausted SKU. **(2)** 裸 alias vs 版本后缀 — prod 用版本后缀 (防 silent churn), ad-hoc 用裸 OK. **(3)** 轮动证据 (具体 SKU flip 例) |
| Audit history table | (none) | NEW — 3 rows: May 9 / May 13 / May 14 each with finding + source PR |
| Code/path landing | `llm_router.py:122-184` + `test_llm_router_fallback.py` + chain order | Same + "(verify line range before relying, may drift)" + audit-matrix.md pointer |

---

## §2 What was KEPT from May-9 memory

The May-9 advice is not all wrong — much of it is operationally valuable:

- **`qwen3-vl-*` vs `qwen-vl-*` typo gotcha** (May-9 §"SKU naming gotcha") — still valid, audit-matrix.md PR #577 also uses `qwen-vl-plus-2025-05-07` (no "3").
- **Version-suffixed SKU 防 silent churn** advice — still valid. Refined: version-suffixed doesn't guarantee free quota (PR #577 found `qwen3.6-flash-2026-04-16` on A is 403 EXHAUSTED), but it **does** prevent the bare-alias case where Aliyun silently rotates the underlying model behind your back. Use version-suffixed for prod routing config to lock byte-shape behavior; bare aliases are fine for ad-hoc smoke / audit.
- **DeepSeek-via-bailian free SKU list** (May-9 §"DeepSeek SKU") — corroborated by PR #577 (`deepseek-r1` etc still 200 OK on aliyun_b May 13). NOT touched in refresh.
- **Audit console workflow** (May-9 §"audit 操作流") — still valid, 5-tab navigation still works.

---

## §3 Linkages

- **Memory file** (user dir, out-of-repo): `~/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/reference_bailian_free_quota_audit_pattern.md`
- **Repo audit data** (load-bearing): [`tests/qa-llm-quota/audit-matrix.md`](../../tests/qa-llm-quota/audit-matrix.md)
- **Related memory**: `reference_llm_api_keys_location.md` (keys location, unchanged)
- **Related memory**: `reference_llm_keys.md` (4-provider chain priorities, unchanged — PR #577 confirms chain order `aliyun_b → aliyun_a → zhipu → deepseek` unchanged)
- **Predecessor memory PRs** (graduate sources):
  - 2026-05-09 PR #215/#219 — original memory authorship
  - 2026-05-13 PR #577 — live re-audit + audit-matrix.md establishment

---

## §4 Path/PR-flow note (transparent organizer ping)

MO scope §"Files: 1 memory file edit" + "PR title / Branch / Close #582" has a structural inconsistency: the memory file lives in `~/.claude/...`, outside the repo tree, so it cannot itself be the diff in a git PR. To honor the spirit of the MO (close #582 via PR), this PR carries this thin audit-trail doc (`docs/qa-audits/2026-05-14-bailian-quota-memory-refresh.md`) as the in-repo artifact. The actual memory edit was done with the Write tool against the user-dir file in the same session — outside this PR's diff but inside this session's record.

If organizer prefers memory edits to NOT be paired with a thin doc PR (e.g., handle via `gh issue close 582` + comment), that's also fine — this audit-trail doc is short enough to also be deleted with minimal cost. Future similar MOs can be tagged as "memory-only, no PR" to skip the doc step.

---

## §5 Test plan

- [x] Read memory file May-9 contents → captured §"What changed" diff
- [x] Read PR #577 body + `tests/qa-llm-quota/audit-matrix.md` → captured May-13 data
- [x] Edited memory file in-place with Write/Edit tool (out-of-repo, user dir)
- [x] Memory file post-edit reviewed — preserves May-9 historical table as record, adds STALE warning + May-13 refresh + audit history table
- [x] Cross-cited PR #577 audit-matrix.md inside memory file (relative path back to repo root)
- [x] Doc-only no-op in repo (this file, ~80 LOC, single new file)
- [ ] Organizer ack of structural §4 note + admin-merge

Closes #582.
