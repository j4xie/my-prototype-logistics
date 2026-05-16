package com.cretas.aims.entity.enums;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VoucherFlagTest {

    @Test
    void initialStateIsUncreated() {
        assertEquals(VoucherFlag.UNCREATED, VoucherFlag.initial());
    }

    @Test
    void uncreatedCanTransitionToPending() {
        assertTrue(VoucherFlag.UNCREATED.canTransitionTo(VoucherFlag.PENDING));
    }

    @Test
    void pendingCanTransitionToCreatedOrFailed() {
        assertTrue(VoucherFlag.PENDING.canTransitionTo(VoucherFlag.CREATED));
        assertTrue(VoucherFlag.PENDING.canTransitionTo(VoucherFlag.FAILED));
    }

    @Test
    void failedCanRetryToPending() {
        assertTrue(VoucherFlag.FAILED.canTransitionTo(VoucherFlag.PENDING));
    }

    @Test
    void createdIsTerminal() {
        // CREATED 不能自动回退 — 需 voidVoucher 走业务流程
        assertFalse(VoucherFlag.CREATED.canTransitionTo(VoucherFlag.UNCREATED));
        assertFalse(VoucherFlag.CREATED.canTransitionTo(VoucherFlag.PENDING));
        assertFalse(VoucherFlag.CREATED.canTransitionTo(VoucherFlag.FAILED));
    }

    @Test
    void uncreatedCannotJumpToCreated() {
        // 状态机不跳: UNCREATED 必须先 PENDING 才 CREATED
        assertFalse(VoucherFlag.UNCREATED.canTransitionTo(VoucherFlag.CREATED));
        assertFalse(VoucherFlag.UNCREATED.canTransitionTo(VoucherFlag.FAILED));
    }

    @Test
    void sameStateNotTransition() {
        // self-transition 不允许 (避免 no-op event)
        for (VoucherFlag flag : VoucherFlag.values()) {
            assertFalse(flag.canTransitionTo(flag), flag + " -> " + flag + " should be invalid");
        }
    }
}
