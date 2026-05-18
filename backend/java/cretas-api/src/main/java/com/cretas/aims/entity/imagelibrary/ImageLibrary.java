package com.cretas.aims.entity.imagelibrary;

import com.cretas.aims.entity.BaseEntity;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.Where;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 公共图片库实体 (P2 #80 C-IMAGE-LIB-1).
 *
 * <p>构建在通用 {@link com.cretas.aims.entity.Attachment} 之上 (C-ATT-1, PR #658) 的
 * <b>策划层 (curation layer)</b>: 把已上传的附件以"图库"形式管理, 支持分类/标签/搜索/计数.
 *
 * <p>跨工厂共享: 当 {@code factoryId IS NULL} 或 {@code isPublic = true} 时该图片对全部工厂可见
 * — 平台统一素材库场景 (LOGO / 营销物料 / 设备图等).
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80 C-IMAGE-LIB-1)
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "image_library", indexes = {
        @Index(name = "idx_imglib_factory_category", columnList = "factory_id,category"),
        @Index(name = "idx_imglib_factory_public", columnList = "factory_id,is_public"),
        @Index(name = "idx_imglib_public", columnList = "is_public"),
        @Index(name = "idx_imglib_attachment", columnList = "attachment_id"),
        @Index(name = "idx_imglib_uploader", columnList = "factory_id,uploader_user_id"),
        @Index(name = "idx_imglib_usage", columnList = "factory_id,usage_count")
})
@Where(clause = "deleted_at IS NULL")
public class ImageLibrary extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    /**
     * 关联底层 Attachment ID (C-ATT-1 系统). 软外键 — 不强 FK constraint (跟 Attachment
     * 多态约定一致), Service 层校验. Attachment 软删后, ImageLibrary 仍保留元数据.
     */
    @Column(name = "attachment_id", nullable = false, length = 191)
    private String attachmentId;

    /** 工厂 ID — NULL 表示平台公共图片 (全工厂可见). */
    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * 标签列表 (jsonb 数组). 例: {@code ["促销","春季","新品"]}.
     * 用于 tag-chip UI + 文本检索 (Service 用 LIKE/jsonb 操作符).
     */
    @Type(JsonBinaryType.class)
    @Column(name = "tags", columnDefinition = "jsonb")
    private List<String> tags = new ArrayList<>();

    /** 分类枚举 — 见 {@link Category}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 32)
    private Category category = Category.OTHER;

    /** 上传者用户 ID (审计). */
    @Column(name = "uploader_user_id", nullable = false)
    private Long uploaderUserId;

    /**
     * 是否公开 (跨工厂共享): true → 任意工厂可查; false → 仅 {@code factoryId} 本工厂可查.
     * MVP 不做 ACL, 仅一个 flag.
     */
    @Column(name = "is_public", nullable = false)
    private Boolean isPublic = false;

    /** 使用计数 — 每次被引用时调 {@code recordUsage} 自增. */
    @Column(name = "usage_count", nullable = false)
    private Long usageCount = 0L;

    /**
     * 图片分类 — 白名单约束 (DB CHECK).
     * <p>新增值时必须同步更新 Flyway migration 的 {@code chk_imglib_category} CHECK constraint.
     */
    public enum Category {
        /** 商品图 (产品图 / SKU 主图 / 规格图). */
        PRODUCT,
        /** 营销物料 (banner / 海报 / 朋友圈图 / 节日素材). */
        MARKETING,
        /** 品牌标识 (LOGO / 印章 / 二维码). */
        LOGO,
        /** 活动 / 事件 (会议 / 展会 / 团建 / 培训). */
        EVENT,
        /** 其他. */
        OTHER
    }
}
