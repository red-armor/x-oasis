# x-oasis 连接卡在 CONNECTING 状态根本原因分析

## 核心问题描述

连接流程卡在 `CONNECTING` 状态，无法转移到 `READY` 状态。根本原因是在 `BaseConnectionOrchestrator._doConnect()` 中，调用 `activateParticipant()` 的 Promise 永远不会 resolve。

---

## 1. activateParticipant 完整实现

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/ElectronConnectionOrchestrator.ts`

**关键代码** (第 103-118 行):

```typescript
protected async activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void> {
  const { port } = config;

  const deferred = info.channel.makeRequest(
    ORCHESTRATOR_SERVICE_PATH,      // '__x_oasis_orchestrator__'
    'activateConnection',           // 远程方法名
    port                            // 参数：MessagePort
  );

  if (deferred && typeof (deferred as any).promise === 'object') {
    await (deferred as any).promise;  // ⚠️ 等待这个 promise
  }
}
```

**问题分析**:

1. `activateParticipant` 调用 `channel.makeRequest()` 发送 port 给参与者
2. 期望获得一个 `Deferred` 对象，其 `promise` 会在参与者接收和处理端口后 resolve
3. **关键**: 这个 promise 永远不会 resolve，导致 `await` 卡住

---

## 2. makeRequest 方法实现链

### 2.1 AbstractChannelProtocol.makeRequest()

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts`

**代码** (第 501-518 行):

```typescript
makeRequest(props: SendingProps, transfer?: MessagePort[]): Deferred | void;

makeRequest(
  requestPath: string,
  fnName: string,
  ...args: any[]
): Deferred | void;

makeRequest(...args: any[]) {
  const result = runMiddlewares(this.senderMiddleware, args);
  if (result?.returnValue) return result.returnValue;
  // 对于事件方法，可能返回轻量级对象
  if (result?.seqId !== undefined) {
    return { seqId: result.seqId } as any;
  }
}
```

**关键特点**:
- `makeRequest` 运行发送中间件管道
- 返回 `Deferred` 或 `undefined`
- 中间件管道负责创建 `Deferred` 并存储在 `ongoingRequests` 中

### 2.2 发送中间件管道

**顺序** (AbstractChannelProtocol 构造函数, 第 176-182 行):

```typescript
private _senderMiddleware: SenderMiddleware[] = [
  prepareNormalData,           // ✨ 结构化 RPC 请求，自动检测 Transferable
  updateSeqInfo,               // 分配 seqId
  handleDisconnectedRequest,   // 检查连接状态
  serialize,                   // 编码
  sendRequest,                 // 发送
];
```

---

## 3. 关键中间件详析

### 3.1 prepareNormalData 中间件

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares/prepareRequestData.ts`

**作用** (第 76-132 行):

```typescript
export const prepareNormalData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    const seqId = channel.seqId;
    const parsed = parseRequestArgs(props, args);
    // ...
    
    // 自动检测 Transferable 对象（如 MessagePort）
    const { hasTransferable, transferables } =
      validateAndDetectArgType(params);

    if (hasTransferable) {
      // port 被检测为 Transferable，设置为 TransferableArgsRequest
      requestType = params.length === 1
        ? RequestType.TransferableArgsRequest
        : RequestType.TransferableArrayArgsRequest;
      transfer = transferables;  // [port]
    }

    const header: RequestEntryHeader = [
      requestType,
      seqId,
      requestPath,
      methodName,
    ];

    // 对于 Transferable 请求，body 为空，对象通过 transfer 列表传输
    const body =
      requestType === RequestType.TransferableArgsRequest ||
      requestType === RequestType.TransferableArrayArgsRequest
        ? []
        : params;

    return {
      seqId,
      data: [header, body],
      transfer,  // ← 重要！port 在这里
    };
  };
  // ...
};
```

**传输数据结构**:
```
消息头：[TransferableArgsRequest, seqId, '__x_oasis_orchestrator__', 'activateConnection']
消息体：[]
转移列表：[port]
```

### 3.2 updateSeqInfo 中间件

**作用**: 创建 `Deferred` 并存储在 `ongoingRequests` 中

```typescript
protocol.ongoingRequests.set(seqId, deferred);
```

**这是 makeRequest 返回的 Deferred**

### 3.3 serialize 中间件

编码消息为二进制格式

### 3.4 sendRequest 中间件

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares/sendRequest.ts`

