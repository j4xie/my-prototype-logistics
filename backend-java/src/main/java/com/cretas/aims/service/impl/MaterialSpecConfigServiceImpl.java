package com.cretas.aims.service.impl;

import com.cretas.aims.entity.MaterialSpecConfig;
import com.cretas.aims.repository.MaterialSpecConfigRepository;
import com.cretas.aims.service.MaterialSpecConfigService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 原材料规格配置服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
@Service
public class MaterialSpecConfigServiceImpl implements MaterialSpecConfigService {
    private static final Logger log = LoggerFactory.getLogger(MaterialSpecConfigServiceImpl.class);

    private final MaterialSpecConfigRepository repository;
    private final ObjectMapper objectMapper;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public MaterialSpecConfigServiceImpl(MaterialSpecConfigRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * 系统默认规格配置
     */
    private static final Map<String, List<String>> SYSTEM_DEFAULT_CONFIGS = new LinkedHashMap<>();

    static {
        SYSTEM_DEFAULT_CONFIGS.put("海鲜", Arrays.asList("整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"));
        SYSTEM_DEFAULT_CONFIGS.put("肉类", Arrays.asList("整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"));
        SYSTEM_DEFAULT_CONFIGS.put("蔬菜", Arrays.asList("整颗", "切段", "切丝", "切块", "切片"));
        SYSTEM_DEFAULT_CONFIGS.put("水果", Arrays.asList("整个", "切片", "切块", "去皮", "带皮"));
        SYSTEM_DEFAULT_CONFIGS.put("粉类", Arrays.asList("袋装", "散装", "桶装"));
        SYSTEM_DEFAULT_CONFIGS.put("米面", Arrays.asList("袋装", "散装", "包装"));
        SYSTEM_DEFAULT_CONFIGS.put("油类", Arrays.asList("瓶装", "桶装", "散装", "大桶", "小瓶"));
        SYSTEM_DEFAULT_CONFIGS.put("调料", Arrays.asList("瓶装", "袋装", "罐装", "散装", "盒装"));
        SYSTEM_DEFAULT_CONFIGS.put("其他", Arrays.asList("原装", "分装", "定制"));
    }

    /**
     * JSON转List工具方法
     */
    private List<String> parseSpecifications(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析规格JSON失败: {}", json, e);
            return new ArrayList<>();
        }
    }

    /**
     * List转JSON工具方法
     */
    private String toJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.error("转换规格为JSON失败: {}", list, e);
            return "[]";
        }
    }

    @Override
    public Map<String, List<String>> getAllSpecConfigs(String factoryId) {
        log.info("获取工厂规格配置: factoryId={}", factoryId);

        // 从数据库查询配置
        List<MaterialSpecConfig> configs = repository.findByFactoryId(factoryId);

        if (configs.isEmpty()) {
            log.info("工厂{}无自定义配置，返回系统默认配置", factoryId);
            return new LinkedHashMap<>(SYSTEM_DEFAULT_CONFIGS);
        }

        // 转换为Map格式（需要JSON解析）
        Map<String, List<String>> result = configs.stream()
                .collect(Collectors.toMap(
                        MaterialSpecConfig::getCategory,
                        config -> parseSpecifications(config.getSpecifications()),
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        // 补充缺失的类别（使用系统默认）
        SYSTEM_DEFAULT_CONFIGS.forEach((category, defaultSpecs) -> {
            result.putIfAbsent(category, new ArrayList<>(defaultSpecs));
        });

        return result;
    }

    @Override
    public List<String> getSpecsByCategory(String factoryId, String category) {
        log.info("获取类别规格配置: factoryId={}, category={}", factoryId, category);

        Optional<MaterialSpecConfig> config = repository.findByFactoryIdAndCategory(factoryId, category);

        if (config.isPresent()) {
            return parseSpecifications(config.get().getSpecifications());
        }

        // 返回系统默认配置
        List<String> defaultSpecs = SYSTEM_DEFAULT_CONFIGS.get(category);
        return defaultSpecs != null ? new ArrayList<>(defaultSpecs) : new ArrayList<>();
    }

    @Override
    @Transactional
    public void updateCategorySpecs(String factoryId, String category, List<String> specifications) {
        log.info("更新类别规格配置: factoryId={}, category={}, specs={}", factoryId, category, specifications);

        if (specifications == null || specifications.isEmpty()) {
            throw new IllegalArgumentException("规格列表不能为空");
        }

        String specsJson = toJson(specifications);
        Optional<MaterialSpecConfig> existingConfig = repository.findByFactoryIdAndCategory(factoryId, category);

        if (existingConfig.isPresent()) {
            // 更新现有配置
            MaterialSpecConfig config = existingConfig.get();
            config.setSpecifications(specsJson);
            config.setIsSystemDefault(false);
            repository.save(config);
            log.info("更新规格配置成功: id={}", config.getId());
        } else {
            // 创建新配置
            MaterialSpecConfig config = new MaterialSpecConfig();
            config.setFactoryId(factoryId);
            config.setCategory(category);
            config.setSpecifications(specsJson);
            config.setIsSystemDefault(false);
            repository.save(config);
            log.info("创建规格配置成功: id={}", config.getId());
        }
    }

    @Override
    @Transactional
    public List<String> resetToDefault(String factoryId, String category) {
        log.info("重置为默认配置: factoryId={}, category={}", factoryId, category);

        // 获取系统默认配置
        List<String> defaultSpecs = SYSTEM_DEFAULT_CONFIGS.get(category);
        if (defaultSpecs == null) {
            throw new IllegalArgumentException("未知的类别: " + category);
        }

        Optional<MaterialSpecConfig> existingConfig = repository.findByFactoryIdAndCategory(factoryId, category);

        if (existingConfig.isPresent()) {
            // 更新现有配置为系统默认
            MaterialSpecConfig config = existingConfig.get();
            config.setSpecifications(toJson(new ArrayList<>(defaultSpecs)));
            config.setIsSystemDefault(true);
            repository.save(config);
            log.info("更新为默认配置成功: category={}", category);
        } else {
            // 插入系统默认配置
            MaterialSpecConfig config = new MaterialSpecConfig();
            config.setFactoryId(factoryId);
            config.setCategory(category);
            config.setSpecifications(toJson(new ArrayList<>(defaultSpecs)));
            config.setIsSystemDefault(true);
            repository.save(config);
            log.info("创建默认配置成功: category={}", category);
        }

        return new ArrayList<>(defaultSpecs);
    }

    @Override
    @Transactional
    public void initializeDefaultConfigs(String factoryId) {
        log.info("初始化工厂默认规格配置: factoryId={}", factoryId);

        // 检查是否已初始化
        List<MaterialSpecConfig> existing = repository.findByFactoryId(factoryId);
        if (!existing.isEmpty()) {
            log.warn("工厂{}已有规格配置，跳过初始化", factoryId);
            return;
        }

        // 批量插入默认配置
        List<MaterialSpecConfig> configs = new ArrayList<>();
        SYSTEM_DEFAULT_CONFIGS.forEach((category, specs) -> {
            MaterialSpecConfig config = new MaterialSpecConfig();
            config.setFactoryId(factoryId);
            config.setCategory(category);
            config.setSpecifications(toJson(new ArrayList<>(specs)));
            config.setIsSystemDefault(true);
            configs.add(config);
        });

        repository.saveAll(configs);
        log.info("初始化工厂默认规格配置成功: factoryId={}, count={}", factoryId, configs.size());
    }

    @Override
    public Map<String, List<String>> getSystemDefaultConfigs() {
        return new LinkedHashMap<>(SYSTEM_DEFAULT_CONFIGS);
    }
}
