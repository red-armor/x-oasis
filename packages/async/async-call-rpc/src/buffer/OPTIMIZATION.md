# Buffer 优化说明

## 优化内容

本次优化对 `async-call-rpc` 的 buffer 序列化机制进行了全面改进，实现了统一、可配置、高性能的序列化方案。

## 主要改进

### 1. ✅ 统一使用 BufferFactory

**之前的问题：**
- 每个 Channel 子类都直接创建 `new ReadBuffer()` / `new WriteBuffer()`
- 无法统一管理序列化格式
- 每次访问 getter 都创建新实例（性能问题）

**优化后：**
- 所有 Channel 统一使用 `BufferFactory` 创建 buffer
- 支持通过配置指定序列化格式
- 实现了实例缓存，避免重复创建

### 2. ✅ 支持配置化序列化格式

**新增功能：**
- 在构造函数中通过 `serializationFormat` 参数指定格式
- 支持运行时动态切换格式（`setSerializationFormat()`）
- 支持自定义 buffer 实例（`readBuffer` / `writeBuffer` 参数）

**使用示例：**

```typescript
// 方式 1: 通过配置指定格式
const channel = new WebSocketChannel(socket, {
  serializationFormat: 'msgpack' // 使用 MessagePack
});

// 方式 2: 使用自定义 buffer
const customBuffer = new MyCustomBuffer();
const channel = new MessageChannel({
  port,
  readBuffer: customBuffer,
  writeBuffer: customBuffer
});

// 方式 3: 运行时切换格式
channel.setSerializationFormat('cbor');
```

### 3. ✅ 优化缓存机制

**之前的问题：**
- `MessageChannel` 和 `WebSocketChannel` 每次访问都创建新实例
- `AbstractChannelProtocol` 有缓存，但子类重写后失效

**优化后：**
- 所有 Channel 都使用父类的缓存机制
- 首次访问时创建，后续访问复用实例
- 格式切换时自动清理缓存

### 4. ✅ 增强错误处理

**新增功能：**
- 格式不支持时自动回退到 JSON
- 提供清晰的错误提示和警告
- 支持自定义 buffer 的验证

### 5. ✅ 改进类型定义

**新增类型：**
- `AbstractChannelProtocolProps` - 统一的配置接口
- 所有 Channel 构造函数都支持序列化配置

## 使用指南

### 基础使用（默认 JSON）

```typescript
// 无需配置，默认使用 JSON
const channel = new WebSocketChannel(socket);
// 或者
const channel = new MessageChannel({ port });
```

### 使用 MessagePack（高性能）

```typescript
// 1. 先注册 MessagePack（如果还没注册）
import { registerMessagePack } from '@x-oasis/async-call-rpc/buffer/examples';
registerMessagePack();

// 2. 创建 Channel 时指定格式
const channel = new WebSocketChannel(socket, {
  serializationFormat: 'msgpack'
});
```

### 使用自定义格式

```typescript
// 1. 实现自定义 buffer
class MyCustomBuffer extends ReadBaseBuffer {
  decode(data: any): any {
    // 自定义解码逻辑
  }
  getFormat(): string {
    return 'my-format';
  }
}

// 2. 注册到工厂
import { BufferFactory } from '@x-oasis/async-call-rpc/buffer';
BufferFactory.registerReadBuffer('my-format', () => new MyCustomBuffer());

// 3. 使用
const channel = new MessageChannel({
  port,
  serializationFormat: 'my-format'
});
```

### 运行时切换格式

```typescript
const channel = new WebSocketChannel(socket);

// 初始使用 JSON
console.log(channel.serializationFormat); // 'json'

// 切换到 MessagePack
channel.setSerializationFormat('msgpack');
console.log(channel.serializationFormat); // 'msgpack'

// 下次访问 buffer 时会使用新格式
```

## 性能优化

### 缓存机制

```typescript
// 第一次访问：创建实例
const buffer1 = channel.readBuffer; // 创建新实例

// 后续访问：复用缓存
const buffer2 = channel.readBuffer; // 返回缓存的实例
console.log(buffer1 === buffer2); // true
```

### 格式切换

```typescript
// 切换格式时，缓存会被清理
channel.setSerializationFormat('msgpack');

// 下次访问时会创建新实例
const buffer3 = channel.readBuffer; // 创建新的 MessagePack 实例
console.log(buffer1 === buffer3); // false
```

## 迁移指南

### 从旧版本迁移

**之前：**
```typescript
class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    return new ReadBuffer(); // 每次都创建新实例
  }
  
  get writeBuffer() {
    return new WriteBuffer();
  }
}
```

**现在（推荐）：**
```typescript
// 方式 1: 使用配置（推荐）
class MyChannel extends AbstractChannelProtocol {
  constructor(options?: AbstractChannelProtocolProps) {
    super({ serializationFormat: 'msgpack', ...options });
  }
  // 不需要重写 getter，使用父类的实现
}

// 方式 2: 继续重写（如果需要特殊逻辑）
class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    // 使用工厂创建，支持缓存
    if (this._readBuffer) return this._readBuffer;
    this._readBuffer = BufferFactory.createReadBuffer('msgpack');
    return this._readBuffer;
  }
}
```

## 配置选项

### AbstractChannelProtocolProps

```typescript
interface AbstractChannelProtocolProps {
  description?: string;
  masterProcessName?: string;
  connected?: boolean;
  serializationFormat?: string;  // 序列化格式：'json' | 'msgpack' | 'cbor' | ...
  readBuffer?: ReadBaseBuffer;   // 自定义读 buffer（覆盖 serializationFormat）
  writeBuffer?: WriteBaseBuffer; // 自定义写 buffer（覆盖 serializationFormat）
}
```

## 最佳实践

1. **开发环境使用 JSON**：便于调试和查看数据
   ```typescript
   const format = process.env.NODE_ENV === 'production' ? 'msgpack' : 'json';
   const channel = new WebSocketChannel(socket, { serializationFormat: format });
   ```

2. **生产环境使用 MessagePack**：提升性能
   ```typescript
   const channel = new WebSocketChannel(socket, { 
     serializationFormat: 'msgpack' 
   });
   ```

3. **统一配置**：在应用入口统一配置序列化格式
   ```typescript
   const RPC_CONFIG = {
     serializationFormat: process.env.RPC_FORMAT || 'json'
   };
   
   const channel = new WebSocketChannel(socket, RPC_CONFIG);
   ```

4. **错误处理**：监听格式不支持的情况
   ```typescript
   try {
     const channel = new WebSocketChannel(socket, { 
       serializationFormat: 'msgpack' 
     });
   } catch (error) {
     // 会自动回退到 JSON，但会输出警告
     console.warn('MessagePack not available, using JSON');
   }
   ```

## 总结

通过本次优化，`async-call-rpc` 的 buffer 系统现在具备：

- ✅ **统一管理**：通过 BufferFactory 统一创建和管理
- ✅ **配置灵活**：支持多种配置方式
- ✅ **性能优化**：实例缓存，避免重复创建
- ✅ **易于扩展**：支持自定义格式和实现
- ✅ **向后兼容**：默认行为保持不变（使用 JSON）

这些改进让序列化系统更加健壮、灵活和高效。
