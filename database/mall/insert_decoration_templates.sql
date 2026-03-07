-- 装修模板数据初始化
-- 4个预置模板，每个包含 modulesConfig JSON 和关联的主题配置
-- 运行环境: PostgreSQL (mall_center 库)

-- 注意: 模板数据目前在 Java 代码中以 TEMPLATE_DEFINITIONS 静态定义。
-- 此 SQL 仅用于需要将模板持久化到数据库时使用。
-- 如果 decoration_template 表存在，可以执行以下插入。

-- 检查表是否存在，如果存在则插入模板数据
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'decoration_template') THEN

    -- 食品溯源标准版
    INSERT INTO decoration_template (code, name, description, industry_tags, theme_code, modules_config, status, create_time, update_time)
    VALUES (
      'food_standard',
      '食品溯源标准版',
      '全功能首页，适合食品/溯源行业。包含导航、通知、轮播、分类、快捷入口、热销、推荐、AI助手全部模块。',
      '食品,溯源,生鲜',
      'fresh_green',
      '[{"id":"t1_1","type":"header","visible":true,"order":0,"props":{"showSearch":true,"showLogo":true}},{"id":"t1_2","type":"notice_bar","visible":true,"order":1,"props":{"texts":["欢迎使用食品溯源商城","扫码查看商品溯源信息"],"interval":4000}},{"id":"t1_3","type":"banner","visible":true,"order":2,"props":{"autoplay":true,"interval":5000}},{"id":"t1_4","type":"category_grid","visible":true,"order":3,"props":{"columns":4}},{"id":"t1_5","type":"quick_actions","visible":true,"order":4,"props":{}},{"id":"t1_6","type":"product_scroll","visible":true,"order":5,"props":{"title":"热销单品"}},{"id":"t1_7","type":"product_grid","visible":true,"order":6,"props":{"title":"猜你喜欢","columns":2}},{"id":"t1_8","type":"ai_float","visible":true,"order":99,"props":{}}]',
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      modules_config = EXCLUDED.modules_config,
      update_time = NOW();

    -- 生鲜直供版
    INSERT INTO decoration_template (code, name, description, industry_tags, theme_code, modules_config, status, create_time, update_time)
    VALUES (
      'fresh_direct',
      '生鲜直供版',
      '大图商品展示为主，适合生鲜/农场行业。突出产品视觉冲击力。',
      '生鲜,农场,有机',
      'garden_green',
      '[{"id":"t2_1","type":"header","visible":true,"order":0,"props":{"showSearch":true,"showLogo":true}},{"id":"t2_2","type":"banner","visible":true,"order":1,"props":{"autoplay":true,"interval":4000}},{"id":"t2_3","type":"category_grid","visible":true,"order":2,"props":{"columns":4}},{"id":"t2_4","type":"product_grid","visible":true,"order":3,"props":{"title":"产地直供","columns":2}},{"id":"t2_5","type":"ai_float","visible":true,"order":99,"props":{}}]',
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      modules_config = EXCLUDED.modules_config,
      update_time = NOW();

    -- 餐饮商家版
    INSERT INTO decoration_template (code, name, description, industry_tags, theme_code, modules_config, status, create_time, update_time)
    VALUES (
      'restaurant',
      '餐饮商家版',
      '门店展示+菜品推荐布局，适合餐饮/火锅行业。包含门店信息图文模块。',
      '餐饮,火锅,饭店',
      'festival_red',
      '[{"id":"t3_1","type":"header","visible":true,"order":0,"props":{"showSearch":true,"showLogo":true}},{"id":"t3_2","type":"banner","visible":true,"order":1,"props":{"autoplay":true,"interval":5000}},{"id":"t3_3","type":"notice_bar","visible":true,"order":2,"props":{"texts":["欢迎光临！预订请拨打电话"],"interval":4000}},{"id":"t3_4","type":"product_scroll","visible":true,"order":3,"props":{"title":"招牌菜品"}},{"id":"t3_5","type":"product_grid","visible":true,"order":4,"props":{"title":"全部菜品","columns":3}},{"id":"t3_6","type":"text_image","visible":true,"order":5,"props":{"title":"门店信息","content":"欢迎到店品尝，地址请咨询客服"}}]',
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      modules_config = EXCLUDED.modules_config,
      update_time = NOW();

    -- 简约精选版
    INSERT INTO decoration_template (code, name, description, industry_tags, theme_code, modules_config, status, create_time, update_time)
    VALUES (
      'minimal',
      '简约精选版',
      '极简设计，突出商品本身，适合追求简洁风格的通用店铺。',
      '通用,极简,精品',
      'minimal_white',
      '[{"id":"t4_1","type":"header","visible":true,"order":0,"props":{"showSearch":true,"showLogo":true}},{"id":"t4_2","type":"banner","visible":true,"order":1,"props":{"autoplay":true,"interval":6000}},{"id":"t4_3","type":"product_grid","visible":true,"order":2,"props":{"title":"精选商品","columns":2}},{"id":"t4_4","type":"ai_float","visible":true,"order":99,"props":{}}]',
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      modules_config = EXCLUDED.modules_config,
      update_time = NOW();

    RAISE NOTICE 'Inserted/updated 4 decoration templates';
  ELSE
    RAISE NOTICE 'Table decoration_template does not exist, skipping. Templates are defined in Java code.';
  END IF;
END $$;
