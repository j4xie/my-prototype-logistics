package com.cretas.aims.repository.warehouse;

import com.cretas.aims.entity.warehouse.ReusableContainer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReusableContainerRepository extends JpaRepository<ReusableContainer, String> {

    Page<ReusableContainer> findByFactoryId(String factoryId, Pageable pageable);

    Optional<ReusableContainer> findByFactoryIdAndContainerCode(String factoryId, String containerCode);

    Optional<ReusableContainer> findByIdAndFactoryId(String id, String factoryId);
}
