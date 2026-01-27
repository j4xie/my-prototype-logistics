#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simplified 500 Test Runner with immediate output
"""
import sys
import requests
import json
import time
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

BASE_URL = "http://139.196.165.140:10010"
RECOGNIZE_URL = f"{BASE_URL}/api/public/ai-demo/recognize"

# Test categories with cases
TEST_CASES = [
    # ===== Simple Queries (100) =====
    ("simple", "查看今天的订单"),
    ("simple", "显示所有产品"),
    ("simple", "查询库存"),
    ("simple", "今日生产报表"),
    ("simple", "查看员工列表"),
    ("simple", "显示设备状态"),
    ("simple", "查询批次信息"),
    ("simple", "查看质检记录"),
    ("simple", "显示仓库列表"),
    ("simple", "查询供应商"),
    ("simple", "今天有多少订单"),
    ("simple", "产品有哪些"),
    ("simple", "库存情况如何"),
    ("simple", "生产进度怎样"),
    ("simple", "设备运行正常吗"),
    ("simple", "查一下订单123"),
    ("simple", "找产品PT001"),
    ("simple", "批次B001的信息"),
    ("simple", "员工张三的资料"),
    ("simple", "仓库A的库存"),
    ("simple", "show orders"),
    ("simple", "list products"),
    ("simple", "inventory status"),
    ("simple", "production report"),
    ("simple", "employee list"),
    ("simple", "订单呢"),
    ("simple", "产品看看"),
    ("simple", "库存多少"),
    ("simple", "报表给我"),
    ("simple", "员工名单"),
    ("simple", "昨天的订单"),
    ("simple", "上周生产量"),
    ("simple", "本月库存变化"),
    ("simple", "今年销售额"),
    ("simple", "过去7天的质检"),
    ("simple", "前10个订单"),
    ("simple", "最新5个产品"),
    ("simple", "库存最低的10个"),
    ("simple", "销量前20"),
    ("simple", "最近3个批次"),
    ("simple", "查看订单"),
    ("simple", "显示库存"),
    ("simple", "查询员工"),
    ("simple", "产品列表"),
    ("simple", "设备情况"),
    ("simple", "获取订单"),
    ("simple", "找员工"),
    ("simple", "订单有哪些"),
    ("simple", "库存是什么"),
    ("simple", "看看产品"),
    ("simple", "查看客户"),
    ("simple", "显示物料"),
    ("simple", "查询设备"),
    ("simple", "批次列表"),
    ("simple", "仓库情况"),
    ("simple", "获取产品"),
    ("simple", "找批次"),
    ("simple", "客户有哪些"),
    ("simple", "物料是什么"),
    ("simple", "看看设备"),
    ("simple", "本周订单"),
    ("simple", "上月产量"),
    ("simple", "季度销售"),
    ("simple", "年度报表"),
    ("simple", "当天库存"),
    ("simple", "历史订单"),
    ("simple", "全部产品"),
    ("simple", "所有员工"),
    ("simple", "待处理订单"),
    ("simple", "已完成任务"),
    ("simple", "查订单状态"),
    ("simple", "看产品价格"),
    ("simple", "查库存数量"),
    ("simple", "看员工绩效"),
    ("simple", "查设备效率"),
    ("simple", "订单详情"),
    ("simple", "产品规格"),
    ("simple", "库存明细"),
    ("simple", "员工信息"),
    ("simple", "设备参数"),
    ("simple", "客户订单"),
    ("simple", "供应商产品"),
    ("simple", "仓库库存"),
    ("simple", "部门员工"),
    ("simple", "车间设备"),
    ("simple", "VIP客户"),
    ("simple", "主要供应商"),
    ("simple", "核心产品"),
    ("simple", "关键设备"),
    ("simple", "骨干员工"),
    ("simple", "紧急订单"),
    ("simple", "低库存产品"),
    ("simple", "高销量商品"),
    ("simple", "新入职员工"),
    ("simple", "维修中设备"),
    ("simple", "查看报价单"),
    ("simple", "显示合同"),
    ("simple", "查询发票"),
    ("simple", "查看账单"),
    ("simple", "显示收款"),

    # ===== Complex Queries (80) =====
    ("complex", "查询本月销售额超过10000的订单并按金额排序"),
    ("complex", "显示库存低于安全线且需要补货的产品"),
    ("complex", "找出过去一周质检不合格的批次及其原因"),
    ("complex", "统计各仓库的库存总值并生成报表"),
    ("complex", "对比上月和本月的生产效率"),
    ("complex", "查询员工张三负责的所有订单及完成率"),
    ("complex", "显示设备A的维护记录和下次保养时间"),
    ("complex", "分析客户购买行为并推荐相似产品"),
    ("complex", "计算批次B001的成本构成"),
    ("complex", "预测下月库存需求"),
    ("complex", "查询所有状态为待处理且创建时间超过3天的订单"),
    ("complex", "找出本季度销量增长超过20%的产品"),
    ("complex", "显示各部门的人员配置和绩效对比"),
    ("complex", "分析设备故障率与维护周期的关系"),
    ("complex", "统计各供应商的交付准时率"),
    ("complex", "显示过去12个月的销售趋势图"),
    ("complex", "对比2024和2025年同期产量"),
    ("complex", "分析库存周转率的季度变化"),
    ("complex", "查看设备利用率的月度报告"),
    ("complex", "统计客户投诉的趋势和分类"),
    ("complex", "查询订单O001关联的所有批次和物料"),
    ("complex", "显示产品P001的完整供应链信息"),
    ("complex", "找出与客户C001有关的所有交易记录"),
    ("complex", "查看员工E001参与的所有生产任务"),
    ("complex", "显示仓库W001的入库出库明细"),
    ("complex", "分析本季度的利润率变化趋势"),
    ("complex", "查询逾期未付款的客户及欠款金额"),
    ("complex", "统计各产品线的毛利率对比"),
    ("complex", "显示采购成本的月度变化"),
    ("complex", "分析订单取消率的原因分布"),
    ("complex", "按区域统计销售业绩排名"),
    ("complex", "查询需要续签的合同清单"),
    ("complex", "分析客户流失率及主要原因"),
    ("complex", "统计各渠道的订单转化率"),
    ("complex", "显示产品退货率的品类分布"),
    ("complex", "查询本周需要跟进的销售线索"),
    ("complex", "分析员工加班时长与产出关系"),
    ("complex", "统计各仓库的空间利用率"),
    ("complex", "显示物流成本的构成分析"),
    ("complex", "查询即将过期的产品批次"),
    ("complex", "按客户等级统计订单金额分布"),
    ("complex", "分析促销活动的ROI效果"),
    ("complex", "统计供应商的质量评分排名"),
    ("complex", "显示生产排程的完成情况"),
    ("complex", "查询设备能耗的趋势分析"),
    ("complex", "本月销售额前10的产品及增长率"),
    ("complex", "各地区客户数量和订单量对比"),
    ("complex", "员工绩效排名及完成目标情况"),
    ("complex", "设备维护成本与故障次数关系"),
    ("complex", "供应商价格变动趋势分析"),
    ("complex", "查询符合条件的订单并导出"),
    ("complex", "统计多个维度的销售数据"),
    ("complex", "分析跨部门的协作效率"),
    ("complex", "对比不同时期的关键指标"),
    ("complex", "生成综合经营分析报告"),
    ("complex", "计算产品的完全成本"),
    ("complex", "预测销售趋势并给出建议"),
    ("complex", "分析客户生命周期价值"),
    ("complex", "评估供应商综合绩效"),
    ("complex", "优化库存配置方案"),
    ("complex", "按时间段对比产能利用率"),
    ("complex", "分析订单履约时效分布"),
    ("complex", "统计质量问题的根因分类"),
    ("complex", "评估新产品上市表现"),
    ("complex", "分析季节性销售波动"),
    ("complex", "查询需要预警的业务指标"),
    ("complex", "统计人效比的部门对比"),
    ("complex", "分析采购周期的优化空间"),
    ("complex", "评估渠道盈利能力"),
    ("complex", "预测库存补货时间点"),
    ("complex", "计算客户获取成本"),
    ("complex", "分析产品组合的贡献度"),
    ("complex", "评估设备投资回报率"),
    ("complex", "统计各环节的损耗率"),
    ("complex", "分析客户满意度影响因素"),
    ("complex", "查询需要审批的事项清单"),
    ("complex", "统计项目进度与预算执行"),
    ("complex", "分析市场份额变化趋势"),
    ("complex", "评估风险敞口及应对建议"),
    ("complex", "生成月度经营分析仪表盘"),

    # ===== High-Risk Operations - Phase 1 (60) =====
    ("high_risk", "删除订单O001"),
    ("high_risk", "取消所有待处理订单"),
    ("high_risk", "清空库存数据"),
    ("high_risk", "删除员工E001的记录"),
    ("high_risk", "移除产品P001"),
    ("high_risk", "废弃批次B001"),
    ("high_risk", "删除所有过期数据"),
    ("high_risk", "重置系统设置"),
    ("high_risk", "清除质检记录"),
    ("high_risk", "删除供应商S001"),
    ("high_risk", "修改所有订单状态为已完成"),
    ("high_risk", "更新所有产品价格"),
    ("high_risk", "批量调整库存数量"),
    ("high_risk", "修改员工权限"),
    ("high_risk", "更改系统配置"),
    ("high_risk", "永久删除客户C001的所有数据"),
    ("high_risk", "归档并删除2023年的订单"),
    ("high_risk", "合并重复的产品记录"),
    ("high_risk", "迁移仓库数据到新系统"),
    ("high_risk", "回滚到上一个版本"),
    ("high_risk", "调整订单O001的金额为0"),
    ("high_risk", "取消客户C001的所有欠款"),
    ("high_risk", "修改财务报表数据"),
    ("high_risk", "删除付款记录"),
    ("high_risk", "重新计算所有订单成本"),
    ("high_risk", "删除订单"),
    ("high_risk", "移除产品"),
    ("high_risk", "清除库存"),
    ("high_risk", "删除员工"),
    ("high_risk", "废弃批次"),
    ("high_risk", "清空记录"),
    ("high_risk", "删除数据"),
    ("high_risk", "移除配置"),
    ("high_risk", "清除日志"),
    ("high_risk", "删除备份"),
    ("high_risk", "批量删除"),
    ("high_risk", "全部删除"),
    ("high_risk", "强制删除"),
    ("high_risk", "彻底删除"),
    ("high_risk", "永久删除"),
    ("high_risk", "修改订单金额"),
    ("high_risk", "更改产品价格"),
    ("high_risk", "调整库存数据"),
    ("high_risk", "变更员工信息"),
    ("high_risk", "更新批次状态"),
    ("high_risk", "批量修改"),
    ("high_risk", "全部更新"),
    ("high_risk", "强制修改"),
    ("high_risk", "覆盖数据"),
    ("high_risk", "重置密码"),
    ("high_risk", "取消订单O123"),
    ("high_risk", "作废发票"),
    ("high_risk", "撤销审批"),
    ("high_risk", "终止合同"),
    ("high_risk", "注销账户"),
    ("high_risk", "停用产品"),
    ("high_risk", "冻结账户"),
    ("high_risk", "解除绑定"),
    ("high_risk", "清理缓存"),
    ("high_risk", "重建索引"),

    # ===== Ambiguous Inputs - Phase 3 (70) =====
    ("ambiguous", "查一下"),
    ("ambiguous", "删除"),
    ("ambiguous", "修改那个"),
    ("ambiguous", "看看数据"),
    ("ambiguous", "处理一下"),
    ("ambiguous", "那个订单"),
    ("ambiguous", "上次说的"),
    ("ambiguous", "帮我弄一下"),
    ("ambiguous", "这个不对"),
    ("ambiguous", "改成正确的"),
    ("ambiguous", "查看它的详情"),
    ("ambiguous", "把它删掉"),
    ("ambiguous", "修改这个"),
    ("ambiguous", "那个怎么样了"),
    ("ambiguous", "他负责的订单"),
    ("ambiguous", "订单..."),
    ("ambiguous", "查询那个姓张的"),
    ("ambiguous", "上周的那批货"),
    ("ambiguous", "价格比较高的"),
    ("ambiguous", "最近的那个"),
    ("ambiguous", "看看订单和产品"),
    ("ambiguous", "删除或者取消"),
    ("ambiguous", "今天或明天的"),
    ("ambiguous", "张三或李四的"),
    ("ambiguous", "A仓库或B仓库"),
    ("ambiguous", "查询订单状态"),
    ("ambiguous", "修改产品价格"),
    ("ambiguous", "调整库存数量"),
    ("ambiguous", "分配任务给员工"),
    ("ambiguous", "设置提醒"),
    ("ambiguous", "删除但保留记录"),
    ("ambiguous", "增加并减少库存"),
    ("ambiguous", "完成未完成的"),
    ("ambiguous", "查询不存在的"),
    ("ambiguous", "修改只读数据"),
    ("ambiguous", "那个"),
    ("ambiguous", "这个"),
    ("ambiguous", "它"),
    ("ambiguous", "他们"),
    ("ambiguous", "之前的"),
    ("ambiguous", "后面的"),
    ("ambiguous", "其他的"),
    ("ambiguous", "查一下吧"),
    ("ambiguous", "看看呢"),
    ("ambiguous", "怎么样"),
    ("ambiguous", "如何"),
    ("ambiguous", "咋办"),
    ("ambiguous", "弄一下"),
    ("ambiguous", "这个的数据"),
    ("ambiguous", "那个的情况"),
    ("ambiguous", "刚才说的"),
    ("ambiguous", "前面提到的"),
    ("ambiguous", "另一个"),
    ("ambiguous", "同样的"),
    ("ambiguous", "类似的"),
    ("ambiguous", "差不多的"),
    ("ambiguous", "好像是"),
    ("ambiguous", "大概是"),
    ("ambiguous", "可能是"),
    ("ambiguous", "应该是"),
    ("ambiguous", "或许"),
    ("ambiguous", "也许"),
    ("ambiguous", "估计"),
    ("ambiguous", "貌似"),
    ("ambiguous", "有点"),
    ("ambiguous", "稍微"),
    ("ambiguous", "一些"),
    ("ambiguous", "几个"),
    ("ambiguous", "部分"),
    ("ambiguous", "某些"),

    # ===== Multi-Intent (50) =====
    ("multi", "查看订单并导出报表"),
    ("multi", "先查库存再下订单"),
    ("multi", "删除旧数据并备份"),
    ("multi", "统计销售额和利润"),
    ("multi", "查看员工考勤和绩效"),
    ("multi", "更新库存并通知仓管"),
    ("multi", "查询订单状态和物流信息"),
    ("multi", "生成报表并发送邮件"),
    ("multi", "检查设备状态并安排维护"),
    ("multi", "审核订单并安排发货"),
    ("multi", "查询本月订单、统计销售额、生成报表"),
    ("multi", "检查库存、补货、更新供应商信息"),
    ("multi", "创建账号、分配权限、发送邮件"),
    ("multi", "核对账目、生成报表、归档数据"),
    ("multi", "记录问题、通知相关人、安排复检"),
    ("multi", "查看订单和修改"),
    ("multi", "查询产品并导出"),
    ("multi", "统计库存和分析"),
    ("multi", "检查员工并更新"),
    ("multi", "查看设备和维护"),
    ("multi", "查看并修改订单"),
    ("multi", "查询并导出产品"),
    ("multi", "统计并分析库存"),
    ("multi", "检查并更新员工"),
    ("multi", "查看并维护设备"),
    ("multi", "先查询后删除"),
    ("multi", "先统计后导出"),
    ("multi", "先检查后修改"),
    ("multi", "先分析后建议"),
    ("multi", "先备份后更新"),
    ("multi", "查询并排序"),
    ("multi", "统计并对比"),
    ("multi", "检查并报警"),
    ("multi", "分析并预测"),
    ("multi", "汇总并报告"),
    ("multi", "订单和库存"),
    ("multi", "产品和价格"),
    ("multi", "员工和绩效"),
    ("multi", "设备和维护"),
    ("multi", "客户和订单"),
    ("multi", "查销售统计利润"),
    ("multi", "看订单导报表"),
    ("multi", "查库存补货"),
    ("multi", "查员工发通知"),
    ("multi", "检设备排维护"),
    ("multi", "处理订单并更新库存"),
    ("multi", "审批申请并通知申请人"),
    ("multi", "核对数据并修正错误"),
    ("multi", "汇总报表并发送领导"),
    ("multi", "分析问题并给出建议"),

    # ===== Context-Dependent (40) =====
    ("context", "上面那个订单的详情"),
    ("context", "刚才查的那批货"),
    ("context", "同样的查询条件"),
    ("context", "和之前一样"),
    ("context", "继续刚才的操作"),
    ("context", "撤销上一步"),
    ("context", "再查一次"),
    ("context", "换一个条件"),
    ("context", "看看别的"),
    ("context", "这个不行,换那个"),
    ("context", "基于这个结果筛选"),
    ("context", "在这些里面找"),
    ("context", "排除掉已选的"),
    ("context", "只保留符合条件的"),
    ("context", "把这些合并"),
    ("context", "然后呢"),
    ("context", "还有吗"),
    ("context", "就这样"),
    ("context", "不对,是另一个"),
    ("context", "我是说那个"),
    ("context", "刚才的订单"),
    ("context", "上次的产品"),
    ("context", "之前的数据"),
    ("context", "那个的结果"),
    ("context", "这个的操作"),
    ("context", "同样的订单"),
    ("context", "一样的产品"),
    ("context", "继续的数据"),
    ("context", "下一个结果"),
    ("context", "上一个操作"),
    ("context", "再来一次"),
    ("context", "重复刚才"),
    ("context", "返回上页"),
    ("context", "下一页"),
    ("context", "更多结果"),
    ("context", "展开详情"),
    ("context", "收起列表"),
    ("context", "刷新数据"),
    ("context", "重新加载"),
    ("context", "恢复默认"),

    # ===== Low Confidence / Edge Cases - Phase 4 (50) =====
    ("edge", "xjklsdf"),
    ("edge", "123456"),
    ("edge", "???"),
    ("edge", " "),
    ("edge", "a"),
    ("edge", "查询查询查询"),
    ("edge", "你好你好你好"),
    ("edge", "asdfghjkl"),
    ("edge", "test test test"),
    ("edge", "订单订单订单订单订单"),
    ("edge", "查询order的status"),
    ("edge", "delete订单"),
    ("edge", "show我的orders"),
    ("edge", "【订单查询】"),
    ("edge", "=====订单====="),
    ("edge", ">>>查询<<<"),
    ("edge", "@订单#查询$"),
    ("edge", "订.单.查.询"),
    ("edge", "播放音乐"),
    ("edge", "打开相机"),
    ("edge", "发送微信"),
    ("edge", "导航到北京"),
    ("edge", "设置闹钟"),
    ("edge", "SELECT * FROM orders"),
    ("edge", "{\"action\": \"query\"}"),
    ("edge", "<order>query</order>"),
    ("edge", "curl -X GET /orders"),
    ("edge", "orders.find({})"),
    ("edge", "qwertyuiop"),
    ("edge", "!@#$%^&*()"),
    ("edge", "😀😂🤣"),
    ("edge", "          "),
    ("edge", "null"),
    ("edge", "undefined"),
    ("edge", "NaN"),
    ("edge", "true"),
    ("edge", "false"),
    ("edge", "[]"),
    ("edge", "{}"),
    ("edge", "0"),
    ("edge", "-1"),
    ("edge", "9999999999"),
    ("edge", "1.23456789"),
    ("edge", "a" * 100),
    ("edge", "查" * 50),
    ("edge", "\n\n\n"),
    ("edge", "\t\t\t"),
    ("edge", "订单\0查询"),
    ("edge", "<script>alert(1)</script>"),
    ("edge", "'; DROP TABLE orders; --"),

    # ===== Domain-Specific (30) =====
    ("domain", "查询溯源码"),
    ("domain", "扫描批次二维码"),
    ("domain", "追溯产品来源"),
    ("domain", "查看供应链信息"),
    ("domain", "冷链温度监控"),
    ("domain", "HACCP记录查询"),
    ("domain", "GMP合规检查"),
    ("domain", "批次召回"),
    ("domain", "原料批次追踪"),
    ("domain", "成品检验报告"),
    ("domain", "查看BOM清单"),
    ("domain", "MRP计算"),
    ("domain", "WMS库位查询"),
    ("domain", "ERP数据同步"),
    ("domain", "IoT设备状态"),
    ("domain", "保质期预警"),
    ("domain", "配方查询"),
    ("domain", "营养成分分析"),
    ("domain", "过敏原标识"),
    ("domain", "有机认证查询"),
    ("domain", "溯源码验证"),
    ("domain", "追溯链查询"),
    ("domain", "质检报告"),
    ("domain", "检疫证明"),
    ("domain", "合格证打印"),
    ("domain", "产地证明"),
    ("domain", "生产许可证"),
    ("domain", "食品标签"),
    ("domain", "批号管理"),
    ("domain", "效期管理"),

    # ===== Typos and Noise (20) =====
    ("typo", "查旬订单"),
    ("typo", "库存查徇"),
    ("typo", "生产报彪"),
    ("typo", "员工名蛋"),
    ("typo", "设被状态"),
    ("typo", "产品查xun"),
    ("typo", "订单chaxun"),
    ("typo", "库cun查询"),
    ("typo", "shengchan报表"),
    ("typo", "yuangong列表"),
    ("typo", "查询定单"),
    ("typo", "苦存数量"),
    ("typo", "产品价个"),
    ("typo", "圆工信息"),
    ("typo", "涉备维护"),
    ("typo", "查询，订单"),
    ("typo", "库存。。。"),
    ("typo", "产品！！"),
    ("typo", "员工???"),
    ("typo", "设备..."),
]

def run_tests():
    print("=" * 60)
    print("AI Intent Recognition - 500 Test Cases")
    print("=" * 60)
    print(f"Start: {datetime.now()}")
    print(f"Total cases: {len(TEST_CASES)}")
    print()

    results = {
        "total": len(TEST_CASES),
        "success": 0,
        "failed": 0,
        "by_category": {},
        "confidence_dist": {"high": 0, "medium": 0, "low": 0, "none": 0},
        "match_methods": {},
        "latencies": [],
        "errors": []
    }

    session_id = f"test-{datetime.now().strftime('%H%M%S')}"

    for i, (category, text) in enumerate(TEST_CASES):
        # Skip empty
        if not text or not text.strip():
            results["failed"] += 1
            continue

        start = time.time()
        try:
            resp = requests.post(
                RECOGNIZE_URL,
                json={"userInput": text, "sessionId": session_id},
                timeout=30
            )
            latency = int((time.time() - start) * 1000)
            results["latencies"].append(latency)

            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == 200:
                    results["success"] += 1

                    # Track category
                    if category not in results["by_category"]:
                        results["by_category"][category] = {"success": 0, "fail": 0, "latencies": []}
                    results["by_category"][category]["success"] += 1
                    results["by_category"][category]["latencies"].append(latency)

                    # Track confidence
                    conf = data.get("data", {}).get("confidence")
                    if conf is None:
                        results["confidence_dist"]["none"] += 1
                    elif conf > 0.8:
                        results["confidence_dist"]["high"] += 1
                    elif conf > 0.5:
                        results["confidence_dist"]["medium"] += 1
                    else:
                        results["confidence_dist"]["low"] += 1

                    # Track match method
                    method = data.get("data", {}).get("matchMethod", "unknown")
                    results["match_methods"][method] = results["match_methods"].get(method, 0) + 1
                else:
                    results["failed"] += 1
                    if category not in results["by_category"]:
                        results["by_category"][category] = {"success": 0, "fail": 0, "latencies": []}
                    results["by_category"][category]["fail"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(f"HTTP {resp.status_code}: {text[:30]}")

        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"Error: {str(e)[:50]}")

        # Progress
        if (i + 1) % 50 == 0:
            rate = results["success"] / (i + 1) * 100
            print(f"Progress: {i+1}/{len(TEST_CASES)} | Success: {rate:.1f}%")

        # Small delay
        if (i + 1) % 10 == 0:
            time.sleep(0.3)

    # Final report
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Total: {results['total']}")
    print(f"Success: {results['success']} ({results['success']/results['total']*100:.1f}%)")
    print(f"Failed: {results['failed']}")
    print()

    print("By Category:")
    for cat, stats in results["by_category"].items():
        total = stats["success"] + stats["fail"]
        rate = stats["success"] / total * 100 if total > 0 else 0
        avg_lat = sum(stats["latencies"]) / len(stats["latencies"]) if stats["latencies"] else 0
        print(f"  {cat}: {stats['success']}/{total} ({rate:.1f}%) | avg: {avg_lat:.0f}ms")
    print()

    print("Confidence Distribution:")
    for level, count in results["confidence_dist"].items():
        print(f"  {level}: {count} ({count/results['total']*100:.1f}%)")
    print()

    print("Match Methods:")
    for method, count in results["match_methods"].items():
        print(f"  {method}: {count} ({count/results['total']*100:.1f}%)")
    print()

    if results["latencies"]:
        print("Latency:")
        print(f"  Min: {min(results['latencies'])}ms")
        print(f"  Max: {max(results['latencies'])}ms")
        print(f"  Avg: {sum(results['latencies'])/len(results['latencies']):.0f}ms")
        sorted_lat = sorted(results['latencies'])
        print(f"  P95: {sorted_lat[int(len(sorted_lat)*0.95)]}ms")
    print()

    if results["errors"][:10]:
        print("Sample Errors:")
        for err in results["errors"][:10]:
            print(f"  - {err}")
    print()

    print(f"End: {datetime.now()}")

    # Save report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report = {
        "timestamp": timestamp,
        "results": results
    }
    with open(f"tests/ai-intent/reports/test_500_report_{timestamp}.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: tests/ai-intent/reports/test_500_report_{timestamp}.json")

if __name__ == "__main__":
    run_tests()
