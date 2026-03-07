# 店铺装修系统端到端打通 — 实施方案

> Agent Team 研究报告 | 2026-03-04
> Mode: Full | Researchers: 3 | Phases: Research → Analysis → Critique → Integration

---

## Executive Summary

MallCenter 店铺装修功能**前端 UI 完整但后端全是空壳**。核心问题 4 个：
1. `merchant_page_config` 表不存在 → 配置无法持久化
2. `GET /page` 和 `HomeInitApi` 硬编码返回绿色 → 首页永远不变
3. `POST /page-config` 是 TODO → 保存是假的
4. `decoration_theme_preset` 表为空 → 主题列表 API 返回 `[]`

**额外需求**：店名、Logo、Slogan、通知栏文字目前全部硬编码在 WXML 中，需要加入装修配置。

**实施规模**：7 个文件修改 + 2 个文件新建 + 1 个 SQL 迁移脚本 + 1 个种子数据脚本

---

## 一、数据库变更

### 1.1 建表：merchant_page_config

```sql
-- V3.6__add_merchant_page_config.sql

CREATE TABLE IF NOT EXISTS merchant_page_config (
    id              BIGSERIAL PRIMARY KEY,
    merchant_id     BIGINT,
    page_type       VARCHAR(50) NOT NULL DEFAULT 'home',
    page_name       VARCHAR(100),

    -- 店铺基础信息
    shop_name       VARCHAR(200),
    logo_url        VARCHAR(500),
    slogan          VARCHAR(500),

    -- 通知栏配置 JSON: [{"text":"欢迎光临"},{"text":"扫码溯源"}]
    notice_texts    TEXT,

    -- 主题配置
    theme_preset_id BIGINT,
    theme_code      VARCHAR(50),
    custom_theme    TEXT,  -- JSON: {"primaryColor":"#1890ff","secondaryColor":"#096dd9",...}

    -- 模块/布局配置
    modules_config  TEXT,  -- JSON
    page_config     TEXT,  -- JSON: 自定义区块标题、功能开关等

    -- Banner 配置 JSON: [{"imageUrl":"...","linkUrl":"..."}]
    banner_config   TEXT,

    -- SEO
    seo_title       VARCHAR(200),
    seo_keywords    VARCHAR(500),
    seo_description TEXT,

    -- 状态: 0草稿 1已发布
    status          INTEGER DEFAULT 1,
    version         INTEGER DEFAULT 1,
    publish_time    TIMESTAMP,
    create_by       BIGINT,
    create_time     TIMESTAMP DEFAULT NOW(),
    update_time     TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_mpc_merchant_page ON merchant_page_config(merchant_id, page_type);
CREATE INDEX idx_mpc_status ON merchant_page_config(status);

-- 插入默认配置（所有商户共用，merchant_id=NULL 表示全局默认）
INSERT INTO merchant_page_config (merchant_id, page_type, shop_name, logo_url, slogan, notice_texts, theme_code, custom_theme, status)
VALUES (
    NULL,
    'home',
    '白垩纪食品溯源商城',
    '/public/img/logo-duxianlai.png',
    '新鲜直达，品质生活',
    '[{"text":"欢迎使用白垩纪食品溯源商城"},{"text":"扫码即可查看商品溯源信息"},{"text":"联系电话：13916928096"}]',
    'fresh_green',
    '{"primaryColor":"#52c41a","secondaryColor":"#1a1a1a","backgroundColor":"#f5f5f5","textColor":"#333333","accentColor":"#52c41a","noticeBackground":"#d7f0db","noticeTextColor":"#389e0d","primaryLight":"#d7f0db","primaryDark":"#389e0d"}',
    1
);
```

### 1.2 种子数据：decoration_theme_preset

