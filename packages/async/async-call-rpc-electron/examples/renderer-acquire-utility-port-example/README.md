# Renderer ↔ Utility Port Example

Electron 三进程（main / renderer / utility）之间通过 `@x-oasis/async-call-rpc` 建立 RPC 通道，并由 main 进程作为 broker 中转 `MessagePortMain`，使 renderer 与 utility 建立**直连 RPC 通道**的完整示例。

## 架构总览

```
┌─────────────────────┐          ┌─────────────────────┐
│   Renderer Process  │          │   Utility Process    │
│                     │          │                      │
│  IPCRendererChannel │          │ ElectronUtilityProc  │
│  (renderer→main)    │          │ essChannel           │
│         │           │          │ (utility→main)       │
│         │           │          │         │            │
└─────────┼───────────┘          └─────────┼────────────┘
          │         IPC / Process IPC      │
          ▼                                ▼
┌──────────────────────────────────────────────────────┐
│                    Main Process                      │
│                                                      │
│   IPCMainChannel              ElectronUtilityProcess │
│   (main→renderer)             Channel (main→utility) │
│        │                              │              │
│        │     ┌──────────────────┐     │              │
│        └────►│  Port Broker     │◄────┘              │
│              │                  │                    │
│              │ acquireUtility   │                    │
│              │   Port()         │                    │
│              │ acquireRenderer  │                    │
│              │   Port()         │                    │
│              └──────────────────┘                    │
└──────────────────────────────────────────────────────┘

         ▲  port pair 建立后  ▼

┌─────────────────────┐          ┌─────────────────────┐
│   Renderer Process  │          │   Utility Process    │
│                     │          │                      │
│  RPCMessageChannel  │◄────────►│ ElectronMessagePort  │
│  (@x-oasis/async-   │  Direct  │ MainChannel          │
│   call-rpc-web)     │MessagePort(@x-oasis/async-     │
│                     │  Channel │  call-rpc-electron)  │
│  Full RPC support:  │          │  Full RPC support:   │
│  service + client   │          │  service + client    │
└─────────────────────┘          └─────────────────────┘
```

## 数据流

### 阶段 1: RPC 基础通道建立

应用启动时，main 进程分别与 renderer、utility 建立 RPC 通道：

```
renderer ◄──IPCMainChannel / IPCRendererChannel──► main
main     ◄──ElectronUtilityProcessChannel────────► utility
```

这两条通道用于 **协调控制**（请求 port、分配 port 等），不直接承载业务数据。

### 阶段 2: Port 获取与分发

两条对称的 port 获取路径，每条路径都由 main 创建 `MessageChannelMain` 生成 port pair：

#### 路径 A: `acquireRendererPort`（utility 发起）

```
utility                       main                        renderer
  │                             │                            │
  │  mainClient                 │                            │
  │   .acquireRendererPort() ──►│                            │
  │                             │ new MessageChannelMain()   │
  │                             │ {port1, port2}             │
  │                             │                            │
  │                             │  rendererClient            │
  │                             │   .assignUtilityPort(port2)│
  │                             │ ──────────────────────────►│
  │                             │                            │ utilityInitiatedChannel
  │◄── return [port1] ─────────│                            │  .bindPort(port2)
  │                             │                            │
  │ utilityInitiatedChannel     │                            │
  │  .bindPort(port1)           │                            │
  │                             │                            │
  ╰─────── port1 ◄══ direct MessagePort channel ══► port2 ──╯
```

#### 路径 B: `acquireUtilityPort`（renderer 发起）

```
renderer                      main                        utility
  │                             │                            │
  │  api                        │                            │
  │   .acquireUtilityPort() ───►│                            │
  │                             │ new MessageChannelMain()   │
  │                             │ {port1, port2}             │
  │                             │                            │
  │                             │  utilityClient             │
  │                             │   .assignRendererPort(port2)│
  │                             │ ──────────────────────────►│
  │                             │                            │ rendererInitiatedChannel
  │◄── return [port1] ─────────│                            │  .bindPort(port2)
  │                             │                            │
  │ rendererInitiatedChannel    │                            │
  │  .bindPort(port1)           │                            │
  │                             │                            │
  ╰─────── port1 ◄══ direct MessagePort channel ══► port2 ──╯
```

### 阶段 3: 直连 RPC

