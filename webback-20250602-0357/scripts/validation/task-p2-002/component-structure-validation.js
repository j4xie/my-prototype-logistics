#!/usr/bin/env node

/**
 * @task TASK-P2-002
 * @type 组件结构验证
 * @description UI组件梳理与组织 - 组件结构验证脚本
 * @created 2025-05-27
 * @lastUpdated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

class ComponentStructureValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            score: 0,
            details: {
                componentStructure: {},
                namingConventions: {},
                exportSystem: {},
                documentation: {}
            }
        };
    }

    /**
     * 执行组件结构验证
     */
    async validate() {
        console.log('🏗️  开始组件结构验证...\n');

        try {
            // 1. 验证组件目录结构
            await this.validateComponentStructure();
            
            // 2. 验证命名规范
            await this.validateNamingConventions();
            
            // 3. 验证导出体系
            await this.validateExportSystem();
            
            // 4. 验证文档完整性
            await this.validateDocumentation();
            
            // 5. 计算总分
            this.calculateScore();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ 组件结构验证失败:', error.message);
            throw error;
        }
    }

    /**
     * 验证组件目录结构
     */
    async validateComponentStructure() {
        console.log('📁 验证组件目录结构...');
        
        const uiPath = path.join(__dirname, '../../../web-app/src/components/ui');
        const expectedStructure = {
            'Button.js': '按钮组件',
            'Card.js': '卡片组件', 
            'Input.js': '输入框组件',
            'Modal.js': '模态框组件',
            'Loading.js': '加载组件',
            'Table.js': '表格组件',
            'Badge.js': '徽章组件',
            'Textarea.js': '文本域组件'
        };

        let structureScore = 0;
        const structureResults = {};

        for (const [component, description] of Object.entries(expectedStructure)) {
            const componentPath = path.join(uiPath, component);
            const exists = fs.existsSync(componentPath);
            
            structureResults[component] = {
                exists,
                description,
                path: componentPath
            };

            if (exists) {
                structureScore += 10;
                this.results.passed++;
                console.log(`   ✅ ${component} - ${description}`);
            } else {
                this.results.failed++;
                console.log(`   ❌ ${component} - ${description} (缺失)`);
            }
        }

        // 检查目录组织
        const indexExists = fs.existsSync(path.join(uiPath, 'index.js'));
        if (indexExists) {
            structureScore += 10;
            this.results.passed++;
            console.log(`   ✅ index.js - 组件导出索引`);
        } else {
            this.results.failed++;
            console.log(`   ❌ index.js - 组件导出索引 (缺失)`);
        }

        this.results.details.componentStructure = {
            score: Math.min(100, structureScore),
            components: structureResults,
            hasIndex: indexExists
        };

        console.log(`📊 组件结构得分: ${Math.min(100, structureScore)}%\n`);
    }

    /**
     * 验证命名规范
     */
    async validateNamingConventions() {
        console.log('📝 验证命名规范...');
        
        const uiPath = path.join(__dirname, '../../../web-app/src/components/ui');
        let namingScore = 0;
        const namingResults = {};

        try {
            const files = fs.readdirSync(uiPath).filter(file => file.endsWith('.js'));
            
            for (const file of files) {
                const componentName = path.basename(file, '.js');
                const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(componentName);
                
                namingResults[file] = {
                    componentName,
                    isPascalCase,
                    valid: isPascalCase
                };

                if (isPascalCase) {
                    namingScore += 10;
                    this.results.passed++;
                    console.log(`   ✅ ${file} - 符合PascalCase命名规范`);
                } else {
                    this.results.failed++;
                    console.log(`   ❌ ${file} - 不符合PascalCase命名规范`);
                }
            }

            this.results.details.namingConventions = {
                score: Math.min(100, namingScore),
                files: namingResults,
                totalFiles: files.length
            };

            console.log(`📊 命名规范得分: ${Math.min(100, namingScore)}%\n`);
            
        } catch (error) {
            console.log(`   ❌ 无法读取UI组件目录: ${error.message}\n`);
            this.results.details.namingConventions = { score: 0, error: error.message };
        }
    }

    /**
     * 验证导出体系
     */
    async validateExportSystem() {
        console.log('📤 验证导出体系...');
        
        const indexPath = path.join(__dirname, '../../../web-app/src/components/ui/index.js');
        let exportScore = 0;
        const exportResults = {};

        try {
            if (fs.existsSync(indexPath)) {
                const indexContent = fs.readFileSync(indexPath, 'utf8');
                
                // 检查是否有统一导出
                const hasExports = indexContent.includes('export') || indexContent.includes('module.exports');
                if (hasExports) {
                    exportScore += 30;
                    this.results.passed++;
                    console.log(`   ✅ index.js 包含组件导出`);
                } else {
                    this.results.failed++;
                    console.log(`   ❌ index.js 缺少组件导出`);
                }

                // 检查导出格式
                const hasNamedExports = indexContent.includes('export {') || indexContent.includes('export const');
                if (hasNamedExports) {
                    exportScore += 20;
                    this.results.passed++;
                    console.log(`   ✅ 使用命名导出格式`);
                } else {
                    this.results.failed++;
                    console.log(`   ❌ 缺少命名导出格式`);
                }

                exportResults.indexFile = {
                    exists: true,
                    hasExports,
                    hasNamedExports,
                    content: indexContent.substring(0, 200) + '...'
                };
            } else {
                this.results.failed++;
                console.log(`   ❌ index.js 文件不存在`);
                exportResults.indexFile = { exists: false };
            }

            this.results.details.exportSystem = {
                score: exportScore,
                ...exportResults
            };

            console.log(`📊 导出体系得分: ${exportScore}%\n`);
            
        } catch (error) {
            console.log(`   ❌ 导出体系验证失败: ${error.message}\n`);
            this.results.details.exportSystem = { score: 0, error: error.message };
        }
    }

    /**
     * 验证文档完整性
     */
    async validateDocumentation() {
        console.log('📚 验证文档完整性...');
        
        const readmePath = path.join(__dirname, '../../../web-app/src/components/ui/README.md');
        let docScore = 0;
        const docResults = {};

        try {
            if (fs.existsSync(readmePath)) {
                const readmeContent = fs.readFileSync(readmePath, 'utf8');
                
                // 检查文档长度
                if (readmeContent.length > 500) {
                    docScore += 20;
                    this.results.passed++;
                    console.log(`   ✅ README.md 内容充实 (${readmeContent.length} 字符)`);
                } else {
                    this.results.failed++;
                    console.log(`   ❌ README.md 内容过少 (${readmeContent.length} 字符)`);
                }

                // 检查关键章节
                const requiredSections = ['组件清单', '使用指南', '设计系统'];
                for (const section of requiredSections) {
                    if (readmeContent.includes(section)) {
                        docScore += 10;
                        this.results.passed++;
                        console.log(`   ✅ 包含 "${section}" 章节`);
                    } else {
                        this.results.failed++;
                        console.log(`   ❌ 缺少 "${section}" 章节`);
                    }
                }

                docResults.readme = {
                    exists: true,
                    length: readmeContent.length,
                    hasSections: requiredSections.filter(section => readmeContent.includes(section))
                };
            } else {
                this.results.failed++;
                console.log(`   ❌ README.md 文件不存在`);
                docResults.readme = { exists: false };
            }

            this.results.details.documentation = {
                score: docScore,
                ...docResults
            };

            console.log(`📊 文档完整性得分: ${docScore}%\n`);
            
        } catch (error) {
            console.log(`   ❌ 文档验证失败: ${error.message}\n`);
            this.results.details.documentation = { score: 0, error: error.message };
        }
    }

    /**
     * 计算总分
     */
    calculateScore() {
        const weights = {
            componentStructure: 0.4,  // 组件结构 40%
            namingConventions: 0.2,   // 命名规范 20%
            exportSystem: 0.25,       // 导出体系 25%
            documentation: 0.15       // 文档完整性 15%
        };

        let weightedScore = 0;
        for (const [category, details] of Object.entries(this.results.details)) {
            if (weights[category] && details.score !== undefined) {
                weightedScore += details.score * weights[category];
            }
        }

        this.results.score = Math.round(weightedScore);
        
        console.log('📊 组件结构验证总结:');
        console.log(`   • 组件结构: ${this.results.details.componentStructure.score || 0}% (权重40%)`);
        console.log(`   • 命名规范: ${this.results.details.namingConventions.score || 0}% (权重20%)`);
        console.log(`   • 导出体系: ${this.results.details.exportSystem.score || 0}% (权重25%)`);
        console.log(`   • 文档完整性: ${this.results.details.documentation.score || 0}% (权重15%)`);
        console.log(`   🎯 综合得分: ${this.results.score}%`);
        console.log(`   📈 通过测试: ${this.results.passed}/${this.results.passed + this.results.failed}`);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const validator = new ComponentStructureValidator();
    validator.validate()
        .then(results => {
            console.log('\n🎯 组件结构验证完成');
            console.log(`📊 最终得分: ${results.score}%`);
            process.exit(results.score >= 70 ? 0 : 1);
        })
        .catch(error => {
            console.error('组件结构验证失败:', error);
            process.exit(1);
        });
}

module.exports = ComponentStructureValidator; 