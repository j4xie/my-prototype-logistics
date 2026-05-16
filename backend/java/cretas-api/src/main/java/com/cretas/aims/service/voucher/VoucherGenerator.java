package com.cretas.aims.service.voucher;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.Voucher;
import com.cretas.aims.entity.finance.VoucherEntry;

import java.util.List;

/**
 * 凭证生成器接口. 每个 generator 负责一类业务单 → 凭证 (Voucher + entries) 的映射.
 *
 * <p>实现要求:
 * <ul>
 *   <li>{@link #buildEntries(Object)} 必须返回借贷平衡的分录</li>
 *   <li>{@link #generate(String, Object)} 返回的 Voucher 通过 validateBalanced() 校验</li>
 *   <li>每个 generator 通过 @Component 自动注册到 {@link VoucherGeneratorRegistry}</li>
 * </ul>
 *
 * @param <T> 来源业务实体类型 (SalesOrder / PurchaseOrder / ...)
 */
public interface VoucherGenerator<T> {

    /** 此 generator 输出的凭证类型. */
    VoucherType getType();

    /**
     * 业务类型字符串 (SALES_ORDER / PURCHASE_ORDER / ...) 匹配判断.
     * Registry 用此 dispatch.
     */
    boolean supports(String businessType);

    /**
     * 生成完整 Voucher (含 entries, 借贷必平). Pure function — 不存 DB.
     * 实现末尾必须调用 voucher.validateBalanced() 自我校验.
     */
    Voucher generate(String factoryId, T businessEntity);

    /**
     * 构建借贷分录. 实现必须保证 sum(debit) == sum(credit).
     */
    List<VoucherEntry> buildEntries(T businessEntity);
}
