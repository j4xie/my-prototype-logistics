package com.cretas.aims.service.impl;

import com.cretas.aims.config.DispatcherStrategyConfig;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.DispatcherStrategyService;
import com.cretas.aims.service.LinUCBService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 调度策略干预服务实现
 * 基于抖音推荐系统"商业与生态博弈"设计
 *
 * 支持的策略:
 * 1. 新人培训 - 给新员工学习机会
 * 2. 公平轮换 - 避免同一工人总做同一工序
 * 3. 疲劳控制 - 连续工作多天的工人降权
 * 4. 紧急任务 - 紧急任务优先匹配高技能工人
 * 5. 技能培养 - 给工人分配不熟悉但可学习的任务
 * 6. 工作量均衡 - 避免工作量集中在少数高绩效工人
 */
@Slf4j
@Service
public class DispatcherStrategyServiceImpl implements DispatcherStrategyService {

    private final DispatcherStrategyConfig config;
    private final UserRepository userRepository;
    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final Map<String, String> memoryCache;
    private final boolean useMemoryCache;

    private static final String WORKER_CACHE_PREFIX = "dispatcher:worker:";
    private static final String PROCESS_COUNT_PREFIX = "dispatcher:process:";
    private static final long CACHE_TTL_HOURS = 1;

    private final Random random = new Random();

    @Autowired
    public DispatcherStrategyServiceImpl(
            DispatcherStrategyConfig config,
            UserRepository userRepository,
            WorkerAllocationFeedbackRepository feedbackRepository,
            ObjectMapper objectMapper,
            @Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.config = config;
        this.userRepository = userRepository;
        this.feedbackRepository = feedbackRepository;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
        this.memoryCache = new ConcurrentHashMap<>();
        this.useMemoryCache = (redisTemplate == null);

        if (useMemoryCache) {
            log.warn("DispatcherStrategyService 使用内存缓存 (Redis不可用)");
        } else {
            log.info("DispatcherStrategyService 使用Redis缓存");
        }
    }

    @Override
    public BigDecimal calculateStrategyBoost(String factoryId, Long workerId, Map<String, Object> taskInfo) {
        if (!config.isEnabled() || workerId == null) {
            return BigDecimal.ZERO;
        }

        BigDecimal totalBoost = BigDecimal.ZERO;

        try {
            totalBoost = totalBoost.add(calculateNewWorkerBoost(factoryId, workerId, taskInfo));
            totalBoost = totalBoost.add(calculateRepetitionPenalty(factoryId, workerId, taskInfo));
            totalBoost = totalBoost.add(calculateFatiguePenalty(factoryId, workerId));
            totalBoost = totalBoost.add(calculateUrgentTaskBoost(factoryId, workerId, taskInfo));
            totalBoost = totalBoost.add(calculateSkillDevelopmentBoost(factoryId, workerId, taskInfo));
            totalBoost = totalBoost.add(calculateWorkloadBalance(factoryId, workerId));

            log.debug("工人 {} 策略干预总分: {}", workerId, totalBoost);
        } catch (Exception e) {
            log.warn("计算策略干预分数失败: workerId={}, error={}", workerId, e.getMessage());
        }

        return totalBoost.setScale(4, RoundingMode.HALF_UP);
    }

    @Override
    public Map<Long, BigDecimal> calculateStrategyBoosts(String factoryId, List<Long> workerIds, Map<String, Object> taskInfo) {
        Map<Long, BigDecimal> boosts = new HashMap<>();
        for (Long workerId : workerIds) {
            boosts.put(workerId, calculateStrategyBoost(factoryId, workerId, taskInfo));
        }
        return boosts;
    }

