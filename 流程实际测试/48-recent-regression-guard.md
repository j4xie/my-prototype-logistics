# 48. 最近修复回归防护 (Recent Fix Guard)

> **🟡 R18 QA Smoke 13/15 (2026-04-17 07:08)**: 15 hotspots 健康检查 200: health ✅ / SO ✅ / customers ✅ / suppliers ✅ / equipment ✅ / users ✅ / processing.batches ✅ / QC ✅ / invoices ✅ / payments ✅ / product-types ✅ / canvas.config ✅ / settings ✅. 2 路径差异 404: `/procurement/orders` (应 `/purchase/orders`) + `/finance/receivables` (应 `/accounts-receivable`). 非 blocker, 前端已 正确调用.

**来源**: R4 Agent 5 — 3 个 recent fix 未测
**耗时**: 15 min
**必做**: 每次新 commit 后跑此节

---

## 48.1 R21-F4: smartbi-config JwtAuth 排除 ⭐

### 背景
- Commit `c3204827d` — JwtAuthInterceptor 把 "smartbi-config" 加入排除列表
- 原因: `/api/mobile/smartbi-config/*` 的 factoryId 来自 **query param** `?factoryId=xxx`, 不是 path variable
- 若无此排除, JwtAuth 把 "smartbi-config" 当 factoryId → 403

### 测试
1. admin 登录获取 token
2. curl 测:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/smartbi-config/thresholds?factoryId=F001"
```

### ✅ PASS
- HTTP 200 (不是 403)
- 返回 thresholds 数据

### ❌ FAIL
- 403 "无权访问该工厂数据" → 回归了, 检查 JwtAuthInterceptor 排除列表是否含 "smartbi-config"

### 前端测试
- `/system/smartbi-config` 列表页加载
- Network 面板检查所有 `/smartbi-config/*` 请求 200

### 跨工厂越权测试
- admin (F001) 调 `?factoryId=F002` → 应 403 (后端 query param 工厂边界检查)
- 若 200 返回 F002 数据 → **严重安全漏洞**

---

## 48.2 R21-F5: Whitelist 单对象 POST

### 背景
- Commit `3b36d9d9a` 增加 `POST /api/mobile/whitelist` 单对象 (之前只有批量)
- DTO: `WhitelistSingleAddRequest`

### ⚠️ R6 审计待确认
当前只确认 `WhitelistController.batchAdd(List)` 实装, **单对象 POST 可能未实装**. 若 curl 返 404 / 405, 说明 endpoint 未部署, 改走批量接口并标 "V2 补齐".

### 测试
```bash
curl -X POST "https://www.cretaceousfuture.com/api/mobile/whitelist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800001111","name":"新员工A","factoryId":"F001"}'
```

### ✅ PASS
- 200 + 返回 whitelist ID
- DB 里 `whitelist` 表新增行
- HR 在 `/hr/whitelist` 能看到

### ❌ FAIL
- 404 / 405 → endpoint 未部署
- 400 字段错 → DTO 字段名不匹配

### 前端测试
- `/hr/whitelist` → "添加白名单" 按钮
- 填手机号 + 姓名 → 提交
- Network `POST /whitelist` 单对象 (非数组)

---

## 48.3 R21-F3: FactorySettings 首次 404 → lazy-init

### 背景
- Commit `3b36d9d9a` — GET `/api/mobile/{fid}/settings/full` 首次应**自动创建**默认设置
- 不再 404

### 测试
```bash
# 假设有新工厂 F999 (或用 settings 未创建的工厂)
curl -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/F001/settings/full"
```

### ✅ PASS
- 200 + 返回默认值:
  - `language: zh-CN`
  - `timezone: Asia/Shanghai`
  - `workHours: {start:"09:00", end:"18:00"}`
  - `currency: CNY`
- DB 里 `factory_settings` 表为此工厂创建了行

### ❌ FAIL
- 404 → lazy-init 未生效
- 500 → 后端异常

### 前端测试
- admin 进 `/system/factory-settings` (首次访问)
- 应看到默认值填充的表单
- 不应有 "设置不存在" 错误

---

## 48.4 之前修过的回归点 (必测)

| Commit | 场景 | QA 节 | 勾选 |
|--------|------|-------|------|
| 5df51ffee | Canvas 403 factory_super_admin | §02.2 | ☐ |
| 4e3486855 | URL 双前缀 ReferenceSelector | §02.5 | ☐ ⭐ |
| 321897f82 | 出货按钮无反应 | §02.6 | ☐ |
| e11e767fe | workflow/* JwtAuth 排除 | §02.8 | ☐ ⭐ |
| b9d55382c | Keruyun demo 凭证识别 | §02.9 | ☐ |
| 9bda316fe | FinancialDashboard TypeError fetch | §02.3 | ☐ |
| c3204827d | smartbi-config 排除 ⭐ 本节 | §48.1 | ☐ ⭐⭐ |
| 3b36d9d9a | whitelist 单对象 + FactorySettings lazy | §48.2/48.3 | ☐ ⭐ |

---

## 48.5 Checklist (12 项)

| # | 测试 | 勾选 |
|---|------|------|
| 1 | smartbi-config 200 | ☐ ⭐⭐ |
| 2 | smartbi-config 跨工厂 403 | ☐ ⭐⭐ |
| 3 | whitelist 单对象 POST | ☐ ⭐ |
| 4 | whitelist 批量 POST | ☐ |
| 5 | FactorySettings 首次 200 (lazy-init) | ☐ ⭐ |
| 6 | 默认值齐 (language/timezone) | ☐ |
| 7 | Canvas 403 不再 | ☐ |
| 8 | 双前缀 URL 绝不出现 | ☐ ⭐⭐ |
| 9 | 出货按钮弹 dialog | ☐ |
| 10 | workflow/node-schemas 200 | ☐ |
| 11 | Keruyun demo 同步返 mock | ☐ |
| 12 | Financial Dashboard 切页无 Failed to fetch | ☐ |

---

## 48.6 自动化建议

每次 deploy 后自动跑:
```bash
node tests/bug-verify-2026-04-15/verify-17-full.mjs
```
脚本已覆盖部分回归点. 新增的 smartbi-config/whitelist/FactorySettings 建议补入脚本.

---

## 48.7 R5 审计: 前置确认清单

执行本节前**先确认**后端状态 (避免 QA 跑半天发现 endpoint 不存在):

```bash
# 1. smartbi-config 路径存在
curl -s -o /dev/null -w "%{http_code}" \
  "https://www.cretaceousfuture.com/api/mobile/smartbi-config/thresholds?factoryId=F001" \
  -H "Authorization: Bearer $TOKEN"
# 预期: 200

# 2. whitelist 单对象 POST
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://www.cretaceousfuture.com/api/mobile/whitelist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","name":"test","factoryId":"F001"}'
# 预期: 200 或 409 (重复), 不是 404

# 3. FactorySettings lazy-init
curl -s "https://www.cretaceousfuture.com/api/mobile/F001/settings/full" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('defaults:', 'language' in d.get('data',{}), 'timezone' in d.get('data',{}))"
# 预期: defaults: True True
```

3 个 curl 都通过再继续本节.
