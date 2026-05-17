package com.cretas.aims.repository.finance;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 凭证模板 Repository (Sprint 4 Wave 2 Chat J — C-VOUCHER-TPL-1 foundation).
 *
 * <p>Foundation: minimal query。Full service / VoucherGenerator refactor 在 follow-up chat。
 *
 * <p>Generator template 选用顺序:
 * <ol>
 *   <li>{@link #findActiveDefaultByFactoryAndType} — factory+type 的 default active 模板</li>
 *   <li>{@link #findFirstActiveByFactoryAndType} — factory+type 任意 active 模板 (兜底)</li>
 *   <li>无 → generator fall back 到 hardcoded path (backward compat)</li>
 * </ol>
 *
 * @since 2026-05-24
 */
@Repository
public interface VoucherTemplateRepository extends JpaRepository<VoucherTemplate, String> {

    /** factory + voucherType 的 active default 模板 (unique partial 索引强制唯一). */
    Optional<VoucherTemplate> findByFactoryIdAndVoucherTypeAndIsDefaultTrueAndIsActiveTrue(
            String factoryId, VoucherType voucherType);

    /** Alias 便于代码可读. */
    default Optional<VoucherTemplate> findActiveDefaultByFactoryAndType(
            String factoryId, VoucherType voucherType) {
        return findByFactoryIdAndVoucherTypeAndIsDefaultTrueAndIsActiveTrue(factoryId, voucherType);
    }

    /** factory + voucherType 任意一条 active 模板 (按 createdAt 排序取第一). */
    Optional<VoucherTemplate> findFirstByFactoryIdAndVoucherTypeAndIsActiveTrueOrderByCreatedAtAsc(
            String factoryId, VoucherType voucherType);

    /** Alias. */
    default Optional<VoucherTemplate> findFirstActiveByFactoryAndType(
            String factoryId, VoucherType voucherType) {
        return findFirstByFactoryIdAndVoucherTypeAndIsActiveTrueOrderByCreatedAtAsc(factoryId, voucherType);
    }

    /** 列出工厂全部模板 (含 inactive,用于 Vue editor 列表). */
    List<VoucherTemplate> findByFactoryIdOrderByVoucherTypeAscCreatedAtDesc(String factoryId);

    /** Count active templates per voucherType — audit summary. */
    long countByFactoryIdAndIsActiveTrue(String factoryId);
}
