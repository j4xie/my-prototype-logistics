package com.cretas.aims.repository.rd;

import com.cretas.aims.entity.rd.ProductSample;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductSampleRepository extends JpaRepository<ProductSample, String> {
    Page<ProductSample> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);
    Page<ProductSample> findByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, String status, Pageable pageable);
    List<ProductSample> findByRdRequestIdAndDeletedAtIsNull(String rdRequestId);

    /** Factory-scoped lookup — enforces tenant isolation. */
    Optional<ProductSample> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);
}
