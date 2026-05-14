---
layout: home

hero:
  name: 'x-oasis Wiki'
  text: '源码阅读与概念笔记'
  tagline: 架构分析 · 技术讨论 · Issue 记录 · 参考手册 · 路线图
  actions:
    - theme: brand
      text: 文档索引
      link: /INDEX#文档索引
    - theme: alt
      text: 书写规范
      link: /CONVENTIONS

features:
  - title: 架构分析
    details: 模块职责、依赖与系统设计笔记。
    link: /INDEX
  - title: 技术讨论
    details: 方案对比、概念辨析与深度笔记。
    link: /INDEX
  - title: Issue 记录
    details: AI coding 过程中的问题现象、修复过程与回归结论。
    link: /INDEX
  - title: 参考手册
    details: 目录结构与速查。
    link: /INDEX
  - title: 规划路线
    details: 差距分析、优先级与待办。
    link: /INDEX
---

> 本目录（`codebase-wiki/`）存放 AI 辅助生成的分析文档、技术讨论、Issue 记录、参考手册与规划路线。  
> 书写规范请参考 [CONVENTIONS.md](./CONVENTIONS.md)（也可在仓库中直接打开该文件）。

在分类子目录下添加首篇文档后，在仓库根目录运行 skill 自带的 `regenerate-sidebar.mjs` 以更新侧栏与导航。

## 文档索引

### architecture/ — 架构分析

| #   | 文件 | 标题 | 概述 |
| --- | ---- | ---- | ---- |
|     |      |      |      |

### discussion/ — 技术讨论

| #     | 文件                                                                                                                      | 标题                                                 | 概述                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| D-001 | [20260510-orchestrator-decentralized-connect.md](./discussion/20260510-orchestrator-decentralized-connect.md)             | Orchestrator connect 去中心化设计讨论                | 探讨将 connect 能力从 main process 中心化调度下放到 participant 本地发起的可行性与演进路径     |
| D-002 | [20260511-multi-page-routing-pagelet-proxy.md](./discussion/20260511-multi-page-routing-pagelet-proxy.md)                 | 多 Page 到多 Pagelet 的 RPC 路由问题                 | 多 page 共享 renderer 时 RPC 请求无法路由到对应 pagelet 的根因分析与 ActivationConfig 扩展方案 |
| D-003 | [20260512-direct-channel-vs-ipc-channel-comparison.md](./discussion/20260512-direct-channel-vs-ipc-channel-comparison.md) | Renderer 侧 directChannel 与 ipcChannel RPC 通道对比 | 对比 MessagePort 直连与 IPC 中转两种模式的实现机制、数据路径与优缺点                           |
| D-004 | [20260514-utility-process-supervisor-rfc.md](./discussion/20260514-utility-process-supervisor-rfc.md) | UtilityProcessSupervisor RFC — Electron utility process 生命周期 + 透明换链 | 提案 UtilityProcessSupervisor 统一封装 utilityProcess.fork → bindPort → registerParticipant → 监听 disconnect → 自动 replaceParticipantChannel 流程，解决下游（telegraph 等）三处重复 spawn 实现 + 0 处使用 replaceParticipantChannel 的真实落地缺口 |

### issue/ — Issue 记录

| #     | 文件                                                                                                                         | 标题                                                            | 概述                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| I-001 | [20260510-async-call-rpc-electron-heartbeat-ping-bug.md](./issue/20260510-async-call-rpc-electron-heartbeat-ping-bug.md)     | async-call-rpc-electron 心跳 ping 失败导致连接断开              | 修复 createPageBridge 中 RPC 消息解析错误，心跳 ping 被错误转发到 renderer 进程导致连接频繁断开重连                 |
| I-002 | [20260512-create-page-bridge-multi-port-routing.md](./issue/20260512-create-page-bridge-multi-port-routing.md)               | createPageBridge 多 port 路由导致 monitor / connection 服务互斥 | createPageBridge 原只支持单 port，多 utility process 连接时互斥；新增 serviceRoutes / defaultPeerId 路由机制        |
| I-003 | [20260513-setting-window-rpc-three-bugs.md](./issue/20260513-setting-window-rpc-three-bugs.md)                               | Setting 独立窗口 RPC 三连故障                                   | preload chunks 无法在 sandbox 加载、createPageBridge peer ID heuristic 路由失败、reconnect 后 servicePortMap 不更新 |
| I-004 | [20260513-create-page-bridge-reconnect-firstport-stale.md](./issue/20260513-create-page-bridge-reconnect-firstport-stale.md) | createPageBridge reconnect 后 firstPort 不更新导致 RPC 无响应   | disconnect→connect 后 firstPort 仍指向已关闭旧 port，realChannel.bindPort 不被调用，send 收不到 response            |

### reference/ — 参考手册

| #   | 文件 | 标题 | 概述 |
| --- | ---- | ---- | ---- |
|     |      |      |      |

### roadmap/ — 规划路线

| #   | 文件 | 标题 | 概述 |
| --- | ---- | ---- | ---- |
|     |      |      |      |
