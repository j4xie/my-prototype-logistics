package com.cretas.aims.repository;

import com.cretas.aims.entity.WeightHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 权重历史记录 Repository
 */
@Repository
public interface WeightHistoryRepository extends JpaRepository<WeightHistory, String> {

    List<WeightHistory> findByFactoryIdOrderByAdjustedAtDesc(String factoryId);

    List<WeightHistory> findByFactoryIdAndAdjustedAtAfterOrderByAdjustedAtDesc(String factoryId, LocalDateTime after);
}
