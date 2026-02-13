#!/usr/bin/env python3
"""
食品领域语料采集脚本 — 用于领域预训练

数据来源:
  1. GB 国家标准 (模拟结构化输出)
  2. 食品伙伴网 (foodmate.net) 技术文档
  3. 国家法律法规数据库 (flk.npc.gov.cn) 食品安全法规

输出格式: JSONL
  {"text": "...", "source": "GB2760-2024", "category": "标准"}

使用方式:
  python collect_corpus.py --output-dir ./corpus --max-pages 50
  python collect_corpus.py --output-dir ./corpus --dry-run
"""

import argparse
import json
import logging
import random
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("collect_corpus")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
DEFAULT_OUTPUT_DIR = "./corpus"
DEFAULT_MAX_PAGES = 100
REQUEST_TIMEOUT = 30  # 秒
RATE_LIMIT_MIN = 1.0  # 最小请求间隔 (秒)
RATE_LIMIT_MAX = 3.0  # 最大请求间隔 (秒)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# ---------------------------------------------------------------------------
# GB 国家标准 (结构化模拟数据)
# ---------------------------------------------------------------------------
GB_STANDARDS: List[Dict] = [
    {
        "code": "GB2760-2024",
        "title": "食品安全国家标准 食品添加剂使用标准",
        "text": (
            "GB2760-2024《食品安全国家标准 食品添加剂使用标准》规定了食品添加剂的使用原则、"
            "允许使用的食品添加剂品种、使用范围及最大使用量或残留量。本标准适用于所有使用"
            "食品添加剂的食品。食品添加剂的使用应符合以下基本要求：不应对人体产生任何健康"
            "危害；不应掩盖食品腐败变质；不应掩盖食品本身或加工过程中的质量缺陷或以掺杂、"
            "掺假、伪造为目的而使用食品添加剂；不应降低食品本身的营养价值；在达到预期目的"
            "前提下尽可能降低在食品中的使用量。带入原则：当某食品配料中允许使用某种食品添加"
            "剂，且该配料用于其他食品的生产时，允许该食品添加剂带入最终食品中。"
        ),
    },
    {
        "code": "GB2761-2017",
        "title": "食品安全国家标准 食品中真菌毒素限量",
        "text": (
            "GB2761-2017《食品安全国家标准 食品中真菌毒素限量》规定了食品中黄曲霉毒素B1、"
            "黄曲霉毒素M1、脱氧雪腐镰刀菌烯醇、展青霉素、赭曲霉毒素A和玉米赤霉烯酮的"
            "限量指标。黄曲霉毒素B1限量：谷物及其制品≤5μg/kg，豆类及其制品≤5μg/kg，"
            "坚果及籽类≤5μg/kg，油脂及其制品(花生油、玉米油)≤20μg/kg，调味品(发酵类)"
            "≤5μg/kg，特殊膳食用食品(婴幼儿配方食品)≤0.5μg/kg。食品生产经营者应采取"
            "控制措施使产品中真菌毒素含量达到尽可能低的水平。"
        ),
    },
    {
        "code": "GB2762-2022",
        "title": "食品安全国家标准 食品中污染物限量",
        "text": (
            "GB2762-2022《食品安全国家标准 食品中污染物限量》规定了食品中铅、镉、汞、砷、"
            "锡、镍、铬、亚硝酸盐、硝酸盐、苯并[a]芘、N-二甲基亚硝胺、多氯联苯、"
            "3-氯-1,2-丙二醇等污染物的限量要求。铅限量：谷类≤0.2mg/kg，蔬菜及其制品"
            "≤0.3mg/kg（叶菜蔬菜≤0.3mg/kg），水果及其制品≤0.1mg/kg，肉及肉制品"
            "≤0.2mg/kg（畜禽肝脏≤0.5mg/kg），水产品≤0.5mg/kg（甲壳类≤0.5mg/kg），"
            "乳及乳制品≤0.3mg/kg（液态乳≤0.05mg/kg）。"
        ),
    },
    {
        "code": "GB14880-2012",
        "title": "食品安全国家标准 食品营养强化剂使用标准",
        "text": (
            "GB14880-2012《食品安全国家标准 食品营养强化剂使用标准》规定了食品营养强化剂的"
            "使用原则、允许使用的食品营养强化剂品种、使用范围及使用量。食品营养强化的主要"
            "目的包括：弥补食品在正常加工、储存时造成的营养素损失；在一定范围内保证人们在"
            "各种饮食条件下都能获得充足的营养素；补充自然存在的某种营养素缺乏；使某种食品"
            "达到特殊的膳食用途。允许使用的营养强化剂包括：维生素A、维生素D、维生素E、"
            "维生素K、维生素B1、维生素B2、维生素B6、维生素B12、维生素C、烟酸、叶酸、"
            "泛酸、生物素、牛磺酸、钙、铁、锌、硒、碘等。"
        ),
    },
    {
        "code": "GB7718-2011",
        "title": "食品安全国家标准 预包装食品标签通则",
        "text": (
            "GB7718-2011《食品安全国家标准 预包装食品标签通则》规定了预包装食品标签的基本"
            "要求。标签应包含食品名称、配料表、净含量和规格、生产者和经销者的名称和地址、"
            "日期标示和贮存条件、食品生产许可证编号及产品标准代号等。配料表应以\u201c配料\u201d或"
            "\u201c配料表\u201d为引导词，各种配料按制造或加工食品时加入量的递减顺序一一排列。"
            "食品添加剂应标示其在GB2760中的食品添加剂通用名称。日期标示应清晰标注生产"
            "日期和保质期，日期格式推荐使用年/月/日。"
        ),
    },
    {
        "code": "GB29921-2021",
        "title": "食品安全国家标准 预包装食品中致病菌限量",
        "text": (
            "GB29921-2021《食品安全国家标准 预包装食品中致病菌限量》规定了预包装食品中"
            "沙门氏菌、单核细胞增生李斯特氏菌、大肠埃希氏菌O157:H7、金黄色葡萄球菌和"
            "副溶血性弧菌的限量要求。采样方案采用二级采样方案(n=5, c=0, m=0/25g或"
            "0/25mL)和三级采样方案。肉制品中沙门氏菌限量：n=5, c=0, m=0/25g；"
            "水产制品中副溶血性弧菌限量：n=5, c=1, m=100CFU/g, M=1000CFU/g。"
            "婴幼儿配方食品中阪崎肠杆菌限量：n=3, c=0, m=0/100g。"
        ),
    },
    {
        "code": "GB5009.3-2016",
        "title": "食品安全国家标准 食品中水分的测定",
        "text": (
            "GB5009.3-2016《食品安全国家标准 食品中水分的测定》规定了食品中水分的测定方法。"
            "第一法为直接干燥法，适用于在101-105℃下不含或含其他挥发性物质甚少的食品。"
            "操作步骤：将洁净铝制或玻璃制称量瓶在101-105℃干燥箱中加热1h，取出置于干燥器中"
            "冷却30min，称量。称取2-10g试样，放入称量瓶中，置于101-105℃干燥箱中干燥"
            "2-4h，取出冷却30min后称量。重复干燥1h至恒量。第二法为减压干燥法，适用于"
            "含糖较多或含较多挥发性成分的食品。干燥温度为60-70℃，真空度≤133Pa。"
        ),
    },
    {
        "code": "GB5009.5-2016",
        "title": "食品安全国家标准 食品中蛋白质的测定",
        "text": (
            "GB5009.5-2016《食品安全国家标准 食品中蛋白质的测定》规定了食品中蛋白质的测定"
            "方法。第一法为凯氏定氮法。原理：食品中的蛋白质在催化剂作用下，用硫酸消化使"
            "蛋白质分解，其中碳和氢被氧化为二氧化碳和水逸出，蛋白质中的氨基转化为硫酸铵。"
            "然后碱化蒸馏使氨游离，用硼酸吸收后以盐酸或硫酸标准滴定溶液滴定，根据酸的"
            "消耗量乘以换算系数（一般食品为6.25，乳制品为6.38，面粉为5.70）计算蛋白质含量。"
            "检出限：0.05g/100g。"
        ),
    },
    {
        "code": "GB2763-2021",
        "title": "食品安全国家标准 食品中农药最大残留限量",
        "text": (
            "GB2763-2021《食品安全国家标准 食品中农药最大残留限量》规定了564种农药在376种"
            "（类）食品中10092项最大残留限量。对于不同作物类别，同一农药品种的限量值可能不同。"
            "例如，有机磷类农药毒死蜱在稻谷中的MRL为0.1mg/kg，在甘蓝类蔬菜中为1mg/kg。"
            "拟除虫菊酯类农药氯氰菊酯在苹果中的MRL为2mg/kg，在叶菜类蔬菜中为5mg/kg。"
            "新增了草铵膦、氟吡菌胺、嘧菌酯等农药残留限量值。推荐检测方法包括气相色谱法"
            "（GC-MS/MS）和液相色谱法（LC-MS/MS）。"
        ),
    },
    {
        "code": "GB1886.1-2021",
        "title": "食品安全国家标准 食品添加剂 碳酸钠",
        "text": (
            "GB1886.1-2021《食品安全国家标准 食品添加剂 碳酸钠》规定了食品添加剂碳酸钠的"
            "质量要求、检验方法、检验规则和标志、包装、运输、贮存。碳酸钠（Na2CO3），又称"
            "纯碱、苏打，在食品工业中用作酸度调节剂、膨松剂和面团改良剂。质量要求：碳酸钠"
            "（Na2CO3）含量（以干基计）≥99.2%，灼烧失量（180℃）≤1.0%，氯化物（以Cl计）"
            "≤0.4%，铁（Fe）≤0.003%，水不溶物≤0.03%，硫酸盐（以SO4计）≤0.03%，"
            "砷（As）≤0.0003%，重金属（以Pb计）≤0.001%。"
        ),
    },
    {
        "code": "GB31621-2014",
        "title": "食品安全国家标准 食品经营过程卫生规范",
        "text": (
            "GB31621-2014《食品安全国家标准 食品经营过程卫生规范》规定了食品经营过程中"
            "原料采购、运输和贮存、销售、食品召回和退市等环节的场所、设施、人员的基本要求"
            "和管理准则。储存要求：冷藏食品应在0-8℃条件下储存，冷冻食品应在-12℃以下储存。"
            "食品与非食品应分区摆放，生食品与熟食品应有效分隔。散装食品应有明显的区域或隔离"
            "措施与预包装食品分开销售。温度控制：冷藏柜温度应保持0-8℃，冷冻柜温度应保持"
            "-18℃以下，热链食品中心温度应保持60℃以上。"
        ),
    },
    {
        "code": "GB14881-2013",
        "title": "食品安全国家标准 食品生产通用卫生规范",
        "text": (
            "GB14881-2013《食品安全国家标准 食品生产通用卫生规范》规定了食品生产过程中"
            "厂区选址及总体布局、厂房和车间、设施与设备、卫生管理、食品原料和食品相关产品、"
            "食品安全控制、检验、食品的贮存和运输等方面的基本要求和管理准则。生产车间应按照"
            "清洁程度分为一般作业区、准清洁作业区和清洁作业区。清洁作业区应有独立的空气净化"
            "系统，空气洁净度应符合生产需要。人员进入清洁作业区应经过更衣、洗手、消毒。"
            "食品接触面应光滑、无毒、耐腐蚀，便于清洁和消毒。设备布局应合理，便于清洁、"
            "消毒和维护，防止交叉污染。"
        ),
    },
]

