#!/usr/bin/env python3
"""
P0 靶向文档入库 — 修复 2 个 retrieval miss + 1 个弱分类补充

Target queries:
  1. "饮料生产线CIP清洗系统设计与验证" → 当前匹配通用CIP (sim=0.8287)
  2. "餐饮服务单位食品安全管理人员配备要求" → 当前匹配通用管理员 (sim=0.7779)
  3. 水产品冷链温度控制 → aquatic 弱分类补充

Usage:
  python ingest_p0_targeted.py --server http://47.100.235.168:8083
  python ingest_p0_targeted.py --server http://47.100.235.168:8083 --dry-run
"""

import argparse
import json
import logging
import sys

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingest_p0")

P0_DOCUMENTS = [
    # ===== Document 1: 饮料生产线CIP清洗系统 (fixes miss #1) =====
    {
        "title": "饮料生产线CIP在线清洗系统设计、参数与验证规范",
        "content": (
            "CIP(Clean In Place，原位清洗/在线清洗)是饮料生产线不拆卸设备即可进行清洗消毒的自动化系统，"
            "是饮料企业保障产品微生物安全的核心卫生设施。GB 12695-2016《食品安全国家标准 饮料生产卫生规范》"
            "要求饮料生产企业应建立有效的清洗消毒制度，CIP系统是满足该要求的主要技术手段。\n\n"

            "一、CIP系统基本组成：\n"
            "CIP系统通常由碱液罐、酸液罐、热水罐、清水罐、回收罐、CIP泵组、温度/浓度传感器、"
            "自动控制系统(PLC)和管路阀门组成。大型饮料工厂一般采用多路CIP站，"
            "分别服务于调配系统、杀菌系统、灌装系统和储罐等不同区域。\n\n"

            "二、不同饮料品类CIP清洗参数：\n\n"
            "1. 含乳饮料/蛋白饮料(乳蛋白残留难清洗)：\n"
            "   - 预冲洗：清水60°C，5-10分钟，冲去大部分残留物\n"
            "   - 碱洗：NaOH浓度2.0-2.5%，温度75-80°C，循环时间20-30分钟\n"
            "   - 中间冲洗：清水冲洗至pH中性\n"
            "   - 酸洗：HNO₃浓度1.0-1.5%，温度65-70°C，循环时间10-15分钟\n"
            "   - 最终冲洗：纯净水/无菌水冲洗，至电导率<50 μS/cm\n"
            "   - 消毒(可选)：85-95°C热水循环15-20分钟 或 过氧乙酸0.1-0.3%\n"
            "   流速要求：管路内流速≥1.5 m/s，确保湍流清洗效果(Re>10000)\n\n"

            "2. 果汁/果蔬汁饮料(果胶、色素残留)：\n"
            "   - 预冲洗：清水50°C，5分钟\n"
            "   - 碱洗：NaOH浓度1.5-2.0%，温度70-75°C，循环时间15-20分钟\n"
            "   - 中间冲洗：清水冲洗\n"
            "   - 热水冲洗：80-85°C热水循环10分钟(果汁线一般不需酸洗)\n"
            "   - 最终冲洗：纯净水冲洗\n"
            "   注：NFC(非浓缩还原)果汁线需更严格的微生物控制\n\n"

            "3. 碳酸饮料(CO₂环境，微生物风险较低)：\n"
            "   - 预冲洗：清水常温，3-5分钟\n"
            "   - 碱洗：NaOH浓度1.5-2.0%，温度65-70°C，循环时间15分钟\n"
            "   - 清水冲洗\n"
            "   - 消毒：ClO₂溶液(50-100 ppm)循环10分钟 或 过氧乙酸\n"
            "   - 最终冲洗：纯净水冲洗\n\n"

            "4. 茶饮料/植物蛋白饮料：\n"
            "   - 类似含乳饮料流程，碱液浓度2.0%，温度75°C\n"
            "   - 茶饮料需注意茶多酚/色素在管壁沉积，可增加碱洗时间至25分钟\n\n"

            "5. 功能饮料/运动饮料(含维生素/矿物质)：\n"
            "   - 矿物质沉积需酸洗去除，HNO₃浓度1.0-1.2%，65°C/10分钟\n"
            "   - 其余参数同碳酸饮料\n\n"

            "三、CIP清洗验证标准：\n"
            "1. 目视检查：设备内表面无可见残留物(视镜/内窥镜检查)\n"
            "2. 冲洗水检测：\n"
            "   - pH值：6.5-7.5(接近纯净水)\n"
            "   - 电导率：<50 μS/cm\n"
            "   - 碱/酸残留：不得检出\n"
            "3. 微生物检测：\n"
            "   - 设备表面涂抹法：菌落总数≤25 CFU/25cm²\n"
            "   - 冲洗水微生物：菌落总数<10 CFU/mL，大肠菌群不得检出\n"
            "4. ATP荧光检测(快速验证)：\n"
            "   - 管路/阀门/灌装头表面：ATP值<100 RLU (合格)\n"
            "   - 100-300 RLU (需关注)，>300 RLU (不合格，需重新清洗)\n"
            "5. 过敏原残留检测(有过敏原风险的产线切换时)：\n"
            "   - 牛奶蛋白ELISA检测：<2.5 ppm (FDA建议阈值)\n\n"

            "四、CIP频率与记录：\n"
            "   - 生产结束后必须清洗(每班次/每天)\n"
            "   - 品种切换时必须清洗(特别是过敏原管理)\n"
            "   - 停产超过4小时需重新清洗后方可生产\n"
            "   - 清洗记录应包括：日期、时间、清洗程序、碱/酸浓度、温度、时间、验证结果、操作人签名\n"
            "   - 记录保存期限：至少2年(GB 12695-2016要求)\n\n"

            "五、法规依据：\n"
            "   - GB 12695-2016《食品安全国家标准 饮料生产卫生规范》\n"
            "   - GB 14881-2013《食品安全国家标准 食品生产通用卫生规范》\n"
            "   - 企业应制定CIP清洗SOP，纳入HACCP/OPRP前提方案"
        ),
        "category": "process",
        "source": "GB 12695-2016/CIP清洗",
        "version": "2024",
        "metadata": {
            "standard_no": "GB 12695-2016",
            "target_query": "饮料生产线CIP清洗系统设计与验证",
            "food_type": "beverage",
            "priority": "P0"
        }
    },

    # ===== Document 2: 餐饮服务食品安全管理人员配备 (fixes miss #2) =====
    {
        "title": "餐饮服务单位食品安全管理人员配备要求与职责规范",
        "content": (
            "食品安全管理人员是餐饮服务单位食品安全管理的核心角色。根据GB 31654-2021"
            "《食品安全国家标准 餐饮服务通用卫生规范》和《餐饮服务食品安全操作规范》(2018版)，"
            "不同规模和类型的餐饮服务单位有不同的管理人员配备要求。\n\n"

            "一、法律法规依据：\n"
            "1. 《中华人民共和国食品安全法》(2021修正)第33条、第44条\n"
            "2. GB 31654-2021《食品安全国家标准 餐饮服务通用卫生规范》\n"
            "3. 《餐饮服务食品安全操作规范》(国家市场监管总局 2018年第12号公告)\n"
            "4. 《学校食品安全与营养健康管理规定》(教育部等三部门令第45号 2019)\n"
            "5. 《养老机构食品安全管理规范》\n\n"

            "二、配备标准(按餐饮单位类型)：\n\n"
            "1. 特大型餐饮服务单位(餐位数≥1000位 或 就餐面积≥3000㎡)：\n"
            "   - 应设立食品安全管理机构(如食品安全管理部/科)\n"
            "   - 配备≥2名专职食品安全管理人员\n"
            "   - 管理人员应持有高级食品安全管理员证书\n\n"

            "2. 大型餐饮服务单位(500≤餐位<1000 或 1000≤面积<3000㎡)：\n"
            "   - 应配备≥1名专职食品安全管理人员\n"
            "   - 建议设立食品安全管理岗位\n\n"

            "3. 中型餐饮服务单位(150≤餐位<500 或 150≤面积<1000㎡)：\n"
            "   - 应配备≥1名专职或兼职食品安全管理人员\n\n"

            "4. 小型餐饮服务单位(餐位<150)：\n"
            "   - 可由经营者或指定人员兼任食品安全管理职责\n"
            "   - 仍需完成食品安全培训并通过考核\n\n"

            "5. 特殊类型(强制专职要求)：\n"
            "   a) 中央厨房：必须设立食品安全管理机构，配备≥2名专职管理人员\n"
            "   b) 集体用餐配送单位：必须配备专职食品安全管理人员\n"
            "   c) 学校食堂(含托幼机构)：\n"
            "      - 必须配备专职食品安全管理人员(《学校食品安全与营养健康管理规定》第13条)\n"
            "      - 学校食品安全管理人员须经食品安全培训合格后上岗\n"
            "      - 校长(园长)是第一责任人，实行校长陪餐制度\n"
            "   d) 养老机构食堂：应配备专职或兼职食品安全管理人员\n"
            "   e) 医疗机构食堂：应配备专职食品安全管理人员\n"
            "   f) 连锁餐饮企业总部：必须设立食品安全管理机构\n"
            "   g) 网络餐饮服务第三方平台：必须设立食品安全管理机构\n\n"

            "三、食品安全管理人员职责(GB 31654-2021)：\n"
            "1. 建立并落实食品安全管理制度\n"
            "2. 组织食品安全自查，发现问题及时整改\n"
            "3. 审核原料供应商资质，管理进货查验和索证索票\n"
            "4. 管理从业人员健康证明，确保持证上岗\n"
            "5. 组织从业人员食品安全培训\n"
            "6. 监督食品加工制作过程的规范操作\n"
            "7. 管理食品留样(学校/养老/医疗食堂：每品种≥125g，保存48h以上，温度0-8°C)\n"
            "8. 管理餐饮具清洗消毒，确保合格\n"
            "9. 处理食品安全投诉，配合监管部门检查\n"
            "10. 制定食品安全事故应急处置预案\n\n"

            "四、培训与考核要求：\n"
            "1. 上岗前培训：食品安全管理人员在上岗前应完成食品安全知识培训\n"
            "2. 年度培训：食品安全管理人员每年应接受不少于40学时的食品安全培训\n"
            "   (《餐饮服务食品安全操作规范》2018版要求)\n"
            "3. 普通从业人员：每年培训不少于12学时\n"
            "4. 监督抽查考核：市场监管部门可随机抽查考核，不合格须补训\n"
            "5. 培训内容应包括：\n"
            "   - 食品安全法律法规\n"
            "   - 食品安全基础知识(交叉污染防控、温度控制、个人卫生)\n"
            "   - 食品安全管理制度\n"
            "   - 食品安全事故应急处置\n"
            "   - 食源性疾病预防知识\n\n"

            "五、法律责任：\n"
            "   - 《食品安全法》第126条：未配备食品安全管理人员或未经培训上岗的，"
            "责令改正，给予警告；拒不改正的，处5000元以上5万元以下罚款\n"
            "   - 情节严重的，责令停产停业，直至吊销许可证"
        ),
        "category": "regulation",
        "source": "GB 31654-2021/餐饮管理人员",
        "version": "2021",
        "metadata": {
            "standard_no": "GB 31654-2021",
            "related_standards": "食品安全法第33/44条, 餐饮服务食品安全操作规范2018",
            "target_query": "餐饮服务单位食品安全管理人员配备要求",
            "food_type": "catering",
            "priority": "P0"
        }
    },

    # ===== Document 3: 水产品冷链物流温度控制 (fixes weak aquatic) =====
    {
        "title": "水产品冷链物流全程温度控制与质量保障规范",
        "content": (
            "水产品是高风险易腐食品，冷链管理直接关系产品安全性和品质。"
            "GB 31605-2020《食品安全国家标准 食品冷链物流卫生规范》和SC/T 9001系列标准"
            "对水产品从出厂到销售的全程温度控制提出了明确要求。\n\n"

            "一、水产品温度分类与控制标准：\n\n"
            "1. 鲜活水产品：\n"
            "   - 淡水鱼类：运输水温与养殖水温温差≤5°C，宜控制在10-20°C\n"
            "   - 海水鱼类/贝类：运输水温10-15°C，盐度与原产地一致\n"
            "   - 甲壳类(虾蟹)：活运温度5-15°C，充氧供氧(溶解氧>5 mg/L)\n"
            "   - 运输密度：鱼类≤250 kg/m³水，虾类≤150 kg/m³水\n"
            "   - 运输时间：国内≤24h，宜≤12h\n\n"

            "2. 冷鲜(冰鲜)水产品：\n"
            "   - 储运温度：0~4°C(不冻结)\n"
            "   - 货架期：一般3-7天(取决于品种和初始菌落数)\n"
            "   - 三文鱼/金枪鱼刺身级：中心温度0-2°C，货架期≤3天\n"
            "   - 运输过程温度波动≤±2°C\n"
            "   - 碎冰/冰袋/冷藏车温控均可\n\n"

            "3. 冷冻水产品：\n"
            "   - 储存温度：≤-18°C\n"
            "   - 速冻：中心温度在30分钟内从-1°C降至-5°C(通过最大冰晶生成带)\n"
            "   - 运输过程温度波动≤±2°C，短暂波动不超过-15°C\n"
            "   - 金枪鱼(超低温)：-50~-60°C(保持鲜红色泽)\n"
            "   - 虾仁/鱿鱼圈/鱼柳等加工品：≤-18°C\n"
            "   - 货架期：-18°C条件下一般12-24个月\n\n"

            "4. 干制/腌制水产品：\n"
            "   - 干制品(鱼干/虾皮)：常温密封，水分活度aw<0.65\n"
            "   - 腌制品(咸鱼/酱虾)：常温或冷藏，aw<0.85\n\n"

            "二、冷链运输要求(GB 31605-2020)：\n"
            "1. 运输工具：\n"
            "   - 冷藏车/保温车应具备温度记录仪(精度±0.5°C)\n"
            "   - 记录间隔≤30分钟，自动记录不可篡改\n"
            "   - 冷藏车制冷机组应定期校验\n\n"
            "2. 装卸要求：\n"
            "   - 冷冻品装卸时间不得超过30分钟\n"
            "   - 冷鲜品装卸时间不得超过20分钟\n"
            "   - 装卸区域温度宜≤15°C(有条件应配备封闭式对接)\n\n"
            "3. 堆码要求：\n"
            "   - 冷藏车内堆垛高度不超过制冷出风口\n"
            "   - 货物与车壁间距≥10cm，确保冷气循环\n"
            "   - 不同温度要求的产品不得混装\n\n"

            "三、水产品冷链关键控制点(CCP)：\n"
            "1. 捕捞/收获后：30分钟内降温至4°C以下(冰鲜)或速冻\n"
            "2. 加工车间：环境温度≤15°C(原料处理区)，≤12°C(分割加工区)\n"
            "3. 预冷/速冻：液氮速冻(-196°C接触)或隧道式速冻(-35~-40°C风温)\n"
            "4. 冷库储存：-18°C±1°C，相对湿度90-95%\n"
            "5. 配送最后一公里：保温箱+冰袋/干冰，温度记录\n\n"

            "四、微生物风险与温度关系：\n"
            "   - 副溶血性弧菌：10°C以下生长极缓慢，4°C基本停止繁殖\n"
            "   - 李斯特菌：可在0-4°C缓慢增殖(冷鲜水产品的主要风险)\n"
            "   - 组胺(鲐鱼/金枪鱼)：>15°C时组氨酸脱羧酶活跃，组胺快速积累\n"
            "   - 危险温度带：5-60°C(微生物快速繁殖区)\n\n"

            "五、法规依据：\n"
            "   - GB 31605-2020《食品安全国家标准 食品冷链物流卫生规范》\n"
            "   - GB 31621-2014《食品安全国家标准 食品经营过程卫生规范》\n"
            "   - SC/T 3016《水产品抽样方法》\n"
            "   - GB 10136-2015《食品安全国家标准 动物性水产制品》\n"
            "   - GB 2733-2015《食品安全国家标准 鲜、冻动物性水产品》\n"
            "   水产品冷链断链是导致食品安全事故的主要原因之一，企业应建立冷链温度追溯体系。"
        ),
        "category": "process",
        "source": "GB 31605-2020/水产冷链",
        "version": "2024",
        "metadata": {
            "standard_no": "GB 31605-2020",
            "related_standards": "GB 31621-2014, GB 2733-2015, SC/T 3016",
            "target_query": "水产品冷链物流温度控制",
            "food_type": "aquatic",
            "priority": "P0"
        }
    },
]