```sql
-- V3.7__seed_decoration_themes.sql

INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, status, sort_order, use_count, create_time) VALUES
('清新绿', 'fresh_green', '自然清新，适合生鲜蔬果、有机食品',
 '{"primaryColor":"#52c41a","secondaryColor":"#389e0d","backgroundColor":"#f5f5f5","noticeBackground":"#d7f0db","noticeTextColor":"#389e0d","primaryLight":"#d7f0db","primaryDark":"#389e0d","headerBackground":"#1a1a1a"}',
 'fresh,natural,organic', 'food,organic,vegetable,fruit', '新鲜直达，品质生活', 1, 1, 0, NOW()),

('海洋蓝', 'ocean_blue', '清爽海洋风，适合海鲜水产、进口食品',
 '{"primaryColor":"#1890ff","secondaryColor":"#096dd9","backgroundColor":"#f0f7ff","noticeBackground":"#d6e8ff","noticeTextColor":"#096dd9","primaryLight":"#d6e8ff","primaryDark":"#096dd9","headerBackground":"#001529"}',
 'ocean,fresh,cool', 'seafood,import,frozen', '深海臻选，鲜活到家', 1, 2, 0, NOW()),

('田园绿', 'farm_green', '淳朴自然，适合农产品、土特产',
 '{"primaryColor":"#7CB305","secondaryColor":"#5B8C00","backgroundColor":"#f9ffe6","noticeBackground":"#e8f5c8","noticeTextColor":"#5B8C00","primaryLight":"#e8f5c8","primaryDark":"#5B8C00","headerBackground":"#1a2e00"}',
 'farm,rustic,natural', 'farm,specialty,grain', '田间直送，原味乡土', 1, 3, 0, NOW()),

('经典金', 'classic_gold', '尊贵大气，适合高端礼品、奢侈品',
 '{"primaryColor":"#D4AF37","secondaryColor":"#B8860B","backgroundColor":"#fffef5","noticeBackground":"#fff8d6","noticeTextColor":"#B8860B","primaryLight":"#fff8d6","primaryDark":"#B8860B","headerBackground":"#1a1500"}',
 'luxury,classic,premium', 'gift,jewelry,wine,tea', '臻选品质，尊享生活', 1, 4, 0, NOW()),

('茶韵棕', 'tea_brown', '古朴雅致，适合茶叶、咖啡、传统糕点',
 '{"primaryColor":"#8B4513","secondaryColor":"#6D4C41","backgroundColor":"#faf5f0","noticeBackground":"#f0e4d7","noticeTextColor":"#6D4C41","primaryLight":"#f0e4d7","primaryDark":"#6D4C41","headerBackground":"#2d1a0a"}',
 'tea,elegant,traditional', 'tea,coffee,pastry', '一盏茶香，品味人生', 1, 5, 0, NOW()),

('母婴暖', 'baby_warm', '柔和温暖，适合母婴用品、儿童玩具',
 '{"primaryColor":"#F4C2C2","secondaryColor":"#EE96AA","backgroundColor":"#fff5f5","noticeBackground":"#ffe8e8","noticeTextColor":"#EE96AA","primaryLight":"#ffe8e8","primaryDark":"#EE96AA","headerBackground":"#4a1a2a"}',
 'warm,soft,caring', 'baby,mother,children,toy', '用心呵护，陪伴成长', 1, 6, 0, NOW()),

('甜美粉', 'sweet_pink', '温馨甜美，适合甜品烘焙、少女风',
 '{"primaryColor":"#eb2f96","secondaryColor":"#c41d7f","backgroundColor":"#fff0f6","noticeBackground":"#ffd6eb","noticeTextColor":"#c41d7f","primaryLight":"#ffd6eb","primaryDark":"#c41d7f","headerBackground":"#2a0a1a"}',
 'sweet,romantic,pink', 'bakery,dessert,girl,gift', '甜蜜时光，幸福味道', 1, 7, 0, NOW()),

('美妆紫', 'beauty_purple', '优雅浪漫，适合美妆护肤、时尚配饰',
 '{"primaryColor":"#722ED1","secondaryColor":"#531DAB","backgroundColor":"#f9f0ff","noticeBackground":"#e8d6ff","noticeTextColor":"#531DAB","primaryLight":"#e8d6ff","primaryDark":"#531DAB","headerBackground":"#1a0a2d"}',
 'elegant,romantic,fashion', 'cosmetics,skincare,fashion,perfume', '美丽绽放，自信由我', 1, 8, 0, NOW()),

('深夜黑', 'dark_night', '酷炫潮流，适合潮牌服饰、电竞周边',
 '{"primaryColor":"#FAAD14","secondaryColor":"#D48806","backgroundColor":"#1a1a1a","noticeBackground":"#333333","noticeTextColor":"#FAAD14","primaryLight":"#3d3d00","primaryDark":"#D48806","headerBackground":"#000000","textColor":"#e0e0e0"}',
 'cool,trendy,dark', 'fashion,streetwear,gaming,nightlife', '释放自我，潮流不息', 1, 9, 0, NOW()),

('科技蓝', 'tech_blue', '科技感十足，适合数码产品、智能家电',
 '{"primaryColor":"#2F54EB","secondaryColor":"#1D39C4","backgroundColor":"#f0f5ff","noticeBackground":"#d6e4ff","noticeTextColor":"#1D39C4","primaryLight":"#d6e4ff","primaryDark":"#1D39C4","headerBackground":"#0a1a3d"}',
 'tech,professional,modern', 'digital,electronic,smart,appliance', '智能生活，触手可及', 1, 10, 0, NOW()),

('自然木', 'natural_wood', '质朴自然，适合家居家具、手工艺品',
 '{"primaryColor":"#A0522D","secondaryColor":"#8B4513","backgroundColor":"#faf5f0","noticeBackground":"#f0e0d0","noticeTextColor":"#8B4513","primaryLight":"#f0e0d0","primaryDark":"#8B4513","headerBackground":"#2d1a0a"}',
 'natural,rustic,warm', 'furniture,home,craft,wood', '匠心之作，温暖家居', 1, 11, 0, NOW()),

('活力橙', 'dopamine_orange', '热情活力，适合促销活动、快消品',
 '{"primaryColor":"#fa8c16","secondaryColor":"#d46b08","backgroundColor":"#fff7e6","noticeBackground":"#ffe7ba","noticeTextColor":"#d46b08","primaryLight":"#ffe7ba","primaryDark":"#d46b08","headerBackground":"#2d1a00"}',
 'energetic,promotion,vibrant', 'snack,beverage,fashion,promotion', '活力满满，惊喜不断', 1, 12, 0, NOW()),

('节日红', 'festival_red', '喜庆热烈，适合节日促销、喜庆礼品',
 '{"primaryColor":"#CF1322","secondaryColor":"#A8071A","backgroundColor":"#fff1f0","noticeBackground":"#ffd6d6","noticeTextColor":"#A8071A","primaryLight":"#ffd6d6","primaryDark":"#A8071A","headerBackground":"#2a0a0a"}',
 'festival,celebration,red', 'festival,gift,specialty,newyear', '喜迎佳节，好礼相送', 1, 13, 0, NOW()),

('医疗蓝', 'medical_blue', '专业可信，适合保健品、健康服务',
 '{"primaryColor":"#13C2C2","secondaryColor":"#08979C","backgroundColor":"#e6fffb","noticeBackground":"#b5f5ec","noticeTextColor":"#08979C","primaryLight":"#b5f5ec","primaryDark":"#08979C","headerBackground":"#002329"}',
 'professional,trust,health', 'health,supplement,medical,wellness', '专业守护，健康生活', 1, 14, 0, NOW()),

('简约白', 'minimal_white', '简洁明了，适合追求极简风格的各类店铺',
 '{"primaryColor":"#333333","secondaryColor":"#666666","backgroundColor":"#ffffff","noticeBackground":"#f5f5f5","noticeTextColor":"#666666","primaryLight":"#f0f0f0","primaryDark":"#666666","headerBackground":"#1a1a1a"}',
 'minimal,clean,simple', 'general,retail,service', '简约不简单', 1, 15, 0, NOW());
```

