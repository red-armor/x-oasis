# Buffer 优化变更日志

## 优化完成时间
2024年（当前）

## 概述

本次优化对 `async-call-rpc` 的 buffer 序列化系统进行了全面改进，实现了统一管理、配置化和高性能的序列化方案。

## 主要变更

### 1. 类型定义增强

**文件**: `src/types/channel.ts`

**新增**:
- `AbstractChannelProtocolProps` 类型，包含序列化配置选项：
  - `serializationFormat?: string` - 序列化格式配置
  - `readBuffer?: ReadBaseBuffer` - 自定义读 buffer
  - `writeBuffer?: WriteBaseBuffer` - 自定义写 buffer

**影响**: 所有 Channel 构造函数现在都支持序列化配置

### 2. AbstractChannelProtocol 优化

**文件**: `src/protocol/AbstractChannelProtocol.ts`

**改进**:
- ✅ 使用 `BufferFactory` 统一创建 buffer 实例
- ✅ 支持通过构造函数配置序列化格式
- ✅ 实现智能缓存机制（首次创建，后续复用）
- ✅ 添加格式验证和自动回退机制（不支持时回退到 JSON）
- ✅ 新增 `setSerializationFormat()` 方法支持运行时切换
- ✅ 新增 `serializationFormat` getter 获取当前格式

**之前**:
```typescript
get readBuffer() {
  if (this._readBuffer) return this._readBuffer;
  this._readBuffer = new ReadBuffer(); // 硬编码 JSON
  return this._readBuffer;
}
```

**现在**:
```typescript
get readBuffer(): ReadBaseBuffer {
  if (this._readBuffer) return this._readBuffer;
  // 使用工厂创建，支持配置格式
  this._readBuffer = BufferFactory.createReadBuffer(this._serializationFormat);
  return this._readBuffer;
}
```

### 3. 子类 Channel 优化

**文件**: 
- `src/protocol/MessageChannel.ts`
- `src/protocol/WebSocketChannel.ts`
- `src/protocol/WorkerChannel.ts`

**改进**:
- ✅ 移除直接创建 buffer 实例的代码
- ✅ 继承父类的 buffer getter（使用工厂和缓存）
- ✅ 构造函数支持 `AbstractChannelProtocolProps` 配置
- ✅ 统一使用父类的缓存机制

**之前**:
```typescript
get readBuffer() {
  return new ReadBuffer(); // 每次都创建新实例
}
```

**现在**:
```typescript
// 继承父类实现，使用工厂和缓存
// 可通过构造函数配置格式
constructor(options: { port: MessagePort } & AbstractChannelProtocolProps) {
  super(options); // 传递配置给父类
}
```

### 4. 类型定义合并

**文件**: `src/types/messageChannel.ts`

**改进**:
- ✅ `AbstractChannelProtocolProps` 现在扩展自 `channel.ts` 中的基础定义
- ✅ 保持向后兼容，添加了序列化相关字段

## 使用方式变更

### 之前的使用方式

```typescript
// 只能使用默认的 JSON
const channel = new WebSocketChannel(socket);

// 要使用其他格式，需要重写 getter
class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    return new MessagePackReadBuffer(); // 需要手动实现
  }
}
```

### 现在的使用方式

```typescript
// 方式 1: 通过配置指定格式（推荐）
const channel = new WebSocketChannel(socket, {
  serializationFormat: 'msgpack'
});

// 方式 2: 使用自定义 buffer
const channel = new MessageChannel({
  port,
  readBuffer: new MyCustomBuffer(),
  writeBuffer: new MyCustomBuffer()
});

// 方式 3: 运行时切换
channel.setSerializationFormat('cbor');
```

## 性能改进

1. **缓存机制**: 所有 Channel 现在都使用缓存，避免重复创建 buffer 实例
2. **延迟初始化**: Buffer 实例在首次访问时才创建
3. **工厂模式**: 统一通过工厂创建，便于管理和优化

## 向后兼容性

✅ **完全向后兼容**

- 默认行为保持不变（使用 JSON）
- 不传配置时，行为与之前完全一致
- 现有的重写 getter 的代码仍然有效

## 迁移建议

### 如果之前重写了 buffer getter

**之前**:
```typescript
class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    return new ReadBuffer();
  }
}
```

**现在（推荐）**:
```typescript
// 方式 1: 使用配置（推荐）
class MyChannel extends AbstractChannelProtocol {
  constructor(options?: AbstractChannelProtocolProps) {
    super({ serializationFormat: 'msgpack', ...options });
  }
  // 不需要重写 getter
}

// 方式 2: 继续重写（如果需要特殊逻辑）
class MyChannel extends AbstractChannelProtocol {
  get readBuffer() {
    if (this._readBuffer) return this._readBuffer;
    this._readBuffer = BufferFactory.createReadBuffer('msgpack');
    return this._readBuffer;
  }
}
```

## 新增功能

1. **格式配置**: 通过构造函数配置序列化格式
2. **运行时切换**: `setSerializationFormat()` 方法
3. **格式查询**: `serializationFormat` getter
4. **自动回退**: 格式不支持时自动回退到 JSON
5. **自定义 buffer**: 支持直接传入自定义 buffer 实例

## 测试建议

1. **基础功能**: 验证默认 JSON 行为不变
2. **格式配置**: 测试不同格式的配置和使用
3. **缓存机制**: 验证 buffer 实例被正确缓存
4. **格式切换**: 测试运行时格式切换
5. **错误处理**: 测试不支持的格式时的回退机制

## 相关文件

- `src/buffer/BufferFactory.ts` - 工厂实现
- `src/buffer/SerializationFormat.ts` - 格式定义
- `src/buffer/README.md` - 使用文档
- `src/buffer/ARCHITECTURE.md` - 架构说明
- `src/buffer/OPTIMIZATION.md` - 优化说明

## 总结

本次优化实现了：
- ✅ 统一的 buffer 管理机制
- ✅ 灵活的配置方式
- ✅ 性能优化（缓存）
- ✅ 易于扩展（工厂模式）
- ✅ 完全向后兼容

这些改进让序列化系统更加健壮、灵活和高效，同时保持了良好的向后兼容性。
