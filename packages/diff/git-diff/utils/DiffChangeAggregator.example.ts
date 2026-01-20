/**
 * DiffChangeAggregator 使用示例
 *
 * 展示如何使用 Diff 方案来聚合变更
 *
 * 注意：使用前需要安装 diff 库
 * npm install diff
 * npm install @types/diff --save-dev
 */

// 注意：实际使用时需要取消注释
// import { diffLines, createPatch } from 'diff';
import { DiffChangeAggregator } from './DiffChangeAggregator';

// ==================== 基本使用 ====================

async function basicExample() {
  // 1. 创建聚合器实例
  const aggregator = new DiffChangeAggregator();

  // 2. 设置基础版本
  const filePath = 'src/Button.tsx';
  const baseContent = `export const Button = () => {
  return <div>Click me</div>;
};`;

  aggregator.setBaseVersion(filePath, baseContent);

  // 3. 记录变更
  const newContent = `export const Button = () => {
  return <div className="btn-primary">Click me</div>;
};`;

  aggregator.recordChange(filePath, newContent, 'panel');

  // 4. 聚合变更
  const aggregated = aggregator.aggregateChanges();

  aggregated.forEach((change) => {
    console.log('文件:', change.filePath);
    console.log('摘要:', change.summary);
    console.log('Unified Diff:');
    console.log(change.unifiedDiff);
    console.log('描述:', change.description);
  });

  // 5. 清空待处理变更（提交后）
  aggregator.clearPendingChanges();
}

// ==================== 与编辑器集成 ====================

class EditorIntegrationExample {
  private aggregator: DiffChangeAggregator;
  private files: Map<string, string> = new Map();

  constructor() {
    this.aggregator = new DiffChangeAggregator();
  }

  /**
   * 初始化文件
   */
  initializeFile(filePath: string, content: string) {
    this.files.set(filePath, content);
    this.aggregator.setBaseVersion(filePath, content);
  }

  /**
   * 处理编辑器变更
   */
  onEditorChange(filePath: string, newContent: string) {
    this.files.set(filePath, newContent);
    this.aggregator.recordChange(filePath, newContent, 'editor');
  }

  /**
   * 获取聚合后的变更
   */
  getAggregatedChanges() {
    return this.aggregator.aggregateChanges();
  }

  /**
   * 提交变更
   */
  commit() {
    this.aggregator.clearPendingChanges();
  }
}

// ==================== 与操作面板集成 ====================

class PanelIntegrationExample {
  private aggregator: DiffChangeAggregator;
  private currentFiles: Map<string, string> = new Map();

  constructor() {
    this.aggregator = new DiffChangeAggregator();
  }

  /**
   * 初始化文件
   */
  initializeFile(filePath: string, content: string) {
    this.currentFiles.set(filePath, content);
    this.aggregator.setBaseVersion(filePath, content);
  }

  /**
   * 从操作面板应用变更
   */
  async applyPanelChange(
    filePath: string,
    position: { line: number; column: number },
    updates: { className?: string; style?: Record<string, string> }
  ) {
    const currentContent = this.currentFiles.get(filePath) || '';

    // 使用 sourceCodeModifier 应用变更
    const { modifySourceCode } = await import('./sourceCodeModifier');
    const result = modifySourceCode(
      currentContent,
      position,
      updates,
      filePath
    );

    if (result.success && result.newText) {
      // 记录变更
      this.aggregator.recordChange(filePath, result.newText, 'panel');

      // 更新当前内容
      this.currentFiles.set(filePath, result.newText);
    }

    return result;
  }

  /**
   * 获取 Unified Diff 格式的变更
   */
  getUnifiedDiffs() {
    const aggregated = this.aggregator.aggregateChanges();
    return aggregated.map((change) => ({
      filePath: change.filePath,
      unifiedDiff: change.unifiedDiff,
      description: change.description,
    }));
  }
}

// ==================== 批量变更示例 ====================

async function batchChangesExample() {
  const aggregator = new DiffChangeAggregator();
  const filePath = 'src/App.tsx';

  const baseContent = `export default function App() {
  return <div>Hello</div>;
}`;

  aggregator.setBaseVersion(filePath, baseContent);

  // 模拟多次变更
  let currentContent = baseContent;

  // 变更 1: 添加 className
  currentContent = `export default function App() {
  return <div className="container">Hello</div>;
}`;
  aggregator.recordChange(filePath, currentContent, 'panel');

  // 变更 2: 添加 style
  currentContent = `export default function App() {
  return <div className="container" style={{padding: "10px"}}>Hello</div>;
}`;
  aggregator.recordChange(filePath, currentContent, 'panel');

  // 变更 3: 修改文本
  currentContent = `export default function App() {
  return <div className="container" style={{padding: "10px"}}>Hello World</div>;
}`;
  aggregator.recordChange(filePath, currentContent, 'editor');

  // 聚合变更（会计算从基础版本到最终版本的差异）
  const aggregated = aggregator.aggregateChanges();

  console.log('聚合后的变更:', aggregated);
  // 注意：Diff 方案会计算整体差异，而不是分别计算每次变更
}

