# 基于 Y.js 的操作删除方案

## 概述

Y.js 是一个基于 CRDT (Conflict-free Replicated Data Type) 的协作编辑库，提供了 `Y.Text`、`Y.Array` 等共享类型，支持多用户并发编辑并保证最终一致性。本文档介绍如何基于 Y.js 实现操作删除功能，从操作历史中删除指定的操作。

## Y.js 基础

### 什么是 Y.js？

Y.js 是一个 CRDT 实现，与 OT 算法不同：

- **CRDT vs OT**：
  - OT：通过变换操作解决冲突
  - CRDT：通过数据结构本身保证无冲突合并

- **核心特性**：
  - **最终一致性**：所有站点最终得到相同结果
  - **无冲突合并**：不需要复杂的冲突解决逻辑
  - **结构保持**：操作历史以结构化的方式保存

### Y.js 关键机制

#### 1. Y.Text 和删除操作

```typescript
import * as Y from 'yjs';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('text');

// 插入文本
ytext.insert(0, 'Hello');

// 删除文本（标记为 deleted，不是物理删除）
ytext.delete(0, 5); // 删除从位置0开始的5个字符
```

**重要**：Y.js 的 `delete` 操作不会物理移除内容，而是将其标记为 `deleted`（tombstone），这样可以：
- 保持操作历史完整性
- 支持撤销/重做
- 保证 CRDT 结构一致性

#### 2. RelativePosition

Y.js 使用 `RelativePosition` 来处理位置，避免绝对位置的问题：

```typescript
import { RelativePosition } from 'yjs';

// 创建相对位置
const pos = RelativePosition.create(ytext, 5);

// 从相对位置获取绝对位置
const absolutePos = RelativePosition.createAbsolutePosition(ytext, pos);
```

#### 3. Item 结构

Y.js 内部使用 Item 结构表示操作：

```typescript
interface Item {
  id: ID;           // 唯一标识
  left: Item | null; // 左兄弟节点
  right: Item | null; // 右兄弟节点
  deleted: boolean;  // 是否被删除
  content: any;     // 内容
}
```

#### 4. UndoManager

Y.js 提供了 `UndoManager` 来管理撤销/重做：

```typescript
import { UndoManager } from 'yjs';

const undoManager = new UndoManager(ytext);

// 撤销
undoManager.undo();

// 重做
undoManager.redo();
```

## 操作删除的挑战

### 问题描述

在 Y.js 中删除一个历史操作时，面临以下挑战：

1. **CRDT 结构保持**：Y.js 的删除是标记式的，不能直接物理删除操作
2. **位置依赖**：后续操作可能依赖于被删除操作创建的内容
3. **Item 引用**：其他 Item 可能引用了被删除的 Item
4. **并发一致性**：多用户协作时需要保证一致性

### 示例场景

```typescript
// 初始文本: "Hello"
ytext.insert(0, 'Hello');

// 操作A: 插入 " World"
ytext.insert(5, ' World'); // "Hello World"

// 操作B: 插入 "Beautiful "
ytext.insert(6, 'Beautiful '); // "Hello Beautiful World"

// 操作C: 删除 "World"
ytext.delete(16, 5); // "Hello Beautiful "
```

如果删除操作A：
- 操作B和操作C的位置都基于 "Hello World" 计算
- 删除操作A后，需要调整操作B和操作C的位置
- 但 Y.js 的 Item 结构需要保持完整性

## 方案设计

### 方案一：UndoManager 机制（简单场景）

**核心思想**：使用 Y.js 的 `UndoManager` 来撤销操作。

#### 实现