    @Override
    public List<LinUCBService.WorkerRecommendation> applyStrategyReranking(
            List<LinUCBService.WorkerRecommendation> recommendations,
            String factoryId,
            Map<String, Object> taskInfo) {

        if (recommendations == null || recommendations.isEmpty()) {
            return recommendations;
        }

        Map<Long, BigDecimal> strategyBoosts = calculateStrategyBoosts(
                factoryId,
                recommendations.stream().map(LinUCBService.WorkerRecommendation::getWorkerId).collect(Collectors.toList()),
                taskInfo
        );

        List<ScoredRecommendation> scored = recommendations.stream()
                .map(r -> {
                    BigDecimal boost = strategyBoosts.getOrDefault(r.getWorkerId(), BigDecimal.ZERO);
                    BigDecimal finalScore = r.getUcbScore().add(boost);
                    return new ScoredRecommendation(r, finalScore, boost);
                })
                .sorted((a, b) -> b.finalScore.compareTo(a.finalScore))
                .collect(Collectors.toList());

        for (ScoredRecommendation sr : scored) {
            LinUCBService.WorkerRecommendation rec = sr.recommendation;
            String originalReason = rec.getRecommendation() != null ? rec.getRecommendation() : "";

            StringBuilder reason = new StringBuilder(originalReason);
            if (sr.strategyBoost.compareTo(BigDecimal.ZERO) > 0) {
                reason.append("策略加分: +").append(sr.strategyBoost.setScale(2, RoundingMode.HALF_UP)).append("; ");
            } else if (sr.strategyBoost.compareTo(BigDecimal.ZERO) < 0) {
                reason.append("策略降权: ").append(sr.strategyBoost.setScale(2, RoundingMode.HALF_UP)).append("; ");
            }

            rec.setRecommendation(reason.toString());
            rec.setUcbScore(sr.finalScore);
        }

        log.info("策略重排序完成: {} 个工人", recommendations.size());

        return scored.stream().map(sr -> sr.recommendation).collect(Collectors.toList());
    }

    @Override
    public Map<String, BigDecimal> getStrategyBreakdown(String factoryId, Long workerId, Map<String, Object> taskInfo) {
        Map<String, BigDecimal> breakdown = new LinkedHashMap<>();

        breakdown.put("newWorker", calculateNewWorkerBoost(factoryId, workerId, taskInfo));
        breakdown.put("repetition", calculateRepetitionPenalty(factoryId, workerId, taskInfo));
        breakdown.put("fatigue", calculateFatiguePenalty(factoryId, workerId));
        breakdown.put("urgent", calculateUrgentTaskBoost(factoryId, workerId, taskInfo));
        breakdown.put("skillDevelopment", calculateSkillDevelopmentBoost(factoryId, workerId, taskInfo));
        breakdown.put("workloadBalance", calculateWorkloadBalance(factoryId, workerId));

        BigDecimal total = breakdown.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        breakdown.put("total", total);

        return breakdown;
    }

    @Override
    public BigDecimal calculateNewWorkerBoost(String factoryId, Long workerId, Map<String, Object> taskInfo) {
        int tenureDays = getWorkerTenureDays(factoryId, workerId);
        int skillLevel = getWorkerSkillLevel(factoryId, workerId);

        if (tenureDays <= config.getNewWorkerDays() && skillLevel <= config.getNewWorkerSkillThreshold()) {
            double decayFactor = 1.0 - (double) tenureDays / config.getNewWorkerDays();
            return BigDecimal.valueOf(config.getNewWorkerWeight() * decayFactor);
        }

        return BigDecimal.ZERO;
    }

    @Override
    public BigDecimal calculateRepetitionPenalty(String factoryId, Long workerId, Map<String, Object> taskInfo) {
        String processType = extractProcessType(taskInfo);
        if (processType == null) {
            return BigDecimal.ZERO;
        }

        int recentCount = getRecentProcessCount(factoryId, workerId, processType, config.getRepetitionDays());

        if (recentCount >= config.getMaxConsecutiveDays()) {
            return BigDecimal.valueOf(config.getSeverePenalty());
        } else if (recentCount > 0) {
            double penaltyFactor = (double) recentCount / config.getMaxConsecutiveDays();
            return BigDecimal.valueOf(config.getRepetitionPenalty() * penaltyFactor);
        }

        return BigDecimal.ZERO;
    }

    @Override
    public BigDecimal calculateFatiguePenalty(String factoryId, Long workerId) {
        double todayHours = getWorkerTodayHours(factoryId, workerId);
        int consecutiveDays = getWorkerConsecutiveWorkDays(factoryId, workerId);

        BigDecimal penalty = BigDecimal.ZERO;

        if (todayHours >= config.getSevereFatigueHoursThreshold()) {
            penalty = BigDecimal.valueOf(config.getSevereFatigueWeight());
        } else if (todayHours >= config.getFatigueHoursThreshold()) {
            double fatigueFactor = (todayHours - config.getFatigueHoursThreshold()) /
                    (config.getSevereFatigueHoursThreshold() - config.getFatigueHoursThreshold());
            penalty = BigDecimal.valueOf(config.getFatigueWeight() * fatigueFactor);
        }

        if (consecutiveDays >= config.getConsecutiveWorkDaysThreshold()) {
            double daysFatigue = (double) (consecutiveDays - config.getConsecutiveWorkDaysThreshold() + 1) /
                    config.getConsecutiveWorkDaysThreshold();
            penalty = penalty.add(BigDecimal.valueOf(config.getFatigueWeight() * Math.min(1.0, daysFatigue)));
        }

        return penalty;
    }

