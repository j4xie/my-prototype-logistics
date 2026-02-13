# 食品加工知识库 — 完整信息来源与数据集资源库

**编制日期**: 2026-02-11
**总资源数**: 200+ 项

---

## 资源概览

| 类别 | 数量 | 说明 |
|------|------|------|
| GB国家标准 | 50+ | 食品添加剂、微生物检验、卫生规范等 |
| 法律法规 | 8+ | 食品安全法、许可管理、召回管理等 |
| HACCP/ISO/BRC认证 | 10+ | 体系标准与认证要求 |
| 行业白皮书 | 10+ | 年度报告、监测数据、趋势分析 |
| 加工工艺文档 | 17+ | 肉/乳/烘焙/饮料/调味品/冷冻等 |
| SOP操作规程 | 10+ | 原料验收、生产控制、清洗消毒等 |
| NLP数据集 | 23 | FoodEarth/FoodBase/TASTEset/AgCNER等 |
| 知识图谱 | 8 | FoodKG/FoodOn/AGROVOC/OwnThink等 |
| 营养/安全数据库 | 10 | USDA/中国食物成分表/GB 2760等 |
| 行业术语表 | 7 | 中英双语食品工业术语 |
| API与在线平台 | 8+ | Edamam/FDA/食品伙伴网等 |
| 培训材料 | 10+ | HACCP内审/GMP/食品检验员 |
| 科学教材 | 7+ | 食品工艺学/食品化学/微生物学 |
| 设备技术手册 | 5+ | 杀菌/包装/冷链设备 |

---

## 一、核心 NLP 数据集（训练用）

### 1.1 中文首选数据集