### 1.3 建表：ai_decoration_session

```sql
CREATE TABLE IF NOT EXISTS ai_decoration_session (
    id              BIGSERIAL PRIMARY KEY,
    session_id      VARCHAR(64) UNIQUE NOT NULL,
    merchant_id     BIGINT,
    industry        VARCHAR(50),
    style           VARCHAR(50),
    theme_code      VARCHAR(50),
    ai_result       TEXT,  -- JSON
    final_config    TEXT,  -- JSON
    status          VARCHAR(20) DEFAULT 'active',
    create_time     TIMESTAMP DEFAULT NOW(),
    update_time     TIMESTAMP DEFAULT NOW()
);
```

---

## 二、后端代码修改清单

### 2.1 新建 MerchantPageConfigMapper.java

**路径**: `logistics-mall/src/main/java/com/joolun/mall/mapper/MerchantPageConfigMapper.java`

```java
package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.MerchantPageConfig;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MerchantPageConfigMapper extends BaseMapper<MerchantPageConfig> {
}
```

### 2.2 修改 MerchantPageConfig.java Entity

**路径**: `logistics-mall/src/main/java/com/joolun/mall/entity/MerchantPageConfig.java`

**新增字段**:
```java
// 在现有字段基础上添加:

/** 店铺名称 */
private String shopName;

/** Logo URL */
private String logoUrl;

/** 店铺标语 */
private String slogan;

/** 通知栏配置 JSON: [{"text":"..."},{"text":"..."}] */
private String noticeTexts;

/** Banner配置 JSON */
private String bannerConfig;

/** 使用的主题编码 */
private String themeCode;
```

