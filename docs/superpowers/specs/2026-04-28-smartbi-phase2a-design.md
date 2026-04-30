# SmartBI Phase 2A Design — Web-admin + RN 流量直连 Python (50 个端点子集)

**日期**：2026-04-28
**状态**：已批准，待出 implementation plan
**前置依赖**：Phase 1 LLM 迁移完成（commits `7d2ca463c` → `cab0118ff`，全部 main 上线）

---

## 背景与动机

Phase 1 完成 LLM 客户端迁移后，Java 仍承担所有 SmartBI 流量入口（`/api/mobile/{factoryId}/smart-bi/*`），但实际业务逻辑已大量下沉到 Python：

- 多数 Java SmartBI Controller 是 **thin proxy** —— 内部通过 `PythonSmartBIClient` 调用 Python 8083
- 前端调用链：`Web-admin / RN → nginx:139 → Java:10010 → PythonSmartBIClient → Python:8083 → 业务逻辑`
- 双倍传输（前端→Java→Python）+ Java 同步阻塞 IO

Phase 2 目标：把客户端流量从 nginx 直接路由到 Python，去掉 Java 这一跳。Phase 2 拆分为 4 个子阶段（2A/2B/2C/2D），本 spec 覆盖 **Phase 2A**：迁移 50 个 in-scope 端点到 Python alias 层，前端代码零改动。

---

## Phase 2A Scope

### In-scope（50 个端点）

| Controller | 路径前缀 | 端点数 |
|------------|----------|--------|
| `SmartBIAnalysisController` | `/api/mobile/{factoryId}/smart-bi/analysis/*` 等 | 26 |
| `SmartBIUploadController` | `/api/mobile/{factoryId}/smart-bi/upload*` | 13 |
| `SmartBIDashboardController` | `/api/mobile/{factoryId}/smart-bi/dashboard/*` | 11 |

### Out-of-scope（明确排除，理由如下）

| Controller | 端点数 | 排除理由 |
|------------|--------|----------|
| `SmartBIConfigController` | 41 | 路径 `/api/mobile/smartbi-config/*` 无 `{factoryId}` 段，与 alias 模式不兼容；admin 配置类操作（intents/thresholds/templates 等），低 QPS，不是 Phase 2 性能目标受益者。留 Phase 3 单独项目。 |
| `SmartBIPublicDemoController` | 10 | 路径 `/api/public/smart-bi/*`，demo/营销用途，使用 demo 工厂数据无 RLS 敏感性，无客户端真实使用。永久保留 Java。 |

### 同时排除的功能边界

- Java SmartBI Controllers **不删除**——50 个 in-scope 方法保留作为回滚保险，nginx 路由切走后空闲（QPS=0）
- `PythonSmartBIClient.java` **不删除**——内部模块仍然可被其他 Java 业务调用（如 ArenaRL 之类，待 Phase 2D 评估）
- web-admin 已经直连的 23 个 Python 独有端点（`/api/excel/detect-regions` 等）继续走 `/smartbi-api/` proxy，不动

---

## 目标架构

```
当前(Phase 1 后):
   Web-admin / RN → nginx:139 → Java:10010 (内部调 Python via PythonSmartBIClient)

Phase 2A 后:
   Web-admin / RN → nginx:139
        ├ /api/mobile/{fid}/smart-bi/*      → Python:8083  ★ Phase 2A 新路径
        ├ /api/mobile/smartbi-config/*      → Java:10010   (Config 41 端点不动)
        ├ /api/public/smart-bi/*            → Java:10010   (Demo 10 端点不动)
        ├ /api/mobile/auth/*                → Java:10010   (auth 在 Java)
        └ /api/mobile/{fid}/<其他>          → Java:10010   (非 SmartBI 业务)
```

---

## 设计 1：端点性质审计（T0 任务）

**关键事实**：reviewer 审计发现，`SmartBIAnalysisController` 大量方法已经是 thin proxy 调 Python（通过 `PythonSmartBIClient`）。这意味着 alias 工作量取决于端点性质。

**T0 必须先做** —— 对 50 个 in-scope 端点逐个分类：

