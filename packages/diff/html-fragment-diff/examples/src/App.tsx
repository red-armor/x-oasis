import React, { useState } from 'react';
import {
  compareHtmlFragments,
  HtmlFragmentDiff,
} from '@x-oasis/html-fragment-diff';
import './index.css';

// 默认示例
const DEFAULT_ORIGINAL = '<h1 class="title primary">Hello World</h1>';
const DEFAULT_FINAL = '<h1 class="title secondary active">Hello React</h1>';

const App: React.FC = () => {
  const [originalFragment, setOriginalFragment] = useState(DEFAULT_ORIGINAL);
  const [finalFragment, setFinalFragment] = useState(DEFAULT_FINAL);
  const [diffResult, setDiffResult] = useState<HtmlFragmentDiff | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleCompare = () => {
    try {
      setParseError(null);
      const result = compareHtmlFragments(originalFragment, finalFragment);
      setDiffResult(result);
    } catch (error: any) {
      setParseError(error.message || '解析失败');
      setDiffResult(null);
    }
  };

  const handleReset = () => {
    setOriginalFragment(DEFAULT_ORIGINAL);
    setFinalFragment(DEFAULT_FINAL);
    setDiffResult(null);
    setParseError(null);
  };

  return (
    <div className="container">
      <h1>HTML Fragment Diff Example</h1>
      <p className="subtitle">对比两个 HTML 片段，检测 class 增删和文本变更</p>

      <div className="info-box">
        <strong>使用说明：</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
          <li>左侧输入原始 HTML 片段，右侧输入最终 HTML 片段</li>
          <li>点击"对比"按钮查看 class 和文本的变更</li>
          <li>支持解析第一个根元素的 tagName、classList、textContent 等</li>
        </ul>
      </div>

      <div className="section">
        <div className="section-title">HTML 片段输入</div>
        <div className="file-comparison">
          <div className="file-panel">
            <div className="file-header">原始片段</div>
            <textarea
              className="file-content"
              value={originalFragment}
              onChange={(e) => setOriginalFragment(e.target.value)}
              placeholder="输入原始 HTML 片段，如: <h1 class='title'>Hello</h1>"
              spellCheck={false}
            />
          </div>
          <div className="file-panel">
            <div className="file-header">最终片段</div>
            <textarea
              className="file-content"
              value={finalFragment}
              onChange={(e) => setFinalFragment(e.target.value)}
              placeholder="输入最终 HTML 片段，如: <h1 class='title active'>World</h1>"
              spellCheck={false}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={handleCompare}>对比</button>
          <button
            onClick={handleReset}
            style={{ background: '#6c757d' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#5a6268';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#6c757d';
            }}
          >
            重置
          </button>
        </div>
      </div>

      {parseError && (
        <div
          className="result-panel"
          style={{ borderColor: '#dc3545', background: '#f8d7da' }}
        >
          <div className="result-title" style={{ color: '#721c24' }}>
            解析错误
          </div>
          <div className="result-content" style={{ color: '#721c24' }}>
            {parseError}
          </div>
        </div>
      )}

      {diffResult && (
        <div className="section">
          <div className="section-title">对比结果</div>

          {/* 解析结果 */}
          <div className="diff-item">
            <div className="diff-item-title">原始片段解析</div>
            {diffResult.original ? (
              <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                <div>
                  <strong>标签名:</strong> {diffResult.original.tagName}
                </div>
                <div>
                  <strong>Class 列表:</strong>{' '}
                  {diffResult.original.classList.length > 0 ? (
                    diffResult.original.classList.map((cls, idx) => (
                      <span key={idx} className="class-added">
                        {cls}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#999' }}>(无)</span>
                  )}
                </div>
                <div>
                  <strong>文本内容:</strong>{' '}
                  {diffResult.original.textContent || '(空)'}
                </div>
                {Object.keys(diffResult.original.otherAttrs).length > 0 && (
                  <div>
                    <strong>其他属性:</strong>{' '}
                    {JSON.stringify(diffResult.original.otherAttrs)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#999' }}>解析失败</div>
            )}
          </div>

          <div className="diff-item">
            <div className="diff-item-title">最终片段解析</div>
            {diffResult.final ? (
              <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                <div>
                  <strong>标签名:</strong> {diffResult.final.tagName}
                </div>
                <div>
                  <strong>Class 列表:</strong>{' '}
                  {diffResult.final.classList.length > 0 ? (
                    diffResult.final.classList.map((cls, idx) => (
                      <span key={idx} className="class-added">
                        {cls}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#999' }}>(无)</span>
                  )}
                </div>
                <div>
                  <strong>文本内容:</strong>{' '}
                  {diffResult.final.textContent || '(空)'}
                </div>
                {Object.keys(diffResult.final.otherAttrs).length > 0 && (
                  <div>
                    <strong>其他属性:</strong>{' '}
                    {JSON.stringify(diffResult.final.otherAttrs)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#999' }}>解析失败</div>
            )}
          </div>

          {/* Class 变更 */}
          <div className="diff-item">
            <div className="diff-item-title">Class 变更</div>
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              {diffResult.classAdded.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#155724' }}>新增的 Class:</strong>
                  <div style={{ marginTop: '4px' }}>
                    {diffResult.classAdded.map((cls, idx) => (
                      <span key={idx} className="class-added">
                        +{cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {diffResult.classRemoved.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#721c24' }}>删除的 Class:</strong>
                  <div style={{ marginTop: '4px' }}>
                    {diffResult.classRemoved.map((cls, idx) => (
                      <span key={idx} className="class-removed">
                        -{cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {diffResult.classAdded.length === 0 &&
                diffResult.classRemoved.length === 0 && (
                  <div style={{ color: '#666' }}>Class 无变更</div>
                )}
            </div>
          </div>

          {/* 文本变更 */}
          <div className="diff-item">
            <div className="diff-item-title">文本变更</div>
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              {diffResult.textChanged ? (
                <div>
                  <div className="text-changed">{diffResult.textSummary}</div>
                  <div style={{ marginTop: '8px' }}>
                    <div>
                      <strong>原始文本:</strong>{' '}
                      {diffResult.textOriginal || '(空)'}
                    </div>
                    <div>
                      <strong>最终文本:</strong>{' '}
                      {diffResult.textFinal || '(空)'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-unchanged">文本无变更</div>
              )}
            </div>
          </div>

          {/* JSON 输出 */}
          <div className="result-panel">
            <div className="result-title">完整 JSON 结果</div>
            <div className="result-content">
              <pre>{JSON.stringify(diffResult, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
