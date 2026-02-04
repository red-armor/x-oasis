import { expect, test, describe } from 'vitest';
import {
  parseFragmentToElement,
  compareHtmlFragments,
  consumeGroupChangeResult,
} from '../src';

describe('parseFragmentToElement', () => {
  test('should parse simple HTML fragment', () => {
    const fragment = '<h1 class="title primary">Hello World</h1>';
    const result = parseFragmentToElement(fragment);

    expect(result).not.toBeNull();
    expect(result?.tagName).toBe('h1');
    expect(result?.classList).toEqual(['title', 'primary']);
    expect(result?.textContent).toBe('Hello World');
  });

  test('should handle fragment without class', () => {
    const fragment = '<div>Text content</div>';
    const result = parseFragmentToElement(fragment);

    expect(result).not.toBeNull();
    expect(result?.tagName).toBe('div');
    expect(result?.classList).toEqual([]);
    expect(result?.textContent).toBe('Text content');
  });

  test('should handle empty fragment', () => {
    const result = parseFragmentToElement('');
    expect(result).toBeNull();
  });

  test('should handle invalid HTML', () => {
    const result = parseFragmentToElement('<invalid>');
    // parse5 might still parse it, but we should handle gracefully
    expect(result).not.toBeUndefined();
  });

  test('should extract other attributes', () => {
    const fragment = '<input type="text" id="test" value="hello" />';
    const result = parseFragmentToElement(fragment);

    expect(result).not.toBeNull();
    expect(result?.otherAttrs).toHaveProperty('type', 'text');
    expect(result?.otherAttrs).toHaveProperty('id', 'test');
    expect(result?.otherAttrs).toHaveProperty('value', 'hello');
    expect(result?.otherAttrs).not.toHaveProperty('class');
  });

  test('should handle nested elements and extract text', () => {
    const fragment = '<div><span>Hello</span> <strong>World</strong></div>';
    const result = parseFragmentToElement(fragment);

    expect(result).not.toBeNull();
    expect(result?.tagName).toBe('div');
    expect(result?.textContent).toContain('Hello');
    expect(result?.textContent).toContain('World');
  });
});

describe('compareHtmlFragments', () => {
  test('should detect class additions', () => {
    const original = '<h1 class="title">Hello</h1>';
    const final = '<h1 class="title active">Hello</h1>';
    const result = compareHtmlFragments(original, final);

    expect(Array.isArray(result.classAdded)).toBe(true);
    expect(result.classAdded).toContain('active');
    expect(new Set(result.classAdded).size).toBe(result.classAdded.length);
    expect(result.classRemoved).toEqual([]);
  });

  test('should detect class removals', () => {
    const original = '<h1 class="title primary">Hello</h1>';
    const final = '<h1 class="title">Hello</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.classRemoved).toContain('primary');
    expect(result.classAdded).toEqual([]);
  });

  test('should detect both additions and removals', () => {
    const original = '<h1 class="title primary">Hello</h1>';
    const final = '<h1 class="title secondary">Hello</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.classRemoved).toContain('primary');
    expect(Array.isArray(result.classAdded)).toBe(true);
    expect(result.classAdded).toContain('secondary');
    expect(new Set(result.classAdded).size).toBe(result.classAdded.length);
  });

  test('classAdded should be array with no duplicates', () => {
    // final 中 class 重复时，classAdded 仍应去重
    const original = '<h1 class="a">x</h1>';
    const final = '<h1 class="a b b c c c">x</h1>';
    const result = compareHtmlFragments(original, final);

    expect(Array.isArray(result.classAdded)).toBe(true);
    expect(result.classAdded).toEqual(['b', 'c']);
    expect(new Set(result.classAdded).size).toBe(result.classAdded.length);
  });

  test('should detect text changes', () => {
    const original = '<h1>Hello</h1>';
    const final = '<h1>World</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.textChanged).toBe(true);
    expect(result.textOriginal).toBe('Hello');
    expect(result.textFinal).toBe('World');
    expect(result.textSummary).toContain('Hello');
    expect(result.textSummary).toContain('World');
  });

  test('should detect no changes', () => {
    const original = '<h1 class="title">Hello</h1>';
    const final = '<h1 class="title">Hello</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.classAdded).toEqual([]);
    expect(result.classRemoved).toEqual([]);
    expect(result.textChanged).toBe(false);
    expect(result.textSummary).toBe('无变更');
  });

  test('should handle empty text', () => {
    const original = '<h1></h1>';
    const final = '<h1>Text</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.textChanged).toBe(true);
    expect(result.textOriginal).toBe('');
    expect(result.textFinal).toBe('Text');
  });

  test('should handle parsing failures gracefully', () => {
    // parse5 仍会解析 <invalid> 为元素（tagName 为 'invalid'），只有无根元素或空片段时才为 null
    const original = '<invalid>';
    const final = '<h1>Valid</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.final).not.toBeNull();
    expect(result.final?.tagName).toBe('h1');
    // classAdded/classRemoved 应为 string[]，且无 class 时为空数组
    expect(Array.isArray(result.classAdded)).toBe(true);
    expect(Array.isArray(result.classRemoved)).toBe(true);
    expect(result.classAdded).toEqual([]);
    expect(result.classRemoved).toEqual([]);
  });
});

describe('consumeGroupChangeResult', () => {
  test('should add htmlDiff to result', () => {
    const result = {
      originalFragment: '<h1 class="title">Hello</h1>',
      finalFragment: '<h1 class="title active">Hello</h1>',
      originalRange: { start: 0, end: 20 },
      finalRange: { start: 0, end: 25 },
    };

    const consumed = consumeGroupChangeResult(result);

    expect(consumed).toBeDefined();
    expect(consumed?.htmlDiff).toBeDefined();
    expect(Array.isArray(consumed?.htmlDiff.classAdded)).toBe(true);
    expect(consumed?.htmlDiff.classAdded).toContain('active');
    expect(new Set(consumed?.htmlDiff.classAdded).size).toBe(
      consumed?.htmlDiff.classAdded.length ?? 0
    );
    expect(consumed?.originalRange).toEqual(result.originalRange);
    expect(consumed?.finalRange).toEqual(result.finalRange);
  });

  test('should return undefined for undefined input', () => {
    const consumed = consumeGroupChangeResult(undefined);
    expect(consumed).toBeUndefined();
  });

  test('should preserve all original properties', () => {
    const result = {
      originalFragment: '<h1>Hello</h1>',
      finalFragment: '<h1>World</h1>',
      originalRange: { start: 0, end: 10 },
      finalRange: { start: 0, end: 10 },
      changeAnalysis: {
        equal: false,
        summary: 'test',
      },
    };

    const consumed = consumeGroupChangeResult(result);

    expect(consumed).toBeDefined();
    expect(consumed?.originalRange).toEqual(result.originalRange);
    expect(consumed?.finalRange).toEqual(result.finalRange);
    expect(consumed?.changeAnalysis).toEqual(result.changeAnalysis);
    expect(consumed?.htmlDiff).toBeDefined();
  });
});
