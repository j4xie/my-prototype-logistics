package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.RegionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 区域实体 DTO
 *
 * 用于表示从自然语言查询中识别出的地理区域实体，
 * 包含匹配文本、区域类型、标准化名称和位置信息。
 *
 * 使用示例：
 * - 查询 "华东地区销售额" → RegionEntity(text="华东地区", type=REGION, normalizedName="华东")
 * - 查询 "浙江省的订单" → RegionEntity(text="浙江省", type=PROVINCE, normalizedName="浙江")
 * - 查询 "杭州市场分析" → RegionEntity(text="杭州", type=CITY, normalizedName="杭州")
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegionEntity {

    /**
     * 匹配的原始文本
     * 从用户查询中提取的区域相关文本片段
     * 例如："华东"、"浙江省"、"杭州市"
     */
    private String text;

    /**
     * 区域类型
     * REGION: 大区（华东、华南等）
     * PROVINCE: 省/直辖市/自治区
     * CITY: 城市
     */
    private RegionType type;

    /**
     * 标准化名称
     * 统一规范后的区域名称，用于数据库查询和数据匹配
     * 例如："浙江省" → "浙江"，"杭州市" → "杭州"
     */
    private String normalizedName;

    /**
     * 父级区域
     * 对于省份：父级为大区名称
     * 对于城市：父级为省份名称
     */
    private String parentRegion;

    /**
     * 匹配置信度 (0.0 - 1.0)
     * 精确匹配为 1.0，别名匹配为 0.9
     */
    @Builder.Default
    private double confidence = 1.0;

    /**
     * 是否通过别名匹配
     */
    @Builder.Default
    private boolean matchedByAlias = false;

    /**
     * 匹配到的别名（如果 matchedByAlias 为 true）
     */
    private String matchedAlias;

    /**
     * 在原始查询文本中的起始位置（包含）
     * 用于文本高亮和定位
     */
    private int startIndex;

    /**
     * 在原始查询文本中的结束位置（不包含）
     * 用于文本高亮和定位
     */
    private int endIndex;

    // ==================== 便捷构造方法 ====================

    /**
     * 创建大区实体
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return RegionEntity
     */
    public static RegionEntity region(String text, String normalizedName, int startIndex, int endIndex) {
        return RegionEntity.builder()
                .text(text)
                .type(RegionType.REGION)
                .normalizedName(normalizedName)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建大区实体（通过别名匹配）
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param alias 匹配到的别名
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return RegionEntity
     */
    public static RegionEntity regionByAlias(String text, String normalizedName, String alias,
                                              int startIndex, int endIndex) {
        return RegionEntity.builder()
                .text(text)
                .type(RegionType.REGION)
                .normalizedName(normalizedName)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .matchedByAlias(true)
                .matchedAlias(alias)
                .confidence(0.9)
                .build();
    }

    /**
     * 创建省级实体
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param parentRegion 所属大区
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return RegionEntity
     */
    public static RegionEntity province(String text, String normalizedName, String parentRegion,
                                         int startIndex, int endIndex) {
        return RegionEntity.builder()
                .text(text)
                .type(RegionType.PROVINCE)
                .normalizedName(normalizedName)
                .parentRegion(parentRegion)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建省级实体（通过别名匹配）
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param parentRegion 所属大区
     * @param alias 匹配到的别名
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return RegionEntity
     */
    public static RegionEntity provinceByAlias(String text, String normalizedName, String parentRegion,
                                                String alias, int startIndex, int endIndex) {
        return RegionEntity.builder()
                .text(text)
                .type(RegionType.PROVINCE)
                .normalizedName(normalizedName)
                .parentRegion(parentRegion)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .matchedByAlias(true)
                .matchedAlias(alias)
                .confidence(0.9)
                .build();
    }

    /**
     * 创建城市实体
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param parentProvince 所属省份
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return RegionEntity
     */
    public static RegionEntity city(String text, String normalizedName, String parentProvince,
                                     int startIndex, int endIndex) {
        return RegionEntity.builder()
                .text(text)
                .type(RegionType.CITY)
                .normalizedName(normalizedName)
                .parentRegion(parentProvince)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    // ==================== 工具方法 ====================

    /**
     * 获取匹配文本的长度
     *
     * @return 文本长度
     */
    public int getTextLength() {
        return text != null ? text.length() : 0;
    }

    /**
     * 判断是否为大区类型
     *
     * @return true 如果是大区
     */
    public boolean isRegion() {
        return type == RegionType.REGION;
    }

    /**
     * 判断是否为省级类型
     *
     * @return true 如果是省/直辖市/自治区
     */
    public boolean isProvince() {
        return type == RegionType.PROVINCE;
    }

    /**
     * 判断是否为城市类型
     *
     * @return true 如果是城市
     */
    public boolean isCity() {
        return type == RegionType.CITY;
    }

    /**
     * 判断实体是否有效
     *
     * @return true 如果包含必要信息
     */
    public boolean isValid() {
        return text != null && !text.isEmpty()
                && type != null
                && normalizedName != null && !normalizedName.isEmpty()
                && startIndex >= 0
                && endIndex > startIndex;
    }
}
