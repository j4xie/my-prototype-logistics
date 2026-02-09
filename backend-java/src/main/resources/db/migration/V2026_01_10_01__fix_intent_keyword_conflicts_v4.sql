-- ================================================
-- V4.0 意图关键词冲突修复
-- 基于500测试案例失败分析
-- ================================================

-- ================================================
-- 1. 秤模块修复 - SCALE_DELETE_DEVICE 抢占问题
-- ================================================

-- SCALE_DELETE_DEVICE: 只保留明确的删除关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '删除秤', '删掉秤', '移除秤', '注销秤', '秤不用了',
    '把秤删了', '去掉这个秤', '秤设备删除'
),
learned_expressions = '[]'
WHERE intent_code = 'SCALE_DELETE_DEVICE';

-- SCALE_LIST_DEVICES: 强化列表查询关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '秤列表', '电子秤列表', '所有秤', '查看秤', '有哪些秤',
    '称重设备列表', '地磅列表', '台秤列表', '看看有哪些秤',
    '秤设备清单', '我们的秤', '工厂的秤', '秤都有哪些',
    '称重设备清单', 'IoT秤列表', '物联网秤列表', '智能秤列表',
    '电子称一览', '秤一览', '帮我看秤'
)
WHERE intent_code = 'SCALE_LIST_DEVICES';

-- SCALE_DEVICE_DETAIL: 秤详情查询
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '秤详情', '秤的详细信息', '查看某个秤', '秤的参数',
    '这个秤的状态', '秤的精度', '秤的量程', '秤连接状态',
    '秤在线吗', '秤是否正常', '秤具体是什么型号', '秤的配置',
    '称重设备详情', '称重设备状态'
)
WHERE intent_code = 'SCALE_DEVICE_DETAIL';

-- SCALE_ADD_DEVICE: 添加秤
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '添加秤', '新增秤', '注册新秤', '录入电子秤', '接入秤',
    '新建秤设备', '创建秤', '添加称重设备', '新增称重设备'
)
WHERE intent_code = 'SCALE_ADD_DEVICE';

-- SCALE_UPDATE_DEVICE: 更新秤
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '修改秤', '更新秤', '调整秤设置', '秤配置修改',
    '更新秤参数', '修改秤配置', '编辑秤', '变更秤设置'
)
WHERE intent_code = 'SCALE_UPDATE_DEVICE';

-- ================================================
-- 2. 生产批次模块修复 - PROCESSING_BATCH_CREATE 过度匹配
-- ================================================

-- PROCESSING_BATCH_CREATE: 只保留明确的创建关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '创建批次', '新建批次', '新建生产任务', '创建加工批次',
    '开一个新批次', '新增批次', '开始新批次', '创建生产批次',
    '新建加工任务', '录入新批次'
),
learned_expressions = '[]'
WHERE intent_code = 'PROCESSING_BATCH_CREATE';

-- PROCESSING_BATCH_LIST: 强化列表查询关键词
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '批次列表', '生产批次列表', '所有批次', '全部批次',
    '批次清单', '生产任务列表', '加工任务列表', '今天的生产批次',
    '批次都有哪些', '查看批次', '批次查询', '生产订单列表',
    '帮我查批次', '批次汇总', '生产列表'
)
WHERE intent_code = 'PROCESSING_BATCH_LIST';

-- PROCESSING_BATCH_DETAIL: 批次详情
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '批次详情', '批次具体信息', '某个批次的状态', '批次进度查询',
    '查看批次资料', '这个批次的详情', '批次信息', '单个批次',
    '批次详细', '批次数据'
)
WHERE intent_code = 'PROCESSING_BATCH_DETAIL';

-- PROCESSING_BATCH_START: 开始批次
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '开始生产', '批次开始', '启动批次', '开工', '批次上线',
    '开始加工', '生产启动', '投产'
)
WHERE intent_code = 'PROCESSING_BATCH_START';

-- PROCESSING_BATCH_PAUSE: 暂停批次
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '暂停批次', '批次暂停', '停一下生产', '暂时中止',
    '生产暂停', '批次挂起', '暂停加工'
)
WHERE intent_code = 'PROCESSING_BATCH_PAUSE';

-- PROCESSING_BATCH_RESUME: 恢复批次
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '继续生产', '恢复批次', '批次恢复', '重新开始生产',
    '恢复加工', '取消暂停', '继续加工'
)
WHERE intent_code = 'PROCESSING_BATCH_RESUME';

