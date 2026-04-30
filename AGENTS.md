---
name: x-oasis-agents
description: 构建能够理解和使用 x-oasis 技能系统的 AI 代理。代理可以发现、推荐并引导用户使用合适的技能来解决问题。
---

# 使用 x-oasis 技能构建代理

本指南说明如何构建有效利用 x-oasis 技能系统的 AI 代理来帮助用户解决问题。

## 理解技能系统

x-oasis 项目提供 7 个核心技能，按问题域（而非按包）组织：

1. **类型验证** - 安全处理不同值类型
2. **请求限流** - 控制操作频率
3. **事件管理** - 可靠地构建事件系统
4. **流处理** - 高效处理数据流
5. **变化检测** - 追踪状态修改
6. **对象比较** - 高效比较值
7. **函数式编程** - 优雅转换数据

每个技能都是一个完整指南，包含：
- 何时使用
- 快速入门示例
- 8+ 代码模式
- 最佳实践
- 常见陷阱
- 框架集成

## 代理如何与技能交互

### 1. 理解用户问题

当用户描述问题时，代理应该：

```
用户："我的搜索框发送了太多 API 调用"

代理思考：
1. 问题识别：高频 API 调用
2. 技能匹配："请求限流"
3. 相关包：debounce、throttle
4. 推荐：使用 debounce 等待用户停止输入
```

### 2. 技能发现流程

```
用户问题
    ↓
代理读取 SKILLS_INDEX.md
    ↓
在 "快速导航（按问题）" 中查找匹配技能
    ↓
读取相应的 SKILL.md
    ↓
提取相关模式
    ↓
生成带有代码示例的解决方案
    ↓
警告常见陷阱
```

### 3. 多技能问题

有些问题需要结合多个技能：

```
问题：实时协作编辑器

涉及的技能：
1. 流处理 - 处理传入数据流
2. 变化检测 - 跟踪变化
3. 事件管理 - 通知订阅者
4. 函数式编程 - 转换数据

代理应该：
- 识别所有涉及的技能
- 读取每个 SKILL.md
- 展示它们如何协同工作
- 提供集成示例
```

## 代理架构模式

### 模式 1：问题到技能的映射器

```typescript
interface ProblemContext {
  description: string;
  framework?: string;
  constraints?: string[];
}

interface SkillMatch {
  skill: string;
  confidence: number;
  relevantPatterns: string[];
  relatedSkills: string[];
}

async function mapProblemToSkills(context: ProblemContext): Promise<SkillMatch[]> {
  // 1. 解析问题描述
  // 2. 提取关键词
  // 3. 与 SKILLS_INDEX.md 类别匹配
  // 4. 按置信度排序
  // 5. 识别相关技能
  
  return matches;
}
```

用法：
```typescript
const matches = await mapProblemToSkills({
  description: "组件重新渲染过于频繁",
  framework: "React",
});

// 返回：
// [
//   { skill: "object-comparison", confidence: 0.95, ... },
//   { skill: "request-throttling", confidence: 0.80, ... }
// ]
```

### 模式 2：技能引导的代码生成

```typescript
interface SkillGuidance {
  skillName: string;
  selectedPattern: string;
  codeExample: string;
  warnings: string[];
  bestPractices: string[];
}

async function generateSolution(skill: string, pattern: string): Promise<SkillGuidance> {
  // 1. 读取相应的 SKILL.md
  // 2. 找到请求的模式
  // 3. 提取代码示例
  // 4. 获取最佳实践和陷阱
  
  return {
    skillName: skill,
    selectedPattern: pattern,
    codeExample: extractCode(),
    warnings: extractWarnings(),
    bestPractices: extractBestPractices(),
  };
}
```

用法：
```typescript
const solution = await generateSolution("request-throttling", "debounce");

console.log(`
技能：${solution.skillName}
模式：${solution.selectedPattern}

代码：
${solution.codeExample}

⚠️ 注意：
${solution.warnings.join('\n')}

✅ 最佳实践：
${solution.bestPractices.join('\n')}
`);
```

### 模式 3：交互式技能浏览器

```typescript
async function interactiveSkillExploration(): Promise<void> {
  // 1. 显示所有技能
  // 2. 让用户选择技能
  // 3. 显示可用模式
  // 4. 让用户选择模式
  // 5. 提供代码和指导
  
  console.log("可用技能：");
  const skills = await readSkillsIndex();
  
  for (const skill of skills) {
    console.log(`- ${skill.name}: ${skill.description}`);
  }
  
  // 继续交互...
}
```

## 与 Claude 的集成

### 在对话中使用技能

