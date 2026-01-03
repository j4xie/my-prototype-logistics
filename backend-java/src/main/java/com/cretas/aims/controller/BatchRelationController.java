package com.cretas.aims.controller;

import com.cretas.aims.entity.BatchRelation;
import com.cretas.aims.service.BatchRelationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 批次关联控制器
 * 用于管理生产批次与原材料批次的追溯关系
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/batch-relations")
@RequiredArgsConstructor
@Tag(name = "批次关联管理", description = "批次追溯关联管理接口")
public class BatchRelationController {

    private final BatchRelationService batchRelationService;

    /**
     * 获取批次关联列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取批次关联列表", description = "分页查询批次关联")
    public ResponseEntity<?> getBatchRelations(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "0") @Parameter(description = "页码") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页大小") int size) {
        try {
            PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "usedAt"));
            Page<BatchRelation> relations = batchRelationService.getBatchRelations(factoryId, pageRequest);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", relations.getContent());
            response.put("page", page);
            response.put("size", size);
            response.put("totalElements", relations.getTotalElements());
            response.put("totalPages", relations.getTotalPages());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取批次关联列表失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 根据生产批次查询关联
     */
    @GetMapping("/production/{productionBatchId}")
    @Operation(summary = "根据生产批次查询", description = "查询生产批次使用的所有原材料")
    public ResponseEntity<?> getByProductionBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "生产批次ID") Long productionBatchId) {
        try {
            List<BatchRelation> relations = batchRelationService.getByProductionBatchId(productionBatchId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", relations
            ));
        } catch (Exception e) {
            log.error("查询生产批次关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 根据原材料批次查询关联
     */
    @GetMapping("/material/{materialBatchId}")
    @Operation(summary = "根据原材料批次查询", description = "查询原材料被使用到的所有生产批次")
    public ResponseEntity<?> getByMaterialBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料批次ID") String materialBatchId) {
        try {
            List<BatchRelation> relations = batchRelationService.getByMaterialBatchId(materialBatchId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", relations
            ));
        } catch (Exception e) {
            log.error("查询原材料批次关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 正向追溯
     */
    @GetMapping("/trace/forward/{materialBatchId}")
    @Operation(summary = "正向追溯", description = "从原材料追溯到生产批次")
    public ResponseEntity<?> traceForward(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料批次ID") String materialBatchId) {
        try {
            List<BatchRelation> trace = batchRelationService.traceForward(materialBatchId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", trace
            ));
        } catch (Exception e) {
            log.error("正向追溯失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 反向追溯
     */
    @GetMapping("/trace/backward/{productionBatchId}")
    @Operation(summary = "反向追溯", description = "从生产批次追溯到原材料")
    public ResponseEntity<?> traceBackward(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "生产批次ID") Long productionBatchId) {
        try {
            List<BatchRelation> trace = batchRelationService.traceBackward(productionBatchId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", trace
            ));
        } catch (Exception e) {
            log.error("反向追溯失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取未验证的关联
     */
    @GetMapping("/unverified")
    @Operation(summary = "获取未验证关联", description = "获取所有未验证的批次关联")
    public ResponseEntity<?> getUnverifiedRelations(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        try {
            List<BatchRelation> unverified = batchRelationService.getUnverifiedRelations(factoryId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", unverified
            ));
        } catch (Exception e) {
            log.error("获取未验证关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取单个批次关联详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取关联详情", description = "根据ID获取批次关联详情")
    public ResponseEntity<?> getBatchRelation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "关联ID") String id) {
        try {
            return batchRelationService.getBatchRelationById(factoryId, id)
                    .map(relation -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "data", relation
                    )))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("获取批次关联详情失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 创建批次关联
     */
    @PostMapping
    @Operation(summary = "创建批次关联", description = "创建生产批次与原材料批次的关联")
    public ResponseEntity<?> createBatchRelation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long userId,
            @RequestBody @Parameter(description = "关联信息") BatchRelation batchRelation) {
        try {
            batchRelation.setFactoryId(factoryId);
            batchRelation.setOperatorId(userId);
            BatchRelation created = batchRelationService.createBatchRelation(batchRelation);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", created,
                "message", "批次关联创建成功"
            ));
        } catch (Exception e) {
            log.error("创建批次关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 更新批次关联
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新批次关联", description = "更新批次关联信息")
    public ResponseEntity<?> updateBatchRelation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "关联ID") String id,
            @RequestBody @Parameter(description = "更新数据") BatchRelation updateData) {
        try {
            BatchRelation updated = batchRelationService.updateBatchRelation(id, updateData);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", updated,
                "message", "批次关联更新成功"
            ));
        } catch (Exception e) {
            log.error("更新批次关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 验证批次关联
     */
    @PostMapping("/{id}/verify")
    @Operation(summary = "验证批次关联", description = "验证批次关联的准确性")
    public ResponseEntity<?> verifyRelation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "关联ID") String id,
            @RequestAttribute("userId") @Parameter(hidden = true) Long userId) {
        try {
            BatchRelation verified = batchRelationService.verifyRelation(id, userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", verified,
                "message", "批次关联已验证"
            ));
        } catch (Exception e) {
            log.error("验证批次关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 删除批次关联
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除批次关联", description = "删除指定的批次关联")
    public ResponseEntity<?> deleteBatchRelation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "关联ID") String id) {
        try {
            batchRelationService.deleteBatchRelation(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "批次关联删除成功"
            ));
        } catch (Exception e) {
            log.error("删除批次关联失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
}
