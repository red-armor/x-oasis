'use strict';
/**
 * @x-oasis/async-call-rpc-electron — ipcMain + ipcRenderer 示例（渲染进程侧）
 *
 * 本文件在渲染进程中运行（由 main-process.ts 通过 BrowserWindow 加载）。
 *
 * 本示例展示：
 * 1. 使用 IPCRendererChannel 创建 RPC 通道
 * 2. 通过 clientHost 注册客户端
 * 3. 使用类型安全的代理调用主进程方法
 */
Object.defineProperty(exports, '__esModule', { value: true });
const electron_1 = require('electron');
const { IPCRendererChannel } = require('@x-oasis/async-call-rpc-electron');
const { clientHost } = require('@x-oasis/async-call-rpc');
// ─── 创建 RPC 通道 ───────────────────────────────────────────────────────────
// channelName 必须与主进程的 IPCMainChannel 一致
const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer: electron_1.ipcRenderer,
  projectName: 'my-electron-app',
  description: 'renderer→main RPC channel',
});
// ─── 注册 RPC 客户端 ─────────────────────────────────────────────────────────
// servicePath 必须与主进程 registerService 的第一个参数一致
const api = clientHost.registerClient('api', { channel }).createProxy();
// ─── 使用示例 ────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(msg);
  const el = document.getElementById('output');
  if (el) el.textContent += `${msg}\n`;
}
async function main() {
  const el = document.getElementById('output');
  if (el) el.textContent = '';
  const port = await api.acquirePort();
  console.log('port ', port);
}
main().catch(console.error);
// ─── 断开连接 ────────────────────────────────────────────────────────────────
//
// 页面卸载时可以主动断开：
// window.addEventListener('beforeunload', () => {
//   channel.disconnect();
// });
