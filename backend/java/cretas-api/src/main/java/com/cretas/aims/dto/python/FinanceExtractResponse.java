package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 财务数据提取响应 DTO
 *
 * 接收 Python /api/finance/extract 端点的响应结果，
 * 每条 record 对应一个 SmartBiFinanceData 实体。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinanceExtractResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 提取的财务记录列表
     * 每条记录包含: recordType, recordDate, category, department,
     * actualAmount, totalCost, receivableAmount, payableAmount, budgetAmount
     */
    private List<Map<String, Object>> records;

    /**
     * 错误信息
     */
    private String error;
}
