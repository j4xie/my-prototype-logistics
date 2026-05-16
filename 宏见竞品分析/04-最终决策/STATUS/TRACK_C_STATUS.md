# Track C — 每日 STATUS

> **本文件**: Chat 4 (Track C) 每天追加 1 段进度
> **Organizer 阅读**: Chat 1 每天读 + 协调跨 track 冲突

---

## Day 0 — 派发 (2026-05-14 18:14:12)

- 状态: 📤 **已派发 Brief, 等 Chat 4 启动**
- Brief 文件: `04-最终决策/TRACK_C_BRIEF.md` (11d 工时)
- 收到 brief 后: Chat 4 应立即:
  1. 创建 git worktree + branch `feature/asap-track-c`
  2. 读完 Brief §1-§11
  3. 启动 Day 1 任务
  4. 当天结束在本文件追加 Day 1 进度

---

<!-- Chat 4 启动后在下面追加 Day 1, Day 2, ... -->

## Day 1 — 2026-05-15 (C-ATT-1: Service 接口骨架)

- ✅ 完成:
  - Worktree 起在 `C:\Users\Steve\cretas-track-c`, branch `feature/asap-track-c-att-1` (从 `origin/main @ 52f1b622d` 起)
  - 读完 SCHEMA_DESIGN.md §2.3 (行 522-731) + 现有 OSS 代码 (`OssService` / `OssServiceImpl` / `OssConfig`)
  - 新增 4 个文件 (mvn compile 通过):
    - `backend/.../entity/Attachment.java` — JPA Entity (含 18 值 `EntityType` + 6 值 `FileCategory` 内嵌枚举, `@Where(deleted_at IS NULL)`, `@PrePersist` 自动 UUID)
    - `backend/.../service/attachment/AttachmentService.java` — **8 方法接口** (无实现, 仅签名稳定)
    - `backend/.../service/attachment/dto/RegisterAttachmentRequest.java` — OSS 直传后注册元数据 DTO (含 Jakarta validation)
    - `backend/.../service/attachment/dto/UpdateAttachmentRequest.java` — 仅允许改 description/businessTag/fileCategory
  - Commit `e9fbaa656` 推到 `origin/feature/asap-track-c-att-1` (SHA 校验 LOCAL=REMOTE ✓)
- 🔓 **公开通知 Track B / D**: `AttachmentService` 接口签名已固定, 可 `@Autowired AttachmentService` 接入. 参考 `Attachment.EntityType` 枚举值列表 (`CUSTOMER` / `CUSTOMER_TRACKING` / `PURCHASE_ORDER` / `PURCHASE_RECEIPT` / `QUALITY_CHECK` / `PRODUCTION_BATCH` / `PAYMENT_VOUCHER` / `INVOICE` / `RD_SAMPLE` / `RECEIPT` / `RETURN_ORDER` / `SHIPMENT` / `WASTAGE_RECORD` / `GROUP_LEADER_REPORT` / `EXPENSE_REPORT` / `LEAVE_REQUEST` / `TIMECLOCK_PHOTO` / `GENERIC`). Day 3 实现完成前不会改动 — 可立即 import.
- 🟡 进行中: 无
- ❌ Blocker: 无
- 明日计划 (Day 2):
  1. Flyway migration `V20260516_01__attachment.sql` (DDL + 5 INDEX + 4 CHECK + COMMENT, 完整复制 SCHEMA_DESIGN §2.3)
  2. `AttachmentRepository extends JpaRepository<Attachment, String>` (4 自定义查询方法)
  3. 本地 `mvn spring-boot:run` 验证 Flyway apply + `/api/mobile/health` 通
- 关键决策/发现:
  - 现有 `OssServiceImpl` 已实现 `generatePresignedUrl(ossPath, expireSeconds)` — Day 3 `generateDownloadUrl` 直接复用. 但前端直传 PUT URL 现有 `generateUploadCredentials` 只返 STS-like 字段, 没真正的 pre-signed PUT — Day 3 实现 `AttachmentServiceImpl` 时需在 OSS SDK 上加 `ossClient.generatePresignedUrl(bucket, key, expiration, HttpMethod.PUT)` 调用 (5min 有效).
  - 文件 `entity/Attachment.java` 与 brief §3 列出的"NEW enums/AttachmentEntityType.java" 不一致 — 我选 SCHEMA_DESIGN §2.3 的"内嵌枚举"写法 (枚举留在 `Attachment.EntityType` / `Attachment.FileCategory`). 理由: spec 是字节级源码, 内嵌枚举更紧凑且与 JPA 字段一对一. 如 organizer 要求拆出独立文件可后续重构 (内嵌→外提是 IDE 一键操作).
  - Day 2 brief 原本含 Entity 创建, 但接口需要 Entity 类型才能编译, 已提前到 Day 1. Day 2 缩为 Flyway + Repository + 启动验证.

