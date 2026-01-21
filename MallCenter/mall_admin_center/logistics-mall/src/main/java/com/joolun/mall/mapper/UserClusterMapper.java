package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.UserCluster;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 用户聚类Mapper
 */
public interface UserClusterMapper extends BaseMapper<UserCluster> {

    /**
     * 查询所有激活的聚类
     */
    @Select("SELECT * FROM user_clusters WHERE active = true ORDER BY id")
    List<UserCluster> selectActiveClusters();

    /**
     * 查询最新版本号
     */
    @Select("SELECT COALESCE(MAX(version), 0) FROM user_clusters")
    int selectMaxVersion();

    /**
     * 停用旧版本聚类
     */
    @Update("UPDATE user_clusters SET active = false, update_time = NOW() WHERE version < #{version}")
    int deactivateOldVersions(@Param("version") int version);

    /**
     * 根据聚类名称查询
     */
    @Select("SELECT * FROM user_clusters WHERE cluster_name = #{clusterName} AND active = true")
    UserCluster selectByClusterName(@Param("clusterName") String clusterName);

    /**
     * 更新聚类成员数量
     */
    @Update("UPDATE user_clusters SET member_count = #{memberCount}, update_time = NOW() WHERE id = #{clusterId}")
    int updateMemberCount(@Param("clusterId") Long clusterId, @Param("memberCount") int memberCount);

    /**
     * 批量更新聚类成员数量
     */
    @Update("UPDATE user_clusters c SET member_count = " +
            "(SELECT COUNT(*) FROM user_cluster_assignments a WHERE a.cluster_id = c.id AND a.version = c.version), " +
            "update_time = NOW() " +
            "WHERE c.active = true")
    int batchUpdateMemberCounts();
}
