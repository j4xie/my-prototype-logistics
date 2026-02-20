package com.cretas.aims.service;

import com.cretas.aims.entity.PayrollRecord;
import com.cretas.aims.entity.PieceRateRule;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.WorkerDailyEfficiency;
import com.cretas.aims.repository.PayrollRecordRepository;
import com.cretas.aims.repository.PieceRateRuleRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.WorkerDailyEfficiencyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 工资计算引擎服务
 * 负责计件工资计算、日效率统计、工资单生成
 *
 * 主要功能:
 * - 阶梯计件工资计算
 * - 工人日效率记录和统计
 * - 工资单生成和汇总
 * - 人力成本分析
 *
 * 效率评级标准:
 * - A: 优秀 (效率 >= 120%)
 * - B: 良好 (效率 >= 100%)
 * - C: 合格 (效率 >= 80%)
 * - D: 待提升 (效率 < 80%)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WageCalculationService {

    private final PieceRateRuleRepository pieceRateRuleRepository;
    private final PayrollRecordRepository payrollRecordRepository;
    private final WorkerDailyEfficiencyRepository workerDailyEfficiencyRepository;
    private final UserRepository userRepository;

    // ==================== 常量定义 ====================

    /** 工资记录状态: 待审核 */
    public static final String PAYROLL_STATUS_PENDING = "PENDING";
    /** 工资记录状态: 已审核 */
    public static final String PAYROLL_STATUS_APPROVED = "APPROVED";
    /** 工资记录状态: 已发放 */
    public static final String PAYROLL_STATUS_PAID = "PAID";

    /** 结算周期: 日结 */
    public static final String PERIOD_TYPE_DAILY = "DAILY";
    /** 结算周期: 周结 */
    public static final String PERIOD_TYPE_WEEKLY = "WEEKLY";
    /** 结算周期: 月结 */
    public static final String PERIOD_TYPE_MONTHLY = "MONTHLY";

    /** 效率趋势: 上升 */
    public static final String TREND_UP = "UP";
    /** 效率趋势: 下降 */
    public static final String TREND_DOWN = "DOWN";
    /** 效率趋势: 稳定 */
    public static final String TREND_STABLE = "STABLE";

    /** 标准工时 (小时/天) */
    private static final BigDecimal STANDARD_WORK_HOURS_PER_DAY = new BigDecimal("8");
    /** 加班工资倍率 */
    private static final BigDecimal OVERTIME_RATE_MULTIPLIER = new BigDecimal("1.5");
    /** 周末加班倍率 */
    private static final BigDecimal WEEKEND_OVERTIME_MULTIPLIER = new BigDecimal("2.0");

    // ==================== 计件工资计算 ====================

    /**
     * 计算计件工资
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param pieceCount 完成件数
     * @param processStageType 工序类型
     * @param date 日期
     * @return 计件工资金额
     */
    public BigDecimal calculatePieceRateWage(String factoryId, Long workerId,
            int pieceCount, String processStageType, LocalDate date) {

        if (pieceCount <= 0) {
            log.debug("计件数为0，返回0工资: factoryId={}, workerId={}", factoryId, workerId);
            return BigDecimal.ZERO;
        }

        // 1. 查找适用的计件规则 (按优先级)
        Optional<PieceRateRule> ruleOpt = findApplicableRule(factoryId, processStageType, null, date);

        if (ruleOpt.isEmpty()) {
            log.warn("未找到适用的计件规则: factoryId={}, processStageType={}, date={}",
                    factoryId, processStageType, date);
            return BigDecimal.ZERO;
        }

        PieceRateRule rule = ruleOpt.get();
        log.debug("使用计件规则: id={}, name={}, tier1Rate={}",
                rule.getId(), rule.getName(), rule.getTier1Rate());

        // 2. 使用规则的 calculateWage 方法计算阶梯工资
        BigDecimal wage = rule.calculateWage(pieceCount);

        log.info("计件工资计算完成: factoryId={}, workerId={}, pieceCount={}, wage={}",
                factoryId, workerId, pieceCount, wage);

        return wage;
    }

    /**
     * 计算计件工资 (带产品类型)
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param pieceCount 完成件数
     * @param processStageType 工序类型
     * @param productTypeId 产品类型ID
     * @param date 日期
     * @return 计件工资金额
     */
    public BigDecimal calculatePieceRateWage(String factoryId, Long workerId,
            int pieceCount, String processStageType, String productTypeId, LocalDate date) {

        if (pieceCount <= 0) {
            return BigDecimal.ZERO;
        }

        Optional<PieceRateRule> ruleOpt = findApplicableRule(factoryId, processStageType, productTypeId, date);

        if (ruleOpt.isEmpty()) {
            log.warn("未找到适用的计件规则: factoryId={}, processStageType={}, productTypeId={}",
                    factoryId, processStageType, productTypeId);
            return BigDecimal.ZERO;
        }

        return ruleOpt.get().calculateWage(pieceCount);
    }

    /**
     * 查找适用的计件规则
     */
    private Optional<PieceRateRule> findApplicableRule(String factoryId,
            String processStageType, String productTypeId, LocalDate date) {

        // 优先查找完全匹配的规则
        if (processStageType != null && productTypeId != null) {
            Optional<PieceRateRule> exactMatch = pieceRateRuleRepository
                    .findBestMatchingRule(factoryId, processStageType, productTypeId, date);
            if (exactMatch.isPresent()) {
                return exactMatch;
            }
        }

        // 其次查找工序匹配的规则
        if (processStageType != null) {
            List<PieceRateRule> processRules = pieceRateRuleRepository
                    .findEffectiveRulesByProcessStage(factoryId, processStageType, date);
            if (!processRules.isEmpty()) {
                return Optional.of(processRules.get(0));
            }
        }

        // 最后查找工厂通用规则
        List<PieceRateRule> factoryRules = pieceRateRuleRepository.findEffectiveRules(factoryId, date);
        return factoryRules.isEmpty() ? Optional.empty() : Optional.of(factoryRules.get(0));
    }

    // ==================== 日效率记录 ====================

    /**
     * 记录工人日效率
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param workDate 工作日期
     * @param pieceCount 完成件数
     * @param workMinutes 工作时长(分钟)
     * @param processStageType 工序类型
     * @return 效率记录
     */
    @Transactional
    public WorkerDailyEfficiency recordDailyEfficiency(String factoryId, Long workerId,
            LocalDate workDate, int pieceCount, int workMinutes, String processStageType) {

        log.info("记录日效率: factoryId={}, workerId={}, date={}, pieces={}, minutes={}",
                factoryId, workerId, workDate, pieceCount, workMinutes);

        // 1. 获取工人信息
        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("工人不存在: " + workerId));

        // 2. 查找或创建当日效率记录
        WorkerDailyEfficiency efficiency = workerDailyEfficiencyRepository
                .findByFactoryIdAndWorkerIdAndWorkDateAndProcessStageType(
                        factoryId, workerId, workDate, processStageType)
                .orElse(WorkerDailyEfficiency.builder()
                        .factoryId(factoryId)
                        .workerId(workerId)
                        .workerName(worker.getFullName())
                        .workDate(workDate)
                        .processStageType(processStageType)
                        .totalPieceCount(0)
                        .effectiveWorkMinutes(0)
                        .qualifiedCount(0)
                        .defectCount(0)
                        .build());

        // 3. 更新计件数据
        int newPieceCount = (efficiency.getTotalPieceCount() != null ? efficiency.getTotalPieceCount() : 0) + pieceCount;
        int newWorkMinutes = (efficiency.getEffectiveWorkMinutes() != null ? efficiency.getEffectiveWorkMinutes() : 0) + workMinutes;

        efficiency.setTotalPieceCount(newPieceCount);
        efficiency.setEffectiveWorkMinutes(newWorkMinutes);

        // 4. 假设全部合格 (可以后续调整)
        efficiency.setQualifiedCount(newPieceCount);

        // 5. 计算效率指标 (会在 @PrePersist/@PreUpdate 中自动计算)
        // piecesPerHour, averageTimePerPiece 等

        // 6. 计算效率趋势
        calculateEfficiencyTrend(efficiency, factoryId, workerId, workDate);

        // 7. 获取标准效率并设置对比基准
        setStandardEfficiency(efficiency, factoryId, processStageType);

        // 8. 保存并返回
        efficiency = workerDailyEfficiencyRepository.save(efficiency);
        log.info("日效率记录完成: id={}, piecesPerHour={}", efficiency.getId(), efficiency.getPiecesPerHour());

        return efficiency;
    }

    /**
     * 更新效率记录 (追加计件)
     */
    @Transactional
    public WorkerDailyEfficiency updateDailyEfficiency(Long efficiencyId,
            int additionalPieces, int additionalMinutes) {

        WorkerDailyEfficiency efficiency = workerDailyEfficiencyRepository.findById(efficiencyId)
                .orElseThrow(() -> new RuntimeException("效率记录不存在: " + efficiencyId));

        int newPieceCount = (efficiency.getTotalPieceCount() != null ? efficiency.getTotalPieceCount() : 0) + additionalPieces;
        int newWorkMinutes = (efficiency.getEffectiveWorkMinutes() != null ? efficiency.getEffectiveWorkMinutes() : 0) + additionalMinutes;

        efficiency.setTotalPieceCount(newPieceCount);
        efficiency.setEffectiveWorkMinutes(newWorkMinutes);
        efficiency.setQualifiedCount(newPieceCount);

        return workerDailyEfficiencyRepository.save(efficiency);
    }

    /**
     * 计算效率趋势
     */
    private void calculateEfficiencyTrend(WorkerDailyEfficiency current,
            String factoryId, Long workerId, LocalDate workDate) {

        // 获取前一天的效率
        LocalDate previousDate = workDate.minusDays(1);
        Optional<WorkerDailyEfficiency> previousOpt = workerDailyEfficiencyRepository
                .findByFactoryIdAndWorkerIdAndWorkDate(factoryId, workerId, previousDate);

        if (previousOpt.isEmpty() || previousOpt.get().getPiecesPerHour() == null) {
            current.setEfficiencyTrend(TREND_STABLE);
            return;
        }

        BigDecimal previousRate = previousOpt.get().getPiecesPerHour();
        BigDecimal currentRate = current.getPiecesPerHour();

        if (currentRate == null) {
            current.setEfficiencyTrend(TREND_STABLE);
            return;
        }

        // 计算变化百分比
        BigDecimal changePercent = currentRate.subtract(previousRate)
                .divide(previousRate, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        if (changePercent.compareTo(BigDecimal.valueOf(5)) > 0) {
            current.setEfficiencyTrend(TREND_UP);
        } else if (changePercent.compareTo(BigDecimal.valueOf(-5)) < 0) {
            current.setEfficiencyTrend(TREND_DOWN);
        } else {
            current.setEfficiencyTrend(TREND_STABLE);
        }
    }

    /**
     * 设置标准效率
     */
    private void setStandardEfficiency(WorkerDailyEfficiency efficiency,
            String factoryId, String processStageType) {

        // 获取工厂该工序的平均效率作为标准
        BigDecimal avgEfficiency = workerDailyEfficiencyRepository
                .avgPiecesPerHourByFactoryAndDate(factoryId, efficiency.getWorkDate());

        if (avgEfficiency != null) {
            efficiency.setStandardPiecesPerHour(avgEfficiency);
        } else {
            // 默认标准: 60件/小时
            efficiency.setStandardPiecesPerHour(new BigDecimal("60"));
        }
    }

    // ==================== 工资单生成 ====================

    /**
     * 生成工资单
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param periodStart 周期开始
     * @param periodEnd 周期结束
     * @return 工资记录
     */
    @Transactional
    public PayrollRecord generatePayroll(String factoryId, Long workerId,
            LocalDate periodStart, LocalDate periodEnd) {

        log.info("生成工资单: factoryId={}, workerId={}, period={} to {}",
                factoryId, workerId, periodStart, periodEnd);

        // 检查是否已存在工资记录
        if (payrollRecordRepository.existsByFactoryIdAndWorkerIdAndPeriodStartAndPeriodEnd(
                factoryId, workerId, periodStart, periodEnd)) {
            throw new RuntimeException("该周期的工资记录已存在");
        }

        // 1. 获取工人信息
        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("工人不存在: " + workerId));

        // 2. 汇总周期内的所有日效率记录
        List<WorkerDailyEfficiency> efficiencies = workerDailyEfficiencyRepository
                .findByWorkerAndDateRange(factoryId, workerId, periodStart, periodEnd);

        // 3. 计算总计件数
        int totalPieceCount = efficiencies.stream()
                .mapToInt(e -> e.getTotalPieceCount() != null ? e.getTotalPieceCount() : 0)
                .sum();

        // 4. 计算计件工资 (使用周期内最后一天的规则)
        BigDecimal pieceRateWage = BigDecimal.ZERO;
        Long pieceRuleId = null;

        if (totalPieceCount > 0) {
            // 获取主要工序类型 (出现次数最多的工序)
            String mainProcessStage = efficiencies.stream()
                    .filter(e -> e.getProcessStageType() != null)
                    .collect(Collectors.groupingBy(WorkerDailyEfficiency::getProcessStageType, Collectors.counting()))
                    .entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);

            Optional<PieceRateRule> ruleOpt = findApplicableRule(factoryId, mainProcessStage, null, periodEnd);
            if (ruleOpt.isPresent()) {
                PieceRateRule rule = ruleOpt.get();
                pieceRateWage = rule.calculateWage(totalPieceCount);
                pieceRuleId = rule.getId();
            }
        }

        // 5. 获取基本工资
        BigDecimal baseSalary = worker.getMonthlySalary();
        if (baseSalary != null) {
            // 按天数比例计算
            long totalDays = periodEnd.toEpochDay() - periodStart.toEpochDay() + 1;
            long daysInMonth = periodStart.lengthOfMonth();
            baseSalary = baseSalary.multiply(BigDecimal.valueOf(totalDays))
                    .divide(BigDecimal.valueOf(daysInMonth), 2, RoundingMode.HALF_UP);
        } else {
            baseSalary = BigDecimal.ZERO;
        }

        // 6. 计算总工作时长和加班时长
        int totalWorkMinutes = efficiencies.stream()
                .mapToInt(e -> e.getEffectiveWorkMinutes() != null ? e.getEffectiveWorkMinutes() : 0)
                .sum();
        BigDecimal totalWorkHours = BigDecimal.valueOf(totalWorkMinutes)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);

        // 计算标准工时 (工作天数 * 8小时)
        int workDays = efficiencies.size();
        BigDecimal standardHours = STANDARD_WORK_HOURS_PER_DAY.multiply(BigDecimal.valueOf(workDays));

        // 加班时长
        BigDecimal overtimeHours = BigDecimal.ZERO;
        BigDecimal overtimeWage = BigDecimal.ZERO;
        if (totalWorkHours.compareTo(standardHours) > 0) {
            overtimeHours = totalWorkHours.subtract(standardHours);
            // 计算加班工资 (使用小时工资 * 1.5)
            BigDecimal hourlyRate = worker.getHourlyRate();
            if (hourlyRate != null) {
                overtimeWage = hourlyRate.multiply(overtimeHours)
                        .multiply(OVERTIME_RATE_MULTIPLIER)
                        .setScale(2, RoundingMode.HALF_UP);
            }
        }

        // 7. 计算平均效率
        BigDecimal averageEfficiency = BigDecimal.ZERO;
        if (totalWorkMinutes > 0) {
            averageEfficiency = BigDecimal.valueOf(totalPieceCount * 60.0 / totalWorkMinutes)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        // 8. 确定效率评级
        String efficiencyRating = determineEfficiencyRating(averageEfficiency, factoryId, periodStart, periodEnd);

        // 9. 确定周期类型
        String periodType = determinePeriodType(periodStart, periodEnd);

        // 10. 创建工资记录
        PayrollRecord payroll = PayrollRecord.builder()
                .factoryId(factoryId)
                .workerId(workerId)
                .workerName(worker.getFullName())
                .periodStart(periodStart)
                .periodEnd(periodEnd)
                .periodType(periodType)
                .totalPieceCount(totalPieceCount)
                .pieceRateWage(pieceRateWage)
                .pieceRuleId(pieceRuleId)
                .baseSalary(baseSalary)
                .overtimeWage(overtimeWage)
                .overtimeHours(overtimeHours)
                .bonusAmount(BigDecimal.ZERO)
                .deductionAmount(BigDecimal.ZERO)
                .averageEfficiency(averageEfficiency)
                .totalWorkHours(totalWorkHours)
                .efficiencyRating(efficiencyRating)
                .status(PAYROLL_STATUS_PENDING)
                .build();

        // totalWage 会在 @PrePersist 中自动计算
        payroll = payrollRecordRepository.save(payroll);

        log.info("工资单生成完成: id={}, totalWage={}, pieceRateWage={}",
                payroll.getId(), payroll.getTotalWage(), payroll.getPieceRateWage());

        return payroll;
    }

    /**
     * 批量生成工资单 (按工厂)
     *
     * @param factoryId 工厂ID
     * @param periodStart 周期开始
     * @param periodEnd 周期结束
     * @return 工资记录列表
     */
    @Transactional
    public List<PayrollRecord> generateFactoryPayroll(String factoryId,
            LocalDate periodStart, LocalDate periodEnd) {

        log.info("批量生成工资单: factoryId={}, period={} to {}", factoryId, periodStart, periodEnd);

        // 获取有效率记录的所有工人
        List<WorkerDailyEfficiency> allEfficiencies = workerDailyEfficiencyRepository
                .findByDateRange(factoryId, periodStart, periodEnd);

        Set<Long> workerIds = allEfficiencies.stream()
                .map(WorkerDailyEfficiency::getWorkerId)
                .collect(Collectors.toSet());

        List<PayrollRecord> payrolls = new ArrayList<>();
        int successCount = 0;
        int skipCount = 0;

        for (Long workerId : workerIds) {
            try {
                // 检查是否已存在
                if (payrollRecordRepository.existsByFactoryIdAndWorkerIdAndPeriodStartAndPeriodEnd(
                        factoryId, workerId, periodStart, periodEnd)) {
                    log.debug("工资记录已存在，跳过: workerId={}", workerId);
                    skipCount++;
                    continue;
                }

                PayrollRecord payroll = generatePayroll(factoryId, workerId, periodStart, periodEnd);
                payrolls.add(payroll);
                successCount++;
            } catch (Exception e) {
                log.error("生成工资单失败: workerId={}, error={}", workerId, e.getMessage());
            }
        }

        log.info("批量生成工资单完成: 成功={}, 跳过={}, 总计={}", successCount, skipCount, workerIds.size());

        return payrolls;
    }

    /**
     * 确定效率评级
     */
    private String determineEfficiencyRating(BigDecimal efficiency, String factoryId,
            LocalDate periodStart, LocalDate periodEnd) {

        // 获取工厂平均效率作为基准
        BigDecimal avgEfficiency = payrollRecordRepository
                .avgEfficiencyByPeriod(factoryId, periodStart, periodEnd);

        BigDecimal baseline = avgEfficiency != null ? avgEfficiency : new BigDecimal("60");

        // 计算相对效率百分比
        BigDecimal relativePercent = efficiency.divide(baseline, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        if (relativePercent.compareTo(BigDecimal.valueOf(120)) >= 0) {
            return "A"; // 优秀
        } else if (relativePercent.compareTo(BigDecimal.valueOf(100)) >= 0) {
            return "B"; // 良好
        } else if (relativePercent.compareTo(BigDecimal.valueOf(80)) >= 0) {
            return "C"; // 合格
        } else {
            return "D"; // 待提升
        }
    }

    /**
     * 确定周期类型
     */
    private String determinePeriodType(LocalDate periodStart, LocalDate periodEnd) {
        long days = periodEnd.toEpochDay() - periodStart.toEpochDay() + 1;

        if (days == 1) {
            return PERIOD_TYPE_DAILY;
        } else if (days <= 7) {
            return PERIOD_TYPE_WEEKLY;
        } else {
            return PERIOD_TYPE_MONTHLY;
        }
    }

    // ==================== 效率排名和趋势 ====================

    /**
     * 获取工人效率排名
     *
     * @param factoryId 工厂ID
     * @param date 日期
     * @return 效率排名列表
     */
    public List<WorkerDailyEfficiency> getWorkerEfficiencyRanking(String factoryId, LocalDate date) {
        List<WorkerDailyEfficiency> ranking = workerDailyEfficiencyRepository
                .findDailyRanking(factoryId, date);

        // 设置排名
        for (int i = 0; i < ranking.size(); i++) {
            ranking.get(i).setRankInTeam(i + 1);
        }

        return ranking;
    }

    /**
     * 获取工序效率排名
     */
    public List<WorkerDailyEfficiency> getProcessEfficiencyRanking(String factoryId,
            LocalDate date, String processStageType) {

        List<WorkerDailyEfficiency> ranking = workerDailyEfficiencyRepository
                .findDailyRankingByProcess(factoryId, date, processStageType);

        for (int i = 0; i < ranking.size(); i++) {
            ranking.get(i).setRankInTeam(i + 1);
        }

        return ranking;
    }

    /**
     * 获取工人效率趋势
     *
     * @param workerId 工人ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 日期 -> 效率 的映射
     */
    public Map<LocalDate, BigDecimal> getWorkerEfficiencyTrend(Long workerId,
            LocalDate startDate, LocalDate endDate) {

        List<Object[]> trendData = workerDailyEfficiencyRepository
                .getWorkerTrend(workerId, startDate, endDate);

        Map<LocalDate, BigDecimal> trend = new LinkedHashMap<>();
        for (Object[] row : trendData) {
            LocalDate date = (LocalDate) row[0];
            BigDecimal efficiency = (BigDecimal) row[1];
            trend.put(date, efficiency != null ? efficiency : BigDecimal.ZERO);
        }

        return trend;
    }

    /**
     * 获取工厂效率趋势
     */
    public List<Map<String, Object>> getFactoryEfficiencyTrend(String factoryId,
            LocalDate startDate, LocalDate endDate) {

        List<Object[]> trendData = workerDailyEfficiencyRepository
                .getDailyTrend(factoryId, startDate, endDate);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : trendData) {
            Map<String, Object> dayData = new LinkedHashMap<>();
            dayData.put("date", row[0]);
            dayData.put("avgEfficiency", row[1]);
            dayData.put("totalPieces", row[2]);
            dayData.put("workerCount", row[3]);
            result.add(dayData);
        }

        return result;
    }

    // ==================== 人力成本分析 ====================

    /**
     * 人力成本分析
     *
     * @param factoryId 工厂ID
     * @param periodStart 周期开始
     * @param periodEnd 周期结束
     * @return 分析结果
     */
    public Map<String, Object> analyzeLaborCost(String factoryId,
            LocalDate periodStart, LocalDate periodEnd) {

        log.info("人力成本分析: factoryId={}, period={} to {}", factoryId, periodStart, periodEnd);

        Map<String, Object> analysis = new LinkedHashMap<>();

        // 1. 总工资支出
        BigDecimal totalWage = payrollRecordRepository.sumTotalWageByPeriod(factoryId, periodStart, periodEnd);
        analysis.put("totalWage", totalWage != null ? totalWage : BigDecimal.ZERO);

        // 2. 计件工资总额
        BigDecimal totalPieceRateWage = payrollRecordRepository.sumPieceRateWageByPeriod(factoryId, periodStart, periodEnd);
        analysis.put("totalPieceRateWage", totalPieceRateWage != null ? totalPieceRateWage : BigDecimal.ZERO);

        // 3. 总计件数
        Integer totalPieceCount = payrollRecordRepository.sumPieceCountByPeriod(factoryId, periodStart, periodEnd);
        analysis.put("totalPieceCount", totalPieceCount != null ? totalPieceCount : 0);

        // 4. 单件人工成本
        BigDecimal costPerPiece = BigDecimal.ZERO;
        if (totalPieceCount != null && totalPieceCount > 0 && totalWage != null) {
            costPerPiece = totalWage.divide(BigDecimal.valueOf(totalPieceCount), 4, RoundingMode.HALF_UP);
        }
        analysis.put("costPerPiece", costPerPiece);

        // 5. 平均效率
        BigDecimal avgEfficiency = payrollRecordRepository.avgEfficiencyByPeriod(factoryId, periodStart, periodEnd);
        analysis.put("averageEfficiency", avgEfficiency != null ? avgEfficiency : BigDecimal.ZERO);

        // 6. 按效率评级统计
        List<Object[]> ratingStats = payrollRecordRepository.countByEfficiencyRating(factoryId, periodStart, periodEnd);
        Map<String, Map<String, Object>> byRating = new LinkedHashMap<>();
        for (Object[] row : ratingStats) {
            String rating = (String) row[0];
            if (rating != null) {
                Map<String, Object> ratingData = new LinkedHashMap<>();
                ratingData.put("count", row[1]);
                ratingData.put("totalWage", row[2]);
                byRating.put(rating, ratingData);
            }
        }
        analysis.put("byEfficiencyRating", byRating);

        // 7. 按工序统计
        List<Object[]> processStats = workerDailyEfficiencyRepository.statsByProcessStage(factoryId, periodStart, periodEnd);
        Map<String, Map<String, Object>> byProcess = new LinkedHashMap<>();
        for (Object[] row : processStats) {
            String processStage = (String) row[0];
            if (processStage != null) {
                Map<String, Object> processData = new LinkedHashMap<>();
                processData.put("avgEfficiency", row[1]);
                processData.put("totalPieces", row[2]);
                byProcess.put(processStage, processData);
            }
        }
        analysis.put("byProcessStage", byProcess);

        // 8. 工人数量
        long workerCount = workerDailyEfficiencyRepository.countWorkersByDate(factoryId, periodEnd);
        analysis.put("workerCount", workerCount);

        // 9. 人均产出
        BigDecimal avgPiecesPerWorker = BigDecimal.ZERO;
        if (workerCount > 0 && totalPieceCount != null) {
            avgPiecesPerWorker = BigDecimal.valueOf(totalPieceCount)
                    .divide(BigDecimal.valueOf(workerCount), 2, RoundingMode.HALF_UP);
        }
        analysis.put("avgPiecesPerWorker", avgPiecesPerWorker);

        // 10. 人均工资
        BigDecimal avgWagePerWorker = BigDecimal.ZERO;
        if (workerCount > 0 && totalWage != null) {
            avgWagePerWorker = totalWage.divide(BigDecimal.valueOf(workerCount), 2, RoundingMode.HALF_UP);
        }
        analysis.put("avgWagePerWorker", avgWagePerWorker);

        log.info("人力成本分析完成: totalWage={}, costPerPiece={}, avgEfficiency={}",
                totalWage, costPerPiece, avgEfficiency);

        return analysis;
    }

    // ==================== 工资单审核和发放 ====================

    /**
     * 审核工资单
     */
    @Transactional
    public PayrollRecord approvePayroll(Long payrollId, Long approverId) {
        PayrollRecord payroll = payrollRecordRepository.findById(payrollId)
                .orElseThrow(() -> new RuntimeException("工资记录不存在: " + payrollId));

        if (!PAYROLL_STATUS_PENDING.equals(payroll.getStatus())) {
            throw new RuntimeException("只能审核待审核状态的工资记录");
        }

        payroll.setStatus(PAYROLL_STATUS_APPROVED);
        payroll.setApprovedBy(approverId);
        payroll.setApprovedAt(LocalDateTime.now());

        log.info("工资单审核通过: id={}, approverId={}", payrollId, approverId);

        return payrollRecordRepository.save(payroll);
    }

    /**
     * 标记工资已发放
     */
    @Transactional
    public PayrollRecord markAsPaid(Long payrollId) {
        PayrollRecord payroll = payrollRecordRepository.findById(payrollId)
                .orElseThrow(() -> new RuntimeException("工资记录不存在: " + payrollId));

        if (!PAYROLL_STATUS_APPROVED.equals(payroll.getStatus())) {
            throw new RuntimeException("只能发放已审核的工资记录");
        }

        payroll.setStatus(PAYROLL_STATUS_PAID);
        payroll.setPaidAt(LocalDateTime.now());

        log.info("工资单已发放: id={}", payrollId);

        return payrollRecordRepository.save(payroll);
    }

    /**
     * 批量审核
     */
    @Transactional
    public int batchApprove(List<Long> payrollIds, Long approverId) {
        int count = 0;
        for (Long id : payrollIds) {
            try {
                approvePayroll(id, approverId);
                count++;
            } catch (Exception e) {
                log.error("批量审核失败: id={}, error={}", id, e.getMessage());
            }
        }
        return count;
    }

    // ==================== 查询方法 ====================

    /**
     * 获取工人工资历史
     */
    public List<PayrollRecord> getWorkerPayrollHistory(Long workerId, int limit) {
        return payrollRecordRepository.findByWorkerId(workerId).stream()
                .sorted(Comparator.comparing(PayrollRecord::getPeriodStart).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * 获取待审核工资单数量
     */
    public long countPendingPayrolls(String factoryId) {
        return payrollRecordRepository.countByFactoryIdAndStatus(factoryId, PAYROLL_STATUS_PENDING);
    }

    /**
     * 获取工资排行榜
     */
    public List<PayrollRecord> getTopEarners(String factoryId, LocalDate periodStart,
            LocalDate periodEnd, int limit) {

        return payrollRecordRepository.findTopEarners(
                factoryId, periodStart, periodEnd,
                org.springframework.data.domain.PageRequest.of(0, limit));
    }
}
