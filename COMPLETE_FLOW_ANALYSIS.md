# x-oasis async-call-rpc 完整数据流分析

## 文件位置索引

### 核心文件
1. **autoDetectTransfer.ts** - 自动检测 Transferable 对象
   - 路径: `/packages/async/async-call-rpc/src/middlewares/autoDetectTransfer.ts`
   - 关键函数: `isTransferable()`, `validateAndDetectArgType()`, `findTransferables()`

2. **types/rpc.ts** - 请求/响应类型定义
   - 路径: `/packages/async/async-call-rpc/src/types/rpc.ts`
   - 关键枚举: `RequestType`, `ResponseType`
   - 特别: `RequestType.TransferableArgsRequest = 'tar'`

3. **types/protocol.ts** - 协议类型定义
   - 路径: `/packages/async/async-call-rpc/src/types/protocol.ts`
   - 关键接口: `SendingProps`

4. **prepareRequestData.ts** - 请求数据准备中间件
   - 路径: `/packages/async/async-call-rpc/src/middlewares/prepareRequestData.ts`
   - 关键函数: `parseRequestArgs()`, `prepareNormalData()`

5. **handleResponse.ts** - 响应处理中间件（客户端）
   - 路径: `/packages/async/async-call-rpc/src/middlewares/handleResponse.ts`
   - 关键逻辑: PortSuccess 处理

6. **handleRequest.ts** - 请求处理中间件（服务器）
   - 路径: `/packages/async/async-call-rpc/src/middlewares/handleRequest.ts`
   - 关键逻辑: TransferableArgsRequest 重建, PortSuccess 响应

7. **sendRequest.ts** - 发送请求中间件
   - 路径: `/packages/async/async-call-rpc/src/middlewares/sendRequest.ts`
   - 关键函数: `sendRequest()`

8. **normalize.ts** - 消息规范化中间件
   - 路径: `/packages/async/async-call-rpc/src/middlewares/normalize.ts`
   - 关键函数: `normalizeMessageChannelRawMessage()`, `normalizeIPCChannelRawMessage()`

9. **buffer.ts** - 序列化/反序列化中间件
   - 路径: `/packages/async/async-call-rpc/src/middlewares/buffer.ts`
   - 关键函数: `serialize()`, `deserialize()`

### 示例文件
10. **main.ts** - Electron 主进程示例
    - 路径: `/packages/async/async-call-rpc-electron/examples/renderer-acquire-main-port-example/main.ts`

11. **preload.ts** - Electron 预加载脚本
    - 路径: `/packages/async/async-call-rpc-electron/examples/renderer-acquire-main-port-example/preload.ts`

12. **transferable-args.spec.ts** - 测试文件
    - 路径: `/packages/async/async-call-rpc/test/transferable-args.spec.ts`

---

## 关键问题解答

### Q1: validateAndDetectArgType 如何判断 args 是 Transferable?

**源代码** (`autoDetectTransfer.ts` 第 35-47 行):

```typescript
function isTransferable(value: any): boolean {
  if (value == null) return false;

  // 策略 1: 通过 Object.prototype.toString 检查已知类型
  const typeName = Object.prototype.toString.call(value).slice(8, -1);
  if (TRANSFERABLE_TYPES.includes(typeName)) return true;

  // 策略 2: Duck-typing - 任何有 postMessage 方法的对象
  if (typeof value === 'object' && typeof value.postMessage === 'function') {
    return true;
  }

  return false;
}
```

**已知 Transferable 类型** (`autoDetectTransfer.ts` 第 9-18 行):

```typescript
const TRANSFERABLE_TYPES = [
  'MessagePort',      // ← Web API 和 Electron
  'MessagePortMain',  // ← Electron 特有
  'ArrayBuffer',
  'OffscreenCanvas',
  'ImageBitmap',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
];
```

**validateAndDetectArgType 逻辑** (`autoDetectTransfer.ts` 第 60-94 行):