VERIFICATION_QUERIES = [
    ("process", "饮料生产线CIP清洗系统设计与验证"),
    ("regulation", "餐饮服务单位食品安全管理人员配备要求"),
    ("process", "水产品冷链物流全程温度控制规范"),
    # Additional queries to test coverage
    ("process", "含乳饮料CIP碱洗温度浓度参数"),
    ("regulation", "学校食堂食品安全管理人员专职要求"),
    ("process", "冷冻水产品运输温度波动要求"),
]


def ingest_documents(server: str, dry_run: bool = False):
    """Ingest P0 documents via /api/food-kb/ingest-batch API."""
    url = f"{server}/api/food-kb/ingest-batch"

    logger.info(f"Ingesting {len(P0_DOCUMENTS)} P0 targeted documents to {server}")

    if dry_run:
        for i, doc in enumerate(P0_DOCUMENTS, 1):
            logger.info(f"  [{i}] {doc['title']} (category={doc['category']}, "
                        f"content_len={len(doc['content'])} chars)")
        logger.info("DRY RUN — no documents ingested")
        return True

    payload = {"documents": P0_DOCUMENTS}

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            result = resp.json()

            if result.get("success"):
                logger.info(f"Successfully ingested {result.get('ingested', '?')} documents")
                if result.get("errors"):
                    for err in result["errors"]:
                        logger.warning(f"  Error: {err}")
                return True
            else:
                logger.error(f"Ingestion failed: {result.get('message', 'unknown error')}")
                return False
    except Exception as e:
        logger.error(f"HTTP error: {e}")
        return False


