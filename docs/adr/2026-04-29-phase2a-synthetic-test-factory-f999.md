# ADR: Phase 2A Synthetic Test Factory F999

| Field | Value |
|---|---|
| Status | Accepted (2026-04-29) |
| Deciders | stevenj4xie |
| Spec | docs/superpowers/specs/2026-04-29-alerts-full-port-design.md |
| Plan | docs/superpowers/plans/2026-04-29-alerts-full-port.md |
| Implemented | chat 2 (2026-04-29) — commits `90208d24c` (migration) + `58af128e0`/`f84101d53` (goldens) |

## Context

Phase 2A ports 50 Java SmartBI endpoints to Python aliases for byte-shape parity before T6 nginx cutover. ~10 of those endpoints are backed by 1000+ LOC services in `RecommendationServiceImpl` / `*AnalysisServiceImpl` that emit non-trivial responses on factories with `smart_bi_*_data` populated.

Recording byte-shape goldens against an empty factory produces uselessly empty responses. Recording against a real production factory (e.g. F001) produces unstable goldens that drift with prod data changes. We need a stable, deterministic test factory that:

1. Has a `factories` row (so JWT login succeeds + RLS doesn't block)
2. Has `smart_bi_sales_data`, `smart_bi_finance_data`, `smart_bi_department_data` populated with deterministic content
3. Stays stable across prod data changes
4. Is recorder-accessible from CI/dev

## Alternatives considered

### Option 1 — Reuse F001
F001 is the existing PoC test factory **and** has `smart_bi_*_data` seed (345 sales / 2648 finance / 6 dept rows on test env). But F001 carries other production-shape fixtures used by unrelated tests; coupling alert goldens to F001 means alert tests break whenever F001's other fixtures change. **Rejected** as the primary fixture, but used as **seed source** for F999 (see Option 4).

### Option 2 — Reuse `DEMO_FACTORY`
Java's V2026_01_18_02 migration purports to seed `DEMO_FACTORY` with rich smart_bi data. Reality discovered during chat 2: that migration lives in `db/migration-pg-converted/` which is **never scanned by Flyway** (active locations is `classpath:db/flyway`, per `application-pg.properties:44`). Consequently:

- `factory_id='DEMO_FACTORY'` rows do NOT exist in `smart_bi_*_data` on any environment
- The `factories` table has no row for `'DEMO_FACTORY'` either
- `SmartBIPublicDemoController.java:41` defines `DEMO_FACTORY_ID = 'F_DEMO'` (a separate string mismatch)

The orphaned migration + the F_DEMO/DEMO_FACTORY name mismatch means the entire "demo factory" code path was never functional on any environment. **Rejected** until that pre-existing bug is fixed (out of scope for Phase 2A).

### Option 3 — Promote `DEMO_FACTORY` to real factory + apply orphaned migration
Add 1 migration to `db/flyway/` that inserts `('DEMO_FACTORY', ...)` into `factories` AND replays the orphaned seed insert. Cheaper than Option 4 in code volume, but conflates Phase 2A's test fixture choice with fixing a Java demo bug that has multiple downstream callers depending on the broken behaviour. **Rejected** to keep Phase 2A scope tight.

### Option 4 — Synthetic F999 (chosen)
New migration creates a clean, purpose-named test factory `F999`. Seed data via `INSERT ... SELECT` from F001's existing `smart_bi_*_data` rows (no fixture re-authoring). Test user `phase2a_test_user` with env-injected password hash that defaults to `DISABLED` in prod. Future Phase 2A endpoints that need additional factory data extend F999's seed via per-endpoint migrations.

## Decision

Adopt **Option 4: synthetic F999 test factory, seeded from F001**.

### Implementation details

| Element | Where |
|---|---|
| Migration | `backend/java/cretas-api/src/main/resources/db/flyway/V20260430_01__phase2a_test_factory_F999.sql` |
| Test user | `phase2a_test_user` / role_code `factory_super_admin` / level 0 |
| Password hash | Flyway placeholder `${PHASE2A_TEST_USER_PASSWORD_HASH}` resolved by Spring from env var |
| Test env config | `application-pg.properties: spring.flyway.placeholders.PHASE2A_TEST_USER_PASSWORD_HASH=${PHASE2A_TEST_USER_PASSWORD_HASH:DISABLED}` |
| Prod env config | `application-pg-prod.properties: spring.flyway.placeholders.PHASE2A_TEST_USER_PASSWORD_HASH=DISABLED` (literal) |
| Test env env vars | `/www/wwwroot/cretas/.env.test` sets `PHASE2A_TEST_USER_PASSWORD_HASH=<bcrypt>` + `PHASE2A_TEST_USER_PASSWORD=<plaintext>` |
| Seed data | `INSERT ... SELECT` from `factory_id='F001'` for sales/finance/department |
| Recorder wrapper | `scripts/phase2a/record-alerts-goldens.sh` |
| Goldens | `tests/fixtures/java-smartbi-golden/<endpoint>-F999.json` (56 recorded in chat 2) |

## Consequences

### Positive

- **Deterministic goldens** — F999 seed copies F001 once via Flyway migration; subsequent F001 mutations don't drift F999 (rows isolated by `factory_id`).
- **Reusable across remaining Phase 2A endpoints** — chat 2's recorder run produced 56 F999 goldens in one pass (alerts, analysis-{sales,department,region,finance,production,quality,inventory,procurement}, dashboard, data-date-range, datasource-list, query-templates, etc.). These are calibration data for future contract tests beyond /alerts.
- **F999 ADR clarifies the precedent** — the next 10+ analysis-subdomain endpoints follow this pattern without re-debating fixture choice.
- **~150 LOC of migration vs. ~1000 LOC of fresh fixture authoring** — the INSERT...SELECT clones an entire production-shape dataset.
- **Prod posture is safe by default** — `application-pg-prod.properties` hardcodes `DISABLED`; production cannot accidentally serve a logged-in `phase2a_test_user` even if env vars leak.

### Negative

- **F999 is created in prod database too** — Flyway runs the migration in every env. Mitigated by `password_hash='DISABLED'` in `application-pg-prod.properties` rendering the user un-loginable. Cleanup migration deferred to T6 cutover close-out.
- **Spring `${VAR:DEFAULT}` substitution edge case** observed during deploy: when `PHASE2A_TEST_USER_PASSWORD_HASH` env var contains `$` characters (bcrypt `$2b$12$...`), Spring's substitution yielded the literal `DISABLED` fallback rather than the env var value. Root cause not fully diagnosed (suspected double-substitution interaction between Spring's resolver and the runtime env). **Workaround**: manual `UPDATE users SET password_hash = '<bcrypt>' WHERE username = 'phase2a_test_user';` after deploy. Tracked as Phase 2A close-out follow-up.
- **F999 data shape inherits F001's distribution** — F001's current month (April 2026) has ~90% completion rate which trips no `/alerts` thresholds. Chat 2 sales golden recorded `data: []`. To exercise non-empty alert byte-shape, chat 3 will either (a) add F999-specific synthetic data trip-rows via a follow-up migration, or (b) lower thresholds in test-only `alert_thresholds.json` overlay.
- **DEMO_FACTORY pollution remains unfixed** — separate Phase 3 ADR.

