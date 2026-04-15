# Upload 500MB 全链路深度 E2E 测试计划

**日期**: 2026-04-14
**分支**: `e2e/v1-framework`
**特性 commit**: `72f9d5d4e` — fix(upload): 50MB → 500MB + CSV 支持
**Spec**: depth-first-e2e skill §Rule 1-7 + §1.3 硬规则 + §8.2 数值门槛
**执行方式**: 3 轮闭环 (Plan → Audit → Execute → Audit results → Fix → Re-verify)

---

## 1. 测试对象 (Scope)

本次测试 **不是** SmartBI 全量回归，**只**围绕 "Upload 上限 10MB→500MB + CSV 支持" 这一个改动，做 **全链路深度验证**：

```
浏览器前端 (ExcelUpload.vue, 500*1024*1024 拦截)
   ↓
Nginx 139:8086 (client_max_body_size 500m)
   ↓
Java Spring Boot 47:10010 (SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE=500MB)
   ↓
Python FastAPI 47:8083 (MAX_FILE_SIZE_MB=500)
   ↓
PostgreSQL smartbi_prod_db (excel_uploads + dynamic_data)
   ↓
Chat 管线 (POST /smart-bi/query, auto-resolve upload → cost_rigidity)
```

**5 个层都要验证**，任何一层用旧限制都会让深度测试失败。

---

## 2. 硬规则 (Rule 1 — depth 标签强制)

每条测试必须带 `depth` 字段。本次三档定义：

| depth | 本测试中的判定 |
|---|---|
| **smoke** | 只看 URL/DOM/JS bundle 字符串 — 不上传文件 |
| **medium** | 上传 ≤50MB 文件 + API 200 + 获取 upload_id — 不查详情也不跑 chat |
| **deep** | 上传 > 旧上限 (60MB+) + API 200 + toast + excel_uploads 表 +1 + chat 能查该 upload 的业务数据 |

**60MB 是关键阈值**：旧配置 50MB 会 413 挡死，新配置 500MB 必须放行。这就是唯一能证明"配置真的改对了"的动作。

---

## 3. 三轮闭环 (Round design)

### R1 — Baseline (证明全链路配置真的生效)

**目标**: 证明 60MB CSV 上传在 5 个层都通过，并被 chat 管线消费。

| ID | Layer | 动作 | depth | 通过条件 |
|---|---|---|---|---|
| **R1-L1-1** | 前端 | 打开 `/smart-bi/upload` | smoke | 页面渲染 + `.upload-card` 可见 |
| **R1-L1-2** | 前端 bundle | grep 线上 `ExcelUpload-*.js` | smoke | 含 `超过 500MB` 字符串 |
| **R1-L1-3** | Nginx 配置 | ssh grep `client_max_body_size` | smoke | 3 处全是 `500m` |
| **R1-L1-4** | Java 运行时 | `cat /proc/.../environ \| grep MULTIPART` | smoke | `500MB` 在进程 env |
| **R1-L1-5** | Python 运行时 | `cat /proc/.../environ \| grep MAX_FILE_SIZE_MB` | smoke | `500` 在进程 env |
| **R1-L2-1** | 前端校验 | JS 注入 mock 450MB File | medium | `beforeUpload` 返回 true |
| **R1-L2-2** | 前端校验 | JS 注入 mock 501MB File | medium | `ElMessage.error('文件大小不能超过 500MB')` 触发 |
| **R1-L2-3** | 前端校验 | JS 注入 mock 10MB CSV | medium | 通过扩展名校验，不再被挡 |
| **R1-L3-1** | Java upload API | `POST /api/smartbi/excel/upload` **55MB xlsx** (跨越旧 50MB 限制) | medium | 返回 200 + `uploadId` — **失败即证明 Java 配置未生效** |
| **R1-L3-2** | Python upload API | `POST /api/smartbi/excel/upload` **55MB CSV** (跨越旧 50MB 限制) | medium | 返回 200 + 解析行数 > 0 — **失败即证明 Python 配置未生效** |
| **R1-L4-1** 🔥 | **全链路** | 真浏览器上传 **60MB CSV** → chat 查询 cost_rigidity → 读取返回数据 | **deep** | 见下方 deep 模板 |

