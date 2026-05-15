package com.cretas.aims.service.attachment.dto;

import com.cretas.aims.entity.Attachment;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 注册附件元数据请求 — 前端 OSS 直传完成后调 {@code POST /api/mobile/{factoryId}/attachments}.
 *
 * <p>spec: SCHEMA_DESIGN §2.3
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1)
 */
@Data
public class RegisterAttachmentRequest {

    @NotNull
    private Attachment.EntityType entityType;

    @NotBlank
    @Size(max = 191)
    private String entityId;

    @NotBlank
    @Size(max = 255)
    private String fileName;

    @NotBlank
    @Size(max = 1000)
    private String fileUrl;

    @Size(max = 1000)
    private String thumbnailUrl;

    @NotNull
    @Min(1)
    private Long fileSize;

    /** MIME type — e.g. image/jpeg / application/pdf */
    @NotBlank
    @Size(max = 50)
    private String fileType;

    private Attachment.FileCategory fileCategory;

    /** OSS / R2 / LOCAL — 默认 OSS. */
    @Size(max = 20)
    private String fileStorage;

    /** SHA256, 客户端计算. 同 factory 同 hash 视为同一文件 → 触发去重. */
    @Size(max = 64)
    private String fileHash;

    /** 业务标签: CONTRACT_SCAN / DELIVERY_PROOF / WEIGHT_TICKET / 等. */
    @Size(max = 50)
    private String businessTag;

    @Size(max = 500)
    private String description;

    /** WEB / MOBILE / DINGTALK / API — 默认 WEB. */
    @Size(max = 20)
    private String uploadSource;
}
