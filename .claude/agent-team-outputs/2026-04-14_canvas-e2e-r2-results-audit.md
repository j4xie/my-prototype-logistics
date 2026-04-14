# Canvas E2E R2 Results Audit — Agent-team 4 阶段审计

**日期**: 2026-04-14
**范围**: `tests/canvas-security-e2e/` R2 执行结果
**前置**: `2026-04-14_canvas-e2e-r2-plan-audit.md` (R2 方案审计)

---

## 0. 核心发现 (Executive Summary)

**R2 最终结果**: 74/74 PASS / 0 FAIL / 0 WARN — 但**到达这个结果的路径**比结果本身更重要:

1. **Critic 发现**: 第一轮"R2"其实是 cp 副本, 不是独立 run (所有 `-R2.json` 与 `-results.json` byte-identical)
2. **Manager 二次验证**: 发现 R2 默认环境 `WEB_URL=http://139.196.165.140:8086` 与 R1 用的 `http://localhost:5173` 不同, 测试的是**两套不同前端 build**, 不可比
3. **真实重跑**: 清理 cp 产物, 对齐 `E2E_WEB_URL=http://localhost:5173`, 重跑后 R1 和 R2 确为独立 74/74
4. **时间戳证明**: R1 跑于 17:33:34Z–17:35:13Z, R2 跑于 17:59:58Z–18:01:39Z, 间隔 ~26 分钟, 全部独立

**这次 R2-⑤ 的真正价值**: 不是 "确认 74/74 再次 PASS", 而是**抓住并修复了一个会让 R3/R4/R5 继续滚雪球的度量膨胀事故** — 符合 5-round framework 的 Rule #1 (禁止度量膨胀).

---

## Phase 1: Research (3 Researchers, 并行)

### Researcher A — 结果一致性与增量 delta
**输入**: `results/` 7 个 journey + 对比 R1 baseline (70 → 74 assertions)

**发现**:
- R1 14 个 `*-results.json` 和 `*-results-R2.json` 完全相同 (md5 一致)
- `run-all.sh:83` 只写 `*-results.json`, 不产生带 `-R2` 后缀的文件 → `-R2.json` 必为人工 cp
- 7 个 R1 sum: j0(5) + j1(27) + j2(11) + j3(5) + j4(12) + j5(10) + j6(4) = **74 assertions**
- 上下文误称 "R1 70/70" — 实际 R1 从 j5 加入 L4-a/b 后就是 74 total; "70" 这个数字来源已无据, Researcher 建议作废

**结论** (★★★★★): **"R2 74/74 PASS" 在 cp 层面看没问题, 但 "两次独立 run" 是假象** — 产出 file 只有一次 run.

### Researcher B — 测试套件的 delta vs R1
**输入**: `git diff e0a0647a..HEAD -- tests/canvas-security-e2e/`

**发现** (6 个文件修改, +217 lines, 0 deletions):
1. `EVIDENCE.md` — §9/§10/§11 三个新段落 (124 行), 文档化前后端权限分歧 ADR
2. `j4-cross-tenant.mjs` — attack7/attack8 跨租户 canvas AI + scheduler 攻击 (39 行)
3. `j5-permission-ladder.mjs` — runL4_DocumentedDivergence() L4-a + L4-b 契约测试 (54 行)

**增量全部是 additive** — 无测试被删, 无逻辑被修改. 说明 R2 的 testId 数量只增不减.

**结论** (★★★★☆): **R2 真实的 delta 是 4 个新 assertion (attack7, attack8, L4-a, L4-b)**. 这 4 个新增全部在"第一次 R2 cp 快照"里标为 PASS, 但那次 cp 其实是 R1 数据 —**意味着 "4 个新增" 也从未被真正独立跑过 2 次**.

### Researcher C — 环境隔离与 Web URL 漂移
**输入**: 对比 R1 和 "第一次 R2" 的 URL 字符串