# ---------------------------------------------------------------------------
# 食品伙伴网采集
# ---------------------------------------------------------------------------
FOODMATE_BASE_URL = "https://www.foodmate.net"
FOODMATE_TECH_URLS = [
    "/tech/guobiaostandard/",  # 国标相关
    "/tech/foodadditives/",    # 食品添加剂技术
    "/tech/micro/",            # 微生物检测
    "/tech/haccp/",            # HACCP 管理
]

# ---------------------------------------------------------------------------
# 法律法规来源
# ---------------------------------------------------------------------------
NPC_FLK_BASE = "https://flk.npc.gov.cn"
FOOD_SAFETY_KEYWORDS = [
    "食品安全法",
    "农产品质量安全法",
    "食品安全法实施条例",
]


def _rate_limit() -> None:
    """随机延时以遵守爬虫礼仪"""
    delay = random.uniform(RATE_LIMIT_MIN, RATE_LIMIT_MAX)
    logger.debug("Rate limit: sleeping %.1f s", delay)
    time.sleep(delay)


def _safe_get(url: str, session: requests.Session) -> Optional[requests.Response]:
    """带重试和异常处理的 HTTP GET"""
    for attempt in range(3):
        try:
            resp = session.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            logger.warning("请求失败 (attempt %d/3): %s — %s", attempt + 1, url, exc)
            if attempt < 2:
                time.sleep(2 ** attempt)
    return None


