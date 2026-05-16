package com.cretas.aims.service.impl;

import com.cretas.aims.entity.common.BusinessLink;
import com.cretas.aims.repository.BusinessLinkRepository;
import com.cretas.aims.service.LinkArrayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 业务单跨域关联 service 实现 (Sprint 3 Track-F C-LINKARRAY-1).
 *
 * <p>幂等 link/unlink + 双向查询. 所有 query 走 factoryId 隔离.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LinkArrayServiceImpl implements LinkArrayService {

    private final BusinessLinkRepository linkRepository;

    @Override
    @Transactional
    public BusinessLink link(String factoryId,
                             String ownerType, String ownerId,
                             String linkType,
                             String targetType, String targetId,
                             String description, String userId) {
        validateNotBlank("factoryId", factoryId);
        validateNotBlank("ownerType", ownerType);
        validateNotBlank("ownerId", ownerId);
        validateNotBlank("linkType", linkType);
        validateNotBlank("targetType", targetType);
        validateNotBlank("targetId", targetId);

        Optional<BusinessLink> existing = linkRepository
                .findByOwnerTypeAndOwnerIdAndTargetTypeAndTargetId(
                        ownerType, ownerId, targetType, targetId);
        if (existing.isPresent()) {
            BusinessLink found = existing.get();
            if (!factoryId.equals(found.getFactoryId())) {
                throw new IllegalStateException(
                        "Existing link in different factory — owner=" + ownerType + ":" + ownerId
                                + " target=" + targetType + ":" + targetId
                                + " existingFactory=" + found.getFactoryId());
            }
            log.debug("BusinessLink already exists, returning idempotent — owner={}:{} target={}:{}",
                    ownerType, ownerId, targetType, targetId);
            return found;
        }

        BusinessLink link = new BusinessLink();
        link.setFactoryId(factoryId);
        link.setOwnerType(ownerType);
        link.setOwnerId(ownerId);
        link.setLinkType(linkType);
        link.setTargetType(targetType);
        link.setTargetId(targetId);
        link.setDescription(description);
        link.setLinkedBy(userId);
        link.setLinkedAt(LocalDateTime.now());

        BusinessLink saved = linkRepository.save(link);
        log.info("BusinessLink created — factory={} owner={}:{} linkType={} target={}:{}",
                factoryId, ownerType, ownerId, linkType, targetType, targetId);
        return saved;
    }

    @Override
    @Transactional
    public int unlink(String factoryId,
                      String ownerType, String ownerId,
                      String targetType, String targetId) {
        validateNotBlank("factoryId", factoryId);
        int rows = linkRepository.softDeleteLink(factoryId, ownerType, ownerId, targetType, targetId);
        log.info("BusinessLink unlinked — factory={} owner={}:{} target={}:{} rows={}",
                factoryId, ownerType, ownerId, targetType, targetId, rows);
        return rows;
    }

    @Override
    public List<BusinessLink> getOutboundLinks(String factoryId, String ownerType, String ownerId) {
        return linkRepository.findByFactoryIdAndOwnerTypeAndOwnerId(factoryId, ownerType, ownerId);
    }

    @Override
    public List<BusinessLink> getInboundLinks(String factoryId, String targetType, String targetId) {
        return linkRepository.findByFactoryIdAndTargetTypeAndTargetId(factoryId, targetType, targetId);
    }

    @Override
    public List<BusinessLink> getByType(String factoryId, String linkType, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 200);
        return linkRepository.findByFactoryIdAndLinkType(
                factoryId, linkType,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "linkedAt"))
        ).getContent();
    }

    private static void validateNotBlank(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
    }
}
