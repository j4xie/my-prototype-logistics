# V1 E2E Test Suite

六扇门 v3 客户需求端到端验证框架. 详见 `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md`.

## Quick Start

```bash
# Prerequisites: backend (10010) + web-admin (5173) + postgres (5432) running

# PR gate only (14 tests, ~1.5 min)
bash tests/v1-e2e/scripts/run-pr-gate.sh

# Full suite (all tests, ~5 min)
bash tests/v1-e2e/scripts/run-full.sh
```

## Test Specs

### PR Gate (@pr-gate) — 14 tests

| Spec | Description |
|------|-------------|
| `l1-smoke.spec.ts` | 10 main menu navigation items |
| `g1-invoice.spec.ts` | Tax rate grouping — 杀手锏 demo (9%×2500 + 13%×800) |
| `g2-sales-chain.spec.ts` | SO → PO → receive chain |
| `g3-production-chain.spec.ts` | Production 6-step chain |

### Post-Deploy (@post-deploy) — ~25 tests

| Spec | Description | Feature Coverage |
|------|-------------|-----------------|
| `j4-super-admin-setup.spec.ts` | Factory initialization | super admin setup |
| `j5-sales-full.spec.ts` | Sales full cycle | P1-6 / P1-7 / P0-3 / P0-9 / P0-7 |
| `j6-purchase-full.spec.ts` | Procurement cycle | purchase flow |
| `j7-warehouse-full.spec.ts` | Warehouse pages | inventory pages |
| `j8-rd-sample.spec.ts` | R&D samples + quotes | P1-3 / P1-8 / P0-4 |
| `j9-employee-segment-web.spec.ts` | Employee process (web) | P1-1 web |
| `j10-bom-audit.spec.ts` | BOM change log + FMR | P1-9 / P1-5 |

## Seed Data

`F_E2E_TEST` factory with 5 users, 3 customers, 3 suppliers, 40 materials, 5 products, 5 BOMs.

```bash
# Reset seed data (idempotent)
bash tests/v1-e2e/scripts/seed-and-reset.sh
```

## Prerequisites

1. PostgreSQL 17 running on localhost:5432
2. Java backend on localhost:10010 (`mvn spring-boot:run`)
3. web-admin frontend on localhost:5173 (`npm run dev`)
4. `F_E2E_TEST` factory seeded (`bash tests/v1-e2e/scripts/seed-and-reset.sh`)

## Directory Structure

```
tests/v1-e2e/
├── fixtures/       — SQL seed data
├── helpers/        — login / selectors / assertions / installApiProxy
├── web/            — Playwright Web specs (11 files)
├── rn/             — Maestro RN tests
└── scripts/        — bash orchestration scripts
    ├── run-pr-gate.sh
    ├── run-full.sh
    ├── seed-and-reset.sh
    ├── wait-for-health.sh
    └── wait-for-port.sh
```

## CI Workflows

| File | Trigger | Scope |
|------|---------|-------|
| `.github/workflows/e2e-pr.yml` | `pull_request` | PR gate (@pr-gate) |
| `.github/workflows/e2e-post-deploy.yml` | nightly + manual | Full suite (@post-deploy) |

## Known Constraints

- **`warehouse_worker` is MOBILE_ONLY** — use `super_admin` for warehouse page tests
- **Vite proxy broken locally** — `installApiProxy()` in helpers intercepts `/api/mobile/**` and forwards to port 10010
- **Backend 429 rate limit** — use auth-cache `storageState` pattern (login once, reuse state)
- **`tax_rate` is integer percent** — store as `9` or `13`, not `0.09` or `0.13`
- **All schema table names are plural** — `sales_orders`, `purchase_orders`, etc.
- **Subagents may switch branch** — verify you are on `e2e/v1-framework` before running tests

## Debugging

1. View trace: `npx playwright show-trace test-results/xxx/trace.zip`
2. Check `.shared-state.json` for cross-platform handshake state
3. DB snapshot on failure: `test-results/pg_dump_failure.sql`
