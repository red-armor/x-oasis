/**
 * 操作序列管理器
 *
 * 用于管理用户的操作序列，支持：
 * - 记录操作和快照
 * - 删除中间操作并重新计算后续操作
 * - 自动更新位置信息
 */

import {
  modifySourceCode,
  SourcePosition,
  StyleUpdate,
} from './sourceCodeModifier';

/**
 * 操作类型
 */
export type OperationType =
  | 'add-class'
  | 'remove-class'
  | 'update-style'
  | 'edit-text'
  | 'add-line'
  | 'remove-line'
  | 'modify-content';

/**
 * 操作接口
 */
export interface Operation {
  /** 唯一标识 */
  id: string;
  /** 操作类型 */
  type: OperationType;
  /** 目标位置 */
  target: {
    filePath: string;
    line: number;
    column: number;
  };
  /** 操作负载 */
  payload: {
    className?: string | string[];
    style?: Record<string, string>;
    text?: string;
    content?: string;
    oldContent?: string;
  };
  /** 时间戳 */
  timestamp: number;
  /** 操作来源 */
  source: 'panel' | 'editor';
  /** 操作执行时的上下文（可选） */
  context?: {
    beforeContent?: string;
    afterContent?: string;
  };
}

/**
 * 快照接口
 */
interface Snapshot {
  /** 文件路径 -> 文件内容 */
  files: Map<string, string>;
  /** 快照对应的操作索引 */
  operationIndex: number;
  /** 快照时间戳 */
  timestamp: number;
}

/**
 * 删除操作的结果
 */
export interface RemoveOperationResult {
  /** 是否成功 */
  success: boolean;
  /** 新的操作序列 */
  newOperations: Operation[];
  /** 更新后的源码状态 */
  updatedSourceCode: Map<string, string>;
  /** 失效的操作ID列表 */
  failedOperations: string[];
  /** 错误信息 */
  error?: string;
}

/**
 * 操作序列管理器
 */
export class OperationSequenceManager {
  /** 操作序列 */
  private operations: Operation[] = [];

  /** 关键快照（每 N 个操作保存一次） */
  private keySnapshots: Map<number, Snapshot> = new Map();

  /** 快照间隔（每 N 个操作保存一次快照） */
  private snapshotInterval = 5;

  /** 基础快照（初始状态） */
  private baseSnapshot: Map<string, string> = new Map();

  constructor(options?: {
    /** 快照间隔，默认 5 */
    snapshotInterval?: number;
  }) {
    if (options?.snapshotInterval) {
      this.snapshotInterval = options.snapshotInterval;
    }
  }

  /**
   * 设置基础快照（初始源码状态）
   */
  setBaseSnapshot(files: Map<string, string>): void {
    this.baseSnapshot = new Map(files);
  }

