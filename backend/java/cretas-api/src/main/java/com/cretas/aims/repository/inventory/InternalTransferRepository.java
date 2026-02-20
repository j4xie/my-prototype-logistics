package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.enums.TransferStatus;
import com.cretas.aims.entity.inventory.InternalTransfer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InternalTransferRepository extends JpaRepository<InternalTransfer, String> {

    /** 调出方视角（我发出的调拨） */
    Page<InternalTransfer> findBySourceFactoryIdOrderByCreatedAtDesc(String sourceFactoryId, Pageable pageable);

    /** 调入方视角（我收到的调拨） */
    Page<InternalTransfer> findByTargetFactoryIdOrderByCreatedAtDesc(String targetFactoryId, Pageable pageable);

    /** 双向视角：调出或调入 */
    @Query("SELECT t FROM InternalTransfer t WHERE t.sourceFactoryId = :factoryId OR t.targetFactoryId = :factoryId ORDER BY t.createdAt DESC")
    Page<InternalTransfer> findByFactoryId(@Param("factoryId") String factoryId, Pageable pageable);

    Page<InternalTransfer> findBySourceFactoryIdAndStatusOrderByCreatedAtDesc(String sourceFactoryId, TransferStatus status, Pageable pageable);

    Optional<InternalTransfer> findBySourceFactoryIdAndTransferNumber(String sourceFactoryId, String transferNumber);

    @Query("SELECT COUNT(t) FROM InternalTransfer t WHERE t.sourceFactoryId = :factoryId AND FUNCTION('DATE', t.createdAt) = CURRENT_DATE")
    long countTodayBySourceFactory(@Param("factoryId") String factoryId);
}