**代码** (第 53-79 行):

```typescript
export const sendRequest = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, transfer } = value;

    // ⭐ 关键：调用 channel.send(data, transfer)
    // 在 IPCMainChannel 中，这会调用 webContents.postMessage()
    if (transfer && transfer.length > 0) {
      channelProtocol.send(data, transfer);  // 包含 MessagePort 的转移列表
    } else {
      channelProtocol.send(data);
    }

    return value;
  };
  fn.lifecycle = SendMiddlewareLifecycle.Send;
  return fn;
};
```

---

## 4. IPCMainChannel 的 send/receive 实现

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/IPCMainChannel.ts`

### 4.1 send 方法 (第 146-180 行)

```typescript
send(data: unknown, transfer?: any[]): void {
  // 确定目标 WebContents
  const target = this._acceptAllSenders
    ? this._lastSender
    : this._webContents;

  if (!target || (target.isDestroyed && target.isDestroyed())) {
    return;
  }

  // ⭐ 关键：使用 postMessage 发送带转移列表的消息
  if (transfer && transfer.length) {
    // CASE 1: 带 Transferable 对象的消息
    // port 在这里被转移到 renderer 进程
    (target as any).postMessage(this._channelName, data, transfer);
  } else {
    // CASE 2: 简单消息
    target.send(this._channelName, data);
  }
}
```

### 4.2 on 方法 (第 70-144 行)

```typescript
on(listener: (data: unknown) => void): void | (() => void) {
  const handler = (_event: IpcMainEvent, ...args: unknown[]): void => {
    // STEP 1: 处理发送者路由（绑定 vs 广播模式）
    if (this._acceptAllSenders) {
      this._lastSender = _event.sender;
    } else if (_event.sender !== this._webContents) {
      return;  // 过滤其他发送者
    }

    // STEP 2: 提取主数据
    const data = args.length === 1 ? args[0] : args;

    // STEP 3: ⭐ 关键：从 Electron IPC 事件中提取端口
    // 当 renderer 用 transfer 列表发送时，port 在 _event.ports 中
    const ports = _event.ports || [];

    // STEP 4: 调用监听器，使用 MessageEvent 样式结构
    listener({
      data,
      sender: _event.sender,
      ports,  // ← 关键！端口必须包含在这里
    } as any);
  };

  ipcMain.on(this._channelName, handler);
  return () => {
    ipcMain.off(this._channelName, handler);
  };
}
```

**关键点**: ports 从 `_event.ports` 提取并包含在消息对象中

---

## 5. RPCService 设置

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/endpoint/RPCService.ts`

**代码** (第 22-26 行):

```typescript
setChannel(channel: AbstractChannelProtocol) {
  this.channel = channel;
  this.channel.setService(this);  // 注册 service
  this.channel.ensureListenerAttached();  // 确保监听器已附加
}
```

**作用**: 
- 将 RPCService 与 channel 关联
- 触发 `ensureListenerAttached()` 注册 `onMessage` 监听器
- 这样接收端能处理传入的 RPC 请求

---

## 6. registerOrchestratorHandler 的注册流程

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/ElectronConnectionOrchestrator.ts`

**代码** (第 144-153 行):

```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void {
  // 创建 service，用于处理 'activateConnection' 方法调用
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: onPort,  // ← 处理器
    },
  });
  service.setChannel(channel);  // ← 注册 service 到 channel
}
```

**流程**:
1. 参与者调用 `registerOrchestratorHandler(channel, onPort)`
2. 创建 RPCService，处理器是 `onPort` 回调
3. 将 service 绑定到 channel
4. 现在 channel 监听 `activateConnection` 请求

---

## 7. ORCHESTRATOR_SERVICE_PATH 常量

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/orchestrator/types.ts`

