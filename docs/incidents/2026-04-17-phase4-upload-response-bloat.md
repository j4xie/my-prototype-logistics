# Phase 4 上传响应体过大 — 架构问题 & 优化方案

**发现时间**: 2026-04-17
**场景**: D2/A 验证期间,浏览器上传 QHJ Q4 评价文件 (2.4MB xlsx) 后 UI 停留 90% 进度条超过 4 分钟

---

## 根因

`/api/mobile/{factory}/smart-bi/upload-and-analyze` 返回的 JSON **把原始文件内容全部带回 FE**:

```
Response body: 10,909,738 bytes (10.4 MB)

parseResult.previewData: 6942 rows × 30 cols ← 全量!
parseResult.headers: 30
parseResult.fieldMappings: 20
parseResult.dataFeatures: per-column stats
parseResult.metadata: extra
parseResult.structureInfo: detected shape
+ Java 外层 aiAnalysis / chartConfig / recommendedTemplates
```

实际 FE 只在 "数据预览" 表格渲染 **前 5-20 行**(见 `ExcelUpload.vue` L744-L774),其余 6900+ 行纯属累赘。

---

## 影响

| 链路 | 用户感受 |
|---|---|
| 客户机 → 生产 (同机房千兆) | 1-2s 可接受 |
| 开发机 → 139 公网 (~200KB/s) | **52s 传输 + FE 解析时间** = UI 卡 1 分钟+ |
| 手机 4G / 远程 VPN | 几乎不可用 |

后端 7s 完成处理,返回 10MB 给 FE 后,axios 在这段时间内 promise 挂起 → FE 的 `uploading=true` 不清除 → 进度条永停 90%。

---

## 优化方案 (按工作量排序)

### ✅ A · 后端截断 previewData (推荐,30min 工作量)

在 `SmartBIUploadFlowServiceImpl` 返回给 Controller 前:

```java
// 只保留前 50 行给 FE 预览, 全量数据已通过 uploadId 持久化
if (parseResult.getPreviewData() != null && parseResult.getPreviewData().size() > 50) {
    parseResult.setPreviewData(parseResult.getPreviewData().subList(0, 50));
}
```

或在 Python `/api/excel/auto-parse` response shape 层:

```python
# smartbi/api/excel.py 返回前
resp["preview_data"] = preview_data[:50]
```

**影响**: 响应从 10MB → ~50KB, 传输从 52s → 0.3s。FE 预览表格行为不变(本来只渲染前 20 行)。

**前端改动**: 无。`parseResult.sampleData` 现在至多 50 行,`pr.preview_data.length` 继续用于"X 行预览"标签。

### B · 拆分 preview 为独立 GET 端点 (中等,2-3h)

`/upload-and-analyze` 只回 `{uploadId, headers, rowCount, requiresConfirmation, ...}`。FE 拿到 uploadId 后分页拉:

```
GET /api/mobile/{factory}/smart-bi/upload/{uploadId}/preview?limit=50&offset=0
```

**收益**: 响应 < 10KB。支持"下一页预览"交互。

**成本**: 新 Java controller + 新 Vue action + FE 重构 uploadAndAnalyze。

### C · GZIP 响应 (部分缓解,15min)

nginx / Spring Boot 开启 gzip (已开?待查)。10MB JSON 里重复 Chinese keys 可压缩到 ~1-2MB。

**收益有限**: 传输时间 52s → 10s,仍慢。不治本。

### D · 不返回 dataFeatures / metadata / structureInfo (小改,10min)

这三个字段是 Python `auto-parse` 的内部诊断结构,FE 不用。Java 层直接 drop:

```java
parseResult.setDataFeatures(null);
parseResult.setMetadata(null);
parseResult.setStructureInfo(null);
```

**收益**: 大概 10MB → 8MB (主要体积仍在 previewData,A 才是主减肥)。

---

## 推荐组合

**最小改动最大收益**: **A + D** 一起做,~30min 工作量,响应从 10MB → 30KB,全场景流畅。

**长期治本**: B (preview 独立端点) + 未来换成 S3 storage URL 返回。

---

## 不做 的选项

- ~~完全去掉 previewData~~: FE 需要首屏显示预览,去掉会破体验
- ~~SSE 流式~~: preview 是一次性 payload, stream 收益不大
- ~~WebSocket~~: 过度工程,单次请求不需要

---

## 验证方法

优化后再跑 D2/A 浏览器验证:
1. 打开 DevTools Network
2. 上传 QHJ Q4 文件 (原本卡 90% 4 分钟)
3. 观察 `upload-and-analyze` response size (应 < 100KB) + duration (应 < 15s)
4. 确认 UI 正确转到步骤 2 (`requiresConfirmation=true` → 字段确认屏)
