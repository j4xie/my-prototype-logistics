# PRD-API-TestController

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档标题 | TestController API详细设计文档 |
| 控制器名称 | TestController |
| 业务域 | 开发测试 (Development Testing) |
| 接口路径 | `/api/test` |
| 文档版本 | v1.0.0 |
| 创建日期 | 2025-11-20 |
| 最后更新 | 2025-11-20 |
| 作者 | Cretas Team |

---

## ⚠️ 重要说明

**本Controller仅用于开发测试环境，生产环境应删除此文件。**

TestController提供了**密码加密测试**功能，帮助开发人员在开发过程中测试BCrypt密码加密和验证逻辑。

**安全警告**：
- ❌ **生产环境禁止使用**：此Controller不应部署到生产环境
- ❌ **无权限控制**：所有端点均无身份验证要求
- ❌ **暴露敏感功能**：密码加密功能不应对外暴露
- ✅ **仅限开发环境**：应仅在本地开发或测试环境使用

---

## 目录

- [1. 概述](#1-概述)
- [2. API端点详细设计](#2-api端点详细设计)
  - [2.1 生成BCrypt密码哈希](#21-生成bcrypt密码哈希)
  - [2.2 验证BCrypt密码](#22-验证bcrypt密码)
- [3. 使用场景](#3-使用场景)
- [4. 安全建议](#4-安全建议)
- [5. 前端集成示例](#5-前端集成示例)

---

## 1. 概述

### 1.1 业务背景

**TestController**是白垩纪食品溯源系统的**开发测试辅助控制器**，提供2个简单的密码加密测试端点。

**主要用途**：
- 🔐 **密码哈希生成**：将明文密码转换为BCrypt哈希（用于初始化数据库用户数据）
- ✅ **密码验证测试**：测试BCrypt密码匹配逻辑是否正常工作
- 🛠️ **开发调试**：帮助开发人员快速生成测试用户的密码哈希

### 1.2 技术栈

- **框架**：Spring Boot 2.7.15
- **密码加密**：BCrypt（Spring Security PasswordEncoder）
- **权限控制**：无（⚠️ 仅开发环境使用）

### 1.3 端点概览

TestController包含**2个API端点**：

| 端点 | 方法 | 路径 | 功能 |
|------|------|------|------|
| 1 | GET | `/api/test/encode-password` | 生成BCrypt密码哈希 |
| 2 | GET | `/api/test/verify-password` | 验证BCrypt密码 |

---

## 2. API端点详细设计

### 2.1 生成BCrypt密码哈希

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/test/encode-password` |
| 接口描述 | 将明文密码转换为BCrypt哈希 |
| 权限要求 | 无（⚠️ 仅开发环境使用） |

**请求参数**

**查询参数**：
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| password | String | 是 | 明文密码 | Admin@123456 |

**请求示例**

```
GET /api/test/encode-password?password=Admin@123456
```

**响应数据结构**

```
$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy
```

**响应说明**：
- 直接返回BCrypt加密后的密码哈希字符串
- 每次调用返回的哈希值都不同（BCrypt内置随机盐）

**BCrypt哈希特性**：
1. **不可逆**：无法从哈希反推出原密码
2. **随机盐**：每次加密同一密码生成不同哈希
3. **慢速算法**：计算耗时约100ms，防止暴力破解
4. **固定长度**：60个字符

**使用场景**

- 初始化数据库时生成管理员密码哈希
- 批量创建测试用户时生成密码
- 手动重置用户密码时生成新哈希
- 验证密码加密逻辑是否正常工作

**示例流程**

```bash
# 1. 生成密码哈希
curl "http://localhost:10010/api/test/encode-password?password=Admin@123456"
# 返回: $2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy

# 2. 将哈希值插入数据库
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy', 'super_admin');
```

---

### 2.2 验证BCrypt密码

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/test/verify-password` |
| 接口描述 | 验证明文密码是否与BCrypt哈希匹配 |
| 权限要求 | 无（⚠️ 仅开发环境使用） |

**请求参数**

**查询参数**：
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| rawPassword | String | 是 | 明文密码 | Admin@123456 |
| encodedPassword | String | 是 | BCrypt密码哈希 | $2a$10$N9qo8... |

**请求示例**

```
GET /api/test/verify-password?rawPassword=Admin@123456&encodedPassword=$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy
```

**响应数据结构**

```
Password matches: true
```

或

```
Password matches: false
```

**响应说明**：
- 返回字符串，格式：`Password matches: {true|false}`
- `true`：明文密码与哈希匹配
- `false`：明文密码与哈希不匹配

**验证原理**

BCrypt验证过程：
1. 从`encodedPassword`中提取盐值
2. 使用相同盐值加密`rawPassword`
3. 比较加密结果与`encodedPassword`是否一致

**使用场景**

- 测试密码加密/验证逻辑是否正常
- 调试用户登录失败问题（验证数据库中的密码哈希是否正确）
- 验证手动重置的密码是否能正常登录

**示例流程**

```bash
# 场景：用户报告无法登录，密码是Admin@123456
# 1. 从数据库获取该用户的password_hash
SELECT password_hash FROM users WHERE username = 'admin';
# 返回: $2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy

# 2. 使用测试接口验证
curl "http://localhost:10010/api/test/verify-password?rawPassword=Admin@123456&encodedPassword=$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy"
# 返回: Password matches: true

# 结论：密码哈希正确，问题可能在其他地方（如用户状态、权限等）
```

---

## 3. 使用场景

### 3.1 初始化管理员账号

**场景**：首次部署系统，需要创建超级管理员账号

```bash
# 1. 生成密码哈希
curl "http://localhost:10010/api/test/encode-password?password=SuperAdmin@2025"
# 返回: $2a$10$xK3pL9mN7oQ2rS4tU5vW6eY8zA1bC2dE3fG4hI5jK6lM7nO8pQ9r

# 2. 执行SQL插入管理员
INSERT INTO users (id, username, password_hash, role, factory_id, is_active)
VALUES (1, 'super_admin', '$2a$10$xK3pL9mN7oQ2rS4tU5vW6eY8zA1bC2dE3fG4hI5jK6lM7nO8pQ9r', 'super_admin', NULL, true);
```

### 3.2 批量创建测试用户

**场景**：开发环境需要创建100个测试用户

```typescript
// 批量生成密码脚本
const usernames = ['user1', 'user2', 'user3', /* ... */ 'user100'];

for (const username of usernames) {
  const password = `Test@${username}`;

  // 调用测试接口生成哈希
  const hash = await fetch(
    `http://localhost:10010/api/test/encode-password?password=${password}`
  ).then(r => r.text());

  // 插入数据库
  await db.query(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, hash, 'factory_worker']
  );
}
```

### 3.3 调试登录失败问题

**场景**：用户报告无法登录，排查密码问题

```bash
# 步骤1：从数据库查询用户的密码哈希
mysql> SELECT username, password_hash FROM users WHERE username = 'zhangsan';
+----------+--------------------------------------------------------------+
| username | password_hash                                                |
+----------+--------------------------------------------------------------+
| zhangsan | $2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP |
+----------+--------------------------------------------------------------+

# 步骤2：使用测试接口验证密码
curl "http://localhost:10010/api/test/verify-password?rawPassword=WrongPassword&encodedPassword=$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP"
# 返回: Password matches: false

curl "http://localhost:10010/api/test/verify-password?rawPassword=CorrectPassword&encodedPassword=$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP"
# 返回: Password matches: true

# 结论：用户输入的密码错误，需要重置密码
```

### 3.4 重置用户密码

**场景**：用户忘记密码，管理员手动重置

```bash
# 1. 生成新密码哈希
curl "http://localhost:10010/api/test/encode-password?password=NewPassword@2025"
# 返回: $2a$10$newHashValue...

# 2. 更新数据库
UPDATE users
SET password_hash = '$2a$10$newHashValue...'
WHERE username = 'zhangsan';

# 3. 验证新密码（可选）
curl "http://localhost:10010/api/test/verify-password?rawPassword=NewPassword@2025&encodedPassword=$2a$10$newHashValue..."
# 返回: Password matches: true
```

---

## 4. 安全建议

### 4.1 生产环境安全措施

**强制要求**：

1. **删除TestController**
   ```bash
   # 生产环境编译前删除文件
   rm src/main/java/com/cretas/aims/controller/TestController.java
   ```

2. **使用Profile隔离**
   ```java
   @RestController
   @RequestMapping("/api/test")
   @Profile("dev") // 仅在dev环境激活
   public class TestController {
       // ...
   }
   ```

3. **添加权限控制**（如果必须保留）
   ```java
   @RestController
   @RequestMapping("/api/test")
   @PreAuthorize("hasAuthority('super_admin')") // 仅超级管理员
   public class TestController {
       // ...
   }
   ```

4. **IP白名单限制**
   ```yaml
   # application-prod.yml
   security:
     test-endpoints:
       enabled: false
       allowed-ips:
         - 127.0.0.1
         - 10.0.0.0/8
   ```

### 4.2 潜在安全风险

| 风险 | 严重程度 | 说明 | 缓解措施 |
|------|---------|------|---------|
| 密码嗅探 | 🔴 高 | 明文密码通过URL传输，可被日志记录 | 使用POST + 请求体传参 |
| 暴力破解 | 🟡 中 | 攻击者可批量生成常见密码的哈希 | 添加Rate Limiting |
| 服务滥用 | 🟡 中 | BCrypt计算密集，可能被用于DoS攻击 | 添加频率限制、IP白名单 |
| 信息泄露 | 🟡 中 | 暴露系统使用BCrypt加密算法 | 生产环境删除Controller |

### 4.3 改进建议

**建议的安全实现**（如果必须保留此功能）：

```java
@RestController
@RequestMapping("/api/test")
@PreAuthorize("hasAuthority('super_admin')")
@Profile("dev") // 仅开发环境
public class TestController {

    private final PasswordEncoder passwordEncoder;
    private final Map<String, Integer> rateLimitMap = new ConcurrentHashMap<>();

    @PostMapping("/encode-password") // 改用POST
    public ResponseEntity<String> encodePassword(
        @RequestBody PasswordRequest request,
        HttpServletRequest httpRequest
    ) {
        // IP频率限制
        String clientIp = httpRequest.getRemoteAddr();
        int count = rateLimitMap.getOrDefault(clientIp, 0);
        if (count > 10) {
            return ResponseEntity.status(429).body("Rate limit exceeded");
        }
        rateLimitMap.put(clientIp, count + 1);

        // 密码强度验证
        if (request.getPassword().length() < 8) {
            return ResponseEntity.badRequest().body("Password too weak");
        }

        String hash = passwordEncoder.encode(request.getPassword());

        // 记录审计日志
        log.warn("Password encoding requested by {}", httpRequest.getRemoteAddr());

        return ResponseEntity.ok(hash);
    }
}

@Data
class PasswordRequest {
    private String password;
}
```

---

## 5. 前端集成示例

### 5.1 API Client封装

**testApiClient.ts**（⚠️ 仅开发环境使用）

```typescript
import { apiClient } from './apiClient';

/**
 * 生成BCrypt密码哈希
 * ⚠️ 仅用于开发测试环境
 */
export const encodePassword = async (password: string): Promise<string> => {
  const response = await apiClient.get<string>(
    '/api/test/encode-password',
    { params: { password } }
  );
  return response.data;
};

/**
 * 验证BCrypt密码
 * ⚠️ 仅用于开发测试环境
 */
export const verifyPassword = async (
  rawPassword: string,
  encodedPassword: string
): Promise<boolean> => {
  const response = await apiClient.get<string>(
    '/api/test/verify-password',
    { params: { rawPassword, encodedPassword } }
  );
  // 解析 "Password matches: true" 格式的响应
  return response.data.includes('true');
};

export default {
  encodePassword,
  verifyPassword,
};
```

### 5.2 开发工具组件

**PasswordToolScreen.tsx**（⚠️ 仅开发环境）

```typescript
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Card, Title, Paragraph } from 'react-native-paper';
import * as testApi from '../services/api/testApiClient';

/**
 * 密码工具页面
 * ⚠️ 仅用于开发测试环境，生产环境应移除
 */
export const PasswordToolScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [encodedHash, setEncodedHash] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

  const handleEncode = async () => {
    if (!password) {
      Alert.alert('错误', '请输入密码');
      return;
    }

    try {
      const hash = await testApi.encodePassword(password);
      setEncodedHash(hash);
      Alert.alert('成功', '密码哈希已生成');
    } catch (error: any) {
      Alert.alert('错误', error.message || '生成失败');
    }
  };

  const handleVerify = async () => {
    if (!verifyPassword || !verifyHash) {
      Alert.alert('错误', '请输入密码和哈希值');
      return;
    }

    try {
      const matches = await testApi.verifyPassword(verifyPassword, verifyHash);
      setVerifyResult(matches);
      Alert.alert(
        matches ? '验证成功' : '验证失败',
        matches ? '密码与哈希匹配' : '密码与哈希不匹配'
      );
    } catch (error: any) {
      Alert.alert('错误', error.message || '验证失败');
    }
  };

  return (
    <View style={styles.container}>
      {/* 密码加密 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>生成密码哈希</Title>
          <TextInput
            label="明文密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
          />
          <Button mode="contained" onPress={handleEncode} style={styles.button}>
            生成哈希
          </Button>
          {encodedHash && (
            <View style={styles.result}>
              <Paragraph style={styles.label}>BCrypt哈希:</Paragraph>
              <Paragraph
                style={styles.hash}
                selectable
                onPress={() => {
                  // 复制到剪贴板的逻辑
                  Alert.alert('提示', '长按可复制哈希值');
                }}
              >
                {encodedHash}
              </Paragraph>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 密码验证 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>验证密码</Title>
          <TextInput
            label="明文密码"
            value={verifyPassword}
            onChangeText={setVerifyPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="BCrypt哈希"
            value={verifyHash}
            onChangeText={setVerifyHash}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          <Button mode="contained" onPress={handleVerify} style={styles.button}>
            验证
          </Button>
          {verifyResult !== null && (
            <View
              style={[
                styles.result,
                { backgroundColor: verifyResult ? '#C8E6C9' : '#FFCDD2' },
              ]}
            >
              <Paragraph
                style={[
                  styles.resultText,
                  { color: verifyResult ? '#2E7D32' : '#C62828' },
                ]}
              >
                {verifyResult ? '✓ 密码匹配' : '✗ 密码不匹配'}
              </Paragraph>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 安全警告 */}
      <Card style={[styles.card, styles.warningCard]}>
        <Card.Content>
          <Title style={styles.warningTitle}>⚠️ 安全警告</Title>
          <Paragraph style={styles.warningText}>
            此工具仅供开发测试使用，严禁在生产环境部署。
          </Paragraph>
          <Paragraph style={styles.warningText}>
            • 不要在公共网络环境使用
          </Paragraph>
          <Paragraph style={styles.warningText}>
            • 不要输入真实用户的密码
          </Paragraph>
          <Paragraph style={styles.warningText}>
            • 生产环境应删除TestController
          </Paragraph>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  result: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  hash: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#1976D2',
  },
  resultText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
    borderWidth: 2,
  },
  warningTitle: {
    color: '#E65100',
  },
  warningText: {
    color: '#E65100',
    fontSize: 13,
    marginTop: 4,
  },
});
```

### 5.3 命令行工具脚本

**generate-password-hash.js**（Node.js脚本）

```javascript
#!/usr/bin/env node
const axios = require('axios');

