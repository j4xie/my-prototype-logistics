package com.cretas.aims.service.impl;

import com.cretas.aims.entity.DialectMapping;
import com.cretas.aims.entity.DialectMapping.MappingSource;
import com.cretas.aims.entity.DialectMapping.MappingType;
import com.cretas.aims.repository.DialectMappingRepository;
import com.cretas.aims.service.DialectNormalizationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 方言/口语标准化服务实现
 *
 * 提供方言/口语表达到标准表达的映射功能。
 * 使用 ConcurrentHashMap 保证线程安全，
 * 启动时从数据库加载映射，支持运行时动态添加。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
public class DialectNormalizationServiceImpl implements DialectNormalizationService {

    private final DialectMappingRepository dialectMappingRepository;

    /**
     * 内存中的映射缓存 (方言表达 -> DialectMapping)
     * 使用 ConcurrentHashMap 保证线程安全
     */
    private final ConcurrentHashMap<String, DialectMapping> mappingCache = new ConcurrentHashMap<>();

    /**
     * 按长度排序的方言表达列表（用于优先匹配较长的表达）
     */
    private volatile List<String> sortedDialectKeys = new ArrayList<>();

    /**
     * 预置方言映射定义
     */
    private static final List<PresetMapping> PRESET_MAPPINGS = new ArrayList<>();

