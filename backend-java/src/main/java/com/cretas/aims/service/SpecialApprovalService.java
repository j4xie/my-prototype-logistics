package com.cretas.aims.service;

import com.cretas.aims.dto.quality.ApprovalDecisionRequest;
import com.cretas.aims.dto.quality.SpecialApprovalDTO;
import com.cretas.aims.dto.quality.SpecialApprovalRequest;

import java.util.List;

/**
 * 特批放行审批服务接口
 *
 * 管理质检特批放行的申请、审批流程
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
public interface SpecialApprovalService {

    /**
     * 提交特批放行申请
     *
     * @param factoryId 工厂ID
     * @param inspectionId 质检记录ID
     * @param request 特批申请请求
     * @param requesterId 申请人ID
     * @return 特批申请信息
     */
    SpecialApprovalDTO submitSpecialApproval(
            String factoryId,
            String inspectionId,
            SpecialApprovalRequest request,
            Long requesterId
    );

    /**
     * 获取待审批列表
     *
     * @param factoryId 工厂ID
     * @return 待审批列表
     */
    List<SpecialApprovalDTO> getPendingApprovals(String factoryId);

    /**
     * 获取特批申请详情
     *
     * @param factoryId 工厂ID
     * @param approvalId 审批ID
     * @return 特批申请详情
     */
    SpecialApprovalDTO getApprovalById(String factoryId, String approvalId);

    /**
     * 处理审批决策
     *
     * @param factoryId 工厂ID
     * @param approvalId 审批ID
     * @param decision 审批决策
     * @param approverId 审批人ID
     * @return 更新后的审批信息
     */
    SpecialApprovalDTO processDecision(
            String factoryId,
            String approvalId,
            ApprovalDecisionRequest decision,
            Long approverId
    );

    /**
     * 获取我的申请记录
     *
     * @param factoryId 工厂ID
     * @param requesterId 申请人ID
     * @return 申请记录列表
     */
    List<SpecialApprovalDTO> getMyRequests(String factoryId, Long requesterId);

    /**
     * 获取我的审批记录
     *
     * @param factoryId 工厂ID
     * @param approverId 审批人ID
     * @return 审批记录列表
     */
    List<SpecialApprovalDTO> getMyApprovals(String factoryId, Long approverId);
}
