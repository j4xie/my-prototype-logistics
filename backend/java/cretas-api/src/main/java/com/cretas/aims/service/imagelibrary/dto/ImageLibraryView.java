package com.cretas.aims.service.imagelibrary.dto;

import com.cretas.aims.entity.imagelibrary.ImageLibrary;
import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 图片库 view DTO — 同时返回底层 Attachment 的 fileUrl/thumbnailUrl, 前端不用二次请求.
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImageLibraryView {
    private String id;
    private String attachmentId;
    private String factoryId;
    private String title;
    private String description;
    private List<String> tags;
    private Category category;
    private Long uploaderUserId;
    private Boolean isPublic;
    private Long usageCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 底层 Attachment 文件 URL (聚合返回, 避免前端 N+1). */
    private String fileUrl;

    /** 底层 Attachment 缩略图 URL (可空). */
    private String thumbnailUrl;

    /** 底层 Attachment 原文件名 (展示用). */
    private String fileName;

    /** 底层 Attachment 文件大小 (字节). */
    private Long fileSize;

    public static ImageLibraryView fromEntity(ImageLibrary entity) {
        return ImageLibraryView.builder()
                .id(entity.getId())
                .attachmentId(entity.getAttachmentId())
                .factoryId(entity.getFactoryId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .tags(entity.getTags())
                .category(entity.getCategory())
                .uploaderUserId(entity.getUploaderUserId())
                .isPublic(entity.getIsPublic())
                .usageCount(entity.getUsageCount())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
