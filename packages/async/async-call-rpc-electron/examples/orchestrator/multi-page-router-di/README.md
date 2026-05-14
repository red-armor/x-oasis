# Multi-Page Router DI Example

Electron 多进程 + 多 pagelet（多 utility process 承载独立 React 页面）+ DI 容器
+ ConnectionOrchestrator 撮合的端到端示例。本 demo 是 `@x-oasis/async-call-rpc-electron`
的最复杂场景，目标覆盖：

- **多 pagelet**：每个业务页面（`connection` / `monitor` / `setting`）跑在独立的
  utility process 里，main 进程只承载 BrowserWindow + 控制平面
- **ConnectionOrchestrator**：参与者（main / daemon / shared / pagelet × N）通过 main
  hub 撮合后建立 P↔P 直连 RPC，业务流量不经 main 转发
- **UtilityProcessSupervisor**：daemon / shared / 每个 pagelet 都由独立 supervisor
  托管，崩溃自动重启 + restart history + 健康度 inspector snapshot
- **DI**：用 `@x-oasis/di` 在每个进程内组装服务

## 进程拓扑

```
                       ┌──────────────────────────┐
                       │   Main Process (broker)   │
                       │                           │
                       │  • BrowserWindow          │
                       │  • MainCpServer           │
                       │  • SupervisorRegistry:    │
                       │    DaemonProcess          │
                       │    SharedProcess          │
                       │    PageletProcess × N     │
                       └─┬─────┬──────────────┬────┘
                         │     │              │
            ┌────────────┘     │              └──────────────┐
            ▼                  ▼                              ▼
   ┌───────────────┐   ┌───────────────┐         ┌─────────────────────┐
   │ Daemon UP     │   │ Shared UP     │         │ Pagelet UPs:        │
   │ (diagnostics, │   │ (cross-page   │         │ • connection        │
   │  metrics)     │   │  state)       │         │ • monitor           │
   │               │   │               │         │ • setting           │
   └───────┬───────┘   └───────┬───────┘         └──────────┬──────────┘
           │                   │                            │
           │  ConnectionOrchestrator (control plane via main)
           │                   │                            │
           └────────── P↔P direct RPC channels ─────────────┘
                  (entangled MessagePort, no main-process forwarding)
```

| Participant       | 进程类型         | 职责                                          |
| ----------------- | ---------------- | --------------------------------------------- |
| `main`            | Electron main    | BrowserWindow、orchestrator hub、supervisor   |
| `daemon`          | Utility process  | 性能采样 + supervisor 快照聚合 → monitor      |
| `shared`          | Utility process  | 跨 pagelet 共享配置（echo / get / setConfig） |
| `connection`      | Utility process  | 演示 P↔P RPC 的 pagelet                       |
| `monitor`         | Utility process  | 渲染 ProcessesTable + SupervisorsPanel        |
| `setting`         | Utility process  | 独立窗口的设置页（多 BrowserWindow 演示）     |

## 文件结构（关键路径）

```
src/
├── apps/
│   ├── main/                      # main process — 应用启动、orchestrator hub
│   │   └── application/electron-main/
│   │       ├── AppApplication.ts  # 聚合 daemon/shared/pagelet supervisor 快照
│   │       └── MainCpServer.ts    # MainCpServer / orchestrator 注册
│   ├── daemon/                    # daemon utility process — 性能采样 + 快照聚合
│   │   ├── application/electron-main/DaemonProcess.ts   # supervisor 实例化点
│   │   └── diagnostics/                                  # MonitorSnapshot 跨进程契约
│   ├── shared/                    # shared utility process — 跨 pagelet 配置中心
│   │   └── application/electron-main/SharedProcess.ts   # supervisor 实例化点
│   ├── connection/                # connection pagelet — P↔P RPC 演示
│   ├── monitor/                   # monitor pagelet — UI 入口
│   │   └── application/browser/components/SupervisorsPanel.tsx
│   └── setting/                   # setting pagelet — 多窗口
└── services/
    ├── pagelet-host/              # pagelet 通用 host
    │   ├── electron-main/PageletProcess.ts  # supervisor 实例化点（pagelet 用）
    │   └── node/PageletWorker.ts            # 基类，含 connectToPeer / onPeerConnection
    └── main-metrics/              # main 进程的 pid → name 映射注册表
```

