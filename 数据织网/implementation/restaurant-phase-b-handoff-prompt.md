# 餐饮 Phase B — Handoff Prompt for 新 Chat

**生成时间**: Apr 28 2026 (collapse handoff)
**当前 branch**: `e2e/v1-framework`
**HEAD commit**: `c8dee0a98` (datetime tz fix on completeness factoryAge)
**Phase A close-out commit**: `cc4e805b3` (safe-commit.sh + rule 5b)
**Memory file**: `memory/project_apr28_restaurant_phase_a_complete.md` (full audit trail)

---

## 当前状态 (Phase A 完成 + Phase B 4/9 quick-wins shipped)

### Phase A 全部完成 (21/21 tasks)

- W0 spike (4 tasks) → spec v2 §2.3 schema CONFIRMED, W0.2 miss rate 26%, W0.3 选 协-α
- A-1 ETL admin trigger (6 tasks) → retry helper + cron catchup + admin endpoints + etl-status.vue
- A-2 完整度页 (2 tasks) → 6-module API + completeness.vue + get_cretas_pool() singleton
- A-3 数据质量队列 (6 tasks) → Java UserCountController + Python list/resolve/reject/batch/history + 4-eye gate + queue.vue 699 lines + detail page
- Smoke E2E (1 task) + Deploy + Real-window verify (2 tasks)

### Phase B Quick-Wins Already Shipped (4/9)

| # | Item | Commit | Live Verify |
|---|---|---|---|
| 1 | 6 keyword classifier expansion | `80ec7202f` (concurrent-merged) | Server-side spot-check ✓ |
| 2 | factoryAge business date columns | `05cd07e34` + `c8dee0a98` (datetime fix) | R_XMX 4→17 days, overall 16%→29% ✓ |
| 3 | Cross-factory access tightening | `05cd07e34` | F002→R_BEJ 403 中文 ✓ |
| 4 | safe-commit.sh + rule 5b (concurrent-edit fix) | `cc4e805b3` | Dogfood + c8dee0a98 verified ✓ |

### Tests + Verify

- **23/23 unit tests PASS** (14 pytest + 9 vitest)
- **41+ scenarios verified**: 4 happy path + 8 sad path + 3-role RBAC + race condition + 50-row scale + 7 factoryId edge + 4-eye block/bypass + cross-factory + history + detail page + failure log
- **17 bugs caught + fixed**: 13 reviewer + 3 deep-test + 1 datetime tz
- **Live test env verified**: F002 (restaurant_admin1) + R_BEJ (buerjun_admin) + R_XMX (API)

---

## Phase B Remaining Backlog (5 items)

### Need brainstorm before code (4 items)

#### B-1 outlier filter
- Soft-warn IQR + global fallback + factor 历史采样源
- 适用场景: dashboard 异常值警告
- 复杂度: 中 (algorithm + UX)
- 可独立做不依赖其他项

#### B-2 LLM bottom-fill normalizer
- 用 `common.llm_router` SLOT.MAPPER chain (qwen-turbo-1101 etc)
- few-shot from `restaurant_field_canonical_labels` 新表
- 触发: 现有 hardcoded keyword miss 后 fallback 调 LLM
- **优先级降低**: 6-keyword quick-win 已消 62.6% miss; 剩余 26% restaurant miss → LLM 收益 ~9% absolute. Wait for re-measurement.
- 复杂度: 大 (新 table + LLM 调用 + cache + cost monitoring)

#### B-3 dashboard density
- 4+4 stat 卡 + AI 推荐 + 摘要
- **触发**: 等 customer 用了 Phase A 的 R_XMX 29% completeness 后反馈
- 复杂度: 中 (UI 重构 + summary algorithm)

#### Java admin-count service-account JWT
- Python `_get_admin_count_for_factory` 现 fallback count=2 (safer enforce 4-eye)
- 加 service-account JWT → enable real admin-count → enable single-admin degradation path
- 复杂度: 小 (auth design)
- **依赖**: 决定 service-account 鉴权方式 (shared secret / cert / mTLS)