**代码** (第 18 行):

```typescript
export const ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__' as const;
```

---

## 8. 接收端消息处理管道

**顺序** (AbstractChannelProtocol 构造函数, 第 169-174 行):

```typescript
protected _onMessageMiddleware: ClientMiddleware[] = [
  normalizeMessageChannelRawMessage,  // 提取 data 和 ports
  deserialize,                         // 解码
  handleRequest,                       // 分发到 handler
  handleResponse,                      // 处理响应
];
```

### 8.1 normalize 中间件

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares/normalize.ts`

```typescript
export const normalizeMessageChannelRawMessage =
  () =>
  (event: MessageEvent): NormalizedRawMessageOutput => {
    const data = event.data;
    const ports = event.ports ? [...event.ports] : [];  // ← 提取端口

    return {
      event,
      data,
      ports,  // ← 必须包含！
    };
  };
```

### 8.2 handleRequest 中间件

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares/handleRequest.ts`

**关键部分** (第 65-156 行):

```typescript
export const handleRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const { data, ports } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0] as any;

    // STEP 1: 检查是否是响应（不是请求）
    if (Object.values(ResponseType).includes(type)) {
      return message;  // 转给 handleResponse
    }

    const seqId = header[1];
    const requestPath = header[2];
    const methodName = header[3];
    let args = body[0];

    // ✨ 关键：处理 Transferable 参数
    // port 通过 message.ports 传输，不在序列化的 body 中
    if (type === RequestType.TransferableArgsRequest) {
      args = (ports || [])[0];  // ← 单个 port
    } else if (type === RequestType.TransferableArrayArgsRequest) {
      args = ports || [];  // ← 多个 port
    }

    // ... 继续处理请求
    // 最终调用 handler(args)，即 onPort(port)
  };
```

**关键点**: 
- `TransferableArgsRequest` 类型的参数从 `ports[0]` 中提取
- 这就是 `onPort` 回调接收 port 的方式

### 8.3 handleResponse 中间件

**文件**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares/handleResponse.ts`

**关键部分** (第 129-250 行):

```typescript
export const handleResponse =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const { data, ports } = message;
    const type = header[0] as any;

    // ... 检查这是否是响应

    const seqId = header[1];
    const findDefer = protocol.ongoingRequests.get(`${seqId}`);

    if (findDefer) {
      // ⭐ 关键：处理 Transferable 返回值
      if (type === ResponseType.PortSuccess) {
        // 单个 Transferable：用 ports[0] resolve
        findDefer.resolve(ports && ports[0]);
      } else if (type === ResponseType.PortArraySuccess) {
        // 多个 Transferable：用完整的 ports 数组 resolve
        findDefer.resolve(ports || []);
      } else if (type === ResponseType.ReturnSuccess) {
        // 常规返回值
        findDefer.resolve(body[0]);
      } else if (type === ResponseType.ReturnFail) {
        // 错误响应
        findDefer.reject(rpcError);
      }
    }
    // ...
  };
```

---

## 9. 完整连接流程图

```
主进程（Orchestrator）          |    渲染进程（Participant）
─────────────────────────────────┼─────────────────────────────────

