import { diff_match_patch } from 'diff-match-patch';

const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

export interface RestoreRangeOptions {
  startOffset: number;
  endOffset: number;
}

/**
 * 文件恢复管理器
 * 用于将最新文件中的指定 range 恢复到原始版本
 */
export class FileRestoreManager {
  private originalContent: string;
  private dmp: diff_match_patch;

  constructor(originalContent: string) {
    this.originalContent = originalContent;
    this.dmp = new diff_match_patch();
  }

  /**
   * 将最新文件中指定 offset range 的内容恢复到原始版本
   * @param currentContent 最新文件内容
   * @param options 包含 startOffset 和 endOffset 的选项
   * @returns 恢复后的文件内容
   */
  restoreRange(currentContent: string, options: RestoreRangeOptions): string {
    const { startOffset, endOffset } = options;

    if (startOffset < 0 || endOffset < 0 || startOffset > endOffset) {
      throw new Error('Invalid offset range');
    }

    if (
      startOffset > currentContent.length ||
      endOffset > currentContent.length
    ) {
      throw new Error('Offset range exceeds current content length');
    }

    // 计算差异
    const diffs = this.dmp.diff_main(this.originalContent, currentContent);
    this.dmp.diff_cleanupSemantic(diffs);

    // 找到最新文件中 startOffset 和 endOffset 对应的原始文件中的位置
    const originalRange = this.mapCurrentRangeToOriginal(
      diffs,
      startOffset,
      endOffset
    );

    // 从原始文件中提取对应范围的内容
    const originalRangeContent = this.originalContent.substring(
      originalRange.start,
      originalRange.end
    );

    // 替换最新文件中指定 range 的内容
    const restoredContent =
      currentContent.substring(0, startOffset) +
      originalRangeContent +
      currentContent.substring(endOffset);

    return restoredContent;
  }

  /**
   * 将最新文件中的 offset range 映射到原始文件中的 offset range
   */
  private mapCurrentRangeToOriginal(
    diffs: Array<[number, string]>,
    currentStart: number,
    currentEnd: number
  ): { start: number; end: number } {
    let currentOffset = 0; // 当前在最新文件中的 offset
    let originalOffset = 0; // 当前在原始文件中的 offset
    let originalStart: number | null = null;
    let originalEnd: number | null = null;

    for (const [operation, text] of diffs) {
      const textLength = text.length;

      if (operation === DIFF_EQUAL) {
        // 相等部分：两个文件的 offset 同步增加
        const rangeStart = currentOffset;
        const rangeEnd = currentOffset + textLength;

        // 检查 currentStart 是否在这个 EQUAL 区间内
        if (
          originalStart === null &&
          currentStart >= rangeStart &&
          currentStart < rangeEnd
        ) {
          const offsetInRange = currentStart - rangeStart;
          originalStart = originalOffset + offsetInRange;
        }
        // 检查 currentEnd 是否在这个 EQUAL 区间内
        if (
          originalEnd === null &&
          currentEnd > rangeStart &&
          currentEnd <= rangeEnd
        ) {
          const offsetInRange = currentEnd - rangeStart;
          originalEnd = originalOffset + offsetInRange;
        }

        currentOffset += textLength;
        originalOffset += textLength;
      } else if (operation === DIFF_INSERT) {
        // 插入部分：只在新文件中存在
        const rangeStart = currentOffset;
        const rangeEnd = currentOffset + textLength;

        // 如果 currentStart 在插入内容中，映射到插入前的原始位置
        if (
          originalStart === null &&
          currentStart >= rangeStart &&
          currentStart < rangeEnd
        ) {
          originalStart = originalOffset;
        }
        // 如果 currentEnd 在插入内容中，映射到插入前的原始位置
        if (
          originalEnd === null &&
          currentEnd > rangeStart &&
          currentEnd <= rangeEnd
        ) {
          originalEnd = originalOffset;
        }

        currentOffset += textLength;
        // INSERT 不增加 originalOffset
      } else if (operation === DIFF_DELETE) {
        // 删除部分：只在原始文件中存在
        // 如果 currentStart 或 currentEnd 在删除位置之前，需要调整
        if (originalStart === null && currentStart <= currentOffset) {
          // 如果 currentStart 在删除位置之前，映射到删除开始的位置
          originalStart = originalOffset;
        }
        if (originalEnd === null && currentEnd <= currentOffset) {
          // 如果 currentEnd 在删除位置之前，映射到删除开始的位置
          originalEnd = originalOffset;
        }

        originalOffset += textLength;
        // DELETE 不增加 currentOffset
      }

      // 如果两个位置都找到了，可以提前退出
      if (originalStart !== null && originalEnd !== null) {
        break;
      }
    }

    // 处理边界情况：如果 range 在所有 diff 之后
    if (originalStart === null) {
      originalStart = originalOffset;
    }
    if (originalEnd === null) {
      originalEnd = originalOffset;
    }

    return { start: originalStart, end: originalEnd };
  }

  /**
   * 获取原始文件内容
   */
  getOriginalContent(): string {
    return this.originalContent;
  }

  /**
   * 更新原始文件内容
   */
  updateOriginalContent(newOriginalContent: string): void {
    this.originalContent = newOriginalContent;
  }
}

/**
 * 便捷函数：直接恢复指定 range 的内容
 */
export function restoreRange(
  originalContent: string,
  currentContent: string,
  startOffset: number,
  endOffset: number
): string {
  const manager = new FileRestoreManager(originalContent);
  return manager.restoreRange(currentContent, { startOffset, endOffset });
}

export default FileRestoreManager;
