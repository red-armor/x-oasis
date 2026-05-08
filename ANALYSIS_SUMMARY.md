# x-oasis 连接卡在 CONNECTING 状态 - 根本原因分析总结

## 执行摘要

在 x-oasis 项目中，使用 `ElectronConnectionOrchestrator.connect()` 建立参与者间的直接连接时，连接卡在 `CONNECTING` 状态，永远无法转移到 `READY` 状态。

**根本原因**: `activateParticipant()` 方法中的 `await deferred.promise` 永远不会被 resolve。

---

## 问题流程图

```
orchestrator.connect(fromId, toId)
  │
  ├─ IDLE → CONNECTING (状态转移)
  │
  ├─ createPortPair() 
  │  └─ 创建 {port1, port2} 对
  │
  ├─ Promise.all([
  │    activateParticipant(fromInfo, {port: port1}),
  │    activateParticipant(toInfo, {port: port2})
  │  ])
  │
  ├─ activateParticipant() 中：
  │  ├─ channel.makeRequest('__x_oasis_orchestrator__', 'activateConnection', port)
  │  ├─ 返回 Deferred 对象
  │  └─ await deferred.promise  ⏳ 永远卡在这里
  │
  └─ ❌ 超时或永不返回
```

---

## 关键代码行数据表

| 组件 | 文件 | 行数 | 代码摘要 |
|------|------|------|---------|
| **发送端** | ElectronConnectionOrchestrator.ts | 103-118 | `activateParticipant()` await deferred.promise |
| **通道** | AbstractChannelProtocol.ts | 501-518 | `makeRequest()` 方法定义 |
| **端口提取** | IPCMainChannel.ts | 125 | `const ports = _event.ports \|\| [];` |
| **数据发送** | IPCMainChannel.ts | 174 | `webContents.postMessage(this._channelName, data, transfer);` |
| **处理器注册** | ElectronConnectionOrchestrator.ts | 144-153 | `registerOrchestratorHandler()` 设置处理器 |
| **常量** | types/orchestrator/types.ts | 18 | `ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__'` |
| **响应解析** | handleResponse.ts | 204-207 | `findDefer.resolve(ports && ports[0]);` |

---

## 核心技术概念

### 1. Deferred（延迟对象）

```typescript
type Deferred<T = any> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (err?: unknown) => void;
  promise: PromiseLike<T>;
};
```

- **创建**: 在 `updateSeqInfo` 中间件中由 `createDeferred()` 创建
- **存储**: `channel.ongoingRequests.Map<seqId, Deferred>`
- **解决**: 在 `handleResponse` 中间件中通过匹配 seqId 来调用 `resolve()`

### 2. MessagePort 转移

- MessagePort 是 Web API 中的 Transferable 对象
- 必须通过 `transfer` 列表发送，不能序列化
- Electron 支持通过 `webContents.postMessage(channel, data, [port])` 转移
- 接收端通过 `event.ports` 获取转移的对象

### 3. 请求类型自动检测

- `prepareNormalData` 中间件检测参数中的 Transferable 对象
- 如果检测到，设置 `requestType = TransferableArgsRequest` ('tar')
- 实际对象通过 `transfer` 列表传输，消息体为空

### 4. 响应类型

- `ReturnSuccess` ('rs'): 常规返回值
- `PortSuccess` ('ps'): 单个 Transferable，从 `ports[0]` 取值
- `PortArraySuccess` ('pas'): 多个 Transferable，用完整的 `ports` 数组

---

## 发送-接收-响应完整流程

### 发送阶段（主进程）

```typescript
// activateParticipant() 中
const deferred = channel.makeRequest(
  '__x_oasis_orchestrator__',
  'activateConnection',
  port  // MessagePort 对象
);

// 中间件管道：
// 1. prepareNormalData
//    - seqId = "main_key_0"  (例)
//    - 自动检测 port 为 Transferable
//    - 设置 requestType = 'tar'
//    - 设置 transfer = [port]
//
// 2. updateSeqInfo
//    - 创建 Deferred
//    - ongoingRequests.set("main_key_0", deferred)
//
// 3. serialize
//    - 编码为二进制
//
// 4. sendRequest
//    - channel.send(data, [port])
//    - → webContents.postMessage(channelName, data, [port])
//    - → port 转移到 renderer 进程

await deferred.promise  // 等待响应
```

