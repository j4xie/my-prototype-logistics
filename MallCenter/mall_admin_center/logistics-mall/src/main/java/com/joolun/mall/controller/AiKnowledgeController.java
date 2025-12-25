package com.joolun.mall.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.AiKnowledgeCategory;
import com.joolun.mall.entity.AiKnowledgeDocument;
import com.joolun.mall.entity.AiQaPair;
import com.joolun.mall.service.AiKnowledgeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI知识库控制器 - 对齐前端 aiKnowledge.js API路径
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/ai-knowledge")
@Tag(name = "AI知识库管理")
public class AiKnowledgeController {
    
    private final AiKnowledgeService aiKnowledgeService;
    
    // ========== 文档管理 (对齐 /documents 路径) ==========
    
    @GetMapping("/documents")
    @Operation(summary = "获取文档列表")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<IPage<AiKnowledgeDocument>> getDocuments(
            Page<AiKnowledgeDocument> page,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        return R.ok(aiKnowledgeService.pageDocuments(page, categoryId, keyword, status));
    }
    
    @GetMapping("/documents/{id}")
    @Operation(summary = "获取文档详情")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<AiKnowledgeDocument> getDocument(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.getDocumentById(id));
    }
    
    @PostMapping("/documents/upload")
    @Operation(summary = "上传文档")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:add')")
    public R<AiKnowledgeDocument> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String title) {
        // 简化实现：创建文档记录，实际文件上传需配合OSS/本地存储
        AiKnowledgeDocument document = new AiKnowledgeDocument();
        document.setCategoryId(categoryId);
        document.setTitle(title != null ? title : file.getOriginalFilename());
        document.setFileType(getFileExtension(file.getOriginalFilename()));
        document.setFileUrl("/uploads/" + file.getOriginalFilename()); // 占位，实际应上传到存储
        return R.ok(aiKnowledgeService.createDocument(document));
    }
    
    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex > 0 ? filename.substring(dotIndex + 1).toLowerCase() : "";
    }
    
    @PutMapping("/documents/{id}")
    @Operation(summary = "更新文档")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:edit')")
    public R<Boolean> updateDocument(@PathVariable Long id, @RequestBody AiKnowledgeDocument document) {
        document.setId(id);
        return R.ok(aiKnowledgeService.updateDocument(document));
    }
    
    @DeleteMapping("/documents/{id}")
    @Operation(summary = "删除文档")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:del')")
    public R<Boolean> deleteDocument(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.deleteDocument(id));
    }
    
    @DeleteMapping("/documents/batch")
    @Operation(summary = "批量删除文档")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:del')")
    public R<Boolean> batchDeleteDocuments(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body.get("ids");
        if (ids != null) {
            for (Long id : ids) {
                aiKnowledgeService.deleteDocument(id);
            }
        }
        return R.ok(true);
    }
    
    @PostMapping("/documents/{id}/reprocess")
    @Operation(summary = "重新解析文档")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:edit')")
    public R<Boolean> reprocessDocument(@PathVariable Long id) {
        // 重置向量化状态，触发重新处理
        AiKnowledgeDocument document = new AiKnowledgeDocument();
        document.setId(id);
        document.setVectorStatus(0); // 重置为待处理
        return R.ok(aiKnowledgeService.updateDocument(document));
    }
    
    // ========== 分类管理 (对齐 /categories 路径) ==========
    
    @GetMapping("/categories/tree")
    @Operation(summary = "获取分类树")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<List<AiKnowledgeCategory>> getCategoryTree() {
        return R.ok(aiKnowledgeService.getCategoryTree());
    }
    
    @GetMapping("/categories")
    @Operation(summary = "获取分类列表")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<List<AiKnowledgeCategory>> getCategories() {
        return R.ok(aiKnowledgeService.listCategories());
    }
    
    @PostMapping("/categories")
    @Operation(summary = "添加分类")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:add')")
    public R<AiKnowledgeCategory> addCategory(@RequestBody AiKnowledgeCategory category) {
        return R.ok(aiKnowledgeService.createCategory(category));
    }
    
    @PutMapping("/categories/{id}")
    @Operation(summary = "更新分类")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:edit')")
    public R<Boolean> updateCategory(@PathVariable Long id, @RequestBody AiKnowledgeCategory category) {
        category.setId(id);
        return R.ok(aiKnowledgeService.updateCategory(category));
    }
    
    @DeleteMapping("/categories/{id}")
    @Operation(summary = "删除分类")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:del')")
    public R<Boolean> deleteCategory(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.deleteCategory(id));
    }
    
    // ========== QA配对管理 (对齐 /qa-pairs 路径) ==========
    
    @GetMapping("/qa-pairs")
    @Operation(summary = "获取QA列表")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<IPage<AiQaPair>> getQAPairs(
            Page<AiQaPair> page,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        return R.ok(aiKnowledgeService.pageQaPairs(page, categoryId, keyword, status));
    }
    
    @GetMapping("/qa-pairs/{id}")
    @Operation(summary = "获取QA详情")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<AiQaPair> getQAPair(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.getQaPairById(id));
    }
    
    @PostMapping("/qa-pairs")
    @Operation(summary = "添加QA")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:add')")
    public R<AiQaPair> addQAPair(@RequestBody AiQaPair qaPair) {
        return R.ok(aiKnowledgeService.createQaPair(qaPair));
    }
    
    @PutMapping("/qa-pairs/{id}")
    @Operation(summary = "更新QA")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:edit')")
    public R<Boolean> updateQAPair(@PathVariable Long id, @RequestBody AiQaPair qaPair) {
        qaPair.setId(id);
        return R.ok(aiKnowledgeService.updateQaPair(qaPair));
    }
    
    @DeleteMapping("/qa-pairs/{id}")
    @Operation(summary = "删除QA")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:del')")
    public R<Boolean> deleteQAPair(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.deleteQaPair(id));
    }
    
    @PostMapping("/qa-pairs/import")
    @Operation(summary = "批量导入QA")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:add')")
    public R<Integer> importQAPairs(@RequestBody List<AiQaPair> qaPairs) {
        int count = 0;
        for (AiQaPair qaPair : qaPairs) {
            aiKnowledgeService.createQaPair(qaPair);
            count++;
        }
        return R.ok(count);
    }
    
    // ========== 知识库统计 ==========
    
    @GetMapping("/stats")
    @Operation(summary = "获取知识库统计")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<Map<String, Object>> getKnowledgeStats() {
        Map<String, Object> stats = new HashMap<>();
        // 统计各项数据
        List<AiKnowledgeCategory> categories = aiKnowledgeService.listCategories();
        stats.put("categoryCount", categories.size());
        
        // 分页查询获取总数
        IPage<AiKnowledgeDocument> docPage = aiKnowledgeService.pageDocuments(new Page<>(1, 1), null, null, null);
        stats.put("documentCount", docPage.getTotal());
        
        IPage<AiQaPair> qaPage = aiKnowledgeService.pageQaPairs(new Page<>(1, 1), null, null, null);
        stats.put("qaCount", qaPage.getTotal());
        
        // 向量化统计（简化）
        stats.put("vectorCount", 0);
        
        return R.ok(stats);
    }
    
    @GetMapping("/vectorization/status")
    @Operation(summary = "获取向量化状态")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:get')")
    public R<Map<String, Object>> getVectorizationStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("pending", 0);
        status.put("processing", 0);
        status.put("completed", 0);
        status.put("failed", 0);
        return R.ok(status);
    }
    
    @PostMapping("/vectorization/trigger")
    @Operation(summary = "触发向量化")
    @PreAuthorize("@ss.hasPermi('mall:ai:knowledge:edit')")
    public R<Boolean> triggerVectorization(@RequestBody Map<String, List<Long>> body) {
        // 简化实现：标记为处理中
        List<Long> documentIds = body.get("documentIds");
        if (documentIds != null) {
            for (Long id : documentIds) {
                AiKnowledgeDocument document = new AiKnowledgeDocument();
                document.setId(id);
                document.setVectorStatus(1); // 处理中
                aiKnowledgeService.updateDocument(document);
            }
        }
        return R.ok(true);
    }
    
    // ========== 公开接口（无需权限）==========
    
    @GetMapping("/qa-pairs/hot")
    @Operation(summary = "获取热门问答")
    public R<List<AiQaPair>> getHotQaPairs(@RequestParam(defaultValue = "10") int limit) {
        return R.ok(aiKnowledgeService.getHotQaPairs(limit));
    }
    
    @PostMapping("/documents/{id}/like")
    @Operation(summary = "点赞文档")
    public R<Boolean> likeDocument(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.likeDocument(id));
    }
    
    @PostMapping("/qa-pairs/{id}/like")
    @Operation(summary = "点赞问答")
    public R<Boolean> likeQaPair(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.likeQaPair(id));
    }
    
    @PostMapping("/qa-pairs/{id}/dislike")
    @Operation(summary = "踩问答")
    public R<Boolean> dislikeQaPair(@PathVariable Long id) {
        return R.ok(aiKnowledgeService.dislikeQaPair(id));
    }
}
