package com.cretas.aims.service;

import com.cretas.aims.entity.common.BusinessLink;

import java.util.List;

/**
 * 业务单跨域关联 service (Sprint 3 Track-F C-LINKARRAY-1).
 *
 * <p>对齐宏见 ERP 的 linkListArray 8 类 link_type:
 * sale / sample / request / produce / outsource / stock / project / free.
 *
 * <p>所有方法以 factoryId 隔离 — 工厂 A 看不到工厂 B 的 link.
 */
public interface LinkArrayService {

    /**
     * 建立关联.
     *
     * @param factoryId 工厂 ID (隔离边界)
     * @param ownerType 持有 link 的业务单类型 (e.g. "RETURN_ORDER")
     * @param ownerId 持有 link 的业务单 ID
     * @param linkType 关联维度 (sale / sample / ...)
     * @param targetType 关联对象类型 (e.g. "SALES_ORDER")
     * @param targetId 关联对象 ID
     * @param description 备注 (可选)
     * @param userId 创建 link 的 userId (可选, 用 String 兼容 long)
     * @return 已建立 / 已存在的 BusinessLink (幂等)
     */
    BusinessLink link(String factoryId,
                      String ownerType, String ownerId,
                      String linkType,
                      String targetType, String targetId,
                      String description, String userId);

    /**
     * 解除关联 (软删除).
     *
     * @return 删除条数 (0 / 1)
     */
    int unlink(String factoryId,
               String ownerType, String ownerId,
               String targetType, String targetId);

    /** 我 link 了谁 (outbound, factoryId 隔离). */
    List<BusinessLink> getOutboundLinks(String factoryId, String ownerType, String ownerId);

    /** 谁 link 了我 (inbound, factoryId 隔离). */
    List<BusinessLink> getInboundLinks(String factoryId, String targetType, String targetId);

    /** 按 linkType 分页 (e.g. 该工厂所有 "sale" 类型 link). */
    List<BusinessLink> getByType(String factoryId, String linkType, int page, int size);
}
