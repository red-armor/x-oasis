---
title: Transferable 对象传递指南
description: MessagePort、ArrayBuffer 等 Transferable 对象在 async-call-rpc 中的完整使用指南
category: Async
order: 90
---

# Transferable 对象传递指南

本文档涵盖 `@x-oasis/async-call-rpc` 中 Transferable 对象传递的设计、实现和使用方式。

## 目录

- [核心概念](#核心概念)
- [支持的 Transferable 类型](#支持的-transferable-类型)
- [架构设计](#架构设计)
- [使用示例](#使用示例)
- [接收端处理链](#接收端处理链)
- [序列化错误参考](#序列化错误参考)
- [最佳实践](#最佳实践)
- [FAQ](#faq)

---

## 核心概念

在 Electron 主进程和渲染进程之间、或者在 Web Workers 之间传递 MessagePort 时，需要理解三个关键概念：

1. **Transferable Objects** - 可以在领域间转移所有权的对象（转移后发送方不可再使用）
2. **Transfer List** - 告诉传输层哪些对象需要转移（而不是复制）
3. **Auto-Detection** - `prepareNormalData` 中间件内置的自动 Transferable 检测

## 支持的 Transferable 类型

| 类型              | 说明                          | 环境     | 用途                 |
| ----------------- | ----------------------------- | -------- | -------------------- |
| `MessagePort`     | 双向通信通道                  | 所有     | RPC 通信、事件监听   |
| `MessagePortMain` | Electron 主进程的 MessagePort | Electron | 主进程侧通信         |
| `ArrayBuffer`     | 二进制数据缓冲区              | 所有     | 大数据传输、性能优化 |
| `ImageBitmap`     | 图像数据                      | 浏览器   | 渲染进程间共享图像   |
| `OffscreenCanvas` | GPU 加速的 Canvas             | 浏览器   | 离屏渲染             |
| `ReadableStream`  | 可读流                        | 浏览器   | 流式数据传输         |
| `WritableStream`  | 可写流                        | 浏览器   | 流式数据接收         |
| `TransformStream` | 转换流                        | 浏览器   | 流式数据转换         |

此外，任何具有 `postMessage` 方法的 duck-typed 对象也会被自动识别为 Transferable。

---

## 架构设计

### 设计背景

原始问题：当通过 RPC 调用传递 `MessagePort` 作为函数参数时，serialize/deserialize 中间件会尝试序列化 MessagePort，导致 `Error: Failed to serialize arguments`。

Electron IPC 的 `postMessage(data, transfer)` 支持 transferable 列表，但 RPC 框架原本只在返回值是 port 时处理（`PortSuccess` 响应类型），不支持参数中包含 port 的情况。

### 解决方案：在 Prepare 阶段自动检测

自动检测逻辑集成在 `prepareNormalData` 中间件中，而不是作为独立中间件：

```
Client Code
  ↓
channel.makeRequest(path, method, ...args)
  ↓
[prepareNormalData]
├─ 解析参数
├─ 检测 args 类型：是否全是 Transferable?
│  ├─ 全 Transferable → RequestType = 'tar', transfer = args
│  ├─ 全 serializable → RequestType = 'pr', transfer = []
│  └─ 混用 → 抛错
└─ 返回准备好的请求
  ↓
[updateSeqInfo] → 分配 seqId
  ↓
[handleDisconnectedRequest] → 检查连接
  ↓
[serialize] → 编码消息
  ↓
[sendRequest] → 发送（带 transfer list）
```

### 关键类型

```typescript
enum RequestType {
  PromiseRequest = 'pr', // 普通请求
  TransferableArgsRequest = 'tar', // 参数全为 Transferable 的请求
  // ...
}
```

### 约束条件

```
args 必须是以下之一：
├─ 全 Transferable (MessagePort, ArrayBuffer, ...)
│  └─ 自动使用 TransferableArgsRequest
├─ 全 serializable (对象, 基本类型, ...)
│  └─ 使用 PromiseRequest
└─ 混用
   └─ 抛错：Invalid: args contain both Transferable and serializable
```

如果需要同时传递 Transferable 和普通数据，可以：

1. 将普通数据包装在另一个调用中
2. 分开两次调用
3. 为 Transferable 参数设计独立的方法

---

## 使用示例

### 场景 1: Return Value 为 MessagePort

主进程返回 MessagePort 给渲染进程：

**主进程（Main）**

```typescript
import { MessageChannelMain } from 'electron';

const mainService = {
  acquirePort() {
    const { port1, port2 } = new MessageChannelMain();

    port1.on('message', (message) => {
      console.log('Main received:', message);
      port1.postMessage(`Echo: ${message}`);
    });
    port1.start();

    // 直接返回 port2，框架自动处理 transfer list
    return port2;
  },
};
```

**渲染进程（Renderer）**

```typescript
async function setupDirectCommunication() {
  // 获取主进程返回的 MessagePort
  const port = await endpoint.acquirePort();

  port.onmessage = (event) => {
    console.log('Renderer received:', event.data);
  };
  port.start();
  port.postMessage('Hello from renderer');
}
```

### 场景 2: Arguments 为 Transferable（ArrayBuffer）

```typescript
async function sendImageData() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const imageData = canvas.getContext('2d')?.getImageData(0, 0, 800, 600);
  const arrayBuffer = imageData?.data.buffer;

  // 直接传递 ArrayBuffer，自动检测为 Transferable
  const result = await endpoint.processImageData(arrayBuffer);

  // 注意：arrayBuffer 在发送后变成 detached，不能再使用
}
```

### 场景 3: 手动指定 Transfer List（高级）

当需要显式控制 transfer list 时，通过 `SendingProps` 指定：

```typescript
const buffer = new ArrayBuffer(1024);
await endpoint.processData({
  requestPath: 'Service',
  methodName: 'processData',
  args: [buffer],
  transfer: [buffer], // 显式指定，跳过自动检测
});
```

---

## 接收端处理链

### 完整数据流

```
发送端（Main Process）
  ↓
[1] autoDetect 检测到 Transferable
  transfer list = [port]

[2] channel.send(data, transfer)
  webContents.postMessage(channelName, data, [port])

接收端（Renderer Process）
  ↓
[1] IPCRendererChannel.on()
  ports = _event.ports    // 从 Electron IPC event 提取

[2] normalize 中间件
  { data: "...", ports: [port] }  // 保留 ports

[3] deserialize 中间件
  { ...value, data: decoded }     // 通过 spread 保留 ports

[4] handleResponse / handleRequest
  if (type === 'tar') {
    args = message.ports;          // 从 ports 重建 args
  }
  if (type === 'ps') {
    resolve(message.ports[0]);     // PortSuccess 使用 ports[0]
  }

[5] 业务代码
  const port = await endpoint.acquirePort();
  port.postMessage('hello');       // 可用
```

### 接收端关键问题及解决

**问题：Ports 在中间件链中丢失**

每个中间件都必须保留 `ports` 字段：

```typescript
// ❌ 错误：只返回 data，ports 丢失
return { data: decoded };

// ✅ 正确：使用 spread 保留所有字段
return { ...value, data: decoded };
```

**问题：handleResponse 使用错误的字段**

```typescript
// ❌ 错误：PortSuccess 时 body 通常是空的
resolve(body[0]);

// ✅ 正确：使用 message.ports
resolve(message.ports[0]);
```

**问题：IPC 通道未传递 ports**

```typescript
// ❌ 错误
listener(args[0]); // 遗漏了 event.ports

// ✅ 正确
const ports = _event.ports || [];
listener({ data, ports });
```

### 改造对应关系

| 接收阶段 | 文件                    | 关键操作                                     |
| -------- | ----------------------- | -------------------------------------------- |
| 物理传输 | IPCRendererChannel.ts   | 提取 `_event.ports`                          |
| 物理传输 | IPCMainChannel.ts       | 提取 `_event.ports`                          |
| 规范化   | normalize.ts            | 保留 `event.ports`                           |
| 反序列化 | buffer.ts (deserialize) | `{...value}` 保留 ports                      |
| 响应路由 | handleResponse.ts       | PortSuccess 用 `ports[0]`                    |
| 请求处理 | handleRequest.ts        | TransferableArgsRequest 用 `ports` 重建 args |

---

## 序列化错误参考

当 `serialize/deserialize` 中间件未正确配置时，会导致以下错误。

### 快速诊断表

| 错误信息                                  | 最可能原因                      | 解决方案                |
| ----------------------------------------- | ------------------------------- | ----------------------- |
| `Failed to serialize arguments`           | `serialize` 未调用 `encode()`   | 启用 serialize 中间件   |
| `Cannot read property 'xxx' of undefined` | `deserialize` 未调用 `decode()` | 启用 deserialize 中间件 |
| `Assignment to constant variable`         | MessagePort 数据格式错误        | 检查端口序列化链        |
| `Cannot destructure property`             | 数据仍为编码格式                | 检查 decode 逻辑        |
| 沉默故障/数据不一致                       | 部分中间件正确，部分失败        | 添加数据验证            |

### 错误场景

#### Electron 序列化失败

```
handleRequest → encode() → serialize 未调用 encode
  → IPCMainChannel.send(编码对象)
  → Electron 尝试 JSON 序列化
  → ❌ Error: Failed to serialize arguments
```

解决：确保 serialize 中间件调用 `writeBuffer.encode()`。

#### 数据反序列化失败

```
接收到编码数据 → deserialize 未调用 decode
  → const [header, body] = data;  // ❌ 无法解构编码对象
```

解决：确保 deserialize 中间件调用 `readBuffer.decode()`。

#### 级联失败示例

```
主进程 acquirePort() 返回 MessagePort
  ↓ ✅ handleRequest 编码成功
  ↓ ❌ serialize 未调用 encode()
  ↓ ❌ Electron 序列化失败
即使跨过序列化：
  ↓ ❌ deserialize 未调用 decode()
  ↓ ❌ port.postMessage() → "postMessage is not a function"
```

#### 沉默故障（最危险）

数据以错误格式到达但代码继续运行，可能导致数据被错误处理。

防护方案：

```typescript
const validateDecodedData = (data: any) => {
  if (!Array.isArray(data) || data.length !== 2) {
    throw new Error(`Invalid decoded data format: expected [header, body]`);
  }
  const [header] = data;
  if (!Array.isArray(header) || header.length < 2) {
    throw new Error(`Invalid header format: ${JSON.stringify(header)}`);
  }
};
```

### 部署前检查清单

- [ ] `serialize` 中间件已注册，`writeBuffer.encode()` 被调用
- [ ] `deserialize` 中间件已注册，`readBuffer.decode()` 被调用
- [ ] 错误处理带日志
- [ ] MessagePort 传输测试通过
- [ ] 没有沉默的数据不一致现象

---

## 最佳实践

### 推荐做法

```typescript
// 1. 直接传递 Transferable，依赖自动检测
const port = new MessagePort();
await service.method(port);

// 2. 转移后不要再使用原对象
const port = new MessagePort();
await service.method(port);
// ❌ port.postMessage('hello'); // Error: port is detached

// 3. 对性能关键路径使用 ArrayBuffer transfer
const buffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB
await service.processData(buffer); // 转移而非复制

// 4. 需要双向通信时，先创建 port pair
const { port1, port2 } = new MessageChannel();
// port1 留本地，port2 发送给对端
await service.setupChannel(port2);
port1.onmessage = (e) => console.log(e.data);
```

### 常见错误

```typescript
// ❌ 转移后还在用
const port = new MessagePort();
await service.method(port);
port.postMessage('hello'); // Error: port is detached

// ❌ 同一个 buffer 转移两次
const buffer = new ArrayBuffer(1024);
await service1.method(buffer);
await service2.method(buffer); // Error: buffer was transferred!

// ❌ 混用 Transferable 和普通参数
await service.method(port, { callback: fn }); // 抛错
```

### TypeScript 类型定义

```typescript
interface Service {
  getPort(): Promise<MessagePort>;
  processBuffer(buffer: ArrayBuffer): Promise<void>;
}

const endpoint = createEndpoint<Service>({ channel });
const port = await endpoint.getPort(); // 类型: MessagePort
```

---

## FAQ

### Q: 为什么 MessagePort 发送后不能用了？

Transferable 对象转移后所有权归接收方，发送方变成 detached 状态。如需双向通信，使用 `MessageChannel` 创建 port pair。

### Q: 自动检测有性能开销吗？

很小，O(n) 复杂度的一次扫描，远低于序列化成本。

### Q: 可以只对某些方法启用自动检测吗？

自动检测是全局的，但只在参数确实包含 Transferable 时生效。不传 Transferable 时走普通流程。

### Q: 支持哪些环境？

Transferable Objects 是标准 Web API，所有现代浏览器和 Electron 都支持。Node.js `worker_threads` 也支持。

### Q: 如何调试 transfer 是否生效？

```typescript
const buffer = new ArrayBuffer(1024);
console.log(buffer.byteLength); // 1024
await service.processBuffer(buffer);
console.log(buffer.byteLength); // 0 (detached = 转移成功)
```

---

## 相关源码

| 文件                                    | 职责                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| `src/middlewares/autoDetectTransfer.ts` | `isTransferable`、`validateAndDetectArgType` 工具函数 |
| `src/middlewares/prepareRequestData.ts` | `prepareNormalData` 中间件（含自动检测）              |
| `src/middlewares/handleRequest.ts`      | 接收端处理 `TransferableArgsRequest`                  |
| `src/middlewares/handleResponse.ts`     | 接收端处理 `PortSuccess` 响应                         |
| `src/middlewares/buffer.ts`             | serialize / deserialize 中间件                        |
| `src/middlewares/normalize.ts`          | 消息规范化，提取 ports                                |
| `src/middlewares/sendRequest.ts`        | 发送请求，带 transfer list                            |
| `src/types/rpc.ts`                      | `RequestType` 枚举定义                                |
| `src/types/protocol.ts`                 | `SendingProps` 类型（含 `transfer` 字段）             |
