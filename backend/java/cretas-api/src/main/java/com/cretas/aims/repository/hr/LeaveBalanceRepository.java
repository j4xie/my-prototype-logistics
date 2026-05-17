package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.LeaveBalance;
import com.cretas.aims.entity.hr.enums.LeaveType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, String> {

    Optional<LeaveBalance> findByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
            String factoryId, Long userId, LeaveType leaveType, String yearMonth);

    /** 悲观锁版本 — Service 累计 earned/used 时用, 防并发覆盖. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<LeaveBalance> findForUpdateByFactoryIdAndUserIdAndLeaveTypeAndYearMonth(
            String factoryId, Long userId, LeaveType leaveType, String yearMonth);

    List<LeaveBalance> findByFactoryIdAndUserIdAndYearMonth(
            String factoryId, Long userId, String yearMonth);

    List<LeaveBalance> findByFactoryIdAndUserIdOrderByYearMonthDesc(
            String factoryId, Long userId);

    List<LeaveBalance> findByFactoryIdAndLeaveTypeAndYearMonth(
            String factoryId, LeaveType leaveType, String yearMonth);
}
