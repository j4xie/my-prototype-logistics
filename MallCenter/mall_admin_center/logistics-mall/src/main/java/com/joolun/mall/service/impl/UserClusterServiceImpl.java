package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.UserCluster;
import com.joolun.mall.entity.UserClusterAssignment;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.entity.UserRecommendationProfile;
import com.joolun.mall.mapper.UserClusterAssignmentMapper;
import com.joolun.mall.mapper.UserClusterMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import com.joolun.mall.mapper.UserRecommendationProfileMapper;
import com.joolun.mall.service.FeatureEngineeringService;
import com.joolun.mall.service.UserClusterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 用户聚类服务实现
 *
 * K-Means算法实现:
 * - K = 6 (默认，可配置)
 * - MAX_ITERATIONS = 100
 * - CONVERGENCE_THRESHOLD = 0.001
 * - 使用K-Means++进行质心初始化
 * - 使用欧氏距离
 *
 * 用户特征向量 (48维) - 优化点8扩展:
 * [0-9]:   品类偏好 (Top 10品类归一化权重)
 * [10-14]: 价格偏好 (5维: 极低/低/中/高/极高)
 * [15-19]: 购买频率 (5维: 更细粒度)
 * [20-26]: 活跃时段 (7维: 凌晨/早晨/上午/中午/下午/晚间/深夜)
 * [27-31]: 商户偏好 (5维: Top5商户权重)
 * [32-36]: 行为模式 (5维: 复购率/篮子大小/浏览深度/决策速度/价格敏感度)
 * [37-41]: 客单价分布 (5维)
 * [42-44]: 新品接受度 (3维: 低/中/高)
 * [45-47]: 成熟度+活跃度+探索度 (3维)
 *
 * @author UserCluster Enhancement
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserClusterServiceImpl implements UserClusterService {

    private final UserClusterMapper userClusterMapper;
    private final UserClusterAssignmentMapper userClusterAssignmentMapper;
    private final UserRecommendationProfileMapper userRecommendationProfileMapper;
    private final UserInterestTagMapper userInterestTagMapper;
    private final FeatureEngineeringService featureEngineeringService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // K-Means 参数
    private static final int MAX_ITERATIONS = 100;
    private static final double CONVERGENCE_THRESHOLD = 0.001;
    private static final double BOUNDARY_USER_RATIO_THRESHOLD = 1.2;  // 距离比 < 1.2 为边界用户

    // Redis 缓存
    private static final String CLUSTER_CACHE_PREFIX = "user:cluster:";
    private static final long CLUSTER_CACHE_TTL_HOURS = 24;

    // 默认聚类配置
    private static final Map<Integer, ClusterConfig> DEFAULT_CLUSTER_CONFIGS = new LinkedHashMap<>();
    static {
        DEFAULT_CLUSTER_CONFIGS.put(0, new ClusterConfig("火锅店采购", "肉类、火锅底料、蔬菜为主", 
                Arrays.asList("肉类", "火锅底料", "蔬菜")));
        DEFAULT_CLUSTER_CONFIGS.put(1, new ClusterConfig("快餐店采购", "速食、调味品、粮油为主",
                Arrays.asList("速食", "调味品", "粮油")));
        DEFAULT_CLUSTER_CONFIGS.put(2, new ClusterConfig("烘焙店采购", "烘焙原料、乳制品为主",
                Arrays.asList("烘焙原料", "乳制品", "糖类")));
        DEFAULT_CLUSTER_CONFIGS.put(3, new ClusterConfig("高端餐厅", "进口食材、海鲜为主",
                Arrays.asList("进口食材", "海鲜", "高端肉类")));
        DEFAULT_CLUSTER_CONFIGS.put(4, new ClusterConfig("社区团购", "蔬果、日用品为主",
                Arrays.asList("蔬菜", "水果", "日用品")));
        DEFAULT_CLUSTER_CONFIGS.put(5, new ClusterConfig("新用户群", "默认聚类，等待更多行为数据",
                Arrays.asList("热门商品", "新品推荐")));
    }

    // ==================== 聚类运行 ====================

    @Override
    @Transactional
    public void runKMeansClustering(int k) {
        log.info("开始K-Means聚类, k={}", k);
        long startTime = System.currentTimeMillis();

        try {
            // 1. 获取所有有画像的用户
            List<UserRecommendationProfile> profiles = getAllUserProfiles();
            if (profiles.isEmpty()) {
                log.warn("没有找到用户画像数据，跳过聚类");
                return;
            }

            log.info("加载用户画像: {} 个用户", profiles.size());

            // 2. 构建用户特征向量
            Map<String, double[]> userFeatures = new HashMap<>();
            for (UserRecommendationProfile profile : profiles) {
                double[] features = buildUserFeatureVector(profile);
                userFeatures.put(profile.getWxUserId(), features);
            }

            log.info("构建特征向量完成: {} 个用户", userFeatures.size());

            // 3. K-Means++ 初始化质心
            List<double[]> centroids = initializeCentroidsKMeansPlusPlus(
                    new ArrayList<>(userFeatures.values()), k);

            log.info("K-Means++初始化完成: {} 个质心", centroids.size());

            // 4. 迭代优化
            Map<String, Integer> assignments = new HashMap<>();
            for (int iter = 0; iter < MAX_ITERATIONS; iter++) {
                // 分配阶段: 每个用户分配到最近的质心
                Map<String, Integer> newAssignments = assignToClusters(userFeatures, centroids);

                // 更新阶段: 重新计算质心
                List<double[]> newCentroids = updateCentroids(userFeatures, newAssignments, k);

                // 检查收敛
                double maxShift = calculateMaxCentroidShift(centroids, newCentroids);
                log.debug("迭代 {}: 最大质心偏移 = {}", iter, maxShift);

                centroids = newCentroids;
                assignments = newAssignments;

                if (maxShift < CONVERGENCE_THRESHOLD) {
                    log.info("K-Means在第{}次迭代后收敛", iter + 1);
                    break;
                }
            }

            // 5. 保存聚类结果
            int newVersion = userClusterMapper.selectMaxVersion() + 1;
            saveClusters(centroids, assignments, userFeatures, newVersion);

            // 6. 停用旧版本
            userClusterMapper.deactivateOldVersions(newVersion);

            // 7. 清除缓存
            clearClusterCache();

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("K-Means聚类完成: k={}, 用户数={}, 耗时={}ms, 版本={}",
                    k, userFeatures.size(), elapsed, newVersion);

        } catch (Exception e) {
            log.error("K-Means聚类失败", e);
            throw new RuntimeException("聚类失败: " + e.getMessage(), e);
        }
    }

    @Override
    @Scheduled(cron = "0 0 3 * * SUN")  // 每周日凌晨3点
    public void weeklyUserClustering() {
        log.info("开始每周用户聚类任务");
        try {
            runKMeansClustering(DEFAULT_K);
        } catch (Exception e) {
            log.error("每周聚类任务失败", e);
        }
    }

    // ==================== 聚类查询 ====================

    @Override
    public UserClusterAssignment getUserClusterAssignment(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return null;
        }

        // 尝试从缓存获取
        String cacheKey = CLUSTER_CACHE_PREFIX + "assignment:" + wxUserId;
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, UserClusterAssignment.class);
            }
        } catch (Exception e) {
            log.debug("读取缓存失败: {}", e.getMessage());
        }

        // 从数据库查询
        UserClusterAssignment assignment = userClusterAssignmentMapper.selectByWxUserId(wxUserId);
        
        // 缓存结果
        if (assignment != null) {
            try {
                redisTemplate.opsForValue().set(cacheKey, 
                        objectMapper.writeValueAsString(assignment),
                        CLUSTER_CACHE_TTL_HOURS, TimeUnit.HOURS);
            } catch (Exception e) {
                log.debug("写入缓存失败: {}", e.getMessage());
            }
        }

        return assignment;
    }

    @Override
    public List<UserCluster> getAllClusters() {
        return userClusterMapper.selectActiveClusters();
    }

    @Override
    public UserCluster getClusterById(Long clusterId) {
        if (clusterId == null) {
            return null;
        }
        return userClusterMapper.selectById(clusterId);
    }

    @Override
    public List<UserClusterAssignment> getClusterMembers(Long clusterId, int limit) {
        if (clusterId == null || limit <= 0) {
            return Collections.emptyList();
        }
        return userClusterAssignmentMapper.selectClusterMembers(clusterId, limit);
    }

    // ==================== 用户分配 ====================

    @Override
    @Transactional
    public UserClusterAssignment assignUserToCluster(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return null;
        }

        // 检查是否已有分配
        UserClusterAssignment existing = getUserClusterAssignment(wxUserId);
        if (existing != null) {
            return existing;
        }

        // 获取用户画像
        UserRecommendationProfile profile = userRecommendationProfileMapper.selectByWxUserId(wxUserId);
        if (profile == null) {
            log.debug("用户画像不存在, 分配到新用户群: wxUserId={}", wxUserId);
            return assignToNewUserCluster(wxUserId);
        }

        // 构建特征向量
        double[] features = buildUserFeatureVector(profile);

        // 获取所有聚类中心
        List<UserCluster> clusters = getAllClusters();
        if (clusters.isEmpty()) {
            log.warn("没有激活的聚类，分配到新用户群");
            return assignToNewUserCluster(wxUserId);
        }

        // 找到最近的聚类
        UserCluster nearestCluster = null;
        UserCluster secondNearestCluster = null;
        double minDistance = Double.MAX_VALUE;
        double secondMinDistance = Double.MAX_VALUE;

        for (UserCluster cluster : clusters) {
            double[] centroid = parseCentroidVector(cluster.getCentroidVector());
            double distance = euclideanDistance(features, centroid);

            if (distance < minDistance) {
                secondMinDistance = minDistance;
                secondNearestCluster = nearestCluster;
                minDistance = distance;
                nearestCluster = cluster;
            } else if (distance < secondMinDistance) {
                secondMinDistance = distance;
                secondNearestCluster = cluster;
            }
        }

        if (nearestCluster == null) {
            return assignToNewUserCluster(wxUserId);
        }

        // 创建分配记录
        UserClusterAssignment assignment = new UserClusterAssignment();
        assignment.setWxUserId(wxUserId);
        assignment.setClusterId(nearestCluster.getId());
        assignment.setFeatureVector(serializeVector(features));
        assignment.setDistanceToCentroid(minDistance);
        
        // 计算置信度 (基于距离差异)
        double confidence = 1.0 - (minDistance / (minDistance + secondMinDistance + 0.001));
        assignment.setConfidence(confidence);
        
        // 次近聚类信息
        if (secondNearestCluster != null) {
            assignment.setSecondNearestClusterId(secondNearestCluster.getId());
            assignment.setDistanceToSecondNearest(secondMinDistance);
        }
        
        assignment.setVersion(nearestCluster.getVersion());
        assignment.setBoundaryUser(secondMinDistance / minDistance < BOUNDARY_USER_RATIO_THRESHOLD);
        assignment.setAssignmentTime(LocalDateTime.now());

        userClusterAssignmentMapper.insert(assignment);

        // 更新聚类成员数
        userClusterMapper.updateMemberCount(nearestCluster.getId(), 
                nearestCluster.getMemberCount() + 1);

        // 清除缓存
        String cacheKey = CLUSTER_CACHE_PREFIX + "assignment:" + wxUserId;
        redisTemplate.delete(cacheKey);

        log.info("用户分配到聚类: wxUserId={}, cluster={}, distance={}, confidence={}",
                wxUserId, nearestCluster.getClusterName(), minDistance, confidence);

        return assignment;
    }

    @Override
    public List<String> getSimilarUsers(String wxUserId, int limit) {
        if (wxUserId == null || wxUserId.isEmpty() || limit <= 0) {
            return Collections.emptyList();
        }
        return userClusterAssignmentMapper.selectSimilarUsers(wxUserId, limit);
    }

    // ==================== 统计与监控 ====================

    @Override
    public Map<String, Object> getClusterStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        try {
            // 获取所有激活聚类
            List<UserCluster> clusters = getAllClusters();
            stats.put("clusterCount", clusters.size());

            // 计算总用户数和分布
            int totalUsers = 0;
            Map<String, Integer> distribution = new LinkedHashMap<>();
            double totalAvgDistance = 0;

            for (UserCluster cluster : clusters) {
                int memberCount = cluster.getMemberCount() != null ? cluster.getMemberCount() : 0;
                totalUsers += memberCount;
                distribution.put(cluster.getClusterName(), memberCount);
                if (cluster.getAvgDistance() != null) {
                    totalAvgDistance += cluster.getAvgDistance();
                }
            }

            stats.put("totalUsers", totalUsers);
            stats.put("avgClusterSize", clusters.isEmpty() ? 0 : totalUsers / clusters.size());
            stats.put("clusterDistribution", distribution);
            stats.put("avgIntraClusterDistance", clusters.isEmpty() ? 0 : totalAvgDistance / clusters.size());

            // 最后聚类时间
            LocalDateTime lastClusterTime = clusters.stream()
                    .filter(c -> c.getLastClusterTime() != null)
                    .map(UserCluster::getLastClusterTime)
                    .max(LocalDateTime::compareTo)
                    .orElse(null);
            stats.put("lastClusterTime", lastClusterTime);

            // 边界用户数
            List<UserClusterAssignment> boundaryUsers = userClusterAssignmentMapper.selectBoundaryUsers(1000);
            stats.put("boundaryUserCount", boundaryUsers.size());

            // 当前版本
            int currentVersion = userClusterMapper.selectMaxVersion();
            stats.put("currentVersion", currentVersion);

        } catch (Exception e) {
            log.error("获取聚类统计失败", e);
            stats.put("error", e.getMessage());
        }

        return stats;
    }

    // ==================== K-Means 核心算法 ====================

    /**
     * K-Means++ 质心初始化
     * 选择距离已选质心较远的点作为新质心，以获得更好的初始分布
     */
    private List<double[]> initializeCentroidsKMeansPlusPlus(List<double[]> features, int k) {
        if (features.isEmpty() || k <= 0) {
            return Collections.emptyList();
        }

        Random random = new Random(42);  // 固定种子确保可重复性
        List<double[]> centroids = new ArrayList<>();

        // 1. 随机选择第一个质心
        centroids.add(features.get(random.nextInt(features.size())).clone());

        // 2. 选择剩余质心
        for (int i = 1; i < k && i < features.size(); i++) {
            // 计算每个点到最近质心的距离平方
            double[] distances = new double[features.size()];
            double totalDistance = 0;

            for (int j = 0; j < features.size(); j++) {
                double minDist = Double.MAX_VALUE;
                for (double[] centroid : centroids) {
                    double dist = euclideanDistance(features.get(j), centroid);
                    minDist = Math.min(minDist, dist);
                }
                distances[j] = minDist * minDist;  // 距离平方
                totalDistance += distances[j];
            }

            // 按概率选择下一个质心 (距离越远概率越大)
            double threshold = random.nextDouble() * totalDistance;
            double cumulative = 0;
            for (int j = 0; j < features.size(); j++) {
                cumulative += distances[j];
                if (cumulative >= threshold) {
                    centroids.add(features.get(j).clone());
                    break;
                }
            }

            // 确保添加了质心
            if (centroids.size() <= i) {
                centroids.add(features.get(random.nextInt(features.size())).clone());
            }
        }

        return centroids;
    }

    /**
     * 分配阶段: 将每个用户分配到最近的质心
     */
    private Map<String, Integer> assignToClusters(Map<String, double[]> userFeatures,
                                                   List<double[]> centroids) {
        Map<String, Integer> assignments = new HashMap<>();

        for (Map.Entry<String, double[]> entry : userFeatures.entrySet()) {
            String userId = entry.getKey();
            double[] features = entry.getValue();

            int nearestCluster = 0;
            double minDistance = Double.MAX_VALUE;

            for (int i = 0; i < centroids.size(); i++) {
                double distance = euclideanDistance(features, centroids.get(i));
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestCluster = i;
                }
            }

            assignments.put(userId, nearestCluster);
        }

        return assignments;
    }

    /**
     * 更新阶段: 重新计算质心
     */
    private List<double[]> updateCentroids(Map<String, double[]> userFeatures,
                                            Map<String, Integer> assignments,
                                            int k) {
        List<double[]> newCentroids = new ArrayList<>();
        
        for (int i = 0; i < k; i++) {
            List<double[]> clusterMembers = new ArrayList<>();
            
            for (Map.Entry<String, Integer> entry : assignments.entrySet()) {
                if (entry.getValue() == i) {
                    clusterMembers.add(userFeatures.get(entry.getKey()));
                }
            }

            if (clusterMembers.isEmpty()) {
                // 空聚类保持原质心或随机选择
                newCentroids.add(new double[FEATURE_DIM]);
            } else {
                // 计算成员均值
                double[] centroid = new double[FEATURE_DIM];
                for (double[] member : clusterMembers) {
                    for (int j = 0; j < FEATURE_DIM; j++) {
                        centroid[j] += member[j];
                    }
                }
                for (int j = 0; j < FEATURE_DIM; j++) {
                    centroid[j] /= clusterMembers.size();
                }
                newCentroids.add(centroid);
            }
        }

        return newCentroids;
    }

    /**
     * 计算质心最大偏移量 (用于收敛检测)
     */
    private double calculateMaxCentroidShift(List<double[]> oldCentroids, List<double[]> newCentroids) {
        double maxShift = 0;
        for (int i = 0; i < oldCentroids.size() && i < newCentroids.size(); i++) {
            double shift = euclideanDistance(oldCentroids.get(i), newCentroids.get(i));
            maxShift = Math.max(maxShift, shift);
        }
        return maxShift;
    }

    /**
     * 欧氏距离
     */
    private double euclideanDistance(double[] a, double[] b) {
        if (a == null || b == null || a.length != b.length) {
            return Double.MAX_VALUE;
        }
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            double diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    // ==================== 特征构建 ====================

    /**
     * 构建用户特征向量 (48维) - 优化点8扩展
     *
     * 新特征布局:
     * [0-9]:   品类偏好 (Top 10品类归一化权重, 原Top5)
     * [10-14]: 价格偏好 (5维: 极低/低/中/高/极高)
     * [15-19]: 购买频率 (5维: 更细粒度)
     * [20-26]: 活跃时段 (7维: 凌晨/早晨/上午/中午/下午/晚间/深夜)
     * [27-31]: 商户偏好 (5维: Top5商户权重)
     * [32-36]: 行为模式 (5维: 复购率/篮子大小/浏览深度/决策速度/价格敏感度)
     * [37-41]: 客单价分布 (5维)
     * [42-44]: 新品接受度 (3维: 低/中/高)
     * [45-47]: 成熟度+活跃度+探索度 (3维)
     */
    private double[] buildUserFeatureVector(UserRecommendationProfile profile) {
        double[] features = new double[FEATURE_DIM];
        Arrays.fill(features, 0);

        if (profile == null) {
            return features;
        }

        String wxUserId = profile.getWxUserId();

        try {
            // [0-9] 品类偏好 (Top 10品类)
            List<UserInterestTag> categoryTags = userInterestTagMapper.selectByType(wxUserId, "category");
            List<UserInterestTag> topCategories = categoryTags.stream()
                    .sorted((a, b) -> Double.compare(
                            b.getWeight().doubleValue(),
                            a.getWeight().doubleValue()))
                    .limit(10)
                    .collect(Collectors.toList());

            for (int i = 0; i < topCategories.size() && i < 10; i++) {
                features[i] = topCategories.get(i).getWeight().doubleValue();
            }

            // [10-14] 价格偏好 (5维: 极低/低/中/高/极高)
            String pricePrefs = profile.getPricePreferences();
            if (pricePrefs != null && !pricePrefs.isEmpty()) {
                try {
                    Map<String, Object> priceMap = objectMapper.readValue(pricePrefs,
                            new TypeReference<Map<String, Object>>() {});
                    String range = (String) priceMap.getOrDefault("range", "medium");
                    switch (range) {
                        case "very_low":
                            features[10] = 1.0;
                            break;
                        case "low":
                            features[11] = 1.0;
                            break;
                        case "medium":
                            features[12] = 1.0;
                            break;
                        case "high":
                            features[13] = 1.0;
                            break;
                        case "very_high":
                            features[14] = 1.0;
                            break;
                        default:
                            features[12] = 1.0;  // 默认中等
                    }
                } catch (Exception e) {
                    features[12] = 1.0;  // 默认中等
                }
            }

            // [15-19] 购买频率 (5维: 极低/低/中/高/极高)
            Integer purchaseCount = profile.getPurchaseCount();
            if (purchaseCount != null) {
                if (purchaseCount < 2) {
                    features[15] = 1.0;  // 极低频
                } else if (purchaseCount < 5) {
                    features[16] = 1.0;  // 低频
                } else if (purchaseCount < 15) {
                    features[17] = 1.0;  // 中频
                } else if (purchaseCount < 30) {
                    features[18] = 1.0;  // 高频
                } else {
                    features[19] = 1.0;  // 极高频
                }
            } else {
                features[15] = 1.0;  // 默认极低频
            }

            // [20-26] 活跃时段 (7维: 凌晨/早晨/上午/中午/下午/晚间/深夜)
            String activeHours = profile.getActiveHours();
            if (activeHours != null && !activeHours.isEmpty()) {
                try {
                    Map<String, Double> hoursMap = objectMapper.readValue(activeHours,
                            new TypeReference<Map<String, Double>>() {});
                    features[20] = hoursMap.getOrDefault("dawn", 0.0);       // 0-5点
                    features[21] = hoursMap.getOrDefault("early_morning", 0.0);  // 6-8点
                    features[22] = hoursMap.getOrDefault("morning", 0.0);    // 9-11点
                    features[23] = hoursMap.getOrDefault("noon", 0.0);       // 12-13点
                    features[24] = hoursMap.getOrDefault("afternoon", 0.0);  // 14-17点
                    features[25] = hoursMap.getOrDefault("evening", 0.0);    // 18-21点
                    features[26] = hoursMap.getOrDefault("night", 0.0);      // 22-23点
                } catch (Exception e) {
                    // 默认值
                }
            }

            // [27-31] 商户偏好 (Top5商户权重)
            List<UserInterestTag> merchantTags = userInterestTagMapper.selectByType(wxUserId, "merchant");
            List<UserInterestTag> topMerchants = merchantTags.stream()
                    .sorted((a, b) -> Double.compare(
                            b.getWeight().doubleValue(),
                            a.getWeight().doubleValue()))
                    .limit(5)
                    .collect(Collectors.toList());
            for (int i = 0; i < topMerchants.size() && i < 5; i++) {
                features[27 + i] = topMerchants.get(i).getWeight().doubleValue();
            }

            // [32-36] 行为模式 (5维)
            features[32] = calculateRepurchaseRate(wxUserId);        // 复购率
            features[33] = calculateAvgBasketSize(profile);          // 平均篮子大小
            features[34] = calculateBrowseDepth(wxUserId);           // 浏览深度
            features[35] = calculateDecisionSpeed(wxUserId);         // 决策速度
            features[36] = calculatePriceSensitivity(profile);       // 价格敏感度

            // [37-41] 客单价分布 (5维)
            Double avgOrderValue = extractAvgOrderValue(profile);
            if (avgOrderValue != null) {
                if (avgOrderValue < 50) {
                    features[37] = 1.0;
                } else if (avgOrderValue < 100) {
                    features[38] = 1.0;
                } else if (avgOrderValue < 200) {
                    features[39] = 1.0;
                } else if (avgOrderValue < 500) {
                    features[40] = 1.0;
                } else {
                    features[41] = 1.0;
                }
            }

            // [42-44] 新品接受度 (3维)
            double newProductAcceptance = calculateNewProductAcceptance(wxUserId);
            if (newProductAcceptance < 0.3) {
                features[42] = 1.0;  // 低
            } else if (newProductAcceptance < 0.6) {
                features[43] = 1.0;  // 中
            } else {
                features[44] = 1.0;  // 高
            }

            // [45] 画像成熟度
            String status = profile.getProfileStatus();
            if ("mature".equals(status)) {
                features[45] = 1.0;
            } else if ("warming".equals(status)) {
                features[45] = 0.5;
            } else {
                features[45] = 0.1;
            }

            // [46] 活跃度
            Integer behaviorCount = profile.getBehaviorCount();
            if (behaviorCount != null) {
                features[46] = Math.min(1.0, behaviorCount / 100.0);
            }

            // [47] 探索度 (浏览品类数/浏览次数)
            features[47] = calculateExplorationScore(wxUserId);

        } catch (Exception e) {
            log.debug("构建用户特征向量失败: wxUserId={}, error={}", wxUserId, e.getMessage());
        }

        // 归一化
        return featureEngineeringService.normalizeFeatures(features);
    }

    // ==================== 新增辅助方法 (优化点8) ====================

    private double calculateRepurchaseRate(String wxUserId) {
        // 简化实现：基于标签判断
        try {
            List<UserInterestTag> tags = userInterestTagMapper.selectByType(wxUserId, "behavior");
            for (UserInterestTag tag : tags) {
                if ("repurchase".equals(tag.getTagValue())) {
                    return tag.getWeight() != null ? tag.getWeight().doubleValue() : 0.5;
                }
            }
        } catch (Exception e) {
            log.debug("计算复购率失败: {}", e.getMessage());
        }
        return 0.3;  // 默认值
    }

    private double calculateAvgBasketSize(UserRecommendationProfile profile) {
        // 简化实现：基于购买数量估算
        Integer purchaseCount = profile.getPurchaseCount();
        if (purchaseCount == null || purchaseCount == 0) return 0.2;
        return Math.min(1.0, purchaseCount / 50.0);
    }

    private double calculateBrowseDepth(String wxUserId) {
        // 简化实现：基于标签数量
        try {
            List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 100);
            return Math.min(1.0, tags.size() / 30.0);
        } catch (Exception e) {
            return 0.3;
        }
    }

    private double calculateDecisionSpeed(String wxUserId) {
        // 简化实现：返回中等值
        return 0.5;
    }

    private double calculatePriceSensitivity(UserRecommendationProfile profile) {
        // 基于价格偏好判断
        String pricePrefs = profile.getPricePreferences();
        if (pricePrefs != null) {
            if (pricePrefs.contains("low")) return 0.8;
            if (pricePrefs.contains("high")) return 0.2;
        }
        return 0.5;
    }

    private double calculateNewProductAcceptance(String wxUserId) {
        // 简化实现
        return 0.5;
    }

    private double calculateExplorationScore(String wxUserId) {
        try {
            List<UserInterestTag> categoryTags = userInterestTagMapper.selectByType(wxUserId, "category");
            return Math.min(1.0, categoryTags.size() / 10.0);
        } catch (Exception e) {
            return 0.3;
        }
    }

    /**
     * 从purchasePattern JSON中提取平均订单金额
     * purchasePattern格式: {"frequency": "weekly", "avg_amount": 300}
     */
    private Double extractAvgOrderValue(UserRecommendationProfile profile) {
        try {
            String purchasePattern = profile.getPurchasePattern();
            if (purchasePattern == null || purchasePattern.isEmpty()) {
                return null;
            }
            Map<String, Object> patternMap = objectMapper.readValue(purchasePattern,
                    new TypeReference<Map<String, Object>>() {});
            Object avgAmount = patternMap.get("avg_amount");
            if (avgAmount != null) {
                return ((Number) avgAmount).doubleValue();
            }
        } catch (Exception e) {
            log.debug("解析purchasePattern失败: {}", e.getMessage());
        }
        return null;
    }

    // ==================== 数据持久化 ====================

    /**
     * 保存聚类结果
     */
    private void saveClusters(List<double[]> centroids, 
                               Map<String, Integer> assignments,
                               Map<String, double[]> userFeatures,
                               int version) {
        LocalDateTime now = LocalDateTime.now();

        // 计算每个聚类的统计信息
        Map<Integer, List<String>> clusterMembers = new HashMap<>();
        for (Map.Entry<String, Integer> entry : assignments.entrySet()) {
            clusterMembers.computeIfAbsent(entry.getValue(), k -> new ArrayList<>())
                    .add(entry.getKey());
        }

        // 保存聚类
        List<UserCluster> clusters = new ArrayList<>();
        for (int i = 0; i < centroids.size(); i++) {
            UserCluster cluster = new UserCluster();
            
            // 使用默认配置
            ClusterConfig config = DEFAULT_CLUSTER_CONFIGS.getOrDefault(i,
                    new ClusterConfig("聚类" + (i + 1), "自动生成的聚类", Collections.emptyList()));
            
            cluster.setClusterName(config.name);
            cluster.setDescription(config.description);
            cluster.setCentroidVector(serializeVector(centroids.get(i)));
            
            List<String> members = clusterMembers.getOrDefault(i, Collections.emptyList());
            cluster.setMemberCount(members.size());
            
            // 计算平均距离
            double avgDistance = calculateAvgDistance(members, userFeatures, centroids.get(i));
            cluster.setAvgDistance(avgDistance);
            
            // 推荐品类
            try {
                cluster.setRecommendCategories(objectMapper.writeValueAsString(config.recommendCategories));
            } catch (JsonProcessingException e) {
                cluster.setRecommendCategories("[]");
            }
            
            cluster.setVersion(version);
            cluster.setActive(true);
            cluster.setLastClusterTime(now);

            userClusterMapper.insert(cluster);
            clusters.add(cluster);
        }

        // 保存用户分配
        for (Map.Entry<String, Integer> entry : assignments.entrySet()) {
            String wxUserId = entry.getKey();
            int clusterIndex = entry.getValue();
            
            if (clusterIndex >= 0 && clusterIndex < clusters.size()) {
                UserCluster cluster = clusters.get(clusterIndex);
                double[] features = userFeatures.get(wxUserId);
                double distance = euclideanDistance(features, centroids.get(clusterIndex));

                // 计算次近聚类
                double secondMinDistance = Double.MAX_VALUE;
                Long secondNearestClusterId = null;
                for (int i = 0; i < centroids.size(); i++) {
                    if (i != clusterIndex) {
                        double d = euclideanDistance(features, centroids.get(i));
                        if (d < secondMinDistance) {
                            secondMinDistance = d;
                            secondNearestClusterId = clusters.get(i).getId();
                        }
                    }
                }

                UserClusterAssignment assignment = new UserClusterAssignment();
                assignment.setWxUserId(wxUserId);
                assignment.setClusterId(cluster.getId());
                assignment.setFeatureVector(serializeVector(features));
                assignment.setDistanceToCentroid(distance);
                assignment.setConfidence(1.0 - distance / (distance + secondMinDistance + 0.001));
                assignment.setSecondNearestClusterId(secondNearestClusterId);
                assignment.setDistanceToSecondNearest(secondMinDistance);
                assignment.setVersion(version);
                assignment.setBoundaryUser(secondMinDistance / distance < BOUNDARY_USER_RATIO_THRESHOLD);
                assignment.setAssignmentTime(now);

                userClusterAssignmentMapper.insert(assignment);
            }
        }

        log.info("保存聚类结果: {} 个聚类, {} 个用户分配", clusters.size(), assignments.size());
    }

    /**
     * 计算聚类内平均距离
     */
    private double calculateAvgDistance(List<String> members, 
                                         Map<String, double[]> userFeatures,
                                         double[] centroid) {
        if (members.isEmpty()) {
            return 0;
        }
        double totalDistance = 0;
        for (String userId : members) {
            double[] features = userFeatures.get(userId);
            if (features != null) {
                totalDistance += euclideanDistance(features, centroid);
            }
        }
        return totalDistance / members.size();
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取所有用户画像
     */
    private List<UserRecommendationProfile> getAllUserProfiles() {
        LambdaQueryWrapper<UserRecommendationProfile> wrapper = new LambdaQueryWrapper<>();
        wrapper.isNotNull(UserRecommendationProfile::getWxUserId);
        return userRecommendationProfileMapper.selectList(wrapper);
    }

    /**
     * 分配到新用户群
     */
    private UserClusterAssignment assignToNewUserCluster(String wxUserId) {
        // 查找新用户群聚类
        UserCluster newUserCluster = userClusterMapper.selectByClusterName("新用户群");
        
        if (newUserCluster == null) {
            // 创建默认聚类
            log.warn("新用户群聚类不存在，无法分配");
            return null;
        }

        UserClusterAssignment assignment = new UserClusterAssignment();
        assignment.setWxUserId(wxUserId);
        assignment.setClusterId(newUserCluster.getId());
        assignment.setFeatureVector(serializeVector(new double[FEATURE_DIM]));
        assignment.setDistanceToCentroid(0.0);
        assignment.setConfidence(0.5);
        assignment.setVersion(newUserCluster.getVersion());
        assignment.setBoundaryUser(false);
        assignment.setAssignmentTime(LocalDateTime.now());

        userClusterAssignmentMapper.insert(assignment);

        return assignment;
    }

    /**
     * 序列化向量为JSON字符串
     */
    private String serializeVector(double[] vector) {
        if (vector == null) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(vector);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    /**
     * 解析质心向量
     */
    private double[] parseCentroidVector(String json) {
        if (json == null || json.isEmpty()) {
            return new double[FEATURE_DIM];
        }
        try {
            return objectMapper.readValue(json, double[].class);
        } catch (JsonProcessingException e) {
            return new double[FEATURE_DIM];
        }
    }

    /**
     * 清除聚类缓存
     */
    private void clearClusterCache() {
        try {
            Set<String> keys = redisTemplate.keys(CLUSTER_CACHE_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
            }
        } catch (Exception e) {
            log.warn("清除缓存失败: {}", e.getMessage());
        }
    }

    /**
     * 聚类配置内部类
     */
    private static class ClusterConfig {
        final String name;
        final String description;
        final List<String> recommendCategories;

        ClusterConfig(String name, String description, List<String> recommendCategories) {
            this.name = name;
            this.description = description;
            this.recommendCategories = recommendCategories;
        }
    }
}
