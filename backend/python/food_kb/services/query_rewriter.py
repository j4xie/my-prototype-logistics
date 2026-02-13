"""
食品知识库查询改写服务
Query Rewriting for food knowledge RAG — Phase 3 optimization.

Strategies:
  1. Rule-based synonym/term expansion (zero latency)
  2. Multi-query decomposition for complex cross-domain queries
  3. Optional LLM query rewriting for ambiguous queries (adds ~500ms)

Pipeline integration:
  Original query → expand_query() → multiple search queries → merge results
"""

import logging
import re
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)


# ─── Rule-based synonym/term expansion tables ──────────────────────────

# Map common terms to technical equivalents that appear in document titles/content
# Format: (trigger_pattern, expansion_terms_to_append)
SYNONYM_EXPANSIONS: List[Tuple[str, List[str]]] = [
    # Materials & equipment
    (r"不锈钢.*(304|316)", ["食品接触材料", "GB 4806", "金属材料"]),
    (r"食品.*(接触|包装).*(材料|容器)", ["GB 4806", "迁移量"]),

    # Emergency & incidents
    (r"(应对|处理|处置).*(食品安全|安全事件|安全事故)", ["应急响应", "事故分级", "召回"]),
    (r"食品.*召回", ["应急响应", "事故", "食品安全事件"]),
    (r"食品.*舆情", ["危机公关", "食品安全事件"]),

    # Microbe + meat cross-domain
    (r"(肉制品|肉类).*(李斯特|沙门|致病菌|微生物)", ["肉制品加工", "微生物控制", "冷藏"]),
    (r"(李斯特|沙门).*(肉制品|肉类|冷藏)", ["肉制品加工", "微生物控制"]),

    # Standards quick-lookup
    (r"GB\s*2760", ["食品添加剂使用标准"]),
    (r"GB\s*2761", ["真菌毒素限量"]),
    (r"GB\s*2762", ["污染物限量"]),
    (r"GB\s*2763", ["农药最大残留限量"]),
    (r"GB\s*4789", ["微生物检验"]),
    (r"GB\s*5009", ["食品检验方法"]),
    (r"GB\s*7718", ["预包装食品标签"]),
    (r"GB\s*14880", ["营养强化剂"]),
    (r"GB\s*14881", ["食品生产通用卫生规范"]),
    (r"GB\s*28050", ["营养标签", "NRV"]),
    (r"GB\s*29921", ["致病菌限量"]),
    (r"GB\s*31621", ["食品经营过程卫生规范"]),

    # Additive categories
    (r"防腐剂", ["山梨酸", "苯甲酸", "脱氢乙酸"]),
    (r"甜味剂", ["阿斯巴甜", "三氯蔗糖", "甜蜜素", "赤藓糖醇"]),
    (r"着色剂|色素", ["日落黄", "柠檬黄", "诱惑红", "胭脂红"]),
    (r"增稠剂", ["卡拉胶", "黄原胶", "瓜尔胶"]),
    (r"乳化剂", ["单甘酯", "卵磷脂", "蔗糖酯"]),
    (r"抗氧化剂", ["TBHQ", "BHA", "BHT", "维生素E"]),

    # Process terms
    (r"巴氏杀菌|HTST|LTLT", ["乳制品杀菌", "巴氏"]),
    (r"UHT|超高温", ["灭菌乳", "超高温瞬时"]),
    (r"商业无菌", ["罐头", "杀菌", "F值"]),
    (r"速冻", ["急速冷冻", "IQF", "-30℃"]),
    (r"冷链", ["温度控制", "冷藏运输", "断链"]),

    # Contaminants
    (r"重金属", ["铅", "镉", "汞", "砷"]),
    (r"农药残留", ["草甘膦", "有机磷", "拟除虫菊酯"]),
    (r"兽药残留", ["氯霉素", "呋喃唑酮", "瘦肉精"]),
    (r"瘦肉精", ["盐酸克伦特罗", "莱克多巴胺", "兽药"]),

    # Certification & regulation
    (r"有机.*(食品|认证)", ["有机产品", "GB/T 19630", "认证"]),
    (r"SC证|生产许可", ["食品生产许可", "许可证", "审查"]),
    (r"HACCP", ["危害分析", "关键控制点", "CCP"]),
    (r"ISO\s*22000", ["食品安全管理体系", "FSMS"]),
    (r"FSSC\s*22000", ["食品安全体系认证", "ISO 22000"]),
    (r"BRC", ["全球食品安全标准", "BRCGS"]),

    # Microbe names → full names
    (r"李斯特菌", ["单核细胞增生李斯特菌", "单增李斯特"]),
    (r"沙门氏菌", ["沙门菌", "Salmonella"]),
    (r"大肠杆菌.*O157", ["产志贺毒素大肠杆菌", "STEC"]),
    (r"金葡菌|金黄色葡萄球菌", ["肠毒素", "Staphylococcus aureus"]),
    (r"阪崎", ["克罗诺杆菌", "Cronobacter sakazakii"]),

    # Industry sectors
    (r"中央厨房", ["团餐", "集体供餐", "配送"]),
    (r"预制菜", ["即食即热", "中央厨房", "冷链配送"]),
    (r"保健食品", ["功能声称", "注册备案", "特殊食品"]),
    (r"婴幼儿.*配方", ["婴幼儿食品", "特殊膳食", "阪崎"]),
    (r"进口食品", ["检验检疫", "海关", "报关"]),
    (r"电商食品|网络食品", ["电子商务", "网购", "平台责任"]),

    # ── Weak-category expansions (eval round: 9 categories MRR<0.9) ──

    # beverage (MRR 0.75) — 饮料生产、CIP清洗、果汁标注
    (r"饮料.*(生产|加工|车间|工艺|灌装)", ["饮料生产卫生规范", "GB 12695", "CIP清洗"]),
    (r"(果汁|果蔬汁).*(含量|标注|标签|比例)", ["果汁含量标注", "饮料", "GB 7101"]),
    (r"矿泉水|天然泉水|纯净水|饮用水", ["饮用水", "GB 8537", "GB 19298", "饮料"]),
    (r"碳酸饮料|汽水|气泡水", ["碳酸饮料", "CO2含量", "饮料", "GB 7101"]),
    (r"CIP.*清洗|清洗.*系统|就地清洗", ["CIP清洗", "饮料生产", "管道清洗", "卫生规范"]),
    (r"饮料.*(CIP|清洗|消毒)", ["CIP清洗系统", "饮料生产卫生规范", "GB 12695"]),
    (r"(茶饮|奶茶|咖啡).*(生产|加工|标准)", ["饮料", "饮料生产", "茶饮料", "GB 21733"]),
    (r"(功能|能量|运动|蛋白).*(饮料|饮品)", ["饮料", "特殊用途饮料", "功能饮料"]),
    (r"植物基.*饮", ["植物蛋白饮料", "饮料", "GB/T 30885"]),

    # novel_food (MRR 0.75) — 新食品原料、新资源食品
    (r"新食品原料|新资源食品|新食品", ["新食品原料", "安全性评估", "卫生部公告", "实质等同"]),
    (r"(没人|没有人|以前没|从来没).*(吃过|食用|使用)", ["新食品原料", "安全性评估", "实质等同"]),
    (r"(没见过|没听过|不认识|稀有|稀奇|罕见).*(食材|原料|食品|食物)", ["新食品原料", "安全性评估", "实质等同"]),
    (r"(新的|新型|新奇|陌生).*(食品原料|食材|原料|食物)", ["新食品原料", "安全性评估", "卫生部公告"]),
    (r"(能不能|可以|可否|允许).*(直接|拿来|用来).*(做食品|卖|生产|加工)", ["新食品原料", "安全性评估", "食品生产许可"]),
    (r"(药食同源|药食两用)", ["药食同源", "新食品原料", "卫生部公告", "既是食品又是药品"]),
    (r"实质等同", ["新食品原料", "安全性评估", "实质等同"]),

    # aquatic (MRR 0.77) — 水产品、海鲜、组胺
    (r"水产品|水产.*(加工|养殖|检测)", ["水产品", "水产品加工", "GB 2733", "兽药残留"]),
    (r"海鲜|海产品|海产", ["水产品", "海产品", "水产品加工", "GB 2733"]),
    (r"(鱼|虾|蟹|贝|蚝|蛤|蛏|螺|海参|鲍鱼|鱿鱼).*(加工|检测|标准|养殖|鲜度)", ["水产品", "水产品加工", "鲜度", "GB 2733"]),
    (r"组胺|鲭鱼毒素|青皮红肉鱼", ["组胺", "水产品", "鲜度", "高组胺鱼", "GB 2733"]),
    (r"(寄生虫|异尖).*(鱼|水产|海鲜|生食)", ["水产品", "寄生虫", "生食水产品", "冷冻杀灭"]),
    (r"(甲醛|甲醛次硫酸|吊白块).*(水产|海鲜|鱼)", ["水产品", "非法添加", "甲醛"]),
    (r"(生食|刺身|寿司).*(水产|鱼|海鲜)", ["生食水产品", "水产品", "寄生虫", "微生物"]),

    # catering (MRR 0.81) — 餐饮服务、食堂、明厨亮灶
    (r"餐饮.*(服务|经营|管理|卫生|安全|规范)", ["餐饮服务", "食品经营", "GB 31654", "餐饮服务食品安全"]),
    (r"食堂|团餐|集体用餐|集体食堂", ["餐饮服务", "食堂", "集体用餐", "GB 31654"]),
    (r"明厨亮灶|透明厨房|阳光厨房", ["明厨亮灶", "餐饮服务", "食品安全管理"]),
    (r"(外卖|外送|配送).*(食品|餐饮|安全)", ["餐饮服务", "网络餐饮", "外卖配送", "食品安全"]),
    (r"(后厨|厨房).*(管理|卫生|规范|操作|清洁)", ["餐饮服务", "后厨管理", "GB 31654", "操作规范"]),
    (r"(学校|校园|幼儿园|养老院|医院).*(食堂|用餐|供餐|膳食)", ["餐饮服务", "集体用餐", "食堂", "学校食品安全"]),
    (r"餐饮.*许可|食品经营许可", ["餐饮服务", "食品经营许可", "许可证"]),
    (r"(餐具|碗筷|餐盘).*(消毒|清洗|检测)", ["餐饮服务", "餐饮具消毒", "GB 14934"]),

    # edible_oil (MRR 0.81) — 食用油、植物油、酸价、过氧化值
    (r"食用油|食用植物油|烹调油", ["食用植物油", "GB 2716", "食用油脂", "食品安全标准"]),
    (r"(植物油|花生油|大豆油|菜籽油|葵花油|芝麻油|橄榄油|棕榈油|玉米油)", ["食用植物油", "GB 2716", "食用油"]),
    (r"(酸价|酸值).*(超标|检测|标准|限量|限值)", ["食用油", "酸价", "GB 2716", "油脂酸败"]),
    (r"(过氧化值|POV).*(超标|检测|标准|限量|限值)", ["食用油", "过氧化值", "GB 2716", "油脂氧化"]),
    (r"(地沟油|废弃油|回收油)", ["食用油", "非法", "废弃油脂", "食品安全"]),
    (r"(煎炸油|煎炸用油|反复.*油)", ["食用油", "煎炸过程", "极性组分", "酸价"]),
    (r"(黄曲霉毒素|AFB1).*(油|花生|粮)", ["黄曲霉毒素", "食用油", "花生", "GB 2761"]),
    (r"油脂.*(酸败|哈喇|变质|氧化)", ["食用油", "酸价", "过氧化值", "油脂氧化"]),

    # bakery (MRR 0.85) — 烘焙、面包、糕点
    (r"烘焙.*(食品|产品|加工|生产|工艺)", ["烘焙食品", "糕点", "面包", "GB 7099"]),
    (r"面包.*(生产|加工|发酵|保质|防腐|标准)", ["面包", "烘焙食品", "糕点", "GB 7099"]),
    (r"(糕点|蛋糕|月饼|饼干|曲奇|酥饼|派).*(标准|加工|生产|检测)", ["糕点", "烘焙食品", "GB 7099"]),
    (r"(饼干|曲奇|威化|苏打饼)", ["饼干", "烘焙食品", "GB 7100"]),
    (r"(铝|明矾|硫酸铝|含铝).*(膨松|泡打粉|油条|面制品)", ["含铝膨松剂", "烘焙", "铝残留", "GB 2760"]),
    (r"(丙烯酰胺|反式脂肪).*(烘焙|面包|饼干|糕点)", ["烘焙食品", "丙烯酰胺", "加工污染物"]),

    # grain (MRR 0.87) — 粮食、大米、面粉、谷物
    (r"粮食.*(安全|质量|储存|加工|标准|检测)", ["粮食", "粮食安全", "谷物", "GB 2715"]),
    (r"(大米|稻米|稻谷).*(标准|质量|检测|加工|重金属|镉)", ["大米", "粮食", "GB/T 1354", "GB 2762"]),
    (r"(面粉|小麦粉).*(标准|质量|检测|加工|增白|过氧化苯甲酰)", ["面粉", "小麦粉", "粮食", "GB/T 1355"]),
    (r"(谷物|杂粮|玉米|燕麦|荞麦|高粱|小米).*(加工|标准|质量)", ["谷物", "粮食", "GB 2715"]),
    (r"(真菌毒素|脱氧雪腐|呕吐毒素|DON|玉米赤霉|伏马毒素).*(粮|谷|面|米|麦)", ["真菌毒素", "粮食", "GB 2761"]),
    (r"(粮食|谷物).*(储存|仓储|储藏|虫害|霉变)", ["粮食储存", "粮食安全", "虫害", "霉变"]),

    # contact_material (MRR 0.88) — 食品接触材料补充规则
    (r"(塑料|PE|PP|PET|PS|PC).*(食品|接触|包装|容器|迁移)", ["食品接触材料", "塑料", "GB 4806.7", "迁移量"]),
    (r"(橡胶|硅胶).*(食品|接触|密封|垫圈)", ["食品接触材料", "橡胶", "GB 4806.11", "迁移量"]),
    (r"(陶瓷|搪瓷|玻璃).*(食品|接触|餐具|容器)", ["食品接触材料", "陶瓷", "GB 4806.5", "铅镉溶出"]),
    (r"(纸|纸板|纸杯|纸碗).*(食品|接触|包装)", ["食品接触材料", "纸", "GB 4806.8", "荧光物质"]),
    (r"迁移量|迁移.*(测试|检测|限量|总量)", ["食品接触材料", "总迁移量", "特定迁移", "GB 31604"]),
    (r"(涂层|涂料).*(食品|接触|内壁|容器)", ["食品接触材料", "涂层", "GB 4806.10"]),
    (r"(双酚A|BPA|邻苯二甲酸)", ["食品接触材料", "塑料", "迁移量", "GB 4806"]),

    # traceability (MRR 0.88) — 追溯、溯源、批次管理
    (r"追溯|溯源|追踪|可追溯", ["食品追溯", "溯源体系", "追溯系统", "批次管理"]),
    (r"(一物一码|二维码|条码|条形码).*(追溯|溯源|食品|扫码)", ["食品追溯", "一物一码", "溯源码", "信息化"]),
    (r"批次.*(管理|追溯|号|编码|记录|追踪)", ["批次管理", "食品追溯", "批次追溯", "生产记录"]),
    (r"(区块链|blockchain).*(食品|追溯|溯源)", ["食品追溯", "区块链溯源", "防伪"]),
    (r"(来源|去向|流向).*(追溯|追查|追踪|查询)", ["食品追溯", "溯源", "供应链追溯"]),
    (r"(进货|采购|销售).*(台账|记录|追溯)", ["食品追溯", "台账", "进货查验", "索证索票"]),
    (r"(索证索票|索证|索票)", ["食品追溯", "进货查验", "索证索票", "供应商管理"]),
    (r"(产品.*召回|召回.*追溯)", ["食品追溯", "召回", "批次追溯", "应急响应"]),

    # ── Vague query pattern expansions (模糊查询 MRR=0.79) ──

    # Vague "never eaten before" → novel_food
    (r"(以前|从前|过去).*没.*(吃|食用|见|用).*的.*(东西|食品|食材|食物|原料|产品)", ["新食品原料", "安全性评估", "实质等同"]),
    (r"(稀有|奇特|特殊|少见|罕见|新型).*(食品原料|食材|原料|成分)", ["新食品原料", "安全性评估", "卫生部公告"]),
    (r"(能不能|可不可以|能否|是否可以).*(做食品|当食品|做原料|卖|售卖|上市|销售)", ["新食品原料", "食品安全", "食品生产许可", "安全性评估"]),

    # Vague cleaning system queries → CIP in food context
    (r"(清洗|清洁).*(系统|设备|流程|规范|SOP).*(食品|饮料|乳品|乳制品|生产)", ["CIP清洗", "卫生规范", "清洗消毒"]),
    (r"(食品|饮料|乳品|乳制品|生产).*(清洗|清洁).*(系统|设备|流程|规范|SOP)", ["CIP清洗", "卫生规范", "清洗消毒"]),

    # Vague food safety questions
    (r"(怎么|如何).*(知道|判断|辨别|区分).*(安全|合格|有问题|能不能吃)", ["食品安全", "检测", "标准", "合格"]),
    (r"(吃了|误食|误服).*(会不会|会|会怎样|有没有).*(中毒|问题|危害)", ["食品安全", "食物中毒", "食品安全事件"]),
]