```typescript
import * as Y from 'yjs';
import { UndoManager } from 'yjs';

interface OperationMetadata {
  id: string;
  operation: Y.TextEvent;
  timestamp: number;
  undoStackIndex?: number;
}

class YjsUndoBasedManager {
  private ydoc: Y.Doc;
  private ytext: Y.Text;
  private undoManager: UndoManager;
  private operationHistory: OperationMetadata[] = [];
  private undoStack: Y.Transaction[] = [];

  constructor() {
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('text');
    this.undoManager = new UndoManager(this.ytext);
    
    // 监听操作
    this.ytext.observe((event) => {
      this.recordOperation(event);
    });
  }

  /**
   * 记录操作
   */
  private recordOperation(event: Y.TextEvent): void {
    const metadata: OperationMetadata = {
      id: this.generateId(),
      operation: event,
      timestamp: Date.now()
    };
    this.operationHistory.push(metadata);
  }

  /**
   * 删除操作（通过撤销）
   */
  deleteOperation(operationId: string): void {
    const operationIndex = this.operationHistory.findIndex(
      op => op.id === operationId
    );
    
    if (operationIndex === -1) {
      return;
    }

    // 找到操作在历史中的位置
    // 需要撤销到该操作之前，然后重新应用后续操作
    const targetOperation = this.operationHistory[operationIndex];
    
    // 使用 UndoManager 撤销
    // 注意：UndoManager 只能撤销最近的操作，不能撤销历史中的任意操作
    // 所以这个方案有限制
    this.undoOperation(operationIndex);
  }

  /**
   * 撤销操作
   */
  private undoOperation(index: number): void {
    // 计算需要撤销的步数
    const stepsToUndo = this.operationHistory.length - index;
    
    // 撤销到目标操作之前
    for (let i = 0; i < stepsToUndo; i++) {
      this.undoManager.undo();
    }
    
    // 重新应用后续操作（排除被删除的操作）
    const operationsToReapply = this.operationHistory
      .slice(index + 1)
      .filter(op => !op.deleted);
    
    // 重新应用操作
    for (const op of operationsToReapply) {
      this.reapplyOperation(op);
    }
  }

  private reapplyOperation(op: OperationMetadata): void {
    // 重新应用操作
    // 需要从 event 中提取操作信息
    // 这里简化处理，实际需要更复杂的逻辑
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random()}`;
  }
}
```

#### 优点

- **使用 Y.js 原生功能**：利用 `UndoManager`
- **不破坏 CRDT 结构**：通过撤销机制
- **实现相对简单**：不需要复杂的 transform 逻辑

#### 缺点

- **限制**：只能撤销最近的操作，不能删除历史中的任意操作
- **性能**：需要撤销和重新应用操作
- **依赖顺序**：操作必须按顺序撤销

### 方案二：Replay 机制 + RelativePosition（推荐）

**核心思想**：保存快照和操作元数据，删除操作后从快照重新应用，使用 RelativePosition 处理位置。

#### 数据结构

```typescript
import * as Y from 'yjs';
import { RelativePosition } from 'yjs';

interface OperationMetadata {
  id: string;
  type: 'insert' | 'delete';
  position: RelativePosition | number; // 使用相对位置或绝对位置
  content: string;
  length?: number; // 对于 delete 操作
  timestamp: number;
  transactionId?: string;
  deleted?: boolean; // 标记是否被删除
}

interface Snapshot {
  version: number;
  ytextState: Uint8Array; // Y.js 的编码状态
  text: string; // 文本内容
  operationIds: string[]; // 包含的操作ID
  timestamp: number;
}
```

#### 实现

```typescript
import * as Y from 'yjs';
import { RelativePosition } from 'yjs';

class YjsReplayManager {
  private ydoc: Y.Doc;
  private ytext: Y.Text;
  private operationHistory: OperationMetadata[] = [];
  private snapshots: Snapshot[] = [];
  private snapshotInterval: number = 10; // 每10个操作创建一个快照
  private deletedOperationIds: Set<string> = new Set();

  constructor(initialText: string = '') {
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('text');
    
    if (initialText) {
      this.ytext.insert(0, initialText);
    }
    
    // 创建初始快照
    this.createSnapshot();
    
    // 监听操作
    this.ytext.observe((event) => {
      this.recordOperation(event);
    });
  }

