package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.UserClusterAssignment;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 用户聚类分配Mapper
 */
public interface UserClusterAssignmentMapper extends BaseMapper<UserClusterAssignment> {

    /**
     * 根据用户ID查询最新分配
     */
    @Select("SELECT * FROM user_cluster_assignments WHERE wx_user_id = #{wxUserId} " +
            "ORDER BY version DESC LIMIT 1")
    UserClusterAssignment selectByWxUserId(@Param("wxUserId") String wxUserId);

    /**
     * 查询聚类成员
     */
    @Select("SELECT * FROM user_cluster_assignments WHERE cluster_id = #{clusterId} " +
            "AND version = (SELECT MAX(version) FROM user_cluster_assignments) " +
            "ORDER BY distance_to_centroid ASC LIMIT #{limit}")
    List<UserClusterAssignment> selectClusterMembers(@Param("clusterId") Long clusterId,
                                                      @Param("limit") int limit);

    /**
     * 查询相似用户 (同聚类且距离相近)
     */
    @Select("SELECT a2.wx_user_id FROM user_cluster_assignments a1 " +
            "JOIN user_cluster_assignments a2 ON a1.cluster_id = a2.cluster_id " +
            "AND a1.version = a2.version " +
            "WHERE a1.wx_user_id = #{wxUserId} AND a2.wx_user_id != #{wxUserId} " +
            "ORDER BY ABS(a1.distance_to_centroid - a2.distance_to_centroid) ASC " +
            "LIMIT #{limit}")
    List<String> selectSimilarUsers(@Param("wxUserId") String wxUserId, @Param("limit") int limit);

    /**
     * 统计各聚类成员数
     */
    @Select("SELECT cluster_id, COUNT(*) as count FROM user_cluster_assignments " +
            "WHERE version = (SELECT MAX(version) FROM user_cluster_assignments) " +
            "GROUP BY cluster_id")
    List<java.util.Map<String, Object>> countByCluster();

    /**
     * 删除旧版本分配
     */
    @Select("DELETE FROM user_cluster_assignments WHERE version < #{version}")
    int deleteOldVersions(@Param("version") int version);

    /**
     * 查询边界用户
     */
    @Select("SELECT * FROM user_cluster_assignments WHERE boundary_user = true " +
            "AND version = (SELECT MAX(version) FROM user_cluster_assignments) " +
            "ORDER BY confidence ASC LIMIT #{limit}")
    List<UserClusterAssignment> selectBoundaryUsers(@Param("limit") int limit);

    /**
     * 批量插入或更新用户聚类分配
     * 使用 INSERT ON DUPLICATE KEY UPDATE 实现 UPSERT
     *
     * @param assignments 用户聚类分配列表
     * @return 影响行数
     */
    int batchInsertOrUpdate(@Param("list") List<UserClusterAssignment> assignments);
}
