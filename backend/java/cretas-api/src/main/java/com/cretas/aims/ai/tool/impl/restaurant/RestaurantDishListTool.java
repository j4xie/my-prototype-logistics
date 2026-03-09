package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.repository.ProductTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 餐饮菜品列表查询工具
 *
 * 从 product_types 表中查询该门店的菜品目录。
 * 对应意图: RESTAURANT_DISH_LIST
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantDishListTool extends AbstractBusinessTool {

    @Autowired
    private ProductTypeRepository productTypeRepository;

    @Override
    public String getToolName() {
        return "restaurant_dish_list";
    }

    @Override
    public String getDescription() {
        return "查看餐饮门店的菜品列表。返回所有在售菜品的名称、编码、分类等信息。" +
                "适用场景：查看菜单、浏览菜品目录、获取菜品概览。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", Collections.emptyMap());
        schema.put("required", Collections.emptyList());
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行菜品列表查询 - 工厂ID: {}", factoryId);

        List<ProductType> dishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);

        if (dishes.isEmpty()) {
            return buildSimpleResult("当前菜品目录为空。请先在「菜品管理」中添加菜品信息。", null);
        }

        List<Map<String, Object>> dishList = dishes.stream().map(d -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", d.getId());
            item.put("名称", d.getName());
            item.put("编码", d.getCode());
            item.put("分类", d.getCategory() != null ? d.getCategory() : "-");
            item.put("状态", Boolean.TRUE.equals(d.getIsActive()) ? "在售" : "下架");
            return item;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCount", dishes.size());
        result.put("dishes", dishList);

        log.info("菜品列表查询完成 - 共 {} 道菜品", dishes.size());
        return result;
    }
}
