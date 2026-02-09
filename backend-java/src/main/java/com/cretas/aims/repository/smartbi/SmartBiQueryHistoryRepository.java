package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiQueryHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * SmartBI 查询历史 Repository
 *
 * <p>管理用户查询历史记录，支持会话查询、最近查询和热门意图统计。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiQueryHistoryRepository extends JpaRepository<SmartBiQueryHistory, Long> {

    /**
     * 根据工厂ID和会话ID查询历史记录，按创建时间升序排列
     *
     * @param factoryId 工厂ID
     * @param sessionId 会话ID
     * @return 查询历史列表
     */
    List<SmartBiQueryHistory> findByFactoryIdAndSessionIdOrderByCreatedAtAsc(String factoryId,
                                                                               String sessionId);

    /**
     * 查询指定工厂最近的10条查询历史，按创建时间降序排列
     *
     * @param factoryId 工厂ID
     * @return 最近查询历史列表
     */
    List<SmartBiQueryHistory> findTop10ByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * 统计指定工厂的热门意图（按查询次数排序）
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数（用于限制返回数量）
     * @return 意图和对应查询次数的数组列表 [intent, count]
     */
    @Query("SELECT q.intent, COUNT(q) FROM SmartBiQueryHistory q WHERE q.factoryId = :factoryId " +
           "GROUP BY q.intent ORDER BY COUNT(q) DESC")
    List<Object[]> findTopIntents(@Param("factoryId") String factoryId, Pageable pageable);
}