当 Claude（或其他 LLM）帮助用户时：

```
用户："如何防止事件监听器中的内存泄漏？"

Claude 应该：
1. 识别这符合 "事件管理" 技能
2. 参考 skills/event-management/SKILL.md
3. 显示模式 2（用于清理的 DisposableStore）
4. 突出陷阱 1（忘记清理）
5. 提供工作代码示例
6. 警告常见错误
```

### Claude 针对 x-oasis 的指令

```
帮助使用 x-oasis 包时：

1. 始终先检查 SKILLS_INDEX.md
2. 找到用户问题匹配的技能
3. 读取完整的 SKILL.md 文件
4. 提取相关模式（通常每个技能 8+ 个）
5. 显示有效的代码示例
6. 解释最佳实践和陷阱
7. 如果需要组合多个技能
8. 提供框架特定的示例

不要：
- 在不阅读完整 SKILL.md 的情况下给出不完整的答案
- 忽略常见陷阱部分
- 不加解释地混合模式
- 假设过时的方法
```

## 技能文件格式供代理使用

每个 SKILL.md 遵循可预测的结构：

```
---
name: skill-name
description: 单行描述
---

# 技能名称

## 何时使用此技能
[场景和用例列表]

## 快速入门
[5 分钟工作示例]

## 可用工具
[函数/包表]

## 模式 1：[模式名称]
[说明和代码]

## 模式 2：[模式名称]
[说明和代码]

... (总共 8+ 个模式)

## 最佳实践
[✅ 做法和 ❌ 不要做的部分]

## 常见陷阱
[要避免的错误及示例]

## 集成示例
[React、Vue、Svelte、Node.js 示例]

## 参考
[技术细节链接]
```

代理可以可靠地解析和提取此结构中的信息。

## 构建 x-oasis 技能代理

### 第 1 步：设置技能加载

```typescript
import fs from "fs";
import path from "path";

class SkillsLoader {
  private skillsDir = "./skills";
  private skillsIndex: any = null;
  private skillCache = new Map<string, string>();

  async initialize(): Promise<void> {
    // 加载 SKILLS_INDEX.md
    const indexPath = path.join(this.skillsDir, "SKILLS_INDEX.md");
    const indexContent = fs.readFileSync(indexPath, "utf-8");
    this.skillsIndex = this.parseIndex(indexContent);
  }

  async getSkill(skillName: string): Promise<string> {
    if (this.skillCache.has(skillName)) {
      return this.skillCache.get(skillName)!;
    }

    const skillPath = path.join(this.skillsDir, skillName, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf-8");
    this.skillCache.set(skillName, content);
    return content;
  }

  async findSkillsForProblem(keyword: string): Promise<string[]> {
    // 在 SKILLS_INDEX.md 中搜索匹配的技能
    return this.skillsIndex.findMatches(keyword);
  }

  private parseIndex(content: string): any {
    // 解析索引以提取技能及其描述
    // 返回可搜索的结构
  }
}
```

### 第 2 步：问题到技能的匹配

```typescript
class ProblemMatcher {
  constructor(private loader: SkillsLoader) {}

  async findSkills(problem: string): Promise<Array<{skill: string; match: number}>> {
    const keywords = this.extractKeywords(problem);
    const matches: Map<string, number> = new Map();

    for (const keyword of keywords) {
      const skillNames = await this.loader.findSkillsForProblem(keyword);
      for (const skill of skillNames) {
        matches.set(skill, (matches.get(skill) || 0) + 1);
      }
    }

    return Array.from(matches.entries())
      .map(([skill, score]) => ({ skill, match: score }))
      .sort((a, b) => b.match - a.match);
  }

  private extractKeywords(problem: string): string[] {
    // 从问题描述中提取关键概念
    const keywords = [
      "限流",
      "防抖",
      "内存泄漏",
      "事件",
      "比较",
      "diff",
      "验证",
      // ... 更多关键词
    ];

    return keywords.filter((k) => problem.toLowerCase().includes(k));
  }
}
```

### 第 3 步：解决方案生成

```typescript
class SolutionGenerator {
  constructor(private loader: SkillsLoader) {}

  async generateSolution(skill: string, userContext: string): Promise<string> {
    const skillContent = await this.loader.getSkill(skill);

    // 提取相关部分
    const patterns = this.extractPatterns(skillContent);
    const bestPractices = this.extractBestPractices(skillContent);
    const pitfalls = this.extractPitfalls(skillContent);

    // 找到最佳匹配的模式
    const selectedPattern = this.selectBestPattern(patterns, userContext);

    // 生成响应
    return this.formatResponse({
      skill,
      selectedPattern,
      bestPractices,
      pitfalls,
    });
  }

  private extractPatterns(content: string): Pattern[] {
    // 解析 SKILL.md 以提取所有模式部分
  }

  private selectBestPattern(patterns: Pattern[], context: string): Pattern {
    // 使用上下文选择最相关的模式
  }

  private formatResponse(data: any): string {
    // 格式化供人阅读
  }
}
```

