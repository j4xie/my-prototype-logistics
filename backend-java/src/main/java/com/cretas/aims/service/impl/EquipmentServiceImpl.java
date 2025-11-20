package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.CreateEquipmentRequest;
import com.cretas.aims.dto.equipment.EquipmentDTO;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.service.EquipmentService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 设备服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class EquipmentServiceImpl implements EquipmentService {

    private static final Logger log = LoggerFactory.getLogger(EquipmentServiceImpl.class);

    private final EquipmentRepository equipmentRepository;

    @Override
    @Transactional
    public EquipmentDTO createEquipment(String factoryId, CreateEquipmentRequest request, Integer userId) {
        log.info("创建设备: factoryId={}, name={}", factoryId, request.getName());

        FactoryEquipment equipment = new FactoryEquipment();
        equipment.setId(java.util.UUID.randomUUID().toString());
        equipment.setFactoryId(factoryId);
        equipment.setCode(generateEquipmentCode());
        equipment.setEquipmentCode(generateEquipmentCode());
        equipment.setName(request.getName());
        equipment.setType(request.getType());
        equipment.setModel(request.getModel());
        equipment.setManufacturer(request.getManufacturer());
        equipment.setSerialNumber(request.getSerialNumber());
        equipment.setPurchaseDate(request.getPurchaseDate());
        equipment.setPurchasePrice(request.getPurchasePrice());
        equipment.setDepreciationYears(request.getDepreciationYears());
        equipment.setHourlyCost(request.getHourlyCost());
        equipment.setPowerConsumptionKw(request.getPowerConsumptionKw());
        equipment.setLocation(request.getLocation());
        equipment.setMaintenanceIntervalHours(request.getMaintenanceIntervalHours());
        equipment.setWarrantyExpiryDate(request.getWarrantyExpiryDate());
        equipment.setStatus("idle");
        equipment.setTotalRunningHours(0);
        equipment.setNotes(request.getNotes());
        equipment.setCreatedBy(userId);
        equipment.setCreatedAt(LocalDateTime.now());

        // 计算下次维护日期
        if (request.getMaintenanceIntervalHours() != null) {
            equipment.setNextMaintenanceDate(LocalDate.now().plusDays(30));
        }

        equipment = equipmentRepository.save(equipment);
        log.info("设备创建成功: id={}, code={}", equipment.getId(), equipment.getEquipmentCode());
        return toDTO(equipment);
    }

    @Override
    @Transactional
    public EquipmentDTO updateEquipment(String factoryId, String equipmentId, CreateEquipmentRequest request) {
        log.info("更新设备: factoryId={}, equipmentId={}", factoryId, equipmentId);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        if (request.getName() != null) equipment.setName(request.getName());
        if (request.getType() != null) equipment.setType(request.getType());
        if (request.getModel() != null) equipment.setModel(request.getModel());
        if (request.getManufacturer() != null) equipment.setManufacturer(request.getManufacturer());
        if (request.getSerialNumber() != null) equipment.setSerialNumber(request.getSerialNumber());
        if (request.getPurchaseDate() != null) equipment.setPurchaseDate(request.getPurchaseDate());
        if (request.getPurchasePrice() != null) equipment.setPurchasePrice(request.getPurchasePrice());
        if (request.getDepreciationYears() != null) equipment.setDepreciationYears(request.getDepreciationYears());
        if (request.getHourlyCost() != null) equipment.setHourlyCost(request.getHourlyCost());
        if (request.getPowerConsumptionKw() != null) equipment.setPowerConsumptionKw(request.getPowerConsumptionKw());
        if (request.getLocation() != null) equipment.setLocation(request.getLocation());
        if (request.getMaintenanceIntervalHours() != null) equipment.setMaintenanceIntervalHours(request.getMaintenanceIntervalHours());
        if (request.getWarrantyExpiryDate() != null) equipment.setWarrantyExpiryDate(request.getWarrantyExpiryDate());
        if (request.getNotes() != null) equipment.setNotes(request.getNotes());
        equipment.setUpdatedAt(LocalDateTime.now());

        equipment = equipmentRepository.save(equipment);
        log.info("设备更新成功: id={}", equipment.getId());
        return toDTO(equipment);
    }

    @Override
    @Transactional
    public void deleteEquipment(String factoryId, String equipmentId) {
        log.info("删除设备: factoryId={}, equipmentId={}", factoryId, equipmentId);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        // 检查是否有使用记录
        if (equipmentRepository.hasUsageRecords(equipmentId)) {
            throw new BusinessException("设备有使用记录，无法删除");
        }

        equipmentRepository.delete(equipment);
        log.info("设备删除成功: id={}", equipmentId);
    }

    @Override
    public EquipmentDTO getEquipmentById(String factoryId, String equipmentId) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));
        return toDTO(equipment);
    }

    @Override
    public PageResponse<EquipmentDTO> getEquipmentList(String factoryId, PageRequest pageRequest) {
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<FactoryEquipment> equipmentPage = equipmentRepository.findByFactoryId(factoryId, pageable);
        List<EquipmentDTO> equipmentDTOs = equipmentPage.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        PageResponse<EquipmentDTO> response = new PageResponse<>();
        response.setContent(equipmentDTOs);
        response.setPage(pageRequest.getPage());
        response.setSize(pageRequest.getSize());
        response.setTotalElements(equipmentPage.getTotalElements());
        response.setTotalPages(equipmentPage.getTotalPages());
        response.setFirst(equipmentPage.isFirst());
        response.setLast(equipmentPage.isLast());

        return response;
    }

    @Override
    public List<EquipmentDTO> getEquipmentByStatus(String factoryId, String status) {
        List<FactoryEquipment> equipment = equipmentRepository.findByFactoryIdAndStatus(factoryId, status);
        return equipment.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<EquipmentDTO> getEquipmentByType(String factoryId, String type) {
        List<FactoryEquipment> equipment = equipmentRepository.findByFactoryIdAndType(factoryId, type);
        return equipment.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<EquipmentDTO> searchEquipment(String factoryId, String keyword) {
        List<FactoryEquipment> equipment = equipmentRepository.searchByKeyword(factoryId, keyword);
        return equipment.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public EquipmentDTO updateEquipmentStatus(String factoryId, String equipmentId, String status) {
        log.info("更新设备状态: factoryId={}, equipmentId={}, status={}", factoryId, equipmentId, status);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        equipment.setStatus(status);
        equipment.setUpdatedAt(LocalDateTime.now());
        equipment = equipmentRepository.save(equipment);

        log.info("设备状态更新成功: id={}, status={}", equipment.getId(), status);
        return toDTO(equipment);
    }

    @Override
    @Transactional
    public EquipmentDTO startEquipment(String factoryId, String equipmentId) {
        log.info("启动设备: factoryId={}, equipmentId={}", factoryId, equipmentId);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        if ("running".equals(equipment.getStatus())) {
            throw new BusinessException("设备已在运行中");
        }
        if ("maintenance".equals(equipment.getStatus())) {
            throw new BusinessException("设备正在维护中，无法启动");
        }
        if ("scrapped".equals(equipment.getStatus())) {
            throw new BusinessException("设备已报废，无法启动");
        }

        equipment.setStatus("running");
        equipment.setUpdatedAt(LocalDateTime.now());
        equipment = equipmentRepository.save(equipment);

        log.info("设备启动成功: id={}", equipment.getId());
        return toDTO(equipment);
    }

    @Override
    @Transactional
    public EquipmentDTO stopEquipment(String factoryId, String equipmentId, Integer runningHours) {
        log.info("停止设备: factoryId={}, equipmentId={}, runningHours={}", factoryId, equipmentId, runningHours);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        if (!"running".equals(equipment.getStatus())) {
            throw new BusinessException("设备未在运行中");
        }

        equipment.setStatus("idle");
        if (runningHours != null) {
            equipment.setTotalRunningHours(equipment.getTotalRunningHours() + runningHours);
        }
        equipment.setUpdatedAt(LocalDateTime.now());
        equipment = equipmentRepository.save(equipment);

        log.info("设备停止成功: id={}", equipment.getId());
        return toDTO(equipment);
    }

    @Override
    @Transactional
    public EquipmentDTO recordMaintenance(String factoryId, String equipmentId, LocalDate maintenanceDate,
                                         BigDecimal cost, String description) {
        log.info("记录设备维护: factoryId={}, equipmentId={}, date={}", factoryId, equipmentId, maintenanceDate);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        equipment.setLastMaintenanceDate(maintenanceDate);
        if (equipment.getMaintenanceIntervalHours() != null && equipment.getMaintenanceIntervalHours() > 0) {
            int daysInterval = equipment.getMaintenanceIntervalHours() / 24;
            equipment.setNextMaintenanceDate(maintenanceDate.plusDays(daysInterval));
        }
        equipment.setUpdatedAt(LocalDateTime.now());
        equipment = equipmentRepository.save(equipment);

        // TODO: 保存维护记录到EquipmentMaintenance表

        log.info("设备维护记录成功: id={}", equipment.getId());
        return toDTO(equipment);
    }

    @Override
    public List<EquipmentDTO> getEquipmentNeedingMaintenance(String factoryId) {
        LocalDate checkDate = LocalDate.now().plusDays(7); // 提前7天提醒
        List<FactoryEquipment> equipment = equipmentRepository.findEquipmentNeedingMaintenance(factoryId, checkDate);
        return equipment.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<EquipmentDTO> getEquipmentWithExpiringWarranty(String factoryId, Integer daysAhead) {
        LocalDate warningDate = LocalDate.now().plusDays(daysAhead);
        List<FactoryEquipment> equipment = equipmentRepository.findEquipmentWithExpiringWarranty(factoryId, warningDate);
        return equipment.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public BigDecimal calculateDepreciatedValue(String factoryId, String equipmentId) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        if (equipment.getPurchasePrice() == null || equipment.getDepreciationYears() == null ||
            equipment.getPurchaseDate() == null) {
            return equipment.getPurchasePrice();
        }

        long monthsUsed = ChronoUnit.MONTHS.between(equipment.getPurchaseDate(), LocalDate.now());
        long totalMonths = equipment.getDepreciationYears() * 12L;

        if (monthsUsed >= totalMonths) {
            return BigDecimal.ZERO;
        }

        BigDecimal depreciationPerMonth = equipment.getPurchasePrice().divide(
                BigDecimal.valueOf(totalMonths), 2, RoundingMode.HALF_UP);
        BigDecimal totalDepreciation = depreciationPerMonth.multiply(BigDecimal.valueOf(monthsUsed));

        return equipment.getPurchasePrice().subtract(totalDepreciation);
    }

    @Override
    public Map<String, Object> getEquipmentStatistics(String factoryId, String equipmentId) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        Map<String, Object> statistics = new HashMap<>();
        statistics.put("equipmentId", equipment.getId());
        statistics.put("equipmentName", equipment.getName());
        statistics.put("status", equipment.getStatus());
        statistics.put("totalRunningHours", equipment.getTotalRunningHours());
        statistics.put("purchasePrice", equipment.getPurchasePrice());
        statistics.put("currentValue", calculateDepreciatedValue(factoryId, equipmentId));

        if (equipment.getHourlyCost() != null && equipment.getTotalRunningHours() != null) {
            BigDecimal totalCost = equipment.getHourlyCost().multiply(BigDecimal.valueOf(equipment.getTotalRunningHours()));
            statistics.put("totalOperatingCost", totalCost);
        }

        statistics.put("needsMaintenance", equipment.getNextMaintenanceDate() != null &&
                equipment.getNextMaintenanceDate().isBefore(LocalDate.now().plusDays(7)));

        return statistics;
    }

    @Override
    public List<Map<String, Object>> getEquipmentUsageHistory(String factoryId, String equipmentId) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        // TODO: 从BatchEquipmentUsage表获取使用历史
        List<Map<String, Object>> history = new ArrayList<>();
        return history;
    }

    @Override
    public List<Map<String, Object>> getEquipmentMaintenanceHistory(String factoryId, String equipmentId) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        // TODO: 从EquipmentMaintenance表获取维护历史
        List<Map<String, Object>> history = new ArrayList<>();
        return history;
    }

    @Override
    public Map<String, Object> getOverallEquipmentStatistics(String factoryId) {
        Map<String, Object> statistics = new HashMap<>();

        // 设备总数
        long totalEquipment = equipmentRepository.countByFactoryId(factoryId);
        statistics.put("totalEquipment", totalEquipment);

        // 设备总价值
        BigDecimal totalValue = equipmentRepository.calculateTotalEquipmentValue(factoryId);
        statistics.put("totalValue", totalValue != null ? totalValue : BigDecimal.ZERO);

        // 按状态统计
        List<Object[]> statusCount = equipmentRepository.countByStatus(factoryId);
        Map<String, Long> statusDistribution = new HashMap<>();
        for (Object[] row : statusCount) {
            statusDistribution.put((String) row[0], (Long) row[1]);
        }
        statistics.put("statusDistribution", statusDistribution);

        // 按类型统计
        List<Object[]> typeCount = equipmentRepository.countByType(factoryId);
        Map<String, Long> typeDistribution = new HashMap<>();
        for (Object[] row : typeCount) {
            String type = (String) row[0];
            typeDistribution.put(type != null ? type : "未分类", (Long) row[1]);
        }
        statistics.put("typeDistribution", typeDistribution);

        // 平均运行时间
        Double avgRunningHours = equipmentRepository.calculateAverageRunningHours(factoryId);
        statistics.put("averageRunningHours", avgRunningHours != null ? avgRunningHours : 0.0);

        // 总运行成本
        BigDecimal totalOperatingCost = equipmentRepository.calculateTotalOperatingCost(factoryId);
        statistics.put("totalOperatingCost", totalOperatingCost != null ? totalOperatingCost : BigDecimal.ZERO);

        return statistics;
    }

    @Override
    public Map<String, Object> getEquipmentEfficiencyReport(String factoryId, String equipmentId,
                                                           LocalDate startDate, LocalDate endDate) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        Map<String, Object> report = new HashMap<>();
        report.put("equipmentId", equipment.getId());
        report.put("equipmentName", equipment.getName());
        report.put("startDate", startDate);
        report.put("endDate", endDate);

        // TODO: 从使用记录计算实际效率数据
        report.put("utilizationRate", 0.0);
        report.put("availability", 0.0);
        report.put("performance", 0.0);
        report.put("quality", 0.0);
        report.put("oee", 0.0);

        return report;
    }

    @Override
    @Transactional
    public List<EquipmentDTO> importEquipment(String factoryId, List<CreateEquipmentRequest> requests, Integer userId) {
        log.info("批量导入设备: factoryId={}, count={}", factoryId, requests.size());

        List<EquipmentDTO> importedEquipment = new ArrayList<>();
        for (CreateEquipmentRequest request : requests) {
            try {
                EquipmentDTO equipment = createEquipment(factoryId, request, userId);
                importedEquipment.add(equipment);
            } catch (Exception e) {
                log.error("导入设备失败: name={}, error={}", request.getName(), e.getMessage());
            }
        }

        log.info("批量导入完成，成功导入 {} 个设备", importedEquipment.size());
        return importedEquipment;
    }

    @Override
    public byte[] exportEquipmentList(String factoryId) {
        log.info("导出设备列表: factoryId={}", factoryId);

        // 查询所有设备
        List<FactoryEquipment> equipment = equipmentRepository.findByFactoryId(factoryId);

        // 转换为DTO
        List<EquipmentDTO> equipmentDTOs = equipment.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        // 转换为Excel导出DTO
        List<com.cretas.aims.dto.equipment.EquipmentExportDTO> exportDTOs = equipmentDTOs.stream()
                .map(com.cretas.aims.dto.equipment.EquipmentExportDTO::fromEquipmentDTO)
                .collect(Collectors.toList());

        // 生成Excel文件
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        byte[] excelBytes = excelUtil.exportToExcel(
                exportDTOs,
                com.cretas.aims.dto.equipment.EquipmentExportDTO.class,
                "设备列表"
        );

        log.info("设备列表导出成功: factoryId={}, count={}", factoryId, equipment.size());
        return excelBytes;
    }

    @Override
    public byte[] generateImportTemplate() {
        log.info("生成设备导入模板");

        // 使用ExcelUtil生成空模板
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        byte[] templateBytes = excelUtil.generateTemplate(
                com.cretas.aims.dto.equipment.EquipmentExportDTO.class,
                "设备导入模板"
        );

        log.info("设备导入模板生成成功");
        return templateBytes;
    }

    @Override
    // 不使用@Transactional，让每个save操作独立进行，避免单行失败导致整体回滚
    public com.cretas.aims.dto.common.ImportResult<EquipmentDTO> importEquipmentFromExcel(
            String factoryId,
            java.io.InputStream inputStream) {
        log.info("开始从Excel批量导入设备: factoryId={}", factoryId);

        // 1. 解析Excel文件
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        List<com.cretas.aims.dto.equipment.EquipmentExportDTO> excelData;
        try {
            excelData = excelUtil.importFromExcel(inputStream,
                    com.cretas.aims.dto.equipment.EquipmentExportDTO.class);
        } catch (Exception e) {
            log.error("Excel文件解析失败: factoryId={}", factoryId, e);
            throw new RuntimeException("Excel文件格式错误或无法解析: " + e.getMessage());
        }

        com.cretas.aims.dto.common.ImportResult<EquipmentDTO> result =
                com.cretas.aims.dto.common.ImportResult.create(excelData.size());

        // 2. 逐行验证并导入
        for (int i = 0; i < excelData.size(); i++) {
            com.cretas.aims.dto.equipment.EquipmentExportDTO exportDTO = excelData.get(i);
            int rowNumber = i + 2; // Excel行号（从2开始，1是表头）

            try {
                // 2.1 验证必填字段
                if (exportDTO.getName() == null || exportDTO.getName().trim().isEmpty()) {
                    result.addFailure(rowNumber, "设备名称不能为空", toJsonString(exportDTO));
                    continue;
                }

                // 2.2 验证编码唯一性（如果提供了编码）
                if (exportDTO.getEquipmentCode() != null && !exportDTO.getEquipmentCode().trim().isEmpty()) {
                    if (equipmentRepository.existsByFactoryIdAndEquipmentCode(factoryId, exportDTO.getEquipmentCode())) {
                        result.addFailure(rowNumber, "设备编码已存在: " + exportDTO.getEquipmentCode(),
                                toJsonString(exportDTO));
                        continue;
                    }
                }

                // 2.3 转换为Entity
                FactoryEquipment equipment = convertFromExportDTO(exportDTO, factoryId);

                // 2.4 保存
                FactoryEquipment saved = equipmentRepository.save(equipment);

                // 2.5 转换为DTO并记录成功
                EquipmentDTO dto = toDTO(saved);
                result.addSuccess(dto);

                log.debug("成功导入设备: row={}, name={}", rowNumber, exportDTO.getName());

            } catch (Exception e) {
                log.error("导入设备失败: factoryId={}, row={}, data={}", factoryId, rowNumber, exportDTO, e);
                result.addFailure(rowNumber, "保存失败: " + e.getMessage(), toJsonString(exportDTO));
            }
        }

        log.info("设备批量导入完成: factoryId={}, total={}, success={}, failure={}",
                factoryId, result.getTotalCount(), result.getSuccessCount(), result.getFailureCount());
        return result;
    }

    /**
     * 从EquipmentExportDTO转换为FactoryEquipment实体
     */
    private FactoryEquipment convertFromExportDTO(com.cretas.aims.dto.equipment.EquipmentExportDTO dto, String factoryId) {
        FactoryEquipment equipment = new FactoryEquipment();
        equipment.setId(java.util.UUID.randomUUID().toString());
        equipment.setFactoryId(factoryId);
        equipment.setEquipmentCode(dto.getEquipmentCode() != null ? dto.getEquipmentCode() : generateEquipmentCode());
        equipment.setCode(equipment.getEquipmentCode()); // code字段使用equipmentCode
        equipment.setName(dto.getName());
        equipment.setType(dto.getType());
        equipment.setModel(dto.getModel());
        equipment.setManufacturer(dto.getManufacturer());
        equipment.setSerialNumber(dto.getSerialNumber());

        // 解析日期字符串
        if (dto.getPurchaseDate() != null && !dto.getPurchaseDate().trim().isEmpty()) {
            try {
                equipment.setPurchaseDate(LocalDate.parse(dto.getPurchaseDate()));
            } catch (Exception e) {
                log.warn("日期解析失败: {}", dto.getPurchaseDate());
            }
        }

        equipment.setPurchasePrice(dto.getPurchasePrice());
        equipment.setHourlyCost(dto.getHourlyCost());
        equipment.setStatus(dto.getStatus() != null ? dto.getStatus().toLowerCase() : "idle");
        equipment.setLocation(dto.getLocation());
        equipment.setTotalRunningHours(dto.getTotalRunningHours() != null ? dto.getTotalRunningHours() : 0);
        equipment.setMaintenanceIntervalHours(dto.getMaintenanceIntervalHours());

        // 解析最后维护日期
        if (dto.getLastMaintenanceDate() != null && !dto.getLastMaintenanceDate().trim().isEmpty()) {
            try {
                equipment.setLastMaintenanceDate(LocalDate.parse(dto.getLastMaintenanceDate()));
            } catch (Exception e) {
                log.warn("日期解析失败: {}", dto.getLastMaintenanceDate());
            }
        }

        equipment.setCreatedBy(1); // 系统导入，使用默认用户ID
        equipment.setCreatedAt(LocalDateTime.now());
        return equipment;
    }

    /**
     * 将对象转换为JSON字符串
     */
    private String toJsonString(Object obj) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }

    @Override
    @Transactional
    public EquipmentDTO scrapEquipment(String factoryId, String equipmentId, String reason) {
        log.info("报废设备: factoryId={}, equipmentId={}, reason={}", factoryId, equipmentId, reason);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        equipment.setStatus("scrapped");
        equipment.setNotes(equipment.getNotes() != null ?
                equipment.getNotes() + "\n报废原因: " + reason : "报废原因: " + reason);
        equipment.setUpdatedAt(LocalDateTime.now());
        equipment = equipmentRepository.save(equipment);

        log.info("设备报废成功: id={}", equipment.getId());
        return toDTO(equipment);
    }

    @Override
    public Double calculateOEE(String factoryId, String equipmentId, LocalDate startDate, LocalDate endDate) {
        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));

        // TODO: 实现OEE计算
        // OEE = Availability × Performance × Quality
        return 0.0;
    }

    /**
     * Entity转DTO
     */
    private EquipmentDTO toDTO(FactoryEquipment equipment) {
        EquipmentDTO dto = EquipmentDTO.builder()
                .id(equipment.getId())
                .factoryId(equipment.getFactoryId())
                .equipmentCode(equipment.getEquipmentCode())
                .name(equipment.getName())
                .type(equipment.getType())
                .model(equipment.getModel())
                .manufacturer(equipment.getManufacturer())
                .serialNumber(equipment.getSerialNumber())
                .purchaseDate(equipment.getPurchaseDate())
                .purchasePrice(equipment.getPurchasePrice())
                .depreciationYears(equipment.getDepreciationYears())
                .status(equipment.getStatus())
                .location(equipment.getLocation())
                .hourlyCost(equipment.getHourlyCost())
                .powerConsumptionKw(equipment.getPowerConsumptionKw())
                .totalRunningHours(equipment.getTotalRunningHours())
                .maintenanceIntervalHours(equipment.getMaintenanceIntervalHours())
                .lastMaintenanceDate(equipment.getLastMaintenanceDate())
                .nextMaintenanceDate(equipment.getNextMaintenanceDate())
                .warrantyExpiryDate(equipment.getWarrantyExpiryDate())
                .notes(equipment.getNotes())
                .createdAt(equipment.getCreatedAt())
                .updatedAt(equipment.getUpdatedAt())
                .createdBy(equipment.getCreatedBy())
                .build();

        // 计算当前价值
        dto.setCurrentValue(calculateDepreciatedValue(equipment.getFactoryId(), equipment.getId()));

        // 计算是否需要维护
        if (equipment.getNextMaintenanceDate() != null) {
            dto.setNeedsMaintenance(equipment.getNextMaintenanceDate().isBefore(LocalDate.now().plusDays(7)));
        }

        return dto;
    }

    /**
     * 生成设备编码
     */
    private String generateEquipmentCode() {
        return "EQP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
    }
}
