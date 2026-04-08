package com.cretas.aims.repository.factory;

import com.cretas.aims.entity.factory.FactoryMaterialRequisitionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FactoryMaterialRequisitionItemRepository extends JpaRepository<FactoryMaterialRequisitionItem, String> {
    List<FactoryMaterialRequisitionItem> findByRequisition_IdAndDeletedAtIsNull(String requisitionId);
}