# Multi-query decomposition patterns
# When a query mentions multiple distinct entities, split into sub-queries
DECOMPOSE_PATTERNS: List[Tuple[str, List[str]]] = [
    # "A和B的..." → search both A and B separately
    (r"(.+[菌毒素剂])和(.+[菌毒素剂])的(.+)",
     ["{0}的{2}", "{1}的{2}"]),
    # "A与B的区别/对比" → search both
    (r"(.+)与(.+)的(区别|对比|比较|差异)",
     ["{0}", "{1}"]),
    # "A和B的区别" (using 和)
    (r"(.+)和(.+)的(区别|对比|比较|差异)",
     ["{0}", "{1}"]),
]


class QueryRewriter:
    """
    Query rewriting for food knowledge RAG.

    Zero-cost rule-based expansion for most queries.
    Optional LLM rewriting for edge cases.
    """

    def __init__(self):
        self._llm_fn = None
        self._stats = {"expansions": 0, "decompositions": 0, "llm_rewrites": 0}

    def configure(self, llm_fn=None):
        """Configure optional LLM rewriting function.

        Args:
            llm_fn: async callable(prompt) -> str, or None to disable LLM rewriting
        """
        self._llm_fn = llm_fn

    @property
    def stats(self) -> dict:
        return dict(self._stats)

    def expand_query(self, query: str) -> str:
        """
        Expand query with synonym/term additions.

        Rule-based, zero latency. Appends relevant technical terms
        that help vector and BM25 search find the right documents.

        Args:
            query: Original user query

        Returns:
            Expanded query string (original + appended terms)
        """
        expansions = set()

        for pattern, terms in SYNONYM_EXPANSIONS:
            if re.search(pattern, query, re.IGNORECASE):
                for t in terms:
                    # Don't add terms already in the query
                    if t.lower() not in query.lower():
                        expansions.add(t)

        if expansions:
            self._stats["expansions"] += 1
            expanded = f"{query} {' '.join(expansions)}"
            logger.debug(
                f"Query expanded: '{query[:40]}...' → +{len(expansions)} terms: "
                f"{', '.join(list(expansions)[:5])}"
            )
            return expanded

        return query

    def decompose_query(self, query: str) -> List[str]:
        """
        Decompose complex multi-entity queries into sub-queries.

        Returns multiple queries when the original mentions distinct entities
        that should be searched separately and results merged.

        Args:
            query: Original user query

        Returns:
            List of queries (length 1 if no decomposition needed)
        """
        for pattern, templates in DECOMPOSE_PATTERNS:
            m = re.search(pattern, query)
            if m:
                groups = m.groups()
                sub_queries = []
                for tmpl in templates:
                    try:
                        sq = tmpl.format(*groups)
                        sub_queries.append(sq.strip())
                    except (IndexError, KeyError):
                        continue

                if len(sub_queries) >= 2:
                    self._stats["decompositions"] += 1
                    logger.debug(
                        f"Query decomposed: '{query[:40]}...' → "
                        f"{len(sub_queries)} sub-queries"
                    )
                    # Also include the original expanded query
                    return [self.expand_query(query)] + [
                        self.expand_query(sq) for sq in sub_queries
                    ]

        # No decomposition — return single expanded query
        return [self.expand_query(query)]

    def rewrite(self, query: str) -> List[Tuple[str, str]]:
        """
        Full query rewriting pipeline.

        1. Rule-based synonym expansion
        2. Multi-query decomposition (if applicable)

        Returns list of (raw_query, expanded_query) tuples.
        - raw_query: for vector search (preserves embedding focus)
        - expanded_query: for BM25 search + reranker (adds domain terms)

        Usually 1 tuple, sometimes 2-3 for decomposed queries.
        """
        expanded = self.expand_query(query)

        # Try decomposition
        for pattern, templates in DECOMPOSE_PATTERNS:
            m = re.search(pattern, query)
            if m:
                groups = m.groups()
                sub_queries = []
                for tmpl in templates:
                    try:
                        sq = tmpl.format(*groups).strip()
                        sub_queries.append(sq)
                    except (IndexError, KeyError):
                        continue

                if len(sub_queries) >= 2:
                    self._stats["decompositions"] += 1
                    logger.debug(
                        f"Query decomposed: '{query[:40]}...' → "
                        f"{len(sub_queries)} sub-queries"
                    )
                    result = [(query, expanded)]
                    for sq in sub_queries:
                        sq_expanded = self.expand_query(sq)
                        result.append((sq, sq_expanded))
                    return result

        return [(query, expanded)]


# ── Global singleton ──
_rewriter_instance: Optional[QueryRewriter] = None


def get_query_rewriter() -> QueryRewriter:
    global _rewriter_instance
    if _rewriter_instance is None:
        _rewriter_instance = QueryRewriter()
    return _rewriter_instance
