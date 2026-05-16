package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.SalesOrderShortageReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SalesOrderShortageReportRepository extends JpaRepository<SalesOrderShortageReport, String> {

    /**
     * 取销售订单的最新报告 (一单一报告 — 软删除过滤通过实体 {@code @Where}).
     */
    Optional<SalesOrderShortageReport> findByFactoryIdAndSalesOrderId(String factoryId, String salesOrderId);
}
