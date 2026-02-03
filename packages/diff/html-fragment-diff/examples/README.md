# Examples

这个目录包含 `@x-oasis/html-fragment-diff` 的交互式示例。

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
cd packages/diff/html-fragment-diff/examples
pnpm install
pnpm dev
```

或者从项目根目录运行：

```bash
pnpm install
cd packages/diff/html-fragment-diff/examples
pnpm dev
```

开发服务器将在 `http://localhost:3001` 启动，并自动在浏览器中打开。

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

1. **HTML 片段输入**: 并排显示原始片段和最终片段输入框
2. **解析结果**: 显示每个片段的解析结果（标签名、class 列表、文本内容等）
3. **Class 变更**: 显示新增和删除的 class
4. **文本变更**: 显示文本内容的变更情况
5. **JSON 输出**: 显示完整的对比结果 JSON

## 示例场景

### 场景 1: Class 新增

- Original: `<h1 class="title">Hello</h1>`
- Final: `<h1 class="title active">Hello</h1>`
- 说明: 演示 class 的新增，从 "title" 变为 "title active"

### 场景 2: Class 删除

- Original: `<h1 class="title primary">Hello</h1>`
- Final: `<h1 class="title">Hello</h1>`
- 说明: 演示 class 的删除，从 "title primary" 变为 "title"

### 场景 3: 文本变更

- Original: `<h1>Hello</h1>`
- Final: `<h1>World</h1>`
- 说明: 演示文本内容的变更

## 技术实现

示例使用：
- **Vite**: 快速的前端构建工具
- **React**: UI 框架
- **TypeScript**: 类型安全
- **@x-oasis/html-fragment-diff**: 核心库，提供 HTML 片段解析和对比功能
- **parse5**: HTML 解析库

## GitHub Pages 部署

示例已配置支持 GitHub Pages 部署。在 `vite.config.ts` 中：

- 支持 `GITHUB_PAGES` 环境变量
- 自动配置 base 路径
- 支持子路径部署

部署时设置环境变量：
- `GITHUB_PAGES=true`
- `GITHUB_REPOSITORY=owner/repo-name`
- `GITHUB_PAGES_PATH=html-fragment-diff`