### 接收阶段（渲染进程）

```typescript
// ipcRenderer.on() 回调
const handler = (_event, ...args) => {
  // ⭐ 关键：提取 ports
  const ports = _event.ports || [];  // 应该是 [port]
  
  // 消息处理管道：
  // 1. normalizeIPCChannelRawMessage
  //    - 提取 event.ports
  //    - 返回 {data, ports: [port]}
  //
  // 2. deserialize
  //    - 解码消息
  //
  // 3. handleRequest
  //    - type = 'tar'
  //    - seqId = "main_key_0"  (必须匹配)
  //    - args = ports[0]  (提取 port 参数)
  //    - handler(args)  // 调用 onPort(port)
  //    - onPort 返回 undefined
  //
  // 4. invokeHandler()
  //    - response = await Promise.resolve(undefined)
  //    - safeSendReply({
  //        type: 'rs',
  //        seqId: "main_key_0",
  //        body: [undefined]
  //      })
  //    - → ipcRenderer.send(channelName, responseData)
};
```

### 响应处理（主进程）

```typescript
// ipcMain.on() 回调 - 接收来自 renderer 的响应
const handler = (_event, ...args) => {
  // 消息处理管道：
  // 1. normalizeMessageChannelRawMessage
  //    - 提取 event.data
  //    - 返回 {data, ports: []}
  //
  // 2. deserialize
  //    - 解码
  //
  // 3. handleResponse
  //    - type = 'rs'
  //    - seqId = "main_key_0"
  //    - findDefer = ongoingRequests.get("main_key_0")
  //    - ✅ 如果找到：findDefer.resolve(body[0])
  //    - ❌ 如果找不到：deferred 永不 resolve
};
```

---

## 🔴 三个最可能的根本原因

### 原因 1: SeqId 不匹配（概率: 极高）

**现象**: `handleResponse` 中找不到对应的 deferred

```typescript
// 发送端存储
ongoingRequests.set("main_channel_0", deferred);

// 但响应中的 seqId 可能是
seqId = "different_key_0"  // ❌ 不匹配

// 查找失败
ongoingRequests.get("different_key_0")  // undefined
```

**诊断方法**:
```bash
# 在 activateParticipant 和 handleResponse 中添加日志
console.log('Sending with seqId:', seqId);
console.log('Receiving response with seqId:', seqId);
console.log('Match:', ongoingRequests.has(seqId));
```

### 原因 2: ports 在接收端未正确提取（概率: 高）

**现象**: 接收端无法获得 port 参数

```typescript
// ❌ 错误：ports 没有提取
listener({
  data,
  sender,
  ports: []  // 丢失！
} as any);

// ✅ 正确：从 _event.ports 提取
const ports = _event.ports || [];
listener({
  data,
  sender,
  ports  // 包含转移的对象
} as any);
```

**关键代码**: IPCMainChannel.ts 第 125 行
```typescript
const ports = _event.ports || [];
```

### 原因 3: 响应未被发送（概率: 中）

**现象**: 接收端处理器不发送响应

```typescript
// safeSendReply 中的检查
if (!protocol.isConnected()) {
  return;  // ❌ 响应丢失
}

// 或者处理器本身有问题
onPort(port);  // 同步 void 函数
// 没有显式返回值
```

**诊断方法**:
```typescript
// 在 invokeHandler 中添加日志
console.log('Handler called');
console.log('About to send reply, isConnected:', protocol.isConnected());
safeSendReply(protocol, sendData);
console.log('Reply sent');
```

---

## 完整的文件清单

