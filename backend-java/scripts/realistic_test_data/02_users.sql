-- =====================================================
-- 用户数据 (100条) - 每个工厂20人，真实中文姓名
-- 密码统一为 123456，BCrypt 哈希
-- =====================================================

-- BCrypt hash for '123456'
SET @pwd_hash = '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy';

-- =====================================================
-- F001: 舟山明珠水产加工厂 (20人)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role_code, factory_id, is_active, phone, department, position, monthly_salary, created_at, updated_at) VALUES
-- 工厂管理员 (1人)
('zs_admin', @pwd_hash, '郑海明', 'factory_super_admin', 'F001', 1, '13857201001', '管理层', '厂长', 25000.00, NOW(), NOW()),
-- 部门主管 (3人)
('zs_dept1', @pwd_hash, '陈建国', 'department_admin', 'F001', 1, '13857201011', '生产部', '生产经理', 15000.00, NOW(), NOW()),
('zs_dept2', @pwd_hash, '李明辉', 'department_admin', 'F001', 1, '13857201012', '质检部', '质检经理', 14000.00, NOW(), NOW()),
('zs_dept3', @pwd_hash, '王志强', 'department_admin', 'F001', 1, '13857201013', '仓储部', '仓储经理', 13000.00, NOW(), NOW()),
-- 车间主管 (4人)
('zs_ws1', @pwd_hash, '张伟东', 'workshop_supervisor', 'F001', 1, '13857201021', '切割车间', '车间主任', 10000.00, NOW(), NOW()),
('zs_ws2', @pwd_hash, '刘海峰', 'workshop_supervisor', 'F001', 1, '13857201022', '冷冻车间', '车间主任', 10000.00, NOW(), NOW()),
('zs_ws3', @pwd_hash, '周国庆', 'workshop_supervisor', 'F001', 1, '13857201023', '包装车间', '车间主任', 9500.00, NOW(), NOW()),
('zs_ws4', @pwd_hash, '吴建平', 'workshop_supervisor', 'F001', 1, '13857201024', '清洗车间', '车间主任', 9500.00, NOW(), NOW()),
-- 质检员 (2人)
('zs_qi1', @pwd_hash, '赵丽娟', 'quality_inspector', 'F001', 1, '13857201031', '质检部', '质检员', 7000.00, NOW(), NOW()),
('zs_qi2', @pwd_hash, '孙美玲', 'quality_inspector', 'F001', 1, '13857201032', '质检部', '质检员', 6800.00, NOW(), NOW()),
-- 操作员 (10人)
('zs_op01', @pwd_hash, '钱志明', 'operator', 'F001', 1, '13857201041', '切割车间', '切割工', 5500.00, NOW(), NOW()),
('zs_op02', @pwd_hash, '周晓红', 'operator', 'F001', 1, '13857201042', '切割车间', '切割工', 5500.00, NOW(), NOW()),
('zs_op03', @pwd_hash, '吴大伟', 'operator', 'F001', 1, '13857201043', '冷冻车间', '冷冻工', 5800.00, NOW(), NOW()),
('zs_op04', @pwd_hash, '郑小燕', 'operator', 'F001', 1, '13857201044', '冷冻车间', '冷冻工', 5800.00, NOW(), NOW()),
('zs_op05', @pwd_hash, '王建华', 'operator', 'F001', 1, '13857201045', '包装车间', '包装工', 5200.00, NOW(), NOW()),
('zs_op06', @pwd_hash, '李秀英', 'operator', 'F001', 1, '13857201046', '包装车间', '包装工', 5200.00, NOW(), NOW()),
('zs_op07', @pwd_hash, '张国强', 'operator', 'F001', 1, '13857201047', '清洗车间', '清洗工', 5000.00, NOW(), NOW()),
('zs_op08', @pwd_hash, '陈小明', 'operator', 'F001', 1, '13857201048', '清洗车间', '清洗工', 5000.00, NOW(), NOW()),
('zs_op09', @pwd_hash, '刘德华', 'operator', 'F001', 1, '13857201049', '切割车间', '切割工', 5500.00, NOW(), NOW()),
('zs_op10', @pwd_hash, '杨丽华', 'operator', 'F001', 1, '13857201050', '包装车间', '包装工', 5200.00, NOW(), NOW());