connect('renderer', 'utility')
│
├─ IDLE → CONNECTING
│
├─ createPortPair()
│  result: {port1, port2}
│
├─ activateParticipant(renderer, {port: port1})
│  │
│  └─ makeRequest('__x_oasis_orchestrator__', 'activateConnection', port1)
│     │
│     ├─ prepareNormalData
│     │  └─ auto-detect port as TransferableArgsRequest
│     │     data: [['tar', seqId, '__x_oasis_orchestrator__', 'activateConnection'], []]
│     │     transfer: [port1]
│     │
│     ├─ updateSeqInfo
│     │  └─ create Deferred
│     │     ongoingRequests.set(seqId, deferred)
│     │     return deferred
│     │
│     ├─ serialize
│     │
│     └─ sendRequest
│        └─ channel.send(data, [port1])
│           │
│           └─ webContents.postMessage(channel, data, [port1])
│              │
│              ├─ Port 通过 transfer 列表转移到 renderer
│              │  (port 不能再在主进程中使用)
│              │
│              └─────────────────────────────────────>  ipcRenderer 接收
│                                                       │
│                                                       └─ normalizeIPCChannelRawMessage
│                                                          data: [...]
│                                                          ports: [port1]
│                                                          │
│                                                          └─ handleRequest
│                                                             type: 'tar'
│                                                             args = ports[0]  (port1)
│                                                             │
│                                                             └─ handler = onPort
│                                                                onPort(port1)
│                                                                │
│                                                                └─ directChannel.bindPort(port1)
│                                                                   │
│                                                                   └─ 发送响应给主进程？
│                                                                      ❌ 问题：没有响应！
│
│  await deferred.promise
│  ❌ 永远等待中...没有响应来解决这个 promise！
│
│
└─ Promise.all([...]) 超时/永远不会 resolve
```

---

## 10. 🔴 根本原因

**问题**: `onPort` 处理器在接收端执行后，**没有发送响应回主进程**

### 10.1 期望的流程

1. ✅ 主进程发送 `activateConnection` 请求 + port
2. ✅ 渲染进程接收并调用 `onPort(port)` 处理器
3. ❌ **缺失**: 渲染进程应该发送响应确认已接收 port
4. ❌ **结果**: 主进程的 `deferred.promise` 永远不会 resolve

### 10.2 问题原因分析

在 `registerOrchestratorHandler` 中：

```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void {
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: onPort,  // ← 这是同步的 void 函数
    },
  });
  service.setChannel(channel);
}
```

**问题**:
- `onPort` 是 `(port: any) => void` — 不返回任何值
- 当处理器完成后，系统无法区分：
  - 是否应该发送成功响应
  - 是否应该发送错误响应
  - 是否应该等待异步操作

### 10.3 handleRequest 如何处理响应

在 `handleRequest` 中（第 336-412 行），处理常规请求时：

```typescript
const invokeHandler = async () => {
  const result = ctx !== undefined ? handler(args, ctx) : handler(args);

  try {
    const response = await Promise.resolve(result);
    
    // ⭐ 发送成功响应
    const responseHeader = [ResponseType.ReturnSuccess, seqId];
    let sendData = protocol.writeBuffer.encode([responseHeader, [response]]);
    safeSendReply(protocol, sendData);
  } catch (err) {
    // ⭐ 发送错误响应
  }
};

