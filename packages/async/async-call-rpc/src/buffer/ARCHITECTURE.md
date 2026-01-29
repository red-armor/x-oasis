# 分层可配置设计说明

## 什么是"分层可配置设计"？

"分层可配置设计"指的是将系统按照**职责分离**成不同的层次，每一层都可以**独立配置和替换**，而不影响其他层。

## 架构层次图

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (Application)                  │
│  - 业务逻辑代码                                          │
│  - 调用 RPC 方法                                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  RPC 协议层 (Protocol Layer)              │
│  - AbstractChannelProtocol                               │
│  - WebSocketChannel / MessageChannel / WorkerChannel    │
│  - 负责消息路由、请求管理                                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                中间件层 (Middleware Layer)                │
│  - serialize / deserialize                               │
│  - handleRequest / handleResponse                        │
│  - 可插拔的中间件链                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│           序列化抽象层 (Serialization Abstraction)       │
│  - ReadBaseBuffer / WriteBaseBuffer (抽象接口)           │
│  - 定义统一的 encode/decode 接口                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│         序列化实现层 (Serialization Implementation)      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   JSON       │  │ MessagePack  │  │   CBOR       │ │
│  │ ReadBuffer   │  │ ReadBuffer   │  │ ReadBuffer   │ │
│  │ WriteBuffer  │  │ WriteBuffer  │  │ WriteBuffer  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  - 多种序列化格式的具体实现                               │
│  - 可以随时添加新的实现                                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│              工厂层 (Factory Layer)                       │
│  - BufferFactory                                         │
│  - 格式注册表 (Registry)                                  │
│  - 根据配置创建对应的序列化器                             │
└─────────────────────────────────────────────────────────┘
```

## 核心概念

### 1. **分层 (Layered)**

每一层只关注自己的职责：

- **应用层**: 只管调用 RPC，不关心序列化细节
- **协议层**: 只管消息传输，不关心数据格式
- **中间件层**: 只管数据转换流程，不关心具体序列化算法
- **抽象层**: 定义接口契约，不关心具体实现
- **实现层**: 只管序列化算法，不关心上层如何使用
- **工厂层**: 只管创建和注册，不关心具体实现

### 2. **可配置 (Configurable)**

每一层都可以通过配置来改变行为：

```typescript
// 配置方式 1: 在 Channel 中配置
class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    // 可以配置为 JSON
    return BufferFactory.createReadBuffer(SerializationFormat.JSON);
    // 或者配置为 MessagePack
    // return BufferFactory.createReadBuffer(SerializationFormat.MESSAGEPACK);
  }
}

// 配置方式 2: 通过工厂注册自定义实现
BufferFactory.registerReadBuffer('my-format', () => new MyCustomBuffer());

// 配置方式 3: 运行时动态切换
const format = getFormatFromConfig(); // 从配置文件读取
const buffer = BufferFactory.createReadBuffer(format);
```

## 设计优势

### ✅ 1. **解耦 (Decoupling)**

各层之间通过接口通信，互不依赖：

```typescript
// 中间件层不需要知道具体是 JSON 还是 MessagePack
export const serialize = (channel: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => ({
    ...value,
    // 只调用抽象接口，不关心具体实现
    data: channel.writeBuffer.encode(value.data),
  });
  return fn;
};
```

### ✅ 2. **可扩展 (Extensible)**

添加新格式不需要修改现有代码：

```typescript
// 添加新的序列化格式，只需要：
// 1. 实现 ReadBaseBuffer 和 WriteBaseBuffer
class MyNewFormatBuffer extends ReadBaseBuffer {
  decode(data: any): any { /* ... */ }
  getFormat(): string { return 'my-format'; }
}

// 2. 注册到工厂
BufferFactory.registerReadBuffer('my-format', () => new MyNewFormatBuffer());

// 3. 使用
const buffer = BufferFactory.createReadBuffer('my-format');
// 完成！不需要修改任何其他代码
```

### ✅ 3. **可替换 (Replaceable)**

可以轻松切换不同的实现：

```typescript
// 开发环境使用 JSON（便于调试）
const devBuffer = BufferFactory.createReadBuffer(SerializationFormat.JSON);

// 生产环境使用 MessagePack（性能更好）
const prodBuffer = BufferFactory.createReadBuffer(SerializationFormat.MESSAGEPACK);

// 根据环境变量切换
const buffer = process.env.NODE_ENV === 'production' 
  ? prodBuffer 
  : devBuffer;
