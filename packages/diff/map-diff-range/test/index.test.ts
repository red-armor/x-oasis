import { expect, test, describe } from 'vitest';
import {
  mapNewerRangeToOlder,
  mapOlderRangeToNewer,
  analyzeFragmentChange,
  resolveGroupChangeFragments,
} from '../src';

describe('mapNewerRangeToOlder', () => {
  test('should map range when content is unchanged', () => {
    const older = 'Hello World';
    const newer = 'Hello World';
    const result = mapNewerRangeToOlder(older, newer, 0, 5);
    expect(result).toEqual({ start: 0, end: 5 });
  });

  test('should map range when content has insertions', () => {
    const older = 'Hello World';
    const newer = 'Hello Beautiful World';
    // Map range in newer (6-16, "Beautiful ") to older
    const result = mapNewerRangeToOlder(older, newer, 6, 16);
    // Should map to position 6 in older (after "Hello ")
    expect(result.start).toBe(6);
    expect(result.end).toBe(6);
  });

  test('should map range when content has deletions', () => {
    const older = 'Hello Beautiful World';
    const newer = 'Hello World';
    // Map range in newer (6-6, at deletion point) to older
    const result = mapNewerRangeToOlder(older, newer, 6, 6);
    expect(result.start).toBe(6);
    expect(result.end).toBeGreaterThan(6);
  });

  test('should map range in equal section', () => {
    const older = 'The quick brown fox';
    const newer = 'The fast brown fox';
    // Map "brown fox" (10-19 in newer) to older
    const result = mapNewerRangeToOlder(older, newer, 10, 19);
    expect(result.start).toBeGreaterThan(0);
    expect(result.end).toBeGreaterThan(result.start);
  });

  test('should handle range at boundary', () => {
    const older = 'Hello';
    const newer = 'Hello World';
    const result = mapNewerRangeToOlder(older, newer, 5, 11);
    expect(result.start).toBe(5);
    expect(result.end).toBe(5);
  });
});

describe('mapOlderRangeToNewer', () => {
  test('should map range when content is unchanged', () => {
    const older = 'Hello World';
    const newer = 'Hello World';
    const result = mapOlderRangeToNewer(older, newer, 0, 5);
    expect(result).toEqual({ start: 0, end: 5 });
  });

  test('should map range when content has insertions', () => {
    const older = 'Hello World';
    const newer = 'Hello Beautiful World';
    // Map range in older (6-6) to newer
    const result = mapOlderRangeToNewer(older, newer, 6, 6);
    expect(result.start).toBe(6);
    expect(result.end).toBeGreaterThan(6);
  });

  test('should map range when content has deletions', () => {
    const older = 'Hello Beautiful World';
    const newer = 'Hello World';
    // Map range in older (6-16, "Beautiful ") to newer
    const result = mapOlderRangeToNewer(older, newer, 6, 16);
    expect(result.start).toBe(6);
    expect(result.end).toBe(6);
  });

  test('should map range in equal section', () => {
    const older = 'The quick brown fox';
    const newer = 'The fast brown fox';
    // Map "brown fox" in older to newer
    const result = mapOlderRangeToNewer(older, newer, 10, 19);
    expect(result.start).toBeGreaterThan(0);
    expect(result.end).toBeGreaterThan(result.start);
  });
});