## Future endpoint extension pattern

For an endpoint that needs F999 to have additional data (e.g. `/analysis/procurement` reading a `smart_bi_purchase_data` table that gets seeded via a new migration), add:

```sql
-- V<date>__phase2a_F999_<table>_seed.sql
INSERT INTO smart_bi_<table> (factory_id, ...)
SELECT 'F999', ...
FROM smart_bi_<table>
WHERE factory_id = 'F001'
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

Then re-record that endpoint's golden against F999 via:

```bash
ssh -fN -L 10011:localhost:10011 root@47.100.235.168
export PHASE2A_TEST_USER_PASSWORD=<from .env.test>
./scripts/phase2a/record-alerts-goldens.sh
# → tests/fixtures/java-smartbi-golden/<endpoint>-F999.json
```

## Cross-references

- Spec §3.3 (F999 foundation) — original plan assumed DEMO_FACTORY source; corrected to F001 in this ADR
- Spec §3.4 (Password handling) — Spring placeholder pattern + DISABLED prod posture
- `feedback_concurrent_edit_safety.md` (memory) — used `safe-commit.sh` path-explicit for all Phase 2A commits
- `feedback_flyway_dollar_brace_placeholder.md` (memory) — single `$` for Flyway placeholder syntax (verified)
- `aliyun-credentials.md` (rules) — server SSH access for env var setup
- Recorded goldens: 56 files at `tests/fixtures/java-smartbi-golden/*-F999.json`
