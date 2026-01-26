# 基于 OT 算法的操作删除方案

## 概述

Operational Transformation (OT) 算法是协作编辑领域的经典算法，用于处理并发操作和保证最终一致性。本文档介绍如何基于 OT 算法实现操作删除功能，解决位置冲突、依赖关系和并发一致性问题。

## OT 算法基础

### 什么是 OT？

OT（Operational Transformation）是一种用于协作编辑的算法，通过变换（transform）操作来解决并发冲突，保证：

1. **收敛性（Convergence）**：所有站点最终得到相同的结果
2. **意图保留（Intention Preservation）**：每个操作的效果都被正确保留
3. **因果有序（Causality Preservation）**：操作的因果顺序被正确维护

### OT 核心概念

- **操作（Operation）**：对文档的修改，如插入、删除
- **变换（Transform）**：将两个操作进行变换，使它们可以交换顺序执行
- **位置调整**：通过变换规则调整操作的位置参数

### 基本 Transform 规则

OT 算法的核心是 transform 函数，用于调整两个操作的相对位置：

| opA 类型 | opB 类型 | Transform 规则（opA 相对于 opB） |
|---------|---------|--------------------------------|
| insert | insert | 如果 opB.pos < opA.pos，则 opA.pos += opB.length |
| insert | delete | 如果 opB 删除位置 < opA.pos，则 opA.pos -= opB.length；如果删除区域跨越 opA.pos，调整到删除范围起始位置 |
| delete | insert | 如果 opB.pos < opA.pos，则 opA.pos += opB.length |
| delete | delete | 处理重叠部分，调整删除范围 |

## 操作删除的挑战

### 问题描述

在 OT 系统中删除一个历史操作时，面临以下挑战：

1. **位置冲突**：后续操作的位置基于包含被删除操作的文本状态计算
2. **依赖关系**：后续操作可能依赖于被删除操作创建的内容
3. **并发一致性**：多个用户可能同时删除操作，需要保证一致性
4. **语义一致性**：删除操作后，需要保证文档状态符合用户意图

### 示例场景

```
原始文本: "Hello"
操作A (v1): insert(5, " World") → "Hello World"
操作B (v2): insert(6, "Beautiful ") → "Hello Beautiful World"
操作C (v3): delete(16, "World") → "Hello Beautiful "
```

如果删除操作A：
- 操作B和操作C的位置都基于 "Hello World" 计算
- 删除操作A后，文本变回 "Hello"
- 操作B和操作C的位置都需要调整

## 方案设计

### 方案一：重放历史 + Transform（推荐）

**核心思想**：从初始状态重新应用所有未被删除的操作，使用 OT transform 规则调整位置。

#### 数据结构

```typescript
interface Operation {
  id: string;
  type: 'insert' | 'delete';
  position: number;
  content: string;      // 对于 insert 是插入内容，对于 delete 是删除内容
  baseVersion: number;   // 操作生成时的文档版本
  siteId: string;        // 操作来源站点ID
  timestamp: number;
  deleted?: boolean;     // 标记是否被删除
}

interface OTManager {
  operations: Operation[];
  deletedOperationIds: Set<string>;
  currentVersion: number;
  originalText: string;
}
```

#### 实现

