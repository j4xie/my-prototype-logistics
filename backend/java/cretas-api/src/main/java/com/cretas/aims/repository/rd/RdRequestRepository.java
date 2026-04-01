package com.cretas.aims.repository.rd;

import com.cretas.aims.entity.rd.RdRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RdRequestRepository extends JpaRepository<RdRequest, String> {
    Page<RdRequest> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);
    Page<RdRequest> findByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, String status, Pageable pageable);
}
