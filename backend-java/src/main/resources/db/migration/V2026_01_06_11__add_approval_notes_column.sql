-- 添加审批备注字段
-- 用于平台级意图晋升审批时记录审批人的备注信息

ALTER TABLE intent_optimization_suggestions
ADD COLUMN IF NOT EXISTS approval_notes TEXT COMMENT '审批备注 (平台晋升审批时使用)';
