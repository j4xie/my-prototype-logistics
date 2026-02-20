package com.cretas.aims.ai.tool.impl.material;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.dto.material.RawMaterialTypeDTO;
import com.cretas.aims.dto.supplier.SupplierDTO;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.RawMaterialTypeService;
import com.cretas.aims.service.SupplierService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 原材料入库工具
 *
 * 用于创建新的原材料批次记录，支持从自然语言中提取入库参数。
 * 当参数不完整时，返回需要确认的参数列表。
 *
 * 示例输入：
 * - "入库一批带鱼,数量500公斤"
 * - "新到一批鲜虾300公斤,供应商是渔港供应商"
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Component
public class MaterialBatchCreateTool extends AbstractBusinessTool {

    @Autowired
    @Lazy
    private MaterialBatchService materialBatchService;

    @Autowired
    @Lazy
    private RawMaterialTypeService rawMaterialTypeService;

    @Autowired
    @Lazy
    private SupplierService supplierService;

    // 数量提取正则：匹配 "500公斤"、"300kg"、"100斤" 等
    private static final Pattern QUANTITY_PATTERN = Pattern.compile(
            "(\\d+(?:\\.\\d+)?)\\s*(公斤|kg|千克|斤|吨|t|箱|件|袋|桶|瓶|个)",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    public String getToolName() {
        return "material_batch_create";
    }

    @Override
    public String getDescription() {
        return "创建原材料入库批次。用于登记新到货的原材料。需要提供原材料类型ID、供应商ID、数量等信息。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // materialTypeId: 原材料类型ID（必需）
        Map<String, Object> materialTypeId = new HashMap<>();
        materialTypeId.put("type", "string");
        materialTypeId.put("description", "原材料类型ID");
        properties.put("materialTypeId", materialTypeId);

        // supplierId: 供应商ID（必需）
        Map<String, Object> supplierId = new HashMap<>();
        supplierId.put("type", "string");
        supplierId.put("description", "供应商ID");
        properties.put("supplierId", supplierId);

        // quantity: 入库数量（必需）
        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "入库数量，必须大于0");
        quantity.put("minimum", 0.001);
        properties.put("quantity", quantity);

        // unit: 单位（必需）
        Map<String, Object> unit = new HashMap<>();
        unit.put("type", "string");
        unit.put("description", "数量单位，如：公斤、箱、袋等");
        properties.put("unit", unit);

        // totalValue: 总价值（可选）
        Map<String, Object> totalValue = new HashMap<>();
        totalValue.put("type", "number");
        totalValue.put("description", "入库总价值(元)");
        properties.put("totalValue", totalValue);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("materialTypeId", "supplierId", "quantity", "unit"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        // 入库操作需要额外的信息，先返回空让系统提示用户
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String userInput = getString(params, "userInput");
        log.info("执行原料入库 - 工厂ID: {}, 用户输入: {}", factoryId, userInput);

        // 1. 从用户输入中提取信息
        String extractedMaterial = extractMaterialName(userInput);
        BigDecimal extractedQuantity = extractQuantity(userInput);
        String extractedUnit = extractUnit(userInput);
        String extractedSupplierName = extractSupplierName(userInput);

        // 2. 检查是否有完整参数传入（用户二次确认后的调用）
        String materialTypeId = getString(params, "materialTypeId");
        String supplierId = getString(params, "supplierId");
        BigDecimal quantity = extractedQuantity != null ? extractedQuantity : getBigDecimal(params, "quantity");
        String unit = extractedUnit != null ? extractedUnit : getString(params, "unit");
        BigDecimal totalValue = getBigDecimal(params, "totalValue");

        // 3. 如果有完整参数（用户已确认），直接执行入库
        if (materialTypeId != null && supplierId != null) {
            return executeCreate(factoryId, materialTypeId, supplierId, quantity, unit, totalValue, userInput, context);
        }

        // 4. 首次调用：自动查找原材料类型，返回供应商选项让用户确认
        RawMaterialTypeDTO matchedMaterialType = null;
        List<RawMaterialTypeDTO> candidateMaterialTypes = new ArrayList<>();

        if (extractedMaterial != null) {
            // 调用 Service 搜索原材料类型
            // 注意：PageRequest.page 是 1-based，最小值为 1
            PageRequest pageRequest = PageRequest.of(1, 10);
            pageRequest.setKeyword(extractedMaterial);

            var searchResult = rawMaterialTypeService.searchMaterialTypes(factoryId, extractedMaterial, pageRequest);
            candidateMaterialTypes = searchResult.getContent();

            // 尝试精确匹配
            for (RawMaterialTypeDTO type : candidateMaterialTypes) {
                if (type.getName().equals(extractedMaterial)) {
                    matchedMaterialType = type;
                    break;
                }
            }
            // 如果没有精确匹配但只有一个结果，使用它
            if (matchedMaterialType == null && candidateMaterialTypes.size() == 1) {
                matchedMaterialType = candidateMaterialTypes.get(0);
            }
        }

        // 5. 调用 Service 获取供应商列表
        List<SupplierDTO> suppliers = supplierService.getActiveSuppliers(factoryId);

        // 6. 构建需要用户确认的响应
        return buildSupplierSelectionResponse(
                extractedMaterial, matchedMaterialType, candidateMaterialTypes,
                quantity, unit, suppliers, extractedSupplierName, userInput);
    }

    /**
     * 执行实际的入库操作
     */
    private Map<String, Object> executeCreate(String factoryId, String materialTypeId, String supplierId,
                                               BigDecimal quantity, String unit, BigDecimal totalValue,
                                               String userInput, Map<String, Object> context) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return buildErrorResponse("入库数量必须大于0");
        }
        if (unit == null || unit.isEmpty()) {
            unit = "公斤";
        }