-- =====================================================
-- F002: 青岛国鲜水产有限公司 (20人)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role_code, factory_id, is_active, phone, department, position, monthly_salary, created_at, updated_at) VALUES
-- 工厂管理员 (1人)
('qd_admin', @pwd_hash, '刘海涛', 'factory_super_admin', 'F002', 1, '13253201001', '管理层', '厂长', 28000.00, NOW(), NOW()),
-- 部门主管 (3人)
('qd_dept1', @pwd_hash, '孙立新', 'department_admin', 'F002', 1, '13253201011', '生产部', '生产总监', 18000.00, NOW(), NOW()),
('qd_dept2', @pwd_hash, '马晓峰', 'department_admin', 'F002', 1, '13253201012', '质检部', '质检总监', 16000.00, NOW(), NOW()),
('qd_dept3', @pwd_hash, '赵宏伟', 'department_admin', 'F002', 1, '13253201013', '仓储部', '仓储总监', 15000.00, NOW(), NOW()),
-- 车间主管 (4人)
('qd_ws1', @pwd_hash, '王大鹏', 'workshop_supervisor', 'F002', 1, '13253201021', '加工车间', '车间主任', 12000.00, NOW(), NOW()),
('qd_ws2', @pwd_hash, '李晓明', 'workshop_supervisor', 'F002', 1, '13253201022', '冷藏车间', '车间主任', 11500.00, NOW(), NOW()),
('qd_ws3', @pwd_hash, '张海燕', 'workshop_supervisor', 'F002', 1, '13253201023', '包装车间', '车间主任', 11000.00, NOW(), NOW()),
('qd_ws4', @pwd_hash, '刘国华', 'workshop_supervisor', 'F002', 1, '13253201024', '分拣车间', '车间主任', 11000.00, NOW(), NOW()),
-- 质检员 (2人)
('qd_qi1', @pwd_hash, '周美丽', 'quality_inspector', 'F002', 1, '13253201031', '质检部', '高级质检员', 8500.00, NOW(), NOW()),
('qd_qi2', @pwd_hash, '吴建军', 'quality_inspector', 'F002', 1, '13253201032', '质检部', '质检员', 7500.00, NOW(), NOW()),
-- 操作员 (10人)
('qd_op01', @pwd_hash, '陈国庆', 'operator', 'F002', 1, '13253201041', '加工车间', '加工技师', 6500.00, NOW(), NOW()),
('qd_op02', @pwd_hash, '郑小华', 'operator', 'F002', 1, '13253201042', '加工车间', '加工工人', 6000.00, NOW(), NOW()),
('qd_op03', @pwd_hash, '王海燕', 'operator', 'F002', 1, '13253201043', '冷藏车间', '冷藏工', 6200.00, NOW(), NOW()),
('qd_op04', @pwd_hash, '李建平', 'operator', 'F002', 1, '13253201044', '冷藏车间', '冷藏工', 6200.00, NOW(), NOW()),
('qd_op05', @pwd_hash, '张丽萍', 'operator', 'F002', 1, '13253201045', '包装车间', '包装工', 5800.00, NOW(), NOW()),
('qd_op06', @pwd_hash, '刘晓军', 'operator', 'F002', 1, '13253201046', '包装车间', '包装工', 5800.00, NOW(), NOW()),
('qd_op07', @pwd_hash, '周建国', 'operator', 'F002', 1, '13253201047', '分拣车间', '分拣工', 5600.00, NOW(), NOW()),
('qd_op08', @pwd_hash, '吴丽红', 'operator', 'F002', 1, '13253201048', '分拣车间', '分拣工', 5600.00, NOW(), NOW()),
('qd_op09', @pwd_hash, '陈大明', 'operator', 'F002', 1, '13253201049', '加工车间', '加工工人', 6000.00, NOW(), NOW()),
('qd_op10', @pwd_hash, '郑美华', 'operator', 'F002', 1, '13253201050', '包装车间', '包装工', 5800.00, NOW(), NOW());

