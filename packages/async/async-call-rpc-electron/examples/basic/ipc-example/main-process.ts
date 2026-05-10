/**
 * @x-oasis/async-call-rpc-electron — ipcMain + ipcRenderer 示例（主进程侧）
 *
 * 启动方式：
 *   cd packages/async/async-call-rpc-electron/examples/ipc-example
 *   npm install    # 安装 electron（约 90MB 下载）
 *   npm start      # 启动 Electron 应用
 *
 * 本示例展示：
 * 1. 创建 BrowserWindow
 * 2. 使用 IPCMainChannel 建立 RPC 通道
 * 3. 注册服务并提供可远程调用的方法
 */

import { app, BrowserWindow, dialog } from 'electron';
import { IPCMainChannel } from '../../../src/electron-main/index.js';
import { serviceHost } from '@x-oasis/async-call-rpc';
import path from 'path';

// ─── 模拟的应用配置 ─────────────────────────────────────────────────────────

const appConfig: Record<string, unknown> = {
  theme: 'dark',
  language: 'zh-CN',
  fontSize: 14,
  autoSave: true,
};

// ─── 创建窗口并建立 RPC 通道 ─────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 加载渲染进程页面
  win.loadFile(path.join(__dirname, 'index.html'));

  // 开发调试：打开 DevTools（取消下行注释可以查看渲染进程日志）
  // win.webContents.openDevTools();

  // ── 创建 RPC 通道 ──
  // channelName 必须与渲染进程的 IPCRendererChannel 一致
  const channel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: win.webContents,
    description: 'main→renderer RPC channel',
  });

  // ── 注册 RPC 服务 ──
  // 渲染进程可以通过 clientHost 调用这些方法
  serviceHost.registerService('api', {
    channel,
    serviceHost,
    handlers: {
      /**
       * 获取应用版本号
       */
      getAppVersion: () => {
        return app.getVersion();
      },

      /**
       * 读取配置项
       * @param key - 配置键名
       * @returns 配置值，不存在时返回 undefined
       */
      readConfig: (key: string) => {
        return appConfig[key];
      },

      /**
       * 批量读取配置
       * @param keys - 配置键名数组
       * @returns 键值对对象
       */
      readConfigBatch: (keys: string[]) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = appConfig[key];
        }
        return result;
      },

      /**
       * 打开文件选择对话框
       * @param options - 对话框选项
       * @returns 用户选择的文件路径数组
       */
      openDialog: async (options?: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => {
        const result = await dialog.showOpenDialog(win, {
          title: options?.title ?? '选择文件',
          filters: options?.filters ?? [
            { name: '所有文件', extensions: ['*'] },
          ],
          properties: ['openFile', 'multiSelections'],
        });
        return result.filePaths;
      },

      /**
       * 更新配置项
       * 注意：RPC 框架只传递第一个参数给 handler，
       * 所以多参数需要用对象包装。
       * @param params - { key: 配置键名, value: 配置值 }
       */
      updateConfig: (params: { key: string; value: unknown }) => {
        appConfig[params.key] = params.value;
        return true;
      },
    },
  });

  return win;
}

// ─── 应用启动 ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
});

// ─── 多窗口场景 ──────────────────────────────────────────────────────────────
//
// 每个 BrowserWindow 需要独立的 IPCMainChannel 实例。
// IPCMainChannel 会根据 event.sender 过滤消息，
// 确保不同窗口的消息不会互相干扰。
//
// function createSecondWindow() {
//   const win2 = new BrowserWindow({ /* ... */ });
//   const channel2 = new IPCMainChannel({
//     channelName: 'app-rpc',           // 可以使用相同的 channelName
//     webContents: win2.webContents,     // 但必须绑定不同的 webContents
//     description: 'main→renderer (window 2)',
//   });
//   serviceHost.registerService('api-win2', {
//     channel: channel2,
//     serviceHost,
//     handlers: { /* ... */ },
//   });
// }