### 2.3 修改 MaDecorationApi.java — 核心改造

**路径**: `logistics-admin/src/main/java/com/joolun/web/controller/mall/MaDecorationApi.java`

#### GET /page — 改为查库

```java
// 替换原有硬编码逻辑 (L43-69)
@Anonymous
@GetMapping("/page")
public R<Map<String, Object>> getPageConfig(
        @RequestParam(required = false) Long merchantId,
        @RequestParam(defaultValue = "home") String pageType) {
    try {
        Map<String, Object> config = new HashMap<>();

        // 1. 查询商户专属配置
        MerchantPageConfig pageConfig = null;
        if (merchantId != null) {
            pageConfig = merchantPageConfigMapper.selectOne(
                new LambdaQueryWrapper<MerchantPageConfig>()
                    .eq(MerchantPageConfig::getMerchantId, merchantId)
                    .eq(MerchantPageConfig::getPageType, pageType)
                    .eq(MerchantPageConfig::getStatus, 1)
                    .orderByDesc(MerchantPageConfig::getVersion)
                    .last("LIMIT 1")
            );
        }

        // 2. 降级查全局默认配置 (merchant_id IS NULL)
        if (pageConfig == null) {
            pageConfig = merchantPageConfigMapper.selectOne(
                new LambdaQueryWrapper<MerchantPageConfig>()
                    .isNull(MerchantPageConfig::getMerchantId)
                    .eq(MerchantPageConfig::getPageType, pageType)
                    .eq(MerchantPageConfig::getStatus, 1)
                    .last("LIMIT 1")
            );
        }

        // 3. 兜底硬编码默认值
        if (pageConfig == null) {
            // 保留原来的默认绿色主题作为最终兜底
            Map<String, Object> theme = new HashMap<>();
            theme.put("primaryColor", "#52c41a");
            theme.put("secondaryColor", "#1a1a1a");
            theme.put("backgroundColor", "#f5f5f5");
            theme.put("textColor", "#333333");
            theme.put("accentColor", "#52c41a");
            config.put("theme", theme);
            config.put("modules", new Object[]{});
            return R.ok(config);
        }

        // 4. 从 pageConfig 构建返回数据
        // 主题
        Map<String, Object> theme = new HashMap<>();
        if (pageConfig.getCustomTheme() != null) {
            theme = objectMapper.readValue(pageConfig.getCustomTheme(), Map.class);
        }
        config.put("theme", theme);

        // 店铺信息
        config.put("shopName", pageConfig.getShopName());
        config.put("logoUrl", pageConfig.getLogoUrl());
        config.put("slogan", pageConfig.getSlogan());

        // 通知栏
        if (pageConfig.getNoticeTexts() != null) {
            config.put("noticeTexts", objectMapper.readTree(pageConfig.getNoticeTexts()));
        }

        // 模块配置
        config.put("modules", pageConfig.getModulesConfig() != null
            ? objectMapper.readTree(pageConfig.getModulesConfig()) : new Object[]{});

        return R.ok(config);
    } catch (Exception e) {
        log.error("获取页面配置失败", e);
        return R.fail("获取页面配置失败");
    }
}
```

#### POST /page-config — 实际保存

