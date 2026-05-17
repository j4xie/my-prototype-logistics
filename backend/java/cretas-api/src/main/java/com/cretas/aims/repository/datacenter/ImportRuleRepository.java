package com.cretas.aims.repository.datacenter;

import com.cretas.aims.entity.datacenter.ImportRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImportRuleRepository extends JpaRepository<ImportRule, Long> {

    Page<ImportRule> findByFactoryIdAndModuleCode(String factoryId, String moduleCode, Pageable pageable);

    Page<ImportRule> findByFactoryId(String factoryId, Pageable pageable);

    Optional<ImportRule> findByIdAndFactoryId(Long id, String factoryId);
}