```typescript
function validateAndDetectArgType(args: any[]): {
  hasTransferable: boolean;
  transferables: any[];
} {
  if (!args || args.length === 0) {
    return { hasTransferable: false, transferables: [] };
  }

  const transferables: any[] = [];
  let hasTransferable = false;
  let hasNonTransferable = false;

  // 关键规则: 遍历每个 arg
  for (const arg of args) {
    if (isTransferable(arg)) {
      hasTransferable = true;
      transferables.push(arg);
    } else {
      hasNonTransferable = true;
    }
  }

  // ⚠️ 不能混合 Transferable 和非 Transferable
  if (hasTransferable && hasNonTransferable) {
    throw new Error(
      `Invalid args: Cannot mix Transferable objects (MessagePort, ArrayBuffer, etc.) ` +
        `with regular serializable data. All args must be either all Transferable or all serializable. ` +
        `Received mixed args.`
    );
  }

  return {
    hasTransferable,  // true 只有在所有 args 都是 Transferable
    transferables,    // 提取出的 Transferable 对象数组
  };
}
```

**关键点**:
- ✅ 所有 args 都必须是 Transferable
- ✅ 或所有 args 都是可序列化数据
- ❌ 不能混合
- 返回 `hasTransferable = true` 才会改变请求类型为 `TransferableArgsRequest`

---

### Q2: `params: [].concat(props.args)` 对非数组参数的影响?

**源代码** (`prepareRequestData.ts` 第 45-56 行):

```typescript
// CASE 2: SendingProps call convention
return {
  requestPath: props.requestPath,
  methodName: props.methodName,
  params: [].concat(props.args),  // ← 这一行
  transfer: props.transfer || args[0] || [],
  isOptionsRequest: !!props.isOptionsRequest,
  requestType:
    (props.requestType as RequestType) || RequestType.PromiseRequest,
};
```

**分析**:

`[].concat()` 是将参数转换为数组的标准方法:

| 输入 | 结果 | 说明 |
|------|------|------|
| `undefined` | `[undefined]` | 创建包含 undefined 的数组 |
| `null` | `[null]` | 创建包含 null 的数组 |
| `42` | `[42]` | 单个数字转数组 |
| `port` (单个对象) | `[port]` | 单个对象转数组 |
| `[port1, port2]` | `[port1, port2]` | 已是数组，保持原样 |
| `{name: 'test'}` | `[{...}]` | 单个对象转数组 |

**对于 Transferable 对象的影响**:

```typescript
// 例1: 单个 MessagePort
const port = new MessagePort();
client.assignPort(port);
// → props.args = port (不是数组!)
// → params = [].concat(port) = [port]
// → validateAndDetectArgType([port]) → hasTransferable = true
// → 请求类型变为 TransferableArgsRequest
// ✅ 正确处理

// 例2: 多个 MessagePort
const [port1, port2] = new MessageChannelMain();
client.processPorts([port1, port2]);
// → props.args = [port1, port2]
// → params = [].concat([port1, port2]) = [port1, port2]
// → validateAndDetectArgType([port1, port2]) → hasTransferable = true
// ✅ 正确处理

// 例3: 混合参数 (会抛出错误)
client.method({port: port, name: 'test'});
// → props.args = {port: port, name: 'test'}
// → params = [].concat({...}) = [{port: port, name: 'test'}]
// → validateAndDetectArgType([{...}]) → hasTransferable = false (对象本身不是 Transferable)
// ✅ 这是序列化对象，不是 Transferable 混合
```

**重点**:
- `[].concat(props.args)` 确保 `params` 总是数组
- 对单个 Transferable 对象工作正常
- 对数组 Transferable 也工作正常
- 防止传递 undefined args 导致的崩溃

---

### Q3: 从 sender `assignPort(port)` → `prepareNormalData` → `handleResponse` 的完整数据流转

#### **SENDER 端 (主进程 - main.ts)**

```typescript
// main.ts 第 35-42 行
acquirePort(): [Electron.MessagePortMain] {
  const { port1, port2 } = new MessageChannelMain();
  if (!count) {
    console.log('trigger assign');
    client.assignPort(port2);  // ← 这里调用！
    count = count + 1;
  }
  return [port1];  // 返回给 renderer
}
```

**数据流 1: `client.assignPort(port2)` 调用**

```
client.assignPort(port2)
  ↓
代理拦截 (Proxy handler)
  ↓
endpoint.request({
  requestPath: 'renderer-api',
  methodName: 'assignPort',
  args: port2  // ← 非数组!
})
```

