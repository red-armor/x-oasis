# Renderer Acquire Main Port Example

一个展示如何在 Electron 中从 renderer 进程获取 main 进程端口的示例项目。

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run dev
```

## 配置说明

### 热刷新支持

此项目配置了完整的热刷新支持，使得在修改 `@x-oasis/*` 包的源代码时能够实时刷新：

#### 1. 动态别名解析 (`resolve-aliases.ts`)

`resolve-aliases.ts` 文件实现了动态别名解析逻辑：

- 自动扫描所有 `@x-oasis/*` 包
- 如果包存在 `src/index.ts` 但没有 `dist` 目录，则指向源文件
- 否则使用 node_modules 中的编译版本

**优点**：
- 无需手动维护别名列表
- 自动适应新增的包
- 开发时始终使用源代码，支持热刷新

#### 2. 文件监听配置

在 `electron.vite.config.ts` 中配置了 `server.watch` 选项：

```typescript
server: {
  watch: {
    ignored: ['!**/node_modules/@x-oasis/**'],
  },
}
```

这告诉 Vite 不要忽略 `node_modules` 中 `@x-oasis` 包的文件变更，从而启用热刷新。

#### 3. 依赖排除配置

`externalizeDepsPlugin` 的 `exclude` 列表自动包含所有未编译的 `@x-oasis` 包，这样它们会被 Vite 处理而不是被视为外部依赖。

### 工作流程

1. **修改 `@x-oasis/async-call-rpc` 的源代码**
   - 在 `packages/async/async-call-rpc/src/**` 中修改文件
   
2. **自动热刷新**
   - Vite 检测到文件变更
   - Renderer 进程自动刷新
   - Main/Preload 进程自动重启

3. **无需重启开发服务器**
   - `npm run dev` 保持运行
   - 所有变更实时生效

## 构建

```bash
npm run build
```

## 预览构建后的应用

```bash
npm run preview
```

## 注意事项

- 确保 `@x-oasis` 的各个包都在 monorepo workspace 中
- 首次运行前确保已执行 `pnpm install`（在项目根目录）
- 如果添加了新的 `@x-oasis` 包，无需修改配置，动态解析会自动处理