    @Override
    public BigDecimal calculateUrgentTaskBoost(String factoryId, Long workerId, Map<String, Object> taskInfo) {
        Integer priority = getIntegerFromMap(taskInfo, "priority");
        if (priority == null || priority < config.getUrgentPriorityThreshold()) {
            return BigDecimal.ZERO;
        }

        int skillLevel = getWorkerSkillLevel(factoryId, workerId);
        if (skillLevel >= config.getUrgentSkillThreshold()) {
            double skillBonus = (double) (skillLevel - config.getUrgentSkillThreshold() + 1) /
                    (5 - config.getUrgentSkillThreshold() + 1);
            return BigDecimal.valueOf(config.getUrgentTaskWeight() * skillBonus);
        }

        return BigDecimal.ZERO;
    }

    @Override
    public BigDecimal calculateSkillDevelopmentBoost(String factoryId, Long workerId, Map<String, Object> taskInfo) {
        if (random.nextDouble() > config.getSkillDevelopmentProbability()) {
            return BigDecimal.ZERO;
        }

        String processType = extractProcessType(taskInfo);
        if (processType == null) {
            return BigDecimal.ZERO;
        }

        int recentCount = getRecentProcessCount(factoryId, workerId, processType, 30);
        if (recentCount == 0) {
            return BigDecimal.valueOf(config.getSkillDevelopmentWeight());
        }

        return BigDecimal.ZERO;
    }

    @Override
    public BigDecimal calculateWorkloadBalance(String factoryId, Long workerId) {
        int weeklyTasks = getWeeklyTaskCount(factoryId, workerId);

        if (weeklyTasks >= config.getHighWorkloadThreshold()) {
            double overloadFactor = (double) (weeklyTasks - config.getHighWorkloadThreshold()) /
                    config.getHighWorkloadThreshold();
            return BigDecimal.valueOf(config.getHighWorkloadPenalty() * Math.min(1.0, overloadFactor));
        }

        return BigDecimal.ZERO;
    }

    @Override
    public int getWorkerTenureDays(String factoryId, Long workerId) {
        try {
            Optional<User> user = userRepository.findById(workerId);
            if (user.isPresent() && user.get().getFactoryId().equals(factoryId)
                    && user.get().getHireDate() != null) {
                return (int) ChronoUnit.DAYS.between(user.get().getHireDate(), LocalDate.now());
            }
        } catch (Exception e) {
            log.warn("获取工人入职天数失败: workerId={}", workerId, e);
        }
        return Integer.MAX_VALUE;
    }

    @Override
    public int getWorkerSkillLevel(String factoryId, Long workerId) {
        try {
            Optional<User> user = userRepository.findById(workerId);
            if (user.isPresent() && user.get().getFactoryId().equals(factoryId)) {
                return parseAverageSkillLevel(user.get().getSkillLevels());
            }
        } catch (Exception e) {
            log.warn("获取工人技能等级失败: workerId={}", workerId, e);
        }
        return 3;
    }

    /**
     * 解析 skillLevels JSON 字符串，计算平均技能等级
     * JSON 格式: {"切片": 3, "质检": 2, "包装": 4}
     *
     * @param skillLevelsJson 技能等级 JSON 字符串
     * @return 平均技能等级 (1-5), 默认为 3
     */
    private int parseAverageSkillLevel(String skillLevelsJson) {
        if (skillLevelsJson == null || skillLevelsJson.isEmpty()) {
            return 3; // 默认中等技能
        }

        try {
            Map<String, Integer> skillMap = objectMapper.readValue(
                    skillLevelsJson, new TypeReference<Map<String, Integer>>() {});

            if (skillMap.isEmpty()) {
                return 3;
            }

            double avg = skillMap.values().stream()
                    .mapToInt(Integer::intValue)
                    .average()
                    .orElse(3.0);

            return (int) Math.round(avg);
        } catch (Exception e) {
            log.warn("解析技能等级JSON失败: {}", skillLevelsJson, e);
            return 3;
        }
    }

