package com.cretas.aims.controller;

import com.cretas.aims.dto.approval.UpdateApprovalChainConfigRequest;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.ApprovalChainConfig;
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
 * {@link ApprovalChainController#updateConfig} (Issue #384 batch 6 final).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link UpdateApprovalChainConfigRequest} instead of the
 *       {@link ApprovalChainConfig} entity directly (Rule 17.1 anti-pattern fix)</li>
 *   <li>Maps only mutable fields to the partial entity; service then iterates
 *       each with an {@code if (... != null)} guard, so leaving a wire field
 *       absent preserves the existing DB value</li>
 *   <li>Service signature unchanged: still receives
 *       {@code (factoryId, configId, ApprovalChainConfig)}</li>
 *   <li>Mapper does NOT touch {@code id}, {@code factoryId}, {@code decisionType},
 *       {@code enabled} (managed via toggle), {@code version} (auto-incremented),
 *       audit timestamps</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class ApprovalChainControllerUpdateTest {

    @Mock ApprovalChainService approvalChainService;

    @InjectMocks ApprovalChainController controller;

    @Test
    void updateConfig_minimumBody_onlyWireFieldsPropagated_immutablesAbsent() {
        // Minimum wire body: ALL fields null (caller PUT empty body to no-op).
        UpdateApprovalChainConfigRequest req = new UpdateApprovalChainConfigRequest();

        ApprovalChainConfig persisted = new ApprovalChainConfig();
        persisted.setId("config-001");
        when(approvalChainService.updateConfig(
                eq("F001"), eq("config-001"), any(ApprovalChainConfig.class)))
                .thenReturn(persisted);

        ApiResponse<ApprovalChainConfig> resp =
                controller.updateConfig("F001", "config-001", req);

        ArgumentCaptor<ApprovalChainConfig> captor =
                ArgumentCaptor.forClass(ApprovalChainConfig.class);
        Mockito.verify(approvalChainService).updateConfig(
                eq("F001"), eq("config-001"), captor.capture());
        ApprovalChainConfig partial = captor.getValue();

        assertNotNull(resp);
        // ALL wire-side mutable fields null in partial (mapper writes wire null,
        // and service iterates with `if (... != null)` guard so the existing DB
        // value is preserved).
        assertNull(partial.getName());
        assertNull(partial.getDescription());
        assertNull(partial.getTriggerCondition());
        assertNull(partial.getApprovalLevel());
        assertNull(partial.getRequiredApprovers());
        assertNull(partial.getApproverRoles());
        assertNull(partial.getApproverUserIds());
        assertNull(partial.getTimeoutMinutes());
        assertNull(partial.getEscalationConfigId());
        assertNull(partial.getAutoApproveCondition());
        assertNull(partial.getAutoRejectCondition());
        assertNull(partial.getPriority());
        // Immutables / out-of-scope: mapper never calls these setters.
        // For non-initializer fields (id, factoryId, decisionType) → null.
        assertNull(partial.getId());
        assertNull(partial.getFactoryId());
        assertNull(partial.getDecisionType());
        // For field-initializer fields (enabled=true, version=1), since the mapper
        // never calls these setters, the entity field initializers survive.
        // Service's updateConfig path also never calls setEnabled / setVersion
        // (enabled via /toggle endpoint; version auto-incremented inside update),
        // so the partial entity carries field-initializer defaults harmlessly.
        assertEquals(true, partial.getEnabled(),
                "Mapper does NOT expose enabled (managed via /toggle); field initializer survives");
        assertEquals(1, partial.getVersion(),
                "Mapper does NOT expose version (auto-incremented); field initializer survives");
    }

    @Test
    void updateConfig_explicitFields_allPropagatedByMapper() {
        UpdateApprovalChainConfigRequest req = new UpdateApprovalChainConfigRequest();
        req.setName("更新后名称");
        req.setDescription("更新后描述");
        req.setTriggerCondition("{\"newCondition\":true}");
        req.setApprovalLevel(2);
        req.setRequiredApprovers(3);
        req.setApproverRoles("[\"factory_super_admin\",\"qc_lead\"]");
        req.setApproverUserIds("[1,2,3]");
        req.setTimeoutMinutes(60);
        req.setEscalationConfigId("escalation-002");
        req.setAutoApproveCondition("{\"autoOk\":true}");
        req.setAutoRejectCondition("{\"autoNo\":true}");
        req.setPriority(99);

        when(approvalChainService.updateConfig(
                eq("F001"), eq("config-001"), any(ApprovalChainConfig.class)))
                .thenAnswer(inv -> inv.getArgument(2));

        ApiResponse<ApprovalChainConfig> resp =
                controller.updateConfig("F001", "config-001", req);

        ArgumentCaptor<ApprovalChainConfig> captor =
                ArgumentCaptor.forClass(ApprovalChainConfig.class);
        Mockito.verify(approvalChainService).updateConfig(
                eq("F001"), eq("config-001"), captor.capture());
        ApprovalChainConfig partial = captor.getValue();

        assertNotNull(resp);
        assertEquals("更新后名称", partial.getName());
        assertEquals("更新后描述", partial.getDescription());
        assertEquals("{\"newCondition\":true}", partial.getTriggerCondition());
        assertEquals(2, partial.getApprovalLevel());
        assertEquals(3, partial.getRequiredApprovers());
        assertEquals("[\"factory_super_admin\",\"qc_lead\"]", partial.getApproverRoles());
        assertEquals("[1,2,3]", partial.getApproverUserIds());
        assertEquals(60, partial.getTimeoutMinutes());
        assertEquals("escalation-002", partial.getEscalationConfigId());
        assertEquals("{\"autoOk\":true}", partial.getAutoApproveCondition());
        assertEquals("{\"autoNo\":true}", partial.getAutoRejectCondition());
        assertEquals(99, partial.getPriority());
        // Immutables not from DTO
        assertNull(partial.getId());
        assertNull(partial.getFactoryId());
        assertNull(partial.getDecisionType());
        // Field-initializer defaults survive (mapper never calls these setters)
        assertEquals(true, partial.getEnabled());
        assertEquals(1, partial.getVersion());
    }

    @Test
    void updateConfig_responseEnvelope_successTrueDataPresent() {
        UpdateApprovalChainConfigRequest req = new UpdateApprovalChainConfigRequest();
        req.setName("Updated");

        ApprovalChainConfig persisted = new ApprovalChainConfig();
        persisted.setId("config-001");
        persisted.setName("Updated");
        when(approvalChainService.updateConfig(
                eq("F001"), eq("config-001"), any(ApprovalChainConfig.class)))
                .thenReturn(persisted);

        ApiResponse<ApprovalChainConfig> resp =
                controller.updateConfig("F001", "config-001", req);

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        assertEquals("审批链配置更新成功", resp.getMessage());
        assertEquals(persisted, resp.getData());
    }
}
