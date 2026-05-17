-- V20260605_02: 工作流变量库 (workflow_variable_def) — Sprint 4 W2 Chat J C-WF-VAR-1
--
-- 用途: 元数据登记表, 告诉 PropertyPanel / AIChat Tool / 文档生成器
--      "这个工厂可以在 SpEL 表达式里引用哪些变量, 类型是什么".
--
-- 配合 SandboxedSpelEvaluator + WorkflowVariableContext, 形成完整变量库:
--    1. 静态层 (WorkflowVariableContext POJO): 4 命名空间 (own/order/customer/businessEntity)
--    2. 元数据层 (本表): 变量名 / 类型 / 样例值 / 描述, 给前端选择器 + AIChat Tool 用
--    3. 求值层 (SandboxedSpelEvaluator): 拒绝反射 / Type / new / 写入
--
-- factory_id NULL = 系统预设 (全工厂共享, 15 默认变量), 非 NULL = 工厂自定义扩展.

CREATE TABLE workflow_variable_def (
    id            VARCHAR(36)  PRIMARY KEY,
    factory_id    VARCHAR(50),
        -- NULL = 系统预设 (跨工厂可见); 非 NULL = 工厂自定义
    var_name      VARCHAR(100) NOT NULL,
        -- SpEL 引用名, e.g. "own.userId" / "order.amount" / "businessEntity['priority']"
    var_type      VARCHAR(50)  NOT NULL,
        -- 数据类型: STRING / NUMBER / DECIMAL / BOOLEAN / DATE / DATETIME
    category      VARCHAR(50)  NOT NULL DEFAULT 'CUSTOM',
        -- 分组: OWN / ORDER / CUSTOMER / BUSINESS / CUSTOM
    description   VARCHAR(500),
    sample_value  VARCHAR(500),
        -- 样例值 (string-encoded), 供 AIChat Tool 测试时填充
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP
);

-- 唯一性: 同 factory + var_name 不重复 (含 NULL factory_id COALESCE)
CREATE UNIQUE INDEX uq_workflow_variable_def_name
    ON workflow_variable_def (COALESCE(factory_id, '__GLOBAL__'), var_name)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workflow_variable_def_category
    ON workflow_variable_def (category, is_active)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_workflow_variable_def_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_variable_def_updated_at
BEFORE UPDATE ON workflow_variable_def
FOR EACH ROW EXECUTE FUNCTION update_workflow_variable_def_updated_at();

COMMENT ON TABLE workflow_variable_def IS 'C-WF-VAR-1 工作流变量库元数据 — 给 PropertyPanel/AIChat Tool 提供 var name + type + sample';
COMMENT ON COLUMN workflow_variable_def.var_name IS 'SpEL 引用名, e.g. own.userId, businessEntity[''priority'']';
COMMENT ON COLUMN workflow_variable_def.var_type IS 'STRING / NUMBER / DECIMAL / BOOLEAN / DATE / DATETIME';
COMMENT ON COLUMN workflow_variable_def.category IS 'OWN / ORDER / CUSTOMER / BUSINESS / CUSTOM';

-- ==================== Seed 15 系统预设变量 ====================
-- factory_id NULL = 系统全工厂可见. 跟 WorkflowVariableContext POJO 字段对齐.

INSERT INTO workflow_variable_def (id, factory_id, var_name, var_type, category, description, sample_value, is_active)
VALUES
    -- OWN 命名空间 (4 变量)
    (gen_random_uuid()::text, NULL, 'own.userId',     'NUMBER',  'OWN', '当前操作人 ID',    '42',                 TRUE),
    (gen_random_uuid()::text, NULL, 'own.username',   'STRING',  'OWN', '当前操作人 登录名', 'alice',              TRUE),
    (gen_random_uuid()::text, NULL, 'own.role',       'STRING',  'OWN', '当前操作人 角色',   'factory_admin',      TRUE),
    (gen_random_uuid()::text, NULL, 'own.department', 'STRING',  'OWN', '当前操作人 部门',   'FINANCE',            TRUE),
    -- ORDER 命名空间 (5 变量)
    (gen_random_uuid()::text, NULL, 'order.orderNumber', 'STRING',  'ORDER',    '单据号',        'SO-20260516-0123', TRUE),
    (gen_random_uuid()::text, NULL, 'order.amount',      'DECIMAL', 'ORDER',    '单据金额',      '15000.00',          TRUE),
    (gen_random_uuid()::text, NULL, 'order.type',        'STRING',  'ORDER',    '单据类型',      'SALES',             TRUE),
    (gen_random_uuid()::text, NULL, 'order.creatorId',   'NUMBER',  'ORDER',    '创建人 ID',     '7',                 TRUE),
    (gen_random_uuid()::text, NULL, 'order.status',      'STRING',  'ORDER',    '单据当前状态',  'PENDING_APPROVAL',  TRUE),
    -- CUSTOMER 命名空间 (4 变量)
    (gen_random_uuid()::text, NULL, 'customer.id',          'STRING',  'CUSTOMER', '客户 ID',     'C001',              TRUE),
    (gen_random_uuid()::text, NULL, 'customer.name',        'STRING',  'CUSTOMER', '客户名称',    '六腾门连锁',         TRUE),
    (gen_random_uuid()::text, NULL, 'customer.level',       'STRING',  'CUSTOMER', '客户等级',    'VIP',               TRUE),
    (gen_random_uuid()::text, NULL, 'customer.creditLimit', 'DECIMAL', 'CUSTOMER', '客户信用额度', '100000.00',         TRUE),
    -- BUSINESS 通用 (2 示例; 实际可任意 key)
    (gen_random_uuid()::text, NULL, 'businessEntity[''priority'']', 'STRING', 'BUSINESS', '业务优先级 (通用 map)', 'HIGH',  TRUE),
    (gen_random_uuid()::text, NULL, 'businessEntity[''season'']',   'STRING', 'BUSINESS', '业务季度 (通用 map)',   'Q3',   TRUE);