    @Override
    public double getWorkerTodayHours(String factoryId, Long workerId) {
        String cacheKey = WORKER_CACHE_PREFIX + factoryId + ":" + workerId + ":todayHours";

        try {
            String cached = getCacheValue(cacheKey);
            if (cached != null) {
                return Double.parseDouble(cached);
            }

            LocalDateTime todayStart = LocalDate.now().atStartOfDay();
            Double hours = feedbackRepository.sumActualHoursByWorkerAndDate(workerId, factoryId, todayStart);
            hours = hours != null ? hours : 0.0;

            setCacheValue(cacheKey, String.valueOf(hours), CACHE_TTL_HOURS, TimeUnit.HOURS);

            return hours;
        } catch (Exception e) {
            log.warn("获取工人今日工时失败: workerId={}", workerId, e);
            return 0.0;
        }
    }

    @Override
    public int getWorkerConsecutiveWorkDays(String factoryId, Long workerId) {
        try {
            LocalDateTime sevenDaysAgo = LocalDate.now().minusDays(7).atStartOfDay();
            List<LocalDate> workDates = feedbackRepository.findDistinctWorkDatesByWorker(
                    workerId, factoryId, sevenDaysAgo);

            if (workDates == null || workDates.isEmpty()) {
                return 0;
            }

            Collections.sort(workDates, Collections.reverseOrder());
            int consecutive = 0;
            LocalDate expected = LocalDate.now();

            for (LocalDate date : workDates) {
                if (date.equals(expected) || date.equals(expected.minusDays(1))) {
                    consecutive++;
                    expected = date;
                } else {
                    break;
                }
            }

            return consecutive;
        } catch (Exception e) {
            log.warn("获取工人连续工作天数失败: workerId={}", workerId, e);
            return 0;
        }
    }

    @Override
    public int getRecentProcessCount(String factoryId, Long workerId, String processType, int days) {
        String cacheKey = PROCESS_COUNT_PREFIX + factoryId + ":" + workerId + ":" + processType + ":" + days;

        try {
            String cached = getCacheValue(cacheKey);
            if (cached != null) {
                return Integer.parseInt(cached);
            }

            LocalDateTime startDate = LocalDate.now().minusDays(days).atStartOfDay();
            Integer count = feedbackRepository.countByWorkerAndProcessType(
                    workerId, factoryId, processType, startDate);
            count = count != null ? count : 0;

            setCacheValue(cacheKey, String.valueOf(count), CACHE_TTL_HOURS, TimeUnit.HOURS);

            return count;
        } catch (Exception e) {
            log.warn("获取工人近期工序执行次数失败: workerId={}, processType={}", workerId, processType, e);
            return 0;
        }
    }

    @Override
    public int getWeeklyTaskCount(String factoryId, Long workerId) {
        try {
            LocalDateTime weekStart = LocalDate.now().minusDays(7).atStartOfDay();
            Integer count = feedbackRepository.countByWorkerAndDateAfter(workerId, factoryId, weekStart);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("获取工人本周任务数失败: workerId={}", workerId, e);
            return 0;
        }
    }

    private String extractProcessType(Map<String, Object> taskInfo) {
        if (taskInfo == null) return null;
        Object value = taskInfo.get("processType");
        if (value == null) value = taskInfo.get("stageType");
        if (value == null) value = taskInfo.get("taskType");
        return value != null ? value.toString() : null;
    }

    private Integer getIntegerFromMap(Map<String, Object> map, String key) {
        if (map == null || !map.containsKey(key)) return null;
        Object value = map.get(key);
        if (value instanceof Integer) return (Integer) value;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (Exception e) {
            return null;
        }
    }

    // ==================== 缓存辅助方法 ====================

    /**
     * 获取缓存值 (支持Redis和内存缓存回退)
     */
    private String getCacheValue(String key) {
        if (useMemoryCache) {
            return memoryCache.get(key);
        }
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            log.debug("Redis获取缓存失败, 回退到内存缓存: key={}", key);
            return memoryCache.get(key);
        }
    }

    /**
     * 设置缓存值 (支持Redis和内存缓存回退)
     */
    private void setCacheValue(String key, String value, long timeout, TimeUnit unit) {
        if (useMemoryCache) {
            memoryCache.put(key, value);
            return;
        }
        try {
            redisTemplate.opsForValue().set(key, value, timeout, unit);
        } catch (Exception e) {
            log.debug("Redis设置缓存失败, 回退到内存缓存: key={}", key);
            memoryCache.put(key, value);
        }
    }

    private static class ScoredRecommendation {
        LinUCBService.WorkerRecommendation recommendation;
        BigDecimal finalScore;
        BigDecimal strategyBoost;

        ScoredRecommendation(LinUCBService.WorkerRecommendation recommendation,
                           BigDecimal finalScore, BigDecimal strategyBoost) {
            this.recommendation = recommendation;
            this.finalScore = finalScore;
            this.strategyBoost = strategyBoost;
        }
    }
}
