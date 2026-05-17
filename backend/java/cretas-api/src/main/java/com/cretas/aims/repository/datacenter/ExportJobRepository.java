package com.cretas.aims.repository.datacenter;

import com.cretas.aims.entity.datacenter.ExportJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExportJobRepository extends JpaRepository<ExportJob, String> {

    Page<ExportJob> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<ExportJob> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, String status, Pageable pageable);

    Optional<ExportJob> findByIdAndFactoryId(String id, String factoryId);
}
