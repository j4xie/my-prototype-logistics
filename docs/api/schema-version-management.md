# Schema版本管理策略

<!-- TASK-P3-017B Day 2交付物 -->
<!-- 遵循规范: development-management-unified.mdc, refactor-management-unified.mdc -->
<!-- 创建日期: 2025-02-02 -->

## 📋 **策略概览**

### **版本管理目标**
建立OpenAPI Schema的统一版本管理机制，确保Mock API的稳定性和可追溯性：

1. **Schema权威性**: OpenAPI作为单一可信数据源
2. **版本冻结**: 建立基线版本并严格控制变更
3. **向后兼容**: 保证现有客户端不受影响
4. **自动同步**: Schema变更自动更新TypeScript类型
5. **变更追踪**: 完整的版本历史和影响分析

## 🏗️ **版本管理架构**

### **1. Schema存储结构**
```
src/mocks/schemas/
├── 📄 openapi.yaml         # 当前权威Schema
├── 📄 async-api.yaml       # 事件API规范
├── 📁 versions/            # 版本历史存储
│   ├── 📄 1.0.0-baseline.yaml
│   ├── 📄 1.0.1.yaml
│   ├── 📄 1.1.0.yaml
│   └── 📄 versions.json    # 版本元数据
├── 📁 migrations/          # 版本迁移脚本
│   ├── 📄 1.0.0-to-1.0.1.ts
│   └── 📄 1.0.1-to-1.1.0.ts
└── 📁 validation/          # Schema验证规则
    ├── 📄 base-rules.json
    └── 📄 custom-rules.ts
```

### **2. 版本命名规范**
遵循Semantic Versioning 2.0.0规范：

- **MAJOR.MINOR.PATCH** (例: 1.2.3)
- **MAJOR**: 不兼容的API变更
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的Bug修复
- **预发布**: alpha, beta, rc (例: 1.2.0-beta.1)
- **基线版本**: 1.0.0-baseline (Phase-3起始基线)

### **3. 版本生命周期状态**
```typescript
export enum SchemaVersionStatus {
  DRAFT = 'draft',           // 草稿阶段
  REVIEW = 'review',         // 评审阶段
  APPROVED = 'approved',     // 已批准
  ACTIVE = 'active',         // 当前活跃
  DEPRECATED = 'deprecated', // 已弃用
  RETIRED = 'retired'        // 已退役
}
```

## 📊 **版本元数据管理**

### **版本信息数据结构**
```typescript
// src/mocks/schemas/versions/versions.json
export interface SchemaVersionInfo {
  version: string;                    // 版本号
  status: SchemaVersionStatus;        // 版本状态
  createdAt: string;                 // 创建时间
  createdBy: string;                 // 创建人
  description: string;               // 版本描述
  breaking: boolean;                 // 是否破坏性变更
  deprecated: string[];              // 弃用的字段/接口
  added: string[];                   // 新增的字段/接口
  modified: string[];                // 修改的字段/接口
  checksum: string;                  // Schema文件校验和
  dependencies: {                    // 依赖版本
    openapi: string;
    typescript: string;
    msw: string;
  };
  compatibleWith: string[];          // 兼容的版本列表
  migrationPath?: string;            // 迁移脚本路径
}
```

### **版本元数据示例**
```json
{
  "versions": [
    {
      "version": "1.0.0-baseline",
      "status": "active",
      "createdAt": "2025-02-02T10:00:00Z",
      "createdBy": "Phase-3-Team",
      "description": "Phase-3重构基线版本，包含18个核心API接口",
      "breaking": false,
      "deprecated": [],
      "added": [
        "/auth/login",
        "/auth/logout",
        "/users/profile",
        "/products/list",
        "/trace/records"
      ],
      "modified": [],
      "checksum": "sha256:a1b2c3d4e5f6...",
      "dependencies": {
        "openapi": "3.0.3",
        "typescript": "5.0.0",
        "msw": "2.0.0"
      },
      "compatibleWith": ["1.0.0-baseline"],
      "migrationPath": null
    }
  ],
  "current": "1.0.0-baseline",
  "deprecated": [],
  "retired": []
}
```

## 🔄 **版本变更流程**

### **1. 变更提议阶段**
```typescript
// src/mocks/scripts/propose-change.ts
export interface SchemaChangeProposal {
  type: 'MAJOR' | 'MINOR' | 'PATCH';
  description: string;
  motivation: string;
  breakingChanges: BreakingChange[];
  affectedEndpoints: string[];
  estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
  proposedBy: string;
  reviewers: string[];
}

export class SchemaChangeManager {
  async proposeChange(proposal: SchemaChangeProposal): Promise<string> {
    // 1. 生成变更ID
    const changeId = generateChangeId();

    // 2. 创建变更分支
    await createChangeBranch(changeId);

    // 3. 生成影响分析报告
    const impact = await analyzeImpact(proposal);

    // 4. 提交评审
    await submitForReview(changeId, proposal, impact);

    return changeId;
  }
}
```

