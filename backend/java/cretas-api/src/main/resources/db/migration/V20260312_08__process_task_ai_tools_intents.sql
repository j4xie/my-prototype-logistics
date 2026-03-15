-- Process Task AI Tools — Intent Config bindings
-- 4 tools: process_task_query, process_task_create, process_task_summary, process_task_analysis

INSERT INTO ai_intent_config (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level)
VALUES
  (gen_random_uuid(), 'PROCESS_TASK_QUERY', '查询工序任务', 'DATA_QUERY',
   'process_task_query',
   '["工序任务","工序列表","工序进度","查看工序","工序状态","任务列表","进行中任务","待完成任务"]',
   true, 'LOW'),
  (gen_random_uuid(), 'PROCESS_TASK_CREATE', '创建工序任务', 'DATA_OPERATION',
   'process_task_create',
   '["创建工序","新建工序任务","安排工序","新增任务","创建生产任务","添加工序"]',
   true, 'MEDIUM'),
  (gen_random_uuid(), 'PROCESS_TASK_SUMMARY', '工序任务摘要', 'DATA_QUERY',
   'process_task_summary',
   '["任务详情","任务摘要","任务进度详情","工序任务详细","报工详情","工人参与情况"]',
   true, 'LOW'),
  (gen_random_uuid(), 'PROCESS_TASK_ANALYSIS', '工序任务分析', 'REPORT',
   'process_task_analysis',
   '["工序分析","产能分析","任务完成率","延期风险","工序统计","生产进度分析","工序瓶颈"]',
   true, 'LOW')
ON CONFLICT DO NOTHING;