invokeHandler();  // ← 异步执行，但没有等待
```

**对于 onPort 处理器**:
- `onPort(port)` 返回 `void`
- `Promise.resolve(void)` → `undefined`
- 发送 `ReturnSuccess` 响应，带着 `undefined`

❌ **但这仍应该触发响应！** 除非...

---

## 11. 🔍 深层问题：响应可能丢失

### 可能的原因链

**原因 1**: `_isConnected` 检查导致响应被丢弃

在 `safeSendReply` 中（handleRequest.ts 第 43-48 行）：

```typescript
const safeSendReply = (protocol: AbstractChannelProtocol, data: any): void => {
  if (!protocol.isConnected()) {
    return;  // ❌ 如果 channel 未连接，响应不会发送
  }
  protocol.sendReply(data);
};
```

**可能场景**: 渲染进程的 channel 在接收处理器完成前未连接

### 原因 2: 消息实际上被发送了，但响应处理有问题

在 Electron 中，从 renderer 到 main 的响应可能没有被正确接收

### 原因 3: Transferable port 后续不能通过同一 channel 回复

❌ 当 port 被转移后，原始 channel 可能变得不可用或混乱

---

## 12. 📋 诊断检查清单

### 需要验证的点

1. **Deferred 是否被创建**
   - `ongoingRequests` 中是否有 seqId？
   - ✅ 应该有（在 updateSeqInfo 中创建）

2. **消息是否被发送**
   - `channel.send()` 是否被调用？
   - 应该看到 `webContents.postMessage()` 被调用
   - ✅ 应该有

3. **接收端是否收到消息**
   - renderer 的 `ipcRenderer.on()` 是否触发？
   - 可以通过 logging 验证
   - ❓ 需要检查

4. **onPort 处理器是否被调用**
   - 渲染进程是否真的执行了 `onPort(port)`？
   - 可以在处理器中添加 console.log
   - ❓ 需要检查

5. **响应是否被发送回来**
   - 主进程是否收到 `handleResponse`？
   - 是否看到匹配的 seqId？
   - ❓ 需要检查 — **这是关键**

6. **Deferred 是否被 resolve**
   - `handleResponse` 中是否找到了 deferred？
   - `findDefer.resolve()` 是否被调用？
   - ❓ 需要检查 — **最可能的问题**

---

## 13. 详细变量跟踪

### 发送端（主进程）

```typescript
// ElectronConnectionOrchestrator.activateParticipant()

const seqId_sender = "unique_id_123";  // 由 channel.seqId getter 生成

const deferred = channel.makeRequest(
  '__x_oasis_orchestrator__',
  'activateConnection',
  port
);

// deferred 结构
{
  resolve: fn,
  reject: fn,
  promise: Promise
}

// 存储在：
// protocol.ongoingRequests.set("unique_id_123", deferred)
```

### 消息数据结构

```typescript
// 序列化前
data = [
  ['tar', 'unique_id_123', '__x_oasis_orchestrator__', 'activateConnection'],
  []
]
transfer = [port]

// 通过 IPC 发送
webContents.postMessage('rpc-channel', serialized_data, [port])
```

### 接收端（renderer 进程）

```typescript
// ipcRenderer.on('rpc-channel', (event, ...args) => {
//   event.ports  ← [port]  (从主进程转移过来)
//   args[0]      ← serialized_data
// })

// 反序列化后
data = [
  ['tar', 'unique_id_123', '__x_oasis_orchestrator__', 'activateConnection'],
  []
]
ports = [port]

// handleRequest 处理
type = 'tar'
seqId = 'unique_id_123'
args = ports[0]  (port)

handler = onPort
handler(port)  ← 同步调用，返回 undefined

// 发送响应
response = undefined
sendData = writeBuffer.encode([
  ['rs', 'unique_id_123'],  // ResponseType.ReturnSuccess
  [undefined]
])

protocol.sendReply(sendData)  // 通过 ipcRenderer.send()
```

### 回到发送端

```typescript
// ipcMain.on('rpc-channel', (event, data) => {
//   // 应该收到上面发送的响应
// })

// 但是...
// ongoingRequests 中有这个 seqId 吗？
// 'unique_id_123' 是否能与响应中的 seqId 匹配？

// handleResponse 检查
findDefer = protocol.ongoingRequests.get('unique_id_123')

if (findDefer) {
  findDefer.resolve(undefined)  // ← 应该在这里 resolve
}
```

---

## 14. 可能的 SeqId 不匹配问题

### 潜在陷阱

如果发送端和接收端的 seqId 不一致：

```typescript
// 发送端
sender_channel.seqId  // "key1_0"
// ongoingRequests.set("key1_0", deferred)

// 接收端  
receiver_channel.seqId  // "key2_0"  ❌ 不同的 channel
// 响应包含 "key2_0"