// ==================== 生成 AI 消息示例 ====================

function generateAIMessageExample() {
  const aggregator = new DiffChangeAggregator();

  // ... 记录变更 ...

  const aggregated = aggregator.aggregateChanges();

  // 生成 AI 友好的消息（使用 Unified Diff 格式）
  const messages = aggregated.map((change) => {
    return {
      role: 'user',
      content: `# 源码变更通知\n\n文件: ${change.filePath}\n\n\`\`\`diff\n${change.unifiedDiff}\n\`\`\`\n\n${change.description}`,
    };
  });

  // 发送给 AI
  // sendToAI(messages);
}

// ==================== 比较两个版本 ====================

function compareVersionsExample() {
  const aggregator = new DiffChangeAggregator();
  const filePath = 'src/Component.tsx';

  const version1 = `export const Component = () => {
  return <div>Version 1</div>;
};`;

  const version2 = `export const Component = () => {
  return (
    <div className="new">
      <span>Version 2</span>
    </div>
  );
};`;

  // 设置基础版本
  aggregator.setBaseVersion(filePath, version1);

  // 记录新版本
  aggregator.recordChange(filePath, version2, 'editor');

  // 获取差异
  const aggregated = aggregator.aggregateChanges();

  if (aggregated.length > 0) {
    const change = aggregated[0];
    console.log('Unified Diff:');
    console.log(change.unifiedDiff);
    console.log('变更摘要:', change.summary);
  }
}

// ==================== 处理新文件 ====================

function newFileExample() {
  const aggregator = new DiffChangeAggregator();
  const filePath = 'src/NewComponent.tsx';

  const newFileContent = `export const NewComponent = () => {
  return <div>New Component</div>;
};`;

  // 设置基础版本为空（新文件）
  aggregator.setBaseVersion(filePath, '');

  // 记录新文件内容
  aggregator.recordChange(filePath, newFileContent, 'editor');

  // 获取变更
  const aggregated = aggregator.aggregateChanges();

  if (aggregated.length > 0) {
    const change = aggregated[0];
    console.log('新文件变更:', change);
    // summary.totalAdditions 会显示新增的行数
  }
}

// ==================== 完整工作流示例 ====================

class CompleteWorkflowExample {
  private aggregator: DiffChangeAggregator;
  private files: Map<string, string> = new Map();

  constructor() {
    this.aggregator = new DiffChangeAggregator();
  }

  /**
   * 初始化工作流
   */
  initialize(files: Map<string, string>) {
    files.forEach((content, filePath) => {
      this.files.set(filePath, content);
      this.aggregator.setBaseVersion(filePath, content);
    });
  }

  /**
   * 处理用户操作
   */
  async handleUserAction(
    filePath: string,
    action: 'panel' | 'editor',
    change: (current: string) => string
  ) {
    const currentContent = this.files.get(filePath);
    if (!currentContent) {
      throw new Error(`File ${filePath} not found`);
    }

    const newContent = change(currentContent);

    // 记录变更
    this.aggregator.recordChange(filePath, newContent, action);

    // 更新文件
    this.files.set(filePath, newContent);
  }

  /**
   * 准备发送给 AI（使用 Unified Diff 格式）
   */
  prepareForAI(): Array<{
    filePath: string;
    unifiedDiff: string;
    description: string;
  }> {
    const aggregated = this.aggregator.aggregateChanges();

    return aggregated.map((change) => ({
      filePath: change.filePath,
      unifiedDiff: change.unifiedDiff,
      description: change.description,
      summary: change.summary,
    }));
  }

  /**
   * 提交后清理
   */
  commit() {
    this.aggregator.clearPendingChanges();
  }

  /**
   * 获取当前所有文件的变更（用于调试）
   */
  getCurrentChanges() {
    return this.aggregator.aggregateChanges();
  }
}

// ==================== 使用真实 diff 库的示例 ====================

/**
 * 注意：这个示例展示了如何使用真实的 diff 库
 * 需要安装: npm install diff @types/diff
 */
async function useRealDiffLibrary() {
  // 取消注释以使用真实的 diff 库
  /*
  import { diffLines, createPatch } from 'diff';

  const oldContent = 'line1\nline2\nline3';
  const newContent = 'line1\nline2-modified\nline3\nline4';

  // 行级别差异
  const lineDiff = diffLines(oldContent, newContent);
  console.log('Line diff:', lineDiff);

  // 生成 Unified Diff
  const patch = createPatch('file.txt', oldContent, newContent);
  console.log('Unified diff:', patch);
  */

  console.log('请安装 diff 库后取消注释上面的代码');
}

export {
  basicExample,
  EditorIntegrationExample,
  PanelIntegrationExample,
  batchChangesExample,
  generateAIMessageExample,
  compareVersionsExample,
  newFileExample,
  CompleteWorkflowExample,
  useRealDiffLibrary,
};
