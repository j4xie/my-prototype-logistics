package com.joolun.mall.controller.aps;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.aps.ProductionOrder;
import com.joolun.mall.entity.aps.ScheduleConflict;
import com.joolun.mall.entity.aps.ScheduleTask;
import com.joolun.mall.mapper.aps.ProductionOrderMapper;
import com.joolun.mall.mapper.aps.ScheduleConflictMapper;
import com.joolun.mall.mapper.aps.ScheduleTaskMapper;
import com.joolun.mall.service.aps.APSSchedulingService;
import com.joolun.mall.service.aps.APSSimulationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * APS 排产调度控制器
 *
 * @author APS Scheduling System
 * @since 2026-01-21
 */
@Slf4j
@RestController
@RequestMapping("/api/aps")
@RequiredArgsConstructor
public class APSSchedulingController {

    private final APSSchedulingService schedulingService;
    private final APSSimulationService simulationService;
    private final ProductionOrderMapper orderMapper;
    private final ScheduleTaskMapper taskMapper;
    private final ScheduleConflictMapper conflictMapper;

    // ==================== 调度API ====================

    @PostMapping("/schedule/single/{orderId}")
    public R<?> scheduleSingleOrder(@PathVariable String orderId) {
        try {
            log.info("单订单排产请求: orderId={}", orderId);
            ProductionOrder order = orderMapper.selectById(orderId);
            if (order == null) {
                return R.fail("订单不存在");
            }
            List<APSSchedulingService.LineCandidate> candidates = schedulingService.scheduleOrder(order);
            Map<String, Object> result = new HashMap<>();
            result.put("orderId", orderId);
            result.put("candidates", candidates);
            result.put("candidateCount", candidates.size());
            return R.ok(result);
        } catch (Exception e) {
            log.error("单订单排产失败: orderId={}, error={}", orderId, e.getMessage(), e);
            return R.fail("排产失败: " + e.getMessage());
        }
    }

