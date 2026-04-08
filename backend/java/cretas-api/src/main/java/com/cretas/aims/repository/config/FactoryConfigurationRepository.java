package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryConfigurationRepository extends JpaRepository<FactoryConfiguration, Long> {
    Optional<FactoryConfiguration> findByFactoryIdAndStatus(String factoryId, String status);

    @Query("SELECT fc FROM FactoryConfiguration fc WHERE fc.factoryId = :factoryId AND fc.status = 'PUBLISHED' ORDER BY fc.configVersion DESC")
    Optional<FactoryConfiguration> findLatestPublished(@Param("factoryId") String factoryId);

    @Query("SELECT fc FROM FactoryConfiguration fc WHERE fc.factoryId = :factoryId AND fc.status = 'DRAFT'")
    Optional<FactoryConfiguration> findDraft(@Param("factoryId") String factoryId);

    List<FactoryConfiguration> findByFactoryIdOrderByConfigVersionDesc(String factoryId);

    Optional<FactoryConfiguration> findByFactoryIdAndConfigVersion(String factoryId, Integer configVersion);
}