```java
// 替换原有TODO空壳 (L168-185)
@Anonymous
@PostMapping("/page-config")
public R<Boolean> savePageConfig(@RequestBody Map<String, Object> params) {
    try {
        Long merchantId = params.get("merchantId") != null ?
                Long.parseLong(params.get("merchantId").toString()) : null;
        String pageType = (String) params.getOrDefault("pageType", "home");

        // 查询是否已有配置
        LambdaQueryWrapper<MerchantPageConfig> wrapper = new LambdaQueryWrapper<MerchantPageConfig>()
                .eq(MerchantPageConfig::getPageType, pageType);
        if (merchantId != null) {
            wrapper.eq(MerchantPageConfig::getMerchantId, merchantId);
        } else {
            wrapper.isNull(MerchantPageConfig::getMerchantId);
        }
        MerchantPageConfig existing = merchantPageConfigMapper.selectOne(wrapper.last("LIMIT 1"));

        if (existing == null) {
            existing = new MerchantPageConfig();
            existing.setMerchantId(merchantId);
            existing.setPageType(pageType);
            existing.setStatus(1);
            existing.setVersion(1);
        }

        // 更新字段
        if (params.containsKey("themeCode")) {
            existing.setThemeCode((String) params.get("themeCode"));
        }
        if (params.containsKey("themeConfig")) {
            existing.setCustomTheme(params.get("themeConfig") instanceof String
                ? (String) params.get("themeConfig")
                : objectMapper.writeValueAsString(params.get("themeConfig")));
        }
        if (params.containsKey("shopName")) {
            existing.setShopName((String) params.get("shopName"));
        }
        if (params.containsKey("logoUrl")) {
            existing.setLogoUrl((String) params.get("logoUrl"));
        }
        if (params.containsKey("slogan")) {
            existing.setSlogan((String) params.get("slogan"));
        }
        if (params.containsKey("noticeTexts")) {
            existing.setNoticeTexts(params.get("noticeTexts") instanceof String
                ? (String) params.get("noticeTexts")
                : objectMapper.writeValueAsString(params.get("noticeTexts")));
        }

        existing.setUpdateTime(LocalDateTime.now());

        if (existing.getId() == null) {
            merchantPageConfigMapper.insert(existing);
        } else {
            merchantPageConfigMapper.updateById(existing);
        }

        log.info("保存页面配置成功: merchantId={}, pageType={}, themeCode={}",
                merchantId, pageType, existing.getThemeCode());
        return R.ok(true);
    } catch (Exception e) {
        log.error("保存页面配置失败", e);
        return R.fail("保存配置失败");
    }
}
```

#### GET /css-variables — 动态生成

```java
// 替换原有硬编码 (L78-103)
@Anonymous
@GetMapping("/css-variables")
public R<Map<String, String>> getCssVariables(@RequestParam(required = false) Long merchantId) {
    try {
        // 复用 getPageConfig 逻辑获取主题
        R<Map<String, Object>> pageResult = getPageConfig(merchantId, "home");
        Map<String, Object> theme = (Map<String, Object>) pageResult.getData().get("theme");

        Map<String, String> cssVars = new HashMap<>();
        cssVars.put("--primary-color", (String) theme.getOrDefault("primaryColor", "#52c41a"));
        cssVars.put("--primary-light", (String) theme.getOrDefault("primaryLight", "#d7f0db"));
        cssVars.put("--primary-dark", (String) theme.getOrDefault("primaryDark", "#389e0d"));
        cssVars.put("--dark-bg", (String) theme.getOrDefault("headerBackground", "#1a1a1a"));
        cssVars.put("--notice-bg", (String) theme.getOrDefault("noticeBackground", "#d7f0db"));
        cssVars.put("--notice-text", (String) theme.getOrDefault("noticeTextColor", "#389e0d"));
        cssVars.put("--text-primary", (String) theme.getOrDefault("textColor", "#333"));
        cssVars.put("--accent-color", (String) theme.getOrDefault("primaryColor", "#52c41a"));

        return R.ok(cssVars);
    } catch (Exception e) {
        log.error("获取CSS变量失败", e);
        return R.fail("获取CSS变量失败");
    }
}
```

### 2.4 修改 HomeInitApi.java — theme 段改为查库

**路径**: `logistics-admin/src/main/java/com/joolun/web/api/HomeInitApi.java`

**改动**: 第 116-127 行的硬编码 theme 段，改为调用 MerchantPageConfigMapper 查询。

```java
// 原来:
Map<String, Object> theme = new HashMap<>();
theme.put("primaryColor", "#52c41a");
// ...硬编码...
result.put("theme", theme);

// 改为:
// 注入 MerchantPageConfigMapper (在类顶部)
@Autowired
private MerchantPageConfigMapper merchantPageConfigMapper;
private static final ObjectMapper objectMapper = new ObjectMapper();

// 在 homeInit() 方法的 theme 段:
MerchantPageConfig pageConfig = merchantPageConfigMapper.selectOne(
    new LambdaQueryWrapper<MerchantPageConfig>()
        .isNull(MerchantPageConfig::getMerchantId)
        .eq(MerchantPageConfig::getPageType, "home")
        .eq(MerchantPageConfig::getStatus, 1)
        .last("LIMIT 1")
);
Map<String, Object> theme = new HashMap<>();
if (pageConfig != null && pageConfig.getCustomTheme() != null) {
    try {
        theme = objectMapper.readValue(pageConfig.getCustomTheme(), Map.class);
    } catch (Exception e) {
        log.warn("解析主题配置失败，使用默认值", e);
    }
}
if (theme.isEmpty()) {
    theme.put("primaryColor", "#52c41a");
    theme.put("secondaryColor", "#1a1a1a");
    theme.put("backgroundColor", "#f5f5f5");
    theme.put("textColor", "#333333");
    theme.put("accentColor", "#52c41a");
}
result.put("theme", theme);

// 同时返回店铺信息
if (pageConfig != null) {
    result.put("shopName", pageConfig.getShopName());
    result.put("logoUrl", pageConfig.getLogoUrl());
    result.put("slogan", pageConfig.getSlogan());
    if (pageConfig.getNoticeTexts() != null) {
        try {
            result.put("noticeTexts", objectMapper.readTree(pageConfig.getNoticeTexts()));
        } catch (Exception e) { /* ignore */ }
    }
}
```

