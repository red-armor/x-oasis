# 事件方法与订阅请求指南

理解 `async-call-rpc` 中事件方法（on*）的处理机制，以及为什么采用 `SubscriptionRequest` 模式而不是简单回调。

## 核心概念

### 两种流式模式

在此框架中存在两种处理流式数据的模式：

**1. 旧的 on* 方法模式（简单回调）**
- 通过 `isEventMethod` 检测（on* 前缀）
- 使用 `requestEvents` Map 存储回调函数
- 直接函数式回调：`callback(...args)`
- 优点：简单直接
- 缺点：无统一错误处理、无context注入、无生命周期管理

**2. 新的 SubscriptionRequest 模式（observable 风格）**
- 显式使用 `RequestType.SubscriptionRequest`
- 结构化的 observer：`.onData()`, `.onError()`, `.onComplete()`
- handler 返回 observable-like 对象
- 优点：完整生命周期、统一错误处理、支持context注入
- 缺点：实现更复杂

## 为什么不用简单实现？

假设最初的简单实现如下：

```typescript
if (isEventMethod(fnName)) {
  const event = serviceHost.getHandler(requestPath, fnName);
  const fn = (...args: any[]) => {
    protocol.sendReply(responseBody);
  };
  event?.(fn);
  return message;
}
```

这个实现存在四个关键问题：

### 1. 无 Context 注入

Handler 只能读到 args，无法访问请求元数据：
- 不知道谁发来的请求
- 无法读取用户身份、权限信息
- 无法访问原始的 IPC 事件对象

### 2. 无统一错误处理

- 没有 try-catch，handler 中的任何错误会导致协议崩溃
- 无法向客户端发送结构化的错误信息
- 协议状态可能不一致

### 3. 无生命周期管理

- 无法追踪活跃订阅
- 无法取消正在进行的订阅
- 内存泄漏风险

### 4. 流式数据处理不完整

- 只能发送一次数据
- 没有错误和完成信号
- 客户端无法确定订阅何时结束

## 完整的 SubscriptionRequest 设计

### 关键特性对比

| 方面 | 简单实现 | SubscriptionRequest 实现 |
|------|---------|----------------------|
| 检测方式 | isEventMethod(fnName) | RequestType.SubscriptionRequest |
| 参数注入 | 仅 args | args + context（可选） |
| 错误处理 | 无 | 完整的 try-catch + error 响应 |
| 生命周期 | 无 | subscribe/unsubscribe 管理 |
| 流式数据 | 单次回调 | 多次 onData + onError + onComplete |
| 取消支持 | 无法取消 | 完整的 SubscriptionStop 处理 |
| 内存管理 | 手动 | 自动清理订阅 |

## 什么是 Context（上下文）？

Context 是框架在每次请求时自动为你准备的**请求级别的信息包**。

### 对比示例

**不用 context 的老方式**：

```typescript
// service.ts
class ChatService {
  onNewMessage(callback) {
    // callback 来了，但我怎么知道是谁在监听？
    // 如果要检查权限，我需要...等等，我没有用户信息啊！
    callback({ message: 'Hello' });
  }
}
```

**用 context 的新方式**：

```typescript
// service.ts
class ChatService {
  onNewMessage(args, ctx) {
    // ctx.event.sender 是 Electron IPC 事件的发送方
    // ctx.userId 是当前用户 ID
    // ctx.permissions 是用户权限列表
    
    // 现在可以：
    // 1. 检查用户是否有权监听此频道
    // 2. 记录谁订阅了什么（审计日志）
    // 3. 为特定用户过滤消息
    
    const allowedChannels = ctx.permissions?.channels || [];
    if (!allowedChannels.includes('chat')) {
      throw new Error('No permission');
    }
    
    // 只推送该用户的消息
    return {
      subscribe(observer) {
        chatService.subscribe(msg => {
          if (msg.recipients.includes(ctx.userId)) {
            observer.onData?.(msg);
          }
        });
      }
    };
  }
}
```

## 完整的 Electron IPC 示例

### 场景概述

- **服务端**：Electron 主进程的 ChatService 提供 `onNewMessage` 事件方法
- **客户端**：Electron 渲染进程订阅消息并显示到 UI

### 步骤 1：服务端 - 定义 Service

