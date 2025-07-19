/**
 * 工厂ID生成器
 * 基于GB/T 4754-2017行业分类 + 地理位置的智能推断引擎
 * 生成格式：II-GG-YYYY-NNN
 */

import { matchIndustryKeywords, getIndustryName } from '../config/industry-keywords.js';
import { matchRegionKeywords, getRegionName } from '../config/region-keywords.js';
import { inferRegionFromPhone, isValidMobileNumber } from '../config/mobile-regions.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 智能推断引擎
 * 根据输入信息推断行业代码和地理代码
 */
export class FactoryInferenceEngine {
  constructor() {
    this.confidenceThreshold = 0.7; // 置信度阈值
  }

  /**
   * 综合推断工厂信息
   * @param {Object} input - 输入信息
   * @param {string} input.name - 工厂名称
   * @param {string} input.industry - 行业描述（可选）
   * @param {string} input.address - 详细地址（可选）
   * @param {string} input.contactPhone - 联系电话（可选）
   * @param {string} input.contactEmail - 联系邮箱（可选）
   * @returns {Object} 推断结果
   */
  async inferFactoryInfo(input) {
    const result = {
      industryCode: '140',
      regionCode: 'BJ',
      year: new Date().getFullYear(),
      sequenceNumber: 1,
      confidence: {
        industry: 0.5,
        region: 0.3,
        overall: 0.4
      },
      reasoning: {
        industry: [],
        region: [],
        warnings: []
      },
      needsConfirmation: false
    };

    try {
      // 1. 推断行业代码
      const industryInference = await this.inferIndustryCode(input);
      result.industryCode = industryInference.industryCode;
      result.confidence.industry = industryInference.confidence;
      result.reasoning.industry = industryInference.reasoning;

      // 2. 推断地理代码
      const regionInference = await this.inferRegionCode(input);
      result.regionCode = regionInference.regionCode;
      result.confidence.region = regionInference.confidence;
      result.reasoning.region = regionInference.reasoning;

      // 3. 生成序号
      result.sequenceNumber = await this.generateSequenceNumber(
        result.industryCode,
        result.regionCode,
        result.year
      );

      // 4. 计算综合置信度
      result.confidence.overall = (
        result.confidence.industry * 0.6 + 
        result.confidence.region * 0.4
      );

      // 5. 判断是否需要人工确认
      result.needsConfirmation = result.confidence.overall < this.confidenceThreshold;

      // 6. 生成推断日志
      result.reasoning.warnings = this.generateWarnings(result);

      return result;
    } catch (error) {
      console.error('Factory inference error:', error);
      result.reasoning.warnings.push('推断过程中发生错误，使用默认值');
      return result;
    }
  }

  /**
   * 推断行业代码
   * @param {Object} input - 输入信息
   * @returns {Object} 行业推断结果
   */
  async inferIndustryCode(input) {
    const reasoning = [];
    
    // 组合用于分析的文本
    const analysisText = [
      input.name || '',
      input.industry || '',
      input.contactEmail || ''
    ].join(' ').trim();

    if (!analysisText) {
      reasoning.push('缺少有效的工厂名称和行业信息');
      return {
        industryCode: '140',
        confidence: 0.5,
        reasoning
      };
    }

    // 使用关键词匹配
    const industryMatch = matchIndustryKeywords(analysisText);
    
    reasoning.push(`从文本"${analysisText}"中匹配到关键词: ${industryMatch.matchedKeywords.join(', ')}`);
    reasoning.push(`推断行业: ${industryMatch.industryName} (${industryMatch.industryCode})`);

    return {
      industryCode: industryMatch.industryCode,
      confidence: industryMatch.confidence,
      reasoning
    };
  }

