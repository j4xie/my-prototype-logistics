package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiUsageRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * SmartBI 使用记录 Repository
 *
 * <p>管理AI使用记录，支持统计今日使用次数和费用汇总。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiUsageRecordRepository extends JpaRepository<SmartBiUsageRecord, Long> {

    /**
     * 根据工厂ID和时间范围查询使用记录
     *
     * @param factoryId 工厂ID
     * @param start 开始时间
     * @param end 结束时间
     * @return 使用记录列表
     */
    List<SmartBiUsageRecord> findByFactoryIdAndCreatedAtBetween(String factoryId,
                                                                 LocalDateTime start,
                                                                 LocalDateTime end);

    /**
     * 统计指定工厂今日的使用次数
     * 使用 Native Query 解决 DATE() 函数在 JPQL 中不支持的问题
     *
     * @param factoryId 工厂ID
     * @param date 统计日期
     * @return 使用次数
     */
    @Query(value = "SELECT COUNT(*) FROM smart_bi_usage_records u WHERE u.factory_id = :factoryId " +
           "AND DATE(u.created_at) = :date", nativeQuery = true)
    Long countTodayUsage(@Param("factoryId") String factoryId, @Param("date") LocalDate date);

    /**
     * 统计指定工厂在指定时间段内的费用总和
     *
     * @param factoryId 工厂ID
     * @param start 开始时间
     * @param end 结束时间
     * @return 费用总和
     */
    @Query("SELECT SUM(u.costAmount) FROM SmartBiUsageRecord u WHERE u.factoryId = :factoryId " +
           "AND u.createdAt BETWEEN :start AND :end")
    BigDecimal sumCostByPeriod(@Param("factoryId") String factoryId,
                               @Param("start") LocalDateTime start,
                               @Param("end") LocalDateTime end);
}