```typescript
// main/services/ChatService.ts
class ChatService {
  private messageSubject = new Subject();

  /**
   * 事件方法：当新消息到达时推送给订阅者
   * 
   * @param args - 客户端传入的参数（通常为空或 filter 条件）
   * @param ctx - 框架注入的上下文信息
   */
  onNewMessage(args: unknown, ctx?: Record<string, unknown>) {
    // 使用 context 检查权限
    const userId = ctx?.userId as string;
    const permissions = ctx?.permissions as string[];
    
    if (!permissions?.includes('chat:read')) {
      throw new Error('No permission to read messages');
    }

    console.log(`User ${userId} subscribed to messages`);

    // 返回一个 observable-like 对象
    // 框架会自动调用 .subscribe() 方法
    return {
      subscribe: (observer: {
        onData?: (value: any) => void;
        onError?: (error: any) => void;
        onComplete?: () => void;
      }) => {
        let isActive = true;
        let messageListener: ((msg: any) => void) | null = null;

        // 监听内部消息事件
        messageListener = (msg) => {
          if (isActive) {
            // 推送每条消息给客户端
            observer.onData?.(msg);
          }
        };

        this.messageSubject.subscribe(messageListener);

        // 返回订阅对象，客户端可以通过 SubscriptionStop 取消
        return {
          unsubscribe: () => {
            isActive = false;
            if (messageListener) {
              this.messageSubject.unsubscribe(messageListener);
            }
          },
        };
      },
    };
  }

  // 模拟接收消息（从网络、数据库等）
  receiveMessage(msg: { id: string; userId: string; content: string }) {
    this.messageSubject.next(msg);
  }
}

export default new ChatService();
```

### 步骤 2：服务端 - 初始化 RPC Protocol

```typescript
// main/rpc-server.ts
import { createRPCServiceHost } from '@x-oasis/async-call-rpc';
import chatService from './services/ChatService';
import { ipcMain } from 'electron';

// 初始化 RPC 服务主机
const rpcServiceHost = createRPCServiceHost(
  { ChatService: chatService },
  {
    // 关键配置：定义如何生成每个请求的 context
    createContext: ({ event, requestPath, methodName }) => {
      console.log(`[RPC] ${requestPath}.${methodName} from ${event?.sender?.id}`);

      // 从 IPC 事件中提取用户信息
      const senderId = event?.sender?.id;
      
      return {
        event: event,                      // 保存原始事件，以便后续通信
        userId: `user-${senderId}`,        // 用户 ID
        permissions: ['chat:read', 'chat:write'],  // 用户权限
        sender: event?.sender,             // Electron sender 对象
        timestamp: Date.now(),
      };
    },
  }
);

// 注册 IPC 处理
ipcMain.handle('rpc:request', async (event, data) => {
  return rpcServiceHost.handleRequest(data, { sender: event.sender });
});

export default rpcServiceHost;
```

### 步骤 3：客户端 - 初始化 RPC Client

```typescript
// renderer/rpc-client.ts
import { createRPCClient } from '@x-oasis/async-call-rpc';
import { ipcRenderer } from 'electron';

// 创建 RPC 代理客户端
export const rpcClient = createRPCClient<{
  ChatService: {
    onNewMessage(args?: any): AsyncGenerator;
  };
}>(
  async (data) => {
    // 通过 IPC 发送请求到主进程
    return ipcRenderer.invoke('rpc:request', data);
  },
  {
    onResponse: (data) => {
      // 处理来自主进程的响应
      console.log('[Client] Response from main:', data);
    },
  }
);
```

### 步骤 4：客户端 - 使用事件方法

```typescript
// renderer/components/ChatWindow.vue
import { rpcClient } from '../rpc-client';
import { ref, onMounted, onUnmounted } from 'vue';

export default {
  setup() {
    const messages = ref([]);
    let unsub: any = null;

    onMounted(async () => {
      // 调用事件方法 onNewMessage，传入监听回调
      // 返回一个 unsubscriber 对象，可以取消监听
      unsub = rpcClient.ChatService.onNewMessage((message) => {
        console.log('[UI] New message:', message);
        messages.value.push(message);
      });
    });

    onUnmounted(() => {
      // 取消订阅
      unsub?.unsubscribe?.();
    });

    return { messages };
  },
};
```

### 数据流示意

```
客户端                            主进程（RPC）                    Service
  |                                  |                              |
  |-- subscribe()                    |                              |
  |---- IPC invoke --> onNewMessage() ---> createContext() -------> |
  |                                  |     生成 ctx                |
  |                                  | <--- 返回 observable -------- |
  |                                  |     .subscribe(observer)      |
  |                                  |                              |
  |                                  |                      receiveMessage()
  |                                  |                              |
  |  <-- pushMessage ------ observer.onData(msg) <-- messageSubject.next()
  |  <-- pushMessage ------ observer.onData(msg) <-- messageSubject.next()
  |  <-- error ---------- observer.onError(err) <-- 某个错误
  |                                  |
  |-- unsubscribe()                  |
  |---- IPC invoke --> SubscriptionStop -> subscription.unsubscribe()
```

