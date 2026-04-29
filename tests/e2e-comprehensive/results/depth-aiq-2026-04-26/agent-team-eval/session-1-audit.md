# Session 1 审计报告 — SmartBI 深度测试

**生成时间**: 2026-04-26
**Agent-Team Mode**: Full | Codebase grounding: ENABLED | Healer: All checks passed ✅
**输入**: docs/plans/2026-04-26-deep-aiq-test-plan.md, upload-speed.json, questions.json, upload-curl.sh
**Phase**: Research (R1+R2+R3 并行) → Analysis → Critique → Integration

---

## Executive Summary

- **推荐路径**: 立即修 Bug D (2 行) → spike 9MB sync 单文件验证 (15min) → 修 Bug A (`_probe` 仅 30-50 行, 而非 R1 原估 80-150) → 路径 A3 用 async 端点重传 → 启动 S2 360 题
- **置信度**: 中高 (Critic 推翻 R1#4 主流路径假设, Bug A 改动量从 80-150 下调至 30-50 行; 其他三方共识)
- **核心风险**: 9MB sync xlsx OOM (35%) — 必须 spike 验证, 失败则降级 A2; 并发 commit 串文件风险
- **时间影响**: 立即 < 1h (Bug D + spike), 短期 1-3h (Bug A 修 + 重传 + S2 启动); 360 题不变
- **成本**: 低 (代码改动量在 Critic 修正后 ~ 35-65 行总计)

---

## 1. Researcher 输出 (3 角度并行)

### R1: Bug 根因 + 修复方向 (codebase-grounded)

| # | Finding | Source | ★ |
|---|---|---|---|
| 1 | **Bug A 根因**: `excel_async.py:_probe()` 287-291 只调 `pd.read_csv()` 全部文件,无 xlsx 分支 → 100% gbk decode crash | `backend/python/smartbi/api/excel_async.py:287-291` | ★★★★★ |
| 2 | **Sync 路径正确**: `excel.py:380-401` 按 ext 分支 (.csv → read_csv, else → ExcelFile) | `backend/python/smartbi/api/excel.py:380-401, 1136-1141` | ★★★★★ |
| 3 | **Bug B 根因**: `excel_async.py:53-141` 缺 ext 校验, 整 multipart body 流到磁盘后才 _probe 失败 | `backend/python/smartbi/api/excel_async.py:53-141` | ★★★★★ |
| 4 | ~~Bug A 影响 > _probe: line 416-429 主流也只 read_csv~~ | (Critic 推翻见 §3) | ❌ |
| 5 | **Bug D 根因**: `UploadArea.vue:20,30` accept=".xlsx,.xls" 缺 csv → Apr 26 phase 6 拆分 regression | `web-admin/src/views/smart-bi/analysis/UploadArea.vue:20,30` vs `ExcelUpload.vue:809` | ★★★★★ |
| 6 | **Bug C**: nginx `/smartbi-api/` 缺 `proxy_request_buffering off` + 默认 60s `proxy_read_timeout` (推断,nginx config 不在 repo) | `tmp/nginx_8086_admin_patch.conf:10-12,23-25` | ★★★★☆ |

### R2: 上传体验 + 速度瓶颈 (timing 数据 + UX)

| # | Finding | Source | ★ |
|---|---|---|---|
| 1 | 8 xlsx/xls 全失败合计浪费 **423.4s**, 9MB 唏嘛香会员.xlsx 浪费 189.5s | `upload-speed.json` | ★★★★★ |
| 2 | **错误 toast leak Python 技术栈错误** — 用户看到 `UnicodeDecodeError: 'gbk' codec can't decode...` 而非"格式不支持" | `web-admin/src/views/smart-bi/ExcelUpload.vue:495` | ★★★★★ |
| 3 | **无取消按钮** — axios 上传无 AbortController, 卡死 100s 只能关 tab | `ExcelUpload.vue` 全文 grep 0 处 cancel/abort | ★★★★★ |
| 4 | 同尺寸 csv 速度差 4-60x — 解析时间 dominate, 不是带宽 (gml 4334KB 35.4s vs 4904KB 174s) | `upload-speed.json` self-calc | ★★★★★ |
| 5 | poll_attempts >1 仅 3/11 文件 → sync 路径覆盖 90% case | `upload-speed.json` | ★★★★★ |
| 6 | uploading→parsing UX 切换有 (P0-6 修过), 但 parsing 阶段静态文字无具体 KPI | `ExcelUpload.vue:828-836` | ★★★★★ |

### R3: S2 准备路径 (XMX 补救 + GML 2月 + qhj/gml 是否先跑)

| # | Finding | Source | ★ |
|---|---|---|---|
| 1 | DB 实测: XMX 0 / GML 113K / QHJ 44K rows | prod DB query | ★★★★★ |
| 2 | `xlsx_converted/唏嘛香（牛肉面）2月销量报表.xlsx` 22KB **已预存** | filesystem | ★★★★★ |
| 3 | uploads 4178-4180 .xlsx 16 行历史成功 — 证明小 .xlsx 能过 async | prod DB | ★★★★☆ |
| 4 | sync 端点 `excel.py:618 /auto-parse` 有 .xlsx/.xls/.csv 三分支 | `backend/python/smartbi/api/excel.py:618-684, 1125-1141` | ★★★★★ |
| 5 | Plan v2 §10.10 XMX 优先级最低; §11 无 "S1 必齐才进 S2" 硬规 | `docs/plans/2026-04-26-deep-aiq-test-plan.md:170-186, 248-256` | ★★★★★ |
| 6 | xmx-26~30 数据自审 5 题在 0 数据 case **反而最匹配** (兜底诚实度测试) | `questions.json:99-103` | ★★★★★ |
| 7 | gml-04/07/09/16/17/18/21 共 6 题 (20%) 硬依赖 2月数据 | `questions.json:43-60` | ★★★★★ |
| 8 | Q1 推荐路径 A; Q2 GML 2月重传 critical; Q3 路径 A1 | analyst recommendation | — |

---

## 2. Analyst 综合分析

### Comparison Matrix (4 个 Bug)

| Bug | 当前实现 (file:line) | 严重度 | 改动量 | 优先级 |
|---|---|---|---|---|
| **A** xlsx 解析 | `excel_async.py:287-291` _probe 仅 read_csv | ★★★★★ (8/8 fail) | 80-150 行 *(Critic 修正: 30-50)* | **P0** |
| **B** 缺 ext 校验 | `excel_async.py:53-141` | ★★★★★ (9MB 上传 189s 才报错) | 10-15 行 | P1 |
| **C** nginx timeout | nginx (推断) | ★★★★☆ *(Critic 修正: 2-3★)* | 5 行 nginx | P1 *(deferred)* |
| **D** accept 缺 csv | `UploadArea.vue:20` | ★★★★★ *(Critic 修正: 3★)* | 2 行 | **P0** *(因成本低)* |

### Decision Framework

#### 决策 A: S2 准备路径

| 路径 | 描述 | Analyst 推荐 | Critic 修正 | 最终 |
|---|---|---|---|---|
| A1 | 先补 + 全 3 tenant (sync 重传) | ✅ 60-90min | ⚠️ 9MB OOM 风险 35% | **A1 备选** |
| A2 | 跳过 XMX, 仅 2 tenant (qhj+gml) | 备选 | 仍可作 fallback | fallback |
| A3 | 修 Bug A 后用 async 重传 | 未提 | ✅ **30-45min, 与已成功 12 csv 同路径** | **首选** ⭐ |

#### 决策 B: Bug 修复顺序

| 顺序 | 推荐? |
|---|---|
| **D → A → B → C** | ✅ 推荐 (D 立即解锁 csv, A 主修, B 边缘, C 等 spike) |
| A → D → B → C | ❌ (D 是 2 行 trivial 等不及 A 的 1-3 天) |

#### 决策 C: S2 题量

| 选项 | 推荐? |
|---|---|
| **360 题不变** | ✅ XMX 30 题在 A1 失败时转兜底测试 |
| 缩 30→15 仅诚实度 | 备选 (沉没成本不可接受时) |
| 缩 30→5 仅 xmx-26~30 | ❌ 5 题样本统计意义弱 |

---

## 3. Critic 关键挑战

### Code Verification (实际验证)

| Claim | 验证结果 |
|---|---|
| R1#1 _probe 仅 read_csv | ✅ Confirmed |
| R1#5 UploadArea accept 缺 csv | ✅ Confirmed |
| R3#4 excel.py:618 三分支 | ✅ Confirmed |
| **R1#4 主流也仅 read_csv** | **❌ 推翻**: line 295 `_probe(0)` 失败抛 ParserError → line 511 全局 except 兜底, **主流 416 永远不会到达** |

### 5 大挑战

1. **Bug A 改动量虚高 50-70%**: 单修 _probe 30-50 行就够 (非 80-150). 主流 read_csv 在 xlsx 失败场景下走不到.
2. **Bug D 严重度 5★ → 3★**: ExcelUpload (主入口) 已三格式, UploadArea (二级入口) 流量未量化. 但因 2 行成本极低仍立即修.
3. **A1 60-90min 估算缺历史校准**: 9MB sync 端点全文件载入内存 (无 chunked), OOM 概率 35%.
4. **A3 替代路径 (Critic 最强反驳)**: 修 Bug A 后用 async endpoint 重传 = 已成功的 12 csv 同路径, 30-45min, 风险更低.
5. **Bug C 严重度 4★ → 2-3★**: 189.5s 异步成功 vs 推断 60s timeout 矛盾, 实测前不优先.

### Hidden Assumptions (5 项)

1. xlsx_converted/ 覆盖所有需重传 xlsx 文件
2. test 环境 (10011/8084) Bug 行为与 prod 一致
3. R_XMX_FRESH 账号有 sync 端点上传权限
4. 8 xlsx 失败原因都是同一根因
5. UploadArea 父组件无 file type 二次过滤

### Failure Modes (Top 3)

| Scenario | 概率 | 影响 |
|---|---|---|
| sync /auto-parse 在 9MB 会员.xlsx 上 OOM | Med (35%) | High — prod 5-10min 不可用 |
| Bug D + Bug A 并发 commit pre-commit hook 串入并发文件 (Apr 11 事故) | Med (25%) | Med |
| Bug A 修后 csv 路径 regression | Low (15%) | High — S1 12 csv 全部回归失败 |

### Revised Confidence

| 结论 | Original | Post-Critique |
|---|---|---|
| Decision A (A1 路径推荐) | 80% | **50%** (应先 spike) |
| Decision B (D→A→B→C) | 85% | **65%** (单步耗时下调) |
| Decision C (360 题不变) | 90% | **80%** (维持) |
| Bug A 严重度 5★ | High | High (维持) |
| Bug A 改动量 80-150 | High | **30-50 行** |
| Bug D 严重度 5★ | 85% | **3★ (P1, 但因成本立即修)** |
| Bug C 严重度 4★ | Med-High | **2-3★, deferred** |
| Sync 端点 9MB 60-90min | Med-High | **35% (必先 spike)** |

---

## 4. Integrator 最终决策

### 立即 (< 1h)

1. **修 Bug D** (2 行): `UploadArea.vue:20` accept 加 `,.csv`. 立即解锁 csv 在 SmartBIAnalysis 二级入口
2. **9MB sync 单文件 spike** (15min): dev 环境 1 个 xlsx 调 sync `/auto-parse`, 监控 Java/Python 内存峰值. 把 OOM 概率从 35% 估算降到 < 10% 实测
3. **验证 Bug A 真实影响面**: 当前 12 csv 用 async 跑, 确认 Critic 反驳 (主流不受影响) 在 prod 路径成立

### 短期 (1-3h)

4. **修 Bug A** (~30-50 行): `excel_async.py:287-291` `_probe` 加 ext 分支 (xlsx → ExcelFile, csv → read_csv). 修后跑 12 csv regression
5. **路径 A3 重传**: 修 Bug A 后用 async endpoint 重传 8 个失败 xlsx + GML 2 月数据 (R3 critical). 30-45min. **A1 fallback 仅 spike 通过且 async 仍失败时**
6. **修 Bug B** (10-15 行): `excel_async.py:53-141` 加 ext 校验 fast-fail
7. **启动 S2 360 题**: GML 重传完即可启动, XMX 30 题保留兜底

### 条件性

- **如果 9MB sync OOM** → 锁定 A1 不可用, 走 A3 + Bug A 修复. spec "sync 端点流式改造"进 v2 backlog
- **如果 Bug A 修后 csv regression** → hotfix revert _probe 单分支改动, 在 caller 处分流
- **如果 Bug D + A 并发 commit Apr 11 事故** → commit 前必 `git status --short`, 修 A 与改 D 应**分两 commit**
- **如果 Bug C nginx 60s 在 spike 中复现** → 才修 nginx config (不在 repo), 否则 deferred
- **如果 sync 9MB 实测稳定** → Bug C 严重度正式从 4★ 下调 2★ 永久 deferred

### 必须在 S2 前回答的 Open Questions

1. 9MB sync 单文件 spike 内存峰值多少? (决定 A1 是否可用)
2. Bug A 修复后 12 个已成功 csv 是否回归通过? (csv regression 风险)
3. UploadArea 在 SmartBIAnalysis 的实际流量占比? (验证 D 严重度 5★ → 3★)
4. xlsx_converted/ 覆盖度: 所有失败 xlsx 都有对应转换版?
5. R_XMX_FRESH 账号写入权限: sync/async 对 R_XMX 表是否有 INSERT 权限?
6. test 与 prod schema 一致性: spike 在 test 通过, prod 是否有 RLS / index 差异?
7. Vue 父组件二次过滤: UploadArea 改 accept 后, 父组件是否还在 form-level 过滤 csv?

---

## 5. Consensus & Disagreements

| 主题 | R1/R2/R3 | Analyst | Critic | 最终判定 |
|---|---|---|---|---|
| Bug A 根因 | R1#1 ★★★★★ | P0 | ✅ 验证 | **共识** |
| Bug A 影响主流 (R1#4) | ★★★★★ 推断 | 接受 | ❌ **推翻** (line 511 兜底) | **采纳 Critic** |
| Bug A 改动量 | 80-150 | 沿用 | 30-50 | **采纳 Critic** |
| Bug D 严重度 | 5★ | 5★ | 3★ | **混合**: 修复立即 (2 行成本) + 严重度 P1 |
| Bug C 严重度 | 4★ | 4★ | 2-3★ | **采纳 Critic**: deferred |
| 修复顺序 | D→B→A→C | D→A→B→C | 接受 D 优先 | **D→A→B→C 共识** |
| 重传路径 | A1 | A1 (60-90min) | **A3 反驳** (30-45min) | **采纳 A3, A1 备选** |
| S2 准入 360 题 | ★★★★★ 共识 | 360 不变 | 维持 80% | **共识** |
| GML 2 月重传 | critical | critical | 接受 | **共识** |

---

### Healer Notes

- [Passed] 结构完整性: Executive Summary / Comparison Matrix / Recommendations / Open Questions / Confidence Assessment 全在
- [Passed] 交叉引用完整: Analyst 引用 R1#1/R1#5 等存在
- [Passed] 置信度一致: Integrator 合并 Analyst (原) + Critic (修正)
- [Passed] 可执行建议: 每条 recommendation 有 file:line / 时间估算 / next step
- [Passed] Browser evidence: N/A (BROWSER_RESEARCH=false)

### Process Note

- Mode: Full
- Researchers deployed: 3 (R1 根因 / R2 UX+速度 / R3 S2 准入)
- Total sources: 11 codebase files + DB query + 1 plan doc + 3 prod log/server config
- Key disagreements: 4 resolved (R1#4 主流影响 / Bug A 改动量 / 重传路径 / Bug D 严重度), 1 unresolved (Bug C nginx 严重度, 待 spike 实测)
- Phases completed: Research (3 parallel) → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅

---

**最关键的结论**: **修 Bug A 的成本被 R1 高估 50-70%** (Critic 通过 line 295/511 的实际 control flow 验证证明 _probe 失败后主流根本不会到达). 这意味着 S2 启动可以更激进 — **首选路径 A3** (修 A 后 async 重传, 30-45min) 而非 Analyst 原推荐的 A1 (sync 重传 60-90min, 含 35% OOM 风险).
