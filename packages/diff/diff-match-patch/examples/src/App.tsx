import React, { useState, useRef, useEffect } from 'react';
import { FileRestoreManager } from '@x-oasis/diff-match-patch';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import { generateDiffFile, DiffFile } from '@git-diff-view/file';
import '@git-diff-view/react/styles/diff-view.css';
import './index.css';

// 默认空内容，由用户填写
const ORIGINAL_FILE = '';
const CURRENT_FILE = '';

const App: React.FC = () => {
  const [originalContent, setOriginalContent] = useState(ORIGINAL_FILE);
  const [currentContent, setCurrentContent] = useState(CURRENT_FILE);
  const [startOffset, setStartOffset] = useState<number>(0);
  const [endOffset, setEndOffset] = useState<number>(0);
  const [restoredContent, setRestoredContent] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const originalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const currentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [diffFile, setDiffFile] = useState<DiffFile | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<DiffModeEnum>(
    DiffModeEnum.Split
  );

  // 使用 file diff mode
  useEffect(() => {
    // 确保内容不为空且是字符串类型
    const oldContent =
      typeof originalContent === 'string'
        ? originalContent
        : String(originalContent || '');
    const newContent =
      typeof currentContent === 'string'
        ? currentContent
        : String(currentContent || '');

    if (oldContent === newContent) {
      setDiffFile(null);
      return;
    }

    // 验证内容不为空
    if (!oldContent && !newContent) {
      setDiffFile(null);
      return;
    }

    try {
      console.log('Generating diff file with:', {
        oldContentLength: oldContent.length,
        newContentLength: newContent.length,
        oldContentType: typeof oldContent,
        newContentType: typeof newContent,
      });

      const file = generateDiffFile(
        'code.vue',
        oldContent,
        'codev2.vue',
        newContent,
        'vue',
        'vue'
      );

      // 初始化并构建 diff lines
      file.init();
      file.buildSplitDiffLines();
      file.buildUnifiedDiffLines();

      // 确保所有 hunks 都展开
      file.onAllExpand();

      console.log('DiffFile generated:', file);
      console.log('Hunks:', file.hunks);
      console.log('Unified diff lines:', file.unifiedDiffLines?.length);
      console.log('Split diff lines:', file.splitDiffLines?.length);

      setDiffFile(file);
    } catch (error) {
      console.error('Error generating diff file:', error);
      console.error('Error details:', {
        oldContent: oldContent?.substring(0, 100),
        newContent: newContent?.substring(0, 100),
        oldContentType: typeof oldContent,
        newContentType: typeof newContent,
      });
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
        <div
          className="section-title"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>文件对比</span>
          {diffFile && (
            <div style={{ display: 'flex', gap: '10px', fontSize: '14px' }}>
              <button
                onClick={() => setDiffViewMode(DiffModeEnum.Split)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background:
                    diffViewMode === DiffModeEnum.Split ? '#0366d6' : '#fff',
                  color: diffViewMode === DiffModeEnum.Split ? '#fff' : '#333',
                  cursor: 'pointer',
                }}
              >
                并排视图
              </button>
              <button
                onClick={() => setDiffViewMode(DiffModeEnum.Unified)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background:
                    diffViewMode === DiffModeEnum.Unified ? '#0366d6' : '#fff',
                  color:
                    diffViewMode === DiffModeEnum.Unified ? '#fff' : '#333',
                  cursor: 'pointer',
                }}
              >
                统一视图
              </button>
            </div>
          )}
        </div>

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
            <DiffView
              diffFile={diffFile}
              diffViewMode={diffViewMode}
              diffViewHighlight={true}
            />
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
