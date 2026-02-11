package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.service.smartbi.ProductionDataExportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 生产数据导出服务实现
 * 使用原生SQL聚合查询从 production_batches 表提取多维度生产统计数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Service
public class ProductionDataExportServiceImpl implements ProductionDataExportService {

    private static final Logger log = LoggerFactory.getLogger(ProductionDataExportServiceImpl.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private ProductionBatchRepository batchRepository;

    @Override
    public List<Map<String, Object>> getDailyProductionSummary(String factoryId, LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT " +
                "DATE(created_at) as production_date, " +
                "COUNT(*) as batch_count, " +
                "COALESCE(SUM(actual_quantity), 0) as total_output, " +
                "COALESCE(SUM(good_quantity), 0) as good_output, " +
                "COALESCE(AVG(yield_rate), 0) as avg_yield_rate, " +
                "COALESCE(SUM(total_cost), 0) as total_cost, " +
                "COALESCE(AVG(unit_cost), 0) as avg_unit_cost, " +
                "COALESCE(AVG(efficiency), 0) as avg_efficiency, " +
                "COALESCE(SUM(defect_quantity), 0) as total_defects, " +
                "COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_batches " +
                "FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND created_at BETWEEN :start AND :end " +
                "AND deleted_at IS NULL " +
                "GROUP BY DATE(created_at) " +
                "ORDER BY DATE(created_at)";

        Query query = entityManager.createNativeQuery(sql);
        query.setParameter("factoryId", factoryId);
        query.setParameter("start", start);
        query.setParameter("end", end);

        @SuppressWarnings("unchecked")
        List<Object[]> results = query.getResultList();
        return mapResultsToList(results,
                "日期", "批次数", "总产量", "合格产量", "平均良率(%)",
                "总成本", "平均单位成本", "平均效率(%)", "缺陷数", "完成批次");
    }

    @Override
    public List<Map<String, Object>> getProductionByProduct(String factoryId, LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT " +
                "COALESCE(product_name, '未知产品') as product_name, " +
                "COUNT(*) as batch_count, " +
                "COALESCE(SUM(actual_quantity), 0) as total_output, " +
                "COALESCE(AVG(yield_rate), 0) as avg_yield_rate, " +
                "COALESCE(SUM(total_cost), 0) as total_cost, " +
                "COALESCE(AVG(unit_cost), 0) as avg_unit_cost, " +
                "COALESCE(SUM(defect_quantity), 0) as total_defects " +
                "FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND created_at BETWEEN :start AND :end " +
                "AND deleted_at IS NULL " +
                "GROUP BY product_name " +
                "ORDER BY SUM(actual_quantity) DESC";

        Query query = entityManager.createNativeQuery(sql);
        query.setParameter("factoryId", factoryId);
        query.setParameter("start", start);
        query.setParameter("end", end);

        @SuppressWarnings("unchecked")
        List<Object[]> results = query.getResultList();
        return mapResultsToList(results,
                "产品名称", "批次数", "总产量", "平均良率(%)", "总成本", "平均单位成本", "缺陷数");
    }

    @Override
    public List<Map<String, Object>> getProductionByEquipment(String factoryId, LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT " +
                "COALESCE(CAST(equipment_id AS VARCHAR), '未分配') as equipment_id, " +
                "COALESCE(equipment_name, '未知设备') as equipment_name, " +
                "COUNT(*) as batch_count, " +
                "COALESCE(SUM(actual_quantity), 0) as total_output, " +
                "COALESCE(AVG(yield_rate), 0) as avg_yield_rate, " +
                "COALESCE(AVG(efficiency), 0) as avg_efficiency, " +
                "COALESCE(SUM(work_duration_minutes), 0) as total_work_minutes, " +
                "COALESCE(SUM(equipment_cost), 0) as equipment_cost " +
                "FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND created_at BETWEEN :start AND :end " +
                "AND deleted_at IS NULL " +
                "GROUP BY equipment_id, equipment_name " +
                "ORDER BY SUM(actual_quantity) DESC";

        Query query = entityManager.createNativeQuery(sql);
        query.setParameter("factoryId", factoryId);
        query.setParameter("start", start);
        query.setParameter("end", end);

        @SuppressWarnings("unchecked")
        List<Object[]> results = query.getResultList();
        return mapResultsToList(results,
                "设备ID", "设备名称", "批次数", "总产量", "平均良率(%)",
                "平均效率(%)", "总工作时长(分钟)", "设备成本");
    }

    @Override
    public List<Map<String, Object>> getProductionByPersonnel(String factoryId, LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT " +
                "COALESCE(supervisor_name, '未知') as supervisor_name, " +
                "COUNT(*) as batch_count, " +
                "COALESCE(SUM(actual_quantity), 0) as total_output, " +
                "COALESCE(AVG(yield_rate), 0) as avg_yield_rate, " +
                "COALESCE(AVG(efficiency), 0) as avg_efficiency, " +
                "COALESCE(SUM(labor_cost), 0) as labor_cost, " +
                "COALESCE(SUM(worker_count), 0) as total_workers " +
                "FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND created_at BETWEEN :start AND :end " +
                "AND deleted_at IS NULL " +
                "GROUP BY supervisor_name " +
                "ORDER BY SUM(actual_quantity) DESC";

        Query query = entityManager.createNativeQuery(sql);
        query.setParameter("factoryId", factoryId);
        query.setParameter("start", start);
        query.setParameter("end", end);

        @SuppressWarnings("unchecked")
        List<Object[]> results = query.getResultList();
        return mapResultsToList(results,
                "负责人", "批次数", "总产量", "平均良率(%)", "平均效率(%)", "人工成本", "总人数");
    }

    @Override
    public Map<String, Object> getProductionAnalysisDashboard(String factoryId, String period) {
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start;
        if ("week".equals(period)) {
            start = end.minus(7, ChronoUnit.DAYS);
        } else if ("quarter".equals(period)) {
            start = end.minus(90, ChronoUnit.DAYS);
        } else if ("year".equals(period)) {
            start = end.minus(365, ChronoUnit.DAYS);
        } else {
            // default: month
            start = end.minus(30, ChronoUnit.DAYS);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("dailySummary", getDailyProductionSummary(factoryId, start, end));
        result.put("byProduct", getProductionByProduct(factoryId, start, end));
        result.put("byEquipment", getProductionByEquipment(factoryId, start, end));
        result.put("byPersonnel", getProductionByPersonnel(factoryId, start, end));
        result.put("period", period);
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());

        return result;
    }

    /**
     * 将原生SQL查询结果映射为 List<Map<String, Object>>
     * 自动对浮点数进行2位小数四舍五入
     *
     * @param rows        查询结果行
     * @param columnNames 列名（中文，用于前端展示）
     * @return 映射后的列表
     */
    private List<Map<String, Object>> mapResultsToList(List<Object[]> rows, String... columnNames) {
        return rows.stream().map(row -> {
            Map<String, Object> map = new LinkedHashMap<>();
            for (int i = 0; i < columnNames.length && i < row.length; i++) {
                Object val = row[i];
                if (val instanceof Number) {
                    Number num = (Number) val;
                    // Round doubles/floats to 2 decimal places
                    if (val instanceof Double || val instanceof Float) {
                        map.put(columnNames[i], Math.round(num.doubleValue() * 100.0) / 100.0);
                    } else {
                        map.put(columnNames[i], num);
                    }
                } else {
                    map.put(columnNames[i], val != null ? val.toString() : "");
                }
            }
            return map;
        }).collect(Collectors.toList());
    }
}
