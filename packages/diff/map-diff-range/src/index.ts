/**
 * 基于 diff-match-patch 的 range 映射与变更分析工具
 * 用于在 originalContent / currentContent / finalContent 之间映射 range，并分析片段级变更
 *
 * 参考: https://github.com/red-armor/x-oasis/blob/main/packages/diff/diff-match-patch/src/index.ts#L123
 */

import { diff_match_patch } from 'diff-match-patch';

/** diff 操作常量，与 diff-match-patch 一致 */
const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

/** 单端 range，start 含头，end 含尾（substring 语义） */
export interface Range {
  start: number;
  end: number;
}

/** 片段级变更分析结果 */
export interface FragmentChangeAnalysis {
  /** 原始片段内容 */
  originalFragment: string;
  /** 最终片段内容 */
  finalFragment: string;
  /** 是否完全相同 */
  equal: boolean;
  /** 仅删除（无新增） */
  onlyDeletion: boolean;
  /** 仅新增（无删除） */
  onlyInsertion: boolean;
  /** 既有删除又有新增（替换） */
  replacement: boolean;
  /** 语义化描述（简短） */
  summary: string;
  /** 详细 diff 条目，便于上层做展示或进一步处理 */
  diffs: Array<[number, string]>;
}

/**
 * 将「新内容」中的 offset range 映射到「旧内容」中的 offset range
 * 等价于 x-oasis 的 mapCurrentRangeToOriginal：diffs = diff_main(older, newer)，给定 newer 上的 [start,end]，返回 older 上的 [start,end]
 *
 * @param olderContent 旧内容（diff 的 text1）
 * @param newerContent 新内容（diff 的 text2）
 * @param startOffset 新内容中的 range 起始 offset
 * @param endOffset 新内容中的 range 结束 offset（不含尾，即 [startOffset, endOffset) 或含尾由调用方约定，此处按 substring 含头含尾）
 * @returns 旧内容中对应的 range；若越界或无效则返回 { start: 0, end: 0 }
 */
export function mapNewerRangeToOlder(
  olderContent: string,
  newerContent: string,
  startOffset: number,
  endOffset: number
): Range {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(olderContent, newerContent);
  dmp.diff_cleanupSemantic(diffs);

  let newerOffset = 0;
  let olderOffset = 0;
  let olderStart: number | null = null;
  let olderEnd: number | null = null;

  for (let i = 0; i < diffs.length; i++) {
    const [op, text] = diffs[i];
    const len = text.length;
    const nextDiff = i < diffs.length - 1 ? diffs[i + 1] : null;

    if (op === DIFF_EQUAL) {
      const rangeStart = newerOffset;
      const rangeEnd = newerOffset + len;

      if (
        olderStart === null &&
        startOffset >= rangeStart &&
        startOffset < rangeEnd
      ) {
        olderStart = olderOffset + (startOffset - rangeStart);
      }
      if (
        olderEnd === null &&
        endOffset > rangeStart &&
        endOffset <= rangeEnd
      ) {
        const offsetInRange = endOffset - rangeStart;
        olderEnd = olderOffset + offsetInRange;
        if (endOffset === rangeEnd && nextDiff && nextDiff[0] === DIFF_DELETE) {
          olderEnd = olderOffset + len + nextDiff[1].length;
        }
      }

      newerOffset += len;
      olderOffset += len;
    } else if (op === DIFF_INSERT) {
      const rangeStart = newerOffset;
      const rangeEnd = newerOffset + len;

      if (
        olderStart === null &&
        startOffset >= rangeStart &&
        startOffset < rangeEnd
      ) {
        olderStart = olderOffset;
      }
      if (
        olderEnd === null &&
        endOffset > rangeStart &&
        endOffset <= rangeEnd
      ) {
        olderEnd = olderOffset;
      }

      newerOffset += len;
    } else if (op === DIFF_DELETE) {
      if (olderStart === null && startOffset <= newerOffset) {
        olderStart = olderOffset;
      }
      if (olderEnd === null && endOffset <= newerOffset) {
        olderEnd = endOffset === newerOffset ? olderOffset + len : olderOffset;
      } else if (olderEnd === null && endOffset === newerOffset) {
        olderEnd = olderOffset + len;
      }

      olderOffset += len;
    }

    if (olderStart !== null && olderEnd !== null) break;
  }

  if (olderStart === null) olderStart = olderOffset;
  if (olderEnd === null) olderEnd = olderOffset;

  return { start: olderStart, end: olderEnd };
}

/**
 * 将「旧内容」中的 offset range 映射到「新内容」中的 offset range
 * 与 mapNewerRangeToOlder 对称：diffs = diff_main(older, newer)，给定 older 上的 [start,end]，返回 newer 上的 [start,end]
 *
 * @param olderContent 旧内容（diff 的 text1）
 * @param newerContent 新内容（diff 的 text2）
 * @param startOffset 旧内容中的 range 起始 offset
 * @param endOffset 旧内容中的 range 结束 offset
 * @returns 新内容中对应的 range
 */
