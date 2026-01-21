package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.service.SimulationDataGenerator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 模拟数据生成 API
 * 用于生成测试推荐系统的模拟数据
 *
 * 注意: 此API仅用于测试环境，生产环境应禁用
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/simulation")
@Tag(name = "模拟数据生成", description = "生成测试用的模拟用户和行为数据")
public class SimulationController {

    private final SimulationDataGenerator simulationDataGenerator;

    /**
     * 生成完整模拟数据
     * 包含500个模拟用户和50000+行为事件
     */
    @PostMapping("/generate")
    @Operation(summary = "生成完整模拟数据", description = "一次性生成500个用户和50000+行为事件")
    public R<Map<String, Integer>> generateFullSimulation() {
        try {
            log.info("开始生成完整模拟数据...");
            long startTime = System.currentTimeMillis();

            Map<String, Integer> result = simulationDataGenerator.generateFullSimulation();

            long duration = System.currentTimeMillis() - startTime;
            log.info("模拟数据生成完成: 耗时={}ms, 结果={}", duration, result);

            return R.ok(result, "模拟数据生成成功，耗时 " + duration + "ms");
        } catch (Exception e) {
            log.error("生成模拟数据失败", e);
            return R.fail("生成模拟数据失败: " + e.getMessage());
        }
    }

    /**
     * 生成模拟用户
     */
    @PostMapping("/users")
    @Operation(summary = "生成模拟用户", description = "生成指定数量的模拟用户画像")
    public R<Integer> generateUsers(
            @RequestParam(defaultValue = "500") int count) {
        try {
            log.info("开始生成模拟用户: count={}", count);

            int generated = simulationDataGenerator.generateSimulatedUsers(count);

            log.info("模拟用户生成完成: 目标={}, 实际={}", count, generated);
            return R.ok(generated, "成功生成 " + generated + " 个模拟用户");
        } catch (Exception e) {
            log.error("生成模拟用户失败", e);
            return R.fail("生成模拟用户失败: " + e.getMessage());
        }
    }

    /**
     * 生成模拟行为事件
     */
    @PostMapping("/events")
    @Operation(summary = "生成模拟行为事件", description = "为模拟用户生成行为事件")
    public R<Integer> generateEvents(
            @RequestParam(defaultValue = "50000") int count) {
        try {
            log.info("开始生成模拟行为事件: count={}", count);

            int generated = simulationDataGenerator.generateSimulatedEvents(count);

            log.info("模拟行为事件生成完成: 目标={}, 实际={}", count, generated);
            return R.ok(generated, "成功生成 " + generated + " 个行为事件");
        } catch (Exception e) {
            log.error("生成模拟行为事件失败", e);
            return R.fail("生成模拟行为事件失败: " + e.getMessage());
        }
    }

    /**
     * 清理模拟数据
     */
    @DeleteMapping("/clear")
    @Operation(summary = "清理模拟数据", description = "删除所有以sim_user_为前缀的模拟数据")
    public R<Void> clearSimulatedData() {
        try {
            log.info("开始清理模拟数据...");

            simulationDataGenerator.clearSimulatedData();

            log.info("模拟数据清理完成");
            return R.ok(null, "模拟数据清理成功");
        } catch (Exception e) {
            log.error("清理模拟数据失败", e);
            return R.fail("清理模拟数据失败: " + e.getMessage());
        }
    }

    /**
     * 获取生成统计
     */
    @GetMapping("/stats")
    @Operation(summary = "获取生成统计", description = "查看当前模拟数据的统计信息")
    public R<Map<String, Object>> getGenerationStats() {
        try {
            Map<String, Object> stats = simulationDataGenerator.getGenerationStats();
            return R.ok(stats);
        } catch (Exception e) {
            log.error("获取生成统计失败", e);
            return R.fail("获取生成统计失败: " + e.getMessage());
        }
    }
}
