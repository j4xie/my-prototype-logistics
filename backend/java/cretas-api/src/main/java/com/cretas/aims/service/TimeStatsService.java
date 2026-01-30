package com.cretas.aims.service;

import com.cretas.aims.dto.TimeStatsDTO;
import java.time.LocalDate;
import java.util.List;
/**
 * 时间统计服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface TimeStatsService {
    /**
     * 获取日统计
     */
    TimeStatsDTO getDailyStats(String factoryId, LocalDate date);
     /**
     * 获取日期范围内的日统计
      */
    TimeStatsDTO getDailyStatsRange(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取周统计
      */
    TimeStatsDTO getWeeklyStats(String factoryId, Integer year, Integer week);
     /**
     * 获取月统计
      */
    TimeStatsDTO getMonthlyStats(String factoryId, Integer year, Integer month);
     /**
     * 获取年统计
      */
    TimeStatsDTO getYearlyStats(String factoryId, Integer year);
     /**
     * 按工作类型统计
      */
    TimeStatsDTO getStatsByWorkType(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 按部门统计
      */
    TimeStatsDTO getStatsByDepartment(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取生产力分析
      */
    TimeStatsDTO.ProductivityAnalysis getProductivityAnalysis(String factoryId,
                                                              LocalDate startDate,
                                                              LocalDate endDate);
     /**
     * 获取员工时间统计
      */
    List<TimeStatsDTO.WorkerTimeStats> getWorkerTimeStats(String factoryId,
                                                          LocalDate startDate,
                                                          LocalDate endDate,
                                                          Integer topN);
     /**
     * 获取员工个人时间统计
      */
    TimeStatsDTO.WorkerTimeStats getWorkerTimeStatsById(String factoryId,
                                                        Integer workerId,
                                                        LocalDate startDate,
                                                        LocalDate endDate);
     /**
     * 获取实时统计
      */
    TimeStatsDTO getRealtimeStats(String factoryId);
     /**
     * 获取对比分析
      */
    TimeStatsDTO getComparativeStats(String factoryId,
                                     LocalDate period1Start,
                                     LocalDate period1End,
                                     LocalDate period2Start,
                                     LocalDate period2End);
     /**
     * 获取异常统计
      */
    TimeStatsDTO getAnomalyStats(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 导出统计报告
      */
    String exportStatsReport(String factoryId, LocalDate startDate, LocalDate endDate, String format);
     /**
     * 获取统计趋势
      */
    List<TimeStatsDTO.DailyStats> getStatsTrend(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 清理过期统计数据
      */
    void cleanupOldStats(String factoryId, Integer retentionDays);
     /**
     * 重新计算统计
      */
    void recalculateStats(String factoryId, LocalDate date);
}
