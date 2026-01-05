package com.cretas.aims.controller;

import com.cretas.aims.dto.scale.SimulatorStatus;
import com.cretas.aims.dto.scale.VirtualScaleConfig;
import com.cretas.aims.service.simulator.VirtualScaleSimulator;
import com.cretas.aims.util.ErrorSanitizer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 虚拟秤模拟器控制器
 * 用于测试环境下模拟电子秤数据，无需实际硬件
 *
 * 主要功能:
 * - 启动/停止虚拟秤模拟器
 * - 发送模拟称重数据
 * - 生成测试数据帧
 *
 * 使用场景:
 * - 开发调试: 无硬件条件下测试称重数据解析
 * - 协议验证: 生成符合协议格式的测试数据
 * - 演示环境: 模拟真实称重过程
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/scale-simulator")
@RequiredArgsConstructor
@Tag(name = "虚拟秤模拟器", description = "用于开发测试的虚拟秤模拟器API")
@Validated
public class ScaleSimulatorController {

    private final VirtualScaleSimulator virtualScaleSimulator;

    // ==================== 模拟器生命周期 ====================

    /**
     * 启动虚拟秤模拟器
     */
    @PostMapping("/start")
    @Operation(summary = "启动模拟器", description = "使用自定义配置启动虚拟秤模拟器")
    public ResponseEntity<Map<String, Object>> startSimulator(
            @PathVariable String factoryId,
            @Valid @RequestBody VirtualScaleConfig config) {

        log.info("[虚拟秤] 启动模拟器: factory={}, config={}", factoryId, config);

        try {
            String simulatorId = virtualScaleSimulator.startSimulator(config.getProtocolId(), config);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "模拟器启动成功");
            response.put("simulatorId", simulatorId);
            response.put("protocolId", config.getProtocolId());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] 启动失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "启动失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 快速启动 - 使用 Keli D2008 协议预设
     */
    @PostMapping("/start/keli-d2008")
    @Operation(summary = "快速启动 Keli D2008", description = "使用预设的 Keli D2008 协议配置快速启动")
    public ResponseEntity<Map<String, Object>> startKeliD2008(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "测试秤") String name) {

        log.info("[虚拟秤] 快速启动 Keli D2008: factory={}, name={}", factoryId, name);

        VirtualScaleConfig config = VirtualScaleConfig.builder()
                .simulatorName(name)
                .protocolId("proto-keli-d2008-ascii")
                .defaultUnit("kg")
                .minWeight(BigDecimal.ZERO)
                .maxWeight(new BigDecimal("5000"))
                .fluctuationPercent(new BigDecimal("3.0"))
                .stabilizationSteps(5)
                .stepIntervalMs(200)
                .decimalPlaces(2)
                .autoSend(false)
                .build();

        try {
            String simulatorId = virtualScaleSimulator.startSimulator(config.getProtocolId(), config);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Keli D2008 模拟器启动成功");
            response.put("simulatorId", simulatorId);
            response.put("protocolId", "proto-keli-d2008-ascii");
            response.put("config", config);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] Keli D2008 启动失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "启动失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 停止指定模拟器
     */
    @PostMapping("/{simulatorId}/stop")
    @Operation(summary = "停止模拟器", description = "停止指定的虚拟秤模拟器")
    public ResponseEntity<Map<String, Object>> stopSimulator(
            @PathVariable String factoryId,
            @PathVariable String simulatorId) {

        log.info("[虚拟秤] 停止模拟器: factory={}, simulatorId={}", factoryId, simulatorId);

        try {
            virtualScaleSimulator.stopSimulator(simulatorId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "模拟器已停止");
            response.put("simulatorId", simulatorId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] 停止失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "停止失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 停止所有模拟器
     */
    @PostMapping("/stop-all")
    @Operation(summary = "停止所有模拟器", description = "停止当前所有运行中的虚拟秤模拟器")
    public ResponseEntity<Map<String, Object>> stopAllSimulators(@PathVariable String factoryId) {

        log.info("[虚拟秤] 停止所有模拟器: factory={}", factoryId);

        int count = virtualScaleSimulator.getActiveSimulatorCount();
        virtualScaleSimulator.stopAllSimulators();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", String.format("已停止 %d 个模拟器", count));
        response.put("stoppedCount", count);

        return ResponseEntity.ok(response);
    }

    /**
     * 暂停模拟器
     */
    @PostMapping("/{simulatorId}/pause")
    @Operation(summary = "暂停模拟器", description = "暂停指定的模拟器")
    public ResponseEntity<Map<String, Object>> pauseSimulator(
            @PathVariable String factoryId,
            @PathVariable String simulatorId) {

        log.info("[虚拟秤] 暂停模拟器: simulatorId={}", simulatorId);

        try {
            virtualScaleSimulator.pauseSimulator(simulatorId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "模拟器已暂停");
            response.put("simulatorId", simulatorId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "暂停失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 恢复模拟器
     */
    @PostMapping("/{simulatorId}/resume")
    @Operation(summary = "恢复模拟器", description = "恢复暂停的模拟器")
    public ResponseEntity<Map<String, Object>> resumeSimulator(
            @PathVariable String factoryId,
            @PathVariable String simulatorId) {

        log.info("[虚拟秤] 恢复模拟器: simulatorId={}", simulatorId);

        try {
            virtualScaleSimulator.resumeSimulator(simulatorId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "模拟器已恢复");
            response.put("simulatorId", simulatorId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "恢复失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    // ==================== 状态查询 ====================

    /**
     * 获取所有运行中的模拟器列表
     */
    @GetMapping("/list")
    @Operation(summary = "获取模拟器列表", description = "获取当前所有运行中的虚拟秤模拟器")
    public ResponseEntity<Map<String, Object>> listSimulators(@PathVariable String factoryId) {

        List<SimulatorStatus> simulators = virtualScaleSimulator.getRunningSimulators();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", simulators);
        response.put("count", simulators.size());

        return ResponseEntity.ok(response);
    }

    /**
     * 获取指定模拟器状态
     */
    @GetMapping("/{simulatorId}/status")
    @Operation(summary = "获取模拟器状态", description = "获取指定虚拟秤模拟器的详细状态")
    public ResponseEntity<Map<String, Object>> getSimulatorStatus(
            @PathVariable String factoryId,
            @PathVariable String simulatorId) {

        SimulatorStatus status = virtualScaleSimulator.getSimulatorStatus(simulatorId);

        Map<String, Object> response = new HashMap<>();
        if (status != null) {
            response.put("success", true);
            response.put("data", status);
        } else {
            response.put("success", false);
            response.put("message", "模拟器不存在: " + simulatorId);
        }

        return ResponseEntity.ok(response);
    }

    // ==================== 数据发送 ====================

    /**
     * 发送模拟称重数据
     */
    @PostMapping("/{simulatorId}/send")
    @Operation(summary = "发送称重数据", description = "通过模拟器发送指定的称重数据")
    public ResponseEntity<Map<String, Object>> sendWeight(
            @PathVariable String factoryId,
            @PathVariable String simulatorId,
            @RequestParam @Parameter(description = "重量值") BigDecimal weight,
            @RequestParam(defaultValue = "true") @Parameter(description = "是否稳定") boolean stable) {

        log.info("[虚拟秤] 发送称重数据: simulatorId={}, weight={}, stable={}", simulatorId, weight, stable);

        try {
            byte[] frame = virtualScaleSimulator.sendWeight(simulatorId, weight, stable);
            String hex = virtualScaleSimulator.frameToHex(frame);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "数据发送成功");
            response.put("weight", weight);
            response.put("stable", stable);
            response.put("frameHex", hex);
            response.put("frameLength", frame.length);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] 发送失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "发送失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 模拟完整称重过程 (波动 -> 稳定)
     */
    @PostMapping("/{simulatorId}/simulate-weighing")
    @Operation(summary = "模拟完整称重过程", description = "模拟从波动到稳定的完整称重过程")
    public ResponseEntity<Map<String, Object>> simulateWeighingProcess(
            @PathVariable String factoryId,
            @PathVariable String simulatorId,
            @RequestParam @Parameter(description = "目标重量") BigDecimal targetWeight,
            @RequestParam(defaultValue = "false") @Parameter(description = "是否同步执行") boolean sync) {

        log.info("[虚拟秤] 模拟称重过程: simulatorId={}, targetWeight={}, sync={}", simulatorId, targetWeight, sync);

        try {
            Map<String, Object> response = new HashMap<>();

            if (sync) {
                // 同步执行，返回所有帧
                List<byte[]> frames = virtualScaleSimulator.simulateWeighingProcessSync(simulatorId, targetWeight);
                List<String> hexFrames = frames.stream()
                        .map(virtualScaleSimulator::frameToHex)
                        .collect(Collectors.toList());

                response.put("success", true);
                response.put("message", "称重过程模拟完成");
                response.put("targetWeight", targetWeight);
                response.put("totalFrames", frames.size());
                response.put("frames", hexFrames);
            } else {
                // 异步执行
                virtualScaleSimulator.simulateWeighingProcess(simulatorId, targetWeight);
                response.put("success", true);
                response.put("message", "称重过程模拟已启动 (异步)");
                response.put("targetWeight", targetWeight);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] 模拟称重失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "模拟失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    // ==================== 数据帧生成 ====================

    /**
     * 生成测试数据帧 (不需要启动模拟器)
     */
    @PostMapping("/generate-frame")
    @Operation(summary = "生成测试数据帧", description = "根据协议直接生成测试数据帧，无需启动模拟器")
    public ResponseEntity<Map<String, Object>> generateFrame(
            @PathVariable String factoryId,
            @RequestParam @Parameter(description = "协议ID") String protocolId,
            @RequestParam @Parameter(description = "重量值") BigDecimal weight,
            @RequestParam(defaultValue = "kg") @Parameter(description = "单位") String unit,
            @RequestParam(defaultValue = "true") @Parameter(description = "是否稳定") boolean stable) {

        log.info("[虚拟秤] 生成数据帧: protocolId={}, weight={}, unit={}, stable={}", protocolId, weight, unit, stable);

        try {
            byte[] frame = virtualScaleSimulator.generateFrame(protocolId, weight, unit, stable);
            String hex = virtualScaleSimulator.frameToHex(frame);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("frameHex", hex);
            response.put("frameLength", frame.length);
            response.put("protocolId", protocolId);
            response.put("weight", weight);
            response.put("unit", unit);
            response.put("stable", stable);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] 生成帧失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "生成失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 批量生成测试数据集
     */
    @PostMapping("/generate-test-dataset")
    @Operation(summary = "批量生成测试数据", description = "批量生成指定数量的测试数据帧")
    public ResponseEntity<Map<String, Object>> generateTestDataset(
            @PathVariable String factoryId,
            @RequestParam @Parameter(description = "协议ID") String protocolId,
            @RequestParam(defaultValue = "10") @Parameter(description = "生成数量") int count,
            @RequestParam(required = false) @Parameter(description = "最小重量") BigDecimal minWeight,
            @RequestParam(required = false) @Parameter(description = "最大重量") BigDecimal maxWeight) {

        log.info("[虚拟秤] 批量生成测试数据: protocolId={}, count={}", protocolId, count);

        try {
            List<byte[]> frames;
            if (minWeight != null && maxWeight != null) {
                frames = virtualScaleSimulator.generateTestDataset(protocolId, count, minWeight, maxWeight);
            } else {
                frames = virtualScaleSimulator.generateTestDataset(protocolId, count);
            }

            List<String> hexFrames = frames.stream()
                    .map(virtualScaleSimulator::frameToHex)
                    .collect(Collectors.toList());

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("count", frames.size());
            response.put("protocolId", protocolId);
            response.put("frames", hexFrames);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[虚拟秤] 批量生成失败: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "生成失败: " + ErrorSanitizer.sanitize(e));
            return ResponseEntity.badRequest().body(response);
        }
    }

    // ==================== 统计信息 ====================

    /**
     * 获取模拟器统计信息
     */
    @GetMapping("/stats")
    @Operation(summary = "获取统计信息", description = "获取模拟器的统计信息")
    public ResponseEntity<Map<String, Object>> getStats(@PathVariable String factoryId) {

        int activeCount = virtualScaleSimulator.getActiveSimulatorCount();
        List<SimulatorStatus> simulators = virtualScaleSimulator.getRunningSimulators();

        long totalFramesSent = simulators.stream()
                .mapToLong(s -> s.getTotalFramesSent() != null ? s.getTotalFramesSent() : 0)
                .sum();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("activeSimulators", activeCount);
        response.put("totalFramesSent", totalFramesSent);
        response.put("simulatorIds", simulators.stream()
                .map(SimulatorStatus::getSimulatorId)
                .collect(Collectors.toList()));

        return ResponseEntity.ok(response);
    }
}
