package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.LinUCBArmParameter;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * LinUCB 臂参数 Mapper
 */
public interface LinUCBArmParameterMapper extends BaseMapper<LinUCBArmParameter> {

    /**
     * 查询所有分类级别的臂参数
     */
    @Select("SELECT * FROM linucb_arm_parameters WHERE arm_type = 'category'")
    List<LinUCBArmParameter> selectAllCategoryArms();

    /**
     * 查询所有商品级别的臂参数
     */
    @Select("SELECT * FROM linucb_arm_parameters WHERE arm_type = 'product'")
    List<LinUCBArmParameter> selectAllProductArms();

    /**
     * 根据臂ID和类型查询
     */
    @Select("SELECT * FROM linucb_arm_parameters WHERE arm_id = #{armId} AND arm_type = #{armType}")
    LinUCBArmParameter selectByArmIdAndType(@Param("armId") String armId, @Param("armType") String armType);

    /**
     * 更新臂参数 (A矩阵、b向量、theta向量)
     */
    @Update("UPDATE linucb_arm_parameters SET " +
            "a_matrix = #{aMatrix}, " +
            "b_vector = #{bVector}, " +
            "theta_vector = #{thetaVector}, " +
            "selection_count = selection_count + 1, " +
            "update_time = NOW() " +
            "WHERE arm_id = #{armId} AND arm_type = #{armType}")
    int updateParameters(@Param("armId") String armId,
                         @Param("armType") String armType,
                         @Param("aMatrix") String aMatrix,
                         @Param("bVector") String bVector,
                         @Param("thetaVector") String thetaVector);

    /**
     * 更新反馈计数
     */
    @Update("UPDATE linucb_arm_parameters SET " +
            "positive_feedback_count = positive_feedback_count + #{positive}, " +
            "negative_feedback_count = negative_feedback_count + #{negative}, " +
            "cumulative_reward = cumulative_reward + #{reward}, " +
            "expected_ctr = (positive_feedback_count + #{positive}) / " +
            "  GREATEST(1, positive_feedback_count + #{positive} + negative_feedback_count + #{negative}), " +
            "update_time = NOW() " +
            "WHERE arm_id = #{armId} AND arm_type = #{armType}")
    int updateFeedback(@Param("armId") String armId,
                       @Param("armType") String armType,
                       @Param("positive") int positive,
                       @Param("negative") int negative,
                       @Param("reward") double reward);

    /**
     * 批量查询指定臂的参数
     */
    @Select("<script>" +
            "SELECT * FROM linucb_arm_parameters " +
            "WHERE arm_type = #{armType} AND arm_id IN " +
            "<foreach collection='armIds' item='armId' open='(' separator=',' close=')'>" +
            "#{armId}" +
            "</foreach>" +
            "</script>")
    List<LinUCBArmParameter> selectByArmIds(@Param("armIds") List<String> armIds,
                                             @Param("armType") String armType);

    /**
     * 查询预期CTR最高的臂 (用于利用阶段)
     */
    @Select("SELECT * FROM linucb_arm_parameters WHERE arm_type = #{armType} " +
            "ORDER BY expected_ctr DESC LIMIT #{limit}")
    List<LinUCBArmParameter> selectTopByExpectedCtr(@Param("armType") String armType,
                                                     @Param("limit") int limit);

    /**
     * 查询选择次数最少的臂 (用于冷启动)
     */
    @Select("SELECT * FROM linucb_arm_parameters WHERE arm_type = #{armType} " +
            "ORDER BY selection_count ASC LIMIT #{limit}")
    List<LinUCBArmParameter> selectLeastSelected(@Param("armType") String armType,
                                                  @Param("limit") int limit);
}
