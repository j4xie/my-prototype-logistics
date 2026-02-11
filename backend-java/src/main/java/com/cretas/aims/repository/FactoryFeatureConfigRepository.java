package com.cretas.aims.repository;

import com.cretas.aims.entity.FactoryFeatureConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryFeatureConfigRepository extends JpaRepository<FactoryFeatureConfig, Long> {

    List<FactoryFeatureConfig> findByFactoryIdAndDeletedAtIsNull(String factoryId);

    Optional<FactoryFeatureConfig> findByFactoryIdAndModuleIdAndDeletedAtIsNull(
            String factoryId, String moduleId);
}
