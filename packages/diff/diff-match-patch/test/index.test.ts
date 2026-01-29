import { expect, test, describe } from 'vitest';
import { FileRestoreManager, restoreRange } from '../src';

describe('FileRestoreManager', () => {
  test('should restore range when content is unchanged', () => {
    const original = 'Hello World';
    const current = 'Hello World';
    const manager = new FileRestoreManager(original);

    const result = manager.restoreRange(current, {
      startOffset: 0,
      endOffset: 5,
    });
    expect(result).toBe('Hello World');
  });

  test('should restore range when content has insertions', () => {
    const original = 'Hello World';
    const current = 'Hello Beautiful World';
    const manager = new FileRestoreManager(original);

    // 恢复插入的 "Beautiful " 部分（offset 6-16，含空格共 10 字符）
    const result = manager.restoreRange(current, {
      startOffset: 6,
      endOffset: 16,
    });
    expect(result).toBe('Hello World');
  });

  test('should restore range when content has deletions', () => {
    const original = 'Hello Beautiful World';
    const current = 'Hello World';
    const manager = new FileRestoreManager(original);

    // 在删除的位置恢复内容（在 "Hello " 和 "World" 之间）
    const result = manager.restoreRange(current, {
      startOffset: 6,
      endOffset: 6,
    });
    expect(result).toBe('Hello Beautiful World');
  });

  test('should restore range when content has modifications', () => {
    const original = 'Hello World';
    const current = 'Hello Beautiful World';
    const manager = new FileRestoreManager(original);

    // 恢复整个修改的部分
    const result = manager.restoreRange(current, {
      startOffset: 0,
      endOffset: current.length,
    });
    expect(result).toBe(original);
  });

  test('should restore partial range in modified content', () => {
    const original = 'The quick brown fox';
    const current = 'The fast brown fox';
    const manager = new FileRestoreManager(original);

    // 恢复 "fast" 为 "quick"（offset 4-8）
    const result = manager.restoreRange(current, {
      startOffset: 4,
      endOffset: 8,
    });
    expect(result).toBe('The quick brown fox');
  });

  test('should handle complex changes', () => {
    const original = 'function test() {\n  return true;\n}';
    const current =
      'function test() {\n  console.log("test");\n  return true;\n}';
    const manager = new FileRestoreManager(original);

    // 恢复插入的 console.log 行（range 20-40 完全在 INSERT 内时，替换为空）
    const result = manager.restoreRange(current, {
      startOffset: 20,
      endOffset: 40,
    });
    expect(result).toContain('return true');
    expect(result).not.toContain('console.log');
  });

  test('should throw error for invalid offset range', () => {
    const original = 'Hello World';
    const current = 'Hello World';
    const manager = new FileRestoreManager(original);

    expect(() => {
      manager.restoreRange(current, { startOffset: 10, endOffset: 5 });
    }).toThrow('Invalid offset range');

    expect(() => {
      manager.restoreRange(current, { startOffset: -1, endOffset: 5 });
    }).toThrow('Invalid offset range');

    expect(() => {
      manager.restoreRange(current, { startOffset: 0, endOffset: 100 });
    }).toThrow('Offset range exceeds current content length');
  });
});

describe('restoreRange function', () => {
  test('should restore range using convenience function', () => {
    const original = 'Hello World';
    const current = 'Hello Beautiful World';

    const result = restoreRange({
      originalContent: original,
      currentContent: current,
      startOffset: 6,
      endOffset: 16,
    });
    expect(result).toBe('Hello World');
  });
});