#### **Sender 中间件管道** (AbstractChannelProtocol._senderMiddleware)

```typescript
[
  prepareNormalData,        // STEP 1
  updateSeqInfo,            // STEP 2
  handleDisconnectedRequest,// STEP 3
  serialize,                // STEP 4
  sendRequest,              // STEP 5
]
```

##### **STEP 1: prepareNormalData** (`prepareRequestData.ts` 第 76-119 行)

```typescript
export const prepareNormalData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    const seqId = channel.seqId;  // 例: "seq-assign-port-123"
    const parsed = parseRequestArgs(props, args);
    
    // parseRequestArgs 内部:
    // props.args = port2 (MessagePortMain 对象)
    // params = [].concat(port2) = [port2]
    // transfer = [] (未指定)
    
    const { requestPath, methodName, params, isOptionsRequest } = parsed;
    // requestPath: 'renderer-api'
    // methodName: 'assignPort'
    // params: [port2]  ← 现在是数组!
    
    let { transfer, requestType } = parsed;
    // transfer: []
    // requestType: 'pr' (PromiseRequest)
    
    const hasExplicitTransfer = transfer && transfer.length > 0;
    // false
    
    if (!hasExplicitTransfer && requestType === RequestType.PromiseRequest) {
      // 执行自动检测
      const { hasTransferable, transferables } =
        validateAndDetectArgType(params);
      
      // validateAndDetectArgType([port2]):
      // - isTransferable(port2) → true (MessagePortMain)
      // - hasTransferable = true
      // - transferables = [port2]
      
      if (hasTransferable) {  // true
        requestType = RequestType.TransferableArgsRequest;  // 'tar'
        transfer = transferables;  // [port2]
      }
    }
    
    const header: RequestEntryHeader = [
      'tar',              // TransferableArgsRequest
      'seq-assign-port-123',
      'renderer-api',
      'assignPort'
    ];
    
    return {
      seqId: 'seq-assign-port-123',
      isOptionsRequest: false,
      data: [header, [port2]],  // ← body 含有 port2
      transfer: [port2],        // ← transfer list!
    };
  };
  
  fn.lifecycle = SendMiddlewareLifecycle.Prepare;
  return fn;
};
```

**输出状态**:
```javascript
{
  seqId: 'seq-assign-port-123',
  isOptionsRequest: false,
  data: [
    ['tar', 'seq-assign-port-123', 'renderer-api', 'assignPort'],
    [port2]  // MessagePortMain 对象
  ],
  transfer: [port2]  // ← Transferable list!
}
```

##### **STEP 2: updateSeqInfo** (简单，只添加 seqId 跟踪)

```typescript
// 创建 Deferred 以等待响应
protocol.ongoingRequests.set('seq-assign-port-123', deferred);
```

##### **STEP 3: handleDisconnectedRequest** (检查连接状态)

```typescript
if (!protocol.isConnected()) {
  protocol.pendingSendEntries.add(entry);
  return; // 离线队列
}
// 继续...
```

##### **STEP 4: serialize** (`buffer.ts` 第 114-133 行)

```typescript
export const serialize = (channel: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data } = value;
    let encoded = data;
    
    try {
      encoded = channel.writeBuffer.encode(data);
      // 把 RPC 消息 [header, body] 编码成 JSON 字符串
      // encoded = '[[["tar","seq-assign-port-123","renderer-api","assignPort"],[]]'
      // ⚠️ port2 在 body 中被编码了，但会在下一步通过 transfer 参数处理
    } catch (err) {
      console.error('[encode error]', data, err);
    }
    
    return {
      ...value,
      data: encoded,  // 现在是字符串
    };
  };
  
  fn.lifecycle = SendMiddlewareLifecycle.DataOperation;
  return fn;
};
```

**输出状态**:
```javascript
{
  seqId: 'seq-assign-port-123',
  isOptionsRequest: false,
  data: '[["tar","seq-assign-port-123","renderer-api","assignPort"],[[<Circular>]]]',
  transfer: [port2]  // ← 仍然保存!
}
```

