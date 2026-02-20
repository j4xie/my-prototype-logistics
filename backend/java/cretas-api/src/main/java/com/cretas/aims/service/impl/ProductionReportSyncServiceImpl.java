package com.cretas.aims.service.impl;

import com.cretas.aims.entity.ProductionReport;
import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;
import com.cretas.aims.repository.ProductionReportRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiDynamicDataRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgFieldDefinitionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cretas.aims.entity.User;
import com.cretas.aims.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 生产报工数据自动同步到SmartBI三表系统
 *
 * 核心流程:
 * 1. 从cretas_db读取未同步的production_reports
 * 2. 按report_type分组 (PROGRESS / HOURS)
 * 3. 为每种类型创建SmartBiPgExcelUpload (source='AUTO_PRODUCTION')
 * 4. 创建固定schema的field_definitions
 * 5. 将报工数据转换为JSONB行写入smart_bi_dynamic_data
 * 6. 标记production_reports.synced_to_smartbi = true
 *
 * P1-4: 幂等性保障 — 同一天重复触发会先清理旧数据再写入
 * P1-5: HOURS工序语义优化 — 区分数据来源，"工序/产品"标签
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true", matchIfMissing = false)
public class ProductionReportSyncServiceImpl {

    private static final String AUTO_SYNC_SOURCE = "AUTO_PRODUCTION";
    private static final String PROGRESS_SHEET_NAME = "生产进度汇总";
    private static final String HOURS_SHEET_NAME = "工时汇总";
    private static final String EFFICIENCY_SHEET_NAME = "人效汇总";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Autowired
    private ProductionReportRepository reportRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SmartBiPgExcelUploadRepository uploadRepository;

    @Autowired
    private SmartBiPgFieldDefinitionRepository fieldDefRepository;

    @Autowired
    private SmartBiDynamicDataRepository dynamicDataRepository;

