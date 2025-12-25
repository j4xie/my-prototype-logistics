package com.joolun.web.api;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.*;
import com.joolun.mall.service.TraceabilityService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 溯源API - 小程序端
 * 提供商品溯源信息查询功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/traceability")
public class TraceabilityApi {

    private final TraceabilityService traceabilityService;

    /**
     * 根据批次号查询溯源信息
     *
     * @param batchNo 批次号
     * @return 溯源详情
     */
    @GetMapping("/batch/no/{batchNo}")
    public AjaxResult getByBatchNo(@PathVariable("batchNo") String batchNo) {
        if (batchNo == null || batchNo.trim().isEmpty()) {
            return AjaxResult.error("批次号不能为空");
        }

        try {
            // 获取完整的溯源信息（含时间线、原料、质检、证据）
            TraceabilityBatch batch = traceabilityService.getDetailByBatchNo(batchNo.trim());

            if (batch == null) {
                return AjaxResult.error("未找到该批次的溯源信息");
            }

            return AjaxResult.success(batch);
        } catch (Exception e) {
            log.error("查询溯源信息失败: batchNo={}", batchNo, e);
            return AjaxResult.error("查询溯源信息失败");
        }
    }

    /**
     * 根据批次ID查询溯源信息
     *
     * @param id 批次ID
     * @return 溯源详情
     */
    @GetMapping("/batch/{id}")
    public AjaxResult getById(@PathVariable("id") Long id) {
        try {
            TraceabilityBatch batch = traceabilityService.getDetail(id);

            if (batch == null) {
                return AjaxResult.error("未找到该批次的溯源信息");
            }

            return AjaxResult.success(batch);
        } catch (Exception e) {
            log.error("查询溯源信息失败: id={}", id, e);
            return AjaxResult.error("查询溯源信息失败");
        }
    }

    /**
     * 获取批次时间线
     *
     * @param batchId 批次ID
     * @return 时间线列表
     */
    @GetMapping("/batch/{batchId}/timeline")
    public AjaxResult getTimeline(@PathVariable("batchId") Long batchId) {
        try {
            List<TraceabilityTimeline> timeline = traceabilityService.getTimeline(batchId);
            return AjaxResult.success(timeline);
        } catch (Exception e) {
            log.error("获取时间线失败: batchId={}", batchId, e);
            return AjaxResult.error("获取时间线失败");
        }
    }

    /**
     * 获取批次原料列表
     *
     * @param batchId 批次ID
     * @return 原料列表
     */
    @GetMapping("/batch/{batchId}/materials")
    public AjaxResult getRawMaterials(@PathVariable("batchId") Long batchId) {
        try {
            List<TraceabilityRawMaterial> materials = traceabilityService.getRawMaterials(batchId);
            return AjaxResult.success(materials);
        } catch (Exception e) {
            log.error("获取原料列表失败: batchId={}", batchId, e);
            return AjaxResult.error("获取原料列表失败");
        }
    }

    /**
     * 获取批次质检报告
     *
     * @param batchId 批次ID
     * @return 质检报告列表
     */
    @GetMapping("/batch/{batchId}/quality-reports")
    public AjaxResult getQualityReports(@PathVariable("batchId") Long batchId) {
        try {
            List<TraceabilityQualityReport> reports = traceabilityService.getQualityReports(batchId);
            return AjaxResult.success(reports);
        } catch (Exception e) {
            log.error("获取质检报告失败: batchId={}", batchId, e);
            return AjaxResult.error("获取质检报告失败");
        }
    }

    /**
     * 获取批次证据文件
     *
     * @param batchId 批次ID
     * @return 证据列表
     */
    @GetMapping("/batch/{batchId}/evidences")
    public AjaxResult getEvidences(@PathVariable("batchId") Long batchId) {
        try {
            List<TraceabilityEvidence> evidences = traceabilityService.getEvidences(batchId);
            return AjaxResult.success(evidences);
        } catch (Exception e) {
            log.error("获取证据失败: batchId={}", batchId, e);
            return AjaxResult.error("获取证据失败");
        }
    }

    /**
     * 验证溯源信息真实性
     *
     * @param batchNo 批次号
     * @return 验证结果
     */
    @GetMapping("/verify/{batchNo}")
    public AjaxResult verifyTraceability(@PathVariable("batchNo") String batchNo) {
        try {
            TraceabilityBatch batch = traceabilityService.getByBatchNo(batchNo);

            if (batch == null) {
                return AjaxResult.success(Map.of(
                    "valid", false,
                    "message", "批次号不存在"
                ));
            }

            Map<String, Object> result = new HashMap<>();
            result.put("valid", true);
            result.put("batchNo", batch.getBatchNo());
            result.put("productName", batch.getProductName());
            result.put("producerName", batch.getMerchant() != null ? batch.getMerchant().getMerchantName() : null);
            result.put("productionDate", batch.getProductionDate());
            result.put("status", batch.getStatus());

            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("验证溯源信息失败: batchNo={}", batchNo, e);
            return AjaxResult.error("验证失败");
        }
    }
}
