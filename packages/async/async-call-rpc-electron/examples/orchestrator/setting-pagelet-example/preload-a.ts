import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openSettingWindow: () => ipcRenderer.invoke('open-setting-window'),
  onThemeChange: (callback: (theme: string) => void) => {
    ipcRenderer.on('theme-change', (_event, theme) => callback(theme));
  },
});
