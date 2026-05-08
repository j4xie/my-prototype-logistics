# T6.4 Stage 1 Customer Comms Schedule (F002 + F003)

**Stage**: T6.4 Stage 1 (5-day Strategy B stagger, Day 1)
**Status**: Doc-only schedule — execution by 销售对接人 on May 10
**Author**: ops chat 2 (T6.4 Stage 1 comms schedule)
**Date drafted**: 2026-05-09 CST
**Predecessor**: PR #141 customer-comms-plan (`docs/superpowers/runbooks/2026-05-08-t6-4-customer-comms-plan.md`) — templates source
**Sister doc**: `docs/superpowers/dispatch/2026-05-10-t6-4-stage-1-marching-order.md` (cutover execution MO)

---

## 0. Cutover-time decision — 14:00-15:00 CST (organizer-confirmed 2026-05-09)

This runbook anchors on **`May 10 14:00 CST`** cutover. Resolved by organizer 2026-05-09 as a deliberate T6.4 pre-customer-return override invoking PR #141 §2.3 (customer-specific alternative window) — not a default-window shift.

**Reasoning** (organizer-confirmed):
- **0 customer-side usage** during T6.4 (factories not in production load) → "low-traffic 03:00" defensive value is null
- **Operator alertness > traffic minimization**: Steve + organizer + sister chats all awake during 14:00-15:00 → rollback decision quality higher in daylight than 03:00 fatigue window
- **Stage 3 48h soak** (May 12-14) spans 2 full daytime cycles → fully observable
- **One-time T6.4 event**: 14:00 anchor does NOT lock future cutover defaults. Post-customer-return future cutovers revert to PR #141 §2.1 default 03:00.
- **PR #141 §2.3 explicit invocation**: alternative window mechanism exists in shipped doc — this is documented use, not hack.