    @PostMapping("/schedule/batch")
    public R<?> batchSchedule(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            log.info("批量排产请求: startDate={}, endDate={}", startDate, endDate);
            APSSchedulingService.SchedulingResult result = schedulingService.batchSchedule(startDate, endDate);
            return R.ok(result);
        } catch (Exception e) {
            log.error("批量排产失败: error={}", e.getMessage(), e);
            return R.fail("批量排产失败: " + e.getMessage());
        }
    }

    @PostMapping("/schedule/urgent")
    public R<?> insertUrgentOrder(@RequestBody ProductionOrder order) {
        try {
            log.info("紧急订单插单请求: orderNo={}", order.getOrderNo());
            // 先保存订单
            if (order.getId() == null) {
                orderMapper.insert(order);
            }
            APSSchedulingService.InsertResult result = schedulingService.insertUrgentOrder(order);
            return R.ok(result);
        } catch (Exception e) {
            log.error("紧急订单插单失败: error={}", e.getMessage(), e);
            return R.fail("插单失败: " + e.getMessage());
        }
    }

    @PostMapping("/schedule/reschedule")
    public R<?> reschedule(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate) {
        try {
            log.info("重新排产请求: fromDate={}", fromDate);
            APSSchedulingService.SchedulingResult result = schedulingService.reschedule(fromDate);
            return R.ok(result);
        } catch (Exception e) {
            log.error("重新排产失败: error={}", e.getMessage(), e);
            return R.fail("重新排产失败: " + e.getMessage());
        }
    }

    // ==================== 查询API ====================

    @GetMapping("/tasks")
    public R<?> listScheduleTasks(
            @RequestParam(required = false) String lineId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String status) {
        try {
            log.info("查询排产任务: lineId={}, date={}, status={}", lineId, date, status);
            LambdaQueryWrapper<ScheduleTask> wrapper = new LambdaQueryWrapper<>();
            if (lineId != null) {
                wrapper.eq(ScheduleTask::getLineId, lineId);
            }
            if (date != null) {
                wrapper.ge(ScheduleTask::getPlannedStart, date.atStartOfDay())
                       .lt(ScheduleTask::getPlannedStart, date.plusDays(1).atStartOfDay());
            }
            if (status != null) {
                wrapper.eq(ScheduleTask::getStatus, status);
            }
            wrapper.orderByAsc(ScheduleTask::getPlannedStart);
            List<ScheduleTask> tasks = taskMapper.selectList(wrapper);
            return R.ok(tasks);
        } catch (Exception e) {
            log.error("查询排产任务失败: error={}", e.getMessage(), e);
            return R.fail("查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/tasks/{taskId}")
    public R<?> getTaskDetail(@PathVariable String taskId) {
        try {
            log.info("获取任务详情: taskId={}", taskId);
            ScheduleTask task = taskMapper.selectById(taskId);
            if (task == null) {
                return R.fail("任务不存在");
            }
            return R.ok(task);
        } catch (Exception e) {
            log.error("获取任务详情失败: error={}", e.getMessage(), e);
            return R.fail("查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/conflicts")
    public R<?> listUnresolvedConflicts() {
        try {
            log.info("查询未解决冲突");
            List<ScheduleConflict> conflicts = conflictMapper.selectList(
                new LambdaQueryWrapper<ScheduleConflict>()
                    .eq(ScheduleConflict::getIsResolved, false)
                    .orderByDesc(ScheduleConflict::getCreatedAt)
            );
            return R.ok(conflicts);
        } catch (Exception e) {
            log.error("查询冲突失败: error={}", e.getMessage(), e);
            return R.fail("查询失败: " + e.getMessage());
        }
    }

    @GetMapping("/stats")
    public R<?> getSchedulingStats() {
        try {
            log.info("获取排产统计");
            Map<String, Object> stats = schedulingService.getSchedulingStats();
            return R.ok(stats);
        } catch (Exception e) {
            log.error("获取统计失败: error={}", e.getMessage(), e);
            return R.fail("获取统计失败: " + e.getMessage());
        }
    }

    // ==================== 模拟数据API ====================

    @PostMapping("/simulation/generate")
    public R<?> generateTestData(
            @RequestParam(defaultValue = "100") int orders,
            @RequestParam(defaultValue = "5") int lines,
            @RequestParam(defaultValue = "20") int workers,
            @RequestParam(defaultValue = "14") int days) {
        try {
            log.info("生成测试数据: orders={}, lines={}, workers={}, days={}", orders, lines, workers, days);
            Map<String, Object> result = new HashMap<>();

            // 生成产线
            simulationService.generateSimulatedLines(lines);
            result.put("linesGenerated", lines);

            // 生成人员
            simulationService.generateSimulatedWorkers(workers);
            result.put("workersGenerated", workers);

            // 生成设备
            simulationService.generateSimulatedEquipment(lines * 3);
            result.put("equipmentGenerated", lines * 3);

            // 生成模具
            simulationService.generateSimulatedMolds(10);
            result.put("moldsGenerated", 10);

            // 生成换型矩阵
            simulationService.generateChangeoverMatrix();
            result.put("changeoverMatrixGenerated", true);

            // 生成订单
            simulationService.generateSimulatedOrders(orders, days);
            result.put("ordersGenerated", orders);

            result.put("success", true);
            return R.ok(result);
        } catch (Exception e) {
            log.error("生成测试数据失败: error={}", e.getMessage(), e);
            return R.fail("生成测试数据失败: " + e.getMessage());
        }
    }

    @DeleteMapping("/simulation/clear")
    public R<?> clearSimulatedData() {
        try {
            log.info("清理模拟数据");
            Map<String, Integer> result = simulationService.clearSimulatedData();
            return R.ok(result);
        } catch (Exception e) {
            log.error("清理模拟数据失败: error={}", e.getMessage(), e);
            return R.fail("清理模拟数据失败: " + e.getMessage());
        }
    }

    // ==================== 配置API ====================

    @GetMapping("/config/weights")
    public R<?> getStrategyWeights() {
        try {
            log.info("获取策略权重配置");
            Map<String, Double> weights = schedulingService.getStrategyWeights();
            return R.ok(weights);
        } catch (Exception e) {
            log.error("获取策略权重失败: error={}", e.getMessage(), e);
            return R.fail("获取策略权重失败: " + e.getMessage());
        }
    }

    @PutMapping("/config/weights")
    public R<?> updateStrategyWeights(@RequestBody Map<String, Double> weights) {
        try {
            log.info("更新策略权重: {}", weights);
            schedulingService.updateStrategyWeights(weights);
            return R.ok("策略权重已更新");
        } catch (Exception e) {
            log.error("更新策略权重失败: error={}", e.getMessage(), e);
            return R.fail("更新策略权重失败: " + e.getMessage());
        }
    }
}
