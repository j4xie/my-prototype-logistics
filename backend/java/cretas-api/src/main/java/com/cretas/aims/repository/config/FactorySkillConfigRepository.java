package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactorySkillConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactorySkillConfigRepository extends JpaRepository<FactorySkillConfig, Long> {
    List<FactorySkillConfig> findByFactoryId(String factoryId);
    Optional<FactorySkillConfig> findByFactoryIdAndSkillName(String factoryId, String skillName);
    List<FactorySkillConfig> findByFactoryIdAndEnabledTrue(String factoryId);
}
