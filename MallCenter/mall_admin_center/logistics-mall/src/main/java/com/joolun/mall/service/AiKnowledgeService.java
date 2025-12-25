package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.mall.entity.AiKnowledgeCategory;
import com.joolun.mall.entity.AiKnowledgeDocument;
import com.joolun.mall.entity.AiQaPair;

import java.util.List;

/**
 * AI知识库服务接口
 */
public interface AiKnowledgeService {
    
    // ========== 分类管理 ==========
    
    /**
     * 获取分类树
     */
    List<AiKnowledgeCategory> getCategoryTree();
    
    /**
     * 获取所有分类列表
     */
    List<AiKnowledgeCategory> listCategories();
    
    /**
     * 获取分类详情
     */
    AiKnowledgeCategory getCategoryById(Long id);
    
    /**
     * 创建分类
     */
    AiKnowledgeCategory createCategory(AiKnowledgeCategory category);
    
    /**
     * 更新分类
     */
    boolean updateCategory(AiKnowledgeCategory category);
    
    /**
     * 删除分类
     */
    boolean deleteCategory(Long id);
    
    // ========== 文档管理 ==========
    
    /**
     * 分页查询文档
     */
    IPage<AiKnowledgeDocument> pageDocuments(Page<AiKnowledgeDocument> page, Long categoryId, String keyword, Integer status);
    
    /**
     * 根据分类查询文档
     */
    List<AiKnowledgeDocument> listDocumentsByCategory(Long categoryId);
    
    /**
     * 搜索文档
     */
    List<AiKnowledgeDocument> searchDocuments(String keyword, Long categoryId);
    
    /**
     * 获取文档详情（会增加浏览次数）
     */
    AiKnowledgeDocument getDocumentById(Long id);
    
    /**
     * 创建文档
     */
    AiKnowledgeDocument createDocument(AiKnowledgeDocument document);
    
    /**
     * 更新文档
     */
    boolean updateDocument(AiKnowledgeDocument document);
    
    /**
     * 删除文档
     */
    boolean deleteDocument(Long id);
    
    /**
     * 发布文档
     */
    boolean publishDocument(Long id);
    
    /**
     * 点赞文档
     */
    boolean likeDocument(Long id);
    
    // ========== 问答对管理 ==========
    
    /**
     * 分页查询问答对
     */
    IPage<AiQaPair> pageQaPairs(Page<AiQaPair> page, Long categoryId, String keyword, Integer status);
    
    /**
     * 根据分类查询问答对
     */
    List<AiQaPair> listQaPairsByCategory(Long categoryId);
    
    /**
     * 搜索问答
     */
    List<AiQaPair> searchQaPairs(String keyword, Long categoryId);
    
    /**
     * 获取热门问答
     */
    List<AiQaPair> getHotQaPairs(int limit);
    
    /**
     * 获取问答详情（会增加命中次数）
     */
    AiQaPair getQaPairById(Long id);
    
    /**
     * 创建问答对
     */
    AiQaPair createQaPair(AiQaPair qaPair);
    
    /**
     * 更新问答对
     */
    boolean updateQaPair(AiQaPair qaPair);
    
    /**
     * 删除问答对
     */
    boolean deleteQaPair(Long id);
    
    /**
     * 点赞问答
     */
    boolean likeQaPair(Long id);
    
    /**
     * 踩问答
     */
    boolean dislikeQaPair(Long id);
}
