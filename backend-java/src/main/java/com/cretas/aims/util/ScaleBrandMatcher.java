package com.cretas.aims.util;

import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 秤品牌匹配工具类
 *
 * 提取 ScaleIntentHandler 中重复的品牌别名匹配逻辑
 * - 品牌别名映射 (中文 -> 英文代码)
 * - 型号解析
 * - 智能协议匹配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Component
public class ScaleBrandMatcher {

    private final ScaleBrandModelRepository scaleBrandModelRepository;
    private final ScaleProtocolConfigRepository scaleProtocolConfigRepository;

    /**
     * 品牌别名映射 (中文 -> 英文代码)
     */
    public static final Map<String, String> BRAND_ALIASES = Map.ofEntries(
            Map.entry("柯力", "KELI"),
            Map.entry("耀华", "YAOHUA"),
            Map.entry("矽策", "XICE"),
            Map.entry("英展", "YIZHENG"),
            Map.entry("梅特勒", "METTLER"),
            Map.entry("托利多", "TOLEDO"),
            Map.entry("赛多利斯", "SARTORIUS"),
            Map.entry("奥豪斯", "OHAUS")
    );

    /**
     * 型号匹配模式 (如 D2008, XK3190-A9)
     */
    private static final Pattern MODEL_PATTERN = Pattern.compile("([A-Za-z]+\\d+[A-Za-z0-9-]*)");

    /**
     * 16进制数据匹配模式
     */
    public static final Pattern HEX_PATTERN = Pattern.compile("([0-9A-Fa-f]{2}\\s*)+");

    /**
     * 重量数据匹配模式
     */
    public static final Pattern WEIGHT_PATTERN = Pattern.compile(
            "(\\d+(?:\\.\\d+)?)\\s*(kg|g|t|吨|公斤|克)?",
            Pattern.CASE_INSENSITIVE
    );

    public ScaleBrandMatcher(ScaleBrandModelRepository scaleBrandModelRepository,
                              ScaleProtocolConfigRepository scaleProtocolConfigRepository) {
        this.scaleBrandModelRepository = scaleBrandModelRepository;
        this.scaleProtocolConfigRepository = scaleProtocolConfigRepository;
    }

    /**
     * 品牌匹配结果
     */
    @Getter
    public static class BrandMatchResult {
        private final String brandCode;
        private final String brandName;

        public BrandMatchResult(String brandCode, String brandName) {
            this.brandCode = brandCode;
            this.brandName = brandName;
        }

        public boolean isMatched() {
            return brandCode != null;
        }
    }

    /**
     * 智能协议匹配结果
     */
    @Getter
    public static class ProtocolMatchInfo {
        private final String protocolId;
        private final String protocolCode;
        private final String protocolName;
        private final String matchType; // EXACT_BRAND_MODEL, BRAND_ONLY, BRAND_MODEL_DEFAULT
        private final boolean verified;

        public ProtocolMatchInfo(ScaleProtocolConfig config, String matchType) {
            this.protocolId = config.getId();
            this.protocolCode = config.getProtocolCode();
            this.protocolName = config.getProtocolName();
            this.matchType = matchType;
            this.verified = Boolean.TRUE.equals(config.getIsVerified());
        }

        /**
         * 获取匹配类型的中文描述
         */
        public String getMatchTypeDescription() {
            return switch (matchType) {
                case "EXACT_BRAND_MODEL" -> "精确匹配";
                case "BRAND_ONLY" -> "品牌匹配";
                case "BRAND_MODEL_DEFAULT" -> "默认协议";
                default -> matchType;
            };
        }
    }

    /**
     * 从用户输入中匹配品牌
     *
     * @param userInput 用户输入的文本
     * @return 品牌匹配结果
     */
    public BrandMatchResult matchBrandFromInput(String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return new BrandMatchResult(null, null);
        }

        for (Map.Entry<String, String> entry : BRAND_ALIASES.entrySet()) {
            if (userInput.contains(entry.getKey())) {
                return new BrandMatchResult(entry.getValue(), entry.getKey());
            }
        }