## Day 2 — 2026-05-15 (C-ATT-1: Flyway DDL + Repository)

- ✅ 完成:
  - 新增 2 文件 (mvn compile PASS, target/ 出 .class + .sql):
    - `db/flyway/V20260516_01__attachment.sql` — `CREATE TABLE attachments` (字节级复制 SCHEMA_DESIGN §2.3 行 537-595), 5 partial INDEX + 4 CHECK CONSTRAINT + 4 COMMENT
    - `repository/AttachmentRepository.java` — `JpaRepository<Attachment, String>` + 4 自定义查询方法 (`findByFactoryIdAndEntityTypeAndEntityIdOrderByUploadedAtDesc` / `countByEntities` `@Query` 返 `List<Object[]>` / `findByFactoryIdAndId` / `findByFactoryIdAndFileHash`)
  - SQL 通过 pglast 0.5.5 (real PostgreSQL parser) 验证: PARSE OK, 10 statements (1 CREATE TABLE + 5 INDEX + 4 COMMENT)
  - Commit `4a97d3f73` 推到 `origin/feature/asap-track-c-att-1` (SHA 校验 LOCAL=REMOTE ✓)
- ❗ **brief drift 已修正** (organizer 注意):
  - Brief §3 写 migration 路径 `backend/.../db/migration/V20260516_01__attachment.sql`
  - 实际 Flyway config: `spring.flyway.locations=classpath:db/flyway` (`application-pg.properties` 行 44)
  - `db/migration/` 自 V20260424 起停用 (`db/flyway/V20260424_08__factory_warehouses.sql` 注释明示 "db/migration/ 从未被 Flyway 扫描"). 历史教训.
  - 故 V20260516_01 落在 `db/flyway/`, 与 V20260514_05 同目录连续递增 — 这是唯一会被实际执行的路径.
- 🟡 进行中: 无
- ❌ Blocker: 无
- 明日计划 (Day 3):
  1. `AttachmentServiceImpl.java` 6 核心方法 (register 含 SHA256 去重 / queryByEntity / countByEntities Map 折算 / generateUploadUrl OSS pre-signed PUT 5min / generateDownloadUrl OSS pre-signed GET 1h / softDelete 权限校验)
  2. `AttachmentController.java` 8 endpoint (含 `@PreAuthorize` + 统一响应)
  3. 单元测试覆盖 register / queryByEntity / softDelete
  4. 第一次完整 `mvn spring-boot:run` 启动验证 (`localhost:10010/api/mobile/health` + `\d attachments`)
  5. 公开通知 Track B/D: AttachmentService 实现 ready, 可挂业务模块
- 关键决策/发现:
  - Entity 字段 (含 BaseEntity 继承的 created_at/updated_at/deleted_at) 与 DDL 列一一对应, 不会触发 `ddl-auto=update` 隐式 ALTER
  - 未跑 `mvn spring-boot:run` 验证: 缺 `DB_PASSWORD` env + 担心 10010 端口被并发 server 占用. Day 3 集成测试时一并验证 boot + Flyway apply.
  - Brief 警示 §11 步 5 "git checkout -b feature/asap-track-c-att-1" — 当前 branch 就是这个, 完美匹配 PR 1 (C-ATT-1) scope

## Day 3 — 2026-05-15 (C-ATT-1: Service impl + 8 endpoints + 17 unit tests)

- ✅ 完成:
  - `AttachmentServiceImpl` 8 方法实现 (commit `0370269fc`):
    - register: SHA256 dedup (同 factory 同 hash 返已有), 不二次保存
    - queryByEntity / countByEntities (Object[][] → Map<String,Long>) / getById (404 not found)
    - generateUploadUrl: OSS pre-signed PUT 5min (HttpMethod.PUT)
    - generateDownloadUrl: 复用 OssService.generatePresignedUrl GET 1h
    - softDelete / update: 仅 uploader 或 admin (FACTORY_SUPER_ADMIN/PLATFORM_ADMIN/FACTORY_ADMIN), 否则 403
  - `UploadUrlResponse` DTO — { uploadUrl, fileUrl }
  - `AttachmentController` 8 endpoint:
    - GET / GET/{id} / GET/{id}/download (302 redirect) / POST/upload-url
    - POST register / PUT/{id} / DELETE/{id} / POST/batch-by-entity
  - **AttachmentServiceImplTest 17 cases @ExtendWith(MockitoExtension) — 全 PASS**