**R1-L4-1 Deep 模板** (Rule 1 的 12 步必经 + 跨租户隔离 — Critic 2026-04-14 审计补充)：

1. `navigateTo('/smart-bi/upload')` — 真实路由 (非 router.push)
2. 记录 baseline (双断言):
   - `targetBefore = SELECT COUNT(*) FROM excel_uploads WHERE factory_id='F_DEMO'`
   - `otherBefore = SELECT COUNT(*) FROM excel_uploads WHERE factory_id != 'F_DEMO'`
3. 客户端合成 60MB CSV：50 万行 POS 流水 (`order_id, store_id, dish, amount, pay_time`)，sha256 记录留证
4. `fileInput.setInputFiles(...)` 触发 ElUpload
5. `waitForResponse('**/excel/upload', {timeout: 120000})` → `apiStatus === 200`
6. `await page.waitForSelector('.el-message--success')` → `toastText`
7. `const uploadId = response.data.uploadId` 记录
8. DB 双断言 (跨租户隔离):
   - `targetAfter === targetBefore + 1` — 自己工厂 +1
   - **`otherAfter === otherBefore` — 其他工厂计数**严格**不变 (防止 factory_id 错写 / 泄漏)**
9. DB 验证: `SELECT COUNT(*) FROM dynamic_data WHERE upload_id=:id AND factory_id='F_DEMO'` → `> 400000`
10. 跳转 `/smart-bi/chat`，输入 "分析成本刚性" (命中 `cost_rigidity`)
11. `waitForResponse('**/smart-bi/query')` → `apiStatus === 200` + `response.data.sectionName === 'cost_rigidity'`
12. 验证返回含 `rigidity` 数值字段 (业务语义校验) + `response.data.factoryId === 'F_DEMO'` (返回数据 factory 一致性)

**R1-L4-1 失败会意味着什么**：
- 前端 bundle 没拿到 500MB 新值 → 第 2 步拦截
- Nginx 没 reload → 第 5 步 413
- Java 没读取 env → 第 5 步 413 / MultipartException
- Python 没读取 env → 第 5 步 413 或 ContentTooLargeError
- DB auto-resolve 未启用 → 第 11 步 `pos_df is None` 导致 SKIP

**R1 目标**: L4 deep ≥ 1 (本轮贡献 1 条 R1-L4-1)。

---

### R2 — Edge cases + 1 new deep

**目标**: 边界值 + 负面路径 + xlsx 深度一条。

| ID | Layer | 动作 | depth | 通过条件 |
|---|---|---|---|---|
| **R2-L2-1** | 前端文案 | `ElMessage` 截屏含 `500MB` | smoke | OCR / innerText 匹配 |
| **R2-L2-2** | 前端 MIME | CSV MIME `text/csv` 通过 | medium | beforeUpload 返回 true |
| **R2-L2-3** | 前端扩展名 | `.CSV` (大写) 通过 | medium | 触发 `toLowerCase()` 分支 |
| **R2-L3-1** | Nginx | `curl -X POST` 300MB body | medium | 不 413 |
| **R2-L3-2** | Java multipart | 300MB xlsx (不走解析) `/upload` | medium | 200 (不 MaxUploadSizeExceededException) |
| **R2-L3-3** | Python multipart | 300MB CSV | medium | 200 (不 ContentTooLargeError) |
| **R2-L4-1** 🔥 | **全链路** | 真浏览器上传 **120MB xlsx** (5 sheet 餐饮数据) → chat 查询 `menu_engineering` → 验证返回含 stars/plowhorses 分类 | **deep** | deep 模板 12 步 |
| **R2-L4-2** 🔥 | **全链路** | 真浏览器上传 **80MB CSV** (2 年跨期数据) → chat 查询 `temporal_comparison` → 验证 yoy 同比字段 | **deep** | deep 模板 12 步 |

**R2 目标**: 新增 deep ≥ 1 (本轮贡献 2 条 R2-L4-1 / R2-L4-2)。