const API_BASE = 'http://localhost:10010';

async function generateHash(password) {
  try {
    const response = await axios.get(`${API_BASE}/api/test/encode-password`, {
      params: { password },
    });
    return response.data;
  } catch (error) {
    throw new Error(`生成失败: ${error.message}`);
  }
}

async function verifyHash(rawPassword, encodedPassword) {
  try {
    const response = await axios.get(`${API_BASE}/api/test/verify-password`, {
      params: { rawPassword, encodedPassword },
    });
    return response.data.includes('true');
  } catch (error) {
    throw new Error(`验证失败: ${error.message}`);
  }
}

// CLI使用
const args = process.argv.slice(2);
const command = args[0];

if (command === 'encode') {
  const password = args[1];
  if (!password) {
    console.error('用法: node generate-password-hash.js encode <password>');
    process.exit(1);
  }
  generateHash(password).then(hash => {
    console.log('密码哈希:');
    console.log(hash);
  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
} else if (command === 'verify') {
  const [rawPassword, encodedPassword] = [args[1], args[2]];
  if (!rawPassword || !encodedPassword) {
    console.error('用法: node generate-password-hash.js verify <password> <hash>');
    process.exit(1);
  }
  verifyHash(rawPassword, encodedPassword).then(matches => {
    console.log(matches ? '✓ 密码匹配' : '✗ 密码不匹配');
    process.exit(matches ? 0 : 1);
  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  console.log('用法:');
  console.log('  生成哈希: node generate-password-hash.js encode <password>');
  console.log('  验证密码: node generate-password-hash.js verify <password> <hash>');
  process.exit(1);
}
```

**使用示例**：

```bash
# 生成密码哈希
node generate-password-hash.js encode "Admin@123456"
# 输出: $2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy

# 验证密码
node generate-password-hash.js verify "Admin@123456" "$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy"
# 输出: ✓ 密码匹配
```

---

## 6. BCrypt技术细节

### 6.1 BCrypt算法特点

| 特性 | 说明 |
|------|------|
| **不可逆性** | 无法从哈希反推出原密码 |
| **随机盐** | 每次加密同一密码生成不同哈希（内置盐值） |
| **自适应性** | 可调整计算复杂度（work factor/cost） |
| **抗暴力破解** | 计算密集，每次验证约100ms |
| **固定长度** | 哈希值固定60个字符 |

### 6.2 BCrypt哈希格式

```
$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy
 │  │  │                                                          │
 │  │  └─ 盐值（22字符）                                          │
 │  └─ cost参数（迭代次数 = 2^10 = 1024）                         │
 └─ 算法版本（2a = BCrypt）                                       └─ 哈希值（31字符）
```

**字段说明**：
- **$2a$**：BCrypt算法版本（2a是最常用版本）
- **10**：cost参数（迭代次数 = 2^10 = 1024次）
- **N9qo8uLOickgx2ZMRZoM**：随机盐值（22字符）
- **ye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy**：密码哈希值（31字符）

### 6.3 Cost参数对比

| Cost | 迭代次数 | 计算时间 | 适用场景 |
|------|---------|---------|---------|
| 8 | 256 | ~40ms | 低安全要求 |
| 10 | 1024 | ~100ms | **默认值，推荐** |
| 12 | 4096 | ~400ms | 高安全要求 |
| 14 | 16384 | ~1.6s | 极高安全要求 |

**Spring Security默认使用cost=10**

---

## 7. 总结

### 7.1 端点概览

TestController包含**2个API端点**：

1. **生成BCrypt密码哈希**：`GET /api/test/encode-password`
2. **验证BCrypt密码**：`GET /api/test/verify-password`

### 7.2 主要用途

- ✅ 开发环境快速生成密码哈希
- ✅ 调试密码验证逻辑
- ✅ 初始化测试用户数据
- ✅ 排查用户登录问题

### 7.3 安全要求

- ❌ **禁止在生产环境使用**
- ✅ 使用`@Profile("dev")`限制环境
- ✅ 添加`@PreAuthorize`权限控制
- ✅ 实施IP白名单和频率限制
- ✅ 改用POST方法传参（避免URL记录明文密码）

### 7.4 替代方案

生产环境应使用正规的密码管理方式：
- **用户注册**：通过正常注册流程创建账号
- **密码重置**：通过邮件/短信验证码重置密码
- **管理员操作**：通过管理后台的用户管理功能重置密码
- **数据库初始化**：使用Liquibase/Flyway migration脚本预生成哈希

---

**文档结束**

**⚠️ 再次提醒：本Controller仅供开发测试使用，生产环境必须删除或严格限制访问权限。**

如需查看其他Controller的API文档，请参考：
- [PRD-API-索引文档](./PRD-API-索引文档.md)
- [PRD-API-AuthController](./PRD-API-AuthController.md)
- [PRD-API-UserController](./PRD-API-UserController.md)
- [PRD-API-PlatformController](./PRD-API-PlatformController.md)
