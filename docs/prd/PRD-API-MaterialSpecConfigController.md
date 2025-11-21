# PRD-API-MaterialSpecConfigController

**文档版本**: v1.0.0
**创建日期**: 2025-01-20
**Controller**: `MaterialSpecConfigController.java`
**基础路径**: `/api/mobile/{factoryId}/material-spec-config`
**功能模块**: 原材料规格配置管理

---

## 📋 目录

- [概述](#概述)
- [端点列表](#端点列表)
- [数据模型](#数据模型)
- [API详细说明](#api详细说明)
  - [1. 获取所有规格配置](#1-获取所有规格配置)
  - [2. 获取类别规格配置](#2-获取类别规格配置)
  - [3. 更新类别规格配置](#3-更新类别规格配置)
  - [4. 重置为默认配置](#4-重置为默认配置)
  - [5. 获取系统默认配置](#5-获取系统默认配置)
- [系统默认配置](#系统默认配置)
- [核心业务逻辑](#核心业务逻辑)
- [前端集成指南](#前端集成指南)
- [错误处理](#错误处理)
- [测试建议](#测试建议)

---

## 概述

**MaterialSpecConfigController** 负责管理原材料类别的规格选项配置。每个工厂可以为不同类别的原材料自定义规格选项，用于在录入原材料批次时选择。

### 核心功能

1. **规格配置查询**
   - 获取工厂所有类别的规格配置
   - 获取指定类别的规格选项
   - 获取系统默认配置

2. **规格配置管理**
   - 更新类别的规格选项
   - 重置为系统默认配置

3. **默认配置体系**
   - 系统预设9个类别的默认配置
   - 工厂可自定义每个类别的规格
   - 未自定义时使用系统默认

### 业务价值

- **标准化管理**: 统一原材料规格选项，避免录入混乱
- **灵活配置**: 支持工厂自定义规格，满足不同业务需求
- **提升效率**: 下拉选择替代手动输入，减少错误
- **数据一致性**: 规格标准化便于统计分析

### 应用场景

**示例：海鲜类原材料**
- **系统默认**: ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]
- **工厂自定义**: ["整条", "切片", "去骨切片", "三文鱼块", "鱼排", "虾仁"]

在录入原材料批次时，从下拉列表选择规格：
```
原材料名称: 三文鱼
规格: [下拉选择] 去骨切片
数量: 50kg
```

---

## 端点列表

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 |
|---|----------|---------|---------|---------|
| 1 | GET | `/api/mobile/{factoryId}/material-spec-config` | 获取所有规格配置 | 所有角色 |
| 2 | GET | `/api/mobile/{factoryId}/material-spec-config/{category}` | 获取类别规格配置 | 所有角色 |
| 3 | PUT | `/api/mobile/{factoryId}/material-spec-config/{category}` | 更新类别规格配置 | 工厂管理员 |
| 4 | DELETE | `/api/mobile/{factoryId}/material-spec-config/{category}` | 重置为默认配置 | 工厂管理员 |
| 5 | GET | `/api/mobile/{factoryId}/material-spec-config/system/defaults` | 获取系统默认配置 | 所有角色 |

**共计**: 5个端点

---

## 数据模型

### MaterialSpecConfig（实体类）

```typescript
interface MaterialSpecConfig {
  id: number;                       // 主键ID
  factoryId: string;                // 工厂ID
  category: string;                 // 类别名称（如"海鲜"、"肉类"）
  specifications: string;           // 规格选项列表（JSON文本）
  isSystemDefault: boolean;         // 是否系统默认配置
  createdAt?: string;               // 创建时间
  updatedAt?: string;               // 更新时间
}
```

### SpecConfigDTO（前端使用）

```typescript
// 响应格式：Map<类别, 规格列表>
type SpecConfigResponse = Record<string, string[]>;

// 示例
const specConfigs: SpecConfigResponse = {
  "海鲜": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"],
  "肉类": ["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"],
  "蔬菜": ["整颗", "切段", "切丝", "切块", "切片"],
  // ...
};
```

### UpdateSpecRequest（更新请求）

```typescript
interface UpdateSpecRequest {
  specifications: string[];         // 规格列表（至少1项）
}
```

### 核心字段说明

#### 1. category（类别）
- **定义**: 原材料类别名称
- **系统预设类别**:
  - 海鲜、肉类、蔬菜、水果
  - 粉类、米面、油类、调料
  - 其他

#### 2. specifications（规格选项）
- **存储方式**: JSON文本（TEXT列）
- **序列化**: Service层负责JSON序列化/反序列化
- **示例**:
  ```json
  ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]
  ```

#### 3. isSystemDefault（系统默认标识）
- **true**: 系统预设的默认配置
- **false**: 用户自定义配置

### 数据库设计

**表名**: `material_spec_config`

**唯一约束**:
```sql
UNIQUE KEY `uk_factory_category` (`factory_id`, `category`)
```
- **含义**: 同一工厂中，每个类别只能有一个规格配置

**索引**:
```sql
INDEX `idx_spec_factory` (`factory_id`)
INDEX `idx_spec_category` (`category`)
```

**关联关系**:
- `factory` → `Factory` (多对一)

---

## API详细说明

### 1. 获取所有规格配置

**端点**: `GET /api/mobile/{factoryId}/material-spec-config`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "海鲜": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"],
    "肉类": ["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"],
    "蔬菜": ["整颗", "切段", "切丝", "切块", "切片"],
    "水果": ["整个", "切片", "切块", "去皮", "带皮"],
    "粉类": ["袋装", "散装", "桶装"],
    "米面": ["袋装", "散装", "包装"],
    "油类": ["瓶装", "桶装", "散装", "大桶", "小瓶"],
    "调料": ["瓶装", "袋装", "罐装", "散装", "盒装"],
    "其他": ["原装", "分装", "定制"]
  },
  "timestamp": "2025-01-20T12:00:00"
}
```

#### 业务逻辑

```java
// MaterialSpecConfigService.getAllSpecConfigs()
public Map<String, List<String>> getAllSpecConfigs(String factoryId) {
    // 1. 从数据库查询工厂的自定义配置
    List<MaterialSpecConfig> configs = repository.findByFactoryId(factoryId);

    // 2. 如果工厂没有自定义配置，返回系统默认
    if (configs.isEmpty()) {
        log.info("工厂{}无自定义配置，返回系统默认配置", factoryId);
        return new LinkedHashMap<>(SYSTEM_DEFAULT_CONFIGS);
    }

    // 3. 转换为Map格式（JSON反序列化）
    Map<String, List<String>> result = configs.stream()
        .collect(Collectors.toMap(
            MaterialSpecConfig::getCategory,
            config -> parseSpecifications(config.getSpecifications()),
            (a, b) -> a,
            LinkedHashMap::new
        ));

    // 4. 补充缺失的类别（使用系统默认）
    SYSTEM_DEFAULT_CONFIGS.forEach((category, defaultSpecs) -> {
        result.putIfAbsent(category, defaultSpecs);
    });

    return result;
}

// JSON反序列化
private List<String> parseSpecifications(String json) {
    try {
        return objectMapper.readValue(json, new TypeReference<List<String>>() {});
    } catch (JsonProcessingException e) {
        log.error("解析规格JSON失败: {}", json, e);
        return new ArrayList<>();
    }
}
```

#### 前端集成示例

```typescript
// src/services/api/materialSpecConfigApiClient.ts
export const materialSpecConfigApiClient = {
  getAllSpecConfigs: async (factoryId: string): Promise<Record<string, string[]>> => {
    const response = await apiClient.get<ApiResponse<Record<string, string[]>>>(
      `/api/mobile/${factoryId}/material-spec-config`
    );
    return response.data.data;
  },
};

// 使用示例
const MaterialBatchFormScreen: React.FC = () => {
  const [specConfigs, setSpecConfigs] = useState<Record<string, string[]>>({});
  const [selectedCategory, setSelectedCategory] = useState('海鲜');
  const [selectedSpec, setSelectedSpec] = useState('');

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const configs = await materialSpecConfigApiClient.getAllSpecConfigs('CRETAS_2024_001');
        setSpecConfigs(configs);
      } catch (error) {
        Alert.alert('错误', '加载规格配置失败');
      }
    };

    fetchConfigs();
  }, []);

  return (
    <View>
      {/* 类别选择 */}
      <Picker
        selectedValue={selectedCategory}
        onValueChange={setSelectedCategory}
      >
        {Object.keys(specConfigs).map(category => (
          <Picker.Item key={category} label={category} value={category} />
        ))}
      </Picker>

      {/* 规格选择 */}
      <Picker
        selectedValue={selectedSpec}
        onValueChange={setSelectedSpec}
      >
        {specConfigs[selectedCategory]?.map(spec => (
          <Picker.Item key={spec} label={spec} value={spec} />
        ))}
      </Picker>
    </View>
  );
};
```

---

### 2. 获取类别规格配置

**端点**: `GET /api/mobile/{factoryId}/material-spec-config/{category}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `category` (string, 必填): 类别名称（如"海鲜"、"肉类"）

**示例请求**:
```
GET /api/mobile/CRETAS_2024_001/material-spec-config/海鲜
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"],
  "timestamp": "2025-01-20T12:05:00"
}
```

**未配置时** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"],
  "timestamp": "2025-01-20T12:05:00"
}
```
> 注意：即使工厂未自定义该类别，也会返回系统默认配置

#### 业务逻辑

```java
// MaterialSpecConfigService.getSpecsByCategory()
public List<String> getSpecsByCategory(String factoryId, String category) {
    // 1. 查询工厂的自定义配置
    Optional<MaterialSpecConfig> configOpt = repository
        .findByFactoryIdAndCategory(factoryId, category);

    // 2. 如果存在自定义配置，返回自定义
    if (configOpt.isPresent()) {
        String json = configOpt.get().getSpecifications();
        return parseSpecifications(json);
    }

    // 3. 否则返回系统默认（如果类别存在）
    List<String> defaultSpecs = SYSTEM_DEFAULT_CONFIGS.get(category);
    if (defaultSpecs != null) {
        return new ArrayList<>(defaultSpecs);
    }

    // 4. 类别不存在，返回空列表
    log.warn("类别{}不存在系统默认配置", category);
    return new ArrayList<>();
}
```

#### 前端集成示例

```typescript
const MaterialSpecSelector: React.FC<{ category: string }> = ({ category }) => {
  const [specs, setSpecs] = useState<string[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('');

  useEffect(() => {
    const fetchSpecs = async () => {
      try {
        const specList = await materialSpecConfigApiClient.getSpecsByCategory(
          'CRETAS_2024_001',
          category
        );
        setSpecs(specList);
      } catch (error) {
        Alert.alert('错误', '加载规格选项失败');
      }
    };

    if (category) {
      fetchSpecs();
    }
  }, [category]);

  return (
    <Picker
      selectedValue={selectedSpec}
      onValueChange={setSelectedSpec}
    >
      <Picker.Item label="请选择规格" value="" />
      {specs.map(spec => (
        <Picker.Item key={spec} label={spec} value={spec} />
      ))}
    </Picker>
  );
};
```

---

### 3. 更新类别规格配置

**端点**: `PUT /api/mobile/{factoryId}/material-spec-config/{category}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `category` (string, 必填): 类别名称

**请求体** (`application/json`):
```json
{
  "specifications": [
    "整条",
    "切片",
    "去骨切片",
    "三文鱼块",
    "鱼排",
    "虾仁"
  ]
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "规格配置更新成功",
  "data": {
    "category": "海鲜",
    "specifications": [
      "整条",
      "切片",
      "去骨切片",
      "三文鱼块",
      "鱼排",
      "虾仁"
    ]
  },
  "timestamp": "2025-01-20T12:10:00"
}
```

**错误响应**:
- `400 Bad Request`: 规格列表为空

#### 业务逻辑

```java
// MaterialSpecConfigService.updateCategorySpecs()
@Transactional
public void updateCategorySpecs(String factoryId, String category, List<String> specifications) {
    // 1. 参数验证
    if (specifications == null || specifications.isEmpty()) {
        throw new ValidationException("规格列表不能为空");
    }

    // 2. 去重和排序
    List<String> uniqueSpecs = specifications.stream()
        .distinct()
        .sorted()
        .collect(Collectors.toList());

    // 3. 转换为JSON
    String json = toJson(uniqueSpecs);

    // 4. 查询是否已存在配置
    Optional<MaterialSpecConfig> configOpt = repository
        .findByFactoryIdAndCategory(factoryId, category);

    if (configOpt.isPresent()) {
        // 更新已存在的配置
        MaterialSpecConfig config = configOpt.get();
        config.setSpecifications(json);
        config.setIsSystemDefault(false);  // 标记为自定义
        repository.save(config);
    } else {
        // 创建新配置
        MaterialSpecConfig config = new MaterialSpecConfig();
        config.setFactoryId(factoryId);
        config.setCategory(category);
        config.setSpecifications(json);
        config.setIsSystemDefault(false);
        repository.save(config);
    }

    log.info("更新规格配置成功: factoryId={}, category={}, count={}",
        factoryId, category, uniqueSpecs.size());
}

// JSON序列化
private String toJson(List<String> list) {
    try {
        return objectMapper.writeValueAsString(list);
    } catch (JsonProcessingException e) {
        log.error("转换规格为JSON失败: {}", list, e);
        return "[]";
    }
}
```

#### 前端集成示例

```typescript
const SpecConfigEditScreen: React.FC = ({ route }) => {
  const { category } = route.params;
  const [specs, setSpecs] = useState<string[]>([]);
  const [newSpec, setNewSpec] = useState('');

  const loadSpecs = async () => {
    try {
      const specList = await materialSpecConfigApiClient.getSpecsByCategory(
        'CRETAS_2024_001',
        category
      );
      setSpecs(specList);
    } catch (error) {
      Alert.alert('错误', '加载失败');
    }
  };

  useEffect(() => {
    loadSpecs();
  }, [category]);

  const handleAddSpec = () => {
    if (newSpec.trim() && !specs.includes(newSpec.trim())) {
      setSpecs([...specs, newSpec.trim()]);
      setNewSpec('');
    }
  };

  const handleRemoveSpec = (spec: string) => {
    setSpecs(specs.filter(s => s !== spec));
  };

  const handleSave = async () => {
    if (specs.length === 0) {
      Alert.alert('错误', '规格列表不能为空');
      return;
    }

    try {
      await materialSpecConfigApiClient.updateCategorySpecs(
        'CRETAS_2024_001',
        category,
        specs
      );

      Alert.alert('成功', '规格配置已更新');
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', '保存失败');
    }
  };

  return (
    <ScrollView>
      <Text style={styles.title}>编辑规格配置：{category}</Text>

      {/* 添加新规格 */}
      <View style={styles.addSection}>
        <TextInput
          placeholder="输入新规格"
          value={newSpec}
          onChangeText={setNewSpec}
        />
        <Button title="添加" onPress={handleAddSpec} />
      </View>

      {/* 规格列表 */}
      <View style={styles.specList}>
        {specs.map((spec, index) => (
          <View key={index} style={styles.specItem}>
            <Text>{spec}</Text>
            <IconButton
              icon="delete"
              onPress={() => handleRemoveSpec(spec)}
            />
          </View>
        ))}
      </View>

      {/* 保存按钮 */}
      <Button title="保存" onPress={handleSave} />
    </ScrollView>
  );
};
```

---

### 4. 重置为默认配置

**端点**: `DELETE /api/mobile/{factoryId}/material-spec-config/{category}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `category` (string, 必填): 类别名称

**示例请求**:
```
DELETE /api/mobile/CRETAS_2024_001/material-spec-config/海鲜
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "已重置为默认配置",
  "data": {
    "category": "海鲜",
    "specifications": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]
  },
  "timestamp": "2025-01-20T12:15:00"
}
```

#### 业务逻辑

```java
// MaterialSpecConfigService.resetToDefault()
@Transactional
public List<String> resetToDefault(String factoryId, String category) {
    // 1. 删除自定义配置
    Optional<MaterialSpecConfig> configOpt = repository
        .findByFactoryIdAndCategory(factoryId, category);

    if (configOpt.isPresent()) {
        repository.delete(configOpt.get());
        log.info("删除自定义配置: factoryId={}, category={}", factoryId, category);
    }

    // 2. 返回系统默认配置
    List<String> defaultSpecs = SYSTEM_DEFAULT_CONFIGS.get(category);
    if (defaultSpecs == null) {
        log.warn("类别{}不存在系统默认配置", category);
        return new ArrayList<>();
    }

    return new ArrayList<>(defaultSpecs);
}
```

#### 前端集成示例

```typescript
const SpecConfigEditScreen: React.FC = ({ route }) => {
  const { category } = route.params;

  const handleResetToDefault = async () => {
    Alert.alert(
      '确认重置',
      '将删除自定义配置，恢复为系统默认配置。确定继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置',
          style: 'destructive',
          onPress: async () => {
            try {
              const defaultSpecs = await materialSpecConfigApiClient.resetToDefault(
                'CRETAS_2024_001',
                category
              );

              Alert.alert('成功', '已重置为默认配置');
              setSpecs(defaultSpecs);
            } catch (error) {
              Alert.alert('错误', '重置失败');
            }
          },
        },
      ]
    );
  };

  return (
    <View>
      <Button
        title="重置为默认配置"
        onPress={handleResetToDefault}
        color="orange"
      />
    </View>
  );
};
```

---

### 5. 获取系统默认配置

**端点**: `GET /api/mobile/{factoryId}/material-spec-config/system/defaults`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "海鲜": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"],
    "肉类": ["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"],
    "蔬菜": ["整颗", "切段", "切丝", "切块", "切片"],
    "水果": ["整个", "切片", "切块", "去皮", "带皮"],
    "粉类": ["袋装", "散装", "桶装"],
    "米面": ["袋装", "散装", "包装"],
    "油类": ["瓶装", "桶装", "散装", "大桶", "小瓶"],
    "调料": ["瓶装", "袋装", "罐装", "散装", "盒装"],
    "其他": ["原装", "分装", "定制"]
  },
  "timestamp": "2025-01-20T12:20:00"
}
```

#### 业务逻辑

```java
// MaterialSpecConfigService.getSystemDefaultConfigs()
public Map<String, List<String>> getSystemDefaultConfigs() {
    return new LinkedHashMap<>(SYSTEM_DEFAULT_CONFIGS);
}
```

#### 前端集成示例

```typescript
const SystemDefaultsScreen: React.FC = () => {
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const configs = await materialSpecConfigApiClient.getSystemDefaults('CRETAS_2024_001');
        setDefaults(configs);
      } catch (error) {
        Alert.alert('错误', '加载系统默认配置失败');
      }
    };

    fetchDefaults();
  }, []);

  return (
    <ScrollView>
      <Text style={styles.title}>系统默认规格配置</Text>

      {Object.entries(defaults).map(([category, specs]) => (
        <View key={category} style={styles.categoryCard}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.specList}>
            {specs.map(spec => (
              <Chip key={spec}>{spec}</Chip>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};
```

---

## 系统默认配置

### 完整默认配置列表

```java
private static final Map<String, List<String>> SYSTEM_DEFAULT_CONFIGS = new LinkedHashMap<>();

static {
    // 1. 海鲜类
    SYSTEM_DEFAULT_CONFIGS.put("海鲜", Arrays.asList(
        "整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"
    ));

    // 2. 肉类
    SYSTEM_DEFAULT_CONFIGS.put("肉类", Arrays.asList(
        "整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"
    ));

    // 3. 蔬菜类
    SYSTEM_DEFAULT_CONFIGS.put("蔬菜", Arrays.asList(
        "整颗", "切段", "切丝", "切块", "切片"
    ));

    // 4. 水果类
    SYSTEM_DEFAULT_CONFIGS.put("水果", Arrays.asList(
        "整个", "切片", "切块", "去皮", "带皮"
    ));

    // 5. 粉类
    SYSTEM_DEFAULT_CONFIGS.put("粉类", Arrays.asList(
        "袋装", "散装", "桶装"
    ));

    // 6. 米面类
    SYSTEM_DEFAULT_CONFIGS.put("米面", Arrays.asList(
        "袋装", "散装", "包装"
    ));

    // 7. 油类
    SYSTEM_DEFAULT_CONFIGS.put("油类", Arrays.asList(
        "瓶装", "桶装", "散装", "大桶", "小瓶"
    ));

    // 8. 调料类
    SYSTEM_DEFAULT_CONFIGS.put("调料", Arrays.asList(
        "瓶装", "袋装", "罐装", "散装", "盒装"
    ));

    // 9. 其他类
    SYSTEM_DEFAULT_CONFIGS.put("其他", Arrays.asList(
        "原装", "分装", "定制"
    ));
}
```

### 分类说明

#### 1. 海鲜类
**规格**: 整条、切片、去骨切片、鱼块、鱼排、虾仁、去壳

**适用场景**:
- 整条：完整的鱼类
- 切片：切成薄片（如三文鱼片）
- 去骨切片：去除鱼骨的切片
- 鱼块：切成块状
- 鱼排：带骨的鱼排
- 虾仁：去壳的虾仁
- 去壳：其他去壳海鲜

#### 2. 肉类
**规格**: 整块、切片、切丁、绞肉、排骨、带骨、去骨

**适用场景**:
- 整块：完整的肉块
- 切片：切成薄片（如猪肉片）
- 切丁：切成小丁（如牛肉丁）
- 绞肉：绞碎的肉糜
- 排骨：带骨的排骨
- 带骨：其他带骨肉类
- 去骨：去骨肉类

#### 3. 蔬菜类
**规格**: 整颗、切段、切丝、切块、切片

**适用场景**:
- 整颗：完整的蔬菜（如白菜）
- 切段：切成段状（如葱段）
- 切丝：切成丝状（如土豆丝）
- 切块：切成块状（如南瓜块）
- 切片：切成薄片（如黄瓜片）

#### 4. 水果类
**规格**: 整个、切片、切块、去皮、带皮

**适用场景**:
- 整个：完整的水果
- 切片：切成薄片（如苹果片）
- 切块：切成块状（如西瓜块）
- 去皮：去皮处理
- 带皮：带皮状态

#### 5-9. 包装类（粉类、米面、油类、调料、其他）
**规格**: 袋装、散装、桶装、瓶装、罐装、盒装等

**适用场景**:
- 不同包装形式的原材料
- 根据包装规格录入

---

## 核心业务逻辑

### 1. 配置优先级

```
工厂自定义配置 > 系统默认配置
```

**逻辑**:
```java
public List<String> getSpecsByCategory(String factoryId, String category) {
    // 1. 优先查询工厂自定义配置
    Optional<MaterialSpecConfig> configOpt = repository
        .findByFactoryIdAndCategory(factoryId, category);

    if (configOpt.isPresent()) {
        // 返回自定义配置
        return parseSpecifications(configOpt.get().getSpecifications());
    }

    // 2. 否则返回系统默认配置
    return SYSTEM_DEFAULT_CONFIGS.getOrDefault(category, new ArrayList<>());
}
```

### 2. JSON序列化/反序列化

**存储格式**:
```json
["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]
```

**序列化**（List → JSON）:
```java
private String toJson(List<String> list) {
    try {
        return objectMapper.writeValueAsString(list);
    } catch (JsonProcessingException e) {
        log.error("转换规格为JSON失败: {}", list, e);
        return "[]";
    }
}
```

**反序列化**（JSON → List）:
```java
private List<String> parseSpecifications(String json) {
    try {
        return objectMapper.readValue(json, new TypeReference<List<String>>() {});
    } catch (JsonProcessingException e) {
        log.error("解析规格JSON失败: {}", json, e);
        return new ArrayList<>();
    }
}
```

### 3. 配置更新策略

**更新流程**:
```java
@Transactional
public void updateCategorySpecs(String factoryId, String category, List<String> specifications) {
    // 1. 去重
    List<String> uniqueSpecs = specifications.stream()
        .distinct()
        .collect(Collectors.toList());

    // 2. 转换为JSON
    String json = toJson(uniqueSpecs);

    // 3. 查询是否已存在
    Optional<MaterialSpecConfig> configOpt = repository
        .findByFactoryIdAndCategory(factoryId, category);

    if (configOpt.isPresent()) {
        // 更新已有配置
        MaterialSpecConfig config = configOpt.get();
        config.setSpecifications(json);
        config.setIsSystemDefault(false);
        repository.save(config);
    } else {
        // 创建新配置
        MaterialSpecConfig config = new MaterialSpecConfig();
        config.setFactoryId(factoryId);
        config.setCategory(category);
        config.setSpecifications(json);
        config.setIsSystemDefault(false);
        repository.save(config);
    }
}
```

### 4. 配置重置策略

**重置流程**:
```java
@Transactional
public List<String> resetToDefault(String factoryId, String category) {
    // 1. 删除自定义配置（如果存在）
    Optional<MaterialSpecConfig> configOpt = repository
        .findByFactoryIdAndCategory(factoryId, category);

    if (configOpt.isPresent()) {
        repository.delete(configOpt.get());
    }

    // 2. 返回系统默认配置
    List<String> defaultSpecs = SYSTEM_DEFAULT_CONFIGS.get(category);
    return defaultSpecs != null ? new ArrayList<>(defaultSpecs) : new ArrayList<>();
}
```

### 5. 工厂初始化

**新工厂创建时**:
```java
public void initializeDefaultConfigs(String factoryId) {
    // 可选：为新工厂创建所有系统默认配置的副本
    // 或者不创建，让第一次查询时自动使用系统默认
}
```

---

## 前端集成指南

### 完整API客户端

```typescript
// src/services/api/materialSpecConfigApiClient.ts
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const materialSpecConfigApiClient = {
  // 1. 获取所有规格配置
  getAllSpecConfigs: async (factoryId: string): Promise<Record<string, string[]>> => {
    const response = await apiClient.get<ApiResponse<Record<string, string[]>>>(
      `/api/mobile/${factoryId}/material-spec-config`
    );
    return response.data.data;
  },

  // 2. 获取类别规格配置
  getSpecsByCategory: async (factoryId: string, category: string): Promise<string[]> => {
    const response = await apiClient.get<ApiResponse<string[]>>(
      `/api/mobile/${factoryId}/material-spec-config/${category}`
    );
    return response.data.data;
  },

  // 3. 更新类别规格配置
  updateCategorySpecs: async (
    factoryId: string,
    category: string,
    specifications: string[]
  ): Promise<{ category: string; specifications: string[] }> => {
    const response = await apiClient.put<
      ApiResponse<{ category: string; specifications: string[] }>
    >(
      `/api/mobile/${factoryId}/material-spec-config/${category}`,
      { specifications }
    );
    return response.data.data;
  },

  // 4. 重置为默认配置
  resetToDefault: async (
    factoryId: string,
    category: string
  ): Promise<string[]> => {
    const response = await apiClient.delete<
      ApiResponse<{ category: string; specifications: string[] }>
    >(`/api/mobile/${factoryId}/material-spec-config/${category}`);
    return response.data.data.specifications;
  },

  // 5. 获取系统默认配置
  getSystemDefaults: async (factoryId: string): Promise<Record<string, string[]>> => {
    const response = await apiClient.get<ApiResponse<Record<string, string[]>>>(
      `/api/mobile/${factoryId}/material-spec-config/system/defaults`
    );
    return response.data.data;
  },
};
```

### 完整使用示例

```typescript
// 示例1: 原材料批次录入页面
const MaterialBatchFormScreen: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [specConfigs, setSpecConfigs] = useState<Record<string, string[]>>({});
  const [formData, setFormData] = useState({
    materialName: '',
    category: '',
    specification: '',
    quantity: 0,
  });

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await materialSpecConfigApiClient.getAllSpecConfigs('CRETAS_2024_001');
        setSpecConfigs(configs);
        setCategories(Object.keys(configs));
      } catch (error) {
        Alert.alert('错误', '加载规格配置失败');
      }
    };

    loadConfigs();
  }, []);

  const handleCategoryChange = (category: string) => {
    setFormData({
      ...formData,
      category,
      specification: '', // 重置规格选择
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>原材料名称</Text>
      <TextInput
        value={formData.materialName}
        onChangeText={text => setFormData({ ...formData, materialName: text })}
        placeholder="输入原材料名称"
      />

      <Text style={styles.label}>类别</Text>
      <Picker
        selectedValue={formData.category}
        onValueChange={handleCategoryChange}
      >
        <Picker.Item label="请选择类别" value="" />
        {categories.map(category => (
          <Picker.Item key={category} label={category} value={category} />
        ))}
      </Picker>

      {formData.category && (
        <>
          <Text style={styles.label}>规格</Text>
          <Picker
            selectedValue={formData.specification}
            onValueChange={spec => setFormData({ ...formData, specification: spec })}
          >
            <Picker.Item label="请选择规格" value="" />
            {specConfigs[formData.category]?.map(spec => (
              <Picker.Item key={spec} label={spec} value={spec} />
            ))}
          </Picker>
        </>
      )}

      <Text style={styles.label}>数量（kg）</Text>
      <TextInput
        value={formData.quantity.toString()}
        onChangeText={text => setFormData({ ...formData, quantity: parseFloat(text) || 0 })}
        keyboardType="numeric"
        placeholder="输入数量"
      />

      <Button title="提交" onPress={handleSubmit} />
    </ScrollView>
  );
};

// 示例2: 规格配置管理页面
const SpecConfigManagementScreen: React.FC = () => {
  const [configs, setConfigs] = useState<Record<string, string[]>>({});
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadConfigs();
    loadDefaults();
  }, []);

  const loadConfigs = async () => {
    const data = await materialSpecConfigApiClient.getAllSpecConfigs('CRETAS_2024_001');
    setConfigs(data);
  };

  const loadDefaults = async () => {
    const data = await materialSpecConfigApiClient.getSystemDefaults('CRETAS_2024_001');
    setDefaults(data);
  };

  const isCustomized = (category: string): boolean => {
    return JSON.stringify(configs[category]) !== JSON.stringify(defaults[category]);
  };

  return (
    <FlatList
      data={Object.keys(configs)}
      keyExtractor={item => item}
      renderItem={({ item: category }) => (
        <Card>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryName}>{category}</Text>
            {isCustomized(category) && (
              <Badge>自定义</Badge>
            )}
          </View>

          <View style={styles.specList}>
            {configs[category]?.map(spec => (
              <Chip key={spec}>{spec}</Chip>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title="编辑"
              onPress={() => navigation.navigate('EditSpecConfig', { category })}
            />
            {isCustomized(category) && (
              <Button
                title="重置"
                color="orange"
                onPress={() => handleReset(category)}
              />
            )}
          </View>
        </Card>
      )}
    />
  );
};
```

---

## 错误处理

### 常见错误码

| 错误码 | HTTP状态码 | 说明 | 前端处理 |
|--------|-----------|------|---------|
| `EMPTY_SPECIFICATIONS` | 400 | 规格列表为空 | 提示用户至少添加一个规格 |
| `INVALID_CATEGORY` | 400 | 类别名称无效 | 提示并返回配置列表页 |
| `FACTORY_NOT_FOUND` | 404 | 工厂不存在 | 提示并返回首页 |

### 错误处理示例

```typescript
try {
  await materialSpecConfigApiClient.updateCategorySpecs(
    factoryId,
    category,
    specifications
  );
} catch (error) {
  if (error.code === 'EMPTY_SPECIFICATIONS') {
    Alert.alert('错误', '规格列表不能为空，请至少添加一个规格');
  } else if (error.code === 'INVALID_CATEGORY') {
    Alert.alert('错误', '类别名称无效');
  } else {
    Alert.alert('错误', '保存失败，请重试');
  }
}
```

---

## 测试建议

### 1. 单元测试

```java
// MaterialSpecConfigServiceTest.java
@SpringBootTest
class MaterialSpecConfigServiceTest {

    @Autowired
    private MaterialSpecConfigService specConfigService;

    @Test
    void testGetAllSpecConfigs_NoCustomConfig_ReturnsDefault() {
        String factoryId = "TEST_FACTORY_001";

        Map<String, List<String>> configs = specConfigService.getAllSpecConfigs(factoryId);

        assertNotNull(configs);
        assertEquals(9, configs.size());  // 9个默认类别
        assertTrue(configs.containsKey("海鲜"));
        assertEquals(7, configs.get("海鲜").size());
    }

    @Test
    void testUpdateCategorySpecs_Success() {
        String factoryId = "TEST_FACTORY_001";
        String category = "海鲜";
        List<String> customSpecs = Arrays.asList("整条", "切片", "自定义规格");

        specConfigService.updateCategorySpecs(factoryId, category, customSpecs);

        List<String> result = specConfigService.getSpecsByCategory(factoryId, category);
        assertEquals(3, result.size());
        assertTrue(result.contains("自定义规格"));
    }

    @Test
    void testResetToDefault_Success() {
        String factoryId = "TEST_FACTORY_001";
        String category = "海鲜";

        // 先设置自定义配置
        specConfigService.updateCategorySpecs(factoryId, category, Arrays.asList("自定义"));

        // 重置为默认
        List<String> defaultSpecs = specConfigService.resetToDefault(factoryId, category);

        assertNotNull(defaultSpecs);
        assertEquals(7, defaultSpecs.size());
        assertTrue(defaultSpecs.contains("整条"));
    }
}
```

### 2. 集成测试

```bash
#!/bin/bash
# test_spec_config_apis.sh

FACTORY_ID="CRETAS_2024_001"
BASE_URL="http://localhost:10010"
TOKEN="your_jwt_token"

# 1. 获取所有规格配置
echo "1. 获取所有规格配置"
curl -s -X GET \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/material-spec-config" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

# 2. 获取海鲜类别规格
echo "2. 获取海鲜类别规格"
curl -s -X GET \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/material-spec-config/海鲜" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

# 3. 更新海鲜类别规格
echo "3. 更新海鲜类别规格"
curl -s -X PUT \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/material-spec-config/海鲜" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "specifications": ["整条", "切片", "去骨切片", "三文鱼块", "鱼排", "虾仁"]
  }' | jq '.data'

# 4. 获取系统默认配置
echo "4. 获取系统默认配置"
curl -s -X GET \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/material-spec-config/system/defaults" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

# 5. 重置为默认配置
echo "5. 重置为默认配置"
curl -s -X DELETE \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/material-spec-config/海鲜" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

echo "✅ 所有测试完成"
```

### 3. 前端测试

```typescript
// __tests__/materialSpecConfigApiClient.test.ts
import { materialSpecConfigApiClient } from '@/services/api/materialSpecConfigApiClient';

describe('MaterialSpecConfigApiClient', () => {
  const factoryId = 'CRETAS_2024_001';

  it('should get all spec configs', async () => {
    const configs = await materialSpecConfigApiClient.getAllSpecConfigs(factoryId);

    expect(configs).toBeDefined();
    expect(Object.keys(configs).length).toBeGreaterThan(0);
    expect(configs['海鲜']).toBeDefined();
  });

  it('should get specs by category', async () => {
    const specs = await materialSpecConfigApiClient.getSpecsByCategory(factoryId, '海鲜');

    expect(specs).toBeInstanceOf(Array);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs).toContain('整条');
  });

  it('should update category specs', async () => {
    const customSpecs = ['整条', '切片', '自定义规格'];
    const result = await materialSpecConfigApiClient.updateCategorySpecs(
      factoryId,
      '海鲜',
      customSpecs
    );

    expect(result.category).toBe('海鲜');
    expect(result.specifications).toEqual(customSpecs);
  });
});
```

---

## 总结

**MaterialSpecConfigController** 提供了灵活的原材料规格配置管理功能：

1. **5个API端点**: 涵盖查询、更新、重置操作
2. **9个系统默认类别**: 海鲜、肉类、蔬菜、水果、粉类、米面、油类、调料、其他
3. **自定义配置**: 工厂可自定义每个类别的规格选项
4. **配置优先级**: 自定义配置 > 系统默认配置
5. **JSON存储**: 规格列表以JSON文本形式存储

**业务价值**:
- 标准化原材料规格管理
- 提升数据录入效率
- 减少人工输入错误
- 便于统计分析

**前端应用**:
- 原材料批次录入时的规格选择
- 规格配置管理界面
- 系统默认配置查看

---

**文档完成日期**: 2025-01-20
**端点覆盖**: 5/5 (100%)
**预估文档字数**: ~15,000 words
