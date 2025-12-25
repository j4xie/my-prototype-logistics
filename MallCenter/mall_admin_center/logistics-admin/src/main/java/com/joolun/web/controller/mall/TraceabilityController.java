package com.joolun.web.controller.mall;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.*;
import com.joolun.mall.service.TraceabilityService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 溯源管理
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/traceability")
public class TraceabilityController extends BaseController {

    private final TraceabilityService traceabilityService;

    // ========== 批次管理 ==========

    /**
     * 分页查询批次
     */
    @GetMapping("/batch/page")
    @PreAuthorize("@ss.hasPermi('mall:traceability:index')")
    public AjaxResult page(Page page, TraceabilityBatch batch) {
        return AjaxResult.success(traceabilityService.page1(page, batch));
    }

    /**
     * 通过id查询批次
     */
    @GetMapping("/batch/{id}")
    @PreAuthorize("@ss.hasPermi('mall:traceability:get')")
    public AjaxResult getById(@PathVariable("id") Long id) {
        return AjaxResult.success(traceabilityService.getDetail(id));
    }

    /**
     * 根据批次号查询（公开接口，供C端扫码使用）
     */
    @GetMapping("/batch/no/{batchNo}")
    public AjaxResult getByBatchNo(@PathVariable("batchNo") String batchNo) {
        return AjaxResult.success(traceabilityService.getDetailByBatchNo(batchNo));
    }

    /**
     * 新增批次
     */
    @PostMapping("/batch")
    @PreAuthorize("@ss.hasPermi('mall:traceability:add')")
    public AjaxResult save(@RequestBody TraceabilityBatch batch) {
        return AjaxResult.success(traceabilityService.createBatch(batch));
    }

    /**
     * 修改批次
     */
    @PutMapping("/batch")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult updateById(@RequestBody TraceabilityBatch batch) {
        return AjaxResult.success(traceabilityService.updateById(batch));
    }

    /**
     * 更新批次状态
     */
    @PutMapping("/batch/{id}/status")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") Integer status) {
        return AjaxResult.success(traceabilityService.updateStatus(id, status));
    }

    /**
     * 删除批次（软删除）
     */
    @DeleteMapping("/batch/{id}")
    @PreAuthorize("@ss.hasPermi('mall:traceability:del')")
    public AjaxResult removeById(@PathVariable Long id) {
        return AjaxResult.success(traceabilityService.removeById(id));
    }

    // ========== 时间线管理 ==========

    /**
     * 获取批次时间线
     */
    @GetMapping("/batch/{batchId}/timeline")
    public AjaxResult getTimeline(@PathVariable("batchId") Long batchId) {
        return AjaxResult.success(traceabilityService.getTimeline(batchId));
    }

    /**
     * 添加时间线节点
     */
    @PostMapping("/timeline")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult addTimelineNode(@RequestBody TraceabilityTimeline node) {
        return AjaxResult.success(traceabilityService.addTimelineNode(node));
    }

    /**
     * 更新时间线节点
     */
    @PutMapping("/timeline")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult updateTimelineNode(@RequestBody TraceabilityTimeline node) {
        return AjaxResult.success(traceabilityService.updateTimelineNode(node));
    }

    /**
     * 删除时间线节点
     */
    @DeleteMapping("/timeline/{nodeId}")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult deleteTimelineNode(@PathVariable("nodeId") Long nodeId) {
        return AjaxResult.success(traceabilityService.deleteTimelineNode(nodeId));
    }

    /**
     * 批量保存时间线节点
     * 行为：有id且存在则更新，无id则新增，DB中存在但本次未提交的节点删除
     */
    @PostMapping("/batch/{batchId}/timeline/batch")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult batchSaveTimeline(
            @PathVariable("batchId") Long batchId,
            @RequestBody java.util.List<TraceabilityTimeline> nodes) {
        return AjaxResult.success(traceabilityService.batchSaveTimeline(batchId, nodes));
    }

    // ========== 原料管理 ==========

    /**
     * 获取批次原料列表
     */
    @GetMapping("/batch/{batchId}/materials")
    public AjaxResult getRawMaterials(@PathVariable("batchId") Long batchId) {
        return AjaxResult.success(traceabilityService.getRawMaterials(batchId));
    }

    /**
     * 添加原料
     */
    @PostMapping("/material")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult addRawMaterial(@RequestBody TraceabilityRawMaterial material) {
        return AjaxResult.success(traceabilityService.addRawMaterial(material));
    }

    // ========== 质检报告管理 ==========

    /**
     * 获取批次质检报告
     */
    @GetMapping("/batch/{batchId}/quality-reports")
    public AjaxResult getQualityReports(@PathVariable("batchId") Long batchId) {
        return AjaxResult.success(traceabilityService.getQualityReports(batchId));
    }

    /**
     * 添加质检报告
     */
    @PostMapping("/quality-report")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult addQualityReport(@RequestBody TraceabilityQualityReport report) {
        return AjaxResult.success(traceabilityService.addQualityReport(report));
    }

    // ========== 证据管理 ==========

    /**
     * 获取批次证据
     */
    @GetMapping("/batch/{batchId}/evidences")
    public AjaxResult getEvidences(@PathVariable("batchId") Long batchId) {
        return AjaxResult.success(traceabilityService.getEvidences(batchId));
    }

    /**
     * 添加证据
     */
    @PostMapping("/evidence")
    @PreAuthorize("@ss.hasPermi('mall:traceability:edit')")
    public AjaxResult addEvidence(@RequestBody TraceabilityEvidence evidence) {
        return AjaxResult.success(traceabilityService.addEvidence(evidence));
    }
}