-- PROCESSING_BATCH_COMPLETE: 完成批次
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '完成批次', '批次完工', '加工完成', '生产完毕',
    '批次结束', '完工', '收工', '生产结束'
)
WHERE intent_code = 'PROCESSING_BATCH_COMPLETE';

-- PROCESSING_BATCH_CANCEL: 取消批次
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '取消批次', '撤销批次', '批次不做了', '作废批次',
    '删除批次', '放弃批次', '批次作废'
)
WHERE intent_code = 'PROCESSING_BATCH_CANCEL';

-- ================================================
-- 3. 告警模块修复 - 意图混淆问题
-- ================================================

-- ALERT_LIST: 告警列表（通用查询）
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '告警列表', '所有告警', '查看告警', '告警记录',
    '全部告警', '警报列表', '告警一览', '告警清单',
    '有什么告警', '系统警报列表', '异常列表', '帮我看告警'
)
WHERE intent_code = 'ALERT_LIST';

-- ALERT_ACTIVE: 活跃/当前告警（强调未处理）
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '活跃告警', '当前告警', '未处理告警', '待处理告警',
    '进行中告警', '实时告警', '正在发生的告警', '未解决告警',
    '现在有哪些告警', '正在报警', '当前异常', '未关闭警报'
)
WHERE intent_code = 'ALERT_ACTIVE';

-- ALERT_ACKNOWLEDGE: 确认告警（强调确认动作）
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '确认告警', '确认收到告警', '告警已读', '标记告警已读',
    '我知道这个告警了', '告警我看到了', '确认这个警报',
    '知悉告警', '告警确认'
)
WHERE intent_code = 'ALERT_ACKNOWLEDGE';

-- ALERT_RESOLVE: 解决告警
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '解决告警', '告警已处理', '关闭告警', '问题已解决',
    '告警可以关了', '完成告警处理', '告警处理完毕',
    '告警已修复', '解除告警'
)
WHERE intent_code = 'ALERT_RESOLVE';

-- ALERT_STATS: 告警统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '告警统计', '告警数据统计', '报警次数统计', '告警趋势',
    '警报数量分析', '告警汇总数据', '告警统计报表'
)
WHERE intent_code = 'ALERT_STATS';

-- ALERT_BY_LEVEL: 按级别告警
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '严重告警', '高级别警报', '紧急告警', '一般性告警',
    '按严重程度看告警', '告警级别', '危急告警', '低级别告警'
)
WHERE intent_code = 'ALERT_BY_LEVEL';

-- ALERT_DIAGNOSE: 告警诊断
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '诊断告警', '告警诊断', '分析告警原因', '告警怎么回事',
    '为什么会报警', '告警根因分析', '告警原因', '异常诊断'
)
WHERE intent_code = 'ALERT_DIAGNOSE';

-- ================================================
-- 4. 溯源模块修复 - TRACE_* 意图缺失
-- ================================================

-- TRACE_BATCH: 批次溯源（区别于批次详情）
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '批次溯源', '追踪批次', '批次追溯', '批次来源',
    '查批次流向', '批次从哪来', '溯源这个批次',
    '批次追踪', '批次来源追溯', '批次全程追踪'
)
WHERE intent_code = 'TRACE_BATCH';

-- TRACE_FULL: 全链路溯源
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '全链路追溯', '完整溯源', '从头到尾追踪', '全流程追溯',
    '端到端溯源', '全程溯源', '完整追踪链', '全链路溯源'
)
WHERE intent_code = 'TRACE_FULL';

-- TRACE_PUBLIC: 公开溯源
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '公开溯源', '生成溯源码', '公开溯源信息', '消费者溯源',
    '对外溯源', '产品溯源二维码', '溯源码生成', '外部溯源查询'
)
WHERE intent_code = 'TRACE_PUBLIC';

-- ================================================
-- 5. 设备模块修复 - EQUIPMENT_STATS 过度匹配
-- ================================================

-- EQUIPMENT_STATS: 设备统计（明确统计相关）
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备统计', '设备使用率', '设备效率数据', '设备运行时长统计',
    '设备利用率统计', '机器运行统计', '设备数据统计'
),
learned_expressions = '[]'
WHERE intent_code = 'EQUIPMENT_STATS';

-- EQUIPMENT_LIST: 设备列表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备列表', '所有设备', '设备清单', '查看设备',
    '设备查询', '机器列表', '生产设备', '设备一览',
    '全部设备', '设备目录', '查设备', '看设备', '帮我看设备'
)
WHERE intent_code = 'EQUIPMENT_LIST';

