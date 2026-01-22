package com.cretas.aims.ai.synthetic;

import com.cretas.aims.ai.synthetic.IntentSkelBuilder.IntentSkel;
import com.cretas.aims.ai.synthetic.IntentSkelBuilder.Slot;
import com.cretas.aims.config.SyntheticDataConfig;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for generating synthetic training samples from intent skeletons.
 *
 * <p>This generator creates diverse training data by:
 * <ul>
 *   <li>Randomly selecting patterns from skeleton definitions</li>
 *   <li>Filling slots with randomized values</li>
 *   <li>Applying domain randomization (synonyms, typos, reordering)</li>
 * </ul>
 *
 * <p>Generated samples are used to augment real training data, improving
 * the model's ability to handle variations in user input.
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentScenGenerator {

    private final SyntheticDataConfig config;

    /**
     * Pattern for matching slot placeholders in template strings.
     * Matches {SLOT_NAME} format.
     */
    private static final Pattern SLOT_PATTERN = Pattern.compile("\\{([A-Z_]+)\\}");

    /**
     * Common synonym mappings for domain randomization.
     * Key: original word, Value: list of synonyms.
     */
    private static final Map<String, List<String>> SYNONYM_MAP = initSynonymMap();

    /**
     * Common typo character substitutions.
     * Key: original char, Value: list of possible typo chars.
     */
    private static final Map<Character, List<Character>> TYPO_MAP = initTypoMap();

    /**
     * Represents a generated synthetic sample.
     *
     * <p>Each sample contains the generated user input, associated intent,
     * extracted parameters, and quality metrics for filtering.
     */
    @Data
    public static class SyntheticSample {
        /**
         * The generated user input text.
         */
        private String userInput;

        /**
         * The intent code this sample maps to.
         */
        private String intentCode;

        /**
         * Slot fills (parameter name -> value mappings).
         */
        private Map<String, String> params;

        /**
         * Confidence score from the generator (0.0 to 1.0).
         * Based on how well required slots were filled.
         */
        private double generatorConfidence;

        /**
         * Generation depth. Set to 1 for first-generation synthetic data.
         * Used to prevent recursive synthesis.
         */
        private int generation = 1;

        /**
         * Reference to the skeleton used for generation.
         */
        private String skeletonId;

        /**
         * GRAPE quality score (nullable).
         * Will be populated during post-processing quality assessment.
         */
        private BigDecimal grapeScore;
    }

    /**
     * Generates synthetic samples from an intent skeleton.
     *
     * @param skel  the intent skeleton containing patterns and slot definitions
     * @param count the number of samples to generate
     * @return list of generated synthetic samples
     */
    public List<SyntheticSample> generate(IntentSkel skel, int count) {
        if (!config.isEnabled()) {
            log.debug("Synthetic data generation is disabled");
            return Collections.emptyList();
        }

        if (skel == null || skel.getPatterns() == null || skel.getPatterns().isEmpty()) {
            log.warn("Cannot generate samples: skeleton or patterns are empty");
            return Collections.emptyList();
        }

        List<SyntheticSample> samples = new ArrayList<>(count);
        Random random = new Random();

        for (int i = 0; i < count; i++) {
            try {
                SyntheticSample sample = generateSingle(skel, random);
                if (sample != null) {
                    samples.add(sample);
                }
            } catch (Exception e) {
                log.warn("Failed to generate sample {}: {}", i, e.getMessage());
            }
        }

        log.info("Generated {} synthetic samples for intent: {}", samples.size(), skel.getIntentCode());
        return samples;
    }

    /**
     * Generates a single synthetic sample.
     */
    private SyntheticSample generateSingle(IntentSkel skel, Random random) {
        // Randomly select a pattern
        List<String> patterns = skel.getPatterns();
        String pattern = patterns.get(random.nextInt(patterns.size()));

        // Fill slots with random values
        Map<String, String> fills = fillSlots(skel.getSlots(), random);

        // Apply the pattern with fills
        String rawInput = applyPattern(pattern, fills);

        // Apply domain randomization
        String userInput = applyDomainRandomization(rawInput, random);

        // Calculate confidence
        double confidence = calculateConfidence(skel.getSlots(), fills);

        // Build the sample
        SyntheticSample sample = new SyntheticSample();
        sample.setUserInput(userInput);
        sample.setIntentCode(skel.getIntentCode());
        sample.setParams(fills);
        sample.setGeneratorConfidence(confidence);
        sample.setGeneration(1);
        sample.setSkeletonId(skel.getId());
        sample.setGrapeScore(null); // To be set during quality assessment

        return sample;
    }

    /**
     * Fills slots with randomly selected values.
     *
     * @param slots  the slot definitions from the skeleton
     * @param random the random number generator
     * @return map of slot name to selected value
     */
    public Map<String, String> fillSlots(List<Slot> slots, Random random) {
        if (slots == null || slots.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, String> fills = new HashMap<>();
        double omitProb = config.getDomainRandomization().getOmitOptionalProb();

        for (Slot slot : slots) {
            // Possibly skip optional slots
            if (!slot.isRequired() && random.nextDouble() < omitProb) {
                continue;
            }

            // Select a random value from the slot's value list
            Set<String> valueSet = slot.getValues();
            if (valueSet != null && !valueSet.isEmpty()) {
                List<String> values = new ArrayList<>(valueSet);
                String value = values.get(random.nextInt(values.size()));
                fills.put(slot.getName(), value);
            }
        }

        return fills;
    }

    /**
     * Applies a pattern by replacing slot placeholders with filled values.
     *
     * @param pattern the pattern template with {SLOT} placeholders
     * @param fills   the slot name to value mappings
     * @return the pattern with placeholders replaced
     */
    public String applyPattern(String pattern, Map<String, String> fills) {
        if (pattern == null || pattern.isEmpty()) {
            return "";
        }

        StringBuffer result = new StringBuffer();
        Matcher matcher = SLOT_PATTERN.matcher(pattern);

        while (matcher.find()) {
            String slotName = matcher.group(1);
            String replacement = fills.getOrDefault(slotName, "");
            // Escape special regex characters in replacement
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);

        // Clean up multiple spaces and trim
        return result.toString().replaceAll("\\s+", " ").trim();
    }

    /**
     * Calculates confidence score based on how well required slots were filled.
     *
     * @param slots the slot definitions
     * @param fills the actual fills
     * @return confidence score between 0.0 and 1.0
     */
    public double calculateConfidence(List<Slot> slots, Map<String, String> fills) {
        if (slots == null || slots.isEmpty()) {
            return 1.0; // No slots means full confidence
        }

        long requiredCount = slots.stream().filter(Slot::isRequired).count();
        if (requiredCount == 0) {
            return 1.0; // No required slots means full confidence
        }

        long filledRequired = slots.stream()
                .filter(Slot::isRequired)
                .filter(slot -> fills.containsKey(slot.getName())
                        && fills.get(slot.getName()) != null
                        && !fills.get(slot.getName()).isEmpty())
                .count();

        return (double) filledRequired / requiredCount;
    }

    /**
     * Applies domain randomization to improve model robustness.
     *
     * <p>This method applies three types of transformations based on configured probabilities:
     * <ul>
     *   <li>Synonym replacement: Substitutes words with synonyms</li>
     *   <li>Typo introduction: Adds realistic typos</li>
     *   <li>Clause reordering: Shuffles clause order</li>
     * </ul>
     *
     * @param input  the original input text
     * @param random the random number generator
     * @return the randomized input text
     */
    public String applyDomainRandomization(String input, Random random) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        SyntheticDataConfig.DomainRandomization randConfig = config.getDomainRandomization();
        String result = input;

        // Apply synonym replacement
        if (random.nextDouble() < randConfig.getSynonymProb()) {
            result = applySynonymReplacement(result, random);
        }

        // Apply typos
        if (random.nextDouble() < randConfig.getTypoProb()) {
            result = applyTypos(result, random);
        }

        // Apply clause reordering
        if (random.nextDouble() < randConfig.getReorderProb()) {
            result = applyClauseReordering(result, random);
        }

        return result;
    }

    /**
     * Applies synonym replacement to words in the input.
     */
    private String applySynonymReplacement(String input, Random random) {
        String[] words = input.split("\\s+");
        StringBuilder result = new StringBuilder();

        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            String lowerWord = word.toLowerCase();

            // Check if we have synonyms and randomly decide to replace
            if (SYNONYM_MAP.containsKey(lowerWord) && random.nextDouble() < 0.5) {
                List<String> synonyms = SYNONYM_MAP.get(lowerWord);
                String synonym = synonyms.get(random.nextInt(synonyms.size()));

                // Preserve original case
                if (Character.isUpperCase(word.charAt(0))) {
                    synonym = Character.toUpperCase(synonym.charAt(0)) + synonym.substring(1);
                }
                word = synonym;
            }

            if (i > 0) {
                result.append(" ");
            }
            result.append(word);
        }

        return result.toString();
    }

    /**
     * Introduces realistic typos into the input.
     */
    private String applyTypos(String input, Random random) {
        StringBuilder result = new StringBuilder(input);

        // Only introduce 1-2 typos per input
        int typoCount = random.nextInt(2) + 1;
        int attempts = 0;
        int maxAttempts = 10;

        while (typoCount > 0 && attempts < maxAttempts) {
            attempts++;
            int pos = random.nextInt(result.length());
            char c = result.charAt(pos);

            // Only apply typos to letters
            if (!Character.isLetter(c)) {
                continue;
            }

            // Check for character substitution
            char lowerC = Character.toLowerCase(c);
            if (TYPO_MAP.containsKey(lowerC)) {
                List<Character> typos = TYPO_MAP.get(lowerC);
                char typoChar = typos.get(random.nextInt(typos.size()));

                // Preserve case
                if (Character.isUpperCase(c)) {
                    typoChar = Character.toUpperCase(typoChar);
                }

                result.setCharAt(pos, typoChar);
                typoCount--;
            }
        }

        return result.toString();
    }

    /**
     * Reorders clauses in the input.
     * Splits by common delimiters and shuffles the parts.
     */
    private String applyClauseReordering(String input, Random random) {
        // Split by common delimiters while preserving them
        String[] clauses = input.split("(?<=,)|(?<=\u3001)|(?<=\uff0c)");

        if (clauses.length <= 1) {
            return input;
        }

        // Shuffle the clauses
        List<String> clauseList = new ArrayList<>(Arrays.asList(clauses));
        Collections.shuffle(clauseList, random);

        return clauseList.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(", "));
    }

    /**
     * Initializes the synonym mapping table.
     */
    private static Map<String, List<String>> initSynonymMap() {
        Map<String, List<String>> map = new HashMap<>();

        // Chinese synonyms for common terms
        map.put("查询", Arrays.asList("查看", "搜索", "查找", "检索"));
        map.put("创建", Arrays.asList("新建", "添加", "生成", "创立"));
        map.put("删除", Arrays.asList("移除", "清除", "去掉", "消除"));
        map.put("修改", Arrays.asList("更改", "编辑", "变更", "调整"));
        map.put("库存", Arrays.asList("存货", "储备", "仓储量"));
        map.put("订单", Arrays.asList("定单", "工单", "单据"));
        map.put("物料", Arrays.asList("材料", "原料", "原材料"));
        map.put("产品", Arrays.asList("商品", "货品", "制品"));
        map.put("批次", Arrays.asList("批号", "生产批次", "批量"));
        map.put("质检", Arrays.asList("质量检查", "品质检验", "检测"));
        map.put("生产", Arrays.asList("制造", "制作", "加工"));
        map.put("发货", Arrays.asList("出货", "配送", "发运"));
        map.put("今天", Arrays.asList("当天", "今日", "本日"));
        map.put("明天", Arrays.asList("次日", "明日"));
        map.put("昨天", Arrays.asList("前一天", "昨日"));
        map.put("所有", Arrays.asList("全部", "所有的", "全部的"));
        map.put("统计", Arrays.asList("汇总", "合计", "总计"));

        // English synonyms
        map.put("query", Arrays.asList("search", "find", "lookup", "retrieve"));
        map.put("create", Arrays.asList("add", "new", "generate", "make"));
        map.put("delete", Arrays.asList("remove", "clear", "drop", "erase"));
        map.put("update", Arrays.asList("modify", "edit", "change", "alter"));
        map.put("inventory", Arrays.asList("stock", "storage", "warehouse"));
        map.put("order", Arrays.asList("purchase", "request"));
        map.put("material", Arrays.asList("item", "component", "part"));
        map.put("product", Arrays.asList("goods", "item", "article"));
        map.put("batch", Arrays.asList("lot", "group"));
        map.put("today", Arrays.asList("current day", "this day"));
        map.put("all", Arrays.asList("every", "total", "complete"));

        return Collections.unmodifiableMap(map);
    }

    /**
     * Initializes the typo character mapping.
     * Based on keyboard proximity and visual similarity.
     */
    private static Map<Character, List<Character>> initTypoMap() {
        Map<Character, List<Character>> map = new HashMap<>();

        // Keyboard proximity typos
        map.put('a', Arrays.asList('s', 'q', 'z'));
        map.put('s', Arrays.asList('a', 'd', 'w', 'x'));
        map.put('d', Arrays.asList('s', 'f', 'e', 'c'));
        map.put('f', Arrays.asList('d', 'g', 'r', 'v'));
        map.put('g', Arrays.asList('f', 'h', 't', 'b'));
        map.put('h', Arrays.asList('g', 'j', 'y', 'n'));
        map.put('j', Arrays.asList('h', 'k', 'u', 'm'));
        map.put('k', Arrays.asList('j', 'l', 'i'));
        map.put('l', Arrays.asList('k', 'o', 'p'));
        map.put('e', Arrays.asList('w', 'r', 'd'));
        map.put('r', Arrays.asList('e', 't', 'f'));
        map.put('t', Arrays.asList('r', 'y', 'g'));
        map.put('y', Arrays.asList('t', 'u', 'h'));
        map.put('u', Arrays.asList('y', 'i', 'j'));
        map.put('i', Arrays.asList('u', 'o', 'k'));
        map.put('o', Arrays.asList('i', 'p', 'l'));
        map.put('p', Arrays.asList('o', 'l'));
        map.put('q', Arrays.asList('w', 'a'));
        map.put('w', Arrays.asList('q', 'e', 's'));
        map.put('z', Arrays.asList('a', 'x'));
        map.put('x', Arrays.asList('z', 'c', 's'));
        map.put('c', Arrays.asList('x', 'v', 'd'));
        map.put('v', Arrays.asList('c', 'b', 'f'));
        map.put('b', Arrays.asList('v', 'n', 'g'));
        map.put('n', Arrays.asList('b', 'm', 'h'));
        map.put('m', Arrays.asList('n', 'j'));

        return Collections.unmodifiableMap(map);
    }
}
