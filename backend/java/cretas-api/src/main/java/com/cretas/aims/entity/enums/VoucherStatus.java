package com.cretas.aims.entity.enums;

/**
 * 凭证自身状态. 与 {@link VoucherFlag} 不同 — VoucherFlag 是业务单上的标记,
 * VoucherStatus 是 Voucher entity 自己的生命周期.
 */
public enum VoucherStatus {
    /** 草稿 — generator 刚生成, 未过账 */
    DRAFT,
    /** 已过账 — 财务审核通过 */
    POSTED,
    /** 作废 — voidVoucher 后状态 */
    VOID
}