| 类别 | 定义 | 单端点 alias 工作量 |
|------|------|---------------------|
| **Y. Java thin proxy** | Java controller 内部调用 `PythonSmartBIClient.xxx()`，Python 已有内部端点 | ~30 分钟（路径别名 + schema 适配） |
| **X. Java native** | Java 调本地 service（DB 查询 + Java 业务逻辑），Python 无等价实现 | ~6-8 小时（Python 重新实现业务逻辑） |
| **Z. Java 条件分支** | Java 根据 query param（如 `dimension`）调不同 service | ~2-4 小时（Python 重写条件分支） |

T0 输出：`docs/superpowers/research/2026-04-28-smartbi-50-endpoints-classification.md`，按 X/Y/Z 列出 50 端点 + 工作量估算总和。**T5 实施顺序基于 T0 结果**：先做 Y 类（高密度低工作量）→ Z 类 → X 类（最复杂）。

---

## 设计 2：Python alias 模块结构

新增独立模块 `backend/python/smartbi_compat/`，与现有 `backend/python/smartbi/` 隔离：

```
backend/python/smartbi_compat/
├── __init__.py
├── api/
│   ├── __init__.py
│   ├── analysis.py          # 26 个 alias for /smart-bi/analysis/*
│   ├── upload.py            # 13 个 alias for /smart-bi/upload*
│   └── dashboard.py         # 11 个 alias for /smart-bi/dashboard/*
├── aggregator.py            # 类别 X 端点的内部聚合调用逻辑
├── auth.py                  # verify_jwt_and_factory dependency
└── schema_compat.py         # 响应 schema 对齐工具（字段名映射 / Decimal → float）
```

### Alias 实现模板

**类别 Y（thin proxy 直传）**：

```python
# smartbi_compat/api/upload.py
@router.post("/api/mobile/{factory_id}/smart-bi/upload-and-analyze")
async def upload_and_analyze(
    factory_id: str,
    file: UploadFile = File(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    # Java 端原本是 pythonClient.parseExcelViaAsync()，直接调对应 Python 端点
    return await excel_async.auto_parse_async(factory_id, file)
```

**类别 X/Z（聚合或条件）**：

```python
# smartbi_compat/api/analysis.py
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
async def sales_analysis(
    factory_id: str,
    dimension: Optional[str] = None,
    start_date: str = ...,
    end_date: str = ...,
    auth: AuthContext = Depends(verify_jwt_and_factory),
):
    # 复刻 Java 条件分支
    if dimension == "salesperson":
        return wrap_response({"ranking": await get_salesperson_ranking(...)})

    # 默认聚合：并发调 4 个 Python 子端点
    kpis, ranking, trend, region = await asyncio.gather(
        analysis_sales.get_kpis(factory_id, ...),
        analysis_sales.get_ranking_salesperson(factory_id, ...),
        analysis_sales.get_trend(factory_id, ...),
        analysis_sales.get_region_distribution(factory_id, ...),
    )
    return wrap_response({"kpis": kpis, "ranking": ranking, "trend": trend, "regionDistribution": region})

def wrap_response(data):
    """Java 响应外壳: {success, data, message}"""
    return {"success": True, "data": data, "message": "操作成功"}
```

### 关键设计原则

1. **响应 schema 严格对齐 Java**：字段名（如 `regionDistribution` 而非 `region_distribution`）、嵌套结构、外壳（`{success, data, message}`）完全一致 → contract test 强制验证
2. **聚合用 `asyncio.gather` 并发**：理论性能优于 Java 串行 ——但前提是 asyncpg pool 调大（见设计 4）
3. **不污染现有 Python 模块**：`smartbi_compat/` 独立目录，alias 逻辑只在此模块；现有 `/api/excel/*`、`/api/analysis/*` 等端点继续供 web-admin 23 个直连功能使用
4. **数值精度对齐**：Java `BigDecimal` 与 Python `Decimal/float` 转换时统一用 `float`，contract test 容忍 1e-6 误差

---

## 设计 3：JWT middleware（含 cross-factory bypass 修复）

### 实际算法 + payload（已确认）

