# Buffer Serialization Formats

本模块提供了可插拔的序列化/反序列化机制，支持多种数据格式用于 RPC 通信。

## 支持的序列化格式

### 1. JSON (默认)
- **格式**: `SerializationFormat.JSON`
- **特点**: 人类可读、易于调试、跨平台兼容
- **性能**: 中等，适合大多数场景
- **使用**: 默认格式，无需额外配置

### 2. MessagePack (推荐高性能方案)
- **格式**: `SerializationFormat.MESSAGEPACK`
- **特点**: 二进制格式、体积小、性能高（比 JSON 快 2-3 倍）
- **性能**: 高，适合性能敏感场景
- **依赖**: `@msgpack/msgpack`

### 3. CBOR
- **格式**: `SerializationFormat.CBOR`
- **特点**: 标准二进制格式（RFC 7049）、支持更多数据类型
- **性能**: 高
- **依赖**: `cbor` 或 `cbor-web`

### 4. Protocol Buffers
- **格式**: `SerializationFormat.PROTOBUF`
- **特点**: Google 出品、高性能、需要 schema 定义
- **性能**: 极高，适合大规模系统
- **依赖**: `protobufjs` 或 `@grpc/proto-loader`

## 使用方法

### 方式 1: 在 Channel 中重写 buffer getter

```typescript
import { SerializationFormat, BufferFactory } from '@x-oasis/async-call-rpc/buffer';
import AbstractChannelProtocol from './AbstractChannelProtocol';

class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    // 使用 MessagePack
    return BufferFactory.createReadBuffer(SerializationFormat.MESSAGEPACK);
  }
  
  get writeBuffer() {
    return BufferFactory.createWriteBuffer(SerializationFormat.MESSAGEPACK);
  }
}
```

### 方式 2: 注册自定义序列化器

```typescript
import { BufferFactory } from '@x-oasis/async-call-rpc/buffer';
import { encode, decode } from '@msgpack/msgpack';
import ReadBaseBuffer from '@x-oasis/async-call-rpc/buffer/ReadBaseBuffer';
import WriteBaseBuffer from '@x-oasis/async-call-rpc/buffer/WriteBaseBuffer';

// 实现 MessagePack 序列化器
class MessagePackReadBuffer extends ReadBaseBuffer {
  decode(data: string | ArrayBuffer | Uint8Array): any {
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      return decode(encoder.encode(data));
    }
    return decode(data as Uint8Array);
  }
  
  getFormat(): string {
    return 'msgpack';
  }
}

class MessagePackWriteBuffer extends WriteBaseBuffer {
  encode(data: any): Uint8Array {
    return encode(data);
  }
  
  getFormat(): string {
    return 'msgpack';
  }
}

// 注册到工厂
BufferFactory.registerReadBuffer('msgpack', () => new MessagePackReadBuffer());
BufferFactory.registerWriteBuffer('msgpack', () => new MessagePackWriteBuffer());
```

### 方式 3: 使用工厂创建（推荐）

```typescript
import { BufferFactory, SerializationFormat } from '@x-oasis/async-call-rpc/buffer';

// 创建 JSON buffer（默认）
const jsonReadBuffer = BufferFactory.createReadBuffer(SerializationFormat.JSON);
const jsonWriteBuffer = BufferFactory.createWriteBuffer(SerializationFormat.JSON);

// 创建 MessagePack buffer（需要先注册）
const msgpackReadBuffer = BufferFactory.createReadBuffer(SerializationFormat.MESSAGEPACK);
const msgpackWriteBuffer = BufferFactory.createWriteBuffer(SerializationFormat.MESSAGEPACK);
```

## 性能对比

根据社区实践和基准测试：

| 格式 | 序列化速度 | 体积 | 可读性 | 推荐场景 |
|------|-----------|------|--------|---------|
| JSON | 基准 | 100% | ⭐⭐⭐⭐⭐ | 开发、调试、小数据量 |
| MessagePack | 2-3x | 60-70% | ⭐ | 生产环境、性能敏感 |
| CBOR | 2-3x | 60-70% | ⭐ | 标准兼容场景 |
| Protobuf | 3-5x | 50-60% | ⭐ | 大规模系统、跨服务 |

## 内容协商

未来可以支持在 RPC 握手时协商序列化格式：

```typescript
// 客户端发送支持的格式列表
const supportedFormats = [
  SerializationFormat.MESSAGEPACK,
  SerializationFormat.JSON
];

// 服务端选择最佳格式并返回
const selectedFormat = negotiateFormat(supportedFormats);
```

## 注意事项

1. **二进制格式传输**: MessagePack、CBOR、Protobuf 等二进制格式需要确保传输层支持二进制数据（如 WebSocket 的 binary 模式）

2. **类型兼容性**: 不同格式对 JavaScript 类型的支持不同：
   - JSON: 不支持 Date、Map、Set、undefined 等
   - MessagePack: 支持更多类型，包括 Date、Binary 等
   - CBOR: 支持最广泛的类型

3. **向后兼容**: 切换序列化格式时，需要确保客户端和服务端使用相同的格式

4. **错误处理**: 序列化/反序列化失败时，应该回退到 JSON 或抛出明确的错误

## 参考实现

- **JSON-RPC 2.0**: https://www.jsonrpc.org/specification
- **MessagePack**: https://msgpack.org/
- **CBOR**: https://cbor.io/
- **Protocol Buffers**: https://developers.google.com/protocol-buffers
