/**
 * 质检专用 AI Prompt
 * Quality Inspection AI Prompt
 */

import { InspectionData, InspectionBatch, AIExtractionResponse } from './types';
import { INSPECTION_ITEMS, calculateGrade } from './config';

/**
 * 系统提示词
 */
export const QUALITY_INSPECTION_SYSTEM_PROMPT = `
你是白垩纪食品溯源系统的智能质检助手。你的任务是：
1. 理解质检员的口述内容
2. 提取关键检验数据
3. 引导完成所有检验项目
4. 确认并汇总检验结果

## 检验项目（HACCP标准）
1. 外观（0-20分）：色泽、形态、瑕疵
2. 气味（0-20分）：正常/轻微异味/明显异味
3. 规格（0-20分）：尺寸标准、偏差
4. 重量（0-20分）：重量标准、偏差
5. 包装（0-20分）：完整性、标签

## 响应格式
你必须返回一个JSON对象，格式如下：
{
  "action": "extract" | "confirm" | "prompt" | "complete" | "error",
  "extractedData": {
    "sampleSize": 10,
    "appearance": { "score": 18, "notes": ["色泽正常", "有瑕疵1件"] },
    "smell": { "score": 20, "notes": ["正常"] },
    "specification": { "score": 16, "notes": ["平均15.2cm", "2件偏小"] },
    "weight": { "score": 19, "notes": ["平均148g"] },
    "packaging": { "score": 20, "notes": ["包装完整", "标签清晰"] }
  },
  "missingItems": ["规格", "重量", "包装"],
  "speechResponse": "已记录外观18分，请继续检查规格...",
  "isComplete": false,
  "totalScore": 93,
  "suggestedGrade": "B"
}

## 交互规则
1. 使用简洁的中文回复
2. 主动提示缺失的信息
3. 数字要准确提取
4. 不确定时询问确认
5. 完成所有项目后汇总结果
6. 语音响应要简短，适合朗读

## 评分标准
- A级: 90分及以上
- B级: 80-89分
- C级: 60-79分
- D级: 60分以下

## 示例对话
用户: "抽样10件，外观色泽正常，形态完整，有1件轻微裂纹，评分18分"
助手: {
  "action": "extract",
  "extractedData": {
    "sampleSize": 10,
    "appearance": { "score": 18, "notes": ["色泽正常", "形态完整", "有瑕疵1件"] }
  },
  "missingItems": ["气味", "规格", "重量", "包装"],
  "speechResponse": "已记录外观18分。还需要检查气味、规格、重量和包装。请继续。",
  "isComplete": false
}
`;

/**
 * 生成检验开始提示
 */
export function generateStartPrompt(batch: InspectionBatch): string {
  return `好的，已定位到批次 ${batch.batchNumber}，${batch.productName}，${batch.quantity}${batch.unit}${batch.source ? `，来源${batch.source}` : ''}。请开始检验，需要检查的项目包括：外观、气味、规格、重量、包装。`;
}

/**
 * 生成用户消息上下文
 */
export function generateUserContext(
  batch: InspectionBatch,
  currentData: Partial<InspectionData>,
  userMessage: string
): string {
  const completedItems = getCompletedItems(currentData);
  const missingItems = getMissingItems(currentData);

  return `
当前批次: ${batch.batchNumber} (${batch.productName}, ${batch.quantity}${batch.unit})
已完成检验项: ${completedItems.length > 0 ? completedItems.join('、') : '无'}
待检验项: ${missingItems.join('、')}
当前已记录数据: ${JSON.stringify(currentData)}

用户说: "${userMessage}"

请提取用户口述中的检验数据，并返回JSON格式响应。
`;
}

/**
 * 获取已完成的检验项
 */
export function getCompletedItems(data: Partial<InspectionData>): string[] {
  const completed: string[] = [];

  if (data.appearance?.score !== undefined) completed.push('外观');
  if (data.smell?.score !== undefined) completed.push('气味');
  if (data.specification?.score !== undefined) completed.push('规格');
  if (data.weight?.score !== undefined) completed.push('重量');
  if (data.packaging?.score !== undefined) completed.push('包装');

  return completed;
}

/**
 * 获取未完成的检验项
 */
export function getMissingItems(data: Partial<InspectionData>): string[] {
  const missing: string[] = [];

  if (data.appearance?.score === undefined) missing.push('外观');
  if (data.smell?.score === undefined) missing.push('气味');
  if (data.specification?.score === undefined) missing.push('规格');
  if (data.weight?.score === undefined) missing.push('重量');
  if (data.packaging?.score === undefined) missing.push('包装');

  return missing;
}

/**
 * 计算总分
 */
export function calculateTotalScore(data: Partial<InspectionData>): number {
  let total = 0;

  if (data.appearance?.score) total += data.appearance.score;
  if (data.smell?.score) total += data.smell.score;
  if (data.specification?.score) total += data.specification.score;
  if (data.weight?.score) total += data.weight.score;
  if (data.packaging?.score) total += data.packaging.score;

  return total;
}

/**
 * 检查是否完成所有检验
 */
export function isInspectionComplete(data: Partial<InspectionData>): boolean {
  return getMissingItems(data).length === 0;
}

/**
 * 生成检验完成汇总
 */
export function generateCompletionSummary(data: InspectionData): string {
  const totalScore = calculateTotalScore(data);
  const grade = calculateGrade(totalScore);

  return `已完成全部检验项目：外观${data.appearance?.score}分、气味${data.smell?.score}分、规格${data.specification?.score}分、重量${data.weight?.score}分、包装${data.packaging?.score}分。总分${totalScore}分，建议等级${grade}。是否确认提交？`;
}

/**
 * 解析 AI 响应
 */
export function parseAIResponse(responseText: string): AIExtractionResponse | null {
  try {
    // 尝试提取 JSON 部分
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('无法从响应中提取JSON:', responseText);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIExtractionResponse;

    // 验证必需字段
    if (!parsed.action || !parsed.speechResponse) {
      console.error('AI响应缺少必需字段:', parsed);
      return null;
    }

    // 补充计算字段
    if (parsed.extractedData) {
      const totalScore = calculateTotalScore(parsed.extractedData);
      parsed.totalScore = totalScore;
      parsed.suggestedGrade = calculateGrade(totalScore);
      parsed.isComplete = isInspectionComplete(parsed.extractedData);
      parsed.missingItems = getMissingItems(parsed.extractedData);
    }

    return parsed;
  } catch (error) {
    console.error('解析AI响应失败:', error, responseText);
    return null;
  }
}

/**
 * 生成错误响应
 */
export function generateErrorResponse(message: string): AIExtractionResponse {
  return {
    action: 'error',
    speechResponse: message,
    isComplete: false,
    missingItems: INSPECTION_ITEMS.map((item) => item.name),
  };
}
