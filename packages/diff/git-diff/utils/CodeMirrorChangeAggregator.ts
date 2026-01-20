/**
 * CodeMirror 原生变更聚合器
 *
 * 使用 CodeMirror 6 的 Transaction 系统来追踪和聚合源码变更
 *
 * 依赖：
 * - @codemirror/state
 * - @codemirror/view
 */

import { EditorState, Transaction } from '@codemirror/state';

/**
 * 变更类型
 */
export type ChangeType = 'insert' | 'delete' | 'replace';

/**
 * 单个变更
 */
export interface CodeChange {
  /** 变更类型 */
  type: ChangeType;
  /** 起始位置（字符偏移） */
  from: number;
  /** 结束位置（字符偏移） */
  to: number;
  /** 插入的文本 */
  insert?: string;
  /** 删除的文本 */
  delete?: string;
  /** 行号（起始） */
  lineFrom: number;
  /** 行号（结束） */
  lineTo: number;
  /** 时间戳 */
  timestamp: number;
  /** 变更来源 */
  source: 'panel' | 'editor';
}

/**
 * 聚合后的变更
 */
export interface AggregatedChange {
  /** 文件路径 */
  filePath: string;
  /** 变更列表 */
  changes: CodeChange[];
  /** 变更摘要 */
  summary: {
    totalInsertions: number;
    totalDeletions: number;
    totalReplacements: number;
    affectedLines: number[];
  };
  /** 变更描述（用于 AI 模型） */
  description: string;
}

/**
 * CodeMirror 变更聚合器
 */
export class CodeMirrorChangeAggregator {
  /** 文件路径 -> EditorState 映射 */
  private editorStates: Map<string, EditorState> = new Map();

  /** 文件路径 -> 基础版本（初始状态） */
  private baseVersions: Map<string, string> = new Map();

  /** 文件路径 -> 变更列表 */
  private pendingChanges: Map<string, CodeChange[]> = new Map();

  /** 聚合时间窗口（毫秒） */
  private aggregationWindow = 1000;

  constructor(options?: {
    /** 聚合时间窗口，默认 1000ms */
    aggregationWindow?: number;
  }) {
    if (options?.aggregationWindow) {
      this.aggregationWindow = options.aggregationWindow;
    }
  }

  /**
   * 设置文件的基础版本
   */
  setBaseVersion(filePath: string, content: string): void {
    this.baseVersions.set(filePath, content);

    // 创建 EditorState
    const state = EditorState.create({
      doc: content,
    });
    this.editorStates.set(filePath, state);

    // 清空该文件的待处理变更
    this.pendingChanges.set(filePath, []);
  }

  /**
   * 记录变更（从 CodeMirror Transaction）
   */
  recordChangeFromTransaction(
    filePath: string,
    transaction: Transaction,
    source: 'panel' | 'editor' = 'editor'
  ): void {
    const state = this.editorStates.get(filePath);
    if (!state) {
      console.warn(`No editor state found for file: ${filePath}`);
      return;
    }

    // 更新 EditorState
    // 注意：transaction 已经是应用后的状态，我们需要从 transaction.changes 提取
    // 但这里我们直接使用 transaction 来更新状态
    try {
      const newState = transaction.state || state.update(transaction).state;
      this.editorStates.set(filePath, newState);
    } catch (error) {
      // 如果 transaction 已经应用，直接使用其 state
      if (transaction.state) {
        this.editorStates.set(filePath, transaction.state);
      } else {
        console.warn('Failed to update editor state:', error);
        return;
      }
    }

    // 提取变更
    const changes = this.extractChangesFromTransaction(
      transaction,
      state,
      source
    );

    // 添加到待处理变更列表
    if (!this.pendingChanges.has(filePath)) {
      this.pendingChanges.set(filePath, []);
    }
    this.pendingChanges.get(filePath)!.push(...changes);
  }

  /**
   * 记录变更（从文本内容）
   */
  recordChangeFromContent(
    filePath: string,
    oldContent: string,
    newContent: string,
    source: 'panel' | 'editor' = 'editor'
  ): void {
    // 更新 EditorState
    const state = this.editorStates.get(filePath);
    if (state) {
      // 计算差异并创建 Transaction
      const transaction = this.createTransactionFromDiff(
        state,
        oldContent,
        newContent
      );
      if (transaction) {
        this.recordChangeFromTransaction(filePath, transaction, source);
        return;
      }
    }

    // 如果无法创建 Transaction，直接使用文本差异
    const changes = this.extractChangesFromTextDiff(
      oldContent,
      newContent,
      source
    );

    if (!this.pendingChanges.has(filePath)) {
      this.pendingChanges.set(filePath, []);
    }
    this.pendingChanges.get(filePath)!.push(...changes);

    // 更新 EditorState
    const newState = EditorState.create({
      doc: newContent,
    });
    this.editorStates.set(filePath, newState);
  }