| 数据集 | 规模 | 内容 | 获取方式 | 价值 |
|--------|------|------|---------|------|
| **FoodEarth** | 81万+ QA对, 2.5亿Token | 食品营养/安全/工程知识 | FoodSky论文 | ★★★★★ |
| **AgCNER + AgBERT** | 66,553样本/206,992实体 | 农业NER 13类 | [GitHub](https://github.com/guojson/AgCNER/) | ★★★★★ |
| **XiaChuFang** | 152万食谱 | 中文食谱+食材+烹饪步骤 | [OpenDataLab](https://opendatalab.org.cn) | ★★★★★ |
| **FoodieQA** | 389图/350菜品/14菜系 | 中文多模态食品QA | [HuggingFace](https://huggingface.co/datasets/lyan62/FoodieQA) | ★★★★★ |
| **OwnThink** | 14亿三元组 | 中文KG含食品实体 | [GitHub](https://github.com/ownthink/KnowledgeGraphData) | ★★★★☆ |
| **中国食物成分表** | 全品类营养数据 | 蛋白/脂肪/维生素等 | [在线查询](https://nlc.chinanutri.cn/fq/) | ★★★★★ |
| **CookBook-KG** | 从下厨房构建 | 菜品-食材-工艺关系 | [GitHub](https://github.com/ngl567/CookBook-KG) | ★★★★☆ |
| **ChineseFoodNet** | 18万+图/208类 | 中式菜品图像 | [OpenDataLab](https://opendatalab.com/OpenDataLab/ChineseFoodNet) | ★★★★☆ |

### 1.2 英文核心数据集

| 数据集 | 规模 | 内容 | 获取方式 | 价值 |
|--------|------|------|---------|------|
| **FoodBase Corpus** | 12,844实体/274,053弱标注 | 食品NER基准 | [Oxford Academic](https://academic.oup.com/database/article/doi/10.1093/database/baz121/5611291) | ★★★★★ |
| **Recipe1M+** | 100万食谱+1300万图片 | 跨模态食谱 | [MIT](https://im2recipe.csail.mit.edu/) | ★★★★★ |
| **TASTEset** | 13,000+实体标注 | 食材/数量/工艺细粒度NER | [GitHub](https://github.com/taisti/TASTEset-2.0) | ★★★★☆ |
| **RecipeDB** | 118,171食谱/20,262食材 | 全球食谱结构化KB | [CosyLab](https://cosylab.iiitd.edu.in/recipedb) | ★★★★☆ |
| **Food-101** | 101类/101,000图 | 食物图像分类 | [HuggingFace](https://huggingface.co/datasets/ethz/food101) | ★★★★☆ |
| **USDA FoodData** | 8000+食品 | 营养成分权威库 | [API](https://fdc.nal.usda.gov/api-guide/) | ★★★★★ |
| **SemEval-2025** | 6,644条召回文本 | 食品安全危害检测 | [竞赛官网](https://food-hazard-detection-semeval-2025.github.io/) | ★★★★☆ |

### 1.3 知识图谱

| 知识图谱 | 规模 | 获取方式 | 价值 |
|----------|------|---------|------|
| **FoodKG** | 6700万RDF三元组 | [论文](http://www.cs.rpi.edu/~zaki/PaperDir/ISWC19.pdf) | ★★★★★ |
| **FoodOn** | 41,400概念/1.2M多语言术语 | [foodon.org](https://foodon.org/) | ★★★★★ |
| **AGROVOC** | 41,400概念/42种语言 | [FAO](https://agrovoc.fao.org/) | ★★★★★ |
| **OwnThink** | 14亿三元组 | [GitHub](https://github.com/ownthink/KnowledgeGraphData) | ★★★★☆ |

### 1.4 预训练模型

| 模型 | 语言 | 获取方式 |
|------|------|---------|
| FoodBaseBERT-NER | 英文 | [HuggingFace](https://huggingface.co/Dizex/FoodBaseBERT-NER) |
| InstaFoodRoBERTa-NER | 英文 | [HuggingFace](https://huggingface.co/Dizex/InstaFoodRoBERTa-NER) |
| AgBERT | 中文 | [GitHub](https://github.com/guojson/AgCNER/) |
| RecipeBERT | 英文 | [HuggingFace](https://huggingface.co/alexdseo/RecipeBERT) |

---

## 二、GB 国家标准（食品安全核心）

### 2.1 通用食品安全标准

| 标准号 | 名称 | 实施日期 | 获取方式 |
|--------|------|---------|---------|
| GB 2760-2024 | 食品添加剂使用标准 | 2025-02-08 | [在线查询](https://gb2760.cfsa.net.cn/) |
| GB 7718-2025 | 预包装食品标签通则 | 2027-03-16 | 国家卫健委公告 |
| GB 14881-2025 | 食品生产通用卫生规范 | 2026-09-02 | 免费下载 |
| GB 2761-2017 | 食品中真菌毒素限量 | - | 免费下载 |
| GB 2762-2025 | 食品中污染物限量 | 2026-09-02 | 免费下载 |
| GB 29921-2021 | 预包装食品中致病菌限量 | 2021-11-22 | 免费下载 |
| GB 14880 | 食品营养强化剂使用标准 | - | 免费查阅 |

### 2.2 微生物检验系列 (GB 4789)
- GB 4789.1 总则
- GB 4789.2 菌落总数测定
- GB 4789.4 沙门氏菌检验
- 等30+项检验标准

### 2.3 理化检验系列 (GB 5009)
- 铅、汞、砷、镉、农药残留等检测方法

### 2.4 标准查询平台
- [食品安全国家标准检索](https://sppt.cfsa.net.cn:8086/db) — 1610项标准/2万+指标/340+食品种类
- [全国标准信息平台](https://std.samr.gov.cn/)

---

## 三、法律法规

| 法规名称 | 发布机构 | 获取方式 |
|----------|---------|---------|
| 食品安全法(2021修正) | 全国人大 | [法律法规数据库](https://flk.npc.gov.cn) |
| 食品安全法实施条例 | 国务院 | 免费查阅 |
| 农产品质量安全法 | 全国人大 | 免费查阅 |
| 食品生产许可管理办法(2020) | 市场监管总局 | [gov.cn](https://www.gov.cn) |
| 食品经营许可管理办法 | 市场监管总局 | 免费查阅 |
| 食品召回管理办法(2020修订) | 市场监管总局 | 免费查阅 |

---

## 四、HACCP/ISO/认证标准

| 标准 | 说明 | 获取方式 |
|------|------|---------|
| GB/T 27341-2009 | HACCP体系 食品生产企业通用要求 | 需购买 |
| ISO 22000:2018 | 食品安全管理体系 | ISO官网(购买) |
| FSSC 22000 | 基于ISO 22000+额外要求(GFSI认可) | 认证机构 |
| BRC第9版 | 英国零售商协会全球标准 | [brcgs.com](https://www.brcgs.com) |
| IFS第8版 | 国际食品标准(欧洲) | IFS官网 |
| SQF | 安全质量食品(美国) | SQF官网 |
| HACCP计划指南(USDA中文) | 美国FSIS制定指南 | [USDA PDF](https://www.fsis.usda.gov/sites/default/files/media_file/documents/FSIS-GD-2020-0008-Chinese.pdf) |

---

## 五、行业白皮书与报告

| 报告 | 机构 | 关键数据 |
|------|------|---------|
| 2024中国食品产业运行趋势报告 | 中国食品工业协会 | 营收90652.5亿/利润6431.7亿 |
| 2024食品安全抽检报告 | 市场监管总局 | 合格率97.04% |
| 2024农产品质量监测 | 农业农村部 | 合格率98% |
| 中国食品工业年鉴 | 食品工业协会 | 年度统计 |
| 进一步强化食品安全全链条监管(2025) | 中央办公厅 | 政策方向 |

---

## 六、加工工艺技术文档

### 各品类工艺
- **肉制品**: GB31661-2025 调制肉制品卫生规范、肉制品生产许可审查细则
- **乳制品**: 巴氏杀菌(63°C/30min或72°C/15s)、UHT(135-150°C/2-5s)、发酵(42°C/8h)
- **烘焙食品**: 食品工艺学教材、职业教育实训教程
- **饮料**: 果汁/碳酸/茶饮料生产线工艺
- **调味品**: 酱油酿造(高盐稀态发酵)、食醋、酱料
- **冷冻食品**: 速冻水饺工艺、预制菜生产规范
- **休闲食品**: 薯片/坚果/糖果加工

### SOP模板
- [食品伙伴网SOP资源库](https://wenku.foodmate.net/tag_26.html)
- 原料验收、生产工艺、成品检验、清洗消毒SOP

---

## 七、关键平台与数据库

| 平台 | URL | 内容 |
|------|-----|------|
| 食品伙伴网 | [foodmate.net](https://www.foodmate.net/) | 标准/法规/工艺/论坛(中文第一门户) |
| 食品安全标准检索 | [sppt.cfsa.net.cn](https://sppt.cfsa.net.cn:8086/db) | 1610项标准检索 |
| GB 2760查询 | [gb2760.cfsa.net.cn](https://gb2760.cfsa.net.cn/) | 食品添加剂标准查询 |
| 食品安全抽检查询 | [spcjsac.gsxt.gov.cn](https://spcjsac.gsxt.gov.cn/) | 全国抽检数据 |
| 中国食物成分表 | [nlc.chinanutri.cn](https://nlc.chinanutri.cn/fq/) | 营养成分查询 |
| 食品伙伴网数据库 | [db.foodmate.net](https://db.foodmate.net/) | 添加剂/原料/标准 |
| OpenFDA | [open.fda.gov](https://open.fda.gov/apis/food/enforcement/) | 美国食品执法API |
| RASFF Window | [ec.europa.eu](https://webgate.ec.europa.eu/rasff-window/screen/list) | 欧盟食品安全预警 |
| Codex Alimentarius | [fao.org](https://www.fao.org/fao-who-codexalimentarius/en/) | 国际食品标准 |
| HuggingFace | [huggingface.co](https://huggingface.co/datasets) | NLP数据集/模型 |
| OpenDataLab | [opendatalab.com](https://opendatalab.com/) | 中文数据集平台 |
| ModelScope | [modelscope.cn](https://modelscope.cn/datasets) | 阿里开源数据集 |

---

## 八、食品行业术语资源

| 术语表 | 语言 | 获取方式 |
|--------|------|---------|
| GB/T 15091-1994 食品工业基本术语 | 中英 | [std.samr.gov.cn](https://std.samr.gov.cn/) |
| HACCP/GMP专业术语 | 中英 | 行业标准 |
| 食品添加剂中英文名称对照 | 中英 | GB 2760附录 + [db.foodmate.net](https://db.foodmate.net/additive/) |
| AGROVOC | 42语言 | [agrovoc.fao.org](https://agrovoc.fao.org/) |
| FoodOn本体 | 42语言 | [foodon.org](https://foodon.org/) |

---

## 九、数据集成建议

### 分层架构
```
第1层: 术语层 — AGROVOC + FoodOn + GB术语标准
第2层: 结构化数据层 — USDA营养 + 中国食物成分表 + GB 2760
第3层: 知识图谱层 — FoodKG + OwnThink食品子集 + CookBook-KG
第4层: 非结构化文本层 — FoodEarth(81万QA) + 食品伙伴网 + 下厨房
第5层: 事件数据层 — FDA召回 + RASFF + 国家抽检数据
```

### 推荐获取优先级
1. **立即获取(免费/开源)**: AgCNER, FoodBase, FoodOn, AGROVOC, USDA API, GB标准
2. **短期获取(需申请)**: FoodEarth, Recipe1M+, 中国食物成分表在线版
3. **中期构建(需爬虫)**: 食品伙伴网论坛, 下厨房食谱, 知乎食品话题
4. **长期积累(需标注)**: 企业内部SOP, 检测报告, 工艺文档
