---
name: x-oasis
description: 精选实用工具库集合，按问题域组织，带有 AI 友好的技能系统
---

# x-oasis 项目指南

本文档解释了 x-oasis 项目结构以及如何有效地与 Claude Code 和 AI 代理在此代码库中工作。

## 项目概览

**x-oasis** 是一个包含 **63 个实用包** 的 monorepo，组织成 17 个类别，加上一个 **基于技能的文档系统**，为 AI 理解和指导而设计。

```
├── packages/                  # 63 个实用包
│   ├── assertion/            # 10 个包（is-*、类型检查）
│   ├── async/                # 2 个包（异步工具、RPC）
│   ├── comparison/           # 5 个包（相等、限制）
│   ├── css/                  # 1 个包（颜色工具）
│   ├── diff/                 # 3 个包（差异算法）
│   ├── dimension/            # 2 个包（布局工具）
│   ├── dom/                  # 5 个包（DOM 操作）
│   ├── error/                # 3 个包（日志、不变）
│   ├── event/                # 2 个包（发射器、一次性订阅）
│   ├── functional/           # 6+ 个包（分组、映射等）
│   ├── ioc/                  # 1 个包（依赖注入）
│   ├── misc/                 # 6 个包（工具）
│   ├── promise/              # 1 个包（延迟）
│   ├── proto/                # 5 个包（原型操作）
│   ├── schedule/             # 4 个包（防抖、节流）
│   ├── stream/               # 3 个包（异步迭代）
│   └── struct/               # 4 个包（数据结构）
│
├── skills/                    # 问题域文档
│   ├── SKILLS_INDEX.md        # 主索引和导航
│   ├── type-validation/SKILL.md
│   ├── request-throttling/SKILL.md
│   ├── event-management/SKILL.md
│   ├── stream-processing/SKILL.md
│   ├── change-detection/SKILL.md
│   ├── object-comparison/SKILL.md
│   └── functional-programming/SKILL.md
│
├── AGENTS.md                  # 如何用技能构建代理
├── CLAUDE.md                  # 本文件
└── README.md                  # 项目概览
```

## 关键概念

### 技能 vs 包

此项目使用 **技能** 而不是 **包** 作为主要导航：

- **包** = 实现（代码在 `packages/`）
- **技能** = 问题域（文档在 `skills/`）

一个技能解决问题并使用多个包。例如：
- **请求限流** 技能使用防抖、节流、batchinator 包
- **变化检测** 技能使用 diff-match-patch、html-fragment-diff、map-diff-range 包

### 何时使用什么

| 情况 | 做法 |
|-----------|-----------|
| 用户问「我如何...？」| 在 SKILLS_INDEX.md 中找到匹配技能 |
| 用户有性能问题 | 阅读对象比较或请求限流技能 |
| 用户需要代码示例 | 在相关 SKILL.md 中查找模式部分 |
| 用户想学习最佳实践 | 检查「最佳实践」和「常见陷阱」 |
| 用户问特定包 | 找出哪个技能使用该包 |
| 需要多个技能 | 读取每个 SKILL.md 并展示组合 |

## 使用技能

### 每个 SKILL.md 的结构

每个 SKILL.md 遵循此结构：

```
元数据（YAML 前沿）
- name：技能标识符
- description：简要概览

何时使用此技能
- 场景和用例
- 它解决的问题示例

快速入门
- 5 分钟工作示例
- 最小代码开始

可用工具
- 函数和包表
- 每个工具做什么

模式 1：[名称]
模式 2：[名称]
... (8+ 个模式)
- 真实世界代码示例
- 分步实现

最佳实践
- ✅ 做法：推荐方法
- ❌ 不做法：反模式

常见陷阱
- 要避免的真实错误
- 为什么会发生
- 如何修复

集成示例
- React 示例
- Vue 示例
- Svelte 示例
- Node.js 示例

参考资料
- 更深层技术细节链接
```

### 如何提取信息

帮助 x-oasis 时，**始终**：

