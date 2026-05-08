# x-oasis 连接问题快速参考

## 文件清单与关键代码位置

| 文件 | 功能 | 关键代码行 | 关键信息 |
|------|------|----------|---------|
| **ElectronConnectionOrchestrator.ts** | Electron 连接编排器实现 | 103-118 | `activateParticipant()` 方法 |
| | | 144-153 | `registerOrchestratorHandler()` 处理器注册 |
| **AbstractChannelProtocol.ts** | RPC 通道基类 | 501-518 | `makeRequest()` 方法 |
| | | 169-174 | 接收中间件管道 |
| | | 176-182 | 发送中间件管道 |
| | | 195 | `ongoingRequests` 存储 pending 请求 |
| **IPCMainChannel.ts** | Electron IPC 主进程通道 | 146-180 | `send()` 方法 - 发送带 transfer 列表的消息 |
| | | 70-144 | `on()` 方法 - 接收并提取 ports |
| | | 125 | ⭐ 提取 `_event.ports` 关键行 |
| **RPCService.ts** | RPC 服务注册 | 22-26 | `setChannel()` 方法 |
| **types.ts** (types/rpc.ts) | 请求/响应类型定义 | 1-106 | 请求类型 (RequestType) 和响应类型 (ResponseType) |
| | | 49 | `TransferableArgsRequest = 'tar'` |
| | | 88 | `PortSuccess = 'ps'` |
| **types.ts** (orchestrator/types.ts) | 编排器常量 | 18 | `ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__'` |
| **prepareRequestData.ts** | 请求准备中间件 | 76-132 | 自动检测 Transferable 对象 |
| **sendRequest.ts** | 发送中间件 | 53-79 | 调用 `channel.send(data, transfer)` |
| **handleRequest.ts** | 请求处理中间件 | 65-156 | 从 `message.ports` 中提取参数 |
| | | 336-412 | 调用处理器并发送响应 |
| **handleResponse.ts** | 响应处理中间件 | 129-250 | 解析响应并 resolve deferred |
| | | 204-207 | PortSuccess/PortArraySuccess 处理 |
| **normalize.ts** | 消息规范化中间件 | 21-40 | 提取 `event.ports` |
| **Deferred.ts** | Promise 包装器 | 1-21 | Deferred 类型和 createDeferred 工厂 |
| **BaseConnectionOrchestrator.ts** | 基础编排器 | 204-253 | `connect()` 方法流程 |
| | | 341-406 | `_doConnect()` 的完整流程 |

---

## 关键数据流向

### 1️⃣ 发送 MessagePort

```
activateParticipant()
  ↓
channel.makeRequest('__x_oasis_orchestrator__', 'activateConnection', port)
  ↓
prepareNormalData (自动检测 port 为 Transferable)
  ↓ seqId: "key_0"
  ↓ requestType: TransferableArgsRequest
  ↓ transfer: [port]
  ↓
updateSeqInfo (创建 Deferred)
  ↓
  └─ ongoingRequests.set("key_0", deferred)
  └─ return deferred
  
serialize & sendRequest
  ↓
channel.send(data, [port])
  ↓ (IPCMainChannel)
  ↓
webContents.postMessage(channelName, data, [port])
```

### 2️⃣ 接收 MessagePort

```
ipcRenderer 接收 (event.ports 包含 port)
  ↓
normalizeIPCChannelRawMessage
  ↓
  └─ ports = event.ports (⭐ 必须包含)
  
deserialize
  ↓
handleRequest
  ↓
  ├─ type === TransferableArgsRequest?
  ├─ args = ports[0]  ⭐ 从 ports 中提取参数
  │
  └─ handler(args)  // onPort(port)
     ↓
     response = undefined
     ↓
     invokeHandler() (异步)
       ├─ sendResponse(ReturnSuccess)
       └─ ipcRenderer.send(channelName, responseData)
```

### 3️⃣ 处理响应

```
ipcMain 接收响应
  ↓
normalizeMessageChannelRawMessage
  ↓
deserialize
  ↓
handleResponse
  ↓
  ├─ seqId = data[0][1]  // "key_0"?
  ├─ findDefer = ongoingRequests.get(seqId)
  │
  └─ if (findDefer) {
       findDefer.resolve(body[0])  ⭐ 这里 resolve promise
     }
```

