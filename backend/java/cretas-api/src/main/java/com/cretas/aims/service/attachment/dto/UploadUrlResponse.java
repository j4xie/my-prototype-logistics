package com.cretas.aims.service.attachment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Upload URL endpoint 返回 — 给前端直传 OSS 用.
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1)
 */
@Data
@AllArgsConstructor
public class UploadUrlResponse {
    /** OSS 预签名 PUT URL — 5 分钟有效. 前端用 fetch/axios PUT 此 URL 上传文件. */
    private String uploadUrl;

    /** 上传完成后的最终 fileUrl (无签名), 前端调 register 时携带. */
    private String fileUrl;
}
