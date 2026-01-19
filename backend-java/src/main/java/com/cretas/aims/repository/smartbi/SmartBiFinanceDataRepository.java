package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.enums.RecordType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * SmartBI 财务数据 Repository
 *
 * <p>管理财务数据（成本、应收款等），支持按类型和日期范围查询、按分类统计。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiFinanceDataRepository extends JpaRepository<SmartBiFinanceData, Long> {

    /**
     * 根据工厂ID、记录类型和日期范围查询财务数据
     *
     * @param factoryId 工厂ID
     * @param type 记录类型（COST/AR等）
     * @param start 开始日期
     * @param end 结束日期
     * @return 财务数据列表
     */
    List<SmartBiFinanceData> findByFactoryIdAndRecordTypeAndRecordDateBetween(String factoryId,
                                                                               RecordType type,
                                                                               LocalDate start,
                                                                               LocalDate end);

    /**
     * 按分类统计成本数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 成本分类统计 [category, totalCost, materialCost, laborCost, overheadCost]
     */
    @Query("SELECT f.category, SUM(f.totalCost), SUM(f.materialCost), SUM(f.laborCost), SUM(f.overheadCost) " +
           "FROM SmartBiFinanceData f WHERE f.factoryId = :factoryId AND f.recordType = 'COST' " +
           "AND f.recordDate BETWEEN :start AND :end GROUP BY f.category")
    List<Object[]> findCostByCategory(@Param("factoryId") String factoryId,
                                      @Param("start") LocalDate start,
                                      @Param("end") LocalDate end);

    /**
     * 按客户统计应收款数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 客户应收款统计 [customerName, receivableAmount, collectionAmount, avgAgingDays]
     */
    @Query("SELECT f.customerName, SUM(f.receivableAmount), SUM(f.collectionAmount), AVG(f.agingDays) " +
           "FROM SmartBiFinanceData f WHERE f.factoryId = :factoryId AND f.recordType = 'AR' " +
           "AND f.recordDate BETWEEN :start AND :end GROUP BY f.customerName")
    List<Object[]> findARByCustomer(@Param("factoryId") String factoryId,
                                    @Param("start") LocalDate start,
                                    @Param("end") LocalDate end);

    /**
     * 根据工厂ID和日期范围查询所有类型的财务数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 财务数据列表
     */
    List<SmartBiFinanceData> findByFactoryIdAndRecordDateBetween(String factoryId,
                                                                  LocalDate start,
                                                                  LocalDate end);

    /**
     * 删除指定上传ID关联的财务数据
     *
     * @param uploadId 上传记录ID
     */
    @Modifying
    void deleteByUploadId(Long uploadId);
}
