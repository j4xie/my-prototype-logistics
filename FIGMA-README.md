# Figma API 工具

此工具包提供了访问Figma API的简单方法，使您能够从Figma设计文件中检索各种数据。

## 准备工作

1. **配置环境变量**:
   - 确保你有一个有效的Figma访问令牌
   - 在`.env`文件中设置`FIGMA_TOKEN`
   - 请从Figma账户设置中获取你的个人访问令牌

2. **安装依赖**:
   ```bash
   npm install axios dotenv
   ```

## 使用方法

### 运行示例脚本

```bash
node figma-example.js YOUR_FIGMA_FILE_ID
```

将`YOUR_FIGMA_FILE_ID`替换为你要访问的Figma文件ID。文件ID可以从Figma文件URL中获取，例如：
`https://www.figma.com/file/abcd1234/DesignSystem` 中的 `abcd1234` 就是文件ID。

### 在你的代码中使用

```javascript
const figmaTools = require('./figma-tools');

async function example() {
  // 获取文件信息
  const fileInfo = await figmaTools.getFile('YOUR_FIGMA_FILE_ID');
  console.log(fileInfo.name);
  
  // 获取特定节点
  const nodes = await figmaTools.getFileNodes('YOUR_FIGMA_FILE_ID', 'NODE_ID');
  console.log(nodes);
  
  // 获取组件
  const components = await figmaTools.getFileComponents('YOUR_FIGMA_FILE_ID');
  console.log(components);
}

example();
```

## 可用函数

工具包提供以下功能：

- `getFile(fileId)` - 获取文件信息
- `getFileNodes(fileId, nodeIds)` - 获取特定节点信息
- `getFileComponents(fileId)` - 获取文件组件
- `getImageFills(fileId, format, scale)` - 获取图像填充
- `getComments(fileId)` - 获取文件评论
- `postComment(fileId, message, clientMeta, parentId)` - 发布评论

## 示例

查看 `figma-example.js` 文件，了解完整的使用示例。

## 提示

- 保持访问令牌的安全，不要在公共仓库中提交
- Figma API有速率限制，请避免过于频繁的调用
- 如果出现权限错误，请确保你有权访问目标文件 