-- =====================================================
-- F003: 厦门鹭海食品有限公司 (20人)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role_code, factory_id, is_active, phone, department, position, monthly_salary, created_at, updated_at) VALUES
-- 工厂管理员 (1人)
('xm_admin', @pwd_hash, '林志远', 'factory_super_admin', 'F003', 1, '13959201001', '管理层', '厂长', 26000.00, NOW(), NOW()),
-- 部门主管 (3人)
('xm_dept1', @pwd_hash, '黄伟明', 'department_admin', 'F003', 1, '13959201011', '生产部', '生产经理', 16000.00, NOW(), NOW()),
('xm_dept2', @pwd_hash, '陈丽芳', 'department_admin', 'F003', 1, '13959201012', '质检部', '质检经理', 15000.00, NOW(), NOW()),
('xm_dept3', @pwd_hash, '林国强', 'department_admin', 'F003', 1, '13959201013', '仓储部', '仓储经理', 14000.00, NOW(), NOW()),
-- 车间主管 (4人)
('xm_ws1', @pwd_hash, '郑建华', 'workshop_supervisor', 'F003', 1, '13959201021', '贝类加工车间', '车间主任', 11000.00, NOW(), NOW()),
('xm_ws2', @pwd_hash, '吴小燕', 'workshop_supervisor', 'F003', 1, '13959201022', '干制车间', '车间主任', 10500.00, NOW(), NOW()),
('xm_ws3', @pwd_hash, '王志华', 'workshop_supervisor', 'F003', 1, '13959201023', '包装车间', '车间主任', 10000.00, NOW(), NOW()),
('xm_ws4', @pwd_hash, '李海峰', 'workshop_supervisor', 'F003', 1, '13959201024', '清洗车间', '车间主任', 10000.00, NOW(), NOW()),
-- 质检员 (2人)
('xm_qi1', @pwd_hash, '张美玲', 'quality_inspector', 'F003', 1, '13959201031', '质检部', '质检员', 7500.00, NOW(), NOW()),
('xm_qi2', @pwd_hash, '刘晓红', 'quality_inspector', 'F003', 1, '13959201032', '质检部', '质检员', 7200.00, NOW(), NOW()),
-- 操作员 (10人)
('xm_op01', @pwd_hash, '周建明', 'operator', 'F003', 1, '13959201041', '贝类加工车间', '去壳工', 5800.00, NOW(), NOW()),
('xm_op02', @pwd_hash, '吴丽华', 'operator', 'F003', 1, '13959201042', '贝类加工车间', '去壳工', 5800.00, NOW(), NOW()),
('xm_op03', @pwd_hash, '陈志强', 'operator', 'F003', 1, '13959201043', '干制车间', '干制工', 6000.00, NOW(), NOW()),
('xm_op04', @pwd_hash, '郑小燕', 'operator', 'F003', 1, '13959201044', '干制车间', '干制工', 6000.00, NOW(), NOW()),
('xm_op05', @pwd_hash, '王海燕', 'operator', 'F003', 1, '13959201045', '包装车间', '包装工', 5500.00, NOW(), NOW()),
('xm_op06', @pwd_hash, '李国华', 'operator', 'F003', 1, '13959201046', '包装车间', '包装工', 5500.00, NOW(), NOW()),
('xm_op07', @pwd_hash, '张建平', 'operator', 'F003', 1, '13959201047', '清洗车间', '清洗工', 5200.00, NOW(), NOW()),
('xm_op08', @pwd_hash, '刘美红', 'operator', 'F003', 1, '13959201048', '清洗车间', '清洗工', 5200.00, NOW(), NOW()),
('xm_op09', @pwd_hash, '周大明', 'operator', 'F003', 1, '13959201049', '贝类加工车间', '去壳工', 5800.00, NOW(), NOW()),
('xm_op10', @pwd_hash, '吴晓华', 'operator', 'F003', 1, '13959201050', '包装车间', '包装工', 5500.00, NOW(), NOW());

