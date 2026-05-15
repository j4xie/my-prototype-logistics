package com.cretas.aims.service.attachment.dto;

import com.cretas.aims.entity.Attachment;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新附件请求 — 仅允许改 description / businessTag / fileCategory.
 * 文件本身 (fileUrl / fileHash / entityType / entityId / uploadedBy) 不可变.
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1)
 */
@Data
public class UpdateAttachmentRequest {

    @Size(max = 500)
    private String description;

    @Size(max = 50)
    private String businessTag;

    private Attachment.FileCategory fileCategory;
}
