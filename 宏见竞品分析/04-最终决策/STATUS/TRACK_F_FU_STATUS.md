# TRACK F FU STATUS — Follow-up Chat 2 (Sample Photo Gallery)

> **Worker**: Chat 2 (前 Chat F, S-RD-1 主 PR #680 已 merged at 2026-05-16 03:33 UTC)
> **Branch**: `fix/sprint2-fu-chat2-sample-attachment`
> **Base**: `origin/main@8f0a6f8ce`
> **Start**: 2026-05-16

---

## FU Task 1 (2026-05-16) — Sample Photo Gallery

### Brief 任务清单 vs 实际 state (pre-flight verify, HARD rule)

Steve 给的任务清单 ~2-3h, 但 pre-flight grep verify 发现 6 步里 5 步已经 ship 在 main:

| Steve 第 N 步 | 实际状态 | Action |
|---|---|---|
| 2. AttachmentEntityType 加 SAMPLE_REQUEST | `RD_SAMPLE` 已存在 (`Attachment.java:121`), PR #680 已用 | skip |
| 3. AttachmentPermissionResolver 加映射 | `RD_SAMPLE → "rd"` 已映射 (`AttachmentPermissionResolver.java:74`) | skip |
| 4. SampleRequest entity 加 attachmentIds 字段 | Track C 用 **join 表** 设计 (attachments by entity_type+entity_id), 加字段反违设计 | skip |
| 5. 替换 mock placeholder | PR #680 已用真 `<AttachmentList entityType="RD_SAMPLE">` — 非 mock | upgrade scope |
| 6. Flyway V20260601_06+ | 无 schema 改动 | skip |

Steve sign-off **B) Full SamplePhotoGalleryScreen scope** (~2-3h): 独立 photo gallery + grid + tap fullscreen.

### ✅ 完成

- **`screens/rd/SamplePhotoGalleryScreen.tsx`** (NEW, ~280 行):
  - 3 列 grid (FlatList numColumns=3), thumbnail size = (screen_width - padding - gap) / 3
  - Top header: 样品标题 + AttachmentUploadButton (camera + gallery 双 source, fileCategory=PHOTO)
  - Tap thumbnail → Modal preview (Image contain mode + 元数据 + 删除/关闭按钮)
  - Long press thumbnail (delayLongPress=400ms) → Alert 二次确认 → `attachmentApi.delete`
  - 仅展示 PHOTO 附件 (`fileCategory === 'PHOTO' || fileType?.startsWith('image/')`), VIDEO / DOCUMENT 不入 gallery
  - Pull-to-refresh + 空状态引导 + 错误重试
  - Modal metadata 显示: fileName + size + mimeType + uploadedAt + description + businessTag
  - EXIF 不显示 (后端 Sprint 1 Attachment API 不返 EXIF 元数据, 留 Sprint 3 / backend 扩展)

- **`screens/rd/SampleRequestDetailScreen.tsx`** (MODIFY, +35/-5):
  - 附件 Section 升级:
    - 顶部并列: `📷 上传照片` AttachmentUploadButton + `🖼 网格视图 →` 跳 SamplePhotoGalleryScreen
    - 保留 inline `<AttachmentList>` (用 refreshKey 上传后自动刷新)
  - 加 navigation prop + RDStackParamList 含 SamplePhotoGallery route
  - 加 `attachmentRefreshKey` state, AttachmentUploadButton.onUploaded 触发 +1

### Sprint 1 Track C API 真接入 (per Steve 任务"调真 AttachmentApi")

| API | 用法 | 调用点 |
|---|---|---|
| `attachmentApi.list('RD_SAMPLE', sampleId)` | 加载 gallery 列表 | SamplePhotoGalleryScreen.load |
| `attachmentApi.uploadAndRegister(...)` | upload-url + OSS PUT + register 整流程 | AttachmentUploadButton (内部) |
| `attachmentApi.delete(id)` | 软删 | SamplePhotoGalleryScreen.handleDelete |
| `attachmentApi.getUploadUrl + register` | 同 uploadAndRegister 内部 | (透明) |
| Backend `AttachmentPermissionResolver.RD_SAMPLE → "rd"` module | 隐式权限校验 (用户需 `rd:read`/`rd:read_write`) | 后端自动 enforce |

### 不破 Sprint 1 K2 RBAC

- 0 后端文件修改 (AttachmentService / PermissionResolver / Controller 都不动)
- 前端用现存 `attachmentApi` + `AttachmentUploadButton` + `AttachmentList`, 它们已正确 invoke `@RequirePermission` 等 K2 修复 (PR #658 + follow-ups)
- 仅前端新增 / 修改 2 个 screen

### 不动其他 chat 文件

| 别 chat ownership | 验证不碰 |
|---|---|
| Chat E `service/shortage/` + `SalesOrderShortageReviewScreen` | ✓ 未动 |
| Chat G `components/workflow/` | ✓ 未动 |
| Chat H `components/list/RowActionBottomSheet` | ✓ 未动 |
| Chat I `components/list/StickyFooterSummary` | ✓ 未动 |
| Chat J `service/purchase/PurchaseOrderApprovalFlow` | ✓ 未动 |

### 📌 Follow-up (留 organizer 拍板)

1. **Navigator wiring**: `SamplePhotoGallery` 路由加到 stack navigator (同 SampleRequestList/Detail 留 follow-up, 跟 #680 一致策略)
2. **EXIF metadata**: 后端 Attachment 表扩展 EXIF 字段 (相机型号 / 拍摄日期 / GPS) → 前端 Modal 显示
3. **Multi-select delete + batch download**: gallery 加批量操作
4. **VIDEO 类附件 gallery 入口**: 当前只 photo, 视频留独立 view

### 工时

| Steve 估 | 实际 |
|---|---|
| 2-3h | ~1h (跳过 Steve 列的 5 步无效任务后实际只做 gallery screen + DetailScreen edit) |

---
