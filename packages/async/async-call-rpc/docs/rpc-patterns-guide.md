---
title: RPC 调用模式指南
description: 梳理 RPC 三种调用模式的术语、源码实现与行业参考
category: Async
order: 10
---

# RPC 调用模式指南

本文档梳理 RPC 框架中三种核心调用模式的标准术语，帮助开发者建立统一的认知。

## 三种调用模式

| 场景 | 本库实现 | 标准术语 | JSON-RPC 2.0 |
|------|----------|----------|--------------|
| `client.invoke()` 获取返回值 | `PromiseRequest` | **Request** / **Unary** | Request (with `id`) |
| `client.onEvent()` 持续监听 | `SubscriptionRequest` / `EventMethodStop` | **Subscription** / **Server Streaming** | Subscription (扩展) |
| `client.notify()` 不需要返回值 | `SignalRequest` | **Notification** | Request (without `id`) |

### 1. Request（请求）

客户端发送请求，服务端返回结果或错误。

```typescript
// 客户端
const user = await client.getUser({ id: 1 });

// 服务端实现
async getUser({ id }) {
  return await db.users.find(id);
}
```

**特点**：
- 有 `id`，客户端等待响应
- 典型的一问一答模式
- 适用于 CRUD 操作、查询等

### 2. Subscription（订阅）

客户端建立长连接，服务端持续推送数据，直到客户端取消。

```typescript
// 客户端
const unsub = client.onMessage((msg) => {
  console.log('Received:', msg);
});

// 稍后取消订阅
unsub();

// 服务端实现
onMessage(callback) {
  setInterval(() => callback({ time: Date.now() }), 1000);
}
```

**特点**：
- 客户端发起订阅，服务端持续推送
- 支持 ping-pong 事件模式（`on*` 方法）
- 支持流式订阅（返回 observable）
- 两种取消方式：`SubscriptionStop` 和 `EventMethodStop`

### 3. Notification（通知）

客户端发送数据，服务端不返回响应。fire-and-forget 模式。

```typescript
// 客户端
client.notify({ event: 'user_click', data: '...' });
// 不等待返回值

// 服务端实现
notify(data) {
  analytics.track(data.event, data.data);
  // 无需返回任何内容
}
```

**特点**：
- 无 `id`，服务端不响应
- 适用于日志上报、埋点、命令下发等场景
- 无法确认服务端是否收到

## 源码实现

### RequestType 枚举

定义于 `src/types/rpc.ts`：

```typescript
export enum RequestType {
  /**
   * Normal request — waits for a single return value.
   */
  PromiseRequest = 'pr',

  /**
   * Fire-and-forget command — no return value expected.
   */
  SignalRequest = 'sr',

  /**
   * Subscription request — expects a stream of values.
   */
  SubscriptionRequest = 'sub',
}
```

### 客户端使用方式

```typescript
// Request
channel.makeRequest({
  requestPath: '/service',
  methodName: 'getUser',
  args: [{ id: 1 }],
});

// Subscription
channel.makeRequest({
  requestPath: '/service',
  methodName: 'onMessage',
  args: [],
  requestType: RequestType.SubscriptionRequest,
});

// Notification
channel.makeRequest({
  requestPath: '/service',
  methodName: 'track',
  args: [{ event: 'click' }],
  requestType: RequestType.SignalRequest,
});
```

## 跨框架对比

| 模式 | 本库 | JSON-RPC 2.0 | gRPC | tRPC |
|------|------|--------------|------|------|
| 获取返回值 | `PromiseRequest` | Request (with `id`) | Unary RPC | query / mutation |
| 持续监听 | `SubscriptionRequest` | Subscription (扩展) | Server Streaming | subscription |
| 无返回值 | `SignalRequest` | Notification | ❌ 无原生支持 | ❌ 无原生支持 |

### gRPC 四种模式

gRPC 定义了更细粒度的分类：

| gRPC 模式 | 适用场景 |
|-----------|----------|
| **Unary RPC** | Request - 单一请求，单一响应 |
| **Server Streaming RPC** | Subscription - 服务端流式推送 |
| **Client Streaming RPC** | 客户端流式发送，服务端返回单一响应 |
| **Bidirectional Streaming RPC** | 双向流式通信 |

gRPC 没有原生支持 Notification，通常通过 Unary + 忽略响应实现。

### tRPC

```typescript
// tRPC 的 procedure 类型
router({
  getUser: publicProcedure.query(() => {}),      // 对应 Request
  createUser: publicProcedure.mutation(() => {}), // 对应 Request
  onMessage: publicProcedure.subscription(() => {}), // 对应 Subscription
})
```

tRPC 同样没有原生 Notification 支持。

## 当前实现状态

| 模式 | 类型定义 | 客户端支持 | 服务端处理 |
|------|----------|------------|------------|
| Request | ✅ `PromiseRequest` | ✅ | ✅ 正常返回响应 |
| Subscription | ✅ `SubscriptionRequest` / `EventMethodStop` | ✅ | ✅ 流式推送 |
| Notification | ✅ `SignalRequest` | ✅ | ⚠️ 与 PromiseRequest 处理相同 |

**注意**：当前 `SignalRequest` 在服务端的处理逻辑与 `PromiseRequest` 无异，都会返回响应。如需实现真正的 Notification 行为，需要在 `handleRequest.ts` 中区分处理——对于 `SignalRequest` 不发送响应。

## 参考

- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [gRPC Core Concepts](https://grpc.io/docs/guides/concepts)
- [tRPC Procedures](https://trpc.io/docs/server/procedures)
- [源码：types/rpc.ts](../src/types/rpc.ts)
- [源码：handleRequest.ts](../src/middlewares/handleRequest.ts)