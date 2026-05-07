# ⚡ IMMEDIATE — task #25: region targetCompletion week-range tie-break (chat 2 fill-in)

**From**: organizer chat
**Date**: 2026-05-07
**Task**: #25 [FOLLOWUP] region targetCompletion week-range LinkedHashMap insertion order tie-break
**Scope**: ~30-60 min,1-2 PR scope discovery + impl
**Block**: T6.4 100% factories cutover (real customer data 4-tied changePercent regions trigger 18 diffs)

---

## 背景 — assumption inversion alert

`backend/python/smartbi_compat/api/analysis_region.py:518` 的 `_build_region_target_completion` 当前使用 `_java_hashmap_bucket` pre-sort + stable sort by changePercent desc。这假设 Java 用 **HashMap** (hash bucket iter order) 作 grouping。

但 retrospective doc (PR #97 PR-N-2 era) 标记: "**LinkedHashMap** insertion order requires SQL alignment" — 暗示 Java 实际可能是 LinkedHashMap (insertion order based on SQL row order),不是 HashMap (hash bucket)。

**如果 Python 假设错**: 当前 _java_hashmap_bucket 排序跟 Java 实际 LinkedHashMap insertion order 不一致 → 4-tied changePercent regions (e.g. 上海/江苏 90.91% on Q1) 顺序错 → 18 diffs。

---

## 你的 Phase A: 验证 Java 真实 grouping 类型

### A.1 Read Java RegionAnalysisServiceImpl

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RegionAnalysisServiceImpl.java`

Read line 269-314 (`getRegionTargetCompletion` 实现)。回答:

1. SQL query 文本 (找 native query 或 JPA repository call)
2. SQL 是否含 ORDER BY?如果有,ORDER BY 哪个 column?
3. Aggregation 怎么做? 几种可能:
   - `Collectors.groupingBy(KeyExtractor)` → 默认 **HashMap** (hash bucket)
   - `Collectors.groupingBy(KeyExtractor, LinkedHashMap::new, ...)` → **LinkedHashMap** (insertion order based on stream order)
   - `stream().collect(...).stream().collect(Collectors.toMap(..., LinkedHashMap::new))` → 同上
   - Manual `LinkedHashMap` constructor + putAll loop → insertion order
4. 排序在哪一步? Aggregation 之前 vs 之后?
5. 最终 `List<MetricResult>` 来源是 `aggregationMap.entrySet().stream().map(...)` 还是 `entrySet().stream().sorted(...).map(...)`?

### A.2 SSH server side — 比对 prod golden 数据

如果 Java code 不清楚,直接 query 一组 4-tied changePercent 数据看 Java 输出 region 顺序:

```bash
# 用 PR-1 spike token 生成方式获 F999 token
TOKEN=$(...)

# Java prod 10010
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:10010/api/mobile/F999/smart-bi/analysis/region?startDate=2024-01-01&endDate=2024-03-31" \
  > /tmp/java-region-q1.json

# Python prod 8083 (用 SSH localhost,不走 nginx canary)
ssh root@47.100.235.168 "curl -s -H 'Authorization: Bearer $TOKEN' \
  'http://localhost:8083/api/mobile/F999/smart-bi/analysis/region?startDate=2024-01-01&endDate=2024-03-31'" \
  > /tmp/python-region-q1.json

diff <(jq '.data.targetCompletion' /tmp/java-region-q1.json) \
     <(jq '.data.targetCompletion' /tmp/python-region-q1.json)
```

如果 diff 出现 (顺序不一致),记录 4-tied region 在 Java 跟 Python 各自顺序,反推 Java 用什么 order。

### A.3 Conclusion

写下结论 (写进 spec doc / PR description):
- Java grouping 类型: HashMap / LinkedHashMap / 其他
- 如果 LinkedHashMap: insertion order 来自什么 (SQL ORDER BY by region? 字典序?)
- 如果 HashMap: 当前 Python _java_hashmap_bucket fix 是对的方向 (这种 case task #25 实际 already fixed,close as no-op)

⛔ HOLD: Phase A discovery 完之后 STOP ping user with conclusion before Phase B impl。

---

## Phase B: Impl fix (按 Phase A 结论)

### Case 1: Java 是 LinkedHashMap (假设 inversion 是对的)

改 `analysis_region.py:518-570`:
- 删掉 `_java_hashmap_bucket` 相关 step 1
- 改 SQL query 加 ORDER BY (如果当前 query 没有)
- Python aggregation 改 `dict()` (Python 3.7+ 保 insertion order = LinkedHashMap behavior),不需要 manual sort tie-break

### Case 2: Java 是 HashMap (task #25 已 fixed, close no-op)

写一份 doc-only PR confirming:
- Java code reference (line 269-314 grouping type)
- 现状 Python fix 方向正确
- Close task #25 as no-op,但留 spec-doc as "已 verified" reference

### Case 3: 其他 (e.g. Java 用 manual sort)

ping organizer with details,等 GO 再 impl。

---

## Phase C: Edge case golden + parity test

录 F999 / F001 region targetCompletion goldens 在 4-tied changePercent edge case:

```bash
# F999 / F001 in 4 quarter ranges (Q1/Q2/Q3/Q4) covering tied changePercent
for fid in F999 F001; do
  for q in "2024-01-01:2024-03-31" "2024-04-01:2024-06-30" "2024-07-01:2024-09-30" "2024-10-01:2024-12-31"; do
    start=${q%:*}; end=${q#*:}
    ./scripts/record-java-golden.sh $fid $fid \
      "/api/mobile/$fid/smart-bi/analysis/region" \
      "startDate=$start&endDate=$end" \
      > tests/fixtures/java-smartbi-golden/analysis-region-$fid-$start.json
  done
done
```

加 byte-shape parity test:
- `tests/python/smartbi_compat/test_analysis_region.py` 或类似 (找 existing test file)
- Test fixture 含 4-tied changePercent regions
- Assert Python `targetCompletion` list 顺序跟 Java golden 一致

---

## Phase D: PR + ⛔ STOP ping user before push (NEW)

⛔ **新 rule** (per memory `feedback_pause_before_deploy_or_push.md`):
> Deploy or git push 前必须停下通知 Steve. 他用多 worktree/多 chat, 需要先 git stash + worktree merge 再继续. 仅本地 commit 不强制.

所以工作流改成:
1. Local commit OK (随时做)
2. ⛔ STOP — ping Steve before `git push`
3. Wait for Steve 给 GO (e.g. "push OK" / 等他 worktree state 好)
4. `git push` → `gh pr create`

```bash
# Steps 1-2 OK
git add backend/python/smartbi_compat/api/analysis_region.py \
        tests/fixtures/java-smartbi-golden/analysis-region-F*-*.json \
        tests/python/smartbi_compat/test_analysis_region.py
git status --short
git commit -- ... -m "fix(phase2a): region targetCompletion <Phase A 结论 key>"

# ⛔ STOP — ping user
# "Local commit done. Awaiting your GO before git push (per worktree-merge-first rule).
#  Branch: ops-region-tie-break. Commit: <SHA>. Diff: <files list>."

# Steps 3+ 等 user GO
# git push -u origin ops-region-tie-break
# gh pr create ...
```

⛔ 同样 rule 适用 Phase A discovery 如果你 commit 文档/golden 但 not impl: 任何 push 之前 STOP ping user。

---

## Step 0 — 新 worktree (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/region-tie-break -b ops-region-tie-break origin/main
cd .worktrees/region-tie-break
pwd
git branch --show-current
```

---

## ⛔ HOLD blocks

| Block | Trigger |
|---|---|
| ⛔ DO NOT git push before STOP+ping user (NEW per worktree-merge rule) | All commits stay local until user GO |
| ⛔ DO NOT deploy prod (--env prod) | chat 1 PR-3 24h soak observation period — prod 状态 frozen until 2026-05-08 11:36 CST |
| ⛔ DO NOT touch chat 1 ops-uvicorn-workers worktree or ops-receivable-rule10 worktree | Their isolation |
| ⛔ DO NOT chain to T6.4 plan or other speculative work | Single PR scope |
| ⛔ DO NOT 改 _java_hashmap_bucket helper | Even if task #25 fix shows it's wrong direction for region — helper is used elsewhere (Rule 8) |
| ⛔ DO NOT skip Phase A discovery | Don't blindly impl based on retrospective doc — verify Java first |

---

## Stop-and-ping 触发条件

- Phase A discovery 后 (mandatory STOP per Phase A.3 instruction)
- Java code 含 manual sort logic 不像 HashMap 也不像 LinkedHashMap (Case 3 — ping with details)
- 4-tied changePercent edge case 在 prod 数据**找不到** (e.g. F001 没有 tied changePercent regions)
- Phase A 发现 task #25 实际已 fixed (Case 2),改成 close-as-no-op confirmation PR
- 改 region 文件触发 chain reaction 到其他 endpoint
- Test env smoke 任何 5xx
- 任何 git push 之前 (per pause rule)

---

## Resumption checklist

- [ ] `cd .worktrees/region-tie-break && git pull origin main` 拿最新 main
- [ ] Read this marching order
- [ ] Phase A.1 Read Java RegionAnalysisServiceImpl line 269-314
- [ ] Phase A.2 SSH compare Java vs Python output for tied case
- [ ] Phase A.3 conclusion (HashMap / LinkedHashMap / other)
- [ ] **STOP** ping user with Phase A conclusion before Phase B impl
- [ ] (organizer GO 后) Phase B impl per Case 1/2/3
- [ ] Phase C edge case goldens + parity test
- [ ] Phase D commit local + **STOP** ping user before push
- [ ] (user GO 后) push + PR + ping organizer

---

## 注意

Task description 提到 LinkedHashMap 是基于 retrospective doc 推断,**未必准确**。Phase A 的目的是 verify。如果 task #25 实际 already fixed (Case 2),老实 close 比硬 impl 重要。

Reference: 你 task #31 PR-A 自己抓到 V20260427_01 dupe 的能力 — 同样质量的 spec discovery 这次也用得上。
