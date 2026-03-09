package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 创建采购单工具（写操作）
 *
 * 对应意图: RESTAURANT_PROCUREMENT_CREATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantProcurementCreateTool extends AbstractBusinessTool {

    @Autowired
    private PurchaseOrderRepository purchaseOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_procurement_create";
    }

    @Override
    public String getDescription() {
        return "创建采购单（草稿状态）。需要提供供应商ID，可选备注和预计交货日期。" +
                "适用场景：发起采购、食材补货。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> supplierId = new HashMap<>();
        supplierId.put("type", "string");
        supplierId.put("description", "供应商ID（必需）");
        properties.put("supplierId", supplierId);

        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "备注（可选）");
        properties.put("remark", remark);

        Map<String, Object> expectedDeliveryDate = new HashMap<>();
        expectedDeliveryDate.put("type", "string");
        expectedDeliveryDate.put("description", "预计交货日期，格式: yyyy-MM-dd（可选）");
        expectedDeliveryDate.put("format", "date");
        properties.put("expectedDeliveryDate", expectedDeliveryDate);

        schema.put("properties", properties);
        schema.put("required", List.of("supplierId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("supplierId");
    }

    @Override
    public boolean requiresPermission() {
        return true;
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行创建采购单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String supplierId = getString(params, "supplierId");
        if (supplierId == null || supplierId.trim().isEmpty()) {
            throw new IllegalArgumentException("请提供供应商ID（supplierId）");
        }

        Long userId = getUserId(context);

        // 生成采购单号
        long todayCount = purchaseOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());
        String orderNumber = String.format("PO-%s-%03d", LocalDate.now().toString().replace("-", ""), todayCount + 1);

        PurchaseOrder po = new PurchaseOrder();
        po.setFactoryId(factoryId);
        po.setOrderNumber(orderNumber);
        po.setSupplierId(supplierId.trim());
        po.setOrderDate(LocalDate.now());
        po.setStatus(PurchaseOrderStatus.DRAFT);
        po.setCreatedBy(userId != null ? userId : 0L);

        String remark = getString(params, "remark");
        if (remark != null) {
            po.setRemark(remark);
        }

        String expectedDeliveryDateStr = getString(params, "expectedDeliveryDate");
        if (expectedDeliveryDateStr != null) {
            try {
                po.setExpectedDeliveryDate(LocalDate.parse(expectedDeliveryDateStr));
            } catch (Exception ignored) {}
        }

        purchaseOrderRepository.save(po);
        log.info("创建采购单成功: factoryId={}, orderNumber={}, id={}", factoryId, orderNumber, po.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("采购单号", orderNumber);
        result.put("id", po.getId());
        result.put("供应商ID", supplierId);
        result.put("状态", "草稿");
        result.put("下一步", "请在「采购管理」中添加采购明细（食材种类、数量、单价），然后提交审批。");
        result.put("message", String.format("采购单「%s」已创建（草稿状态），请在采购管理中完善明细。", orderNumber));

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "supplierId", "请问要向哪个供应商采购？请提供供应商ID。",
            "remark", "请问需要添加备注吗？（可选）",
            "expectedDeliveryDate", "请问预计交货日期是？格式: yyyy-MM-dd（可选）"
        );
        return questions.get(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "supplierId", "供应商ID",
            "remark", "备注",
            "expectedDeliveryDate", "预计交货日期"
        );
        return displayNames.getOrDefault(paramName, paramName);
    }
}
