package com.cretas.aims.service.impl;

import com.cretas.aims.entity.ProductionLineSupervisor;
import com.cretas.aims.repository.ProductionLineSupervisorRepository;
import com.cretas.aims.service.ProductionLineSupervisorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 产线负责人服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductionLineSupervisorServiceImpl implements ProductionLineSupervisorService {

    private final ProductionLineSupervisorRepository supervisorRepository;

    @Override
    public List<ProductionLineSupervisor> getSupervisorsByLine(String factoryId, String lineId) {
        log.debug("获取产线负责人列表, factoryId={}, lineId={}", factoryId, lineId);
        return supervisorRepository.findSupervisorsByLine(factoryId, lineId);
    }

    @Override
    public ProductionLineSupervisor getPrimarySupervisor(String lineId) {
        log.debug("获取产线主要负责人, lineId={}", lineId);
        return supervisorRepository.findByProductionLineIdAndIsPrimaryTrue(lineId).orElse(null);
    }

    @Override
    public List<String> getLineIdsBySupervisor(String factoryId, Long userId) {
        log.debug("获取车间主任负责的产线, factoryId={}, userId={}", factoryId, userId);
        return supervisorRepository.findLineIdsBySupervisor(factoryId, userId);
    }

    @Override
    @Transactional
    public ProductionLineSupervisor assignSupervisor(String factoryId, String lineId, Long userId, boolean isPrimary) {
        log.info("分配产线负责人, factoryId={}, lineId={}, userId={}, isPrimary={}",
                factoryId, lineId, userId, isPrimary);

        // 检查是否已分配
        if (supervisorRepository.existsByProductionLineIdAndSupervisorUserId(lineId, userId)) {
            log.warn("产线负责人已存在, lineId={}, userId={}", lineId, userId);
            throw new RuntimeException("该用户已经是此产线的负责人");
        }

        // 如果设置为主要负责人，需要取消原有主要负责人
        if (isPrimary) {
            supervisorRepository.findByProductionLineIdAndIsPrimaryTrue(lineId)
                    .ifPresent(existing -> {
                        log.info("取消原主要负责人, lineId={}, oldUserId={}", lineId, existing.getSupervisorUserId());
                        existing.setIsPrimary(false);
                        supervisorRepository.save(existing);
                    });
        }

        ProductionLineSupervisor supervisor = new ProductionLineSupervisor();
        supervisor.setFactoryId(factoryId);
        supervisor.setProductionLineId(lineId);
        supervisor.setSupervisorUserId(userId);
        supervisor.setIsPrimary(isPrimary);
        supervisor.setAssignedAt(LocalDateTime.now());

        return supervisorRepository.save(supervisor);
    }

    @Override
    @Transactional
    public void removeSupervisor(String lineId, Long userId) {
        log.info("移除产线负责人, lineId={}, userId={}", lineId, userId);

        if (!supervisorRepository.existsByProductionLineIdAndSupervisorUserId(lineId, userId)) {
            log.warn("产线负责人不存在, lineId={}, userId={}", lineId, userId);
            throw new RuntimeException("该用户不是此产线的负责人");
        }

        supervisorRepository.deleteByProductionLineIdAndSupervisorUserId(lineId, userId);
    }

    @Override
    public boolean isAssigned(String lineId, Long userId) {
        return supervisorRepository.existsByProductionLineIdAndSupervisorUserId(lineId, userId);
    }
}
