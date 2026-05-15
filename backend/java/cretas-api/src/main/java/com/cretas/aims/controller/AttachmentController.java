package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.Attachment;
import com.cretas.aims.entity.Attachment.EntityType;
import com.cretas.aims.service.attachment.AttachmentService;
import com.cretas.aims.service.attachment.dto.RegisterAttachmentRequest;
import com.cretas.aims.service.attachment.dto.UpdateAttachmentRequest;
import com.cretas.aims.service.attachment.dto.UploadUrlResponse;
import com.cretas.aims.service.attachment.impl.AttachmentServiceImpl;
import com.cretas.aims.utils.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Attachment REST API — C-ATT-1.
 *
 * <p>8 endpoint 完整实现 (见 SCHEMA_DESIGN §2.3 API 契约):
 * <ol>
 *   <li>GET /attachments?entityType=X&entityId=Y — 列表</li>
 *   <li>GET /attachments/{id} — 详情</li>
 *   <li>GET /attachments/{id}/download — 302 重定向到签名 GET URL</li>
 *   <li>POST /attachments/upload-url — 取签名 PUT URL (前端直传)</li>
 *   <li>POST /attachments — 注册元数据 (前端 OSS 上传完成后)</li>
 *   <li>PUT /attachments/{id} — 更新 description/businessTag/fileCategory</li>
 *   <li>DELETE /attachments/{id} — 软删</li>
 *   <li>POST /attachments/batch-by-entity — 批量计数 (列表页徽章)</li>
 * </ol>
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1 Day 3)
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/mobile/{factoryId}/attachments")
@CrossOrigin(origins = {"https://www.cretaceousfuture.com", "http://139.196.165.140:8086", "http://localhost:5173"})
public class AttachmentController {

    private final AttachmentService attachmentService;

    // ==================== 1. List by entity ====================

    @GetMapping
    public ResponseEntity<ApiResponse<List<Attachment>>> listByEntity(
            @PathVariable String factoryId,
            @RequestParam EntityType entityType,
            @RequestParam String entityId) {
        List<Attachment> list = attachmentService.queryByEntity(factoryId, entityType, entityId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    // ==================== 2. Get by id ====================

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Attachment>> getById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(attachmentService.getById(factoryId, id)));
    }

    // ==================== 3. Download (302 redirect to signed URL) ====================

    @GetMapping("/{id}/download")
    public ResponseEntity<Void> download(
            @PathVariable String factoryId,
            @PathVariable String id) {
        String signedUrl = attachmentService.generateDownloadUrl(factoryId, id);
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create(signedUrl));
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }

    // ==================== 4. Upload URL (pre-signed PUT) ====================

    @PostMapping("/upload-url")
    public ResponseEntity<ApiResponse<UploadUrlResponse>> generateUploadUrl(
            @PathVariable String factoryId,
            @Valid @RequestBody UploadUrlRequest req) {
        String putUrl = attachmentService.generateUploadUrl(factoryId, req.getFileName(), req.getFileType());
        String fileUrl = AttachmentServiceImpl.stripQuery(putUrl);
        return ResponseEntity.ok(ApiResponse.success(new UploadUrlResponse(putUrl, fileUrl)));
    }

    // ==================== 5. Register metadata (post-upload) ====================

    @PostMapping
    public ResponseEntity<ApiResponse<Attachment>> register(
            @PathVariable String factoryId,
            @Valid @RequestBody RegisterAttachmentRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        Attachment saved = attachmentService.register(factoryId, req, userId);
        return ResponseEntity.ok(ApiResponse.success("上传成功", saved));
    }

    // ==================== 6. Update (description/businessTag/fileCategory) ====================

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Attachment>> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody UpdateAttachmentRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(attachmentService.update(factoryId, id, req, userId)));
    }

    // ==================== 7. Soft delete ====================

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> softDelete(
            @PathVariable String factoryId,
            @PathVariable String id) {
        Long userId = SecurityUtils.getCurrentUserId();
        attachmentService.softDelete(factoryId, id, userId);
        return ResponseEntity.ok(ApiResponse.successMessage("删除成功"));
    }

    // ==================== 8. Batch count by entity ====================

    @PostMapping("/batch-by-entity")
    public ResponseEntity<ApiResponse<Map<String, Long>>> batchCount(
            @PathVariable String factoryId,
            @Valid @RequestBody BatchCountRequest req) {
        Map<String, Long> counts = attachmentService.countByEntities(factoryId, req.getEntityType(), req.getEntityIds());
        return ResponseEntity.ok(ApiResponse.success(counts));
    }

    // ==================== Request DTOs (inner — only used by this Controller) ====================

    @Data
    public static class UploadUrlRequest {
        @NotBlank
        private String fileName;
        @NotBlank
        private String fileType;
    }

    @Data
    public static class BatchCountRequest {
        @NotNull
        private EntityType entityType;
        @NotNull
        private List<String> entityIds;
    }
}