```typescript
class OTBasedOperationManager {
  private operations: Operation[] = [];
  private deletedOperationIds: Set<string> = new Set();
  private currentVersion: number = 0;
  private originalText: string;

  constructor(originalText: string) {
    this.originalText = originalText;
  }

  addOperation(operation: Operation): void {
    operation.baseVersion = this.currentVersion;
    this.operations.push(operation);
    this.currentVersion++;
  }

  deleteOperation(operationId: string): string {
    // 标记操作为已删除
    this.deletedOperationIds.add(operationId);
    
    // 从原始文本重新应用所有未被删除的操作
    return this.replayOperations();
  }

  private replayOperations(): string {
    let text = this.originalText;
    const appliedOperations: Operation[] = [];
    
    // 按顺序应用所有未被删除的操作
    for (const op of this.operations) {
      if (this.deletedOperationIds.has(op.id)) {
        continue; // 跳过被删除的操作
      }
      
      // 对当前操作进行 transform，使其相对于已应用的操作
      const transformedOp = this.transformOperation(
        op,
        appliedOperations
      );
      
      // 应用变换后的操作
      text = this.applyOperation(text, transformedOp);
      appliedOperations.push(transformedOp);
    }
    
    return text;
  }

  /**
   * 将操作 op 相对于已应用的操作列表进行 transform
   */
  private transformOperation(
    op: Operation,
    appliedOps: Operation[]
  ): Operation {
    let transformedOp = { ...op };
    
    // 对每个已应用的操作进行 transform
    for (const appliedOp of appliedOps) {
      transformedOp = this.transform(transformedOp, appliedOp);
    }
    
    return transformedOp;
  }

  /**
   * OT 核心：transform 两个操作
   * 返回 op1 相对于 op2 变换后的结果
   */
  private transform(op1: Operation, op2: Operation): Operation {
    // 如果 op2 在 op1 之前执行，op1 的位置需要调整
    if (op2.baseVersion < op1.baseVersion) {
      return this.adjustPosition(op1, op2);
    }
    
    // 如果 op2 在 op1 之后执行，但 op2 已经应用，说明 op1 需要相对于 op2 调整
    // 这里简化处理，实际 OT 需要更复杂的逻辑
    return this.adjustPosition(op1, op2);
  }

  /**
   * 根据 op2 调整 op1 的位置
   */
  private adjustPosition(op1: Operation, op2: Operation): Operation {
    const adjustedOp = { ...op1 };
    
    if (op2.type === 'insert') {
      // op2 是插入操作
      if (op2.position <= op1.position) {
        // op2 在 op1 之前或同一位置插入
        adjustedOp.position += op2.content.length;
      }
    } else if (op2.type === 'delete') {
      // op2 是删除操作
      const deleteEnd = op2.position + op2.content.length;
      
      if (op2.position < op1.position) {
        // op2 删除在 op1 之前
        if (deleteEnd <= op1.position) {
          // 完全在 op1 之前，op1 位置前移
          adjustedOp.position -= op2.content.length;
        } else {
          // 删除范围跨越 op1 的位置
          adjustedOp.position = op2.position;
        }
      } else if (op2.position === op1.position && op1.type === 'delete') {
        // 两个删除操作在同一位置，需要特殊处理
        // 这里简化处理，实际需要更复杂的逻辑
      }
    }
    
    return adjustedOp;
  }

  /**
   * 应用操作到文本
   */
  private applyOperation(text: string, operation: Operation): string {
    // 验证位置有效性
    if (operation.position < 0 || operation.position > text.length) {
      console.warn(`Invalid position: ${operation.position}`);
      return text;
    }
    
    switch (operation.type) {
      case 'insert':
        return (
          text.slice(0, operation.position) +
          operation.content +
          text.slice(operation.position)
        );
        
      case 'delete':
        const deleteEnd = operation.position + operation.content.length;
        if (deleteEnd > text.length) {
          console.warn(`Delete operation exceeds text length`);
          return text;
        }
        
        // 验证要删除的内容是否存在
        const actualContent = text.slice(operation.position, deleteEnd);
        if (actualContent !== operation.content) {
          console.warn(
            `Content mismatch: expected "${operation.content}", got "${actualContent}"`
          );
          return text;
        }
        
        return (
          text.slice(0, operation.position) +
          text.slice(deleteEnd)
        );
        
      default:
        return text;
    }
  }

  /**
   * 恢复被删除的操作
   */
  restoreOperation(operationId: string): string {
    this.deletedOperationIds.delete(operationId);
    return this.replayOperations();
  }

  /**
   * 获取当前文本
   */
  getCurrentText(): string {
    return this.replayOperations();
  }
}
```

#### 优点

- **严格保证一致性**：通过 transform 规则保证位置正确
- **支持并发**：可以处理多个用户同时删除操作
- **可恢复**：被删除的操作可以恢复
- **符合 OT 标准**：使用标准的 transform 规则

#### 缺点

- **性能开销**：需要重新应用所有操作，操作数量多时可能较慢
- **实现复杂**：需要正确实现 transform 规则

### 方案二：增量修正 + 依赖检查

**核心思想**：只调整受删除操作影响的操作，而不是重新应用所有操作。

#### 实现