        // 构建创建请求
        CreateMaterialBatchRequest request = new CreateMaterialBatchRequest();
        request.setMaterialTypeId(materialTypeId);
        request.setSupplierId(supplierId);
        request.setReceiptDate(LocalDate.now());
        request.setReceiptQuantity(quantity);
        request.setQuantityUnit(unit);
        request.setTotalWeight(convertToKg(quantity, unit));
        request.setTotalValue(totalValue != null ? totalValue : convertToKg(quantity, unit).multiply(new BigDecimal("10")));
        request.setNotes("AI入库: " + userInput);

        try {
            Long userId = context.get("userId") != null ? ((Number) context.get("userId")).longValue() : null;
            MaterialBatchDTO result = materialBatchService.createMaterialBatch(factoryId, request, userId);

            log.info("原料入库成功 - 批次号: {}", result.getBatchNumber());
            return buildSuccessResponse(result, quantity, unit);

        } catch (Exception e) {
            log.error("原料入库失败: {}", e.getMessage(), e);
            return buildErrorResponse("入库失败: " + e.getMessage());
        }
    }

    private String extractMaterialName(String userInput) {
        if (userInput == null) return null;

        // 常见模式："入库一批带鱼"、"新到一批鲜虾"
        String[] patterns = {"入库一批(.+?)[,，]", "新到一批(.+?)[,，0-9]", "到货一批(.+?)[,，0-9]",
                            "一批(.+?)[,，0-9]"};

        for (String pattern : patterns) {
            Pattern p = Pattern.compile(pattern);
            Matcher m = p.matcher(userInput);
            if (m.find()) {
                String name = m.group(1).trim();
                name = name.replaceAll("\\d+.*", "").trim();
                if (!name.isEmpty() && name.length() <= 20) {
                    return name;
                }
            }
        }
        return null;
    }

    private BigDecimal extractQuantity(String userInput) {
        if (userInput == null) return null;

        Matcher matcher = QUANTITY_PATTERN.matcher(userInput);
        if (matcher.find()) {
            return new BigDecimal(matcher.group(1));
        }
        return null;
    }

    private String extractUnit(String userInput) {
        if (userInput == null) return "公斤";

        Matcher matcher = QUANTITY_PATTERN.matcher(userInput);
        if (matcher.find()) {
            String unit = matcher.group(2).toLowerCase();
            if ("kg".equals(unit) || "千克".equals(unit)) {
                return "公斤";
            }
            return matcher.group(2);
        }
        return "公斤";
    }

    private String extractSupplierName(String userInput) {
        if (userInput == null) return null;

        Pattern supplierPattern = Pattern.compile("供应商[是为]?(.+?)(?:[,，]|$)");
        Matcher matcher = supplierPattern.matcher(userInput);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    private BigDecimal convertToKg(BigDecimal quantity, String unit) {
        if (quantity == null) return BigDecimal.ZERO;

        switch (unit) {
            case "吨":
            case "t":
                return quantity.multiply(new BigDecimal("1000"));
            case "斤":
                return quantity.multiply(new BigDecimal("0.5"));
            case "公斤":
            case "kg":
            case "千克":
            default:
                return quantity;
        }
    }

    /**
     * 构建供应商选择响应
     * 自动匹配原材料类型后，返回供应商列表让用户选择
     *
     * 使用 DTO 而非 Entity，复用 Service 层逻辑
     */
    private Map<String, Object> buildSupplierSelectionResponse(
            String extractedMaterial, RawMaterialTypeDTO matchedMaterialType,
            List<RawMaterialTypeDTO> candidateMaterialTypes, BigDecimal quantity, String unit,
            List<SupplierDTO> suppliers, String extractedSupplierName, String userInput) {

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("needsConfirmation", true);
        result.put("confirmationType", "SUPPLIER_SELECTION");

        StringBuilder message = new StringBuilder();
        message.append("📦 入库信息确认\n\n");

        // 原材料类型信息
        if (matchedMaterialType != null) {
            message.append("✅ 原材料：").append(matchedMaterialType.getName())
                    .append("（").append(matchedMaterialType.getCode()).append("）\n");
        } else if (extractedMaterial != null) {
            if (candidateMaterialTypes.isEmpty()) {
                message.append("⚠️ 未找到原材料「").append(extractedMaterial).append("」，请选择：\n");
            } else {
                message.append("⚠️ 原材料「").append(extractedMaterial).append("」有多个匹配，请选择：\n");
            }
        } else {
            message.append("⚠️ 未识别到原材料名称，请选择：\n");
        }

        // 数量信息
        if (quantity != null) {
            message.append("✅ 数量：").append(quantity).append(" ").append(unit != null ? unit : "公斤").append("\n");
        }

        // 供应商选择提示
        message.append("\n📋 请选择供应商：\n");
        if (suppliers.isEmpty()) {
            message.append("（暂无可用供应商，请先添加供应商）\n");
        } else {
            for (int i = 0; i < Math.min(suppliers.size(), 5); i++) {
                SupplierDTO s = suppliers.get(i);
                message.append(String.format("%d. %s", i + 1, s.getName()));
                if (s.getSupplierCode() != null) {
                    message.append("（").append(s.getSupplierCode()).append("）");
                }
                message.append("\n");
            }
            if (suppliers.size() > 5) {
                message.append("... 共 ").append(suppliers.size()).append(" 个供应商\n");
            }
        }

        result.put("message", message.toString());

        // 提取的参数
        Map<String, Object> extractedParams = new HashMap<>();
        if (extractedMaterial != null) extractedParams.put("materialName", extractedMaterial);
        if (matchedMaterialType != null) {
            extractedParams.put("materialTypeId", matchedMaterialType.getId());
            extractedParams.put("materialTypeName", matchedMaterialType.getName());
            extractedParams.put("materialTypeCode", matchedMaterialType.getCode());
        }
        if (quantity != null) extractedParams.put("quantity", quantity);
        if (unit != null) extractedParams.put("unit", unit);
        result.put("extractedParams", extractedParams);

        // 原材料类型选项（如果需要用户选择）
        if (matchedMaterialType == null && !candidateMaterialTypes.isEmpty()) {
            List<Map<String, Object>> materialOptions = candidateMaterialTypes.stream()
                    .map(type -> {
                        Map<String, Object> option = new HashMap<>();
                        option.put("id", type.getId());
                        option.put("name", type.getName());
                        option.put("code", type.getCode());
                        option.put("category", type.getCategory());
                        return option;
                    })
                    .collect(Collectors.toList());
            result.put("materialTypeOptions", materialOptions);
        }

        // 供应商选项
        List<Map<String, Object>> supplierOptions = suppliers.stream()
                .map(supplier -> {
                    Map<String, Object> option = new HashMap<>();
                    option.put("id", supplier.getId());
                    option.put("name", supplier.getName());
                    option.put("code", supplier.getSupplierCode());
                    // 如果用户提到了供应商名称，检查是否匹配
                    if (extractedSupplierName != null &&
                        supplier.getName().contains(extractedSupplierName)) {
                        option.put("recommended", true);
                    }
                    return option;
                })
                .collect(Collectors.toList());
        result.put("supplierOptions", supplierOptions);

        // 建议操作：选择供应商后调用业务 API 完成入库
        Map<String, Object> suggestedAction = new HashMap<>();
        suggestedAction.put("type", "CALL_API");
        suggestedAction.put("method", "POST");
        suggestedAction.put("endpoint", "/api/mobile/{factoryId}/material-batches");
        suggestedAction.put("label", "选择供应商并确认入库");
        suggestedAction.put("description", "选择供应商后，调用此 API 完成入库操作");

        // 请求体模板（前端需要填充 supplierId）
        Map<String, Object> requestTemplate = new HashMap<>();
        if (matchedMaterialType != null) {
            requestTemplate.put("materialTypeId", matchedMaterialType.getId());
        }
        requestTemplate.put("supplierId", "{{选择的供应商ID}}");
        requestTemplate.put("receiptDate", LocalDate.now().toString());
        if (quantity != null) {
            requestTemplate.put("receiptQuantity", quantity);
            requestTemplate.put("totalWeight", convertToKg(quantity, unit));
        }
        requestTemplate.put("quantityUnit", unit != null ? unit : "公斤");
        requestTemplate.put("notes", "AI入库: " + userInput);

        suggestedAction.put("requestBody", requestTemplate);
        suggestedAction.put("requiredFields", Arrays.asList("supplierId"));

        result.put("suggestedAction", suggestedAction);

        return result;
    }

    private Map<String, Object> buildSuccessResponse(MaterialBatchDTO batch, BigDecimal quantity, String unit) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", String.format("✅ 入库成功！\n批次号：%s\n数量：%s %s\n入库日期：%s",
                batch.getBatchNumber(), quantity, unit, batch.getReceiptDate()));
        result.put("batchNumber", batch.getBatchNumber());
        result.put("batchId", batch.getId());
        result.put("receiptDate", batch.getReceiptDate());
        return result;
    }

    private Map<String, Object> buildErrorResponse(String errorMessage) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("message", "❌ " + errorMessage);
        return result;
    }
}