def verify_retrieval(server: str):
    """Test that the new documents are retrieved for target queries."""
    url = f"{server}/api/food-kb/query"

    logger.info(f"\nVerifying retrieval for {len(VERIFICATION_QUERIES)} test queries...")

    results = []
    with httpx.Client(timeout=30) as client:
        for category, query in VERIFICATION_QUERIES:
            try:
                resp = client.post(url, json={
                    "query": query,
                    "top_k": 3,
                    "similarity_threshold": 0.50,
                })
                resp.raise_for_status()
                data = resp.json()

                docs = data.get("data", [])
                if docs:
                    top = docs[0]
                    sim = top.get("similarity", 0)
                    title = top.get("title", "?")[:50]
                    status = "✅" if sim >= 0.80 else "⚠️"
                    logger.info(f"  {status} [{category}] \"{query[:40]}...\" → sim={sim:.4f} | {title}")
                    results.append((query, sim, title))
                else:
                    logger.warning(f"  ❌ [{category}] \"{query[:40]}...\" → no results")
                    results.append((query, 0, "NO RESULTS"))
            except Exception as e:
                logger.error(f"  ❌ [{category}] \"{query[:40]}...\" → error: {e}")
                results.append((query, 0, f"ERROR: {e}"))

    return results


def check_stats(server: str):
    """Check total document count after ingestion."""
    url = f"{server}/api/food-kb/stats"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
            total = data.get("data", {}).get("total_documents", data.get("total_documents", "?"))
            logger.info(f"\nKnowledge base total documents: {total}")
            return total
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Ingest P0 targeted documents")
    parser.add_argument("--server", required=True, help="Python service URL")
    parser.add_argument("--dry-run", action="store_true", help="Preview without ingesting")
    parser.add_argument("--verify-only", action="store_true", help="Only run verification queries")
    args = parser.parse_args()

    server = args.server.rstrip("/")

    if args.verify_only:
        check_stats(server)
        verify_retrieval(server)
        return

    # Step 1: Check current stats
    check_stats(server)

    # Step 2: Ingest
    success = ingest_documents(server, dry_run=args.dry_run)
    if not success:
        sys.exit(1)

    if args.dry_run:
        return

    # Step 3: Verify
    import time
    logger.info("Waiting 3s for embedding indexing...")
    time.sleep(3)

    check_stats(server)
    verify_retrieval(server)


if __name__ == "__main__":
    main()
