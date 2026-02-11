package com.cretas.aims.repository;

import com.cretas.aims.entity.BatchEvidencePhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 批次证据照片数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Repository
public interface BatchEvidencePhotoRepository extends JpaRepository<BatchEvidencePhoto, Long> {

    /**
     * 按批次ID和工厂ID查询所有照片
     */
    List<BatchEvidencePhoto> findByBatchIdAndFactoryId(Long batchId, String factoryId);

    /**
     * 按批次ID、工厂ID和阶段查询照片
     */
    List<BatchEvidencePhoto> findByBatchIdAndFactoryIdAndStage(Long batchId, String factoryId, String stage);

    /**
     * 统计批次照片数量
     */
    long countByBatchIdAndFactoryId(Long batchId, String factoryId);
}