```typescript
class IncrementalOTManager {
  private operations: Operation[] = [];
  private deletedOperationIds: Set<string> = new Set();
  private originalText: string;
  private snapshots: Map<number, string> = new Map(); // version -> text

  constructor(originalText: string) {
    this.originalText = originalText;
    this.snapshots.set(0, originalText);
  }

  addOperation(operation: Operation): void {
    operation.baseVersion = this.operations.length;
    this.operations.push(operation);
    
    // 应用操作并保存快照
    const currentText = this.getCurrentText();
    this.snapshots.set(this.operations.length, currentText);
  }

  deleteOperation(operationId: string): string {
    const operationIndex = this.operations.findIndex(
      op => op.id === operationId
    );
    
    if (operationIndex === -1) {
      return this.getCurrentText();
    }

    const deletedOp = this.operations[operationIndex];
    this.deletedOperationIds.add(operationId);

    // 找到删除操作之前的快照
    const snapshotVersion = deletedOp.baseVersion;
    const snapshotText = this.snapshots.get(snapshotVersion) || this.originalText;

    // 获取需要调整的操作（在删除操作之后的操作）
    const operationsToAdjust = this.operations
      .slice(operationIndex + 1)
      .filter(op => !this.deletedOperationIds.has(op.id));

    // 对每个操作进行 transform，使其相对于被删除的操作
    const adjustedOperations = operationsToAdjust.map(op => {
      return this.transformAgainstDeleted(op, deletedOp);
    });

    // 从快照重新应用调整后的操作
    let text = snapshotText;
    for (const op of adjustedOperations) {
      text = this.applyOperation(text, op);
    }

    // 更新操作列表
    this.operations = this.operations
      .filter(op => op.id !== operationId)
      .map((op, index) => {
        if (index > operationIndex) {
          // 更新后续操作的位置
          return adjustedOperations[index - operationIndex - 1];
        }
        return op;
      });

    return text;
  }

  /**
   * 将操作相对于被删除的操作进行 transform
   */
  private transformAgainstDeleted(
    op: Operation,
    deletedOp: Operation
  ): Operation {
    // 使用 OT transform 规则调整位置
    return this.adjustPosition(op, deletedOp);
  }

  private adjustPosition(op1: Operation, op2: Operation): Operation {
    // 同方案一的实现
    // ...
  }

  private getCurrentText(): string {
    // 从原始文本重新应用所有未被删除的操作
    // ...
  }
}
```

#### 优点

- **性能优化**：只调整受影响的操作，不需要重新应用所有操作
- **快照机制**：利用快照减少计算

#### 缺点

- **实现复杂**：需要正确识别依赖关系
- **边界情况多**：需要处理各种重叠和依赖场景

### 方案三：Tombstone 标记方法

**核心思想**：不真正删除操作，而是标记为"已删除"（tombstone），在应用时跳过。

#### 实现

```typescript
class TombstoneOTManager {
  private operations: Operation[] = [];
  private originalText: string;

  constructor(originalText: string) {
    this.originalText = originalText;
  }

  addOperation(operation: Operation): void {
    this.operations.push(operation);
  }

  deleteOperation(operationId: string): string {
    // 标记为已删除，但不从列表中移除
    const op = this.operations.find(o => o.id === operationId);
    if (op) {
      op.deleted = true;
    }
    
    // 重新应用所有操作（跳过已删除的）
    return this.replayOperations();
  }

  private replayOperations(): string {
    let text = this.originalText;
    const appliedOps: Operation[] = [];
    
    for (const op of this.operations) {
      if (op.deleted) {
        // 跳过已删除的操作，但需要考虑它对位置的影响
        // 这里简化处理，实际需要更复杂的逻辑
        continue;
      }
      
      // Transform 相对于已应用的操作（包括已删除的操作）
      const transformedOp = this.transformOperation(op, appliedOps);
      text = this.applyOperation(text, transformedOp);
      appliedOps.push(transformedOp);
    }
    
    return text;
  }

  /**
   * Transform 操作时，需要考虑已删除操作的位置影响
   */
  private transformOperation(
    op: Operation,
    appliedOps: Operation[]
  ): Operation {
    let transformedOp = { ...op };
    
    // 对已应用的操作进行 transform
    for (const appliedOp of appliedOps) {
      transformedOp = this.transform(transformedOp, appliedOp);
    }
    
    // 对已删除但未应用的操作进行 transform（只考虑位置影响）
    for (const deletedOp of this.operations) {
      if (deletedOp.deleted && deletedOp.baseVersion < op.baseVersion) {
        // 只调整位置，不应用内容
        transformedOp = this.adjustPositionOnly(transformedOp, deletedOp);
      }
    }
    
    return transformedOp;
  }

  /**
   * 只调整位置，不考虑内容
   */
  private adjustPositionOnly(op1: Operation, op2: Operation): Operation {
    // 根据 op2 的类型调整 op1 的位置
    // 同方案一的 adjustPosition 逻辑
    // ...
  }
}
```

#### 优点

- **历史完整性**：保留所有操作历史，便于审计和恢复
- **易于实现**：逻辑相对简单
- **支持恢复**：可以轻松恢复被删除的操作

#### 缺点

- **历史膨胀**：tombstone 标记会不断增加
- **位置计算复杂**：需要考虑已删除操作的位置影响

## Transform 规则详解

### Insert vs Insert

```typescript
function transformInsertInsert(
  op1: Operation, // 要变换的操作
  op2: Operation  // 已应用的操作
): Operation {
  if (op2.position < op1.position) {
    // op2 在 op1 之前插入，op1 位置后移
    return {
      ...op1,
      position: op1.position + op2.content.length
    };
  } else if (op2.position === op1.position) {
    // 同一位置，使用 tie-breaker（如 siteId 或 timestamp）
    if (op2.siteId < op1.siteId) {
      return {
        ...op1,
        position: op1.position + op2.content.length
      };
    }
  }
  return op1;
}
```