1. 检查 `skills/SKILLS_INDEX.md` 获取问题类型
2. 读取完整的相关 `SKILL.md` 文件
3. 从模式部分提取代码
4. 包含常见陷阱的警告
5. 建议最佳实践部分中的最佳实践

示例：

```
用户："如何防抖搜索函数？"

过程：
1. 检查 SKILLS_INDEX.md → 找到「请求限流」
2. 读取 skills/request-throttling/SKILL.md
3. 找到「模式 1：防抖」
4. 提取代码示例
5. 检查「常见陷阱」→ 关于内存泄漏的陷阱 2
6. 从「最佳实践」部分建议
7. 提供框架特定的示例（React/Vue/等）
```

## 交互指南

### ✅ 做法

```
帮助用户时：

✅ 回答前读完整的 SKILL.md
✅ 直接从 SKILL.md 模式引用
✅ 突出相关的陷阱部分
✅ 显示完整、工作的代码示例
✅ 解释何时使用每个模式
✅ 如果需要建议技能组合
✅ 指导用户阅读原始 SKILL.md
✅ 将答案置于记录的模式中
✅ 在相关时包括框架特定示例
✅ 直接说：「这是请求限流技能中的模式 X」
```

### ❌ 不做法

```
帮助用户时：

❌ 给出 SKILL.md 中未记录的答案
❌ 临时发挥新模式
❌ 忽视常见陷阱部分
❌ 提供不完整的代码片段
❌ 不加说明地混合模式
❌ 在不读 SKILLS_INDEX.md 的情况下假设技能
❌ 推荐未验证的模式
❌ 给出过时信息
❌ 跳过 React/Vue 项目的框架特定示例
❌ 建议「不做法」部分的反模式为好实践
```

## 常见任务

### 任务 1：回答「我如何...？」问题

```
问题："如何防止事件监听器中的内存泄漏？"

步骤：
1. 识别：内存泄漏防止 → 事件管理技能
2. 读：skills/event-management/SKILL.md
3. 找：「陷阱 1：内存泄漏」
4. 提取：模式 2 或模式 8
5. 显示：完整工作代码
6. 警告：关于忘记 dispose() 调用
```

### 任务 2：调试性能问题

```
问题："组件重新渲染过多"

步骤：
1. 识别：性能 → 对象比较或请求限流
2. 读：skills/object-comparison/SKILL.md 首先
3. 找：模式 1（浅相等）或模式 5（变化检测）
4. 建议：对 React 记忆化使用 shallowEqual
5. 替代：如果高频更新则为请求限流
6. 警告：陷阱 3 关于记忆化失效
```

### 任务 3：显示多技能解决方案

```
问题："用实时同步构建协作编辑器"

涉及的技能：
1. 流处理 → 处理数据流
2. 变化检测 → 追踪变化
3. 事件管理 → 同步事件
4. 函数式编程 → 转换数据

步骤：
1. 显示每个技能的角色
2. 解释它们如何协同工作
3. 显示每个 SKILL.md 的模式 X
4. 提供集成示例
5. 突出关键陷阱
```

### 任务 4：帮助类型验证

```
问题："如何安全地检查值是否为空？"

步骤：
1. 识别：类型验证 → 类型验证技能
2. 读：skills/type-validation/SKILL.md
3. 注意：多个 is-* 函数可用
4. 显示：正确函数（isEmpty，不是 == null）
5. 警告：陷阱 2 关于字符串 vs 假值混淆
6. 示例：表单验证用例
```

## 代码示例和参考资料

### 获取代码示例

始终从 SKILL.md 模式部分提取：

```
✅ 正确：
从 skills/request-throttling/SKILL.md 模式 1：
import { debounce } from '@x-oasis/debounce';
const search = debounce(api.search, 300);

❌ 错：
自己编写防抖实现
```

### 测试建议

审查代码时：

1. 检查它是否与记录的模式匹配
2. 验证它遵循最佳实践
3. 查找常见陷阱
4. 根据 SKILL.md 建议改进