-- EQUIPMENT_DETAIL: 设备详情
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备详情', '设备信息', '某个设备的信息', '设备参数',
    '机台详细资料', '具体设备状态', '设备规格', '设备基本情况'
)
WHERE intent_code = 'EQUIPMENT_DETAIL';

-- EQUIPMENT_START: 启动设备
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '启动设备', '开启设备', '把设备打开', '开启机器',
    '设备上电', '启用设备', '让设备运转起来', '开机'
)
WHERE intent_code = 'EQUIPMENT_START';

-- EQUIPMENT_STOP: 停止设备
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '停止设备', '关闭设备', '把设备关了', '机器停下来',
    '关掉设备', '设备下电', '让机器停止运转', '关机', '停机'
)
WHERE intent_code = 'EQUIPMENT_STOP';

-- EQUIPMENT_ALERT_LIST: 设备告警列表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备告警列表', '设备警报汇总', '设备故障告警', '机器告警列表',
    '设备异常列表', '设备报警记录', '设备告警查询',
    '哪些设备有故障', '机器报警信息', '设备异常汇总', '设备有什么问题'
)
WHERE intent_code = 'EQUIPMENT_ALERT_LIST';

-- EQUIPMENT_ALERT_STATS: 设备告警统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备告警统计', '设备故障统计', '设备异常统计', '机器故障统计',
    '设备警报统计', '设备报警汇总', '机器利用率'
)
WHERE intent_code = 'EQUIPMENT_ALERT_STATS';

-- EQUIPMENT_MAINTENANCE: 设备维护
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '设备维护', '设备保养', '设备该保养了', '机器维修计划',
    '设备保养记录', '机台维护情况', '设备检修安排', '维护保养'
)
WHERE intent_code = 'EQUIPMENT_MAINTENANCE';

-- EQUIPMENT_STATUS_UPDATE: 更新设备状态
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '更新设备状态', '修改设备状态', '设备状态变更',
    '切换设备状态', '设备状态更新'
)
WHERE intent_code = 'EQUIPMENT_STATUS_UPDATE';

-- ================================================
-- 6. 出货模块修复
-- ================================================

-- SHIPMENT_QUERY: 出货查询
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '查询出货', '出货记录', '出货单查询', '发货记录', '发货查询',
    '查出货', '出货历史', '发货历史', '出货单列表', '查发货',
    '发货记录查询', '发货单查询', '帮我查发货'
)
WHERE intent_code = 'SHIPMENT_QUERY';

-- SHIPMENT_CREATE: 创建出货
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '创建出货', '新建出货', '新建出货单', '安排发货',
    '创建发货单', '出货登记', '登记出货', '准备发货',
    '开一张出货单', '发个货'
)
WHERE intent_code = 'SHIPMENT_CREATE';

-- SHIPMENT_STATS: 出货统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '出货统计', '发货统计', '出货报表', '发货报表', '出货量统计',
    '出货数据', '发货数据', '出货汇总', '出货量', '发货量',
    '发货数量统计', '出货量分析', '本月出货统计'
)
WHERE intent_code = 'SHIPMENT_STATS';

-- SHIPMENT_BY_DATE: 按日期出货
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '今天发货', '今日发货', '昨天发货', '本周出货',
    '今天发了多少货', '某天的发货记录', '按日期查出货',
    '近期出货', '最近发货'
)
WHERE intent_code = 'SHIPMENT_BY_DATE';

-- SHIPMENT_BY_CUSTOMER: 按客户出货
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '某个客户的出货', '客户发货', '给谁发过货',
    '客户发货记录', '查某客户的发货', '发给这个客户的货'
)
WHERE intent_code = 'SHIPMENT_BY_CUSTOMER';

-- SHIPMENT_UPDATE: 更新出货
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '修改出货', '更新出货', '修改发货单', '更新出货信息',
    '变更发货内容', '调整出货数量', '编辑发货记录'
)
WHERE intent_code = 'SHIPMENT_UPDATE';

-- SHIPMENT_STATUS_UPDATE: 更新出货状态
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '更新出货状态', '修改发货状态', '出货状态变更',
    '发货状态更新', '物流状态更新'
)
WHERE intent_code = 'SHIPMENT_STATUS_UPDATE';

-- ================================================
-- 7. 原料模块修复
-- ================================================

-- MATERIAL_BATCH_QUERY: 原料查询
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '原料查询', '查看原材料', '原材料库存', '原料信息',
    '物料查询', '原料批次查询', '材料清单', '仓库原料'
)
WHERE intent_code = 'MATERIAL_BATCH_QUERY';