  /**
   * 记录操作
   */
  private recordOperation(event: Y.TextEvent): void {
    event.changes.delta.forEach((delta) => {
      if (delta.insert) {
        // 插入操作
        const metadata: OperationMetadata = {
          id: this.generateId(),
          type: 'insert',
          position: this.getCurrentPosition(delta),
          content: delta.insert as string,
          timestamp: Date.now()
        };
        this.operationHistory.push(metadata);
      } else if (delta.delete) {
        // 删除操作
        const metadata: OperationMetadata = {
          id: this.generateId(),
          type: 'delete',
          position: this.getCurrentPosition(delta),
          length: delta.delete,
          content: '', // 需要从原始文本中获取
          timestamp: Date.now()
        };
        this.operationHistory.push(metadata);
      }
    });

    // 定期创建快照
    if (this.operationHistory.length % this.snapshotInterval === 0) {
      this.createSnapshot();
    }
  }

  /**
   * 获取当前位置（转换为 RelativePosition）
   */
  private getCurrentPosition(delta: any): RelativePosition {
    // 简化处理，实际需要根据 delta 计算位置
    // 这里返回一个占位符
    return RelativePosition.create(this.ytext, 0);
  }

  /**
   * 创建快照
   */
  private createSnapshot(): void {
    const state = Y.encodeStateAsUpdate(this.ydoc);
    const text = this.ytext.toString();
    const operationIds = this.operationHistory.map(op => op.id);

    this.snapshots.push({
      version: this.operationHistory.length,
      ytextState: state,
      text,
      operationIds,
      timestamp: Date.now()
    });
  }

  /**
   * 删除操作
   */
  deleteOperation(operationId: string): string {
    const operationIndex = this.operationHistory.findIndex(
      op => op.id === operationId
    );

    if (operationIndex === -1) {
      return this.ytext.toString();
    }

    // 标记为已删除
    this.deletedOperationIds.add(operationId);

    // 找到包含此操作之前的最近快照
    const snapshot = this.findSnapshotBeforeOperation(operationIndex);
    
    // 从快照恢复
    this.restoreFromSnapshot(snapshot);

    // 重新应用未被删除的操作
    const operationsToReapply = this.operationHistory
      .slice(snapshot.operationIds.length)
      .filter(op => !this.deletedOperationIds.has(op.id));

    // 重新应用操作
    for (const op of operationsToReapply) {
      this.reapplyOperation(op);
    }

    // 更新操作历史
    this.operationHistory = this.operationHistory.filter(
      op => !this.deletedOperationIds.has(op.id)
    );

    return this.ytext.toString();
  }

  /**
   * 找到操作之前的快照
   */
  private findSnapshotBeforeOperation(operationIndex: number): Snapshot {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].operationIds.length <= operationIndex) {
        return this.snapshots[i];
      }
    }
    return this.snapshots[0];
  }

  /**
   * 从快照恢复
   */
  private restoreFromSnapshot(snapshot: Snapshot): void {
    // 创建新的文档
    const newDoc = new Y.Doc();
    Y.applyUpdate(newDoc, snapshot.ytextState);
    
    // 替换当前文档
    this.ydoc = newDoc;
    this.ytext = this.ydoc.getText('text');
  }

  /**
   * 重新应用操作
   */
  private reapplyOperation(op: OperationMetadata): void {
    // 将 RelativePosition 转换为绝对位置
    let position: number;
    
    if (op.position instanceof RelativePosition) {
      position = RelativePosition.createAbsolutePosition(
        this.ytext,
        op.position
      ) || 0;
    } else {
      position = op.position as number;
    }

    // 验证位置有效性
    if (position < 0 || position > this.ytext.length) {
      console.warn(`Invalid position: ${position}`);
      return;
    }

    // 应用操作
    if (op.type === 'insert') {
      this.ytext.insert(position, op.content);
    } else if (op.type === 'delete') {
      // 验证要删除的内容是否存在
      const actualContent = this.ytext.toString().slice(
        position,
        position + (op.length || 0)
      );
      
      if (actualContent.length === (op.length || 0)) {
        this.ytext.delete(position, op.length || 0);
      } else {
        console.warn(`Content mismatch for delete operation`);
      }
    }
  }

  /**
   * 恢复被删除的操作
   */
  restoreOperation(operationId: string): string {
    this.deletedOperationIds.delete(operationId);
    
    // 重新应用所有操作
    return this.replayAllOperations();
  }

  /**
   * 重新应用所有操作
   */
  private replayAllOperations(): string {
    // 从初始快照开始
    const initialSnapshot = this.snapshots[0];
    this.restoreFromSnapshot(initialSnapshot);

    // 应用所有未被删除的操作
    for (const op of this.operationHistory) {
      if (!this.deletedOperationIds.has(op.id)) {
        this.reapplyOperation(op);
      }
    }

    return this.ytext.toString();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random()}`;
  }

  /**
   * 获取当前文本
   */
  getCurrentText(): string {
    return this.ytext.toString();
  }
}
```

