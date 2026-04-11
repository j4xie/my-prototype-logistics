# V1 E2E 测试框架

六扇门 v3 客户需求端到端验证框架. 详见 `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md`.

## 快速跑

```bash
# PR 门禁 (~12 分钟)
bash scripts/run-pr-gate.sh

# 全量 + 跨端 (~45 分钟, 需 Android emulator)
bash scripts/run-full.sh

# 单个 journey
npx playwright test web/g1-invoice.spec.ts
```

## 前置

1. PostgreSQL 17 运行在 localhost:5432
2. Java 后端运行在 localhost:10010 (`mvn spring-boot:run`)
3. web-admin 前端运行在 localhost:5173 (`npm run dev`)
4. 已 seed `F_E2E_TEST` 工厂 (`bash scripts/seed-and-reset.sh`)

## 结构

- `fixtures/` — SQL 种子数据
- `helpers/` — 登录/选择器/断言
- `web/` — Playwright Web 测试
- `rn/` — Maestro RN 测试
- `scripts/` — 指挥官 bash 脚本

## 调试

1. 看 `test-results/` 下的 trace.zip: `npx playwright show-trace test-results/xxx/trace.zip`
2. 看 `.shared-state.json` 是跨端握手的状态
3. 失败时 DB snapshot 在 `test-results/pg_dump_failure.sql`
