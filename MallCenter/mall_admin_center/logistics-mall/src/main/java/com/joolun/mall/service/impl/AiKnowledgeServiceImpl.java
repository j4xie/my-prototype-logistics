package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.mall.entity.AiKnowledgeCategory;
import com.joolun.mall.entity.AiKnowledgeDocument;
import com.joolun.mall.entity.AiQaPair;
import com.joolun.mall.mapper.AiKnowledgeCategoryMapper;
import com.joolun.mall.mapper.AiKnowledgeDocumentMapper;
import com.joolun.mall.mapper.AiQaPairMapper;
import com.joolun.mall.service.AiKnowledgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AI知识库服务实现
 */
@Service
@RequiredArgsConstructor
public class AiKnowledgeServiceImpl implements AiKnowledgeService {
    
    private final AiKnowledgeCategoryMapper categoryMapper;
    private final AiKnowledgeDocumentMapper documentMapper;
    private final AiQaPairMapper qaPairMapper;
    
    // ========== 分类管理 ==========
    
    @Override
    public List<AiKnowledgeCategory> getCategoryTree() {
        List<AiKnowledgeCategory> allCategories = categoryMapper.selectAllCategories();
        return buildTree(allCategories, 0L);
    }
    
    private List<AiKnowledgeCategory> buildTree(List<AiKnowledgeCategory> categories, Long parentId) {
        List<AiKnowledgeCategory> tree = new ArrayList<>();
        for (AiKnowledgeCategory category : categories) {
            Long pid = category.getParentId() == null ? 0L : category.getParentId();
            if (pid.equals(parentId)) {
                category.setChildren(buildTree(categories, category.getId()));
                tree.add(category);
            }
        }
        return tree;
    }
    
    @Override
    public List<AiKnowledgeCategory> listCategories() {
        return categoryMapper.selectAllCategories();
    }
    