-- MATERIAL_LOW_STOCK_ALERT: 低库存预警
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '低库存预警', '库存不足预警', '原料缺货', '物料低库存',
    '需要补货的原料', '哪些原料快没了', '缺货提醒', '库存告警'
)
WHERE intent_code = 'MATERIAL_LOW_STOCK_ALERT';

-- MATERIAL_BATCH_RESERVE: 原料预留
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '预留原料', '锁定物料', '原料占用', '保留材料',
    '预定原料', '原料预留', '物料预留'
)
WHERE intent_code = 'MATERIAL_BATCH_RESERVE';

-- MATERIAL_UPDATE: 原料更新
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '更新原料', '修改原料信息', '原料信息变更',
    '物料信息更新', '材料信息修改'
)
WHERE intent_code = 'MATERIAL_UPDATE';

-- ================================================
-- 8. 质检模块修复
-- ================================================

-- QUALITY_CHECK_QUERY: 质检项查询
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '质检项目', '质量检查项', '检测标准', '检查什么',
    '质检查询', '检验项目有哪些', '质检指标', '品质检验项目'
)
WHERE intent_code = 'QUALITY_CHECK_QUERY';

-- QUALITY_CHECK_EXECUTE: 执行质检
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '执行质检', '开始检验', '做质量检查', '进行质检',
    '检验这批货', '质量检测', '做个检验', '检查产品质量',
    '品质检验', '质检操作'
)
WHERE intent_code = 'QUALITY_CHECK_EXECUTE';

-- QUALITY_STATS: 质量统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '质检合格率', '质量统计', '质检通过率', '质量数据统计',
    '品质数据', '质检数据分析', '质量报告统计'
)
WHERE intent_code = 'QUALITY_STATS';

-- QUALITY_CRITICAL_ITEMS: 关键质检项
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '关键质检项', '重要检验指标', '核心质量点', '主要质检内容',
    '关键品质要求', '重点检查项'
)
WHERE intent_code = 'QUALITY_CRITICAL_ITEMS';

-- QUALITY_DISPOSITION_EXECUTE: 执行处置
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '执行处置', '不良品处置', '处理不合格品', '次品处理',
    '质量问题处置', '执行处置方案', '处置执行'
)
WHERE intent_code = 'QUALITY_DISPOSITION_EXECUTE';

-- QUALITY_DISPOSITION_EVALUATE: 评估处置
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '评估处置', '处置评估', '处置方案评估', '不良品评估'
)
WHERE intent_code = 'QUALITY_DISPOSITION_EVALUATE';

-- ================================================
-- 9. 报表模块修复
-- ================================================

-- REPORT_DASHBOARD_OVERVIEW: 总览看板
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '数据看板', '总体概况', '综合报表', '首页数据',
    '整体情况', '大屏展示', '汇总看板', '概览',
    '厂里什么情况', '帮我看报表'
)
WHERE intent_code = 'REPORT_DASHBOARD_OVERVIEW';

-- REPORT_PRODUCTION: 生产报表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '生产报表', '产量数据', '生产统计报告', '产出报表',
    '加工数据报表', '生产情况报告', '产能报表', '今天生产了多少'
)
WHERE intent_code = 'REPORT_PRODUCTION';

-- REPORT_INVENTORY: 库存报表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '库存报表', '库存数据', '存货报告', '仓储报表',
    '库存汇总', '库存分析报告', '物料库存报表'
)
WHERE intent_code = 'REPORT_INVENTORY';

-- REPORT_QUALITY: 质量报表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '质量报表', '品质数据报告', '质检报表', '合格率报表',
    '质量分析报告', '检验报表', '品质报告'
)
WHERE intent_code = 'REPORT_QUALITY';

-- REPORT_EFFICIENCY: 效率报表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '效率报表', '产能利用率', '生产效率分析', '设备效率报告',
    'OEE报表', '效率数据', '效率分析报告'
)
WHERE intent_code = 'REPORT_EFFICIENCY';

-- ================================================
-- 10. 客户模块修复
-- ================================================

-- CUSTOMER_LIST: 客户列表
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '客户列表', '客户名单', '所有客户', '客户清单',
    '客户都有谁', '客户档案', '合作客户列表'
)
WHERE intent_code = 'CUSTOMER_LIST';

-- CUSTOMER_SEARCH: 客户搜索
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '搜索客户', '找客户', '查找客户', '客户检索',
    '根据名字找客户', '客户筛选'
)
WHERE intent_code = 'CUSTOMER_SEARCH';

-- CUSTOMER_ACTIVE: 活跃客户
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '活跃客户', '活跃的客户', '最近下单的客户', '有交易的客户',
    '常来的客户', '活跃客户列表'
)
WHERE intent_code = 'CUSTOMER_ACTIVE';

