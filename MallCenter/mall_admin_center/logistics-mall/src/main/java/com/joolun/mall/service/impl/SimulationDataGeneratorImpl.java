package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.UserBehaviorEvent;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.entity.UserRecommendationProfile;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.UserBehaviorEventMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import com.joolun.mall.mapper.UserRecommendationProfileMapper;
import com.joolun.mall.service.SimulationDataGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 模拟数据生成服务实现
 *
 * 生成策略:
 * 1. 用户画像: 9种类型共500个用户
 * 2. 行为事件: 50000+事件，符合真实分布
 * 3. 行为序列: 模拟真实购买路径
 * 4. 时间分布: 过去90天，工作日/周末/时段差异
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SimulationDataGeneratorImpl implements SimulationDataGenerator {

    private final UserRecommendationProfileMapper profileMapper;
    private final UserBehaviorEventMapper eventMapper;
    private final UserInterestTagMapper tagMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final ObjectMapper objectMapper;

    // 模拟用户ID前缀
    private static final String SIM_USER_PREFIX = "sim_user_";

    // 用户类型配置
    private static final List<UserTypeConfig> USER_TYPE_CONFIGS = Arrays.asList(
            new UserTypeConfig("火锅店采购", 60,
                    Arrays.asList("肉类", "火锅底料", "蔬菜", "毛肚", "牛肉", "羊肉"),
                    "medium", "high", "mature"),
            new UserTypeConfig("快餐店采购", 70,
                    Arrays.asList("速食", "调味品", "粮油", "鸡肉", "米面", "食用油"),
                    "low", "high", "mature"),
            new UserTypeConfig("烘焙店采购", 50,
                    Arrays.asList("烘焙原料", "乳制品", "黄油", "面粉", "奶油", "糖类"),
                    "medium_high", "medium", "mature"),
            new UserTypeConfig("高端餐厅", 40,
                    Arrays.asList("进口食材", "海鲜", "和牛", "龙虾", "鹅肝", "松露"),
                    "high", "low_bulk", "mature"),
            new UserTypeConfig("社区团购", 60,
                    Arrays.asList("蔬果", "日用品", "水果", "蔬菜", "鸡蛋", "牛奶"),
                    "low", "high_small", "mature"),
            new UserTypeConfig("食堂采购", 50,
                    Arrays.asList("粮油", "肉类", "大米", "面粉", "猪肉", "鸡肉"),
                    "medium", "stable", "mature"),
            new UserTypeConfig("便利店", 40,
                    Arrays.asList("零食", "饮料", "方便面", "饼干", "矿泉水", "果汁"),
                    "medium_low", "high", "mature"),
            new UserTypeConfig("茶饮店", 50,
                    Arrays.asList("茶叶", "水果", "乳制品", "椰浆", "芋头", "杨梅"),
                    "medium", "medium", "mature"),
            new UserTypeConfig("新用户", 80,
                    Arrays.asList("随机"),
                    "random", "low", "cold_start")
    );

    // 事件类型分布
    private static final Map<String, Double> EVENT_TYPE_DISTRIBUTION = new LinkedHashMap<String, Double>() {{
        put("view", 0.55);
        put("click", 0.15);
        put("cart_add", 0.12);
        put("favorite", 0.05);
        put("search", 0.08);
        put("purchase", 0.05);
    }};

    // 设备类型分布
    private static final List<String> DEVICE_TYPES = Arrays.asList("ios", "android", "devtools");
    private static final double[] DEVICE_WEIGHTS = {0.35, 0.60, 0.05};

    // 来源类型分布
    private static final List<String> SOURCE_TYPES = Arrays.asList("home", "search", "category", "recommend", "share");
    private static final double[] SOURCE_WEIGHTS = {0.30, 0.25, 0.20, 0.20, 0.05};

    // 生成统计
    private LocalDateTime lastGenerationTime;
    private int lastGeneratedUsers;
    private int lastGeneratedEvents;
    private int lastGeneratedTags;
    private Map<String, Integer> usersByType = new HashMap<>();
    private Map<String, Integer> eventsByType = new HashMap<>();

    @Override
    @Transactional
    public int generateSimulatedUsers(int count) {
        log.info("开始生成模拟用户画像: 目标数量={}", count);

        List<UserRecommendationProfile> profiles = new ArrayList<>();
        usersByType.clear();
        int userIndex = 1;

        // 按类型分配用户数量
        int totalConfigured = USER_TYPE_CONFIGS.stream().mapToInt(c -> c.count).sum();
        double scale = (double) count / totalConfigured;

        for (UserTypeConfig config : USER_TYPE_CONFIGS) {
            int typeCount = (int) Math.round(config.count * scale);
            usersByType.put(config.typeName, typeCount);

            for (int i = 0; i < typeCount && userIndex <= count; i++) {
                UserRecommendationProfile profile = createUserProfile(userIndex++, config);
                profiles.add(profile);
            }
        }

        // 批量插入
        int inserted = 0;
        int batchSize = 100;
        for (int i = 0; i < profiles.size(); i += batchSize) {
            int end = Math.min(i + batchSize, profiles.size());
            List<UserRecommendationProfile> batch = profiles.subList(i, end);
            for (UserRecommendationProfile profile : batch) {
                try {
                    profileMapper.insert(profile);
                    inserted++;
                } catch (Exception e) {
                    log.warn("插入用户画像失败: userId={}, error={}", profile.getWxUserId(), e.getMessage());
                }
            }
        }

        lastGeneratedUsers = inserted;
        log.info("模拟用户画像生成完成: 目标={}, 实际={}", count, inserted);
        return inserted;
    }

    @Override
    @Transactional
    public int generateSimulatedEvents(int count) {
        log.info("开始生成模拟行为事件: 目标数量={}", count);

        // 获取所有模拟用户
        LambdaQueryWrapper<UserRecommendationProfile> profileWrapper = new LambdaQueryWrapper<>();
        profileWrapper.likeRight(UserRecommendationProfile::getWxUserId, SIM_USER_PREFIX);
        List<UserRecommendationProfile> profiles = profileMapper.selectList(profileWrapper);

        if (profiles.isEmpty()) {
            log.warn("没有找到模拟用户，请先生成用户画像");
            return 0;
        }

        // 获取商品列表
        LambdaQueryWrapper<GoodsSpu> spuWrapper = new LambdaQueryWrapper<>();
        spuWrapper.eq(GoodsSpu::getShelf, "1");
        List<GoodsSpu> products = goodsSpuMapper.selectList(spuWrapper);

        if (products.isEmpty()) {
            log.warn("没有找到上架商品，无法生成行为事件");
            return 0;
        }

        log.info("找到 {} 个模拟用户和 {} 个商品", profiles.size(), products.size());

        // 按品类分组商品
        Map<String, List<GoodsSpu>> productsByCategory = products.stream()
                .filter(p -> p.getCategoryFirst() != null)
                .collect(Collectors.groupingBy(GoodsSpu::getCategoryFirst));

        List<UserBehaviorEvent> events = new ArrayList<>();
        eventsByType.clear();
        EVENT_TYPE_DISTRIBUTION.keySet().forEach(type -> eventsByType.put(type, 0));

        Random random = new Random();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startTime = now.minusDays(90);

        // 为每个用户生成行为事件
        int eventsPerUser = count / profiles.size();
        int extraEvents = count % profiles.size();

        for (int i = 0; i < profiles.size(); i++) {
            UserRecommendationProfile profile = profiles.get(i);
            int userEventCount = eventsPerUser + (i < extraEvents ? 1 : 0);

            // 根据用户类型调整事件数量
            String status = profile.getProfileStatus();
            if ("cold_start".equals(status)) {
                userEventCount = Math.max(1, userEventCount / 3); // 冷启动用户事件较少
            } else if ("warming".equals(status)) {
                userEventCount = Math.max(3, userEventCount / 2);
            }

            List<UserBehaviorEvent> userEvents = generateUserBehaviorSequence(
                    profile, products, productsByCategory, userEventCount, startTime, now);
            events.addAll(userEvents);
        }

        // 批量插入事件
        int inserted = 0;
        int batchSize = 500;
        for (int i = 0; i < events.size(); i += batchSize) {
            int end = Math.min(i + batchSize, events.size());
            List<UserBehaviorEvent> batch = events.subList(i, end);
            try {
                int batchInserted = eventMapper.insertBatch(batch);
                inserted += batchInserted;
            } catch (Exception e) {
                log.warn("批量插入事件失败: batch={}, error={}", i / batchSize, e.getMessage());
                // 逐条插入
                for (UserBehaviorEvent event : batch) {
                    try {
                        eventMapper.insert(event);
                        inserted++;
                    } catch (Exception ex) {
                        // ignore
                    }
                }
            }
        }

        // 统计事件类型分布
        for (UserBehaviorEvent event : events) {
            eventsByType.merge(event.getEventType(), 1, Integer::sum);
        }

        lastGeneratedEvents = inserted;
        log.info("模拟行为事件生成完成: 目标={}, 实际={}", count, inserted);
        return inserted;
    }

    @Override
    @Transactional
    public Map<String, Integer> generateFullSimulation() {
        log.info("开始生成完整模拟数据");
        lastGenerationTime = LocalDateTime.now();

        // 清理旧数据
        clearSimulatedData();

        // 生成用户画像
        int users = generateSimulatedUsers(500);

        // 生成行为事件
        int events = generateSimulatedEvents(50000);

        // 生成兴趣标签
        int tags = generateInterestTags();

        Map<String, Integer> result = new LinkedHashMap<>();
        result.put("users", users);
        result.put("events", events);
        result.put("tags", tags);

        log.info("完整模拟数据生成完成: users={}, events={}, tags={}", users, events, tags);
        return result;
    }

    @Override
    @Transactional
    public void clearSimulatedData() {
        log.info("开始清理模拟数据");

        try {
            // 删除模拟用户的行为事件
            LambdaQueryWrapper<UserBehaviorEvent> eventWrapper = new LambdaQueryWrapper<>();
            eventWrapper.likeRight(UserBehaviorEvent::getWxUserId, SIM_USER_PREFIX);
            int deletedEvents = eventMapper.delete(eventWrapper);

            // 删除模拟用户的兴趣标签
            LambdaQueryWrapper<UserInterestTag> tagWrapper = new LambdaQueryWrapper<>();
            tagWrapper.likeRight(UserInterestTag::getWxUserId, SIM_USER_PREFIX);
            int deletedTags = tagMapper.delete(tagWrapper);

            // 删除模拟用户画像
            LambdaQueryWrapper<UserRecommendationProfile> profileWrapper = new LambdaQueryWrapper<>();
            profileWrapper.likeRight(UserRecommendationProfile::getWxUserId, SIM_USER_PREFIX);
            int deletedProfiles = profileMapper.delete(profileWrapper);

            log.info("模拟数据清理完成: profiles={}, events={}, tags={}",
                    deletedProfiles, deletedEvents, deletedTags);
        } catch (Exception e) {
            log.error("清理模拟数据失败", e);
        }
    }

    @Override
    public Map<String, Object> getGenerationStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        // 查询当前模拟数据数量
        LambdaQueryWrapper<UserRecommendationProfile> profileWrapper = new LambdaQueryWrapper<>();
        profileWrapper.likeRight(UserRecommendationProfile::getWxUserId, SIM_USER_PREFIX);
        Long totalUsers = profileMapper.selectCount(profileWrapper);

        LambdaQueryWrapper<UserBehaviorEvent> eventWrapper = new LambdaQueryWrapper<>();
        eventWrapper.likeRight(UserBehaviorEvent::getWxUserId, SIM_USER_PREFIX);
        Long totalEvents = eventMapper.selectCount(eventWrapper);

        LambdaQueryWrapper<UserInterestTag> tagWrapper = new LambdaQueryWrapper<>();
        tagWrapper.likeRight(UserInterestTag::getWxUserId, SIM_USER_PREFIX);
        Long totalTags = tagMapper.selectCount(tagWrapper);

        stats.put("totalUsers", totalUsers);
        stats.put("totalEvents", totalEvents);
        stats.put("totalTags", totalTags);
        stats.put("usersByType", usersByType);
        stats.put("eventsByType", eventsByType);
        stats.put("dateRange", Map.of(
                "start", LocalDateTime.now().minusDays(90).toLocalDate().toString(),
                "end", LocalDateTime.now().toLocalDate().toString()
        ));
        stats.put("generationTime", lastGenerationTime != null ? lastGenerationTime.toString() : "未生成");
        stats.put("simUserPrefix", SIM_USER_PREFIX);

        return stats;
    }

    // ==================== 私有方法 ====================

    /**
     * 创建用户画像
     */
    private UserRecommendationProfile createUserProfile(int index, UserTypeConfig config) {
        UserRecommendationProfile profile = new UserRecommendationProfile();
        String userId = String.format("%s%03d", SIM_USER_PREFIX, index);

        profile.setWxUserId(userId);
        profile.setProfileStatus(config.profileStatus);
        profile.setBehaviorCount(generateBehaviorCount(config));
        profile.setPurchaseCount(generatePurchaseCount(config));
        profile.setCategoryPreferences(generateCategoryPreferences(config));
        profile.setPricePreferences(generatePricePreferences(config));
        profile.setBrandPreferences(generateBrandPreferences(config));
        profile.setFeaturePreferences(generateFeaturePreferences(config));
        profile.setActiveHours(generateActiveHours(config));
        profile.setBrowsePattern(generateBrowsePattern(config));
        profile.setPurchasePattern(generatePurchasePattern(config));
        profile.setColdStartStrategy(config.profileStatus.equals("cold_start") ? "popular" : null);
        profile.setColdStartCompleted(!config.profileStatus.equals("cold_start"));

        LocalDateTime now = LocalDateTime.now();
        Random random = new Random();
        int daysAgo = random.nextInt(90) + 1;
        profile.setFirstVisitTime(now.minusDays(daysAgo));
        profile.setLastActiveTime(now.minusDays(random.nextInt(daysAgo)));
        profile.setLastRecommendationTime(now.minusDays(random.nextInt(7)));
        profile.setRecommendationClickRate(BigDecimal.valueOf(0.1 + random.nextDouble() * 0.3));
        profile.setRecommendationConvertRate(BigDecimal.valueOf(0.02 + random.nextDouble() * 0.08));
        profile.setCreateTime(now);
        profile.setUpdateTime(now);

        return profile;
    }

    /**
     * 生成行为数量
     */
    private int generateBehaviorCount(UserTypeConfig config) {
        Random random = new Random();
        switch (config.profileStatus) {
            case "cold_start":
                return random.nextInt(5);
            case "warming":
                return 5 + random.nextInt(15);
            default:
                return 20 + random.nextInt(200);
        }
    }

    /**
     * 生成购买数量
     */
    private int generatePurchaseCount(UserTypeConfig config) {
        Random random = new Random();
        switch (config.frequency) {
            case "high":
            case "high_small":
                return 10 + random.nextInt(50);
            case "medium":
                return 5 + random.nextInt(20);
            case "low":
            case "low_bulk":
                return 1 + random.nextInt(10);
            case "stable":
                return 8 + random.nextInt(15);
            default:
                return random.nextInt(5);
        }
    }

    /**
     * 生成品类偏好JSON
     */
    private String generateCategoryPreferences(UserTypeConfig config) {
        Map<String, Double> prefs = new LinkedHashMap<>();
        Random random = new Random();

        for (int i = 0; i < config.categories.size(); i++) {
            String category = config.categories.get(i);
            if (!"随机".equals(category)) {
                double weight = 0.9 - i * 0.1 + random.nextDouble() * 0.1;
                prefs.put(category, Math.round(weight * 100) / 100.0);
            }
        }

        try {
            return objectMapper.writeValueAsString(prefs);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成价格偏好JSON
     */
    private String generatePricePreferences(UserTypeConfig config) {
        Map<String, Object> prefs = new LinkedHashMap<>();
        Random random = new Random();

        switch (config.priceLevel) {
            case "low":
                prefs.put("range", "low");
                prefs.put("avg", 50 + random.nextInt(50));
                prefs.put("max", 200);
                break;
            case "medium_low":
                prefs.put("range", "medium_low");
                prefs.put("avg", 80 + random.nextInt(70));
                prefs.put("max", 300);
                break;
            case "medium":
                prefs.put("range", "medium");
                prefs.put("avg", 150 + random.nextInt(100));
                prefs.put("max", 500);
                break;
            case "medium_high":
                prefs.put("range", "medium_high");
                prefs.put("avg", 250 + random.nextInt(150));
                prefs.put("max", 800);
                break;
            case "high":
                prefs.put("range", "high");
                prefs.put("avg", 500 + random.nextInt(500));
                prefs.put("max", 2000);
                break;
            default:
                prefs.put("range", "random");
                prefs.put("avg", 100 + random.nextInt(400));
                prefs.put("max", 1000);
        }

        try {
            return objectMapper.writeValueAsString(prefs);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成品牌偏好JSON
     */
    private String generateBrandPreferences(UserTypeConfig config) {
        Map<String, Double> prefs = new LinkedHashMap<>();
        Random random = new Random();

        List<String> brands = Arrays.asList("科尔沁", "恒都", "蒙牛", "伊利", "金龙鱼", "海天", "李锦记");
        int brandCount = 2 + random.nextInt(3);

        for (int i = 0; i < brandCount; i++) {
            String brand = brands.get(random.nextInt(brands.size()));
            if (!prefs.containsKey(brand)) {
                prefs.put(brand, Math.round((0.5 + random.nextDouble() * 0.5) * 100) / 100.0);
            }
        }

        try {
            return objectMapper.writeValueAsString(prefs);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成特性偏好JSON
     */
    private String generateFeaturePreferences(UserTypeConfig config) {
        Map<String, Double> prefs = new LinkedHashMap<>();
        Random random = new Random();

        if ("high".equals(config.priceLevel)) {
            prefs.put("imported", 0.7 + random.nextDouble() * 0.3);
            prefs.put("organic", 0.5 + random.nextDouble() * 0.3);
            prefs.put("premium", 0.8 + random.nextDouble() * 0.2);
        } else if ("low".equals(config.priceLevel)) {
            prefs.put("value", 0.8 + random.nextDouble() * 0.2);
            prefs.put("bulk", 0.6 + random.nextDouble() * 0.3);
        } else {
            prefs.put("fresh", 0.5 + random.nextDouble() * 0.3);
            prefs.put("quality", 0.4 + random.nextDouble() * 0.3);
        }

        try {
            return objectMapper.writeValueAsString(prefs);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成活跃时段JSON
     */
    private String generateActiveHours(UserTypeConfig config) {
        Map<String, Double> hours = new LinkedHashMap<>();
        Random random = new Random();

        // B2B采购通常在工作时间
        hours.put("morning", 0.2 + random.nextDouble() * 0.3);    // 6-12
        hours.put("afternoon", 0.3 + random.nextDouble() * 0.3);  // 12-18
        hours.put("evening", 0.1 + random.nextDouble() * 0.2);    // 18-22

        try {
            return objectMapper.writeValueAsString(hours);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成浏览模式JSON
     */
    private String generateBrowsePattern(UserTypeConfig config) {
        Map<String, Object> pattern = new LinkedHashMap<>();
        Random random = new Random();

        pattern.put("avg_duration", 20 + random.nextInt(40));  // 20-60秒
        pattern.put("avg_products", 3 + random.nextInt(10));   // 3-12个商品

        try {
            return objectMapper.writeValueAsString(pattern);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成购买模式JSON
     */
    private String generatePurchasePattern(UserTypeConfig config) {
        Map<String, Object> pattern = new LinkedHashMap<>();
        Random random = new Random();

        switch (config.frequency) {
            case "high":
                pattern.put("frequency", "daily");
                pattern.put("avg_amount", 200 + random.nextInt(300));
                break;
            case "high_small":
                pattern.put("frequency", "daily");
                pattern.put("avg_amount", 50 + random.nextInt(100));
                break;
            case "medium":
                pattern.put("frequency", "weekly");
                pattern.put("avg_amount", 300 + random.nextInt(500));
                break;
            case "low_bulk":
                pattern.put("frequency", "monthly");
                pattern.put("avg_amount", 2000 + random.nextInt(5000));
                break;
            case "stable":
                pattern.put("frequency", "weekly");
                pattern.put("avg_amount", 500 + random.nextInt(500));
                break;
            default:
                pattern.put("frequency", "occasional");
                pattern.put("avg_amount", 100 + random.nextInt(200));
        }

        try {
            return objectMapper.writeValueAsString(pattern);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * 生成用户行为序列
     * 模拟真实的购买路径
     */
    private List<UserBehaviorEvent> generateUserBehaviorSequence(
            UserRecommendationProfile profile,
            List<GoodsSpu> allProducts,
            Map<String, List<GoodsSpu>> productsByCategory,
            int eventCount,
            LocalDateTime startTime,
            LocalDateTime endTime) {

        List<UserBehaviorEvent> events = new ArrayList<>();
        Random random = new Random();

        // 解析用户偏好品类
        List<String> preferredCategories = parsePreferredCategories(profile.getCategoryPreferences());

        // 获取用户可能感兴趣的商品
        List<GoodsSpu> relevantProducts = new ArrayList<>();
        for (String category : preferredCategories) {
            List<GoodsSpu> categoryProducts = productsByCategory.get(category);
            if (categoryProducts != null) {
                relevantProducts.addAll(categoryProducts);
            }
        }
        if (relevantProducts.isEmpty()) {
            relevantProducts.addAll(allProducts);
        }

        // 生成会话
        int sessionsCount = Math.max(1, eventCount / 10);
        List<String> sessionIds = new ArrayList<>();
        for (int i = 0; i < sessionsCount; i++) {
            sessionIds.add(UUID.randomUUID().toString().substring(0, 8));
        }

        int eventsGenerated = 0;
        int sessionIndex = 0;

        while (eventsGenerated < eventCount) {
            String sessionId = sessionIds.get(sessionIndex % sessionIds.size());
            LocalDateTime sessionStart = randomDateTime(startTime, endTime, random);

            // 生成一个会话的行为序列
            List<UserBehaviorEvent> sessionEvents = generateSessionBehavior(
                    profile, relevantProducts, allProducts, sessionId, sessionStart, random);

            for (UserBehaviorEvent event : sessionEvents) {
                if (eventsGenerated >= eventCount) break;
                events.add(event);
                eventsGenerated++;
            }

            sessionIndex++;
        }

        return events;
    }

    /**
     * 生成单个会话的行为序列
     */
    private List<UserBehaviorEvent> generateSessionBehavior(
            UserRecommendationProfile profile,
            List<GoodsSpu> relevantProducts,
            List<GoodsSpu> allProducts,
            String sessionId,
            LocalDateTime sessionStart,
            Random random) {

        List<UserBehaviorEvent> events = new ArrayList<>();
        LocalDateTime eventTime = sessionStart;
        String deviceType = weightedChoice(DEVICE_TYPES, DEVICE_WEIGHTS, random);
        String ipAddress = generateRandomIp(random);

        // 决定这个会话的行为序列类型
        int sequenceType = random.nextInt(10);

        if (sequenceType < 3) {
            // 30%: 浏览型 - view → view → view
            int viewCount = 3 + random.nextInt(5);
            for (int i = 0; i < viewCount; i++) {
                GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
                events.add(createEvent(profile.getWxUserId(), "view", eventTime, product, sessionId, deviceType, ipAddress, "home"));
                eventTime = eventTime.plusSeconds(10 + random.nextInt(30));
            }
        } else if (sequenceType < 5) {
            // 20%: 搜索型 - search → view → view → click
            String keyword = getSearchKeyword(profile, random);
            events.add(createSearchEvent(profile.getWxUserId(), keyword, eventTime, sessionId, deviceType, ipAddress));
            eventTime = eventTime.plusSeconds(5 + random.nextInt(10));

            int viewCount = 2 + random.nextInt(4);
            for (int i = 0; i < viewCount; i++) {
                GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
                events.add(createEvent(profile.getWxUserId(), "view", eventTime, product, sessionId, deviceType, ipAddress, "search"));
                eventTime = eventTime.plusSeconds(10 + random.nextInt(20));
            }

            if (random.nextDouble() < 0.5) {
                GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
                events.add(createEvent(profile.getWxUserId(), "click", eventTime, product, sessionId, deviceType, ipAddress, "search"));
            }
        } else if (sequenceType < 7) {
            // 20%: 加购型 - view → click → cart_add
            GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
            events.add(createEvent(profile.getWxUserId(), "view", eventTime, product, sessionId, deviceType, ipAddress, "recommend"));
            eventTime = eventTime.plusSeconds(15 + random.nextInt(30));
            events.add(createEvent(profile.getWxUserId(), "click", eventTime, product, sessionId, deviceType, ipAddress, "recommend"));
            eventTime = eventTime.plusSeconds(20 + random.nextInt(40));
            events.add(createEvent(profile.getWxUserId(), "cart_add", eventTime, product, sessionId, deviceType, ipAddress, "recommend"));
        } else if (sequenceType < 8) {
            // 10%: 购买型 - view → click → cart_add → purchase
            GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
            events.add(createEvent(profile.getWxUserId(), "view", eventTime, product, sessionId, deviceType, ipAddress, "category"));
            eventTime = eventTime.plusSeconds(10 + random.nextInt(20));
            events.add(createEvent(profile.getWxUserId(), "click", eventTime, product, sessionId, deviceType, ipAddress, "category"));
            eventTime = eventTime.plusSeconds(30 + random.nextInt(60));
            events.add(createEvent(profile.getWxUserId(), "cart_add", eventTime, product, sessionId, deviceType, ipAddress, "category"));
            eventTime = eventTime.plusSeconds(60 + random.nextInt(120));
            events.add(createEvent(profile.getWxUserId(), "purchase", eventTime, product, sessionId, deviceType, ipAddress, "category"));
        } else if (sequenceType < 9) {
            // 10%: 收藏型 - view → favorite
            GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
            events.add(createEvent(profile.getWxUserId(), "view", eventTime, product, sessionId, deviceType, ipAddress, "recommend"));
            eventTime = eventTime.plusSeconds(20 + random.nextInt(40));
            events.add(createEvent(profile.getWxUserId(), "favorite", eventTime, product, sessionId, deviceType, ipAddress, "recommend"));
        } else {
            // 10%: 对比型 - view → view → view → click → cart_add
            List<GoodsSpu> comparedProducts = new ArrayList<>();
            for (int i = 0; i < 3; i++) {
                GoodsSpu product = relevantProducts.get(random.nextInt(relevantProducts.size()));
                comparedProducts.add(product);
                events.add(createEvent(profile.getWxUserId(), "view", eventTime, product, sessionId, deviceType, ipAddress, "category"));
                eventTime = eventTime.plusSeconds(15 + random.nextInt(25));
            }
            GoodsSpu chosen = comparedProducts.get(random.nextInt(comparedProducts.size()));
            events.add(createEvent(profile.getWxUserId(), "click", eventTime, chosen, sessionId, deviceType, ipAddress, "category"));
            if (random.nextDouble() < 0.6) {
                eventTime = eventTime.plusSeconds(30 + random.nextInt(60));
                events.add(createEvent(profile.getWxUserId(), "cart_add", eventTime, chosen, sessionId, deviceType, ipAddress, "category"));
            }
        }

        return events;
    }

    /**
     * 创建行为事件
     */
    private UserBehaviorEvent createEvent(String wxUserId, String eventType, LocalDateTime eventTime,
                                           GoodsSpu product, String sessionId, String deviceType,
                                           String ipAddress, String sourceType) {
        UserBehaviorEvent event = new UserBehaviorEvent();
        event.setWxUserId(wxUserId);
        event.setEventType(eventType);
        event.setEventTime(eventTime);
        event.setTargetType("product");
        event.setTargetId(product.getId());
        event.setTargetName(product.getName());
        event.setSessionId(sessionId);
        event.setDeviceType(deviceType);
        event.setIpAddress(ipAddress);
        event.setSourceType(sourceType);

        // 生成事件详情
        Map<String, Object> eventData = new LinkedHashMap<>();
        eventData.put("product_id", product.getId());
        eventData.put("category", product.getCategoryFirst());
        if (product.getSalesPrice() != null) {
            eventData.put("price", product.getSalesPrice());
        }
        if ("purchase".equals(eventType)) {
            eventData.put("quantity", 1 + new Random().nextInt(5));
        }

        try {
            event.setEventData(objectMapper.writeValueAsString(eventData));
        } catch (JsonProcessingException e) {
            event.setEventData("{}");
        }

        return event;
    }

    /**
     * 创建搜索事件
     */
    private UserBehaviorEvent createSearchEvent(String wxUserId, String keyword, LocalDateTime eventTime,
                                                  String sessionId, String deviceType, String ipAddress) {
        UserBehaviorEvent event = new UserBehaviorEvent();
        event.setWxUserId(wxUserId);
        event.setEventType("search");
        event.setEventTime(eventTime);
        event.setTargetType("search");
        event.setTargetId(keyword);
        event.setTargetName(keyword);
        event.setSessionId(sessionId);
        event.setDeviceType(deviceType);
        event.setIpAddress(ipAddress);
        event.setSourceType("home");

        Map<String, Object> eventData = new LinkedHashMap<>();
        eventData.put("search_keyword", keyword);
        eventData.put("result_count", 5 + new Random().nextInt(50));

        try {
            event.setEventData(objectMapper.writeValueAsString(eventData));
        } catch (JsonProcessingException e) {
            event.setEventData("{}");
        }

        return event;
    }

    /**
     * 生成兴趣标签
     */
    private int generateInterestTags() {
        log.info("开始生成用户兴趣标签");

        LambdaQueryWrapper<UserRecommendationProfile> wrapper = new LambdaQueryWrapper<>();
        wrapper.likeRight(UserRecommendationProfile::getWxUserId, SIM_USER_PREFIX);
        List<UserRecommendationProfile> profiles = profileMapper.selectList(wrapper);

        int tagCount = 0;
        Random random = new Random();

        for (UserRecommendationProfile profile : profiles) {
            List<String> categories = parsePreferredCategories(profile.getCategoryPreferences());

            for (int i = 0; i < categories.size(); i++) {
                String category = categories.get(i);
                double weight = 0.9 - i * 0.1;
                double confidence = 0.7 + random.nextDouble() * 0.3;

                try {
                    tagMapper.upsertTag(
                            profile.getWxUserId(),
                            "category",
                            category,
                            1,
                            weight,
                            confidence,
                            "simulation",
                            0.1
                    );
                    tagCount++;
                } catch (Exception e) {
                    // ignore duplicates
                }
            }
        }

        lastGeneratedTags = tagCount;
        log.info("用户兴趣标签生成完成: {}", tagCount);
        return tagCount;
    }

    /**
     * 解析偏好品类
     */
    private List<String> parsePreferredCategories(String categoryPreferencesJson) {
        if (categoryPreferencesJson == null || categoryPreferencesJson.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Double> prefs = objectMapper.readValue(categoryPreferencesJson, Map.class);
            return new ArrayList<>(prefs.keySet());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    /**
     * 获取搜索关键词
     */
    private String getSearchKeyword(UserRecommendationProfile profile, Random random) {
        List<String> categories = parsePreferredCategories(profile.getCategoryPreferences());
        if (!categories.isEmpty()) {
            return categories.get(random.nextInt(categories.size()));
        }

        List<String> defaultKeywords = Arrays.asList("牛肉", "鸡肉", "蔬菜", "水果", "调味品", "粮油");
        return defaultKeywords.get(random.nextInt(defaultKeywords.size()));
    }

    /**
     * 生成随机时间
     */
    private LocalDateTime randomDateTime(LocalDateTime start, LocalDateTime end, Random random) {
        long startEpoch = start.toLocalDate().toEpochDay();
        long endEpoch = end.toLocalDate().toEpochDay();
        long randomDay = startEpoch + random.nextInt((int) (endEpoch - startEpoch));

        // 工作时间权重更高 (9:00 - 18:00)
        int hour;
        if (random.nextDouble() < 0.7) {
            hour = 9 + random.nextInt(9);  // 9-17
        } else {
            hour = random.nextInt(24);
        }

        int minute = random.nextInt(60);
        int second = random.nextInt(60);

        return LocalDateTime.of(
                java.time.LocalDate.ofEpochDay(randomDay),
                LocalTime.of(hour, minute, second)
        );
    }

    /**
     * 生成随机IP
     */
    private String generateRandomIp(Random random) {
        return String.format("192.168.%d.%d",
                random.nextInt(256),
                random.nextInt(256));
    }

    /**
     * 加权随机选择
     */
    private <T> T weightedChoice(List<T> items, double[] weights, Random random) {
        double total = 0;
        for (double w : weights) total += w;

        double r = random.nextDouble() * total;
        double cumulative = 0;

        for (int i = 0; i < items.size(); i++) {
            cumulative += weights[i];
            if (r <= cumulative) {
                return items.get(i);
            }
        }

        return items.get(items.size() - 1);
    }

    // ==================== 内部类 ====================

    /**
     * 用户类型配置
     */
    private static class UserTypeConfig {
        final String typeName;
        final int count;
        final List<String> categories;
        final String priceLevel;
        final String frequency;
        final String profileStatus;

        UserTypeConfig(String typeName, int count, List<String> categories,
                       String priceLevel, String frequency, String profileStatus) {
            this.typeName = typeName;
            this.count = count;
            this.categories = categories;
            this.priceLevel = priceLevel;
            this.frequency = frequency;
            this.profileStatus = profileStatus;
        }
    }
}
