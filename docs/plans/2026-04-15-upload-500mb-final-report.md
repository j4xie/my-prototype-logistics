# Upload 500MB 全链路深度 E2E — Final Report

**Dates**: 2026-04-14 ~ 2026-04-15
**Branch**: `e2e/v1-framework`
**Final commit**: `c97f6d0ef`
**Spec**: depth-first-e2e skill Rule 1-7, `docs/plans/2026-04-14-upload-500mb-depth-e2e-plan.md`
**Scope**: 餐饮 SmartBI 上传特性（从 10MB 限提到 500MB + CSV 支持）

---

## 1. 最终成绩

| 指标 | 值 |
|---|---|
| **总测试数** | 25 |
| **PASS** | 25/25 |
| **FAIL** | 0 |
| **WARN** | 0 |
| **smoke** | 7 |
| **medium** | 12 |
| **真 deep** | **6** |
| **pctOfSpec** | 100% |
| **pctDeep** | **24%** (skill §8.2 建议 ≥20%, 达标) |

---

## 2. 轮次与 Critic 审计轨迹

| 轮次 | 产出 | Critic 判决 | 关键修复 |
|---|---|---|---|
| R1 v1 | 10/10 形式通过 | **BLOCK** | canary 假绿, L4 section=skipped 未证 auto-resolve, L3-1 parse-failed 当 PASS |
| R1 v2 rework | 4 FAIL | 继续修 | BUG-2 OOM + 深度压缩为 medium+ |
| R1 final | 10/10 真绿 | APPROVE | `autoResolve.loaded && uploadIdMatches` 三重门控 |
| R2 v1 | 6/6 | APPROVE_WITH_CHANGES | depth 虚高 (3 deep → 实际 1); L4-2 自证预言种子 |
| R2 truth | 6/6 诚实 | 接受 | 降级 L4-2/REG-1 → medium, L3-3 真幂等 |
| R3 v1 | 5/5 | APPROVE_WITH_CHANGES | L4-2 自证预言真发生 (dirty data 含 "bad" → body echo "bad" → regex 命中) |
| R3 truth | 5/5 诚实 | 接受 | 纯数字列 + `status/warnings` 断言 |
| R4 v1 | 4/4 | APPROVE_WITH_CHANGES | chat 端点 intent=null 仍 PASS (message fallback) |
| R4 truth | 4/4 诚实 | 接受 | 字段名真相 (`intent` 不是 `intentCode`), chatElapsedMs 35s 证真 LLM 运行 |

**4 轮 Critic 审计，4 轮都发现问题，4 轮都真修**。

---

## 3. 真 bug 发现列表

| # | Bug | 发现轮 | 状态 |
|---|---|---|---|
| BUG-1 | Java `SmartBIUploadFlowServiceImpl` 不接受 CSV（仅 xlsx/xls） | R1 v1 | ✅ 修 (接受 `.csv`) |
| BUG-1.2 | Python `StructureDetector.detect()` 用 openpyxl → CSV 崩 | R1 rework | ✅ 修 (csv_passthrough 分支) |
| BUG-1.3 | Python `FixedExecutor.execute_with_pandas()` 下游 context_extractor 也用 openpyxl | R1 rework | ✅ 修 (CSV 跳过 context 提取) |
| BUG-2 | Java `PythonSmartBIClient.parseExcel` 用 `file.getBytes()` → 60MB CSV OOM | R1 rework (L4 500 tracking code) | ✅ 修 (streaming temp File + file-size-threshold=1MB) |
| BUG-2.2 | Java 500k 行持久化时 heap OOM (concurrent session 补 batch+flush) | R1 rework | ✅ 修 (commit a237cda1c) |
| BUG-3 | `restaurant_sections.py` 的 auto-resolve import 名错（silent except 吞掉） | R1 rework (deep 新加的 autoResolve.reason 揪出) | ✅ 修 (`get_db_session`→`get_db`, `ExcelUploadRepository`→`UploadRepository`) |
| Deploy | Blue-Green 切换的 `.env.prod` 不被新 service 读取 | R1 rework | ✅ 修 (inline Environment=) |
| Deploy | Nginx `client_max_body_size` 默认 100m | R1 setup | ✅ 修 (3 处改 500m) |

**共 8 个真 bug 修复**，均通过 E2E depth 测试揪出。

---

## 4. 代码路径覆盖矩阵

| 维度 | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| 500MB 配置 5 层 | ✅ L1-1..5 | | | |
| xlsx + CSV + uppercase | ✅ | ✅ L3-2 | | |
| 3 个 restaurant sections | ✅ diagnostics | ✅ temporal_comparison + menu_engineering | ✅ temporal via CSV | |
| 跨租户 canary 隔离 | ✅ L4-1 | | | |
| 幂等双上传 | | ✅ L3-3 | | |
| 文件大小拒绝 (501MB) | | | ✅ L3-1 | |
| Auth 缺失拒绝 | | | ✅ L3-2 | |
| 脏数据 handler 信号 | | | ✅ L4-2 deep | |
| autoResolve loaded + uploadId match | ✅ deep | ✅ medium×2 | ✅ L4-1 deep | ✅ L4-1/L4-2 |
| 无数据优雅处理 | | | | ✅ L3-1 |
| **并发上传竞态 + 内容完整性** | | | | ✅ **L4-1 deep** |
| **Chat NL pipeline (真 LLM 35s)** | | | | ✅ **L4-2 deep** |

