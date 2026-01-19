# HTML 转 PDF 指南

## 方法一：使用浏览器（推荐 - 最简单）

### Safari / Chrome / Edge

1. **打开 index.html**
   - 在浏览器中打开文件：`file:///Users/jietaoxie/my-prototype-logistics/platform/index.html`
   
2. **打印为 PDF**
   - macOS: `Cmd + P` → 选择"另存为 PDF"
   - 设置：
     - 页面大小：A4
     - 边距：默认或自定义
     - 背景图形：✅ 启用（保留样式）

3. **保存**
   - 另存为：`index.pdf`

4. **重复步骤**
   - 对 `dashboard.html` 执行相同操作
   - 另存为：`dashboard.pdf`

---

## 方法二：使用 CLI 工具（需安装）

### 安装 wkhtmltopdf

```bash
brew install wkhtmltopdf
```

### 转换命令

```bash
cd /Users/jietaoxie/my-prototype-logistics/platform

# 转换 index.html
wkhtmltopdf --enable-local-file-access \
  --print-media-type \
  --no-stop-slow-scripts \
  index.html index.pdf

# 转换 dashboard.html  
wkhtmltopdf --enable-local-file-access \
  --print-media-type \
  --no-stop-slow-scripts \
  dashboard.html dashboard.pdf
```

---

## 方法三：在线转换

1. 访问：https://cloudconvert.com/html-to-pdf
2. 上传 `index.html` 和 `dashboard.html`
3. 下载生成的 PDF

---

## 预期输出

- `platform/index.pdf` - 首页 PDF
- `platform/dashboard.pdf` - Dashboard PDF