-- =====================================================
-- F004: 湛江南海渔业公司 (20人)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role_code, factory_id, is_active, phone, department, position, monthly_salary, created_at, updated_at) VALUES
-- 工厂管理员 (1人)
('zj_admin', @pwd_hash, '梁志强', 'factory_super_admin', 'F004', 1, '13650201001', '管理层', '厂长', 24000.00, NOW(), NOW()),
-- 部门主管 (3人)
('zj_dept1', @pwd_hash, '何建国', 'department_admin', 'F004', 1, '13650201011', '生产部', '生产经理', 14000.00, NOW(), NOW()),
('zj_dept2', @pwd_hash, '罗丽华', 'department_admin', 'F004', 1, '13650201012', '质检部', '质检经理', 13000.00, NOW(), NOW()),
('zj_dept3', @pwd_hash, '邓海峰', 'department_admin', 'F004', 1, '13650201013', '仓储部', '仓储经理', 12500.00, NOW(), NOW()),
-- 车间主管 (4人)
('zj_ws1', @pwd_hash, '曾国庆', 'workshop_supervisor', 'F004', 1, '13650201021', '虾类加工车间', '车间主任', 10000.00, NOW(), NOW()),
('zj_ws2', @pwd_hash, '谭小明', 'workshop_supervisor', 'F004', 1, '13650201022', '速冻车间', '车间主任', 9500.00, NOW(), NOW()),
('zj_ws3', @pwd_hash, '彭建华', 'workshop_supervisor', 'F004', 1, '13650201023', '包装车间', '车间主任', 9000.00, NOW(), NOW()),
('zj_ws4', @pwd_hash, '廖晓燕', 'workshop_supervisor', 'F004', 1, '13650201024', '清洗车间', '车间主任', 9000.00, NOW(), NOW()),
-- 质检员 (2人)
('zj_qi1', @pwd_hash, '蒋美玲', 'quality_inspector', 'F004', 1, '13650201031', '质检部', '质检员', 6800.00, NOW(), NOW()),
('zj_qi2', @pwd_hash, '韩晓红', 'quality_inspector', 'F004', 1, '13650201032', '质检部', '质检员', 6500.00, NOW(), NOW()),
-- 操作员 (10人)
('zj_op01', @pwd_hash, '唐志明', 'operator', 'F004', 1, '13650201041', '虾类加工车间', '剥壳工', 5200.00, NOW(), NOW()),
('zj_op02', @pwd_hash, '丁丽华', 'operator', 'F004', 1, '13650201042', '虾类加工车间', '剥壳工', 5200.00, NOW(), NOW()),
('zj_op03', @pwd_hash, '冯志强', 'operator', 'F004', 1, '13650201043', '速冻车间', '速冻工', 5500.00, NOW(), NOW()),
('zj_op04', @pwd_hash, '袁小燕', 'operator', 'F004', 1, '13650201044', '速冻车间', '速冻工', 5500.00, NOW(), NOW()),
('zj_op05', @pwd_hash, '蔡海燕', 'operator', 'F004', 1, '13650201045', '包装车间', '包装工', 4800.00, NOW(), NOW()),
('zj_op06', @pwd_hash, '钟国华', 'operator', 'F004', 1, '13650201046', '包装车间', '包装工', 4800.00, NOW(), NOW()),
('zj_op07', @pwd_hash, '潘建平', 'operator', 'F004', 1, '13650201047', '清洗车间', '清洗工', 4600.00, NOW(), NOW()),
('zj_op08', @pwd_hash, '叶美红', 'operator', 'F004', 1, '13650201048', '清洗车间', '清洗工', 4600.00, NOW(), NOW()),
('zj_op09', @pwd_hash, '余大明', 'operator', 'F004', 1, '13650201049', '虾类加工车间', '剥壳工', 5200.00, NOW(), NOW()),
('zj_op10', @pwd_hash, '龙晓华', 'operator', 'F004', 1, '13650201050', '包装车间', '包装工', 4800.00, NOW(), NOW());

