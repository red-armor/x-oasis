import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      openSettingWindow: () => Promise<void>;
      onThemeChange: (callback: (theme: string) => void) => void;
    };
  }
}

const THEMES: Record<
  string,
  { bg: string; text: string; card: string; border: string }
> = {
  light: {
    bg: '#f1f5f9',
    text: '#1e293b',
    card: '#ffffff',
    border: '#e2e8f0',
  },
  dark: {
    bg: '#0f172a',
    text: '#e2e8f0',
    card: '#1e293b',
    border: '#334155',
  },
};

function App() {
  const [theme, setTheme] = useState<string>('light');

  useEffect(() => {
    window.electronAPI.onThemeChange((newTheme) => {
      setTheme(newTheme);
    });
  }, []);

  const colors = THEMES[theme] || THEMES.light;

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: colors.bg,
        color: colors.text,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.3s, color 0.3s',
      }}
    >
      <div
        style={{
          background:
            theme === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
              : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          padding: '20px 28px',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>Main Window A</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          Setting Pagelet Example — Theme controlled by Setting Window
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: 32,
        }}
      >
        <div
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            maxWidth: 400,
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 12,
              filter: theme === 'dark' ? 'invert(1)' : 'none',
            }}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Current Theme: {theme}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Open the setting page to change this window's theme
          </div>
        </div>

        <button
          onClick={() => window.electronAPI.openSettingWindow()}
          style={{
            padding: '14px 36px',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            borderRadius: 10,
            backgroundColor: '#3b82f6',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.3)';
          }}
        >
          Open Setting Page
        </button>

        <div
          style={{
            fontSize: 11,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 360,
          }}
        >
          Flow: Window B → Setting Pagelet → Shared/Daemon/Main → Window A
        </div>
      </div>
    </div>
  );
}

export default App;
