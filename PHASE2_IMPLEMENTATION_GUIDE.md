# Phase 2: 原料选择器快捷添加功能 - 实施指南

## 🎯 目标
在MaterialTypeSelector底部添加"添加新原料"功能，让用户可以在选择原料时快速创建新的原料类型。

---

## 📝 修改清单

### 文件: `src/components/processing/MaterialTypeSelector.tsx`

#### 1. 添加import（文件顶部）
```typescript
import { Alert } from 'react-native';  // 添加Alert
import { SegmentedButtons } from 'react-native-paper';  // 添加SegmentedButtons
```

#### 2. 添加状态（第28行后）
```typescript
// 快捷添加功能状态
const [showAddForm, setShowAddForm] = useState(false);
const [newMaterialName, setNewMaterialName] = useState('');
const [newMaterialCategory, setNewMaterialCategory] = useState('鱼类');
const [creating, setCreating] = useState(false);
```

#### 3. 添加创建函数（第58行后，handleSelect函数后）
```typescript
const handleCreateMaterial = async () => {
  if (!newMaterialName.trim()) {
    Alert.alert('验证错误', '请输入原料名称');
    return;
  }

  try {
    setCreating(true);

    await materialAPI.createMaterialType({
      name: newMaterialName.trim(),
      category: newMaterialCategory,
      unit: 'kg',
    });

    console.log('✅ Material type created:', newMaterialName);

    // 刷新列表
    await fetchMaterialTypes();

    // 自动选中新创建的原料
    onSelect(newMaterialName.trim());

    // 关闭弹窗
    setShowAddForm(false);
    setModalVisible(false);

    // 清空表单
    setNewMaterialName('');
    setNewMaterialCategory('鱼类');
  } catch (error: any) {
    console.error('❌ Failed to create material:', error);
    Alert.alert('创建失败', error.response?.data?.message || error.message || '请重试');
  } finally {
    setCreating(false);
  }
};
```

#### 4. 更新FlatList添加ListFooterComponent（替换第101-123行的FlatList）

```tsx
<FlatList
  data={filteredMaterials}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <>
      <List.Item
        title={item.name}
        description={item.category}
        onPress={() => handleSelect(item.name)}
        right={props => value === item.name ? <List.Icon {...props} icon="check" color="#2196F3" /> : null}
      />
      <Divider />
    </>
  )}
  ListEmptyComponent={
    <View style={styles.emptyContainer}>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {searchQuery ? '未找到匹配的原料类型' : '暂无原料类型'}
      </Text>
    </View>
  }
  ListFooterComponent={
    !showAddForm ? (
      // 添加按钮
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddForm(true)}
      >
        <Text style={styles.addButtonText}>➕ 找不到？点击添加新原料类型</Text>
      </TouchableOpacity>
    ) : (
      // 创建表单
      <View style={styles.addForm}>
        <Text variant="titleMedium" style={styles.formTitle}>添加新原料</Text>

        <TextInput
          label="原料名称 *"
          value={newMaterialName}
          onChangeText={setNewMaterialName}
          mode="outlined"
          placeholder="例如: 黄鱼"
          style={styles.formInput}
          autoFocus
        />

        <Text variant="bodySmall" style={styles.formLabel}>分类</Text>
        <SegmentedButtons
          value={newMaterialCategory}
          onValueChange={setNewMaterialCategory}
          buttons={[
            { value: '鱼类', label: '鱼类' },
            { value: '虾蟹类', label: '虾蟹' },
            { value: '贝类', label: '贝类' },
            { value: '头足类', label: '头足' },
            { value: '其他', label: '其他' },
          ]}
          style={styles.formSegment}
        />

        <View style={styles.formActions}>
          <Button
            mode="outlined"
            onPress={() => {
              setShowAddForm(false);
              setNewMaterialName('');
            }}
            disabled={creating}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleCreateMaterial}
            loading={creating}
            disabled={creating}
          >
            保存
          </Button>
        </View>
      </View>
    )
  }
/>
```

#### 5. 添加样式（styles对象中添加）

```typescript
addButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  marginTop: 8,
  marginBottom: 8,
  marginHorizontal: 16,
  backgroundColor: '#E3F2FD',
  borderRadius: 8,
},
addButtonText: {
  color: '#2196F3',
  fontSize: 14,
  fontWeight: '500',
},
addForm: {
  padding: 16,
  backgroundColor: '#F5F5F5',
  borderTopWidth: 1,
  borderTopColor: '#E0E0E0',
  marginTop: 8,
},
formTitle: {
  marginBottom: 16,
  fontWeight: '600',
},
formLabel: {
  color: '#757575',
  marginBottom: 8,
  marginTop: 8,
},
formInput: {
  marginBottom: 12,
},
formSegment: {
  marginBottom: 16,
},
formActions: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 8,
},
```

---

## ✅ 实施步骤

1. 打开 `frontend/src/components/processing/MaterialTypeSelector.tsx`
2. 按照上面的代码分5步依次修改
3. 保存文件，应用会自动热重载
4. 测试功能

---

## 🧪 测试步骤

1. 进入原料入库页面
2. 点击"原料类型"
3. 滚动到底部，看到"➕ 找不到？点击添加新原料类型"
4. 点击按钮，表单展开
5. 填写原料名称："黄鱼"
6. 选择分类："鱼类"
7. 点击"保存"
8. 应该看到成功提示
9. 列表刷新，"黄鱼"出现
10. "黄鱼"被自动选中，弹窗关闭
11. 原料入库表单显示"黄鱼"

---

**所有代码已准备好，请按照指南修改MaterialTypeSelector.tsx文件！**
