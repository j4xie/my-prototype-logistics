# 30 — Backlog Status Audit (2026-05-16)

> **来源**: Steve 要求 "审计一下,看看应该怎么做" → 发现 28-Backlog 跟 main 严重 misaligned, 14/88 项已 ship 但 backlog 全标 ❌.
>
> **方法**: grep `--all --grep=<id>` 每项 + gh PR search + 验证 Track 命名规则.
>
> **结论**: 88 项剩余 **74 项** (14 ✅ + 3 ⚠️), 不是 88. Sign-off 锁定的 "9 月 P0+P1 = 66 项 / 252d" 真实剩余 **51 项 / ~220d nominal / ~132 工日 / ~7 月**.

---

## 1. 关键 finding

| 维度 | 28-Backlog 假设 | **Main 真实** |
|---|---|---|
| 88 项剩余 | 88 (全 ❌) | **74** (14 ✅ + 3 ⚠️) |
| P0 已 ship | 0 | **9 of 18** (50%) |
| P1 已 ship | 0 | **5 of 47** (10.6%) |
| Sprint 0-2 真实推进 | "Sprint 0 done, Sprint 1 ready start" | **Sprint 1 全 ship + Sprint 2 G/H/I/J/E/F ship + Track-B1 钉钉 in flight** |

---

## 2. P0 战略 12 项 ship 状态

| # | 编号 | 28-Backlog | **Audit 结果** | 证据 | 工时 saved |
|---|---|---|---|---|---|
| 1 | F-VFLAG-1 | ❌ | ❌ | grep 0 hits ("vflag" / "F-VFLAG") | — |
| 2 | C-LINKARRAY-1 | ❌ | ❌ | grep 0 hits | — |
| 3 | S-LOCK-1 | ❌ | ❌ | grep 0 hits | — |
| 4 | M-BOM-VER-1 升级 | ❌ | ❌ | grep 0 hits (M-BOM-1 ship 但版本/ECN 没做) | — |
| 5 | C-APPROVAL-EDITOR-1 | ❌ | ❌ | grep 0 hits | — |
| 6 | C-PRT-EDITOR-1 | ❌ | ❌ | grep 0 hits (C-PRT-1 后端 ship, EDITOR 没做) | — |
| 7 | C-AI-1 钉钉 | ❌ | **⚠️ 80% (Track-B1 Day 1-5 ship on branch, awaiting Day 6 E2E + PR)** | `529611399 [Track-B1] Day 5: Retry scheduler + 4 admin endpoints` | — |
| 8 | N20 C-ATT-1 attachment | ❌ | **✅ Track-C #658** | `f296447c6 [Track-C] C-ATT-1 通用 Attachment 系统 (Day 1-5) (#658)` | 5d |
| 9 | N24/N25 M-WP-1/2 | ❌ | **✅ Track-D2 #650** | `ec69a94dc [Track-D2] M-WP-1/M-WP-2 工序管理` | 5d |
| 10 | N32 M-BOM-1 | ❌ | **✅ Track-D1 #656** | `809fc32a7 [Track-D1] M-BOM-1 BOM 配方 + Bug-2 + Bug-3 (Track D1 全部 3 项)` | 5d |
| 11 | N13 W-ABA-1 抄码品 | ❌ | **✅ Track-B2 #649** | `f07020c7d [Track-B2] W-ABA-1 抄码品识别` | 2d |
| 12 | N48 S-RD-1 研发样品 | ❌ | **✅ Sprint2-F #680** | `c3d9a0b34 [Sprint2-F] N48 ProductSample → 自动 BOM` | 5d |

**P0 战略**: 5 ✅ ship + 1 ⚠️ in flight + 6 ❌ not started = **22d saved**

---

## 3. P0 必修 6 项 ship 状态

