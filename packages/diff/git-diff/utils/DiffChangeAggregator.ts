/**
 * Diff 变更聚合器
 *
 * 使用 diff 算法来计算和聚合源码变更
 *
 * 依赖：
 * - diff (npm install diff)
 *   或
 * - diff-match-patch (npm install diff-match-patch)
 *
 * 推荐使用 diff 库，因为它提供了更友好的 API
 */

// 注意：这里使用类型定义，实际使用时需要安装对应的包
// import { diffLines, diffWords, createPatch } from 'diff';

/**
 * 变更类型
 */
export type DiffChangeType = 'add' | 'remove' | 'modify';

/**
 * 行级别的变更
 */
export interface LineChange {
  /** 变更类型 */
  type: DiffChangeType;
  /** 行号（原始文件中的行号，如果是新增则为 null） */
  oldLine: number | null;
  /** 行号（新文件中的行号，如果是删除则为 null） */
  newLine: number | null;
  /** 原始内容 */
  oldContent?: string;
  /** 新内容 */
  newContent?: string;
  /** 时间戳 */
  timestamp: number;
  /** 变更来源 */
  source: 'panel' | 'editor';
}

/**
 * 聚合后的变更
 */
export interface DiffAggregatedChange {
  /** 文件路径 */
  filePath: string;
  /** 变更列表 */
  changes: LineChange[];
  /** 变更摘要 */
  summary: {
    totalAdditions: number;
    totalDeletions: number;
    totalModifications: number;
    affectedOldLines: number[];
    affectedNewLines: number[];
  };
  /** Unified Diff 格式的变更描述 */
  unifiedDiff: string;
  /** 语义化描述（用于 AI 模型） */
  description: string;
}

/**
 * Diff 变更聚合器
 */
export class DiffChangeAggregator {
  /** 文件路径 -> 基础版本（初始状态） */
  private baseVersions: Map<string, string> = new Map();

  /** 文件路径 -> 当前版本 */
  private currentVersions: Map<string, string> = new Map();

  /** 文件路径 -> 变更历史 */
  private changeHistory: Map<
    string,
    Array<{ content: string; timestamp: number }>
  > = new Map();

  /** 聚合时间窗口（毫秒） */
  private aggregationWindow = 1000;

  /**
   * 设置文件的基础版本
   */
  setBaseVersion(filePath: string, content: string): void {
    this.baseVersions.set(filePath, content);
    this.currentVersions.set(filePath, content);
    this.changeHistory.set(filePath, [
      {
        content,
        timestamp: Date.now(),
      },
    ]);
  }

  /**
   * 记录变更
   */
  recordChange(
    filePath: string,
    newContent: string,
    source: 'panel' | 'editor' = 'editor'
  ): void {
    const currentContent = this.currentVersions.get(filePath);

    if (currentContent === undefined) {
      // 新文件
      this.setBaseVersion(filePath, '');
      this.currentVersions.set(filePath, newContent);
    } else if (currentContent !== newContent) {
      // 内容有变化
      this.currentVersions.set(filePath, newContent);

      // 记录到历史
      const history = this.changeHistory.get(filePath) || [];
      history.push({
        content: newContent,
        timestamp: Date.now(),
      });
      this.changeHistory.set(filePath, history);
    }
  }

  /**
   * 聚合变更（使用 diff 库）
   */
  aggregateChanges(): DiffAggregatedChange[] {
    const aggregated: DiffAggregatedChange[] = [];

    this.currentVersions.forEach((currentContent, filePath) => {
      const baseContent = this.baseVersions.get(filePath);

      if (!baseContent) {
        // 新文件
        const changes = this.computeChangesForNewFile(currentContent, filePath);
        if (changes.length > 0) {
          aggregated.push({
            filePath,
            changes,
            summary: this.generateSummary(changes),
            unifiedDiff: this.generateUnifiedDiff(filePath, '', currentContent),
            description: this.generateDescription(filePath, changes, 'new'),
          });
        }
      } else if (currentContent !== baseContent) {
        // 计算差异
        const changes = this.computeDiff(baseContent, currentContent, filePath);

        if (changes.length > 0) {
          const summary = this.generateSummary(changes);
          aggregated.push({
            filePath,
            changes,
            summary,
            unifiedDiff: this.generateUnifiedDiff(
              filePath,
              baseContent,
              currentContent
            ),
            description: this.generateDescription(
              filePath,
              changes,
              'modified'
            ),
          });
        }
      }
    });

    return aggregated;
  }

  /**
   * 计算差异（使用 diff 库的行级别比较）
   */
  private computeDiff(
    oldContent: string,
    newContent: string,
    filePath: string
  ): LineChange[] {
    // 注意：这里需要实际安装 diff 库
    // import { diffLines } from 'diff';
    // const diff = diffLines(oldContent, newContent);

    // 由于没有实际安装库，这里提供一个简化实现
    // 实际使用时应该使用 diff 库
    return this.computeDiffSimple(oldContent, newContent);
  }

