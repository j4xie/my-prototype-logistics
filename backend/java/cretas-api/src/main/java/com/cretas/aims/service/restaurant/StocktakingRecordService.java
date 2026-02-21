package com.cretas.aims.service.restaurant;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.restaurant.StocktakingRecord;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public interface StocktakingRecordService {
    PageResponse<StocktakingRecord> getRecords(String factoryId, StocktakingRecord.Status status, int page, int size);
    StocktakingRecord getRecordById(String factoryId, String recordId);
    StocktakingRecord createRecord(String factoryId, StocktakingRecord record, Long userId);
    StocktakingRecord completeRecord(String factoryId, String recordId, BigDecimal actualQuantity, Long userId);
    void cancelRecord(String factoryId, String recordId);
    Map<String, Object> getLatestSummary(String factoryId);
}