---

## 三、前端代码修改清单

### 3.1 pages/home/index.wxml — 硬编码改为动态绑定

**Logo (第 13 行)**:
```xml
<!-- 原来 -->
<image class="logo-img" src="/public/img/logo-duxianlai.png" mode="aspectFit"></image>
<!-- 改为 -->
<image class="logo-img" src="{{logoUrl || '/public/img/logo-duxianlai.png'}}" mode="aspectFit"></image>
```

**通知栏 (第 25-35 行)**:
```xml
<!-- 原来: 3条硬编码 swiper-item -->
<!-- 改为 -->
<swiper class="notice-swiper" autoplay="true" circular="true" vertical="true" interval="4000">
  <swiper-item wx:for="{{noticeList}}" wx:key="index">
    <text class="notice-text">{{item.text}}</text>
  </swiper-item>
</swiper>
```

**区块标题 (第 99、134 行等)**:
```xml
<!-- 原来 -->
<text>热销单品</text>
<!-- 改为 -->
<text>{{sectionTitles.hot || '热销单品'}}</text>
```

### 3.2 pages/home/index.js — 读取并应用动态配置

**data 新增字段**:
```javascript
data: {
  // ...existing...
  logoUrl: '',
  shopName: '',
  slogan: '',
  noticeList: [
    { text: '欢迎使用白垩纪食品溯源商城' },
    { text: '扫码即可查看商品溯源信息' },
    { text: '联系电话：13916928096' }
  ],
  sectionTitles: { hot: '热销单品', recommend: '猜你喜欢' }
}
```

**loadPageConfig() 方法中增加店铺信息读取**:
```javascript
// 在 loadPageConfig() 成功回调中, config 已包含新字段
if (config.shopName) {
  this.setData({ shopName: config.shopName })
}
if (config.logoUrl) {
  this.setData({ logoUrl: config.logoUrl })
}
if (config.slogan) {
  this.setData({ slogan: config.slogan })
}
if (config.noticeTexts && config.noticeTexts.length > 0) {
  this.setData({ noticeList: config.noticeTexts })
}
```

**generateCssVariables() 修复与补全**:
```javascript
generateCssVariables(theme) {
  if (!theme) return ''
  const vars = []

  // 主色调 (修复: 去掉重复的 push)
  if (theme.primaryColor) {
    vars.push(`--primary-color: ${theme.primaryColor}`)
    vars.push(`--accent-color: ${theme.primaryColor}`)
    vars.push(`--border-accent: ${theme.primaryColor}`)
  }
  // 深色背景
  if (theme.secondaryColor) {
    vars.push(`--secondary-color: ${theme.secondaryColor}`)
  }
  if (theme.headerBackground) {
    vars.push(`--dark-bg: ${theme.headerBackground}`)
  } else if (theme.secondaryColor) {
    vars.push(`--dark-bg: ${theme.secondaryColor}`)
  }
  // 页面背景
  if (theme.backgroundColor) {
    vars.push(`--background: ${theme.backgroundColor}`)
    vars.push(`--page-bg: ${theme.backgroundColor}`)
  }
  // 通知栏 (新增映射)
  if (theme.noticeBackground) {
    vars.push(`--notice-bg: ${theme.noticeBackground}`)
  }
  if (theme.noticeTextColor) {
    vars.push(`--notice-text: ${theme.noticeTextColor}`)
  }
  // 主色衍生 (新增映射)
  if (theme.primaryLight) {
    vars.push(`--primary-light: ${theme.primaryLight}`)
  }
  if (theme.primaryDark) {
    vars.push(`--primary-dark: ${theme.primaryDark}`)
  }
  // 文字
  if (theme.textColor) {
    vars.push(`--text-color: ${theme.textColor}`)
    vars.push(`--text-primary: ${theme.textColor}`)
  }
  if (theme.textSecondaryColor) {
    vars.push(`--text-secondary: ${theme.textSecondaryColor}`)
  }
  // 卡片/边框/圆角
  if (theme.cardBackground) vars.push(`--card-bg: ${theme.cardBackground}`)
  if (theme.borderColor) vars.push(`--border-color: ${theme.borderColor}`)
  if (theme.borderRadius) vars.push(`--border-radius: ${theme.borderRadius}`)

  return vars.join('; ')
}
```