- 算法：**HS256**（确认源：`backend/java/cretas-api/src/main/java/com/cretas/aims/util/JwtUtil.java:89`）
- Payload claims（camelCase）：`userId`, `factoryId`, `username`, `role`
- Secret 来源：`/www/wwwroot/cretas/.env.prod` 的 `JWT_SECRET`

### Python 实现

```python
# backend/python/auth_middleware.py 扩展
import jwt
from fastapi import Depends, HTTPException, Request

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

PRIVILEGED_ROLES = {"platform_admin", "platform_super_admin"}

async def verify_jwt_and_factory(
    request: Request,
    factory_id: str,  # 从 URL path 注入
) -> AuthContext:
    # 1. 提取 Bearer token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    token = auth_header[7:]

    # 2. 验证签名 + 过期
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    # 3. 跨工厂校验（修复 P1-1 bypass）
    token_factory = payload.get("factoryId")
    role = payload.get("role", "")

    if token_factory is None:
        # null factoryId token (移动端简化登录用) — 必须是高权限角色才能访问 SmartBI
        if role not in PRIVILEGED_ROLES:
            raise HTTPException(
                403,
                "Token without factoryId requires platform_admin role for SmartBI access"
            )
        # PRIVILEGED_ROLES 可访问任意 factory
    else:
        # 有 factoryId 的 token: 严格匹配 URL path
        if token_factory != factory_id:
            raise HTTPException(
                403,
                f"Cross-factory access denied: token factory={token_factory} vs URL factory={factory_id}"
            )

    return AuthContext(
        user_id=payload["userId"],
        username=payload["username"],
        factory_id=factory_id,  # 用 URL 的，避免歧义
        role=role,
    )
```

### 适用范围

- 仅适用于 `/api/mobile/{factoryId}/smart-bi/*` 这种 URL 含 `{factoryId}` 段的端点
- 如果未来 Phase 3 迁移 SmartBIConfigController（无 factoryId），需要单独的 `verify_jwt_admin_only` helper，本 spec 不涉及

### secret 同步部署

```bash
# /etc/systemd/system/cretas-python.service (现有)
# 加一行:
EnvironmentFile=/www/wwwroot/cretas/.env.prod
# Java 已经在用同一个文件，secret 自动一致

# /etc/systemd/system/cretas-python-test.service (Phase B-N 之前还是 nohup, 需要先 systemd 化或在 restart-test.sh 加 source .env.prod)
```

### PUBLIC_PREFIXES 不变

Java→Python 内部调用（`/api/llm/*`、`/api/internal/*` 等）继续走 PUBLIC_PREFIXES bypass（不要求 JWT），不动现有逻辑。**Phase 2A 新增端点不在 PUBLIC_PREFIXES 中**，强制走 `verify_jwt_and_factory`。

---

## 设计 4：Nginx 路由 + asyncpg pool 调整

### Nginx 配置（拆 SSE 独立 location）

```nginx
# 在 139 网关 nginx 配置中添加:

# (1) SSE 端点专用 location — proxy_buffering off
# 必须放在主 location 之前 (顺序敏感, 更具体的优先匹配)
location ~ ^/api/mobile/[^/]+/smart-bi/(dashboard/executive/insights/custom/stream|upload-batch-stream)$ {
    proxy_pass http://47.100.235.168:8083;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization $http_authorization;

    proxy_buffering off;          # SSE 必需
    proxy_cache off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}

# (2) SmartBI 主 location — 默认 buffering (修复 P0-2)
location ~ ^/api/mobile/[^/]+/smart-bi/ {
    proxy_pass http://47.100.235.168:8083;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization $http_authorization;

    client_max_body_size 300m;     # 大文件上传
    proxy_read_timeout 300s;       # 长查询
    # buffering: 默认开启 (不在此 location 关闭)
}
```

### Asyncpg pool 调整（修复 P1-2）

`backend/python/smartbi/config.py`:

```python
postgres_pool_size: int = Field(default=40, env="POSTGRES_POOL_SIZE")
# 原默认 5 → 40 (理论支持 10 并发用户 × 4 sub-call/请求)
```

