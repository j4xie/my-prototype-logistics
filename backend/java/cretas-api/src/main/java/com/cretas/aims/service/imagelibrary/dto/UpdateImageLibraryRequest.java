package com.cretas.aims.service.imagelibrary.dto;

import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 更新图片库元数据 — 仅允许改 title/description/tags/category/isPublic.
 * 不允许改 attachmentId / uploaderUserId / factoryId.
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
@Data
public class UpdateImageLibraryRequest {

    @Size(max = 200)
    private String title;

    @Size(max = 5000)
    private String description;

    private List<String> tags;

    private Category category;

    private Boolean isPublic;
}
