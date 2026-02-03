

> @apps/code-preview-2/services/editor/CodeModService.ts:105-147 帮我完善一下方法，目前会涉及到三个文件，最开始的文件 originalContent, 当前文件 currentContent 以及更改以后文件finalContent；同时提供了 originalTagOffset表示当前文件变更发生的range，也就是这个range的内容变了，对应到了 finalContent; 首先通过 originalTagOffset 找到它对应的 originalContent 的range，以及找到它对应的finalContent的range；拿到这两个range以后，我们就可以得到最开始文件的片段，以及最后的文件片段；通过这两个片段内容的对比，帮我分析出来他们两个之间到底发生了什么change；其中 originalTagOffset 名字不太合理，应该是 currentTagOffset; 而通过range找映射的range可以参考 https://github.com/red-armor/x-oasis/blob/main/packages/diff/diff-match-patch/src/index.ts#L123 ；整个utils作为一个单独的方法放到一个单独文件里面来提供。

Implementing the solution: reading the full `CodeModService` and related utilities to understand structure and dependencies.


[3 tools called]


Checking how `@x-oasis/diff-match-patch` is used and whether it exposes range-mapping:


[3 tools called]


Creating the range-mapping utility file and completing the method. Checking the `diff-match-patch` API in the repo:


[4 tools called]


Implementing the solution: creating the utility file and updating CodeModService.


[7 tools called]


Checking whether `diff-match-patch` default export exists and fixing lint/type issues:


[1 tool called]


Fixing the tagPosition type: it's string but we need number. Checking its usage:


[3 tools called]


Allowing currentTagOffset to accept string or number and coercing to number inside the method.


[4 tools called]


Updating the addSketchDraft options type to accept tagPosition as string or number:


[3 tools called]


Lint is clean for the changed files. Remaining tsc errors come from other files. Marking the task complete.


[1 tool called]


已按你的需求改完，变更总结如下。

### 1. 新文件 `resolveGroupChangeUtils.ts`

单独工具文件，包含：

