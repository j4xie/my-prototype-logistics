-- ISAPI 事件日志添加 AI 分析字段
-- 用于存储 Qwen VL 对告警图片的分析结果

ALTER TABLE isapi_event_logs
    ADD COLUMN ai_analyzed BOOLEAN DEFAULT FALSE,
    ADD COLUMN ai_analyzed_at DATETIME,
    ADD COLUMN ai_threat_level VARCHAR(20) COMMENT 'HIGH, MEDIUM, LOW, NONE',
    ADD COLUMN ai_detected_objects VARCHAR(500) COMMENT 'JSON array of detected objects',
    ADD COLUMN ai_object_count INT,
    ADD COLUMN ai_scene_description VARCHAR(500),
    ADD COLUMN ai_risk_assessment VARCHAR(1000),
    ADD COLUMN ai_recommended_actions VARCHAR(1000) COMMENT 'JSON array of recommended actions',
    ADD COLUMN ai_production_impact VARCHAR(500),
    ADD COLUMN ai_hygiene_concern BOOLEAN DEFAULT FALSE,
    ADD COLUMN ai_safety_concern BOOLEAN DEFAULT FALSE,
    ADD COLUMN ai_requires_action BOOLEAN DEFAULT FALSE;

-- 添加索引以支持高威胁级别告警查询
CREATE INDEX idx_ai_requires_action ON isapi_event_logs(ai_requires_action);
CREATE INDEX idx_ai_threat_level ON isapi_event_logs(ai_threat_level);
CREATE INDEX idx_ai_analyzed ON isapi_event_logs(ai_analyzed);
