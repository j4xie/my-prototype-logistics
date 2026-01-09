package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.*;
import com.joolun.mall.mapper.GoodsCategoryMapper;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.TraceabilityBatchMapper;
import com.joolun.mall.service.ProductKnowledgeService;
import com.joolun.mall.service.TraceabilityService;
import com.joolun.mall.service.VectorSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 商品知识库服务实现 - RAG (Retrieval Augmented Generation)
 * 用于构建商品知识上下文，增强 AI 对话能力
 */
@Slf4j
@Service
public class ProductKnowledgeServiceImpl implements ProductKnowledgeService {

    private final GoodsSpuMapper goodsSpuMapper;
    private final GoodsCategoryMapper categoryMapper;
    private final TraceabilityBatchMapper traceabilityBatchMapper;
    private final TraceabilityService traceabilityService;
    private final VectorSearchService vectorSearchService;
    private final RedisTemplate<String, Object> redisTemplate;

    public ProductKnowledgeServiceImpl(
            GoodsSpuMapper goodsSpuMapper,
            GoodsCategoryMapper categoryMapper,
            TraceabilityBatchMapper traceabilityBatchMapper,
            TraceabilityService traceabilityService,
            VectorSearchService vectorSearchService,
            @Qualifier("stringObjectRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.goodsSpuMapper = goodsSpuMapper;
        this.categoryMapper = categoryMapper;
        this.traceabilityBatchMapper = traceabilityBatchMapper;
        this.traceabilityService = traceabilityService;
        this.vectorSearchService = vectorSearchService;
        this.redisTemplate = redisTemplate;
    }

    private static final String KNOWLEDGE_CACHE_KEY_PREFIX = "mall:rag:knowledge:";
    private static final long KNOWLEDGE_CACHE_TTL_HOURS = 2;
    private static final DecimalFormat PRICE_FORMAT = new DecimalFormat("#,##0.00");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // RAG 系统提示模板
    private static final String RAG_SYSTEM_PROMPT_TEMPLATE = """
        你是白垩纪食品溯源商城的智能客服助手。你拥有以下商品知识库信息：

        %s

        基于以上知识库信息，请帮助用户：
        1. 回答关于商品的问题（价格、规格、库存、特点等）
        2. 根据用户需求推荐合适的商品
        3. 解答关于商品溯源和食品安全的疑问
        4. 提供专业的采购建议

        请用自然、专业的语气回答。如果知识库中没有相关信息，请诚实告知用户，不要编造信息。

        请以JSON格式返回：
        {
            "intent": "用户意图",
            "keywords": ["关键词"],
            "response": "回复内容",
            "confidence": 0.95,
            "sourcedFromKnowledge": true
        }
        """;

    @Override
    public String buildProductContext(String productId) {
        if (productId == null || productId.isEmpty()) {
            return "";
        }

        // 尝试从缓存获取
        String cacheKey = KNOWLEDGE_CACHE_KEY_PREFIX + "product:" + productId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return cached.toString();
        }

        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) {
            return "";
        }

        StringBuilder context = new StringBuilder();
        context.append("【商品信息】\n");
        context.append("- 商品名称：").append(product.getName()).append("\n");

        if (product.getSpuCode() != null) {
            context.append("- 商品编码：").append(product.getSpuCode()).append("\n");
        }

        if (product.getSellPoint() != null && !product.getSellPoint().isEmpty()) {
            context.append("- 卖点：").append(product.getSellPoint()).append("\n");
        }

        if (product.getDescription() != null && !product.getDescription().isEmpty()) {
            // 截取描述，避免过长
            String desc = product.getDescription();
            if (desc.length() > 500) {
                desc = desc.substring(0, 500) + "...";
            }
            context.append("- 详细描述：").append(desc).append("\n");
        }

        // 价格信息
        if (product.getSalesPrice() != null) {
            context.append("- 销售价格：").append(formatPrice(product.getSalesPrice())).append("元\n");
        }
        if (product.getMarketPrice() != null && product.getSalesPrice() != null
                && product.getMarketPrice().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal discount = product.getSalesPrice().divide(product.getMarketPrice(), 2, BigDecimal.ROUND_HALF_UP);
            if (discount.compareTo(BigDecimal.ONE) < 0) {
                context.append("- 市场价：").append(formatPrice(product.getMarketPrice())).append("元（当前优惠 ")
                       .append(discount.multiply(BigDecimal.valueOf(10)).setScale(1, BigDecimal.ROUND_HALF_UP)).append("折）\n");
            }
        }

