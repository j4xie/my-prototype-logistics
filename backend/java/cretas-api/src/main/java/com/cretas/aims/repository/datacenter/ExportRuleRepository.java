package com.cretas.aims.repository.datacenter;

import com.cretas.aims.entity.datacenter.ExportRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExportRuleRepository extends JpaRepository<ExportRule, Long> {

    Page<ExportRule> findByFactoryIdAndModuleCode(String factoryId, String moduleCode, Pageable pageable);

    Page<ExportRule> findByFactoryId(String factoryId, Pageable pageable);

    Optional<ExportRule> findByIdAndFactoryId(Long id, String factoryId);
}
