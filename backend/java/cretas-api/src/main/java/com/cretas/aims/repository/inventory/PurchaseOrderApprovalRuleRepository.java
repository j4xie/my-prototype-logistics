package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.PurchaseOrderApprovalRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 采购审核规则 Repo — Sprint2-J P-FIN-1.
 *
 * <p>核心查询: factory 取启用规则. 同 factory 多条 enabled=true 时, 按 createdAt
 * desc 取首条 (允许 ops 灰度引入新规则, 旧规则禁用).
 */
@Repository
public interface PurchaseOrderApprovalRuleRepository extends JpaRepository<PurchaseOrderApprovalRule, String> {

    List<PurchaseOrderApprovalRule> findByFactoryIdAndEnabledTrueOrderByCreatedAtDesc(String factoryId);

    Optional<PurchaseOrderApprovalRule> findByFactoryIdAndRuleName(String factoryId, String ruleName);
}
