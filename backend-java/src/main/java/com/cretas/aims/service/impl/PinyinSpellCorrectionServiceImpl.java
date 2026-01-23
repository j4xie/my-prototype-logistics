package com.cretas.aims.service.impl;

import com.cretas.aims.service.SpellCorrectionService;
import lombok.extern.slf4j.Slf4j;
import net.sourceforge.pinyin4j.PinyinHelper;
import net.sourceforge.pinyin4j.format.HanyuPinyinCaseType;
import net.sourceforge.pinyin4j.format.HanyuPinyinOutputFormat;
import net.sourceforge.pinyin4j.format.HanyuPinyinToneType;
import net.sourceforge.pinyin4j.format.exception.BadHanyuPinyinOutputFormatCombination;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;

/**
 * 基于拼音的中文拼写纠正服务实现
 *
 * 实现原理：
 * 1. 维护业务词汇表及其拼音
 * 2. 使用滑动窗口扫描输入文本
 * 3. 对每个片段计算拼音
 * 4. 如果拼音匹配业务词汇但字形不同，进行替换
 *
 * 常见错别字示例：
 * - 销受 → 销售 (xiao shou)
 * - 物聊 → 物料 (wu liao)
 * - 设背 → 设备 (she bei)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
public class PinyinSpellCorrectionServiceImpl implements SpellCorrectionService {

    /**
     * 拼音输出格式（不带声调）
     */
    private final HanyuPinyinOutputFormat pinyinFormat;

    /**
     * 业务词汇表：词汇 -> 拼音
     */
    private final Map<String, String> vocabularyPinyin = new LinkedHashMap<>();

    /**
     * 拼音到词汇的反向映射：拼音 -> 正确词汇
     */
    private final Map<String, String> pinyinToWord = new HashMap<>();

    /**
     * 常见错别字直接映射（高频错误，直接替换）
     */
    private final Map<String, String> directMappings = new LinkedHashMap<>();

    public PinyinSpellCorrectionServiceImpl() {
        this.pinyinFormat = new HanyuPinyinOutputFormat();
        this.pinyinFormat.setCaseType(HanyuPinyinCaseType.LOWERCASE);
        this.pinyinFormat.setToneType(HanyuPinyinToneType.WITHOUT_TONE);
    }

    @PostConstruct
    public void init() {
        // 初始化业务词汇表
        initVocabulary();
        // 初始化直接映射（高频错别字）
        initDirectMappings();

        log.info("拼写纠正服务初始化完成: {} 个业务词汇, {} 个直接映射",
                vocabularyPinyin.size(), directMappings.size());
    }

    /**
     * 初始化业务词汇表
     */
    private void initVocabulary() {
        // 核心业务词汇（按类别组织）
        String[] coreVocabulary = {
            // 物料相关
            "销售", "物料", "设备", "质检", "库存", "考勤", "发货", "批次",
            "原料", "材料", "成品", "半成品", "包装", "配料",
            // 操作动词
            "入库", "出库", "盘点", "调拨", "消耗", "采购", "生产", "加工",
            "审核", "审批", "确认", "取消", "完成", "暂停", "恢复",
            // 人员/组织
            "供应商", "客户", "员工", "工人", "主管", "经理", "管理员",
            // 质量相关
            "合格", "不合格", "检测", "检验", "抽检", "全检", "复检",
            // 设备相关
            "机器", "产线", "车间", "仓库", "冷库",
            // 报表相关
            "报表", "统计", "分析", "汇总", "导出", "查询",
            // 时间相关
            "今天", "昨天", "本周", "本月", "上周", "上月",
            // 状态
            "进度", "状态", "记录", "明细", "详情", "列表",
            // 追溯相关
            "溯源", "追溯", "追踪", "来源", "去向",
            // 告警相关
            "告警", "预警", "警报", "异常", "故障"
        };

        for (String word : coreVocabulary) {
            String pinyin = getPinyin(word);
            if (pinyin != null && !pinyin.isEmpty()) {
                vocabularyPinyin.put(word, pinyin);
                pinyinToWord.put(pinyin, word);
            }
        }
    }

    /**
     * 初始化常见错别字直接映射
     * 这些是高频出现的同音错字，直接替换效率更高
     */
    private void initDirectMappings() {
        // 任务中指定的错别字
        directMappings.put("销受", "销售");
        directMappings.put("物聊", "物料");
        directMappings.put("设背", "设备");
        directMappings.put("质减", "质检");
        directMappings.put("库村", "库存");
        directMappings.put("考琴", "考勤");
        directMappings.put("发或", "发货");
        directMappings.put("批词", "批次");

        // 扩展常见错别字
        directMappings.put("原聊", "原料");
        directMappings.put("材聊", "材料");
        directMappings.put("入酷", "入库");
        directMappings.put("出酷", "出库");
        directMappings.put("盘店", "盘点");
        directMappings.put("供应尚", "供应商");
        directMappings.put("客护", "客户");
        directMappings.put("员攻", "员工");
        directMappings.put("合个", "合格");
        directMappings.put("不合个", "不合格");
        directMappings.put("检侧", "检测");
        directMappings.put("仓酷", "仓库");
        directMappings.put("冷酷", "冷库");
        directMappings.put("报表", "报表");
        directMappings.put("统及", "统计");
        directMappings.put("查旬", "查询");
        directMappings.put("告惊", "告警");
        directMappings.put("预惊", "预警");
        directMappings.put("异长", "异常");
        directMappings.put("故账", "故障");
        directMappings.put("溯原", "溯源");
        directMappings.put("追溯", "追溯");  // 确保正确词汇不被误改
        directMappings.put("成品", "成品");
        directMappings.put("半成品", "半成品");
        directMappings.put("生残", "生产");
        directMappings.put("加攻", "加工");
        directMappings.put("审和", "审核");
        directMappings.put("审披", "审批");
    }

    @Override
    public String correct(String input) {
        if (input == null || input.trim().isEmpty()) {
            return input;
        }

        String result = input;

        // Step 1: 应用直接映射（高效处理高频错别字）
        for (Map.Entry<String, String> entry : directMappings.entrySet()) {
            if (result.contains(entry.getKey())) {
                String oldResult = result;
                result = result.replace(entry.getKey(), entry.getValue());
                if (!oldResult.equals(result)) {
                    log.debug("直接映射纠正: '{}' -> '{}'", entry.getKey(), entry.getValue());
                }
            }
        }

        // Step 2: 使用滑动窗口进行拼音匹配纠正
        result = correctByPinyinMatching(result);

        if (!result.equals(input)) {
            log.info("拼写纠正完成: '{}' -> '{}'", truncate(input, 30), truncate(result, 30));
        }

        return result;
    }

    /**
     * 使用滑动窗口和拼音匹配进行纠正
     */
    private String correctByPinyinMatching(String input) {
        if (input == null || input.length() < 2) {
            return input;
        }

        StringBuilder result = new StringBuilder();
        int i = 0;

        while (i < input.length()) {
            boolean corrected = false;

            // 尝试不同窗口大小（4, 3, 2 字符）
            for (int windowSize = Math.min(4, input.length() - i); windowSize >= 2; windowSize--) {
                if (i + windowSize > input.length()) continue;

                String segment = input.substring(i, i + windowSize);

                // 跳过非中文字符
                if (!isChineseSegment(segment)) {
                    continue;
                }

                // 计算片段拼音
                String segmentPinyin = getPinyin(segment);
                if (segmentPinyin == null || segmentPinyin.isEmpty()) {
                    continue;
                }

                // 查找匹配的正确词汇
                String correctWord = pinyinToWord.get(segmentPinyin);
                if (correctWord != null && !correctWord.equals(segment)) {
                    // 拼音相同但字形不同，进行替换
                    result.append(correctWord);
                    log.debug("拼音匹配纠正: '{}' -> '{}' (pinyin: {})",
                            segment, correctWord, segmentPinyin);
                    i += windowSize;
                    corrected = true;
                    break;
                }
            }

            if (!corrected) {
                result.append(input.charAt(i));
                i++;
            }
        }

        return result.toString();
    }

    @Override
    public boolean needsCorrection(String input) {
        if (input == null || input.trim().isEmpty()) {
            return false;
        }

        // 检查直接映射
        for (String errorWord : directMappings.keySet()) {
            if (input.contains(errorWord)) {
                return true;
            }
        }

        // 检查拼音匹配
        for (int i = 0; i < input.length() - 1; i++) {
            for (int windowSize = Math.min(4, input.length() - i); windowSize >= 2; windowSize--) {
                if (i + windowSize > input.length()) continue;

                String segment = input.substring(i, i + windowSize);
                if (!isChineseSegment(segment)) continue;

                String segmentPinyin = getPinyin(segment);
                if (segmentPinyin == null) continue;

                String correctWord = pinyinToWord.get(segmentPinyin);
                if (correctWord != null && !correctWord.equals(segment)) {
                    return true;
                }
            }
        }

        return false;
    }

    @Override
    public Optional<String> suggest(String input) {
        if (!needsCorrection(input)) {
            return Optional.empty();
        }
        return Optional.of(correct(input));
    }

    /**
     * 获取中文字符串的拼音（不带声调）
     */
    private String getPinyin(String chinese) {
        if (chinese == null || chinese.isEmpty()) {
            return null;
        }

        StringBuilder pinyin = new StringBuilder();
        for (char c : chinese.toCharArray()) {
            try {
                String[] pinyinArray = PinyinHelper.toHanyuPinyinStringArray(c, pinyinFormat);
                if (pinyinArray != null && pinyinArray.length > 0) {
                    pinyin.append(pinyinArray[0]);
                } else if (Character.isLetterOrDigit(c)) {
                    // 保留非中文字符
                    pinyin.append(c);
                }
            } catch (BadHanyuPinyinOutputFormatCombination e) {
                log.warn("拼音转换异常: char={}, error={}", c, e.getMessage());
                return null;
            }
        }
        return pinyin.toString();
    }

    /**
     * 检查字符串是否全为中文字符
     */
    private boolean isChineseSegment(String segment) {
        if (segment == null || segment.isEmpty()) {
            return false;
        }
        for (char c : segment.toCharArray()) {
            if (!isChinese(c)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 判断字符是否为中文
     */
    private boolean isChinese(char c) {
        return c >= '\u4e00' && c <= '\u9fff';
    }

    /**
     * 截断字符串
     */
    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }
}