    @Override
    public AiKnowledgeCategory getCategoryById(Long id) {
        return categoryMapper.selectById(id);
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiKnowledgeCategory createCategory(AiKnowledgeCategory category) {
        category.setCreateTime(LocalDateTime.now());
        category.setUpdateTime(LocalDateTime.now());
        if (category.getSort() == null) {
            category.setSort(0);
        }
        if (category.getStatus() == null) {
            category.setStatus(1);
        }
        categoryMapper.insert(category);
        return category;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateCategory(AiKnowledgeCategory category) {
        category.setUpdateTime(LocalDateTime.now());
        return categoryMapper.updateById(category) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteCategory(Long id) {
        return categoryMapper.deleteById(id) > 0;
    }
    
    // ========== 文档管理 ==========
    
    @Override
    public IPage<AiKnowledgeDocument> pageDocuments(Page<AiKnowledgeDocument> page, Long categoryId, String keyword, Integer status) {
        LambdaQueryWrapper<AiKnowledgeDocument> wrapper = new LambdaQueryWrapper<>();
        if (categoryId != null) {
            wrapper.eq(AiKnowledgeDocument::getCategoryId, categoryId);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(AiKnowledgeDocument::getTitle, keyword)
                    .or().like(AiKnowledgeDocument::getKeywords, keyword)
                    .or().like(AiKnowledgeDocument::getContent, keyword));
        }
        if (status != null) {
            wrapper.eq(AiKnowledgeDocument::getStatus, status);
        }
        wrapper.orderByDesc(AiKnowledgeDocument::getCreateTime);
        return documentMapper.selectPage(page, wrapper);
    }
    
    @Override
    public List<AiKnowledgeDocument> listDocumentsByCategory(Long categoryId) {
        return documentMapper.selectByCategoryId(categoryId);
    }
    
    @Override
    public List<AiKnowledgeDocument> searchDocuments(String keyword, Long categoryId) {
        return documentMapper.searchDocuments(keyword, categoryId);
    }
    
    @Override
    public AiKnowledgeDocument getDocumentById(Long id) {
        documentMapper.incrementViewCount(id);
        return documentMapper.selectById(id);
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiKnowledgeDocument createDocument(AiKnowledgeDocument document) {
        document.setCreateTime(LocalDateTime.now());
        document.setUpdateTime(LocalDateTime.now());
        if (document.getStatus() == null) {
            document.setStatus(0); // 默认草稿
        }
        if (document.getViewCount() == null) {
            document.setViewCount(0);
        }
        if (document.getLikeCount() == null) {
            document.setLikeCount(0);
        }
        if (document.getVectorStatus() == null) {
            document.setVectorStatus(0);
        }
        documentMapper.insert(document);
        return document;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateDocument(AiKnowledgeDocument document) {
        document.setUpdateTime(LocalDateTime.now());
        return documentMapper.updateById(document) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteDocument(Long id) {
        return documentMapper.deleteById(id) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean publishDocument(Long id) {
        AiKnowledgeDocument document = new AiKnowledgeDocument();
        document.setId(id);
        document.setStatus(1);
        document.setUpdateTime(LocalDateTime.now());
        return documentMapper.updateById(document) > 0;
    }
    
    @Override
    public boolean likeDocument(Long id) {
        return documentMapper.incrementLikeCount(id) > 0;
    }
    
    // ========== 问答对管理 ==========
    
    @Override
    public IPage<AiQaPair> pageQaPairs(Page<AiQaPair> page, Long categoryId, String keyword, Integer status) {
        LambdaQueryWrapper<AiQaPair> wrapper = new LambdaQueryWrapper<>();
        if (categoryId != null) {
            wrapper.eq(AiQaPair::getCategoryId, categoryId);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(AiQaPair::getQuestion, keyword)
                    .or().like(AiQaPair::getKeywords, keyword));
        }
        if (status != null) {
            wrapper.eq(AiQaPair::getStatus, status);
        }
        wrapper.orderByDesc(AiQaPair::getHitCount);
        return qaPairMapper.selectPage(page, wrapper);
    }
    
    @Override
    public List<AiQaPair> listQaPairsByCategory(Long categoryId) {
        return qaPairMapper.selectByCategoryId(categoryId);
    }
    
    @Override
    public List<AiQaPair> searchQaPairs(String keyword, Long categoryId) {
        return qaPairMapper.searchQaPairs(keyword, categoryId);
    }
    
    @Override
    public List<AiQaPair> getHotQaPairs(int limit) {
        return qaPairMapper.selectHotQaPairs(limit);
    }
    
    @Override
    public AiQaPair getQaPairById(Long id) {
        qaPairMapper.incrementHitCount(id);
        return qaPairMapper.selectById(id);
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiQaPair createQaPair(AiQaPair qaPair) {
        qaPair.setCreateTime(LocalDateTime.now());
        qaPair.setUpdateTime(LocalDateTime.now());
        if (qaPair.getStatus() == null) {
            qaPair.setStatus(1);
        }
        if (qaPair.getHitCount() == null) {
            qaPair.setHitCount(0);
        }
        if (qaPair.getLikeCount() == null) {
            qaPair.setLikeCount(0);
        }
        if (qaPair.getDislikeCount() == null) {
            qaPair.setDislikeCount(0);
        }
        qaPairMapper.insert(qaPair);
        return qaPair;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateQaPair(AiQaPair qaPair) {
        qaPair.setUpdateTime(LocalDateTime.now());
        return qaPairMapper.updateById(qaPair) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteQaPair(Long id) {
        return qaPairMapper.deleteById(id) > 0;
    }
    
    @Override
    public boolean likeQaPair(Long id) {
        return qaPairMapper.incrementLikeCount(id) > 0;
    }
    
    @Override
    public boolean dislikeQaPair(Long id) {
        return qaPairMapper.incrementDislikeCount(id) > 0;
    }
}