# ===== 数据源 1: GB 国家标准 (结构化模拟) ====================================

def collect_gb_standards(dry_run: bool = False) -> List[Dict]:
    """
    采集 GB 国家标准语料。
    当前使用预定义的结构化数据（模拟）；正式环境可对接 openstd.samr.gov.cn。
    """
    records: List[Dict] = []
    for std in GB_STANDARDS:
        record = {
            "text": f"{std['title']}\n\n{std['text']}",
            "source": std["code"],
            "category": "标准",
        }
        if dry_run:
            logger.info("[DRY RUN] GB 标准: %s — %s (约 %d 字)",
                        std["code"], std["title"], len(std["text"]))
        else:
            records.append(record)
            logger.info("采集 GB 标准: %s — %s", std["code"], std["title"])
    return records


# ===== 数据源 2: 食品伙伴网技术文档 ==========================================

def collect_foodmate_articles(
    session: requests.Session,
    max_pages: int = 10,
    dry_run: bool = False,
) -> List[Dict]:
    """
    采集食品伙伴网技术文档。
    遵循 rate limiting，解析文章正文。
    """
    records: List[Dict] = []
    pages_crawled = 0

    for section_path in FOODMATE_TECH_URLS:
        if pages_crawled >= max_pages:
            break

        list_url = urljoin(FOODMATE_BASE_URL, section_path)
        logger.info("正在采集分区: %s", list_url)

        if dry_run:
            logger.info("[DRY RUN] 将采集列表页: %s", list_url)
            pages_crawled += 1
            continue

        _rate_limit()
        resp = _safe_get(list_url, session)
        if resp is None:
            logger.warning("跳过分区 (请求失败): %s", list_url)
            continue

        resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.text, "html.parser")

        # 食品伙伴网文章链接通常在 <a> 标签中
        article_links = []
        for a_tag in soup.select("a[href]"):
            href = a_tag.get("href", "")
            # 过滤文章详情页 (通常包含数字 ID)
            if "/tech/" in href and href.endswith(".html"):
                full_url = urljoin(FOODMATE_BASE_URL, href)
                if full_url not in [r.get("_url") for r in records]:
                    article_links.append(full_url)

        logger.info("分区 %s 发现 %d 篇文章链接", section_path, len(article_links))

        for article_url in article_links:
            if pages_crawled >= max_pages:
                break

            _rate_limit()
            art_resp = _safe_get(article_url, session)
            if art_resp is None:
                continue

            art_resp.encoding = art_resp.apparent_encoding or "utf-8"
            art_soup = BeautifulSoup(art_resp.text, "html.parser")

            # 提取标题
            title_tag = art_soup.find("h1") or art_soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else "未知标题"

            # 提取正文内容
            content_div = (
                art_soup.find("div", class_="content")
                or art_soup.find("div", id="content")
                or art_soup.find("article")
            )
            if content_div:
                # 去除脚本和样式
                for tag in content_div.find_all(["script", "style", "nav", "footer"]):
                    tag.decompose()
                text = content_div.get_text(separator="\n", strip=True)
            else:
                text = art_soup.get_text(separator="\n", strip=True)

            # 过滤过短文本
            if len(text) < 100:
                logger.debug("跳过短文本 (%d 字): %s", len(text), article_url)
                continue

            record = {
                "text": f"{title}\n\n{text}",
                "source": "foodmate.net",
                "category": "技术文档",
                "_url": article_url,
            }
            records.append(record)
            pages_crawled += 1
            logger.info("采集文章 [%d/%d]: %s (约 %d 字)",
                        pages_crawled, max_pages, title[:40], len(text))

    return records