## 重要文件

| 文件 | 目的 |
|------|---------|
| `skills/SKILLS_INDEX.md` | 主索引、导航、问题查找 |
| `skills/*/SKILL.md` | 完整技能文档 |
| `AGENTS.md` | 如何用技能构建代理 |
| `CLAUDE.md` | 本文件（项目指南） |
| `packages/*/package.json` | 个别包元数据 |
| `README.md` | 项目概览 |

## 项目约定

### 命名

- 包：小写、连字符（例如 `is-empty`、`async-call-rpc`）
- 技能：小写、连字符（例如 `type-validation`、`request-throttling`）
- 函数：驼峰式（例如 `isEmpty`、`debounce`、`groupBy`）

### 文档标准

每个 SKILL.md：
- 必须有 8+ 个模式
- 必须有最佳实践（做法/不做法）
- 必须有常见陷阱
- 应该有 4+ 个框架集成
- 应该包括真实世界示例

### 代码质量

建议代码时：
- 始终提供完整、工作的示例
- 首先显示最常见的用例
- 包括简单和高级模式
- 在建议前在心理上测试语法
- 在有帮助时使用 TypeScript 类型提示

## 何时参考资源

**指向 SKILL.md**：用户询问关于使用技能的具体问题
```
用户："如何使用防抖？"
→ "见 skills/request-throttling/SKILL.md 模式 1"
```

**指向 SKILLS_INDEX.md**：用户不确定使用哪个技能
```
用户："我有性能问题"
→ "检查 skills/SKILLS_INDEX.md「按问题快速导航」"
```

**指向 AGENTS.md**：关于构建代理的讨论
```
用户："代理应该如何使用技能？"
→ "见 AGENTS.md 获取架构模式"
```

**指向包 README**：关于特定包实现的细节
```
用户："@x-oasis/debounce 在内部如何工作？"
→ "见 packages/schedule/debounce/README.md"
```

## 关键指南

### 始终验证

```typescript
❌ 错：
await import('@x-oasis/some-package');

✅ 对：
检查 skills/SKILLS_INDEX.md 获取实际包名
然后在 packages/* 目录中验证
```

### 始终读完整 SKILL.md

```
❌ 错：
不阅读完整技能的快速答案

✅ 对：
1. 读完整 SKILL.md
2. 检查模式以获得最佳匹配
3. 审查最佳实践部分
4. 注意常见陷阱
5. 然后提供答案
```

### 始终包括示例

```
❌ 错：
「对记忆化使用浅相等」

✅ 对：
「对记忆化使用浅相等：

import { shallowEqual } from '@x-oasis/shallow-equal';
const memoized = useMemo(() => {
  return shallowEqual(prevProps, nextProps);
}, [props]);

这是 skills/object-comparison/SKILL.md 中的模式 1」
```

## 未来增强

技能系统可以扩展：

- 为剩余包添加更多技能（DOM、原型等）
- Reference/ 目录带有技术细节
- Examples/ 文件夹带有完整工作项目
- 性能基准和度量
- 链接到技能的视频教程
- 技能依赖映射

## 结论

x-oasis 项目旨在帮助用户解决问题，而不仅仅是列出包。技能系统通过以下方式桥接这一差距：

1. **按问题组织** - 而不是实现
2. **提供模式** - 随时使用的代码示例
3. **教授最佳实践** - 常见陷阱和做法/不做法
4. **支持框架** - React、Vue、Svelte、Node.js
5. **启用 AI 代理** - 清晰、可解析的结构

在 x-oasis 工作时：
- 将技能视为主要文档
- 让技能指导你的建议
- 回答前始终读完整的 SKILL.md
- 直接从模式提取代码
- 突出相关陷阱
- 为复杂问题组合技能

这确保了对所有用户的一致、高质量的指导。

---

**有问题？** 检查 `skills/SKILLS_INDEX.md` 或相关的 `SKILL.md`。
