package com.cretas.aims.dto.finance;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 通用交易记录请求
 */
@Data
public class RecordTransactionRequest {

    @NotBlank(message = "交易对手ID不能为空")
    private String counterpartyId;

    /** 关联的订单ID（可选） */
    private String orderId;

    @NotNull(message = "金额不能为空")
    @Positive(message = "金额必须大于0")
    private BigDecimal amount;

    /** 到期日（挂账时填写） */
    private LocalDate dueDate;

    /** 付款方式（收付款时填写） */
    private String paymentMethod;

    /** 付款凭证号 */
    private String paymentReference;

    private String remark;
}
