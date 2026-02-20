package com.cretas.aims.repository.pos;

import com.cretas.aims.entity.enums.PosBrand;
import com.cretas.aims.entity.pos.PosConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PosConnectionRepository extends JpaRepository<PosConnection, String> {

    List<PosConnection> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    List<PosConnection> findByFactoryIdAndIsActiveTrue(String factoryId);

    Optional<PosConnection> findByFactoryIdAndBrand(String factoryId, PosBrand brand);

    Optional<PosConnection> findByIdAndFactoryId(String id, String factoryId);
}