- **`mapNewerRangeToOlder(olderContent, newerContent, startOffset, endOffset)`**
  把「新内容」上的 range 映射到「旧内容」上的 range，逻辑对齐 [x-oasis 的 mapCurrentRangeToOriginal](https://github.com/red-armor/x-oasis/blob/main/packages/diff/diff-match-patch/src/index.ts#L123)（`diff_main(older, newer)`，给定 newer 上的 [start,end]，返回 older 上的 range）。

- **`mapOlderRangeToNewer(olderContent, newerContent, startOffset, endOffset)`**
  反向映射：旧内容上的 range → 新内容上的 range。

- **`analyzeFragmentChange(originalFragment, finalFragment)`**
  对两段文本做 diff，得到：
  - `equal` / `onlyDeletion` / `onlyInsertion` / `replacement`
  - `summary` 简短描述（如「删除: xxx」「新增: xxx」「替换: a → b」）
  - `diffs` 原始 diff 数组，便于上层展示或再处理。

- **`resolveGroupChangeFragments(options)`**
  入口方法：接收 `originalContent`、`currentContent`、`finalContent` 和 `currentTagOffset`（当前文件中变更的 range），返回：
  - `originalRange` / `finalRange`：在 original 和 final 中对应的 range
  - `originalFragment` / `finalFragment`：两段片段内容
  - `changeAnalysis`：上述片段级变更分析。

### 2. `CodeModService` 修改

- **参数命名**：`originTagOffset` 改为 **`currentTagOffset`**（表示当前文件中发生变更的 range）。
- **类型**：`currentTagOffset` 和 `addSketchDraft` 的 `tagPosition` 支持 **`number | string`**，内部用 `parseInt(..., 10)` 转成 number，与 `removeSketchOperation` 一致。
- **语法**：在 `domId` 后补上缺失的逗号。
- **实现**：
  - 用 `resolveTemplateTagOffset` 得到 template 偏移，把传入的 template 内 offset 转成文件级 offset，得到 `currentRangeOffset`。
  - 调用 **`resolveGroupChangeFragments`**，传入 `originalContent`、`currentContent`、`finalContent` 和 `currentRangeOffset`。
  - 返回该调用的结果（包含 `originalRange`、`finalRange`、两个片段和 `changeAnalysis`）；无法解析时返回 `undefined`。

这样，`resolveGroupChangeMessage` 会通过 `currentTagOffset` 先映射到 original 与 final 的 range，取出两段片段，再用 `analyzeFragmentChange` 得到「发生了什么变更」的描述；range 映射逻辑集中在 `resolveGroupChangeUtils.ts` 中，与 x-oasis 的 diff 映射思路一致。



## result

{
    "originalRange": {
        "start": 244,
        "end": 315
    },
    "finalRange": {
        "start": 244,
        "end": 315
    },
    "originalFragment": "<h1 class=\"text-[--color-text-title] text-2xl font-bold\">姓名3333444</h1>",
    "finalFragment": "<h1 class=\"text-2xl font-bold text-[--color-primary-pressing]\">姓名3</h1>",
    "changeAnalysis": {
        "originalFragment": "<h1 class=\"text-[--color-text-title] text-2xl font-bold\">姓名3333444</h1>",
        "finalFragment": "<h1 class=\"text-2xl font-bold text-[--color-primary-pressing]\">姓名3</h1>",
        "equal": false,
        "onlyDeletion": false,
        "onlyInsertion": false,
        "replacement": true,
        "summary": "替换: [--color-text-title] text-2xl font-bold\"… → 2xl font-bold text-[--color-primary-pres…",
        "diffs": [
            [
                0,
                "<h1 class=\"text-"
            ],
            [
                -1,
                "[--color-text-title] text-2xl font-bold\">姓名3333444"
            ],
            [
                1,
                "2xl font-bold text-[--color-primary-pressing]\">姓名3"
            ],
            [
                0,
                "</h1>"
            ]
        ]
    }
}













比如现在 @apps/code-preview-2/services/editor/CodeModService.ts:198-205 operation的值是 {
    "originalRange": {
        "start": 244,
        "end": 315
    },
    "finalRange": {
        "start": 244,
        "end": 315
    },
    "originalFragment": "<h1 class=\"text-[--color-text-title] text-2xl font-bold\">姓名3333444</h1>",
    "finalFragment": "<h1 class=\"text-2xl font-bold text-[--color-primary-pressing]\">姓名3</h1>",
    "changeAnalysis": {
        "originalFragment": "<h1 class=\"text-[--color-text-title] text-2xl font-bold\">姓名3333444</h1>",
        "finalFragment": "<h1 class=\"text-2xl font-bold text-[--color-primary-pressing]\">姓名3</h1>",
        "equal": false,
        "onlyDeletion": false,
        "onlyInsertion": false,
        "replacement": true,
        "summary": "替换: [--color-text-title] text-2xl font-bold\"… → 2xl font-bold text-[--color-primary-pres…",
        "diffs": [
            [
                0,
                "<h1 class=\"text-"
            ],
            [
                -1,
                "[--color-text-title] text-2xl font-bold\">姓名3333444"
            ],
            [
                1,
                "2xl font-bold text-[--color-primary-pressing]\">姓名3"
            ],
            [
                0,
                "</h1>"
            ]
        ]
    }
}；这个可以作为一个中间值，再提供一个方法消费这个result；它是消费 originalFragment， finalFragment，他们两个html 标签，通过parse的方式，帮我解析一下它俩的区别，比如class 多了啥，少了啥；然后text变更了啥。。



这个语义化的html diff，有没有开源社区方案呢。


[7 tools called]


有的，社区里和「语义化 HTML diff」相关的方案大致有几类，可以按你要的「结构化结果」还是「操作序列」来选。

---

## 1. **diff-dom**（最贴近「结构化 diff」）

- **仓库**: [fiduswriter/diffDOM](https://github.com/fiduswriter/diffDOM)
- **npm**: [diff-dom](https://www.npmjs.com/package/diff-dom)
- **协议**: LGPL-3.0

**特点**：
- 对两个 DOM / 两段 HTML 做**语义级 diff**，得到一列「修改操作」（不是纯文本 diff）。
- 支持 **HTML 字符串**：`stringToObj(html)` 转成内部虚拟 DOM 再 diff。
- 输出是**操作序列**，例如：`addAttribute`、`removeAttribute`、`replaceAttribute`、文本替换、子节点增删等。
- 零依赖，有 TypeScript 类型，还可 `apply` / `undo` 到 DOM。

**和你要的「class 多了啥、少了啥、文本变了啥」的关系**：
- 它给的是「从 A 到 B 的步骤」，没有直接给你 `classAdded` / `classRemoved`。
- 你可以在拿到 diff 后，**遍历操作序列**，把涉及 `class` 的 `addAttribute` / `removeAttribute` / `replaceAttribute` 归纳成「多了哪些 class、少了哪些 class」，文本变更同理。

适合：**接受「操作序列」再自己聚合成语义化结果**时使用。

---

## 2. **@open-wc/semantic-dom-diff**

- **npm**: [@open-wc/semantic-dom-diff](https://www.npmjs.com/package/@open-wc/semantic-dom-diff)
- **协议**: MIT

**特点**：
- 做的是**语义相等**比较：忽略空白、换行、注释、属性顺序等，判断两段 DOM/HTML 是否「语义相同」。
- 主要用在**测试**里：和 Chai 集成（`expect(el).dom.to.equal(...)`），或做快照测试。
- 输出是「通过/不通过」+ 可读的 diff 字符串，**不是**给你「class 增删、文本变更」这种可编程结构。

适合：**测试/断言**，不适合当「语义化 html diff 数据结构」给业务逻辑消费。

---

## 3. **html-differ**

- **npm**: [html-differ](https://www.npmjs.com/package/html-differ)

**特点**：
- 比较两段 HTML，对 **class** 做**集合语义**：`class="a b"` 和 `class="b a"` 视为相同。
- 可配置忽略属性、空白、注释等。
- 提供 `diffHtml()`、`isEqual()` 等，更偏向「是否相等」和 diff 报告，**不保证**直接暴露「added/removed class 数组」这种结构。

适合：**判断两段 HTML 是否语义等价**，若需要严格「多了啥、少了啥」可能要自己再解析一层。

---

## 4. **html-compare**（基于 cheerio）

- 按结构比较 HTML，返回 `added` / `removed` / `changed` 等类型的 change 对象和位置。
- 更接近「结构化变更」，但文档和 API 需要自己再查一下是否直接有「按属性的 class 增删」。

---

## 小结与建议

| 方案 | 输出形态 | 是否直接给出「class 增删 + 文本变更」 | 更适合场景 |
|------|----------|----------------------------------------|------------|
| **diff-dom** | 操作序列（add/remove/replace attribute 等） | 需自己从操作里归纳 | 需要可 apply 的 patch、或从操作序列推导语义 |
| **@open-wc/semantic-dom-diff** | 断言通过/失败 + 可读 diff 文本 | 否 | 测试、快照 |
| **html-differ** | 是否相等 + diff 报告 | 不一定 | 语义等价判断 |
| **当前实现（parse5 + 自研 compare）** | `classAdded` / `classRemoved` / `textSummary` 等 | 是 | 业务侧直接消费「多了啥、少了啥、文本变了啥」 |

**结论**：
- 若目标就是**直接拿到「class 多了啥、少了啥、文本变更」的语义化结构**，并给 Sketch 等业务用，**目前基于 parse5 的自研方案**更贴需求，社区库没有现成的「一模一样」的 API。
- 若你愿意**先拿 diff 操作序列再聚合**，可以引入 **diff-dom**，在 `htmlFragmentDiff.ts` 里用 diff-dom 的 diff 结果，写一小段逻辑把 `replaceAttribute('class', ...)` 等转成 `classAdded` / `classRemoved` 和文本变更，这样能少维护一点「自己解析 + 对比」的代码，但要注意 **LGPL-3.0** 的合规使用。





