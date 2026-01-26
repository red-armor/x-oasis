/**
 * 测试运行 CodeMirrorChangeAggregator 示例
 *
 * 运行方式：
 * - 如果使用 ts-node: npx ts-node test-code-mirror-aggregator.ts
 * - 如果使用 Node.js + tsx: npx tsx test-code-mirror-aggregator.ts
 */

import { CodeMirrorChangeAggregator } from './CodeMirrorChangeAggregator';

// ==================== 基本使用示例 ====================

async function runBasicExample() {
  console.log('\n========== 基本使用示例 ==========\n');

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
  console.log('✓ 设置基础版本');

  // 3. 方式一：从文本内容记录变更（简化示例）
  const modifiedContent1 = baseContent.replace(
    '<div>',
    '<div className="btn-primary"'
  );
  aggregator.recordChangeFromContent(
    filePath,
    baseContent,
    modifiedContent1,
    'panel'
  );
  console.log('✓ 从文本内容记录变更（方式一）');

  // 4. 方式二：继续从文本内容记录变更
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
  console.log('✓ 从文本内容记录变更');

  // 5. 聚合变更
  const aggregated = aggregator.aggregateChanges();
  console.log('\n--- 聚合结果 ---');

  aggregated.forEach((change) => {
    console.log('\n文件:', change.filePath);
    console.log('摘要:', JSON.stringify(change.summary, null, 2));
    console.log('变更数量:', change.changes.length);
    console.log('描述:');
    console.log(change.description);
  });

  // 6. 清空待处理变更（提交后）
  aggregator.clearPendingChanges();
  console.log('\n✓ 清空待处理变更');
}

// ==================== 批量变更示例 ====================

async function runBatchChangesExample() {
  console.log('\n\n========== 批量变更示例 ==========\n');

  return new Promise<void>((resolve) => {
    const aggregator = new CodeMirrorChangeAggregator();
    const filePath = 'src/App.tsx';

    const baseContent = `export default function App() {
  return <div>Hello</div>;
}`;

    aggregator.setBaseVersion(filePath, baseContent);
    console.log('✓ 设置基础版本');

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
    console.log('✓ 变更 1: 添加 className');

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
      console.log('✓ 变更 2: 添加 style (500ms 后)');
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
      console.log('✓ 变更 3: 修改文本 (1500ms 后)');

      // 聚合变更
      const aggregated = aggregator.aggregateChanges();
      console.log('\n--- 聚合结果 ---');
      console.log(`共 ${aggregated.length} 个文件发生变更`);

      aggregated.forEach((change) => {
        console.log(`\n文件: ${change.filePath}`);
        console.log(`变更组数: ${change.changes.length}`);
        console.log('摘要:', JSON.stringify(change.summary, null, 2));
      });

      // 可以看到前两个变更被合并，第三个变更单独一组
      resolve();
    }, 1500);
  });
}

// ==================== 完整工作流示例 ====================

async function runCompleteWorkflowExample() {
  console.log('\n\n========== 完整工作流示例 ==========\n');

  class CompleteWorkflow {
    private aggregator: CodeMirrorChangeAggregator;
    private files: Map<string, string> = new Map();

    constructor() {
      this.aggregator = new CodeMirrorChangeAggregator({
        aggregationWindow: 2000, // 2秒聚合窗口
      });
    }

    initialize(files: Map<string, string>) {
      files.forEach((content, filePath) => {
        this.files.set(filePath, content);
        this.aggregator.setBaseVersion(filePath, content);
      });
      console.log(`✓ 初始化 ${files.size} 个文件`);
    }

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
      console.log(
        `✓ ${action === 'panel' ? '操作面板' : '编辑器'} 变更: ${filePath}`
      );
    }

    prepareForAI(): Array<{
      filePath: string;
      description: string;
      summary: any;
    }> {
      const aggregated = this.aggregator.aggregateChanges();

      return aggregated.map((change) => ({
        filePath: change.filePath,
        description: change.description,
        summary: change.summary,
      }));
    }

    commit() {
      this.aggregator.clearPendingChanges();
      console.log('✓ 提交变更');
    }
  }

  const workflow = new CompleteWorkflow();

  // 初始化文件
  const files = new Map<string, string>();
  files.set(
    'src/Button.tsx',
    `export const Button = () => {
  return <div>Click me</div>;
};`
  );
  files.set(
    'src/App.tsx',
    `export default function App() {
  return <Button />;
};`
  );

  workflow.initialize(files);

  // 模拟用户操作
  await workflow.handleUserAction('src/Button.tsx', 'panel', (current) => {
    return current.replace('<div>', '<div className="btn">');
  });

  await workflow.handleUserAction('src/Button.tsx', 'editor', (current) => {
    return current.replace('Click me', 'Click me now');
  });

  await workflow.handleUserAction('src/App.tsx', 'panel', (current) => {
    return current.replace('<Button />', '<Button className="primary" />');
  });

  // 准备发送给 AI
  const aiMessages = workflow.prepareForAI();
  console.log('\n--- AI 消息 ---');
  aiMessages.forEach((msg, index) => {
    console.log(`\n消息 ${index + 1}:`);
    console.log(`文件: ${msg.filePath}`);
    console.log(`摘要:`, JSON.stringify(msg.summary, null, 2));
    console.log(`描述长度: ${msg.description.length} 字符`);
  });

  // 提交
  workflow.commit();
}

// ==================== 主函数 ====================

async function main() {
  console.log('========================================');
  console.log('CodeMirrorChangeAggregator 测试运行');
  console.log('========================================');

  try {
    // 运行基本示例
    await runBasicExample();

    // 运行批量变更示例
    await runBatchChangesExample();

    // 运行完整工作流示例
    await runCompleteWorkflowExample();

    console.log('\n\n========================================');
    console.log('所有测试完成！');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误信息:', error.message);
      console.error('堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

export { runBasicExample, runBatchChangesExample, runCompleteWorkflowExample };
