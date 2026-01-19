#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate remaining 93 test cases for P2+P3 testing
"""

import json

def generate_config_cases():
    """Generate 15 CONFIG test cases"""
    cases = []

    # CONFIG_GET cases (6)
    for i in range(1, 7):
        case = {
            "id": f"TC-P2-CONFIG-{i:03d}",
            "priority": "P2",
            "category": "CONFIG",
            "intentCode": "CONFIG_GET",
            "testType": "QUERY",
            "description": f"验证获取配置-场景{i}",
            "userInput": ["查询系统配置", "获取工厂配置", "配置信息查询", "查看当前配置", "系统参数获取", "配置详情"][i-1],
            "expectedIntent": {
                "intentCode": "CONFIG_GET",
                "confidence": [1.0, 0.95, 0.9, 0.9, 0.85, 0.9][i-1],
                "matchMethod": "FUSION" if i <= 2 else "SEMANTIC",
                "questionType": "INFORMATION_QUERY"
            },
            "testDataSetup": {
                "sql": f"INSERT INTO system_config (id, factory_id, config_key, config_value, created_at, updated_at) VALUES ({4000+i}, 'F001', 'test_config_{i}', 'value_{i}', NOW(), NOW());",
                "factoryId": "F001",
                "cleanup": f"DELETE FROM system_config WHERE id = {4000+i};"
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "dataNotNull": True
                },
                "dataVerification": {
                    "method": "FIELD_VALUES",
                    "expectedFields": ["configKey", "configValue"]
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": "配置|config"
            }
        }
        cases.append(case)

    # CONFIG_UPDATE cases (5)
    for i in range(7, 12):
        case = {
            "id": f"TC-P2-CONFIG-{i:03d}",
            "priority": "P2",
            "category": "CONFIG",
            "intentCode": "CONFIG_UPDATE",
            "testType": "OPERATION",
            "description": f"验证更新配置-场景{i-6}",
            "userInput": ["更新配置项test_config_7为new_value", "修改系统配置", "设置配置参数", "调整配置值", "配置更新操作"][i-7],
            "expectedIntent": {
                "intentCode": "CONFIG_UPDATE",
                "confidence": [0.95, 0.9, 0.9, 0.85, 0.9][i-7],
                "matchMethod": "FUSION" if i == 7 else "SEMANTIC",
                "questionType": "OPERATIONAL_COMMAND"
            },
            "testDataSetup": {
                "sql": f"INSERT INTO system_config (id, factory_id, config_key, config_value, created_at, updated_at) VALUES ({4000+i}, 'F001', 'test_config_{i}', 'old_value', NOW(), NOW());",
                "factoryId": "F001",
                "cleanup": f"DELETE FROM system_config WHERE id = {4000+i};"
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "operationSuccess": True
                },
                "operationVerification": {
                    "type": "FIELD_UPDATED",
                    "checkSql": f"SELECT config_value FROM system_config WHERE id = {4000+i}",
                    "expectedNewValue": "new_value" if i == 7 else None
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": "更新成功|修改成功"
            }
        }
        cases.append(case)

    # CONFIG_LIST cases (4)
    for i in range(12, 16):
        case = {
            "id": f"TC-P2-CONFIG-{i:03d}",
            "priority": "P2",
            "category": "CONFIG",
            "intentCode": "CONFIG_LIST",
            "testType": "QUERY",
            "description": f"验证配置列表-场景{i-11}",
            "userInput": ["配置列表", "所有配置项", "系统配置清单", "配置参数列表"][i-12],
            "expectedIntent": {
                "intentCode": "CONFIG_LIST",
                "confidence": [1.0, 0.9, 0.85, 0.9][i-12],
                "matchMethod": "PHRASE" if i == 12 else "SEMANTIC",
                "questionType": "INFORMATION_QUERY"
            },
            "testDataSetup": {
                "sql": f"INSERT INTO system_config (id, factory_id, config_key, config_value, created_at, updated_at) VALUES ({4000+i}, 'F001', 'config_a', 'val_a', NOW(), NOW()), ({4000+i+1}, 'F001', 'config_b', 'val_b', NOW(), NOW());",
                "factoryId": "F001",
                "cleanup": f"DELETE FROM system_config WHERE id IN ({4000+i}, {4000+i+1});"
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "dataNotNull": True
                },
                "dataVerification": {
                    "method": "LIST_COUNT",
                    "expectedMinCount": 2
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": "配置|2.*个"
            }
        }
        cases.append(case)

    return cases

def generate_camera_cases():
    """Generate 9 CAMERA test cases"""
    cases = []

    # CAMERA_STATUS cases (4)
    for i in range(1, 5):
        case = {
            "id": f"TC-P2-CAMERA-{i:03d}",
            "priority": "P2",
            "category": "CAMERA",
            "intentCode": "CAMERA_STATUS",
            "testType": "QUERY",
            "description": f"验证摄像头状态查询-场景{i}",
            "userInput": ["查询摄像头状态", "摄像头工作正常吗", "监控设备状态", "摄像头在线情况"][i-1],
            "expectedIntent": {
                "intentCode": "CAMERA_STATUS",
                "confidence": [1.0, 0.85, 0.9, 0.9][i-1],
                "matchMethod": "FUSION" if i == 1 else "SEMANTIC",
                "questionType": "INFORMATION_QUERY"
            },
            "testDataSetup": {
                "sql": f"INSERT INTO cameras (id, factory_id, camera_code, camera_name, status, created_at, updated_at) VALUES (3000+{i}, 'F001', 'CAM-{i:03d}', '摄像头{i}', 'ONLINE', NOW(), NOW());",
                "factoryId": "F001",
                "cleanup": f"DELETE FROM cameras WHERE id = {3000+i};"
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "dataNotNull": True
                },
                "dataVerification": {
                    "method": "STATUS_CHECK",
                    "expectedFields": ["status"],
                    "expectedStatus": "ONLINE"
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": "在线|正常|ONLINE"
            }
        }
        cases.append(case)

    # CAMERA_CONFIG cases (3)
    for i in range(5, 8):
        case = {
            "id": f"TC-P2-CAMERA-{i:03d}",
            "priority": "P2",
            "category": "CAMERA",
            "intentCode": "CAMERA_CONFIG",
            "testType": "OPERATION",
            "description": f"验证摄像头配置-场景{i-4}",
            "userInput": ["配置摄像头参数", "设置监控清晰度", "调整摄像头设置"][i-5],
            "expectedIntent": {
                "intentCode": "CAMERA_CONFIG",
                "confidence": [0.95, 0.9, 0.9][i-5],
                "matchMethod": "SEMANTIC",
                "questionType": "OPERATIONAL_COMMAND"
            },
            "testDataSetup": {
                "sql": f"INSERT INTO cameras (id, factory_id, camera_code, camera_name, status, created_at, updated_at) VALUES ({3000+i}, 'F001', 'CAM-{i:03d}', '摄像头{i}', 'ONLINE', NOW(), NOW());",
                "factoryId": "F001",
                "cleanup": f"DELETE FROM cameras WHERE id = {3000+i};"
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "operationSuccess": True
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": "配置成功|设置完成"
            }
        }
        cases.append(case)

    # CAMERA_LIST cases (2)
    for i in range(8, 10):
        case = {
            "id": f"TC-P2-CAMERA-{i:03d}",
            "priority": "P2",
            "category": "CAMERA",
            "intentCode": "CAMERA_LIST",
            "testType": "QUERY",
            "description": f"验证摄像头列表-场景{i-7}",
            "userInput": ["所有摄像头", "监控设备列表"][i-8],
            "expectedIntent": {
                "intentCode": "CAMERA_LIST",
                "confidence": [0.9, 0.9][i-8],
                "matchMethod": "SEMANTIC",
                "questionType": "INFORMATION_QUERY"
            },
            "testDataSetup": {
                "sql": f"INSERT INTO cameras (id, factory_id, camera_code, camera_name, status, created_at, updated_at) VALUES ({3000+i}, 'F001', 'CAM-{i:03d}', '摄像头{i}', 'ONLINE', NOW(), NOW()), ({3000+i+1}, 'F001', 'CAM-{i+1:03d}', '摄像头{i+1}', 'ONLINE', NOW(), NOW());",
                "factoryId": "F001",
                "cleanup": f"DELETE FROM cameras WHERE id IN ({3000+i}, {3000+i+1});"
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "dataNotNull": True
                },
                "dataVerification": {
                    "method": "LIST_COUNT",
                    "expectedMinCount": 2
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": "摄像头|2.*个"
            }
        }
        cases.append(case)

    return cases

def generate_p3_conversation_cases():
    """Generate 18 P3 CONVERSATION test cases (003-020)"""
    cases = []

    # Multi-turn conversation scenarios
    scenarios = [
        {"intent": "MATERIAL_BATCH_USE", "missing": "数量", "prompt1": "使用批次BATCH-001", "prompt2": "200公斤"},
        {"intent": "SHIPMENT_CREATE", "missing": "客户", "prompt1": "创建出货单", "prompt2": "客户是沃尔玛"},
        {"intent": "QUALITY_CHECK_EXECUTE", "missing": "批次", "prompt1": "执行质检", "prompt2": "批次PB-001"},
        {"intent": "PROCESSING_BATCH_CREATE", "missing": "产品", "prompt1": "创建生产批次", "prompt2": "产品是冷冻带鱼"},
        {"intent": "MATERIAL_BATCH_QUERY", "missing": "材料", "prompt1": "查询原料", "prompt2": "带鱼"},
        {"intent": "USER_CREATE", "missing": "角色", "prompt1": "创建用户zhangsan", "prompt2": "角色是操作员"},
        {"intent": "SHIPMENT_CREATE", "missing": "数量", "prompt1": "给客户C001发货", "prompt2": "数量500kg"},
        {"intent": "QUALITY_CHECK_EXECUTE", "missing": "样本数", "prompt1": "质检批次PB-002", "prompt2": "抽检100个"},
        {"intent": "MATERIAL_BATCH_USE", "missing": "批次", "prompt1": "使用带鱼原料", "prompt2": "批次BATCH-002"},
        {"intent": "PROCESSING_BATCH_CREATE", "missing": "数量", "prompt1": "生产冷冻虾仁", "prompt2": "计划1000kg"},
        {"intent": "USER_UPDATE", "missing": "用户名", "prompt1": "修改用户信息", "prompt2": "用户test_user"},
        {"intent": "CUSTOMER_CREATE", "missing": "联系人", "prompt1": "新建客户美团", "prompt2": "联系人李明"},
        {"intent": "SHIPMENT_CREATE", "missing": "多参数", "prompt1": "创建发货", "prompt2": "客户C002,产品带鱼,数量300kg"},
        {"intent": "QUALITY_CHECK_EXECUTE", "missing": "多参数", "prompt1": "质检", "prompt2": "批次PB-003,抽检50个,合格45个"},
        {"intent": "PROCESSING_BATCH_START", "missing": "批次", "prompt1": "开始生产", "prompt2": "批次PB-004"},
        {"intent": "MATERIAL_ADJUST_QUANTITY", "missing": "调整量", "prompt1": "调整库存BATCH-003", "prompt2": "增加50kg"},
        {"intent": "USER_DISABLE", "missing": "用户名", "prompt1": "禁用用户", "prompt2": "用户test_user_10"},
        {"intent": "CUSTOMER_SEARCH", "missing": "搜索条件", "prompt1": "查找客户", "prompt2": "名称包含超市"}
    ]

    for i, scenario in enumerate(scenarios, start=3):
        case = {
            "id": f"TC-P3-CONVERSATION-{i:03d}",
            "priority": "P3",
            "category": "CONVERSATION",
            "intentCode": scenario["intent"],
            "testType": "MULTI_TURN",
            "description": f"验证多轮对话-缺少{scenario['missing']}澄清",
            "conversationRounds": [
                {
                    "round": 1,
                    "userInput": scenario["prompt1"],
                    "expectedResponse": {
                        "status": "CONVERSATION_CONTINUE",
                        "sessionIdNotNull": True,
                        "messagePattern": f"请提供|{scenario['missing']}"
                    }
                },
                {
                    "round": 2,
                    "userInput": scenario["prompt2"],
                    "sessionIdRequired": True,
                    "expectedResponse": {
                        "status": "COMPLETED",
                        "intentCode": scenario["intent"],
                        "dataNotNull": True if "QUERY" in scenario["intent"] else None,
                        "operationSuccess": True if "CREATE" in scenario["intent"] or "UPDATE" in scenario["intent"] or "USE" in scenario["intent"] or "START" in scenario["intent"] or "ADJUST" in scenario["intent"] or "DISABLE" in scenario["intent"] else None
                    }
                }
            ],
            "testDataSetup": {
                "sql": "",
                "factoryId": "F001",
                "cleanup": ""
            },
            "validation": {
                "multiTurnValidation": {
                    "enabled": True,
                    "checkSessionContinuity": True,
                    "checkParameterExtraction": True
                },
                "semanticCheck": {
                    "enabled": True,
                    "llmPrompt": f"第一轮对话缺少{scenario['missing']},系统是否正确识别并要求补充?第二轮补充后是否成功执行?"
                }
            }
        }
        cases.append(case)

    return cases

def generate_p3_colloquial_cases():
    """Generate 23 P3 COLLOQUIAL test cases (003-025)"""
    cases = []

    # Colloquial expression scenarios
    scenarios = [
        {"intent": "MATERIAL_BATCH_QUERY", "variants": ["还有多少货", "库存够不够", "剩多少了", "仓库里还有啥", "存货情况"], "desc": "库存查询口语化"},
        {"intent": "MATERIAL_BATCH_QUERY", "variants": ["东西还有吗", "原料够用吗", "缺不缺货", "要不要补货"], "desc": "库存查询口语化-补充"},
        {"intent": "PROCESSING_BATCH_LIST", "variants": ["今天忙不忙", "生产怎么样", "做了多少", "产量如何", "生产情况"], "desc": "生产查询口语化"},
        {"intent": "PROCESSING_BATCH_LIST", "variants": ["车间在干啥", "生产线开工了吗", "今天做什么", "加工进度"], "desc": "生产查询口语化-补充"},
        {"intent": "QUALITY_CHECK_EXECUTE", "variants": ["这批行不行", "能用吗", "合格吗", "质量可以吗", "检测过了没"], "desc": "质检查询口语化"},
        {"intent": "QUALITY_CHECK_EXECUTE", "variants": ["这货咋样", "质量怎么样", "有没有问题", "能不能发货"], "desc": "质检查询口语化-补充"},
        {"intent": "EQUIPMENT_LIST", "variants": ["机器正常吗", "设备咋样", "有问题吗", "设备都好吗", "机械状态"], "desc": "设备查询口语化"},
        {"intent": "EQUIPMENT_LIST", "variants": ["机器能用吗", "设备运转正常不", "有没有故障"], "desc": "设备查询口语化-补充"},
        {"intent": "CLOCK_IN", "variants": ["我来了", "开工了", "到了", "上工", "报到"], "desc": "签到口语化"},
        {"intent": "CLOCK_IN", "variants": ["签个到", "打个卡", "登记一下"], "desc": "签到口语化-补充"},
        {"intent": "CLOCK_OUT", "variants": ["撤了", "收工", "下班了", "走了", "回家了"], "desc": "签退口语化"},
        {"intent": "CLOCK_OUT", "variants": ["今天干完了", "可以走了吗", "下工"], "desc": "签退口语化-补充"},
        {"intent": "SHIPMENT_QUERY", "variants": ["东西发出去了吗", "货走了没", "发货了吗", "出货情况", "物流怎么样"], "desc": "发货查询口语化"},
        {"intent": "SHIPMENT_QUERY", "variants": ["送出去了没", "客户收到了吗", "发走了吗"], "desc": "发货查询口语化-补充"},
        {"intent": "TRACE_BATCH", "variants": ["这是哪来的", "原料从哪来", "批次来源", "这批是什么做的"], "desc": "溯源查询口语化"},
        {"intent": "TRACE_BATCH", "variants": ["用的什么料", "材料信息", "这是啥原料"], "desc": "溯源查询口语化-补充"},
        {"intent": "REPORT_DASHBOARD_OVERVIEW", "variants": ["今天咋样", "情况如何", "最近怎么样", "给我看看数据"], "desc": "报表查询口语化"},
        {"intent": "REPORT_DASHBOARD_OVERVIEW", "variants": ["厂里什么情况", "今天忙不忙", "整体情况"], "desc": "报表查询口语化-补充"},
        {"intent": "ALERT_LIST", "variants": ["有啥问题吗", "出事了没", "有没有异常", "告警信息"], "desc": "告警查询口语化"},
        {"intent": "CUSTOMER_LIST", "variants": ["客户有哪些", "都有谁", "客户信息"], "desc": "客户查询口语化"},
        {"intent": "ATTENDANCE_TODAY", "variants": ["今天谁来了", "考勤情况", "出勤怎么样"], "desc": "考勤查询口语化"},
        {"intent": "MATERIAL_BATCH_USE", "variants": ["用一下", "拿点货", "领料"], "desc": "原料使用口语化"},
        {"intent": "PROCESSING_BATCH_CREATE", "variants": ["安排生产", "做一批", "开始加工"], "desc": "生产创建口语化"}
    ]

    for i, scenario in enumerate(scenarios, start=3):
        case = {
            "id": f"TC-P3-COLLOQUIAL-{i:03d}",
            "priority": "P3",
            "category": "COLLOQUIAL",
            "intentCode": scenario["intent"],
            "testType": "COLLOQUIAL_VARIANTS",
            "description": scenario["desc"],
            "inputVariants": scenario["variants"],
            "allShouldRecognizeAs": scenario["intent"],
            "expectedIntent": {
                "intentCode": scenario["intent"],
                "confidence": 0.75,
                "matchMethod": "COLLOQUIAL",
                "questionType": "INFORMATION_QUERY" if "QUERY" in scenario["intent"] or "LIST" in scenario["intent"] else "OPERATIONAL_COMMAND"
            },
            "testDataSetup": {
                "sql": "",
                "factoryId": "F001",
                "cleanup": ""
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED",
                    "intentRecognized": True,
                    "dataNotNull": True if "QUERY" in scenario["intent"] or "LIST" in scenario["intent"] else None
                },
                "variantValidation": {
                    "enabled": True,
                    "allVariantsShouldRecognize": True,
                    "expectedIntentCode": scenario["intent"]
                },
                "semanticCheck": {
                    "enabled": True,
                    "llmPrompt": f"用户使用多种口语化表达,系统是否都正确识别为{scenario['intent']}意图?"
                }
            },
            "expectedResponse": {
                "status": "COMPLETED",
                "messagePattern": ".*"
            }
        }
        cases.append(case)

    return cases

def generate_p3_boundary_cases():
    """Generate 19 P3 BOUNDARY test cases (002-020)"""
    cases = []

    # Boundary test scenarios
    scenarios = [
        {"desc": "空输入", "input": "", "expected": "ERROR", "pattern": "输入不能为空"},
        {"desc": "纯空格输入", "input": "   ", "expected": "ERROR", "pattern": "输入不能为空"},
        {"desc": "超长输入-500字符", "input": "查询" + "这是一个非常长的输入"*30, "expected": "ERROR", "pattern": "输入过长"},
        {"desc": "超长输入-1000字符", "input": "帮我" + "查询库存信息"*100, "expected": "ERROR", "pattern": "输入过长"},
        {"desc": "超长输入-带有效内容", "input": "查询库存" + "请帮我查一下"*50, "expected": "COMPLETED", "pattern": "库存"},
        {"desc": "特殊字符-符号", "input": "查询@#$%库存", "expected": "COMPLETED", "pattern": "库存"},
        {"desc": "特殊字符-表情", "input": "查询库存😊👍", "expected": "COMPLETED", "pattern": "库存"},
        {"desc": "特殊字符-混合", "input": "库存!!!???", "expected": "COMPLETED", "pattern": "库存"},
        {"desc": "纯数字输入", "input": "12345", "expected": "ERROR", "pattern": "无法识别"},
        {"desc": "纯数字-日期格式", "input": "20260116", "expected": "ERROR", "pattern": "无法识别"},
        {"desc": "纯英文-单词", "input": "query inventory", "expected": "COMPLETED", "pattern": "inventory"},
        {"desc": "纯英文-句子", "input": "show me the production status", "expected": "COMPLETED", "pattern": "production"},
        {"desc": "混合语言-中英", "input": "query库存信息", "expected": "COMPLETED", "pattern": "库存"},
        {"desc": "混合语言-中英数", "input": "查询batch001的信息", "expected": "COMPLETED", "pattern": "batch"},
        {"desc": "SQL注入-基础", "input": "查询'; DROP TABLE users;--", "expected": "ERROR", "pattern": "非法字符|输入异常"},
        {"desc": "SQL注入-OR条件", "input": "库存 OR 1=1", "expected": "COMPLETED", "pattern": "库存"},
        {"desc": "XSS攻击-script标签", "input": "查询<script>alert('xss')</script>库存", "expected": "ERROR", "pattern": "非法字符|输入异常"},
        {"desc": "XSS攻击-img标签", "input": "<img src=x onerror=alert(1)>库存", "expected": "ERROR", "pattern": "非法字符"},
        {"desc": "XSS攻击-转义字符", "input": "库存&lt;script&gt;", "expected": "COMPLETED", "pattern": "库存"}
    ]

    for i, scenario in enumerate(scenarios, start=2):
        case = {
            "id": f"TC-P3-BOUNDARY-{i:03d}",
            "priority": "P3",
            "category": "BOUNDARY",
            "intentCode": "UNKNOWN" if scenario["expected"] == "ERROR" else "MATERIAL_BATCH_QUERY",
            "testType": "BOUNDARY",
            "description": f"验证边界场景-{scenario['desc']}",
            "userInput": scenario["input"],
            "expectedIntent": {
                "intentCode": "UNKNOWN" if scenario["expected"] == "ERROR" else "MATERIAL_BATCH_QUERY",
                "confidence": 0.0 if scenario["expected"] == "ERROR" else 0.8,
                "matchMethod": "NONE" if scenario["expected"] == "ERROR" else "SEMANTIC",
                "questionType": "INVALID" if scenario["expected"] == "ERROR" else "INFORMATION_QUERY"
            },
            "testDataSetup": {
                "sql": "",
                "factoryId": "F001",
                "cleanup": ""
            },
            "validation": {
                "responseAssertion": {
                    "status": scenario["expected"],
                    "intentRecognized": False if scenario["expected"] == "ERROR" else True,
                    "messageNotNull": True
                },
                "semanticCheck": {
                    "enabled": True,
                    "llmPrompt": f"边界输入场景:{scenario['desc']},系统是否正确处理并给出友好提示?"
                }
            },
            "expectedResponse": {
                "status": scenario["expected"],
                "messagePattern": scenario["pattern"]
            }
        }
        cases.append(case)

    return cases

def generate_p3_exception_cases():
    """Generate 9 P3 EXCEPTION test cases (001-009)"""
    cases = []

    # Exception scenarios
    scenarios = [
        {"desc": "LLM Fallback触发-复杂查询", "input": "帮我统计一下上个月所有带鱼批次的平均合格率并与去年同期对比", "intent": "REPORT_PRODUCTION", "confidence": 0.5},
        {"desc": "LLM Fallback触发-多意图混合", "input": "查询库存然后创建出货单再质检", "intent": "MATERIAL_BATCH_QUERY", "confidence": 0.6},
        {"desc": "LLM Fallback触发-模糊指代", "input": "把那个批次的数据更新一下", "intent": "PROCESSING_BATCH_UPDATE", "confidence": 0.55},
        {"desc": "低置信度-相似意图", "input": "库存报告", "intent": "REPORT_INVENTORY", "confidence": 0.65},
        {"desc": "低置信度-缺少关键词", "input": "看一下", "intent": "UNKNOWN", "confidence": 0.3},
        {"desc": "低置信度-歧义表达", "input": "批次情况", "intent": "PROCESSING_BATCH_LIST", "confidence": 0.6},
        {"desc": "意图模糊-多个可能", "input": "查询信息", "intent": "UNKNOWN", "confidence": 0.4},
        {"desc": "意图模糊-业务外", "input": "今天天气怎么样", "intent": "UNKNOWN", "confidence": 0.1},
        {"desc": "不支持的操作", "input": "删除所有数据", "intent": "UNKNOWN", "confidence": 0.2}
    ]

    for i, scenario in enumerate(scenarios, start=1):
        case = {
            "id": f"TC-P3-EXCEPTION-{i:03d}",
            "priority": "P3",
            "category": "EXCEPTION",
            "intentCode": scenario["intent"],
            "testType": "EXCEPTION",
            "description": scenario["desc"],
            "userInput": scenario["input"],
            "expectedIntent": {
                "intentCode": scenario["intent"],
                "confidence": scenario["confidence"],
                "matchMethod": "LLM_FALLBACK" if "Fallback" in scenario["desc"] else "SEMANTIC",
                "questionType": "INFORMATION_QUERY"
            },
            "testDataSetup": {
                "sql": "",
                "factoryId": "F001",
                "cleanup": ""
            },
            "validation": {
                "responseAssertion": {
                    "status": "COMPLETED" if scenario["confidence"] >= 0.5 else "ERROR",
                    "intentRecognized": scenario["confidence"] >= 0.5,
                    "messageNotNull": True
                },
                "semanticCheck": {
                    "enabled": True,
                    "llmPrompt": f"异常场景:{scenario['desc']},系统是否给出了合理的响应或错误提示?"
                }
            },
            "expectedResponse": {
                "status": "COMPLETED" if scenario["confidence"] >= 0.5 else "ERROR",
                "messagePattern": ".*"
            }
        }
        cases.append(case)

    return cases

def main():
    """Generate all remaining cases and merge with existing file"""
    import os

    # Read existing file
    file_path = 'test-cases-p2p3-complete-165.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Existing test cases: {len(data['testCases'])}")

    # Generate new cases
    config_cases = generate_config_cases()
    camera_cases = generate_camera_cases()
    conversation_cases = generate_p3_conversation_cases()
    colloquial_cases = generate_p3_colloquial_cases()
    boundary_cases = generate_p3_boundary_cases()
    exception_cases = generate_p3_exception_cases()

    # Add all new cases
    data['testCases'].extend(config_cases)
    data['testCases'].extend(camera_cases)
    data['testCases'].extend(conversation_cases)
    data['testCases'].extend(colloquial_cases)
    data['testCases'].extend(boundary_cases)
    data['testCases'].extend(exception_cases)

    # Update totalCases
    data['totalCases'] = len(data['testCases'])

    print(f"New CONFIG cases: {len(config_cases)}")
    print(f"New CAMERA cases: {len(camera_cases)}")
    print(f"New CONVERSATION cases: {len(conversation_cases)}")
    print(f"New COLLOQUIAL cases: {len(colloquial_cases)}")
    print(f"New BOUNDARY cases: {len(boundary_cases)}")
    print(f"New EXCEPTION cases: {len(exception_cases)}")
    print(f"Total test cases: {data['totalCases']}")

    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Successfully generated {data['totalCases']} test cases!")
    print(f"📁 File saved to: {os.path.abspath(file_path)}")

    # Print distribution
    print("\n📊 Test Case Distribution:")
    print(f"  P2 CLOCK: 28 cases")
    print(f"  P2 USER: 24 cases")
    print(f"  P2 CRM: 20 cases")
    print(f"  P2 CONFIG: {len(config_cases)} cases")
    print(f"  P2 CAMERA: {len(camera_cases)} cases")
    print(f"  P3 CONVERSATION: {len(conversation_cases)} cases")
    print(f"  P3 COLLOQUIAL: {len(colloquial_cases)} cases")
    print(f"  P3 BOUNDARY: {len(boundary_cases)} cases")
    print(f"  P3 EXCEPTION: {len(exception_cases)} cases")

if __name__ == '__main__':
    main()
