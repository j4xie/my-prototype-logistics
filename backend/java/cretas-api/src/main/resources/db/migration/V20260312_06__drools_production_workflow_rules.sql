-- Task 14: Insert production workflow Drools rules into drools_rules table
-- These rules handle PROCESS mode state transitions and validations

-- Rule: enter_supplementing action
INSERT INTO drools_rules (id, factory_id, rule_group, rule_name, rule_description, rule_content, version, enabled, priority, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'SYSTEM',
    'action:enter_supplementing',
    'enter_supplementing_record_previous',
    'Records previousTerminalStatus when entering SUPPLEMENTING state',
    'package com.cretas.aims.rules.production;

import com.cretas.aims.entity.ProcessTask;
import java.util.Map;

global Map actionResult;

rule "Enter Supplementing - Record Previous Status"
    salience 100
    when
        $task: ProcessTask(
            status.name() == "COMPLETED" || status.name() == "CLOSED"
        )
    then
        actionResult.put("previousTerminalStatus", $task.getStatus().name());
        actionResult.put("newStatus", "SUPPLEMENTING");
        actionResult.put("action", "enter_supplementing");
end',
    1, true, 100, NOW(), NOW()
) ON CONFLICT (factory_id, rule_group, rule_name) DO NOTHING;

-- Rule: exit_supplementing action
INSERT INTO drools_rules (id, factory_id, rule_group, rule_name, rule_description, rule_content, version, enabled, priority, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'SYSTEM',
    'action:exit_supplementing',
    'exit_supplementing_restore_status',
    'Restores previousTerminalStatus when all supplements are approved',
    'package com.cretas.aims.rules.production;

import com.cretas.aims.entity.ProcessTask;
import java.util.Map;

global Map actionResult;

rule "Exit Supplementing - Restore Previous Status"
    salience 100
    when
        $task: ProcessTask(
            status.name() == "SUPPLEMENTING",
            previousTerminalStatus != null
        )
    then
        actionResult.put("newStatus", $task.getPreviousTerminalStatus());
        actionResult.put("action", "exit_supplementing");
        actionResult.put("clearPreviousTerminalStatus", true);
end',
    1, true, 100, NOW(), NOW()
) ON CONFLICT (factory_id, rule_group, rule_name) DO NOTHING;

-- Rule: update_completed_qty action
INSERT INTO drools_rules (id, factory_id, rule_group, rule_name, rule_description, rule_content, version, enabled, priority, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'SYSTEM',
    'action:update_completed_qty',
    'update_completed_quantity_on_approve',
    'Updates completedQuantity when a report is approved',
    'package com.cretas.aims.rules.production;

import java.util.Map;
import java.math.BigDecimal;

global Map actionResult;

rule "Update Completed Quantity On Approve"
    salience 100
    when
        $facts: Map(
            this["approvedQuantity"] != null,
            this["taskId"] != null
        )
    then
        actionResult.put("action", "update_completed_qty");
        actionResult.put("taskId", $facts.get("taskId"));
        actionResult.put("quantity", $facts.get("approvedQuantity"));
end',
    1, true, 100, NOW(), NOW()
) ON CONFLICT (factory_id, rule_group, rule_name) DO NOTHING;

-- Rule: production_validation group
INSERT INTO drools_rules (id, factory_id, rule_group, rule_name, rule_description, rule_content, version, enabled, priority, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'SYSTEM',
    'production_validation',
    'process_task_quantity_validation',
    'Validates process task quantities before state transitions',
    'package com.cretas.aims.rules.production;

import com.cretas.aims.entity.ProcessTask;
import java.util.Map;
import java.math.BigDecimal;

global Map validationResult;

rule "Completed quantity must not exceed planned by 200%"
    salience 90
    when
        $task: ProcessTask(
            plannedQuantity != null,
            completedQuantity != null,
            completedQuantity.compareTo(plannedQuantity.multiply(new BigDecimal("2"))) > 0
        )
    then
        validationResult.put("valid", false);
        validationResult.put("message", "完成量不能超过计划量的200%");
end

rule "Cannot close task with pending reports"
    salience 85
    when
        $task: ProcessTask(
            pendingQuantity != null,
            pendingQuantity.compareTo(BigDecimal.ZERO) > 0
        )
        $facts: Map(this["action"] == "close")
    then
        validationResult.put("valid", false);
        validationResult.put("message", "存在待审批报工，无法关闭任务");
end',
    1, true, 90, NOW(), NOW()
) ON CONFLICT (factory_id, rule_group, rule_name) DO NOTHING;

-- Rule: onTransition audit for PRODUCTION_WORKFLOW
INSERT INTO drools_rules (id, factory_id, rule_group, rule_name, rule_description, rule_content, version, enabled, priority, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'SYSTEM',
    'onTransition:PRODUCTION_WORKFLOW',
    'production_workflow_transition_audit',
    'Audit log for all production workflow state transitions',
    'package com.cretas.aims.rules.production;

import java.util.Map;

global Map actionResult;

rule "Log Production Workflow Transition"
    salience 50
    when
        $facts: Map(
            this["fromState"] != null,
            this["toState"] != null,
            this["event"] != null
        )
    then
        actionResult.put("auditRequired", true);
        actionResult.put("entityType", "PRODUCTION_WORKFLOW");
        actionResult.put("fromState", $facts.get("fromState"));
        actionResult.put("toState", $facts.get("toState"));
        actionResult.put("event", $facts.get("event"));
end',
    1, true, 50, NOW(), NOW()
) ON CONFLICT (factory_id, rule_group, rule_name) DO NOTHING;