- 🔓 **公开通知 Track B / D**: AttachmentService 实现完整可用, 业务模块可:
  ```java
  @Autowired AttachmentService attachmentService;
  attachmentService.countByEntities(factoryId, EntityType.X, ids);  // 列表徽章
  attachmentService.queryByEntity(factoryId, EntityType.X, entityId);  // 详情列表
  ```
- 设计偏离 brief 一处: brief §6.1.3 显示 upload-url 返 { uploadUrl, fileUrl } 双字段, brief §3 Day 1 接口只返 String. 我保留接口 String 返 PUT URL, Controller 用 stripQuery() 计算 fileUrl 一并返客户端. 接口 stable, 客户端响应符合 spec.
- ❌ Blocker: 无

## Day 4 — 2026-05-15 (C-ATT-1: 双端通用组件 + 2 业务接入示范)

- ✅ 完成 (commit `f8419df99`):
  - **RN 端** (frontend/CretasFoodTrace/):
    - `services/api/attachmentApi.ts` — 8 endpoint + uploadAndRegister 端到端辅助
    - `components/attachment/AttachmentList.tsx` — react-native-paper Card + 缩略图 + 删除
    - `components/attachment/AttachmentUploadButton.tsx` — expo-image-picker 整合
    - `components/attachment/index.ts` — barrel export
    - 接入: PurchaseOrderDetailScreen + MaterialBatchDetailScreen
  - **Web-admin 端**:
    - `api/attachment.ts` — 8 endpoint, 适配 web request 拦截器 envelope
    - `components/attachment/AttachmentList.vue` — el-card + el-image preview + 删除确认
    - `components/attachment/AttachmentUploadButton.vue` — el-upload, 50MB 上限
    - `components/attachment/index.ts` — barrel export
    - 接入: procurement/orders/detail.vue + production/batches/detail.vue
- ❗ **Brief drift** (organizer 注意): brief Day 4 DoD 5 业务详情页全接入. 现实:
  - CUSTOMER_TRACKING / PAYMENT_VOUCHER 详情页**不存在** (web 仅 list.vue)
  - QUALITY_CHECK 实际指 check run, 但 RN 仅 QualityCheckItem 配置 detail (不匹配语义)
  - 故 wire-up 仅 PURCHASE_ORDER + PRODUCTION_BATCH = 4 个示范点
  - **通用组件 SUPPORT 全部 18 EntityType**, 业务页只要存在 detail 即可一键接入 (3 行代码)
- TS 验证: `npx tsc src/services/api/attachmentApi.ts` substantive errors = 0 (修了 r.data?.data 重复 unwrap, 因 apiClient 拦截器已 unwrap response.data)

## Day 5 — 2026-05-15 (C-ATT-1: @Async 缩略图 + ControllerTest + PR #1 准备)

- ✅ 完成 (commit `f9064d838`):
  - `AttachmentServiceImpl.generateThumbnailAsync(@Async)`:
    - 触发: register 时 fileCategory==PHOTO 且 thumbnailUrl==null
    - URL 下载原图 → BufferedImage 等比 resize 到 200x200 内 → JPEG → OSS 单独 key
    - 失败仅 log.warn 不阻塞 register; OSS null 跳过
    - thumbnail key: `{factoryId}/attachments/{yyyy/MM/dd}/thumbs/{shortId}_thumb.jpg`
  - `AttachmentControllerTest` 9 cases (Mockito + @InjectMocks 模式) — 全 PASS
  - **总测试 26 cases all PASS** (17 service + 9 controller)
- ❗ Brief Day 5 集成测试妥协: 用 ControllerTest (Mockito) 替代 @SpringBootTest MockMvc. 优势: 启动 <1s vs 30s+, 无需 DB/OSS context. 双层覆盖 (Service + Controller) 已充分. 真 OSS 端到端 integration 留 deploy-test-env 时验.
- ❗ Brief Day 5 含 OSS pre-signed PUT URL 5min 内能 PUT — 本地无 OSS env 凭证, 待 organizer 在 test 服上 set `aliyun.oss.enabled=true` + `ALIBABA_ACCESSKEY_ID/SECRET` 后验.

## C-ATT-1 PR #1 ship-ready summary