```

### ✅ 4. **可测试 (Testable)**

每一层都可以独立测试：

```typescript
// 测试序列化实现层
describe('MessagePackBuffer', () => {
  it('should encode and decode correctly', () => {
    const buffer = new MessagePackWriteBuffer();
    const data = { name: 'test', value: 123 };
    const encoded = buffer.encode(data);
    const decoded = new MessagePackReadBuffer().decode(encoded);
    expect(decoded).toEqual(data);
  });
});

// 测试工厂层
describe('BufferFactory', () => {
  it('should create correct buffer type', () => {
    const buffer = BufferFactory.createReadBuffer(SerializationFormat.JSON);
    expect(buffer).toBeInstanceOf(ReadBuffer);
  });
});
```

## 实际应用场景

### 场景 1: 开发 vs 生产环境

```typescript
// 开发环境：使用 JSON，方便调试
if (process.env.NODE_ENV === 'development') {
  channel.readBuffer = BufferFactory.createReadBuffer(SerializationFormat.JSON);
  channel.writeBuffer = BufferFactory.createWriteBuffer(SerializationFormat.JSON);
} else {
  // 生产环境：使用 MessagePack，提升性能
  channel.readBuffer = BufferFactory.createReadBuffer(SerializationFormat.MESSAGEPACK);
  channel.writeBuffer = BufferFactory.createWriteBuffer(SerializationFormat.MESSAGEPACK);
}
```

### 场景 2: 根据数据大小选择格式

```typescript
function getOptimalFormat(dataSize: number): SerializationFormat {
  if (dataSize < 1024) {
    // 小数据：用 JSON，开销小
    return SerializationFormat.JSON;
  } else if (dataSize < 1024 * 1024) {
    // 中等数据：用 MessagePack，平衡性能和体积
    return SerializationFormat.MESSAGEPACK;
  } else {
    // 大数据：用 Protobuf，极致性能
    return SerializationFormat.PROTOBUF;
  }
}
```

### 场景 3: 客户端-服务端协商

```typescript
// 客户端发送支持的格式列表
const clientFormats = [
  SerializationFormat.MESSAGEPACK,
  SerializationFormat.JSON
];

// 服务端选择最佳格式
const serverFormats = [
  SerializationFormat.MESSAGEPACK,
  SerializationFormat.CBOR,
  SerializationFormat.JSON
];

// 协商结果
const selectedFormat = negotiateFormat(clientFormats, serverFormats);
// 返回: 'msgpack' (双方都支持的第一个格式)

// 使用协商后的格式
channel.readBuffer = BufferFactory.createReadBuffer(selectedFormat);
channel.writeBuffer = BufferFactory.createWriteBuffer(selectedFormat);
```

## 对比：非分层设计的问题

### ❌ 不好的设计（紧耦合）

```typescript
// 所有层都直接依赖 JSON
class Channel {
  send(data: any) {
    const json = JSON.stringify(data); // 硬编码 JSON
    this.socket.send(json);
  }
  
  receive(json: string) {
    const data = JSON.parse(json); // 硬编码 JSON
    return data;
  }
}

// 问题：
// 1. 想换成 MessagePack？需要修改所有地方
// 2. 想支持多种格式？需要大量 if-else
// 3. 无法测试序列化逻辑（和传输逻辑耦合）
```

### ✅ 好的设计（分层可配置）

```typescript
// 抽象层定义接口
abstract class WriteBaseBuffer {
  abstract encode(data: any): any;
}

// 实现层提供具体实现
class JSONBuffer extends WriteBaseBuffer {
  encode(data: any) { return JSON.stringify(data); }
}

class MessagePackBuffer extends WriteBaseBuffer {
  encode(data: any) { return msgpack.encode(data); }
}

// 协议层使用抽象接口
class Channel {
  constructor(private writeBuffer: WriteBaseBuffer) {}
  
  send(data: any) {
    const encoded = this.writeBuffer.encode(data); // 使用抽象接口
    this.socket.send(encoded);
  }
}

// 使用：可以轻松切换
const jsonChannel = new Channel(new JSONBuffer());
const msgpackChannel = new Channel(new MessagePackBuffer());
```

## 总结

**分层可配置设计** = **职责分离** + **接口抽象** + **工厂模式**

- **分层**: 将复杂系统拆分成多个职责清晰的层次
- **可配置**: 每一层都可以通过配置来改变行为，而不影响其他层
- **优势**: 解耦、可扩展、可替换、可测试

这样的设计让你可以：
- ✅ 轻松添加新的序列化格式
- ✅ 根据场景选择最合适的格式
- ✅ 在不影响其他代码的情况下切换格式
- ✅ 独立测试每一层的功能
