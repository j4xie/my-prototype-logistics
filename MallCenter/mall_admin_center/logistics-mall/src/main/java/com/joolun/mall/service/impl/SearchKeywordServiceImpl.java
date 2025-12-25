package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.MerchantNotification;
import com.joolun.mall.entity.SearchKeywordRecord;
import com.joolun.mall.entity.SearchKeywordStats;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.mapper.SearchKeywordRecordMapper;
import com.joolun.mall.mapper.SearchKeywordStatsMapper;
import com.joolun.mall.service.MerchantNotificationService;
import com.joolun.mall.service.SearchKeywordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 搜索关键词服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchKeywordServiceImpl extends ServiceImpl<SearchKeywordRecordMapper, SearchKeywordRecord>
        implements SearchKeywordService {

    private final SearchKeywordStatsMapper statsMapper;
    private final MerchantMapper merchantMapper;
    private final MerchantNotificationService notificationService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void recordSearch(String keyword, Long userId, Long merchantId, String phone, int resultCount, String source) {
        if (!StringUtils.hasText(keyword)) {
            return;
        }

        // 标准化关键词
        String normalizedKeyword = normalizeKeyword(keyword);

        // 1. 保存搜索记录
        SearchKeywordRecord record = new SearchKeywordRecord();
        record.setKeyword(keyword);
        record.setNormalizedKeyword(normalizedKeyword);
        record.setUserId(userId);
        record.setMerchantId(merchantId);
        record.setPhone(phone);
        record.setResultCount(resultCount);
        record.setSearchSource(source);
        record.setStatus(0);
        record.setCreateTime(LocalDateTime.now());
        baseMapper.insert(record);

        // 2. 更新统计数据
        updateStats(normalizedKeyword, keyword, resultCount == 0, merchantId);
    }

    @Override
    public IPage<SearchKeywordRecord> pageRecords(IPage<SearchKeywordRecord> page, SearchKeywordRecord query) {
        return baseMapper.selectPage1(page, query);
    }

    @Override
    public List<SearchKeywordStats> getHotKeywords(int limit) {
        return statsMapper.selectHotKeywords(limit);
    }

    @Override
    public IPage<SearchKeywordStats> pagePendingStats(IPage<SearchKeywordStats> page, SearchKeywordStats query) {
        return statsMapper.selectPage1(page, query);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean matchProducts(Long statsId, List<Long> productIds, Long operatorId) {
        SearchKeywordStats stats = statsMapper.selectById(statsId);
        if (stats == null) {
            return false;
        }

        // 更新统计记录
        stats.setMatchedProductIds(productIds.toString());
        stats.setStatus(1); // 已匹配
        stats.setUpdateTime(LocalDateTime.now());
        statsMapper.updateById(stats);

        // 更新相关的搜索记录
        LambdaUpdateWrapper<SearchKeywordRecord> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(SearchKeywordRecord::getNormalizedKeyword, stats.getKeyword())
               .eq(SearchKeywordRecord::getStatus, 0)
               .set(SearchKeywordRecord::getMatchedProductIds, productIds.toString())
               .set(SearchKeywordRecord::getMatchedTime, LocalDateTime.now())
               .set(SearchKeywordRecord::getMatchedBy, operatorId)
               .set(SearchKeywordRecord::getStatus, 1);
        baseMapper.update(null, wrapper);

        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int notifyMerchants(Long statsId, String title, String content, boolean sendSms,
                                Long operatorId, String operatorName) {
        SearchKeywordStats stats = statsMapper.selectById(statsId);
        if (stats == null) {
            return 0;
        }

        // 获取搜索过该关键词的商户
        LambdaQueryWrapper<SearchKeywordRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SearchKeywordRecord::getNormalizedKeyword, stats.getKeyword())
               .isNotNull(SearchKeywordRecord::getMerchantId)
               .groupBy(SearchKeywordRecord::getMerchantId);
        List<SearchKeywordRecord> records = baseMapper.selectList(wrapper);

        int count = 0;
        for (SearchKeywordRecord record : records) {
            if (record.getMerchantId() == null) continue;

            // 发送通知
            MerchantNotification notification = notificationService.sendNotification(
                record.getMerchantId(),
                title,
                content,
                "product_found",
                stats.getKeyword(),
                stats.getMatchedProductIds(),
                sendSms,
                operatorId,
                operatorName
            );

            if (notification != null) {
                // 更新搜索记录
                record.setNotificationId(notification.getId());
                record.setNotifiedTime(LocalDateTime.now());
                record.setStatus(2);
                baseMapper.updateById(record);
                count++;
            }
        }

        // 更新统计状态
        if (count > 0) {
            stats.setStatus(2); // 已通知
            stats.setUpdateTime(LocalDateTime.now());
            statsMapper.updateById(stats);
        }

        return count;
    }

    @Override
    public Map<String, Object> getOverview() {
        Map<String, Object> overview = new HashMap<>();

        // 今日无结果搜索数
        LambdaQueryWrapper<SearchKeywordRecord> todayWrapper = new LambdaQueryWrapper<>();
        todayWrapper.eq(SearchKeywordRecord::getResultCount, 0)
                   .ge(SearchKeywordRecord::getCreateTime, LocalDateTime.now().toLocalDate().atStartOfDay());
        overview.put("todayNoResult", baseMapper.selectCount(todayWrapper));

        // 待处理关键词数
        LambdaQueryWrapper<SearchKeywordStats> pendingWrapper = new LambdaQueryWrapper<>();
        pendingWrapper.eq(SearchKeywordStats::getStatus, 0);
        overview.put("pendingKeywords", statsMapper.selectCount(pendingWrapper));

        // 已匹配关键词数
        LambdaQueryWrapper<SearchKeywordStats> matchedWrapper = new LambdaQueryWrapper<>();
        matchedWrapper.eq(SearchKeywordStats::getStatus, 1);
        overview.put("matchedKeywords", statsMapper.selectCount(matchedWrapper));

        // 已通知商户数
        LambdaQueryWrapper<SearchKeywordStats> notifiedWrapper = new LambdaQueryWrapper<>();
        notifiedWrapper.eq(SearchKeywordStats::getStatus, 2);
        overview.put("notifiedKeywords", statsMapper.selectCount(notifiedWrapper));

        return overview;
    }

    @Override
    public boolean updateStatus(Long id, Integer status, String note) {
        SearchKeywordStats stats = statsMapper.selectById(id);
        if (stats == null) {
            return false;
        }
        stats.setStatus(status);
        stats.setAdminNote(note);
        stats.setUpdateTime(LocalDateTime.now());
        return statsMapper.updateById(stats) > 0;
    }

    @Override
    public boolean ignoreKeyword(Long statsId, String reason, Long operatorId) {
        return updateStatus(statsId, 3, reason);
    }

    @Override
    public SearchKeywordRecord recordSearch(String keyword, Long userId, Long merchantId, String phone, int resultCount) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }

        String normalizedKeyword = normalizeKeyword(keyword);

        // 保存搜索记录
        SearchKeywordRecord record = new SearchKeywordRecord();
        record.setKeyword(keyword);
        record.setNormalizedKeyword(normalizedKeyword);
        record.setUserId(userId);
        record.setMerchantId(merchantId);
        record.setPhone(phone);
        record.setResultCount(resultCount);
        record.setSearchSource("miniprogram");
        record.setStatus(0);
        record.setCreateTime(LocalDateTime.now());
        baseMapper.insert(record);

        // 更新统计数据
        updateStats(normalizedKeyword, keyword, resultCount == 0, merchantId);

        return record;
    }

    @Override
    public IPage<SearchKeywordStats> pageStats(IPage<SearchKeywordStats> page, SearchKeywordStats query) {
        return statsMapper.selectPage1(page, query);
    }

    @Override
    public SearchKeywordStats getStatsById(Long id) {
        return statsMapper.selectById(id);
    }

    @Override
    public boolean matchProducts(Long statsId, List<String> productIds) {
        List<Long> longIds = productIds.stream()
            .map(Long::parseLong)
            .collect(Collectors.toList());
        return matchProducts(statsId, longIds, null);
    }

    @Override
    public Map<String, Object> notifyMerchants(Long statsId, Boolean sendSms, String templateCode) {
        SearchKeywordStats stats = statsMapper.selectById(statsId);
        if (stats == null) {
            return Map.of("success", false, "message", "关键词不存在", "count", 0);
        }

        // 构建通知标题和内容
        String title = "您关注的商品已上架";
        String content = String.format("您之前搜索的「%s」现已有相关商品上架，点击查看详情", stats.getKeyword());

        int count = notifyMerchants(statsId, title, content, sendSms != null && sendSms, null, null);

        return Map.of(
            "success", count > 0,
            "message", count > 0 ? "通知发送成功" : "没有需要通知的商户",
            "count", count
        );
    }

    @Override
    public boolean updateStats(SearchKeywordStats stats) {
        if (stats == null || stats.getId() == null) {
            return false;
        }
        stats.setUpdateTime(LocalDateTime.now());
        return statsMapper.updateById(stats) > 0;
    }

    /**
     * 标准化关键词
     */
    private String normalizeKeyword(String keyword) {
        return keyword.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    /**
     * 更新统计数据
     */
    private void updateStats(String normalizedKeyword, String originalKeyword, boolean noResult, Long merchantId) {
        SearchKeywordStats stats = statsMapper.selectByKeyword(normalizedKeyword);

        if (stats == null) {
            // 新建统计记录
            stats = new SearchKeywordStats();
            stats.setKeyword(normalizedKeyword);
            stats.setOriginalKeywords("[\"" + originalKeyword + "\"]");
            stats.setSearchCount(1);
            stats.setNoResultCount(noResult ? 1 : 0);
            stats.setUniqueUsers(1);
            stats.setUniqueMerchants(merchantId != null ? 1 : 0);
            stats.setFirstSearchTime(LocalDateTime.now());
            stats.setLastSearchTime(LocalDateTime.now());
            stats.setStatus(0);
            stats.setPriority(0);
            stats.setIsHot(0);
            stats.setCreateTime(LocalDateTime.now());
            statsMapper.insert(stats);
        } else {
            // 更新统计记录
            stats.setSearchCount(stats.getSearchCount() + 1);
            if (noResult) {
                stats.setNoResultCount(stats.getNoResultCount() + 1);
            }
            stats.setLastSearchTime(LocalDateTime.now());

            // 更新优先级
            if (stats.getNoResultCount() >= 10 && stats.getUniqueMerchants() >= 3) {
                stats.setPriority(2);
            } else if (stats.getNoResultCount() >= 5 || stats.getUniqueMerchants() >= 2) {
                stats.setPriority(1);
            }

            // 更新热门标记
            if (stats.getSearchCount() >= 50) {
                stats.setIsHot(1);
            }

            stats.setUpdateTime(LocalDateTime.now());
            statsMapper.updateById(stats);
        }
    }
}
