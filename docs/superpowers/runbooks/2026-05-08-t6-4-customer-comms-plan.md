# T6.4 Customer Communications Plan

**Phase**: T6.4 (Phase 2A SmartBI Java→Python cutover, final wave — 14 real customer factories)
**Status**: Doc-only customer-comms readiness — execution awaits separate marching order after T6.3 24h soak GO
**Author**: chat 3 (T6.4 customer comms plan writer)
**Date**: 2026-05-08
**Predecessor doc**: `2026-05-08-t6-4-real-customers-cutover-runbook.md` (technical cutover runbook §9 has skeletal comms — this doc expands it)
**Sister docs**: `2026-05-07-t6-3-50pct-factories-cutover-runbook.md` (test-factories cutover, no customer comms needed there)

---

## 0. Purpose & scope

This doc is the **customer-facing communications playbook** for T6.4. It complements the technical cutover runbook (which covers nginx vhost / smoke / rollback) by detailing:

- Customer notification timing per Strategy B stages
- Bilingual / Chinese-first templates for pre / during / post-cutover messages
- Channel selection per customer relationship tier
- P1 escalation timeline with explicit ack SLAs
- Per-customer customization checklist (sales fills in)

⛔ **Doc-only**: nothing in this plan executes prod state changes. Customer outreach happens through sales team's existing channels; this doc supplies templates and timing guidance.

⛔ **Customer alias convention**: this doc uses `<customer_alias>` placeholder + factory ID as canonical reference. Sales team owns the actual customer brand name → alias mapping (kept internal to sales CRM, not in repo).

---

## 1. 14 real customer factories — roster (placeholder)

**Source of truth**: PR #110 §1.2 OUT-of-scope list, anchored in `2026-05-08-t6-4-real-customers-cutover-runbook.md` §1.1. Customer brand names suppressed here per non-leak policy.

| # | Factory ID | Customer alias | Tier | 销售对接人 | Customer contact | Preferred channel |
|---|---|---|---|---|---|---|
| 1 | `F002` | `<customer_alias_f002>` | F-numeric | TBD | TBD | TBD |
| 2 | `F003` | `<customer_alias_f003>` | F-numeric | TBD | TBD | TBD |
| 3 | `F004` | `<customer_alias_f004>` | F-numeric | TBD | TBD | TBD |
| 4 | `F006` | `<customer_alias_f006>` | F-numeric | TBD | TBD | TBD |
| 5 | `R001` | `<customer_alias_r001>` | Demo→real pilot | TBD | TBD | TBD |
| 6 | `RES_GML_001` | `<customer_alias_gml_prod>` | Restaurant chain | TBD | TBD | TBD |
| 7 | `RES_3101_009` | `<customer_alias_qhj_prod>` | Production tenant | TBD | TBD | TBD |
| 8 | `R_GML_DEMO` | `<customer_alias_gml_pilot>` | Restaurant chain pilot | TBD | TBD | TBD |
| 9 | `R_XMX_CHAIN` | `<customer_alias_xmx_chain>` | Restaurant chain | TBD | TBD | TBD |
| 10 | `R_XMX_FRESH` | `<customer_alias_xmx_fresh1>` | Restaurant chain pilot | TBD | TBD | TBD |
| 11 | `R_XMX_FRESH2` | `<customer_alias_xmx_fresh2>` | Restaurant chain pilot | TBD | TBD | TBD |
| 12 | `R_XMX_FRESH3` | `<customer_alias_xmx_fresh3>` | Restaurant chain pilot | TBD | TBD | TBD |
| 13 | `R_YHDJ_DEMO` | `<customer_alias_yhdj_pilot>` | Restaurant chain pilot | TBD | TBD | TBD |
| 14 | `R_YJJ_DEMO` | `<customer_alias_yjj_pilot>` | Restaurant chain pilot | TBD | TBD | TBD |

