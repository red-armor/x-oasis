import React, { useState, useRef, useEffect } from 'react';
import { FileRestoreManager } from '@x-oasis/diff-match-patch';
import { DiffView } from '@git-diff-view/react';
import { generateDiffFile, DiffFile } from '@git-diff-view/file';
import './index.css';

// 示例文件内容
const ORIGINAL_FILE = `\n<templabe>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
      <HomeIcon class="h-6 w-6 text-indigo-600" /> 欢迎
    </h2>

    <!-- 图片示例：随机占位图 -->
    <img
      src="https://picsum.photos/seed/vebox/400/200"
      alt="示例图片"
      class="rounded-md shadow"
    />

    <!-- Switch 示例 -->
    <div class="flex items-center gap-4">
      <Switch v-model="enabled" class="relative inline-flex h-6 w-11 items-center rounded-full" :class="enabled ? 'bg-indigo-600' : 'bg-gray-300'">
        <span class="sr-only">Enable notifications</span>
        <span :class="enabled ? 'translate-x-6' : 'translate-x-1'" class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
      </Switch>
      <span class="text-sm text-gray-700">通知 {{ enabled ? '开启' : '关闭' }}</span>
    </div>

    <!-- Disclosure 示例 -->
    <Disclosure as="div" class="w-full">
      <DisclosureButton class="flex w-full justify-between rounded-lg bg-indigo-50 px-4 py-2 text-left text-sm font-medium text-indigo-900 hover:bg-indigo-100">
        <span>查看更多介绍</span>
        <ChevronUpIcon class="h-5 w-5" />
      </DisclosureButton>
      <DisclosurePanel class="px-4 pt-4 pb-2 text-sm text-gray-600">
        这是一个使用 <strong>Headless UI</strong> + <strong>Heroicons</strong> 构建的 Vue3 示例。
      </DisclosurePanel>
    </Disclosure>

    <!-- Disabled button 示例，用于测试 click-select 兜底逻辑 -->
    <button class="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed" disabled>禁用按钮</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HomeIcon, ChevronUpIcon } from '@heroicons/vue/24/solid';
import { Switch, Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';

const enabled = ref(true);
</script>`;

const CURRENT_FILE = `\n<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
      <HomeIcon class="h-6 w-6 text-indigo-600" /> 欢迎
    </h2>

    <!-- 图片示例：随机占位图 -->
    <img
      src="https://picsum.photos/seed/vebox/400/200"
      alt="示例图片"
      class="rounded-md shadow"
    />

    <!-- Switch 示例 -->
    <div class="flex items-center gap-4">
      <Switch v-model="enabled" class="relative inline-flex h-6 w-11 items-center rounded-full" :class="enabled ? 'bg-indigo-600' : 'bg-gray-300'">
        <span class="sr-only">Enable notifications</span>
        <span :class="enabled ? 'translate-x-6' : 'translate-x-1'" class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
      </Switch>
      <span class="text-sm text-gray-700">通知 {{ enabled ? '开启' : '关闭' }}</span>
    </div>

    <!-- Disclosure 示例 -->
    <Disclosure as="div" class="w-full">
      <DisclosureButton class="flex w-full justify-between rounded-lg bg-indigo-50 px-4 py-2 text-left text-sm font-medium text-indigo-900 hover:bg-indigo-100">
        <span>查看更多介绍</span>
        <ChevronUpIcon class="h-5 w-5" />
      </DisclosureButton>
      <DisclosurePanel class="px-4 pt-4 pb-2 text-sm text-gray-600">
        这是一个使用 <strong>Headless UI</strong> + <strong>Heroicons</strong> 构建的 Vue3 示例。
      </DisclosurePanel>
    </Disclosure>

    <!-- Disabled button 示例，用于测试 click-select 兜底逻辑 -->
    <button class="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed" disabled>禁用</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HomeIcon, ChevronUpIcon } from '@heroicons/vue/24/solid';
import { Switch, Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';

const enabled = ref(true);
</script>`;

