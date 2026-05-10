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

import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '../../../src/electron-browser/index.js';
import { clientHost } from '@x-oasis/async-call-rpc';

// ─── 定义远程服务接口（与主进程注册的 handlers 对应） ──────────────────────────

interface AppAPI {
  getAppVersion(): Promise<string>;
  readConfig(key: string): Promise<unknown>;
  readConfigBatch(keys: string[]): Promise<Record<string, unknown>>;
  openDialog(options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string[]>;
  updateConfig(params: { key: string; value: unknown }): Promise<boolean>;
}

// ─── 创建 RPC 通道 ───────────────────────────────────────────────────────────

// channelName 必须与主进程的 IPCMainChannel 一致
const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'my-electron-app',
  description: 'renderer→main RPC channel',
});

// ─── 注册 RPC 客户端 ─────────────────────────────────────────────────────────

// servicePath 必须与主进程 registerService 的第一个参数一致
const api = clientHost.registerClient('api', { channel }).createProxy<AppAPI>();

// ─── 使用示例 ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
  const el = document.getElementById('output');
  if (el) el.textContent += `${msg}\n`;
}

async function main() {
  const el = document.getElementById('output');
  if (el) el.textContent = '';

  // 1. 获取应用版本号
  const version = await api.getAppVersion();
  log(`App version: ${version}`);

  // 2. 读取单个配置
  const theme = await api.readConfig('theme');
  log(`Theme: ${theme}`);

  // 3. 批量读取配置
  const configs = await api.readConfigBatch(['theme', 'language', 'fontSize']);
  log(`Configs: ${JSON.stringify(configs)}`);

  // 4. 更新配置
  const success = await api.updateConfig({ key: 'theme', value: 'light' });
  log(`Config updated: ${success}`);

  // 5. 验证更新结果
  const newTheme = await api.readConfig('theme');
  log(`New theme: ${newTheme}`);

  log('\n=== All RPC calls completed ===');
}

main().catch(console.error);

// ─── 断开连接 ────────────────────────────────────────────────────────────────
//
// 页面卸载时可以主动断开：
// window.addEventListener('beforeunload', () => {
//   channel.disconnect();
// });