**分享文案 (第 172 行)**:
```javascript
// 原来:
let title = '白垩纪食品溯源商城 - 源头可追溯'
// 改为:
let title = (this.data.shopName || '食品溯源商城') + ' - 源头可追溯'
```

### 3.3 pages/merchant-center/shop-design/index.js — 增加店铺信息编辑

**data 新增**:
```javascript
data: {
  // ...existing...
  shopName: '',
  logoUrl: '',
  shopSlogan: '',
  noticeTexts: [],
  showShopInfoEditor: false
}
```

**新方法: 加载当前店铺信息**:
```javascript
async loadCurrentConfig() {
  try {
    const merchantId = app.globalData.merchantId
    const res = await api.getDecorationConfig('home', merchantId)
    if (res.data) {
      this.setData({
        currentTheme: res.data.theme || null,
        selectedThemeId: res.data.themeId,
        shopName: res.data.shopName || '',
        logoUrl: res.data.logoUrl || '',
        shopSlogan: res.data.slogan || '',
        noticeTexts: res.data.noticeTexts || []
      })
    }
  } catch (err) {
    console.error('加载当前配置失败:', err)
  }
}
```

**新方法: 保存时包含店铺信息**:
```javascript
async saveThemeConfig(merchantId, theme) {
  return new Promise((resolve, reject) => {
    const config = app.globalData.config
    wx.request({
      url: config.basePath + '/weixin/api/ma/decoration/page-config',
      method: 'POST',
      data: {
        merchantId: merchantId,
        pageType: 'home',
        themeCode: theme.code,
        themeConfig: JSON.stringify({
          primaryColor: theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          backgroundColor: theme.backgroundColor || '#f5f5f5',
          noticeBackground: theme.noticeBackground || '',
          noticeTextColor: theme.noticeTextColor || '',
          primaryLight: theme.primaryLight || '',
          primaryDark: theme.primaryDark || '',
          headerBackground: theme.headerBackground || ''
        }),
        // 新增: 店铺信息
        shopName: this.data.shopName,
        logoUrl: this.data.logoUrl,
        slogan: this.data.shopSlogan,
        noticeTexts: JSON.stringify(this.data.noticeTexts)
      },
      header: { 'content-type': 'application/json', 'third-session': app.globalData.thirdSession || '' },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 200) resolve(res.data)
        else reject(new Error(res.data.msg || '保存失败'))
      },
      fail: reject
    })
  })
}
```

### 3.4 pages/merchant-center/shop-design/index.wxml — 增加店铺信息编辑区

在 `<!-- AI智能装修入口 -->` 之前插入：

```xml
<!-- 店铺基础信息 -->
<view class="shop-info-section">
  <view class="section-header">
    <text class="section-title">店铺信息</text>
    <text class="edit-btn" bindtap="toggleShopInfoEditor">{{showShopInfoEditor ? '收起' : '编辑'}}</text>
  </view>
  <view class="shop-info-preview" wx:if="{{!showShopInfoEditor}}">
    <image class="shop-logo-preview" src="{{logoUrl || '/public/img/logo-duxianlai.png'}}" mode="aspectFit"></image>
    <view class="shop-text-info">
      <text class="shop-name-text">{{shopName || '未设置店铺名'}}</text>
      <text class="shop-slogan-text">{{shopSlogan || '未设置标语'}}</text>
    </view>
  </view>
  <view class="shop-info-form" wx:if="{{showShopInfoEditor}}">
    <view class="form-item">
      <text class="form-label">店铺名称</text>
      <input class="form-input" placeholder="输入店铺名称" value="{{shopName}}" bindinput="onShopNameInput" maxlength="30"/>
    </view>
    <view class="form-item">
      <text class="form-label">店铺标语</text>
      <input class="form-input" placeholder="输入标语/口号" value="{{shopSlogan}}" bindinput="onSloganInput" maxlength="50"/>
    </view>
    <view class="form-item">
      <text class="form-label">Logo</text>
      <view class="logo-upload" bindtap="chooseLogoImage">
        <image wx:if="{{logoUrl}}" src="{{logoUrl}}" mode="aspectFit" class="logo-thumb"></image>
        <text wx:else class="cuIcon-cameraadd upload-icon"></text>
      </view>
    </view>
    <view class="form-item">
      <text class="form-label">通知栏</text>
      <view class="notice-edit-list">
        <view class="notice-edit-item" wx:for="{{noticeTexts}}" wx:key="index">
          <input class="notice-input" value="{{item.text}}" data-index="{{index}}" bindinput="onNoticeInput"/>
          <text class="cuIcon-close delete-notice" data-index="{{index}}" bindtap="deleteNotice"></text>
        </view>
        <button class="add-notice-btn" bindtap="addNotice" wx:if="{{noticeTexts.length < 5}}">
          <text class="cuIcon-add"></text> 添加通知
        </button>
      </view>
    </view>
  </view>
</view>
```

