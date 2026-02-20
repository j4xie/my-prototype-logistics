package com.cretas.aims.repository;

import com.cretas.aims.entity.DataCompletenessSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 数据完整性快照数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Repository
public interface DataCompletenessSnapshotRepository extends JpaRepository<DataCompletenessSnapshot, Long> {

    /**
     * 按工厂ID和实体类型查询，按快照日期降序
     */
    List<DataCompletenessSnapshot> findByFactoryIdAndEntityTypeOrderBySnapshotDateDesc(
            String factoryId, String entityType);

    /**
     * 按工厂ID和快照日期查询
     */
    List<DataCompletenessSnapshot> findByFactoryIdAndSnapshotDate(String factoryId, LocalDate snapshotDate);

    /**
     * 查询指定工厂和实体类型的最新快照
     */
    Optional<DataCompletenessSnapshot> findTopByFactoryIdAndEntityTypeOrderBySnapshotDateDesc(
            String factoryId, String entityType);
}
