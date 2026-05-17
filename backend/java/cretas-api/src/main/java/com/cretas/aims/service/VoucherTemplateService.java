package com.cretas.aims.service;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherEntry;
import com.cretas.aims.entity.finance.VoucherTemplate;

import java.util.List;
import java.util.Optional;

/**
 * 凭证模板服务 (C-VOUCHER-TPL-1).
 *
 * <p>Sprint 4 W2 Chat J — 让财务管理员可编辑科目映射, 替代 Sprint 3 E 7 generator
 * 硬编码 subjectCode. 关键 API:
 *
 * <ul>
 *   <li>{@link #findActiveTemplate} — Generator 调用, 找 active default → 任意 active → empty</li>
 *   <li>{@link #renderEntries} — 用 SpEL 求值 amountExpression 渲染分录</li>
 *   <li>CRUD — admin 增删改查</li>
 * </ul>
 *
 * <p>Backward compat: caller 在 empty optional 时 fall back 到 hardcoded path.
 * Generator 老 7 实现保持不变, AbstractVoucherGenerator.generate() 注入此服务.
 *
 * @since 2026-05-17
 */
public interface VoucherTemplateService {

    /**
     * Generator 调用: factory + voucherType 找 active 模板.
     * <p>Lookup 顺序: active default → 任意 active → empty (fall back hardcoded).
     */
    Optional<VoucherTemplate> findActiveTemplate(String factoryId, VoucherType voucherType);

    /**
     * 用模板 + 业务实体渲染 VoucherEntry 列表.
     * <p>SpEL 变量空间: {@code #entity} = businessEntity 直接绑定.
     * 模板 amountExpression 形如 {@code #entity.totalAmount}.
     *
     * @throws com.cretas.aims.exception.BusinessException 当 SpEL eval 失败 / 结果不能转 BigDecimal
     */
    List<VoucherEntry> renderEntries(VoucherTemplate template, Object businessEntity);

    // ==================== Admin CRUD ====================

    List<VoucherTemplate> listByFactory(String factoryId);

    List<VoucherTemplate> listByFactoryAndType(String factoryId, VoucherType voucherType);

    Optional<VoucherTemplate> getById(String factoryId, String id);

    VoucherTemplate create(String factoryId, VoucherTemplate template);

    VoucherTemplate update(String factoryId, String id, VoucherTemplate partial);

    void delete(String factoryId, String id);

    /**
     * 设某模板为 default — 自动取消同 (factory, voucherType) 其他 default.
     * (DB unique partial 索引强制每 factory+type 最多 1 default, 此方法保证写时不冲突.)
     */
    VoucherTemplate setAsDefault(String factoryId, String id);
}