---

## 四、实施顺序与依赖关系

```
Phase 1: 数据库 (无依赖)
  ├─ 1a. 执行 V3.6 建表 merchant_page_config + 默认数据
  ├─ 1b. 执行 V3.7 种子数据 decoration_theme_preset (15条)
  └─ 1c. 执行建表 ai_decoration_session

Phase 2: 后端 (依赖 Phase 1)
  ├─ 2a. 新建 MerchantPageConfigMapper.java
  ├─ 2b. 修改 MerchantPageConfig.java Entity (加字段)
  ├─ 2c. 修改 MaDecorationApi.java (GET /page, POST /page-config, GET /css-variables)
  └─ 2d. 修改 HomeInitApi.java (theme段查库)

Phase 3: 前端 (依赖 Phase 2)
  ├─ 3a. home/index.wxml (Logo/通知栏/标题动态化)
  ├─ 3b. home/index.js (generateCssVariables补全, 读取店铺信息)
  ├─ 3c. shop-design/index.js (增加店铺信息编辑方法)
  ├─ 3d. shop-design/index.wxml (增加店铺信息编辑UI)
  └─ 3e. shop-design/index.wxss (编辑表单样式)

Phase 4: 部署与验证
  ├─ 4a. Maven 打包上传 JAR
  ├─ 4b. 执行 SQL 迁移
  ├─ 4c. 重启 mall-backend
  ├─ 4d. DevTools 清缓存 + 编译
  └─ 4e. E2E 验证
```

---

## 五、风险点与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **merchant_page_config 表首次保存 vs 更新** | INSERT/UPDATE 逻辑需正确判断 | 用 `selectOne` 查询后决定 insert 或 updateById |
| **Logo 上传依赖 OSS** | Mall 后端 OSS 上传接口是否可用待确认 | 先支持输入 URL，后续接入 wx.uploadFile + OSS |
| **主题 ID 范围过滤** | WXML 用 `item.id <= 3` 过滤分类，后端自增ID可能不是1-15 | 种子数据不指定 id（用 SERIAL），前端改为按 `industryTags` 字段过滤 |
| **generateCssVariables 新字段** | 后端主题 JSON 新增 `noticeBackground` 等字段，旧配置无此字段 | JS 中全部用 `theme.xxx \|\| ''` 兜底 |
| **HomeInitApi vs MaDecorationApi 双入口** | 首页可能走 HomeInitApi，也可能走 MaDecorationApi 降级 | 两个入口都改为查库，保持数据一致 |
| **finishGuideFlow 参数不匹配** | 前端发 industry/style/themeCode，后端期望 finalConfig | 后端 guide/finish 端点也需适配，或前端包装成 finalConfig 格式 |
| **分享文案 globalData** | 启动时 shopName 可能还没加载 | 在 onShareAppMessage 中实时读取 `this.data.shopName` |
| **Maven 编译** | 新文件可能导致编译错误 | 新建 Mapper 确保在正确包路径下 |

---

## 六、工作量估算

| 阶段 | 改动文件数 | 预估 |
|------|-----------|------|
| Phase 1: SQL | 3 个 SQL 文件 | 小 |
| Phase 2: 后端 | 4 个 Java 文件 (1新建 + 3修改) | 中 |
| Phase 3: 前端 | 5 个文件 (2个 js + 2个 wxml + 1个 wxss) | 中 |
| Phase 4: 部署验证 | — | 小 |
| **总计** | **12 个文件** | **中等** |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total findings: 45+
- Key issues identified: 14 (P0: 3, P1: 3, P2: 4, P3: 4)
- Phases completed: Research (×3 parallel) → Analysis → Critique → Integration → Heal
- Healer: All structural checks passed ✓
