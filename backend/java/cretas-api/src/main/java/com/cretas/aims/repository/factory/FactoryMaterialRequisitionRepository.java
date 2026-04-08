package com.cretas.aims.repository.factory;

import com.cretas.aims.entity.factory.FactoryMaterialRequisition;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryMaterialRequisitionRepository extends JpaRepository<FactoryMaterialRequisition, String> {

    Optional<FactoryMaterialRequisition> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    Page<FactoryMaterialRequisition> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);

    Page<FactoryMaterialRequisition> findByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, Status status, Pageable pageable);

    List<FactoryMaterialRequisition> findByFactoryIdAndProductionPlanIdAndDeletedAtIsNull(String factoryId, String productionPlanId);

    @Query("SELECT COUNT(r) FROM FactoryMaterialRequisition r WHERE r.factoryId = :factoryId AND r.requisitionNo LIKE CONCAT(:prefix, '%')")
    long countByFactoryIdAndRequisitionNoPrefix(@Param("factoryId") String factoryId, @Param("prefix") String prefix);
}