##### **STEP 5: sendRequest** (`sendRequest.ts` 第 53-80 行)

```typescript
export const sendRequest = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, transfer } = value;
    
    if (transfer && transfer.length > 0) {
      // 我们的情况!
      channelProtocol.send(data, transfer);
      // 调用底层 send，传入:
      // - data: 编码后的消息
      // - transfer: [port2]  ← MessagePortMain 对象!
    } else {
      channelProtocol.send(data);
    }
    
    return value;
  };
  
  fn.lifecycle = SendMiddlewareLifecycle.Send;
  return fn;
};
```

**最终发送** (IPCMainChannel.send):
```typescript
// Electron IPC
webContents.send('app-rpc', encodedData, [port2]);
// 或等价的
ipcMain.send('channel-name', encodedData, [port2]);
```

---

#### **RECEIVER 端 (Renderer 进程 - preload.ts)**

收到消息时触发接收管道:

```typescript
[
  normalizeMessageChannelRawMessage,  // STEP 1
  deserialize,                        // STEP 2
  handleRequest,                      // STEP 3
  handleResponse,                     // STEP 4
]
```

##### **STEP 1: normalizeMessageChannelRawMessage** (`normalize.ts` 第 21-40 行)

```typescript
export const normalizeMessageChannelRawMessage = () => (event: MessageEvent) => {
  const data = event.data;
  // data = '[["tar","seq-assign-port-123","renderer-api","assignPort"],[[<Circular>]]]'
  
  const ports = event.ports ? [...event.ports] : [];
  // ports = [port2]  // ← 这是关键! MessagePortMain 对象在这里!
  
  return {
    event,
    data,
    ports,  // ← 保存 ports!
  };
};
```

**输出状态**:
```javascript
{
  event: MessageEvent,
  data: '[["tar","seq-assign-port-123","renderer-api","assignPort"],[]]',
  ports: [port2]  // ← MessagePortMain 对象保存在这里!
}
```

##### **STEP 2: deserialize** (`buffer.ts` 第 183-204 行)

```typescript
export const deserialize = (channel: AbstractChannelProtocol) => 
  (value: NormalizedRawMessageOutput) => {
    const { data } = value;
    let decoded = data;
    
    try {
      decoded = channel.readBuffer.decode(data);
      // 把 JSON 字符串解码成对象
      // decoded = [
      //   ['tar', 'seq-assign-port-123', 'renderer-api', 'assignPort'],
      //   []  ← body 是空数组 (TransferableArgsRequest 的正常行为)
      // ]
    } catch (err) {
      console.error('[decode error]', data, err);
    }
    
    // ⚠️ CRITICAL: 保留 ports 字段!
    return {
      ...value,  // 保留 event 和 ports
      data: decoded,  // 只更新 data 字段
    };
  };
```

**输出状态** (重要!):
```javascript
{
  event: MessageEvent,
  data: [
    ['tar', 'seq-assign-port-123', 'renderer-api', 'assignPort'],
    []  // body 是空的
  ],
  ports: [port2]  // ← 仍然保存!
}
```

##### **STEP 3: handleRequest** (`handleRequest.ts` 第 65-103 行)

```typescript
export const handleRequest = (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const { data, ports } = message;  // ← 接收 ports
    const header = data[0];
    const body = data[1];
    const type = header[0];  // 'tar'
    
    const seqId = header[1];  // 'seq-assign-port-123'
    const requestPath = header[2];  // 'renderer-api'
    const methodName = header[3];  // 'assignPort'
    let args = body[0];  // undefined (TransferableArgsRequest 的 body 是空的)
    
    // ✨ SPECIAL HANDLING: TransferableArgsRequest
    if (type === RequestType.TransferableArgsRequest) {  // 'tar'
      args = ports || [];  // ← 从 ports 重建 args!
      // args = [port2]  // ← 现在 args 有了实际的 port!
      
      console.debug(
        `[handleRequest] TransferableArgsRequest: reconstructed ${args.length} args from message.ports`
      );
    }
    
    // ... 执行 handler
    // 找到对应的 handler:
    let handler = serviceHost.getHandler('renderer-api', 'assignPort');
    // handler = (port) => { console.log('assign port', port); }
    
    // 调用 handler
    const result = handler(args);  // handler(port2)
    // console.log('assign port', port2) 被执行
    
    // 返回响应
    const response = await Promise.resolve(result);  // undefined
    
    if (isPortLike(response)) {
      // response 不是 port，是 undefined，所以跳过
    } else {
      const responseHeader = [ResponseType.ReturnSuccess, seqId];
      // [ResponseType.ReturnSuccess, 'seq-assign-port-123']
      
      let sendData = protocol.writeBuffer.encode([
        responseHeader,
        [response]  // [undefined]
      ]);
      
      safeSendReply(protocol, sendData);
      // 发送回 sender
    }
  };
```

