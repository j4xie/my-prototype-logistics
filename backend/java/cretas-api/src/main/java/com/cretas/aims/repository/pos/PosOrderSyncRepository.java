package com.cretas.aims.repository.pos;

import com.cretas.aims.entity.enums.PosBrand;
import com.cretas.aims.entity.enums.PosSyncStatus;
import com.cretas.aims.entity.pos.PosOrderSync;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PosOrderSyncRepository extends JpaRepository<PosOrderSync, Long> {

    Page<PosOrderSync> findByFactoryIdOrderBySyncedAtDesc(String factoryId, Pageable pageable);

    /** 幂等检查：同品牌同POS订单号是否已同步 */
    boolean existsByPosOrderIdAndBrand(String posOrderId, PosBrand brand);

    Optional<PosOrderSync> findByPosOrderIdAndBrand(String posOrderId, PosBrand brand);

    List<PosOrderSync> findByFactoryIdAndSyncStatus(String factoryId, PosSyncStatus status);

    /** 查找需要重试的记录（失败且重试次数<上限） */
    List<PosOrderSync> findBySyncStatusAndRetryCountLessThan(PosSyncStatus status, int maxRetries);
}
