# @x-oasis/map-diff-range

基于 diff-match-patch 的 range 映射与变更分析工具，用于在 currentContent 和 nextContent 之间映射 range，并分析片段级变更。

## 功能

- **Range 映射**：在新旧内容之间双向映射 offset range
- **变更分析**：分析两段片段之间的变更类型（equal、onlyDeletion、onlyInsertion、replacement）
- **内容映射**：根据 currentContent 和 currentRange，找到 nextContent 对应的 range
- **语义化描述**：自动生成简短的变更摘要

## 安装

```bash
npm install @x-oasis/map-diff-range
# 或
pnpm add @x-oasis/map-diff-range
```

## 在线示例

查看 [交互式示例](./examples/index.html) 来可视化地了解如何使用这个库。示例包含：

- 文件内容输入（currentContent、nextContent）
- 交互式的 offset range 映射功能
- 详细的变更分析展示
- 多个预设的测试场景

## 使用方法

### 基本用法：Range 映射

```typescript
import { mapNewerRangeToOlder, mapOlderRangeToNewer } from '@x-oasis/map-diff-range';

const older = 'Hello World';
const newer = 'Hello Beautiful World';

// 将新内容中的 range 映射到旧内容
const olderRange = mapNewerRangeToOlder(older, newer, 6, 16);
console.log(olderRange); // { start: 6, end: 6 }

// 将旧内容中的 range 映射到新内容
const newerRange = mapOlderRangeToNewer(older, newer, 6, 6);
console.log(newerRange); // { start: 6, end: 16 }
```

### 变更分析

```typescript
import { analyzeFragmentChange } from '@x-oasis/map-diff-range';

const original = 'Hello World';
const final = 'Hello Beautiful World';

const analysis = analyzeFragmentChange(original, final);
console.log(analysis.equal); // false
console.log(analysis.onlyInsertion); // true
console.log(analysis.summary); // "新增: Beautiful "
console.log(analysis.diffs); // [[0, "Hello "], [1, "Beautiful "], [0, "World"]]
```

### Range 映射与变更分析

```typescript
import { resolveGroupChangeFragments } from '@x-oasis/map-diff-range';

const current = '<h1 class="title text-xl">Name</h1>';
const next = '<h1 class="text-xl font-bold">Name</h1>';

const result = resolveGroupChangeFragments({
  currentContent: current,
  nextContent: next,
  currentRange: { start: 4, end: 30 },
});

if (result) {
  console.log(result.nextRange); // { start: 4, end: 35 }
  console.log(result.currentFragment); // 'class="title text-xl">Name</h1>'
  console.log(result.nextFragment); // 'class="text-xl font-bold">Name</h1>'
  console.log(result.changeAnalysis.replacement); // true
  console.log(result.changeAnalysis.summary); // "替换: title  → font-bold"
}
```

## API

### Range

```typescript
interface Range {
  start: number; // 起始 offset（含头）
  end: number;   // 结束 offset（含尾）
}
```

### FragmentChangeAnalysis

```typescript
interface FragmentChangeAnalysis {
  originalFragment: string;  // 原始片段内容
  finalFragment: string;      // 最终片段内容
  equal: boolean;            // 是否完全相同
  onlyDeletion: boolean;     // 仅删除（无新增）
  onlyInsertion: boolean;    // 仅新增（无删除）
  replacement: boolean;      // 既有删除又有新增（替换）
  summary: string;           // 语义化描述（简短）
  diffs: Array<[number, string]>; // 详细 diff 条目
}
```

### mapNewerRangeToOlder

将「新内容」中的 offset range 映射到「旧内容」中的 offset range。

```typescript
function mapNewerRangeToOlder(
  olderContent: string,
  newerContent: string,
  startOffset: number,
  endOffset: number
): Range
```

**参数：**
- `olderContent`: 旧内容（diff 的 text1）
- `newerContent`: 新内容（diff 的 text2）
- `startOffset`: 新内容中的 range 起始 offset
- `endOffset`: 新内容中的 range 结束 offset（含尾）

**返回：** 旧内容中对应的 range

### mapOlderRangeToNewer

将「旧内容」中的 offset range 映射到「新内容」中的 offset range。

```typescript
function mapOlderRangeToNewer(
  olderContent: string,
  newerContent: string,
  startOffset: number,
  endOffset: number
): Range
```

**参数：**
- `olderContent`: 旧内容（diff 的 text1）
- `newerContent`: 新内容（diff 的 text2）
- `startOffset`: 旧内容中的 range 起始 offset
- `endOffset`: 旧内容中的 range 结束 offset

**返回：** 新内容中对应的 range

### analyzeFragmentChange

对比两段片段内容，分析发生的变更类型并生成简短描述。

```typescript
function analyzeFragmentChange(
  originalFragment: string,
  finalFragment: string
): FragmentChangeAnalysis
```

**参数：**
- `originalFragment`: 原始片段
- `finalFragment`: 变更后片段

**返回：** 变更分析结果

### resolveGroupChangeFragments

根据当前内容和 range，找到下一个内容对应的 range，并分析二者之间的变更。

```typescript
function resolveGroupChangeFragments(options: {
  currentContent: string;
  nextContent: string;
  currentRange: Range;
}): {
  nextRange: Range;
  currentFragment: string;
  nextFragment: string;
  changeAnalysis: FragmentChangeAnalysis;
} | undefined
```

**参数：**
- `options.currentContent`: 当前文件内容
- `options.nextContent`: 下一个文件内容
- `options.currentRange`: 当前文件中需要映射的 range

**返回：** 映射得到的 nextRange、对应片段、以及片段级变更分析；若无法解析则返回 `undefined`

## 示例场景

### 场景 1: Class 属性变更

```typescript
const current = '<h1 class="title text-xl">Name</h1>';
const next = '<h1 class="text-xl font-bold">Name</h1>';

const result = resolveGroupChangeFragments({
  currentContent: current,
  nextContent: next,
  currentRange: { start: 4, end: 30 },
});

// result.changeAnalysis.replacement === true
// result.changeAnalysis.summary === "替换: title  → font-bold"
```

### 场景 2: 文本替换

```typescript
const current = 'Hello Beautiful World';
const next = 'Hello Amazing World';

const result = resolveGroupChangeFragments({
  currentContent: current,
  nextContent: next,
  currentRange: { start: 6, end: 15 },
});

// result.changeAnalysis.replacement === true
// result.changeAnalysis.summary === "替换: Beautiful  → Amazing "
```

### 场景 3: 仅删除

```typescript
const current = 'Hello Beautiful World';
const next = 'Hello World';

const result = resolveGroupChangeFragments({
  currentContent: current,
  nextContent: next,
  currentRange: { start: 6, end: 15 },
});

// result.changeAnalysis.onlyDeletion === true
// result.changeAnalysis.summary === "删除: Beautiful "
```

### 场景 4: 仅新增

```typescript
const current = 'Hello World';
const next = 'Hello Beautiful World';

const result = resolveGroupChangeFragments({
  currentContent: current,
  nextContent: next,
  currentRange: { start: 6, end: 6 },
});

// result.changeAnalysis.onlyInsertion === true
// result.changeAnalysis.summary === "新增: Beautiful "
```

## 错误处理

如果提供的 offset range 无效，`resolveGroupChangeFragments` 会返回 `undefined`：

- `startOffset < 0` 或 `endOffset < 0`
- `startOffset > endOffset`
- `endOffset > currentContent.length`

## 依赖

- [diff-match-patch](https://www.npmjs.com/package/diff-match-patch): Google 的 diff-match-patch 库

## License

ISC