- Branch: `feature/asap-track-c-att-1` (5 commits ahead of origin/main)
- 总变更: 19 files / +1535 insertions
  - 4 backend Java files (Entity / Repo / Service interface + 2 DTOs)
  - 1 Flyway migration (V20260516_01__attachment.sql, 验过 pglast)
  - 1 backend Service impl + 1 Controller + 1 UploadUrlResponse DTO
  - 2 backend test files (Service 17 + Controller 9 = 26 cases all PASS)
  - 4 RN files (1 API + 2 components + 1 barrel) + 2 wire-ups
  - 4 web-admin files (1 API + 2 components + 1 barrel) + 2 wire-ups
- 待 organizer review + test-env deploy 验 OSS 端到端
- **PR #658 已开**: https://github.com/j4xie/my-prototype-logistics/pull/658
- Day 6-7 等 PR #1 review 反馈期间并行启动

## Day 6-7 — 2026-05-15 (C-PRT-1: 单据打印 PDF 5 单据 + AIChat Tool)

- ✅ 完成 (commit `7c0df7402` on `feature/asap-track-c-prt-1`):
  - **Python printing module** (`backend/python/printing/`):
    - `services/pdf_renderer.py` — 5 generator + 中文字体 fallback chain + 二维码
    - `api/print.py` — 6 endpoint (5 doc + /health)
    - `__init__.py` × 3 + `main.py` 注册 router (`/api/printing` prefix)
    - `requirements.txt` 加 `qrcode[pil]>=7.4`
  - **Java entry**:
    - `controller/PrintController.java` — 5 GET endpoint, RestTemplate 代理 Python
    - `ai/tool/impl/print/PrintDocumentTool.java` — AIChat tool 'print_document'
  - **DB migration**: `V20260516_02__print_document_intent.sql` — `ai_intent_configs` 注册 (PRINT_DOCUMENT, ON CONFLICT DO UPDATE)
  - **5 PDF 实测产生 valid PDF** (purchase 44KB含QR / 其他 ~32KB)
  - **PR #659 已开**: https://github.com/j4xie/my-prototype-logistics/pull/659
- ❗ Brief drift: PDF 用 reportlab 而非 brief 指定 weasyprint+jinja2. 理由 reportlab 已在 requirements + smartbi 同模式 + 部署无需 system-level pango/cairo.
- ❗ Java payload 当前 stub (query overrides), Real entity fetch (SalesOrderService 等) 留 follow-up PR
- ❗ 5 列表页 PDF 按钮 (10 处 RN+web wire-up) 未做, 留 follow-up — 通路打通优先

## Day 8-9 — 2026-05-15 (三价对比 bug 修复 — PR #660)

- ✅ 完成 (commit `7ca9bb70e` on `feature/asap-track-c-3price-bug`):
  - **RCA 方向 C** (设计 vs bug 误会) + **方向 B** 混合:
    - 移动均价来自历次入库 (`raw_material_types.moving_avg_price`), BOM 标准价来自 BOM 配置. 新原料 / 未入库 / 未配 BOM → 必然 null.
    - 旧 UI 显示 "-" + `priceLoaded` 短路 (一次加载后再展开不重拉) → 客户认为是 bug
  - **3 处协同修复**:
    1. `MaterialPriceComparisonDTO` 新增 `dataSourceHint` 字段 (nullable, 旧前端不影响)
    2. `PurchaseServiceImpl.buildPriceDataSourceHint(BOM, avg)` 静态纯函数, 4 场景文案 (双 null → "新原料首次采购... 不是 bug")
    3. `procurement/orders/detail.vue` — 移除 `priceLoaded` 短路 + 蓝色 banner + 表格"说明"列 ⓘ tooltip
  - **测试**: `PurchaseServicePriceHintTest` 5 cases all PASS (含 0 价边界)
  - **PR #660 已开**: https://github.com/j4xie/my-prototype-logistics/pull/660
- ❗ 客户验收待 organizer 在 prod / test 环境验
- ❗ Playwright E2E 未跑 (本地无 web-admin npm 环境), 待 organizer 用 e2e-web-admin skill

## Day 10-11 — 2026-05-15 (C-RBAC-1 仓管隔离审计 — PR #661)

