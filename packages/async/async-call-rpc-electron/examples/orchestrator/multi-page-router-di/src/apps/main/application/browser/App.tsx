import PageView from '@/apps/connection/application/browser/PageView';

import {
  CONNECTION_PAGE,
  PageConfig,
} from '@/apps/main/application/common/cp-config';
import { CONNECTION_PARTICIPANT_ID } from '@/services/pagelet-host/common';

export type { PageConfig };

function App(): JSX.Element {
  const page = CONNECTION_PAGE;

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
          style={{ padding: '20px 16px', borderBottom: '1px solid #334155' }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#f8fafc',
              letterSpacing: -0.3,
            }}
          >
            Multi-Page (DI)
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Keep Alive + DI
          </div>
        </div>

        <div style={{ padding: '8px' }}>
          <button
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              backgroundColor: `${page.color}25`,
              color: page.color,
              cursor: 'default',
              marginBottom: 2,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: page.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              C
            </span>
            <div>
              <div style={{ lineHeight: '16px' }}>{page.label}</div>
              <div
                style={{
                  fontSize: 10,
                  color: `${page.color}99`,
                  lineHeight: '14px',
                }}
              >
                {page.description}
              </div>
            </div>
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
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
            renderer ↔ {CONNECTION_PARTICIPANT_ID}
            <br />
            {CONNECTION_PARTICIPANT_ID} ↔ shared
            <br />
            {CONNECTION_PARTICIPANT_ID} ↔ daemon
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
        <PageView page={page} />
      </div>
    </div>
  );
}

export default App;