        // 库存信息
        if (product.getStock() != null) {
            context.append("- 库存：").append(product.getStock()).append("件");
            if (product.getStock() < 10) {
                context.append("（库存紧张）");
            } else if (product.getStock() > 100) {
                context.append("（库存充足）");
            }
            context.append("\n");
        }

        // 销量信息
        if (product.getSaleNum() != null && product.getSaleNum() > 0) {
            context.append("- 已售：").append(product.getSaleNum()).append("件\n");
        }

        // 分类信息
        String categoryInfo = buildCategoryInfo(product);
        if (!categoryInfo.isEmpty()) {
            context.append("- 所属分类：").append(categoryInfo).append("\n");
        }

        // 上架状态
        if ("1".equals(product.getShelf())) {
            context.append("- 状态：在售\n");
        } else {
            context.append("- 状态：暂时下架\n");
        }

        String result = context.toString();

        // 缓存结果
        redisTemplate.opsForValue().set(cacheKey, result, KNOWLEDGE_CACHE_TTL_HOURS, TimeUnit.HOURS);

        return result;
    }

    @Override
    public String buildCategoryContext(String categoryId) {
        if (categoryId == null || categoryId.isEmpty()) {
            return "";
        }

        // 尝试从缓存获取
        String cacheKey = KNOWLEDGE_CACHE_KEY_PREFIX + "category:" + categoryId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return cached.toString();
        }

        GoodsCategory category = categoryMapper.selectById(categoryId);
        if (category == null) {
            return "";
        }

        StringBuilder context = new StringBuilder();
        context.append("【分类信息】\n");
        context.append("- 分类名称：").append(category.getName()).append("\n");

        if (category.getDescription() != null && !category.getDescription().isEmpty()) {
            context.append("- 分类描述：").append(category.getDescription()).append("\n");
        }

        // 查询该分类下的商品统计
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1");
        wrapper.and(w -> w.eq(GoodsSpu::getCategoryFirst, categoryId)
                         .or()
                         .eq(GoodsSpu::getCategorySecond, categoryId));
        List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);

        context.append("- 在售商品数量：").append(products.size()).append("件\n");

        if (!products.isEmpty()) {
            // 价格区间
            BigDecimal minPrice = products.stream()
                    .filter(p -> p.getSalesPrice() != null)
                    .map(GoodsSpu::getSalesPrice)
                    .min(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);
            BigDecimal maxPrice = products.stream()
                    .filter(p -> p.getSalesPrice() != null)
                    .map(GoodsSpu::getSalesPrice)
                    .max(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);
            context.append("- 价格区间：").append(formatPrice(minPrice)).append(" - ")
                   .append(formatPrice(maxPrice)).append("元\n");

            // 热门商品（按销量排序前3）
            List<GoodsSpu> hotProducts = products.stream()
                    .filter(p -> p.getSaleNum() != null)
                    .sorted((a, b) -> b.getSaleNum().compareTo(a.getSaleNum()))
                    .limit(3)
                    .collect(Collectors.toList());

            if (!hotProducts.isEmpty()) {
                context.append("- 热门商品：");
                context.append(hotProducts.stream()
                        .map(GoodsSpu::getName)
                        .collect(Collectors.joining("、")));
                context.append("\n");
            }
        }

        String result = context.toString();
        redisTemplate.opsForValue().set(cacheKey, result, KNOWLEDGE_CACHE_TTL_HOURS, TimeUnit.HOURS);

        return result;
    }

    @Override
    public List<GoodsSpu> retrieveRelevantKnowledge(String query, int topK) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }

        List<GoodsSpu> results = new ArrayList<>();

        // 1. 优先使用向量搜索
        if (vectorSearchService.isAvailable()) {
            try {
                results = vectorSearchService.searchSimilarProducts(query, topK);
                if (!results.isEmpty()) {
                    log.debug("RAG 向量搜索返回 {} 个结果", results.size());
                    return results;
                }
            } catch (Exception e) {
                log.warn("RAG 向量搜索失败，降级到关键词搜索: {}", e.getMessage());
            }
        }

        // 2. 降级到关键词搜索
        results = keywordSearch(query, topK);
        log.debug("RAG 关键词搜索返回 {} 个结果", results.size());

        return results;
    }

    @Override
    public String enhancePromptWithKnowledge(String userQuery, List<GoodsSpu> products) {
        StringBuilder knowledgeBuilder = new StringBuilder();

        // 添加相关商品知识
        if (products != null && !products.isEmpty()) {
            knowledgeBuilder.append("=== 相关商品信息 ===\n\n");

            for (int i = 0; i < products.size(); i++) {
                GoodsSpu product = products.get(i);
                knowledgeBuilder.append(String.format("商品%d：\n", i + 1));
                knowledgeBuilder.append(buildProductContext(product.getId()));
                knowledgeBuilder.append("\n");
            }
        }

        // 添加分类知识（如果商品有分类信息）
        Set<String> categoryIds = new HashSet<>();
        if (products != null) {
            for (GoodsSpu product : products) {
                if (product.getCategoryFirst() != null) {
                    categoryIds.add(product.getCategoryFirst());
                }
                if (product.getCategorySecond() != null) {
                    categoryIds.add(product.getCategorySecond());
                }
            }
        }

        if (!categoryIds.isEmpty()) {
            knowledgeBuilder.append("=== 相关分类信息 ===\n\n");
            for (String categoryId : categoryIds) {
                knowledgeBuilder.append(buildCategoryContext(categoryId));
                knowledgeBuilder.append("\n");
            }
        }

        // 如果没有找到相关知识
        if (knowledgeBuilder.length() == 0) {
            knowledgeBuilder.append("当前知识库中暂无与用户查询直接相关的商品信息。\n");
            knowledgeBuilder.append("请基于一般知识回答用户问题，并建议用户具体描述需求。\n");
        }

        // 添加用户查询上下文
        knowledgeBuilder.append("\n=== 用户查询 ===\n");
        knowledgeBuilder.append("用户问题：").append(userQuery).append("\n");

        return String.format(RAG_SYSTEM_PROMPT_TEMPLATE, knowledgeBuilder.toString());
    }

    @Override
    public String buildComparisonContext(List<String> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return "";
        }

        StringBuilder context = new StringBuilder();
        context.append("【商品对比】\n\n");

        List<GoodsSpu> products = new ArrayList<>();
        for (String id : productIds) {
            GoodsSpu product = goodsSpuMapper.selectById(id);
            if (product != null) {
                products.add(product);
            }
        }

        if (products.isEmpty()) {
            return "";
        }

        // 对比表格头
        context.append("| 属性 |");
        for (GoodsSpu p : products) {
            context.append(" ").append(truncate(p.getName(), 15)).append(" |");
        }
        context.append("\n|---");
        for (int i = 0; i < products.size(); i++) {
            context.append("|---");
        }
        context.append("|\n");

        // 价格对比
        context.append("| 价格 |");
        for (GoodsSpu p : products) {
            context.append(" ").append(p.getSalesPrice() != null ? formatPrice(p.getSalesPrice()) + "元" : "-").append(" |");
        }
        context.append("\n");

        // 库存对比
        context.append("| 库存 |");
        for (GoodsSpu p : products) {
            context.append(" ").append(p.getStock() != null ? p.getStock() + "件" : "-").append(" |");
        }
        context.append("\n");

        // 销量对比
        context.append("| 销量 |");
        for (GoodsSpu p : products) {
            context.append(" ").append(p.getSaleNum() != null ? p.getSaleNum() + "件" : "-").append(" |");
        }
        context.append("\n");

        // 卖点对比
        context.append("\n【各商品特点】\n");
        for (GoodsSpu p : products) {
            context.append("- ").append(p.getName()).append("：");
            context.append(p.getSellPoint() != null ? p.getSellPoint() : "暂无卖点描述");
            context.append("\n");
        }

        return context.toString();
    }

    @Override
    public String buildPriceContext(List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return "";
        }

        StringBuilder context = new StringBuilder();
        context.append("【价格信息汇总】\n\n");

        // 按价格排序
        List<GoodsSpu> sortedProducts = products.stream()
                .filter(p -> p.getSalesPrice() != null)
                .sorted(Comparator.comparing(GoodsSpu::getSalesPrice))
                .collect(Collectors.toList());

        if (sortedProducts.isEmpty()) {
            return "暂无价格信息\n";
        }

        // 价格区间
        BigDecimal minPrice = sortedProducts.get(0).getSalesPrice();
        BigDecimal maxPrice = sortedProducts.get(sortedProducts.size() - 1).getSalesPrice();
        context.append("价格区间：").append(formatPrice(minPrice)).append(" - ")
               .append(formatPrice(maxPrice)).append("元\n\n");

        // 平均价格
        if (!sortedProducts.isEmpty()) {
            BigDecimal avgPrice = sortedProducts.stream()
                    .map(GoodsSpu::getSalesPrice)
                    .filter(price -> price != null)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(sortedProducts.size()), 2, BigDecimal.ROUND_HALF_UP);
            context.append("平均价格：").append(formatPrice(avgPrice)).append("元\n\n");
        }

        // 按价格分档
        context.append("价格分布：\n");
        Map<String, List<GoodsSpu>> priceRanges = new LinkedHashMap<>();
        priceRanges.put("0-50元", new ArrayList<>());
        priceRanges.put("50-100元", new ArrayList<>());
        priceRanges.put("100-200元", new ArrayList<>());
        priceRanges.put("200元以上", new ArrayList<>());

        for (GoodsSpu p : sortedProducts) {
            BigDecimal price = p.getSalesPrice();
            if (price.compareTo(BigDecimal.valueOf(50)) < 0) {
                priceRanges.get("0-50元").add(p);
            } else if (price.compareTo(BigDecimal.valueOf(100)) < 0) {
                priceRanges.get("50-100元").add(p);
            } else if (price.compareTo(BigDecimal.valueOf(200)) < 0) {
                priceRanges.get("100-200元").add(p);
            } else {
                priceRanges.get("200元以上").add(p);
            }
        }

        for (Map.Entry<String, List<GoodsSpu>> entry : priceRanges.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                context.append("- ").append(entry.getKey()).append("：")
                       .append(entry.getValue().size()).append("款商品\n");
            }
        }

        // 优惠商品
        List<GoodsSpu> discountProducts = sortedProducts.stream()
                .filter(p -> p.getMarketPrice() != null
                        && p.getMarketPrice().compareTo(BigDecimal.ZERO) > 0
                        && p.getSalesPrice() != null
                        && p.getSalesPrice().compareTo(p.getMarketPrice()) < 0)
                .collect(Collectors.toList());

        if (!discountProducts.isEmpty()) {
            context.append("\n【优惠商品】\n");
            for (GoodsSpu p : discountProducts.stream().limit(5).collect(Collectors.toList())) {
                BigDecimal discount = p.getSalesPrice().divide(p.getMarketPrice(), 2, BigDecimal.ROUND_HALF_UP)
                        .multiply(BigDecimal.valueOf(10));
                context.append("- ").append(p.getName()).append("：")
                       .append(formatPrice(p.getSalesPrice())).append("元（")
                       .append(discount.setScale(1, BigDecimal.ROUND_HALF_UP)).append("折）\n");
            }
        }

        return context.toString();
    }

    @Override
    public String buildTraceabilityContext(String productId) {
        if (productId == null || productId.isEmpty()) {
            return "";
        }

        // 尝试从缓存获取
        String cacheKey = KNOWLEDGE_CACHE_KEY_PREFIX + "traceability:" + productId;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return cached.toString();
        }

        StringBuilder context = new StringBuilder();

        // 获取商品信息
        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) {
            return "";
        }

        context.append("【溯源信息】\n");
        context.append("商品：").append(product.getName()).append("\n\n");

        // 查询该商品的溯源批次
        try {
            LambdaQueryWrapper<TraceabilityBatch> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(TraceabilityBatch::getProductId, Long.parseLong(productId))
                   .orderByDesc(TraceabilityBatch::getCreateTime)
                   .last("LIMIT 5");
            List<TraceabilityBatch> batches = traceabilityBatchMapper.selectList(wrapper);

            if (batches.isEmpty()) {
                context.append("暂无溯源批次记录。\n");
                context.append("该商品的详细溯源信息正在建设中，请放心购买。\n");
            } else {
                context.append("最近溯源批次：\n");
                for (TraceabilityBatch batch : batches) {
                    context.append("\n批次号：").append(batch.getBatchNo()).append("\n");
                    if (batch.getProductionDate() != null) {
                        context.append("- 生产日期：").append(batch.getProductionDate().format(DATE_FORMATTER)).append("\n");
                    }
                    if (batch.getExpiryDate() != null) {
                        context.append("- 保质期至：").append(batch.getExpiryDate().format(DATE_FORMATTER)).append("\n");
                    }
                    if (batch.getWorkshop() != null) {
                        context.append("- 生产车间：").append(batch.getWorkshop()).append("\n");
                    }
                    if (batch.getQuantity() != null) {
                        context.append("- 批次数量：").append(batch.getQuantity())
                               .append(batch.getUnit() != null ? batch.getUnit() : "").append("\n");
                    }

                    // 获取批次详情（含质检报告）
                    TraceabilityBatch detail = traceabilityService.getDetail(batch.getId());
                    if (detail != null && detail.getQualityReports() != null && !detail.getQualityReports().isEmpty()) {
                        context.append("- 质检：已通过 ").append(detail.getQualityReports().size()).append(" 项检测\n");
                    }
                }

                context.append("\n购买后可扫码查看完整溯源信息。\n");
            }
        } catch (Exception e) {
            log.warn("获取溯源信息失败: productId={}, error={}", productId, e.getMessage());
            context.append("溯源信息查询暂时不可用。\n");
        }

        String result = context.toString();
        redisTemplate.opsForValue().set(cacheKey, result, KNOWLEDGE_CACHE_TTL_HOURS, TimeUnit.HOURS);

        return result;
    }

    @Override
    public String getHotProductsSummary(int limit) {
        // 尝试从缓存获取
        String cacheKey = KNOWLEDGE_CACHE_KEY_PREFIX + "hot:" + limit;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return cached.toString();
        }

        StringBuilder context = new StringBuilder();
        context.append("【热门商品推荐】\n\n");

        // 查询热门商品（按销量排序）
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
               .isNotNull(GoodsSpu::getSaleNum)
               .orderByDesc(GoodsSpu::getSaleNum)
               .last("LIMIT " + limit);
        List<GoodsSpu> hotProducts = goodsSpuMapper.selectList(wrapper);

        if (hotProducts.isEmpty()) {
            context.append("暂无热门商品数据。\n");
        } else {
            for (int i = 0; i < hotProducts.size(); i++) {
                GoodsSpu p = hotProducts.get(i);
                context.append(String.format("%d. %s\n", i + 1, p.getName()));
                context.append("   价格：").append(formatPrice(p.getSalesPrice())).append("元");
                if (p.getSaleNum() != null && p.getSaleNum() > 0) {
                    context.append(" | 已售：").append(p.getSaleNum()).append("件");
                }
                if (p.getSellPoint() != null && !p.getSellPoint().isEmpty()) {
                    context.append("\n   特点：").append(truncate(p.getSellPoint(), 50));
                }
                context.append("\n\n");
            }
        }

        String result = context.toString();
        redisTemplate.opsForValue().set(cacheKey, result, 30, TimeUnit.MINUTES); // 热门商品缓存30分钟

        return result;
    }

    // ========== 私有辅助方法 ==========

    /**
     * 关键词搜索
     */
    private List<GoodsSpu> keywordSearch(String query, int limit) {
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1");

        String[] keywords = query.split("[\\s，,、]+");
        wrapper.and(w -> {
            for (String keyword : keywords) {
                if (keyword.length() >= 2) {
                    w.or(q -> q.like(GoodsSpu::getName, keyword)
                              .or().like(GoodsSpu::getSellPoint, keyword)
                              .or().like(GoodsSpu::getDescription, keyword));
                }
            }
        });

        wrapper.last("LIMIT " + limit);
        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 构建分类信息字符串
     */
    private String buildCategoryInfo(GoodsSpu product) {
        List<String> categories = new ArrayList<>();

        if (product.getCategoryFirst() != null) {
            GoodsCategory cat1 = categoryMapper.selectById(product.getCategoryFirst());
            if (cat1 != null) {
                categories.add(cat1.getName());
            }
        }

        if (product.getCategorySecond() != null) {
            GoodsCategory cat2 = categoryMapper.selectById(product.getCategorySecond());
            if (cat2 != null) {
                categories.add(cat2.getName());
            }
        }

        return String.join(" > ", categories);
    }

    /**
     * 格式化价格
     */
    private String formatPrice(BigDecimal price) {
        if (price == null) {
            return "0.00";
        }
        return PRICE_FORMAT.format(price);
    }

    /**
     * 截断字符串
     */
    private String truncate(String text, int maxLength) {
        if (text == null) {
            return "";
        }
        if (text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }
}
