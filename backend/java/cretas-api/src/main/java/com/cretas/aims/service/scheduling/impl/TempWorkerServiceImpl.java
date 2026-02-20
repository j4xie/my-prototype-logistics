package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.entity.FactoryTempWorker;
import com.cretas.aims.repository.FactorySchedulingConfigRepository;
import com.cretas.aims.repository.FactoryTempWorkerRepository;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.scheduling.TempWorkerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TempWorkerServiceImpl implements TempWorkerService {

    private final FactoryTempWorkerRepository tempWorkerRepository;
    private final FactorySchedulingConfigRepository configRepository;
    private final WorkerAllocationFeedbackRepository feedbackRepository;

    // 默认配置
    private static final int DEFAULT_TEMP_THRESHOLD_DAYS = 30;
    private static final double DEFAULT_LINUCB_FACTOR = 0.7;
    private static final double DEFAULT_FAIRNESS_FACTOR = 1.5;
    private static final int DEFAULT_SKILL_DECAY_DAYS = 14;
    private static final int DEFAULT_MIN_WEEKLY_ASSIGNMENTS = 3;
    private static final double CONVERSION_EFFICIENCY_THRESHOLD = 0.80;
    private static final double CONVERSION_RELIABILITY_THRESHOLD = 0.75;

    @Override
    public boolean isTempWorker(String factoryId, Long workerId) {
        Optional<FactoryTempWorker> record = tempWorkerRepository.findByFactoryIdAndWorkerId(factoryId, workerId);

        if (record.isPresent()) {
            return record.get().isCurrentlyTempWorker();
        }

        // 如果没有记录，检查是否为新人（入职未满N天）
        // 这里需要从其他数据源获取入职日期，暂时返回false
        return false;
    }

    @Override
    public Optional<FactoryTempWorker> getTempWorkerRecord(String factoryId, Long workerId) {
        return tempWorkerRepository.findByFactoryIdAndWorkerId(factoryId, workerId);
    }

    @Override
    @Transactional
    public FactoryTempWorker registerTempWorker(String factoryId, Long workerId, LocalDate hireDate, LocalDate expectedEndDate) {
        // 检查是否已存在
        Optional<FactoryTempWorker> existing = tempWorkerRepository.findByFactoryIdAndWorkerId(factoryId, workerId);
        if (existing.isPresent()) {
            log.warn("Worker {} already registered in factory {}", workerId, factoryId);
            return existing.get();
        }

        FactoryTempWorker tempWorker = new FactoryTempWorker();
        tempWorker.setFactoryId(factoryId);
        tempWorker.setWorkerId(workerId);
        tempWorker.setIsTempWorker(true);
        tempWorker.setHireDate(hireDate);
        tempWorker.setExpectedEndDate(expectedEndDate);
        tempWorker.setInitialSkillLevel(1);
        tempWorker.setCurrentSkillLevel(1);

        log.info("Registered temp worker {} in factory {}, expected end: {}", workerId, factoryId, expectedEndDate);
        return tempWorkerRepository.save(tempWorker);
    }

    @Override
    @Transactional
    public FactoryTempWorker convertToPermanent(String factoryId, Long workerId) {
        FactoryTempWorker tempWorker = tempWorkerRepository.findByFactoryIdAndWorkerId(factoryId, workerId)
                .orElseThrow(() -> new IllegalArgumentException("Temp worker not found: " + workerId));

        tempWorker.setConvertedToPermanent(true);
        tempWorker.setConversionDate(LocalDate.now());
        tempWorker.setIsTempWorker(false);

        log.info("Converted temp worker {} to permanent in factory {}", workerId, factoryId);
        return tempWorkerRepository.save(tempWorker);
    }

    @Override
    public TempWorkerAdjustment calculateAdjustment(String factoryId, Long workerId) {
        TempWorkerAdjustment adjustment = new TempWorkerAdjustment();
        adjustment.setWorkerId(workerId);

        // 获取工厂配置
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        Optional<FactoryTempWorker> record = getTempWorkerRecord(factoryId, workerId);

        if (record.isPresent() && record.get().isCurrentlyTempWorker()) {
            FactoryTempWorker tw = record.get();

            // 临时工: 使用工厂配置的调整因子
            adjustment.setLinucbFactor(config.getTempWorkerLinucbFactor() != null ?
                    config.getTempWorkerLinucbFactor() : DEFAULT_LINUCB_FACTOR);
            adjustment.setFairnessFactor(config.getTempWorkerFairnessFactor() != null ?
                    config.getTempWorkerFairnessFactor() : DEFAULT_FAIRNESS_FACTOR);
            adjustment.setSkillDecayDays(config.getTempWorkerSkillDecayDays() != null ?
                    config.getTempWorkerSkillDecayDays() : DEFAULT_SKILL_DECAY_DAYS);
            adjustment.setPreferLowComplexity(true);
            // 临时工使用较短的最大连续天数 (更多轮岗机会)
            adjustment.setMaxConsecutiveDays(3);

            // 根据入职天数计算学习加成 (越新加成越高)
            long daysEmployed = tw.getDaysEmployed();
            adjustment.setLearningBonus(Math.max(0, (30 - daysEmployed) / 30.0 * 0.2));
        } else {
            // 正式工: 使用标准参数
            adjustment.setLinucbFactor(1.0);
            adjustment.setFairnessFactor(1.0);
            adjustment.setSkillDecayDays(config.getSkillDecayDays() != null ?
                    config.getSkillDecayDays() : 30);
            adjustment.setPreferLowComplexity(false);
            adjustment.setLearningBonus(0.0);
            // 正式工使用默认的最大连续天数
            adjustment.setMaxConsecutiveDays(config.getMaxConsecutiveDays() != null ?
                    config.getMaxConsecutiveDays() : 5);
        }

        return adjustment;
    }

    @Override
    public int getMaxComplexityForTempWorker(String factoryId, Long workerId) {
        Optional<FactoryTempWorker> record = getTempWorkerRecord(factoryId, workerId);

        if (record.isEmpty() || !record.get().isCurrentlyTempWorker()) {
            return 5; // 正式工无限制
        }

        FactoryTempWorker tw = record.get();
        int skillLevel = tw.getCurrentSkillLevel();

        // 根据技能等级限制复杂度
        // 技能1 -> 复杂度2, 技能2 -> 复杂度3, 技能3 -> 复杂度4, 技能4+ -> 复杂度5
        return Math.min(5, skillLevel + 1);
    }

    @Override
    public boolean meetsMinimumAssignments(String factoryId, Long workerId, int days) {
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        int minAssignments = config.getTempWorkerMinAssignments() != null ?
                config.getTempWorkerMinAssignments() : DEFAULT_MIN_WEEKLY_ASSIGNMENTS;

        // 获取近N天的分配数
        long actualAssignments = feedbackRepository.countByFactoryIdAndWorkerIdAndCreatedAtAfter(
                factoryId, workerId, java.time.LocalDateTime.now().minusDays(days));

        // 按比例计算期望分配数 (每7天至少minAssignments次)
        int expectedAssignments = (int) Math.ceil((double) days / 7 * minAssignments);

        return actualAssignments >= expectedAssignments;
    }

    @Override
    public List<Long> getTempWorkersNeedingAssignment(String factoryId) {
        List<FactoryTempWorker> tempWorkers = tempWorkerRepository.findByFactoryIdAndIsTempWorkerTrue(factoryId);

        return tempWorkers.stream()
                .filter(FactoryTempWorker::isCurrentlyTempWorker)
                .filter(tw -> !meetsMinimumAssignments(factoryId, tw.getWorkerId(), 7))
                .map(FactoryTempWorker::getWorkerId)
                .collect(Collectors.toList());
    }

    @Override
    public List<TempWorkerConversionCandidate> getConversionCandidates(String factoryId) {
        List<FactoryTempWorker> tempWorkers = tempWorkerRepository.findByFactoryIdAndIsTempWorkerTrue(factoryId);

        List<TempWorkerConversionCandidate> candidates = new ArrayList<>();

        for (FactoryTempWorker tw : tempWorkers) {
            if (!tw.isCurrentlyTempWorker()) continue;
            if (tw.getDaysEmployed() < 30) continue; // 入职未满30天不考虑

            TempWorkerConversionCandidate candidate = new TempWorkerConversionCandidate();
            candidate.setWorkerId(tw.getWorkerId());
            candidate.setAvgEfficiency(tw.getAvgEfficiency());
            candidate.setReliabilityScore(tw.getReliabilityScore());
            candidate.setDaysEmployed(tw.getDaysEmployed());
            candidate.setTotalAssignments(tw.getTotalAssignments());

            // 计算综合转正分数
            double score = 0.4 * tw.getAvgEfficiency() +
                    0.3 * tw.getReliabilityScore() +
                    0.2 * Math.min(1.0, tw.getTotalAssignments() / 50.0) +
                    0.1 * Math.min(1.0, tw.getDaysEmployed() / 90.0);

            candidate.setConversionScore(score);

            // 生成建议
            if (tw.getAvgEfficiency() >= CONVERSION_EFFICIENCY_THRESHOLD &&
                    tw.getReliabilityScore() >= CONVERSION_RELIABILITY_THRESHOLD) {
                candidate.setRecommendation("强烈建议转正: 效率和可靠性均达标");
            } else if (tw.getAvgEfficiency() >= CONVERSION_EFFICIENCY_THRESHOLD) {
                candidate.setRecommendation("建议观察: 效率达标但可靠性待提升");
            } else if (tw.getReliabilityScore() >= CONVERSION_RELIABILITY_THRESHOLD) {
                candidate.setRecommendation("建议培训: 可靠性好但效率需提升");
            } else {
                candidate.setRecommendation("继续培养: 效率和可靠性均需提升");
            }

            candidates.add(candidate);
        }

        // 按转正分数排序
        candidates.sort((a, b) -> Double.compare(b.getConversionScore(), a.getConversionScore()));
        return candidates;
    }

    @Override
    @Transactional
    public void updatePerformanceStats(String factoryId, Long workerId, double efficiency, boolean completed) {
        Optional<FactoryTempWorker> record = tempWorkerRepository.findByFactoryIdAndWorkerId(factoryId, workerId);
        if (record.isEmpty()) return;

        FactoryTempWorker tw = record.get();

        // 更新分配次数
        tw.setTotalAssignments(tw.getTotalAssignments() + 1);

        // 更新平均效率 (滑动平均)
        double oldAvg = tw.getAvgEfficiency();
        int count = tw.getTotalAssignments();
        tw.setAvgEfficiency((oldAvg * (count - 1) + efficiency) / count);

        // 更新可靠性 (基于完成率)
        double oldReliability = tw.getReliabilityScore();
        double completionScore = completed ? 1.0 : 0.0;
        tw.setReliabilityScore((oldReliability * (count - 1) + completionScore) / count);

        // 检查是否需要升级技能
        if (tw.getAvgEfficiency() >= 0.85 && tw.getTotalAssignments() >= 20) {
            if (tw.getCurrentSkillLevel() < 4) {
                tw.setCurrentSkillLevel(tw.getCurrentSkillLevel() + 1);
                log.info("Temp worker {} skill upgraded to level {}", workerId, tw.getCurrentSkillLevel());
            }
        }

        tempWorkerRepository.save(tw);
    }

    @Override
    public TempWorkerStats getFactoryTempWorkerStats(String factoryId) {
        TempWorkerStats stats = new TempWorkerStats();
        stats.setFactoryId(factoryId);

        List<FactoryTempWorker> allWorkers = tempWorkerRepository.findAll().stream()
                .filter(w -> factoryId.equals(w.getFactoryId()))
                .collect(Collectors.toList());

        List<FactoryTempWorker> tempWorkers = allWorkers.stream()
                .filter(FactoryTempWorker::isCurrentlyTempWorker)
                .collect(Collectors.toList());

        List<FactoryTempWorker> permanentWorkers = allWorkers.stream()
                .filter(w -> !w.isCurrentlyTempWorker())
                .collect(Collectors.toList());

        stats.setTotalTempWorkers(tempWorkers.size());
        stats.setTotalPermanentWorkers(permanentWorkers.size());

        int total = tempWorkers.size() + permanentWorkers.size();
        stats.setTempWorkerRatio(total > 0 ? (double) tempWorkers.size() / total : 0);

        stats.setAvgTempEfficiency(tempWorkers.stream()
                .mapToDouble(FactoryTempWorker::getAvgEfficiency)
                .average().orElse(0));

        stats.setAvgPermanentEfficiency(permanentWorkers.stream()
                .mapToDouble(FactoryTempWorker::getAvgEfficiency)
                .average().orElse(0));

        stats.setConversionCandidatesCount((int) getConversionCandidates(factoryId).stream()
                .filter(c -> c.getConversionScore() >= 0.7)
                .count());

        LocalDate nextWeek = LocalDate.now().plusDays(7);
        stats.setExpiringSoonCount((int) tempWorkerRepository.findExpiringTempWorkers(
                        factoryId, LocalDate.now(), nextWeek).size());

        return stats;
    }
}
