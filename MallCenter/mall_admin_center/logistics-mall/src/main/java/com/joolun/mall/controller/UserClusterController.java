package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.UserCluster;
import com.joolun.mall.entity.UserClusterAssignment;
import com.joolun.mall.service.UserClusterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 用户聚类 API
 * 提供用户分群查询和管理功能
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recommend/clusters")
@Tag(name = "用户聚类", description = "用户分群和聚类管理API")
public class UserClusterController {

    private final UserClusterService userClusterService;

    /**
     * 获取所有聚类
     */
    @GetMapping
    @Operation(summary = "获取所有聚类", description = "返回当前活跃的所有用户聚类")
    public R<List<UserCluster>> getAllClusters() {
        try {
            List<UserCluster> clusters = userClusterService.getAllClusters();
            return R.ok(clusters);
        } catch (Exception e) {
            log.error("获取聚类列表失败", e);
            return R.fail("获取聚类列表失败: " + e.getMessage());
        }
    }

    /**
     * 获取聚类详情
     */
    @GetMapping("/{clusterId}")
    @Operation(summary = "获取聚类详情", description = "获取指定聚类的详细信息")
    public R<UserCluster> getClusterById(@PathVariable Long clusterId) {
        try {
            UserCluster cluster = userClusterService.getClusterById(clusterId);
            if (cluster == null) {
                return R.fail("聚类不存在");
            }
            return R.ok(cluster);
        } catch (Exception e) {
            log.error("获取聚类详情失败: clusterId={}", clusterId, e);
            return R.fail("获取聚类详情失败: " + e.getMessage());
        }
    }

    /**
     * 获取聚类成员
     */
    @GetMapping("/{clusterId}/members")
    @Operation(summary = "获取聚类成员", description = "获取指定聚类的用户成员列表")
    public R<List<UserClusterAssignment>> getClusterMembers(
            @PathVariable Long clusterId,
            @RequestParam(defaultValue = "50") int limit) {
        try {
            limit = Math.max(1, Math.min(limit, 200));
            List<UserClusterAssignment> members = userClusterService.getClusterMembers(clusterId, limit);
            return R.ok(members);
        } catch (Exception e) {
            log.error("获取聚类成员失败: clusterId={}", clusterId, e);
            return R.fail("获取聚类成员失败: " + e.getMessage());
        }
    }

    /**
     * 获取用户聚类分配
     */
    @GetMapping("/user/{wxUserId}")
    @Operation(summary = "获取用户聚类", description = "查询指定用户的聚类分配信息")
    public R<UserClusterAssignment> getUserClusterAssignment(@PathVariable String wxUserId) {
        try {
            UserClusterAssignment assignment = userClusterService.getUserClusterAssignment(wxUserId);
            if (assignment == null) {
                return R.fail("用户未分配聚类");
            }
            return R.ok(assignment);
        } catch (Exception e) {
            log.error("获取用户聚类失败: wxUserId={}", wxUserId, e);
            return R.fail("获取用户聚类失败: " + e.getMessage());
        }
    }

    /**
     * 为用户分配聚类
     */
    @PostMapping("/user/{wxUserId}/assign")
    @Operation(summary = "分配用户聚类", description = "为指定用户计算并分配最匹配的聚类")
    public R<UserClusterAssignment> assignUserToCluster(@PathVariable String wxUserId) {
        try {
            UserClusterAssignment assignment = userClusterService.assignUserToCluster(wxUserId);
            if (assignment == null) {
                return R.fail("聚类分配失败，可能没有可用聚类");
            }
            return R.ok(assignment, "聚类分配成功");
        } catch (Exception e) {
            log.error("分配用户聚类失败: wxUserId={}", wxUserId, e);
            return R.fail("分配用户聚类失败: " + e.getMessage());
        }
    }

    /**
     * 获取相似用户
     */
    @GetMapping("/user/{wxUserId}/similar")
    @Operation(summary = "获取相似用户", description = "获取与指定用户在同一聚类的相似用户")
    public R<List<String>> getSimilarUsers(
            @PathVariable String wxUserId,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            limit = Math.max(1, Math.min(limit, 50));
            List<String> similarUsers = userClusterService.getSimilarUsers(wxUserId, limit);
            return R.ok(similarUsers);
        } catch (Exception e) {
            log.error("获取相似用户失败: wxUserId={}", wxUserId, e);
            return R.fail("获取相似用户失败: " + e.getMessage());
        }
    }

    /**
     * 获取聚类统计
     */
    @GetMapping("/stats")
    @Operation(summary = "获取聚类统计", description = "获取聚类系统的统计信息")
    public R<Map<String, Object>> getClusterStats() {
        try {
            Map<String, Object> stats = userClusterService.getClusterStats();
            return R.ok(stats);
        } catch (Exception e) {
            log.error("获取聚类统计失败", e);
            return R.fail("获取聚类统计失败: " + e.getMessage());
        }
    }

    /**
     * 运行K-Means聚类
     * 注意: 此操作耗时较长，建议通过定时任务执行
     */
    @PostMapping("/run")
    @Operation(summary = "运行K-Means聚类", description = "手动触发K-Means聚类算法（耗时操作）")
    public R<Void> runKMeansClustering(
            @RequestParam(defaultValue = "6") int k) {
        try {
            log.info("手动触发K-Means聚类: k={}", k);
            k = Math.max(2, Math.min(k, 20));

            long startTime = System.currentTimeMillis();
            userClusterService.runKMeansClustering(k);
            long duration = System.currentTimeMillis() - startTime;

            log.info("K-Means聚类完成: k={}, 耗时={}ms", k, duration);
            return R.ok(null, "聚类完成，耗时 " + duration + "ms");
        } catch (Exception e) {
            log.error("运行K-Means聚类失败: k={}", k, e);
            return R.fail("运行K-Means聚类失败: " + e.getMessage());
        }
    }
}
