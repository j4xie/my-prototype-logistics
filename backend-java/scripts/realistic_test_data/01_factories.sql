-- =====================================================
-- 工厂数据 (5条) - 真实水产加工企业
-- 使用 INSERT IGNORE 追加模式
-- =====================================================

INSERT IGNORE INTO factories (
    id, name, address, industry, industry_code, region_code,
    contact_name, contact_phone, contact_email,
    employee_count, subscription_plan, is_active,
    ai_weekly_quota, manually_verified, confidence,
    created_at, updated_at
) VALUES
-- F001: 舟山明珠水产加工厂 (浙江舟山)
('F001', '舟山明珠水产加工厂', '浙江省舟山市定海区临城街道海天大道188号',
 '海水鱼加工', 'A0312', 'ZJ-ZS',
 '郑海明', '13857201001', 'zhenghaiming@zsmingzhu.com',
 156, 'enterprise', 1, 100, 1, 0.95,
 '2024-01-15 08:00:00', NOW()),

-- F002: 青岛国鲜水产有限公司 (山东青岛)
('F002', '青岛国鲜水产有限公司', '山东省青岛市城阳区流亭街道仙山东路66号',
 '冷冻水产加工', 'A0313', 'SD-QD',
 '王国强', '13853201002', 'wangguoqiang@qdguoxian.com',
 128, 'enterprise', 1, 100, 1, 0.92,
 '2024-02-20 09:00:00', NOW()),

-- F003: 厦门鹭海食品有限公司 (福建厦门)
('F003', '厦门鹭海食品有限公司', '福建省厦门市翔安区马巷镇工业集中区',
 '贝类加工', 'A0314', 'FJ-XM',
 '林志强', '13959201003', 'linzhiqiang@xmluhai.com',
 98, 'professional', 1, 80, 1, 0.90,
 '2024-03-10 10:00:00', NOW()),

-- F004: 湛江南海渔业公司 (广东湛江)
('F004', '湛江南海渔业公司', '广东省湛江市霞山区工业大道中段128号',
 '对虾加工', 'A0315', 'GD-ZJ',
 '陈伟业', '13668201004', 'chenweiye@zjnanhai.com',
 142, 'enterprise', 1, 100, 1, 0.93,
 '2024-04-05 08:30:00', NOW()),

-- F005: 大连獐子岛加工中心 (辽宁大连)
('F005', '大连獐子岛加工中心', '辽宁省大连市长海县獐子岛镇沙包村',
 '海珍品加工', 'A0316', 'LN-DL',
 '张海洋', '13841201005', 'zhanghaiyang@zhangzidao.com',
 186, 'enterprise', 1, 120, 1, 0.96,
 '2024-05-12 09:30:00', NOW());

-- 验证
SELECT '工厂数据导入完成' AS message;
SELECT id, name, address, employee_count FROM factories WHERE id IN ('F001','F002','F003','F004','F005');
