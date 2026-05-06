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

import { app, BrowserWindow, MessageChannelMain } from 'electron';
import { IPCMainChannel } from '../../src/index.ts';
import { serviceHost } from '@x-oasis/async-call-rpc';
import path from 'path';

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
      acquirePort(): Electron.MessagePortMain {
        const { port1, port2 } = new MessageChannelMain();
        return port1;
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