---

## 🔴 关键问题点

| 序号 | 检查项 | 现状 | 风险 |
|------|--------|------|------|
| 1 | Deferred 创建 | ✅ updateSeqInfo 中创建 | 无 |
| 2 | port 转移 | ✅ 通过 transfer 列表 | 无 |
| 3 | ports 提取 (接收端) | ⚠️ IPCMainChannel.on() 需检查 | **高** |
| 4 | 处理器调用 | ⚠️ onPort(port) 是否被调用? | **中** |
| 5 | 响应发送 | ⚠️ safeSendReply() 可能被跳过 | **高** |
| 6 | SeqId 匹配 | ⚠️ 响应的 seqId 是否能匹配? | **极高** |
| 7 | Deferred resolve | ❓ handleResponse 是否找到? | **极高** |

---

## ⭐ 最可能的问题

### 问题 1: 响应的 seqId 不匹配

```
发送端: ongoingRequests.set("main_0", deferred)
接收端: seqId = "renderer_0"  ❌
回到发送端: ongoingRequests.get("renderer_0") ❌ undefined
结果: Deferred 永不 resolve
```

**解决**: 确保 seqId 在 RPC 消息中被正确序列化和反序列化

### 问题 2: ports 在 IPCMainChannel.on() 中未提取

```typescript
// ❌ 错误
const ports = [];  // 丢失！

// ✅ 正确
const ports = _event.ports || [];
```

**解决**: 验证 `_event.ports` 在处理器中被提取

### 问题 3: 响应被 safeSendReply() 中的检查阻止

```typescript
if (!protocol.isConnected()) {
  return;  // ❌ 响应未发送
}
```

**解决**: 确保接收端 channel 的 `_isConnected` 状态正确

---

## 快速诊断命令

```bash
# 1. 搜索所有 ongoingRequests 使用
grep -r "ongoingRequests\." /Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src

# 2. 搜索所有 seqId 的处理
grep -r "seqId" /Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares

# 3. 搜索 safeSendReply 的调用
grep -r "safeSendReply" /Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src

# 4. 搜索 Transferable 相关代码
grep -r "TransferableArgsRequest\|PortSuccess" /Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src
```

---

## Deferred 类型定义

```typescript
type Deferred<T = any> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (err?: unknown) => void;
  promise: PromiseLike<T>;
};
```

**创建方式**: `createDeferred()` 工厂函数

**存储位置**: `channel.ongoingRequests.get(seqId)`

**激活时机**: 在 `handleResponse` 中匹配 seqId 时

---

## 中间件执行顺序

### 发送管道 (AbstractChannelProtocol._senderMiddleware)

```
1. prepareNormalData        → 构建请求结构，检测 Transferable
2. updateSeqInfo            → 分配 seqId，创建 Deferred
3. handleDisconnectedRequest → 检查连接状态
4. serialize                → 编码为二进制
5. sendRequest              → 调用 channel.send(data, transfer)
```

### 接收管道 (AbstractChannelProtocol._onMessageMiddleware)

```
1. normalizeMessageChannelRawMessage → 提取 data 和 ports
2. deserialize                       → 解码
3. handleRequest                     → 分发到处理器
4. handleResponse                    → 路由响应到 Deferred
```

---

## ResponseType 枚举

```typescript
enum ResponseType {
  ReturnSuccess = 'rs',        // 常规返回值
  ReturnFail = 'rf',           // 错误
  PortSuccess = 'ps',          // 单个 Transferable
  PortArraySuccess = 'pas',    // 多个 Transferable
  PortFail = 'pf',             // Transferable 失败
  SubscriptionStopped = 'ss',  // 订阅结束
  EventMethodStopped = 'evt-stopped',  // 事件方法结束
}
```

---

## RequestType 枚举 (Transferable 相关)

```typescript
enum RequestType {
  PromiseRequest = 'pr',
  TransferableArgsRequest = 'tar',      // 单个 Transferable: handler(ports[0])
  TransferableArrayArgsRequest = 'taar', // 多个 Transferable: handler(ports)
  // ...
}
```

