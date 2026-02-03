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

    expect(result.classAdded).toContain('active');
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
    expect(result.classAdded).toContain('secondary');
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
    const original = '<invalid>';
    const final = '<h1>Valid</h1>';
    const result = compareHtmlFragments(original, final);

    expect(result.original).toBeNull();
    expect(result.final).not.toBeNull();
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
    expect(consumed?.htmlDiff.classAdded).toContain('active');
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