systemd 服务文件添加：

```ini
Environment=POSTGRES_POOL_SIZE=40
```

重启 Python 服务后生效。Performance test（设计 5）必须验证 pool 不耗尽。

### Rollback 矩阵（修正 P1-4 误导）

之前 design 说 "注释 nginx location 即可 30 秒回滚" 不准确。**真实情况**：

| 端点类别 | nginx 回滚后 Java 能独立工作？ | rollback 后客户端体验 |
|----------|--------------------------------|------------------------|
| Analysis 26 个（多数 Java thin proxy 调 Python） | **不能独立** —— Java 内部仍调 Python | 仍可用，延迟回到 Phase 2 之前的 Java 阻塞水平 |
| Upload 13 个（Java 直接调 PythonSmartBIClient） | **不能独立** —— Java upload 必须 Python 在线 | 仍可用，效果同上 |
| Dashboard 11 个（部分有 Java 计算） | **部分可** | 仍可用，但 LLM 洞察类功能受 Python 影响 |

**结论**：nginx 回滚的真实意义是"把入口从 Python alias 切回 Java thin proxy"，而不是"恢复 Java 独立服务"。这是**安全 rollback**：客户端仍能用，性能回到 Phase 2 之前。**Python 服务仍是关键依赖**，rollback 不解除这一点。如果是 Python 端有缺陷，rollback 不能彻底解决，需要修 Python。

---

## 设计 5：测试验证策略（50 端点 contract test）

```
tests/python/smartbi_compat/
├── __init__.py
├── conftest.py                   # JWT token fixtures, factory fixtures
├── test_contract_compat.py       # 50 端点 schema 对齐
├── test_jwt_middleware.py         # 5 类 JWT 场景
├── test_alias_aggregation.py     # asyncio.gather + pool 不耗尽
└── test_smoke_e2e.py             # 端到端 (需 test 环境)
```

### Contract test 流程

1. **录制阶段（T2）**：在 test 环境用真实账号（`factory_admin1@F001`、`qhj_prod@RES_3101_009`）调 Java 50 个端点，保存为：
   ```
   tests/fixtures/java-smartbi-golden/
   ├── analysis-sales-F001.json
   ├── analysis-finance-F001.json
   ├── upload-and-analyze-F001.json
   ...
   ```
2. **对比阶段（T5/T7）**：Python alias 端点用同一 input，断言响应 schema 一致：
   ```python
   def test_sales_analysis_schema_match(client, golden):
       java_resp = golden["analysis_sales_F001"]
       py_resp = client.get("/api/mobile/F001/smart-bi/analysis/sales", headers={...}).json()
       assert_schema_compat(py_resp, java_resp, tolerate_numeric_eps=1e-6)
   ```
3. **断言粒度**：
   - Top-level keys 必须完全相等（`{success, data, message}` 外壳 + `data.kpis`、`data.ranking` 等子键）
   - 列表元素的字段集必须相等
   - Float 字段 1e-6 容忍
   - Null vs missing field 视为相等（容错）

### JWT middleware 5 类测试

```python
def test_missing_bearer_returns_401(client):
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales")
    assert r.status_code == 401

def test_expired_token_returns_401(client, expired_token):
    r = client.get("...", headers={"Authorization": f"Bearer {expired_token}"})
    assert r.status_code == 401

def test_cross_factory_returns_403(client, token_for_F001):
    r = client.get("/api/mobile/F002/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token_for_F001}"})
    assert r.status_code == 403

def test_null_factoryid_non_admin_returns_403(client, token_no_factory_no_admin):
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token_no_factory_no_admin}"})
    assert r.status_code == 403  # 修复 P1-1: null factoryId 非 admin 拒绝

def test_platform_admin_can_cross_factory(client, platform_admin_token):
    r = client.get("/api/mobile/F999/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {platform_admin_token}"})
    assert r.status_code == 200
```

### Performance test

- 每个 alias 端点 100 次请求，P50/P95/P99 记录
- Python alias P95 应 ≤ Java baseline P95（聚合用 gather 应更快）
- **Pool 压力测试**：连续 30 秒、20 并发请求 `/analysis/sales`（gather 4 sub-calls），观测 asyncpg `pool.get_size()`、`pool.get_idle_size()`，**不应有 wait queue 持续增长**

