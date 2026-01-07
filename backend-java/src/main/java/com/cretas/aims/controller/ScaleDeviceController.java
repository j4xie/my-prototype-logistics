package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.scale.*;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.enums.DeviceCategory;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import com.cretas.aims.service.ScaleProtocolAdapterService;
import com.cretas.aims.util.ErrorSanitizer;
import com.cretas.aims.utils.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * IoT 秤设备管理控制器
 *
 * 提供 IoT 电子秤设备的 CRUD 操作、协议绑定、数据解析测试等功能
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/scale-devices")
@Tag(name = "IoT秤设备管理", description = "管理工厂内的 IoT 电子秤设备")
@RequiredArgsConstructor
public class ScaleDeviceController {

    private final EquipmentRepository equipmentRepository;
    private final ScaleProtocolConfigRepository protocolRepository;
    private final ScaleBrandModelRepository brandModelRepository;
    private final ScaleProtocolAdapterService protocolAdapterService;

    // ==================== 设备列表查询 ====================

    @GetMapping
    @Operation(summary = "获取秤设备列表", description = "分页获取工厂内的 IoT 电子秤设备")
    public ApiResponse<PageResponse<ScaleDeviceDTO>> getScaleDevices(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") int page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页条数") int size,
            @RequestParam(required = false) @Parameter(description = "搜索关键词") String keyword,
            @RequestParam(required = false) @Parameter(description = "状态筛选") String status) {

        log.info("获取秤设备列表: factoryId={}, page={}, size={}, keyword={}", factoryId, page, size, keyword);

        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "id"));

        // 查询 IoT 秤设备
        Page<FactoryEquipment> equipmentPage;
        if (keyword != null && !keyword.isEmpty()) {
            equipmentPage = equipmentRepository.findByFactoryId(factoryId, pageRequest);
            // 进一步过滤
            List<FactoryEquipment> filtered = equipmentPage.getContent().stream()
                    .filter(e -> e.getDeviceCategory() == DeviceCategory.IOT_SCALE)
                    .filter(e -> keyword == null ||
                            e.getEquipmentName().toLowerCase().contains(keyword.toLowerCase()) ||
                            e.getEquipmentCode().toLowerCase().contains(keyword.toLowerCase()))
                    .filter(e -> status == null || e.getStatus().equals(status))
                    .collect(Collectors.toList());

            List<ScaleDeviceDTO> dtos = filtered.stream()
                    .map(this::enrichDeviceDTO)
                    .collect(Collectors.toList());

            return ApiResponse.success(PageResponse.of(dtos, page, size, (long) filtered.size()));
        }

        equipmentPage = equipmentRepository.findByFactoryId(factoryId, pageRequest);

        // 过滤 IoT 秤设备
        List<ScaleDeviceDTO> dtos = equipmentPage.getContent().stream()
                .filter(e -> e.getDeviceCategory() == DeviceCategory.IOT_SCALE)
                .filter(e -> status == null || e.getStatus().equals(status))
                .map(this::enrichDeviceDTO)
                .collect(Collectors.toList());

        return ApiResponse.success(PageResponse.of(dtos, page, size, (long) dtos.size()));
    }

    // ==================== 设备详情 ====================

    @GetMapping("/{equipmentId}")
    @Operation(summary = "获取秤设备详情", description = "获取指定 IoT 电子秤设备的详细信息")
    public ApiResponse<ScaleDeviceDTO> getScaleDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "设备ID") Long equipmentId) {

        log.info("获取秤设备详情: factoryId={}, equipmentId={}", factoryId, equipmentId);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "设备不存在"));

        if (equipment.getDeviceCategory() != DeviceCategory.IOT_SCALE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该设备不是 IoT 电子秤");
        }

        return ApiResponse.success(enrichDeviceDTO(equipment));
    }

    // ==================== 创建设备 ====================

    @PostMapping
    @Operation(summary = "创建秤设备", description = "添加新的 IoT 电子秤设备")
    public ApiResponse<ScaleDeviceDTO> createScaleDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid ScaleDeviceDTO.CreateRequest request) {

        log.info("创建秤设备: factoryId={}, request={}", factoryId, request);

        // 检查设备编码是否已存在
        if (equipmentRepository.existsByFactoryIdAndEquipmentCode(factoryId, request.getEquipmentCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "设备编码已存在: " + request.getEquipmentCode());
        }

        // 验证品牌型号
        ScaleBrandModel brandModel = null;
        if (request.getScaleBrandModelId() != null) {
            brandModel = brandModelRepository.findById(request.getScaleBrandModelId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "品牌型号不存在"));
        }

        // 验证协议
        ScaleProtocolConfig protocol = null;
        if (request.getScaleProtocolId() != null) {
            protocol = protocolRepository.findById(request.getScaleProtocolId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "协议配置不存在"));
        } else if (brandModel != null && brandModel.getDefaultProtocolId() != null) {
            // 使用品牌型号的默认协议
            protocol = protocolRepository.findById(brandModel.getDefaultProtocolId()).orElse(null);
        }

        // 创建设备
        FactoryEquipment equipment = new FactoryEquipment();
        equipment.setFactoryId(factoryId);
        equipment.setCode(request.getEquipmentCode());
        equipment.setEquipmentCode(request.getEquipmentCode());
        equipment.setEquipmentName(request.getEquipmentName());
        equipment.setType("scale");
        equipment.setDeviceCategory(DeviceCategory.IOT_SCALE);
        equipment.setLocation(request.getLocation());
        equipment.setSerialNumber(request.getSerialNumber());
        equipment.setStatus("idle");
        equipment.setNotes(request.getNotes());

        // IoT 相关字段
        equipment.setIotDeviceCode(request.getIotDeviceCode() != null ?
                request.getIotDeviceCode() : "SCALE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        equipment.setScaleBrandModelId(request.getScaleBrandModelId());
        equipment.setScaleProtocolId(request.getScaleProtocolId() != null ?
                request.getScaleProtocolId() : (protocol != null ? protocol.getId() : null));
        equipment.setMqttTopic(request.getMqttTopic());
        equipment.setScaleConnectionParams(request.getScaleConnectionParams());

        // 从品牌型号获取制造商和型号
        if (brandModel != null) {
            equipment.setManufacturer(brandModel.getManufacturer() != null ?
                    brandModel.getManufacturer() : brandModel.getBrandName());
            equipment.setModel(brandModel.getModelCode());
        }

        // 设置创建者
        Long currentUserId = SecurityUtils.getCurrentUserId();
        equipment.setCreatedBy(currentUserId != null ? currentUserId : 1L);

        equipment = equipmentRepository.save(equipment);

        log.info("秤设备创建成功: id={}, code={}", equipment.getId(), equipment.getEquipmentCode());

        return ApiResponse.success(enrichDeviceDTO(equipment));
    }

    // ==================== 更新设备 ====================

    @PutMapping("/{equipmentId}")
    @Operation(summary = "更新秤设备", description = "更新 IoT 电子秤设备信息")
    public ApiResponse<ScaleDeviceDTO> updateScaleDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "设备ID") Long equipmentId,
            @RequestBody @Valid ScaleDeviceDTO.UpdateRequest request) {

        log.info("更新秤设备: factoryId={}, equipmentId={}, request={}", factoryId, equipmentId, request);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "设备不存在"));

        if (equipment.getDeviceCategory() != DeviceCategory.IOT_SCALE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该设备不是 IoT 电子秤");
        }

        // 更新字段
        if (request.getEquipmentName() != null) {
            equipment.setEquipmentName(request.getEquipmentName());
        }
        if (request.getLocation() != null) {
            equipment.setLocation(request.getLocation());
        }
        if (request.getSerialNumber() != null) {
            equipment.setSerialNumber(request.getSerialNumber());
        }
        if (request.getStatus() != null) {
            equipment.setStatus(request.getStatus());
        }
        if (request.getScaleBrandModelId() != null) {
            equipment.setScaleBrandModelId(request.getScaleBrandModelId());
        }
        if (request.getScaleProtocolId() != null) {
            equipment.setScaleProtocolId(request.getScaleProtocolId());
        }
        if (request.getIotDeviceCode() != null) {
            equipment.setIotDeviceCode(request.getIotDeviceCode());
        }
        if (request.getMqttTopic() != null) {
            equipment.setMqttTopic(request.getMqttTopic());
        }
        if (request.getScaleConnectionParams() != null) {
            equipment.setScaleConnectionParams(request.getScaleConnectionParams());
        }
        if (request.getNotes() != null) {
            equipment.setNotes(request.getNotes());
        }

        equipment = equipmentRepository.save(equipment);

        log.info("秤设备更新成功: id={}", equipment.getId());

        return ApiResponse.success(enrichDeviceDTO(equipment));
    }

    // ==================== 删除设备 ====================

    @DeleteMapping("/{equipmentId}")
    @Operation(summary = "删除秤设备", description = "删除指定的 IoT 电子秤设备")
    public ApiResponse<Void> deleteScaleDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "设备ID") Long equipmentId) {

        log.info("删除秤设备: factoryId={}, equipmentId={}", factoryId, equipmentId);

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "设备不存在"));

        if (equipment.getDeviceCategory() != DeviceCategory.IOT_SCALE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该设备不是 IoT 电子秤");
        }

        // 检查是否有使用记录
        if (equipmentRepository.hasUsageRecords(equipmentId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "设备存在使用记录，无法删除");
        }

        equipmentRepository.delete(equipment);

        log.info("秤设备删除成功: id={}", equipmentId);

        return ApiResponse.success();
    }

    // ==================== 绑定协议 ====================

    @PostMapping("/{equipmentId}/bind-protocol")
    @Operation(summary = "绑定协议", description = "为设备绑定通信协议")
    public ApiResponse<ScaleDeviceDTO> bindProtocol(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "设备ID") Long equipmentId,
            @RequestBody @Valid ScaleDeviceDTO.BindProtocolRequest request) {

        log.info("绑定协议: factoryId={}, equipmentId={}, protocolId={}", factoryId, equipmentId, request.getProtocolId());

        FactoryEquipment equipment = equipmentRepository.findByIdAndFactoryId(equipmentId, factoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "设备不存在"));

        ScaleProtocolConfig protocol = protocolRepository.findById(request.getProtocolId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "协议不存在"));

        equipment.setScaleProtocolId(protocol.getId());
        if (request.getConnectionParams() != null) {
            equipment.setScaleConnectionParams(request.getConnectionParams());
        }

        equipment = equipmentRepository.save(equipment);

        log.info("协议绑定成功: equipmentId={}, protocolId={}", equipmentId, protocol.getId());

        return ApiResponse.success(enrichDeviceDTO(equipment));
    }

    // ==================== 测试数据解析 ====================

    @PostMapping("/test-parse")
    @Operation(summary = "测试数据解析", description = "使用指定协议解析原始数据帧")
    public ApiResponse<ScaleDeviceDTO.TestParseResponse> testParse(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid ScaleDeviceDTO.TestParseRequest request) {

        log.info("测试数据解析: factoryId={}, protocolId={}", factoryId, request.getProtocolId());

        try {
            // 验证协议存在
            if (!protocolRepository.existsById(request.getProtocolId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "协议不存在");
            }

            // 调用协议适配器的 dryRunParse 方法进行测试解析
            ScaleDataParseResult result = protocolAdapterService.dryRunParse(
                    request.getProtocolId(),
                    request.getRawDataHex()
            );

            return ApiResponse.success(ScaleDeviceDTO.TestParseResponse.builder()
                    .success(result.isSuccess())
                    .parseResult(result)
                    .errorMessage(result.getErrorMessage())
                    .build());

        } catch (Exception e) {
            log.error("数据解析测试失败: {}", e.getMessage());
            return ApiResponse.success(ScaleDeviceDTO.TestParseResponse.builder()
                    .success(false)
                    .errorMessage(ErrorSanitizer.sanitize(e))
                    .build());
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 丰富设备 DTO，添加关联的协议和品牌型号信息
     */
    private ScaleDeviceDTO enrichDeviceDTO(FactoryEquipment equipment) {
        ScaleDeviceDTO dto = ScaleDeviceDTO.fromEntity(equipment);

        // 加载协议信息
        if (equipment.getScaleProtocolId() != null) {
            protocolRepository.findById(equipment.getScaleProtocolId())
                    .ifPresent(p -> dto.setProtocol(ScaleProtocolDTO.fromEntity(p)));
        }

        // 加载品牌型号信息
        if (equipment.getScaleBrandModelId() != null) {
            brandModelRepository.findById(equipment.getScaleBrandModelId())
                    .ifPresent(b -> dto.setBrandModel(ScaleBrandModelDTO.fromEntity(b)));
        }

        return dto;
    }
}