    static {
        // ==================== 时间表达 ====================
        PRESET_MAPPINGS.add(new PresetMapping("今儿个", "今天", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("今儿", "今天", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("明儿", "明天", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("昨儿", "昨天", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("前儿", "前天", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("上礼拜", "上周", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("下礼拜", "下周", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("这礼拜", "本周", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("上个礼拜", "上周", MappingType.TIME));
        PRESET_MAPPINGS.add(new PresetMapping("下个礼拜", "下周", MappingType.TIME));

        // ==================== 动词口语化 ====================
        PRESET_MAPPINGS.add(new PresetMapping("瞅瞅", "查看", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("瞧瞧", "查看", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("瞅一瞅", "查看", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("瞧一瞧", "查看", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("整个", "生成", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("整一个", "生成", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("拉出来", "导出", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("拉一下", "导出", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("拉个", "导出", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("弄一下", "处理", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("弄弄", "处理", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("搞一下", "处理", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("搞搞", "处理", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("整整", "处理", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("整一整", "处理", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("看看", "查看", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("查查", "查询", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("找找", "查找", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("算算", "计算", MappingType.VERB));
        PRESET_MAPPINGS.add(new PresetMapping("数数", "统计", MappingType.VERB));

        // ==================== 名词口语化 ====================
        PRESET_MAPPINGS.add(new PresetMapping("玩意儿", "物料", MappingType.NOUN));
        PRESET_MAPPINGS.add(new PresetMapping("玩意", "物料", MappingType.NOUN));
        PRESET_MAPPINGS.add(new PresetMapping("东西", "物品", MappingType.NOUN));
        PRESET_MAPPINGS.add(new PresetMapping("货", "物料", MappingType.NOUN));
        PRESET_MAPPINGS.add(new PresetMapping("活儿", "任务", MappingType.NOUN));
        PRESET_MAPPINGS.add(new PresetMapping("活", "任务", MappingType.NOUN));

        // ==================== 疑问词 ====================
        PRESET_MAPPINGS.add(new PresetMapping("咋样", "怎么样", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("咋", "怎么", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("啥", "什么", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("咋回事", "怎么回事", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("咋整", "怎么处理", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("咋弄", "怎么处理", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("咋搞", "怎么处理", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("咋办", "怎么办", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("啥情况", "什么情况", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("啥意思", "什么意思", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("为啥", "为什么", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("干啥", "做什么", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("整啥", "做什么", MappingType.QUESTION));
        PRESET_MAPPINGS.add(new PresetMapping("弄啥", "做什么", MappingType.QUESTION));

        // ==================== 无意义语气词（删除） ====================
        PRESET_MAPPINGS.add(new PresetMapping("那啥", "", MappingType.FILLER));
        PRESET_MAPPINGS.add(new PresetMapping("这个那个", "", MappingType.FILLER));
        PRESET_MAPPINGS.add(new PresetMapping("那个那个", "", MappingType.FILLER));
        PRESET_MAPPINGS.add(new PresetMapping("这个这个", "", MappingType.FILLER));
        PRESET_MAPPINGS.add(new PresetMapping("嗯那个", "", MappingType.FILLER));
        PRESET_MAPPINGS.add(new PresetMapping("就那个", "", MappingType.FILLER));
        PRESET_MAPPINGS.add(new PresetMapping("就是那个", "", MappingType.FILLER));

        // ==================== 方言特色表达 ====================
        // 东北方言
        PRESET_MAPPINGS.add(new PresetMapping("嘎哈", "干什么", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("咋地", "怎么了", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("得劲", "好用", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("埋汰", "脏", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("削你", "批评你", MappingType.DIALECT));

        // 北方方言
        PRESET_MAPPINGS.add(new PresetMapping("甭", "不用", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("中不中", "行不行", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("中", "行", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("不中", "不行", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("咦", "哎", MappingType.DIALECT));

        // 四川/重庆方言
        PRESET_MAPPINGS.add(new PresetMapping("要得", "可以", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("巴适", "好", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("撇脱", "简单", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("安逸", "舒服", MappingType.DIALECT));

        // 广东方言
        PRESET_MAPPINGS.add(new PresetMapping("嘢", "东西", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("咩", "什么", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("唔", "不", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("点", "怎么", MappingType.DIALECT));

        // 上海方言
        PRESET_MAPPINGS.add(new PresetMapping("阿拉", "我们", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("侬", "你", MappingType.DIALECT));
        PRESET_MAPPINGS.add(new PresetMapping("啥个", "什么", MappingType.DIALECT));

        // ==================== 其他常见口语 ====================
        PRESET_MAPPINGS.add(new PresetMapping("靠谱", "可靠", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("不靠谱", "不可靠", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("给力", "有效", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("不给力", "无效", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("掉链子", "出问题", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("搞定", "完成", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("没搞定", "未完成", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("整完", "完成", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("弄完", "完成", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("OK", "可以", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("ok", "可以", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("行不行", "是否可以", MappingType.OTHER));
        PRESET_MAPPINGS.add(new PresetMapping("能不能", "是否可以", MappingType.OTHER));
    }

    @Autowired
    public DialectNormalizationServiceImpl(DialectMappingRepository dialectMappingRepository) {
        this.dialectMappingRepository = dialectMappingRepository;
    }

    /**
     * 初始化：加载预置映射并从数据库加载已有映射
     */
    @PostConstruct
    public void init() {
        log.info("初始化方言标准化服务...");

        // 1. 初始化预置映射到数据库
        initPresetMappings();

        // 2. 从数据库加载所有映射到内存缓存
        refreshCache();

        log.info("方言标准化服务初始化完成，共加载 {} 个映射", mappingCache.size());
    }

    /**
     * 初始化预置映射到数据库
     */
    private void initPresetMappings() {
        int added = 0;
        for (PresetMapping preset : PRESET_MAPPINGS) {
            if (!dialectMappingRepository.existsByDialectExprAndFactoryId(preset.dialect, null)) {
                DialectMapping mapping = DialectMapping.builder()
                        .dialectExpr(preset.dialect)
                        .standardExpr(preset.standard)
                        .factoryId(null)  // 全局映射
                        .confidence(1.0)
                        .useCount(0)
                        .successCount(0)
                        .mappingType(preset.type)
                        .source(MappingSource.PRESET)
                        .enabled(true)
                        .build();
                dialectMappingRepository.save(mapping);
                added++;
            }
        }
        if (added > 0) {
            log.info("添加了 {} 个预置方言映射", added);
        }
    }

    @Override
    public NormalizationResult normalize(String input) {
        return normalize(input, null);
    }

    @Override
    public NormalizationResult normalize(String input, String factoryId) {
        long startTime = System.currentTimeMillis();

        if (input == null || input.trim().isEmpty()) {
            return NormalizationResult.noChange(input);
        }

        String result = input;
        List<ReplacedMapping> replacements = new ArrayList<>();

        // 按长度降序遍历，优先匹配较长的表达
        for (String dialectKey : sortedDialectKeys) {
            if (result.contains(dialectKey)) {
                DialectMapping mapping = mappingCache.get(dialectKey);
                if (mapping != null && mapping.getEnabled()) {
                    // 检查工厂ID匹配（全局映射或特定工厂）
                    if (mapping.getFactoryId() == null ||
                            mapping.getFactoryId().equals(factoryId)) {

                        String oldResult = result;
                        result = result.replace(dialectKey, mapping.getStandardExpr());

                        // 只有实际发生替换时才记录
                        if (!oldResult.equals(result)) {
                            replacements.add(ReplacedMapping.builder()
                                    .dialectExpr(dialectKey)
                                    .standardExpr(mapping.getStandardExpr())
                                    .mappingType(mapping.getMappingType())
                                    .confidence(mapping.getConfidence())
                                    .mappingId(mapping.getId())
                                    .build());

                            log.debug("方言标准化: '{}' -> '{}'", dialectKey, mapping.getStandardExpr());
                        }
                    }
                }
            }
        }

        // 清理可能产生的多余空格
        result = result.replaceAll("\\s+", " ").trim();

        long processingTime = System.currentTimeMillis() - startTime;

        if (!replacements.isEmpty()) {
            log.debug("方言标准化完成: '{}' -> '{}', 替换 {} 处, 耗时 {}ms",
                    truncate(input, 30), truncate(result, 30),
                    replacements.size(), processingTime);
        }

        return NormalizationResult.builder()
                .originalInput(input)
                .normalizedText(result)
                .hasReplacements(!replacements.isEmpty())
                .replacements(replacements)
                .processingTimeMs(processingTime)
                .build();
    }

    @Override
    @Transactional
    public DialectMapping learnDialect(String dialect, String standard, double confidence) {
        return learnDialect(dialect, standard, confidence, null, MappingType.OTHER);
    }

    @Override
    @Transactional
    public DialectMapping learnDialect(String dialect, String standard, double confidence,
                                        String factoryId, MappingType mappingType) {
        if (dialect == null || dialect.trim().isEmpty() ||
                standard == null) {
            throw new IllegalArgumentException("方言表达和标准表达不能为空");
        }

        String trimmedDialect = dialect.trim();
        String trimmedStandard = standard.trim();

        // 检查是否已存在
        List<DialectMapping> existing = dialectMappingRepository
                .findByDialectExprAndFactory(trimmedDialect, factoryId);

        DialectMapping mapping;
        if (!existing.isEmpty()) {
            // 更新现有映射
            mapping = existing.get(0);
            mapping.setStandardExpr(trimmedStandard);
            mapping.setConfidence(Math.max(mapping.getConfidence(), confidence));
            mapping.setMappingType(mappingType);
            mapping.setEnabled(true);
            log.info("更新方言映射: '{}' -> '{}' (confidence={})",
                    trimmedDialect, trimmedStandard, mapping.getConfidence());
        } else {
            // 创建新映射
            mapping = DialectMapping.builder()
                    .dialectExpr(trimmedDialect)
                    .standardExpr(trimmedStandard)
                    .factoryId(factoryId)
                    .confidence(confidence)
                    .useCount(0)
                    .successCount(0)
                    .mappingType(mappingType)
                    .source(MappingSource.LEARNED)
                    .enabled(true)
                    .build();
            log.info("学习新方言映射: '{}' -> '{}' (confidence={}, factory={})",
                    trimmedDialect, trimmedStandard, confidence, factoryId);
        }

        mapping = dialectMappingRepository.save(mapping);

        // 更新内存缓存
        updateCache(mapping);

        return mapping;
    }

    @Override
    public Map<String, String> getMapping() {
        return mappingCache.values().stream()
                .filter(DialectMapping::getEnabled)
                .collect(Collectors.toMap(
                        DialectMapping::getDialectExpr,
                        DialectMapping::getStandardExpr,
                        (v1, v2) -> v1  // 如果有重复，保留第一个
                ));
    }

    @Override
    public Map<String, String> getMapping(String factoryId) {
        return mappingCache.values().stream()
                .filter(m -> m.getEnabled() &&
                        (m.getFactoryId() == null || m.getFactoryId().equals(factoryId)))
                .collect(Collectors.toMap(
                        DialectMapping::getDialectExpr,
                        DialectMapping::getStandardExpr,
                        (v1, v2) -> v1
                ));
    }

    @Override
    public Map<String, String> getMappingByType(MappingType type) {
        return mappingCache.values().stream()
                .filter(m -> m.getEnabled() && m.getMappingType() == type)
                .collect(Collectors.toMap(
                        DialectMapping::getDialectExpr,
                        DialectMapping::getStandardExpr,
                        (v1, v2) -> v1
                ));
    }

    @Override
    @Transactional
    public void recordUsage(String dialectExpr) {
        DialectMapping mapping = mappingCache.get(dialectExpr);
        if (mapping != null) {
            dialectMappingRepository.incrementUseCount(mapping.getId());
            mapping.incrementUseCount();
        }
    }

    @Override
    @Transactional
    public void recordSuccess(String dialectExpr) {
        DialectMapping mapping = mappingCache.get(dialectExpr);
        if (mapping != null) {
            dialectMappingRepository.incrementUseCount(mapping.getId());
            dialectMappingRepository.incrementSuccessCount(mapping.getId());
            mapping.recordSuccess();
        }
    }

    @Override
    public synchronized void refreshCache() {
        log.debug("刷新方言映射缓存...");

        List<DialectMapping> allMappings = dialectMappingRepository.findByEnabledTrueOrderByConfidenceDesc();

        mappingCache.clear();
        for (DialectMapping mapping : allMappings) {
            mappingCache.put(mapping.getDialectExpr(), mapping);
        }

        // 按长度降序排序键列表
        sortedDialectKeys = new ArrayList<>(mappingCache.keySet());
        sortedDialectKeys.sort((a, b) -> b.length() - a.length());

        log.debug("方言映射缓存刷新完成，共 {} 个映射", mappingCache.size());
    }

    @Override
    public MappingStatistics getStatistics() {
        List<DialectMapping> allMappings = dialectMappingRepository.findAll();
        List<DialectMapping> enabledMappings = allMappings.stream()
                .filter(DialectMapping::getEnabled)
                .collect(Collectors.toList());

        long presetCount = enabledMappings.stream()
                .filter(m -> m.getSource() == MappingSource.PRESET)
                .count();

        long learnedCount = enabledMappings.stream()
                .filter(m -> m.getSource() == MappingSource.LEARNED)
                .count();

        Map<MappingType, Integer> byType = enabledMappings.stream()
                .collect(Collectors.groupingBy(
                        DialectMapping::getMappingType,
                        Collectors.collectingAndThen(Collectors.counting(), Long::intValue)
                ));

        double avgConfidence = enabledMappings.stream()
                .mapToDouble(DialectMapping::getConfidence)
                .average()
                .orElse(0.0);

        long highFrequency = enabledMappings.stream()
                .filter(m -> m.getUseCount() != null && m.getUseCount() >= 10)
                .count();

        return MappingStatistics.builder()
                .totalMappings(allMappings.size())
                .enabledMappings(enabledMappings.size())
                .presetMappings((int) presetCount)
                .learnedMappings((int) learnedCount)
                .mappingsByType(byType)
                .averageConfidence(avgConfidence)
                .highFrequencyMappings((int) highFrequency)
                .build();
    }

    @Override
    @Transactional
    public int disableLowConfidenceMappings(double threshold) {
        int count = dialectMappingRepository.disableLowConfidenceMappings(threshold);
        if (count > 0) {
            log.info("禁用了 {} 个低置信度映射 (threshold={})", count, threshold);
            refreshCache();
        }
        return count;
    }

    /**
     * 更新单个映射到缓存
     */
    private void updateCache(DialectMapping mapping) {
        if (mapping.getEnabled()) {
            mappingCache.put(mapping.getDialectExpr(), mapping);
            // 重新排序
            sortedDialectKeys = new ArrayList<>(mappingCache.keySet());
            sortedDialectKeys.sort((a, b) -> b.length() - a.length());
        } else {
            mappingCache.remove(mapping.getDialectExpr());
            sortedDialectKeys.remove(mapping.getDialectExpr());
        }
    }

    /**
     * 截断字符串
     */
    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }

    // ==================== 预置映射定义类 ====================

    private static class PresetMapping {
        final String dialect;
        final String standard;
        final MappingType type;

        PresetMapping(String dialect, String standard, MappingType type) {
            this.dialect = dialect;
            this.standard = standard;
            this.type = type;
        }
    }
}
