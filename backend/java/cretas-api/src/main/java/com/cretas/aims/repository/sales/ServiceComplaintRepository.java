package com.cretas.aims.repository.sales;

import com.cretas.aims.entity.enums.ServiceComplaintStatus;
import com.cretas.aims.entity.sales.ServiceComplaint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * P2 #74 S-COMPLAINT-1 — ServiceComplaint 仓储.
 */
@Repository
public interface ServiceComplaintRepository extends JpaRepository<ServiceComplaint, String> {

    Optional<ServiceComplaint> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    Page<ServiceComplaint> findByFactoryIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String factoryId, Pageable pageable);

    Page<ServiceComplaint> findByFactoryIdAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
            String factoryId, List<ServiceComplaintStatus> statuses, Pageable pageable);

    Page<ServiceComplaint> findByFactoryIdAndCustomerIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String factoryId, String customerId, Pageable pageable);

    /** Counter for complaint number generation — count of complaints created today. */
    @Query("SELECT COUNT(c) FROM ServiceComplaint c " +
            "WHERE c.factoryId = :factoryId " +
            "AND c.complaintNumber LIKE :prefix " +
            "AND c.deletedAt IS NULL")
    long countByPrefix(@Param("factoryId") String factoryId, @Param("prefix") String prefix);

    /**
     * R4 dedup check — find recent identical complaint within window for same customer +
     * description. Returns first match (any).
     */
    @Query("SELECT c FROM ServiceComplaint c " +
            "WHERE c.factoryId = :factoryId " +
            "AND c.customerId = :customerId " +
            "AND c.description = :description " +
            "AND c.createdAt >= :sinceAt " +
            "AND c.deletedAt IS NULL " +
            "ORDER BY c.createdAt DESC")
    List<ServiceComplaint> findRecentDuplicates(
            @Param("factoryId") String factoryId,
            @Param("customerId") String customerId,
            @Param("description") String description,
            @Param("sinceAt") LocalDateTime sinceAt);
}