port 绑定后，renderer 与 utility 之间形成 **两条独立的直连 RPC 通道**，不再经过 main 进程中转：

```
                  路径 A (utility-initiated)
renderer ◄════════════════════════════════════► utility
  RPCMessageChannel                  ElectronMessagePortMainChannel
  service: renderer-direct-from-     service: utility-direct-from-
           utility                            utility
  (greet handler)                    (echo handler)

                  路径 B (renderer-initiated)
renderer ◄════════════════════════════════════► utility
  RPCMessageChannel                  ElectronMessagePortMainChannel
  service: renderer-direct-from-     service: utility-direct-from-
           renderer                           renderer
  (hello handler)                    (ping handler)
```

每条通道都是完整的 RPC channel，支持：

- `serviceHost.registerService()` 注册 handler
- `clientHost.registerClient().createProxy()` 创建代理调用

## 文件结构

```
renderer-acquire-utility-port-example/
├── main.ts                 # Main 进程 — port broker
├── preload.ts              # Renderer preload — RPCMessageChannel
├── utility-worker.ts       # Utility 进程 — ElectronMessagePortMainChannel
├── electron.vite.config.ts # 构建配置（三进程分离构建）
├── resolve-aliases.ts      # @x-oasis/* 源码别名自动解析
├── index.html              # Renderer 入口
└── src/
    └── App.tsx             # React 组件
```

## 使用的 Channel 类型

| 位置                   | Channel 类                       | 包                        | 用途                                |
| ---------------------- | -------------------------------- | ------------------------- | ----------------------------------- |
| main → renderer        | `IPCMainChannel`                 | `async-call-rpc-electron` | 控制通道（IPC）                     |
| renderer → main        | `IPCRendererChannel`             | `async-call-rpc-electron` | 控制通道（IPC）                     |
| main → utility         | `ElectronUtilityProcessChannel`  | `async-call-rpc-electron` | 控制通道（process IPC）             |
| utility (direct port)  | `ElectronMessagePortMainChannel` | `async-call-rpc-electron` | 直连数据通道（Node.js MessagePort） |
| renderer (direct port) | `RPCMessageChannel`              | `async-call-rpc-web`      | 直连数据通道（Web MessagePort）     |

## 快速开始

```bash
# 在 monorepo 根目录安装依赖
pnpm install

# 进入示例目录
cd packages/async/async-call-rpc-electron/examples/renderer-acquire-utility-port-example

# 开发模式
npm run dev

# 生产构建
npm run build
```

## 运行验证

启动后在终端和 DevTools console 中应看到：

```
[main]     All services registered, waiting for port requests...
[main]     acquireRendererPort: utility requested a port to renderer
[main]     acquireUtilityPort: renderer requested a port to utility
[utility]  acquireRendererPort: binding port for RPC
[utility]  assignRendererPort: binding port for RPC
[renderer] acquireUtilityPort: binding port for RPC
[renderer] assignUtilityPort: binding port for RPC
[utility]  ✅ direct RPC to renderer (utility-initiated): greeting from renderer: ...
[renderer] ✅ direct RPC to utility (renderer-initiated): pong from utility: ...
```

## 配置说明

### 构建配置 (`electron.vite.config.ts`)

三进程分离构建，确保 preload 和 utility-worker 代码互不污染：

- **main**: 单入口 `main.ts` → `out/main/main-process.js`
- **preload**: 单入口 `preload.ts` → `out/preload/preload.js`（无 code splitting）
- **utility-worker**: 通过 Vite 插件 `closeBundle` 在 preload 构建后独立构建 → `out/preload/utility-worker.js`
- **renderer**: Vite + React → `out/renderer/`

### 热刷新支持

- `resolve-aliases.ts` 自动扫描所有 `@x-oasis/*` 包，指向源码 `src/index.ts`
- `server.watch.ignored` 配置确保 `node_modules/@x-oasis` 下的文件变更触发热刷新
- 修改 `@x-oasis/*` 源码后无需重启 dev server

## 注意事项

- Electron utility process 中的 `MessagePort` 使用 Node.js `EventEmitter` API（`port.on`），与 renderer 中的 Web `MessagePort`（`addEventListener`）不同。`ElectronMessagePortMainChannel` 和 `RPCMessageChannel` 分别封装了这两种差异。
- 每个入口必须独立构建，不能共享 Rollup chunk — Electron sandbox 的 `require` 无法加载 chunk 文件。