**关键点**:
- ✅ `args = ports || []` 从 `message.ports` 重建了 args
- ✅ handler 接收 `port2` 对象，而不是序列化的数据
- ✅ 响应发送回去

##### **STEP 4: handleResponse** (在 Renderer 中, 如果有响应)

```typescript
// 通常对 assignPort 这样的单向调用，响应回到 sender
// 但这里 assignPort 是从 sender 调用的，所以 handleResponse 在 sender 端执行
```

---

#### **SENDER 端响应处理** (回到主进程)

接收到响应:

```typescript
// 响应中间件管道执行
// normalizeMessageChannelRawMessage → deserialize → handleRequest → handleResponse

const handleResponse = (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const { data, ports } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0];  // ResponseType.ReturnSuccess
    
    const seqId = header[1];  // 'seq-assign-port-123'
    
    // 查找对应的 deferred
    const findDefer = protocol.ongoingRequests.get(`${seqId}`);
    // findDefer 是我们在 updateSeqInfo 中创建的 Deferred
    
    if (findDefer) {
      const isSubscription = (findDefer as any)._isSubscription;  // false
      
      if (!isSubscription) {
        // ONE-SHOT REQUEST
        protocol.ongoingRequests.delete(`${seqId}`);
        
        if (type === ResponseType.PortSuccess) {
          // PortSuccess 处理 (针对返回 Port 的调用)
          findDefer.resolve(ports && ports[0]);
        } else if (type === ResponseType.ReturnFail) {
          // 错误处理
          const rawError = body[0];
          findDefer.reject(new RPCError({...}));
        } else {
          // ReturnSuccess
          findDefer.resolve(body[0]);  // undefined
        }
      }
    }
  };
```

**最终结果**:
```typescript
const promise = client.assignPort(port2);
promise.then(() => {
  console.log('assignPort completed!');
});
// → resolve 被调用
// → Promise 解决为 undefined (正常的单向调用响应)
```

---

### Q4: PortSuccess 响应时 `findDefer.resolve(ports && ports[0])` 的行为?

**源代码** (`handleResponse.ts` 第 199-203 行):

```typescript
if (type === ResponseType.PortSuccess) {
  // ✓ IMPORTANT: Use message.ports[0], not body[0]
  // The actual MessagePort was transferred via Transferable mechanism
  // and is available in the ports array from the normalize middleware
  findDefer.resolve(ports && ports[0]);
}
```

**详细解析**:

#### **场景: Server 返回 MessagePort**

```typescript
// Server (main.ts)
acquirePort(): [Electron.MessagePortMain] {
  const { port1, port2 } = new MessageChannelMain();
  client.assignPort(port2);  // 发送给 renderer
  return [port1];  // ← 返回给 renderer!
}

// Client (preload.ts)
api.acquirePort().then((port) => {
  console.log('port ---', port);  // 应该是 MessagePort 对象!
});
```

#### **Server 端 (handleRequest)**

```typescript
// handleRequest.ts 第 364-379 行
const response = await Promise.resolve(result);  // port1

if (isPortLike(response)) {  // true, port1 是 MessagePort!
  const portHeader = [ResponseType.PortSuccess, seqId];
  const sendData = protocol.writeBuffer.encode([portHeader, []]);
  
  if (protocol.isConnected()) {
    (protocol.sendReply as (d: any, t?: any[]) => void)(
      sendData,
      [].concat(response)  // transfer: [port1]
    );
  }
  return;
}
```

