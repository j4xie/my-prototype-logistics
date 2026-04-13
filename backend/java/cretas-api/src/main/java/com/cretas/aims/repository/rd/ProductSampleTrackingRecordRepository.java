package com.cretas.aims.repository.rd;

import com.cretas.aims.entity.rd.ProductSampleTrackingRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * P1-8 研发样品追踪记录 Repository.
 */
@Repository
public interface ProductSampleTrackingRecordRepository
        extends JpaRepository<ProductSampleTrackingRecord, String> {

    List<ProductSampleTrackingRecord> findBySampleIdAndDeletedAtIsNullOrderByRecordedAtDesc(String sampleId);

    List<ProductSampleTrackingRecord> findByFactoryIdAndSampleIdAndDeletedAtIsNullOrderByRecordedAtDesc(
            String factoryId, String sampleId);
}
