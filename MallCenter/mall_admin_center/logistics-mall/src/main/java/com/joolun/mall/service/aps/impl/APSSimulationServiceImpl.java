package com.joolun.mall.service.aps.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.aps.*;
import com.joolun.mall.mapper.aps.*;
import com.joolun.mall.service.aps.APSSimulationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * APS 模拟数据服务实现
 * 生成用于测试排程算法的模拟数据
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class APSSimulationServiceImpl implements APSSimulationService {

    private final ProductionOrderMapper orderMapper;
    private final ProductionLineMapper lineMapper;
    private final ProductionWorkerMapper workerMapper;
    private final ProductionEquipmentMapper equipmentMapper;
    private final ProductionMoldMapper moldMapper;
    private final ChangeoverMatrixMapper changeoverMapper;

    // 产品类别
    private static final String[] PRODUCT_CATEGORIES = {
        "糕点类", "饮品类", "调味品类", "休闲食品类", "速冻类"
    };

    // 产线类型
    private static final String[] LINE_TYPES = {
        "assembly", "packaging", "processing", "mixing"
    };

    // 设备类型
    private static final String[] EQUIPMENT_TYPES = {
        "mixer", "filler", "sealer", "labeler", "wrapper"
    };

    // 姓氏和名字列表 (用于生成工人姓名)
    private static final String[] SURNAMES = {
        "张", "王", "李", "赵", "刘", "陈", "杨", "黄", "周", "吴"
    };
    private static final String[] GIVEN_NAMES = {
        "伟", "强", "芳", "娜", "敏", "静", "丽", "明", "勇", "军"
    };

    // 需要清洁的品类组合 (从荤到素或过敏原相关)
    private static final Set<String> CLEANING_REQUIRED_PAIRS = new HashSet<>(Arrays.asList(
        "休闲食品类->糕点类",
        "速冻类->饮品类",
        "调味品类->糕点类"
    ));

    @Override
    @Transactional
    public List<ProductionOrder> generateSimulatedOrders(int count, int days) {
        log.info("开始生成 {} 个模拟生产订单, 交期跨度 {} 天", count, days);

        List<ProductionOrder> orders = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        ThreadLocalRandom random = ThreadLocalRandom.current();

        for (int i = 0; i < count; i++) {
            ProductionOrder order = new ProductionOrder();

            // 基本信息
            order.setId(UUID.randomUUID().toString());
            order.setOrderNo("PO-SIM-" + String.format("%06d", i + 1));
            order.setSalesOrderId("SO-SIM-" + String.format("%06d", random.nextInt(1, 10000)));

            // 产品信息
            String category = PRODUCT_CATEGORIES[random.nextInt(PRODUCT_CATEGORIES.length)];
            order.setProductId("PROD-" + String.format("%04d", random.nextInt(1, 500)));
            order.setProductName(generateProductName(category));
            order.setProductSpec(generateProductSpec());
            order.setProductCategory(category);

            // 数量 (100-1000)
            int qty = random.nextInt(100, 1001);
            order.setPlannedQty(BigDecimal.valueOf(qty));
            order.setCompletedQty(BigDecimal.ZERO);
            order.setUnit("件");

            // 时间约束
            int deadlineDays = random.nextInt(1, days + 1);
            order.setEarliestStart(now.plusHours(random.nextInt(0, 24)));
            order.setLatestEnd(now.plusDays(deadlineDays).withHour(random.nextInt(8, 18)));

            // 工艺参数
            order.setRoutingId("RT-" + String.format("%03d", random.nextInt(1, 50)));
            order.setCurrentOperationSeq(1);
            order.setTotalOperations(random.nextInt(2, 6));
            order.setStandardTime(BigDecimal.valueOf(random.nextDouble(0.5, 3.0)));
            order.setPreWaitTime(random.nextInt(0, 30));
            order.setPostWaitTime(random.nextInt(0, 60));

            // 资源需求
            order.setRequiredEquipmentType(EQUIPMENT_TYPES[random.nextInt(EQUIPMENT_TYPES.length)]);
            order.setRequiredSkillLevel(random.nextInt(1, 6));
            order.setRequiredWorkerCount(random.nextInt(2, 8));

            // 物料状态
            String[] materialStatuses = {"ready", "partial", "waiting"};
            int[] materialWeights = {60, 30, 10};  // 60% ready, 30% partial, 10% waiting
            order.setMaterialStatus(weightedRandom(materialStatuses, materialWeights, random));
            if (!"ready".equals(order.getMaterialStatus())) {
                order.setMaterialArrivalTime(now.plusHours(random.nextInt(4, 48)));
            }

            // 优先级和状态
            order.setPriority(random.nextInt(1, 11));
            order.setIsUrgent(random.nextDouble() < 0.1);  // 10% 紧急订单
            order.setStatus("pending");

            // 排程选项
            order.setAllowSplit(random.nextBoolean());
            order.setAllowCrossDay(random.nextDouble() > 0.3);  // 70% 允许跨天
            order.setAllowMixBatch(random.nextDouble() > 0.4);  // 60% 允许混批

            // 元数据
            order.setIsSimulated(true);
            order.setCreatedAt(now);
            order.setUpdatedAt(now);

            orderMapper.insert(order);
            orders.add(order);
        }

        log.info("成功生成 {} 个模拟生产订单", orders.size());
        return orders;
    }

    @Override
    @Transactional
    public List<ProductionLine> generateSimulatedLines(int count) {
        log.info("开始生成 {} 条模拟生产线", count);

        List<ProductionLine> lines = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        ThreadLocalRandom random = ThreadLocalRandom.current();

        for (int i = 0; i < count; i++) {
            ProductionLine line = new ProductionLine();

            // 基本信息
            line.setId(UUID.randomUUID().toString());
            line.setLineNo("LINE-SIM-" + String.format("%03d", i + 1));
            line.setLineName("模拟产线" + (i + 1));
            line.setLineType(LINE_TYPES[random.nextInt(LINE_TYPES.length)]);
            line.setWorkshopId("WS-" + String.format("%02d", random.nextInt(1, 6)));

            // 能力参数
            int standardCapacity = random.nextInt(50, 200);
            line.setStandardCapacity(BigDecimal.valueOf(standardCapacity));
            line.setMaxCapacity(BigDecimal.valueOf(standardCapacity * 1.2));
            line.setEfficiencyFactor(BigDecimal.valueOf(0.8 + random.nextDouble() * 0.4));

            // 可生产的产品类别 (随机选择2-4个)
            int categoryCount = random.nextInt(2, 5);
            List<String> selectedCategories = new ArrayList<>();
            List<String> availableCategories = new ArrayList<>(Arrays.asList(PRODUCT_CATEGORIES));
            for (int j = 0; j < categoryCount && !availableCategories.isEmpty(); j++) {
                int idx = random.nextInt(availableCategories.size());
                selectedCategories.add(availableCategories.remove(idx));
            }
            line.setProductCategories(String.join(",", selectedCategories));

            // 人员配置
            line.setStandardWorkerCount(random.nextInt(4, 8));
            line.setMinWorkerCount(random.nextInt(2, line.getStandardWorkerCount()));
            line.setMaxWorkerCount(random.nextInt(line.getStandardWorkerCount(), 12));

            // 班次配置
            String[] shiftModes = {"single", "double", "triple"};
            line.setShiftMode(shiftModes[random.nextInt(shiftModes.length)]);
            line.setShift1Start(LocalTime.of(8, 0));
            line.setShift1End(LocalTime.of(16, 0));
            if (!"single".equals(line.getShiftMode())) {
                line.setShift2Start(LocalTime.of(16, 0));
                line.setShift2End(LocalTime.of(0, 0));
            }
            if ("triple".equals(line.getShiftMode())) {
                line.setShift3Start(LocalTime.of(0, 0));
                line.setShift3End(LocalTime.of(8, 0));
            }

            // 当前状态
            String[] statuses = {"available", "running", "maintenance"};
            int[] statusWeights = {40, 50, 10};
            line.setStatus(weightedRandom(statuses, statusWeights, random));
            line.setCurrentWorkerCount(random.nextInt(line.getMinWorkerCount(), line.getMaxWorkerCount() + 1));
            line.setTodayOutput(BigDecimal.valueOf(random.nextInt(0, standardCapacity * 4)));
            line.setEstimatedFreeTime(now.plusHours(random.nextInt(0, 8)));

            // 维护信息
            line.setNextMaintenanceTime(now.plusDays(random.nextInt(7, 30)));
            line.setMaintenanceCycleHours(random.nextInt(200, 500));
            line.setRunningHoursSinceMaintenance(BigDecimal.valueOf(random.nextInt(0, 200)));

            // 如果正在运行，设置当前产品
            if ("running".equals(line.getStatus())) {
                line.setCurrentProductCategory(selectedCategories.get(random.nextInt(selectedCategories.size())));
            }

            // 元数据
            line.setIsSimulated(true);
            line.setCreatedAt(now);
            line.setUpdatedAt(now);

            lineMapper.insert(line);
            lines.add(line);
        }

        log.info("成功生成 {} 条模拟生产线", lines.size());
        return lines;
    }

    @Override
    @Transactional
    public List<ProductionWorker> generateSimulatedWorkers(int count) {
        log.info("开始生成 {} 个模拟工人", count);

        List<ProductionWorker> workers = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        ThreadLocalRandom random = ThreadLocalRandom.current();

        // 获取已有的模拟产线用于分配
        List<ProductionLine> lines = lineMapper.selectList(
            new LambdaQueryWrapper<ProductionLine>()
                .eq(ProductionLine::getIsSimulated, true)
        );

        for (int i = 0; i < count; i++) {
            ProductionWorker worker = new ProductionWorker();

            // 基本信息
            worker.setId(UUID.randomUUID().toString());
            worker.setWorkerNo("WKR-SIM-" + String.format("%04d", i + 1));
            worker.setWorkerName(SURNAMES[random.nextInt(SURNAMES.length)] +
                GIVEN_NAMES[random.nextInt(GIVEN_NAMES.length)]);
            worker.setDepartment("生产部");

            // 默认产线
            if (!lines.isEmpty()) {
                ProductionLine defaultLine = lines.get(random.nextInt(lines.size()));
                worker.setDefaultLineId(defaultLine.getId());
            }

            // 技能属性
            worker.setSkillLevel(random.nextInt(1, 6));

            // 可操作的产线类型 (根据技能等级决定数量)
            int capableLineCount = Math.min(worker.getSkillLevel(), LINE_TYPES.length);
            List<String> capableLines = new ArrayList<>();
            List<String> availableLineTypes = new ArrayList<>(Arrays.asList(LINE_TYPES));
            for (int j = 0; j < capableLineCount && !availableLineTypes.isEmpty(); j++) {
                int idx = random.nextInt(availableLineTypes.size());
                capableLines.add(availableLineTypes.remove(idx));
            }
            worker.setCapableLineTypes(String.join(",", capableLines));

            // 可操作的设备类型
            int capableEquipCount = random.nextInt(2, EQUIPMENT_TYPES.length + 1);
            List<String> capableEquipments = new ArrayList<>();
            List<String> availableEquipTypes = new ArrayList<>(Arrays.asList(EQUIPMENT_TYPES));
            for (int j = 0; j < capableEquipCount && !availableEquipTypes.isEmpty(); j++) {
                int idx = random.nextInt(availableEquipTypes.size());
                capableEquipments.add(availableEquipTypes.remove(idx));
            }
            worker.setCapableEquipmentTypes(String.join(",", capableEquipments));

            worker.setEfficiencyFactor(BigDecimal.valueOf(0.8 + random.nextDouble() * 0.4));

            // 班次信息
            String[] shifts = {"day", "middle", "night"};
            worker.setCurrentShift(shifts[random.nextInt(shifts.length)]);
            switch (worker.getCurrentShift()) {
                case "day":
                    worker.setShiftStart(LocalTime.of(8, 0));
                    worker.setShiftEnd(LocalTime.of(16, 0));
                    break;
                case "middle":
                    worker.setShiftStart(LocalTime.of(16, 0));
                    worker.setShiftEnd(LocalTime.of(0, 0));
                    break;
                case "night":
                    worker.setShiftStart(LocalTime.of(0, 0));
                    worker.setShiftEnd(LocalTime.of(8, 0));
                    break;
            }
            worker.setCanOvertime(random.nextDouble() > 0.3);
            worker.setMaxOvertimeHours(worker.getCanOvertime() ? random.nextInt(2, 5) : 0);

            // 当前状态
            String[] statuses = {"available", "working", "break", "off"};
            int[] statusWeights = {30, 40, 10, 20};
            worker.setStatus(weightedRandom(statuses, statusWeights, random));

            if ("working".equals(worker.getStatus()) && worker.getDefaultLineId() != null) {
                worker.setCurrentLineId(worker.getDefaultLineId());
            }

            worker.setTodayWorkMinutes(random.nextInt(0, 480));
            worker.setEstimatedFreeTime(now.plusHours(random.nextInt(0, 4)));

            // 统计信息
            worker.setMonthWorkDays(random.nextInt(15, 25));
            worker.setMonthOvertimeHours(BigDecimal.valueOf(random.nextInt(0, 30)));
            worker.setAvgOutputPerHour(BigDecimal.valueOf(random.nextInt(20, 50)));

            // 元数据
            worker.setIsSimulated(true);
            worker.setCreatedAt(now);
            worker.setUpdatedAt(now);

            workerMapper.insert(worker);
            workers.add(worker);
        }

        log.info("成功生成 {} 个模拟工人", workers.size());
        return workers;
    }

    @Override
    @Transactional
    public List<ProductionEquipment> generateSimulatedEquipment(int count) {
        log.info("开始生成 {} 台模拟设备", count);

        List<ProductionEquipment> equipments = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        ThreadLocalRandom random = ThreadLocalRandom.current();

        // 获取已有的模拟产线用于分配
        List<ProductionLine> lines = lineMapper.selectList(
            new LambdaQueryWrapper<ProductionLine>()
                .eq(ProductionLine::getIsSimulated, true)
        );

        for (int i = 0; i < count; i++) {
            ProductionEquipment equipment = new ProductionEquipment();

            // 基本信息
            equipment.setId(UUID.randomUUID().toString());
            String type = EQUIPMENT_TYPES[random.nextInt(EQUIPMENT_TYPES.length)];
            equipment.setEquipmentNo("EQ-SIM-" + type.toUpperCase().substring(0, 3) + "-" + String.format("%03d", i + 1));
            equipment.setEquipmentName(getEquipmentName(type) + "-" + (i + 1));
            equipment.setEquipmentType(type);

            // 所属产线 (80% 固定产线, 20% 共享)
            if (random.nextDouble() > 0.2 && !lines.isEmpty()) {
                ProductionLine line = lines.get(random.nextInt(lines.size()));
                equipment.setLineId(line.getId());
                equipment.setIsShared(false);
            } else {
                equipment.setIsShared(true);
            }

            // 能力参数
            int standardSpeed = random.nextInt(30, 150);
            equipment.setStandardSpeed(BigDecimal.valueOf(standardSpeed));
            equipment.setMaxSpeed(BigDecimal.valueOf((int) (standardSpeed * 1.3)));

            // 可处理的产品类别
            int categoryCount = random.nextInt(2, PRODUCT_CATEGORIES.length + 1);
            List<String> selectedCategories = new ArrayList<>();
            List<String> availableCategories = new ArrayList<>(Arrays.asList(PRODUCT_CATEGORIES));
            for (int j = 0; j < categoryCount && !availableCategories.isEmpty(); j++) {
                int idx = random.nextInt(availableCategories.size());
                selectedCategories.add(availableCategories.remove(idx));
            }
            equipment.setProductCategories(String.join(",", selectedCategories));

            equipment.setRequiredOperators(random.nextInt(1, 4));

            // 当前状态
            String[] statuses = {"available", "running", "setup", "maintenance", "fault"};
            int[] statusWeights = {30, 40, 10, 15, 5};
            equipment.setStatus(weightedRandom(statuses, statusWeights, random));

            if ("running".equals(equipment.getStatus())) {
                equipment.setCurrentProductCategory(selectedCategories.get(random.nextInt(selectedCategories.size())));
            }
            equipment.setEstimatedFreeTime(now.plusHours(random.nextInt(0, 6)));

            // 维护信息
            equipment.setLastMaintenanceTime(now.minusDays(random.nextInt(1, 30)));
            equipment.setNextMaintenanceTime(now.plusDays(random.nextInt(7, 60)));
            equipment.setTotalRunningHours(BigDecimal.valueOf(random.nextInt(1000, 10000)));
            equipment.setFailureRate(BigDecimal.valueOf(random.nextDouble() * 0.1));

            // 元数据
            equipment.setIsSimulated(true);
            equipment.setCreatedAt(now);
            equipment.setUpdatedAt(now);

            equipmentMapper.insert(equipment);
            equipments.add(equipment);
        }

        log.info("成功生成 {} 台模拟设备", equipments.size());
        return equipments;
    }

    @Override
    @Transactional
    public List<ProductionMold> generateSimulatedMolds(int count) {
        log.info("开始生成 {} 套模拟模具", count);

        List<ProductionMold> molds = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        ThreadLocalRandom random = ThreadLocalRandom.current();

        String[] moldTypes = {"注塑模", "冲压模", "成型模", "包装模"};

        for (int i = 0; i < count; i++) {
            ProductionMold mold = new ProductionMold();

            // 基本信息
            mold.setId(UUID.randomUUID().toString());
            mold.setMoldNo("MOLD-SIM-" + String.format("%04d", i + 1));
            String moldType = moldTypes[random.nextInt(moldTypes.length)];
            mold.setMoldName(moldType + "-" + (i + 1));
            mold.setMoldType(moldType);

            // 适用产品
            String category = PRODUCT_CATEGORIES[random.nextInt(PRODUCT_CATEGORIES.length)];
            mold.setProductCategory(category);
            mold.setApplicableSpecs(generateProductSpec() + "," + generateProductSpec());

            // 能力参数
            mold.setCavityCount(random.nextInt(1, 8));
            mold.setStandardCycleTime(random.nextInt(10, 60));
            mold.setSetupTime(random.nextInt(15, 45));
            mold.setTeardownTime(random.nextInt(10, 30));

            // 使用状态
            String[] statuses = {"available", "in_use", "maintenance", "scrapped"};
            int[] statusWeights = {50, 30, 15, 5};
            mold.setStatus(weightedRandom(statuses, statusWeights, random));

            if ("in_use".equals(mold.getStatus())) {
                mold.setEstimatedFreeTime(now.plusHours(random.nextInt(1, 8)));
            }

            // 寿命管理
            int designLife = random.nextInt(50000, 200000);
            mold.setDesignLifeCycles(designLife);
            int usedCycles = random.nextInt(0, (int) (designLife * 0.9));
            mold.setUsedCycles(usedCycles);
            mold.setRemainingLifePercent(BigDecimal.valueOf((double) (designLife - usedCycles) / designLife * 100));

            mold.setLastMaintenanceTime(now.minusDays(random.nextInt(1, 30)));
            mold.setMaintenanceCycleCounts(random.nextInt(5000, 20000));

            // 元数据
            mold.setIsSimulated(true);
            mold.setCreatedAt(now);
            mold.setUpdatedAt(now);

            moldMapper.insert(mold);
            molds.add(mold);
        }

        log.info("成功生成 {} 套模拟模具", molds.size());
        return molds;
    }

    @Override
    @Transactional
    public List<ChangeoverMatrix> generateChangeoverMatrix() {
        log.info("开始生成换型时间矩阵");

        List<ChangeoverMatrix> matrix = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        ThreadLocalRandom random = ThreadLocalRandom.current();

        // 为每对产品类别生成换型时间
        for (String fromCategory : PRODUCT_CATEGORIES) {
            for (String toCategory : PRODUCT_CATEGORIES) {
                ChangeoverMatrix changeover = new ChangeoverMatrix();

                changeover.setId(UUID.randomUUID().toString());
                changeover.setFromCategory(fromCategory);
                changeover.setToCategory(toCategory);

                // 判断换型时间
                String pairKey = fromCategory + "->" + toCategory;
                boolean needsCleaning = CLEANING_REQUIRED_PAIRS.contains(pairKey);

                if (fromCategory.equals(toCategory)) {
                    // 同类别: 10-20 分钟
                    changeover.setChangeoverMinutes(random.nextInt(10, 21));
                    changeover.setRequiresCleaning(false);
                    changeover.setCleaningMinutes(0);
                    changeover.setRequiresMoldChange(false);
                    changeover.setMoldChangeMinutes(0);
                    changeover.setRequiresCalibration(random.nextBoolean());
                    changeover.setCalibrationMinutes(changeover.getRequiresCalibration() ? random.nextInt(5, 15) : 0);
                    changeover.setRemark("同类别换型");
                } else if (needsCleaning) {
                    // 需要清洁: 90-120 分钟
                    changeover.setChangeoverMinutes(random.nextInt(90, 121));
                    changeover.setRequiresCleaning(true);
                    changeover.setCleaningMinutes(random.nextInt(30, 60));
                    changeover.setRequiresMoldChange(true);
                    changeover.setMoldChangeMinutes(random.nextInt(20, 40));
                    changeover.setRequiresCalibration(true);
                    changeover.setCalibrationMinutes(random.nextInt(10, 20));
                    changeover.setRemark("需深度清洁换型");
                } else {
                    // 不同类别: 30-60 分钟
                    changeover.setChangeoverMinutes(random.nextInt(30, 61));
                    changeover.setRequiresCleaning(random.nextDouble() < 0.3);
                    changeover.setCleaningMinutes(changeover.getRequiresCleaning() ? random.nextInt(10, 25) : 0);
                    changeover.setRequiresMoldChange(random.nextDouble() < 0.5);
                    changeover.setMoldChangeMinutes(changeover.getRequiresMoldChange() ? random.nextInt(15, 30) : 0);
                    changeover.setRequiresCalibration(true);
                    changeover.setCalibrationMinutes(random.nextInt(5, 15));
                    changeover.setRemark("跨类别换型");
                }

                changeover.setRequiredWorkers(random.nextInt(1, 4));
                changeover.setChangeoverCost(changeover.getChangeoverMinutes() * random.nextInt(5, 15));

                changeover.setIsSimulated(true);
                changeover.setCreatedAt(now);
                changeover.setUpdatedAt(now);

                changeoverMapper.insert(changeover);
                matrix.add(changeover);
            }
        }

        log.info("成功生成 {} 条换型矩阵记录", matrix.size());
        return matrix;
    }

    @Override
    @Transactional
    public Map<String, Integer> clearSimulatedData() {
        log.info("开始清除所有模拟数据");

        Map<String, Integer> deletedCounts = new LinkedHashMap<>();

        // 清除顺序: 先清除有外键依赖的表
        int changeoverCount = changeoverMapper.delete(
            new LambdaQueryWrapper<ChangeoverMatrix>()
                .eq(ChangeoverMatrix::getIsSimulated, true)
        );
        deletedCounts.put("changeoverMatrix", changeoverCount);

        int moldCount = moldMapper.delete(
            new LambdaQueryWrapper<ProductionMold>()
                .eq(ProductionMold::getIsSimulated, true)
        );
        deletedCounts.put("molds", moldCount);

        int equipmentCount = equipmentMapper.delete(
            new LambdaQueryWrapper<ProductionEquipment>()
                .eq(ProductionEquipment::getIsSimulated, true)
        );
        deletedCounts.put("equipment", equipmentCount);

        int workerCount = workerMapper.delete(
            new LambdaQueryWrapper<ProductionWorker>()
                .eq(ProductionWorker::getIsSimulated, true)
        );
        deletedCounts.put("workers", workerCount);

        int orderCount = orderMapper.delete(
            new LambdaQueryWrapper<ProductionOrder>()
                .eq(ProductionOrder::getIsSimulated, true)
        );
        deletedCounts.put("orders", orderCount);

        int lineCount = lineMapper.delete(
            new LambdaQueryWrapper<ProductionLine>()
                .eq(ProductionLine::getIsSimulated, true)
        );
        deletedCounts.put("lines", lineCount);

        log.info("模拟数据清除完成: {}", deletedCounts);
        return deletedCounts;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 根据产品类别生成产品名称
     */
    private String generateProductName(String category) {
        ThreadLocalRandom random = ThreadLocalRandom.current();

        switch (category) {
            case "糕点类":
                String[] cakes = {"奶油蛋糕", "巧克力面包", "红豆酥", "蛋黄派", "夹心饼干", "曲奇饼干"};
                return cakes[random.nextInt(cakes.length)];
            case "饮品类":
                String[] drinks = {"果汁饮料", "乳酸菌饮品", "矿泉水", "功能饮料", "碳酸饮料", "茶饮料"};
                return drinks[random.nextInt(drinks.length)];
            case "调味品类":
                String[] seasonings = {"酱油", "醋", "辣椒酱", "番茄酱", "蚝油", "鸡精"};
                return seasonings[random.nextInt(seasonings.length)];
            case "休闲食品类":
                String[] snacks = {"薯片", "果冻", "坚果", "肉干", "膨化食品", "糖果"};
                return snacks[random.nextInt(snacks.length)];
            case "速冻类":
                String[] frozen = {"速冻水饺", "速冻汤圆", "速冻包子", "冷冻披萨", "冷冻蔬菜", "冰淇淋"};
                return frozen[random.nextInt(frozen.length)];
            default:
                return "通用产品";
        }
    }

    /**
     * 生成产品规格
     */
    private String generateProductSpec() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        String[] units = {"g", "ml", "个", "袋"};
        int[] weights = {100, 200, 250, 300, 500, 1000};
        return weights[random.nextInt(weights.length)] + units[random.nextInt(units.length)];
    }

    /**
     * 根据设备类型获取设备名称
     */
    private String getEquipmentName(String type) {
        switch (type) {
            case "mixer":
                return "搅拌机";
            case "filler":
                return "灌装机";
            case "sealer":
                return "封口机";
            case "labeler":
                return "贴标机";
            case "wrapper":
                return "包装机";
            default:
                return "通用设备";
        }
    }

    /**
     * 带权重的随机选择
     */
    private String weightedRandom(String[] options, int[] weights, ThreadLocalRandom random) {
        int totalWeight = 0;
        for (int weight : weights) {
            totalWeight += weight;
        }

        int randomValue = random.nextInt(totalWeight);
        int cumulativeWeight = 0;

        for (int i = 0; i < options.length; i++) {
            cumulativeWeight += weights[i];
            if (randomValue < cumulativeWeight) {
                return options[i];
            }
        }

        return options[0];
    }
}