**发送的消息**:
```javascript
{
  data: '[["ps","seq-acquire-port-456"],[]]',  // "ps" = PortSuccess
  transfer: [port1]  // MessagePort 对象
}
```

#### **Client 端 (normalize)**

```typescript
export const normalizeMessageChannelRawMessage = () => (event: MessageEvent) => {
  const data = event.data;  // "[["ps","seq-acquire-port-456"],[]]"
  const ports = event.ports ? [...event.ports] : [];  // [port1]
  
  return {
    event,
    data,
    ports,  // ← MessagePort 对象在这里!
  };
};
```

#### **Client 端 (deserialize)**

```typescript
export const deserialize = (channel: AbstractChannelProtocol) =>
  (value: NormalizedRawMessageOutput) => {
    let decoded = channel.readBuffer.decode(value.data);
    // decoded = [["ps", "seq-acquire-port-456"], []]
    
    return {
      ...value,  // 保留 ports!
      data: decoded,
    };
  };
```

**最终消息对象**:
```javascript
message = {
  event: MessageEvent,
  data: [["ps", "seq-acquire-port-456"], []],
  ports: [port1]  // ← 关键!
}
```

#### **Client 端 (handleResponse)**

```typescript
const handleResponse = (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const { data, ports } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0];  // "ps" = ResponseType.PortSuccess
    const seqId = header[1];  // "seq-acquire-port-456"
    
    const findDefer = protocol.ongoingRequests.get(`${seqId}`);
    
    if (findDefer) {
      if (type === ResponseType.PortSuccess) {
        // ⭐ 这是关键行!
        findDefer.resolve(ports && ports[0]);
        // 检查:
        // - ports: [port1] ✓
        // - ports && ports[0]: port1 对象 ✓
        // - 解决 Promise 为: port1
      }
    }
  };
```

#### **Client 端 (应用代码)**

```typescript
api.acquirePort().then((port) => {
  console.log('port ---', port);  // port1 (实际的 MessagePort 对象)
  
  // 现在可以使用 port!
  port.postMessage({ some: 'message' });
  port.addEventListener('message', (event) => {
    console.log(event.data);
  });
});
```

---

## 完整的消息流图示

```
┌─────────────────────────────────────────────────────────────┐
│                        SENDER SIDE                          │
│                      (Main Process)                         │
└─────────────────────────────────────────────────────────────┘

1️⃣ 应用代码调用
   client.assignPort(port2)
   
2️⃣ Sender 中间件管道
   ┌──────────────────────────────────────────┐
   │ prepareNormalData                        │
   │ input:  port2 (MessagePortMain)          │
   │ output: {                                │
   │   data: [header, body],                 │
   │   transfer: [port2],                    │
   │   requestType: 'tar'                    │
   │ }                                       │
   └──────────────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────┐
   │ updateSeqInfo                            │
   │ - 创建 Deferred: deferred-assign-123    │
   │ - 保存到 ongoingRequests                 │
   └──────────────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────┐
   │ serialize                                │
   │ - 编码 data 为 JSON 字符串               │
   └──────────────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────┐
   │ sendRequest                              │
   │ - channel.send(data, transfer: [port2])  │
   └──────────────────────────────────────────┘
                    ↓
             通过 IPC 发送
             (Electron WebContents.send)
                    │
                    │ data: JSON 字符串
                    │ transfer: [port2]
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                      RECEIVER SIDE                          │
│                    (Renderer Process)                       │
└─────────────────────────────────────────────────────────────┘

3️⃣ Receiver 中间件管道
   ┌──────────────────────────────────────────┐
   │ normalizeMessageChannelRawMessage        │
   │ input:  event.data, event.ports         │
   │ output: {                                │
   │   data: JSON 字符串,                    │
   │   ports: [port2]  ← 关键!               │
   │ }                                       │
   └──────────────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────┐
   │ deserialize                              │
   │ input:  data (JSON 字符串)              │
   │ output: {                                │
   │   data: [header, body],                 │
   │   ports: [port2]  ← 保留!               │
   │ }                                       │
   └──────────────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────┐
   │ handleRequest                            │
   │ - type = 'tar' (TransferableArgsRequest)│
   │ - args = ports || [] = [port2]          │
   │ - 调用 handler(port2)                   │
   │   → assignPort(port2) {                 │
   │       console.log('assign port', port2) │
   │     }                                   │
   │ - 返回响应: ReturnSuccess                │
   └──────────────────────────────────────────┘
                    ↓
             响应发送回 sender
                    │
                    ↓
   ┌──────────────────────────────────────────┐
   │ handleResponse (在 sender 端)            │
   │ - 找到 deferred-assign-123              │
   │ - 调用 deferred.resolve(undefined)      │
   │ - Promise 完成                          │
   └──────────────────────────────────────────┘
                    ↓
   应用代码: 
   api.assignPort(port2).then(() => {
     console.log('assignPort completed!');
   });
```