### E2E smoke test

```javascript
// tests/e2e-comprehensive/phase2a-smartbi-smoke.mjs
// 1. 登录 factory_admin1@F001 拿 token
// 2. 对 50 个 alias 端点逐个调 → 期望 200 + 非空 data
// 3. 对比关键字段与录制的 golden samples
// 4. 跨工厂访问 (F001 token → F002 URL) → 期望 403
// 5. null factoryId token (从移动端简化登录拿) → SmartBI 端点期望 403
// 6. 大文件上传 (50MB) → 期望成功 + 内容解析正常
// 7. SSE 流式洞察 → 期望连续 token 输出, 不被 nginx buffering
```

### 通过门禁（必须全过才允许切 prod nginx）

- ✅ 50 端点 contract test 100% 通过
- ✅ JWT 5 类场景通过
- ✅ E2E smoke 通过
- ✅ Performance test：P95 ≤ Java baseline + pool 不耗尽
- ✅ 真窗口验证：web-admin + RN test 包从 UI 操作 5 个核心场景无报错

---

## 设计 6：实施顺序 + 风险 + 工作量估算

### 实施 task 列表（10 个 task）

```
T0. 50 端点性质审计 (X/Y/Z 分类)
    ↓ 输出 docs/superpowers/research/2026-04-28-smartbi-50-endpoints-classification.md
T1. JWT 算法 + secret 同步方案验证
    ↓ HS256 + .env.prod 共享已确认; 仅需在 systemd 加 EnvironmentFile
T2. 录制 Java 50 端点 golden samples (test 环境)
    ↓ 输出 tests/fixtures/java-smartbi-golden/*.json
T3. Python JWT middleware 实现 + 5 类单元测试
    ↓ 新增 verify_jwt_and_factory + null factoryId 修复
T4. Asyncpg pool 调到 40 + Python smartbi_compat 模块脚手架
    ↓ 新增 backend/python/smartbi_compat/{api/,auth.py,aggregator.py,schema_compat.py}
T5. 实施 alias 端点 (基于 T0 分类, 分 3 批)
    T5a. analysis.py (26 端点) — 先 Y 类后 X/Z 类
    T5b. upload.py (13 端点)
    T5c. dashboard.py (11 端点)
    每批跑 contract test, 100% 过才进下一批
T6. nginx test 环境改造 (含 SSE 拆 location) + reload
    ↓ 改 139 nginx 配置, 加 2 个 location
T7. E2E smoke + Performance test (test 环境)
    ↓ 通过门禁 4 项验证
T8. 真窗口验证 (web-admin + RN test 包从 UI 操作)
    ↓ 5 个核心场景: 销售分析 / 财务报表 / 上传 Excel / Dashboard 洞察 / 跨工厂尝试
T9. nginx prod 改造 + 真窗口最终验证
    ↓ test 全过后才切 prod
```

### 风险登记

| ID | 风险 | 概率 | 影响 | 缓解措施 |
|----|------|------|------|----------|
| R1 | JWT 算法对不上 | **低** | 全部 401 | HS256 已审计确认 |
| R2 | Schema 漂移（字段名/嵌套不一致） | **高** | 前端报错 | T0 分类 + Contract test golden samples + 1e-6 数值容忍 |
| R3 | Asyncpg pool 耗尽 | **中** | 部分超时 | T4 pool 调到 40 + T7 perf test 验证 |
| R4 | Nginx regex 优先级冲突 | 低 | 路径错路由 | T6 `nginx -t` + 每条 route `curl` 验证 |
| R5 | Cross-factory null factoryId bypass | 已修复 | 数据泄漏 | T3 实现 + 单元测试覆盖 |
| R6 | Rollback 不是完全恢复（仍依赖 Python） | 已知 | 性能回到 Phase 2 前 | 接受；Python 是关键依赖（不是 nginx 切换能解决的） |
| R7 | T0 分类发现 Java native 端点比预期多 | 中 | 工作量超估 | T0 完成后重新校准 T5 估算 |