#### 优点

- **精确控制**：可以删除历史中的任意操作
- **位置处理**：使用 RelativePosition 处理位置问题
- **不破坏结构**：通过快照恢复，保持 CRDT 结构

#### 缺点

- **性能开销**：需要重新应用操作
- **存储需求**：需要保存快照和元数据
- **实现复杂**：需要处理 RelativePosition 转换

### 方案三：标记式 "Operation Disabled"（实用方案）

**核心思想**：不真正删除操作，而是标记为 disabled，在视图层忽略其效果。

#### 实现

```typescript
import * as Y from 'yjs';

interface OperationMetadata {
  id: string;
  type: 'insert' | 'delete';
  position: number;
  content: string;
  length?: number;
  timestamp: number;
  disabled?: boolean; // 标记是否被禁用
  itemId?: string; // Y.js Item ID
}

class YjsDisabledManager {
  private ydoc: Y.Doc;
  private ytext: Y.Text;
  private operationMetadata: Map<string, OperationMetadata> = new Map();
  private disabledOperationIds: Set<string> = new Set();

  constructor() {
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('text');
    
    // 监听操作
    this.ytext.observe((event) => {
      this.recordOperation(event);
    });
  }

  /**
   * 记录操作
   */
  private recordOperation(event: Y.TextEvent): void {
    event.changes.delta.forEach((delta, index) => {
      if (delta.insert) {
        const metadata: OperationMetadata = {
          id: this.generateId(),
          type: 'insert',
          position: this.calculatePosition(event, index),
          content: delta.insert as string,
          timestamp: Date.now()
        };
        this.operationMetadata.set(metadata.id, metadata);
      } else if (delta.delete) {
        const metadata: OperationMetadata = {
          id: this.generateId(),
          type: 'delete',
          position: this.calculatePosition(event, index),
          length: delta.delete,
          content: '',
          timestamp: Date.now()
        };
        this.operationMetadata.set(metadata.id, metadata);
      }
    });
  }

  private calculatePosition(event: Y.TextEvent, index: number): number {
    // 计算操作位置
    // 这里简化处理
    return 0;
  }

  /**
   * 删除操作（标记为 disabled）
   */
  deleteOperation(operationId: string): void {
    this.disabledOperationIds.add(operationId);
    
    const metadata = this.operationMetadata.get(operationId);
    if (metadata) {
      metadata.disabled = true;
    }
  }

  /**
   * 获取有效文本（排除 disabled 操作）
   */
  getEffectiveText(): string {
    // 方法1：通过 delta 过滤
    return this.getTextFromDelta();
    
    // 方法2：重新构建文本（从原始状态 + 有效操作）
    // return this.rebuildText();
  }

  /**
   * 通过 delta 获取文本
   */
  private getTextFromDelta(): string {
    let text = '';
    let currentPos = 0;

    // 获取所有操作，按位置排序
    const operations = Array.from(this.operationMetadata.values())
      .filter(op => !this.disabledOperationIds.has(op.id))
      .sort((a, b) => a.position - b.position);

    for (const op of operations) {
      if (op.type === 'insert') {
        // 插入内容
        if (op.position <= currentPos) {
          text = text.slice(0, op.position) + op.content + text.slice(op.position);
          currentPos = op.position + op.content.length;
        }
      } else if (op.type === 'delete') {
        // 删除内容
        if (op.position < text.length) {
          const deleteEnd = Math.min(op.position + (op.length || 0), text.length);
          text = text.slice(0, op.position) + text.slice(deleteEnd);
          currentPos = op.position;
        }
      }
    }

    return text;
  }

  /**
   * 恢复操作
   */
  restoreOperation(operationId: string): void {
    this.disabledOperationIds.delete(operationId);
    
    const metadata = this.operationMetadata.get(operationId);
    if (metadata) {
      metadata.disabled = false;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random()}`;
  }
}
```

#### 优点

- **实现简单**：只需要标记，不需要复杂的重放逻辑
- **风险低**：不修改 CRDT 结构
- **可恢复**：可以轻松恢复被删除的操作
- **历史完整**：保留所有操作历史

#### 缺点

- **只是视觉删除**：CRDT 结构中操作仍然存在
- **位置问题**：后续操作的位置可能仍然基于被删除的操作
- **元数据增加**：需要维护额外的元数据

## 完整示例

### 场景

```typescript
// 初始文本: "Hello"
const manager = new YjsReplayManager('Hello');

