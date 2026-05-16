package com.cretas.aims.repository;

import com.cretas.aims.entity.finance.VoucherEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VoucherEntryRepository extends JpaRepository<VoucherEntry, String> {

    List<VoucherEntry> findByVoucherIdAndDeletedAtIsNullOrderByLineNoAsc(String voucherId);

    void deleteByVoucherId(String voucherId);
}
