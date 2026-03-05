package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * SmartBI 销售数据 Repository
 *
 * <p>管理销售数据，支持按时间范围查询、按销售员/部门/区域分组统计。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiSalesDataRepository extends JpaRepository<SmartBiSalesData, Long> {

    /**
     * 根据工厂ID和订单日期范围查询销售数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 销售数据列表
     */
    List<SmartBiSalesData> findByFactoryIdAndOrderDateBetween(String factoryId,
                                                               LocalDate start,
                                                               LocalDate end);

    /**
     * 按销售员分组统计销售数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 销售员统计数据 [salespersonName, totalAmount, totalQuantity]
     */
    @Query("SELECT s.salespersonName, SUM(s.amount), SUM(s.quantity) FROM SmartBiSalesData s " +
           "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
           "GROUP BY s.salespersonName ORDER BY SUM(s.amount) DESC")
    List<Object[]> findSalesBySalesperson(@Param("factoryId") String factoryId,
                                          @Param("start") LocalDate start,
                                          @Param("end") LocalDate end);

    /**
     * 按部门分组统计销售金额
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 部门统计数据 [department, totalAmount]
     */
    @Query("SELECT s.department, SUM(s.amount) FROM SmartBiSalesData s " +
           "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
           "GROUP BY s.department ORDER BY SUM(s.amount) DESC")
    List<Object[]> findSalesByDepartment(@Param("factoryId") String factoryId,
                                         @Param("start") LocalDate start,
                                         @Param("end") LocalDate end);

    /**
     * 按区域分组统计销售金额
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 区域统计数据 [region, totalAmount]
     */
    @Query("SELECT s.region, SUM(s.amount) FROM SmartBiSalesData s " +
           "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
           "GROUP BY s.region ORDER BY SUM(s.amount) DESC")
    List<Object[]> findSalesByRegion(@Param("factoryId") String factoryId,
                                     @Param("start") LocalDate start,
                                     @Param("end") LocalDate end);

    /**
     * KPI 聚合查询: 一次查询返回总销售额, 总数量, 总利润, 总成本, 总目标, 订单数(distinct productId)
     */
    @Query("SELECT COALESCE(SUM(s.amount),0), COALESCE(SUM(s.quantity),0), " +
           "COALESCE(SUM(s.profit),0), COALESCE(SUM(s.cost),0), " +
           "COALESCE(SUM(s.monthlyTarget),0), COUNT(DISTINCT s.productId) " +
           "FROM SmartBiSalesData s WHERE s.factoryId = :factoryId " +
           "AND s.orderDate BETWEEN :start AND :end")
    Object[] findKpiSummary(@Param("factoryId") String factoryId,
                            @Param("start") LocalDate start,
                            @Param("end") LocalDate end);

    /**
     * 按日期聚合销售趋势 (用于趋势图，替代全量加载)
     */
    @Query("SELECT s.orderDate, SUM(s.amount), SUM(s.quantity) FROM SmartBiSalesData s " +
           "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
           "GROUP BY s.orderDate ORDER BY s.orderDate")
    List<Object[]> findDailySalesTrend(@Param("factoryId") String factoryId,
                                       @Param("start") LocalDate start,
                                       @Param("end") LocalDate end);

    /**
     * 按日期+部门聚合 (用于部门趋势对比，替代全量加载)
     */
    @Query("SELECT s.orderDate, s.department, SUM(s.amount) FROM SmartBiSalesData s " +
           "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
           "GROUP BY s.orderDate, s.department ORDER BY s.orderDate")
    List<Object[]> findDepartmentDailyTrend(@Param("factoryId") String factoryId,
                                            @Param("start") LocalDate start,
                                            @Param("end") LocalDate end);

    /**
     * 按产品类别分组统计 (用于饼图)
     */
    @Query("SELECT s.productCategory, SUM(s.amount) FROM SmartBiSalesData s " +
           "WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end " +
           "GROUP BY s.productCategory ORDER BY SUM(s.amount) DESC")
    List<Object[]> findSalesByProductCategory(@Param("factoryId") String factoryId,
                                              @Param("start") LocalDate start,
                                              @Param("end") LocalDate end);

    /**
     * 根据上传ID查询销售数据
     *
     * @param uploadId 上传记录ID
     * @return 销售数据列表
     */
    List<SmartBiSalesData> findByUploadId(Long uploadId);

    /**
     * 删除指定上传ID关联的销售数据
     *
     * @param uploadId 上传记录ID
     */
    @Modifying
    void deleteByUploadId(Long uploadId);

    /**
     * 获取指定工厂销售数据的日期范围（最小和最大订单日期）
     *
     * @param factoryId 工厂ID
     * @return Object[]{minDate, maxDate}，如果没有数据则返回 null
     */
    @Query("SELECT MIN(s.orderDate), MAX(s.orderDate) FROM SmartBiSalesData s WHERE s.factoryId = :factoryId")
    Object[] findDateRangeByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 检查指定日期范围内是否存在数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 数据记录数
     */
    @Query("SELECT COUNT(s) FROM SmartBiSalesData s WHERE s.factoryId = :factoryId AND s.orderDate BETWEEN :start AND :end")
    Long countByFactoryIdAndDateRange(@Param("factoryId") String factoryId, @Param("start") LocalDate start, @Param("end") LocalDate end);
}
