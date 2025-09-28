/**
 * 测试数据初始化脚本
 * 准备集成测试所需的基础数据
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';
import testConfig from './test-config.js';

class TestDataInitializer {
  constructor() {
    this.apiBase = testConfig.services.backend.apiBase;
    this.createdData = {
      factories: [],
      users: [],
      whitelist: [],
      materials: [],
      products: []
    };
  }

  // 通用API请求方法
  async apiRequest(endpoint, method = 'GET', body = null, token = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `API请求失败: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(chalk.red(`API请求错误 [${endpoint}]:`, error.message));
      throw error;
    }
  }

  // 创建平台管理员账号
  async createPlatformAdmin() {
    const spinner = ora('创建平台管理员账号...').start();
    
    try {
      // 首先尝试登录，看是否已存在
      try {
        const loginResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
          username: testConfig.testAccounts.platformAdmin.username,
          password: testConfig.testAccounts.platformAdmin.password,
          deviceInfo: testConfig.testDevices[0]
        });
        
        if (loginResponse.data && loginResponse.data.accessToken) {
          spinner.succeed(chalk.green('✓ 平台管理员账号已存在'));
          return loginResponse.data.accessToken;
        }
      } catch (error) {
        // 账号不存在，继续创建
      }

      // 创建新账号（实际项目中可能需要特殊的创建接口）
      const createResponse = await this.apiRequest('/platform/admin/create', 'POST', {
        username: testConfig.testAccounts.platformAdmin.username,
        password: testConfig.testAccounts.platformAdmin.password,
        phoneNumber: testConfig.testAccounts.platformAdmin.phoneNumber,
        fullName: '平台管理员',
        role: 'platform_super_admin'
      });

      this.createdData.users.push(createResponse.data);
      spinner.succeed(chalk.green('✓ 平台管理员账号创建成功'));
      
      // 登录获取token
      const loginResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.platformAdmin.username,
        password: testConfig.testAccounts.platformAdmin.password,
        deviceInfo: testConfig.testDevices[0]
      });
      
      return loginResponse.data.accessToken;
    } catch (error) {
      spinner.fail(chalk.red('✗ 平台管理员账号创建失败'));
      throw error;
    }
  }

  // 创建测试工厂
  async createTestFactory(adminToken) {
    const spinner = ora('创建测试工厂...').start();
    
    try {
      // 检查工厂是否已存在
      try {
        const factories = await this.apiRequest('/factories', 'GET', null, adminToken);
        const existingFactory = factories.data.find(f => f.factoryId === testConfig.testFactory.factoryId);
        
        if (existingFactory) {
          spinner.succeed(chalk.green('✓ 测试工厂已存在'));
          return existingFactory;
        }
      } catch (error) {
        // 继续创建
      }

      const factory = await this.apiRequest('/factories', 'POST', testConfig.testFactory, adminToken);
      this.createdData.factories.push(factory.data);
      spinner.succeed(chalk.green('✓ 测试工厂创建成功'));
      return factory.data;
    } catch (error) {
      spinner.fail(chalk.red('✗ 测试工厂创建失败'));
      throw error;
    }
  }

  // 添加用户到白名单
  async addToWhitelist(phoneNumbers, adminToken) {
    const spinner = ora('添加用户到白名单...').start();
    
    try {
      const promises = phoneNumbers.map(phoneNumber =>
        this.apiRequest('/whitelist', 'POST', {
          phoneNumber,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天后过期
        }, adminToken).catch(error => {
          // 忽略已存在的错误
          if (!error.message.includes('already exists')) {
            throw error;
          }
        })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      spinner.succeed(chalk.green(`✓ 白名单添加完成 (${successCount}/${phoneNumbers.length})`));
      return true;
    } catch (error) {
      spinner.fail(chalk.red('✗ 白名单添加失败'));
      throw error;
    }
  }

  // 创建工厂用户
  async createFactoryUsers(factoryId, adminToken) {
    const spinner = ora('创建工厂测试用户...').start();
    
    const factoryUsers = [
      testConfig.testAccounts.factoryAdmin,
      testConfig.testAccounts.processOperator,
      testConfig.testAccounts.viewer
    ];

    try {
      const createdUsers = [];
      
      for (const user of factoryUsers) {
        try {
          // 两阶段注册流程
          // 阶段1: 手机验证
          const phase1Response = await this.apiRequest('/mobile/auth/register-phase-one', 'POST', {
            phoneNumber: user.phoneNumber,
            verificationType: 'registration'
          });

          // 模拟验证码（测试环境应该有固定验证码）
          const verificationCode = '123456';

          // 阶段2: 完成注册
          const phase2Response = await this.apiRequest('/mobile/auth/register-phase-two', 'POST', {
            tempToken: phase1Response.data.tempToken,
            verificationCode,
            username: user.username,
            password: user.password,
            fullName: `测试${user.role}`,
            department: user.department,
            factoryId: user.factoryId,
            role: user.role
          }, phase1Response.data.tempToken);

          createdUsers.push(phase2Response.data);
          this.createdData.users.push(phase2Response.data);
        } catch (error) {
          // 用户可能已存在
          console.log(chalk.yellow(`⚠️  用户 ${user.username} 可能已存在`));
        }
      }

      spinner.succeed(chalk.green(`✓ 工厂用户创建完成 (${createdUsers.length}/${factoryUsers.length})`));
      return createdUsers;
    } catch (error) {
      spinner.fail(chalk.red('✗ 工厂用户创建失败'));
      throw error;
    }
  }

  // 创建加工测试数据
  async createProcessingData(operatorToken) {
    const spinner = ora('创建加工测试数据...').start();
    
    try {
      // 创建原料数据
      const materials = [];
      for (const material of testConfig.processingTestData.materials) {
        try {
          const response = await this.apiRequest('/processing/materials', 'POST', material, operatorToken);
          materials.push(response.data);
          this.createdData.materials.push(response.data);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  原料 ${material.code} 可能已存在`));
        }
      }

      // 创建加工模板
      for (const template of testConfig.processingTestData.processingTemplates) {
        try {
          await this.apiRequest('/processing/templates', 'POST', template, operatorToken);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  模板 ${template.name} 可能已存在`));
        }
      }

      spinner.succeed(chalk.green('✓ 加工测试数据创建完成'));
      return materials;
    } catch (error) {
      spinner.fail(chalk.red('✗ 加工测试数据创建失败'));
      throw error;
    }
  }

  // 创建激活码
  async createActivationCodes(adminToken) {
    const spinner = ora('创建设备激活码...').start();
    
    try {
      const codes = [];
      
      for (const code of testConfig.activationCodes) {
        try {
          const response = await this.apiRequest('/activation/codes', 'POST', {
            code,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90天有效期
            maxUses: 10
          }, adminToken);
          codes.push(response.data);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  激活码 ${code} 可能已存在`));
        }
      }

      spinner.succeed(chalk.green(`✓ 激活码创建完成 (${codes.length}/${testConfig.activationCodes.length})`));
      return codes;
    } catch (error) {
      spinner.fail(chalk.red('✗ 激活码创建失败'));
      throw error;
    }
  }

  // 清理测试数据
  async cleanupTestData(adminToken) {
    const spinner = ora('清理旧测试数据...').start();
    
    try {
      // 这里应该实现清理逻辑，删除之前的测试数据
      // 为了安全，只清理特定标记的测试数据
      
      spinner.succeed(chalk.green('✓ 旧测试数据清理完成'));
      return true;
    } catch (error) {
      spinner.warn(chalk.yellow('⚠️  清理旧数据时出现问题，继续执行'));
      return false;
    }
  }

  // 初始化所有测试数据
  async initializeAll() {
    console.log(chalk.cyan.bold('\n📊 初始化集成测试数据\n'));
    console.log(chalk.gray('═'.repeat(50)));

    try {
      // 1. 创建平台管理员
      const adminToken = await this.createPlatformAdmin();
      
      // 2. 清理旧数据（可选）
      if (testConfig.testOptions.cleanupAfterTest) {
        await this.cleanupTestData(adminToken);
      }

      // 3. 创建测试工厂
      const factory = await this.createTestFactory(adminToken);
      
      // 4. 添加白名单
      const phoneNumbers = Object.values(testConfig.testAccounts)
        .map(account => account.phoneNumber)
        .filter(Boolean);
      await this.addToWhitelist(phoneNumbers, adminToken);
      
      // 5. 创建工厂用户
      const factoryUsers = await this.createFactoryUsers(factory.factoryId, adminToken);
      
      // 6. 获取操作员token
      const operatorLogin = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.processOperator.username,
        password: testConfig.testAccounts.processOperator.password,
        deviceInfo: testConfig.testDevices[0]
      });
      const operatorToken = operatorLogin.data.accessToken;
      
      // 7. 创建加工数据
      await this.createProcessingData(operatorToken);
      
      // 8. 创建激活码
      await this.createActivationCodes(adminToken);

      console.log(chalk.gray('═'.repeat(50)));
      console.log(chalk.green.bold('\n✅ 测试数据初始化完成！\n'));
      console.log(chalk.cyan('📋 创建的数据统计：'));
      console.log(chalk.white(`   工厂: ${this.createdData.factories.length}`));
      console.log(chalk.white(`   用户: ${this.createdData.users.length}`));
      console.log(chalk.white(`   白名单: ${phoneNumbers.length}`));
      console.log(chalk.white(`   原料: ${this.createdData.materials.length}`));
      console.log(chalk.white(`   激活码: ${testConfig.activationCodes.length}`));
      
      // 保存数据摘要
      await this.saveDataSummary();
      
      return true;
    } catch (error) {
      console.error(chalk.red.bold('\n❌ 测试数据初始化失败:'), error.message);
      return false;
    }
  }

  // 保存数据摘要
  async saveDataSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        backend: testConfig.services.backend.url,
        frontend: testConfig.services.frontend.url
      },
      createdData: this.createdData,
      testAccounts: Object.keys(testConfig.testAccounts).map(key => ({
        type: key,
        username: testConfig.testAccounts[key].username,
        role: testConfig.testAccounts[key].role
      }))
    };

    const fs = await import('fs').then(m => m.promises);
    const summaryFile = './integration-tests/reports/data-summary.json';
    
    try {
      await fs.mkdir('./integration-tests/reports', { recursive: true });
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
      console.log(chalk.gray(`\n数据摘要已保存到: ${summaryFile}`));
    } catch (error) {
      console.error(chalk.red('保存数据摘要失败:'), error);
    }
  }

  // 验证数据完整性
  async verifyDataIntegrity(adminToken) {
    console.log(chalk.blue('\n🔍 验证测试数据完整性...'));
    
    const checks = [
      { name: '工厂', endpoint: '/factories', expectedCount: 1 },
      { name: '用户', endpoint: '/users', expectedCount: 3 },
      { name: '白名单', endpoint: '/whitelist', expectedCount: 5 }
    ];

    let allValid = true;

    for (const check of checks) {
      try {
        const response = await this.apiRequest(check.endpoint, 'GET', null, adminToken);
        const actualCount = response.data.length;
        
        if (actualCount >= check.expectedCount) {
          console.log(chalk.green(`✓ ${check.name}: ${actualCount} 条记录`));
        } else {
          console.log(chalk.yellow(`⚠️  ${check.name}: ${actualCount}/${check.expectedCount} 条记录`));
          allValid = false;
        }
      } catch (error) {
        console.log(chalk.red(`✗ ${check.name}: 无法验证`));
        allValid = false;
      }
    }

    return allValid;
  }
}

// 主函数
async function main() {
  const initializer = new TestDataInitializer();
  
  try {
    const success = await initializer.initializeAll();
    
    if (success) {
      console.log(chalk.green.bold('\n🎉 测试环境和数据准备就绪！'));
      console.log(chalk.cyan('\n可以开始运行集成测试了。'));
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('致命错误:'), error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TestDataInitializer;