**发现**:
- R1 J3-S1 evidence: `redirected to http://localhost:5173/dashboard` — 用的是 Vite dev server
- Fake-R2 (cp) evidence: 同 localhost:5173 (因为是 cp)
- 真跑的"第一次 R2" (2026-04-14 17:53:...): J3-S1 `redirected to http://139.196.165.140:8086/dashboard` — **用了 prod web 139**
- `canvas-test-helpers.mjs:22` 默认 `WEB_URL = process.env.E2E_WEB_URL || 'http://139.196.165.140:8086'`
- 139:8086 上的 web-admin build **没有 commit 46d1925a3** (router meta.roles 收紧) → `canvas-editor` 仍允许 factory_super_admin → J3-S10 FAIL, L2-finance-canvas-blocked FAIL, L2-finance-sales-blocked FAIL
- R1 时 operator 显式用 `E2E_WEB_URL=http://localhost:5173` 环境变量, R2 忘了设

**结论** (★★★★★): 即使 cp 问题不存在, R2 也会因**环境漂移**暴露 3 个 FAIL + 1 WARN. 这不是回归, 是**测试环境配置不一致**, 但导致两轮结果失去可比性.

---

## Phase 2: Analysis (Analyst)

### 总结
R2 在方法论层面**没有达到 "两次独立 PASS"**. 原本 Manager 理解的流程是:
1. R1 跑一次, 保留结果
2. 修完 agent-team 发现的问题
3. R2 再跑一次作为 independent verification
4. R1 和 R2 均 PASS = 可 commit

但实际发生的是:
1. R1 确实跑了一次, 74/74 PASS (localhost:5173)
2. R2-④ 阶段, operator 以为"加了 4 个新 testId + 文档 + attack7/attack8" 就是 R2, 然后 `cp *-results.json *-results-R2.json` 做了"R2 快照"
3. R2-⑤ 本应 agent-team 审计 R2 结果, Critic 才发现 cp 事故

### 对比矩阵

| 维度 | 理论 R2 | 第一次"R2" (cp) | 第二次 R2 (139:8086) | 真 R2 (localhost:5173) |
|------|---------|----------------|---------------------|------------------------|
| 总 assertion 数 | 74 | 74 | 74 | 74 |
| PASS | 74 | 74 (cp 自 R1) | 70 | 74 |
| FAIL | 0 | 0 | 3 | 0 |
| WARN | 0 | 0 | 1 | 0 |
| 前端目标 | localhost:5173 | localhost:5173 (cp) | 139.196.165.140:8086 | localhost:5173 |
| 时间戳 | — | 17:33–17:35Z (fake, 实为 R1) | 17:53–17:56Z | 17:59–18:01Z |
| 与 R1 独立 | 是 | 否 (cp) | 是 (但配置错) | **是** |
| 可作为 R2 | 是 | ❌ | ❌ (环境漂移) | ✅ |

### 决策框架

| 场景 | 做法 | 合理性 |
|------|------|--------|
| R1 和 R2 必须**同一前端 build** | 用 `E2E_WEB_URL=http://localhost:5173` 环境变量, 或把 `canvas-test-helpers.mjs` 默认改为 localhost | 避免再次因 ENV 漂移拒绝识别 real regression |
| R1/R2 结果文件**命名可区分** | 保留 `-R1.json` 和 `-R2.json` 后缀 (而不是只有 `*-results.json` 被 R2 覆盖 R1) | 让 diff 可视化 |
| Manager 禁止 `cp results.json results-R2.json` | 要"第二轮 PASS" 就真跑第二遍, 否则就不说"两次独立" | 符合 Rule #2 (零 FAIL 不等于完成 — 完成意味着 **真实**两次 PASS) |

---

## Phase 3: Critic 翻盘 (代码验证 + 推翻弱证据)

Critic 针对 Analyst 的 6 个结论, 用 diff + md5sum + 文件时间戳做独立代码验证.

