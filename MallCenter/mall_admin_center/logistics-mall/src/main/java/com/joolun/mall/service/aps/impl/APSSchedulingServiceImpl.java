package com.joolun.mall.service.aps.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.aps.*;
import com.joolun.mall.mapper.aps.*;
import com.joolun.mall.service.aps.APSFeatureService;
import com.joolun.mall.service.aps.APSSchedulingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * APS 排程服务实现
 * (复用配送调度的多策略模式)
 *
 * 核心算法:
 * 1. 多策略评分 (类似多路召回)
 * 2. 约束传播 (检测并处理冲突)
 * 3. 换型优化 (TSP启发式)
 * 4. 人员调配 (负载均衡)
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class APSSchedulingServiceImpl implements APSSchedulingService {

    private final ProductionOrderMapper orderMapper;
    private final ProductionLineMapper lineMapper;
    private final ProductionWorkerMapper workerMapper;
    private final ProductionEquipmentMapper equipmentMapper;
    private final ProductionMoldMapper moldMapper;
    private final ChangeoverMatrixMapper changeoverMapper;
    private final ScheduleTaskMapper taskMapper;
    private final WorkerAssignmentMapper workerAssignmentMapper;
    private final ScheduleConflictMapper conflictMapper;
    private final APSFeatureService featureService;

    // 调度策略权重 (可配置)
    private final ConcurrentHashMap<String, Double> strategyWeights = new ConcurrentHashMap<>();

    // 策略名称常量
    private static final String STRATEGY_EARLIEST_DEADLINE = "earliest_deadline";
    private static final String STRATEGY_SHORTEST_PROCESS = "shortest_process";
    private static final String STRATEGY_MIN_CHANGEOVER = "min_changeover";
    private static final String STRATEGY_CAPACITY_MATCH = "capacity_match";
    private static final String STRATEGY_MATERIAL_READY = "material_ready";
    private static final String STRATEGY_URGENCY_FIRST = "urgency_first";

    // 统计
    private final AtomicInteger totalScheduled = new AtomicInteger(0);
    private final AtomicInteger batchCounter = new AtomicInteger(0);

    @PostConstruct
    public void init() {
        // 初始化默认权重
        strategyWeights.put(STRATEGY_EARLIEST_DEADLINE, 0.25);
        strategyWeights.put(STRATEGY_SHORTEST_PROCESS, 0.20);
        strategyWeights.put(STRATEGY_MIN_CHANGEOVER, 0.20);
        strategyWeights.put(STRATEGY_CAPACITY_MATCH, 0.15);
        strategyWeights.put(STRATEGY_MATERIAL_READY, 0.10);
        strategyWeights.put(STRATEGY_URGENCY_FIRST, 0.10);

        log.info("APS排程服务初始化完成，策略权重: {}", strategyWeights);
    }

    @Override
    public List<LineCandidate> scheduleOrder(ProductionOrder order) {
        if (order == null) {
            return Collections.emptyList();
        }

        log.debug("开始排程订单: orderNo={}", order.getOrderNo());

        // 获取可用产线
        List<ProductionLine> lines = getAvailableLines(order);
        if (lines.isEmpty()) {
            log.warn("没有可用产线: orderNo={}", order.getOrderNo());
            return Collections.emptyList();
        }

        List<LineCandidate> candidates = new ArrayList<>();

        for (ProductionLine line : lines) {
            // 计算各策略得分
            Map<String, Double> strategyScores = calculateStrategyScores(order, line);

            // 加权综合得分
            double totalScore = 0;
            for (Map.Entry<String, Double> entry : strategyScores.entrySet()) {
                double weight = strategyWeights.getOrDefault(entry.getKey(), 0.0);
                totalScore += weight * entry.getValue();
            }

            // 计算预估时长和换型时间
            int estimatedDuration = featureService.estimateProductionDuration(order, line);
            int changeoverTime = featureService.calculateChangeoverTime(
                line.getCurrentProductCategory(),
                order.getProductCategory(),
                line.getId()
            );

            // 计算可用人员数
            int availableWorkers = countAvailableWorkers(line.getId());

            LineCandidate candidate = new LineCandidate(line.getId(), line, totalScore);
            candidate.setStrategyScores(strategyScores);
            candidate.setEstimatedDuration(estimatedDuration);
            candidate.setChangeoverTime(changeoverTime);
            candidate.setAvailableWorkers(availableWorkers);

            candidates.add(candidate);
        }

        // 按得分降序排序
        candidates.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));

        log.debug("订单排程完成: orderNo={}, 候选产线数={}", order.getOrderNo(), candidates.size());
        return candidates;
    }

    @Override
    @Transactional
    public SchedulingResult batchSchedule(LocalDate startDate, LocalDate endDate) {
        log.info("开始批量排程: {} ~ {}", startDate, endDate);
        long startTime = System.currentTimeMillis();

        String batchNo = generateBatchNo();
        SchedulingResult result = new SchedulingResult();
        result.setScheduleBatchNo(batchNo);
        result.setScheduleDate(startDate);

        // 获取待排程订单
        List<ProductionOrder> orders = orderMapper.selectList(
            new LambdaQueryWrapper<ProductionOrder>()
                .eq(ProductionOrder::getStatus, "pending")
                .le(ProductionOrder::getLatestEnd, endDate.plusDays(1).atStartOfDay())
                .orderByDesc(ProductionOrder::getPriority)
                .orderByAsc(ProductionOrder::getLatestEnd)
        );

        result.setTotalOrders(orders.size());

        if (orders.isEmpty()) {
            result.setScheduledOrders(0);
            result.setUnscheduledOrders(0);
            result.setMessage("没有待排程订单");
            result.setElapsedMs(System.currentTimeMillis() - startTime);
            return result;
        }

        // 获取可用资源
        List<ProductionLine> lines = lineMapper.selectList(
            new LambdaQueryWrapper<ProductionLine>()
                .in(ProductionLine::getStatus, Arrays.asList("available", "running"))
        );

        if (lines.isEmpty()) {
            result.setUnscheduledOrders(orders.size());
            result.setMessage("没有可用产线");
            result.setElapsedMs(System.currentTimeMillis() - startTime);
            return result;
        }

        // 分析混批机会
        List<MixBatchGroup> mixBatchGroups = analyzeMixBatchOpportunities(orders);

        // 产线排程状态
        Map<String, LineScheduleState> lineStates = new HashMap<>();
        for (ProductionLine line : lines) {
            lineStates.put(line.getId(), new LineScheduleState(line));
        }

        List<ScheduleTask> createdTasks = new ArrayList<>();
        List<ScheduleConflict> conflicts = new ArrayList<>();
        List<WorkerAssignment> workerAssignments = new ArrayList<>();
        int scheduledCount = 0;
        int totalChangeoverMinutes = 0;

        // 贪心调度 (优先处理混批组)
        Set<String> processedOrderIds = new HashSet<>();

        // 1. 先处理混批组
        for (MixBatchGroup group : mixBatchGroups) {
            ScheduleTask task = scheduleMixBatchGroup(group, lineStates, batchNo);
            if (task != null) {
                createdTasks.add(task);
                totalChangeoverMinutes += task.getChangeoverMinutes() != null ? task.getChangeoverMinutes() : 0;
                for (ProductionOrder o : group.getOrders()) {
                    processedOrderIds.add(o.getId());
                    scheduledCount++;
                }
            }
        }

        // 2. 处理剩余订单
        for (ProductionOrder order : orders) {
            if (processedOrderIds.contains(order.getId())) {
                continue;
            }

            List<LineCandidate> candidates = scheduleOrder(order);
            if (!candidates.isEmpty()) {
                LineCandidate best = candidates.get(0);
                LineScheduleState state = lineStates.get(best.getLineId());

                // 创建排程任务
                ScheduleTask task = createScheduleTask(order, state, batchNo);
                if (task != null) {
                    createdTasks.add(task);
                    totalChangeoverMinutes += task.getChangeoverMinutes() != null ? task.getChangeoverMinutes() : 0;

                    // 更新产线状态
                    state.addTask(task);

                    // 更新订单
                    order.setScheduledLineId(best.getLineId());
                    order.setStatus("scheduled");
                    order.setScheduleBatchNo(batchNo);
                    orderMapper.updateById(order);

                    scheduledCount++;
                }
            }
        }

        // 检测冲突
        conflicts = detectConflicts(createdTasks);

        // 优化人员分配
        workerAssignments = generateWorkerAssignments(createdTasks, batchNo);

        // 保存任务
        for (ScheduleTask task : createdTasks) {
            taskMapper.insert(task);
        }

        // 保存冲突
        for (ScheduleConflict conflict : conflicts) {
            conflictMapper.insert(conflict);
        }

        // 保存人员分配
        for (WorkerAssignment assignment : workerAssignments) {
            workerAssignmentMapper.insert(assignment);
        }

        // 计算统计指标
        result.setScheduledOrders(scheduledCount);
        result.setUnscheduledOrders(orders.size() - scheduledCount);
        result.setTasks(createdTasks);
        result.setConflicts(conflicts);
        result.setWorkerAssignments(workerAssignments);
        result.setTotalChangeoverMinutes(totalChangeoverMinutes);
        result.setLineUtilization(calculateLineUtilization(lineStates, startDate));
        result.setWorkerUtilization(calculateWorkerUtilization(workerAssignments));
        result.setOnTimeRate(calculateOnTimeRate(createdTasks));
        result.setElapsedMs(System.currentTimeMillis() - startTime);
        result.setMessage("排程完成");

        totalScheduled.addAndGet(scheduledCount);

        log.info("批量排程完成: total={}, scheduled={}, conflicts={}, elapsed={}ms",
                orders.size(), scheduledCount, conflicts.size(), result.getElapsedMs());

        return result;
    }

    @Override
    @Transactional
    public InsertResult insertUrgentOrder(ProductionOrder order) {
        log.info("紧急插单: orderNo={}", order.getOrderNo());

        InsertResult result = new InsertResult();

        // 标记为紧急
        order.setIsUrgent(true);
        order.setPriority(10);

        // 获取最优产线
        List<LineCandidate> candidates = scheduleOrder(order);
        if (candidates.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("没有可用产线");
            return result;
        }

        LineCandidate best = candidates.get(0);

        // 找到该产线上的现有任务
        List<ScheduleTask> existingTasks = taskMapper.selectList(
            new LambdaQueryWrapper<ScheduleTask>()
                .eq(ScheduleTask::getLineId, best.getLineId())
                .in(ScheduleTask::getStatus, Arrays.asList("planned", "confirmed"))
                .orderByAsc(ScheduleTask::getPlannedStart)
        );

        // 创建紧急任务
        String batchNo = generateBatchNo();
        ScheduleTask urgentTask = new ScheduleTask();
        urgentTask.setTaskNo("URG-" + System.currentTimeMillis());
        urgentTask.setScheduleBatchNo(batchNo);
        urgentTask.setOrderId(order.getId());
        urgentTask.setOrderNo(order.getOrderNo());
        urgentTask.setTaskType("production");
        urgentTask.setProductId(order.getProductId());
        urgentTask.setProductName(order.getProductName());
        urgentTask.setProductCategory(order.getProductCategory());
        urgentTask.setPlannedQty(order.getPlannedQty());
        urgentTask.setLineId(best.getLineId());
        urgentTask.setLineName(best.getLine().getLineName());

        // 插入到最近空闲时间
        LocalDateTime insertTime = best.getLine().getEstimatedFreeTime();
        if (insertTime == null || insertTime.isBefore(LocalDateTime.now())) {
            insertTime = LocalDateTime.now().plusMinutes(best.getChangeoverTime());
        }

        urgentTask.setPlannedStart(insertTime);
        urgentTask.setPlannedEnd(insertTime.plusMinutes(best.getEstimatedDuration()));
        urgentTask.setPlannedDuration(best.getEstimatedDuration());
        urgentTask.setChangeoverMinutes(best.getChangeoverTime());
        urgentTask.setStatus("confirmed");
        urgentTask.setSequenceInLine(1);

        // 调整受影响的任务
        List<ScheduleTask> affectedTasks = new ArrayList<>();
        int delayMinutes = best.getEstimatedDuration() + best.getChangeoverTime();

        for (ScheduleTask task : existingTasks) {
            if (task.getPlannedStart().isAfter(insertTime) ||
                task.getPlannedStart().equals(insertTime)) {
                task.setPlannedStart(task.getPlannedStart().plusMinutes(delayMinutes));
                task.setPlannedEnd(task.getPlannedEnd().plusMinutes(delayMinutes));
                taskMapper.updateById(task);
                affectedTasks.add(task);
            }
        }

        // 保存紧急任务
        taskMapper.insert(urgentTask);

        // 更新订单
        order.setScheduledLineId(best.getLineId());
        order.setStatus("scheduled");
        order.setScheduleBatchNo(batchNo);
        orderMapper.updateById(order);

        // 检测新冲突
        List<ScheduleTask> allTasks = new ArrayList<>();
        allTasks.add(urgentTask);
        allTasks.addAll(affectedTasks);
        List<ScheduleConflict> newConflicts = detectConflicts(allTasks);

        result.setSuccess(true);
        result.setInsertedTask(urgentTask);
        result.setAffectedTasks(affectedTasks);
        result.setNewConflicts(newConflicts);
        result.setMessage("紧急插单成功，影响 " + affectedTasks.size() + " 个任务");

        log.info("紧急插单完成: orderNo={}, affectedTasks={}", order.getOrderNo(), affectedTasks.size());
        return result;
    }

    @Override
    @Transactional
    public SchedulingResult reschedule(LocalDate fromDate) {
        log.info("重新排程: fromDate={}", fromDate);

        // 取消从该日期开始的所有未执行任务
        List<ScheduleTask> tasksToCancel = taskMapper.selectList(
            new LambdaQueryWrapper<ScheduleTask>()
                .ge(ScheduleTask::getPlannedStart, fromDate.atStartOfDay())
                .in(ScheduleTask::getStatus, Arrays.asList("planned", "confirmed"))
        );

        for (ScheduleTask task : tasksToCancel) {
            task.setStatus("cancelled");
            taskMapper.updateById(task);

            // 恢复订单状态
            ProductionOrder order = orderMapper.selectById(task.getOrderId());
            if (order != null) {
                order.setStatus("pending");
                order.setScheduledLineId(null);
                orderMapper.updateById(order);
            }
        }

        log.info("已取消 {} 个任务", tasksToCancel.size());

        // 重新排程
        return batchSchedule(fromDate, fromDate.plusDays(7));
    }

    @Override
    public List<ScheduleConflict> detectConflicts(List<ScheduleTask> tasks) {
        List<ScheduleConflict> conflicts = new ArrayList<>();

        // 按产线分组
        Map<String, List<ScheduleTask>> tasksByLine = tasks.stream()
            .filter(t -> t.getLineId() != null)
            .collect(Collectors.groupingBy(ScheduleTask::getLineId));

        // 检测时间冲突
        for (Map.Entry<String, List<ScheduleTask>> entry : tasksByLine.entrySet()) {
            List<ScheduleTask> lineTasks = entry.getValue();
            lineTasks.sort(Comparator.comparing(ScheduleTask::getPlannedStart));

            for (int i = 0; i < lineTasks.size() - 1; i++) {
                ScheduleTask current = lineTasks.get(i);
                ScheduleTask next = lineTasks.get(i + 1);

                if (current.getPlannedEnd().isAfter(next.getPlannedStart())) {
                    ScheduleConflict conflict = new ScheduleConflict();
                    conflict.setScheduleBatchNo(current.getScheduleBatchNo());
                    conflict.setConflictType("time_overlap");
                    conflict.setSeverity("high");
                    conflict.setOrder1Id(current.getOrderId());
                    conflict.setOrder1No(current.getOrderNo());
                    conflict.setOrder2Id(next.getOrderId());
                    conflict.setOrder2No(next.getOrderNo());
                    conflict.setConflictStart(next.getPlannedStart());
                    conflict.setConflictEnd(current.getPlannedEnd());
                    conflict.setDescription("任务时间重叠: " + current.getTaskNo() + " 与 " + next.getTaskNo());
                    conflict.setSuggestedSolution("调整任务顺序或延后开始时间");
                    conflicts.add(conflict);
                }
            }
        }

        // 检测模具冲突
        Map<String, List<ScheduleTask>> tasksByMold = tasks.stream()
            .filter(t -> t.getMoldId() != null)
            .collect(Collectors.groupingBy(ScheduleTask::getMoldId));

        for (Map.Entry<String, List<ScheduleTask>> entry : tasksByMold.entrySet()) {
            List<ScheduleTask> moldTasks = entry.getValue();
            if (moldTasks.size() > 1) {
                moldTasks.sort(Comparator.comparing(ScheduleTask::getPlannedStart));

                for (int i = 0; i < moldTasks.size() - 1; i++) {
                    ScheduleTask current = moldTasks.get(i);
                    ScheduleTask next = moldTasks.get(i + 1);

                    if (current.getPlannedEnd().isAfter(next.getPlannedStart()) &&
                        !current.getLineId().equals(next.getLineId())) {
                        ScheduleConflict conflict = new ScheduleConflict();
                        conflict.setScheduleBatchNo(current.getScheduleBatchNo());
                        conflict.setConflictType("mold");
                        conflict.setSeverity("critical");
                        conflict.setOrder1Id(current.getOrderId());
                        conflict.setOrder1No(current.getOrderNo());
                        conflict.setOrder2Id(next.getOrderId());
                        conflict.setOrder2No(next.getOrderNo());
                        conflict.setConflictResourceId(entry.getKey());
                        conflict.setDescription("模具冲突: 同一模具被多条产线同时需要");
                        conflict.setSuggestedSolution("调整生产顺序或使用备用模具");
                        conflicts.add(conflict);
                    }
                }
            }
        }

        // 检测交期冲突
        for (ScheduleTask task : tasks) {
            if (task.getOrderId() != null) {
                ProductionOrder order = orderMapper.selectById(task.getOrderId());
                if (order != null && order.getLatestEnd() != null &&
                    task.getPlannedEnd().isAfter(order.getLatestEnd())) {

                    long delayMinutes = ChronoUnit.MINUTES.between(order.getLatestEnd(), task.getPlannedEnd());

                    ScheduleConflict conflict = new ScheduleConflict();
                    conflict.setScheduleBatchNo(task.getScheduleBatchNo());
                    conflict.setConflictType("time_window");
                    conflict.setSeverity(delayMinutes > 480 ? "critical" : "high");
                    conflict.setOrder1Id(order.getId());
                    conflict.setOrder1No(order.getOrderNo());
                    conflict.setConflictStart(order.getLatestEnd());
                    conflict.setConflictEnd(task.getPlannedEnd());
                    conflict.setDescription("交期延误: 预计延迟 " + delayMinutes + " 分钟");
                    conflict.setEstimatedDelayMinutes((int) delayMinutes);
                    conflict.setSuggestedSolution("增加人员加速或调整优先级");
                    conflicts.add(conflict);
                }
            }
        }

        return conflicts;
    }

    @Override
    public boolean resolveConflict(ScheduleConflict conflict) {
        // 根据冲突类型尝试自动解决
        switch (conflict.getConflictType()) {
            case "time_overlap":
                // 尝试调整后续任务开始时间
                return resolveTimeOverlap(conflict);
            case "mold":
                // 尝试找替代模具或调整顺序
                return resolveMoldConflict(conflict);
            case "time_window":
                // 标记为需人工处理
                conflict.setSuggestedSolution("建议: 1) 增加人员 2) 拆分订单 3) 协调客户延期");
                conflictMapper.updateById(conflict);
                return false;
            default:
                return false;
        }
    }

    @Override
    public List<MixBatchGroup> analyzeMixBatchOpportunities(List<ProductionOrder> orders) {
        List<MixBatchGroup> groups = new ArrayList<>();

        // 按产品类别分组
        Map<String, List<ProductionOrder>> ordersByCategory = orders.stream()
            .filter(o -> Boolean.TRUE.equals(o.getAllowMixBatch()))
            .collect(Collectors.groupingBy(ProductionOrder::getProductCategory));

        int groupIndex = 0;
        for (Map.Entry<String, List<ProductionOrder>> entry : ordersByCategory.entrySet()) {
            List<ProductionOrder> categoryOrders = entry.getValue();

            // 如果同类别有2个以上订单，可以考虑混批
            if (categoryOrders.size() >= 2) {
                // 按交期排序
                categoryOrders.sort(Comparator.comparing(ProductionOrder::getLatestEnd));

                // 简单策略: 交期接近的订单可以合并
                List<ProductionOrder> currentGroup = new ArrayList<>();
                LocalDateTime groupDeadline = null;

                for (ProductionOrder order : categoryOrders) {
                    if (groupDeadline == null) {
                        currentGroup.add(order);
                        groupDeadline = order.getLatestEnd();
                    } else if (ChronoUnit.HOURS.between(groupDeadline, order.getLatestEnd()) <= 24) {
                        // 交期在24小时内的可以合并
                        currentGroup.add(order);
                        groupDeadline = order.getLatestEnd();
                    } else {
                        // 创建混批组
                        if (currentGroup.size() >= 2) {
                            groups.add(createMixBatchGroup(currentGroup, ++groupIndex));
                        }
                        currentGroup = new ArrayList<>();
                        currentGroup.add(order);
                        groupDeadline = order.getLatestEnd();
                    }
                }

                // 处理最后一组
                if (currentGroup.size() >= 2) {
                    groups.add(createMixBatchGroup(currentGroup, ++groupIndex));
                }
            }
        }

        log.info("发现 {} 个混批机会", groups.size());
        return groups;
    }

    @Override
    public ScheduleTask mergeMixBatch(MixBatchGroup group) {
        if (group == null || group.getOrders() == null || group.getOrders().isEmpty()) {
            return null;
        }

        ScheduleTask task = new ScheduleTask();
        task.setIsMixBatch(true);
        task.setMixBatchOrderIds(
            group.getOrders().stream()
                .map(ProductionOrder::getId)
                .collect(Collectors.joining(","))
        );

        // 使用第一个订单的产品信息
        ProductionOrder first = group.getOrders().get(0);
        task.setProductId(first.getProductId());
        task.setProductName(first.getProductName() + " (混批)");
        task.setProductCategory(first.getProductCategory());

        // 合计数量
        task.setPlannedQty(
            group.getOrders().stream()
                .map(ProductionOrder::getPlannedQty)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)
        );

        return task;
    }

    @Override
    public List<WorkerAssignment> optimizeWorkerAssignment(LocalDate date) {
        // 获取当天的所有任务
        List<ScheduleTask> tasks = taskMapper.selectList(
            new LambdaQueryWrapper<ScheduleTask>()
                .ge(ScheduleTask::getPlannedStart, date.atStartOfDay())
                .lt(ScheduleTask::getPlannedStart, date.plusDays(1).atStartOfDay())
                .in(ScheduleTask::getStatus, Arrays.asList("planned", "confirmed"))
        );

        return generateWorkerAssignments(tasks, "OPT-" + date.toString());
    }

    @Override
    public List<TransferSuggestion> suggestWorkerTransfer(String fromLineId, int workerCount) {
        List<TransferSuggestion> suggestions = new ArrayList<>();

        // 获取其他产线的状态
        List<ProductionLine> otherLines = lineMapper.selectList(
            new LambdaQueryWrapper<ProductionLine>()
                .ne(ProductionLine::getId, fromLineId)
                .eq(ProductionLine::getStatus, "running")
        );

        for (ProductionLine line : otherLines) {
            // 检查是否需要更多人员
            int currentWorkers = line.getCurrentWorkerCount() != null ? line.getCurrentWorkerCount() : 0;
            int maxWorkers = line.getMaxWorkerCount() != null ? line.getMaxWorkerCount() : 8;

            if (currentWorkers < maxWorkers) {
                TransferSuggestion suggestion = new TransferSuggestion();
                suggestion.setToLineId(line.getId());
                suggestion.setToLineName(line.getLineName());
                suggestion.setSuggestedWorkers(Math.min(workerCount, maxWorkers - currentWorkers));

                // 计算预期效率提升
                double currentEfficiency = (double) currentWorkers / line.getStandardWorkerCount();
                double newEfficiency = (double) (currentWorkers + suggestion.getSuggestedWorkers()) /
                    line.getStandardWorkerCount();
                suggestion.setExpectedEfficiencyGain((newEfficiency - currentEfficiency) * 100);
                suggestion.setReason("当前人员不足，增员可提升产能");

                suggestions.add(suggestion);
            }
        }

        // 按效率提升排序
        suggestions.sort((a, b) -> Double.compare(b.getExpectedEfficiencyGain(), a.getExpectedEfficiencyGain()));

        return suggestions;
    }

    @Override
    public List<ScheduleTask> optimizeSequence(List<ScheduleTask> tasks, String lineId) {
        if (tasks == null || tasks.size() <= 1) {
            return tasks;
        }

        // TSP启发式: 最近邻算法
        // 目标: 最小化总换型时间

        List<ScheduleTask> optimized = new ArrayList<>();
        Set<String> scheduled = new HashSet<>();

        // 从交期最紧的开始
        tasks.sort(Comparator.comparing(t ->
            t.getOrderId() != null ? orderMapper.selectById(t.getOrderId()).getLatestEnd() : LocalDateTime.MAX
        ));

        ScheduleTask current = tasks.get(0);
        optimized.add(current);
        scheduled.add(current.getId());

        while (optimized.size() < tasks.size()) {
            ScheduleTask next = null;
            int minChangeover = Integer.MAX_VALUE;

            for (ScheduleTask candidate : tasks) {
                if (scheduled.contains(candidate.getId())) {
                    continue;
                }

                int changeover = featureService.calculateChangeoverTime(
                    current.getProductCategory(),
                    candidate.getProductCategory(),
                    lineId
                );

                if (changeover < minChangeover) {
                    minChangeover = changeover;
                    next = candidate;
                }
            }

            if (next != null) {
                optimized.add(next);
                scheduled.add(next.getId());
                current = next;
            }
        }

        // 更新顺序号
        for (int i = 0; i < optimized.size(); i++) {
            optimized.get(i).setSequenceInLine(i + 1);
        }

        return optimized;
    }

    @Override
    public int calculateChangeoverTime(String fromCategory, String toCategory, String lineId) {
        return featureService.calculateChangeoverTime(fromCategory, toCategory, lineId);
    }

    @Override
    public Map<String, Double> getStrategyWeights() {
        return new HashMap<>(strategyWeights);
    }

    @Override
    public void updateStrategyWeights(Map<String, Double> weights) {
        if (weights == null || weights.isEmpty()) {
            return;
        }

        // 归一化
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(total - 1.0) > 0.01) {
            for (Map.Entry<String, Double> entry : weights.entrySet()) {
                weights.put(entry.getKey(), entry.getValue() / total);
            }
        }

        strategyWeights.putAll(weights);
        log.info("APS调度策略权重已更新: {}", strategyWeights);
    }

    @Override
    public Map<String, Object> getSchedulingStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalScheduled", totalScheduled.get());
        stats.put("strategyWeights", new HashMap<>(strategyWeights));

        // 今日统计
        LocalDate today = LocalDate.now();
        long todayTasks = taskMapper.selectCount(
            new LambdaQueryWrapper<ScheduleTask>()
                .ge(ScheduleTask::getCreatedAt, today.atStartOfDay())
        );
        stats.put("todayTasks", todayTasks);

        // 冲突统计
        long unresolvedConflicts = conflictMapper.selectCount(
            new LambdaQueryWrapper<ScheduleConflict>()
                .eq(ScheduleConflict::getIsResolved, false)
        );
        stats.put("unresolvedConflicts", unresolvedConflicts);

        return stats;
    }

    // ==================== 私有方法 ====================

    private List<ProductionLine> getAvailableLines(ProductionOrder order) {
        List<ProductionLine> lines = lineMapper.selectList(
            new LambdaQueryWrapper<ProductionLine>()
                .in(ProductionLine::getStatus, Arrays.asList("available", "running"))
        );

        // 如果指定了产线，优先返回
        if (order.getAssignedLineId() != null) {
            return lines.stream()
                .filter(l -> l.getId().equals(order.getAssignedLineId()))
                .collect(Collectors.toList());
        }

        // 过滤能生产该产品类别的产线
        String category = order.getProductCategory();
        if (category != null) {
            lines = lines.stream()
                .filter(l -> l.getProductCategories() == null ||
                    l.getProductCategories().contains(category))
                .collect(Collectors.toList());
        }

        return lines;
    }

    private Map<String, Double> calculateStrategyScores(ProductionOrder order, ProductionLine line) {
        Map<String, Double> scores = new HashMap<>();

        // 1. 最早交期策略
        if (order.getLatestEnd() != null) {
            long hoursToDeadline = ChronoUnit.HOURS.between(LocalDateTime.now(), order.getLatestEnd());
            scores.put(STRATEGY_EARLIEST_DEADLINE, Math.exp(-hoursToDeadline / 48.0));
        } else {
            scores.put(STRATEGY_EARLIEST_DEADLINE, 0.5);
        }

        // 2. 最短工时策略
        int duration = featureService.estimateProductionDuration(order, line);
        scores.put(STRATEGY_SHORTEST_PROCESS, Math.exp(-duration / 480.0));

        // 3. 最小换型时间策略
        int changeover = featureService.calculateChangeoverTime(
            line.getCurrentProductCategory(),
            order.getProductCategory(),
            line.getId()
        );
        scores.put(STRATEGY_MIN_CHANGEOVER, Math.exp(-changeover / 60.0));

        // 4. 产能匹配策略
        double capacity = line.getStandardCapacity() != null ?
            line.getStandardCapacity().doubleValue() : 100;
        double qty = order.getPlannedQty() != null ? order.getPlannedQty().doubleValue() : 0;
        double hoursNeeded = qty / capacity;
        scores.put(STRATEGY_CAPACITY_MATCH, hoursNeeded <= 8 ? 1.0 : Math.exp(-(hoursNeeded - 8) / 4.0));

        // 5. 物料齐套策略
        String materialStatus = order.getMaterialStatus();
        if ("ready".equals(materialStatus)) {
            scores.put(STRATEGY_MATERIAL_READY, 1.0);
        } else if ("partial".equals(materialStatus)) {
            scores.put(STRATEGY_MATERIAL_READY, 0.5);
        } else {
            scores.put(STRATEGY_MATERIAL_READY, 0.1);
        }

        // 6. 紧急度策略
        int priority = order.getPriority() != null ? order.getPriority() : 5;
        boolean isUrgent = Boolean.TRUE.equals(order.getIsUrgent());
        scores.put(STRATEGY_URGENCY_FIRST, (priority / 10.0) + (isUrgent ? 0.5 : 0));

        return scores;
    }

    private int countAvailableWorkers(String lineId) {
        Long count = workerMapper.selectCount(
            new LambdaQueryWrapper<ProductionWorker>()
                .eq(ProductionWorker::getCurrentLineId, lineId)
                .eq(ProductionWorker::getStatus, "available")
        );
        return count != null ? count.intValue() : 0;
    }

    private String generateBatchNo() {
        return "SCH-" + LocalDate.now().toString().replace("-", "") +
            "-" + String.format("%04d", batchCounter.incrementAndGet());
    }

    private ScheduleTask createScheduleTask(ProductionOrder order, LineScheduleState state, String batchNo) {
        ScheduleTask task = new ScheduleTask();
        task.setTaskNo("TSK-" + System.currentTimeMillis());
        task.setScheduleBatchNo(batchNo);
        task.setOrderId(order.getId());
        task.setOrderNo(order.getOrderNo());
        task.setTaskType("production");
        task.setProductId(order.getProductId());
        task.setProductName(order.getProductName());
        task.setProductSpec(order.getProductSpec());
        task.setProductCategory(order.getProductCategory());
        task.setPlannedQty(order.getPlannedQty());

        // 计算时间
        int changeover = featureService.calculateChangeoverTime(
            state.getLastCategory(),
            order.getProductCategory(),
            state.getLine().getId()
        );
        int duration = featureService.estimateProductionDuration(order, state.getLine());

        LocalDateTime startTime = state.getNextAvailableTime().plusMinutes(changeover);
        LocalDateTime endTime = startTime.plusMinutes(duration);

        task.setPlannedStart(startTime);
        task.setPlannedEnd(endTime);
        task.setPlannedDuration(duration);
        task.setChangeoverMinutes(changeover);
        task.setLineId(state.getLine().getId());
        task.setLineName(state.getLine().getLineName());
        task.setStatus("planned");
        task.setSequenceInLine(state.getTaskCount() + 1);

        // 检查是否跨天
        task.setIsCrossDay(!startTime.toLocalDate().equals(endTime.toLocalDate()));

        // 计算交期差距
        if (order.getLatestEnd() != null) {
            long gapMinutes = ChronoUnit.MINUTES.between(endTime, order.getLatestEnd());
            task.setDeliveryGapMinutes((int) gapMinutes);
            task.setMeetsTimeWindow(gapMinutes >= 0);
        }

        return task;
    }

    private ScheduleTask scheduleMixBatchGroup(MixBatchGroup group, Map<String, LineScheduleState> lineStates,
                                                String batchNo) {
        if (group.getOrders().isEmpty()) {
            return null;
        }

        // 找最优产线
        String lineId = group.getSuggestedLineId();
        if (lineId == null) {
            // 选择换型时间最短的产线
            int minChangeover = Integer.MAX_VALUE;
            for (Map.Entry<String, LineScheduleState> entry : lineStates.entrySet()) {
                int changeover = featureService.calculateChangeoverTime(
                    entry.getValue().getLastCategory(),
                    group.getProductCategory(),
                    entry.getKey()
                );
                if (changeover < minChangeover) {
                    minChangeover = changeover;
                    lineId = entry.getKey();
                }
            }
        }

        if (lineId == null) {
            return null;
        }

        LineScheduleState state = lineStates.get(lineId);
        ScheduleTask task = mergeMixBatch(group);

        task.setTaskNo("MIX-" + System.currentTimeMillis());
        task.setScheduleBatchNo(batchNo);
        task.setTaskType("production");

        // 计算时间
        int changeover = featureService.calculateChangeoverTime(
            state.getLastCategory(),
            group.getProductCategory(),
            lineId
        );

        // 估算混批总时长
        int totalDuration = 0;
        for (ProductionOrder order : group.getOrders()) {
            totalDuration += featureService.estimateProductionDuration(order, state.getLine());
        }
        // 混批节省的换型时间
        totalDuration -= group.getSavedChangeoverMinutes();

        LocalDateTime startTime = state.getNextAvailableTime().plusMinutes(changeover);
        LocalDateTime endTime = startTime.plusMinutes(totalDuration);

        task.setPlannedStart(startTime);
        task.setPlannedEnd(endTime);
        task.setPlannedDuration(totalDuration);
        task.setChangeoverMinutes(changeover);
        task.setLineId(lineId);
        task.setLineName(state.getLine().getLineName());
        task.setStatus("planned");

        // 更新产线状态
        state.addTask(task);

        // 更新订单状态
        for (ProductionOrder order : group.getOrders()) {
            order.setScheduledLineId(lineId);
            order.setStatus("scheduled");
            order.setScheduleBatchNo(batchNo);
            orderMapper.updateById(order);
        }

        return task;
    }

    private List<WorkerAssignment> generateWorkerAssignments(List<ScheduleTask> tasks, String batchNo) {
        List<WorkerAssignment> assignments = new ArrayList<>();

        // 按产线分组
        Map<String, List<ScheduleTask>> tasksByLine = tasks.stream()
            .filter(t -> t.getLineId() != null)
            .collect(Collectors.groupingBy(ScheduleTask::getLineId));

        for (Map.Entry<String, List<ScheduleTask>> entry : tasksByLine.entrySet()) {
            String lineId = entry.getKey();
            List<ScheduleTask> lineTasks = entry.getValue();

            // 获取该产线的工人
            List<ProductionWorker> workers = workerMapper.selectList(
                new LambdaQueryWrapper<ProductionWorker>()
                    .eq(ProductionWorker::getDefaultLineId, lineId)
                    .eq(ProductionWorker::getStatus, "available")
            );

            // 简单分配: 每个任务分配所有可用工人
            for (ScheduleTask task : lineTasks) {
                for (ProductionWorker worker : workers) {
                    WorkerAssignment assignment = new WorkerAssignment();
                    assignment.setScheduleBatchNo(batchNo);
                    assignment.setWorkerId(worker.getId());
                    assignment.setWorkerName(worker.getWorkerName());
                    assignment.setTaskId(task.getId());
                    assignment.setLineId(lineId);
                    assignment.setLineName(task.getLineName());
                    assignment.setPlannedStart(task.getPlannedStart());
                    assignment.setPlannedEnd(task.getPlannedEnd());
                    assignment.setPlannedMinutes(task.getPlannedDuration());
                    assignment.setAssignmentType("initial");
                    assignment.setStatus("planned");
                    assignments.add(assignment);
                }
            }
        }

        return assignments;
    }

    private MixBatchGroup createMixBatchGroup(List<ProductionOrder> orders, int groupIndex) {
        MixBatchGroup group = new MixBatchGroup();
        group.setGroupId("MG-" + groupIndex);
        group.setProductCategory(orders.get(0).getProductCategory());
        group.setOrders(new ArrayList<>(orders));
        group.setTotalQty(orders.stream()
            .mapToInt(o -> o.getPlannedQty() != null ? o.getPlannedQty().intValue() : 0)
            .sum());

        // 计算节省的换型时间 (如果不混批，每个订单都需要换型)
        int savedMinutes = (orders.size() - 1) * 30;  // 假设每次换型30分钟
        group.setSavedChangeoverMinutes(savedMinutes);

        return group;
    }

    private double calculateLineUtilization(Map<String, LineScheduleState> lineStates, LocalDate date) {
        long totalMinutes = 0;
        long usedMinutes = 0;
        int shiftMinutes = 8 * 60;  // 假设8小时班次

        for (LineScheduleState state : lineStates.values()) {
            totalMinutes += shiftMinutes;
            usedMinutes += state.getUsedMinutes();
        }

        return totalMinutes > 0 ? (double) usedMinutes / totalMinutes * 100 : 0;
    }

    private double calculateWorkerUtilization(List<WorkerAssignment> assignments) {
        if (assignments.isEmpty()) {
            return 0;
        }

        int totalPlanned = assignments.stream()
            .mapToInt(a -> a.getPlannedMinutes() != null ? a.getPlannedMinutes() : 0)
            .sum();

        int shiftMinutes = 8 * 60;
        int totalAvailable = assignments.size() * shiftMinutes;

        return totalAvailable > 0 ? (double) totalPlanned / totalAvailable * 100 : 0;
    }

    private double calculateOnTimeRate(List<ScheduleTask> tasks) {
        if (tasks.isEmpty()) {
            return 100;
        }

        long onTime = tasks.stream()
            .filter(t -> Boolean.TRUE.equals(t.getMeetsTimeWindow()))
            .count();

        return (double) onTime / tasks.size() * 100;
    }

    private boolean resolveTimeOverlap(ScheduleConflict conflict) {
        // 简单策略: 延后第二个任务
        ScheduleTask task = taskMapper.selectOne(
            new LambdaQueryWrapper<ScheduleTask>()
                .eq(ScheduleTask::getOrderId, conflict.getOrder2Id())
                .eq(ScheduleTask::getStatus, "planned")
        );

        if (task != null && conflict.getConflictEnd() != null) {
            task.setPlannedStart(conflict.getConflictEnd().plusMinutes(5));
            task.setPlannedEnd(task.getPlannedStart().plusMinutes(task.getPlannedDuration()));
            taskMapper.updateById(task);

            conflict.setIsResolved(true);
            conflict.setResolutionMethod("延后任务开始时间");
            conflict.setResolvedAt(LocalDateTime.now());
            conflictMapper.updateById(conflict);

            return true;
        }
        return false;
    }

    private boolean resolveMoldConflict(ScheduleConflict conflict) {
        // 尝试找替代模具
        ProductionMold alternativeMold = moldMapper.selectOne(
            new LambdaQueryWrapper<ProductionMold>()
                .eq(ProductionMold::getStatus, "available")
                .ne(ProductionMold::getId, conflict.getConflictResourceId())
                .last("LIMIT 1")
        );

        if (alternativeMold != null) {
            // 更新第二个任务使用替代模具
            ScheduleTask task = taskMapper.selectOne(
                new LambdaQueryWrapper<ScheduleTask>()
                    .eq(ScheduleTask::getOrderId, conflict.getOrder2Id())
                    .eq(ScheduleTask::getStatus, "planned")
            );

            if (task != null) {
                task.setMoldId(alternativeMold.getId());
                taskMapper.updateById(task);

                conflict.setIsResolved(true);
                conflict.setResolutionMethod("使用替代模具: " + alternativeMold.getMoldNo());
                conflict.setResolvedAt(LocalDateTime.now());
                conflictMapper.updateById(conflict);

                return true;
            }
        }
        return false;
    }

    // 产线排程状态内部类
    private static class LineScheduleState {
        private final ProductionLine line;
        private LocalDateTime nextAvailableTime;
        private String lastCategory;
        private int taskCount;
        private int usedMinutes;

        public LineScheduleState(ProductionLine line) {
            this.line = line;
            this.nextAvailableTime = line.getEstimatedFreeTime() != null ?
                line.getEstimatedFreeTime() : LocalDateTime.now();
            this.lastCategory = line.getCurrentProductCategory();
            this.taskCount = 0;
            this.usedMinutes = 0;
        }

        public void addTask(ScheduleTask task) {
            this.nextAvailableTime = task.getPlannedEnd();
            this.lastCategory = task.getProductCategory();
            this.taskCount++;
            this.usedMinutes += task.getPlannedDuration() != null ? task.getPlannedDuration() : 0;
        }

        public ProductionLine getLine() { return line; }
        public LocalDateTime getNextAvailableTime() { return nextAvailableTime; }
        public String getLastCategory() { return lastCategory; }
        public int getTaskCount() { return taskCount; }
        public int getUsedMinutes() { return usedMinutes; }
    }
}
