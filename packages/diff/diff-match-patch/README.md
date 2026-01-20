# @x-oasis/diff-match-patch

基于 Google 的 diff-match-patch 库，提供将最新文件中指定 offset range 的内容恢复到原始版本的功能。

## 功能

当文件经过一系列增删改操作后，可以基于最新文件提供 `start-offset` 和 `end-offset`，将指定 range 内的内容恢复到最初版本。

## 安装

```bash
npm install @x-oasis/diff-match-patch
# 或
pnpm add @x-oasis/diff-match-patch
```

## 在线示例

查看 [交互式示例](./examples/index.html) 来可视化地了解如何使用这个库。示例包含：

- 文件差异的可视化显示
- 交互式的 offset range 恢复功能
- 详细的调试信息展示
- 多个预设的测试场景

直接在浏览器中打开 `examples/index.html` 即可使用。

## 使用方法

### 使用类方式

```typescript
import { FileRestoreManager } from '@x-oasis/diff-match-patch';

const originalContent = 'Hello World';
const currentContent = 'Hello Beautiful World';

const manager = new FileRestoreManager(originalContent);

// 恢复 offset 6-15 的内容（"Beautiful "）到原始版本
const restored = manager.restoreRange(currentContent, {
  startOffset: 6,
  endOffset: 15
});

console.log(restored); // "Hello World"
```

### 使用便捷函数

```typescript
import { restoreRange } from '@x-oasis/diff-match-patch';

const originalContent = 'Hello World';
const currentContent = 'Hello Beautiful World';

// 恢复 offset 6-15 的内容到原始版本
const restored = restoreRange(originalContent, currentContent, 6, 15);

console.log(restored); // "Hello World"
```

## API

### FileRestoreManager

#### 构造函数

```typescript
new FileRestoreManager(originalContent: string)
```

创建一个文件恢复管理器实例。

- `originalContent`: 原始文件内容

#### 方法

##### restoreRange

```typescript
restoreRange(
  currentContent: string,
  options: { startOffset: number; endOffset: number }
): string
```

将最新文件中指定 offset range 的内容恢复到原始版本。

- `currentContent`: 最新文件内容
- `options.startOffset`: 恢复范围的起始 offset（基于最新文件）
- `options.endOffset`: 恢复范围的结束 offset（基于最新文件）
- 返回: 恢复后的文件内容

##### getOriginalContent

```typescript
getOriginalContent(): string
```

获取原始文件内容。

##### updateOriginalContent

```typescript
updateOriginalContent(newOriginalContent: string): void
```

更新原始文件内容。

### restoreRange (便捷函数)

```typescript
restoreRange(
  originalContent: string,
  currentContent: string,
  startOffset: number,
  endOffset: number
): string
```

便捷函数，直接恢复指定 range 的内容。

## 示例

### 示例 1: 恢复插入的内容

```typescript
const original = 'Hello World';
const current = 'Hello Beautiful World';

// 恢复插入的 "Beautiful " 部分
const restored = restoreRange(original, current, 6, 15);
// 结果: "Hello World"
```

### 示例 2: 恢复删除的内容

```typescript
const original = 'Hello Beautiful World';
const current = 'Hello World';

// 在删除的位置恢复内容
const restored = restoreRange(original, current, 6, 6);
// 结果: "Hello Beautiful World"
```

### 示例 3: 恢复修改的内容

```typescript
const original = 'The quick brown fox';
const current = 'The fast brown fox';

// 恢复 "fast" 为 "quick"
const restored = restoreRange(original, current, 4, 8);
// 结果: "The quick brown fox"
```

## 错误处理

如果提供的 offset range 无效，函数会抛出错误：

- `Invalid offset range`: startOffset 或 endOffset 无效
- `Offset range exceeds current content length`: offset 超出文件长度

## 依赖

- [diff-match-patch](https://www.npmjs.com/package/diff-match-patch): Google 的 diff-match-patch 库

## License

ISC