### Insert vs Delete

```typescript
function transformInsertDelete(
  op1: Operation, // insert
  op2: Operation  // delete
): Operation {
  const deleteEnd = op2.position + op2.content.length;
  
  if (op2.position < op1.position) {
    if (deleteEnd <= op1.position) {
      // 删除完全在插入位置之前
      return {
        ...op1,
        position: op1.position - op2.content.length
      };
    } else {
      // 删除范围跨越插入位置
      return {
        ...op1,
        position: op2.position
      };
    }
  } else if (op2.position === op1.position) {
    // 删除在插入位置，插入位置不变
    return op1;
  }
  
  return op1;
}
```

### Delete vs Insert

```typescript
function transformDeleteInsert(
  op1: Operation, // delete
  op2: Operation  // insert
): Operation {
  if (op2.position < op1.position) {
    // 插入在删除之前，删除位置后移
    return {
      ...op1,
      position: op1.position + op2.content.length
    };
  } else if (op2.position >= op1.position && 
             op2.position < op1.position + op1.content.length) {
    // 插入在删除范围内，需要分割删除操作
    // 这里简化处理，实际需要更复杂的逻辑
    return op1;
  }
  
  return op1;
}
```

### Delete vs Delete

```typescript
function transformDeleteDelete(
  op1: Operation, // delete
  op2: Operation  // delete
): Operation {
  const op1End = op1.position + op1.content.length;
  const op2End = op2.position + op2.content.length;
  
  if (op2End <= op1.position) {
    // op2 完全在 op1 之前
    return {
      ...op1,
      position: op1.position - op2.content.length
    };
  } else if (op2.position >= op1End) {
    // op2 完全在 op1 之后，位置不变
    return op1;
  } else {
    // 有重叠，需要处理重叠部分
    // 这里简化处理，实际需要更复杂的逻辑
    if (op2.position < op1.position) {
      // op2 开始更早
      const overlap = op1End - op2.position;
      return {
        ...op1,
        position: op2.position,
        content: op1.content.slice(overlap)
      };
    }
  }
  
  return op1;
}
```

## 完整示例

### 场景

```
原始文本: "Hello"
操作A: insert(5, " World") → "Hello World"
操作B: insert(6, "Beautiful ") → "Hello Beautiful World"
操作C: delete(16, "World") → "Hello Beautiful "
```

### 删除操作A的流程

1. **标记操作A为已删除**
2. **重新应用操作**：
   - 操作B：需要 transform 相对于操作A
     - 操作B原位置：6（基于 "Hello World"）
     - Transform 后：6 - 6 = 0（操作A插入的6个字符被移除）
     - 但操作B插入 "Beautiful " 在位置0，结果："Beautiful Hello"
   - 操作C：需要 transform 相对于操作A和操作B
     - 操作C原位置：16（基于 "Hello Beautiful World"）
     - Transform 后：需要调整

3. **最终结果**：从 "Hello" 开始，应用调整后的操作B和操作C

## 性能优化

### 快照策略

- **定期快照**：每 N 个操作创建一个快照
- **版本快照**：在关键版本点创建快照
- **增量快照**：只保存差异

### 缓存机制

- **缓存 transform 结果**：避免重复计算
- **缓存最终文本**：只在操作变化时重新计算

## 并发处理

### 多用户删除

当多个用户同时删除操作时：

1. **使用版本号**：每个操作有 baseVersion
2. **Transform 删除操作**：删除操作本身也需要 transform
3. **最终一致性**：通过 OT 保证所有站点最终一致

### 冲突解决

- **Tie-breaker**：使用 siteId 或 timestamp 决定顺序
- **操作合并**：合并相似的删除操作
- **用户提示**：当冲突无法自动解决时提示用户

## 总结

基于 OT 算法的操作删除方案：

1. **方案一（重放历史）**：最标准，保证一致性，适合所有场景
2. **方案二（增量修正）**：性能更好，但实现复杂
3. **方案三（Tombstone）**：历史完整，但需要处理位置影响

**推荐使用方案一**，因为它：
- 符合 OT 标准
- 保证一致性
- 实现相对简单
- 支持并发和恢复

## 参考资源

- [Operational Transformation - Wikipedia](https://en.wikipedia.org/wiki/Operational_transformation)
- [Google Wave Operational Transformation](https://wave-protocol.googlecode.com/hg-history/wave-protocol%2Ftrunk%2Fspec%2Fcore%2Fwave-ot.html)
- [ShareJS - Real-time collaborative editing](https://github.com/share/sharedb)
