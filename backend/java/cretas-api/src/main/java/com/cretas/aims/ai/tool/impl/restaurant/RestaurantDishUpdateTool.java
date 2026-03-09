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
 * 修改菜品工具（写操作）
 *
 * 根据 id 或 name 定位菜品，更新 price/category/name 等字段。
 * 对应意图: RESTAURANT_DISH_UPDATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantDishUpdateTool extends AbstractBusinessTool {

    @Autowired
    private ProductTypeRepository productTypeRepository;

    @Override
    public String getToolName() {
        return "restaurant_dish_update";
    }

    @Override
    public String getDescription() {
        return "修改菜品信息，支持通过ID或名称定位菜品，可更新名称、价格、分类。" +
                "适用场景：调价、更换分类、修改菜品名称。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> id = new HashMap<>();
        id.put("type", "string");
        id.put("description", "菜品ID（id和name至少提供一个）");
        properties.put("id", id);

        Map<String, Object> name = new HashMap<>();
        name.put("type", "string");
        name.put("description", "菜品名称，用于定位菜品（id和name至少提供一个）");
        properties.put("name", name);

        Map<String, Object> newName = new HashMap<>();
        newName.put("type", "string");
        newName.put("description", "新菜品名称（可选）");
        properties.put("newName", newName);

        Map<String, Object> price = new HashMap<>();
        price.put("type", "number");
        price.put("description", "新价格（可选）");
        properties.put("price", price);

        Map<String, Object> category = new HashMap<>();
        category.put("type", "string");
        category.put("description", "新分类（可选）");
        properties.put("category", category);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList(); // id or name needed, validated in doExecute
    }

    @Override
    public boolean requiresPermission() {
        return true;
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行修改菜品 - 工厂ID: {}, 参数: {}", factoryId, params);

        String dishId = getString(params, "id");
        String dishName = getString(params, "name");

        if (dishId == null && dishName == null) {
            throw new IllegalArgumentException("请提供需要修改的菜品名称或ID");
        }

        ProductType dish = null;
        if (dishId != null) {
            dish = productTypeRepository.findByIdAndFactoryId(dishId, factoryId).orElse(null);
        }
        if (dish == null && dishName != null) {
            dish = productTypeRepository.findByFactoryIdAndName(factoryId, dishName.trim()).orElse(null);
        }

        if (dish == null) {
            return buildSimpleResult(
                    String.format("未找到菜品「%s」，请确认菜品名称或ID是否正确。",
                            dishName != null ? dishName : dishId), null);
        }

        boolean updated = false;
        String newNameStr = getString(params, "newName");
        if (newNameStr != null) {
            dish.setName(newNameStr.trim());
            updated = true;
        }
        BigDecimal price = getBigDecimal(params, "price");
        if (price != null) {
            dish.setUnitPrice(price);
            updated = true;
        }
        String category = getString(params, "category");
        if (category != null) {
            dish.setCategory(category);
            updated = true;
        }

        if (!updated) {
            return buildSimpleResult("请提供需要修改的字段（price/category/newName）。", null);
        }

        productTypeRepository.save(dish);
        log.info("更新菜品成功: factoryId={}, id={}, name={}", factoryId, dish.getId(), dish.getName());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", dish.getId());
        result.put("名称", dish.getName());
        result.put("单价", dish.getUnitPrice() != null ? "¥" + dish.getUnitPrice() : "未设置");
        result.put("分类", dish.getCategory() != null ? dish.getCategory() : "未分类");
        result.put("message", String.format("菜品「%s」已更新成功。", dish.getName()));

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "name", "请问要修改哪道菜品？请提供菜品名称。",
            "id", "请问要修改的菜品ID是什么？",
            "newName", "请问新的菜品名称是什么？",
            "price", "请问新的价格是多少？",
            "category", "请问新的分类是什么？"
        );
        return questions.get(paramName);
    }
}