-- =====================================================
-- F005: 大连獐子岛加工中心 (20人)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role_code, factory_id, is_active, phone, department, position, monthly_salary, created_at, updated_at) VALUES
-- 工厂管理员 (1人)
('dl_admin', @pwd_hash, '于海涛', 'factory_super_admin', 'F005', 1, '13840201001', '管理层', '厂长', 30000.00, NOW(), NOW()),
-- 部门主管 (3人)
('dl_dept1', @pwd_hash, '姜立新', 'department_admin', 'F005', 1, '13840201011', '生产部', '生产总监', 20000.00, NOW(), NOW()),
('dl_dept2', @pwd_hash, '曲晓峰', 'department_admin', 'F005', 1, '13840201012', '质检部', '质检总监', 18000.00, NOW(), NOW()),
('dl_dept3', @pwd_hash, '迟宏伟', 'department_admin', 'F005', 1, '13840201013', '仓储部', '仓储总监', 17000.00, NOW(), NOW()),
-- 车间主管 (4人)
('dl_ws1', @pwd_hash, '宫大鹏', 'workshop_supervisor', 'F005', 1, '13840201021', '海参加工车间', '车间主任', 14000.00, NOW(), NOW()),
('dl_ws2', @pwd_hash, '战晓明', 'workshop_supervisor', 'F005', 1, '13840201022', '鲍鱼加工车间', '车间主任', 13500.00, NOW(), NOW()),
('dl_ws3', @pwd_hash, '初海燕', 'workshop_supervisor', 'F005', 1, '13840201023', '包装车间', '车间主任', 12000.00, NOW(), NOW()),
('dl_ws4', @pwd_hash, '丛国华', 'workshop_supervisor', 'F005', 1, '13840201024', '干制车间', '车间主任', 12000.00, NOW(), NOW()),
-- 质检员 (2人)
('dl_qi1', @pwd_hash, '邹美丽', 'quality_inspector', 'F005', 1, '13840201031', '质检部', '高级质检员', 10000.00, NOW(), NOW()),
('dl_qi2', @pwd_hash, '原建军', 'quality_inspector', 'F005', 1, '13840201032', '质检部', '质检员', 9000.00, NOW(), NOW()),
-- 操作员 (10人)
('dl_op01', @pwd_hash, '盖国庆', 'operator', 'F005', 1, '13840201041', '海参加工车间', '海参加工师', 8000.00, NOW(), NOW()),
('dl_op02', @pwd_hash, '栾小华', 'operator', 'F005', 1, '13840201042', '海参加工车间', '海参加工工', 7500.00, NOW(), NOW()),
('dl_op03', @pwd_hash, '苑海燕', 'operator', 'F005', 1, '13840201043', '鲍鱼加工车间', '鲍鱼加工工', 7200.00, NOW(), NOW()),
('dl_op04', @pwd_hash, '藏建平', 'operator', 'F005', 1, '13840201044', '鲍鱼加工车间', '鲍鱼加工工', 7200.00, NOW(), NOW()),
('dl_op05', @pwd_hash, '柳丽萍', 'operator', 'F005', 1, '13840201045', '包装车间', '包装工', 6500.00, NOW(), NOW()),
('dl_op06', @pwd_hash, '边晓军', 'operator', 'F005', 1, '13840201046', '包装车间', '包装工', 6500.00, NOW(), NOW()),
('dl_op07', @pwd_hash, '荆建国', 'operator', 'F005', 1, '13840201047', '干制车间', '干制工', 6800.00, NOW(), NOW()),
('dl_op08', @pwd_hash, '仝丽红', 'operator', 'F005', 1, '13840201048', '干制车间', '干制工', 6800.00, NOW(), NOW()),
('dl_op09', @pwd_hash, '鞠大明', 'operator', 'F005', 1, '13840201049', '海参加工车间', '海参加工工', 7500.00, NOW(), NOW()),
('dl_op10', @pwd_hash, '隋美华', 'operator', 'F005', 1, '13840201050', '包装车间', '包装工', 6500.00, NOW(), NOW());

-- 验证
SELECT '用户数据导入完成' AS message;
SELECT factory_id, role_code, COUNT(*) as count
FROM users
WHERE factory_id IN ('F001','F002','F003','F004','F005')
GROUP BY factory_id, role_code
ORDER BY factory_id, role_code;