        return new BrandMatchResult(null, null);
    }

    /**
     * 标准化品牌名称
     *
     * 将识别到的品牌字符串转换为标准的品牌代码和名称
     *
     * @param recognizedBrand 识别到的品牌字符串 (可能是中文或英文)
     * @return 标准化的品牌匹配结果
     */
    public BrandMatchResult normalizeBrand(String recognizedBrand) {
        if (recognizedBrand == null || recognizedBrand.isEmpty()) {
            return new BrandMatchResult(null, null);
        }

        for (Map.Entry<String, String> entry : BRAND_ALIASES.entrySet()) {
            if (recognizedBrand.contains(entry.getKey()) ||
                    recognizedBrand.equalsIgnoreCase(entry.getValue())) {
                return new BrandMatchResult(entry.getValue(), entry.getKey());
            }
        }

        // 无法标准化，使用原始值
        return new BrandMatchResult(recognizedBrand, recognizedBrand);
    }

    /**
     * 从用户输入中解析型号
     *
     * @param userInput 用户输入的文本
     * @return 型号代码，如果未找到返回 null
     */
    public String parseModelCode(String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return null;
        }

        Matcher matcher = MODEL_PATTERN.matcher(userInput);
        if (matcher.find()) {
            return matcher.group(1).toUpperCase();
        }
        return null;
    }

    /**
     * 查找品牌型号配置
     *
     * @param brandCode 品牌代码
     * @param modelCode 型号代码 (可选)
     * @return 品牌型号配置
     */
    public Optional<ScaleBrandModel> findBrandModel(String brandCode, String modelCode) {
        if (brandCode == null || brandCode.isEmpty()) {
            return Optional.empty();
        }

        // 1. 精确匹配品牌+型号
        if (modelCode != null && !modelCode.isEmpty()) {
            Optional<ScaleBrandModel> exactMatch = scaleBrandModelRepository
                    .findByBrandCodeAndModelCode(brandCode, modelCode);
            if (exactMatch.isPresent()) {
                return exactMatch;
            }
        }

        // 2. 仅按品牌匹配
        List<ScaleBrandModel> brandModels = scaleBrandModelRepository.findByBrandCode(brandCode);
        if (!brandModels.isEmpty()) {
            return Optional.of(brandModels.get(0));
        }

        return Optional.empty();
    }

    /**
     * 智能协议匹配
     *
     * 匹配策略 (按优先级):
     * 1. 精确匹配: 品牌+型号 (如 KELI_D2008_ASCII)
     * 2. 品牌匹配: 仅品牌 (如 KELI_*)
     * 3. 品牌型号默认: 使用 ScaleBrandModel.defaultProtocolId
     *
     * 在每个级别内，优先选择:
     * - 已验证 (isVerified=true)
     * - 内置 (isBuiltin=true)
     *
     * @param factoryId                  工厂ID
     * @param brandCode                  品牌代码 (如 KELI)
     * @param modelCode                  型号代码 (如 D2008)，可为null
     * @param brandModelDefaultProtocolId 品牌型号配置的默认协议ID，可为null
     * @return 匹配结果，如果无匹配返回null
     */
    public ProtocolMatchInfo findBestMatchingProtocol(String factoryId, String brandCode,
                                                       String modelCode, String brandModelDefaultProtocolId) {
        if (brandCode == null || brandCode.isEmpty()) {
            return null;
        }

        log.debug("协议智能匹配: factoryId={}, brandCode={}, modelCode={}, defaultProtocolId={}",
                factoryId, brandCode, modelCode, brandModelDefaultProtocolId);

        // 策略1: 精确匹配品牌+型号
        if (modelCode != null && !modelCode.isEmpty()) {
            List<ScaleProtocolConfig> exactMatches = scaleProtocolConfigRepository
                    .findByBrandModelPattern(brandCode, modelCode, factoryId);
            if (!exactMatches.isEmpty()) {
                ScaleProtocolConfig best = exactMatches.get(0); // 已按 isVerified, isBuiltin 排序
                log.info("协议匹配成功 [精确品牌+型号]: code={}, name={}, verified={}",
                        best.getProtocolCode(), best.getProtocolName(), best.getIsVerified());
                return new ProtocolMatchInfo(best, "EXACT_BRAND_MODEL");
            }
        }

        // 策略2: 品牌模糊匹配
        List<ScaleProtocolConfig> brandMatches = scaleProtocolConfigRepository
                .findByBrandCodePattern(brandCode, factoryId);
        if (!brandMatches.isEmpty()) {
            ScaleProtocolConfig best = brandMatches.get(0);
            log.info("协议匹配成功 [品牌匹配]: code={}, name={}, verified={}",
                    best.getProtocolCode(), best.getProtocolName(), best.getIsVerified());
            return new ProtocolMatchInfo(best, "BRAND_ONLY");
        }

        // 策略3: 使用品牌型号默认协议
        if (brandModelDefaultProtocolId != null && !brandModelDefaultProtocolId.isEmpty()) {
            Optional<ScaleProtocolConfig> defaultProtocol = scaleProtocolConfigRepository
                    .findById(brandModelDefaultProtocolId);
            if (defaultProtocol.isPresent()) {
                ScaleProtocolConfig config = defaultProtocol.get();
                log.info("协议匹配成功 [品牌型号默认]: code={}, name={}, verified={}",
                        config.getProtocolCode(), config.getProtocolName(), config.getIsVerified());
                return new ProtocolMatchInfo(config, "BRAND_MODEL_DEFAULT");
            }
        }

        log.warn("协议匹配失败: 无法找到匹配的协议 brandCode={}, modelCode={}", brandCode, modelCode);
        return null;
    }

    /**
     * 解析秤类型
     *
     * @param input 用户输入
     * @return 秤类型
     */
    public ScaleBrandModel.ScaleType parseScaleType(String input) {
        if (input == null) {
            return ScaleBrandModel.ScaleType.DESKTOP;
        }
        if (input.contains("地磅") || input.contains("汽车衡")) {
            return ScaleBrandModel.ScaleType.FLOOR;
        } else if (input.contains("台秤") || input.contains("电子台秤")) {
            return ScaleBrandModel.ScaleType.PLATFORM;
        } else {
            return ScaleBrandModel.ScaleType.DESKTOP;
        }
    }

    /**
     * 获取状态标签
     *
     * @param status 状态代码
     * @return 中文标签
     */
    public static String getStatusLabel(String status) {
        if (status == null) return "未知";
        return switch (status.toLowerCase()) {
            case "idle" -> "空闲";
            case "active" -> "运行中";
            case "offline" -> "离线";
            case "error" -> "故障";
            case "maintenance" -> "维护中";
            default -> status;
        };
    }
}