---

## 5. 真 deep 清单（6 条）

| # | 测试 ID | 核心断言 |
|---|---|---|
| 1 | R1-L4-1 | xlsx 42MB → /upload-and-analyze 200 + uploadId + targetDelta=1 + canaryDelta=0 (platform_admin) + autoResolve.loaded + diagnostics section 200 |
| 2 | R2-L4-1 | xlsx → temporal_comparison section autoResolve.loaded + uploadIdMatches |
| 3 | R3-L4-1 | 55MB CSV → temporal_comparison + autoResolve.fileName=.csv + handlerInvoked |
| 4 | R3-L4-2 | 脏 xlsx（纯数字列 xyz_a..c）→ section 返回 status=skipped + warnings[] 非空（handler 真行为，非 echo） |
| 5 | R4-L4-1 | 2 并发上传 → distinct uploadIds + DB totalElements +2 + rowCounts 对称（无 cross-contamination） |
| 6 | R4-L4-2 | upload → chat NL "成本刚性" (35s 真 LLM) → responseText >50 字符 + elapsedMs >200ms（非静态模板） |

---

## 6. 基础设施遇到的非特性问题（记录，已绕过）

1. **Home ISP 上传慢** — 42MB 浏览器 UI 上传需 5-8 分钟。采用 scp+server-local-curl 模式绕过。
2. **Windows Git Bash quote-nesting** — ssh+bash 嵌套引号不可靠。采用 scp script + ssh bash 模式。
3. **Blue-Green 服务名动态变化** — `cretas-backend` ↔ `cretas-backend-green`。getActiveJavaService 动态发现。
4. **listUploads 分页** — content[] 默认 50 条上限。使用 `totalElements` 获取真 DB count。
5. **execSync maxBuffer** — upload-and-analyze 响应 preview 超 1MB。bump 到 50MB。

---

## 7. 已知限制（诚实记录）

1. **600s 超时 ISP 路径**：家用 ISP 对 42MB+ 浏览器上传不可靠。所有 R4+ deep 改用 server-local scp+curl，UI 浏览器上传链路**未做完整 E2E**（浏览器选择文件 → handleUpload → uploadAndAnalyze 全部是 R2 认为的"可降级为 R2 补丁"）。
2. **Intent matching 对 "分析经营诊断" 不命中**：R4 探索发现。"成本刚性" 直接 regex 匹配 SmartBIServiceImpl 命中。NL fuzzy-match 不强是已知。
3. **"跨租户权限漏洞"探测不足**：L3-1 的未知 factoryId 测的是"不存在就返回空集"，未测"存在但无权限"的 leak 场景。需要更严格的 RBAC 测试套件。

---

## 8. 结论

**特性真实交付状态**: ✅ 可交付

- 500MB 上限在 5 层（FE bundle + Nginx + Java multipart + Python FastAPI + systemd env）全部生效
- xlsx + CSV 全链路（上传 → Java multipart → Python parse → persist → auto-resolve → restaurant sections）都能走通
- 并发安全、幂等、跨租户隔离、脏数据处理、auth 控制、无数据优雅都有真实 deep 测试覆盖
- 过程修掉 8 个真 bug，pctDeep 24% 达标且每条 deep 都经 Critic 严审

**不适合立即交付的地方**:
- 浏览器 UI 上传链路的 42MB+ E2E（客户端 ISP 限制，非特性 bug）
- NL intent matching 对"分析经营诊断"类查询的 fuzzy match 改进（需要单独一轮 intent 工作）

**Critic 4 轮审计的方法论收获**:
1. pctDeep 数字容易虚高 — depth 标签要按 skill §12-step 严格校对
2. pass 条件常引入自证循环（body echo 测试数据）— 断言 handler **产物** 而非测试**输入**
3. 兜底条件（"any message exists"）等同 smoke — 必须要求具体业务字段
4. "新 smoke 碰未覆盖代码" 不等于 deep — deep 必须有 click/submit/delta/roundtrip 完整链

---

**Files changed**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java` (streaming temp File + guessMimeFromName)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIUploadFlowServiceImpl.java` (accept .csv)
- `backend/java/cretas-api/src/main/resources/application*.properties` (4 files, 500MB + file-size-threshold)
- `backend/python/smartbi/api/excel.py` (csv_passthrough in /auto-parse)
- `backend/python/smartbi/api/restaurant_sections.py` (auto-resolve + metadata echo)
- `backend/python/smartbi/services/fixed_executor.py` (csv_passthrough branch)
- `web-admin/src/views/smart-bi/ExcelUpload.vue` (500MB limit + CSV accept)
- `tests/e2e-comprehensive/e2e-upload-R{1,2,3,4}.mjs` (4 test rounds)
- `tests/e2e-comprehensive/results/e2e-upload-R{1,2,3,4}.json` (evidence)
- `tests/e2e-comprehensive/scripts/gen-upload-fixtures.mjs`
- `tests/e2e-comprehensive/lib/upload-helpers.mjs`
- Nginx: `/www/server/panel/vhost/nginx/web-admin.conf` (500m, 3 locations)
- systemd: `cretas-backend[-green].service` (inline MULTIPART env), `cretas-python.service` (MAX_FILE_SIZE_MB=500)
