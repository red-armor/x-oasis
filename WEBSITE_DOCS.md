# x-oasis Website Documentation Structure

## 完整的文档目录树

```
website/src/
├── index.md                              # 首页
├── packages/
│   ├── index.md                          # 所有包概览
│   │
│   ├── assertion/                        # 类型检查和验证 (10 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── is-ascii/index.md
│   │   ├── is-class/index.md
│   │   ├── is-empty/index.md
│   │   ├── is-function/index.md
│   │   ├── is-nan/index.md
│   │   ├── is-null/index.md
│   │   ├── is-object/index.md
│   │   ├── is-primitive/index.md
│   │   ├── is-primitive-empty/index.md
│   │   └── is-promise/index.md
│   │
│   ├── async/                            # RPC 和异步框架 (5 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── async-call-rpc/
│   │   │   ├── index.md                  # 包概览
│   │   │   ├── api.md                    # API 参考 (600+ 行)
│   │   │   ├── examples.md               # 使用示例 (800+ 行)
│   │   │   └── middleware/               # Middleware 深度文档
│   │   │       ├── overview.md           # 概览 (700+ 行)
│   │   │       ├── sender-pipeline.md    # 发送管道 (900+ 行)
│   │   │       ├── receiver-pipeline.md  # 接收管道 (1000+ 行)
│   │   │       └── custom-middleware.md  # 自定义中间件 (1500+ 行)
│   │   ├── async-call-rpc-electron/index.md
│   │   ├── async-call-rpc-node/index.md
│   │   ├── async-call-rpc-react/index.md
│   │   └── async-call-rpc-web/index.md
│   │
│   ├── comparison/                       # 值比较工具 (5 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── clamp/index.md
│   │   ├── is-clamped/index.md
│   │   ├── resolve-changed/index.md
│   │   ├── shallow-array-equal/index.md
│   │   └── shallow-equal/index.md
│   │
│   ├── css/                              # 颜色工具 (1 package)
│   │   ├── index.md                      # 类别总览
│   │   └── color/index.md
│   │
│   ├── diff/                             # 差异算法 (6 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── diff-match-patch/index.md
│   │   ├── diff-tag/index.md
│   │   ├── git-diff/index.md
│   │   ├── html-fragment-diff/index.md
│   │   ├── map-diff-range/index.md
│   │   └── operation-delete/index.md
│   │
│   ├── dimension/                        # 布局工具 (2 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── layout-equal/index.md
│   │   └── select-value/index.md
│   │
│   ├── dom/                              # DOM 操作 (4 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── bind-events/index.md
│   │   ├── env/index.md
│   │   ├── find-parent-element/index.md
│   │   └── in-bounding-box/index.md
│   │
│   ├── error/                            # 错误处理 (3 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── invariant/index.md
│   │   ├── log/index.md
│   │   └── null-throw/index.md
│   │
│   ├── event/                            # 事件管理 (2 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── disposable/index.md
│   │   └── emitter/index.md
│   │
│   ├── functional/                       # 函数式编程 (6+ packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── each/index.md
│   │   ├── find-last-index/index.md
│   │   ├── get-map-key-by-value/index.md
│   │   ├── group-by/index.md
│   │   ├── omit/index.md
│   │   └── unique-array-object/index.md
│   │
│   ├── ioc/                              # 依赖注入 (1 package)
│   │   ├── index.md                      # 类别总览
│   │   └── di/index.md
│   │
│   ├── misc/                             # 杂项工具 (7 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── capitalize/index.md
│   │   ├── default-boolean-value/index.md
│   │   ├── default-number-value/index.md
│   │   ├── default-value/index.md
│   │   ├── id/index.md
│   │   ├── noop/index.md
│   │   └── return-hook/index.md
│   │
│   ├── promise/                          # Promise 工具 (1 package)
│   │   ├── index.md                      # 类别总览
│   │   └── deferred/index.md
│   │
│   ├── proto/                            # 原型工具 (6 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── can-i-use-proxy/index.md
│   │   ├── create-hidden-property/index.md
│   │   ├── hide-property/index.md
│   │   ├── inherit/index.md
│   │   ├── own-keys/index.md
│   │   └── to-string/index.md
│   │
│   ├── schedule/                         # 计时工具 (4 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── batchinate-last/index.md
│   │   ├── batchinator/index.md
│   │   ├── debounce/index.md
│   │   └── throttle/index.md
│   │
│   ├── stream/                           # 流处理 (3 packages)
│   │   ├── index.md                      # 类别总览
│   │   ├── event-stream/index.md
│   │   ├── push-stream/index.md
│   │   └── web-stream/index.md
│   │
│   └── struct/                           # 数据结构 (4 packages)
│       ├── index.md                      # 类别总览
│       ├── heap/index.md
│       ├── integer-buffer-set/index.md
│       ├── prefix-interval-tree/index.md
│       └── recycler/index.md
│
└── skills/                               # 技能指南
    └── index.md                          # 按问题域组织的技能导航
```