-- CUSTOMER_BY_TYPE: 按类型客户
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '客户类型', '按类型查客户', '客户分类', '不同类型客户'
)
WHERE intent_code = 'CUSTOMER_BY_TYPE';

-- CUSTOMER_STATS: 客户统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '客户统计', '客户数据统计', '客户分析', '客户数量',
    '客户分布', '客户增长情况', '客户汇总数据'
)
WHERE intent_code = 'CUSTOMER_STATS';

-- CUSTOMER_PURCHASE_HISTORY: 客户购买历史
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '客户购买记录', '客户订单历史', '客户采购记录',
    '这个客户买过什么', '客户交易历史', '客户消费记录'
)
WHERE intent_code = 'CUSTOMER_PURCHASE_HISTORY';

-- ================================================
-- 11. 用户模块修复
-- ================================================

-- USER_CREATE: 创建用户
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '新建用户', '创建用户', '添加员工账号', '注册新用户',
    '创建账号', '开通用户', '新增系统用户', '录入新员工'
)
WHERE intent_code = 'USER_CREATE';

-- USER_DISABLE: 禁用用户
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '禁用用户', '停用账号', '冻结用户', '关闭账号',
    '用户停权', '暂停用户', '封禁账号', '停用用户'
)
WHERE intent_code = 'USER_DISABLE';

-- USER_ROLE_ASSIGN: 分配角色
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '分配角色', '给用户分配角色', '设置用户权限', '调整用户角色',
    '授予角色', '变更用户权限', '角色分配', '权限分配'
)
WHERE intent_code = 'USER_ROLE_ASSIGN';

-- ================================================
-- 12. 系统配置模块修复
-- ================================================

-- SCHEDULING_SET_AUTO: 自动排产
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '自动排产', '开启自动排产', '启用自动排产', '排产改为自动',
    '自动化排程', '智能排产', '自动排程模式'
)
WHERE intent_code = 'SCHEDULING_SET_AUTO';

-- SCHEDULING_SET_MANUAL: 人工排产
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '人工排产', '手动排产', '改为人工排产', '手动排产模式',
    '排产需要确认', '人工确认排程', '半自动排产'
)
WHERE intent_code = 'SCHEDULING_SET_MANUAL';

-- FACTORY_FEATURE_TOGGLE: 功能开关
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '功能开关', '开关功能', '启用功能', '禁用功能',
    '功能开关设置', '切换功能状态', '功能切换'
)
WHERE intent_code = 'FACTORY_FEATURE_TOGGLE';

-- RULE_CONFIG: 规则配置
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '规则配置', '配置规则', '规则设置', '业务规则配置',
    '修改规则', '规则管理', '规则调整'
)
WHERE intent_code = 'RULE_CONFIG';

-- ================================================
-- 13. 考勤模块优化
-- ================================================

-- CLOCK_OUT: 下班打卡
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '下班打卡', '下班签退', '签退', '结束工作', '下班了',
    '我要下班', '收工打卡', '离开公司', '退勤', '我先撤了',
    '今天干完了', '回家打卡', '下班了帮我签退', '我要走了'
)
WHERE intent_code = 'CLOCK_OUT';

-- PROCESSING_WORKER_CHECKOUT: 工人签出（区别于下班打卡）
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '工人签出', '员工签出', '产线签出', '车间签出',
    '工作签出', '生产签出'
)
WHERE intent_code = 'PROCESSING_WORKER_CHECKOUT';

-- ATTENDANCE_STATS: 考勤统计
UPDATE ai_intent_configs
SET keywords = JSON_ARRAY(
    '考勤统计', '出勤率统计', '考勤数据分析', '打卡统计',
    '员工出勤情况统计', '考勤汇总数据', '出勤数据'
)
WHERE intent_code = 'ATTENDANCE_STATS';

-- ================================================
-- 14. 清除可能干扰的learned_expressions
-- ================================================

UPDATE ai_intent_configs
SET learned_expressions = '[]'
WHERE intent_code IN (
    'ALERT_ACKNOWLEDGE', 'ALERT_BY_LEVEL', 'ALERT_STATS',
    'REPORT_INVENTORY', 'MATERIAL_BATCH_RESERVE',
    'CUSTOMER_BY_TYPE', 'SHIPMENT_STATUS_UPDATE'
);

-- ================================================
-- 15. 清除TEST_AUTO开头的测试意图
-- ================================================

DELETE FROM ai_intent_configs WHERE intent_code LIKE 'TEST_AUTO_%';