### **2. 评审和批准流程**
```typescript
// src/mocks/scripts/review-process.ts
export class SchemaReviewProcess {
  async reviewChange(changeId: string): Promise<ReviewResult> {
    // 1. 技术可行性评估
    const feasibility = await assessTechnicalFeasibility(changeId);

    // 2. 向后兼容性检查
    const compatibility = await checkBackwardCompatibility(changeId);

    // 3. 性能影响评估
    const performance = await assessPerformanceImpact(changeId);

    // 4. 安全影响分析
    const security = await analyzeSecurity(changeId);

    return {
      changeId,
      approved: feasibility && compatibility && performance && security,
      comments: generateReviewComments([feasibility, compatibility, performance, security]),
      requiredActions: getRequiredActions([feasibility, compatibility, performance, security])
    };
  }
}
```

### **3. 版本发布流程**
```typescript
// src/mocks/scripts/release-version.ts
export class SchemaVersionRelease {
  async releaseVersion(changeId: string, targetVersion: string): Promise<void> {
    // 1. 预发布验证
    await this.preReleaseValidation(changeId);

    // 2. 生成新版本Schema
    await this.generateNewSchema(changeId, targetVersion);

    // 3. 更新TypeScript类型
    await this.updateTypeScriptTypes(targetVersion);

    // 4. 生成MSW Handlers
    await this.generateMSWHandlers(targetVersion);

    // 5. 运行完整测试套件
    await this.runTestSuite(targetVersion);

    // 6. 更新版本元数据
    await this.updateVersionMetadata(targetVersion);

    // 7. 标记当前版本
    await this.tagCurrentVersion(targetVersion);

    // 8. 生成变更日志
    await this.generateChangelog(targetVersion);
  }
}
```

## 🔒 **版本冻结机制**

### **基线版本锁定**
```typescript
// src/mocks/config/version-lock.ts
export class VersionLock {
  private readonly BASELINE_VERSION = '1.0.0-baseline';
  private readonly LOCK_FILE = 'src/mocks/schemas/.version-lock';

  async lockBaseline(): Promise<void> {
    const baselineSchema = await this.loadSchema(this.BASELINE_VERSION);
    const checksum = await this.calculateChecksum(baselineSchema);

    const lockInfo = {
      version: this.BASELINE_VERSION,
      checksum,
      lockedAt: new Date().toISOString(),
      lockedBy: 'Phase-3-System',
      reason: 'Phase-3重构基线版本锁定'
    };

    await fs.writeFile(this.LOCK_FILE, JSON.stringify(lockInfo, null, 2));
  }

  async validateBaseline(): Promise<boolean> {
    const lockInfo = await this.loadLockInfo();
    const currentSchema = await this.loadSchema(this.BASELINE_VERSION);
    const currentChecksum = await this.calculateChecksum(currentSchema);

    return lockInfo.checksum === currentChecksum;
  }
}
```

### **变更控制策略**
```typescript
// src/mocks/scripts/change-control.ts
export class SchemaChangeControl {
  // 严格的变更审批流程
  async requiresApproval(change: SchemaChange): Promise<boolean> {
    // MAJOR版本变更始终需要批准
    if (change.type === 'MAJOR') return true;

    // 影响核心接口的MINOR变更需要批准
    if (change.type === 'MINOR' && this.affectsCoreAPIs(change)) return true;

    // 破坏性PATCH变更需要批准
    if (change.type === 'PATCH' && change.breaking) return true;

    return false;
  }

  // 自动化变更阻止
  async blockDangerousChanges(change: SchemaChange): Promise<string[]> {
    const blockers: string[] = [];

    // 阻止删除现有字段
    if (this.removesExistingFields(change)) {
      blockers.push('不允许删除现有字段，请使用弃用标记');
    }

    // 阻止修改数据类型
    if (this.changesDataTypes(change)) {
      blockers.push('不允许修改字段数据类型，请创建新字段');
    }

    // 阻止URL路径变更
    if (this.changesURLPaths(change)) {
      blockers.push('不允许修改现有URL路径，请创建新版本端点');
    }

    return blockers;
  }
}
```

## 🚀 **自动同步机制**