## 代理交互示例

```
用户："我的 React 应用在道具改变时重新渲染过于频繁"

代理流程：
1. 提取关键词：["React"、"重新渲染"、"道具"]
2. 匹配技能：
   - object-comparison（0.95 置信度）
   - request-throttling（0.60 置信度）
3. 读取 object-comparison/SKILL.md
4. 找到模式 1：「浅相等」
5. 生成响应：

响应：
---
这是一个「对象比较」问题。

你需要通过检测道具是否真的改变来防止不必要的重新渲染。

快速解决方案：
import { shallowEqual } from '@x-oasis/shallow-equal';

const MyComponent = memo(
  ({ data }) => <div>{data.name}</div>,
  (prevProps, nextProps) => {
    return shallowEqual(prevProps, nextProps);
  }
);

⚠️ 常见陷阱：
不要假设 shallowEqual 对嵌套对象有效。
如果你的数据有嵌套改变，使用模式 7：
「深相等（手动）」

✅ 最佳实践：
在 React 中为道具比较使用 shallowEqual
以获得最优性能。

查看更多模式：skills/object-comparison/SKILL.md
---
```

## 代理开发者的提示

### 做法

✅ 给出建议前阅读完整的 SKILL.md  
✅ 直接从 SKILL.md 包含代码示例  
✅ 突出相关的陷阱部分  
✅ 为复杂问题建议模式组合  
✅ 指导用户阅读原始 SKILL.md 以获得更多详情  
✅ 在技能演进时更新你的理解  

### 不做法

❌ 临时发挥未在 SKILL.md 中的解决方案  
❌ 提供不完整的模式信息  
❌ 忽略「常见陷阱」部分  
❌ 不加说明地混合模式  
❌ 未阅读 SKILLS_INDEX.md 就假设问题类型  
❌ 推荐未验证的模式  

## 测试你的代理

```typescript
interface TestCase {
  problem: string;
  expectedSkills: string[];
  expectedPatterns: string[];
}

const testCases: TestCase[] = [
  {
    problem: "我的搜索输入发送了太多 API 调用",
    expectedSkills: ["request-throttling"],
    expectedPatterns: ["模式 1：防抖"],
  },
  {
    problem: "我需要为撤销/重做跟踪改变",
    expectedSkills: ["change-detection", "event-management"],
    expectedPatterns: ["模式 7：撤销/重做系统"],
  },
  // ... 更多测试用例
];

async function runTests(agent: Agent): Promise<void> {
  for (const test of testCases) {
    const skills = await agent.findSkills(test.problem);
    const patterns = await agent.extractPatterns(skills);

    console.assert(
      skills.includes(test.expectedSkills[0]),
      `期望 ${test.expectedSkills[0]} 用于：${test.problem}`
    );
  }
}
```

## 代理集成 API

```typescript
interface SkillsAPI {
  // 获取所有技能元数据
  getAllSkills(): Promise<Skill[]>;

  // 获取特定技能内容
  getSkill(name: string): Promise<string>;

  // 查找与关键词匹配的技能
  searchSkills(keywords: string[]): Promise<string[]>;

  // 获取技能模式
  getPatterns(skillName: string): Promise<Pattern[]>;

  // 获取技能最佳实践
  getBestPractices(skillName: string): Promise<string[]>;

  // 获取常见陷阱
  getPitfalls(skillName: string): Promise<Pitfall[]>;

  // 获取集成示例
  getExamples(skillName: string, framework?: string): Promise<Example[]>;
}

// 在代理中使用
const api = new SkillsAPI("./skills");
const skills = await api.searchSkills(["防抖", "api"]);
const pattern = await api.getPatterns("request-throttling");
```

## 结论

x-oasis 技能系统使代理能够：

1. **理解问题** - 将用户问题映射到技能
2. **指导解决方案** - 提供分步模式
3. **防止错误** - 突出常见陷阱
4. **最佳实践** - 分享经过验证的方法
5. **学习** - 从快速入门到高级的渐进式复杂性

通过遵循此架构，代理可以有效利用技能系统来帮助用户解决 x-oasis 包的问题。

更多关于特定技能的详情，见 `skills/SKILLS_INDEX.md`。
