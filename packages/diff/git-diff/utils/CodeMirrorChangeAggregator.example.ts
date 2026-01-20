/**
 * CodeMirrorChangeAggregator 使用示例
 *
 * 展示如何使用 CodeMirror 原生方案来聚合变更
 */

import { CodeMirrorChangeAggregator } from './CodeMirrorChangeAggregator';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// ==================== 基本使用 ====================

async function basicExample() {
  // 1. 创建聚合器实例
  const aggregator = new CodeMirrorChangeAggregator({
    aggregationWindow: 1000, // 1秒内的变更自动合并
  });

  // 2. 设置基础版本
  const filePath = 'src/Button.tsx';
  const baseContent = `
export const Button = () => {
  return <div>Click me</div>;
};
`;
  aggregator.setBaseVersion(filePath, baseContent);

  // 3. 方式一：从 CodeMirror Transaction 记录变更
  const state = EditorState.create({ doc: baseContent });
  const transaction = state.update({
    changes: {
      from: 30,
      to: 30,
      insert: ' className="btn-primary"',
    },
  }).transaction;

  aggregator.recordChangeFromTransaction(filePath, transaction, 'panel');

  // 4. 方式二：从文本内容记录变更
  const newContent = `
export const Button = () => {
  return <div className="btn-primary">Click me</div>;
};
`;
  aggregator.recordChangeFromContent(
    filePath,
    baseContent,
    newContent,
    'editor'
  );

  // 5. 聚合变更
  const aggregated = aggregator.aggregateChanges();

  aggregated.forEach((change) => {
    console.log('文件:', change.filePath);
    console.log('摘要:', change.summary);
    console.log('描述:', change.description);
    console.log('变更数量:', change.changes.length);
  });

  // 6. 清空待处理变更（提交后）
  aggregator.clearPendingChanges();
}

// ==================== 与 EditorView 集成 ====================

function editorViewIntegrationExample() {
  const aggregator = new CodeMirrorChangeAggregator();

  // 假设有一个 EditorView 实例
  const editorView: EditorView | null = null;

  // 初始化
  function initializeEditor(content: string, filePath: string) {
    aggregator.setBaseVersion(filePath, content);

    // 创建 EditorView（示例）
    // editorView = new EditorView({
    //   state: EditorState.create({ doc: content }),
    //   dispatch: (tr) => {
    //     // 记录变更
    //     aggregator.recordChangeFromTransaction(filePath, tr, 'editor');
    //   }
    // });
  }

  // 监听变更
  function onEditorChange(newContent: string, filePath: string) {
    const currentContent = aggregator.getCurrentContent(filePath) || '';
    aggregator.recordChangeFromContent(
      filePath,
      currentContent,
      newContent,
      'editor'
    );
  }
}

// ==================== 与操作面板集成 ====================

class PanelIntegrationExample {
  private aggregator: CodeMirrorChangeAggregator;
  private currentFiles: Map<string, string> = new Map();

  constructor() {
    this.aggregator = new CodeMirrorChangeAggregator();
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
      this.aggregator.recordChangeFromContent(
        filePath,
        currentContent,
        result.newText,
        'panel'
      );

      // 更新当前内容
      this.currentFiles.set(filePath, result.newText);
    }

    return result;
  }

  /**
   * 获取聚合后的变更（用于发送给 AI）
   */
  getAggregatedChanges() {
    return this.aggregator.aggregateChanges();
  }

  /**
   * 提交变更（清空待处理变更）
   */
  commitChanges() {
    this.aggregator.clearPendingChanges();
  }
}

// ==================== 批量变更示例 ====================

async function batchChangesExample() {
  const aggregator = new CodeMirrorChangeAggregator();
  const filePath = 'src/App.tsx';

  const baseContent = `export default function App() {
  return <div>Hello</div>;
}`;

  aggregator.setBaseVersion(filePath, baseContent);

  // 模拟多次快速变更
  let currentContent = baseContent;

  // 变更 1: 添加 className
  currentContent = currentContent.replace(
    '<div>',
    '<div className="container">'
  );
  aggregator.recordChangeFromContent(
    filePath,
    baseContent,
    currentContent,
    'panel'
  );

  // 变更 2: 添加 style（1秒内，会被聚合）
  setTimeout(() => {
    const newContent = currentContent.replace(
      'className="container"',
      'className="container" style={{padding: "10px"}}'
    );
    aggregator.recordChangeFromContent(
      filePath,
      currentContent,
      newContent,
      'panel'
    );
    currentContent = newContent;
  }, 500);

  // 变更 3: 修改文本（1秒后，会单独聚合）
  setTimeout(() => {
    const newContent = currentContent.replace('Hello', 'Hello World');
    aggregator.recordChangeFromContent(
      filePath,
      currentContent,
      newContent,
      'editor'
    );

    // 聚合变更
    const aggregated = aggregator.aggregateChanges();
    console.log('聚合后的变更:', aggregated);

    // 可以看到前两个变更被合并，第三个变更单独一组
  }, 1500);
}

// ==================== 生成 AI 消息示例 ====================

function generateAIMessageExample() {
  const aggregator = new CodeMirrorChangeAggregator();

  // ... 记录变更 ...

  const aggregated = aggregator.aggregateChanges();

  // 生成 AI 友好的消息
  const messages = aggregated.map((change) => {
    return {
      role: 'user',
      content: `# 源码变更通知\n\n${change.description}`,
    };
  });

  // 发送给 AI
  // sendToAI(messages);
}

// ==================== 错误处理示例 ====================

function errorHandlingExample() {
  const aggregator = new CodeMirrorChangeAggregator();

  try {
    // 尝试记录不存在的文件变更
    aggregator.recordChangeFromContent(
      'non-existent.tsx',
      'old',
      'new',
      'editor'
    );
  } catch (error) {
    console.warn('变更记录失败:', error);
  }

  // 获取当前内容（可能为 undefined）
  const content = aggregator.getCurrentContent('some-file.tsx');
  if (!content) {
    console.warn('文件不存在或未初始化');
  }
}

// ==================== 完整工作流示例 ====================

class CompleteWorkflowExample {
  private aggregator: CodeMirrorChangeAggregator;
  private files: Map<string, string> = new Map();

  constructor() {
    this.aggregator = new CodeMirrorChangeAggregator({
      aggregationWindow: 2000, // 2秒聚合窗口
    });
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
    this.aggregator.recordChangeFromContent(
      filePath,
      currentContent,
      newContent,
      action
    );

    // 更新文件
    this.files.set(filePath, newContent);
  }

  /**
   * 提交变更（准备发送给 AI）
   */
  prepareForAI(): Array<{ filePath: string; description: string }> {
    const aggregated = this.aggregator.aggregateChanges();

    return aggregated.map((change) => ({
      filePath: change.filePath,
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
}

export {
  basicExample,
  editorViewIntegrationExample,
  PanelIntegrationExample,
  batchChangesExample,
  generateAIMessageExample,
  errorHandlingExample,
  CompleteWorkflowExample,
};