---

## 返回 MessagePort 的流程

```
┌─────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                          │
│                      (Main Process)                         │
└─────────────────────────────────────────────────────────────┘

acquirePort(): [Electron.MessagePortMain] {
  const { port1, port2 } = new MessageChannelMain();
  client.assignPort(port2);
  return [port1];  // ← 返回 port1!
}
                    ↓
   handleRequest 检测 isPortLike(port1)
                    ↓
   ┌──────────────────────────────────────────┐
   │ 创建 PortSuccess 响应                   │
   │ header: [ResponseType.PortSuccess, seqId]│
   │ body: []  (空!)                          │
   │ transfer: [port1]  ← port1 在这里!      │
   └──────────────────────────────────────────┘
                    ↓
         sendReply(data, [port1])
                    │
                    │ 通过 IPC 发送
                    │ data: "ps" 响应
                    │ transfer: [port1]
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT SIDE                           │
│                    (Renderer Process)                       │
└─────────────────────────────────────────────────────────────┘

normalize:
  message.ports = [port1]  ← 提取出来!
                    ↓
deserialize:
  保留 ports = [port1]  ← 保存!
                    ↓
handleResponse:
  if (type === 'ps') {  // PortSuccess
    findDefer.resolve(ports && ports[0]);
    // 解决为: port1
  }
                    ↓
api.acquirePort().then((port) => {
  console.log(port);  // port1 对象!
  port.postMessage('hello');  // ✅ 工作正常!
});
```

---

## 关键点总结

| 问题 | 答案 |
|------|------|
| **Q1: isTransferable 判断逻辑** | 1. 检查 Object.toString 是否在 TRANSFERABLE_TYPES 中 2. Duck-typing: 有 postMessage 方法即为 port-like |
| **Q2: concat 对参数的影响** | 确保 args 总是数组；对单个和多个 Transferable 都工作；处理 undefined 安全 |
| **Q3: assignPort 流程** | sender 端自动检测 → TransferableArgsRequest → transfer list 发送 → receiver 端从 ports 重建 args → handler 调用 |
| **Q4: PortSuccess 解决方式** | 从 message.ports[0] 而非 body[0] 获取，因为 Transferable 对象在 ports 数组中 |

---

## 文件引用汇总

### 关键源文件路径

```
/packages/async/async-call-rpc/src/
├── middlewares/
│   ├── autoDetectTransfer.ts          # isTransferable, validateAndDetectArgType
│   ├── prepareRequestData.ts          # prepareNormalData, parseRequestArgs
│   ├── handleResponse.ts              # PortSuccess 处理
│   ├── handleRequest.ts               # TransferableArgsRequest 重建
│   ├── sendRequest.ts                 # 发送 transfer list
│   ├── normalize.ts                   # ports 提取
│   └── buffer.ts                      # deserialize 保留 ports
├── types/
│   ├── rpc.ts                         # RequestType.TransferableArgsRequest
│   └── protocol.ts                    # SendingProps 定义
└── protocol/
    └── AbstractChannelProtocol.ts     # 中间件管道定义
```

### 示例和测试文件

```
/packages/async/async-call-rpc-electron/examples/
└── renderer-acquire-main-port-example/
    ├── main.ts                        # Server: acquirePort(), client.assignPort()
    ├── preload.ts                     # Client: assignPort handler
    └── src/
        ├── App.tsx                    # UI
        └── main.tsx                   # Entry

/packages/async/async-call-rpc/test/
└── transferable-args.spec.ts          # TransferableArgsRequest 测试
```