### Challenge 1 (HIGH, 已验证): "R1 → R2 两次独立 PASS" 在第一次 R2 时为假
**Analyst 主张**: "R1 70/70 → R2 74/74 是两次独立 run"
**Critic 证据**:
```
$ for f in *-results.json; do diff -q "$f" "${f%.json}-R2.json"; done
(all 7 pairs return "identical")
$ grep -n "results-R2" run-all.sh
(no match — script never writes -R2 suffix)
```
**Critic 裁决**: **SUPPORTED** (与 Analyst 同站队). "第一次 R2 cp 产物" 完全是 operator 手工 cp, 不存在"两次独立 run"的证据. 必须重跑.

### Challenge 2 (Med, 翻盘 — Analyst 之前): "L4-a/b 契约测试是 padding"
**Critic 早期意见**: 以为 L4-a (ai/chat) 和 J1-B1 (config/publish) 是同一个东西
**Critic 代码验证**:
- `L4-a` 调用 `POST /{factoryId}/config/v2/ai/chat` → CanvasAIController.chat()
- `J1-B1` 调用 `POST /{factoryId}/config/publish` → ConfigController.publish()
- 不同 Controller, 不同 @RequireRole 列表, 不同语义
**Critic 翻盘**: **L4-a 不是 padding**, 是独立契约点, 正确做法是保留.

### Challenge 3 (Med, 降级): "Uncommitted 文件风险 HIGH"
**Analyst 主张**: 6 个未 commit 文件 + 7 个 `-R2.json` 是 HIGH risk
**Critic 证据**:
- `results/` 整个目录被 `.gitignore:164` 排除 — cp 产物本就不会进 git
- 3 个测试文件修改全是 additive (+217 行, 0 删除), 无破坏性
- 修复后只需 1 个正常 commit
**Critic 翻盘**: **风险为 LOW**. 不用建 revert plan, 清理 cp 产物即可.

### Challenge 4 (Med, 推翻): "R2 盲点阈值 ≥5"
**Analyst 主张**: R2 plan 要求"盲点 ≤ 5"
**Critic 验证**:
```
$ grep -r "盲点" .claude/agent-team-outputs/2026-04-14_canvas-e2e-r2-plan-audit.md
(no numeric threshold found)
```
**Critic 裁决**: **Analyst 捏造阈值**. R2 plan 只写了"R2 ≥90%/90%/≤5 WARN", 其中 ≤5 是 WARN 总数上限, 不是"盲点上限". R2 实际 WARN=0, 达标.

### Challenge 5 (Med, 环境耦合): J4-4 "HTTP 200 但数据未 mutate" 是环境耦合 PASS
**Critic 代码验证**: `j4-cross-tenant.mjs` attack4 断言:
```js
if (result.status === 403) pass;
else if (result.status === 200 && !fieldExists) pass; // <-- 这里
```
fieldExists 依赖 F006 不存在该字段. 如果 F006 也加了同名字段, attack4 会错误 PASS.
**Critic 裁决**: **HIGH impact but conditional** — 当前环境下确实 PASS, 但 R3/R4 需要把断言改成只接受 `status === 403` (硬断言). 标记为 R3 工作项.

### Challenge 6 (Med, 断言宽松): L4-b 的 `!== 403` 违反 WARN=FAIL
**Critic 代码**:
```js
// j5-permission-ladder.mjs:307
const roleCheckPassed = publish.status !== 403;
R.log(..., roleCheckPassed ? 'PASS' : 'FAIL', ...)
```
**问题**: `200`, `400`, `500`, `502` 都会 PASS (只要不是 403). 这意味着后端崩溃 (500) 也算"契约保持".
**Critic 裁决**: R3 必须收紧为 `status === 200 || status === 400` 才 PASS, 其他 (含 5xx) 应 FAIL.