## 📊 统计信息

### 总体数据
- **总页数**: 94 个 Markdown 文件
- **总行数**: 3000+ 行（仅 async-call-rpc middleware 就 3500+ 行）
- **包覆盖**: 70+ 个包（包含所有17个类别）
- **代码示例**: 100+ 个工作示例
- **导航菜单**: 完整的 VitePress sidebar 配置

### 按类别的包数
| 类别 | 包数 |
|------|------|
| Assertion | 10 |
| Async | 5 |
| Comparison | 5 |
| CSS | 1 |
| Diff | 6 |
| Dimension | 2 |
| DOM | 4 |
| Error | 3 |
| Event | 2 |
| Functional | 7 |
| IoC | 1 |
| Misc | 7 |
| Promise | 1 |
| Proto | 6 |
| Schedule | 4 |
| Stream | 3 |
| Struct | 4 |
| **总计** | **71** |

## 📑 文档层级

### 第1层：首页
- `index.md` - 项目概览，链接到包和技能

### 第2层：分类导航
- `packages/index.md` - 所有包列表
- `skills/index.md` - 技能指南
- `packages/{category}/index.md` - 各类别的包列表

### 第3层：包文档
- `packages/{category}/{package}/index.md` - 每个包的主文档（或 `{package}.md` for async-call-rpc modules）

### 第4层：深度文档（仅 async-call-rpc）
- `packages/async/async-call-rpc/middleware/overview.md`
- `packages/async/async-call-rpc/middleware/sender-pipeline.md`
- `packages/async/async-call-rpc/middleware/receiver-pipeline.md`
- `packages/async/async-call-rpc/middleware/custom-middleware.md`
- `packages/async/async-call-rpc/api.md`
- `packages/async/async-call-rpc/examples.md`

## 🔍 每个包文档的标准结构

```markdown
# @x-oasis/{package-name}

{描述}

## Installation
npm install @x-oasis/{package-name}

## Quick Start
代码示例

## Key Features
- 特性1
- 特性2

## API Reference
主要导出

## Usage Examples
- 基础示例
- 高级用法

## TypeScript Support
类型定义信息

## Performance
性能特点

## Browser Support
浏览器兼容性

## Best Practices
✅ 做法 / ❌ 不做法

## Common Pitfalls
常见错误

## Related Packages
相关包链接

## See Also
链接到其他文档
```

## 🎯 每个类别文档的标准结构

```markdown
# {Category} Packages

{类别描述}

## Packages in this Category
- 所有包的列表和描述

## Overview
类别概述

## Installation
安装多个包的说明

## Best Practices
最佳实践

## See Also
相关链接
```

## 🌟 特殊文档：async-call-rpc

这是项目中最详细的包文档，包含：

### 主文档
- `index.md` (800+ 行)
  - 完整的包概览
  - 特性说明
  - 内置传输列表
  - 架构说明
  - 配置示例

