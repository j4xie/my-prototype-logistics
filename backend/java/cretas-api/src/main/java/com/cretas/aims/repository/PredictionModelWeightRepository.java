package com.cretas.aims.repository;

import com.cretas.aims.entity.PredictionModelWeight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 预测模型权重 Repository
 */
@Repository
public interface PredictionModelWeightRepository extends JpaRepository<PredictionModelWeight, String> {

    List<PredictionModelWeight> findByFactoryId(String factoryId);

    Optional<PredictionModelWeight> findByFactoryIdAndFeatureName(String factoryId, String featureName);
}
