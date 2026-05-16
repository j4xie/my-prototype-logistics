package com.cretas.aims.service.impl;

import com.cretas.aims.entity.common.BusinessLink;
import com.cretas.aims.repository.BusinessLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * LinkArrayService 单测 (Sprint 3 Track-F C-LINKARRAY-1 Day 2).
 *
 * <p>覆盖 6 acceptance cases per marching order DoD §Task 5:
 *   1. Create + Query outbound/inbound
 *   2. Multi-link 1 owner → 3 targets
 *   3. getByType filter
 *   4. Unlink soft-delete
 *   5. factoryId isolation A vs B
 *   6. AIChat tool path — covered by service-level link/query, full AIChat
 *      execution path mocked at tool-layer integration test (separate).
 *   7. Bonus: idempotent re-link returns existing row (no duplicate).
 */
@DisplayName("LinkArrayService 单元测试")
@ExtendWith(MockitoExtension.class)
class LinkArrayServiceImplTest {

    @Mock
    private BusinessLinkRepository linkRepository;

    private LinkArrayServiceImpl service;

    private static final String F_A = "F001";
    private static final String F_B = "F002";
    private static final String SO_ID = "so-uuid-123";
    private static final String RO_ID = "ro-uuid-456";

    @BeforeEach
    void setUp() {
        service = new LinkArrayServiceImpl(linkRepository);
    }

