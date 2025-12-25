package com.cretas.aims.controller;

import com.cretas.aims.dto.traceability.TraceabilityDTO;
import com.cretas.aims.service.TraceabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 溯源控制器
 * 提供批次溯源、完整链路溯源和公开溯源查询功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class TraceabilityController {

    private final TraceabilityService traceabilityService;

    /**
     * 获取基础溯源信息（批次级别）
     * 需要认证，返回该批次的基本生产信息和关联数据统计
     *
     * @param factoryId 工厂ID
     * @param batchNumber 批次号
     * @return 基础溯源响应
     */
    @GetMapping("/api/mobile/{factoryId}/traceability/batch/{batchNumber}")
    public ResponseEntity<?> getBatchTrace(
            @PathVariable String factoryId,
            @PathVariable String batchNumber) {
        try {
            log.info("获取批次溯源: factoryId={}, batchNumber={}", factoryId, batchNumber);

            TraceabilityDTO.BatchTraceResponse response = traceabilityService.getBatchTrace(factoryId, batchNumber);

            if (response == null) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "code", 404,
                        "message", "未找到该批次信息"
                ));
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "code", 200,
                    "data", response,
                    "message", "获取批次溯源成功"
            ));
        } catch (Exception e) {
            log.error("获取批次溯源失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "code", 400,
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取完整溯源链路
     * 需要认证，返回从原材料到出货的完整追溯信息
     *
     * @param factoryId 工厂ID
     * @param batchNumber 批次号
     * @return 完整溯源链路响应
     */
    @GetMapping("/api/mobile/{factoryId}/traceability/full/{batchNumber}")
    public ResponseEntity<?> getFullTrace(
            @PathVariable String factoryId,
            @PathVariable String batchNumber) {
        try {
            log.info("获取完整溯源链路: factoryId={}, batchNumber={}", factoryId, batchNumber);

            TraceabilityDTO.FullTraceResponse response = traceabilityService.getFullTrace(factoryId, batchNumber);

            if (response == null) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "code", 404,
                        "message", "未找到该批次信息"
                ));
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "code", 200,
                    "data", response,
                    "message", "获取完整溯源链路成功"
            ));
        } catch (Exception e) {
            log.error("获取完整溯源链路失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "code", 400,
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * 公开溯源查询（消费者扫码）
     * 无需认证，返回脱敏的溯源信息
     *
     * @param batchNumber 批次号
     * @return 公开溯源信息
     */
    @GetMapping("/api/public/trace/{batchNumber}")
    public ResponseEntity<?> getPublicTrace(@PathVariable String batchNumber) {
        try {
            log.info("公开溯源查询: batchNumber={}", batchNumber);

            TraceabilityDTO.PublicTraceResponse response = traceabilityService.getPublicTrace(batchNumber);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "code", 200,
                    "data", response,
                    "message", response.getIsValid() ? "溯源信息查询成功" : response.getMessage()
            ));
        } catch (Exception e) {
            log.error("公开溯源查询失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "code", 400,
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * 通过溯源码查询（消费者扫码）
     * 无需认证，支持扫描二维码获取的完整溯源码
     *
     * @param traceCode 溯源码 (格式: TRACE-{batchNumber}-{uuid})
     * @return 公开溯源信息
     */
    @GetMapping("/api/public/trace/code/{traceCode}")
    public ResponseEntity<?> getTraceByCode(@PathVariable String traceCode) {
        try {
            log.info("溯源码查询: traceCode={}", traceCode);

            // 从溯源码中提取批次号
            // 格式: TRACE-{batchNumber}-{uuid}
            String batchNumber = extractBatchNumberFromTraceCode(traceCode);

            if (batchNumber == null) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "code", 400,
                        "message", "无效的溯源码格式"
                ));
            }

            TraceabilityDTO.PublicTraceResponse response = traceabilityService.getPublicTrace(batchNumber);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "code", 200,
                    "data", response,
                    "message", response.getIsValid() ? "溯源信息查询成功" : response.getMessage()
            ));
        } catch (Exception e) {
            log.error("溯源码查询失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "code", 400,
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * 从溯源码中提取批次号
     */
    private String extractBatchNumberFromTraceCode(String traceCode) {
        if (traceCode == null || !traceCode.startsWith("TRACE-")) {
            return null;
        }

        // TRACE-{batchNumber}-{uuid}
        // 移除 "TRACE-" 前缀
        String remaining = traceCode.substring(6);

        // 找到最后一个 "-" 的位置（UUID前的分隔符）
        int lastDash = remaining.lastIndexOf("-");
        if (lastDash <= 0) {
            return null;
        }

        // 提取批次号
        return remaining.substring(0, lastDash);
    }
}
