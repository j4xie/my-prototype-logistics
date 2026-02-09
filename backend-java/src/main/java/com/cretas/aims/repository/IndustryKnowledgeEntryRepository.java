package com.cretas.aims.repository;

import com.cretas.aims.entity.IndustryKnowledgeEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 行业知识条目 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Repository
public interface IndustryKnowledgeEntryRepository extends JpaRepository<IndustryKnowledgeEntry, String> {

    /**
     * 根据主题代码查找活跃的知识条目
     */
    List<IndustryKnowledgeEntry> findByTopicCodeAndIsActiveTrue(String topicCode);

    /**
     * 查找所有活跃的知识条目
     */
    List<IndustryKnowledgeEntry> findByIsActiveTrue();

    /**
     * 根据主题代码查找最新版本的知识
     */
    @Query("SELECT k FROM IndustryKnowledgeEntry k WHERE k.topicCode = :topicCode AND k.isActive = true ORDER BY k.version DESC")
    List<IndustryKnowledgeEntry> findLatestByTopicCode(String topicCode);

    /**
     * 根据来源类型查找知识条目
     */
    List<IndustryKnowledgeEntry> findBySourceTypeAndIsActiveTrue(String sourceType);

    /**
     * 检查主题代码是否存在
     */
    boolean existsByTopicCodeAndIsActiveTrue(String topicCode);
}