⚠️ **Naming traps** (per cutover runbook §1.2):
- `_DEMO` / `_FRESH` suffix on R_* factories is **NOT a test indicator** — names confirm real chain pilots / production tenants. Treat all 14 as customer-impacting.
- `RES_3101_009` is production-tier even though sequence 009 lives next to test-tier 001-008.

---

## 2. Strategy B staggered timing — per-stage customer mapping

Per cutover runbook §2.2 recommendation, T6.4 uses **Option B** (staggered, 4 stages over 4-5 days). This section maps customer notifications to stages.

### 2.1 Stage-to-customer mapping

| Stage | Day | Cutover window (CST suggestion) | Customers | Comms load |
|---|---|---|---|---|
| **B1** | Day 1 | 03:00-05:00 (low-traffic) | F002, F003 (2) | 2 pre-notices, 2 post-confirms |
| **B2** | Day 2 | 03:00-05:00 | F004, F006, R001 (3) | 3 pre-notices, 3 post-confirms |
| **B3** | Day 3 | 03:00-05:00 | RES_GML_001, RES_3101_009 (2) | 2 pre-notices, 2 post-confirms |
| **B4a** | Day 4 | 03:00-05:00 | R_GML_DEMO, R_XMX_CHAIN, R_XMX_FRESH, R_XMX_FRESH2 (4) | 4 pre-notices, 4 post-confirms |
| **B4b** | Day 5 | 03:00-05:00 | R_XMX_FRESH3, R_YHDJ_DEMO, R_YJJ_DEMO (3) | 3 pre-notices, 3 post-confirms |

**Total**: 14 pre-notices over 5 days (max 4/day = manageable for sales team). 14 post-confirms.

### 2.2 Why 03:00-05:00 CST window

- **餐饮 customers** (R_*, RES_*): low-traffic — post-meal-service, pre-breakfast prep. Real-time POS load minimal.
- **F-numeric food/manufacturing** (F002-F006): no public ordering load, internal ops only. Window flexible but consistent 03:00-05:00 simplifies scheduling.
- **Cutover blip target <2 min** (graceful nginx reload). Even if customer logs in during window, dashboard refresh shows new page within seconds.

### 2.3 Per-customer window override

If sales team confirms a customer has **transactional sensitivity** during default window (e.g. 24h ordering, batch jobs at 04:00), defer that customer's stage by 1 day or shift to alternative window (e.g. 14:00-15:00 weekday afternoon lull). Document in §7 customization checklist.

### 2.4 Inter-stage soak

Between stages: **4-12h soak**. Each soak window is the early-morning customer day (06:00-18:00) — full transaction cycle observed before next stage. If issue surfaces, rollback only that stage; previous stages stay on Python.

---

## 3. Communication templates

All templates Chinese-first (customer-facing). Sales team adjusts tone per customer relationship (formal email vs casual 微信).

### 3.1 Pre-cutover notice (T-24h before stage cutover)

**Channel**: Per customer's preferred (§4). Send 24h before cutover window.

```
【白垩纪 SmartBI 服务升级通知】

尊敬的 <customer_alias>,

感谢您对白垩纪食品溯源系统的信赖。我们计划于 <YYYY-MM-DD> <HH:MM>-<HH:MM> 进行 SmartBI
后端服务架构升级,旨在提升数据分析与图表查询性能。

【升级影响】
• 升级窗口: <2 分钟瞬时刷新
• 期间您打开仪表盘可能需要一次手动刷新
• 业务数据 / 报表 / 历史记录不受影响

【升级后改善】
• 销售/库存/财务分析查询响应更快
• 大数据量图表加载更稳定

【应急联系】
如升级期间或之后发现任何异常,请立即联系您的销售对接人:
<销售对接人姓名> · <电话/微信>

我们的技术团队将全程在线监控,确保服务平稳过渡。

白垩纪技术团队
<日期>
```

### 3.2 Reminder (T-1h before stage cutover)

**Channel**: 微信群 / 钉钉 (短文本即可,不发邮件避免轰炸)