# ===== 数据源 3: 食品安全法律法规 ==============================================

def collect_food_safety_laws(
    session: requests.Session,
    dry_run: bool = False,
) -> List[Dict]:
    """
    采集食品安全相关法律法规。
    从国家法律法规数据库 (flk.npc.gov.cn) 搜索食品安全法规。
    注意: 实际采集可能受反爬限制，此处包含结构化回退数据。
    """
    records: List[Dict] = []

    # 结构化回退数据（主要法律法规的摘要）
    fallback_laws = [
        {
            "title": "中华人民共和国食品安全法（2021年修正）",
            "source": "食品安全法",
            "text": (
                "《中华人民共和国食品安全法》是为保证食品安全，保障公众身体健康和生命安全"
                "制定的法律。食品安全工作实行预防为主、风险管理、全程控制、社会共治的原则。"
                "国家建立食品安全风险监测制度，对食源性疾病、食品污染以及食品中的有害因素"
                "进行监测。食品生产经营者应当依照法律、法规和食品安全标准从事生产经营活动，"
                "保证食品安全，诚信自律，对社会和公众负责，接受社会监督，承担社会责任。"
                "食品生产经营实行许可制度，从事食品生产、食品销售、餐饮服务应当依法取得许可。"
                "国家对食品添加剂生产实行许可制度，申请食品添加剂生产许可的条件和程序按照"
                "有关工业产品生产许可证管理的规定执行。"
            ),
        },
        {
            "title": "食品安全法实施条例（2019年修订）",
            "source": "食品安全法实施条例",
            "text": (
                "《中华人民共和国食品安全法实施条例》细化了食品安全法的相关规定。明确了食品"
                "安全风险监测和风险评估、食品安全标准、食品生产经营、食品检验、食品进出口、"
                "食品安全事故处置等各环节的具体实施要求。对特殊食品（保健食品、特殊医学用途"
                "配方食品、婴幼儿配方食品）实行严格监督管理。食品标签、说明书应当清晰、明显，"
                "生产日期、保质期等事项应当显著标注。食品安全追溯体系应当保证食品可追溯。"
                "任何单位和个人不得发布未依法取得资质认定的食品检验机构出具的食品检验信息。"
            ),
        },
        {
            "title": "中华人民共和国农产品质量安全法（2022年修订）",
            "source": "农产品质量安全法",
            "text": (
                "《中华人民共和国农产品质量安全法》旨在保障农产品质量安全，维护公众健康。"
                "国家建立农产品质量安全标准体系，包括农产品质量安全的强制性标准和推荐性标准。"
                "农产品生产经营者应当对其生产经营的农产品质量安全负责。农产品质量安全追溯制度"
                "应当保证农产品从生产、收购、储存、运输到销售的全过程可追溯。禁止在农产品生产"
                "过程中使用国家明令禁止使用的农业投入品。农药、兽药使用应当严格执行安全间隔期"
                "和休药期的规定。"
            ),
        },
    ]

    if dry_run:
        for law in fallback_laws:
            logger.info("[DRY RUN] 法律法规: %s (约 %d 字)", law["title"], len(law["text"]))
        return records

    # 尝试在线采集
    for keyword in FOOD_SAFETY_KEYWORDS:
        search_url = f"{NPC_FLK_BASE}/api/search"
        logger.info("搜索法律法规: %s", keyword)
        _rate_limit()

        try:
            resp = session.get(
                search_url,
                params={"keyword": keyword, "type": "law"},
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("result", {}).get("data", [])
                for item in results[:5]:  # 每个关键词最多取 5 条
                    title = item.get("title", "")
                    body = item.get("body", item.get("content", ""))
                    if body and len(body) > 50:
                        records.append({
                            "text": f"{title}\n\n{body}",
                            "source": keyword,
                            "category": "法律法规",
                        })
                        logger.info("采集法规: %s", title)
            else:
                logger.warning("法规搜索返回 %d，使用回退数据", resp.status_code)
                raise requests.RequestException("Non-200 status")
        except (requests.RequestException, json.JSONDecodeError, KeyError) as exc:
            logger.warning("法规在线采集失败 (%s)，使用回退数据: %s", keyword, exc)

    # 若在线采集结果不足，补充回退数据
    if len(records) < len(fallback_laws):
        logger.info("在线采集不足，补充 %d 条回退法规数据",
                     len(fallback_laws) - len(records))
        existing_sources = {r["source"] for r in records}
        for law in fallback_laws:
            if law["source"] not in existing_sources:
                records.append({
                    "text": f"{law['title']}\n\n{law['text']}",
                    "source": law["source"],
                    "category": "法律法规",
                })

    return records


# ---------------------------------------------------------------------------
# 写出 JSONL
# ---------------------------------------------------------------------------

def write_jsonl(records: List[Dict], output_path: Path) -> int:
    """
    将记录写入 JSONL 文件。
    返回写入条数。
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(output_path, "w", encoding="utf-8") as f:
        for rec in records:
            # 移除内部临时字段
            clean = {k: v for k, v in rec.items() if not k.startswith("_")}
            f.write(json.dumps(clean, ensure_ascii=False) + "\n")
            count += 1
    return count


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="食品领域语料采集脚本 — 用于领域预训练",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--output-dir", type=str, default=DEFAULT_OUTPUT_DIR,
        help=f"输出目录 (默认: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--max-pages", type=int, default=DEFAULT_MAX_PAGES,
        help=f"食品伙伴网最大采集页数 (默认: {DEFAULT_MAX_PAGES})",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="试运行模式，不实际采集和写入",
    )
    parser.add_argument(
        "--sources", nargs="+",
        choices=["gb", "foodmate", "law", "all"],
        default=["all"],
        help="指定采集来源 (默认: all)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="启用详细日志",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    sources = set(args.sources)
    if "all" in sources:
        sources = {"gb", "foodmate", "law"}

    output_dir = Path(args.output_dir)
    all_records: List[Dict] = []

    logger.info("=" * 60)
    logger.info("食品领域语料采集开始")
    logger.info("输出目录: %s", output_dir.resolve())
    logger.info("采集来源: %s", ", ".join(sorted(sources)))
    logger.info("Dry run: %s", args.dry_run)
    logger.info("=" * 60)

    session = requests.Session()

    # 1. GB 国家标准
    if "gb" in sources:
        logger.info("--- 采集 GB 国家标准 ---")
        gb_records = collect_gb_standards(dry_run=args.dry_run)
        all_records.extend(gb_records)
        logger.info("GB 标准: %d 条", len(gb_records))

    # 2. 食品伙伴网
    if "foodmate" in sources:
        logger.info("--- 采集食品伙伴网技术文档 ---")
        fm_records = collect_foodmate_articles(
            session, max_pages=args.max_pages, dry_run=args.dry_run,
        )
        all_records.extend(fm_records)
        logger.info("食品伙伴网: %d 条", len(fm_records))

    # 3. 法律法规
    if "law" in sources:
        logger.info("--- 采集食品安全法律法规 ---")
        law_records = collect_food_safety_laws(session, dry_run=args.dry_run)
        all_records.extend(law_records)
        logger.info("法律法规: %d 条", len(law_records))

    session.close()

    # 写出结果
    if args.dry_run:
        logger.info("[DRY RUN] 总计将采集 %d 条语料 (未写入)", len(all_records))
    else:
        output_path = output_dir / "food_corpus.jsonl"
        written = write_jsonl(all_records, output_path)
        logger.info("写入完成: %s (%d 条)", output_path.resolve(), written)

        # 统计
        categories = {}
        for r in all_records:
            cat = r.get("category", "未分类")
            categories[cat] = categories.get(cat, 0) + 1

        logger.info("=" * 60)
        logger.info("采集统计:")
        for cat, count in sorted(categories.items()):
            logger.info("  %s: %d 条", cat, count)
        total_chars = sum(len(r["text"]) for r in all_records)
        logger.info("  总字数: %d", total_chars)
        logger.info("=" * 60)


if __name__ == "__main__":
    main()