## Context 的实际作用

| 阶段 | 没有 context | 有 context |
|------|------------|----------|
| **请求到达** | handler 无法知道是谁发来的请求 | handler 获得 userId、permissions 等 |
| **权限检查** | 需要在 handler 里手动检查（重复） | 框架层统一处理 |
| **数据过滤** | 没办法为不同用户过滤数据 | 可以根据 ctx.userId 过滤 |
| **日志审计** | 无法追踪谁访问了什么 | 自动记录 ctx 信息 |
| **回复通信** | 如果需要回复特定客户端很困难 | ctx.sender 直接指向客户端 |

## isEventMethod vs RequestType.SubscriptionRequest

两者虽然都与事件相关，但适用于不同的场景：

**isEventMethod（旧方式 - Ping-Pong 模式）**
- 函数：`(name: string) => boolean`
- 检测方法名是否以 "on" 开头且后跟大写字母（如 `onData`、`onChange`）
- 适用于**低频事件监听**（ping-pong、listen & fire）
- 实现简单，但没有错误处理和生命周期管理
- 定义位置：`src/common.ts`

**RequestType.SubscriptionRequest（新方式 - 数据流模式）**
- 枚举值：`'sub'`
- 显式的请求类型标记，用于完整的流式处理
- 适用于**高频数据流**（watch、observable、多次推送）
- 支持错误处理、完成信号、取消订阅
- 定义位置：`src/types/rpc.ts`

### 使用场景对比

```typescript
// ========== Ping-Pong 模式（isEventMethod）==========
// 低频事件，简单监听与触发

class ServiceA {
  onPing(callback) {
    setInterval(() => {
      callback('ping');  // 定期触发一次
    }, 10000);
  }
}

// 客户端
client.onPing(this.handlePing.bind(this));

// ========== Streaming 模式（SubscriptionRequest）==========
// 高频数据流，完整生命周期

class ServiceB {
  onFileChanged() {
    return {
      subscribe(observer) {
        watcher.on('change', data => observer.onData(data));      // 多次推送
        watcher.on('error', err => observer.onError(err));        // 错误处理
        watcher.on('end', () => observer.onComplete());           // 完成信号
        
        return {
          unsubscribe() {
            watcher.close();  // 清理资源
          }
        };
      }
    };
  }
}

// 客户端
const unsub = client.subscribe('onFileChanged', ['/path'], {
  onData: (change) => { ... },
  onError: (err) => { ... },
  onComplete: () => { ... }
});
unsub.unsubscribe();  // 主动取消
```

### 在中间件中的应用

```typescript
// updateSeqInfo.ts - 存储事件回调
if (methodName && isEventMethod(methodName)) {
  channelProtocol.requestEvents.set(`${seqId}`, body[0]);
}

// handlePortRequest.ts - 跳过事件方法（等待 SubscriptionRequest 判断）
if (isEventMethod(methodName)) {
  return message;  // 让后续中间件决定是用旧方式还是新方式
}

// handleRequest.ts - 对 SubscriptionRequest 使用新的方式
if (type === RequestType.SubscriptionRequest) {
  // 完整的生命周期管理
  startSubscription();
}
```

### 三种实现方式总结

| 特性 | 旧 isEventMethod | 新 SubscriptionRequest | 两者并存 |
|------|----------------|---------------------|---------|
| **Ping-Pong（onPing）** | ✅ 完美 | ✅ 可以但过度 | ✅ 推荐 |
| **数据流（onWatch）** | ❌ 不适合 | ✅ 完美 | ✅ 推荐 |
| **错误处理** | ❌ 没有 | ✅ 完整 | ✅ 按需 |
| **生命周期** | ❌ 无法取消 | ✅ 完整 | ✅ 按需 |
| **实现复杂度** | 简单 | 中等 | 中等 |

## 关键代码位置

| 文件 | 行号 | 功能 |
|-----|------|------|
| `src/common.ts` | 3-8 | `isEventMethod` 定义 |
| `src/types/rpc.ts` | 1-25 | `RequestType` 枚举定义 |
| `src/types/protocol.ts` | 56-71 | `createContext` 配置选项 |
| `src/middlewares/handleRequest.ts` | 49-261 | `handleRequest` middleware（核心处理逻辑）|
| `src/middlewares/handleRequest.ts` | 118-204 | `SubscriptionRequest` 处理 |
| `src/middlewares/handleRequest.ts` | 106-115 | `resolveContext` 实现 |
| `src/middlewares/updateSeqInfo.ts` | 20-23 | `isEventMethod` 检测 |
| `src/middlewares/handlePortRequest.ts` | 40-42 | 事件方法跳过 |

