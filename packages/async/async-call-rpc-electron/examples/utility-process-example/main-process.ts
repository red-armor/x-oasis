/**
 * @x-oasis/async-call-rpc-electron — UtilityProcess 示例（主进程侧）
 *
 * 这是代码片段示例，不是可独立运行的脚本。
 * 需要在完整的 Electron 主进程环境中使用。
 *
 * 本示例展示：
 * 1. 使用 utilityProcess.fork() 创建子进程
 * 2. 使用 ElectronUtilityProcessChannel 建立 RPC 通道
 * 3. 主进程作为 Client 调用 Utility 进程提供的服务
 * 4. 主进程同时作为 Service 供 Utility 进程回调
 */

import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

import path from 'path';

// ─── 接口定义 ────────────────────────────────────────────────────────────────

/** Utility 进程提供的计算服务接口 */
interface WorkerService {
  /** 处理图片并返回处理后的 Buffer */
  processImage(
    imagePath: string,
    options: {
      width: number;
      height: number;
      quality: number;
    }
  ): Promise<Buffer>;

  /** 压缩文本数据 */
  compress(data: string, algorithm: 'gzip' | 'deflate'): Promise<string>;

  /** 计算文件哈希 */
  hashFile(filePath: string): Promise<string>;

  /** 执行重量级数据分析 */
  analyzeData(data: number[]): Promise<{
    mean: number;
    median: number;
    stddev: number;
  }>;
}

// ─── Fork Utility 进程并建立 RPC 通道 ────────────────────────────────────────

function createWorker() {
  // fork 一个 Utility 进程
  // 注意：入口文件路径需要是编译后的 JS 文件
  const child = utilityProcess.fork(path.join(__dirname, 'utility-worker.js'));

  // 使用 ElectronUtilityProcessChannel 包装子进程
  // 主进程侧传入 `process` 参数
  const channel = new ElectronUtilityProcessChannel({
    process: child,
    description: 'main→utility worker RPC',
  });

  // ── 主进程作为 Client ──
  // 调用 Utility 进程中注册的服务
  const worker = clientHost
    .registerClient('worker', { channel })
    .createProxy<WorkerService>();

  // ── 主进程同时作为 Service（可选） ──
  // 让 Utility 进程可以回调主进程的方法
  serviceHost.registerService('main-callbacks', {
    channel,
    serviceHost,
    handlers: {
      /** 报告进度 */
      reportProgress: (taskId: string, progress: number) => {
        console.log(`[Task ${taskId}] Progress: ${progress}%`);
      },

      /** 记录日志到主进程 */
      log: (level: string, message: string) => {
        console.log(`[Utility][${level}] ${message}`);
      },
    },
  });

  return { child, worker, channel };
}

// ─── 使用示例 ────────────────────────────────────────────────────────────────

async function main() {
  const { worker, child } = createWorker();

  // 等待子进程就绪（可根据实际情况调整）
  await new Promise<void>((resolve) => {
    child.on('spawn', resolve);
  });

  try {
    // 1. 调用图片处理
    const result = await worker.processImage('/path/to/image.png', {
      width: 800,
      height: 600,
      quality: 85,
    });
    console.log('Image processed, buffer size:', result.length);

    // 2. 数据压缩
    const compressed = await worker.compress(
      'Hello, World! '.repeat(1000),
      'gzip'
    );
    console.log('Compressed data length:', compressed.length);

    // 3. 文件哈希
    const hash = await worker.hashFile('/path/to/large-file.bin');
    console.log('File hash:', hash);

    // 4. 数据分析
    const stats = await worker.analyzeData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    console.log('Analysis result:', stats);
    // { mean: 5.5, median: 5.5, stddev: 2.87 }
  } catch (error) {
    console.error('Worker error:', error);
  }
}

main().catch(console.error);

// ─── 生命周期说明 ────────────────────────────────────────────────────────────
//
// - 调用 channel.disconnect() 会自动 kill 子进程
// - 子进程异常退出时，channel 会自动断开
// - 建议在 app.quit 时手动清理：
//
// app.on('will-quit', () => {
//   channel.disconnect();
// });
