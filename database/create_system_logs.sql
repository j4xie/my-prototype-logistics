-- System Logs table + test data
-- Run on: cretas_prod_db (production) and cretas_db (test)

CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    username VARCHAR(100),
    module VARCHAR(100),
    action VARCHAR(200),
    log_type VARCHAR(20) NOT NULL DEFAULT 'INFO',
    log_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    request_method VARCHAR(10),
    request_url VARCHAR(500),
    request_params TEXT,
    response_status INTEGER,
    response_data TEXT,
    error_message TEXT,
    stack_trace TEXT,
    execution_time BIGINT,
    message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_syslog_factory_created ON system_logs(factory_id, created_at);
CREATE INDEX IF NOT EXISTS idx_syslog_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_syslog_log_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_syslog_username ON system_logs(username);

-- Insert test data (30 rows covering various types)
INSERT INTO system_logs (factory_id, username, module, action, log_type, log_level, ip_address, response_status, execution_time, message, created_at) VALUES
('F001', 'factory_admin1', '用户管理', '用户登录', 'AUDIT', 'INFO', '192.168.1.100', 200, 45, '用户 factory_admin1 登录成功', NOW() - INTERVAL '1 hour'),
('F001', 'factory_admin1', '生产管理', '查看批次列表', 'INFO', 'INFO', '192.168.1.100', 200, 120, '查询生产批次 共28条', NOW() - INTERVAL '2 hours'),
('F001', 'warehouse_mgr1', '仓储管理', '入库操作', 'AUDIT', 'INFO', '192.168.1.101', 200, 230, '原料入库: 带鱼原料 500kg 批次 B20260228-001', NOW() - INTERVAL '3 hours'),
('F001', 'quality_insp1', '质量管理', '质检提交', 'AUDIT', 'INFO', '192.168.1.102', 200, 180, '质检报告提交: 批次 B20260228-001 合格', NOW() - INTERVAL '4 hours'),
('F001', 'hr_admin1', '人事管理', '考勤导入', 'INFO', 'INFO', '192.168.1.103', 200, 890, '批量导入考勤数据 42条记录', NOW() - INTERVAL '5 hours'),
('F001', 'factory_admin1', '系统管理', '修改系统设置', 'AUDIT', 'WARN', '192.168.1.100', 200, 65, '修改邮件通知设置: 启用告警邮件', NOW() - INTERVAL '6 hours'),
('F001', 'dispatcher1', '智能调度', '生成调度方案', 'INFO', 'INFO', '192.168.1.104', 200, 3200, '生成本周生产调度方案 覆盖3条产线', NOW() - INTERVAL '7 hours'),
('F001', 'factory_admin1', '数据分析', 'AI成本分析', 'INFO', 'INFO', '192.168.1.100', 200, 8500, 'AI分析完成: 本月成本同比下降3.2%', NOW() - INTERVAL '8 hours'),
('F001', 'workshop_sup1', '生产管理', '开始生产', 'AUDIT', 'INFO', '192.168.1.105', 200, 150, '启动生产批次 B20260228-002 产品:带鱼段', NOW() - INTERVAL '9 hours'),
('F001', 'system', '定时任务', '数据备份', 'INFO', 'INFO', '127.0.0.1', 200, 12000, '每日数据库备份完成 大小: 256MB', NOW() - INTERVAL '10 hours'),
('F001', 'factory_admin1', '财务管理', '导出报表', 'INFO', 'INFO', '192.168.1.100', 200, 2100, '导出本月财务报表 Excel', NOW() - INTERVAL '11 hours'),
('F001', 'warehouse_mgr1', '仓储管理', '库存盘点', 'AUDIT', 'INFO', '192.168.1.101', 200, 560, '完成月度库存盘点 差异率0.2%', NOW() - INTERVAL '12 hours'),
('F001', 'factory_admin1', '用户管理', '创建用户', 'AUDIT', 'INFO', '192.168.1.100', 200, 95, '创建用户 new_worker1 角色:操作员', NOW() - INTERVAL '1 day'),
('F001', 'factory_admin1', '设备管理', '查看设备告警', 'INFO', 'WARN', '192.168.1.100', 200, 80, '设备告警: 切段机 #3 温度超标 78°C', NOW() - INTERVAL '1 day 2 hours'),
('F001', 'system', '系统监控', '健康检查', 'INFO', 'ERROR', '127.0.0.1', 500, 30000, 'Redis 连接超时 尝试重连...', NOW() - INTERVAL '1 day 3 hours'),
('F001', 'factory_admin1', '采购管理', '创建采购单', 'AUDIT', 'INFO', '192.168.1.100', 200, 210, '创建采购订单 PO-20260227-001 供应商:大连海产', NOW() - INTERVAL '1 day 4 hours'),
('F001', 'sales_mgr1', '销售管理', '确认订单', 'AUDIT', 'INFO', '192.168.1.106', 200, 175, '确认销售订单 SO-20260227-003 客户:永辉超市', NOW() - INTERVAL '1 day 5 hours'),
('F001', 'finance_mgr1', '财务管理', '成本核算', 'INFO', 'INFO', '192.168.1.107', 200, 4500, '完成带鱼段 BOM成本核算 55.90元/kg', NOW() - INTERVAL '1 day 6 hours'),
('F001', 'workshop_sup1', '生产管理', '完成批次', 'AUDIT', 'INFO', '192.168.1.105', 200, 190, '生产批次 B20260227-001 完成 产出:480kg', NOW() - INTERVAL '1 day 7 hours'),
('F001', 'system', '定时任务', '邮件发送', 'WARNING', 'WARN', '127.0.0.1', 200, 5000, '日报邮件发送部分失败: 3/5 成功', NOW() - INTERVAL '1 day 8 hours'),
('F001', 'factory_admin1', '智能BI', '上传分析', 'INFO', 'INFO', '192.168.1.100', 200, 15000, 'SmartBI 文件上传并分析完成: 销售明细.xlsx 3个sheet', NOW() - INTERVAL '2 days'),
('F001', 'hr_admin1', '人事管理', '薪资计算', 'AUDIT', 'INFO', '192.168.1.103', 200, 3800, '完成2月薪资计算 42名员工', NOW() - INTERVAL '2 days 1 hour'),
('F001', 'system', '系统监控', '磁盘告警', 'ERROR', 'ERROR', '127.0.0.1', NULL, NULL, '磁盘空间不足: /data 分区使用率 92%', NOW() - INTERVAL '2 days 2 hours'),
('F001', 'factory_admin1', '数据分析', '趋势分析', 'INFO', 'INFO', '192.168.1.100', 200, 2800, '生成近30天产量趋势图', NOW() - INTERVAL '2 days 3 hours'),
('F001', 'quality_insp1', '质量管理', '不合格处理', 'AUDIT', 'WARN', '192.168.1.102', 200, 160, '批次 B20260226-003 质检不合格 → 隔离处理', NOW() - INTERVAL '2 days 4 hours'),
('F001', 'warehouse_mgr1', '仓储管理', '出库操作', 'AUDIT', 'INFO', '192.168.1.101', 200, 195, '成品出库: 带鱼段 200kg → 销售订单 SO-20260226-001', NOW() - INTERVAL '3 days'),
('F001', 'factory_admin1', '系统管理', '角色权限修改', 'AUDIT', 'WARN', '192.168.1.100', 200, 110, '修改角色权限: 质检员 增加 仓储只读权限', NOW() - INTERVAL '3 days 1 hour'),
('F001', 'system', '系统监控', '服务重启', 'WARNING', 'ERROR', '127.0.0.1', NULL, NULL, 'Java 后端服务异常重启 原因: OutOfMemoryError', NOW() - INTERVAL '3 days 2 hours'),
('F001', 'dispatcher1', '智能调度', '调度优化', 'INFO', 'INFO', '192.168.1.104', 200, 6800, '调度优化完成: 产能利用率提升12%', NOW() - INTERVAL '3 days 3 hours'),
('F001', 'factory_admin1', '用户管理', '用户登录', 'AUDIT', 'INFO', '10.0.0.1', 200, 38, '用户 factory_admin1 移动端登录', NOW() - INTERVAL '4 days');

SELECT 'system_logs created with ' || COUNT(*) || ' rows' FROM system_logs WHERE factory_id = 'F001';