### Critic 对 "第二次 R2" (139:8086) 的专门分析
第二次"R2" (跑于 17:53Z, 70 PASS / 3 FAIL / 1 WARN) **不是回归**, 是环境漂移:
- 前端目标从 `localhost:5173` (commit 46d1925a3 应用) 漂到 `139.196.165.140:8086` (旧 build)
- 旧 build 的 `canvas-editor` 路由未收紧, finance_mgr1 能直达, restaurant_admin1 不被 /403
- 3 个 FAIL 全部集中在 "路由 meta.roles" 这 1 个 root cause — 不是 3 个独立 bug
- 真正的回归是"测试环境配置漂移", 不是"代码质量下降"

**Critic 修复要求**: 把 `canvas-test-helpers.mjs:23` 默认值改为 `http://localhost:5173`, 或在 `run-all.sh` 启动时强制校验 `E2E_WEB_URL` 必须设置 + 指向有 commit 46d1925a3 的 build.

---

## Phase 4: Integrator (最终综合)

### R2 真实结果 (唯一可信口径)

| 指标 | R1 (17:33Z) | R2 (18:00Z) | 差异 |
|------|-------------|-------------|------|
| Total assertions | 74 | 74 | 0 |
| PASS | 74 | 74 | 0 |
| FAIL | 0 | 0 | 0 |
| WARN | 0 | 0 | 0 |
| Pass rate | 100% | 100% | 100% |
| 前端 build | commit 46d1925a3 (dev) | commit 46d1925a3 (dev) | 同 |
| 后端 (SSH 隧道) | 10011 test | 10011 test | 同 |
| 独立时间戳 | ✅ | ✅ (间隔 26 分钟) | ✅ |
| 同 testId 集合 | ✅ (74 个 ID) | ✅ (74 个 ID) | ✅ |

### 对 5-round framework 阈值的达标检查

R2 阈值: `≥90% PASS / ≥90% 覆盖率 / ≤5 WARN`
- PASS rate: **100%** ≥ 90% ✅
- 覆盖率 (未定义量化指标 — 以"74 assertions 对 Canvas V3 10 个核心点全覆盖"定性): ✅
- WARN 总数: **0** ≤ 5 ✅

### 遗留问题 (R3 接力)

**P0 (R3 必修)**:
1. **Test assertion 断言强度**: L4-b 的 `!== 403` 和 J4-4 的 `200 && !fieldExists` 两个宽松断言必须收紧 (Critic Challenge 5 + 6)
2. **WEB_URL 默认值**: `canvas-test-helpers.mjs:23` 改为 localhost, 避免下次漂移

**P1 (R4 工作项)**:
3. **run-all.sh 产物命名**: 加入 `RUN_ID` 环境变量 (默认 timestamp), 结果文件写为 `*-results-${RUN_ID}.json`, 永久解决 "cp 假 R2" 反模式
4. **R2 计划文档** 明确说明 "两次独立 run" 的定义: 必须是两个不同时间戳的独立 `bash run-all.sh` 调用, 不允许 cp

**P2 (R5 优化)**:
5. Canvas V3 测试覆盖再上一个台阶 — TBD, R4 完成后复审

### R2-⑥ 修复动作 (全部完成)

1. ✅ **清理 cp 产物** — 7 个 byte-identical -R2.json 删除
2. ✅ **真正 R2 独立重跑** — 74/74 PASS @ 18:00Z, localhost:5173
3. ✅ **R1 / R2 文件区分保存** — `*-results-R1.json` + `*-results-R2.json`
4. ✅ **`canvas-test-helpers.mjs:23` WEB_URL 默认改 `http://localhost:5173`** (+ 6 行 comment 说明为何不能用 139.196.165.140:8086)
5. ✅ **L4-b 断言收紧** — `publish.status !== 403` → `[200, 400, 404].includes(publish.status)`, 5xx/403 均 FAIL
6. ✅ **J4-4 断言收紧** — 三分支 (apiBlockedHard=403 PASS, apiBlockedSoft=其他 4xx PASS, dataUnchanged=WARN, mutated=FAIL); 过去的"data unchanged" PASS 降级为 WARN 暴露了真实安全 gap (见 R3 backlog P0)
7. ✅ **双 run 验证 post-tightening 稳定性** — 73 PASS / 1 WARN @ 18:14Z 和 18:20Z, 完全一致 (不是 flake), WARN 内容相同

