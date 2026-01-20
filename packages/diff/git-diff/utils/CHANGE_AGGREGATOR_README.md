# 变更聚合器使用指南

本项目提供了两套变更聚合方案，用于将用户的源码变更聚合后同步给 AI 模型。

## 方案对比

### CodeMirror 原生方案 (`CodeMirrorChangeAggregator`)

**优点**：
- ✅ 与 CodeMirror 编辑器深度集成
- ✅ 可以精确追踪每个 Transaction
- ✅ 支持字符级别的变更追踪
- ✅ 自动处理位置信息

**缺点**：
- ⚠️ 需要 CodeMirror EditorState/Transaction
- ⚠️ 对于非 CodeMirror 的变更需要额外处理

**适用场景**：
- 编辑器使用 CodeMirror
- 需要精确的变更追踪
- 需要字符级别的变更信息

### Diff 方案 (`DiffChangeAggregator`)

**优点**：
- ✅ 不依赖编辑器实现
- ✅ 可以生成标准的 Unified Diff 格式
- ✅ 实现简单，易于理解
- ✅ 支持任意文本变更

**缺点**：
- ⚠️ 需要安装额外的依赖（`diff` 库）
- ⚠️ 只能进行行级别的差异计算（字符级别需要额外配置）

**适用场景**：
- 需要生成标准的 diff 格式
- 不依赖特定编辑器
- 需要与 Git 等工具兼容的格式

## 安装依赖

### CodeMirror 方案

项目已包含 CodeMirror，无需额外安装。

### Diff 方案

```bash
npm install diff
npm install @types/diff --save-dev
```

然后在 `DiffChangeAggregator.ts` 中取消注释导入语句：

```typescript
import { diffLines, createPatch } from 'diff';
```

## 基本使用

### CodeMirror 方案

```typescript
import { CodeMirrorChangeAggregator } from './CodeMirrorChangeAggregator';
import { EditorState, Transaction } from '@codemirror/state';

// 创建聚合器
const aggregator = new CodeMirrorChangeAggregator();

// 设置基础版本
aggregator.setBaseVersion('src/Button.tsx', baseContent);

// 方式一：从 Transaction 记录变更
const state = EditorState.create({ doc: baseContent });
const transaction = state.update({
  changes: { from: 30, to: 30, insert: ' className="btn"' }
}).transaction;
aggregator.recordChangeFromTransaction('src/Button.tsx', transaction, 'panel');

// 方式二：从文本内容记录变更
aggregator.recordChangeFromContent('src/Button.tsx', oldContent, newContent, 'editor');

// 聚合变更
const aggregated = aggregator.aggregateChanges();

// 清空待处理变更（提交后）
aggregator.clearPendingChanges();
```

### Diff 方案

```typescript
import { DiffChangeAggregator } from './DiffChangeAggregator';

// 创建聚合器
const aggregator = new DiffChangeAggregator();

// 设置基础版本
aggregator.setBaseVersion('src/Button.tsx', baseContent);

// 记录变更
aggregator.recordChange('src/Button.tsx', newContent, 'panel');

// 聚合变更
const aggregated = aggregator.aggregateChanges();

// 获取 Unified Diff
aggregated.forEach(change => {
  console.log(change.unifiedDiff);
  console.log(change.description);
});

// 清空待处理变更（提交后）
aggregator.clearPendingChanges();
```

## 与操作面板集成

### CodeMirror 方案

```typescript
class PanelIntegration {
  private aggregator = new CodeMirrorChangeAggregator();

  async applyPanelChange(filePath: string, position: SourcePosition, updates: StyleUpdate) {
    const currentContent = this.aggregator.getCurrentContent(filePath) || '';

    const { modifySourceCode } = await import('./sourceCodeModifier');
    const result = modifySourceCode(currentContent, position, updates, filePath);

    if (result.success && result.newText) {
      this.aggregator.recordChangeFromContent(
        filePath,
        currentContent,
        result.newText,
        'panel'
      );
    }
  }

  getAggregatedChanges() {
    return this.aggregator.aggregateChanges();
  }
}
```

### Diff 方案

```typescript
class PanelIntegration {
  private aggregator = new DiffChangeAggregator();

  async applyPanelChange(filePath: string, position: SourcePosition, updates: StyleUpdate) {
    const currentContent = this.aggregator.getCurrentContent(filePath) || '';

    const { modifySourceCode } = await import('./sourceCodeModifier');
    const result = modifySourceCode(currentContent, position, updates, filePath);

    if (result.success && result.newText) {
      this.aggregator.recordChange(filePath, result.newText, 'panel');
    }
  }

  getAggregatedChanges() {
    return this.aggregator.aggregateChanges();
  }
}
```

## 生成 AI 消息

### CodeMirror 方案

```typescript
const aggregated = aggregator.aggregateChanges();

const messages = aggregated.map(change => ({
  role: 'user',
  content: `# 源码变更通知\n\n${change.description}`
}));
```

### Diff 方案

```typescript
const aggregated = aggregator.aggregateChanges();

const messages = aggregated.map(change => ({
  role: 'user',
  content: `# 源码变更通知\n\n文件: ${change.filePath}\n\n\`\`\`diff\n${change.unifiedDiff}\n\`\`\`\n\n${change.description}`
}));
```

## 聚合策略

两个方案都支持时间窗口聚合：

- **聚合窗口**：默认 1 秒内的变更会自动合并
- **文件级别**：同一文件的变更会合并为一个批次
- **冲突处理**：重叠的变更会自动合并

可以通过构造函数参数调整：

```typescript
// CodeMirror 方案
const aggregator = new CodeMirrorChangeAggregator({
  aggregationWindow: 2000 // 2秒
});

// Diff 方案
const aggregator = new DiffChangeAggregator();
// 注意：Diff 方案的时间窗口在内部实现，当前版本固定为 1 秒
```

## 选择建议

1. **如果项目已使用 CodeMirror**：推荐使用 CodeMirror 方案，可以更好地集成
2. **如果需要标准 diff 格式**：推荐使用 Diff 方案，可以生成 Git 兼容的格式
3. **如果需要字符级别追踪**：推荐使用 CodeMirror 方案
4. **如果需要行级别追踪**：两种方案都可以，Diff 方案更简单

## 完整示例

查看以下文件获取完整示例：

- `CodeMirrorChangeAggregator.example.ts` - CodeMirror 方案示例
- `DiffChangeAggregator.example.ts` - Diff 方案示例

## 注意事项

1. **内存管理**：定期调用 `clearPendingChanges()` 清理已提交的变更
2. **错误处理**：变更记录可能失败，需要适当的错误处理
3. **性能**：大量变更时，聚合计算可能较慢，考虑使用 Web Worker
4. **并发**：多个文件同时变更时，确保正确设置基础版本
