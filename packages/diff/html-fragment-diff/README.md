# @x-oasis/html-fragment-diff

解析和对比 HTML 片段，检测 class 变更和文本变更。用于消费 `resolveGroupChangeFragments` 得到的 `originalFragment` / `finalFragment`。

## 功能

- **HTML 解析**：使用 parse5 解析 HTML 片段，提取标签名、class 列表、文本内容等
- **Class 对比**：检测 class 的新增和删除
- **文本对比**：检测文本内容的变更
- **结构化输出**：提供易于展示的结构化对比结果

## 安装

```bash
npm install @x-oasis/html-fragment-diff
# 或
pnpm add @x-oasis/html-fragment-diff
```

## 在线示例

查看 [交互式示例](./examples/index.html) 来可视化地了解如何使用这个库。

## 使用方法

### 基本用法：解析 HTML 片段

```typescript
import { parseFragmentToElement } from '@x-oasis/html-fragment-diff';

const fragment = '<h1 class="title primary">Hello World</h1>';
const parsed = parseFragmentToElement(fragment);

console.log(parsed?.tagName); // "h1"
console.log(parsed?.classList); // ["title", "primary"]
console.log(parsed?.textContent); // "Hello World"
```

### 对比两个 HTML 片段

```typescript
import { compareHtmlFragments } from '@x-oasis/html-fragment-diff';

const original = '<h1 class="title">Hello</h1>';
const final = '<h1 class="title active">World</h1>';

const diff = compareHtmlFragments(original, final);

console.log(diff.classAdded); // ["active"]
console.log(diff.classRemoved); // []
console.log(diff.textChanged); // true
console.log(diff.textSummary); // "「Hello」 → 「World」"
```

### 消费 resolveGroupChangeFragments 的结果

```typescript
import { resolveGroupChangeFragments } from '@x-oasis/map-diff-range';
import { consumeGroupChangeResult } from '@x-oasis/html-fragment-diff';

const result = resolveGroupChangeFragments({
  originalContent: '<h1 class="title">Name</h1>',
  currentContent: '<h1 class="title text-xl">Name</h1>',
  finalContent: '<h1 class="text-xl font-bold">Name</h1>',
  currentTagOffset: { startOffset: 0, endOffset: 30 },
});

const withHtmlDiff = consumeGroupChangeResult(result);

if (withHtmlDiff) {
  console.log(withHtmlDiff.htmlDiff.classAdded); // ["font-bold"]
  console.log(withHtmlDiff.htmlDiff.classRemoved); // ["title"]
  console.log(withHtmlDiff.htmlDiff.textChanged); // false
}
```

## API

### ParsedFragmentElement

```typescript
interface ParsedFragmentElement {
  tagName: string;              // 标签名（小写）
  classList: string[];          // class 属性按空白切分后的列表
  textContent: string;          // 元素内直接+间接文本拼接
  otherAttrs: Record<string, string>; // 除 class 外的其他属性
}
```

### HtmlFragmentDiff

```typescript
interface HtmlFragmentDiff {
  original: ParsedFragmentElement | null;  // 原始片段解析结果
  final: ParsedFragmentElement | null;    // 最终片段解析结果
  classAdded: string[];                     // 新增的 class 列表
  classRemoved: string[];                   // 删除的 class 列表
  textOriginal: string;                     // 原始片段根元素文本
  textFinal: string;                        // 最终片段根元素文本
  textChanged: boolean;                     // 文本是否发生变更
  textSummary: string;                      // 文本变更的简短描述
}
```

### parseFragmentToElement

从 HTML 片段中解析出第一个根元素的信息。

```typescript
function parseFragmentToElement(
  fragment: string
): ParsedFragmentElement | null
```

**参数：**
- `fragment`: 单段 HTML，如 `<h1 class="...">姓名</h1>`

**返回：** 第一个根元素的信息；若无元素或解析失败则返回 `null`

### compareHtmlFragments

对比两个 HTML 片段：解析后比较 class 增删与根元素文本变更。

```typescript
function compareHtmlFragments(
  originalFragment: string,
  finalFragment: string
): HtmlFragmentDiff
```

**参数：**
- `originalFragment`: 原始片段（如 `resolveGroupChangeFragments` 的 `originalFragment`）
- `finalFragment`: 最终片段（如 `resolveGroupChangeFragments` 的 `finalFragment`）

**返回：** 结构化对比结果

### consumeGroupChangeResult

消费 `resolveGroupChangeFragments` 的返回值：在原有片段级 diff 基础上，再解析两个 HTML 片段，得到 class 增删与文本变更的结构化结果。

```typescript
function consumeGroupChangeResult<T extends { originalFragment: string; finalFragment: string }>(
  result: T | undefined
): (T & { htmlDiff: HtmlFragmentDiff }) | undefined
```

**参数：**
- `result`: `resolveGroupChangeFragments` 的返回值

**返回：** 原 result 与 HTML 解析对比结果；若 result 为 `undefined` 则返回 `undefined`

## 示例场景

### 场景 1: Class 变更

```typescript
const original = '<h1 class="title">Name</h1>';
const final = '<h1 class="title active">Name</h1>';

const diff = compareHtmlFragments(original, final);
// diff.classAdded === ["active"]
// diff.classRemoved === []
```

### 场景 2: 文本变更

```typescript
const original = '<h1>Hello</h1>';
const final = '<h1>World</h1>';

const diff = compareHtmlFragments(original, final);
// diff.textChanged === true
// diff.textSummary === "「Hello」 → 「World」"
```

### 场景 3: Class 和文本同时变更

```typescript
const original = '<h1 class="title">Hello</h1>';
const final = '<h1 class="title active">World</h1>';

const diff = compareHtmlFragments(original, final);
// diff.classAdded === ["active"]
// diff.textChanged === true
```

## 依赖

- [parse5](https://www.npmjs.com/package/parse5): HTML 解析库

## License

ISC