    /**
     * 同步指定工厂的生产报工数据到SmartBI
     */
    @Transactional("smartbiPostgresTransactionManager")
    public Map<String, Object> syncToSmartBI(String factoryId) {
        log.info("开始SmartBI同步: factoryId={}", factoryId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("factoryId", factoryId);
        result.put("syncTime", LocalDateTime.now().toString());

        List<ProductionReport> unsyncedReports = reportRepository
                .findByFactoryIdAndSyncedToSmartbiFalseAndDeletedAtIsNull(factoryId);

        if (unsyncedReports.isEmpty()) {
            log.info("没有未同步的报工记录: factoryId={}", factoryId);
            result.put("status", "NO_DATA");
            result.put("message", "没有需要同步的报工记录");
            result.put("totalSynced", 0);
            return result;
        }

        log.info("找到{}条未同步报工记录: factoryId={}", unsyncedReports.size(), factoryId);

        Map<String, List<ProductionReport>> groupedByType = unsyncedReports.stream()
                .collect(Collectors.groupingBy(r -> r.getReportType() != null ? r.getReportType() : "UNKNOWN"));

        int totalSynced = 0;
        List<Map<String, Object>> sheetResults = new ArrayList<>();

        for (Map.Entry<String, List<ProductionReport>> entry : groupedByType.entrySet()) {
            String reportType = entry.getKey();
            List<ProductionReport> reports = entry.getValue();

            try {
                Map<String, Object> sheetResult = syncReportType(factoryId, reportType, reports);
                sheetResults.add(sheetResult);
                totalSynced += reports.size();

                markReportsSynced(reports);
                log.info("已标记{}条{}类型报工为已同步", reports.size(), reportType);
            } catch (Exception e) {
                log.error("同步{}类型报工失败: factoryId={}, error={}", reportType, factoryId, e.getMessage(), e);
                Map<String, Object> failResult = new LinkedHashMap<>();
                failResult.put("reportType", reportType);
                failResult.put("status", "FAILED");
                failResult.put("error", e.getMessage());
                failResult.put("count", reports.size());
                sheetResults.add(failResult);
            }
        }

        // 生成人效汇总表
        try {
            Map<String, Object> efficiencyResult = syncWorkerEfficiency(factoryId, unsyncedReports);
            sheetResults.add(efficiencyResult);
        } catch (Exception e) {
            log.error("人效汇总同步失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            Map<String, Object> failResult = new LinkedHashMap<>();
            failResult.put("reportType", "EFFICIENCY");
            failResult.put("status", "FAILED");
            failResult.put("error", e.getMessage());
            sheetResults.add(failResult);
        }

        result.put("status", "COMPLETED");
        result.put("totalSynced", totalSynced);
        result.put("totalUnsyncedFound", unsyncedReports.size());
        result.put("sheets", sheetResults);
        result.put("message", String.format("同步完成: %d条报工记录写入SmartBI", totalSynced));

        log.info("SmartBI同步完成: factoryId={}, totalSynced={}", factoryId, totalSynced);
        return result;
    }

    /**
     * 同步指定类型的报工数据到SmartBI三表
     */
    @Transactional("smartbiPostgresTransactionManager")
    public Map<String, Object> syncReportType(String factoryId, String reportType, List<ProductionReport> reports) {
        Map<String, Object> sheetResult = new LinkedHashMap<>();
        sheetResult.put("reportType", reportType);
        sheetResult.put("count", reports.size());

        boolean isProgress = ProductionReport.ReportType.PROGRESS.equals(reportType);
        String sheetName = isProgress ? PROGRESS_SHEET_NAME : HOURS_SHEET_NAME;
        String today = LocalDate.now().format(DATE_FMT);
        String fileName = String.format("[自动同步] %s - %s", sheetName, today);

        // P1-4 幂等性: 清理今日已有的同类型数据
        cleanupExistingAutoSync(factoryId, sheetName);

        SmartBiPgExcelUpload upload = SmartBiPgExcelUpload.builder()
                .factoryId(factoryId)
                .fileName(fileName)
                .sheetName(sheetName)
                .detectedTableType(AUTO_SYNC_SOURCE)
                .rowCount(reports.size())
                .columnCount(isProgress ? 7 : 7)
                .uploadStatus(UploadStatus.PARSING)
                .build();

        upload = uploadRepository.save(upload);
        Long uploadId = upload.getId();
        log.info("创建upload记录: uploadId={}, sheetName={}", uploadId, sheetName);

        List<SmartBiPgFieldDefinition> fieldDefs = isProgress
                ? createProgressFieldDefinitions(uploadId)
                : createHoursFieldDefinitions(uploadId);
        fieldDefRepository.saveAll(fieldDefs);

        List<SmartBiDynamicData> dataRows = new ArrayList<>();
        int rowIndex = 0;
        for (ProductionReport report : reports) {
            Map<String, Object> rowData = isProgress
                    ? buildProgressRowData(report)
                    : buildHoursRowData(report);

            SmartBiDynamicData dynamicData = SmartBiDynamicData.builder()
                    .factoryId(factoryId)
                    .uploadId(uploadId)
                    .sheetName(sheetName)
                    .rowIndex(rowIndex++)
                    .rowData(rowData)
                    .period(report.getReportDate() != null ? report.getReportDate().format(DATE_FMT) : null)
                    .category(isProgress ? report.getProcessCategory() : report.getProductName())
                    .build();

            dataRows.add(dynamicData);
        }

        dynamicDataRepository.saveAll(dataRows);

        upload.setUploadStatus(UploadStatus.COMPLETED);
        upload.setRowCount(dataRows.size());
        uploadRepository.save(upload);

        sheetResult.put("status", "SUCCESS");
        sheetResult.put("uploadId", uploadId);
        sheetResult.put("savedRows", dataRows.size());
        sheetResult.put("fieldCount", fieldDefs.size());

        return sheetResult;
    }

    @Transactional
    public void markReportsSynced(List<ProductionReport> reports) {
        for (ProductionReport report : reports) {
            report.setSyncedToSmartbi(true);
        }
        reportRepository.saveAll(reports);
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledSync() {
        log.info("开始定时SmartBI同步任务");
        try {
            List<String> factoryIds = reportRepository.findDistinctFactoryIdsWithUnsyncedReports();
            if (factoryIds.isEmpty()) {
                log.info("定时同步: 没有工厂有未同步数据");
                return;
            }

            log.info("定时同步: 发现{}个工厂有未同步数据", factoryIds.size());
            int totalSynced = 0;
            int factoriesProcessed = 0;

            for (String factoryId : factoryIds) {
                try {
                    Map<String, Object> result = syncToSmartBI(factoryId);
                    Object synced = result.get("totalSynced");
                    if (synced instanceof Number) {
                        totalSynced += ((Number) synced).intValue();
                    }
                    factoriesProcessed++;
                } catch (Exception e) {
                    log.error("定时同步失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
                }
            }

            log.info("定时SmartBI同步完成: {}个工厂, 共同步{}条记录", factoriesProcessed, totalSynced);
        } catch (Exception e) {
            log.error("定时SmartBI同步任务异常: {}", e.getMessage(), e);
        }
    }

    // ==================== 人效汇总同步 ====================

    @Transactional("smartbiPostgresTransactionManager")
    public Map<String, Object> syncWorkerEfficiency(String factoryId, List<ProductionReport> allReports) {
        Map<String, Object> sheetResult = new LinkedHashMap<>();
        sheetResult.put("reportType", "EFFICIENCY");

        // P1-4 幂等性: 清理今日已有的人效汇总数据
        cleanupExistingAutoSync(factoryId, EFFICIENCY_SHEET_NAME);

        Set<Long> workerIds = allReports.stream()
                .map(ProductionReport::getWorkerId)
                .collect(Collectors.toSet());

        Map<Long, String> workerNameMap = new HashMap<>();
        for (Long wid : workerIds) {
            userRepository.findById(wid).ifPresent(user -> {
                String name = user.getFullName();
                if (name == null || name.isBlank()) name = user.getUsername();
                workerNameMap.put(wid, name);
            });
        }

        // P1-5: 按 worker_id + report_date + processCategory 聚合
        // PROGRESS有processCategory字段，HOURS用productName做fallback
        Map<String, WorkerDayAgg> aggMap = new LinkedHashMap<>();
        for (ProductionReport r : allReports) {
            String rawProcess = r.getProcessCategory();
            if ((rawProcess == null || rawProcess.isBlank()) && r.getProductName() != null) {
                rawProcess = r.getProductName();
            }
            if (rawProcess == null || rawProcess.isBlank()) {
                rawProcess = "未分类";
            }
            final String process = rawProcess;

            String key = r.getWorkerId() + "|"
                    + (r.getReportDate() != null ? r.getReportDate().format(DATE_FMT) : "unknown")
                    + "|" + process;
            WorkerDayAgg agg = aggMap.computeIfAbsent(key, k -> new WorkerDayAgg(r.getWorkerId(), r.getReportDate(), process));

            if (ProductionReport.ReportType.PROGRESS.equals(r.getReportType())) {
                agg.addProgress(r);
            } else if (ProductionReport.ReportType.HOURS.equals(r.getReportType())) {
                agg.addHours(r);
            }
        }

        if (aggMap.isEmpty()) {
            sheetResult.put("status", "NO_DATA");
            sheetResult.put("count", 0);
            return sheetResult;
        }

        String today = LocalDate.now().format(DATE_FMT);
        String fileName = String.format("[自动同步] %s - %s", EFFICIENCY_SHEET_NAME, today);

        SmartBiPgExcelUpload upload = SmartBiPgExcelUpload.builder()
                .factoryId(factoryId)
                .fileName(fileName)
                .sheetName(EFFICIENCY_SHEET_NAME)
                .detectedTableType(AUTO_SYNC_SOURCE)
                .rowCount(aggMap.size())
                .columnCount(11)
                .uploadStatus(UploadStatus.PARSING)
                .build();
        upload = uploadRepository.save(upload);
        Long uploadId = upload.getId();

        List<SmartBiPgFieldDefinition> fieldDefs = createEfficiencyFieldDefinitions(uploadId);
        fieldDefRepository.saveAll(fieldDefs);

        List<SmartBiDynamicData> dataRows = new ArrayList<>();
        int rowIndex = 0;
        for (WorkerDayAgg agg : aggMap.values()) {
            String workerName = workerNameMap.getOrDefault(agg.workerId, "员工#" + agg.workerId);
            Map<String, Object> rowData = buildEfficiencyRowData(agg, workerName);

            SmartBiDynamicData data = SmartBiDynamicData.builder()
                    .factoryId(factoryId)
                    .uploadId(uploadId)
                    .sheetName(EFFICIENCY_SHEET_NAME)
                    .rowIndex(rowIndex++)
                    .rowData(rowData)
                    .period(agg.reportDate != null ? agg.reportDate.format(DATE_FMT) : null)
                    .category(workerName)
                    .build();
            dataRows.add(data);
        }

        dynamicDataRepository.saveAll(dataRows);

        upload.setUploadStatus(UploadStatus.COMPLETED);
        upload.setRowCount(dataRows.size());
        uploadRepository.save(upload);

        sheetResult.put("status", "SUCCESS");
        sheetResult.put("uploadId", uploadId);
        sheetResult.put("savedRows", dataRows.size());
        sheetResult.put("fieldCount", fieldDefs.size());
        sheetResult.put("count", dataRows.size());

        log.info("人效汇总同步完成: uploadId={}, workers={}, rows={}", uploadId, workerNameMap.size(), dataRows.size());
        return sheetResult;
    }

    /**
     * 员工日聚合辅助类 (P1-5: 增加数据来源追踪)
     */
    private static class WorkerDayAgg {
        final Long workerId;
        final LocalDate reportDate;
        final String processCategory;
        boolean hasProgress = false;
        boolean hasHours = false;
        BigDecimal totalOutput = BigDecimal.ZERO;
        BigDecimal totalGood = BigDecimal.ZERO;
        BigDecimal totalDefect = BigDecimal.ZERO;
        int totalMinutes = 0;
        BigDecimal totalVolume = BigDecimal.ZERO;
        List<String> products = new ArrayList<>();

        WorkerDayAgg(Long workerId, LocalDate reportDate, String processCategory) {
            this.workerId = workerId;
            this.reportDate = reportDate;
            this.processCategory = processCategory;
        }

        void addProgress(ProductionReport r) {
            hasProgress = true;
            if (r.getOutputQuantity() != null) totalOutput = totalOutput.add(r.getOutputQuantity());
            if (r.getGoodQuantity() != null) totalGood = totalGood.add(r.getGoodQuantity());
            if (r.getDefectQuantity() != null) totalDefect = totalDefect.add(r.getDefectQuantity());
            if (r.getProductName() != null && !products.contains(r.getProductName())) {
                products.add(r.getProductName());
            }
        }

        void addHours(ProductionReport r) {
            hasHours = true;
            if (r.getTotalWorkMinutes() != null) totalMinutes += r.getTotalWorkMinutes();
            if (r.getOperationVolume() != null) totalVolume = totalVolume.add(r.getOperationVolume());
            if (r.getProductName() != null && !products.contains(r.getProductName())) {
                products.add(r.getProductName());
            }
        }
    }

    // P1-5: 增加"数据来源"和"产品明细"列
    private Map<String, Object> buildEfficiencyRowData(WorkerDayAgg agg, String workerName) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("员工姓名", workerName);
        row.put("日期", agg.reportDate != null ? agg.reportDate.format(DATE_FMT) : null);
        row.put("工序/产品", agg.processCategory);
        row.put("数据来源", agg.hasProgress && agg.hasHours ? "进度+工时"
                : agg.hasProgress ? "进度报工" : "工时报工");
        row.put("产品明细", String.join("、", agg.products));
        row.put("产出数量", agg.totalOutput.doubleValue());
        row.put("合格数量", agg.totalGood.doubleValue());

        double defectRate = 0;
        if (agg.totalOutput.compareTo(BigDecimal.ZERO) > 0) {
            defectRate = agg.totalDefect.multiply(BigDecimal.valueOf(100))
                    .divide(agg.totalOutput, 2, RoundingMode.HALF_UP).doubleValue();
        }
        row.put("不良率(%)", defectRate);

        row.put("工作时长(分钟)", agg.totalMinutes);

        double efficiency = 0;
        if (agg.totalMinutes > 0) {
            double hours = agg.totalMinutes / 60.0;
            efficiency = agg.totalOutput.doubleValue() / hours;
            efficiency = Math.round(efficiency * 100.0) / 100.0;
        }
        row.put("人效(产出/小时)", efficiency);

        row.put("操作量", agg.totalVolume.doubleValue());

        return row;
    }

    // P1-5: 更新字段定义 — "工序/产品" + "数据来源" + "产品明细"
    private List<SmartBiPgFieldDefinition> createEfficiencyFieldDefinitions(Long uploadId) {
        List<SmartBiPgFieldDefinition> defs = new ArrayList<>();

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("员工姓名").standardName("worker_name")
                .fieldType("STRING").semanticType("dimension").chartRole("x_axis")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(0).build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("日期").standardName("report_date")
                .fieldType("DATE").semanticType("time").chartRole("series")
                .isDimension(false).isMeasure(false).isTime(true).displayOrder(1)
                .formatPattern("yyyy-MM-dd").build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("工序/产品").standardName("process_category")
                .fieldType("STRING").semanticType("dimension").chartRole("series")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(2).build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("数据来源").standardName("data_source")
                .fieldType("STRING").semanticType("dimension").chartRole("filter")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(3).build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("产品明细").standardName("product_detail")
                .fieldType("STRING").semanticType("dimension").chartRole("filter")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(4).build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("产出数量").standardName("output_quantity")
                .fieldType("NUMBER").semanticType("quantity").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(5)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("合格数量").standardName("good_quantity")
                .fieldType("NUMBER").semanticType("quantity").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(6)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("不良率(%)").standardName("defect_rate")
                .fieldType("NUMBER").semanticType("ratio").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(7)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("工作时长(分钟)").standardName("work_minutes")
                .fieldType("NUMBER").semanticType("measure").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(8)
                .formatPattern("#,##0").build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("人效(产出/小时)").standardName("efficiency_per_hour")
                .fieldType("NUMBER").semanticType("ratio").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(9)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder()
                .uploadId(uploadId).originalName("操作量").standardName("operation_volume")
                .fieldType("NUMBER").semanticType("measure").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(10)
                .formatPattern("#,##0.##").build());

        return defs;
    }

    // ==================== P1-4: 幂等性清理 ====================

    @Transactional("smartbiPostgresTransactionManager")
    public void cleanupExistingAutoSync(String factoryId, String sheetName) {
        List<SmartBiPgExcelUpload> existing = uploadRepository
                .findByFactoryIdAndDetectedTableTypeAndSheetName(factoryId, AUTO_SYNC_SOURCE, sheetName);

        if (existing.isEmpty()) return;

        String today = LocalDate.now().format(DATE_FMT);
        for (SmartBiPgExcelUpload upload : existing) {
            if (upload.getFileName() != null && upload.getFileName().contains(today)) {
                Long uploadId = upload.getId();
                log.info("清理今日重复的自动同步数据: uploadId={}, sheetName={}", uploadId, sheetName);
                dynamicDataRepository.deleteByUploadId(uploadId);
                fieldDefRepository.deleteByUploadId(uploadId);
                uploadRepository.delete(upload);
            }
        }
    }

    // ==================== PROGRESS报工字段定义 ====================

    private List<SmartBiPgFieldDefinition> createProgressFieldDefinitions(Long uploadId) {
        List<SmartBiPgFieldDefinition> defs = new ArrayList<>();

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("报告日期").standardName("report_date")
                .fieldType("DATE").semanticType("time").chartRole("x_axis")
                .isDimension(false).isMeasure(false).isTime(true).displayOrder(0)
                .formatPattern("yyyy-MM-dd").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("工序类目").standardName("process_category")
                .fieldType("STRING").semanticType("dimension").chartRole("series")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(1).build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("产品名称").standardName("product_name")
                .fieldType("STRING").semanticType("dimension").chartRole("series")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(2).build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("产出数量").standardName("output_quantity")
                .fieldType("NUMBER").semanticType("quantity").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(3)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("合格数量").standardName("good_quantity")
                .fieldType("NUMBER").semanticType("quantity").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(4)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("不良数量").standardName("defect_quantity")
                .fieldType("NUMBER").semanticType("quantity").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(5)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("报告人").standardName("reporter_name")
                .fieldType("STRING").semanticType("dimension").chartRole("filter")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(6).build());

        return defs;
    }

    // ==================== HOURS报工字段定义 ====================

    private List<SmartBiPgFieldDefinition> createHoursFieldDefinitions(Long uploadId) {
        List<SmartBiPgFieldDefinition> defs = new ArrayList<>();

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("报告日期").standardName("report_date")
                .fieldType("DATE").semanticType("time").chartRole("x_axis")
                .isDimension(false).isMeasure(false).isTime(true).displayOrder(0)
                .formatPattern("yyyy-MM-dd").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("商品名称").standardName("product_name")
                .fieldType("STRING").semanticType("dimension").chartRole("series")
                .isDimension(true).isMeasure(false).isTime(false).displayOrder(1).build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("总工时(分钟)").standardName("total_work_minutes")
                .fieldType("NUMBER").semanticType("measure").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(2)
                .formatPattern("#,##0").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("总人数").standardName("total_workers")
                .fieldType("NUMBER").semanticType("measure").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(3)
                .formatPattern("#,##0").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("操作量").standardName("operation_volume")
                .fieldType("NUMBER").semanticType("measure").chartRole("y_axis")
                .isDimension(false).isMeasure(true).isTime(false).displayOrder(4)
                .formatPattern("#,##0.##").build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("开始时间").standardName("production_start_time")
                .fieldType("STRING").semanticType("time").chartRole("tooltip")
                .isDimension(false).isMeasure(false).isTime(false).displayOrder(5).build());

        defs.add(SmartBiPgFieldDefinition.builder().uploadId(uploadId)
                .originalName("结束时间").standardName("production_end_time")
                .fieldType("STRING").semanticType("time").chartRole("tooltip")
                .isDimension(false).isMeasure(false).isTime(false).displayOrder(6).build());

        return defs;
    }