三个 supervisor 实例化点（`DaemonProcess.ts` / `SharedProcess.ts` /
`PageletProcess.ts`）都使用相同的 `restartPolicy` 配置，见下文 [Supervisor 配置](#supervisor-配置)。

## 快速开始

```bash
# monorepo 根目录
pnpm install

# 进入 demo
cd packages/async/async-call-rpc-electron/examples/orchestrator/multi-page-router-di

# 开发模式（必须在 TTY 中运行 — electron-vite 在 nohup 下会立即退出）
pnpm dev
```

启动后会弹出主窗口（默认进入 monitor pagelet），可在侧栏切换到 `connection` /
`setting`。Setting pagelet 会拉起独立 BrowserWindow。

## 验证 Supervisor 自动重启

这是验证 §3.D 健康度字段 + supervisor 行为的核心流程。

### 准备

1. 启动 demo（`pnpm dev`）
2. 进入 monitor pagelet，找到 **Supervisors** 面板
3. 等所有卡片显示 `RUNNING`（emerald 绿色 badge）
4. 注意每张卡片下方的三列健康度行：
   - `CHANNEL READY` —— 距离最近一次 channel ready 的相对时间（`5s ago`）
   - `READINESS PROBE` —— firstMessage 模式下的最近 probe 时间；spawn 模式下显示 `n/a`
   - `PROBE FAILURES` —— 连续 probe 失败次数，> 0 时变 rose 玫红色

### 触发崩溃 → 重启

1. 在另一个终端找出某个 utility process 的 pid：

   ```bash
   ps aux | grep -i 'multi-page-router-di' | grep -v grep
   ```

   或者直接看 `Processes` 面板里的 pid 列。

2. 强杀（`-9` 模拟硬崩，supervisor 必须自动恢复）：

   ```bash
   kill -9 <pid>
   ```

3. 在 SupervisorsPanel 中**预期看到**：
   - 该 supervisor 的 state badge 从 `RUNNING` (emerald)
     → **`RESTARTING`** (amber 琥珀色) → **`RUNNING`** (emerald)
   - `restart count` stat 从 0 变成 1
   - `CHANNEL READY` 时间戳跳回 `0s ago`（重新 ready 了）
   - `Recent restarts` 区域多一条新 entry，状态显示为 **success**（绿色），
     `pid <旧pid> → <新pid>`

### 触发重复崩溃 → 累计

连续多次 `kill -9 <new pid>`，可观察：

- `restart count` 持续递增（受 `maxRetries: 10` 上限）
- `Recent restarts` 列表保留最近 5 条（已 reverse，最新在顶部）
- 重启间隔随次数指数退避（500ms × 2^n，capped at 5s + jitter）

### 触发 maxRetries → failed

如果在 5 分钟窗口内连续 kill 11 次（默认 `maxElapsedMs: 300_000`），
`ExponentialBackoffPolicy.nextRetryDelayMs` 会返回 null，supervisor 进入
**`FAILED`** 状态（rose 红色 badge），`Recent restarts` 最后一条会显示 `failed`。
此时 supervisor 不会再尝试，需重启 demo 才能恢复。

> ⚠️ 如果 kill 后**没有进入 `restarting`，而是直接 `failed`**：检查
> `DaemonProcess.ts` / `SharedProcess.ts` / `PageletProcess.ts` 是否传了
> `restartPolicy`。没传 policy 时 supervisor 会按 "no restartPolicy → failed"
> 直接终止（见 `UtilityProcessSupervisor.ts:762-764`）。

## Supervisor 配置

三处 supervisor 实例化点统一使用：

```typescript
restartPolicy: new ExponentialBackoffPolicy({
  initialDelayMs: 500,    // 首次重启延迟，让 restarting 状态肉眼可见
  maxDelayMs: 5_000,      // 上限，避免后续重启等太久看不出效果
  maxRetries: 10,         // 防 demo 中失控循环
}),
```

`ExponentialBackoffPolicy` 默认 `jitterFactor: 0.3`（full jitter，区间
`[-30%, +30%]`），无需额外配置即可避免 thundering herd。`maxElapsedMs`
默认 5 分钟未配置；超过则同样 give up → failed。

生产配置应根据业务调整 — 例如长跑后端服务可能需要更大的 `maxDelayMs` 和
`maxElapsedMs`，或完全不设 `maxRetries`（默认 Infinity）。

## 验证 P↔P 直连 RPC

monitor pagelet 还演示了 [D-006 Gap 1 Forwarding Proxy 验证](../../../../../codebase-wiki/discussion/20260508-x-oasis-orchestrator-capability-gaps.md)
（在源仓的 wiki 里）的 P↔P 能力：

1. 切到 `Connection` pagelet
2. 点击 "Call Setting Peer Info" 按钮
3. 终端会打印 `connection ↔ setting` 的 P↔P RPC 调用，且在 monitor pagelet 的
   `ConnectionStats` 区域可看到一条新建立的 entangled-port connection

详见 `src/services/pagelet-host/node/PageletWorker.ts` 的 `connectToPeer()` 实现，
和 `src/apps/connection/application/node/ConnectionWorker.ts` 的 handler 调用点。

## 已知问题

- `pnpm exec tsc --noEmit` 当前有若干 baseline 错误（`isolatedModules` +
  `emitDecoratorMetadata` 的装饰器签名 import-type 要求、若干 sub-path import
  的命名导出缺失），属于 demo 自身待清理项，不阻塞运行（electron-vite 用
  esbuild 编译，typecheck 仅做编辑器提示）。
- electron-vite dev server 在非 TTY 环境（如 nohup / CI 后台）下会立即退出，
  必须在交互式终端运行。

## 相关文档

- [`@x-oasis/async-call-rpc-electron` 主仓 README](../../../README.md) —
  channel 类型、port broker pattern
- [基础示例](../../basic/) — 单 utility / 单 renderer 的 RPC 通道建立
- 上游设计文档（如果你在 telegraph repo 里）：
  - `codebase-wiki/architecture/20260509-telegraph-final-process-architecture.md`
    （A-008，最终架构）
  - `codebase-wiki/discussion/20260508-x-oasis-orchestrator-capability-gaps.md`
    （D-006，能力差距分析）
  - `codebase-wiki/roadmap/20260514-x-oasis-supervisor-next-steps.md`
    （§3.D 健康度字段、§3.E backoff jitter 等推进项）
