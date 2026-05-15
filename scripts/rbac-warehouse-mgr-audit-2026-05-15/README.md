# C-RBAC-1 — 仓管员 RBAC 隔离审计

**Date**: 2026-05-15
**Track**: C (Track C ASAP Sprint 1)
**Spec**: `宏见竞品分析/04-最终决策/TRACK_C_BRIEF.md` §Day 10-11

## 客户原话 (六扇门第三次 May7 part2 行 188-189)

> "其他的话就尽量少让那个仓管员去参与什么什么价格类的不要让他们去参与"
> "做仓管的他年纪都比较大文化素质很低的, 你不能太伪赖他们"

## 本目录内容

| File | 用途 |
|---|---|
| `run-regression.sh` | 25 case (5角色 × 5视图) bash 脚本, 跑后输出 `report.md` |
| `expected-rbac-matrix.csv` | 期望矩阵, 与 run-regression 对照 |
| `report.md` | 跑完输出 (gitignored, 每次跑覆盖) |
| `_seed-tokens.sh` | (待补) 用 5 角色账号登录拿 token, export 到 env |

## 测试套件总览 (3 层防御)

1. **静态注解审计 (mvn 单测)**: `RBACWarehouseManagerIsolationTest.java` (4 cases)
   - 反射枚举所有 entity 价格字段, 凡命中 price/amount/cost/payable/etc 关键词必须 `@PriceSensitive`
   - `@Transient` computed getter 同样要求 (P0 fix from 2026-05-12)
   - `PRICE_VIEW_PERMISSION` 常量字符串稳定 (跨服务约定)
2. **AIChat 诊断面板**: `RBACAuditTool` (`@Component`)
   - 用户问 "审计仓管 RBAC" → 返回当前 framework 状态 + 期望矩阵
3. **运行时 5x5 negative regression (本目录)**: 用真 token 调 25 endpoint
   - 期望: PASS = 200 + 价格字段 null/'—', OR 403/401
   - FAIL = 200 + 价格字段含数值 (价格泄漏)

## 跑法 (deploy 后)

```bash
# 1. 准备 5 角色 token (示例 — 用各角色 username/password 调 /auth/unified-login)
export TOKEN_WAREHOUSE_MGR=$(curl -sX POST http://test.cretas.local:10010/api/mobile/auth/unified-login \
    -H "Content-Type: application/json" \
    -d '{"username":"f006_warehouse_mgr","password":"xxx"}' | jq -r .data.accessToken)
# ... 同样 export TOKEN_OPERATOR / TOKEN_QUALITY_INSPECTOR / TOKEN_CUSTOMER_SERVICE / TOKEN_VIEWER

# 2. 跑 regression
export CRETAS_BASE_URL=http://test.cretas.local:10010
export CRETAS_FACTORY_ID=F006
export CRETAS_SAMPLE_PO_ID=$(curl -s -H "Authorization: Bearer $TOKEN_WAREHOUSE_MGR" \
    "$CRETAS_BASE_URL/api/mobile/F006/purchase/orders?page=0&size=1" | jq -r .data.content[0].id)
# ... 同样 export 其他 SAMPLE_*_ID

bash scripts/rbac-warehouse-mgr-audit-2026-05-15/run-regression.sh

# 3. 看 report
cat scripts/rbac-warehouse-mgr-audit-2026-05-15/report.md
```

## CI 集成 (后续)

可在 GitHub Actions PR check 中跑, 用 service container 启动 backend + 自动 seed 5 角色 + 跑 regression. 失败 block merge. 后续 PR 实现.

## 期望状态 (本 PR ship 时)

- ✅ 静态注解审计 4/4 PASS (本 PR commit 已验)
- ⏳ 25 case 实跑 PASS — 待 organizer 在 deploy-test 跑 (本 PR 不携带跑结果, 因本地无 5 角色 token)
- ✅ AIChat 诊断面板 ready (RBACAuditTool 已 commit)