  /**
   * 简化的 diff 实现（实际应该使用 diff 库）
   */
  private computeDiffSimple(
    oldContent: string,
    newContent: string
  ): LineChange[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const changes: LineChange[] = [];

    // 使用最长公共子序列算法（简化版）
    let oldIndex = 0;
    let newIndex = 0;
    const timestamp = Date.now();

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // 新行
        changes.push({
          type: 'add',
          oldLine: null,
          newLine: newIndex + 1,
          newContent: newLines[newIndex],
          timestamp,
          source: 'editor',
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // 删除行
        changes.push({
          type: 'remove',
          oldLine: oldIndex + 1,
          newLine: null,
          oldContent: oldLines[oldIndex],
          timestamp,
          source: 'editor',
        });
        oldIndex++;
      } else if (oldLines[oldIndex] === newLines[newIndex]) {
        // 行相同，跳过
        oldIndex++;
        newIndex++;
      } else {
        // 行不同，检查是否是修改还是新增/删除
        // 简化处理：视为修改
        changes.push({
          type: 'modify',
          oldLine: oldIndex + 1,
          newLine: newIndex + 1,
          oldContent: oldLines[oldIndex],
          newContent: newLines[newIndex],
          timestamp,
          source: 'editor',
        });
        oldIndex++;
        newIndex++;
      }
    }

    return changes;
  }

  /**
   * 计算新文件的变更
   */
  private computeChangesForNewFile(
    content: string,
    filePath: string
  ): LineChange[] {
    const lines = content.split('\n');
    const timestamp = Date.now();

    return lines.map((line, index) => ({
      type: 'add' as DiffChangeType,
      oldLine: null,
      newLine: index + 1,
      newContent: line,
      timestamp,
      source: 'editor' as const,
    }));
  }

  /**
   * 生成变更摘要
   */
  private generateSummary(
    changes: LineChange[]
  ): DiffAggregatedChange['summary'] {
    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalModifications = 0;
    const affectedOldLines = new Set<number>();
    const affectedNewLines = new Set<number>();

    changes.forEach((change) => {
      if (change.type === 'add') {
        totalAdditions++;
        if (change.newLine !== null) {
          affectedNewLines.add(change.newLine);
        }
      } else if (change.type === 'remove') {
        totalDeletions++;
        if (change.oldLine !== null) {
          affectedOldLines.add(change.oldLine);
        }
      } else if (change.type === 'modify') {
        totalModifications++;
        if (change.oldLine !== null) {
          affectedOldLines.add(change.oldLine);
        }
        if (change.newLine !== null) {
          affectedNewLines.add(change.newLine);
        }
      }
    });

    return {
      totalAdditions,
      totalDeletions,
      totalModifications,
      affectedOldLines: Array.from(affectedOldLines).sort((a, b) => a - b),
      affectedNewLines: Array.from(affectedNewLines).sort((a, b) => a - b),
    };
  }

  /**
   * 生成 Unified Diff 格式
   */
  private generateUnifiedDiff(
    filePath: string,
    oldContent: string,
    newContent: string
  ): string {
    // 注意：实际应该使用 diff 库的 createPatch 方法
    // import { createPatch } from 'diff';
    // return createPatch(filePath, oldContent, newContent);

    // 简化实现（改进版，避免无限循环）
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff: string[] = [];

    diff.push(`--- a/${filePath}`);
    diff.push(`+++ b/${filePath}`);

    // 如果内容完全相同，返回空 diff
    if (oldContent === newContent) {
      return diff.join('\n');
    }

    // 计算差异块（简化版：逐行比较）
    let oldIndex = 0;
    let newIndex = 0;
    const maxIterations = Math.max(oldLines.length, newLines.length) * 2; // 防止无限循环
    let iterations = 0;

    while (
      (oldIndex < oldLines.length || newIndex < newLines.length) &&
      iterations < maxIterations
    ) {
      iterations++;

      // 如果都到达末尾，退出
      if (oldIndex >= oldLines.length && newIndex >= newLines.length) {
        break;
      }

      // 如果旧文件已到末尾，剩余都是新增
      if (oldIndex >= oldLines.length) {
        diff.push(
          `@@ -${oldLines.length},0 +${newIndex + 1},${
            newLines.length - newIndex
          } @@`
        );
        for (let i = newIndex; i < newLines.length; i++) {
          diff.push(`+${newLines[i]}`);
        }
        break;
      }

      // 如果新文件已到末尾，剩余都是删除
      if (newIndex >= newLines.length) {
        diff.push(
          `@@ -${oldIndex + 1},${oldLines.length - oldIndex} +${
            newLines.length
          },0 @@`
        );
        for (let i = oldIndex; i < oldLines.length; i++) {
          diff.push(`-${oldLines[i]}`);
        }
        break;
      }

      // 如果行相同，跳过
      if (oldLines[oldIndex] === newLines[newIndex]) {
        oldIndex++;
        newIndex++;
        continue;
      }

      // 找到差异块的结束（简化：找到下一个匹配的行或到文件末尾）
      let blockEndOld = oldIndex;
      let blockEndNew = newIndex;
      let foundMatch = false;

      // 尝试找到匹配的行（限制搜索范围，避免性能问题）
      const searchRange = Math.min(
        10,
        Math.max(oldLines.length - oldIndex, newLines.length - newIndex)
      );

      for (let searchOffset = 1; searchOffset <= searchRange; searchOffset++) {
        if (
          oldIndex + searchOffset < oldLines.length &&
          newIndex + searchOffset < newLines.length &&
          oldLines[oldIndex + searchOffset] ===
            newLines[newIndex + searchOffset]
        ) {
          blockEndOld = oldIndex + searchOffset;
          blockEndNew = newIndex + searchOffset;
          foundMatch = true;
          break;
        }
      }

      // 如果没有找到匹配，差异块到文件末尾
      if (!foundMatch) {
        blockEndOld = oldLines.length;
        blockEndNew = newLines.length;
      }

      // 生成 hunk
      const oldCount = blockEndOld - oldIndex;
      const newCount = blockEndNew - newIndex;

      if (oldCount > 0 || newCount > 0) {
        diff.push(
          `@@ -${oldIndex + 1},${oldCount} +${newIndex + 1},${newCount} @@`
        );

        // 添加变更行（先删除，后添加）
        for (let i = oldIndex; i < blockEndOld; i++) {
          diff.push(`-${oldLines[i]}`);
        }
        for (let i = newIndex; i < blockEndNew; i++) {
          diff.push(`+${newLines[i]}`);
        }
      }

      oldIndex = blockEndOld;
      newIndex = blockEndNew;
    }

    // 如果达到最大迭代次数，添加警告
    if (iterations >= maxIterations) {
      diff.push('@@ WARNING: Diff computation may be incomplete @@');
    }

    return diff.join('\n');
  }

