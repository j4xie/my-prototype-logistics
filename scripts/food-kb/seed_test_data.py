#!/usr/bin/env python3
"""
食品知识库种子数据入库脚本
Seed the food knowledge base with core food safety documents.

Ingests 20 knowledge documents covering:
- 5 GB standards (GB 2760 additives, GB 14881 hygiene, GB 4789 microbiology, etc.)
- 5 HACCP/process parameters (sterilization, CCP, pasteurization, etc.)
- 5 Food Safety Law articles
- 5 Common FAQs (shelf life, allergens, labeling, etc.)

Usage:
  python seed_test_data.py --server http://47.100.235.168:8083
  python seed_test_data.py --server http://localhost:8083
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_test_data")

# ============================================================
# Seed Documents
# ============================================================

SEED_DOCUMENTS = [
    # ===== GB Standards (5) =====
    {
        "title": "GB 2760-2024 食品添加剂使用标准 - 防腐剂部分",
        "content": (
            "根据GB 2760-2024《食品安全国家标准 食品添加剂使用标准》，防腐剂的使用应严格遵循以下规定：\n\n"
            "1. 山梨酸及其钾盐(山梨酸钾，E202)：\n"
            "   - 乳及乳制品（发酵乳）：最大使用量 0.075 g/kg（以山梨酸计）\n"
            "   - 果蔬汁饮料：最大使用量 0.5 g/kg\n"
            "   - 酱油、醋：最大使用量 1.0 g/kg\n"
            "   - 面包、糕点：最大使用量 1.0 g/kg\n"
            "   - 肉制品（熟肉制品）：最大使用量 0.075 g/kg\n\n"
            "2. 苯甲酸及其钠盐(苯甲酸钠，E211)：\n"
            "   - 碳酸饮料：最大使用量 0.2 g/kg（以苯甲酸计）\n"
            "   - 果酱：最大使用量 0.5 g/kg\n"
            "   - 酱油：最大使用量 1.0 g/kg\n"
            "   - 注意：苯甲酸钠不得用于婴幼儿食品\n\n"
            "3. 使用原则：\n"
            "   - 在达到预期目的的前提下，尽可能降低使用量\n"
            "   - 不应掩盖食品腐败变质\n"
            "   - 不应掩盖食品本身或加工过程中的质量缺陷\n"
            "   - 多种防腐剂混合使用时，各自用量占其最大使用量的比例之和不应超过1"
        ),
        "category": "standard",
        "source": "GB 2760-2024",
        "version": "2024",
        "metadata": {"standard_no": "GB 2760-2024", "section": "防腐剂", "effective_date": "2025-02-08"}
    },
    {
        "title": "GB 2760-2024 食品添加剂使用标准 - 甜味剂部分",
        "content": (
            "根据GB 2760-2024，常用甜味剂的使用规定：\n\n"
            "1. 阿斯巴甜(E951)：\n"
            "   - 碳酸饮料：最大使用量 0.6 g/kg\n"
            "   - 果冻：0.5 g/kg\n"
            "   - 口香糖：10.0 g/kg\n"
            "   - ADI值（每日允许摄入量）：40 mg/kg体重\n"
            "   - 注意：含苯丙氨酸，苯丙酮尿症患者禁用\n\n"
            "2. 三氯蔗糖(蔗糖素，E955)：\n"
            "   - 饮料：0.25 g/kg\n"
            "   - 烘焙食品：0.3 g/kg\n"
            "   - 调味品：0.25 g/kg\n"
            "   - ADI值：15 mg/kg体重\n\n"
            "3. 安赛蜜(E950)：\n"
            "   - 饮料：0.3 g/kg\n"
            "   - 糕点：0.3 g/kg\n"
            "   - ADI值：15 mg/kg体重\n\n"
            "4. 甜味剂使用原则：多种甜味剂混合使用时，各自用量占最大使用量比例之和不超过1"
        ),
        "category": "standard",
        "source": "GB 2760-2024",
        "version": "2024",
        "metadata": {"standard_no": "GB 2760-2024", "section": "甜味剂"}
    },
    {
        "title": "GB 14881-2013 食品生产通用卫生规范",
        "content": (
            "GB 14881-2013《食品安全国家标准 食品生产通用卫生规范》主要内容：\n\n"
            "1. 选址与厂区环境：\n"
            "   - 工厂不得建在受污染区域，周围无有毒有害气体、粉尘等\n"
            "   - 厂区地面硬化，有排水系统，无扬尘\n\n"
            "2. 厂房和车间：\n"
            "   - 清洁作业区：加工、内包装车间，空气洁净度10万级以上\n"
            "   - 准清洁作业区：原料处理、外包装车间\n"
            "   - 一般作业区：仓库、外围区域\n"
            "   - 各区之间有效隔离，防止交叉污染\n\n"
            "3. 人员卫生：\n"
            "   - 持有效健康证明上岗\n"
            "   - 进入车间换工作服、戴帽、洗手消毒\n"
            "   - 手部清洗消毒不少于20秒\n\n"
            "4. 温度控制：\n"
            "   - 冷藏库温度：0-4°C\n"
            "   - 冷冻库温度：≤-18°C\n"
            "   - 食品加工环境温度根据产品要求控制\n\n"
            "5. 设备与工器具：\n"
            "   - 与食品接触面应光滑、易清洗、耐腐蚀\n"
            "   - 不锈钢材质推荐304或316"
        ),
        "category": "standard",
        "source": "GB 14881-2013",
        "version": "2013",
        "metadata": {"standard_no": "GB 14881-2013", "section": "通用卫生规范"}
    },
    {
        "title": "GB 4789 食品微生物学检验系列标准",
        "content": (
            "GB 4789系列是食品微生物学检验的国家标准，主要包括：\n\n"
            "1. GB 4789.2 菌落总数测定：\n"
            "   - 方法：平板计数法\n"
            "   - 培养条件：36±1°C，48±2h\n"
            "   - 培养基：平板计数琼脂(PCA)\n\n"
            "2. GB 4789.3 大肠菌群计数：\n"
            "   - 方法一：MPN法（最可能数法）\n"
            "   - 方法二：平板计数法\n"
            "   - 培养条件：36±1°C，24±2h\n\n"
            "3. GB 4789.4 沙门氏菌检验：\n"
            "   - 前增菌→选择性增菌→分离→生化鉴定→血清学鉴定\n"
            "   - 检验周期：4-7天\n"
            "   - 结果报告：在25g(mL)样品中检出/未检出\n\n"
            "4. GB 4789.10 金黄色葡萄球菌检验：\n"
            "   - 培养基：Baird-Parker琼脂平板\n"
            "   - 培养条件：36±1°C，46-48h\n\n"
            "5. GB 4789.30 单核细胞增生李斯特菌检验：\n"
            "   - 需使用PALCAM琼脂和Oxford琼脂进行分离"
        ),
        "category": "standard",
        "source": "GB 4789",
        "version": "2016",
        "metadata": {"standard_no": "GB 4789", "section": "微生物检验系列"}
    },
    {
        "title": "GB 29921-2021 预包装食品中致病菌限量",
        "content": (
            "GB 29921-2021《食品安全国家标准 预包装食品中致病菌限量》规定：\n\n"
            "1. 乳制品致病菌限量：\n"
            "   - 沙门氏菌：n=5, c=0, m=0/25g（不得检出）\n"
            "   - 金黄色葡萄球菌：n=5, c=2, m=100 CFU/g, M=1000 CFU/g\n"
            "   - 单核细胞增生李斯特菌：n=5, c=0, m=0/25g\n\n"
            "2. 肉制品（即食）致病菌限量：\n"
            "   - 沙门氏菌：n=5, c=0, m=0/25g\n"
            "   - 金黄色葡萄球菌：n=5, c=1, m=100 CFU/g, M=1000 CFU/g\n\n"
            "3. 采样方案说明：\n"
            "   - n: 同一批次采集的样品件数\n"
            "   - c: 最大可允许超出m值的样品数\n"
            "   - m: 微生物指标可接受水平的限量值\n"
            "   - M: 微生物指标的最高安全限量值\n\n"
            "4. 适用范围：预包装食品，不适用于餐饮食品"
        ),
        "category": "standard",
        "source": "GB 29921-2021",
        "version": "2021",
        "metadata": {"standard_no": "GB 29921-2021", "section": "致病菌限量"}
    },

    # ===== HACCP / Process Parameters (5) =====
    {
        "title": "HACCP体系关键控制点(CCP)识别方法",
        "content": (
            "HACCP（Hazard Analysis and Critical Control Points）体系中CCP的识别：\n\n"
            "1. CCP判断树方法：\n"
            "   Q1: 该步骤是否存在预防控制措施？→ 否：修改步骤/工艺\n"
            "   Q2: 该步骤是否能消除或将危害降低到可接受水平？→ 是：CCP\n"
            "   Q3: 污染是否可能超过可接受水平？→ 否：非CCP\n"
            "   Q4: 后续步骤能否消除危害？→ 是：非CCP；否：CCP\n\n"
            "2. 常见CCP示例：\n"
            "   - 热处理/杀菌工序（控制致病菌）\n"
            "   - 金属检测（控制物理性危害）\n"
            "   - 冷却工序（控制微生物生长）\n"
            "   - 配料称量（控制添加剂用量）\n\n"
            "3. CCP监控要求：\n"
            "   - 每个CCP必须有监控程序\n"
            "   - 监控频率应足以保证CCP在控制之中\n"
            "   - 监控参数：时间、温度、pH、Aw等可测量参数\n"
            "   - 超出临界限值时必须执行纠偏措施"
        ),
        "category": "haccp",
        "source": "HACCP原理与应用指南",
        "metadata": {"topic": "CCP识别"}
    },
    {
        "title": "UHT超高温灭菌工艺参数",
        "content": (
            "UHT（Ultra High Temperature）超高温瞬时灭菌工艺：\n\n"
            "1. 标准参数：\n"
            "   - 灭菌温度：135-150°C\n"
            "   - 保温时间：2-8秒\n"
            "   - 最常用组合：137°C / 4秒 或 142°C / 2秒\n\n"
            "2. F值计算：\n"
            "   - F₀ = D₁₂₁.₁ × (log N₀ - log N)\n"
            "   - 商业无菌要求：F₀ ≥ 3分钟（针对嗜热脂肪芽孢杆菌）\n"
            "   - UHT处理的F₀值通常为5-15分钟\n\n"
            "3. 对比巴氏杀菌：\n"
            "   - 巴氏杀菌(HTST)：72-75°C / 15秒\n"
            "   - 巴氏杀菌(LTLT)：63°C / 30分钟\n"
            "   - 巴氏杀菌目标：杀灭致病菌，保留部分有益菌\n"
            "   - UHT目标：达到商业无菌，常温保存\n\n"
            "4. UHT后保存条件：\n"
            "   - 常温密封保存，保质期6-12个月\n"
            "   - 无菌灌装是关键环节"
        ),
        "category": "process",
        "source": "乳品工艺学",
        "metadata": {"topic": "UHT灭菌", "equipment": "UHT灭菌机"}
    },
    {
        "title": "酸奶发酵工艺参数与质量控制",
        "content": (
            "酸奶(发酵乳)生产工艺关键参数：\n\n"
            "1. 原料乳预处理：\n"
            "   - 标准化：脂肪含量调至3.0-3.5%，蛋白质≥2.9%\n"
            "   - 均质：60-65°C下，15-20MPa两段式均质\n"
            "   - 杀菌：95°C / 5min 或 90°C / 10min\n\n"
            "2. 发酵参数：\n"
            "   - 发酵剂：保加利亚乳杆菌 + 嗜热链球菌（1:1）\n"
            "   - 接种量：2-5%（DVS直投式发酵剂按说明使用）\n"
            "   - 发酵温度：42-43°C（搅拌型）\n"
            "   - 发酵终点：pH 4.5-4.6，酸度70-80°T\n"
            "   - 发酵时间：4-6小时\n\n"
            "3. 后处理：\n"
            "   - 搅拌型：发酵后搅拌破乳→冷却至18-22°C→灌装→冷藏\n"
            "   - 凝固型：灌装后发酵→冷藏\n"
            "   - 冷藏温度：2-6°C\n"
            "   - 保质期：21-28天（冷藏）\n\n"
            "4. 常见质量问题：\n"
            "   - 乳清析出：蛋白含量不足或发酵过度\n"
            "   - 组织粗糙：均质不充分\n"
            "   - 口感过酸：发酵温度过高或时间过长"
        ),
        "category": "process",
        "source": "乳制品生产工艺手册",
        "metadata": {"topic": "酸奶发酵", "product": "发酵乳"}
    },
    {
        "title": "罐头食品杀菌工艺(F值计算与应用)",
        "content": (
            "罐头食品商业灭菌工艺规范：\n\n"
            "1. 低酸食品(pH > 4.6)杀菌：\n"
            "   - 目标微生物：肉毒梭菌(C. botulinum)\n"
            "   - D₁₂₁.₁°C = 0.21min\n"
            "   - 12D杀灭：F₀ ≥ 2.52min\n"
            "   - 实际安全系数：F₀ ≥ 3min\n"
            "   - 典型工艺：121°C / 15-90min（依产品而定）\n\n"
            "2. 酸性食品(pH ≤ 4.6)杀菌：\n"
            "   - pH ≤ 4.6时肉毒梭菌不能生长产毒\n"
            "   - 目标微生物：耐热霉菌、酵母\n"
            "   - 杀菌温度：85-100°C\n"
            "   - 果酱：85°C / 15min\n"
            "   - 酸渍蔬菜：100°C / 10-15min\n\n"
            "3. 杀菌釜操作要点：\n"
            "   - 排气完全（排尽冷空气）\n"
            "   - 升温均匀\n"
            "   - 恒温阶段计时准确\n"
            "   - 冷却至40°C以下出釜\n"
            "   - 反压冷却防止涨罐\n\n"
            "4. 记录要求：每批次记录时间-温度曲线，保存至少3年"
        ),
        "category": "process",
        "source": "罐头食品生产技术规范",
        "metadata": {"topic": "罐头杀菌", "product": "罐头食品"}
    },
    {
        "title": "食品加工中的水分活度(Aw)控制",
        "content": (
            "水分活度(Aw)是食品保藏的关键参数：\n\n"
            "1. 微生物生长与Aw的关系：\n"
            "   - 大多数细菌：Aw ≥ 0.91\n"
            "   - 大多数酵母：Aw ≥ 0.88\n"
            "   - 大多数霉菌：Aw ≥ 0.80\n"
            "   - 嗜盐细菌：Aw ≥ 0.75\n"
            "   - 嗜渗酵母：Aw ≥ 0.60\n"
            "   - 肉毒梭菌毒素产生：Aw ≥ 0.94\n\n"
            "2. 常见食品的Aw值：\n"
            "   - 鲜肉、鲜鱼：0.98-0.99\n"
            "   - 面包：0.95-0.97\n"
            "   - 果酱：0.75-0.80\n"
            "   - 蜂蜜：0.54-0.75\n"
            "   - 饼干、薯片：0.10-0.30\n"
            "   - 奶粉：0.20-0.25\n\n"
            "3. 降低Aw的方法：\n"
            "   - 干燥/脱水：热风干燥、冻干、喷雾干燥\n"
            "   - 加盐：腌制\n"
            "   - 加糖：糖渍、蜜饯\n"
            "   - 真空冷冻干燥：保持最佳品质\n\n"
            "4. 检测方法：使用水分活度仪(如AquaLab)测量，精度±0.003"
        ),
        "category": "process",
        "source": "食品保藏学原理",
        "metadata": {"topic": "水分活度", "parameter": "Aw"}
    },

    # ===== Food Safety Law (5) =====
    {
        "title": "食品安全法 - 食品添加剂管理规定",
        "content": (
            "《中华人民共和国食品安全法》(2021年修订)关于食品添加剂的规定：\n\n"
            "第四十条：食品添加剂应当在技术上确有必要且经过风险评估证明安全可靠，"
            "方可列入允许使用的范围。\n\n"
            "第四十一条：食品添加剂的使用应当符合食品安全国家标准(GB 2760)。"
            "不得在食品生产中使用食品添加剂以外的化学物质和其他可能危害人体健康的物质。\n\n"
            "第一百二十三条违法处罚：\n"
            "- 使用非法添加物：货值金额不足1万元的，处5万-10万元罚款\n"
            "- 超范围超限量使用添加剂：货值1万元以上的，处货值10-20倍罚款\n"
            "- 情节严重的：吊销许可证，行为人5年内不得从事食品行业\n"
            "- 构成犯罪的：依法追究刑事责任\n\n"
            "第一百四十八条：消费者因不符合食品安全标准的食品受到损害的，"
            "可以向生产者或者经营者要求赔偿损失。可以要求支付价款十倍或者损失三倍的赔偿金，"
            "增加赔偿的金额不足一千元的，为一千元。"
        ),
        "category": "regulation",
        "source": "食品安全法(2021修订)",
        "version": "2021",
        "metadata": {"law": "食品安全法", "articles": ["40", "41", "123", "148"]}
    },
    {
        "title": "食品安全法 - 食品召回制度",
        "content": (
            "《食品安全法》食品召回制度规定：\n\n"
            "第六十三条：\n"
            "食品生产者发现其生产的食品不符合食品安全标准或者有证据证明可能危害人体健康的，"
            "应当立即停止生产，召回已经上市销售的食品，通知相关生产经营者和消费者。\n\n"
            "召回等级分类：\n"
            "一级召回：已经或者可能导致严重健康损害甚至死亡的\n"
            "  - 24小时内启动召回，10个工作日内完成\n"
            "二级召回：已经或者可能导致一般健康损害的\n"
            "  - 48小时内启动召回，20个工作日内完成\n"
            "三级召回：标签/标识不符合标准但不会造成健康损害的\n"
            "  - 72小时内启动召回，30个工作日内完成\n\n"
            "召回食品的处理：\n"
            "- 能够补救的：生产者在补救后可以继续销售\n"
            "- 不能补救的：应当进行无害化处理或者予以销毁\n"
            "- 对因标签标识等不影响食品安全的：可以改正后继续销售"
        ),
        "category": "regulation",
        "source": "食品安全法(2021修订)",
        "version": "2021",
        "metadata": {"law": "食品安全法", "articles": ["63"], "topic": "食品召回"}
    },
    {
        "title": "食品安全法 - 食品生产许可制度",
        "content": (
            "《食品安全法》食品生产许可相关规定：\n\n"
            "第三十五条：从事食品生产、食品销售、餐饮服务，应当依法取得许可。"
            "食品生产许可证(SC证)编号格式：SC+14位数字\n\n"
            "申请条件：\n"
            "1. 具有与生产的食品品种、数量相适应的食品原料处理和食品加工、"
            "包装、贮存等场所，保持该场所环境整洁\n"
            "2. 具有与生产的食品品种、数量相适应的生产设备或者设施\n"
            "3. 具有合理的设备布局和工艺流程，防止交叉污染\n"
            "4. 具有食品安全管理人员和保证食品安全的规章制度\n"
            "5. 具有合理的设备布局和工艺流程\n\n"
            "许可证有效期：5年\n"
            "变更事项：在许可证有效期内，需办理变更手续\n"
            "注销情形：生产条件发生重大变化且不符合许可条件的"
        ),
        "category": "regulation",
        "source": "食品安全法(2021修订)",
        "version": "2021",
        "metadata": {"law": "食品安全法", "articles": ["35"], "topic": "生产许可"}
    },
    {
        "title": "食品安全法 - 食品标签标识要求",
        "content": (
            "《食品安全法》与GB 7718结合的标签要求：\n\n"
            "第六十七条预包装食品标签应标明：\n"
            "1. 名称、规格、净含量、生产日期\n"
            "2. 成分或者配料表（按添加量递减排列）\n"
            "3. 生产者的名称、地址、联系方式\n"
            "4. 保质期\n"
            "5. 产品标准代号\n"
            "6. 贮存条件\n"
            "7. 所使用的食品添加剂在国家标准中的通用名称\n"
            "8. 生产许可证编号\n\n"
            "配料表标注规则：\n"
            "- 各种配料按制造或加工中加入量的递减顺序排列\n"
            "- 食品添加剂使用通用名称，可标注功能类别名+具体名称\n"
            "- 复合配料：若加入量>25%，需展开标注各组分\n\n"
            "营养标签(GB 28050)：\n"
            "- 必须标注：能量、蛋白质、脂肪、碳水化合物、钠（核心营养素4+1）\n"
            "- NRV%（营养素参考值百分比）"
        ),
        "category": "regulation",
        "source": "食品安全法(2021修订) + GB 7718",
        "version": "2021",
        "metadata": {"law": "食品安全法", "articles": ["67"], "topic": "食品标签"}
    },
    {
        "title": "食品安全法 - 食品安全事故处置",
        "content": (
            "《食品安全法》食品安全事故应急处置：\n\n"
            "第一百零三条：\n"
            "发生食品安全事故的单位应当立即采取措施，防止事故扩大。\n"
            "事故单位和接收病人进行治疗的单位应当及时向所在地县级人民政府"
            "食品安全监督管理部门报告。\n\n"
            "报告内容：\n"
            "1. 事故发生的时间、地点、人数\n"
            "2. 涉事食品名称、生产批号\n"
            "3. 危害程度及救治情况\n"
            "4. 已采取的控制措施\n\n"
            "处置流程：\n"
            "1. 立即封存可能导致事故的食品及其原料\n"
            "2. 封存被污染的食品相关产品\n"
            "3. 采集和保全相关证据\n"
            "4. 做好信息发布工作\n"
            "5. 配合有关部门调查\n\n"
            "法律责任：隐瞒、谎报、缓报食品安全事故的，"
            "对直接负责的主管人员处以5000-30000元罚款"
        ),
        "category": "regulation",
        "source": "食品安全法(2021修订)",
        "version": "2021",
        "metadata": {"law": "食品安全法", "articles": ["103"], "topic": "事故处置"}
    },

    # ===== Common FAQs (5) =====
    {
        "title": "食品保质期的确定方法与影响因素",
        "content": (
            "食品保质期是指食品在标签指明的贮存条件下保持品质的期限。\n\n"
            "1. 保质期确定方法：\n"
            "   - 长期稳定性试验：在标示贮存条件下定期检测至品质不合格\n"
            "   - 加速试验(ASLT)：在加速条件下推算常温保质期\n"
            "     * Q10法则：温度每升高10°C，变质速率增加2-3倍\n"
            "     * 通常选择37°C或40°C进行加速\n"
            "   - 微生物挑战实验：接种目标微生物，观察生长情况\n\n"
            "2. 影响保质期的主要因素：\n"
            "   - 水分活度(Aw)：最关键因素\n"
            "   - 温度：每升高10°C，化学反应速率约翻倍\n"
            "   - pH值：低pH抑制细菌生长\n"
            "   - 包装方式：真空/气调包装可显著延长\n"
            "   - 防腐剂：山梨酸钾、苯甲酸钠等\n"
            "   - 光照：引起脂质氧化和维生素降解\n\n"
            "3. 标注要求：\n"
            "   - 保质期12个月以上：标注年月\n"
            "   - 保质期6个月以上不足12个月：标注年月日\n"
            "   - 保质期不足6个月：标注年月日"
        ),
        "category": "process",
        "source": "食品保藏原理与技术",
        "metadata": {"topic": "保质期", "faq": True}
    },
    {
        "title": "食品过敏原管理与标注规范",
        "content": (
            "食品过敏原管理是食品安全管理的重要组成部分。\n\n"
            "1. 中国法规要求标注的过敏原(GB 7718推荐)：\n"
            "   - 含有麸质的谷物及其制品（如小麦、黑麦、大麦）\n"
            "   - 甲壳纲类动物及其制品（如虾、蟹、龙虾）\n"
            "   - 鱼类及其制品\n"
            "   - 蛋类及其制品\n"
            "   - 花生及其制品\n"
            "   - 大豆及其制品\n"
            "   - 乳及乳制品（包括乳糖）\n"
            "   - 坚果及其果仁类制品\n\n"
            "2. 工厂过敏原管理措施：\n"
            "   - 原料分开存放，标识清楚\n"
            "   - 生产排程：先生产不含过敏原产品\n"
            "   - 设备彻底清洗（验证清洗效果）\n"
            "   - 使用专用工器具和生产线\n"
            "   - 员工培训：了解过敏原交叉污染风险\n\n"
            "3. 标签标注方式：\n"
            "   - 在配料表中直接标明\n"
            "   - 或在配料表邻近位置用醒目方式提示\n"
            "   - 可能含有(may contain)声明：用于无法完全避免交叉污染的情况"
        ),
        "category": "standard",
        "source": "GB 7718 + 过敏原管理指南",
        "metadata": {"topic": "过敏原", "faq": True}
    },
    {
        "title": "食品中常见非法添加物及鉴别方法",
        "content": (
            "食品中禁止添加的非法物质及其鉴别方法：\n\n"
            "1. 三聚氰胺(Melamine)：\n"
            "   - 用途：冒充蛋白质（提高氮含量）\n"
            "   - 检测：HPLC法、GC-MS法\n"
            "   - 限量：婴幼儿配方食品≤1mg/kg，其他食品≤2.5mg/kg\n\n"
            "2. 苏丹红(Sudan Red)：\n"
            "   - 用途：增色（辣椒粉、腌制品）\n"
            "   - 检测：HPLC法\n"
            "   - 限量：不得检出\n\n"
            "3. 瘦肉精(盐酸克伦特罗)：\n"
            "   - 用途：促进猪肉瘦肉率\n"
            "   - 检测：ELISA法、GC-MS法\n"
            "   - 限量：不得检出\n\n"
            "4. 硼砂(Borax)：\n"
            "   - 用途：增加面制品的弹性和韧性\n"
            "   - 检测：甲亚胺-H比色法\n"
            "   - 限量：不得使用\n\n"
            "5. 甲醛(Formaldehyde)：\n"
            "   - 用途：非法保鲜（水产品、血制品）\n"
            "   - 检测：乙酰丙酮比色法、HPLC法\n"
            "   - 限量：不得添加"
        ),
        "category": "regulation",
        "source": "食品中非法添加物质名录",
        "metadata": {"topic": "非法添加物", "faq": True}
    },
    {
        "title": "食品工厂CIP清洗操作规程",
        "content": (
            "CIP(Clean in Place)就地清洗是食品工厂设备清洗的标准方法。\n\n"
            "1. 标准CIP清洗步骤：\n"
            "   Step 1: 预冲洗 - 清水冲洗残留物料，40-50°C，5-10min\n"
            "   Step 2: 碱洗 - NaOH溶液（1.5-2.0%浓度），70-80°C，15-20min\n"
            "   Step 3: 中间冲洗 - 清水冲洗碱液残留，常温，5-10min\n"
            "   Step 4: 酸洗 - HNO₃溶液（0.5-1.0%浓度），60-70°C，10-15min\n"
            "   Step 5: 最终冲洗 - 清水冲洗酸液残留，常温，5-10min\n"
            "   Step 6: 消毒 - 热水消毒（≥85°C / 15min）或化学消毒\n\n"
            "2. 清洗验证方法：\n"
            "   - ATP荧光检测：RLU < 150（合格）\n"
            "   - pH试纸检测：冲洗水pH与进水一致\n"
            "   - 微生物涂抹：菌落总数 < 25 CFU/25cm²\n\n"
            "3. 频率要求：\n"
            "   - 每批次生产结束后进行CIP清洗\n"
            "   - 品种更换时必须CIP\n"
            "   - 每周至少一次全面CIP"
        ),
        "category": "sop",
        "source": "食品工厂CIP清洗操作规程",
        "metadata": {"topic": "CIP清洗", "faq": True}
    },
    {
        "title": "食品营养标签NRV计算方法",
        "content": (
            "根据GB 28050-2011，食品营养标签的核心营养素NRV计算：\n\n"
            "1. 核心营养素的NRV参考值：\n"
            "   - 能量：8400 kJ (2000 kcal)\n"
            "   - 蛋白质：60 g\n"
            "   - 脂肪：≤60 g\n"
            "   - 碳水化合物：300 g\n"
            "   - 钠：2000 mg\n\n"
            "2. NRV%计算公式：\n"
            "   NRV% = (X/NRV) × 100%\n"
            "   其中X为食品每100g(mL)或每份中该营养素的含量\n\n"
            "3. 示例计算：\n"
            "   某牛奶每100mL含蛋白质3.2g\n"
            "   蛋白质NRV% = (3.2/60) × 100% = 5%\n\n"
            "4. 营养声称条件：\n"
            "   - '低脂'：≤3g/100g(固体) 或 ≤1.5g/100mL(液体)\n"
            "   - '低钠'：≤120mg/100g\n"
            "   - '高蛋白'：≥20% NRV/100g 或 ≥10% NRV/100mL\n"
            "   - '无糖'：≤0.5g/100g(mL)\n\n"
            "5. 修约规则：按GB 28050附录标准修约，"
            "能量和核心营养素含量低于'0'界限值时可标注为'0'"
        ),
        "category": "standard",
        "source": "GB 28050-2011",
        "version": "2011",
        "metadata": {"standard_no": "GB 28050-2011", "topic": "营养标签", "faq": True}
    },
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库种子数据入库")
    parser.add_argument(
        "--server", "-s",
        default="http://47.100.235.168:8083",
        help="Python service URL (default: http://47.100.235.168:8083)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="只打印文档，不实际入库"
    )
    args = parser.parse_args()

    logger.info(f"Target server: {args.server}")
    logger.info(f"Documents to ingest: {len(SEED_DOCUMENTS)}")

    if args.dry_run:
        for i, doc in enumerate(SEED_DOCUMENTS, 1):
            logger.info(f"  [{i}] {doc['category']:12s} | {doc['title'][:60]}")
        logger.info("Dry run complete. Use without --dry-run to ingest.")
        return

    # Step 1: Health check
    logger.info("Checking server health...")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/health")
            health = resp.json()
            logger.info(f"Health: {json.dumps(health, indent=2)}")
            if not health.get("success"):
                logger.error("Health check failed, aborting")
                sys.exit(1)
    except Exception as e:
        logger.error(f"Cannot reach server: {e}")
        sys.exit(1)

    # Step 2: Batch ingest
    logger.info("Starting batch ingestion...")
    start = time.time()

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                f"{args.server}/api/food-kb/ingest-batch",
                json={
                    "documents": SEED_DOCUMENTS,
                    "operator": "seed_script",
                },
            )
            resp.raise_for_status()
            result = resp.json()
    except Exception as e:
        logger.error(f"Batch ingestion failed: {e}")
        sys.exit(1)

    elapsed = time.time() - start
    logger.info(f"Ingestion result: {json.dumps(result, indent=2, ensure_ascii=False)}")
    logger.info(f"Elapsed: {elapsed:.1f}s")

    if result.get("success"):
        logger.info(f"SUCCESS: {result.get('success_count', 0)}/{result.get('total', 0)} documents ingested")
    else:
        logger.warning(f"PARTIAL: {result.get('success_count', 0)} success, {result.get('fail_count', 0)} failed")

    # Step 3: Verify stats
    logger.info("Verifying knowledge base stats...")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/stats")
            stats = resp.json()
            logger.info(f"Stats: {json.dumps(stats, indent=2)}")
    except Exception as e:
        logger.warning(f"Stats check failed: {e}")

    # Step 4: Quick search test
    logger.info("Running quick search test...")
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{args.server}/api/food-kb/query",
                json={"query": "山梨酸钾在酸奶中的最大使用量", "top_k": 3},
            )
            search_result = resp.json()
            logger.info(f"Search results: {search_result.get('count', 0)} documents found")
            for doc in search_result.get("data", [])[:3]:
                logger.info(f"  [{doc.get('similarity', 0):.3f}] {doc.get('title', '')[:50]}")
    except Exception as e:
        logger.warning(f"Search test failed: {e}")

    logger.info("Seed data ingestion complete!")


if __name__ == "__main__":
    main()
