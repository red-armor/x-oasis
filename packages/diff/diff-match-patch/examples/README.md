# Examples

这个目录包含 `@x-oasis/diff-match-patch` 的交互式示例。

## 运行示例

### 方法 1: 直接在浏览器中打开

直接在浏览器中打开 `index.html` 文件即可。

### 方法 2: 使用本地服务器

如果你使用 Python:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

然后访问 `http://localhost:8000`

如果你使用 Node.js:

```bash
npx http-server -p 8000
```

然后访问 `http://localhost:8000`

## 功能说明

示例页面包含以下功能：

1. **文件对比**: 并排显示原始文件和修改后的文件
2. **差异可视化**: 使用颜色编码显示差异
   - 绿色: 新增的内容 (INSERT)
   - 红色: 删除的内容 (DELETE)
   - 灰色: 相同的内容 (EQUAL)
3. **恢复操作**:
   - 输入 offset range (startOffset, endOffset)
   - 点击"恢复"按钮将指定范围恢复到原始版本
   - 显示详细的调试信息
4. **快速示例**: 提供预设的 offset range 按钮，快速测试不同场景

## 示例场景

### 场景 1: 恢复 "禁用" → "禁用按钮"

- startOffset: 1512
- endOffset: 1514
- 说明: 将 codev2.vue 中的 "禁用" 恢复为 code.vue 中的 "禁用按钮"

### 场景 2: 恢复整个按钮区域

- startOffset: 1416
- endOffset: 1512
- 说明: 恢复包含按钮的整个区域

## 技术实现

示例使用：
- `diff-match-patch` (通过 CDN 引入)
- 纯 JavaScript 实现 `FileRestoreManager` 的核心逻辑
- 无需构建步骤，可直接在浏览器中运行
