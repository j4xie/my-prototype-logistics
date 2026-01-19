package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI Skill Repository
 *
 * <p>Data access layer for SmartBiSkill entities. Provides methods for
 * querying skills by various criteria including name, category, and triggers.</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiSkillRepository extends JpaRepository<SmartBiSkill, Long> {

    /**
     * Find a skill by its unique name
     *
     * @param name the skill name (e.g., "material-batch-query")
     * @return the skill if found
     */
    Optional<SmartBiSkill> findByName(String name);

    /**
     * Find all enabled skills
     *
     * @return list of enabled skills ordered by priority
     */
    List<SmartBiSkill> findByEnabledTrueOrderByPriorityAsc();

    /**
     * Find skills by category
     *
     * @param category the skill category (e.g., "analytics", "alerting")
     * @return list of skills in the category
     */
    List<SmartBiSkill> findByCategoryAndEnabledTrueOrderByPriorityAsc(String category);

    /**
     * Find skills whose triggers contain the given keyword (JSON array contains)
     * Uses MySQL JSON_CONTAINS function
     *
     * @param keyword the trigger keyword to search for
     * @return list of matching skills
     */
    @Query(value = "SELECT * FROM smart_bi_skill WHERE enabled = true " +
            "AND JSON_SEARCH(triggers, 'one', :keyword) IS NOT NULL " +
            "AND deleted_at IS NULL " +
            "ORDER BY priority ASC", nativeQuery = true)
    List<SmartBiSkill> findByTriggersContaining(@Param("keyword") String keyword);

    /**
     * Search skills by display name or description (fuzzy match)
     *
     * @param searchTerm the search term
     * @return list of matching skills
     */
    @Query("SELECT s FROM SmartBiSkill s WHERE s.enabled = true AND " +
            "(LOWER(s.displayName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
            "LOWER(s.description) LIKE LOWER(CONCAT('%', :searchTerm, '%'))) " +
            "ORDER BY s.priority ASC")
    List<SmartBiSkill> searchByDisplayNameOrDescription(@Param("searchTerm") String searchTerm);

    /**
     * Check if a skill with the given name exists
     *
     * @param name the skill name
     * @return true if exists
     */
    boolean existsByName(String name);

    /**
     * Count enabled skills by category
     *
     * @param category the skill category
     * @return count of enabled skills in category
     */
    long countByCategoryAndEnabledTrue(String category);

    /**
     * Find all distinct categories
     *
     * @return list of unique category names
     */
    @Query("SELECT DISTINCT s.category FROM SmartBiSkill s WHERE s.category IS NOT NULL AND s.enabled = true")
    List<String> findAllCategories();

    /**
     * Find skills that require a specific permission
     *
     * @param permission the required permission
     * @return list of skills requiring the permission
     */
    List<SmartBiSkill> findByRequiredPermissionAndEnabledTrue(String permission);

    /**
     * Find skills by version
     *
     * @param version the skill version
     * @return list of skills with the specified version
     */
    List<SmartBiSkill> findByVersion(String version);
}
