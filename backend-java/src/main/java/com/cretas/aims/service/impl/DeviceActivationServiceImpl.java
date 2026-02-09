package com.cretas.aims.service.impl;

import com.cretas.aims.dto.DeviceActivationDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.DeviceActivation;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.DeviceActivationRepository;
import com.cretas.aims.service.DeviceActivationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
/**
 * 设备激活服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class DeviceActivationServiceImpl implements DeviceActivationService {
    private static final Logger log = LoggerFactory.getLogger(DeviceActivationServiceImpl.class);

    private final DeviceActivationRepository activationRepository;
    @Override
    @Transactional
    public List<DeviceActivationDTO> generateActivationCodes(String factoryId,
                                                            DeviceActivationDTO.GenerateRequest request) {
        log.info("生成激活码: factoryId={}, quantity={}", factoryId, request.getQuantity());
        List<DeviceActivationDTO> generatedCodes = new ArrayList<>();
        int quantity = request.getQuantity() != null ? request.getQuantity() : 1;
        for (int i = 0; i < quantity; i++) {
            DeviceActivation activation = new DeviceActivation();
            activation.setFactoryId(request.getFactoryId() != null ? request.getFactoryId() : factoryId);
            activation.setActivationCode(generateUniqueCode());
            activation.setStatus("PENDING");
            activation.setMaxDevices(request.getMaxDevices() != null ? request.getMaxDevices() : 1);
            activation.setAllowMultipleDevices(request.getAllowMultipleDevices() != null ?
                request.getAllowMultipleDevices() : false);
            activation.setNotes(request.getNotes());
            if (request.getValidDays() != null && request.getValidDays() > 0) {
                activation.setExpiresAt(LocalDateTime.now().plusDays(request.getValidDays()));
            }
            activation = activationRepository.save(activation);
            generatedCodes.add(convertToDTO(activation));
        }
        log.info("成功生成{}个激活码", generatedCodes.size());
        return generatedCodes;
    }
    @Override
    @Transactional(readOnly = true)
    public DeviceActivationDTO validateActivationCode(String activationCode) {
        log.debug("验证激活码: {}", activationCode);
        DeviceActivation activation = activationRepository.findByActivationCode(activationCode)
                .orElseThrow(() -> new BusinessException("激活码不存在"));
        if (!activation.isValid()) {
            throw new BusinessException("激活码无效或已过期");
        }
        return convertToDTO(activation);
    }
    @Override
    @Transactional
    public DeviceActivationDTO activateDevice(DeviceActivationDTO.ActivateRequest request) {
        log.info("激活设备: activationCode={}, deviceId={}",
                request.getActivationCode(), request.getDeviceId());
        DeviceActivation activation = activationRepository
                .findByActivationCode(request.getActivationCode())
                .orElseThrow(() -> new BusinessException("激活码不存在"));
        // 检查设备是否已被其他激活码激活
        Optional<DeviceActivation> existingActivation = activationRepository
                .findByFactoryIdAndDeviceId(activation.getFactoryId(), request.getDeviceId());
        if (existingActivation.isPresent() &&
            !existingActivation.get().getId().equals(activation.getId())) {
            throw new BusinessException("设备已被其他激活码激活");
        }
        // 更新激活信息
        activation.setDeviceId(request.getDeviceId());
        activation.setDeviceName(request.getDeviceName());
        activation.setDeviceType(request.getDeviceType());
        activation.setDeviceModel(request.getDeviceModel());
        activation.setOsType(request.getOsType());
        activation.setOsVersion(request.getOsVersion());
        activation.setAppVersion(request.getAppVersion());
        activation.setIpAddress(request.getIpAddress());
        activation.setMacAddress(request.getMacAddress());
        activation.activate(request.getDeviceId(), null); // TODO: 传入实际用户ID
        activation = activationRepository.save(activation);
        log.info("设备激活成功: deviceId={}", request.getDeviceId());
        return convertToDTO(activation);
    }
    @Override
    @Transactional
    public void revokeActivation(String factoryId, Integer activationId) {
        log.info("撤销激活: factoryId={}, activationId={}", factoryId, activationId);
        DeviceActivation activation = activationRepository.findById(activationId)
                .orElseThrow(() -> new BusinessException("激活记录不存在"));
        if (!activation.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该激活记录");
        }
        activation.setStatus("REVOKED");
        activationRepository.save(activation);
        log.info("激活已撤销: activationId={}", activationId);
    }
    @Override
    @Transactional
    public void revokeActivationBatch(String factoryId, List<Integer> activationIds) {
        log.info("批量撤销激活: factoryId={}, ids={}", factoryId, activationIds);
        activationRepository.updateStatusBatch(factoryId, activationIds, "REVOKED");
        log.info("批量撤销完成: count={}", activationIds.size());
    }
    @Override
    @Transactional
    public DeviceActivationDTO updateActivationStatus(String factoryId, Integer activationId, String status) {
        log.info("更新激活状态: factoryId={}, activationId={}, status={}",
                factoryId, activationId, status);
        DeviceActivation activation = activationRepository.findById(activationId)
                .orElseThrow(() -> new BusinessException("激活记录不存在"));
        if (!activation.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该激活记录");
        }
        activation.setStatus(status);
        activation = activationRepository.save(activation);
        return convertToDTO(activation);
    }
    @Override
    @Transactional(readOnly = true)
    public DeviceActivationDTO getActivation(String factoryId, Integer activationId) {
        DeviceActivation activation = activationRepository.findById(activationId)
                .orElseThrow(() -> new BusinessException("激活记录不存在"));
        if (!activation.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该激活记录");
        }
        return convertToDTO(activation);
    }
    @Override
    @Transactional(readOnly = true)
    public DeviceActivationDTO getActivationByCode(String activationCode) {
        return convertToDTO(activationRepository.findByActivationCode(activationCode)
                .orElseThrow(() -> new BusinessException("激活码不存在")));
    }
    @Override
    @Transactional(readOnly = true)
    public DeviceActivationDTO getActivationByDevice(String factoryId, String deviceId) {
        return convertToDTO(activationRepository
                .findByFactoryIdAndDeviceId(factoryId, deviceId)
                .orElseThrow(() -> new BusinessException("设备未激活")));
    }
    @Override
    @Transactional(readOnly = true)
    public PageResponse<DeviceActivationDTO> getActivations(String factoryId, String status,
                                                           String deviceType, Pageable pageable) {
        Page<DeviceActivation> page;
        if (status != null) {
            page = activationRepository.findByFactoryIdAndStatus(factoryId, status, pageable);
        } else {
            page = activationRepository.findByFactoryId(factoryId, pageable);
        }
        List<DeviceActivationDTO> dtos = page.getContent().stream()
                .filter(a -> deviceType == null || deviceType.equals(a.getDeviceType()))
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        return PageResponse.of(dtos, page.getNumber(), page.getSize(), page.getTotalElements());
    }
    @Override
    @Transactional(readOnly = true)
    public DeviceActivationDTO.ActivationStatistics getStatistics(String factoryId) {
        DeviceActivationDTO.ActivationStatistics stats = new DeviceActivationDTO.ActivationStatistics();
        // 统计各状态数量
        List<Object[]> statusCounts = activationRepository.countByStatus(factoryId);
        long totalCodes = 0;
        long pendingCodes = 0;
        long activatedCodes = 0;
        long expiredCodes = 0;
        long revokedCodes = 0;
        for (Object[] row : statusCounts) {
            String status = (String) row[0];
            Long count = (Long) row[1];
            totalCodes += count;
            switch (status) {
                case "PENDING":
                    pendingCodes = count;
                    break;
                case "ACTIVATED":
                    activatedCodes = count;
                    break;
                case "EXPIRED":
                    expiredCodes = count;
                    break;
                case "REVOKED":
                    revokedCodes = count;
                    break;
            }
        }
        stats.setTotalCodes(totalCodes);
        stats.setPendingCodes(pendingCodes);
        stats.setActivatedCodes(activatedCodes);
        stats.setExpiredCodes(expiredCodes);
        stats.setRevokedCodes(revokedCodes);
        // 统计设备数
        long totalDevices = activationRepository.countByFactoryIdAndStatus(factoryId, "ACTIVATED");
        stats.setTotalDevices(totalDevices);
        stats.setActiveDevices(totalDevices); // TODO: 实际计算活跃设备
        // 计算时间段统计
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime todayStart = now.toLocalDate().atStartOfDay();
        LocalDateTime weekStart = now.minusDays(7);
        LocalDateTime monthStart = now.minusDays(30);
        List<DeviceActivation> monthlyActivations = activationRepository
                .findActivationsByDateRange(factoryId, monthStart, now);
        List<DeviceActivation> weeklyActivations = activationRepository
                .findActivationsByDateRange(factoryId, weekStart, now);
        List<DeviceActivation> dailyActivations = activationRepository
                .findActivationsByDateRange(factoryId, todayStart, now);
        stats.setMonthlyActivations((long) monthlyActivations.size());
        stats.setWeeklyActivations((long) weeklyActivations.size());
        stats.setDailyActivations((long) dailyActivations.size());
        // 计算比率
        if (totalCodes > 0) {
            stats.setActivationRate((double) activatedCodes / totalCodes * 100);
        }
        if (totalDevices > 0) {
            stats.setDeviceUtilizationRate((double) stats.getActiveDevices() / totalDevices * 100);
        }
        return stats;
    }
    @Override
    @Transactional(readOnly = true)
    public List<DeviceActivationDTO> getRecentActivations(String factoryId, Integer limit) {
        Pageable pageable = PageRequest.of(0, limit != null ? limit : 10,
                Sort.by(Sort.Direction.DESC, "activatedAt"));
        List<DeviceActivation> activations = activationRepository
                .findRecentActivations(factoryId, pageable);
        return activations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional(readOnly = true)
    public List<DeviceActivationDTO> getExpiringActivations(String factoryId, Integer days) {
        LocalDateTime cutoffTime = LocalDateTime.now().plusDays(days != null ? days : 7);
        List<DeviceActivation> activations = activationRepository.findByFactoryId(factoryId,
                PageRequest.of(0, Integer.MAX_VALUE)).getContent();
        return activations.stream()
                .filter(a -> a.getExpiresAt() != null &&
                        a.getExpiresAt().isBefore(cutoffTime) &&
                        a.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional(readOnly = true)
    public List<DeviceActivationDTO> getInactiveDevices(String factoryId, Integer inactiveDays) {
        LocalDateTime cutoffTime = LocalDateTime.now().minusDays(inactiveDays != null ? inactiveDays : 30);
        List<DeviceActivation> inactiveDevices = activationRepository
                .findInactiveDevices(factoryId, cutoffTime);
        return inactiveDevices.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional
    public void updateDeviceActivity(String factoryId, String deviceId) {
        activationRepository.updateLastActiveTime(factoryId, deviceId, LocalDateTime.now());
    }
    @Override
    @Transactional
    public DeviceActivationDTO extendExpiration(String factoryId, Integer activationId, Integer additionalDays) {
        log.info("延长激活有效期: factoryId={}, activationId={}, days={}",
                factoryId, activationId, additionalDays);
        DeviceActivation activation = activationRepository.findById(activationId)
                .orElseThrow(() -> new BusinessException("激活记录不存在"));
        if (!activation.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该激活记录");
        }
        LocalDateTime newExpiry = activation.getExpiresAt() != null ?
                activation.getExpiresAt().plusDays(additionalDays) :
                LocalDateTime.now().plusDays(additionalDays);
        activation.setExpiresAt(newExpiry);
        activation = activationRepository.save(activation);
        return convertToDTO(activation);
    }
    @Override
    @Transactional(readOnly = true)
    public boolean isDeviceActivated(String factoryId, String deviceId) {
        return activationRepository.existsByFactoryIdAndDeviceIdAndStatus(
                factoryId, deviceId, "ACTIVATED");
    }
    @Override
    @Transactional(readOnly = true)
    public boolean isActivationCodeValid(String activationCode) {
        Optional<DeviceActivation> activation = activationRepository.findByActivationCode(activationCode);
        return activation.isPresent() && activation.get().isValid();
    }
    @Override
    @Transactional
    public void cleanupExpiredActivations() {
        log.info("清理过期的激活记录");
        List<DeviceActivation> expiredActivations = activationRepository
                .findExpiredActivations(LocalDateTime.now());
        for (DeviceActivation activation : expiredActivations) {
            activation.setStatus("EXPIRED");
            activationRepository.save(activation);
        }
        log.info("已将{}个激活记录标记为过期", expiredActivations.size());
    }
    @Override
    public String exportActivations(String factoryId, LocalDateTime startDate, LocalDateTime endDate) {
        log.info("导出激活记录: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        List<DeviceActivation> activations = activationRepository
                .findActivationsByDateRange(factoryId, startDate, endDate);
        // TODO: 实现实际的导出逻辑（CSV、Excel等）
        StringBuilder sb = new StringBuilder();
        sb.append("激活码,设备ID,设备名称,状态,激活时间\n");
        for (DeviceActivation activation : activations) {
            sb.append(String.format("%s,%s,%s,%s,%s\n",
                    activation.getActivationCode(),
                    activation.getDeviceId(),
                    activation.getDeviceName(),
                    activation.getStatus(),
                    activation.getActivatedAt()));
        }
        return sb.toString();
    }
    @Override
    @Transactional
    public List<DeviceActivationDTO> importActivationCodes(String factoryId, List<String> codes) {
        log.info("批量导入激活码: factoryId={}, count={}", factoryId, codes.size());
        List<DeviceActivationDTO> imported = new ArrayList<>();
        for (String code : codes) {
            if (!activationRepository.existsByActivationCode(code)) {
                DeviceActivation activation = new DeviceActivation();
                activation.setFactoryId(factoryId);
                activation.setActivationCode(code);
                activation.setStatus("PENDING");
                activation.setMaxDevices(1);
                activation.setAllowMultipleDevices(false);
                activation = activationRepository.save(activation);
                imported.add(convertToDTO(activation));
            }
        }
        log.info("成功导入{}个激活码", imported.size());
        return imported;
    }
    @Override
    @Transactional(readOnly = true)
    public List<DeviceActivationDTO> getDeviceActivationHistory(String factoryId, String deviceId) {
        // TODO: 实现设备激活历史查询
        List<DeviceActivation> activations = new ArrayList<>();
        Optional<DeviceActivation> current = activationRepository
                .findByFactoryIdAndDeviceId(factoryId, deviceId);
        current.ifPresent(activations::add);
        return activations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional
    public DeviceActivationDTO transferActivation(String factoryId, String oldDeviceId, String newDeviceId) {
        log.info("转移激活: factoryId={}, oldDevice={}, newDevice={}",
                factoryId, oldDeviceId, newDeviceId);
        DeviceActivation activation = activationRepository
                .findByFactoryIdAndDeviceId(factoryId, oldDeviceId)
                .orElseThrow(() -> new BusinessException("原设备未激活"));
        // 检查新设备是否已激活
        if (activationRepository.existsByFactoryIdAndDeviceIdAndStatus(
                factoryId, newDeviceId, "ACTIVATED")) {
            throw new BusinessException("新设备已被激活");
        }
        activation.setDeviceId(newDeviceId);
        activation.setLastActiveAt(LocalDateTime.now());
        activation = activationRepository.save(activation);
        log.info("激活转移成功: {} -> {}", oldDeviceId, newDeviceId);
        return convertToDTO(activation);
    }
    // ========== 私有辅助方法 ==========
    private String generateUniqueCode() {
        String code;
        do {
            code = generateActivationCode();
        } while (activationRepository.existsByActivationCode(code));
        return code;
    }
    private String generateActivationCode() {
        String prefix = "ACT";
        String year = String.valueOf(LocalDate.now().getYear());
        String random1 = generateRandomString(4);
        String random2 = generateRandomString(4);
        return String.format("%s-%s-%s-%s", prefix, year, random1, random2);
    }
    private String generateRandomString(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
    private DeviceActivationDTO convertToDTO(DeviceActivation entity) {
        return DeviceActivationDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .activationCode(entity.getActivationCode())
                .deviceId(entity.getDeviceId())
                .deviceName(entity.getDeviceName())
                .deviceType(entity.getDeviceType())
                .deviceModel(entity.getDeviceModel())
                .osType(entity.getOsType())
                .osVersion(entity.getOsVersion())
                .appVersion(entity.getAppVersion())
                .ipAddress(entity.getIpAddress())
                .macAddress(entity.getMacAddress())
                .status(entity.getStatus())
                .activatedAt(entity.getActivatedAt())
                .activatedBy(entity.getActivatedBy())
                .expiresAt(entity.getExpiresAt())
                .maxDevices(entity.getMaxDevices())
                .usedDevices(entity.getUsedDevices())
                .allowMultipleDevices(entity.getAllowMultipleDevices())
                .lastActiveAt(entity.getLastActiveAt())
                .notes(entity.getNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