**Cross-doc sync** (out of this runbook's scope): chat 3 will file separate amendment to 5 stage MOs + PR #141 §2.1/§2.2 to bring shipped docs in sync with 14:00 anchor for T6.4 stages.

---

## 1. Background

T6.4 Stage 1 cuts F002 + F003 (2 F-numeric real customer factories) over to Python. Stakes: **MEDIUM** — real customers but non-high-volume; F-numeric tier (food / manufacturing internal ops, no public ordering load). Per PR #141 §1 roster + §4.2 default-tier channel matrix: F-numeric default = email + 微信 for pre-notice, 微信 for reminder, 电话 for rollback only.

**Default-stage channel mix**: 2 channels for non-rollback comms (email + 微信). 4-channel escalation (email + 微信 + 钉钉 + 电话) is reserved for Stage 3 high-stakes restaurant chains (per `2026-05-12-t6-4-stage-3-marching-order.md` prereqs §1.2). Not pre-escalating Stage 1 channels preserves 4-channel signal weight for Stage 3.

24h soak follows; Stage 2 trigger gated on Stage 1 GO declaration per Stage 1 MO §6.

---

## 2. Schedule (cutover anchor: May 10 14:00 CST per §0 — pending reconcile)

| 时间点 | Template | Channel | 收件人 | 内容 highlight |
|---|---|---|---|---|
| **T-24h** (May 9 14:00) | §3.1 pre-notice | email + 微信 | F002 + F003 销售对接人 + 技术对接人 | 24h advance notice; cutover window + impact scope (<2 min refresh) + 销售对接人 contact |
| **T-1h** (May 10 13:00) | §3.2 reminder | 微信 | 同上 | 1-hour countdown; confirm client-side ready |
| **T+0** (May 10 14:00) | (internal organizer marker — no customer comms) | — | — | Cutover begins |
| **T+15min** (May 10 14:15) | §3.3 during-cutover | 微信 | 同上 (内部销售群 first, 销售按需转客户) | Live execution status; if any P1 → immediately escalate per §5 SLAs |
| **T+1h** (May 10 15:00) | §3.4 post-confirm | email + 微信 | 同上 | Cutover complete; customer verifies side OK |
| **T+24h** (May 11 14:00) | §3.5 stage-GO | email | 同上 | 24h soak GO + metrics summary; Stage 1 closure |
| **(if rollback)** | §3.6 rollback | email + 微信 + 钉钉 + **电话** | 同上 + 销售直拨 | 4-channel panic mode; reach customer ≤5 min; 电话 leads, others supplement |

All template bodies live in PR #141 §3.1-§3.6 — sales fills `<customer_alias>` + `<HH:MM>` + `<销售对接人>` placeholders at send time.

---

## 3. Channel rationale

**Default Stage 1 mix (per PR #141 §4.2 F-numeric tier)**:
- **Pre-notice**: email + 微信 — formal record + quick visibility
- **Reminder / during-cutover**: 微信 — fast, lightweight, no email overload
- **Post-confirm + Stage GO**: email + 微信 — formal closure
- **Rollback ONLY**: 4-channel panic (email + 微信 + 钉钉 + 电话). 电话 leads per PR #141 §4.1 (immediate response, can't be missed)

**Why no pre-escalate Stage 1 to 4-channel?** Stage 3 (RES_GML_001 + RES_3101_009 桂满陇 / QHJ_PROD) is the high-stakes pre-restaurant-chain stage (per Stage 3 MO §0). 4-channel is its signature comms posture. Using 4-channel for Stage 1's medium-stakes F-numeric customers would flatten the stake gradient and reduce signal effectiveness when Stage 3 actually needs it.

---

## 4. Per-customer specifics (GAPs marked)

Customer info **NOT in repo** per PR #141 §1 non-leak policy + §8.1 (sales-team-owned, lives in CRM). Sales fills these in CRM **before** May 9 12:00 CST send-by deadline for §3.1 pre-notice.

### F002

- 客户公司中文名 / alias: **GAP — pending Steve / 销售 提供**
- 销售对接人 (姓名 + 职位 + 电话 + 微信): **GAP — pending Steve / 销售 提供**
- 技术对接人 (客户侧 IT / 数据负责人 + 联系方式): **GAP — pending Steve / 销售 提供**
- Email 地址 (formal channel): **GAP — pending Steve / 销售 提供**
- 微信号 / 群名: **GAP — pending Steve / 销售 提供**
- 钉钉 ID (rollback only): **GAP — pending Steve / 销售 提供**
- 电话 (rollback only): **GAP — pending Steve / 销售 提供**
- Batch jobs / scheduled reports in 13:00-16:00 window: **GAP — verify with customer ops**
- Customer-specific window override (per PR #141 §2.3, if customer prefers different time): **GAP — sales confirm**

### F003

- 客户公司中文名 / alias: **GAP — pending Steve / 销售 提供**
- 销售对接人 (姓名 + 职位 + 电话 + 微信): **GAP — pending Steve / 销售 提供**
- 技术对接人 (客户侧 IT / 数据负责人 + 联系方式): **GAP — pending Steve / 销售 提供**
- Email 地址 (formal channel): **GAP — pending Steve / 销售 提供**
- 微信号 / 群名: **GAP — pending Steve / 销售 提供**
- 钉钉 ID (rollback only): **GAP — pending Steve / 销售 提供**
- 电话 (rollback only): **GAP — pending Steve / 销售 提供**
- Batch jobs / scheduled reports in 13:00-16:00 window: **GAP — verify with customer ops**
- Customer-specific window override (per PR #141 §2.3): **GAP — sales confirm**

⛔ **GAP fill location**: PR #141 §7 customization checklist (per-customer, lives in sales CRM / shared doc, **not committed to repo** per non-leak policy). Each GAP above maps 1:1 to a §7 checklist row.

---

## 5. Sender responsibility

| Time slot | Owner | Why |
|---|---|---|
| **T-24h pre-notice** (May 9 14:00) | 销售对接人 (per-customer) | Customer-facing; sales owns relationship + tone calibration |
| **T-1h reminder** (May 10 13:00) | 销售对接人 | Same reason; quick 微信 ping |
| **T+15min during-cutover** | 技术值班 → 内部销售群 | Real-time status; sales forwards relevant snippets to customer 微信 if customer asks |
| **T+1h post-confirm** (15:00) | 销售对接人 | Customer-facing closure |
| **T+24h stage-GO** (May 11 14:00) | 销售对接人 + organizer (metrics summary) | Sales sends; organizer provides numerical summary for body |
| **Rollback** | 技术值班 (decision) → 销售对接人 (customer reach) | Technical triggers, sales communicates per §5 SLAs |

**Organizer chat does NOT directly reach customers.** Role: trigger 销售对接人 at each time slot via 内部群 ping; provide template-fill values (`<HH:MM>` actual cutover stamp, `<24h metrics summary>` for §3.5).

---

## 6. Stage 2-5 reuse note

This schedule is the **default-stage template** for T6.4 Strategy B. Stages 2 / 4 / 5 (medium-stakes F-numeric or restaurant chain pilots) can 1:1 reuse this schedule structure with factory ID + cutover date substitutions:

- **Stage 2** (May 11): F004 + F006 + R001 — same default-stage 2-channel mix
- **Stage 4** (May 13): R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH — restaurant chain pilots, 2-channel default OK (not high-stakes like Stage 3)
- **Stage 5** (May 14): R_XMX_FRESH2 + R_XMX_FRESH3 + R_YHDJ_DEMO + R_YJJ_DEMO — pilots, 2-channel default

**Stage 3 (May 12) does NOT reuse this**. Per `2026-05-12-t6-4-stage-3-marching-order.md` line 26 + §1 prereqs: Stage 3 uses 4-channel (邮件 + 微信 + 钉钉 + 电话) pre-notice for 桂满陇 + QHJ_PROD high-stakes restaurant chain; extended T-24h to T+48h on-call window (vs Stage 1's T+24h); Pattern B 3-state distribution baseline capture per customer pre-cutover. Stage 3 has its own dedicated comms schedule runbook (TBD if dispatched separately, otherwise inline in Stage 3 MO §0).

---

## 7. ⛔ HOLD blocks

- ⛔ **Doc-only**: nothing in this schedule sends emails / 微信 / 钉钉. Sales executes per the time table on May 10.
- ⛔ **GAP fields**: F002 + F003 customer info (§4) **must** be filled in CRM before May 9 12:00 CST. If GAPs unresolved by then → escalate to organizer + delay Stage 1 cutover.
- ⛔ **No pre-escalate channels**: Stage 1 default = 2-channel (email + 微信). Don't add 钉钉 / 电话 to non-rollback comms. Save 4-channel for Stage 3 + rollback signal.
- ⛔ **`<customer_alias>` placeholders**: sales fills from CRM, not committed to repo (per PR #141 non-leak policy).
- ⛔ **Send-by deadlines** anchor on 14:00 cutover (§0 organizer-confirmed). Pre-notice T-24h = May 9 14:00 CST.

---

**End of T6.4 Stage 1 customer comms schedule.**