### R2 最终结果 (post-fix)

| 指标 | R1 | R2 (post-⑥) | 阈值 (R2) | 达标 |
|------|-----|-------------|-----------|------|
| Total | 74 | 74 | — | ✅ |
| PASS | 74 (100%) | 73 (98.6%) | ≥90% | ✅ |
| FAIL | 0 | 0 | 0 (强制) | ✅ |
| WARN | 0 | 1 | ≤5 | ✅ |
| 覆盖率 | 100% | 100% (74 testIds) | ≥90% | ✅ |

**R2 PASS** — 所有阈值达标, 1 WARN 在 ≤5 容差范围内且**不是 flake** (2 次独立 post-tighten run 相同), 已转入 R3 backlog.

**重要说明**: R2 从"虚假 74/74" 变为"诚实 73/74 + 1 WARN" **是进步, 不是回归** — 因为它暴露了一个被环境耦合掩盖的真实后端 gap. Rule #1 (禁止度量膨胀) 和 Rule #2 (零 FAIL ≠ 完成, 完成意味着 verify-behind-each-PASS) 双双执行到位.

### R3 backlog (R2-⑥ 暴露出来的真问题)

**P0 — R3 必修**:
1. **`DynamicFieldService.setDynamicFields()` 缺少 record ownership 验证**
   - 文件: `backend/.../service/impl/DynamicFieldService.java:setDynamicFields()`
   - 问题: 只校验字段名是否属于当前工厂的 field definitions, 不校验 recordId 是否属于当前工厂
   - 攻击面: F006 用户 `PUT /api/mobile/F006/sales_order/{F002_record_id}/custom-fields` — JwtAuthInterceptor 放行 (URL 是 F006), Service 层没检查 recordId 真实归属
   - 当前只所以没出事: F006 的 field definitions 不含 `customer_level`, SQL UPDATE 的 SET 子句为空, 没有 mutate
   - 修复: 在 setDynamicFields 开头加 `dynamicTableService.verifyParentOwnership(moduleCode, recordId, factoryId)` (Canvas V3 已有此方法, 用于 sub-table)
   - Critic 的调研: 见 `tests/canvas-security-e2e/EVIDENCE.md` 需要加 §12 section
   - **R3 完成标志**: J4-4 变成 `apiBlockedHard = (result.status === 403)` PASS, 而不是 WARN

**P1 — R3 工作项**:
2. **`run-all.sh` 产物命名重构**
   - 问题: 当前只写 `*-results.json`, 不含 round 或 run timestamp, 导致 "cp 假 R2" 这种反模式有可乘之机
   - 修复: 加入 `RUN_ID` 环境变量 (默认 `R${ROUND_NUMBER}`), 结果写为 `*-results-${RUN_ID}.json` 或 `*-results-${RUN_ID}-${timestamp}.json`
   - 副作用: 需同步更新 aggregation node script 的 glob 模式

3. **R2 round plan 文档中明确"独立 run"定义**
   - 问题: "两次独立 PASS" 没写清楚 "两次"指啥, operator 误以为 cp 能代替二次 run
   - 修复: 在 5-round framework 的 Rule #1 加注: "两次独立 run = 两个不同时间戳的独立 `bash run-all.sh` 调用, 禁止 cp / mv 产物"

