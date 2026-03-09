package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.repository.ProductTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 新增菜品工具（写操作）
 *
 * 创建新的 ProductType 记录。
 * 对应意图: RESTAURANT_DISH_CREATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantDishCreateTool extends AbstractBusinessTool {

    @Autowired
    private ProductTypeRepository productTypeRepository;

    @Override
    public String getToolName() {
        return "restaurant_dish_create";
    }

    @Override
    public String getDescription() {
        return "新增菜品，创建菜品记录。需要提供菜品名称，可选价格和分类。" +
                "适用场景：添加新菜品、扩充菜单。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> name = new HashMap<>();
        name.put("type", "string");
        name.put("description", "菜品名称（必需）");
        properties.put("name", name);

        Map<String, Object> price = new HashMap<>();
        price.put("type", "number");
        price.put("description", "菜品单价（可选）");
        properties.put("price", price);

        Map<String, Object> category = new HashMap<>();
        category.put("type", "string");
        category.put("description", "菜品分类（可选），如：川菜、粤菜、湘菜");
        properties.put("category", category);

        schema.put("properties", properties);
        schema.put("required", List.of("name"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("name");
    }

    @Override
    public boolean requiresPermission() {
        return true;
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行新增菜品 - 工厂ID: {}, 参数: {}", factoryId, params);

        String name = getString(params, "name");
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("请提供菜品名称（name）");
        }

        // 检查重名
        if (productTypeRepository.findByFactoryIdAndName(factoryId, name.trim()).isPresent()) {
            return buildSimpleResult(String.format("菜品「%s」已存在，请勿重复添加。", name.trim()), null);
        }

        Long userId = getUserId(context);

        ProductType dish = new ProductType();
        dish.setFactoryId(factoryId);
        dish.setName(name.trim());
        dish.setCode("DISH-" + System.currentTimeMillis());
        dish.setUnit("份");
        dish.setIsActive(true);
        dish.setCreatedBy(userId != null ? userId : 0L);

        BigDecimal price = getBigDecimal(params, "price");
        if (price != null) {
            dish.setUnitPrice(price);
        }

        String category = getString(params, "category");
        if (category != null) {
            dish.setCategory(category);
        }

        productTypeRepository.save(dish);
        log.info("新增菜品成功: factoryId={}, name={}, id={}", factoryId, name, dish.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", dish.getId());
        result.put("名称", dish.getName());
        result.put("编码", dish.getCode());
        result.put("单价", dish.getUnitPrice() != null ? "¥" + dish.getUnitPrice() : "未设置");
        result.put("分类", dish.getCategory() != null ? dish.getCategory() : "未分类");
        result.put("message", String.format("菜品「%s」已成功添加。", name.trim()));

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "name", "请问要添加的菜品名称是什么？",
            "price", "请问菜品单价是多少？（可选）",
            "category", "请问菜品属于哪个分类？如川菜、粤菜等（可选）"
        );
        return questions.get(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "name", "菜品名称",
            "price", "单价",
            "category", "分类"
        );
        return displayNames.getOrDefault(paramName, paramName);
    }
}
