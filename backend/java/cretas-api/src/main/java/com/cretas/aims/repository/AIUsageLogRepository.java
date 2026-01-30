package com.cretas.aims.repository;

import com.cretas.aims.entity.AIUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AI使用日志Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Repository
public interface AIUsageLogRepository extends JpaRepository<AIUsageLog, Long> {

    /**
     * 统计指定工厂在指定周次的AI调用次数
     *
     * @param factoryId 工厂ID
     * @param weekNumber 周次编号 (例如: '2025-W44')
     * @return 调用次数
     */
    @Query("SELECT COUNT(a) FROM AIUsageLog a WHERE a.factoryId = :factoryId AND a.weekNumber = :weekNumber")
    Long countByFactoryIdAndWeekNumber(@Param("factoryId") String factoryId,
                                       @Param("weekNumber") String weekNumber);

    /**
     * 获取指定工厂的所有AI使用记录
     *
     * @param factoryId 工厂ID
     * @return AI使用日志列表
     */
    List<AIUsageLog> findByFactoryId(String factoryId);

    /**
     * 获取指定周次的所有AI使用记录
     *
     * @param weekNumber 周次编号
     * @return AI使用日志列表
     */
    List<AIUsageLog> findByWeekNumber(String weekNumber);

    /**
     * 统计指定工厂的历史总调用次数
     *
     * @param factoryId 工厂ID
     * @return 历史总调用次数
     */
    Long countByFactoryId(String factoryId);
}
