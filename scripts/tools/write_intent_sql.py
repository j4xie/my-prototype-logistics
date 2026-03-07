#!/usr/bin/env python3
# Script to write the intent update SQL file on the server
sql = (
    "UPDATE ai_intent_configs SET \n"
    "  description = $$为指定生产批次创建新的质量检测记录单。适用于质检员需要开始一次新的质检任务时，需要指定检测类型（如原料检验、过程检验、成品检验）和批次号。不适用于查询已有质检结果、统计质检合格率、查看质检标准等场景。$$,\n"
    '  keywords = \'["新建质检","创建质检单","开始质检","发起质检任务","新增检测记录","创建检验单"]\'::jsonb\n'
    "WHERE intent_code = 'QUALITY_CHECK_CREATE';\n\n"
    "UPDATE ai_intent_configs SET \n"
    "  description = $$当用户明确询问系统的使用方法、操作指南或功能介绍时提供帮助说明。仅当用户直接表达不知道怎么操作、请求使用教程、询问系统有什么功能时触发。不适用于任何业务查询、数据操作、报表生成等具体业务场景。$$,\n"
    '  keywords = \'["系统帮助","怎么用这个系统","操作指南","功能介绍","使用教程","系统使用说明"]\'::jsonb\n'
    "WHERE intent_code = 'SYSTEM_HELP';\n\n"
    "UPDATE ai_intent_configs SET \n"
    "  description = $$释放之前已通过预留操作锁定的原材料批次，将其状态从已预留恢复为可用。仅用于取消已有的原材料预留记录，需要指定预留批次号。不适用于原材料出库、消耗记录、库存查询、任务分配等操作。$$,\n"
    '  keywords = \'["释放预留","取消预留","解锁原料批次","释放原料预留","取消原料锁定"]\'::jsonb\n'
    "WHERE intent_code = 'MATERIAL_BATCH_RELEASE';\n"
)

with open("/tmp/update_intents.sql", "w", encoding="utf-8") as f:
    f.write(sql)
print("SQL file written successfully")
print("---")
print(sql)
