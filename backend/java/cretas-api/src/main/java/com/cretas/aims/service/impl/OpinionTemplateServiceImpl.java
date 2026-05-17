package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.OpinionTemplate;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.OpinionTemplateRepository;
import com.cretas.aims.service.OpinionTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;

/**
 * {@link OpinionTemplateService} 实现.
 *
 * @since 2026-05-16
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OpinionTemplateServiceImpl implements OpinionTemplateService {

    private final OpinionTemplateRepository repository;

    @Override
    public List<OpinionTemplate> listAvailable(String factoryId, String decisionType) {
        if (!StringUtils.hasText(decisionType)) {
            throw new BusinessException(400, "decisionType 不能为空")
                    .withHintTarget("decisionType");
        }
        return repository.findAvailableForFactory(decisionType, factoryId);
    }

    @Override
    public List<OpinionTemplate> listByFactory(String factoryId) {
        requireFactoryId(factoryId);
        return repository.findByFactoryIdAndIsActiveTrueOrderBySortOrderAsc(factoryId);
    }

    @Override
    public List<OpinionTemplate> listSystemPresets() {
        return repository.findByFactoryIdIsNullAndIsActiveTrueOrderBySortOrderAsc();
    }

    @Override
    public Optional<OpinionTemplate> getById(String factoryId, String id) {
        return repository.findById(id)
                .filter(t -> belongsToFactoryOrSystem(t, factoryId));
    }

    @Override
    @Transactional
    public OpinionTemplate create(String factoryId, OpinionTemplate template) {
        requireFactoryId(factoryId);
        rejectSystemPresetWrite(template.getFactoryId(), "create");

        template.setFactoryId(factoryId);
        if (!StringUtils.hasText(template.getDecisionType())) {
            throw new BusinessException(400, "decisionType 不能为空")
                    .withHintTarget("decisionType");
        }
        if (!StringUtils.hasText(template.getContent())) {
            throw new BusinessException(400, "content 不能为空")
                    .withHintTarget("content");
        }
        if (template.getContent().length() > 500) {
            throw new BusinessException(400, "content 长度不能超过 500 字")
                    .withHintTarget("content");
        }
        if (template.getSortOrder() == null) template.setSortOrder(0);
        if (template.getIsActive() == null) template.setIsActive(true);

        OpinionTemplate saved = repository.save(template);
        log.info("OpinionTemplate created - id={}, factoryId={}, decisionType={}",
                saved.getId(), factoryId, saved.getDecisionType());
        return saved;
    }

    @Override
    @Transactional
    public OpinionTemplate update(String factoryId, String id, OpinionTemplate partial) {
        requireFactoryId(factoryId);

        OpinionTemplate existing = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("意见模板", "id", id));

        if (existing.getFactoryId() == null) {
            throw new BusinessException(403, "系统预设模板不可修改")
                    .withHint("请新建工厂自定义模板");
        }
        if (!existing.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权修改其他工厂的模板")
                    .withHint("请切换到模板所属工厂后再操作");
        }

        if (partial.getContent() != null) {
            if (partial.getContent().length() > 500) {
                throw new BusinessException(400, "content 长度不能超过 500 字")
                        .withHintTarget("content");
            }
            existing.setContent(partial.getContent());
        }
        if (partial.getDecisionType() != null) existing.setDecisionType(partial.getDecisionType());
        if (partial.getSortOrder() != null) existing.setSortOrder(partial.getSortOrder());
        if (partial.getIsActive() != null) existing.setIsActive(partial.getIsActive());

        OpinionTemplate saved = repository.save(existing);
        log.info("OpinionTemplate updated - id={}, factoryId={}", saved.getId(), factoryId);
        return saved;
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        requireFactoryId(factoryId);

        OpinionTemplate existing = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("意见模板", "id", id));

        if (existing.getFactoryId() == null) {
            throw new BusinessException(403, "系统预设模板不可删除")
                    .withHint("如需隐藏, 可创建同 decisionType 的工厂自定义模板覆盖");
        }
        if (!existing.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权删除其他工厂的模板")
                    .withHint("请切换到模板所属工厂后再操作");
        }

        // 软删除 — BaseEntity @SQLDelete 会把 DELETE 转为 UPDATE deleted_at = NOW()
        repository.delete(existing);
        log.info("OpinionTemplate deleted - id={}, factoryId={}", id, factoryId);
    }

    private void requireFactoryId(String factoryId) {
        if (!StringUtils.hasText(factoryId)) {
            throw new BusinessException(400, "factoryId 不能为空");
        }
    }

    /** 防御性: 任何 write 路径若试图操作系统预设 (factoryId NULL/empty), 一律 reject. */
    private void rejectSystemPresetWrite(String requestedFactoryId, String op) {
        if (requestedFactoryId != null && !StringUtils.hasText(requestedFactoryId)) {
            throw new BusinessException(400, op + " 失败: factoryId 字段不能为空字符串")
                    .withHintTarget("factoryId");
        }
    }

    private boolean belongsToFactoryOrSystem(OpinionTemplate t, String factoryId) {
        return t.getFactoryId() == null || t.getFactoryId().equals(factoryId);
    }
}