```
【提醒】<customer_alias>,白垩纪 SmartBI 升级将于 1 小时后(<HH:MM>)开始,预计 2 分钟内完成。
有问题请直接 @<销售对接人>。
```

### 3.3 During-cutover comms (live status, 内部发销售群)

**Channel**: 内部销售群,不发客户。技术值班同步状态给销售,销售按需转客户。

```
【内部 · T6.4 Stage <Bx> 状态】
<HH:MM:SS> 开始执行 nginx vhost 切换 (<customer_id_list>)
<HH:MM:SS> nginx -s reload 完成 ✓
<HH:MM:SS> Smoke 测试 <N>/<N> PASS
<HH:MM:SS> Stage <Bx> 切换完成,进入 4-12h soak 监控
当前状态: 健康 ✓ / 异常 ⚠️ / 已回滚 ❌
```

### 3.4 Post-cutover confirm (T+15min after stage smoke pass)

**Channel**: 与 §3.1 同 channel,简短确认。

```
【白垩纪 SmartBI 升级完成】

尊敬的 <customer_alias>,

SmartBI 后端升级已于 <HH:MM> 平稳完成,服务运行正常。

如您在使用中发现任何异常(数据不对、加载缓慢、报错),请立即联系
<销售对接人姓名> · <电话/微信>。我们的技术团队将在 5 分钟内响应。

接下来 24 小时为重点观察期,感谢您的配合。

白垩纪技术团队
```

### 3.5 Stage GO confirmation (T+24h after stage cutover)

**Channel**: 同 §3.1,长文本 OK。

```
【白垩纪 SmartBI 升级 24 小时稳定运行确认】

尊敬的 <customer_alias>,

您所在工厂 <factory_id> 的 SmartBI 后端服务已升级并稳定运行 24 小时,各项指标正常。

【监控数据(参考)】
• 接口响应时间: 较升级前提升 ~<X>%
• 错误率: 0
• 业务交易量: 与升级前 baseline 一致

如后续使用中有任何问题,欢迎联系 <销售对接人>。再次感谢您的支持!

白垩纪技术团队
```

### 3.6 Rollback notice (if needed,P1 issue triggers rollback)

**Channel**: 优先电话 → 微信/钉钉补充。**不发邮件**(时效性差)。

```
【白垩纪 SmartBI 紧急通知】

尊敬的 <customer_alias>,

我们检测到 SmartBI 升级后出现 <issue_summary>,已于 <HH:MM> 回滚至升级前版本,
您的服务现已恢复正常。

【已采取行动】
• 回滚完成时间: <HH:MM>(影响时长 <X> 分钟)
• 回滚后服务状态: 已验证恢复正常

【后续计划】
我们将在 <next_attempt_eta>(通常为次日)完成根因分析后再次尝试升级。
届时您的销售对接人会提前 24 小时再次通知。

如有任何疑问,请直接联系 <销售对接人姓名> · <电话>。
对此次影响,我们深表歉意。

白垩纪技术团队
```

---

## 4. Communication channels — selection guidance

### 4.1 Channel hierarchy

| Channel | Strengths | Weaknesses | Default use case |
|---|---|---|---|
| **电话** (直拨销售对接人) | 立即响应、不可错过 | 客户可能不便接听 | P1 紧急、回滚通知 |
| **微信群** (项目对接群) | 快速、多人可见、附件支持 | 易被淹没,可能漏看 | Pre-notice、reminder、post-confirm |
| **钉钉** | 已读回执、阶段通知打卡 | 部分客户未用 | 内部销售群同步、客户也用钉钉的优先 |
| **邮件** | 正式存档、可法务 forward | 时效性差(可能 1-2 天才看) | 升级公告(T-72h)、24h 稳定确认存档 |
| **工单系统** (如有) | SLA tracking、可视化进度 | 需客户主动登录 | P1 issue 客户报告通道 |

### 4.2 Per-tier default channels

