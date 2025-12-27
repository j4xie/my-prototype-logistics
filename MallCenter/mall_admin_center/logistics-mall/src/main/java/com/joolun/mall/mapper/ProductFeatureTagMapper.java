package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.ProductFeatureTag;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 商品特征标签Mapper
 */
public interface ProductFeatureTagMapper extends BaseMapper<ProductFeatureTag> {

    /**
     * 查询商品的所有标签
     */
    @Select("SELECT * FROM product_feature_tags WHERE product_id = #{productId}")
    List<ProductFeatureTag> selectByProductId(@Param("productId") String productId);

    /**
     * 查询具有指定标签的商品ID列表
     */
    @Select("SELECT product_id FROM product_feature_tags " +
            "WHERE tag_type = #{tagType} AND tag_value = #{tagValue} ORDER BY weight DESC")
    List<String> selectProductIdsByTag(@Param("tagType") String tagType, @Param("tagValue") String tagValue);

    /**
     * 查询具有多个标签的商品 (用于推荐匹配)
     */
    @Select("<script>" +
            "SELECT product_id, SUM(weight) as total_weight FROM product_feature_tags " +
            "WHERE tag_value IN " +
            "<foreach collection='tagValues' item='item' open='(' separator=',' close=')'>" +
            "#{item}" +
            "</foreach>" +
            " GROUP BY product_id ORDER BY total_weight DESC LIMIT #{limit}" +
            "</script>")
    List<String> selectProductIdsByTags(@Param("tagValues") List<String> tagValues, @Param("limit") int limit);
}
