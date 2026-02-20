package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.InternalTransferItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InternalTransferItemRepository extends JpaRepository<InternalTransferItem, Long> {

    List<InternalTransferItem> findByTransferId(String transferId);
}
