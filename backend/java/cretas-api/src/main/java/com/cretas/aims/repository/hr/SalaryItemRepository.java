package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.SalaryStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * SalaryItem 数据访问层.
 *
 * @author Cretas Team — P1-40 H-WAGE-FULL MVP
 * @since 2026-05-17
 */
@Repository
public interface SalaryItemRepository extends JpaRepository<SalaryItem, String> {

    Optional<SalaryItem> findByIdAndFactoryId(String id, String factoryId);

    /** R4 防呆: 同 factory+user+yearMonth 已存在记录 (避免重复创建). */
    Optional<SalaryItem> findByFactoryIdAndUserIdAndYearMonth(
            String factoryId, Long userId, String yearMonth);

    Page<SalaryItem> findByFactoryId(String factoryId, Pageable pageable);

    Page<SalaryItem> findByFactoryIdAndYearMonth(
            String factoryId, String yearMonth, Pageable pageable);

    Page<SalaryItem> findByFactoryIdAndStatus(
            String factoryId, SalaryStatus status, Pageable pageable);

    Page<SalaryItem> findByFactoryIdAndYearMonthAndStatus(
            String factoryId, String yearMonth, SalaryStatus status, Pageable pageable);

    Page<SalaryItem> findByFactoryIdAndUserId(
            String factoryId, Long userId, Pageable pageable);

    /** 月度汇总: 工厂某月份的总应发 + 总社保 + 总税 + 总实发. */
    @Query("""
            SELECT SUM(s.baseSalary), SUM(s.socialInsuranceEmployee),
                   SUM(s.personalTax), SUM(s.netSalary)
            FROM SalaryItem s
            WHERE s.factoryId = :factoryId AND s.yearMonth = :yearMonth
            """)
    Object[] sumMonthlyTotals(
            @Param("factoryId") String factoryId,
            @Param("yearMonth") String yearMonth);

    /** 工厂某月份所有 user 的工资清单 (HR 导出用). */
    List<SalaryItem> findByFactoryIdAndYearMonthOrderByUserId(
            String factoryId, String yearMonth);
}