  /**
   * 记录操作
   */
  recordOperation(
    operation: Operation,
    sourceCodeBefore: Map<string, string>,
    sourceCodeAfter: Map<string, string>
  ): void {
    this.operations.push(operation);

    // 在关键节点保存快照
    const currentIndex = this.operations.length - 1;
    if (currentIndex % this.snapshotInterval === 0) {
      this.keySnapshots.set(currentIndex, {
        files: new Map(sourceCodeAfter),
        operationIndex: currentIndex,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 获取所有操作
   */
  getOperations(): Operation[] {
    return [...this.operations];
  }

  /**
   * 获取操作数量
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * 根据ID获取操作
   */
  getOperationById(id: string): Operation | undefined {
    return this.operations.find((op) => op.id === id);
  }

  /**
   * 删除操作
   */
  async removeOperation(operationId: string): Promise<RemoveOperationResult> {
    const index = this.operations.findIndex((op) => op.id === operationId);

    if (index === -1) {
      return {
        success: false,
        newOperations: this.operations,
        updatedSourceCode: new Map(),
        failedOperations: [],
        error: `Operation ${operationId} not found`,
      };
    }

    try {
      // 1. 找到最近的关键快照
      const nearestSnapshotIndex = this.findNearestSnapshot(index);
      const baseSnapshot = this.getSnapshotAt(nearestSnapshotIndex);

      // 2. 获取需要重放的操作
      const operationsBeforeRemoved = this.operations.slice(0, index);
      const operationsAfterRemoved = this.operations.slice(index + 1);

      // 3. 从快照开始应用删除前的操作（如果快照不是最新的）
      let stateBeforeRemoved = baseSnapshot;
      if (nearestSnapshotIndex < index - 1) {
        stateBeforeRemoved = await this.applyOperations(
          baseSnapshot,
          operationsBeforeRemoved.slice(nearestSnapshotIndex + 1)
        );
      }

      // 4. 从删除前的状态重放删除后的操作
      const replayResult = await this.replayOperations(
        stateBeforeRemoved,
        operationsAfterRemoved
      );

      // 5. 更新操作序列
      const newOperations = [
        ...operationsBeforeRemoved,
        ...replayResult.updatedOperations,
      ];

      // 6. 更新快照
      this.updateSnapshotsAfterRemoval(index, newOperations);

      // 7. 更新操作序列
      this.operations = newOperations;

      return {
        success: true,
        newOperations,
        updatedSourceCode: replayResult.finalState,
        failedOperations: replayResult.failedOperations,
      };
    } catch (error: any) {
      return {
        success: false,
        newOperations: this.operations,
        updatedSourceCode: new Map(),
        failedOperations: [],
        error: error.message || 'Failed to remove operation',
      };
    }
  }

  /**
   * 找到最近的关键快照索引
   */
  private findNearestSnapshot(targetIndex: number): number {
    let nearest = -1;
    this.keySnapshots.forEach((_, index) => {
      if (index < targetIndex && index > nearest) {
        nearest = index;
      }
    });
    return nearest;
  }

  /**
   * 获取指定索引的快照
   */
  private getSnapshotAt(index: number): Map<string, string> {
    if (index === -1) {
      // 返回基础快照
      return new Map(this.baseSnapshot);
    }

    const snapshot = this.keySnapshots.get(index);
    if (snapshot) {
      return new Map(snapshot.files);
    }

    // 如果没有快照，返回基础快照
    return new Map(this.baseSnapshot);
  }

  /**
   * 应用操作序列
   */
  private async applyOperations(
    baseState: Map<string, string>,
    operations: Operation[]
  ): Promise<Map<string, string>> {
    const currentState = new Map(baseState);

    for (const operation of operations) {
      const result = await this.applyOperation(operation, currentState);
      if (result.success && result.updatedFiles) {
        result.updatedFiles.forEach((content, filePath) => {
          currentState.set(filePath, content);
        });
      }
    }

    return currentState;
  }

  /**
   * 重放操作序列（删除操作后）
   */
  private async replayOperations(
    baseState: Map<string, string>,
    operations: Operation[]
  ): Promise<{
    finalState: Map<string, string>;
    updatedOperations: Operation[];
    failedOperations: string[];
  }> {
    const currentState = new Map(baseState);
    const updatedOperations: Operation[] = [];
    const failedOperations: string[] = [];

    for (const operation of operations) {
      const result = await this.applyOperation(operation, currentState);

      if (result.success && result.updatedFiles) {
        // 更新当前代码状态
        result.updatedFiles.forEach((content, filePath) => {
          currentState.set(filePath, content);
        });

        // 更新操作的位置信息
        const updatedOperation = this.adjustOperationPosition(
          operation,
          result
        );
        updatedOperations.push(updatedOperation);
      } else {
        // 操作失败，记录但继续处理后续操作
        failedOperations.push(operation.id);
        console.warn(
          `Operation ${operation.id} failed to replay:`,
          result.error
        );
      }
    }

    return {
      finalState: currentState,
      updatedOperations,
      failedOperations,
    };
  }

  /**
   * 应用单个操作
   */
  private async applyOperation(
    operation: Operation,
    currentState: Map<string, string>
  ): Promise<{
    success: boolean;
    updatedFiles?: Map<string, string>;
    error?: string;
    positionAdjustment?: { line: number; column: number };
  }> {
    const filePath = operation.target.filePath;
    const currentContent = currentState.get(filePath);

    if (currentContent === undefined) {
      return {
        success: false,
        error: `File ${filePath} not found in current state`,
      };
    }

    try {
      switch (operation.type) {
        case 'add-class':
        case 'remove-class':
        case 'update-style':
          return this.applyStyleOperation(operation, currentContent);
        case 'edit-text':
        case 'modify-content':
          return this.applyTextOperation(operation, currentContent);
        case 'add-line':
          return this.applyAddLineOperation(operation, currentContent);
        case 'remove-line':
          return this.applyRemoveLineOperation(operation, currentContent);
        default:
          return {
            success: false,
            error: `Unknown operation type: ${operation.type}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to apply operation',
      };
    }
  }

  /**
   * 应用样式相关操作（add-class, remove-class, update-style）
   */
  private applyStyleOperation(
    operation: Operation,
    currentContent: string
  ): {
    success: boolean;
    updatedFiles?: Map<string, string>;
    error?: string;
  } {
    const position: SourcePosition = {
      line: operation.target.line,
      column: operation.target.column,
    };

    const updates: StyleUpdate = {};

    if (operation.type === 'add-class' && operation.payload.className) {
      updates.className = operation.payload.className;
    } else if (operation.type === 'update-style' && operation.payload.style) {
      updates.style = operation.payload.style;
    } else if (operation.type === 'remove-class') {
      // 移除类名需要特殊处理，这里简化处理
      // 实际实现可能需要解析现有类名并移除指定的类
      updates.className = operation.payload.className;
    }

    const result = modifySourceCode(
      currentContent,
      position,
      updates,
      operation.target.filePath
    );

    if (result.success && result.newText) {
      const updatedFiles = new Map<string, string>();
      updatedFiles.set(operation.target.filePath, result.newText);
      return {
        success: true,
        updatedFiles,
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to apply style operation',
    };
  }

  /**
   * 应用文本编辑操作
   */
  private applyTextOperation(
    operation: Operation,
    currentContent: string
  ): {
    success: boolean;
    updatedFiles?: Map<string, string>;
    error?: string;
  } {
    // 文本编辑操作需要根据具体需求实现
    // 这里提供一个简化版本
    const lines = currentContent.split('\n');
    const targetLine = operation.target.line - 1; // 转换为 0-based

    if (targetLine < 0 || targetLine >= lines.length) {
      return {
        success: false,
        error: `Line ${operation.target.line} is out of range`,
      };
    }

    // 简单的文本替换（实际应该使用更精确的 AST 操作）
    if (operation.type === 'edit-text' && operation.payload.text) {
      const line = lines[targetLine];
      const before = line.substring(0, operation.target.column);
      const after = line.substring(operation.target.column);
      lines[targetLine] = before + operation.payload.text + after;
    } else if (
      operation.type === 'modify-content' &&
      operation.payload.content
    ) {
      lines[targetLine] = operation.payload.content;
    }

    const updatedFiles = new Map<string, string>();
    updatedFiles.set(operation.target.filePath, lines.join('\n'));

    return {
      success: true,
      updatedFiles,
    };
  }

  /**
   * 应用添加行操作
   */
  private applyAddLineOperation(
    operation: Operation,
    currentContent: string
  ): {
    success: boolean;
    updatedFiles?: Map<string, string>;
    error?: string;
    positionAdjustment?: { line: number; column: number };
  } {
    const lines = currentContent.split('\n');
    const targetLine = operation.target.line - 1; // 转换为 0-based

    if (targetLine < 0 || targetLine > lines.length) {
      return {
        success: false,
        error: `Line ${operation.target.line} is out of range`,
      };
    }

    const newLine = operation.payload.content || '';
    lines.splice(targetLine, 0, newLine);

    const updatedFiles = new Map<string, string>();
    updatedFiles.set(operation.target.filePath, lines.join('\n'));

    return {
      success: true,
      updatedFiles,
      // 添加行后，后续操作的行号需要 +1
      positionAdjustment: { line: 1, column: 0 },
    };
  }

  /**
   * 应用删除行操作
   */
  private applyRemoveLineOperation(
    operation: Operation,
    currentContent: string
  ): {
    success: boolean;
    updatedFiles?: Map<string, string>;
    error?: string;
    positionAdjustment?: { line: number; column: number };
  } {
    const lines = currentContent.split('\n');
    const targetLine = operation.target.line - 1; // 转换为 0-based

    if (targetLine < 0 || targetLine >= lines.length) {
      return {
        success: false,
        error: `Line ${operation.target.line} is out of range`,
      };
    }

    lines.splice(targetLine, 1);

    const updatedFiles = new Map<string, string>();
    updatedFiles.set(operation.target.filePath, lines.join('\n'));

    return {
      success: true,
      updatedFiles,
      // 删除行后，后续操作的行号需要 -1
      positionAdjustment: { line: -1, column: 0 },
    };
  }

  /**
   * 调整操作位置（基于应用结果）
   */
  private adjustOperationPosition(
    originalOperation: Operation,
    applyResult: { positionAdjustment?: { line: number; column: number } }
  ): Operation {
    if (!applyResult.positionAdjustment) {
      return originalOperation;
    }

    // 注意：这里只是简单的调整，实际实现可能需要更复杂的逻辑
    // 因为前面的操作可能改变了行号，需要累积计算
    return {
      ...originalOperation,
      target: {
        ...originalOperation.target,
        line:
          originalOperation.target.line +
          (applyResult.positionAdjustment.line || 0),
        column:
          originalOperation.target.column +
          (applyResult.positionAdjustment.column || 0),
      },
    };
  }

  /**
   * 更新快照（删除操作后）
   */
  private updateSnapshotsAfterRemoval(
    removedIndex: number,
    newOperations: Operation[]
  ): void {
    // 清理被删除操作的快照（如果有）
    const removedOp = this.operations[removedIndex];
    if (removedOp) {
      // 快照是基于索引的，删除操作后索引会变化，需要重新计算
      // 这里简化处理：清理所有快照，让系统在需要时重新生成
      // 实际实现可以更智能地只更新受影响的快照
    }

    // 重新计算关键快照的索引
    const newKeySnapshots = new Map<number, Snapshot>();
    this.keySnapshots.forEach((snapshot, oldIndex) => {
      if (oldIndex < removedIndex) {
        // 删除操作之前的快照，索引不变
        newKeySnapshots.set(oldIndex, snapshot);
      } else if (oldIndex > removedIndex) {
        // 删除操作之后的快照，索引需要 -1
        newKeySnapshots.set(oldIndex - 1, snapshot);
      }
      // oldIndex === removedIndex 的快照被删除
    });

    this.keySnapshots = newKeySnapshots;
  }

  /**
   * 清空所有操作和快照
   */
  clear(): void {
    this.operations = [];
    this.keySnapshots.clear();
    this.baseSnapshot.clear();
  }

  /**
   * 获取当前源码状态（通过重放所有操作）
   */
  async getCurrentState(): Promise<Map<string, string>> {
    return this.applyOperations(this.baseSnapshot, this.operations);
  }
}