### **OpenAPI → TypeScript 自动生成**
```typescript
// src/mocks/scripts/auto-sync.ts
export class AutoSyncManager {
  async syncTypesFromSchema(version: string): Promise<void> {
    // 1. 加载指定版本Schema
    const schema = await this.loadSchemaVersion(version);

    // 2. 生成TypeScript接口
    await generateApi({
      input: schema,
      output: `src/mocks/types/api-${version}.d.ts`,
      format: 'prettier',
      exportSchemas: true,
      useOptions: true
    });

    // 3. 生成版本兼容性映射
    await this.generateCompatibilityMapping(version);

    // 4. 更新主类型文件
    await this.updateMainTypes(version);
  }

  async generateMSWHandlers(version: string): Promise<void> {
    // 1. 从OpenAPI生成MSW Handlers
    const spec = await loadOpenAPISpec(`schemas/versions/${version}.yaml`);
    const handlers = await fromOpenApi(spec);

    // 2. 应用自定义业务逻辑
    const enhancedHandlers = await this.enhanceWithBusinessLogic(handlers);

    // 3. 写入Handler文件
    await this.writeHandlers(`handlers/${version}/`, enhancedHandlers);

    // 4. 更新主Handler导出
    await this.updateMainHandlers(version);
  }
}
```

### **CI/CD自动验证**
```yaml
# .github/workflows/schema-validation.yml
name: Schema Version Management
on:
  push:
    paths: ['src/mocks/schemas/**']
  pull_request:
    paths: ['src/mocks/schemas/**']

jobs:
  validate-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate Schema Format
        run: |
          npm run mock:validate-schema

      - name: Check Version Compliance
        run: |
          npm run mock:check-version

      - name: Generate Types
        run: |
          npm run mock:generate-types

      - name: Test Handler Generation
        run: |
          npm run mock:test-handlers

      - name: Backward Compatibility Check
        run: |
          npm run mock:check-compatibility
```

## 📊 **向后兼容策略**

### **兼容性矩阵**
```typescript
// src/mocks/config/compatibility.ts
export const compatibilityMatrix = {
  '1.0.0-baseline': {
    supportedBy: ['1.0.x', '1.1.x'],
    deprecationDate: null,
    eolDate: null
  },
  '1.0.1': {
    supportedBy: ['1.0.x', '1.1.x'],
    deprecationDate: null,
    eolDate: null
  },
  '1.1.0': {
    supportedBy: ['1.1.x', '1.2.x'],
    deprecationDate: '2025-12-31',
    eolDate: '2026-06-30'
  }
};
```

### **版本迁移脚本**
```typescript
// src/mocks/migrations/1.0.0-to-1.0.1.ts
export class Migration_1_0_0_to_1_0_1 {
  async migrate(oldData: any): Promise<any> {
    // 数据结构迁移逻辑
    return {
      ...oldData,
      // 应用特定的迁移变更
      newField: this.computeNewFieldValue(oldData),
      deprecatedField: oldData.oldField // 保持兼容性
    };
  }

  async rollback(newData: any): Promise<any> {
    // 回滚逻辑
    const { newField, ...oldData } = newData;
    return oldData;
  }
}
```

## 🔍 **监控和告警**

### **版本健康监控**
```typescript
// src/mocks/monitoring/version-health.ts
export class VersionHealthMonitor {
  async checkSchemaHealth(): Promise<HealthReport> {
    return {
      schemaValid: await this.validateCurrentSchema(),
      typesSync: await this.checkTypesSync(),
      handlersSync: await this.checkHandlersSync(),
      compatibilityIssues: await this.detectCompatibilityIssues(),
      performanceMetrics: await this.collectPerformanceMetrics()
    };
  }

  async alertOnIssues(report: HealthReport): Promise<void> {
    if (!report.schemaValid) {
      await this.sendAlert('CRITICAL', 'Schema validation failed');
    }

    if (!report.typesSync) {
      await this.sendAlert('WARNING', 'TypeScript types out of sync');
    }

    if (report.compatibilityIssues.length > 0) {
      await this.sendAlert('WARNING', `Compatibility issues detected: ${report.compatibilityIssues.join(', ')}`);
    }
  }
}
```

## 📋 **使用指南**

### **日常开发工作流**
```bash
# 1. 检查当前版本状态
npm run mock:status

# 2. 提议Schema变更
npm run mock:propose-change -- --description "添加新的用户偏好设置API"

# 3. 验证变更影响
npm run mock:analyze-impact -- --change-id CH-001

# 4. 应用已批准的变更
npm run mock:apply-change -- --change-id CH-001

# 5. 发布新版本
npm run mock:release -- --version 1.0.1

# 6. 验证版本健康
npm run mock:health-check
```

### **紧急回滚流程**
```bash
# 1. 检测问题版本
npm run mock:diagnose

# 2. 快速回滚到上一版本
npm run mock:rollback -- --to-version 1.0.0-baseline

# 3. 验证回滚结果
npm run mock:validate-rollback

# 4. 生成事故报告
npm run mock:incident-report
```

---

**文档版本**: v1.0.0
**创建日期**: 2025-02-02
**最后更新**: 2025-02-02
**状态**: ✅ Day 2 完成 - Schema版本管理策略制定完成
