-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_30_7__add_rule_version_tracking.sql
-- Conversion date: 2026-01-26 18:46:20
-- ============================================

-- =====================================================
-- 规则版本追踪字段
-- 用于在审计日志中记录具体的规则配置版本
-- V2025_12_30_7
-- =====================================================

ALTER TABLE decision_audit_logs
ADD COLUMN rule_config_id VARCHAR(36) COMMENT '规则配置ID (ApprovalChainConfig或DroolsRule的ID)',
ADD COLUMN rule_config_version INT COMMENT '规则配置版本号',
ADD COLUMN rule_config_name VARCHAR(100) COMMENT '规则配置名称';

-- 索引：便于按规则配置查询审计记录
CREATE INDEX idx_decision_audit_rule_config ON decision_audit_logs(rule_config_id);
CREATE INDEX idx_decision_audit_rule_version ON decision_audit_logs(rule_config_id, rule_config_version);
