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
     * 删除指定上传ID关联的销售数据
     *
     * @param uploadId 上传记录ID
     */
    @Modifying
    void deleteByUploadId(Long uploadId);
}