---

### R3 — Regression + negative deep

**目标**: 负面路径深度 + 回归 R1 的 deep。

| ID | Layer | 动作 | depth | 通过条件 |
|---|---|---|---|---|
| **R3-L2-1** | 前端负面 | 上传 **501MB** 本地合成文件 | medium | 被前端拦截，不发起网络请求 |
| **R3-L3-1** | Nginx 配置 | ssh 直验 `nginx -T \| grep client_max_body_size` (3 处 500m) | smoke | 全是 500m |
| **R3-L3-2** | Java multipart 配置 | `@SpringBootTest` + `MockMultipartFile(600MB)` 触发 `MaxUploadSizeExceededException` | medium | 异常类型正确 + 消息含 500MB |
| **R3-L3-3** | Python multipart 配置 | `pytest` + mock 600MB UploadFile → FastAPI 拒绝 | medium | HTTPException 413 |
| **R3-L4-1** 🔥 | **前端负面全链路** | 真浏览器构造 **501MB File 对象** → `fileInput.setInputFiles` → 捕获 `.el-message--error` 含 `不能超过 500MB` → **断言 `networkRequests.filter(r => /\/excel\/upload/.test(r.url)).length === 0`** (不是只验 DB +0，防止"前端放行但 backend 拦截"误判) → DB `excel_uploads` countAfter === countBefore | **deep** | deep 模板 12 步 (adapted: list +0 而非 +1, 网络零请求作为主断言) |
| **R3-REG-1** | 回归 | 重跑 R1-L4-1 | deep | 所有 12 步通过 |
| **R3-REG-2** | 回归 | 重跑 R2-L4-1 | deep | 所有 12 步通过 |

**R3 目标**: 新增 deep ≥ 1 (本轮贡献 R3-L4-1 负面 deep)。

---

## 4. Depth 汇总目标 (spec §8.2 numeric)

| 指标 | R1 | R2 | R3 | 累计 |
|---|---|---|---|---|
| total | 10 | 8 | 7 | 25 |
| smoke | 5 | 1 | 1 | 7 |
| medium | 4 | 5 | 3 | 12 |
| **deep** | **1** | **2** | **3** | **6** |
| 累计 deep % | 10% | 20% | 24% | **24%** |

**Pass 目标**: `pctOfSpec ≥ 90%` AND `pctDeep ≥ 20%` (R3 结束时)。
**Hard floor**: 每轮 `deep ≥ 1` (Rule 2)。

---

## 5. 测试资产准备 (pre-work)

| 资产 | 大小 | 生成方式 | 保存位置 |
|---|---|---|---|
| `fixtures/pos_55mb.csv` | ~55 MB | Python: 45万行 POS 流水 — R1-L3-1/L3-2 medium (跨旧50MB) | `tests/e2e-comprehensive/fixtures/` |
| `fixtures/pos_55mb.xlsx` | ~55 MB | openpyxl 版 — R1-L3-1 Java 直验 | 同上 |
| `fixtures/pos_60mb.csv` | ~60 MB | Python: 50万行 POS 流水 — R1-L4-1 deep | 同上 |
| `fixtures/menu_120mb.xlsx` | ~120 MB | Python + openpyxl: 5 sheet × 20万行 | 同上 |
| `fixtures/temporal_80mb.csv` | ~80 MB | Python: 2 年跨期日期 + 门店 | 同上 |
| `fixtures/oversize_501mb.csv` | ~501 MB | dd if=/dev/urandom | 临时, 不入 git |
| ~~`fixtures/oversize_520mb.csv`~~ | ~~520 MB~~ | **降档** → 本地合成 501MB 即可触发前端 `> 500*1024*1024` 拦截 | 同上 |
| ~~`fixtures/huge_600mb.bin`~~ | ~~600 MB~~ | **降档** → 只留 `oversize_501mb.csv` 做负面, Nginx/Java/Python 的 413 改用 Java 单测直验 multipart 配置 | 同上 |