## resolveContext 流程详解

当收到 `SubscriptionRequest` 时的完整流程：

```
1. 消息到达 handleRequest middleware
   ↓
2. 检测 type === RequestType.SubscriptionRequest
   ↓
3. 调用 startSubscription() 异步函数
   ↓
4. 调用 ctx = await resolveContext()
   ├─ 检查 protocol.createContext 是否存在
   ├─ 调用 protocol.createContext({ event, requestPath, methodName })
   └─ 返回 context 对象或 undefined
   ↓
5. 调用 handler(args, ctx) 或 handler(args)
   ├─ 如果有 ctx，handler 作为第二个参数接收
   └─ handler 应返回 observable-like 对象
   ↓
6. 检查返回值的 .subscribe() 方法
   ├─ 如果是 observable，调用 .subscribe({ onData, onError, onComplete })
   └─ 如果不是，将其作为单值响应发送
   ↓
7. 将订阅对象注册到 protocol.subscriptions
   ↓
8. 后续数据流通过 onData() 发送给客户端
   ↓
9. 客户端发送 SubscriptionStop 请求时
   └─ 调用 subscription.unsubscribe() 清理资源
```

## 最佳实践

### ✅ 推荐做法

1. **始终返回 observable**
   ```typescript
   onData(args, ctx) {
     return {
       subscribe(observer) {
         // 处理订阅逻辑
       }
     };
   }
   ```

2. **在 handler 中使用 context**
   ```typescript
   onData(args, ctx) {
     const userId = ctx?.userId;
     // 基于用户信息做出决策
   }
   ```

3. **完整处理所有 observer 信号**
   ```typescript
   observer.onData?.(value);      // 推送数据
   observer.onError?.(err);       // 报告错误
   observer.onComplete?.();       // 表示完成
   ```

4. **在 unsubscribe 时清理资源**
   ```typescript
   return {
     unsubscribe() {
       listener.remove();
       subscription.dispose();
     }
   };
   ```

### ❌ 应该避免

1. **忘记处理错误**
   ```typescript
   // ❌ 错：没有 observer.onError() 处理
   listener.subscribe(value => observer.onData?.(value));
   ```

2. **在 context 不存在时假设它存在**
   ```typescript
   // ❌ 错：如果没有 createContext，ctx 会是 undefined
   const userId = ctx.userId;  // 可能崩溃
   ```

3. **不处理订阅取消**
   ```typescript
   // ❌ 错：没有返回 unsubscribe 方法
   return {
     subscribe(observer) {
       listener.subscribe(observer.onData);
       // 丢失了取消逻辑
     }
   };
   ```

4. **混合使用回调和 observable**
   ```typescript
   // ❌ 错：既调用 callback 又返回 observable
   callback(value);
   return { subscribe(observer) { ... } };
   ```

## 常见陷阱

### 陷阱 1：Context 可能为 undefined

如果 protocol 没有配置 `createContext`，则 ctx 会是 undefined：

```typescript
// ✅ 安全的方式
onData(args, ctx) {
  if (!ctx) {
    throw new Error('Context required');
  }
  // 使用 ctx
}

// 或者
onData(args, ctx = {}) {
  const userId = ctx.userId ?? 'anonymous';
}
```

### 陷阱 2：Memory Leak 风险

忘记在 unsubscribe 时清理监听器：

```typescript
// ❌ 有问题：listener 永远不会被移除
return {
  subscribe(observer) {
    emitter.on('data', value => observer.onData?.(value));
    return { unsubscribe() {} };  // 空的 unsubscribe
  }
};

// ✅ 正确的方式
return {
  subscribe(observer) {
    const handler = value => observer.onData?.(value);
    emitter.on('data', handler);
    return { 
      unsubscribe() {
        emitter.off('data', handler);  // 移除监听器
      }
    };
  }
};
```

### 陷阱 3：混淆 onData 的多次调用

`onData()` 可以被多次调用（与普通函数回调不同）：

```typescript
// ✅ 正确：多次推送数据
subscription.subscribe({
  onData: (value) => {
    console.log('Received:', value);
  }
});

// 服务端
observer.onData?.('first');   // 客户端会接收
observer.onData?.('second');  // 客户端会接收
observer.onData?.('third');   // 客户端会接收
observer.onComplete?.();      // 表示完成
```

## 参考资源

- [RequestType 定义](../src/types/rpc.ts)
- [handleRequest 实现](../src/middlewares/handleRequest.ts)
- [protocol 配置](../src/types/protocol.ts)
- [示例代码](../examples)
