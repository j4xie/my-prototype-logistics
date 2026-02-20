package com.cretas.aims.service;

import com.cretas.aims.entity.config.SystemEnum;
import com.cretas.aims.entity.config.UnitOfMeasurement;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 系统枚举配置服务接口
 *
 * 提供枚举和计量单位的配置化管理:
 * - 支持工厂级别覆盖
 * - 带有本地缓存 (10分钟TTL)
 * - 兼容现有Java枚举类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface SystemEnumService {

    // ==================== 枚举查询 ====================

    /**
     * 获取指定枚举组的所有枚举值
     *
     * @param factoryId 工厂ID
     * @param enumGroup 枚举组 (如 PROCESSING_STAGE, QUALITY_STATUS)
     * @return 枚举列表 (工厂级覆盖优先)
     */
    List<SystemEnum> getEnumsByGroup(String factoryId, String enumGroup);

    /**
     * 获取单个枚举值
     *
     * @param factoryId 工厂ID
     * @param enumGroup 枚举组
     * @param enumCode  枚举代码
     * @return 枚举配置
     */
    Optional<SystemEnum> getEnum(String factoryId, String enumGroup, String enumCode);

    /**
     * 获取枚举的显示标签
     *
     * @param factoryId 工厂ID
     * @param enumGroup 枚举组
     * @param enumCode  枚举代码
     * @return 显示标签 (如果未找到则返回枚举代码本身)
     */
    String getEnumLabel(String factoryId, String enumGroup, String enumCode);

    /**
     * 获取枚举组的代码-标签映射
     *
     * @param factoryId 工厂ID
     * @param enumGroup 枚举组
     * @return Map<枚举代码, 显示标签>
     */
    Map<String, String> getEnumLabelsMap(String factoryId, String enumGroup);

    /**
     * 获取所有可用的枚举组
     *
     * @return 枚举组列表
     */
    List<String> getAllEnumGroups();

    /**
     * 验证枚举值是否有效
     *
     * @param factoryId 工厂ID
     * @param enumGroup 枚举组
     * @param enumCode  枚举代码
     * @return 是否有效
     */
    boolean isValidEnum(String factoryId, String enumGroup, String enumCode);

    // ==================== 枚举管理 ====================

    /**
     * 创建工厂级枚举覆盖
     *
     * @param systemEnum 枚举配置
     * @return 创建的枚举
     */
    SystemEnum createEnum(SystemEnum systemEnum);

    /**
     * 更新枚举配置
     *
     * @param systemEnum 枚举配置
     * @return 更新后的枚举
     */
    SystemEnum updateEnum(SystemEnum systemEnum);

    /**
     * 删除工厂级枚举覆盖 (仅非系统内置)
     *
     * @param factoryId 工厂ID
     * @param enumGroup 枚举组
     * @param enumCode  枚举代码
     */
    void deleteEnum(String factoryId, String enumGroup, String enumCode);

    // ==================== 计量单位查询 ====================

    /**
     * 获取指定分类的所有计量单位
     *
     * @param factoryId 工厂ID
     * @param category  分类 (WEIGHT, VOLUME, COUNT等)
     * @return 单位列表
     */
    List<UnitOfMeasurement> getUnitsByCategory(String factoryId, String category);

    /**
     * 获取所有可用的计量单位
     *
     * @param factoryId 工厂ID
     * @return 单位列表
     */
    List<UnitOfMeasurement> getAllUnits(String factoryId);

    /**
     * 获取单个计量单位
     *
     * @param factoryId 工厂ID
     * @param unitCode  单位代码
     * @return 单位配置
     */
    Optional<UnitOfMeasurement> getUnit(String factoryId, String unitCode);

    /**
     * 获取分类的基础单位
     *
     * @param factoryId 工厂ID
     * @param category  分类
     * @return 基础单位
     */
    Optional<UnitOfMeasurement> getBaseUnit(String factoryId, String category);

    /**
     * 获取所有单位分类
     *
     * @return 分类列表
     */
    List<String> getAllUnitCategories();

    // ==================== 单位换算 ====================

    /**
     * 单位换算
     *
     * @param factoryId  工厂ID
     * @param value      原始值
     * @param fromUnit   原始单位
     * @param toUnit     目标单位
     * @return 换算后的值
     */
    BigDecimal convertUnit(String factoryId, BigDecimal value, String fromUnit, String toUnit);

    /**
     * 转换为基础单位
     *
     * @param factoryId 工厂ID
     * @param value     原始值
     * @param fromUnit  原始单位
     * @return 基础单位的值
     */
    BigDecimal toBaseUnit(String factoryId, BigDecimal value, String fromUnit);

    /**
     * 从基础单位转换
     *
     * @param factoryId 工厂ID
     * @param baseValue 基础单位的值
     * @param toUnit    目标单位
     * @return 目标单位的值
     */
    BigDecimal fromBaseUnit(String factoryId, BigDecimal baseValue, String toUnit);

    // ==================== 计量单位管理 ====================

    /**
     * 创建工厂级单位配置
     *
     * @param unit 单位配置
     * @return 创建的单位
     */
    UnitOfMeasurement createUnit(UnitOfMeasurement unit);

    /**
     * 更新单位配置
     *
     * @param unit 单位配置
     * @return 更新后的单位
     */
    UnitOfMeasurement updateUnit(UnitOfMeasurement unit);

    /**
     * 删除工厂级单位配置 (仅非系统内置)
     *
     * @param factoryId 工厂ID
     * @param unitCode  单位代码
     */
    void deleteUnit(String factoryId, String unitCode);

    // ==================== 缓存管理 ====================

    /**
     * 清除指定工厂的枚举缓存
     *
     * @param factoryId 工厂ID
     */
    void clearEnumCache(String factoryId);

    /**
     * 清除指定工厂的单位缓存
     *
     * @param factoryId 工厂ID
     */
    void clearUnitCache(String factoryId);

    /**
     * 清除所有缓存
     */
    void clearAllCache();
}