  /**
   * 推断地理代码
   * @param {Object} input - 输入信息
   * @returns {Object} 地理推断结果
   */
  async inferRegionCode(input) {
    const reasoning = [];
    let bestMatch = {
      regionCode: 'BJ',
      confidence: 0.3,
      reasoning: ['默认使用北京']
    };

    // 方法1: 地址解析（最高优先级）
    if (input.address) {
      const addressMatch = matchRegionKeywords(input.address);
      reasoning.push(`从地址"${input.address}"中匹配到关键词: ${addressMatch.matchedKeywords.join(', ')}`);
      reasoning.push(`推断地区: ${addressMatch.regionName} (${addressMatch.regionCode})`);
      
      if (addressMatch.confidence > bestMatch.confidence) {
        bestMatch = {
          regionCode: addressMatch.regionCode,
          confidence: addressMatch.confidence,
          reasoning
        };
      }
    }

    // 方法2: 工厂名称中的地理信息
    if (input.name) {
      const nameMatch = matchRegionKeywords(input.name);
      if (nameMatch.confidence > 0.5) {
        reasoning.push(`从工厂名称"${input.name}"中匹配到地理信息: ${nameMatch.matchedKeywords.join(', ')}`);
        
        if (nameMatch.confidence > bestMatch.confidence) {
          bestMatch = {
            regionCode: nameMatch.regionCode,
            confidence: nameMatch.confidence,
            reasoning
          };
        }
      }
    }

    // 方法3: 手机号归属地（优先级较低）
    if (input.contactPhone && isValidMobileNumber(input.contactPhone)) {
      const phoneMatch = inferRegionFromPhone(input.contactPhone);
      reasoning.push(`从手机号"${input.contactPhone}"推断归属地: ${phoneMatch.regionName} (${phoneMatch.regionCode})`);
      reasoning.push(`推断方法: ${phoneMatch.method}, 置信度: ${phoneMatch.confidence}`);
      
      // 只有在没有其他更可靠信息时才使用手机号
      if (bestMatch.confidence < 0.5 && phoneMatch.confidence > bestMatch.confidence) {
        bestMatch = {
          regionCode: phoneMatch.regionCode,
          confidence: phoneMatch.confidence,
          reasoning
        };
      }
    }

    // 方法4: 邮箱域名分析（最低优先级）
    if (input.contactEmail && input.contactEmail.includes('@')) {
      const emailDomain = input.contactEmail.split('@')[1];
      const domainMatch = matchRegionKeywords(emailDomain);
      
      if (domainMatch.confidence > 0.3) {
        reasoning.push(`从邮箱域名"${emailDomain}"中发现地理信息: ${domainMatch.matchedKeywords.join(', ')}`);
        
        if (bestMatch.confidence < 0.4 && domainMatch.confidence > bestMatch.confidence) {
          bestMatch = {
            regionCode: domainMatch.regionCode,
            confidence: domainMatch.confidence,
            reasoning
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 生成序列号
   * @param {string} industryCode - 行业代码
   * @param {string} regionCode - 地区代码
   * @param {number} year - 年份
   * @returns {number} 序列号
   */
  async generateSequenceNumber(industryCode, regionCode, year) {
    try {
      // 查询同类型工厂的最大序号
      const existingFactories = await prisma.factory.findMany({
        where: {
          industryCode: industryCode,
          regionCode: regionCode,
          factoryYear: year
        },
        select: {
          sequenceNumber: true
        },
        orderBy: {
          sequenceNumber: 'desc'
        },
        take: 1
      });

      const maxSequence = existingFactories.length > 0 ? existingFactories[0].sequenceNumber : 0;
      return maxSequence + 1;
    } catch (error) {
      console.error('Error generating sequence number:', error);
      return 1; // 默认从1开始
    }
  }

  /**
   * 生成新格式的工厂ID
   * @param {string} industryCode - 行业代码
   * @param {string} regionCode - 地区代码
   * @param {number} year - 年份
   * @param {number} sequenceNumber - 序列号
   * @returns {string} 工厂ID
   */
  generateFactoryId(industryCode, regionCode, year, sequenceNumber) {
    const formattedSequence = sequenceNumber.toString().padStart(3, '0');
    return `${industryCode}-${regionCode}-${year}-${formattedSequence}`;
  }

  /**
   * 生成警告信息
   * @param {Object} result - 推断结果
   * @returns {Array} 警告信息数组
   */
  generateWarnings(result) {
    const warnings = [];

    if (result.confidence.industry < 0.7) {
      warnings.push(`行业推断置信度较低 (${result.confidence.industry.toFixed(2)})，建议人工确认`);
    }

    if (result.confidence.region < 0.7) {
      warnings.push(`地区推断置信度较低 (${result.confidence.region.toFixed(2)})，建议人工确认`);
    }

    if (result.confidence.overall < 0.6) {
      warnings.push('综合置信度较低，强烈建议人工审核');
    }

    return warnings;
  }
}

/**
 * 工厂ID生成器主类
 */
export class FactoryIdGenerator {
  constructor() {
    this.inferenceEngine = new FactoryInferenceEngine();
  }

  /**
   * 生成新的工厂ID
   * @param {Object} factoryData - 工厂数据
   * @returns {Object} 生成结果
   */
  async generateNewFactoryId(factoryData) {
    try {
      // 1. 智能推断
      const inference = await this.inferenceEngine.inferFactoryInfo(factoryData);

      // 2. 生成ID
      const factoryId = this.inferenceEngine.generateFactoryId(
        inference.industryCode,
        inference.regionCode,
        inference.year,
        inference.sequenceNumber
      );

      // 3. 返回完整结果
      return {
        factoryId,
        industryCode: inference.industryCode,
        regionCode: inference.regionCode,
        factoryYear: inference.year,
        sequenceNumber: inference.sequenceNumber,
        industryName: getIndustryName(inference.industryCode),
        regionName: getRegionName(inference.regionCode),
        confidence: inference.confidence,
        reasoning: inference.reasoning,
        needsConfirmation: inference.needsConfirmation,
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0',
          algorithm: 'smart-inference-v1'
        }
      };
    } catch (error) {
      console.error('Factory ID generation error:', error);
      throw new Error('工厂ID生成失败: ' + error.message);
    }
  }

  /**
   * 验证工厂ID格式
   * @param {string} factoryId - 工厂ID
   * @returns {Object} 验证结果
   */
  validateFactoryId(factoryId) {
    const pattern = /^(\d{3})-([A-Z]{2})-(\d{4})-(\d{3})$/;
    const match = factoryId.match(pattern);

    if (!match) {
      return {
        isValid: false,
        error: '工厂ID格式不正确，应为 III-GG-YYYY-NNN 格式'
      };
    }

    const [, industryCode, regionCode, year, sequence] = match;

    return {
      isValid: true,
      parsed: {
        industryCode,
        regionCode,
        year: parseInt(year),
        sequenceNumber: parseInt(sequence),
        industryName: getIndustryName(industryCode),
        regionName: getRegionName(regionCode)
      }
    };
  }

  /**
   * 解析工厂ID
   * @param {string} factoryId - 工厂ID
   * @returns {Object} 解析结果
   */
  parseFactoryId(factoryId) {
    const validation = this.validateFactoryId(factoryId);
    
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    return validation.parsed;
  }
}

// 导出默认实例
export const factoryIdGenerator = new FactoryIdGenerator();

// 导出工具函数
export { getIndustryName, getRegionName };

/**
 * 批量生成工厂ID（用于测试）
 * @param {Array} factoryDataList - 工厂数据数组
 * @returns {Array} 生成结果数组
 */
export async function batchGenerateFactoryIds(factoryDataList) {
  const generator = new FactoryIdGenerator();
  const results = [];

  for (const factoryData of factoryDataList) {
    try {
      const result = await generator.generateNewFactoryId(factoryData);
      results.push({ success: true, ...result });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        input: factoryData
      });
    }
  }

  return results;
}