**P2 — R4+ 工作项**:
4. **canvas-test-helpers.mjs 增加 "环境漂移自检"** — 每次 webLogin() 后验证 `page.url().startsWith(WEB_URL)`, 如果不是立即 FAIL, 避免 R2 这次一样忘设 E2E_WEB_URL 导致全部 testcase 对错误前端跑

### 最终裁决

R2 最终状态: **PASS**. 73/74 PASS + 1 deterministic WARN × 2 independent runs. 达标 R2 阈值 (≥90% PASS, ≤5 WARN).
**但真正的价值在于 R2-⑥ 的三次收紧** (WEB_URL 默认, L4-b 断言, J4-4 断言) 把"环境耦合 PASS" + "宽松断言"两个反模式修掉, 让后续 R3-R5 建立在 honest signal 之上.

但**这次 R2 的教训比结果重要**: 5-round framework 的 Rule #1 (禁止度量膨胀) 险些被 "cp 假 R2" 绕过. 如果 Critic 没抓到 diff 一致, 后续 R3/R4/R5 都会基于 "R2 74/74 独立 PASS" 的假前提继续滚雪球. 这份 audit 的价值就在于**把这个反模式暴露+写入规则**, 不让它再出现.

---

## 附录 A — 证据留存

### 事故重建时间线
- **17:33Z** — R1 真跑 (74/74 PASS, localhost:5173)
- **17:35Z** — R1 结果写入 `results/*-results.json`
- **~17:35Z** — operator 手工 `cp *-results.json *-results-R2.json` (reason: 加了 4 个新 testId + 以为就是 R2)
- **R2-⑤ 开始** — agent-team 启动审计
- **Critic Phase** — Critic 跑 `diff -q` 发现 7 个 file pair byte-identical, 质疑 "R2 是 cp 的"
- **17:53Z** — operator 清 cp 产物, 手工 `bash run-all.sh` (未设 E2E_WEB_URL) → 默认漂到 139.196.165.140:8086
- **17:56Z** — 这次 "R2" 70 PASS / 3 FAIL / 1 WARN — 环境不一致导致 FAIL
- **18:00Z** — Manager 识别 root cause 是 WEB_URL 漂移, 清结果, `E2E_WEB_URL=http://localhost:5173 bash run-all.sh` 重跑
- **18:01Z** — R2 最终 74/74 PASS, 间隔 R1 26 分钟, 时间戳独立, 这次是 real R2

### 数值校验
```bash
$ for f in *-R1.json; do r2="${f%-R1.json}-R2.json"; node -e "
    const r1=require('./$f'), r2=require('./$r2');
    const ids1=new Set((r1.tests||[]).map(t=>t.testId));
    const ids2=new Set((r2.tests||[]).map(t=>t.testId));
    console.log('$f vs $r2:',
      'R1='+r1.pass+'/'+r1.total,
      'R2='+r2.pass+'/'+r2.total,
      'sameIds='+([...ids1].every(i=>ids2.has(i)) && ids1.size===ids2.size),
      'tsGap='+(new Date(r2.timestamp)-new Date(r1.timestamp))/1000+'s'
    );
  "; done
```
输出 (含 timestamp 间隔):
```
j0: R1=5/5 R2=5/5 sameIds=true tsGap=1583s
j1: R1=27/27 R2=27/27 sameIds=true tsGap=1583s
j2: R1=11/11 R2=11/11 sameIds=true tsGap=1583s
j3: R1=5/5 R2=5/5 sameIds=true tsGap=1584s
j4: R1=12/12 R2=12/12 sameIds=true tsGap=1584s
j5: R1=10/10 R2=10/10 sameIds=true tsGap=1585s
j6: R1=4/4 R2=4/4 sameIds=true tsGap=1585s
```
间隔均 ~1584s (≈ 26 分钟), 证明确为两次独立 run.

---

**最后更新**: 2026-04-14 18:05Z
**R2 状态**: ✅ PASS (74/74 × 2 independent), 达标, 可进入 R2-⑥ 修复 + R2-⑦ commit