| # | 编号 | 28-Backlog | **Audit** | 证据 | Saved |
|---|---|---|---|---|---|
| 13 | M1 三价对比刷新 | ❌ | **⚠️ BLOCKED** | T3-14 test env seed blocker (issue #538) | — |
| 14 | M2 生产工序通用 | ❌ | **⚠️ partial #567, follow-ups OPEN** | issues #622 / #623 (P3 follow-ups) | — |
| 15 | M3 PDF + 扫码 RN | ❌ | **✅ Track-B2 #653** | `8bf5fbc93 [Track-B2] Bug 修 PDF 扫码 RN 端` | 4d |
| 16 | M4 BOM 物料选择器 | ❌ | **✅ Track-D1 #656** | `809fc32a7 [Track-D1] M-BOM-1 BOM 配方 + Bug-2 物料选择器` | 2d |
| 17 | M5 单位转换强校验 | ❌ | **✅ Track-D1 #656** | `809fc32a7 ... + Bug-3 单位换算` | 2d |
| 18 | N3 C-RBAC-1 仓管隔离 | ❌ | **✅ #661 + 多 follow-up** | `e7c864004 feat(rbac): C-RBAC-1` + #667/668/671/672/673/674 | 2d |

**P0 必修**: 4 ✅ + 2 ⚠️ blocked = **10d saved**

---

## 4. P1 战术 47 项 ship 状态 (5 ✅)

| 编号 | 28-Backlog | **Audit** | 证据 | Saved |
|---|---|---|---|---|
| S-MRP-1 (隐含 P1) | ❌ | **✅ Sprint2-E #682** | `b936d19e3 [Sprint2-E] S-MRP-1 销售订单→采购自动分流` | (5d) |
| P-FIN-1 | ❌ | **✅ Sprint2-J #675** | `b7846a918 [Sprint2-J] P-FIN-1 采购订单财务审核+三价标红` | 3d |
| U-NAV-1 | ❌ | **✅ Sprint2-G #683/#684** | `d984dd1e0 [Sprint2-G-1]` + `8f0a6f8ce [Sprint2-G-2]` | 6d |
| U-ACT-1 | ❌ | **✅ Sprint2-H #678** | `10d9e4d36 [Sprint2-H] U-ACT-1 行末操作下拉` | 6d |
| U-FOOTER-1 | ❌ | **✅ Sprint2-I #681** | `a86e40bd5 [Sprint2-I] U-FOOTER-1 Sticky Footer` | 4d |

**P1**: 5 ✅ + 42 ❌ = **24d saved** (含 S-MRP-1 5d)

P1 剩余 42 项 (含 CRM 11 / 销售 6 / 采购 3 / 仓库 4 / 生产 5 / 财务 3 / HR 5 / 品质 2 / 系统 7 / UX 11 / 其他)... 详见 28-Backlog.

---

## 5. P2 选做 15 项 + P3 长期 8 项

**P2**: 0 ✅ — 15 项全 ❌ (大客户/餐饮多门店/食品扩展不在 Sprint 1-2 范围)

**P3**: 0 ✅ — 8 项全 ❌ (TV 大屏 / 微服务 / 1591 RBAC 长期战略)

---

## 6. 工时累计修正

| 类别 | 88-Backlog 原估 | **真实剩余** | Δ |
|---|---|---|---|
| P0 战略 12 | 86d | 64d (剩 6 全做 + Track-B1 收尾 6d) | -22d |
| P0 必修 6 | 14d | 4d (剩 M1+M2, blocked 不算 backlog 直接做) | -10d |
| P1 战术 47 | 152d | 128d (剩 42 项) | -24d |
| P2 选做 15 | 126d | 126d (无变) | 0d |
| P3 长期 8 | 51d | 51d (无变) | 0d |
| **88 项合计** | **429d nominal** | **373d nominal** | **-56d (-13%)** |

按 Claude 1.7× 加速 + 25% buffer:
- 原估: 258d 实际工日 ≈ **15 月**
- 真实: ~224d 实际工日 ≈ **13 月**

按 Steve sign-off "9 月 P0+P1 = 66 项":
- 原估: 252d nominal / 152 工日 / **9 月**
- 真实: 51 项 (66 - 14 已 ship - 1 in flight) ≈ **196d nominal / ~118 工日 / 7 月**

**=> Sign-off 锁定的"9 月"真实只需 7 月** (省 2 月).

---

## 7. ⚠️ Blocker 项独立追踪

### M1 三价对比刷新 (BLOCKED)
- **阻塞**: T3-14 test env seed (issue #538)
- **要解锁**: F006 test factory 在 test DB 上 seed 完整数据
- **行动**: 填 #538 — F006 factory missing on test DB
- **工时**: 2d (修 + 验证)

### M2 生产工序通用未关联 (PARTIAL — P3 deferred, 不修)
- **现状**: #567 partial ship; follow-ups #622/#623 open P3
- **真相 (2026-05-16 reconcile)**: 读完 issue body 发现 — 原作者明确标 P3 "Demo-OK; testing rigor gap" + "feature works in production usage" + "Customer ask describes chain conceptually, not at instance-trace level"
- **行动**: ⛔ 不 dispatch (我之前推 "P3→P0" 是 28-Backlog metadata stale, 不是真相). 尊重原 P3 deferral.
- **追溯到根 rule 违反**: 这是 `feedback_signoff_requires_reconcile_with_main_first.md` HARD + `feedback_brief_must_grep_existing_endpoint_paths.md` HARD 的另一个 instance — 我用 backlog metadata 而不是 issue body 真相做决策
- **工时**: 0d (deferred)

---

## 8. Track-B1 钉钉机器人 进度 (in flight)

**5 day commits 在 branch (无 PR)**:
- Day 1: scaffold
- Day 2: DingTalk inbound webhook (entity + migration + controller) `5def64a2e`
- Day 3: Inbound consumer → AIChat (non-streaming) + 22 unit tests `c4daa2278`
- Day 4: Outbound send service + rate limiter + 2 AIChat Tools `859a18e63`
- Day 5: Retry scheduler + 4 admin endpoints `529611399`

**待 Day 6**: deploy --env test + configure DingTalk Outgoing Webhook URL + E2E in F006 test group + open PR

**预估收尾**: 1-2 day (E2E + PR) = ~1-2d

---

## 9. 推荐 next step (基于 audit)

### 9.1 立即 (本周)
1. **更新 28-Backlog status markers** (本 audit doc + 28-doc inline ✅/⚠️/❌) — done by this doc
2. **修 sign-off scope**: "9 月" → 真实剩余 "7 月" 重 sign-off
3. **填 issue #538**: F006 test factory seed (解锁 M1)
4. **推 #622 / #623** P3→P0 (解锁 M2)
5. **催 Track-B1 Day 6** PR (钉钉机器人 ship)

### 9.2 Sprint 3 dispatch (本月)
剩余 6 P0 项需 dispatch:
- F-VFLAG-1 凭证 hook (10d) — backend, 跟 ApprovalChainConfig 集成
- C-LINKARRAY-1 跨业务关联 (2d) — backend quick win
- S-LOCK-1 锁定/备货/缺料 (1d) — frontend quick win
- M-BOM-VER-1 BOM 工程级升级 (15d) — backend major (BomVersion + ECN + BomLog 反查)
- C-APPROVAL-EDITOR-1 工作流可视化 (20d) — frontend major
- C-PRT-EDITOR-1 打印模板可视化 (10d) — frontend major

**总 58d / 35 工日 / 7 周** (单人, Claude 加速). 跟 Sprint 1 一样按 6 Track 并行 (Track-E/F/G/H/I/J) 可压缩到 ~4 周.

### 9.3 Sprint 4-5 P1 推进
P1 剩 42 项 / 128d / 77 工日 / 16 周 (单人).

### 9.4 Sprint 6+ P2 视客户实际需求

---

## 10. 元教训 (memory candidates)

1. **每次写战略 doc 前必 grep main** — 我犯了 May 13/15 HARD rule 违反 (grep before assume + gh PR search before dispatch outstanding)
2. **Backlog 跟生产线异步** — 写 audit 期间 main 在 ship, 不 reconcile 就 sign-off = 用 stale data 决策
3. **Sign-off 之前必 verify** — Steve 信我说"9 月 P0+P1 66 项 / 252d", 实际数字早期就 stale
4. **Organizer mode 假设错误** — Steve 不是 single dev coder, 是 multi-chat organizer dispatching tracks

---

## 11. 完成度

- ✅ 88 项 ship 状态 grep 验证完成
- ✅ Track-A through Track-D2 (Sprint 1) + Sprint2-E through J (Sprint 2) 全 mapping
- ✅ 真实剩余 73 项 / ~373d nominal / 7 月 (单人 P0+P1)
- ✅ Blocker 项 (#538 + #622/#623) 独立追踪
- ⚠️ Track-B1 钉钉 in flight, Day 6 待 ship
- ✅ Sprint 3 dispatch 6 项 P0 推荐就绪
