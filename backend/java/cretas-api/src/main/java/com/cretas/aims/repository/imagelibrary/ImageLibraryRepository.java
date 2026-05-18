package com.cretas.aims.repository.imagelibrary;

import com.cretas.aims.entity.imagelibrary.ImageLibrary;
import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * ImageLibrary JPA Repository — P2 #80.
 *
 * <p>所有查询自动应用 {@code @Where(deleted_at IS NULL)} (软删除过滤, 见 ImageLibrary).
 *
 * <p>跨工厂可见规则: visible(F, img) ⇔
 *   {@code img.factoryId = F} OR {@code img.factoryId IS NULL} OR {@code img.isPublic = true}.
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
@Repository
public interface ImageLibraryRepository extends JpaRepository<ImageLibrary, String> {

    /**
     * 详情查询 — 应用跨工厂可见规则.
     *
     * <p>对调用工厂 F 仅返回 (factoryId = F) ∪ (factoryId IS NULL) ∪ (isPublic = true) 的图片.
     * 防止 F1 用户拿到 F2 私有图.
     *
     * <p>用 CAST(:factoryId AS string) 给 PG 类型 hint — see
     * .claude/rules/database-entity-sync.md "could not determine data type" 章节.
     */
    @Query("""
            SELECT i FROM ImageLibrary i
            WHERE i.id = :id
              AND (i.factoryId = :factoryId
                   OR i.factoryId IS NULL
                   OR i.isPublic = true)
            """)
    Optional<ImageLibrary> findVisibleById(
            @Param("factoryId") String factoryId,
            @Param("id") String id);

    /**
     * 主列表查询 — 多条件过滤 + 跨工厂可见 + 分页.
     *
     * <p>过滤参数为 null 时不过滤. {@code keyword} 模糊匹配 title 或 description.
     *
     * <p>{@code crossFactoryOnly=true} 时仅返回跨工厂图片 ({@code factoryId IS NULL OR isPublic = true}),
     * 用于平台图库视图; false / null 时返回全部可见图片.
     */
    @Query("""
            SELECT i FROM ImageLibrary i
            WHERE (i.factoryId = :factoryId
                   OR i.factoryId IS NULL
                   OR i.isPublic = true)
              AND (CAST(:category AS string) IS NULL OR i.category = :category)
              AND (CAST(:keyword AS string) IS NULL
                   OR LOWER(i.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(i.description) LIKE LOWER(CONCAT('%', :keyword, '%')))
              AND (:crossFactoryOnly = false
                   OR i.factoryId IS NULL
                   OR i.isPublic = true)
            ORDER BY i.createdAt DESC
            """)
    Page<ImageLibrary> search(
            @Param("factoryId") String factoryId,
            @Param("category") Category category,
            @Param("keyword") String keyword,
            @Param("crossFactoryOnly") boolean crossFactoryOnly,
            Pageable pageable);

    /**
     * 使用计数自增 — 单 SQL 原子递增, 避免乐观锁冲突.
     */
    @Modifying
    @Query("UPDATE ImageLibrary i SET i.usageCount = i.usageCount + 1, i.updatedAt = CURRENT_TIMESTAMP WHERE i.id = :id")
    int incrementUsageCount(@Param("id") String id);

    /**
     * 检查 attachmentId 是否已被收录 — 防重复.
     */
    Optional<ImageLibrary> findByAttachmentId(String attachmentId);
}
