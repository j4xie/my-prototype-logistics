package com.cretas.aims.service.impl;

import com.cretas.aims.entity.restaurant.MaterialRequisition;
import com.cretas.aims.entity.restaurant.WastageRecord;
import com.cretas.aims.repository.restaurant.MaterialRequisitionRepository;
import com.cretas.aims.repository.restaurant.StocktakingRecordRepository;
import com.cretas.aims.repository.restaurant.WastageRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 餐饮 Dashboard 聚合服务
 *
 * <p>汇总领料、损耗、盘点等核心指标，为首页看板提供数据。</p>
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RestaurantDashboardServiceImpl {

    private final MaterialRequisitionRepository requisitionRepository;
    private final WastageRecordRepository wastageRepository;
    private final StocktakingRecordRepository stocktakingRepository;

    /**
     * 获取餐饮看板汇总数据
     *
     * @param factoryId 工厂/餐厅 ID
     * @return 包含核心指标的 Map
     */
    public Map<String, Object> getSummary(String factoryId) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);

        // 1. 今日领料单数量
        long todayRequisitionCount = requisitionRepository.countByFactoryIdAndDate(factoryId, today);

        // 2. 待审批数量（领料 SUBMITTED + 损耗 SUBMITTED）
        long pendingRequisitions = requisitionRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(
                factoryId, MaterialRequisition.Status.SUBMITTED, PageRequest.of(0, 1)).getTotalElements();
        long pendingWastage = wastageRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(
                factoryId, WastageRecord.Status.SUBMITTED, PageRequest.of(0, 1)).getTotalElements();
        long pendingApprovalCount = pendingRequisitions + pendingWastage;

        // 3. 本月损耗金额
        BigDecimal thisMonthWastageCost = wastageRepository.getTotalEstimatedCost(factoryId, monthStart, today);

        // 4. 最近盘点日期
        String latestStocktakingDate = stocktakingRepository.findLatestCompletedDate(factoryId)
                .map(LocalDate::toString)
                .orElse(null);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("todayRequisitionCount", todayRequisitionCount);
        result.put("pendingApprovalCount", pendingApprovalCount);
        result.put("thisMonthWastageCost", thisMonthWastageCost);
        result.put("latestStocktakingDate", latestStocktakingDate);
        return result;
    }
}