// 回到发送端
ongoingRequests.get("key2_0")  // ❌ undefined
// handleResponse 找不到 deferred
// promise 永不 resolve
```

❌ **这很可能是根本原因！**

---

## 15. 总结：关键代码路径

### 发送端关键路径

```
activateParticipant()
  └─ channel.makeRequest(path, 'activateConnection', port)
     └─ runMiddlewares(senderMiddleware, args)
        └─ prepareNormalData
           ├─ seqId = channel.seqId
           ├─ auto-detect port as TransferableArgsRequest
           └─ return {seqId, data, transfer: [port]}
        
        └─ updateSeqInfo
           ├─ create deferred
           └─ ongoingRequests.set(seqId, deferred)
           └─ return {seqId, returnValue: deferred}
        
        └─ serialize & sendRequest
           └─ channel.send(data, [port])
              └─ webContents.postMessage(channel, data, [port])
     
     └─ return deferred
  
  └─ await deferred.promise  ⏳ 等待中...
```

### 接收端关键路径

```
ipcRenderer.on('channel', (event, ...args) => {
  ports: [port]
  
  └─ normalizeIPCChannelRawMessage
     └─ return {data, ports: [port]}
  
  └─ handleRequest
     ├─ seqId = data[0][1]
     ├─ type = 'tar'
     ├─ args = ports[0]
     └─ handler = onPort
        └─ onPort(port)
           └─ directChannel.bindPort(port)
     
     └─ invokeHandler (async)
        └─ response = await Promise.resolve(handler(args))
           └─ response = undefined
        
        └─ safeSendReply(
             encode([['rs', seqId], [response]])
           )
           └─ ipcRenderer.send('channel', data)
```

### 回到发送端

```
ipcMain.on('channel', (event, data) => {
  ports: []
  
  └─ normalizeMessageChannelRawMessage
     └─ return {data, ports: []}
  
  └─ handleResponse
     ├─ type = 'rs'  (ResponseType.ReturnSuccess)
     ├─ seqId = data[0][1]
     ├─ findDefer = ongoingRequests.get(seqId)
     └─ if (findDefer) {
          findDefer.resolve(body[0])  ✅ 应该在这里
        }
```

---

## 16. 🔑 关键找到的问题

基于代码分析，卡在 CONNECTING 状态的根本原因是：

**Promise.all() 中的两个 activateParticipant() 调用中至少有一个的 promise 没有被 resolve**

### 最可能的原因顺序

1. **SeqId 不匹配** (概率: 高)
   - 两个 channel 的 seqId 序列独立
   - 响应到达时 seqId 不匹配，找不到 deferred

2. **响应没有发送回来** (概率: 中)
   - `safeSendReply()` 中的 `isConnected()` 检查失败
   - 接收端 channel 还没准备好

3. **响应被错误的 channel 处理了** (概率: 中)
   - 多个 channel 共享同一个传输
   - 响应被另一个 channel 的 onMessage 处理掉了

4. **端口传输导致 channel 不可用** (概率: 低)
   - Electron 中转移 port 后可能有特殊行为

---

## 17. 推荐的修复方向

### 解决方案 1: 验证 SeqId 匹配

添加日志追踪 seqId：

```typescript
// 发送端
console.log('Sending request with seqId:', seqId);
console.log('Stored in ongoingRequests:', protocol.ongoingRequests.has(seqId));

// 接收端  
console.log('Received response with seqId:', seqId);
console.log('Looking up in ongoingRequests:', protocol.ongoingRequests.has(seqId));
console.log('ongoingRequests keys:', Array.from(protocol.ongoingRequests.keys()));
```

### 解决方案 2: 修复响应发送

确保响应被发送：

```typescript
// 在 registerOrchestratorHandler 中
handlers: {
  activateConnection: async (port) => {
    // 修改为异步，确保有返回值
    directChannel.bindPort(port);
    return { success: true };  // 显式返回值
  }
}
```

### 解决方案 3: 添加超时和诊断

```typescript
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('activateParticipant timeout')), 5000)
);

await Promise.race([deferred.promise, timeoutPromise]);
```

