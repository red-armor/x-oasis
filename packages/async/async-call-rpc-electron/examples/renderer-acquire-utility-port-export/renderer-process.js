/**
 * @x-oasis/async-call-rpc-electron — ipcMain + ipcRenderer 示例（渲染进程侧）
 *
 * 本文件在渲染进程中运行（由 main-process.ts 通过 BrowserWindow 加载）。
 *
 * 注意：渲染进程使用 .js 文件而非 .ts，因为 Electron 渲染进程的 V8 环境
 * 不支持 tsx/cjs 等 TypeScript 运行时编译器（Worker 线程不可用）。
 *
 * 本示例展示：
 * 1. 使用 IPCRendererChannel 创建 RPC 通道
 * 2. 通过 clientHost 注册客户端
 * 3. 使用代理调用主进程方法
 */

const { ipcRenderer } = require('electron');
const { IPCRendererChannel } = require('@x-oasis/async-call-rpc-electron');
const { clientHost } = require('@x-oasis/async-call-rpc');

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

  // 1. 获取应用版本号
  const version = await api.getAppVersion();
  log(`App version: ${version}`);

  // 2. 读取单个配置
  const theme = await api.readConfig('theme');
  log(`Theme: ${theme}`);

  // 3. 批量读取配置
  const configs = await api.readConfigBatch(['theme', 'language', 'fontSize']);
  log(`Configs: ${JSON.stringify(configs)}`);

  // 4. 更新配置（多参数用对象包装，因为 RPC handler 只接收一个参数）
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