  /**
   * 从 Transaction 提取变更
   */
  private extractChangesFromTransaction(
    transaction: Transaction,
    state: EditorState,
    source: 'panel' | 'editor'
  ): CodeChange[] {
    const changes: CodeChange[] = [];
    const doc = state.doc;

    transaction.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      const insertedText = inserted.toString();
      const deletedText = doc.sliceString(fromA, toA);

      // 计算行号
      const lineFrom = doc.lineAt(fromA).number;
      const lineTo = doc.lineAt(toA).number;

      let type: ChangeType;
      if (fromA === toA) {
        type = 'insert';
      } else if (insertedText.length === 0) {
        type = 'delete';
      } else {
        type = 'replace';
      }

      changes.push({
        type,
        from: fromA,
        to: toA,
        insert: insertedText || undefined,
        delete: deletedText || undefined,
        lineFrom,
        lineTo,
        timestamp: Date.now(),
        source,
      });
    });

    return changes;
  }

  /**
   * 从文本差异提取变更（简化版，用于无法使用 Transaction 的情况）
   */
  private extractChangesFromTextDiff(
    oldContent: string,
    newContent: string,
    source: 'panel' | 'editor'
  ): CodeChange[] {
    // 这是一个简化实现，实际应该使用更精确的 diff 算法
    // 这里使用简单的逐行比较
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const changes: CodeChange[] = [];

    let oldPos = 0;
    let newPos = 0;
    let charOffset = 0;

    while (oldPos < oldLines.length || newPos < newLines.length) {
      if (oldPos >= oldLines.length) {
        // 新行插入
        const line = newLines[newPos];
        changes.push({
          type: 'insert',
          from: charOffset,
          to: charOffset,
          insert: `${line}\n`,
          lineFrom: newPos + 1,
          lineTo: newPos + 1,
          timestamp: Date.now(),
          source,
        });
        charOffset += line.length + 1;
        newPos++;
      } else if (newPos >= newLines.length) {
        // 旧行删除
        const line = oldLines[oldPos];
        changes.push({
          type: 'delete',
          from: charOffset,
          to: charOffset + line.length,
          delete: `${line}\n`,
          lineFrom: oldPos + 1,
          lineTo: oldPos + 1,
          timestamp: Date.now(),
          source,
        });
        oldPos++;
      } else if (oldLines[oldPos] === newLines[newPos]) {
        // 行相同，跳过
        charOffset += oldLines[oldPos].length + 1;
        oldPos++;
        newPos++;
      } else {
        // 行不同，视为替换
        const oldLine = oldLines[oldPos];
        const newLine = newLines[newPos];
        changes.push({
          type: 'replace',
          from: charOffset,
          to: charOffset + oldLine.length,
          insert: `${newLine}\n`,
          delete: `${oldLine}\n`,
          lineFrom: oldPos + 1,
          lineTo: oldPos + 1,
          timestamp: Date.now(),
          source,
        });
        charOffset += newLine.length + 1;
        oldPos++;
        newPos++;
      }
    }

    return changes;
  }

  /**
   * 创建 Transaction（从文本差异）
   */
  private createTransactionFromDiff(
    state: EditorState,
    oldContent: string,
    newContent: string
  ): Transaction | null {
    try {
      // 简单的实现：如果内容完全相同，使用 replace
      if (state.doc.toString() === oldContent) {
        // 计算需要替换的范围
        const changes = state.changes([
          {
            from: 0,
            to: state.doc.length,
            insert: newContent,
          },
        ]);
        // 创建新的 Transaction
        // 注意：这里简化处理，实际应该使用更精确的方法
        // 由于无法直接创建 Transaction，这里返回 null，让调用方使用文本差异方法
        return null;
      }
    } catch (error) {
      console.warn('Failed to create transaction from diff:', error);
    }
    return null;
  }

  /**
   * 聚合变更
   */
  aggregateChanges(): AggregatedChange[] {
    const aggregated: AggregatedChange[] = [];

    this.pendingChanges.forEach((changes, filePath) => {
      if (changes.length === 0) return;

      // 按时间窗口分组
      const grouped = this.groupByTimeWindow(changes);

      grouped.forEach((group) => {
        // 合并重叠的变更
        const merged = this.mergeChanges(group);

        // 生成摘要
        const summary = this.generateSummary(merged);

        // 生成描述
        const description = this.generateDescription(filePath, merged, summary);

        aggregated.push({
          filePath,
          changes: merged,
          summary,
          description,
        });
      });
    });

    return aggregated;
  }

  /**
   * 按时间窗口分组
   */
  private groupByTimeWindow(changes: CodeChange[]): CodeChange[][] {
    if (changes.length === 0) return [];

    const groups: CodeChange[][] = [];
    let currentGroup: CodeChange[] = [changes[0]];

    for (let i = 1; i < changes.length; i++) {
      const timeDiff = changes[i].timestamp - changes[i - 1].timestamp;

      if (timeDiff < this.aggregationWindow) {
        currentGroup.push(changes[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [changes[i]];
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  /**
   * 合并重叠的变更
   */
  private mergeChanges(changes: CodeChange[]): CodeChange[] {
    if (changes.length === 0) return [];

    // 按位置排序
    const sorted = [...changes].sort((a, b) => a.from - b.from);
    const merged: CodeChange[] = [];

    let current: CodeChange | null = null;

    for (const change of sorted) {
      if (!current) {
        current = { ...change };
      } else {
        // 检查是否重叠
        if (change.from <= current.to) {
          // 重叠，合并
          current.to = Math.max(current.to, change.to);
          if (change.insert) {
            current.insert = (current.insert || '') + change.insert;
          }
          if (change.delete) {
            current.delete = (current.delete || '') + change.delete;
          }
          current.lineTo = Math.max(current.lineTo, change.lineTo);

          // 更新类型
          if (current.insert && current.delete) {
            current.type = 'replace';
          } else if (current.insert) {
            current.type = 'insert';
          } else if (current.delete) {
            current.type = 'delete';
          }
        } else {
          // 不重叠，保存当前，开始新的
          merged.push(current);
          current = { ...change };
        }
      }
    }

    if (current) {
      merged.push(current);
    }

    return merged;
  }

  /**
   * 生成变更摘要
   */
  private generateSummary(changes: CodeChange[]): AggregatedChange['summary'] {
    let totalInsertions = 0;
    let totalDeletions = 0;
    let totalReplacements = 0;
    const affectedLines = new Set<number>();

    changes.forEach((change) => {
      if (change.type === 'insert') {
        totalInsertions++;
      } else if (change.type === 'delete') {
        totalDeletions++;
      } else if (change.type === 'replace') {
        totalReplacements++;
      }

      // 收集受影响的行号
      for (let line = change.lineFrom; line <= change.lineTo; line++) {
        affectedLines.add(line);
      }
    });

    return {
      totalInsertions,
      totalDeletions,
      totalReplacements,
      affectedLines: Array.from(affectedLines).sort((a, b) => a - b),
    };
  }

  /**
   * 生成变更描述（用于 AI 模型）
   */
  private generateDescription(
    filePath: string,
    changes: CodeChange[],
    summary: AggregatedChange['summary']
  ): string {
    const parts: string[] = [];

    parts.push(`文件 ${filePath} 的变更：`);
    parts.push(`- 添加了 ${summary.totalInsertions} 处`);
    parts.push(`- 删除了 ${summary.totalDeletions} 处`);
    parts.push(`- 替换了 ${summary.totalReplacements} 处`);
    parts.push(`- 受影响的行：${summary.affectedLines.join(', ')}`);
    parts.push('');

    // 详细变更
    changes.forEach((change, index) => {
      parts.push(
        `变更 ${index + 1} (第 ${change.lineFrom}-${change.lineTo} 行):`
      );

      if (change.type === 'insert') {
        parts.push(`  添加内容：\`\`\`\n${change.insert}\n\`\`\``);
      } else if (change.type === 'delete') {
        parts.push(`  删除内容：\`\`\`\n${change.delete}\n\`\`\``);
      } else if (change.type === 'replace') {
        parts.push(`  删除：\`\`\`\n${change.delete}\n\`\`\``);
        parts.push(`  添加：\`\`\`\n${change.insert}\n\`\`\``);
      }
      parts.push('');
    });

    return parts.join('\n');
  }

  /**
   * 清空待处理变更（提交后调用）
   */
  clearPendingChanges(): void {
    // 更新基础版本为当前版本
    this.editorStates.forEach((state, filePath) => {
      this.baseVersions.set(filePath, state.doc.toString());
    });

    this.pendingChanges.clear();
  }

  /**
   * 获取当前文件内容
   */
  getCurrentContent(filePath: string): string | undefined {
    const state = this.editorStates.get(filePath);
    return state?.doc.toString();
  }

  /**
   * 获取所有待处理变更
   */
  getPendingChanges(): Map<string, CodeChange[]> {
    return new Map(this.pendingChanges);
  }
}
