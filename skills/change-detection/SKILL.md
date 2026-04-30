---
name: change-detection
description: 使用差异算法检测和追踪数据结构中的变化。对于变化跟踪、撤销/重做和检测状态之间的变化很有用。
---

# 变化检测技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **追踪变化** 在两个版本之间（表单编辑、文档修订）
- **实现撤销/重做** 功能
- **仅同步改变的部分** 数据
- **检测 HTML 差异** 在生成的内容中
- **构建基于差异的** API（如 Google 文档）
- **优化更新** 通过确切知道改变了什么

## 快速入门

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';
import { diffHtmlFragment } from '@x-oasis/html-fragment-diff';
import { mapDiffRange } from '@x-oasis/map-diff-range';

// 文本差异
const dmp = new DiffMatchPatch();
const diffs = dmp.diff_main('Hello World', 'Hello JavaScript');
console.log('变化：', diffs);

// HTML 差异
const htmlDiff = diffHtmlFragment(
  '<p>老文本</p>',
  '<p>新文本</p>'
);
console.log('HTML 变化：', htmlDiff);

// 在编辑中映射变化
const range = mapDiffRange(
  'Original text here',
  'Original modified text here',
  [10, 20] // 原始范围
);
console.log('新范围：', range);
```

## 可用工具

| 函数 | 目的 | 用例 |
|----------|---------|----------|
| `DiffMatchPatch` | 文本差异/补丁 | 比较文本版本 |
| `diffHtmlFragment` | HTML 差异 | 追踪 HTML 元素变化 |
| `mapDiffRange` | 范围映射 | 在编辑后调整位置 |

## 模式 1：文本差异

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

const dmp = new DiffMatchPatch();

// 获取差异
const original = 'The quick brown fox';
const modified = 'The quick red fox';

const diffs = dmp.diff_main(original, modified);
// 输出：[
//   [0, 'The quick '],    // 未改变
//   [-1, 'brown'],        // 移除
//   [1, 'red'],           // 添加
//   [0, ' fox']           // 未改变
// ]

// 漂亮打印
dmp.diff_prettyprint(diffs);
// 输出：<del>brown</del> ➔ <ins>red</ins>
```

**真实例子：追踪文档编辑**

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

class DocumentTracker {
  private dmp = new DiffMatchPatch();
  private history: string[] = [];

  constructor(initial: string) {
    this.history = [initial];
  }

  edit(newContent: string) {
    const previous = this.history[this.history.length - 1];
    const diffs = this.dmp.diff_main(previous, newContent);

    // 追踪编辑
    this.recordChange(diffs);
    this.history.push(newContent);
  }

  recordChange(diffs: any[]) {
    console.log('所做改变：', diffs);
    // 可能发送到服务器进行同步
  }

  undo() {
    if (this.history.length > 1) {
      this.history.pop();
      return this.history[this.history.length - 1];
    }
  }
}
```

## 模式 2：用于传输的补丁

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

const dmp = new DiffMatchPatch();

const original = 'The original text';
const modified = 'The modified text';

// 创建补丁（用于传输的紧凑格式）
const patches = dmp.patch_make(original, modified);
const patchText = dmp.patch_toText(patches);

console.log('补丁：', patchText);
// 可以通过网络发送（比完整文本小得多）

// 应用补丁以重现改变
const result = dmp.patch_apply(patchText, original);
console.log('结果：', result[0]); // 'The modified text'
```

**真实例子：协作编辑**

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

class CollaborativeDoc {
  private dmp = new DiffMatchPatch();
  private currentVersion = '';

  // 用户在本地编辑
  applyLocalEdit(newText: string) {
    const patches = this.dmp.patch_make(this.currentVersion, newText);
    const patchText = this.dmp.patch_toText(patches);

    // 将补丁发送到服务器（比完整文本小得多）
    this.sendToServer(patchText);
    this.currentVersion = newText;
  }

  // 接收远程编辑
  applyRemoteEdit(patchText: string) {
    const [result] = this.dmp.patch_apply(patchText, this.currentVersion);
    this.currentVersion = result;
    return result;
  }

  private sendToServer(patch: string) {
    // 只发送差异，不是完整文档
    fetch('/api/doc/patch', {
      method: 'POST',
      body: JSON.stringify({ patch }),
    });
  }
}
```

## 模式 3：HTML 差异

```typescript
import { diffHtmlFragment } from '@x-oasis/html-fragment-diff';

// 检测 HTML 差异
const oldHtml = `
  <div class="header">
    <h1>标题</h1>
    <p>描述</p>
  </div>
`;

const newHtml = `
  <div class="header active">
    <h1>新标题</h1>
    <p>新描述</p>
  </div>
`;

const changes = diffHtmlFragment(oldHtml, newHtml);
console.log('变化：', changes);
// 检测：类改变、h1 和 p 中的文本改变
```

**真实例子：视觉回归测试**

```typescript
import { diffHtmlFragment } from '@x-oasis/html-fragment-diff';

async function checkVisualRegression(component: string) {
  const expectedHtml = await getExpectedHtml(component);
  const actualHtml = await renderComponent(component);

  const diff = diffHtmlFragment(expectedHtml, actualHtml);

  if (diff.changes.length > 0) {
    console.error('检测到视觉回归：', diff);
    return false;
  }
  return true;
}
```

## 模式 4：范围映射

```typescript
import { mapDiffRange } from '@x-oasis/map-diff-range';

// 原始文本带有选择范围
const original = 'The quick brown fox jumps';
const modified = 'The very quick brown fox jumps'; // 添加了 "very "

