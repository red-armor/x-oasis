import React, { useState } from 'react';
import { resolveGroupChangeFragments } from '@x-oasis/map-diff-range';
import './index.css';

const App: React.FC = () => {
  const [originalContent, setOriginalContent] = useState(
    '<h1 class="text-[--color-text-title] text-2xl font-bold">姓名3333444</h1>'
  );
  const [currentContent, setCurrentContent] = useState(
    '<h1 class="text-[--color-text-title] text-2xl font-bold">姓名3333444</h1>'
  );
  const [finalContent, setFinalContent] = useState(
    '<h1 class="text-2xl font-bold text-[--color-primary-pressing]">姓名3</h1>'
  );
  const [startOffset, setStartOffset] = useState<number>(244);
  const [endOffset, setEndOffset] = useState<number>(315);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    setError(null);
    try {
      const analysis = resolveGroupChangeFragments({
        originalContent,
        currentContent,
        finalContent,
        currentTagOffset: { startOffset, endOffset },
      });

      if (analysis) {
        setResult(analysis);
      } else {
        setError('无法解析变更：offset range 无效或超出范围');
      }
    } catch (err: any) {
      setError(err.message || '分析失败');
    }
  };

  const getDiffEntryClass = (op: number) => {
    if (op === 1) return 'insert';
    if (op === -1) return 'delete';
    return 'equal';
  };

  const getDiffEntryLabel = (op: number) => {
    if (op === 1) return '+';
    if (op === -1) return '-';
    return '=';
  };

  return (
    <div className="container">
      <h1>Map Diff Range - Range Mapping and Change Analysis</h1>
      <p className="subtitle">
        在 originalContent / currentContent / finalContent 之间映射
        range，并分析片段级变更
      </p>

      <div className="info-box">
        <strong>使用说明：</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
          <li>输入三个文件内容：原始内容、当前内容、最终内容</li>
          <li>输入当前文件中发生变更的 range（startOffset 和 endOffset）</li>
          <li>点击"分析变更"查看映射结果和变更分析</li>
          <li>
            系统会自动计算 originalRange 和 finalRange，并分析片段间的变更
          </li>
        </ul>
      </div>

      <div className="section">
        <div className="section-title">文件内容输入</div>
        <div className="file-comparison">
          <div className="file-panel">
            <div className="file-header">原始内容 (originalContent)</div>
            <textarea
              className="file-content"
              value={originalContent}
              onChange={(e) => setOriginalContent(e.target.value)}
              spellCheck={false}
              placeholder="输入原始文件内容..."
            />
          </div>
          <div className="file-panel">
            <div className="file-header">当前内容 (currentContent)</div>
            <textarea
              className="file-content"
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              spellCheck={false}
              placeholder="输入当前文件内容..."
            />
          </div>
          <div className="file-panel">
            <div className="file-header">最终内容 (finalContent)</div>
            <textarea
              className="file-content"
              value={finalContent}
              onChange={(e) => setFinalContent(e.target.value)}
              spellCheck={false}
              placeholder="输入最终文件内容..."
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">变更 Range 输入</div>
        <div className="controls">
          <div className="control-group">
            <label>Start Offset (基于 currentContent)</label>
            <input
              type="number"
              value={startOffset}
              onChange={(e) => setStartOffset(Number(e.target.value))}
              min="0"
            />
          </div>
          <div className="control-group">
            <label>End Offset (基于 currentContent)</label>
            <input
              type="number"
              value={endOffset}
              onChange={(e) => setEndOffset(Number(e.target.value))}
              min="0"
            />
          </div>
          <button onClick={handleAnalyze}>分析变更</button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>错误：</strong> {error}
        </div>
      )}

      {result && (
        <div className="section">
          <div className="section-title">分析结果</div>

          <div className="analysis-panel">
            <div className="analysis-item">
              <strong>Range 映射</strong>
              <div className="analysis-value">
                <div>
                  Original Range:{' '}
                  <span className="range-info">
                    [{result.originalRange.start}, {result.originalRange.end}]
                  </span>
                </div>
                <div style={{ marginTop: '5px' }}>
                  Final Range:{' '}
                  <span className="range-info">
                    [{result.finalRange.start}, {result.finalRange.end}]
                  </span>
                </div>
              </div>
            </div>

            <div className="analysis-item">
              <strong>原始片段 (originalFragment)</strong>
              <div className="analysis-value">{result.originalFragment}</div>
            </div>

            <div className="analysis-item">
              <strong>最终片段 (finalFragment)</strong>
              <div className="analysis-value">{result.finalFragment}</div>
            </div>

            <div className="analysis-item">
              <strong>变更类型</strong>
              <div className="analysis-value">
                <div>
                  Equal:{' '}
                  <span className="range-info">
                    {String(result.changeAnalysis.equal)}
                  </span>
                </div>
                <div>
                  Only Deletion:{' '}
                  <span className="range-info">
                    {String(result.changeAnalysis.onlyDeletion)}
                  </span>
                </div>
                <div>
                  Only Insertion:{' '}
                  <span className="range-info">
                    {String(result.changeAnalysis.onlyInsertion)}
                  </span>
                </div>
                <div>
                  Replacement:{' '}
                  <span className="range-info">
                    {String(result.changeAnalysis.replacement)}
                  </span>
                </div>
              </div>
            </div>

            <div className="analysis-item">
              <strong>变更摘要 (summary)</strong>
              <div className="analysis-value">
                {result.changeAnalysis.summary}
              </div>
            </div>

            <div className="analysis-item">
              <strong>详细 Diff 条目</strong>
              <div className="analysis-value">
                {result.changeAnalysis.diffs.map(
                  (diff: [number, string], index: number) => (
                    <div
                      key={index}
                      className={`diff-entry ${getDiffEntryClass(diff[0])}`}
                    >
                      <span style={{ fontWeight: 'bold', marginRight: '5px' }}>
                        {getDiffEntryLabel(diff[0])}
                      </span>
                      {diff[1]}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="result-panel">
            <div className="result-title">完整结果 (JSON)</div>
            <div className="result-content">
              {JSON.stringify(result, null, 2)}
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">快速测试场景</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="example-btn"
            onClick={() => {
              setOriginalContent('<h1 class="title">Name</h1>');
              setCurrentContent('<h1 class="title text-xl">Name</h1>');
              setFinalContent('<h1 class="text-xl font-bold">Name</h1>');
              setStartOffset(4);
              setEndOffset(30);
            }}
          >
            场景 1: Class 变更
          </button>
          <button
            className="example-btn"
            onClick={() => {
              setOriginalContent('Hello World');
              setCurrentContent('Hello Beautiful World');
              setFinalContent('Hello Amazing World');
              setStartOffset(6);
              setEndOffset(15);
            }}
          >
            场景 2: 文本替换
          </button>
          <button
            className="example-btn"
            onClick={() => {
              setOriginalContent('The quick brown fox');
              setCurrentContent('The fast brown fox');
              setFinalContent('The slow brown fox');
              setStartOffset(4);
              setEndOffset(8);
            }}
          >
            场景 3: 单词替换
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
