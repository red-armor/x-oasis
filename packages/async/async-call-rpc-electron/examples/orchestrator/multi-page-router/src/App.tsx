import { useState } from 'react';
import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import PageView from './PageView';

const PAGES = [
  {
    id: 'pageA',
    label: 'Page A',
    icon: 'A',
    color: '#3b82f6',
    description: 'Dashboard & Monitoring',
  },
  {
    id: 'pageB',
    label: 'Page B',
    icon: 'B',
    color: '#8b5cf6',
    description: 'Configuration & Settings',
  },
  {
    id: 'pageC',
    label: 'Page C',
    icon: 'C',
    color: '#10b981',
    description: 'System & Diagnostics',
  },
] as const;

export type PageConfig = (typeof PAGES)[number];

export function getPageletId(pageId: string): string {
  return `pagelet-${pageId.replace('page', '').toUpperCase()}`;
}

export const client = createOrchestratorClient({
  directChannelDescription: 'renderer↔preload',
  ipcChannelDescription: 'renderer↔preload:ipc',
});

export const pageletClient = client.getService<any>('pagelet-api');

function App(): JSX.Element {
  const [activePageId, setActivePageId] = useState<string>('pageA');
  const [visited, setVisited] = useState<Set<string>>(new Set(['pageA']));

  const currentPage = PAGES.find((p) => p.id === activePageId) || PAGES[0];
  const pageletId = getPageletId(activePageId);

  const handleSwitch = (pageId: string) => {
    if (pageId === activePageId) return;
    setActivePageId(pageId);
    setVisited((prev) => {
      if (prev.has(pageId)) return prev;
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });
  };

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#f1f5f9',
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 200,
          backgroundColor: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: '20px 16px',
            borderBottom: '1px solid #334155',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#f8fafc',
              letterSpacing: -0.3,
            }}
          >
            Multi-Page
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              marginTop: 2,
            }}
          >
            Keep Alive
          </div>
        </div>

        <div style={{ padding: '8px' }}>
          {PAGES.map((page) => {
            const active = page.id === activePageId;
            return (
              <button
                key={page.id}
                onClick={() => handleSwitch(page.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: active ? `${page.color}25` : 'transparent',
                  color: active ? page.color : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: 2,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: active ? page.color : '#475569',
                    color: active ? '#fff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {page.icon}
                </span>
                <div>
                  <div style={{ lineHeight: '16px' }}>{page.label}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: active ? `${page.color}99` : '#64748b',
                      lineHeight: '14px',
                    }}
                  >
                    {page.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #334155',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#64748b',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Topology
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#94a3b8',
              lineHeight: '16px',
              fontFamily: 'monospace',
            }}
          >
            renderer ↔ {pageletId}
            <br />
            {pageletId} ↔ shared
            <br />
            {pageletId} ↔ daemon
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {PAGES.map((page) => {
          const active = page.id === activePageId;
          const shouldRender = visited.has(page.id);
          if (!shouldRender) return null;
          return (
            <div
              key={page.id}
              style={{
                flex: 1,
                display: active ? 'flex' : 'none',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              <PageView page={page} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