    @Test
    @DisplayName("UT-LAS-001: link() creates new BusinessLink with all fields set")
    void link_createsNewLink_whenNotExisting() {
        when(linkRepository.findByOwnerTypeAndOwnerIdAndTargetTypeAndTargetId(
                "RETURN_ORDER", RO_ID, "SALES_ORDER", SO_ID))
                .thenReturn(Optional.empty());
        when(linkRepository.save(any(BusinessLink.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        BusinessLink result = service.link(F_A, "RETURN_ORDER", RO_ID, "sale",
                "SALES_ORDER", SO_ID, "退货源单", "22");

        assertNotNull(result);
        assertEquals(F_A, result.getFactoryId());
        assertEquals("RETURN_ORDER", result.getOwnerType());
        assertEquals(RO_ID, result.getOwnerId());
        assertEquals("sale", result.getLinkType());
        assertEquals("SALES_ORDER", result.getTargetType());
        assertEquals(SO_ID, result.getTargetId());
        assertEquals("退货源单", result.getDescription());
        assertEquals("22", result.getLinkedBy());
        assertNotNull(result.getLinkedAt());

        ArgumentCaptor<BusinessLink> captor = ArgumentCaptor.forClass(BusinessLink.class);
        verify(linkRepository).save(captor.capture());
        assertEquals("sale", captor.getValue().getLinkType());
    }

    @Test
    @DisplayName("UT-LAS-002: getOutboundLinks + getInboundLinks return factory-isolated results")
    void getLinks_outboundAndInbound() {
        BusinessLink l = newLink(F_A, "RETURN_ORDER", RO_ID, "sale", "SALES_ORDER", SO_ID);
        when(linkRepository.findByFactoryIdAndOwnerTypeAndOwnerId(F_A, "RETURN_ORDER", RO_ID))
                .thenReturn(List.of(l));
        when(linkRepository.findByFactoryIdAndTargetTypeAndTargetId(F_A, "SALES_ORDER", SO_ID))
                .thenReturn(List.of(l));

        List<BusinessLink> outbound = service.getOutboundLinks(F_A, "RETURN_ORDER", RO_ID);
        List<BusinessLink> inbound = service.getInboundLinks(F_A, "SALES_ORDER", SO_ID);

        assertEquals(1, outbound.size());
        assertEquals(1, inbound.size());
        assertEquals(SO_ID, outbound.get(0).getTargetId());
        assertEquals(RO_ID, inbound.get(0).getOwnerId());
    }

    @Test
    @DisplayName("UT-LAS-003: Multi-link — 1 owner SO splits into 3 children, each links back")
    void multiLink_oneSourceToThreeChildren() {
        // Source SO had 3 child SOs linked back to it (split). Reverse query returns 3.
        BusinessLink l1 = newLink(F_A, "SALES_ORDER", "child-1", "free", "SALES_ORDER", SO_ID);
        BusinessLink l2 = newLink(F_A, "SALES_ORDER", "child-2", "free", "SALES_ORDER", SO_ID);
        BusinessLink l3 = newLink(F_A, "SALES_ORDER", "child-3", "free", "SALES_ORDER", SO_ID);
        when(linkRepository.findByFactoryIdAndTargetTypeAndTargetId(F_A, "SALES_ORDER", SO_ID))
                .thenReturn(List.of(l1, l2, l3));

        List<BusinessLink> inbound = service.getInboundLinks(F_A, "SALES_ORDER", SO_ID);
        assertEquals(3, inbound.size());
        assertTrue(inbound.stream().allMatch(b -> "free".equals(b.getLinkType())));
    }

    @Test
    @DisplayName("UT-LAS-004: getByType — factory-level filter, paged")
    void getByType_factoryLevelPaged() {
        BusinessLink l = newLink(F_A, "PRODUCTION_PLAN", "pp-1", "sale", "SALES_ORDER", SO_ID);
        Page<BusinessLink> page = new PageImpl<>(List.of(l));
        when(linkRepository.findByFactoryIdAndLinkType(eq(F_A), eq("sale"), any(Pageable.class)))
                .thenReturn(page);

        List<BusinessLink> result = service.getByType(F_A, "sale", 0, 20);
        assertEquals(1, result.size());
        assertEquals("sale", result.get(0).getLinkType());
    }

    @Test
    @DisplayName("UT-LAS-005: unlink — soft delete with factoryId isolation")
    void unlink_softDeleteFactoryIsolated() {
        when(linkRepository.softDeleteLink(F_A, "RETURN_ORDER", RO_ID, "SALES_ORDER", SO_ID))
                .thenReturn(1);

        int rows = service.unlink(F_A, "RETURN_ORDER", RO_ID, "SALES_ORDER", SO_ID);
        assertEquals(1, rows);
        verify(linkRepository).softDeleteLink(F_A, "RETURN_ORDER", RO_ID, "SALES_ORDER", SO_ID);
    }

    @Test
    @DisplayName("UT-LAS-006: factoryId isolation — link in factory B not visible to A")
    void factoryIsolation_aCannotSeeBLinks() {
        // Repository's findByFactoryId* method is the isolation gate.
        when(linkRepository.findByFactoryIdAndOwnerTypeAndOwnerId(F_A, "RETURN_ORDER", RO_ID))
                .thenReturn(List.of()); // factory A has no link
        when(linkRepository.findByFactoryIdAndOwnerTypeAndOwnerId(F_B, "RETURN_ORDER", RO_ID))
                .thenReturn(List.of(newLink(F_B, "RETURN_ORDER", RO_ID, "sale", "SALES_ORDER", SO_ID)));

        assertEquals(0, service.getOutboundLinks(F_A, "RETURN_ORDER", RO_ID).size());
        assertEquals(1, service.getOutboundLinks(F_B, "RETURN_ORDER", RO_ID).size());
    }

    @Test
    @DisplayName("UT-LAS-007: idempotent re-link — existing row returned, no second save")
    void link_idempotent_whenAlreadyExists() {
        BusinessLink existing = newLink(F_A, "RETURN_ORDER", RO_ID, "sale", "SALES_ORDER", SO_ID);
        when(linkRepository.findByOwnerTypeAndOwnerIdAndTargetTypeAndTargetId(
                "RETURN_ORDER", RO_ID, "SALES_ORDER", SO_ID))
                .thenReturn(Optional.of(existing));

        BusinessLink result = service.link(F_A, "RETURN_ORDER", RO_ID, "sale",
                "SALES_ORDER", SO_ID, "再试一次", "33");

        assertSame(existing, result);
        verify(linkRepository, never()).save(any(BusinessLink.class));
    }

    @Test
    @DisplayName("UT-LAS-008: cross-factory link attempt blocked — IllegalStateException")
    void link_blockedAcrossFactory() {
        BusinessLink existing = newLink(F_B, "RETURN_ORDER", RO_ID, "sale", "SALES_ORDER", SO_ID);
        when(linkRepository.findByOwnerTypeAndOwnerIdAndTargetTypeAndTargetId(
                "RETURN_ORDER", RO_ID, "SALES_ORDER", SO_ID))
                .thenReturn(Optional.of(existing));

        assertThrows(IllegalStateException.class,
                () -> service.link(F_A, "RETURN_ORDER", RO_ID, "sale",
                        "SALES_ORDER", SO_ID, "factory A tries", "22"));
    }

    @Test
    @DisplayName("UT-LAS-009: blank arg rejected — IllegalArgumentException")
    void link_blankArgsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.link("", "RETURN_ORDER", RO_ID, "sale",
                        "SALES_ORDER", SO_ID, "blank factory", "22"));
        assertThrows(IllegalArgumentException.class,
                () -> service.link(F_A, "RETURN_ORDER", RO_ID, "sale",
                        "SALES_ORDER", null, "blank target", "22"));
    }

    private static BusinessLink newLink(String factoryId, String ownerType, String ownerId,
                                         String linkType, String targetType, String targetId) {
        BusinessLink b = new BusinessLink();
        b.setFactoryId(factoryId);
        b.setOwnerType(ownerType);
        b.setOwnerId(ownerId);
        b.setLinkType(linkType);
        b.setTargetType(targetType);
        b.setTargetId(targetId);
        return b;
    }
}
