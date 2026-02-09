package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * SmartBI 部门数据 Repository
 *
 * <p>管理部门业绩数据，支持按时间范围查询和部门绩效统计。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiDepartmentDataRepository extends JpaRepository<SmartBiDepartmentData, Long> {

    /**
     * 根据工厂ID和日期范围查询部门数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 部门数据列表
     */
    List<SmartBiDepartmentData> findByFactoryIdAndRecordDateBetween(String factoryId,
                                                                     LocalDate start,
                                                                     LocalDate end);

    /**
     * 根据工厂ID和部门名称查询部门数据
     *
     * @param factoryId 工厂ID
     * @param department 部门名称
     * @return 部门数据列表
     */
    List<SmartBiDepartmentData> findByFactoryIdAndDepartment(String factoryId,
                                                              String department);

    /**
     * 按部门统计绩效数据
     *
     * @param factoryId 工厂ID
     * @param start 开始日期
     * @param end 结束日期
     * @return 部门绩效统计 [department, salesAmount, salesTarget, costAmount]
     */
    @Query("SELECT d.department, SUM(d.salesAmount), SUM(d.salesTarget), SUM(d.costAmount) " +
           "FROM SmartBiDepartmentData d WHERE d.factoryId = :factoryId " +
           "AND d.recordDate BETWEEN :start AND :end GROUP BY d.department " +
           "ORDER BY SUM(d.salesAmount) DESC")
    List<Object[]> findDepartmentPerformance(@Param("factoryId") String factoryId,
                                              @Param("start") LocalDate start,
                                              @Param("end") LocalDate end);

    /**
     * 删除指定上传ID关联的部门数据
     *
     * @param uploadId 上传记录ID
     */
    @Modifying
    void deleteByUploadId(Long uploadId);
}
