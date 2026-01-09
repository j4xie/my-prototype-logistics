package com.joolun.mall.job;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.service.VectorSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 商品向量化定时任务
 * 定期为新商品生成向量，更新商品向量缓存
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProductVectorizeJob {

    private final GoodsSpuMapper goodsSpuMapper;
    private final VectorSearchService vectorSearchService;

    /**
     * 每天凌晨2点执行全量向量化
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void fullVectorize() {
        if (!vectorSearchService.isAvailable()) {
            log.warn("向量搜索服务不可用，跳过全量向量化");
            return;
        }

        log.info("开始执行商品全量向量化任务");

        try {
            // 获取所有上架商品
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1");
            List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);

            log.info("待向量化商品数量: {}", products.size());

            // 批量向量化
            vectorSearchService.batchVectorizeProducts(products);

            log.info("商品全量向量化任务完成");

        } catch (Exception e) {
            log.error("商品全量向量化任务失败", e);
        }
    }

    /**
     * 每小时执行增量向量化（更新最近修改的商品）
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void incrementalVectorize() {
        if (!vectorSearchService.isAvailable()) {
            return;
        }

        log.info("开始执行商品增量向量化任务");

        try {
            // 获取最近1小时内更新的上架商品
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")
                   .ge(GoodsSpu::getUpdateTime, java.time.LocalDateTime.now().minusHours(1));
            List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);

            if (!products.isEmpty()) {
                log.info("增量向量化商品数量: {}", products.size());
                vectorSearchService.batchVectorizeProducts(products);
            }

            log.info("商品增量向量化任务完成");

        } catch (Exception e) {
            log.error("商品增量向量化任务失败", e);
        }
    }

    /**
     * 手动触发单个商品向量化
     * @param productId 商品ID
     */
    public void vectorizeSingleProduct(String productId) {
        if (!vectorSearchService.isAvailable()) {
            log.warn("向量搜索服务不可用");
            return;
        }

        try {
            vectorSearchService.refreshProductVector(productId);
            log.info("商品向量化完成: productId={}", productId);
        } catch (Exception e) {
            log.error("商品向量化失败: productId={}", productId, e);
        }
    }

    /**
     * 手动触发全量向量化（供管理后台调用）
     */
    public void triggerFullVectorize() {
        fullVectorize();
    }
}
