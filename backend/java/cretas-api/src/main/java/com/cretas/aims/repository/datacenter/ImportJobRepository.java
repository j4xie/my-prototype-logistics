package com.cretas.aims.repository.datacenter;

import com.cretas.aims.entity.datacenter.ImportJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImportJobRepository extends JpaRepository<ImportJob, String> {

    Page<ImportJob> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<ImportJob> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, String status, Pageable pageable);

    Optional<ImportJob> findByIdAndFactoryId(String id, String factoryId);
}