### Ops, no brainstorm needed

#### test env Java systemd unit
- 现 nohup-managed test 10011 没 auto-restart on crash
- prod 有 cretas-backend systemd
- 加同样 service file for test
- 复杂度: 小 (systemd unit)

---

## Phase B 推荐启动顺序

1. **B-1 outlier filter** 先做 — 独立, 无依赖, 客户能直接看到 dashboard 改善
2. **test env Java systemd** 同步做 — 5min ops, 防止 deep-test 时 Java 挂掉

3. **B-2 LLM normalizer** 等 W0.2 重测 — 6-keyword 已部署, 等真客户上传 5+ Excel 后重跑 W0.2 query 看实际 miss 率, 再决定是否做 LLM

4. **Java admin-count JWT** — small auth work, 等 B-1 完成后做

5. **B-3 dashboard density** — 最后, 等 customer feedback

---

## ⚠️ 重要约束

### 1. **All commits must use `safe-commit.sh`**

```bash
bash scripts/safe-commit.sh "commit message" file1 file2 [file3 ...]
```

不要用 `git add F1 F2 && git commit -m "msg"` — 一晚踩了 3 次, 把并发 session 文件吞进 commit。

### 2. **Phase B 创意工作必须先 brainstorm**

per `superpowers:brainstorming` skill: "use BEFORE any creative work — creating features, building components, adding functionality, or modifying behavior". 上面 B-1 / B-2 / B-3 / Java JWT 都是新功能, 必须先 brainstorm 与用户对齐 scope + 优先级。

### 3. **W0 finding 3 binding for any new admin-queue endpoint**

如果 B-1 / B-2 涉及 RLS-protected 表 (smartbi_db agg_* / restaurant_reviews / entity_resolution_admin_queue), MUST 用 `async with conn.transaction(): await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)` 模式。否则 silently 返 0 rows.

### 4. **Concurrent edit safety**

`.claude/rules/concurrent-edit-safety.md` rule 5b 已加, 总是用 safe-commit.sh。

### 5. **Don't push prod without verify**

部署 test env (8084 + 8097) 后真窗 verify, 才考虑 prod (8083 + 8086).

---

## Working Files Quick Reference

| File | 作用 |
|---|---|
| `memory/project_apr28_restaurant_phase_a_complete.md` | 完整 audit trail |
| `数据织网/implementation/restaurant-phase-a-w0-spike-report.md` | W0.2 normalizer hit-rate report (Phase B brainstorm 主输入) |
| `数据织网/implementation/restaurant-phase-a-only-2026-04-28-design.md` | Spec v2 (Phase A binding, post-W0.4 hardening) |
| `数据织网/implementation/restaurant-phase-a-plan-2026-04-28.md` | Phase A plan (mostly historical reference) |
| `scripts/safe-commit.sh` | 所有 commit 必走这个 |
| `.claude/rules/concurrent-edit-safety.md` | rule 5b 强制 safe-commit |

## Test Credentials (in repo: `.env.test.example` — 实密码本地)

- `factory_admin1 / 123456` (factory_super_admin, F001)
- `restaurant_admin1 / 123456` (factory_super_admin, F002 餐饮)
- `buerjun_admin / 123456` (factory_super_admin, R_BEJ)
- 一线员工 operator1 仅移动端

---

## Test Env URLs

| Service | URL |
|---|---|
| web-admin (test) | http://139.196.165.140:8097 |
| Python (test) | http://localhost:8084 (only via SSH) |
| Java (test) | http://localhost:10011 (only via SSH) |
| Restart test services | `ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart-test.sh"` |

**Prod 不要碰** until Phase B 完整 + 用户授权。

---

**作者**: Claude Opus 4.7 + Steve (Phase A 实施 + Phase B partial + collapse handoff)
