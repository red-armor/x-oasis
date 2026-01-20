/**
 * OperationSequenceManager 使用示例
 *
 * 这个文件展示了如何使用操作序列管理器
 */

import {
  OperationSequenceManager,
  Operation,
} from './OperationSequenceManager';

// ==================== 基本使用 ====================

async function basicExample() {
  // 1. 创建管理器实例
  const manager = new OperationSequenceManager({
    snapshotInterval: 5, // 每 5 个操作保存一次快照
  });

  // 2. 设置基础快照（初始源码状态）
  const baseFiles = new Map<string, string>();
  baseFiles.set(
    'src/Button.tsx',
    `
export const Button = () => {
  return <div>Click me</div>;
};
`
  );
  manager.setBaseSnapshot(baseFiles);

  // 3. 记录操作
  const operation1: Operation = {
    id: 'op1',
    type: 'add-class',
    target: {
      filePath: 'src/Button.tsx',
      line: 2,
      column: 15,
    },
    payload: {
      className: 'btn-primary',
    },
    timestamp: Date.now(),
    source: 'panel',
  };

  // 获取操作前的源码
  const beforeOp1 = await manager.getCurrentState();

  // 应用操作（这里简化，实际应该调用 modifySourceCode）
  const afterOp1 = new Map(beforeOp1);
  // ... 应用操作逻辑 ...

  // 记录操作
  manager.recordOperation(operation1, beforeOp1, afterOp1);

  // 4. 继续记录更多操作...
  const operation2: Operation = {
    id: 'op2',
    type: 'update-style',
    target: {
      filePath: 'src/Button.tsx',
      line: 2,
      column: 15,
    },
    payload: {
      style: { color: 'red' },
    },
    timestamp: Date.now(),
    source: 'panel',
  };

  const beforeOp2 = await manager.getCurrentState();
  // ... 应用操作 ...
  const afterOp2 = new Map(beforeOp2);
  manager.recordOperation(operation2, beforeOp2, afterOp2);

  // 5. 删除中间操作（比如删除 op1）
  const result = await manager.removeOperation('op1');

  if (result.success) {
    console.log('操作删除成功');
    console.log('新的操作序列:', result.newOperations);
    console.log('更新后的源码:', result.updatedSourceCode);
    console.log('失效的操作:', result.failedOperations);
  } else {
    console.error('操作删除失败:', result.error);
  }
}

// ==================== 与 SketchService 集成 ====================

class CodeModService {
  private operationManager: OperationSequenceManager;
  private currentSourceCode: Map<string, string> = new Map();

  constructor() {
    this.operationManager = new OperationSequenceManager({
      snapshotInterval: 5,
    });
  }

  /**
   * 初始化源码状态
   */
  initializeSourceCode(files: Map<string, string>) {
    this.currentSourceCode = new Map(files);
    this.operationManager.setBaseSnapshot(files);
  }

  /**
   * 记录操作面板的变更
   */
  async onSketchChanged(options: {
    lineNum: number;
    content?: string;
    class?: string;
    style?: string;
    filePath: string;
  }) {
    const operationId = `op-${Date.now()}-${Math.random()}`;
    const beforeState = new Map(this.currentSourceCode);

    // 应用变更
    const filePath = options.filePath;
    const currentContent = this.currentSourceCode.get(filePath) || '';

    // 使用 modifySourceCode 应用变更
    const { modifySourceCode } = await import('./sourceCodeModifier');
    const result = modifySourceCode(
      currentContent,
      { line: options.lineNum, column: 0 },
      {
        className: options.class,
        style: options.style ? { [options.style]: '' } : undefined,
      },
      filePath
    );

    if (result.success && result.newText) {
      const afterState = new Map(this.currentSourceCode);
      afterState.set(filePath, result.newText);
      this.currentSourceCode = afterState;

      // 记录操作
      const operation: Operation = {
        id: operationId,
        type: options.class
          ? 'add-class'
          : options.style
          ? 'update-style'
          : 'modify-content',
        target: {
          filePath,
          line: options.lineNum,
          column: 0,
        },
        payload: {
          className: options.class,
          style: options.style ? { [options.style]: '' } : undefined,
          content: options.content,
        },
        timestamp: Date.now(),
        source: 'panel',
      };

      this.operationManager.recordOperation(operation, beforeState, afterState);
    }
  }

  /**
   * 删除草稿消息（对应删除操作）
   */
  async removeDraftMessageById(id: string) {
    const result = await this.operationManager.removeOperation(id);

    if (result.success) {
      // 更新当前源码状态
      this.currentSourceCode = result.updatedSourceCode;

      // 如果有失效的操作，可能需要通知用户
      if (result.failedOperations.length > 0) {
        console.warn('以下操作在重放时失效:', result.failedOperations);
      }
    }

    return result;
  }

  /**
   * 获取所有操作
   */
  getOperations(): Operation[] {
    return this.operationManager.getOperations();
  }

  /**
   * 获取当前源码状态
   */
  async getCurrentState(): Promise<Map<string, string>> {
    return this.operationManager.getCurrentState();
  }
}

// ==================== 错误处理示例 ====================

async function errorHandlingExample() {
  const manager = new OperationSequenceManager();

  // 设置基础快照
  const baseFiles = new Map<string, string>();
  baseFiles.set('src/App.tsx', 'export default App;');
  manager.setBaseSnapshot(baseFiles);

  // 尝试删除不存在的操作
  const result = await manager.removeOperation('non-existent-id');

  if (!result.success) {
    console.error('删除失败:', result.error);
    // 处理错误...
  }
}

// ==================== 批量操作示例 ====================

async function batchOperationsExample() {
  const manager = new OperationSequenceManager();

  // 设置基础快照
  const baseFiles = new Map<string, string>();
  baseFiles.set('src/Component.tsx', 'export const Component = () => null;');
  manager.setBaseSnapshot(baseFiles);

  // 记录多个操作
  for (let i = 0; i < 10; i++) {
    const operation: Operation = {
      id: `op-${i}`,
      type: 'add-class',
      target: {
        filePath: 'src/Component.tsx',
        line: 1,
        column: 0,
      },
      payload: {
        className: `class-${i}`,
      },
      timestamp: Date.now() + i,
      source: 'panel',
    };

    const before = await manager.getCurrentState();
    // ... 应用操作 ...
    const after = new Map(before);
    manager.recordOperation(operation, before, after);
  }

  // 删除第 3 个操作（索引从 0 开始，所以是 op-2）
  const result = await manager.removeOperation('op-2');

  if (result.success) {
    console.log(`删除了操作 op-2，剩余 ${result.newOperations.length} 个操作`);
    // 后续操作会自动重新应用，位置信息会自动更新
  }
}

export {
  basicExample,
  CodeModService,
  errorHandlingExample,
  batchOperationsExample,
};
