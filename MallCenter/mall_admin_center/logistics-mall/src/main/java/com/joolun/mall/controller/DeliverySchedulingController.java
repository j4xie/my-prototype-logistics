package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.mapper.DeliveryOrderMapper;
import com.joolun.mall.service.DeliveryFeatureService;
import com.joolun.mall.service.DeliveryPredictionService;
import com.joolun.mall.service.DeliverySchedulingService;
import com.joolun.mall.service.DeliverySimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 配送调度控制器
 *
 * 提供配送调度、预测、模拟数据生成等API
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Slf4j
@RestController
@RequestMapping("/api/delivery")
@RequiredArgsConstructor
@Tag(name = "配送调度", description = "配送调度优化API")
public class DeliverySchedulingController {

    private final DeliverySchedulingService schedulingService;
    private final DeliveryPredictionService predictionService;
    private final DeliverySimulationService simulationService;
    private final DeliveryFeatureService featureService;
    private final DeliveryOrderMapper orderMapper;

    // ==================== 调度API ====================

    @GetMapping("/schedule/order/{orderId}")
    @Operation(summary = "单订单调度", description = "为指定订单获取车辆候选列表")
    public R<List<DeliverySchedulingService.VehicleCandidate>> scheduleOrder(
            @PathVariable String orderId) {
        DeliveryOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            return R.fail("订单不存在");
        }
        List<DeliverySchedulingService.VehicleCandidate> candidates =
            schedulingService.scheduleOrder(order);
        return R.ok(candidates);
    }

    @PostMapping("/schedule/batch")
    @Operation(summary = "批量调度", description = "对指定日期的所有待调度订单进行优化分配")
    public R<DeliverySchedulingService.SchedulingResult> batchSchedule(
            @RequestParam(required = false) String date) {
        LocalDate scheduleDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        DeliverySchedulingService.SchedulingResult result =
            schedulingService.batchSchedule(scheduleDate);
        return R.ok(result);
    }

    @PostMapping("/schedule/confirm")
    @Operation(summary = "确认调度", description = "确认订单分配给指定车辆")
    public R<Boolean> confirmSchedule(
            @RequestParam String orderId,
            @RequestParam String vehicleId) {
        boolean success = schedulingService.confirmSchedule(orderId, vehicleId);
        return success ? R.ok(true) : R.fail("确认调度失败");
    }

    @GetMapping("/schedule/stats")
    @Operation(summary = "调度统计", description = "获取调度服务统计信息")
    public R<Map<String, Object>> getSchedulingStats() {
        return R.ok(schedulingService.getSchedulingStats());
    }

    @GetMapping("/schedule/weights")
    @Operation(summary = "获取策略权重", description = "获取调度策略权重配置")
    public R<Map<String, Double>> getStrategyWeights() {
        return R.ok(schedulingService.getStrategyWeights());
    }

    @PostMapping("/schedule/weights")
    @Operation(summary = "更新策略权重", description = "更新调度策略权重配置")
    public R<String> updateStrategyWeights(@RequestBody Map<String, Double> weights) {
        schedulingService.updateStrategyWeights(weights);
        return R.ok("权重已更新");
    }

    // ==================== 预测API ====================

    @GetMapping("/prediction/stats")
    @Operation(summary = "预测模型统计", description = "获取配送时间预测模型统计信息")
    public R<Map<String, Object>> getPredictionStats() {
        return R.ok(predictionService.getModelStats());
    }

    @GetMapping("/prediction/importance")
    @Operation(summary = "特征重要性", description = "获取预测模型的特征重要性排名")
    public R<Map<String, Double>> getFeatureImportance() {
        return R.ok(predictionService.getFeatureImportance());
    }

    @PostMapping("/prediction/reset")
    @Operation(summary = "重置模型", description = "重置预测模型权重")
    public R<String> resetPredictionModel() {
        predictionService.resetModelWeights();
        return R.ok("模型已重置");
    }

    // ==================== 模拟数据API ====================

    @PostMapping("/simulation/generate")
    @Operation(summary = "生成模拟数据", description = "生成模拟订单和车辆数据")
    public R<Map<String, Object>> generateSimulationData(
            @RequestParam(defaultValue = "500") int orders,
            @RequestParam(defaultValue = "20") int vehicles,
            @RequestParam(defaultValue = "30") int days) {

        Map<String, Object> result = simulationService.runFullSimulation(orders, vehicles, days);
        return R.ok(result);
    }

    @PostMapping("/simulation/orders")
    @Operation(summary = "生成模拟订单", description = "仅生成模拟订单")
    public R<Map<String, Object>> generateOrders(
            @RequestParam(defaultValue = "100") int count,
            @RequestParam(defaultValue = "7") int days) {
        return R.ok(simulationService.generateSimulatedOrders(count, days));
    }

    @PostMapping("/simulation/vehicles")
    @Operation(summary = "生成模拟车辆", description = "仅生成模拟车辆")
    public R<Map<String, Object>> generateVehicles(
            @RequestParam(defaultValue = "10") int count) {
        return R.ok(simulationService.generateSimulatedVehicles(count));
    }

    @PostMapping("/simulation/feedback")
    @Operation(summary = "生成模拟反馈", description = "为已调度订单生成模拟反馈")
    public R<Map<String, Object>> generateFeedback(
            @RequestParam(defaultValue = "7") int days) {
        return R.ok(simulationService.generateSimulatedFeedback(days));
    }

    @DeleteMapping("/simulation/clear")
    @Operation(summary = "清理模拟数据", description = "删除所有模拟数据")
    public R<Map<String, Object>> clearSimulationData() {
        return R.ok(simulationService.clearSimulatedData());
    }

    @GetMapping("/simulation/stats")
    @Operation(summary = "模拟统计", description = "获取模拟数据统计信息")
    public R<Map<String, Object>> getSimulationStats() {
        return R.ok(simulationService.getSimulationStats());
    }

    // ==================== 特征工程API ====================

    @GetMapping("/feature/stats")
    @Operation(summary = "特征统计", description = "获取特征工程统计信息")
    public R<Map<String, Object>> getFeatureStats() {
        return R.ok(featureService.getFeatureStats());
    }
}
