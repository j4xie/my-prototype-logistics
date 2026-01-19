package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.service.scheduling.SchedulingComplexityRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingComplexityRouterImpl implements SchedulingComplexityRouter {

    // 阈值配置
    private static final int SIMPLE_WORKER_THRESHOLD = 10;
    private static final int MEDIUM_WORKER_THRESHOLD = 50;
    private static final int SIMPLE_TASK_THRESHOLD = 20;
    private static final int MEDIUM_TASK_THRESHOLD = 100;
    private static final double HIGH_URGENCY_RATIO = 0.3;
    private static final double HIGH_TEMP_WORKER_RATIO = 0.3;

    @Override
    public SchedulingComplexity evaluateComplexity(String factoryId, SchedulingContext context) {
        SchedulingComplexity complexity = new SchedulingComplexity();

        // 1. 工人复杂度
        int workerCount = context.getAvailableWorkerCount();
        double workerComplexity;
        if (workerCount <= SIMPLE_WORKER_THRESHOLD) {
            workerComplexity = 0.2;
        } else if (workerCount <= MEDIUM_WORKER_THRESHOLD) {
            workerComplexity = 0.2 + 0.4 * (workerCount - SIMPLE_WORKER_THRESHOLD) /
                    (double)(MEDIUM_WORKER_THRESHOLD - SIMPLE_WORKER_THRESHOLD);
        } else {
            workerComplexity = 0.6 + 0.4 * Math.min(1.0, (workerCount - MEDIUM_WORKER_THRESHOLD) / 50.0);
        }

        // 临时工比例增加复杂度
        double tempRatio = context.getTempWorkerCount() / (double) Math.max(1, workerCount);
        if (tempRatio > HIGH_TEMP_WORKER_RATIO) {
            workerComplexity = Math.min(1.0, workerComplexity + 0.15);
        }
        complexity.setWorkerComplexity(workerComplexity);

        // 2. 任务复杂度
        int taskCount = context.getPendingTaskCount();
        int processTypes = context.getProcessTypeCount();
        double taskComplexity;
        if (taskCount <= SIMPLE_TASK_THRESHOLD) {
            taskComplexity = 0.2;
        } else if (taskCount <= MEDIUM_TASK_THRESHOLD) {
            taskComplexity = 0.2 + 0.4 * (taskCount - SIMPLE_TASK_THRESHOLD) /
                    (double)(MEDIUM_TASK_THRESHOLD - SIMPLE_TASK_THRESHOLD);
        } else {
            taskComplexity = 0.6 + 0.4 * Math.min(1.0, (taskCount - MEDIUM_TASK_THRESHOLD) / 100.0);
        }

        // 工序类型增加复杂度
        if (processTypes > 5) {
            taskComplexity = Math.min(1.0, taskComplexity + 0.1);
        }
        complexity.setTaskComplexity(taskComplexity);

        // 3. 约束复杂度
        double constraintComplexity = 0.0;
        if (context.hasSkuConstraints()) {
            constraintComplexity += 0.3;
        }
        if (context.hasTimeConstraints()) {
            constraintComplexity += 0.3;
        }
        if (context.getUrgentTaskRatio() > HIGH_URGENCY_RATIO) {
            constraintComplexity += 0.2;
        }
        complexity.setConstraintComplexity(Math.min(1.0, constraintComplexity));

        // 4. 动态变化程度 (基于临时工比例和紧急任务比例)
        double dynamismScore = tempRatio * 0.5 + context.getUrgentTaskRatio() * 0.5;
        complexity.setDynamismScore(dynamismScore);

        // 5. 综合分数 (加权平均)
        double overall = workerComplexity * 0.3 +
                        taskComplexity * 0.3 +
                        constraintComplexity * 0.25 +
                        dynamismScore * 0.15;
        complexity.setOverallScore(overall);

        // 6. 确定推荐模式
        SchedulingMode mode = routeToAlgorithm(complexity);
        complexity.setRecommendedMode(mode);

        // 7. 生成解释
        StringBuilder explanation = new StringBuilder();
        explanation.append(String.format("工人复杂度: %.2f (工人数: %d, 临时工: %d)",
                workerComplexity, workerCount, context.getTempWorkerCount()));
        explanation.append(String.format(", 任务复杂度: %.2f (任务数: %d, 工序: %d)",
                taskComplexity, taskCount, processTypes));
        explanation.append(String.format(", 约束复杂度: %.2f", constraintComplexity));
        explanation.append(String.format(", 综合: %.2f -> %s", overall, mode));
        complexity.setExplanation(explanation.toString());

        log.info("Scheduling complexity for {}: {}", factoryId, complexity.getExplanation());

        return complexity;
    }

    @Override
    public SchedulingMode routeToAlgorithm(SchedulingComplexity complexity) {
        double score = complexity.getOverallScore();

        if (score < 0.3) {
            return SchedulingMode.RULE_BASED;
        } else if (score < 0.65) {
            return SchedulingMode.LINUCB_FAIR;
        } else {
            return SchedulingMode.HIERARCHICAL_RL;
        }
    }

    @Override
    public SchedulingMode getRecommendedMode(String factoryId, SchedulingContext context) {
        SchedulingComplexity complexity = evaluateComplexity(factoryId, context);
        return complexity.getRecommendedMode();
    }
}