| Customer tier | Default pre-notice | Default reminder | Default rollback |
|---|---|---|---|
| F-numeric (F002-F006) | 邮件 + 微信 | 微信 | 电话 |
| Production (RES_*, R001) | 邮件 + 微信 + 钉钉 | 微信 / 钉钉 | 电话 |
| Restaurant chain pilots (R_*) | 微信 + 钉钉 | 微信 | 电话 |

Sales team owns final decision per customer relationship — table is starting point, not mandate.

### 4.3 Multi-channel redundancy

For all 14 customers, **at least 2 channels** for pre-notice (e.g. 邮件 + 微信). Single-channel risk: client misses email entirely. Two channels reduces miss to <5%.

---

## 5. Escalation path & SLAs

### 5.1 P1 escalation timeline (target SLAs)

```
T+0:00  Customer reports issue (via 销售对接人 / 工单 / 客服)
        ↓
T+0:05  销售对接人 acknowledges to customer (≤5 min)
        Sales pings 技术值班 in 内部群 (P1 ticket)
        ↓
T+0:10  技术值班 confirms reproducibility / severity (≤10 min from T+0:00)
        IF reproducible + customer-impacting → trigger rollback decision
        ↓
T+0:12  Rollback decision made (≤12 min from T+0:00)
        ↓
T+0:14  Nginx vhost rollback executed (≤2 min, see runbook §6.2)
        ↓
T+0:15  销售对接人 confirms recovery to customer (≤15 min from T+0:00)
        Send §3.6 rollback notice
        ↓
T+1:00  Internal post-mortem starts (root cause investigation)
        ↓
T+24:00 Post-mortem doc complete, retry plan agreed with sales
```

### 5.2 Roles & responsibilities

| Role | Responsibility | Person/team |
|---|---|---|
| **销售对接人** | First customer contact, ack within 5 min, channel-bridge to tech | Sales team, per-customer assignment |
| **技术值班** (on-call) | Triage P1 within 10 min, rollback decision authority within 12 min | Engineering on-call rotation |
| **Rollback executor** | Execute nginx vhost restore (cutover runbook §6) | Same as 技术值班 (or designated SRE) |
| **Organizer** | Coordinate post-mortem, decide retry timing | Per project lead |
| **Customer-facing channel monitor** | Watch 微信群 / 工单 for customer-reported issues real-time | Sales team rotation during T6.4 stages |

### 5.3 P2 / P3 issues

| Severity | Definition | Response SLA |
|---|---|---|
| **P1** | Customer cannot use SmartBI / data显著错误 / 大量 5xx | 5min ack, 15min recovery |
| **P2** | UI degraded but workable / occasional errors / minor data inconsistency | 1h ack, next-day fix |
| **P3** | Cosmetic / nice-to-have / performance微小回退 | 24h ack, batched into next release |

P2/P3 do **NOT** trigger rollback. Document in tracker, fix forward.

### 5.4 Decision tree: rollback or fix forward?

```
Customer reports issue
    ↓
Reproducible by 技术值班?
    ↓ YES
Affects core business flow (data accuracy / availability)?
    ↓ YES
> 5% requests affected, OR P1-critical customer?
    ↓ YES                              ↓ NO
ROLLBACK now (§6.2 runbook)            Hot-patch deploy attempt within 2h
                                        IF fails → ROLLBACK
    ↓ NO
Fix forward in next deploy cycle
Document in customer-facing tracker
```

---

## 6. Sales team coordination

### 6.1 Pre-T6.4 prep (T-72h before Stage B1)