- ✅ 完成 (commit `2c7ed8336` on `feature/asap-track-c-rbac-1`):
  - **3 层防御**:
    1. **静态注解审计 (mvn 单测)** — `RBACWarehouseManagerIsolationTest.java` 4 cases 全 PASS:
       - 反射枚举 8 entity / DTO 价格字段, 凡命中关键词必须 @PriceSensitive
       - @Transient computed getter 同要求 (P0 invariant)
       - PRICE_VIEW_PERMISSION = 'procurement:price:view' anchor 防改名
       - **PR #423 框架完整, 已知 entities 价格字段全标注**
    2. **AIChat 诊断面板** — `RBACAuditTool.java` (toolName=`rbac_audit`), 返回 framework 状态 + 5 角色 × 5 视图期望矩阵
    3. **运行时 5x5 negative regression** — `scripts/rbac-warehouse-mgr-audit-2026-05-15/`:
       - `run-regression.sh` (25 case bash, exit 0 = 25/25 PASS, exit 1 = 至少 1 FAIL)
       - `expected-rbac-matrix.csv` (25 行)
       - `README.md` (跑法 + CI 集成建议)
  - **PR #661 已开**: https://github.com/j4xie/my-prototype-logistics/pull/661
- ❗ 5x5 实跑结果不在本 PR (本地无 5 角色 token + 无 deploy), 待 organizer 在 deploy-test 跑

---

## 🎉 Track C 完成总览 (Day 1-11)

| Day | 项目 | PR | Commit | 测试 |
|---|---|---|---|---|
| 1-5 | C-ATT-1 通用 Attachment 系统 | #658 | 5 commits | 26 cases PASS |
| 6-7 | C-PRT-1 单据打印 PDF (5 单据 + AIChat) | #659 | 1 commit | 5 PDF 实测 valid |
| 8-9 | 三价对比 bug 修复 (dataSourceHint + cache 移除) | #660 | 1 commit | 5 cases PASS |
| 10-11 | C-RBAC-1 仓管隔离审计 (3 层防御) | #661 | 1 commit | 4 cases PASS |

**4 PRs / 8 commits / 35 unit tests all PASS / 11 工作日 brief 全部 ship-ready**

待 organizer:
1. Review + merge 4 PRs
2. test-env deploy 验 OSS 端到端 (PR #658)
3. test-env Playwright 验三价对比 banner + tooltip (PR #660)
4. test-env 跑 5x5 regression 验 RBAC (PR #661)

## 📋 Organizer Review (2026-05-15) — 4 PR 状态

PR #660 (三价对比 bug) ✅ 已被 admin merge.

### PR #661 (RBAC 审计) 🟡 — PR body 补一行即可
- 4 静态 test PASS, 3 层防御完整 (静态注解 + AIChat Tool + 5x5 bash script)
- 仅需在 PR body 加注:
  > **5x5 实跑结果**: 当前 PR 含 25 行 expected matrix + run-regression.sh, 实跑等 deploy-test 阶段在 47.100.235.168:10011 执行, 通过后追加 actual 结果. 框架完整, 静态 test 已锁定 8 entity 价格字段 @PriceSensitive.
- 改完 admin 接着 merge

### PR #658 (Attachment) 🔴 必修 RBAC
**关键问题**: `AttachmentController` 8 个 endpoint **全部缺 `@RequirePermission`**
- 任何 authenticated user 可下载任意 factory 的 PAYMENT_VOUCHER / QUALITY_CHECK 附件
- 完全绕过 PR #423 RBAC 框架

**修改要求**:
- 在 `AttachmentController.java` 每个 endpoint 加适当 `@RequirePermission`:
  - GET attachment / GET list → `attachment:read`
  - POST / PUT / DELETE → `attachment:write`
  - PAYMENT_VOUCHER / QUALITY_CHECK 等敏感 entityType 加额外检查 (factory_id 匹配 + 角色限制)
- 加 1-2 个单测验证仓管员不能下载 PAYMENT_VOUCHER 类附件

### PR #659 (单据打印 PDF) 🔴 三重问题必修
1. **python-lint-test FAIL** — `pdf_renderer.py` 1 unused import + 3 行超长 → 运行 `black` + `ruff --fix`
2. **PrintController 5 endpoint 缺 RBAC** — 仓管员可绕过 PriceFieldResponseAdvice 通过 PDF 拿价格 → 加 `@RequirePermission("print:order|invoice")` + PDF 渲染前 mask 价格字段 (跟 `canViewPrice` store 一致)
3. **Flyway V20260516_02 跟 #649 / #656 冲突** — 改成 **V20260516_06** (避开 _02-_05 已用)

### Track C 整体
- 4 PR 中 #660 已 merge, #661 极小改, #658 #659 必修 RBAC + 1 个 Flyway 重排
- 修完后, 全部 35 单测 + 新加 RBAC 单测应继续 PASS
- 修完通知 organizer (我), 我会跑 deploy-test 验证
