#!/usr/bin/env node

/**
 * @task TASK-005: 代码模块化改造
 * @type 模块结构验证
 * @description 验证业务模块的现代化改造质量和模块化组织结构
 * @created 2025-05-27
 * @lastUpdated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

// 验证配置
const VALIDATION_CONFIG = {
    baseDir: path.join(__dirname, '../../../web-app'),
    modulesDir: 'src/components/modules',
    requiredModules: [
        'trace', 'farming', 'processing', 'logistics', 'admin', 'profile'
    ],
    modernComponents: {
        'trace': ['TraceRecordView.jsx', 'TraceRecordForm.jsx'],
        'farming': ['FarmingRecordView.jsx'],
        'processing': ['ProcessingRecordView.jsx'],
        'logistics': ['LogisticsRecordView.jsx'],
        'admin': ['AdminDashboard.jsx'],
        'profile': ['UserProfile.jsx']
    }
};

class ModuleStructureValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: [],
            score: 0
        };
    }

    /**
     * 主验证入口
     */
    async validate() {
        console.log('🔍 开始 TASK-005 模块结构验证...\n');

        try {
            // 1. 验证业务模块目录结构
            await this.validateModuleDirectories();
            
            // 2. 验证现代化组件存在性
            await this.validateModernComponents();
            
            // 3. 验证模块导出体系
            await this.validateModuleExports();
            
            // 4. 验证组件现代化质量
            await this.validateModernizationQuality();
            
            // 5. 验证模块依赖管理
            await this.validateDependencyManagement();

            // 计算总分
            this.calculateScore();
            
            // 生成报告
            await this.generateReport();
            
            console.log(`\n✅ TASK-005 模块结构验证完成！`);
            console.log(`📊 总分: ${this.results.score}% (${this.results.passed}通过/${this.results.passed + this.results.failed}总计)`);
            
            return this.results;
            
        } catch (error) {
            console.error('❌ 验证过程中发生错误:', error.message);
            throw error;
        }
    }

    /**
     * 验证业务模块目录结构
     */
    async validateModuleDirectories() {
        const testName = '业务模块目录结构验证';
        console.log(`🔍 ${testName}...`);

        try {
            const modulesDir = path.join(VALIDATION_CONFIG.baseDir, VALIDATION_CONFIG.modulesDir);
            
            // 检查模块目录是否存在
            if (!fs.existsSync(modulesDir)) {
                this.addTest(testName, false, '业务模块目录不存在');
                return;
            }

            // 检查必需的业务模块
            const missingModules = [];
            for (const module of VALIDATION_CONFIG.requiredModules) {
                const modulePath = path.join(modulesDir, module);
                if (!fs.existsSync(modulePath)) {
                    missingModules.push(module);
                }
            }

            if (missingModules.length > 0) {
                this.addTest(testName, false, `缺少模块: ${missingModules.join(', ')}`);
            } else {
                this.addTest(testName, true, '所有必需业务模块都存在');
            }

        } catch (error) {
            this.addTest(testName, false, `验证失败: ${error.message}`);
        }
    }

    /**
     * 验证现代化组件存在性
     */
    async validateModernComponents() {
        const testName = '现代化组件存在性验证';
        console.log(`🔍 ${testName}...`);

        try {
            const modulesDir = path.join(VALIDATION_CONFIG.baseDir, VALIDATION_CONFIG.modulesDir);
            let totalComponents = 0;
            let existingComponents = 0;

            for (const [module, components] of Object.entries(VALIDATION_CONFIG.modernComponents)) {
                const moduleDir = path.join(modulesDir, module);
                
                for (const component of components) {
                    totalComponents++;
                    const componentPath = path.join(moduleDir, component);
                    
                    if (fs.existsSync(componentPath)) {
                        existingComponents++;
                    }
                }
            }

            const percentage = totalComponents > 0 ? (existingComponents / totalComponents) * 100 : 0;
            this.addTest(testName, percentage >= 90, `现代化组件完成率: ${percentage.toFixed(1)}% (${existingComponents}/${totalComponents})`);

        } catch (error) {
            this.addTest(testName, false, `验证失败: ${error.message}`);
        }
    }

    /**
     * 验证模块导出体系
     */
    async validateModuleExports() {
        const testName = '模块导出体系验证';
        console.log(`🔍 ${testName}...`);

        try {
            const modulesDir = path.join(VALIDATION_CONFIG.baseDir, VALIDATION_CONFIG.modulesDir);
            let validExports = 0;
            let totalModules = 0;

            for (const module of VALIDATION_CONFIG.requiredModules) {
                totalModules++;
                const moduleDir = path.join(modulesDir, module);
                const indexPath = path.join(moduleDir, 'index.js');

                if (fs.existsSync(indexPath)) {
                    const indexContent = fs.readFileSync(indexPath, 'utf8');
                    
                    // 检查是否有有效的导出
                    const hasExports = indexContent.includes('export') || indexContent.includes('module.exports');
                    const hasImports = indexContent.includes('import') || indexContent.includes('require');
                    
                    if (hasExports && hasImports) {
                        validExports++;
                    }
                }
            }

            const percentage = totalModules > 0 ? (validExports / totalModules) * 100 : 0;
            this.addTest(testName, percentage >= 80, `模块导出完整率: ${percentage.toFixed(1)}% (${validExports}/${totalModules})`);

        } catch (error) {
            this.addTest(testName, false, `验证失败: ${error.message}`);
        }
    }

    /**
     * 验证组件现代化质量
     */
    async validateModernizationQuality() {
        const testName = '组件现代化质量验证';
        console.log(`🔍 ${testName}...`);

        try {
            const qualityChecks = {
                reactComponents: 0,
                proptypesUsage: 0,
                modernSyntax: 0,
                designSystem: 0
            };

            let totalChecks = 0;

            for (const [module, components] of Object.entries(VALIDATION_CONFIG.modernComponents)) {
                const moduleDir = path.join(VALIDATION_CONFIG.baseDir, VALIDATION_CONFIG.modulesDir, module);
                
                for (const component of components) {
                    const componentPath = path.join(moduleDir, component);
                    
                    if (fs.existsSync(componentPath)) {
                        totalChecks++;
                        const content = fs.readFileSync(componentPath, 'utf8');
                        
                        // 检查React组件语法
                        if (this.hasReactSyntax(content)) {
                            qualityChecks.reactComponents++;
                        }
                        
                        // 检查PropTypes使用
                        if (this.hasPropTypes(content)) {
                            qualityChecks.proptypesUsage++;
                        }
                        
                        // 检查现代化语法
                        if (this.hasModernSyntax(content)) {
                            qualityChecks.modernSyntax++;
                        }
                        
                        // 检查设计系统规范
                        if (this.followsDesignSystem(content)) {
                            qualityChecks.designSystem++;
                        }
                    }
                }
            }

            if (totalChecks > 0) {
                const avgQuality = (
                    qualityChecks.reactComponents + 
                    qualityChecks.proptypesUsage + 
                    qualityChecks.modernSyntax + 
                    qualityChecks.designSystem
                ) / (totalChecks * 4) * 100;

                this.addTest(testName, avgQuality >= 80, `现代化质量平均分: ${avgQuality.toFixed(1)}%`);
            } else {
                this.addTest(testName, false, '没有找到可验证的现代化组件');
            }

        } catch (error) {
            this.addTest(testName, false, `验证失败: ${error.message}`);
        }
    }

    /**
     * 验证模块依赖管理
     */
    async validateDependencyManagement() {
        const testName = '模块依赖管理验证';
        console.log(`🔍 ${testName}...`);

        try {
            const modulesDir = path.join(VALIDATION_CONFIG.baseDir, VALIDATION_CONFIG.modulesDir);
            let validDependencies = 0;
            let totalModules = 0;

            for (const module of VALIDATION_CONFIG.requiredModules) {
                totalModules++;
                const moduleDir = path.join(modulesDir, module);
                
                if (fs.existsSync(moduleDir)) {
                    const files = this.getAllJSFiles(moduleDir);
                    let hasValidImports = false;
                    
                    for (const file of files) {
                        const content = fs.readFileSync(file, 'utf8');
                        
                        // 检查是否有合理的导入结构
                        if (this.hasValidImportStructure(content)) {
                            hasValidImports = true;
                            break;
                        }
                    }
                    
                    if (hasValidImports) {
                        validDependencies++;
                    }
                }
            }

            const percentage = totalModules > 0 ? (validDependencies / totalModules) * 100 : 0;
            this.addTest(testName, percentage >= 70, `依赖管理规范率: ${percentage.toFixed(1)}% (${validDependencies}/${totalModules})`);

        } catch (error) {
            this.addTest(testName, false, `验证失败: ${error.message}`);
        }
    }

    /**
     * 检查React组件语法
     */
    hasReactSyntax(content) {
        return (
            content.includes('import React') ||
            content.includes('from \'react\'') ||
            content.includes('React.Component') ||
            content.includes('function ') && content.includes('return (') ||
            content.includes('=>') && content.includes('return (')
        );
    }

    /**
     * 检查PropTypes使用
     */
    hasPropTypes(content) {
        return (
            content.includes('PropTypes') ||
            content.includes('propTypes') ||
            content.includes('.isRequired')
        );
    }

    /**
     * 检查现代化语法
     */
    hasModernSyntax(content) {
        return (
            content.includes('const ') ||
            content.includes('let ') ||
            content.includes('=>') ||
            content.includes('...') || // spread operator
            content.includes('useState') ||
            content.includes('useEffect')
        );
    }

    /**
     * 检查是否遵循设计系统
     */
    followsDesignSystem(content) {
        return (
            content.includes('max-w-[390px]') ||
            content.includes('grid-cols-2') ||
            content.includes('bg-white rounded-lg shadow-sm') ||
            content.includes('text-[#1890FF]') ||
            content.includes('className=')
        );
    }

    /**
     * 检查有效的导入结构
     */
    hasValidImportStructure(content) {
        const hasReactImport = content.includes('import React');
        const hasUtilImports = content.includes('../../utils') || content.includes('../../../utils');
        const hasComponentImports = content.includes('../') && (content.includes('components') || content.includes('ui'));
        
        return hasReactImport || hasUtilImports || hasComponentImports;
    }

    /**
     * 获取所有JS/JSX文件
     */
    getAllJSFiles(dir) {
        const files = [];
        
        function traverse(currentDir) {
            if (!fs.existsSync(currentDir)) return;
            
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                const itemPath = path.join(currentDir, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    traverse(itemPath);
                } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
                    files.push(itemPath);
                }
            }
        }
        
        traverse(dir);
        return files;
    }

    /**
     * 添加测试结果
     */
    addTest(name, passed, message) {
        this.results.tests.push({
            name,
            passed,
            message,
            timestamp: new Date().toISOString()
        });
        
        if (passed) {
            this.results.passed++;
            console.log(`  ✅ ${name}: ${message}`);
        } else {
            this.results.failed++;
            console.log(`  ❌ ${name}: ${message}`);
        }
    }

    /**
     * 计算总分
     */
    calculateScore() {
        const total = this.results.passed + this.results.failed;
        this.results.score = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;
    }

    /**
     * 生成验证报告
     */
    async generateReport() {
        const reportDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const report = {
            task: 'TASK-005',
            type: '模块结构验证',
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.results.passed + this.results.failed,
                passedTests: this.results.passed,
                failedTests: this.results.failed,
                score: this.results.score
            },
            results: this.results.tests,
            moduleAnalysis: this.generateModuleAnalysis(),
            recommendations: this.generateRecommendations()
        };

        const reportPath = path.join(reportDir, `module-structure-validation-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 验证报告已生成: ${reportPath}`);
    }

    /**
     * 生成模块分析
     */
    generateModuleAnalysis() {
        const analysis = {};
        
        for (const module of VALIDATION_CONFIG.requiredModules) {
            analysis[module] = {
                exists: false,
                modernComponents: [],
                hasIndex: false,
                qualityScore: 0
            };
            
            const moduleDir = path.join(VALIDATION_CONFIG.baseDir, VALIDATION_CONFIG.modulesDir, module);
            
            if (fs.existsSync(moduleDir)) {
                analysis[module].exists = true;
                
                // 检查现代化组件
                if (VALIDATION_CONFIG.modernComponents[module]) {
                    for (const component of VALIDATION_CONFIG.modernComponents[module]) {
                        const componentPath = path.join(moduleDir, component);
                        if (fs.existsSync(componentPath)) {
                            analysis[module].modernComponents.push(component);
                        }
                    }
                }
                
                // 检查导出文件
                const indexPath = path.join(moduleDir, 'index.js');
                analysis[module].hasIndex = fs.existsSync(indexPath);
            }
        }
        
        return analysis;
    }

    /**
     * 生成改进建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        for (const test of this.results.tests) {
            if (!test.passed) {
                switch (test.name) {
                    case '业务模块目录结构验证':
                        recommendations.push('完善业务模块目录结构，确保所有核心模块都存在');
                        break;
                    case '现代化组件存在性验证':
                        recommendations.push('完成剩余模块的现代化组件创建');
                        break;
                    case '模块导出体系验证':
                        recommendations.push('完善模块导出体系，为每个模块创建规范的index.js文件');
                        break;
                    case '组件现代化质量验证':
                        recommendations.push('提升组件现代化质量，确保使用React现代化语法和设计系统');
                        break;
                    case '模块依赖管理验证':
                        recommendations.push('优化模块依赖管理，建立清晰的导入导出关系');
                        break;
                }
            }
        }
        
        if (recommendations.length === 0) {
            recommendations.push('模块结构验证全部通过，保持当前良好的模块化架构');
        }
        
        return recommendations;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const validator = new ModuleStructureValidator();
    validator.validate()
        .then(results => {
            process.exit(results.score >= 80 ? 0 : 1);
        })
        .catch(error => {
            console.error('验证失败:', error);
            process.exit(1);
        });
}

module.exports = ModuleStructureValidator; 