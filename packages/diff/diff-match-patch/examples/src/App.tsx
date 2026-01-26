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
  const diffContainerRef = useRef<HTMLDivElement>(null);
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

  // 切换原始文件和修改后的文件内容
  const handleSwapFiles = () => {
    const temp = originalContent;
    setOriginalContent(currentContent);
    setCurrentContent(temp);
    // 重置 offset 和恢复结果
    setStartOffset(0);
    setEndOffset(0);
    setRestoredContent('');
    setDebugInfo(null);
  };

  // 计算指定行号在新文件中的offset范围
  const getOffsetRangeFromLineNumber = (
    lineNumber: number
  ): { start: number; end: number } | null => {
    if (!currentContent || lineNumber < 1) return null;

    const lines = currentContent.split('\n');
    if (lineNumber > lines.length) return null;

    // 计算该行之前所有字符的offset
    let startOffset = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      startOffset += lines[i].length + 1; // +1 for newline
    }

    // 该行的结束offset
    const endOffset = startOffset + lines[lineNumber - 1].length;

    return { start: startOffset, end: endOffset };
  };

  // 检查元素是否在修改的行内（通过CSS变量判断）
  const isModifiedLine = (element: HTMLElement): boolean => {
    let current: HTMLElement | null = element;
    while (current && current !== diffContainerRef.current) {
      // 检查内联样式
      const styleAttr = current.getAttribute('style') || '';

      // 如果使用了 --diff-plain-content--，说明是未更改的行，返回 false
      if (styleAttr.includes('--diff-plain-content--')) {
        return false;
      }

      // 如果使用了以下任一变量，说明是修改的行（新增、删除、修改）
      if (
        styleAttr.includes('--diff-add-content--') ||
        styleAttr.includes('--diff-delete-content--') ||
        styleAttr.includes('--diff-modify-content--')
      ) {
        return true;
      }

      // 检查元素的类名，然后查找对应的CSS规则
      const className = current.className;
      if (className && typeof className === 'string') {
        const classes = className.split(/\s+/);
        for (const cls of classes) {
          if (!cls) continue;

          // 检查样式表中是否有这个类的规则使用了相关CSS变量
          try {
            for (let i = 0; i < document.styleSheets.length; i++) {
              const sheet = document.styleSheets[i];
              if (!sheet.cssRules) continue;

              for (let j = 0; j < sheet.cssRules.length; j++) {
                const rule = sheet.cssRules[j] as CSSStyleRule;
                if (
                  rule.selectorText &&
                  rule.selectorText.includes(`.${cls}`)
                ) {
                  const bgColor =
                    rule.style.getPropertyValue('background-color');
                  // 检查是否是修改的行
                  if (
                    bgColor &&
                    (bgColor.includes('var(--diff-add-content--') ||
                      bgColor.includes('var(--diff-delete-content--') ||
                      bgColor.includes('var(--diff-modify-content--'))
                  ) {
                    return true;
                  }
                  // 检查是否是未更改的行
                  if (
                    bgColor &&
                    bgColor.includes('var(--diff-plain-content--')
                  ) {
                    return false;
                  }
                }
              }
            }
          } catch (e) {
            // 跨域样式表可能无法访问，忽略错误
          }
        }
      }

      // 向上查找父元素
      current = current.parentElement;
    }

    // 默认返回 false（未更改的行）
    return false;
  };

  // 从元素中提取新文件的行号
  const extractNewLineNumber = (element: HTMLElement): number | null => {
    let current: HTMLElement | null = element;

    // 先尝试从当前元素及其所有父元素中查找
    while (current && current !== diffContainerRef.current) {
      // 检查各种可能的行号属性
      const lineNum =
        current.getAttribute('data-line-number') ||
        current.getAttribute('data-new-line-number') ||
        current.getAttribute('data-new-line') ||
        current.getAttribute('data-line') ||
        (current as any).dataset?.newLineNumber ||
        (current as any).dataset?.lineNumber ||
        (current as any).dataset?.line;

      if (lineNum) {
        const num = parseInt(lineNum, 10);
        if (!isNaN(num)) {
          return num;
        }
      }

      // 检查类名中是否包含行号信息
      const className = current.className || '';
      if (typeof className === 'string') {
        const match =
          className.match(/line-(\d+)/) ||
          className.match(/new-line-(\d+)/) ||
          className.match(/line-number-(\d+)/) ||
          className.match(/lineNumber-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            return num;
          }
        }
      }

      // 检查文本内容是否包含行号（行号通常显示在行号列中）
      const textContent = current.textContent || '';
      const lineNumMatch = textContent.match(/^\s*(\d+)\s*$/);
      if (lineNumMatch) {
        const num = parseInt(lineNumMatch[1], 10);
        if (!isNaN(num) && num > 0) {
          return num;
        }
      }

      current = current.parentElement;
    }

    // 如果向上查找失败，尝试在整个 diff 容器中查找包含行号的元素
    // 查找所有可能的行号元素
    if (diffContainerRef.current) {
      const allElements = diffContainerRef.current.querySelectorAll(
        '[data-line-number], [data-new-line-number], [data-new-line], [data-line]'
      );

      // 查找最接近点击位置的元素
      for (const el of Array.from(allElements)) {
        const rect = el.getBoundingClientRect();
        const targetRect = element.getBoundingClientRect();

        // 检查是否在同一行附近
        if (Math.abs(rect.top - targetRect.top) < 50) {
          const lineNum =
            el.getAttribute('data-line-number') ||
            el.getAttribute('data-new-line-number') ||
            el.getAttribute('data-new-line') ||
            el.getAttribute('data-line');

          if (lineNum) {
            const num = parseInt(lineNum, 10);
            if (!isNaN(num)) {
              return num;
            }
          }
        }
      }
    }

    return null;
  };

  // 处理diff视图中的点击事件
  const handleDiffClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!diffFile || !currentContent) return;

    const target = e.target as HTMLElement;

    // 首先检查是否点击在修改的行内
    if (!isModifiedLine(target)) {
      // 如果不在修改的行内，不处理
      return;
    }

    // 提取行号
    const newLineNumber = extractNewLineNumber(target);

    if (!newLineNumber || isNaN(newLineNumber)) {
      // 如果无法提取行号，尝试从diffFile中查找所有修改的行
      // 由于我们不知道具体是哪一行，我们可以尝试找到点击位置对应的行
      try {
        const splitLines = (diffFile as any).splitDiffLines;
        if (splitLines && Array.isArray(splitLines)) {
          // 查找所有修改的行（新增或修改）
          const modifiedLines: Array<{ line: any; lineNum: number }> = [];

          for (const line of splitLines) {
            if (line.type === 'add' || line.type === 'modify') {
              const lineNum = line.newLineNumber || line.lineNumber;
              if (lineNum) {
                modifiedLines.push({ line, lineNum });
              }
            }
          }

          // 如果有修改的行，使用第一个（或者可以尝试根据点击位置判断）
          if (modifiedLines.length > 0) {
            // 尝试找到最接近点击位置的行
            // 这里简化处理，使用第一个修改的行
            const firstModified = modifiedLines[0];
            const offsetRange = getOffsetRangeFromLineNumber(
              firstModified.lineNum
            );
            if (offsetRange) {
              setStartOffset(offsetRange.start);
              setEndOffset(offsetRange.end);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error getting offset from diffFile:', error);
      }
      return;
    }

    // 验证该行是否确实是修改的行（通过diffFile验证）
    try {
      const splitLines = (diffFile as any).splitDiffLines;
      if (splitLines && Array.isArray(splitLines)) {
        let isModified = false;

        for (const line of splitLines) {
          // 检查是否是修改的行（新增或修改）
          if (line.type === 'add' || line.type === 'modify') {
            const lineNum = line.newLineNumber || line.lineNumber;
            if (lineNum === newLineNumber) {
              isModified = true;
              break;
            }
          }
        }

        // 只有确认是修改的行，才设置offset
        if (isModified) {
          const offsetRange = getOffsetRangeFromLineNumber(newLineNumber);
          if (offsetRange) {
            setStartOffset(offsetRange.start);
            setEndOffset(offsetRange.end);
          }
        }
      } else {
        // 如果无法访问splitDiffLines，直接使用行号计算（但只对修改的行有效）
        const offsetRange = getOffsetRangeFromLineNumber(newLineNumber);
        if (offsetRange) {
          setStartOffset(offsetRange.start);
          setEndOffset(offsetRange.end);
        }
      }
    } catch (error) {
      console.error('Error getting offset from line number:', error);
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
          <li>
            点击diff视图中的修改行，会自动填充对应的 startOffset 和 endOffset
          </li>
          <li>
            也可以手动输入 startOffset 和 endOffset，点击"恢复"按钮执行恢复操作
          </li>
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

        {/* 提示信息 */}
        {diffFile && (
          <div
            style={{
              marginBottom: '10px',
              padding: '8px 12px',
              backgroundColor: '#e3f2fd',
              border: '1px solid #90caf9',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#1565c0',
            }}
          >
            💡 提示：可以通过点击 diff line 查看变更行的 offset
          </div>
        )}

        {/* 使用 @git-diff-view/react 显示差异 */}
        <div
          ref={diffContainerRef}
          className="diff-container"
          onClick={handleDiffClick}
          style={{
            marginBottom: '20px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: 'pointer',
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
        <div className="file-comparison" style={{ position: 'relative' }}>
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

          {/* 切换按钮 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            <button
              onClick={handleSwapFiles}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0366d6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0256c2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0366d6';
              }}
              title="切换原始文件和修改后的文件内容"
            >
              ⇄ 切换
            </button>
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