export function mapOlderRangeToNewer(
  olderContent: string,
  newerContent: string,
  startOffset: number,
  endOffset: number
): Range {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(olderContent, newerContent);
  dmp.diff_cleanupSemantic(diffs);

  let olderOffset = 0;
  let newerOffset = 0;
  let newerStart: number | null = null;
  let newerEnd: number | null = null;

  for (let i = 0; i < diffs.length; i++) {
    const [op, text] = diffs[i];
    const len = text.length;
    const nextDiff = i < diffs.length - 1 ? diffs[i + 1] : null;

    if (op === DIFF_EQUAL) {
      const oldRangeStart = olderOffset;
      const oldRangeEnd = olderOffset + len;

      if (
        newerStart === null &&
        startOffset >= oldRangeStart &&
        startOffset < oldRangeEnd
      ) {
        newerStart = newerOffset + (startOffset - oldRangeStart);
      }
      if (
        newerEnd === null &&
        endOffset > oldRangeStart &&
        endOffset <= oldRangeEnd
      ) {
        const offsetInRange = endOffset - oldRangeStart;
        newerEnd = newerOffset + offsetInRange;
        if (
          endOffset === oldRangeEnd &&
          nextDiff &&
          nextDiff[0] === DIFF_INSERT
        ) {
          newerEnd = newerOffset + len + nextDiff[1].length;
        }
      }

      olderOffset += len;
      newerOffset += len;
    } else if (op === DIFF_INSERT) {
      newerOffset += len;
    } else if (op === DIFF_DELETE) {
      const oldRangeStart = olderOffset;
      const oldRangeEnd = olderOffset + len;

      if (
        newerStart === null &&
        startOffset >= oldRangeStart &&
        startOffset < oldRangeEnd
      ) {
        newerStart = newerOffset;
      }
      if (
        newerEnd === null &&
        endOffset > oldRangeStart &&
        endOffset <= oldRangeEnd
      ) {
        newerEnd = newerOffset;
      } else if (newerEnd === null && endOffset <= olderOffset) {
        newerEnd = newerOffset;
      }

      olderOffset += len;
    }

    if (newerStart !== null && newerEnd !== null) break;
  }

  if (newerStart === null) newerStart = newerOffset;
  if (newerEnd === null) newerEnd = newerOffset;

  return { start: newerStart, end: newerEnd };
}

/**
 * 对比两段片段内容，分析发生的变更类型并生成简短描述
 *
 * @param originalFragment 原始片段
 * @param finalFragment 变更后片段
 * @returns 变更分析结果
 */
export function analyzeFragmentChange(
  originalFragment: string,
  finalFragment: string
): FragmentChangeAnalysis {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(originalFragment, finalFragment);
  dmp.diff_cleanupSemantic(diffs);

  const hasDelete = diffs.some(([op]) => op === DIFF_DELETE);
  const hasInsert = diffs.some(([op]) => op === DIFF_INSERT);
  const equal = !hasDelete && !hasInsert;
  const onlyDeletion = hasDelete && !hasInsert;
  const onlyInsertion = !hasDelete && hasInsert;
  const replacement = hasDelete && hasInsert;

  let summary: string;
  if (equal) {
    summary = '无变更';
  } else if (onlyDeletion) {
    const deleted = diffs
      .filter(([op]) => op === DIFF_DELETE)
      .map(([, text]) => text)
      .join('');
    summary = `删除: ${formatSnippet(deleted)}`;
  } else if (onlyInsertion) {
    const inserted = diffs
      .filter(([op]) => op === DIFF_INSERT)
      .map(([, text]) => text)
      .join('');
    summary = `新增: ${formatSnippet(inserted)}`;
  } else {
    const deleted = diffs
      .filter(([op]) => op === DIFF_DELETE)
      .map(([, text]) => text)
      .join('');
    const inserted = diffs
      .filter(([op]) => op === DIFF_INSERT)
      .map(([, text]) => text)
      .join('');
    summary = `替换: ${formatSnippet(deleted)} → ${formatSnippet(inserted)}`;
  }

  return {
    originalFragment,
    finalFragment,
    equal,
    onlyDeletion,
    onlyInsertion,
    replacement,
    summary,
    diffs,
  };
}

/** 片段截断展示，避免过长 */
function formatSnippet(s: string, maxLen = 40): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/**
 * 解析「当前文件中变更 range」对应的原始片段与最终片段，并分析二者之间的变更
 * 用于 sketch 等场景：originalContent → currentContent → finalContent，currentTagOffset 为 currentContent 上发生变更的 range
 *
 * @param options.originalContent 最初文件内容
 * @param options.currentContent 当前文件内容
 * @param options.finalContent 变更后的文件内容
 * @param options.currentTagOffset 当前文件中变更发生的 range（startOffset/endOffset）
 * @returns 映射得到的 original/final range、对应片段、以及片段级变更分析；若无法解析则返回 undefined
 */
export function resolveGroupChangeFragments(options: {
  originalContent: string;
  currentContent: string;
  finalContent: string;
  currentTagOffset: { startOffset: number; endOffset: number };
}):
  | {
      originalRange: Range;
      finalRange: Range;
      originalFragment: string;
      finalFragment: string;
      changeAnalysis: FragmentChangeAnalysis;
    }
  | undefined {
  const { originalContent, currentContent, finalContent, currentTagOffset } =
    options;

  const { startOffset, endOffset } = currentTagOffset;

  if (
    startOffset < 0 ||
    endOffset < 0 ||
    startOffset > endOffset ||
    endOffset > currentContent.length
  ) {
    return undefined;
  }

  const originalRange = mapNewerRangeToOlder(
    originalContent,
    currentContent,
    startOffset,
    endOffset
  );
  const finalRange = mapOlderRangeToNewer(
    currentContent,
    finalContent,
    startOffset,
    endOffset
  );

  const originalFragment = originalContent.substring(
    originalRange.start,
    originalRange.end
  );
  const finalFragment = finalContent.substring(
    finalRange.start,
    finalRange.end
  );

  const changeAnalysis = analyzeFragmentChange(originalFragment, finalFragment);

  return {
    originalRange,
    finalRange,
    originalFragment,
    finalFragment,
    changeAnalysis,
  };
}
