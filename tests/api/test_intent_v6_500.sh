#!/bin/bash

# ================================================
# 意图识别系统 v6.0 测试 - 500个真实场景用例
# 设计原则: 从真实工厂岗位人员视角，完全口语化表达
# 10个场景分类: P W Q S E C H M U X
# ================================================

API_BASE="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 统计变量
PASSED=0
FAILED=0
TOTAL=0

# 获取Token
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  意图识别系统 v6.0 测试 - 500个真实场景用例${NC}"
echo -e "${BLUE}  设计原则: 从真实工厂岗位人员视角${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}[INFO] 登录获取Token...${NC}"

LOGIN_RESP=$(curl -s -X POST "${API_BASE}/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}[ERROR] 登录失败${NC}"
  exit 1
fi

echo -e "${GREEN}[OK] Token获取成功${NC}"
echo ""

# 测试函数
test_intent() {
  local input="$1"
  local expected="$2"
  local category="$3"

  ((TOTAL++))

  local result=$(curl -s -X POST "${API_BASE}/${FACTORY_ID}/ai-intents/recognize" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\":\"$input\"}" --max-time 15 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('intentCode',''))" 2>/dev/null)

  if [ -z "$result" ]; then
    result="NONE"
  fi

  if [ "$result" = "$expected" ]; then
    ((PASSED++))
    echo -e "${GREEN}✓${NC} [$category] $input → $result"
  else
    ((FAILED++))
    echo -e "${RED}✗${NC} [$category] $input → Got: $result, Expected: $expected"
  fi
}

# 测试LLM fallback/澄清
test_clarify() {
  local input="$1"
  local expected_status="$2"
  local category="$3"

  ((TOTAL++))

  local response=$(curl -s -X POST "${API_BASE}/${FACTORY_ID}/ai-intents/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\":\"$input\"}" --max-time 15)

  local status=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    ((PASSED++))
    echo -e "${GREEN}✓${NC} [$category] $input → status=$status"
  else
    ((FAILED++))
    echo -e "${RED}✗${NC} [$category] $input → Got: $status, Expected: $expected_status"
  fi
}

echo "================================================"
echo "开始测试..."
echo "================================================"
echo ""

# ==================== P类: 生产车间主管视角 (60个) ====================
echo -e "${CYAN}=== P类: 生产车间主管视角 (60) ===${NC}"

# P001-P010: 产量相关
test_intent "小王那边今天干得怎么样了，产量出来没" "REPORT_PRODUCTION" "P-产量"
test_intent "3号线从早上到现在一共出了多少" "REPORT_PRODUCTION" "P-产量"
test_intent "把这周的产量给我拉一下，我要汇报" "REPORT_PRODUCTION" "P-产量"
test_intent "最近哪个产品做得最多" "REPORT_PRODUCTION" "P-产量"
test_intent "这个月到现在为止，咱们车间产值多少了" "REPORT_PRODUCTION" "P-产量"
test_intent "今儿一天下来能做完这些不" "REPORT_PRODUCTION" "P-产量"
test_intent "昨天夜班的产量跟白班比怎么样" "REPORT_PRODUCTION" "P-产量"
test_intent "A产品上礼拜总共做了多少" "REPORT_PRODUCTION" "P-产量"
test_intent "今天早上开工到现在，产出情况给我说说" "REPORT_PRODUCTION" "P-产量"
test_intent "这几天产量一直上不去是咋回事" "REPORT_PRODUCTION" "P-产量"

# P011-P020: 批次相关
test_intent "昨天夜班那个批次做完没有" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "今天排的活儿都干完了吗" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "现在在做的这些，预计什么时候能做完" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "手里还有几个批次没开工" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "张师傅那边的活儿进行到哪一步了" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "这批货什么时候能交" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "看看车间里现在同时在做几个批次" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "今天还能再接个急活儿不" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "上午那个批次卡在哪个环节了" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "这礼拜的生产任务排得满不满" "PROCESSING_BATCH_LIST" "P-批次"

# P021-P030: 任务分配
test_intent "帮我看看下午还有多少活儿没安排人" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "张师傅请假了，他那边的活谁接了" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "新来的小李今天干的什么活" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "下午的活儿给谁安排了" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "这个产品一般谁做得好" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "明天的活儿排好了没" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "今天加班的有几个人" "ATTENDANCE_QUERY" "P-任务"
test_intent "谁今天干的活最多" "REPORT_PRODUCTION" "P-任务"
test_intent "3号线今天安排的是谁" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "急单给谁做比较合适" "PROCESSING_BATCH_LIST" "P-任务"

# P031-P040: 新建批次
test_intent "帮我建个新批次，客户要得急" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "这个订单要开始做了，先建个生产任务" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "刚接的急单，赶紧给排上" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "新来的订单录一下" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "这批货要开始了，帮我登记一下" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "安排个新的生产任务" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "把这个订单排进生产计划" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "客户又加单了，建个新批次" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "这个产品要返工，重新建个批次" "PROCESSING_BATCH_CREATE" "P-新建"
test_intent "明天的活儿先建好" "PROCESSING_BATCH_CREATE" "P-新建"

# P041-P050: 批次操作
test_intent "这个批次可以开始了，帮我启动" "PROCESSING_BATCH_START" "P-操作"
test_intent "3号线那个批次做完了，给结束掉" "PROCESSING_BATCH_COMPLETE" "P-操作"
test_intent "先停一下，机器要调整" "PROCESSING_BATCH_PAUSE" "P-操作"
test_intent "这批不做了，取消掉" "PROCESSING_BATCH_CANCEL" "P-操作"
test_intent "暂时停一下这个批次" "PROCESSING_BATCH_PAUSE" "P-操作"
test_intent "继续刚才那个批次" "PROCESSING_BATCH_RESUME" "P-操作"
test_intent "这个活干完了，结束" "PROCESSING_BATCH_COMPLETE" "P-操作"
test_intent "作废这个批次，原料有问题" "PROCESSING_BATCH_CANCEL" "P-操作"
test_intent "恢复刚才暂停的" "PROCESSING_BATCH_RESUME" "P-操作"
test_intent "这批次完工了" "PROCESSING_BATCH_COMPLETE" "P-操作"

# P051-P060: 生产问题
test_intent "今天生产有啥问题没" "PROCESSING_BATCH_LIST" "P-问题"
test_intent "哪个批次卡住了" "PROCESSING_BATCH_LIST" "P-问题"
test_intent "生产线有没有停过" "EQUIPMENT_STATS" "P-问题"
test_intent "今天出了什么岔子没" "ALERT_LIST" "P-问题"
test_intent "有没有什么批次超时了" "PROCESSING_BATCH_LIST" "P-问题"
test_intent "产线上有没有异常" "ALERT_ACTIVE" "P-问题"
test_intent "今天的废品率高不高" "QUALITY_STATS" "P-问题"
test_intent "有没有返工的批次" "PROCESSING_BATCH_LIST" "P-问题"
test_intent "生产效率这几天咋样" "REPORT_PRODUCTION" "P-问题"
test_intent "哪个环节最容易出问题" "QUALITY_STATS" "P-问题"

# ==================== W类: 仓库管理员视角 (60个) ====================
echo ""
echo -e "${CYAN}=== W类: 仓库管理员视角 (60) ===${NC}"

# W001-W010: 库存查询
test_intent "库房B区的原料快过期的有哪些，我要安排先用掉" "MATERIAL_EXPIRING_ALERT" "W-库存"
test_intent "老李要的那批料我们还有多少存货" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "库存不够的东西列一下，我好补货" "MATERIAL_LOW_STOCK_ALERT" "W-库存"
test_intent "那个A12原料上次用是什么时候" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "库里还剩多少面粉" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "白糖存货够不够这周用" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "仓库里都有啥原料" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "现在库存最多的是哪个原料" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "哪些原料快用完了" "MATERIAL_LOW_STOCK_ALERT" "W-库存"
test_intent "盘一下现在的库存情况" "REPORT_INVENTORY" "W-库存"

# W011-W020: 入库出库
test_intent "今天送来的那车货入库了没有" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "最近一周进了多少原料，出了多少" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "把出入库流水给我导出来，财务要" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "今天领了多少料出去" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "上午入库的那批货质检过了没" "QUALITY_CHECK_QUERY" "W-出入"
test_intent "昨天出库的都有哪些" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "这批原料登记入库" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "车间领料记录查一下" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "今天的入库单打出来" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "本月的出库量统计" "MATERIAL_BATCH_QUERY" "W-出入"

# W021-W030: 原料追溯
test_intent "帮我查查这个批号的原料是从哪儿进的" "BATCH_TRACE" "W-追溯"
test_intent "这批面粉是哪个供应商的" "BATCH_TRACE" "W-追溯"
test_intent "追溯一下这个批次的来源" "BATCH_TRACE" "W-追溯"
test_intent "这个原料的供货商信息" "BATCH_TRACE" "W-追溯"
test_intent "查查这批货什么时候进的" "BATCH_TRACE" "W-追溯"
test_intent "这个批号的原料检验报告在哪" "QUALITY_CHECK_QUERY" "W-追溯"
test_intent "这批原料用到哪些产品里了" "BATCH_TRACE" "W-追溯"
test_intent "上次用这个供应商的货是什么时候" "BATCH_TRACE" "W-追溯"
test_intent "这个原料的进货价格是多少" "MATERIAL_BATCH_QUERY" "W-追溯"
test_intent "追踪这个批号的使用情况" "BATCH_TRACE" "W-追溯"

# W031-W040: 过期预警
test_intent "快过期的物料有哪些" "MATERIAL_EXPIRING_ALERT" "W-过期"
test_intent "还有几天就过期的原料" "MATERIAL_EXPIRING_ALERT" "W-过期"
test_intent "这个月会过期的东西列一下" "MATERIAL_EXPIRING_ALERT" "W-过期"
test_intent "已经过期的原料有没有" "MATERIAL_EXPIRED_QUERY" "W-过期"
test_intent "保质期快到的赶紧用掉" "MATERIAL_EXPIRING_ALERT" "W-过期"
test_intent "哪些原料要优先消耗" "MATERIAL_FIFO_RECOMMEND" "W-过期"
test_intent "按照先进先出应该用哪批" "MATERIAL_FIFO_RECOMMEND" "W-过期"
test_intent "临期的原料统计一下" "MATERIAL_EXPIRING_ALERT" "W-过期"
test_intent "过期预警的有多少" "MATERIAL_EXPIRING_ALERT" "W-过期"
test_intent "今天有过期的原料吗" "MATERIAL_EXPIRED_QUERY" "W-过期"

# W041-W050: 库存预警
test_intent "低于安全库存的有哪些" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "哪些原料要补货了" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "库存告警的东西" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "快没了的原料" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "需要采购的物料清单" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "哪些东西库存紧张" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "低库存的有几种" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "原料缺货预警" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "要断货的物料" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "库存不足需要补充的" "MATERIAL_LOW_STOCK_ALERT" "W-预警"

# W051-W060: 仓储管理
test_intent "本月损耗最大的是哪几种原料" "MATERIAL_BATCH_QUERY" "W-管理"
test_intent "冷库那边温度正常吗，别把东西冻坏了" "EQUIPMENT_STATS" "W-管理"
test_intent "原料的存放位置查一下" "MATERIAL_BATCH_QUERY" "W-管理"
test_intent "仓库有没有什么异常" "ALERT_LIST" "W-管理"
test_intent "本周库存周转怎么样" "REPORT_INVENTORY" "W-管理"
test_intent "呆滞的物料有多少" "MATERIAL_BATCH_QUERY" "W-管理"
test_intent "库房利用率多少" "REPORT_INVENTORY" "W-管理"
test_intent "原料损耗率统计" "MATERIAL_BATCH_QUERY" "W-管理"
test_intent "盘点差异的情况" "MATERIAL_BATCH_QUERY" "W-管理"
test_intent "仓库的告警情况" "ALERT_LIST" "W-管理"

# ==================== Q类: 质检员视角 (50个) ====================
echo ""
echo -e "${CYAN}=== Q类: 质检员视角 (50) ===${NC}"

# Q001-Q010: 质检结果
test_intent "今天检验的这些里面有不合格的吗" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "上批货检出问题了，是什么毛病" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "这个批次检验过了没" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "今天的质检数据汇总一下" "QUALITY_STATS" "Q-结果"
test_intent "检验不合格的有几个" "QUALITY_STATS" "Q-结果"
test_intent "这批产品的检验报告出来没" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "上午送检的结果" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "原料进来有没有检过" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "这个产品的质检记录" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "最近的检验数据" "QUALITY_CHECK_QUERY" "Q-结果"

# Q011-Q020: 合格率统计
test_intent "这个月的合格率比上个月怎么样" "QUALITY_STATS" "Q-统计"
test_intent "最近哪个产品线质量问题最多" "QUALITY_STATS" "Q-统计"
test_intent "今天的合格率多少" "QUALITY_STATS" "Q-统计"
test_intent "本周的质量数据统计" "QUALITY_STATS" "Q-统计"
test_intent "不良率的趋势怎么样" "QUALITY_STATS" "Q-统计"
test_intent "哪个产品合格率最低" "QUALITY_STATS" "Q-统计"
test_intent "质量环比分析" "QUALITY_STATS" "Q-统计"
test_intent "这个月的质量指标达标没" "QUALITY_STATS" "Q-统计"
test_intent "各产品线的质量排名" "QUALITY_STATS" "Q-统计"
test_intent "质量改善的效果" "QUALITY_STATS" "Q-统计"

# Q021-Q030: 不合格处理
test_intent "不合格品怎么处理的，记录在哪" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "这批次品该怎么处理" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "不良品的处置方案" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "返工的产品有多少" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "报废的数量统计" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "待处理的不合格品" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "降级处理的有哪些" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "不良品怎么办" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "这批不合格的退回去了没" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"
test_intent "不合格品处理流程" "QUALITY_DISPOSITION_EXECUTE" "Q-处理"

# Q031-Q040: 执行质检
test_intent "这批货要检一下" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "开始做质量检验" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "做一下这个批次的QC" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "进行抽检" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "执行入库检验" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "成品检验开始" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "做个质量检查" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "检验一下这批原料" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "首件检验" "QUALITY_CHECK_EXECUTE" "Q-执行"
test_intent "过程检验" "QUALITY_CHECK_EXECUTE" "Q-执行"

# Q041-Q050: 质量追溯
test_intent "这个不良是什么原因造成的" "QUALITY_CHECK_QUERY" "Q-追溯"
test_intent "追溯一下这批次的质量问题" "QUALITY_CHECK_QUERY" "Q-追溯"
test_intent "这个缺陷是哪个环节产生的" "QUALITY_CHECK_QUERY" "Q-追溯"
test_intent "质量问题的根因分析" "QUALITY_STATS" "Q-追溯"
test_intent "这批产品的质量履历" "QUALITY_CHECK_QUERY" "Q-追溯"
test_intent "不良品的来源追溯" "BATCH_TRACE" "Q-追溯"
test_intent "这个问题以前出现过吗" "QUALITY_CHECK_QUERY" "Q-追溯"
test_intent "质量问题发生的频率" "QUALITY_STATS" "Q-追溯"
test_intent "类似的质量问题有多少" "QUALITY_STATS" "Q-追溯"
test_intent "这个缺陷的历史记录" "QUALITY_CHECK_QUERY" "Q-追溯"

# ==================== S类: 发货调度视角 (50个) ====================
echo ""
echo -e "${CYAN}=== S类: 发货调度视角 (50) ===${NC}"

# S001-S010: 发货状态
test_intent "今天要发的货准备好了没" "SHIPMENT_QUERY" "S-状态"
test_intent "老客户张总的那单什么时候能到" "SHIPMENT_QUERY" "S-状态"
test_intent "最近有没有延迟发货的订单" "SHIPMENT_QUERY" "S-状态"
test_intent "下午的发货安排好了吗" "SHIPMENT_QUERY" "S-状态"
test_intent "这批货发出去了没" "SHIPMENT_QUERY" "S-状态"
test_intent "今天还有几单没发" "SHIPMENT_QUERY" "S-状态"
test_intent "明天要发的货有多少" "SHIPMENT_QUERY" "S-状态"
test_intent "急单那个发了没" "SHIPMENT_QUERY" "S-状态"
test_intent "发货进度怎么样了" "SHIPMENT_QUERY" "S-状态"
test_intent "待发货的订单有哪些" "SHIPMENT_QUERY" "S-状态"

# S011-S020: 发货统计
test_intent "这周发了多少车，运费花了多少" "SHIPMENT_BY_DATE" "S-统计"
test_intent "本月发货量统计" "SHIPMENT_BY_DATE" "S-统计"
test_intent "今天发了多少货" "SHIPMENT_BY_DATE" "S-统计"
test_intent "上礼拜的发货数据" "SHIPMENT_BY_DATE" "S-统计"
test_intent "发货量跟上个月比怎么样" "SHIPMENT_BY_DATE" "S-统计"
test_intent "各客户的发货量排名" "SHIPMENT_QUERY" "S-统计"
test_intent "发货准时率多少" "SHIPMENT_QUERY" "S-统计"
test_intent "本季度的发货汇总" "SHIPMENT_BY_DATE" "S-统计"
test_intent "每天平均发多少货" "SHIPMENT_BY_DATE" "S-统计"
test_intent "发货高峰是哪几天" "SHIPMENT_BY_DATE" "S-统计"

# S021-S030: 订单查询
test_intent "帮我查查这个运单号走到哪了" "SHIPMENT_QUERY" "S-订单"
test_intent "这个客户的订单都有哪些" "SHIPMENT_QUERY" "S-订单"
test_intent "未完成的订单列表" "SHIPMENT_QUERY" "S-订单"
test_intent "大订单有哪几个" "SHIPMENT_QUERY" "S-订单"
test_intent "加急的订单" "SHIPMENT_QUERY" "S-订单"
test_intent "快到交期的订单" "SHIPMENT_QUERY" "S-订单"
test_intent "逾期未发的订单" "SHIPMENT_QUERY" "S-订单"
test_intent "今天的发货清单" "SHIPMENT_QUERY" "S-订单"
test_intent "明天的发货安排" "SHIPMENT_QUERY" "S-订单"
test_intent "发货单明细" "SHIPMENT_QUERY" "S-订单"

# S031-S040: 物流跟踪
test_intent "物流状态更新了没" "SHIPMENT_QUERY" "S-物流"
test_intent "这批货到哪了" "SHIPMENT_QUERY" "S-物流"
test_intent "预计什么时候送到" "SHIPMENT_QUERY" "S-物流"
test_intent "物流异常的有没有" "SHIPMENT_QUERY" "S-物流"
test_intent "签收情况" "SHIPMENT_QUERY" "S-物流"
test_intent "在途的货有多少" "SHIPMENT_QUERY" "S-物流"
test_intent "物流信息查询" "SHIPMENT_QUERY" "S-物流"
test_intent "运输中的订单" "SHIPMENT_QUERY" "S-物流"
test_intent "已送达的订单" "SHIPMENT_QUERY" "S-物流"
test_intent "物流延误的情况" "SHIPMENT_QUERY" "S-物流"

# S041-S050: 发货问题
test_intent "发错货的情况有没有" "SHIPMENT_QUERY" "S-问题"
test_intent "退货的订单" "SHIPMENT_QUERY" "S-问题"
test_intent "客户投诉发货的有吗" "SHIPMENT_QUERY" "S-问题"
test_intent "发货出了什么问题" "SHIPMENT_QUERY" "S-问题"
test_intent "漏发的情况" "SHIPMENT_QUERY" "S-问题"
test_intent "少发的订单" "SHIPMENT_QUERY" "S-问题"
test_intent "货损的记录" "SHIPMENT_QUERY" "S-问题"
test_intent "发货异常汇总" "SHIPMENT_QUERY" "S-问题"
test_intent "发货延误原因" "SHIPMENT_QUERY" "S-问题"
test_intent "客户拒收的情况" "SHIPMENT_QUERY" "S-问题"

# ==================== E类: 设备维护员视角 (50个) ====================
echo ""
echo -e "${CYAN}=== E类: 设备维护员视角 (50) ===${NC}"

# E001-E010: 设备状态
test_intent "3号机又报警了，是什么情况" "EQUIPMENT_ALERT_LIST" "E-状态"
test_intent "这台设备上次保养是什么时候" "EQUIPMENT_MAINTENANCE" "E-状态"
test_intent "最近老出毛病的是哪几台机器" "EQUIPMENT_STATS" "E-状态"
test_intent "设备现在都正常运转吗" "EQUIPMENT_STATS" "E-状态"
test_intent "哪台设备在维修" "EQUIPMENT_STATS" "E-状态"
test_intent "机器运行状态" "EQUIPMENT_STATS" "E-状态"
test_intent "设备开机率多少" "EQUIPMENT_STATS" "E-状态"
test_intent "有没有停机的设备" "EQUIPMENT_STATS" "E-状态"
test_intent "设备健康状况" "EQUIPMENT_STATS" "E-状态"
test_intent "机器都好使不" "EQUIPMENT_STATS" "E-状态"

# E011-E020: 故障告警
test_intent "现在有什么设备报警" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "设备告警清单" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "故障报警有几个" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "未处理的设备告警" "ALERT_ACTIVE" "E-告警"
test_intent "设备异常情况" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "紧急的设备故障" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "今天的设备告警" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "设备预警信息" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "机器有没有报警的" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "设备故障通知" "EQUIPMENT_ALERT_LIST" "E-告警"

# E021-E030: 维护保养
test_intent "该保养的设备有哪些" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "本周的保养计划" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "设备维护记录" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "上次维修是什么问题" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "保养到期的设备" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "设备巡检计划" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "维保情况汇总" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "点检记录" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "设备润滑记录" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "预防性维护计划" "EQUIPMENT_MAINTENANCE" "E-保养"

# E031-E040: 停机统计
test_intent "这个月设备故障一共停了多长时间" "EQUIPMENT_STATS" "E-停机"
test_intent "停机时间最长的设备" "EQUIPMENT_STATS" "E-停机"
test_intent "设备稼动率" "EQUIPMENT_STATS" "E-停机"
test_intent "故障停机统计" "EQUIPMENT_STATS" "E-停机"
test_intent "计划外停机" "EQUIPMENT_STATS" "E-停机"
test_intent "MTBF数据" "EQUIPMENT_STATS" "E-停机"
test_intent "MTTR统计" "EQUIPMENT_STATS" "E-停机"
test_intent "设备效率OEE" "EQUIPMENT_STATS" "E-停机"
test_intent "停机原因分析" "EQUIPMENT_STATS" "E-停机"
test_intent "设备利用率" "EQUIPMENT_STATS" "E-停机"

# E041-E050: 备件管理
test_intent "备件库里还有多少这个型号的零件" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "常用备件库存" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "备件不足的有哪些" "MATERIAL_LOW_STOCK_ALERT" "E-备件"
test_intent "需要采购的备件" "MATERIAL_LOW_STOCK_ALERT" "E-备件"
test_intent "备件消耗统计" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "设备配件清单" "EQUIPMENT_LIST" "E-备件"
test_intent "备件领用记录" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "易损件库存" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "备件安全库存" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "维修用料统计" "MATERIAL_BATCH_QUERY" "E-备件"

# ==================== C类: 电子秤操作员视角 (40个) ====================
echo ""
echo -e "${CYAN}=== C类: 电子秤操作员视角 (40) ===${NC}"

# C001-C010: 秤状态
test_intent "这秤显示不准了，能不能校准一下" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "这秤最后一次检定是什么时候" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤好使吗" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "看看秤的状态" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤连上了没" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "这个秤准不准" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤的精度" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "称重设备状态" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤有没有问题" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤需要校准吗" "SCALE_DEVICE_DETAIL" "C-状态"

# C011-C020: 称重记录
test_intent "今天称的这些数据存上了没有" "SCALE_LIST_DEVICES" "C-记录"
test_intent "帮我看看上午称的那批货总重多少" "SCALE_LIST_DEVICES" "C-记录"
test_intent "今天的称重记录" "SCALE_LIST_DEVICES" "C-记录"
test_intent "这批货称了多少" "SCALE_LIST_DEVICES" "C-记录"
test_intent "称重数据查询" "SCALE_LIST_DEVICES" "C-记录"
test_intent "最近的称重记录" "SCALE_LIST_DEVICES" "C-记录"
test_intent "称重历史" "SCALE_LIST_DEVICES" "C-记录"
test_intent "今天称了多少货" "SCALE_LIST_DEVICES" "C-记录"
test_intent "称重数据汇总" "SCALE_LIST_DEVICES" "C-记录"
test_intent "这个批次的重量" "SCALE_LIST_DEVICES" "C-记录"

# C021-C030: 秤列表
test_intent "厂里一共有几台秤" "SCALE_LIST_DEVICES" "C-列表"
test_intent "哪些秤在用" "SCALE_LIST_DEVICES" "C-列表"
test_intent "在线的秤有几台" "SCALE_LIST_DEVICES" "C-列表"
test_intent "秤设备清单" "SCALE_LIST_DEVICES" "C-列表"
test_intent "可用的秤" "SCALE_LIST_DEVICES" "C-列表"
test_intent "联网的秤" "SCALE_LIST_DEVICES" "C-列表"
test_intent "称重设备列表" "SCALE_LIST_DEVICES" "C-列表"
test_intent "智能秤有哪些" "SCALE_LIST_DEVICES" "C-列表"
test_intent "所有秤的情况" "SCALE_LIST_DEVICES" "C-列表"
test_intent "秤的编号列表" "SCALE_LIST_DEVICES" "C-列表"

# C031-C040: 称重问题
test_intent "秤不显示了怎么办" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "称重有误差" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "秤的数据没传上来" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "秤断网了" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "称重设备故障" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "秤的问题" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "秤报警了" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "称重异常" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "秤不工作了" "SCALE_DEVICE_DETAIL" "C-问题"
test_intent "称重设备有问题" "SCALE_DEVICE_DETAIL" "C-问题"

# ==================== H类: 班组长交接班视角 (40个) ====================
echo ""
echo -e "${CYAN}=== H类: 班组长交接班视角 (40) ===${NC}"

# H001-H010: 交接问题
test_intent "上一班留下了什么问题没处理完" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "有没有什么事要交代给下一班的" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "交接班要注意什么" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "上个班次的遗留问题" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "待处理的事项" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "需要关注的问题" "ALERT_LIST" "H-交接"
test_intent "交接内容" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "上一班的情况" "REPORT_PRODUCTION" "H-交接"
test_intent "有什么要交代的" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "遗留问题清单" "PROCESSING_BATCH_LIST" "H-交接"

# H011-H020: 班次产量
test_intent "今天白班的产量汇总一下" "REPORT_PRODUCTION" "H-产量"
test_intent "这个班次做了多少" "REPORT_PRODUCTION" "H-产量"
test_intent "夜班产量多少" "REPORT_PRODUCTION" "H-产量"
test_intent "本班的生产数据" "REPORT_PRODUCTION" "H-产量"
test_intent "这班产出统计" "REPORT_PRODUCTION" "H-产量"
test_intent "当班产量" "REPORT_PRODUCTION" "H-产量"
test_intent "各班次产量对比" "REPORT_PRODUCTION" "H-产量"
test_intent "白班夜班哪个产量高" "REPORT_PRODUCTION" "H-产量"
test_intent "班组产量排名" "REPORT_PRODUCTION" "H-产量"
test_intent "这个班的成绩" "REPORT_PRODUCTION" "H-产量"

# H021-H030: 产线进度
test_intent "各条线现在的进度怎么样了" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "生产线状态" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "产线运行情况" "EQUIPMENT_STATS" "H-进度"
test_intent "各线的任务完成情况" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "产线效率" "EQUIPMENT_STATS" "H-进度"
test_intent "哪条线快做完了" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "哪条线落后了" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "产线负荷" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "生产进度汇总" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "各线的任务量" "PROCESSING_BATCH_LIST" "H-进度"

# H031-H040: 出勤考勤
test_intent "今天出勤的人都到齐了吗" "ATTENDANCE_QUERY" "H-考勤"
test_intent "谁请假了" "ATTENDANCE_QUERY" "H-考勤"
test_intent "今天的出勤情况" "ATTENDANCE_QUERY" "H-考勤"
test_intent "缺勤的有几个" "ATTENDANCE_QUERY" "H-考勤"
test_intent "今天到岗人数" "ATTENDANCE_QUERY" "H-考勤"
test_intent "本班人员情况" "ATTENDANCE_QUERY" "H-考勤"
test_intent "有人迟到吗" "ATTENDANCE_QUERY" "H-考勤"
test_intent "加班的名单" "ATTENDANCE_QUERY" "H-考勤"
test_intent "在岗人员" "ATTENDANCE_QUERY" "H-考勤"
test_intent "请假审批" "ATTENDANCE_QUERY" "H-考勤"

# ==================== M类: 厂长/经理视角 (40个) ====================
echo ""
echo -e "${CYAN}=== M类: 厂长/经理视角 (40) ===${NC}"

# M001-M010: 整体概况
test_intent "这个月整体情况怎么样，能达标吗" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "今天的生产概况" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "工厂运营状况" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "整体数据看一下" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "本周的经营情况" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "目前的生产状态" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "综合报表" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "管理驾驶舱" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "关键指标概览" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "厂区整体状况" "REPORT_DASHBOARD_OVERVIEW" "M-概况"

# M011-M020: 成本分析
test_intent "成本这块控制得怎么样" "COST_QUERY" "M-成本"
test_intent "本月成本花了多少" "COST_QUERY" "M-成本"
test_intent "成本跟预算比怎么样" "COST_QUERY" "M-成本"
test_intent "哪块成本最高" "COST_QUERY" "M-成本"
test_intent "成本趋势分析" "COST_TREND_ANALYSIS" "M-成本"
test_intent "人工成本多少" "COST_QUERY" "M-成本"
test_intent "材料成本统计" "COST_QUERY" "M-成本"
test_intent "制造费用" "COST_QUERY" "M-成本"
test_intent "成本环比" "COST_TREND_ANALYSIS" "M-成本"
test_intent "降本增效情况" "COST_TREND_ANALYSIS" "M-成本"

# M021-M030: 报表报告
test_intent "出一份这周的经营简报" "REPORT_DASHBOARD_OVERVIEW" "M-报表"
test_intent "月度报告" "REPORT_DASHBOARD_OVERVIEW" "M-报表"
test_intent "生产报表" "REPORT_PRODUCTION" "M-报表"
test_intent "质量报告" "QUALITY_STATS" "M-报表"
test_intent "库存报表" "REPORT_INVENTORY" "M-报表"
test_intent "设备报告" "EQUIPMENT_STATS" "M-报表"
test_intent "经营分析报告" "REPORT_DASHBOARD_OVERVIEW" "M-报表"
test_intent "日报周报" "REPORT_PRODUCTION" "M-报表"
test_intent "汇报材料" "REPORT_DASHBOARD_OVERVIEW" "M-报表"
test_intent "数据报表导出" "REPORT_DASHBOARD_OVERVIEW" "M-报表"

# M031-M040: 对比分析
test_intent "跟上个月比，哪些指标变化最大" "REPORT_DASHBOARD_OVERVIEW" "M-对比"
test_intent "同比增长多少" "REPORT_TRENDS" "M-对比"
test_intent "环比分析" "REPORT_TRENDS" "M-对比"
test_intent "各车间对比" "REPORT_PRODUCTION" "M-对比"
test_intent "产线效率排名" "REPORT_PRODUCTION" "M-对比"
test_intent "员工绩效排名" "REPORT_PRODUCTION" "M-对比"
test_intent "产品产量排名" "REPORT_PRODUCTION" "M-对比"
test_intent "趋势分析" "REPORT_TRENDS" "M-对比"
test_intent "数据对比" "REPORT_DASHBOARD_OVERVIEW" "M-对比"
test_intent "目标达成率" "REPORT_DASHBOARD_OVERVIEW" "M-对比"

# ==================== U类: 紧急情况处理 (50个) ====================
echo ""
echo -e "${CYAN}=== U类: 紧急情况处理 (50) ===${NC}"

# U001-U010: 原料短缺
test_intent "原料不够了怎么办，明天的生产能排开吗" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "面粉快用完了，紧急补货" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "原料断供了" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "缺料影响多大" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "没原料了怎么办" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "原料紧急告警" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "供应商断货了" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "物料紧缺" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "原料供应问题" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "缺料预警" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"

# U011-U020: 设备故障
test_intent "设备坏了，有没有备用方案" "EQUIPMENT_ALERT_LIST" "U-故障"
test_intent "机器出故障了" "EQUIPMENT_ALERT_LIST" "U-故障"
test_intent "紧急维修" "EQUIPMENT_MAINTENANCE" "U-故障"
test_intent "设备停机了" "EQUIPMENT_ALERT_LIST" "U-故障"
test_intent "产线停了" "EQUIPMENT_ALERT_LIST" "U-故障"
test_intent "机器报警很严重" "EQUIPMENT_ALERT_LIST" "U-故障"
test_intent "设备紧急告警" "ALERT_ACTIVE" "U-故障"
test_intent "生产线中断" "EQUIPMENT_ALERT_LIST" "U-故障"
test_intent "设备抢修" "EQUIPMENT_MAINTENANCE" "U-故障"
test_intent "机器突然停了" "EQUIPMENT_ALERT_LIST" "U-故障"

# U021-U030: 质量问题
test_intent "出了质量问题，要不要停线" "QUALITY_STATS" "U-质量"
test_intent "产品出问题了" "QUALITY_CHECK_QUERY" "U-质量"
test_intent "质量异常" "QUALITY_STATS" "U-质量"
test_intent "不良品太多了" "QUALITY_STATS" "U-质量"
test_intent "质量事故" "QUALITY_STATS" "U-质量"
test_intent "紧急质检" "QUALITY_CHECK_EXECUTE" "U-质量"
test_intent "产品召回" "QUALITY_DISPOSITION_EXECUTE" "U-质量"
test_intent "质量危机" "QUALITY_STATS" "U-质量"
test_intent "批量不合格" "QUALITY_DISPOSITION_EXECUTE" "U-质量"
test_intent "质量告警" "QUALITY_STATS" "U-质量"

# U031-U040: 问题追溯
test_intent "这批货有问题，能追到是谁做的吗" "BATCH_TRACE" "U-追溯"
test_intent "出问题的批次追溯" "BATCH_TRACE" "U-追溯"
test_intent "问题原料追踪" "BATCH_TRACE" "U-追溯"
test_intent "不良品来源" "BATCH_TRACE" "U-追溯"
test_intent "问题产品追溯" "BATCH_TRACE" "U-追溯"
test_intent "故障原因追查" "BATCH_TRACE" "U-追溯"
test_intent "责任追溯" "BATCH_TRACE" "U-追溯"
test_intent "事故追查" "BATCH_TRACE" "U-追溯"
test_intent "根因分析" "BATCH_TRACE" "U-追溯"
test_intent "问题定位" "BATCH_TRACE" "U-追溯"

# U041-U050: 紧急订单
test_intent "客户临时加急单，能不能插队做" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "紧急订单插单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "加急生产" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "优先安排这个订单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "客户催货" "SHIPMENT_QUERY" "U-急单"
test_intent "紧急发货" "SHIPMENT_QUERY" "U-急单"
test_intent "加班赶单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "特急订单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "订单加急处理" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "紧急交付" "SHIPMENT_QUERY" "U-急单"

# ==================== X类: 复杂查询与对比 (60个) ====================
echo ""
echo -e "${CYAN}=== X类: 复杂查询与对比 (60) ===${NC}"

# X001-X015: 多维度查询
test_intent "把A产品的产量、合格率、成本三个指标放一起看看" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "对比一下三条产线这周的表现" "REPORT_PRODUCTION" "X-多维"
test_intent "今年跟去年同期比，主要差在哪" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "按员工分组，看看谁产量高谁质量好" "REPORT_PRODUCTION" "X-多维"
test_intent "这个客户的订单历史都有哪些" "CUSTOMER_PURCHASE_HISTORY" "X-多维"
test_intent "各产品的成本和利润对比" "COST_QUERY" "X-多维"
test_intent "生产质量成本三项指标" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "综合分析报告" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "多维度数据分析" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "关联数据查询" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "跨部门数据汇总" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "产销存一体化报表" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "全流程数据追踪" "BATCH_TRACE" "X-多维"
test_intent "端到端数据分析" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "业务全景分析" "REPORT_DASHBOARD_OVERVIEW" "X-多维"

# X016-X030: 时间对比
test_intent "本月跟上月的产量对比" "REPORT_TRENDS" "X-对比"
test_intent "这周和上周的数据比较" "REPORT_TRENDS" "X-对比"
test_intent "同比环比分析" "REPORT_TRENDS" "X-对比"
test_intent "历史数据趋势" "REPORT_TRENDS" "X-对比"
test_intent "季度数据对比" "REPORT_TRENDS" "X-对比"
test_intent "年度对比分析" "REPORT_TRENDS" "X-对比"
test_intent "周环比" "REPORT_TRENDS" "X-对比"
test_intent "月同比" "REPORT_TRENDS" "X-对比"
test_intent "日数据对比" "REPORT_TRENDS" "X-对比"
test_intent "时间段对比" "REPORT_TRENDS" "X-对比"
test_intent "数据走势图" "REPORT_TRENDS" "X-对比"
test_intent "趋势变化分析" "REPORT_TRENDS" "X-对比"
test_intent "波动分析" "REPORT_TRENDS" "X-对比"
test_intent "历史峰值对比" "REPORT_TRENDS" "X-对比"
test_intent "基准数据比较" "REPORT_TRENDS" "X-对比"

# X031-X045: 排名分析
test_intent "哪个产品最赚钱" "COST_QUERY" "X-排名"
test_intent "效率最高的产线" "REPORT_PRODUCTION" "X-排名"
test_intent "产量TOP10" "REPORT_PRODUCTION" "X-排名"
test_intent "质量排名" "QUALITY_STATS" "X-排名"
test_intent "成本排名" "COST_QUERY" "X-排名"
test_intent "员工绩效榜" "REPORT_PRODUCTION" "X-排名"
test_intent "产品销量排行" "SHIPMENT_QUERY" "X-排名"
test_intent "客户贡献排名" "SHIPMENT_QUERY" "X-排名"
test_intent "设备效率排名" "EQUIPMENT_STATS" "X-排名"
test_intent "供应商评分" "BATCH_TRACE" "X-排名"
test_intent "最佳和最差对比" "REPORT_DASHBOARD_OVERVIEW" "X-排名"
test_intent "表现最好的" "REPORT_PRODUCTION" "X-排名"
test_intent "问题最多的" "QUALITY_STATS" "X-排名"
test_intent "综合排名" "REPORT_DASHBOARD_OVERVIEW" "X-排名"
test_intent "各维度排行" "REPORT_DASHBOARD_OVERVIEW" "X-排名"

# X046-X060: 条件筛选
test_intent "筛选出本周产量超过1000的批次" "PROCESSING_BATCH_LIST" "X-筛选"
test_intent "合格率低于90%的产品" "QUALITY_STATS" "X-筛选"
test_intent "库存低于安全值的原料" "MATERIAL_LOW_STOCK_ALERT" "X-筛选"
test_intent "逾期未发货的订单" "SHIPMENT_QUERY" "X-筛选"
test_intent "故障次数超过3次的设备" "EQUIPMENT_STATS" "X-筛选"
test_intent "成本超预算的项目" "COST_QUERY" "X-筛选"
test_intent "效率低于标准的产线" "REPORT_PRODUCTION" "X-筛选"
test_intent "不合格率高的批次" "QUALITY_STATS" "X-筛选"
test_intent "延期交付的订单" "SHIPMENT_QUERY" "X-筛选"
test_intent "待审核的事项" "PROCESSING_BATCH_LIST" "X-筛选"
test_intent "异常数据筛查" "ALERT_LIST" "X-筛选"
test_intent "超时未处理的告警" "ALERT_ACTIVE" "X-筛选"
test_intent "高风险项目" "REPORT_DASHBOARD_OVERVIEW" "X-筛选"
test_intent "重点关注的指标" "REPORT_DASHBOARD_OVERVIEW" "X-筛选"
test_intent "需要干预的数据" "ALERT_LIST" "X-筛选"

echo ""
echo "================================================"
echo "测试完成!"
echo "================================================"
echo ""
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo "总计: $TOTAL"
echo ""
RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
echo -e "通过率: ${CYAN}${RATE}%${NC}"
echo ""
echo "================================================"
