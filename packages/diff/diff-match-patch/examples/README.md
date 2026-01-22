# Examples

这个目录包含 `@x-oasis/diff-match-patch` 的交互式示例。

## 运行示例

这是一个基于 Vite + React 的项目。

### 安装依赖

在项目根目录运行：

```bash
pnpm install
```

### 启动开发服务器

在 `examples` 目录下运行：

```bash
cd packages/diff/diff-match-patch/examples
pnpm install
pnpm dev
```

或者从项目根目录运行：

```bash
pnpm install
cd packages/diff/diff-match-patch/examples
pnpm dev
```

开发服务器将在 `http://localhost:3000` 启动，并自动在浏览器中打开。

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

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
- **Vite**: 快速的前端构建工具
- **React**: UI 框架
- **TypeScript**: 类型安全
- **@x-oasis/diff-match-patch**: 核心库，提供 `FileRestoreManager` 类
- **diff-match-patch**: 差异计算库
- **@git-diff-view/react**: 差异可视化组件（样式）
