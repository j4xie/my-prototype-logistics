-- Task 15: StateMachine version governance
-- Add publish_status column and versioning support

-- Add publish_status column (draft/published/archived)
ALTER TABLE state_machines ADD COLUMN IF NOT EXISTS publish_status VARCHAR(20) DEFAULT 'published';

-- Drop old unique constraint (factory_id, entity_type) to allow versions
ALTER TABLE state_machines DROP CONSTRAINT IF EXISTS uk_state_machines;

-- Add new unique constraint (factory_id, entity_type, version)
ALTER TABLE state_machines ADD CONSTRAINT uk_sm_factory_entity_version
    UNIQUE(factory_id, entity_type, version);

-- Partial unique index: only one published version per (factory_id, entity_type)
CREATE UNIQUE INDEX IF NOT EXISTS uk_sm_published
    ON state_machines(factory_id, entity_type)
    WHERE publish_status = 'published';

-- Set existing records to 'published'
UPDATE state_machines SET publish_status = 'published' WHERE publish_status IS NULL;

-- Insert PRODUCTION_WORKFLOW example for F001
INSERT INTO state_machines (id, factory_id, entity_type, machine_name, machine_description, initial_state, states_json, transitions_json, version, enabled, publish_status, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'F001',
    'PRODUCTION_WORKFLOW',
    '多工序长周期加工流程',
    '适用于多工序长周期食品加工场景，支持累加报工、补报、审批',
    'plan_created',
    '[
        {"code":"plan_created","name":"任务已创建","isFinal":false,"color":"#909399"},
        {"code":"in_progress","name":"进行中","isFinal":false,"color":"#1890ff"},
        {"code":"target_reached","name":"已达标","isFinal":false,"color":"#e6a23c"},
        {"code":"completed","name":"已完成","isFinal":true,"color":"#67c23a"},
        {"code":"closed","name":"已关闭","isFinal":true,"color":"#606266"},
        {"code":"supplementing","name":"补报中","isFinal":false,"color":"#e6a23c"}
    ]',
    '[
        {"from":"plan_created","to":"in_progress","event":"first_checkin_or_report"},
        {"from":"in_progress","to":"target_reached","event":"quantity_reached","guard":"#isCompletedGtePlanned(id)"},
        {"from":"target_reached","to":"completed","event":"manual_complete"},
        {"from":"in_progress","to":"closed","event":"manual_close","guard":"#hasPermission(''workshop_supervisor'')"},
        {"from":"completed","to":"supplementing","event":"initiate_supplement","guard":"#hasPermission(''factory_admin'')","action":"enter_supplementing"},
        {"from":"closed","to":"supplementing","event":"initiate_supplement","guard":"#hasPermission(''factory_admin'')","action":"enter_supplementing"},
        {"from":"supplementing","to":"completed","event":"supplement_done","guard":"#hasNoPendingSupplements(id) && #previousStatusIs(''COMPLETED'')","action":"exit_supplementing"},
        {"from":"supplementing","to":"closed","event":"supplement_done","guard":"#hasNoPendingSupplements(id) && #previousStatusIs(''CLOSED'')","action":"exit_supplementing"}
    ]',
    1,
    true,
    'published',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;