**降档理由 (用户 2026-04-14 批准)**: 520/600MB 跨 ISP 上传单次 5+ 分钟且 R3 需多次重跑，把"真发 >500MB 到服务器"的动作压缩为 "501MB 前端拦截" 一条 deep 测试；"服务器拒绝 > 500MB"降级为 R3-L3-x medium (用 curl 直发 100KB 但 `Content-Length` 伪造 600MB 头部触发 Nginx 早期拒绝，或通过 Java `@SpringBootTest` + `MockMultipartFile(600MB)` 直验配置)。

**.gitignore**: 所有 > 10MB 固定件都不进 git，跑前用 `tests/e2e-comprehensive/scripts/gen-upload-fixtures.mjs` 本地生成。

---

## 6. 工具与 helper 要求

基于 depth skill §"Correct patterns"，本次新增 / 复用：

- `helpers.mjs::fillDialogInput` (已有)
- `helpers.mjs::waitForDialog` (已有)
- **新增** `helpers.mjs::uploadFileToElUpload(page, selector, filePath)` — 兼容 ElUpload 隐藏 input
- **新增** `helpers.mjs::countExcelUploadsFromDb(factoryId)` — 通过 Python `/api/smartbi/excel/uploads?factory_id=` 获取
- **新增** `helpers.mjs::chatQueryAndWait(page, userInput, sectionExpected)` — 走 chat UI + 等待 `/smart-bi/query` 返回

**禁用** `body.innerText.includes` 做业务校验 — 只能做 smoke 判定 (§"Bug patterns" Pattern 3)。

---

## 7. 每轮闭环流程 (Rule §7)

1. **① 自审计 (Plan)** — 本文档就是 R1-R3 的 plan
2. **② Agent 独立审计** — 启动 `agent-team` Critic 按 Rule 5 检查本计划的 depth 分布
3. **③ 修复计划** — 根据 Critic 反馈调整 (如需)
4. **④ 执行** — 写测试 + 跑 headful Playwright
5. **⑤ 结果审计** — 输出 Depth Analysis block (Rule 3 格式)
6. **⑥ 修 bug** — 任何 deep FAIL 必须当轮修
7. **⑦ 验证修复** — 重跑对应 deep 测试

---

## 8. 结果 schema (Rule 7 严格格式)

```json
{
  "round": 1,
  "schema_v3": {
    "specTotal": 10,
    "p2Deferred": [],
    "expectedFail": [],
    "effectiveTotal": 10,
    "actualExecuted": 10,
    "actualPass": 10,
    "depthBreakdown": { "smoke": 5, "medium": 4, "deep": 1 },
    "pctOfSpec": 100.0,
    "pctDeep": 10.0
  },
  "bugDiscovery": {
    "canCatchBackend500": 1,
    "canCatchFrontendCrash": 1,
    "realBugsFound": []
  },
  "evidence": {
    "R1-L4-1": {
      "filled": "pos_60mb.csv",
      "fileSize": 62914560,
      "sha256": "...",
      "apiStatus": 200,
      "apiUrl": "http://47.100.235.168:10010/api/smartbi/excel/upload",
      "toastText": "上传成功",
      "uploadId": 1234,
      "rowsBefore": 15,
      "rowsAfter": 16,
      "delta": 1,
      "dynamicDataRows": 500000,
      "chatSection": "cost_rigidity",
      "chatDataKeys": ["rigidity", "stores", "breakdown"]
    }
  }
}
```

---

## 9. Red flag 自检 (Rule 4)

本文档已通过以下自检：

- [x] 不含 "deferred to next round" / "下一轮做"
- [x] 每轮至少 1 条 `depth: 'deep'`
- [x] Deep 测试覆盖 5 个层 (前/Nginx/Java/Python/DB+Chat)
- [x] Report 使用 spec-denominator (不是 script-denominator)
- [x] L4 deep 测试会在 backend API 500 / frontend 崩溃 / 业务 bug 三种情况下 FAIL
- [x] `hasFormField` / `text.includes('关键字')` 等 facade 模式 **不**在 deep 评分项

---

## 10. 与用户的交接点 (escalate points)

以下情况停下来问用户，不自己决定：