const App: React.FC = () => {
  const [originalContent, setOriginalContent] = useState(ORIGINAL_FILE);
  const [currentContent, setCurrentContent] = useState(CURRENT_FILE);
  const [startOffset, setStartOffset] = useState<number>(1512);
  const [endOffset, setEndOffset] = useState<number>(1514);
  const [restoredContent, setRestoredContent] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const originalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const currentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [diffFile, setDiffFile] = useState<DiffFile | null>(null);

  // 使用 @git-diff-view/file 生成 diff 文件
  useEffect(() => {
    if (originalContent === currentContent) {
      setDiffFile(null);
      return;
    }

    try {
      const file = generateDiffFile(
        'code.vue',
        originalContent,
        'codev2.vue',
        currentContent,
        'vue',
        'vue'
      );
      file.init();
      file.buildSplitDiffLines();
      setDiffFile(file);
    } catch (error) {
      console.error('Error generating diff file:', error);
      setDiffFile(null);
    }
  }, [originalContent, currentContent]);

  const handleRestore = () => {
    try {
      const manager = new FileRestoreManager(originalContent);
      const debug = manager.debugRestoreRange(currentContent, {
        startOffset,
        endOffset,
      });
      setDebugInfo(debug);

      const restored = manager.restoreRange(currentContent, {
        startOffset,
        endOffset,
      });
      setRestoredContent(restored);
    } catch (error: any) {
      alert(`错误: ${error.message}`);
    }
  };

  const handleExampleClick = (start: number, end: number) => {
    setStartOffset(start);
    setEndOffset(end);
  };

  return (
    <div className="container">
      <h1>Diff Match Patch - Restore Range Example</h1>
      <p className="subtitle">
        将最新文件中指定 offset range 的内容恢复到原始版本
      </p>

      <div className="info-box">
        <strong>使用说明：</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
          <li>左侧显示原始文件内容，右侧显示修改后的文件内容</li>
          <li>绿色背景表示新增内容，红色背景表示删除内容</li>
          <li>输入 startOffset 和 endOffset，点击"恢复"按钮执行恢复操作</li>
          <li>可以使用下方的快速示例按钮快速测试</li>
        </ul>
      </div>

      <div className="section">
        <div className="section-title">文件对比</div>

        {/* 使用 @git-diff-view/react 显示差异 */}
        <div
          className="diff-container"
          style={{
            marginBottom: '20px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {diffFile ? (
            <DiffView diffFile={diffFile} />
          ) : originalContent === currentContent ? (
            <div
              style={{ padding: '20px', textAlign: 'center', color: '#666' }}
            >
              没有差异（两个文件内容相同）
            </div>
          ) : (
            <div
              style={{ padding: '20px', textAlign: 'center', color: '#666' }}
            >
              正在生成差异...
            </div>
          )}
        </div>

        {/* 可编辑的文件内容区域 */}
        <div className="file-comparison">
          <div className="file-panel">
            <div className="file-header">原始文件 (code.vue) - 可编辑</div>
            <textarea
              ref={originalTextareaRef}
              className="file-content"
              value={originalContent}
              onChange={(e) => setOriginalContent(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="file-panel">
            <div className="file-header">
              修改后的文件 (codev2.vue) - 可编辑
            </div>
            <textarea
              ref={currentTextareaRef}
              className="file-content"
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">恢复操作</div>
        <div className="controls">
          <div className="control-group">
            <label>Start Offset</label>
            <input
              type="number"
              value={startOffset}
              onChange={(e) => setStartOffset(Number(e.target.value))}
              min="0"
            />
          </div>
          <div className="control-group">
            <label>End Offset</label>
            <input
              type="number"
              value={endOffset}
              onChange={(e) => setEndOffset(Number(e.target.value))}
              min="0"
            />
          </div>
          <button onClick={handleRestore}>恢复</button>
        </div>

        <div className="example-offsets">
          <span
            style={{ fontSize: '12px', color: '#666', marginRight: '10px' }}
          >
            快速示例：
          </span>
          <button
            className="example-btn"
            onClick={() => handleExampleClick(1512, 1514)}
          >
            恢复 "禁用" → "禁用按钮" (1512-1514)
          </button>
          <button
            className="example-btn"
            onClick={() => handleExampleClick(1416, 1512)}
          >
            恢复整个按钮区域 (1416-1512)
          </button>
        </div>

        {debugInfo && (
          <div className="offset-info" style={{ marginTop: '15px' }}>
            <strong>调试信息：</strong>
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <div>
                当前范围: {debugInfo.currentRange.start} -{' '}
                {debugInfo.currentRange.end}
              </div>
              <div>
                原始范围映射: {debugInfo.originalRange.start} -{' '}
                {debugInfo.originalRange.end}
              </div>
              <div>
                当前内容:{' '}
                <code>{JSON.stringify(debugInfo.currentContent)}</code>
              </div>
              <div>
                原始内容:{' '}
                <code>{JSON.stringify(debugInfo.originalContent)}</code>
              </div>
              <div>内容将改变: {debugInfo.willChange ? '是' : '否'}</div>
            </div>
          </div>
        )}
      </div>

      {restoredContent && (
        <div className="result-panel">
          <div className="result-title">恢复后的文件内容</div>
          <div className="result-content">{restoredContent}</div>
        </div>
      )}
    </div>
  );
};

export default App;
