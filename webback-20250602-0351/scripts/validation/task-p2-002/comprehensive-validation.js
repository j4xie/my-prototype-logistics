#!/usr/bin/env node

/**
 * @task TASK-P2-002: UI组件梳理与组织
 * @type 综合验证
 * @description 统筹TASK-P2-002所有验证脚本，提供完整的组件体系验收
 * @created 2025-05-27
 * @lastUpdated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

// 导入子验证器
const ComponentStructureValidator = require('./component-structure-validation');
const UnitTestValidator = require('./unit-test-validation');

// 验证脚本元数据
const VALIDATION_META = {
    taskId: 'TASK-P2-002',
    validationType: 'comprehensive',
    module: 'UI组件梳理与组织',
    reportPath: 'refactor/phase-2/progress-reports/'
};

class TaskP2002ComprehensiveValidator {
    constructor() {
        this.results = {
            subValidators: {},
            overall: {
                passed: 0,
                failed: 0,
                score: 0
            },
            taskCompletion: 0
        };
    }

    /**
     * 主验证入口
     */
    async validate() {
        console.log('🎯 开始 TASK-P2-002 综合验证...\n');
        console.log('📋 任务：UI组件梳理与组织');
        console.log('🎯 目标：完成UI组件体系建设，为移动端适配提供基础\n');

        try {
            // 1. 组件结构验证
            console.log('🏗️  执行组件结构验证...');
            const structureValidator = new ComponentStructureValidator();
            this.results.subValidators.structure = await structureValidator.validate();
            
            console.log('\n' + '='.repeat(60) + '\n');
            
            // 2. 单元测试验证  
            console.log('🧪 执行单元测试验证...');
            const unitTestValidator = new UnitTestValidator();
            this.results.subValidators.unitTest = await unitTestValidator.validate();
            
            console.log('\n' + '='.repeat(60) + '\n');

            // 3. 计算综合得分
            this.calculateOverallScore();
            
            // 4. 评估任务完成度
            this.assessTaskCompletion();
            
            // 5. 生成综合报告
            await this.generateComprehensiveReport();
            
            this.printSummary();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ 综合验证过程中发生错误:', error.message);
            throw error;
        }
    }

    /**
     * 计算综合得分
     */
    calculateOverallScore() {
        const weights = {
            structure: 0.7,  // 组件结构权重70%
            unitTest: 0.3    // 单元测试权重30%
        };

        let weightedScore = 0;
        let totalWeight = 0;

        for (const [type, result] of Object.entries(this.results.subValidators)) {
            if (weights[type] && result.score !== undefined) {
                weightedScore += result.score * weights[type];
                totalWeight += weights[type];
                
                this.results.overall.passed += result.passed || 0;
                this.results.overall.failed += result.failed || 0;
            }
        }

        this.results.overall.score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    }

    /**
     * 评估任务完成度
     */
    assessTaskCompletion() {
        const structureScore = this.results.subValidators.structure?.score || 0;
        const unitTestScore = this.results.subValidators.unitTest?.score || 0;
        
        // 任务完成度计算逻辑
        let completionFactors = [];
        
        // 组件结构完成度 (权重60%)
        if (structureScore >= 90) completionFactors.push(60);
        else if (structureScore >= 80) completionFactors.push(50);
        else if (structureScore >= 70) completionFactors.push(40);
        else completionFactors.push(20);
        
        // 单元测试完成度 (权重25%)  
        if (unitTestScore >= 80) completionFactors.push(25);
        else if (unitTestScore >= 60) completionFactors.push(20);
        else if (unitTestScore >= 40) completionFactors.push(15);
        else completionFactors.push(5);
        
        // 组件质量加分 (权重15%)
        const hasModernComponents = structureScore >= 85;
        const hasGoodDocumentation = this.checkDocumentationQuality();
        
        if (hasModernComponents && hasGoodDocumentation) completionFactors.push(15);
        else if (hasModernComponents || hasGoodDocumentation) completionFactors.push(10);
        else completionFactors.push(5);
        
        this.results.taskCompletion = Math.min(100, completionFactors.reduce((sum, factor) => sum + factor, 0));
    }

    /**
     * 检查文档质量
     */
    checkDocumentationQuality() {
        try {
            const readmePath = path.join(__dirname, '../../../web-app/src/components/ui/README.md');
            if (!fs.existsSync(readmePath)) return false;
            
            const content = fs.readFileSync(readmePath, 'utf8');
            return content.length > 1000 && content.includes('组件清单') && content.includes('设计系统');
        } catch {
            return false;
        }
    }

    /**
     * 生成综合报告
     */
    async generateComprehensiveReport() {
        const reportDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const report = {
            task: 'TASK-P2-002',
            title: 'UI组件梳理与组织 - 综合验证报告',
            timestamp: new Date().toISOString(),
            summary: {
                overallScore: this.results.overall.score,
                taskCompletion: this.results.taskCompletion,
                totalTests: this.results.overall.passed + this.results.overall.failed,
                passedTests: this.results.overall.passed,
                failedTests: this.results.overall.failed
            },
            subValidationResults: this.results.subValidators,
            taskAnalysis: this.generateTaskAnalysis(),
            nextSteps: this.generateNextSteps(),
            phaseReadiness: this.assessPhaseReadiness()
        };

        const reportPath = path.join(reportDir, `task-p2-002-comprehensive-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📊 综合验证报告已生成: ${reportPath}`);
    }

    /**
     * 生成任务分析
     */
    generateTaskAnalysis() {
        const structureScore = this.results.subValidators.structure?.score || 0;
        const unitTestScore = this.results.subValidators.unitTest?.score || 0;
        
        return {
            strengths: this.identifyStrengths(structureScore, unitTestScore),
            weaknesses: this.identifyWeaknesses(structureScore, unitTestScore),
            riskAreas: this.identifyRiskAreas(),
            recommendations: this.generateTaskRecommendations()
        };
    }

    /**
     * 识别优势领域
     */
    identifyStrengths(structureScore, unitTestScore) {
        const strengths = [];
        
        if (structureScore >= 85) {
            strengths.push('组件结构组织良好，符合模块化设计原则');
        }
        
        if (unitTestScore >= 70) {
            strengths.push('单元测试覆盖较好，质量控制到位');
        }
        
        if (this.checkDocumentationQuality()) {
            strengths.push('组件文档完善，为后续维护提供良好支撑');
        }
        
        return strengths.length > 0 ? strengths : ['基础结构已建立，为后续开发奠定基础'];
    }

    /**
     * 识别薄弱环节
     */
    identifyWeaknesses(structureScore, unitTestScore) {
        const weaknesses = [];
        
        if (structureScore < 70) {
            weaknesses.push('组件结构需要进一步优化，存在组织性问题');
        }
        
        if (unitTestScore < 60) {
            weaknesses.push('单元测试覆盖不足，需要补充测试用例');
        }
        
        if (!this.checkDocumentationQuality()) {
            weaknesses.push('组件文档需要完善，缺少使用指南');
        }
        
        return weaknesses;
    }

    /**
     * 识别风险区域
     */
    identifyRiskAreas() {
        const risks = [];
        
        if (this.results.overall.score < 80) {
            risks.push('整体质量不达标，可能影响Phase-3技术栈现代化');
        }
        
        if (this.results.taskCompletion < 80) {
            risks.push('任务完成度偏低，需要加快进度以支撑移动端适配');
        }
        
        return risks;
    }

    /**
     * 生成任务建议
     */
    generateTaskRecommendations() {
        const recommendations = [];
        
        if (this.results.overall.score < 90) {
            recommendations.push('优先完善组件结构，确保符合设计系统规范');
        }
        
        if (this.results.subValidators.unitTest?.score < 70) {
            recommendations.push('加强单元测试建设，提升测试覆盖率');
        }
        
        recommendations.push('为Phase-3准备组件现代化方案');
        
        return recommendations;
    }

    /**
     * 生成后续步骤
     */
    generateNextSteps() {
        const nextSteps = [];
        
        if (this.results.taskCompletion >= 85) {
            nextSteps.push('任务基本完成，可以开始Phase-3规划');
            nextSteps.push('整理组件清单，为技术栈现代化做准备');
        } else {
            nextSteps.push('继续完善组件体系，重点关注质量提升');
            nextSteps.push('补充缺失的测试用例和文档');
        }
        
        return nextSteps;
    }

    /**
     * 评估Phase就绪状态
     */
    assessPhaseReadiness() {
        const readiness = {
            phase2Ready: this.results.taskCompletion >= 75,
            phase3Ready: this.results.taskCompletion >= 85 && this.results.overall.score >= 80,
            blockers: []
        };
        
        if (!readiness.phase2Ready) {
            readiness.blockers.push('组件体系建设不完整');
        }
        
        if (!readiness.phase3Ready) {
            readiness.blockers.push('质量标准未达到Phase-3要求');
        }
        
        return readiness;
    }

    /**
     * 打印综合摘要
     */
    printSummary() {
        console.log('📊 TASK-P2-002 综合验证摘要');
        console.log('================================');
        console.log(`🎯 任务完成度: ${this.results.taskCompletion}%`);
        console.log(`📈 综合得分: ${this.results.overall.score}%`);
        console.log(`✅ 通过测试: ${this.results.overall.passed}`);
        console.log(`❌ 失败测试: ${this.results.overall.failed}`);
        
        console.log('\n📋 子验证结果:');
        for (const [type, result] of Object.entries(this.results.subValidators)) {
            const emoji = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
            console.log(`  ${emoji} ${type}: ${result.score}%`);
        }
        
        const readiness = this.assessPhaseReadiness();
        console.log(`\n🚀 Phase-3就绪: ${readiness.phase3Ready ? '✅ 是' : '❌ 否'}`);
        
        if (readiness.blockers.length > 0) {
            console.log('🚫 阻塞项:');
            readiness.blockers.forEach(blocker => console.log(`  - ${blocker}`));
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const validator = new TaskP2002ComprehensiveValidator();
    validator.validate()
        .then(results => {
            const success = results.overall.score >= 80 && results.taskCompletion >= 75;
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('综合验证失败:', error);
            process.exit(1);
        });
}

module.exports = TaskP2002ComprehensiveValidator; 