1. **Fixture 生成耗时过长**：520MB CSV 本地合成 + 上传经过国内 ISP 可能 > 5 分钟 → 提议换 300MB
2. **Spec §1.3 vs §8.2 冲突**：如果 20% deep 目标要求合成 10+ 个 100MB 级文件 → 提议调整 deep 目标或改用 Java 单测直验 multipart
3. **R3 负面 deep 需要"挑战 Nginx"**：520MB curl 直发可能触发 aliyun 安全组或 WAF → 提议先在本机走 SSH tunnel
4. **任何深度测试 FAIL 根因指向新 bug**：按 Rule 6，优先 BLOCK 该轮并升级

---

## 11. 预期总工作量

| 阶段 | 预计命令/步骤数 |
|---|---|
| Fixture 生成脚本 | 1 个 mjs 脚本，3 个文件 |
| Helper 新增 | 3 个函数 (~80 行) |
| R1 测试代码 | ~300 行 mjs |
| R2 测试代码 | ~250 行 |
| R3 测试代码 | ~200 行 |
| 每轮执行时长 | 5-10 分钟 (取决于 60-120MB 上传网速) |
| 每轮审计 | 1 次 agent-team critic |

---

**下一步**: 用户审阅本计划 → 若认可，进入 R1 执行 (写 helper + fixture + R1 测试 → 跑 → 审计结果)。

---

## 12. Critic 独立审计记录 (Rule §7 步骤 ②)

**审计时间**: 2026-04-14
**审计者**: depth-first-e2e Critic (Rule 5 强制 depth 质询清单)
**判决**: **APPROVE_WITH_CHANGES**

### Rule 5 五题答卷 (摘要)
1. Depth 分布: R1 5/4/1 · R2 1/5/2 · R3 1/3/3 · 累计 7/12/6. 每轮 deep ≥ 1 ✅
2. Backend 500 探测: 3 条 deep 的 API 断言会捕获 (R3-L4-1 例外, 因是前端拦截测试)
3. 新深度贡献: R2 两条 deep 走不同解析路径 (openpyxl vs pandas) + 不同 chat tool, 是**真 deep**不是平凡扩展
4. 每轮 ≥1 新 deep: R1=1, R2=2 new, R3=1 new + 2 regression ✅
5. Smoke padding: R1 有 5 条 smoke (config grep 类), 但每条对 "部署漂移早期信号" 有独立价值 (前端 bundle 未 rebuild / nginx 未 reload / systemd env 未注入 — 历史有过), **不是纯凑数**

### 3 条修改已应用
1. ✅ **R1-L4-1 加跨工厂隔离断言** (第 2/8 步): 不只查目标 +1, 也查其他工厂不变 — 防跨租户泄漏 bug 绿灯溜过
2. ✅ **R3-L4-1 明确 "网络面板零 /excel/upload 请求"**: 区分"前端拦截"vs"前端放行但 backend 拦截"
3. ✅ **R1-L3-1/L3-2 升档 55MB**: 原 10MB 不能证明 "旧 50MB 被解除", 现在跨越旧限制 10MB, 失败即证配置漂移

### Critic 的最严厉问题 (已修复)
> "R1-L4-1 的 factory_id 过滤只查了目标工厂的计数增量, 没查其他工厂的计数不变 — 一旦 Python auto-resolve 在 chat 管线误把新 upload 暴露给全局或错误工厂, 这份深度计划会给出绿灯, 跨租户数据泄漏会以 '全部 PASS, 1 个 bug 未发现' 的形态溜过去。"

修复：R1-L4-1 第 2 步改为 `targetBefore + otherBefore` 双记录，第 8 步改为 `targetAfter === targetBefore + 1 AND otherAfter === otherBefore` 双断言；第 12 步加 `response.data.factoryId === 'F_DEMO'` 返回数据 factory 一致性。

### 未修复项
- **Fixture 降档后的"真发大 body 到服务器"覆盖缺失**: Critic 评估"本次改动 scope 下收益低 (Nginx/Java/Python 三处配置都是静态常量), 降档合理" — 接受现状, 但记录为已知 gap。
