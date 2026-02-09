package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiExcelUpload;
import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI Excel上传记录 Repository
 *
 * <p>管理Excel文件上传记录，支持按工厂和状态查询。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiExcelUploadRepository extends JpaRepository<SmartBiExcelUpload, Long> {

    /**
     * 根据工厂ID查询上传记录
     *
     * @param factoryId 工厂ID
     * @return 上传记录列表
     */
    List<SmartBiExcelUpload> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID查询上传记录，按创建时间降序排列
     *
     * @param factoryId 工厂ID
     * @return 上传记录列表
     */
    List<SmartBiExcelUpload> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * 根据工厂ID和上传状态查询上传记录
     *
     * @param factoryId 工厂ID
     * @param status 上传状态
     * @return 上传记录列表
     */
    List<SmartBiExcelUpload> findByFactoryIdAndUploadStatus(String factoryId, UploadStatus status);

    /**
     * 根据ID和工厂ID查询上传记录（工厂隔离）
     *
     * @param id 记录ID
     * @param factoryId 工厂ID
     * @return 上传记录
     */
    Optional<SmartBiExcelUpload> findByIdAndFactoryId(Long id, String factoryId);
}
