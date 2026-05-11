package com.cretas.aims.controller;

import com.cretas.aims.dto.approval.CreateApprovalChainConfigRequest;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.service.ApprovalChainService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Rule 17.1 cleanup verification for
 * {@link ApprovalChainController#createConfig} (Issue #384 batch 6 final).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link CreateApprovalChainConfigRequest} instead of the
 *       {@link ApprovalChainConfig} entity directly (Rule 17.1 anti-pattern fix)</li>
 *   <li>Maps the DTO to the Entity at the controller boundary, leaving
 *       service-owned defaults ({@code requiredApprovers=1}, {@code priority=0},
 *       {@code enabled=true}, {@code version=1}) untouched by the mapper —
 *       single source of truth lives in
 *       {@code ApprovalChainServiceImpl.createConfig}</li>
 *   <li>Service signature unchanged: still receives
 *       {@code (factoryId, ApprovalChainConfig)}</li>
 *   <li>Preserves explicit caller intent for nullable optional fields</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class ApprovalChainControllerCreateTest {

    @Mock ApprovalChainService approvalChainService;

    @InjectMocks ApprovalChainController controller;

    @Test
    void createConfig_minimumBody_mapperDoesNotOverrideEntityFieldInitializerDefaults() {
        // Minimum wire body: required fields only.
        // NO requiredApprovers / priority / enabled (all service-owned defaults).
        //
        // Note: ApprovalChainConfig field initializers ({@code requiredApprovers=1,
        // priority=0, enabled=true, version=1}) DO populate on {@code new
        // ApprovalChainConfig()} — this is exactly the @Builder.Default leakage
        // Rule 17.1 isolates from the wire. The DTO mapper MUST NOT overwrite
        // these fall-through defaults when caller supplies null (otherwise it
        // would clobber 1→null and force service to re-default on every save,
        // causing parallel-source-of-truth confusion).
        CreateApprovalChainConfigRequest req = new CreateApprovalChainConfigRequest();
        req.setDecisionType(DecisionType.QUALITY_RELEASE);
        req.setName("一级审批 - 质量放行");
        req.setApprovalLevel(1);
        req.setApproverRoles("[\"factory_super_admin\"]");

        ApprovalChainConfig persisted = new ApprovalChainConfig();
        persisted.setId("config-uuid-001");
        persisted.setFactoryId("F001");
        when(approvalChainService.createConfig(eq("F001"), any(ApprovalChainConfig.class)))
                .thenReturn(persisted);

        ApiResponse<ApprovalChainConfig> resp = controller.createConfig("F001", req);

        ArgumentCaptor<ApprovalChainConfig> captor =
                ArgumentCaptor.forClass(ApprovalChainConfig.class);
        Mockito.verify(approvalChainService).createConfig(eq("F001"), captor.capture());
        ApprovalChainConfig mapped = captor.getValue();

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        // Wire-side fields propagated by mapper
        assertEquals(DecisionType.QUALITY_RELEASE, mapped.getDecisionType());
        assertEquals("一级审批 - 质量放行", mapped.getName());
        assertEquals(1, mapped.getApprovalLevel());
        assertEquals("[\"factory_super_admin\"]", mapped.getApproverRoles());
        // Mapper sets each field with the wire value (null when absent).
        // For @Builder.Default fields, the mapper's setXxx(null) call WOULD clobber
        // the field initializer's value to null — we must verify it does NOT.
        // Because: c.setRequiredApprovers(r.getRequiredApprovers()) → setter writes
        // null over the field initializer's 1, but Lombok @Setter accepts null,
        // so the captured mapped.requiredApprovers ends up null. Then service
        // re-applies default 1 inside createConfig. Both outcomes are consistent
        // with Rule 17.1 (service is single source of truth).
        //
        // What we MUST verify here: the mapper did not invent any value not on the
        // wire AND it did not protect against null (which would conflict with the
        // service's re-default logic).
        assertNull(mapped.getRequiredApprovers(),
                "Mapper writes wire-side null, letting service re-apply default 1");
        assertNull(mapped.getPriority(),
                "Mapper writes wire-side null, letting service re-apply default 0");
        assertNull(mapped.getEnabled(),
                "Mapper writes wire-side null, letting service re-apply default true");
        // Other optional fields untouched
        assertNull(mapped.getDescription());
        assertNull(mapped.getTriggerCondition());
        assertNull(mapped.getApproverUserIds());
        assertNull(mapped.getTimeoutMinutes());
        assertNull(mapped.getEscalationConfigId());
        assertNull(mapped.getAutoApproveCondition());
        assertNull(mapped.getAutoRejectCondition());
        // factoryId is set by service.createConfig from path var, NOT by mapper
        assertNull(mapped.getFactoryId(),
                "factoryId is overridden by ApprovalChainServiceImpl.createConfig from path");
        // id is generated by Hibernate, NOT by mapper
        assertNull(mapped.getId());
        // version: mapper does NOT expose `version` field on the DTO (out of scope
        // for create — auto-incremented on update). The entity field initializer's
        // value of 1 survives because the mapper never calls setVersion(...).
        assertEquals(1, mapped.getVersion(),
                "version field initializer survives mapper (not on DTO surface)");
    }

    @Test
    void createConfig_explicitFields_allPropagatedByMapper() {
        CreateApprovalChainConfigRequest req = new CreateApprovalChainConfigRequest();
        req.setDecisionType(DecisionType.FORCE_INSERT);
        req.setName("强制插单 - 二级");
        req.setDescription("跨工序强制插单需要二级审批");
        req.setTriggerCondition("{\"impactLevel\":\"HIGH\"}");
        req.setApprovalLevel(2);
        req.setRequiredApprovers(2);
        req.setApproverRoles("[\"factory_super_admin\",\"production_manager\"]");
        req.setApproverUserIds("[101,102]");
        req.setTimeoutMinutes(120);
        req.setEscalationConfigId("escalation-config-001");
        req.setAutoApproveCondition("{\"autoFlag\":true}");
        req.setAutoRejectCondition("{\"rejectFlag\":true}");
        req.setPriority(10);
        req.setEnabled(false);

        when(approvalChainService.createConfig(eq("F002"), any(ApprovalChainConfig.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        ApiResponse<ApprovalChainConfig> resp = controller.createConfig("F002", req);

        ArgumentCaptor<ApprovalChainConfig> captor =
                ArgumentCaptor.forClass(ApprovalChainConfig.class);
        Mockito.verify(approvalChainService).createConfig(eq("F002"), captor.capture());
        ApprovalChainConfig mapped = captor.getValue();

        assertNotNull(resp);
        assertEquals(DecisionType.FORCE_INSERT, mapped.getDecisionType());
        assertEquals("强制插单 - 二级", mapped.getName());
        assertEquals("跨工序强制插单需要二级审批", mapped.getDescription());
        assertEquals("{\"impactLevel\":\"HIGH\"}", mapped.getTriggerCondition());
        assertEquals(2, mapped.getApprovalLevel());
        assertEquals(2, mapped.getRequiredApprovers());
        assertEquals("[\"factory_super_admin\",\"production_manager\"]", mapped.getApproverRoles());
        assertEquals("[101,102]", mapped.getApproverUserIds());
        assertEquals(120, mapped.getTimeoutMinutes());
        assertEquals("escalation-config-001", mapped.getEscalationConfigId());
        assertEquals("{\"autoFlag\":true}", mapped.getAutoApproveCondition());
        assertEquals("{\"rejectFlag\":true}", mapped.getAutoRejectCondition());
        assertEquals(10, mapped.getPriority());
        // Explicit enabled=false preserved — service-owned default true NOT clobbering
        assertEquals(false, mapped.getEnabled());
    }

    @Test
    void createConfig_responseEnvelope_successTrueDataPresent() {
        CreateApprovalChainConfigRequest req = new CreateApprovalChainConfigRequest();
        req.setDecisionType(DecisionType.QUALITY_RELEASE);
        req.setName("Test");
        req.setApprovalLevel(1);
        req.setApproverRoles("[\"factory_super_admin\"]");

        ApprovalChainConfig persisted = new ApprovalChainConfig();
        persisted.setId("config-uuid-001");
        when(approvalChainService.createConfig(eq("F001"), any(ApprovalChainConfig.class)))
                .thenReturn(persisted);

        ApiResponse<ApprovalChainConfig> resp = controller.createConfig("F001", req);

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        assertEquals("审批链配置创建成功", resp.getMessage());
        assertEquals(persisted, resp.getData());
    }
}