// 用户在范围 [10, 15] 处选择了 "brown"
const originalRange = [10, 15];

// 在插入 "very " 后，"brown" 在哪里？
const newRange = mapDiffRange(original, modified, originalRange);
console.log('新范围：', newRange); // [15, 20]
```

**真实例子：选择保留**

```typescript
import { mapDiffRange } from '@x-oasis/map-diff-range';

class RichEditor {
  private content = 'The quick brown fox';
  private selection = [4, 9]; // 用户选择了 "quick"

  replaceText(start: number, end: number, newText: string) {
    const before = this.content.substring(0, start);
    const after = this.content.substring(end);
    const oldContent = this.content;
    this.content = before + newText + after;

    // 保留选择
    this.selection = mapDiffRange(
      oldContent,
      this.content,
      this.selection
    );
  }
}
```

## 模式 5：变化追踪 UI

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

function renderDiff(original: string, modified: string) {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(original, modified);

  return (
    <div className="diff">
      {diffs.map((diff, i) => {
        const [type, text] = diff;
        if (type === 0) {
          return <span key={i}>{text}</span>; // 未改变
        } else if (type === 1) {
          return <span key={i} className="added">{text}</span>; // 添加
        } else {
          return <span key={i} className="removed">{text}</span>; // 移除
        }
      })}
    </div>
  );
}

// 使用
<div className="changes">
  {renderDiff(oldVersion, newVersion)}
</div>
```

## 模式 6：语义差异

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

class SemanticDiff {
  private dmp = new DiffMatchPatch();

  // 带有语义理解的差异
  diffSentences(old: string, new_: string) {
    const oldSentences = old.split(/(?<=[.!?])\s+/);
    const newSentences = new_.split(/(?<=[.!?])\s+/);

    return oldSentences.map((oldS, i) => {
      const newS = newSentences[i];
      if (oldS !== newS) {
        const diffs = this.dmp.diff_main(oldS, newS);
        return { changed: true, diffs };
      }
      return { changed: false, text: oldS };
    });
  }
}

// 句级差异而非字符级
const semantic = new SemanticDiff();
const changes = semantic.diffSentences(
  'The cat sat on the mat. The dog barked.',
  'The cat sat on the rug. The dog barked.'
);
```

## 模式 7：撤销/重做系统

```typescript
import { DiffMatchPatch } from '@x-oasis/diff-match-patch';

class UndoRedoManager {
  private dmp = new DiffMatchPatch();
  private history: { content: string; patches: string }[] = [];
  private currentIndex = -1;

  constructor(initial: string) {
    this.history.push({ content: initial, patches: '' });
    this.currentIndex = 0;
  }

  edit(newContent: string) {
    const current = this.history[this.currentIndex].content;
    const patches = this.dmp.patch_toText(
      this.dmp.patch_make(current, newContent)
    );

    // 移除任何重做历史
    this.history = this.history.slice(0, this.currentIndex + 1);

    // 添加新状态
    this.history.push({ content: newContent, patches });
    this.currentIndex++;
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex].content;
    }
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex].content;
    }
  }

  getCurrentContent() {
    return this.history[this.currentIndex].content;
  }
}
```

## 最佳实践

### ✅ 做法

```typescript
// 使用补丁进行传输（比完整文本小）
const patches = dmp.patch_make(old, new_);
const patchText = dmp.patch_toText(patches);
sendToServer(patchText);

// 在编辑中保留选择
const newRange = mapDiffRange(oldText, newText, selection);

// 清理差异结果
const summary = diffs.map(([type, text]) => ({
  type: ['unchanged', 'added', 'removed'][type + 1],
  text,
}));
```

### ❌ 不做法

```typescript
// 不要字符级比较大文本（慢）
const diffs = dmp.diff_main(hugeText1, hugeText2);

// 不要忽视冲突解决
// 如果两个补丁冲突，优雅地处理

// 不要假设范围保持有效
// 在多个编辑后，重新计算范围位置
```

## 常见陷阱

### 陷阱 1：丢失选择

```typescript
// ❌ 编辑后选择变为无效
let selection = [0, 5];
content = 'X' + content; // 在开头插入
// 选择仍然 [0, 5] 但它是错的！

// ✅ 重新映射选择
selection = mapDiffRange(oldContent, newContent, selection);
```

### 陷阱 2：补丁冲突

```typescript
// ❌ 应用冲突补丁
const patch1 = dmp.patch_make('abc', 'aXc');
const patch2 = dmp.patch_make('abc', 'aBc');

// 两个顺序应用可能失败
dmp.patch_apply(patch1Text, 'abc'); // 'aXc'
dmp.patch_apply(patch2Text, 'aXc'); // 冲突！

// ✅ 为协作编辑追踪补丁血统或使用 OT/CRDT
```

### 陷阱 3：HTML 特殊字符

```typescript
// ❌ 差异在 HTML 实体中中断
diffHtmlFragment(
  '<p>&lt;script&gt;</p>',
  '<p>&lt;img /&gt;</p>'
);

// ✅ 正确处理转义
const escaped1 = escapeHtml(text1);
const escaped2 = escapeHtml(text2);
diffHtmlFragment(escaped1, escaped2);
```

## 参考资料

- [DiffMatchPatch 算法](../../references/diff-algorithm.md)
- [补丁格式规范](../../references/patch-format.md)
- [HTML 差异策略](../../references/html-diffing.md)
- [操作转换](../../references/ot-guide.md)
