package com.cretas.aims.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * 口语化表达映射配置
 *
 * 将用户的口语化、非正式表达映射为标准化查询表述，
 * 用于查询预处理阶段的语义标准化。
 *
 * 支持的口语类型：
 * - 入库相关：货到了没、到货了吗、收到货没
 * - 发货相关：东西发出去了吗、发了没、发货了吗
 * - 库存相关：看看还剩多少、还有多少、库存多少
 * - 质检相关：这批行不行、合格吗、检测过了没
 * - 供应商/客户：谁送来的、哪家送的、给谁了
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Slf4j
@Component
public class ColloquialMappings {

    /**
     * 口语 -> 标准表达映射
     * 使用 LinkedHashMap 保持插入顺序（较长的模式优先匹配）
     */
    private static final Map<String, String> COLLOQUIAL_MAP = new LinkedHashMap<>();

    /**
     * 预编译的正则模式（用于包含变体的口语）
     */
    private static final Map<Pattern, String> PATTERN_MAP = new LinkedHashMap<>();

    static {
        // ==================== 入库相关 ====================
        COLLOQUIAL_MAP.put("货到了没", "查询入库状态");
        COLLOQUIAL_MAP.put("货到了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("到货了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("到货了没", "查询入库状态");
        COLLOQUIAL_MAP.put("收到货没", "查询入库状态");
        COLLOQUIAL_MAP.put("收到货了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("东西到了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("东西到了没", "查询入库状态");
        COLLOQUIAL_MAP.put("材料到了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("原料到了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("进来了吗", "查询入库状态");
        COLLOQUIAL_MAP.put("进来了没", "查询入库状态");

        // 正则模式：X到了吗/没
        PATTERN_MAP.put(Pattern.compile(".{1,10}到了[吗没]"), "查询入库状态");
        PATTERN_MAP.put(Pattern.compile("收到.{1,10}[吗没]"), "查询入库状态");

        // ==================== 发货相关 ====================
        COLLOQUIAL_MAP.put("东西发出去了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("东西发出去了没", "查询发货状态");
        COLLOQUIAL_MAP.put("发了没", "查询发货状态");
        COLLOQUIAL_MAP.put("发了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("发货了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("发货了没", "查询发货状态");
        COLLOQUIAL_MAP.put("寄出去了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("寄出去了没", "查询发货状态");
        COLLOQUIAL_MAP.put("出货了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("出货了没", "查询发货状态");
        COLLOQUIAL_MAP.put("发走了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("发走了没", "查询发货状态");
        COLLOQUIAL_MAP.put("送出去了吗", "查询发货状态");
        COLLOQUIAL_MAP.put("送走了吗", "查询发货状态");

        // 正则模式
        PATTERN_MAP.put(Pattern.compile("发.{0,5}[了没吗]"), "查询发货状态");
        PATTERN_MAP.put(Pattern.compile("寄.{0,5}[了没吗]"), "查询发货状态");

        // ==================== 库存相关 ====================
        COLLOQUIAL_MAP.put("看看还剩多少", "查询库存数量");
        COLLOQUIAL_MAP.put("还有多少", "查询库存数量");
        COLLOQUIAL_MAP.put("库存多少", "查询库存数量");
        COLLOQUIAL_MAP.put("剩多少", "查询库存数量");
        COLLOQUIAL_MAP.put("剩余多少", "查询库存数量");
        COLLOQUIAL_MAP.put("还剩多少", "查询库存数量");
        COLLOQUIAL_MAP.put("有多少存货", "查询库存数量");
        COLLOQUIAL_MAP.put("存货多少", "查询库存数量");
        COLLOQUIAL_MAP.put("仓库里有多少", "查询库存数量");
        COLLOQUIAL_MAP.put("库里有多少", "查询库存数量");
        COLLOQUIAL_MAP.put("够不够", "查询库存数量");
        COLLOQUIAL_MAP.put("够用吗", "查询库存数量");
        COLLOQUIAL_MAP.put("缺不缺货", "查询库存数量");
        COLLOQUIAL_MAP.put("有没有货", "查询库存数量");
        COLLOQUIAL_MAP.put("有货吗", "查询库存数量");

        // 正则模式
        PATTERN_MAP.put(Pattern.compile("还[有剩]多少"), "查询库存数量");
        PATTERN_MAP.put(Pattern.compile(".{1,10}库存"), "查询库存数量");

        // ==================== 质检相关 ====================
        COLLOQUIAL_MAP.put("这批行不行", "查询质检结果");
        COLLOQUIAL_MAP.put("这批能用吗", "查询质检结果");
        COLLOQUIAL_MAP.put("合格吗", "查询质检结果");
        COLLOQUIAL_MAP.put("合格了吗", "查询质检结果");
        COLLOQUIAL_MAP.put("合格了没", "查询质检结果");
        COLLOQUIAL_MAP.put("检测过了没", "查询质检结果");
        COLLOQUIAL_MAP.put("检测过了吗", "查询质检结果");
        COLLOQUIAL_MAP.put("检验了吗", "查询质检结果");
        COLLOQUIAL_MAP.put("检验过了吗", "查询质检结果");
        COLLOQUIAL_MAP.put("品质怎么样", "查询质检结果");
        COLLOQUIAL_MAP.put("质量怎么样", "查询质检结果");
        COLLOQUIAL_MAP.put("质量如何", "查询质检结果");
        COLLOQUIAL_MAP.put("有没有问题", "查询质检结果");
        COLLOQUIAL_MAP.put("有问题吗", "查询质检结果");
        COLLOQUIAL_MAP.put("能用吗", "查询质检结果");
        COLLOQUIAL_MAP.put("能不能用", "查询质检结果");
        COLLOQUIAL_MAP.put("过检了吗", "查询质检结果");
        COLLOQUIAL_MAP.put("检测结果怎么样", "查询质检结果");

        // 正则模式
        PATTERN_MAP.put(Pattern.compile("这批.{0,5}[行能]不[行能]"), "查询质检结果");
        PATTERN_MAP.put(Pattern.compile("检[测验查].{0,5}[了过]"), "查询质检结果");

        // ==================== 供应商相关 ====================
        COLLOQUIAL_MAP.put("谁送来的", "查询供应商信息");
        COLLOQUIAL_MAP.put("谁送的", "查询供应商信息");
        COLLOQUIAL_MAP.put("哪家送的", "查询供应商信息");
        COLLOQUIAL_MAP.put("哪家送来的", "查询供应商信息");
        COLLOQUIAL_MAP.put("哪个供应商", "查询供应商信息");
        COLLOQUIAL_MAP.put("供应商是谁", "查询供应商信息");
        COLLOQUIAL_MAP.put("从哪来的", "查询供应商信息");
        COLLOQUIAL_MAP.put("从哪进的", "查询供应商信息");
        COLLOQUIAL_MAP.put("哪里进的", "查询供应商信息");
        COLLOQUIAL_MAP.put("进货来源", "查询供应商信息");

        // ==================== 客户相关 ====================
        COLLOQUIAL_MAP.put("给谁了", "查询发货客户");
        COLLOQUIAL_MAP.put("发给谁了", "查询发货客户");
        COLLOQUIAL_MAP.put("送给谁了", "查询发货客户");
        COLLOQUIAL_MAP.put("卖给谁了", "查询发货客户");
        COLLOQUIAL_MAP.put("哪个客户", "查询发货客户");
        COLLOQUIAL_MAP.put("客户是谁", "查询发货客户");
        COLLOQUIAL_MAP.put("发往哪里", "查询发货客户");
        COLLOQUIAL_MAP.put("送往哪里", "查询发货客户");
        COLLOQUIAL_MAP.put("去向", "查询发货客户");

        // ==================== 生产相关 ====================
        COLLOQUIAL_MAP.put("做完了吗", "查询生产状态");
        COLLOQUIAL_MAP.put("做完了没", "查询生产状态");
        COLLOQUIAL_MAP.put("做好了吗", "查询生产状态");
        COLLOQUIAL_MAP.put("生产完了吗", "查询生产状态");
        COLLOQUIAL_MAP.put("加工完了吗", "查询生产状态");
        COLLOQUIAL_MAP.put("进度怎么样", "查询生产状态");
        COLLOQUIAL_MAP.put("进度如何", "查询生产状态");
        COLLOQUIAL_MAP.put("做到哪了", "查询生产状态");
        COLLOQUIAL_MAP.put("进行到哪了", "查询生产状态");

        // ==================== 批次相关 ====================
        COLLOQUIAL_MAP.put("这批是什么", "查询批次信息");
        COLLOQUIAL_MAP.put("这批的情况", "查询批次信息");
        COLLOQUIAL_MAP.put("这批货怎么样", "查询批次信息");
        COLLOQUIAL_MAP.put("批次信息", "查询批次信息");
        COLLOQUIAL_MAP.put("批号是多少", "查询批次信息");
        COLLOQUIAL_MAP.put("批次号是多少", "查询批次信息");

        // ==================== 设备相关 ====================
        COLLOQUIAL_MAP.put("机器正常吗", "查询设备状态");
        COLLOQUIAL_MAP.put("设备正常吗", "查询设备状态");
        COLLOQUIAL_MAP.put("机器坏了吗", "查询设备状态");
        COLLOQUIAL_MAP.put("设备坏了吗", "查询设备状态");
        COLLOQUIAL_MAP.put("能不能开机", "查询设备状态");
        COLLOQUIAL_MAP.put("机器能用吗", "查询设备状态");
        COLLOQUIAL_MAP.put("机器转着没", "查询设备状态");
        COLLOQUIAL_MAP.put("机器转着吗", "查询设备状态");
        COLLOQUIAL_MAP.put("设备咋样", "查询设备状态");
        COLLOQUIAL_MAP.put("设备怎么样", "查询设备状态");

        // ==================== 复杂语义优化 - 口语化表达 ====================
        // 口语词 -> 标准表达
        COLLOQUIAL_MAP.put("咋样", "状态");
        COLLOQUIAL_MAP.put("咋整", "操作");
        COLLOQUIAL_MAP.put("干了多少", "生产数量");  // 用于查询，不是动作
        COLLOQUIAL_MAP.put("干了几个", "生产数量");  // 用于查询，不是动作
        COLLOQUIAL_MAP.put("干了多少活", "生产统计");  // 明确是查询
        COLLOQUIAL_MAP.put("搞完没", "完成状态");
        COLLOQUIAL_MAP.put("弄好没", "完成状态");
        COLLOQUIAL_MAP.put("整好了吗", "完成状态");
        COLLOQUIAL_MAP.put("催没催", "催促状态");
        COLLOQUIAL_MAP.put("催了吗", "催促状态");
        COLLOQUIAL_MAP.put("啥情况", "当前状态");
        COLLOQUIAL_MAP.put("咋回事", "当前状态");
        COLLOQUIAL_MAP.put("咋了", "当前状态");
        COLLOQUIAL_MAP.put("有没有", "是否存在");
        COLLOQUIAL_MAP.put("够不够用", "是否足够");
        COLLOQUIAL_MAP.put("够用不", "是否足够");
        COLLOQUIAL_MAP.put("还行吗", "当前状态");
        COLLOQUIAL_MAP.put("行不行", "是否合格");
        COLLOQUIAL_MAP.put("能不能", "是否可以");
        COLLOQUIAL_MAP.put("来得及吗", "时间状态");
        COLLOQUIAL_MAP.put("赶得上吗", "时间状态");
        COLLOQUIAL_MAP.put("靠谱吗", "可靠性");
        COLLOQUIAL_MAP.put("稳不稳", "稳定性");

        // ==================== 动词口语化表达 ====================
        COLLOQUIAL_MAP.put("瞅瞅", "查看");
        COLLOQUIAL_MAP.put("瞧瞧", "查看");
        COLLOQUIAL_MAP.put("看下", "查看");
        COLLOQUIAL_MAP.put("看一下", "查看");
        COLLOQUIAL_MAP.put("查下", "查询");
        COLLOQUIAL_MAP.put("查一下", "查询");
        COLLOQUIAL_MAP.put("帮看下", "查看");
        COLLOQUIAL_MAP.put("帮查下", "查询");
        COLLOQUIAL_MAP.put("整理下", "统计");
        COLLOQUIAL_MAP.put("算算", "统计");
        COLLOQUIAL_MAP.put("数数", "统计数量");
        COLLOQUIAL_MAP.put("拉一下", "导出");
        COLLOQUIAL_MAP.put("拉个", "导出");
        COLLOQUIAL_MAP.put("弄一份", "生成");
        COLLOQUIAL_MAP.put("搞一个", "创建");
        COLLOQUIAL_MAP.put("加一个", "添加");
        COLLOQUIAL_MAP.put("录一下", "录入");
        COLLOQUIAL_MAP.put("改一下", "修改");
        COLLOQUIAL_MAP.put("动一下", "调整");

        // ==================== 否定句口语化 ====================
        COLLOQUIAL_MAP.put("没出问题吧", "是否正常");
        COLLOQUIAL_MAP.put("没事吧", "是否正常");
        COLLOQUIAL_MAP.put("没有吧", "是否存在");
        COLLOQUIAL_MAP.put("不会吧", "是否存在");
        COLLOQUIAL_MAP.put("没坏吧", "是否正常");
        COLLOQUIAL_MAP.put("没超吧", "是否超标");
        COLLOQUIAL_MAP.put("没漏吧", "是否遗漏");

        // ==================== 时间口语化表达 ====================
        COLLOQUIAL_MAP.put("今儿", "今天");
        COLLOQUIAL_MAP.put("昨儿", "昨天");
        COLLOQUIAL_MAP.put("明儿", "明天");
        COLLOQUIAL_MAP.put("前儿", "前天");
        COLLOQUIAL_MAP.put("这几天", "最近三天");
        COLLOQUIAL_MAP.put("那几天", "之前三天");
        COLLOQUIAL_MAP.put("上回", "上次");
        COLLOQUIAL_MAP.put("这回", "本次");
        COLLOQUIAL_MAP.put("那回", "那次");
        COLLOQUIAL_MAP.put("刚才", "刚刚");
        COLLOQUIAL_MAP.put("刚刚", "最近");
        COLLOQUIAL_MAP.put("一会儿", "稍后");

        // ==================== 程度/数量口语化 ====================
        COLLOQUIAL_MAP.put("多少钱", "金额");
        COLLOQUIAL_MAP.put("多重", "重量");
        COLLOQUIAL_MAP.put("多大", "数量");
        COLLOQUIAL_MAP.put("几个", "数量");
        COLLOQUIAL_MAP.put("多少个", "数量");
        COLLOQUIAL_MAP.put("有几批", "批次数量");
        COLLOQUIAL_MAP.put("多少批", "批次数量");
        COLLOQUIAL_MAP.put("哪些", "列表");
        COLLOQUIAL_MAP.put("有啥", "有哪些");
        COLLOQUIAL_MAP.put("都有啥", "所有列表");
        COLLOQUIAL_MAP.put("有多少", "数量统计");

        // ==================== v7.2新增：复杂语义口语化 ====================
        // 设备运行状态口语化
        COLLOQUIAL_MAP.put("转着", "运行中");
        COLLOQUIAL_MAP.put("转着呢", "运行中");
        COLLOQUIAL_MAP.put("开着呢", "运行中");
        COLLOQUIAL_MAP.put("停着呢", "停止中");
        COLLOQUIAL_MAP.put("闲着呢", "空闲中");
        COLLOQUIAL_MAP.put("跑着", "运行中");
        COLLOQUIAL_MAP.put("干着", "运行中");

        // 状态确认口语化
        COLLOQUIAL_MAP.put("好使吗", "是否正常");
        COLLOQUIAL_MAP.put("好用吗", "是否正常");
        COLLOQUIAL_MAP.put("顶用吗", "是否有效");
        COLLOQUIAL_MAP.put("管用吗", "是否有效");
        COLLOQUIAL_MAP.put("行得通吗", "是否可行");
        COLLOQUIAL_MAP.put("没毛病吧", "是否正常");
        COLLOQUIAL_MAP.put("有毛病吗", "是否有问题");
        COLLOQUIAL_MAP.put("出岔子没", "是否出错");

        // 时间状态确认
        COLLOQUIAL_MAP.put("忙完了吗", "是否完成");
        COLLOQUIAL_MAP.put("完事了吗", "是否完成");
        COLLOQUIAL_MAP.put("弄完了吗", "是否完成");
        COLLOQUIAL_MAP.put("搞定了吗", "是否完成");
        COLLOQUIAL_MAP.put("结了没", "是否完成");
        COLLOQUIAL_MAP.put("了结了吗", "是否完成");

        // 数量确认口语化
        COLLOQUIAL_MAP.put("还剩几个", "剩余数量");
        COLLOQUIAL_MAP.put("还剩多少", "剩余数量");
        COLLOQUIAL_MAP.put("剩几个了", "剩余数量");
        COLLOQUIAL_MAP.put("剩多少了", "剩余数量");
        COLLOQUIAL_MAP.put("用了多少", "消耗数量");
        COLLOQUIAL_MAP.put("消耗多少", "消耗数量");
        COLLOQUIAL_MAP.put("花了多少", "消耗数量");

        // 进度查询口语化
        COLLOQUIAL_MAP.put("进行到哪了", "查询进度");
        COLLOQUIAL_MAP.put("做到哪了", "查询进度");
        COLLOQUIAL_MAP.put("搞到哪了", "查询进度");
        COLLOQUIAL_MAP.put("弄到哪了", "查询进度");
        COLLOQUIAL_MAP.put("到哪一步了", "查询进度");
        COLLOQUIAL_MAP.put("进度咋样", "查询进度");

        // 否定句作为查询
        COLLOQUIAL_MAP.put("是不是", "是否");
        COLLOQUIAL_MAP.put("有没有", "是否有");
        COLLOQUIAL_MAP.put("做没做", "是否完成");
        COLLOQUIAL_MAP.put("发没发", "是否发货");
        COLLOQUIAL_MAP.put("到没到", "是否到货");
        COLLOQUIAL_MAP.put("收没收", "是否收货");
        COLLOQUIAL_MAP.put("检没检", "是否质检");
        COLLOQUIAL_MAP.put("验没验", "是否检验");

        // 祈使句转查询（当带有时间词或条件词时）
        COLLOQUIAL_MAP.put("帮忙看", "查看");
        COLLOQUIAL_MAP.put("帮忙查", "查询");
        COLLOQUIAL_MAP.put("帮忙统计", "统计");
        COLLOQUIAL_MAP.put("帮忙找", "查找");
        COLLOQUIAL_MAP.put("帮忙拉", "导出");

        // 跨领域口语化
        COLLOQUIAL_MAP.put("厂里", "工厂");
        COLLOQUIAL_MAP.put("库里", "仓库");
        COLLOQUIAL_MAP.put("车间里", "车间");
        COLLOQUIAL_MAP.put("线上", "生产线");

        // 方言/俚语（更广泛）
        COLLOQUIAL_MAP.put("啥玩意儿", "什么");
        COLLOQUIAL_MAP.put("整啥", "做什么");
        COLLOQUIAL_MAP.put("弄啥", "做什么");
        COLLOQUIAL_MAP.put("干啥", "做什么");
        COLLOQUIAL_MAP.put("搞啥", "做什么");
        COLLOQUIAL_MAP.put("要啥", "需要什么");
        COLLOQUIAL_MAP.put("缺啥", "缺少什么");
        COLLOQUIAL_MAP.put("少啥", "缺少什么");

        // 确认类简短口语
        COLLOQUIAL_MAP.put("OK吗", "是否可以");
        COLLOQUIAL_MAP.put("ok吗", "是否可以");
        COLLOQUIAL_MAP.put("可以吗", "是否可以");
        COLLOQUIAL_MAP.put("成吗", "是否可以");
        COLLOQUIAL_MAP.put("行吗", "是否可以");
        COLLOQUIAL_MAP.put("妥吗", "是否可以");
        COLLOQUIAL_MAP.put("稳吗", "是否稳定");

        // ==================== 正则模式补充 ====================
        // 口语化疑问句模式
        PATTERN_MAP.put(Pattern.compile(".{1,10}咋样"), "查询状态");
        PATTERN_MAP.put(Pattern.compile(".{1,10}啥情况"), "查询状态");
        PATTERN_MAP.put(Pattern.compile(".{1,10}怎么样了"), "查询状态");
        PATTERN_MAP.put(Pattern.compile("干了.{0,5}[吗没]"), "查询完成状态");
        PATTERN_MAP.put(Pattern.compile("做了.{0,5}[吗没]"), "查询完成状态");
        PATTERN_MAP.put(Pattern.compile("整了.{0,5}[吗没]"), "查询完成状态");

        // v7.2新增正则模式
        PATTERN_MAP.put(Pattern.compile(".{1,5}没.{1,5}[吗没呢]"), "查询状态");  // X没X吗 模式
        PATTERN_MAP.put(Pattern.compile(".{1,10}是不是"), "是否");
        PATTERN_MAP.put(Pattern.compile(".{1,10}有没有"), "是否有");
        PATTERN_MAP.put(Pattern.compile("帮.{0,3}[看查找拉统计]"), "查询");
        PATTERN_MAP.put(Pattern.compile("[转开停闲跑]着[呢吗没]?"), "查询设备状态");
    }

    /**
     * 将口语化表达标准化
     *
     * @param input 用户输入
     * @return 标准化后的表达，如果无法识别则返回 Optional.empty()
     */
    public Optional<String> standardize(String input) {
        if (input == null || input.trim().isEmpty()) {
            return Optional.empty();
        }

        String trimmedInput = input.trim();

        // 1. 精确匹配
        String exactMatch = COLLOQUIAL_MAP.get(trimmedInput);
        if (exactMatch != null) {
            log.debug("口语标准化(精确匹配): '{}' -> '{}'", input, exactMatch);
            return Optional.of(exactMatch);
        }

        // 2. 包含匹配（输入包含口语）
        for (Map.Entry<String, String> entry : COLLOQUIAL_MAP.entrySet()) {
            if (trimmedInput.contains(entry.getKey())) {
                log.debug("口语标准化(包含匹配): '{}' 包含 '{}' -> '{}'",
                        input, entry.getKey(), entry.getValue());
                return Optional.of(entry.getValue());
            }
        }

        // 3. 正则匹配
        for (Map.Entry<Pattern, String> entry : PATTERN_MAP.entrySet()) {
            if (entry.getKey().matcher(trimmedInput).find()) {
                log.debug("口语标准化(正则匹配): '{}' -> '{}'", input, entry.getValue());
                return Optional.of(entry.getValue());
            }
        }

        return Optional.empty();
    }

    /**
     * 在文本中查找并替换口语表达
     *
     * @param text 原始文本
     * @return 替换结果
     */
    public StandardizationResult findAndReplace(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new StandardizationResult(text, Collections.emptyList(), Collections.emptyList());
        }

        String result = text;
        List<String> foundColloquials = new ArrayList<>();
        List<String> standardizedTerms = new ArrayList<>();

        // 1. 按长度降序排列口语（优先匹配较长的）
        List<Map.Entry<String, String>> sortedEntries = new ArrayList<>(COLLOQUIAL_MAP.entrySet());
        sortedEntries.sort((a, b) -> b.getKey().length() - a.getKey().length());

        for (Map.Entry<String, String> entry : sortedEntries) {
            String colloquial = entry.getKey();
            if (result.contains(colloquial)) {
                foundColloquials.add(colloquial);
                standardizedTerms.add(entry.getValue());
                result = result.replace(colloquial, entry.getValue());
            }
        }

        // 2. 正则模式匹配
        for (Map.Entry<Pattern, String> entry : PATTERN_MAP.entrySet()) {
            java.util.regex.Matcher matcher = entry.getKey().matcher(result);
            while (matcher.find()) {
                String matched = matcher.group();
                if (!foundColloquials.contains(matched)) {
                    foundColloquials.add(matched);
                    standardizedTerms.add(entry.getValue());
                    result = result.replace(matched, entry.getValue());
                }
            }
        }

        return new StandardizationResult(result, foundColloquials, standardizedTerms);
    }

    /**
     * 获取所有口语模式（用于显示或调试）
     *
     * @return 所有口语模式列表
     */
    public List<String> getAllPatterns() {
        List<String> patterns = new ArrayList<>();
        patterns.addAll(COLLOQUIAL_MAP.keySet());
        for (Pattern pattern : PATTERN_MAP.keySet()) {
            patterns.add("(regex) " + pattern.pattern());
        }
        return patterns;
    }

    /**
     * 获取所有标准表达（用于统计）
     *
     * @return 标准表达及其口语变体数量
     */
    public Map<String, Integer> getStandardExpressionCounts() {
        Map<String, Integer> counts = new HashMap<>();
        for (String standard : COLLOQUIAL_MAP.values()) {
            counts.merge(standard, 1, Integer::sum);
        }
        for (String standard : PATTERN_MAP.values()) {
            counts.merge(standard, 1, Integer::sum);
        }
        return counts;
    }

    /**
     * 检查文本是否包含口语表达
     */
    public boolean containsColloquial(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        // 检查精确匹配
        for (String colloquial : COLLOQUIAL_MAP.keySet()) {
            if (text.contains(colloquial)) {
                return true;
            }
        }
        // 检查正则匹配
        for (Pattern pattern : PATTERN_MAP.keySet()) {
            if (pattern.matcher(text).find()) {
                return true;
            }
        }
        return false;
    }

    /**
     * 添加自定义映射（运行时动态添加）
     *
     * @param colloquial       口语表达
     * @param standardExpression 标准表达
     */
    public void addMapping(String colloquial, String standardExpression) {
        if (colloquial != null && standardExpression != null) {
            COLLOQUIAL_MAP.put(colloquial, standardExpression);
            log.info("添加口语映射: '{}' -> '{}'", colloquial, standardExpression);
        }
    }

    // ==================== 结果类 ====================

    /**
     * 标准化结果
     */
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class StandardizationResult {
        /** 处理后的文本 */
        private String processedText;
        /** 找到的口语表达列表 */
        private List<String> foundColloquials;
        /** 对应的标准表达列表 */
        private List<String> standardizedTerms;

        /**
         * 是否有口语被替换
         */
        public boolean hasReplacements() {
            return foundColloquials != null && !foundColloquials.isEmpty();
        }

        /**
         * 获取替换数量
         */
        public int getReplacementCount() {
            return foundColloquials != null ? foundColloquials.size() : 0;
        }
    }
}