    // ==================== 数据行转换 ====================

    private Map<String, Object> buildProgressRowData(ProductionReport report) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("报告日期", report.getReportDate() != null ? report.getReportDate().format(DATE_FMT) : null);
        row.put("工序类目", report.getProcessCategory());
        row.put("产品名称", report.getProductName());
        row.put("产出数量", decimalToDouble(report.getOutputQuantity()));
        row.put("合格数量", decimalToDouble(report.getGoodQuantity()));
        row.put("不良数量", decimalToDouble(report.getDefectQuantity()));
        row.put("报告人", report.getReporterName());
        return row;
    }

    private Map<String, Object> buildHoursRowData(ProductionReport report) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("报告日期", report.getReportDate() != null ? report.getReportDate().format(DATE_FMT) : null);
        row.put("商品名称", report.getProductName());
        row.put("总工时(分钟)", report.getTotalWorkMinutes());
        row.put("总人数", report.getTotalWorkers());
        row.put("操作量", decimalToDouble(report.getOperationVolume()));
        row.put("开始时间", report.getProductionStartTime() != null ? report.getProductionStartTime().toString() : null);
        row.put("结束时间", report.getProductionEndTime() != null ? report.getProductionEndTime().toString() : null);
        return row;
    }

    private Double decimalToDouble(BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }
}
