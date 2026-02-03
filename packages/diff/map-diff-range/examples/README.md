# Examples

这个目录包含 `@x-oasis/map-diff-range` 的交互式示例。

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
cd packages/diff/map-diff-range/examples
pnpm install
pnpm dev
```

或者从项目根目录运行：

```bash
pnpm install
cd packages/diff/map-diff-range/examples
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

1. **三路文件输入**: 并排显示原始文件、当前文件和最终文件内容
2. **Range 输入**: 输入当前文件中发生变更的 offset range（startOffset/endOffset）
3. **Range 映射**: 自动计算并显示：
   - Original Range：原始文件中对应的 range
   - Final Range：最终文件中对应的 range
4. **片段提取**: 显示从原始文件和最终文件中提取的对应片段
5. **变更分析**: 显示详细的变更分析：
   - 变更类型（equal、onlyDeletion、onlyInsertion、replacement）
   - 变更摘要（语义化描述）
   - 详细 diff 条目（带颜色编码）
6. **快速示例**: 提供预设的测试场景按钮，快速测试不同场景

## 示例场景

### 场景 1: Class 属性变更

- Original: `<h1 class="title">Name</h1>`
- Current: `<h1 class="title text-xl">Name</h1>`
- Final: `<h1 class="text-xl font-bold">Name</h1>`
- Range: startOffset: 4, endOffset: 30
- 说明: 演示 class 属性的变更，从 "title" 变为 "text-xl font-bold"

### 场景 2: 文本替换

- Original: `Hello World`
- Current: `Hello Beautiful World`
- Final: `Hello Amazing World`
- Range: startOffset: 6, endOffset: 15
- 说明: 演示文本的替换，从 "Beautiful" 变为 "Amazing"

### 场景 3: 单词替换

- Original: `The quick brown fox`
- Current: `The fast brown fox`
- Final: `The slow brown fox`
- Range: startOffset: 4, endOffset: 8
- 说明: 演示单词的替换，从 "quick" → "fast" → "slow"

## 技术实现

示例使用：
- **Vite**: 快速的前端构建工具
- **React**: UI 框架
- **TypeScript**: 类型安全
- **@x-oasis/map-diff-range**: 核心库，提供 range 映射和变更分析功能
- **diff-match-patch**: 差异计算库

## GitHub Pages 部署

示例已配置支持 GitHub Pages 部署。在 `vite.config.ts` 中：

- 支持 `GITHUB_PAGES` 环境变量
- 自动配置 base 路径
- 支持子路径部署

部署时设置环境变量：
- `GITHUB_PAGES=true`
- `GITHUB_REPOSITORY=owner/repo-name`
- `GITHUB_PAGES_PATH=map-diff-range`