// 操作A: 插入 " World"
// 操作B: 插入 "Beautiful "
// 操作C: 删除 "World"

// 删除操作A
manager.deleteOperation('operation-a-id');
```

### 删除操作A的流程（方案二）

1. **标记操作A为已删除**
2. **找到快照**：找到操作A之前的最近快照
3. **恢复快照**：从快照恢复 Y.js 文档状态
4. **重新应用操作**：
   - 操作B：使用 RelativePosition 重新计算位置
   - 操作C：使用 RelativePosition 重新计算位置
5. **更新操作历史**：移除被删除的操作

## 与 Y.js 原生删除的对比

### Y.js 的 delete 方法

```typescript
ytext.delete(0, 5); // 删除文本内容，标记为 deleted
```

- **作用**：删除文本内容
- **效果**：内容被标记为 deleted，但操作历史保留
- **用途**：编辑文档内容

### 我们的 deleteOperation

```typescript
manager.deleteOperation('operation-id'); // 从历史中删除操作
```

- **作用**：从操作历史中删除操作
- **效果**：操作不再影响文档，但可能需要重新应用其他操作
- **用途**：选择性撤销历史操作

## 性能优化

### 快照策略

```typescript
// 策略1：定期快照
if (operationCount % 10 === 0) {
  createSnapshot();
}

// 策略2：版本快照
if (isMajorVersion(version)) {
  createSnapshot();
}

// 策略3：增量快照
createIncrementalSnapshot();
```

### 缓存机制

```typescript
// 缓存最终文本
private cachedText: string | null = null;
private cacheVersion: number = -1;

getCurrentText(): string {
  if (this.cacheVersion === this.operationHistory.length) {
    return this.cachedText!;
  }
  
  this.cachedText = this.replayAllOperations();
  this.cacheVersion = this.operationHistory.length;
  return this.cachedText;
}
```

## 并发处理

### 多用户删除

当多个用户同时删除操作时：

```typescript
// 使用 Y.js 的 awareness 机制
import { awareness } from 'y-protocols/awareness';

// 同步删除操作
awareness.setLocalStateField('deletedOperations', deletedOperationIds);

// 监听其他用户的删除
awareness.on('change', () => {
  const remoteDeletedOps = awareness.getStates()
    .map(state => state.deletedOperations)
    .flat();
  
  // 合并删除操作
  remoteDeletedOps.forEach(id => {
    this.deletedOperationIds.add(id);
  });
});
```

### 冲突解决

- **操作合并**：使用 Y.js 的 CRDT 特性自动合并
- **版本控制**：使用版本号处理冲突
- **用户提示**：当无法自动解决时提示用户

## 总结

基于 Y.js 的操作删除方案：

1. **方案一（UndoManager）**：适合撤销最近的操作，实现简单但有限制
2. **方案二（Replay + RelativePosition）**：最灵活，可以删除历史中的任意操作，推荐使用
3. **方案三（Disabled 标记）**：最简单，但只是视觉删除，适合简单场景

**推荐使用方案二**，因为它：
- 可以删除历史中的任意操作
- 使用 RelativePosition 处理位置问题
- 通过快照保持 CRDT 结构
- 支持恢复操作

## 参考资源

- [Y.js 官方文档](https://docs.yjs.dev/)
- [Y.js GitHub](https://github.com/yjs/yjs)
- [CRDT 介绍](https://crdt.tech/)
- [Y.js 示例](https://github.com/yjs/yjs/tree/master/demos)
