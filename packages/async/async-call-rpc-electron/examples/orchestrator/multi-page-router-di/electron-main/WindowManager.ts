import { createId, injectable } from '@x-oasis/di';
import { BrowserWindow } from 'electron';
import { join } from 'path';

export interface IWindowManager {
  openMainWindow(): BrowserWindow;
  getMainWindow(): BrowserWindow | null;
}

export const WindowManagerId = createId('WindowManager');

@injectable()
export class WindowManager implements IWindowManager {
  private mainWindow: BrowserWindow | null = null;

  openMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1100,
      height: 750,
      title: 'Multi-Page Router (DI)',
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
