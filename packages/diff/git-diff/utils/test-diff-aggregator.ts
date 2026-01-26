/**
 * 测试运行 DiffChangeAggregator 示例
 *
 * 运行方式：
 * - npx tsx test-diff-aggregator.ts
 */

import { DiffChangeAggregator } from './DiffChangeAggregator';

// ==================== 基本使用示例 ====================

async function runBasicExample() {
  console.log('\n========== 基本使用示例 ==========\n');

  // 1. 创建聚合器实例
  const aggregator = new DiffChangeAggregator();

  // 2. 设置基础版本
  const filePath = 'src/Button.tsx';
  const baseContent = `export const Button = () => {
  return <div>Click me</div>;
};`;

  aggregator.setBaseVersion(filePath, baseContent);
  console.log('✓ 设置基础版本');

  // 3. 记录变更
  const newContent = `export const Button = () => {
  return <div className="btn-primary">Click me</div>;
};`;

  aggregator.recordChange(filePath, newContent, 'panel');
  console.log('✓ 记录变更');

  // 4. 聚合变更
  const aggregated = aggregator.aggregateChanges();
  console.log('\n--- 聚合结果 ---');

  aggregated.forEach((change) => {
    console.log('\n文件:', change.filePath);
    console.log('摘要:', JSON.stringify(change.summary, null, 2));
    console.log('\nUnified Diff:');
    console.log(change.unifiedDiff);
    console.log('\n描述:');
    console.log(change.description);
  });

  // 5. 清空待处理变更（提交后）
  aggregator.clearPendingChanges();
  console.log('\n✓ 清空待处理变更');
}

// ==================== 批量变更示例 ====================

async function runBatchChangesExample() {
  console.log('\n\n========== 批量变更示例 ==========\n');

  const aggregator = new DiffChangeAggregator();
  const filePath = 'src/App.tsx';

  const baseContent = `export default function App() {
  return <div>Hello</div>;
}`;

  aggregator.setBaseVersion(filePath, baseContent);
  console.log('✓ 设置基础版本');

  // 模拟多次变更
  let currentContent = baseContent;

  // 变更 1: 添加 className
  currentContent = `export default function App() {
  return <div className="container">Hello</div>;
}`;
  aggregator.recordChange(filePath, currentContent, 'panel');
  console.log('✓ 变更 1: 添加 className');

  // 变更 2: 添加 style
  currentContent = `export default function App() {
  return <div className="container" style={{padding: "10px"}}>Hello</div>;
}`;
  aggregator.recordChange(filePath, currentContent, 'panel');
  console.log('✓ 变更 2: 添加 style');

  // 变更 3: 修改文本
  currentContent = `export default function App() {
  return <div className="container" style={{padding: "10px"}}>Hello World</div>;
}`;
  aggregator.recordChange(filePath, currentContent, 'editor');
  console.log('✓ 变更 3: 修改文本');

  // 聚合变更（会计算从基础版本到最终版本的差异）
  const aggregated = aggregator.aggregateChanges();
  console.log('\n--- 聚合结果 ---');
  console.log(`共 ${aggregated.length} 个文件发生变更`);

  aggregated.forEach((change) => {
    console.log(`\n文件: ${change.filePath}`);
    console.log('摘要:', JSON.stringify(change.summary, null, 2));
    console.log('\nUnified Diff:');
    console.log(change.unifiedDiff);
  });

  // 注意：Diff 方案会计算整体差异，而不是分别计算每次变更
  console.log('\n注意：Diff 方案计算的是从基础版本到最终版本的整体差异');
}

// ==================== 版本比较示例 ====================

async function runCompareVersionsExample() {
  console.log('\n\n========== 版本比较示例 ==========\n');

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
  console.log('✓ 设置基础版本 (Version 1)');

  // 记录新版本
  aggregator.recordChange(filePath, version2, 'editor');
  console.log('✓ 记录新版本 (Version 2)');

  // 获取差异
  const aggregated = aggregator.aggregateChanges();

  if (aggregated.length > 0) {
    const change = aggregated[0];
    console.log('\n--- 差异结果 ---');
    console.log('\nUnified Diff:');
    console.log(change.unifiedDiff);
    console.log('\n变更摘要:', JSON.stringify(change.summary, null, 2));
    console.log('\n描述:');
    console.log(change.description);
  }
}

// ==================== 新文件示例 ====================

async function runNewFileExample() {
  console.log('\n\n========== 新文件示例 ==========\n');

  const aggregator = new DiffChangeAggregator();
  const filePath = 'src/NewComponent.tsx';

  const newFileContent = `export const NewComponent = () => {
  return <div>New Component</div>;
};`;

  // 设置基础版本为空（新文件）
  aggregator.setBaseVersion(filePath, '');
  console.log('✓ 设置基础版本（空文件）');

  // 记录新文件内容
  aggregator.recordChange(filePath, newFileContent, 'editor');
  console.log('✓ 记录新文件内容');

  // 获取变更
  const aggregated = aggregator.aggregateChanges();

  if (aggregated.length > 0) {
    const change = aggregated[0];
    console.log('\n--- 新文件变更 ---');
    console.log('摘要:', JSON.stringify(change.summary, null, 2));
    console.log('新增行数:', change.summary.totalAdditions);
    console.log('\nUnified Diff:');
    console.log(change.unifiedDiff);
  }
}

// ==================== 完整工作流示例 ====================

async function runCompleteWorkflowExample() {
  console.log('\n\n========== 完整工作流示例 ==========\n');

  class CompleteWorkflow {
    private aggregator: DiffChangeAggregator;
    private files: Map<string, string> = new Map();

    constructor() {
      this.aggregator = new DiffChangeAggregator();
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
      this.aggregator.recordChange(filePath, newContent, action);

      // 更新文件
      this.files.set(filePath, newContent);
      console.log(
        `✓ ${action === 'panel' ? '操作面板' : '编辑器'} 变更: ${filePath}`
      );
    }

    prepareForAI(): Array<{
      filePath: string;
      unifiedDiff: string;
      description: string;
      summary: any;
    }> {
      const aggregated = this.aggregator.aggregateChanges();

      return aggregated.map((change) => ({
        filePath: change.filePath,
        unifiedDiff: change.unifiedDiff,
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

  // 准备发送给 AI（使用 Unified Diff 格式）
  const aiMessages = workflow.prepareForAI();
  console.log('\n--- AI 消息 ---');
  aiMessages.forEach((msg, index) => {
    console.log(`\n消息 ${index + 1}:`);
    console.log(`文件: ${msg.filePath}`);
    console.log(`摘要:`, JSON.stringify(msg.summary, null, 2));
    console.log(`Unified Diff 长度: ${msg.unifiedDiff.length} 字符`);
    console.log(`描述长度: ${msg.description.length} 字符`);
    console.log('\nUnified Diff 预览（前200字符）:');
    console.log(`${msg.unifiedDiff.substring(0, 200)}...`);
  });

  // 提交
  workflow.commit();
}

// ==================== 主函数 ====================

async function main() {
  console.log('========================================');
  console.log('DiffChangeAggregator 测试运行');
  console.log('========================================');

  try {
    // 运行基本示例
    await runBasicExample();

    // 运行批量变更示例
    await runBatchChangesExample();

    // 运行版本比较示例
    await runCompareVersionsExample();

    // 运行新文件示例
    await runNewFileExample();

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

export {
  runBasicExample,
  runBatchChangesExample,
  runCompareVersionsExample,
  runNewFileExample,
  runCompleteWorkflowExample,
};