- [ ] Sales team fills in §1 roster: 销售对接人 + customer contact + preferred channel for all 14 customers
- [ ] Sales team validates §3 templates with marketing/legal if customer contracts have specific notification language requirements
- [ ] Sales rotation schedule for T6.4 5-day window (each day needs at least 1 销售 on-call for that day's stage customers)
- [ ] 内部群 setup: T6.4 staging group with sales + 技术值班 + organizer
- [ ] §3.6 rollback template pre-translated to alternative tones (formal vs casual) per customer relationship

### 6.2 Daily during-T6.4 cadence

- **D-1 18:00**: Sales sends §3.1 pre-notices for next-day stage customers
- **D 02:00**: 技术值班 final pre-flight (cutover runbook §3 checklist)
- **D 03:00**: Cutover starts, §3.3 internal status begins
- **D 03:30**: Smoke complete, §3.4 post-confirm sent to customers
- **D 06:00**: Sales monitors customer feedback channels for first business hours
- **D 18:00**: Day-end check, no issues → §3.5 stage GO confirm sent (or defer 24h)
- **D+1 03:00**: Repeat for next stage

### 6.3 Sales feedback channel

Sales team aggregates customer feedback in shared doc (Lark/Feishu/Notion). Format:
```
| 时间 | Factory ID | Customer alias | Channel | Issue/Feedback | 销售对接人 | 处置 |
|---|---|---|---|---|---|---|
```

Reviewed daily by organizer + 技术值班. Patterns inform rollback decision.

---

## 7. Per-customer customization checklist

For each of the 14 customers, sales team fills in **before** that customer's stage cutover. 1 row per customer.

```
Customer: <customer_alias> (Factory: <factory_id>)
─────────────────────────────────────────
[ ] 销售对接人 confirmed available T-24h to T+24h of stage
[ ] Customer contact (姓名 + 职位 + 电话 + 微信/钉钉 ID) verified
[ ] Preferred channel confirmed (per §4.2 default 或 customer-specific override)
[ ] Customer business size + transaction sensitivity assessed
    - 高峰时段: <HH:MM-HH:MM, 工作日/周末>
    - 是否需要 cutover window 调整: Y / N
    - 调整后 window: <HH:MM-HH:MM, 日期>
[ ] Customer 历史 issue 记录回顾(过去 30 天):
    - <列出可能影响 cutover sensitivity 的 prior bug>
[ ] Customer 是否有定时任务/批处理在 cutover window 内:
    - <列出 known scheduled jobs>
[ ] Pre-notice 模板已 customize(若需调整语气 / 加客户特定字段)
[ ] 24h baseline metrics 已捕获(per cutover runbook §3.5):
    - 平均日接口调用量: <N>
    - 平均日 dashboard 加载次数: <N>
    - 关键报表使用频次: <N>
[ ] 备用联系人(销售对接人不可用时): <name + contact>
[ ] Stage 决定: <B1/B2/B3/B4a/B4b>
[ ] Cutover 实际执行时间: <fill at execution>
[ ] Post-cutover confirm 发送时间: <fill at execution>
[ ] 24h GO confirm 发送时间: <fill at T+24h>
[ ] 客户反馈摘要: <fill at T+24h>
```

Stored in sales CRM / shared doc, **not committed to repo** (PII / customer info).

---

## 8. Template artifacts & deliverables

### 8.1 Sales-team-owned (NOT in repo)

- 14-customer roster CSV with real names + contacts (CRM)
- Customized pre-notice / post-confirm letters per customer (Lark/Feishu doc)
- §6.3 daily feedback aggregation doc
- §7 customization checklist filled per customer

### 8.2 Repo-owned (this doc + cutover runbook)

- This file: `2026-05-08-t6-4-customer-comms-plan.md` (template + timing + escalation)
- Cutover runbook: `2026-05-08-t6-4-real-customers-cutover-runbook.md` §9 references this doc
- Future: post-T6.4 retrospective doc capturing what worked / what to adjust for Phase 2B+

---

## 9. Coordination with cutover runbook

This doc is **prescriptive on customer-facing comms**. Cutover runbook is **prescriptive on prod state changes**. Both must agree:

| Topic | This doc | Cutover runbook |
|---|---|---|
| 14-customer scope | §1 (alias placeholders) | §1.1 (factory IDs) |
| Strategy B stage timing | §2.1 (cust mapping) | §2.2 + §4.2 (regex per stage) |
| Pre-flight customer comms gate | §6.1 prep | §3.4 customer comms coordination |
| Smoke pass → confirm cust | §3.4 template | §5 smoke test |
| Rollback trigger → cust notice | §3.6 + §5 SLAs | §6.1 trigger conditions |
| GO criteria → 24h confirm | §3.5 | §7 GO criteria |

Any conflict between this doc and cutover runbook → cutover runbook wins for technical execution; this doc wins for customer-facing language.

---

## 10. ⛔ HOLD blocks

- This is **doc-only**. No prod state, no customer outreach triggered by reading this.
- Customer comms execution waits for: (a) T6.3 24h soak GO, (b) Pattern B PR #135 prod deploy, (c) sales team prep §6.1 complete, (d) separate marching order to start Stage B1.
- §3 templates are **starting points**. Sales team adjusts language, branding, tone per customer relationship before sending.
- §1 roster `<customer_alias>` placeholders **must** be filled by sales team in CRM **before** Stage B1 — but those filled values stay in CRM, not pushed to this repo.
- §5 SLAs are **target**, not contractual. If a customer has signed SLA agreements with stricter terms, those override.

---

## 11. Open questions for sales team review

1. **Multi-language**: Any customer requires English communication? (Default: 中文 only.)
2. **Approval chain**: Does §3.1 pre-notice need legal/marketing sign-off before send? (Default: no, but flag for tier-1 customers.)
3. **Compensation policy**: If §3.6 rollback triggered, any SLA credit / 补偿 policy to reference in customer notice? (Default: not mentioned in template; sales adjusts per relationship.)
4. **Aggregate notice**: Some customers may prefer single "T6.4 升级公告" across all 5 days vs per-stage notice. Acceptable trade-off with comms load? (Default: per-stage; revisit if sales requests.)
5. **Post-T6.4 全网公告**: After Stage B4b GO, send broader 升级完成公告 to all 75 factory contacts? (Default: yes, low-key; coordinate with marketing.)

---

## 12. Dependencies & blockers

| Dependency | Status | Owner |
|---|---|---|
| T6.3 24h soak GO | ETA 2026-05-09 12:05 CST | chat 2 / chat 4 |
| Pattern B PR #135 prod deploy | Not yet deployed (per memory `project_2026_05_07_t6_1_dryrun_in_flight.md`) | chat 4 (Python prod owner) |
| Sales team §6.1 prep complete | Not started | Sales lead |
| Sales rotation schedule for 5-day T6.4 window | Not started | Sales lead |
| Customer alias → real name mapping (CRM) | Not started | Sales lead |
| Translation review of §3 templates | Not requested | TBD |

T6.4 Stage B1 cannot trigger until **all** dependencies clear.

---

## 13. Discovery findings baked into this plan

| Finding | Implication for comms |
|---|---|
| 14 real customer factories per cutover runbook §1.1 | Authoritative roster, no re-discovery |
| Strategy B 4-5 day stagger | Sales comms load distributed (max 4/day pre-notices) |
| 03:00-05:00 CST low-traffic window | Most customers not actively using → comms can be lower-urgency tone |
| `_DEMO`/`_FRESH` suffix misleading | All 14 treated as customer-impacting (not test) — full comms protocol |
| <2 min nginx blip target | Pre-notice can promise "瞬时刷新" (not minutes of downtime) |
| 4-12h inter-stage soak | 24h GO confirm aligns with full business day cycle observation |
| Pattern B PR #135 prereq | If not deployed, real-customer Gold data divergence risk → comms timing must include §12 dependency check |

---

## 14. Sign-off & review

Before T6.4 Stage B1 execution, this doc reviewed by:

- [ ] Sales lead (template language + channel selection acceptable)
- [ ] Engineering organizer (SLAs + escalation path workable)
- [ ] On-call rotation lead (5-day coverage confirmed)
- [ ] (Optional) Marketing / legal (template tone + compensation policy)

Sign-off recorded in PR description when this doc merges main.

---

**End of T6.4 Customer Communications Plan**
