package com.cretas.aims.service;

import com.cretas.aims.dto.blueprint.*;
import com.cretas.aims.entity.config.FactoryTypeBlueprint;

import java.util.List;

/**
 * 工厂蓝图服务接口
 */
public interface FactoryBlueprintService {

    /**
     * 获取所有激活的蓝图
     */
    List<FactoryTypeBlueprint> getAllBlueprints();

    /**
     * 根据行业类型获取蓝图
     */
    List<FactoryTypeBlueprint> getBlueprintsByIndustryType(String industryType);

    /**
     * 获取蓝图详情
     */
    FactoryTypeBlueprint getBlueprintById(String id);

    /**
     * 创建蓝图
     */
    FactoryTypeBlueprint createBlueprint(CreateBlueprintRequest request);

    /**
     * 更新蓝图
     */
    FactoryTypeBlueprint updateBlueprint(String id, CreateBlueprintRequest request);

    /**
     * 删除蓝图（软删除）
     */
    void deleteBlueprint(String id);

    /**
     * 应用蓝图到工厂（核心功能）
     */
    BlueprintApplicationResult applyBlueprintToFactory(String blueprintId, ApplyBlueprintRequest request);

    /**
     * 预览蓝图应用效果（dry-run）
     */
    BlueprintApplicationResult previewBlueprintApplication(String blueprintId, String factoryId);

    /**
     * 从现有工厂生成蓝图
     */
    FactoryTypeBlueprint generateBlueprintFromFactory(GenerateBlueprintFromFactoryRequest request);

    /**
     * 获取工厂的蓝图应用历史
     */
    List<BlueprintApplicationResult> getFactoryApplicationHistory(String factoryId);
}