### 工作量估算

50 个端点 × 平均 3h ≈ 150h，按 X/Y/Z 假设比例（70% Y, 30% X/Z）：

```
50 × 0.7 × 0.5h  (thin proxy)     =  17.5h
50 × 0.3 × 6h    (native + 条件)   =  90h
JWT middleware + 5 类测试          =  16h
Asyncpg pool 调整 + 验证            =   4h
Nginx + E2E + perf test            =  16h
真窗口验证 + 修缺陷                  =  24h
─────────────────────────────────────
总计                               ≈ 167h ≈ 4-5 周（单人全职）
```

**T0 分类完成后才能给最终精确估算**。

### Phase 2A 阻塞条件

唯一阻塞：**T0 端点分类必须先完成**。如果 T0 发现 X 类（Java native）端点超过 50%（比预期多），整个 Phase 2A 工作量将翻倍至 8-10 周，需重新与 user 确认 scope。

### Phase 2B/C/D 轮廓（不在本 spec 范围）

```
Phase 2B (3 周): NL Query + Drill-down + Upload 链 (~6 端点 native 实现)
   关键 task: 把 Java 18 个 "Python 没有" 端点逐个审计
              (本 spec 不解决, 留 Phase 2B brainstorm)
   核心补:
     - /query (NL→意图→SQL→结果)
     - /drill-down
     - /upload/confirm + /retry-sheet/{id}
     - /uploads/{id}/data preview

Phase 2C (4 周): Dashboard SSE Insights + Recommendations + Alerts
   核心补:
     - /dashboard/executive/insights/custom/stream (SSE)
     - /recommendations
     - /alerts

Phase 2D (1 周): Query Template CRUD (4 端点) + 清理
   - 直接 Python 端点 + DB CRUD
   - 删除 Java 5 个 SmartBIController + PythonSmartBIClient.java

总 Phase 2 估算: 4-5 + 3 + 4 + 1 ≈ 12-13 周
```

---

## 不迁移的部分

| 模块 | Phase 2A 处理 |
|------|---------------|
| `SmartBIConfigController` (41 端点) | 留 Java，Phase 3 单独项目 |
| `SmartBIPublicDemoController` (10 端点) | 永久保留 Java |
| `PythonSmartBIClient.java` | 暂留（其他 Java 业务可能仍调）。Phase 2D 评估是否删除 |
| Java SmartBI Controllers 50 个 in-scope 方法 | Phase 2A 完成后保留作为回滚保险，Phase 2D 完成后才删 |
| web-admin 已直连的 23 个 Python 独有端点 | 不动，继续走 `/smartbi-api/` |

---

## 验收标准

Phase 2A 算完成的标准：

1. ✅ T0 完成：50 端点分类报告出炉
2. ✅ T3-T5 完成：Python smartbi_compat 模块上线，50 alias 端点 contract test 100% 通过
3. ✅ T6-T7 完成：test 环境 nginx 切换 + 4 项通过门禁全过
4. ✅ T8 完成：真窗口验证 5 个核心场景无报错
5. ✅ T9 完成：prod nginx 切换 + 真窗口最终验证通过
6. ✅ 监控指标：Java SmartBI 50 个 in-scope 端点 QPS 跌至 0，Python `/api/mobile/{fid}/smart-bi/*` QPS 上升

---

## 附录：决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Scope | 一刀切 web + RN | test 环境先验证，prod 切换前已 4 项门禁全过 |
| JWT 方案 | A. Python 共享 secret 独立验证 | Phase 2 核心动机是去 Java 阻塞，B/C 把 Java 留在热路径上违背初衷 |
| 子阶段拆分 | C. Phase 2A/2B/2C/2D | 18 个 Python 缺失端点工作量大，分阶段先拿 web-admin 收益 |
| 路径映射方案 | Python 加 alias 路由 | 前端零改动，nginx 简单 prefix 匹配即可 |
| Java SmartBI 删除时机 | Phase 2D 完成后统一删 | 保留 50 in-scope Controller 作为回滚保险 |