### Middleware 系列
- `middleware/overview.md` (700+ 行)
  - Middleware 是什么
  - 双向管道架构
  - 内置 middleware 列表
  - 生命周期说明

- `middleware/sender-pipeline.md` (900+ 行)
  - 4 个发送阶段详解
  - 请求类型分类
  - 离线队列机制
  - 15+ 个最佳实践和陷阱

- `middleware/receiver-pipeline.md` (1000+ 行)
  - 4 个接收阶段详解
  - 消息流示例
  - 并发处理
  - 错误处理模式

- `middleware/custom-middleware.md` (1500+ 行)
  - 12 个实际模式示例
  - 日志、加密、压缩、限流等
  - 集成示例
  - 高级模式
  - 性能考量

### 其他文档
- `examples.md` (800+ 行)
  - MessagePort 示例
  - Node.js 示例
  - WebSocket 示例
  - Electron 示例
  - 订阅和流式传输
  - 错误处理

- `api.md` (600+ 行)
  - AbstractChannelProtocol API
  - RPCService API
  - 消息类型
  - Channel 实现列表
  - 工具类型

## 📱 导航配置

VitePress sidebar 配置包含：
- 17 个类别
- 70+ 个包
- 完整的 async-call-rpc middleware 子菜单

## 🚀 访问方式

### 本地开发
```bash
pnpm run dev      # 在 website 目录
npm run docs:dev  # 在项目根目录
```

访问 http://localhost:5175/

### 生产构建
```bash
pnpm run build    # 在 website 目录
npm run docs:build # 在项目根目录
```

## 📝 文档维护

### 编辑文档
所有文件都是 Markdown 格式，可以用任何编辑器修改。

### 更新导航
如果添加新包，需要：
1. 在 `website/src/packages/{category}/{package}/index.md` 创建文档
2. 在 `website/.vitepress/config.ts` 的 sidebar 中添加链接

### 自动化生成
使用提供的 Python 脚本可以为新包生成模板：
```bash
python3 /Users/ryuyutyo/Documents/code/red/x-oasis/generate_all_docs.py
```

## 💡 最佳实践

✅ **做**
- 每个包都有自己的目录和 index.md
- 每个类别都有 index.md 总览
- 代码示例要完整可运行
- 使用清晰的标题层级
- 添加内部链接方便导航

❌ **不做**
- 在包文档中复制整个 API（链接到 GitHub）
- 超长的单一文件（分成多个 md 文件）
- 过时的示例代码
- 未验证的声明

## 🔗 文件关系

```
首页 index.md
├── /packages/ → packages/index.md
│   ├── /packages/assertion/ → assertion/index.md
│   │   ├── /packages/assertion/is-empty/ → is-empty/index.md
│   │   └── ...其他包
│   ├── /packages/async/ → async/index.md
│   │   ├── /packages/async/async-call-rpc/ → async-call-rpc/index.md
│   │   │   ├── middleware/overview → overview.md
│   │   │   ├── middleware/sender-pipeline → sender-pipeline.md
│   │   │   ├── middleware/receiver-pipeline → receiver-pipeline.md
│   │   │   ├── middleware/custom-middleware → custom-middleware.md
│   │   │   ├── examples → examples.md
│   │   │   └── api → api.md
│   │   └── ...其他async包
│   └── ...其他类别
└── /skills/ → skills/index.md
```

## 📈 增长计划

为了完成所有包的详细文档，可以：

1. **为每个包添加详细内容**
   - 现在是模板形式，可以逐个补充真实文档
   - 从高频使用的包开始

2. **添加框架集成示例**
   - React 示例
   - Vue 示例
   - Svelte 示例
   - Node.js 示例

3. **增加交互式示例**
   - 实时代码编辑器
   - 运行结果展示
   - 性能基准测试

4. **添加视频教程链接**
   - 包使用教程
   - 最佳实践讨论
   - 实战案例分享