describe('analyzeFragmentChange', () => {
  test('should detect equal fragments', () => {
    const original = 'Hello World';
    const final = 'Hello World';
    const result = analyzeFragmentChange(original, final);
    expect(result.equal).toBe(true);
    expect(result.onlyDeletion).toBe(false);
    expect(result.onlyInsertion).toBe(false);
    expect(result.replacement).toBe(false);
    expect(result.summary).toBe('无变更');
  });

  test('should detect only deletion', () => {
    const original = 'Hello Beautiful World';
    const final = 'Hello World';
    const result = analyzeFragmentChange(original, final);
    expect(result.equal).toBe(false);
    expect(result.onlyDeletion).toBe(true);
    expect(result.onlyInsertion).toBe(false);
    expect(result.replacement).toBe(false);
    expect(result.summary).toContain('删除:');
  });

  test('should detect only insertion', () => {
    const original = 'Hello World';
    const final = 'Hello Beautiful World';
    const result = analyzeFragmentChange(original, final);
    expect(result.equal).toBe(false);
    expect(result.onlyDeletion).toBe(false);
    expect(result.onlyInsertion).toBe(true);
    expect(result.replacement).toBe(false);
    expect(result.summary).toContain('新增:');
  });

  test('should detect replacement', () => {
    const original = 'The quick brown fox';
    const final = 'The fast brown fox';
    const result = analyzeFragmentChange(original, final);
    expect(result.equal).toBe(false);
    expect(result.onlyDeletion).toBe(false);
    expect(result.onlyInsertion).toBe(false);
    expect(result.replacement).toBe(true);
    expect(result.summary).toContain('替换:');
  });

  test('should include diffs array', () => {
    const original = 'Hello World';
    const final = 'Hello Beautiful World';
    const result = analyzeFragmentChange(original, final);
    expect(Array.isArray(result.diffs)).toBe(true);
    expect(result.diffs.length).toBeGreaterThan(0);
  });
});

describe('resolveGroupChangeFragments', () => {
  test('should resolve fragments for simple change', () => {
    const original = 'Hello World';
    const current = 'Hello Beautiful World';
    const final = 'Hello Amazing World';
    const result = resolveGroupChangeFragments({
      originalContent: original,
      currentContent: current,
      finalContent: final,
      currentTagOffset: { startOffset: 6, endOffset: 15 },
    });

    expect(result).toBeDefined();
    if (result) {
      expect(result.originalRange).toBeDefined();
      expect(result.finalRange).toBeDefined();
      expect(result.originalFragment).toBeDefined();
      expect(result.finalFragment).toBeDefined();
      expect(result.changeAnalysis).toBeDefined();
    }
  });

  test('should return undefined for invalid offset range', () => {
    const original = 'Hello World';
    const current = 'Hello World';
    const final = 'Hello World';
    const result = resolveGroupChangeFragments({
      originalContent: original,
      currentContent: current,
      finalContent: final,
      currentTagOffset: { startOffset: -1, endOffset: 5 },
    });

    expect(result).toBeUndefined();
  });

  test('should return undefined when endOffset exceeds content length', () => {
    const original = 'Hello World';
    const current = 'Hello World';
    const final = 'Hello World';
    const result = resolveGroupChangeFragments({
      originalContent: original,
      currentContent: current,
      finalContent: final,
      currentTagOffset: { startOffset: 0, endOffset: 1000 },
    });

    expect(result).toBeUndefined();
  });

  test('should return undefined when startOffset > endOffset', () => {
    const original = 'Hello World';
    const current = 'Hello World';
    const final = 'Hello World';
    const result = resolveGroupChangeFragments({
      originalContent: original,
      currentContent: current,
      finalContent: final,
      currentTagOffset: { startOffset: 10, endOffset: 5 },
    });

    expect(result).toBeUndefined();
  });

  test('should handle complex three-way change', () => {
    const original = '<h1 class="title">Name</h1>';
    const current = '<h1 class="title text-xl">Name</h1>';
    const final = '<h1 class="text-xl font-bold">Name</h1>';
    const result = resolveGroupChangeFragments({
      originalContent: original,
      currentContent: current,
      finalContent: final,
      currentTagOffset: { startOffset: 4, endOffset: 30 },
    });

    expect(result).toBeDefined();
    if (result) {
      expect(result.changeAnalysis.replacement).toBe(true);
      expect(result.originalFragment).toContain('title');
      expect(result.finalFragment).toContain('font-bold');
    }
  });

  test('should handle empty range', () => {
    const original = 'Hello World';
    const current = 'Hello World';
    const final = 'Hello World';
    const result = resolveGroupChangeFragments({
      originalContent: original,
      currentContent: current,
      finalContent: final,
      currentTagOffset: { startOffset: 5, endOffset: 5 },
    });

    expect(result).toBeDefined();
    if (result) {
      expect(result.originalFragment).toBe('');
      expect(result.finalFragment).toBe('');
    }
  });
});
