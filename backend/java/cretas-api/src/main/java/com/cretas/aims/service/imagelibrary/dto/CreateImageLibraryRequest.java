package com.cretas.aims.service.imagelibrary.dto;

import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 创建图片库条目请求 (引用现有 Attachment).
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
@Data
public class CreateImageLibraryRequest {

    /** 已上传的 Attachment ID (由前端先调 attachment upload-url + register 流程取得). */
    @NotBlank
    private String attachmentId;

    @NotBlank
    @Size(max = 200)
    private String title;

    @Size(max = 5000)
    private String description;

    /** 标签列表 (前端 chip 输入), 后端去重 + 去空. */
    private List<String> tags;

    @NotNull
    private Category category;

    /** 是否跨工厂共享 (true → 任意工厂可见). 默认 false. */
    private Boolean isPublic;
}