| 文件路径 | 功能 | 关键代码段 |
|---------|------|----------|
| `packages/async/async-call-rpc-electron/src/ElectronConnectionOrchestrator.ts` | 编排器实现 | 103-118 (activateParticipant) |
| `packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts` | 通道协议基类 | 501-518 (makeRequest) |
| `packages/async/async-call-rpc-electron/src/IPCMainChannel.ts` | IPC 通道 | 70-144 (on), 146-180 (send) |
| `packages/async/async-call-rpc/src/endpoint/RPCService.ts` | 服务注册 | 22-26 (setChannel) |
| `packages/async/async-call-rpc/src/types/rpc.ts` | 类型定义 | 1-106 (RequestType, ResponseType) |
| `packages/async/async-call-rpc/src/orchestrator/types.ts` | 编排器类型 | 18 (ORCHESTRATOR_SERVICE_PATH) |
| `packages/async/async-call-rpc/src/middlewares/prepareRequestData.ts` | 请求准备 | 76-132 |
| `packages/async/async-call-rpc/src/middlewares/sendRequest.ts` | 发送中间件 | 53-79 |
| `packages/async/async-call-rpc/src/middlewares/handleRequest.ts` | 请求处理 | 65-156 |
| `packages/async/async-call-rpc/src/middlewares/handleResponse.ts` | 响应处理 | 129-250 |
| `packages/async/async-call-rpc/src/middlewares/normalize.ts` | 消息规范化 | 21-40 |
| `packages/promise/deferred/src/index.ts` | Deferred 类型 | 1-21 |
| `packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts` | 基础编排器 | 204-253, 341-406 |

---

## 推荐修复方向

### 第一步: 验证 SeqId 一致性

在 `ElectronConnectionOrchestrator.ts` 和 `handleResponse.ts` 中添加诊断日志:

```typescript
// ElectronConnectionOrchestrator.ts - activateParticipant()
console.log('[DEBUG] Sending activateConnection request');
const deferred = info.channel.makeRequest(/* ... */);
console.log('[DEBUG] Deferred seqId:', deferred?.seqId);

// handleResponse.ts - 在 find deferred 时
console.log('[DEBUG] Looking for seqId:', seqId);
console.log('[DEBUG] ongoingRequests keys:', Array.from(protocol.ongoingRequests.keys()));
const findDefer = protocol.ongoingRequests.get(`${seqId}`);
console.log('[DEBUG] Deferred found:', !!findDefer);
```

### 第二步: 验证 ports 提取

检查 IPCMainChannel.ts 第 125 行的 ports 提取:

```typescript
// 应该是这样：
const ports = _event.ports || [];
listener({
  data,
  sender: _event.sender,
  ports,  // ← 必须包含
} as any);
```

### 第三步: 验证响应发送

在 `handleRequest.ts` 的 `safeSendReply` 调用前添加日志:

```typescript
console.log('[DEBUG] About to reply:', {
  isConnected: protocol.isConnected(),
  seqId,
  methodName,
});
safeSendReply(protocol, sendData);
console.log('[DEBUG] Reply sent');
```

### 第四步: 修复（如果是响应未发送）

修改 `registerOrchestratorHandler` 确保处理器返回值:

```typescript
handlers: {
  activateConnection: (port) => {
    directChannel.bindPort(port);
    return { success: true };  // 添加返回值
  }
}
```

---

## 快速检查列表

- [ ] SeqId 在发送端和接收端是否一致?
- [ ] `_event.ports` 是否在 IPCMainChannel.on() 中被提取?
- [ ] ports 是否被包含在传递给 listener 的对象中?
- [ ] 接收端的 `isConnected()` 在处理器执行时返回 true?
- [ ] 响应消息中的 seqId 是否与请求中的 seqId 匹配?
- [ ] `handleResponse` 中是否找到了对应的 deferred?

---

## 参考资源

### 已生成的详细文档
- `/Users/ryuyutyo/Documents/code/red/x-oasis/CONNECTION_BLOCKING_ANALYSIS.md` - 详细的根本原因分析
- `/Users/ryuyutyo/Documents/code/red/x-oasis/QUICK_REFERENCE.md` - 快速参考表

### 关键代码片段
- MessagePort 转移: IPCMainChannel.ts 第 174 行
- Deferred 创建: AbstractChannelProtocol.ts updateSeqInfo 中间件
- 响应匹配: handleResponse.ts 第 167 行

---

## 总结

连接卡在 CONNECTING 状态的根本原因是 `activateParticipant()` 中的 promise 永远不会被 resolve。这通常由以下原因引起:

1. **SeqId 不匹配** (最可能) - 响应的 seqId 与请求的 seqId 不一致
2. **Ports 提取失败** (可能) - 接收端无法获取转移的 MessagePort
3. **响应未发送** (可能) - 由于连接状态检查或其他原因，响应未被发送

通过添加诊断日志和遵循上述修复步骤，应该能够快速定位和解决问题。