  /**
   * 生成语义化描述
   */
  private generateDescription(
    filePath: string,
    changes: LineChange[],
    fileStatus: 'new' | 'modified'
  ): string {
    const summary = this.generateSummary(changes);
    const parts: string[] = [];

    if (fileStatus === 'new') {
      parts.push(`新文件 ${filePath}：`);
      parts.push(`- 共 ${summary.totalAdditions} 行`);
    } else {
      parts.push(`文件 ${filePath} 的变更：`);
      parts.push(`- 添加了 ${summary.totalAdditions} 行`);
      parts.push(`- 删除了 ${summary.totalDeletions} 行`);
      parts.push(`- 修改了 ${summary.totalModifications} 行`);

      if (summary.affectedOldLines.length > 0) {
        parts.push(
          `- 受影响的行（原始）：${summary.affectedOldLines
            .slice(0, 10)
            .join(', ')}${summary.affectedOldLines.length > 10 ? '...' : ''}`
        );
      }
      if (summary.affectedNewLines.length > 0) {
        parts.push(
          `- 受影响的行（新文件）：${summary.affectedNewLines
            .slice(0, 10)
            .join(', ')}${summary.affectedNewLines.length > 10 ? '...' : ''}`
        );
      }
    }

    parts.push('');

    // 详细变更（限制数量，避免过长）
    const displayChanges = changes.slice(0, 20);
    displayChanges.forEach((change, index) => {
      if (change.type === 'add') {
        parts.push(`变更 ${index + 1}: 在第 ${change.newLine} 行添加`);
        parts.push(`\`\`\`\n${change.newContent}\n\`\`\``);
      } else if (change.type === 'remove') {
        parts.push(`变更 ${index + 1}: 删除第 ${change.oldLine} 行`);
        parts.push(`\`\`\`\n${change.oldContent}\n\`\`\``);
      } else if (change.type === 'modify') {
        parts.push(`变更 ${index + 1}: 修改第 ${change.oldLine} 行`);
        parts.push(`删除：\`\`\`\n${change.oldContent}\n\`\`\``);
        parts.push(`添加：\`\`\`\n${change.newContent}\n\`\`\``);
      }
      parts.push('');
    });

    if (changes.length > 20) {
      parts.push(`... 还有 ${changes.length - 20} 处变更未显示`);
    }

    return parts.join('\n');
  }

  /**
   * 清空待处理变更（提交后调用）
   */
  clearPendingChanges(): void {
    // 更新基础版本为当前版本
    this.currentVersions.forEach((content, filePath) => {
      this.baseVersions.set(filePath, content);
    });

    // 清空历史（可选：保留最近 N 条）
    this.changeHistory.clear();
  }

  /**
   * 获取当前文件内容
   */
  getCurrentContent(filePath: string): string | undefined {
    return this.currentVersions.get(filePath);
  }

  /**
   * 获取基础版本
   */
  getBaseVersion(filePath: string): string | undefined {
    return this.baseVersions.get(filePath);
  }
}
