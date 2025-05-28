#!/usr/bin/env node

/**
 * @task TASK-P2-002
 * @type 单元测试验证
 * @description UI组件梳理与组织 - 单元测试验证脚本
 * @created 2025-05-27
 * @lastUpdated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

class UnitTestValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            score: 0,
            details: {
                testExistence: {},
                testCoverage: {},
                testQuality: {},
                testNaming: {}
            }
        };
    }

    /**
     * 执行单元测试验证
     */
    async validate() {
        console.log('🧪 开始单元测试验证...\n');

        try {
            // 1. 验证测试文件存在性
            await this.validateTestExistence();
            
            // 2. 验证测试覆盖率
            await this.validateTestCoverage();
            
            // 3. 验证测试质量
            await this.validateTestQuality();
            
            // 4. 验证测试命名规范
            await this.validateTestNaming();
            
            // 5. 计算总分
            this.calculateScore();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ 单元测试验证失败:', error.message);
            throw error;
        }
    }

    /**
     * 验证测试文件存在性
     */
    async validateTestExistence() {
        console.log('📁 验证测试文件存在性...');
        
        const testPaths = [
            '../../../web-app/tests/unit',
            '../../../web-app/src/components/ui/__tests__',
            '../../../web-app/__tests__/components/ui'
        ];

        let existenceScore = 0;
        const existenceResults = {};

        for (const testPath of testPaths) {
            const fullPath = path.join(__dirname, testPath);
            const exists = fs.existsSync(fullPath);
            
            existenceResults[testPath] = {
                exists,
                fullPath
            };

            if (exists) {
                existenceScore += 20;
                this.results.passed++;
                console.log(`   ✅ 测试目录存在: ${testPath}`);
                
                // 检查测试文件
                try {
                    const files = fs.readdirSync(fullPath);
                    const testFiles = files.filter(file => 
                        file.endsWith('.test.js') || 
                        file.endsWith('.spec.js') ||
                        file.includes('test')
                    );
                    
                    existenceResults[testPath].testFiles = testFiles;
                    if (testFiles.length > 0) {
                        existenceScore += 10;
                        console.log(`   ✅ 发现 ${testFiles.length} 个测试文件`);
                    }
                } catch (error) {
                    console.log(`   ⚠️  无法读取测试目录: ${error.message}`);
                }
            } else {
                this.results.failed++;
                console.log(`   ❌ 测试目录不存在: ${testPath}`);
            }
        }

        this.results.details.testExistence = {
            score: Math.min(100, existenceScore),
            paths: existenceResults
        };

        console.log(`📊 测试存在性得分: ${Math.min(100, existenceScore)}%\n`);
    }

    /**
     * 验证测试覆盖率
     */
    async validateTestCoverage() {
        console.log('📈 验证测试覆盖率...');
        
        const uiComponentsPath = path.join(__dirname, '../../../web-app/src/components/ui');
        let coverageScore = 0;
        const coverageResults = {};

        try {
            if (fs.existsSync(uiComponentsPath)) {
                const componentFiles = fs.readdirSync(uiComponentsPath)
                    .filter(file => file.endsWith('.js') && file !== 'index.js');
                
                coverageResults.totalComponents = componentFiles.length;
                coverageResults.testedComponents = 0;
                coverageResults.components = {};

                for (const componentFile of componentFiles) {
                    const componentName = path.basename(componentFile, '.js');
                    const hasTest = this.findTestForComponent(componentName);
                    
                    coverageResults.components[componentFile] = {
                        hasTest,
                        testPath: hasTest ? this.getTestPath(componentName) : null
                    };

                    if (hasTest) {
                        coverageResults.testedComponents++;
                        this.results.passed++;
                        console.log(`   ✅ ${componentFile} - 有对应测试`);
                    } else {
                        this.results.failed++;
                        console.log(`   ❌ ${componentFile} - 缺少测试`);
                    }
                }

                // 计算覆盖率
                const coveragePercentage = componentFiles.length > 0 
                    ? (coverageResults.testedComponents / componentFiles.length) * 100 
                    : 0;
                
                coverageScore = Math.round(coveragePercentage);
                coverageResults.coveragePercentage = coveragePercentage;

                console.log(`📊 测试覆盖率: ${coverageResults.testedComponents}/${componentFiles.length} (${coveragePercentage.toFixed(1)}%)`);
            } else {
                console.log(`   ❌ UI组件目录不存在`);
                coverageResults.error = 'UI组件目录不存在';
            }

            this.results.details.testCoverage = {
                score: coverageScore,
                ...coverageResults
            };

            console.log(`📊 测试覆盖率得分: ${coverageScore}%\n`);
            
        } catch (error) {
            console.log(`   ❌ 测试覆盖率验证失败: ${error.message}\n`);
            this.results.details.testCoverage = { score: 0, error: error.message };
        }
    }

    /**
     * 验证测试质量
     */
    async validateTestQuality() {
        console.log('🎯 验证测试质量...');
        
        let qualityScore = 0;
        const qualityResults = {};

        // 检查Jest配置
        const jestConfigPaths = [
            '../../../web-app/jest.config.js',
            '../../../web-app/package.json'
        ];

        let hasJestConfig = false;
        for (const configPath of jestConfigPaths) {
            const fullPath = path.join(__dirname, configPath);
            if (fs.existsSync(fullPath)) {
                if (configPath.includes('package.json')) {
                    const packageContent = fs.readFileSync(fullPath, 'utf8');
                    if (packageContent.includes('jest')) {
                        hasJestConfig = true;
                        break;
                    }
                } else {
                    hasJestConfig = true;
                    break;
                }
            }
        }

        if (hasJestConfig) {
            qualityScore += 30;
            this.results.passed++;
            console.log(`   ✅ Jest测试框架配置存在`);
        } else {
            this.results.failed++;
            console.log(`   ❌ 缺少Jest测试框架配置`);
        }

        // 检查测试工具库
        const packageJsonPath = path.join(__dirname, '../../../web-app/package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageContent);
            
            const testLibraries = ['@testing-library/react', '@testing-library/jest-dom', 'enzyme'];
            let hasTestLibrary = false;
            
            for (const lib of testLibraries) {
                if (packageJson.devDependencies?.[lib] || packageJson.dependencies?.[lib]) {
                    hasTestLibrary = true;
                    qualityScore += 20;
                    console.log(`   ✅ 测试库 ${lib} 已安装`);
                    break;
                }
            }
            
            if (!hasTestLibrary) {
                this.results.failed++;
                console.log(`   ❌ 缺少React测试库`);
            } else {
                this.results.passed++;
            }
        }

        qualityResults.hasJestConfig = hasJestConfig;
        qualityResults.score = qualityScore;

        this.results.details.testQuality = qualityResults;
        console.log(`📊 测试质量得分: ${qualityScore}%\n`);
    }

    /**
     * 验证测试命名规范
     */
    async validateTestNaming() {
        console.log('📝 验证测试命名规范...');
        
        let namingScore = 0;
        const namingResults = {};

        const testPaths = [
            '../../../web-app/tests/unit',
            '../../../web-app/src/components/ui/__tests__'
        ];

        let totalTestFiles = 0;
        let validNamedFiles = 0;

        for (const testPath of testPaths) {
            const fullPath = path.join(__dirname, testPath);
            if (fs.existsSync(fullPath)) {
                try {
                    const files = fs.readdirSync(fullPath);
                    const testFiles = files.filter(file => 
                        file.endsWith('.test.js') || 
                        file.endsWith('.spec.js')
                    );

                    for (const file of testFiles) {
                        totalTestFiles++;
                        const isValidNaming = file.endsWith('.test.js') || file.endsWith('.spec.js');
                        
                        if (isValidNaming) {
                            validNamedFiles++;
                            console.log(`   ✅ ${file} - 符合命名规范`);
                        } else {
                            console.log(`   ❌ ${file} - 不符合命名规范`);
                        }
                    }
                } catch (error) {
                    console.log(`   ⚠️  无法读取测试目录: ${testPath}`);
                }
            }
        }

        if (totalTestFiles > 0) {
            namingScore = Math.round((validNamedFiles / totalTestFiles) * 100);
            this.results.passed += validNamedFiles;
            this.results.failed += (totalTestFiles - validNamedFiles);
        } else {
            console.log(`   ⚠️  未发现测试文件`);
        }

        namingResults.totalTestFiles = totalTestFiles;
        namingResults.validNamedFiles = validNamedFiles;
        namingResults.score = namingScore;

        this.results.details.testNaming = namingResults;
        console.log(`📊 测试命名规范得分: ${namingScore}%\n`);
    }

    /**
     * 查找组件对应的测试文件
     */
    findTestForComponent(componentName) {
        const possibleTestPaths = [
            `../../../web-app/tests/unit/${componentName}.test.js`,
            `../../../web-app/tests/unit/${componentName}.spec.js`,
            `../../../web-app/src/components/ui/__tests__/${componentName}.test.js`,
            `../../../web-app/src/components/ui/__tests__/${componentName}.spec.js`,
            `../../../web-app/__tests__/components/ui/${componentName}.test.js`
        ];

        for (const testPath of possibleTestPaths) {
            const fullPath = path.join(__dirname, testPath);
            if (fs.existsSync(fullPath)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取测试文件路径
     */
    getTestPath(componentName) {
        const possibleTestPaths = [
            `tests/unit/${componentName}.test.js`,
            `tests/unit/${componentName}.spec.js`,
            `src/components/ui/__tests__/${componentName}.test.js`,
            `src/components/ui/__tests__/${componentName}.spec.js`
        ];

        for (const testPath of possibleTestPaths) {
            const fullPath = path.join(__dirname, '../../../web-app', testPath);
            if (fs.existsSync(fullPath)) {
                return testPath;
            }
        }
        return null;
    }

    /**
     * 计算总分
     */
    calculateScore() {
        const weights = {
            testExistence: 0.3,    // 测试存在性 30%
            testCoverage: 0.4,     // 测试覆盖率 40%
            testQuality: 0.2,      // 测试质量 20%
            testNaming: 0.1        // 测试命名 10%
        };

        let weightedScore = 0;
        for (const [category, details] of Object.entries(this.results.details)) {
            if (weights[category] && details.score !== undefined) {
                weightedScore += details.score * weights[category];
            }
        }

        this.results.score = Math.round(weightedScore);
        
        console.log('📊 单元测试验证总结:');
        console.log(`   • 测试存在性: ${this.results.details.testExistence.score || 0}% (权重30%)`);
        console.log(`   • 测试覆盖率: ${this.results.details.testCoverage.score || 0}% (权重40%)`);
        console.log(`   • 测试质量: ${this.results.details.testQuality.score || 0}% (权重20%)`);
        console.log(`   • 测试命名: ${this.results.details.testNaming.score || 0}% (权重10%)`);
        console.log(`   🎯 综合得分: ${this.results.score}%`);
        console.log(`   📈 通过测试: ${this.results.passed}/${this.results.passed + this.results.failed}`);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const validator = new UnitTestValidator();
    validator.validate()
        .then(results => {
            console.log('\n🎯 单元测试验证完成');
            console.log(`📊 最终得分: ${results.score}%`);
            process.exit(results.score >= 60 ? 0 : 1);
        })
        .catch(error => {
            console.error('单元测试验证失败:', error);
            process.exit(1);
        });
}

module.exports = UnitTestValidator; 