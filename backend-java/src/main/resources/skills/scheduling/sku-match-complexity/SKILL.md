---
name: sku-match-complexity
displayName: SKU复杂度匹配
description: 根据SKU复杂度自动匹配合适技能等级的工人，复杂产品给熟练工，简单产品可给新人练习
version: 1.0.0
triggers:
  - "复杂产品"
  - "技能匹配"
  - "SKU分配"
  - "产品难度"
tools:
  - SkuComplexityService
  - WorkerFeatureLearningService
contextNeeded:
  - factoryId
  - skuCode
  - workerSkillLevel
parameters:
  complexityLevels: [1,2,3,4,5]
  skillThresholds: [1,1,2,3,4]
  complexityWeight: 0.15
  trainingOpportunityBonus: 0.1
requiredPermission: "scheduling:sku-match:execute"
category: "scheduling"
priority: 50
---
# 功能说明
SKU复杂度与工人技能的智能匹配

## 复杂度等级
| 等级 | 说明 | 最低技能 | 适合工人 |
|------|------|----------|----------|
| 1 | 非常简单 | 1 | 任意/新人优先 |
| 2 | 简单 | 1 | 任意 |
| 3 | 中等 | 2 | 有经验工人 |
| 4 | 复杂 | 3 | 熟练工人 |
| 5 | 非常复杂 | 4 | 专家级工人 |

## 匹配公式
IF skill_level >= required_skill:
    score += complexity_match_bonus
ELIF is_trainee AND complexity <= 2:
    score += training_opportunity_bonus
ELSE:
    score *= skill_gap_penalty
